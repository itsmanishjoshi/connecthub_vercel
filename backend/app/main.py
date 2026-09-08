from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.branding import branding_paths, refresh_jelly_logo
from app.config import FRONTEND_ROOT, settings
from app.database import close_pool, init_pool
from app.db_handler import ensure_attendee_photo_columns
from app.rate_limit import limiter
from app.routes import api_router
from app.security import (
    is_blocked_public_upload_path,
    resolve_upload_file,
    security_headers,
    upload_bucket_and_name,
)
from app.dependencies import authenticate
from app.database import get_pool
from app.upload_access import can_access_upload
from app.services.ai_usage_context import reset_ai_log_context, set_ai_log_context, should_track_ai_usage
from app.services.analytics import ensure_analytics_schema
from app.services.asset_library import ensure_asset_library, register_asset_routes


def _ensure_upload_dirs() -> None:
    for path in (settings.upload_dir, settings.private_upload_dir, settings.ingest_upload_dir):
        try:
            path.mkdir(parents=True, exist_ok=True)
        except OSError as error:
            print(f"Could not create upload dir {path}: {error}", file=sys.stderr)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.is_production and settings.insecure_auth_secret:
        print("Production requires a strong AUTH_SECRET in backend/.env", file=sys.stderr)
        raise SystemExit(1)
    if settings.serve_static and settings.insecure_auth_secret:
        print("Office serving requires a strong AUTH_SECRET in backend/.env", file=sys.stderr)
        raise SystemExit(1)
    if settings.is_production and not settings.allowed_origins:
        print("Production requires ALLOWED_ORIGINS (or deploy on Vercel with VERCEL_URL).", file=sys.stderr)
        raise SystemExit(1)
    if settings.insecure_auth_secret:
        print("AUTH_SECRET is not set; using a development default. Set AUTH_SECRET for office use.")

    _ensure_upload_dirs()

    pool = None
    try:
        pool = await init_pool()
    except Exception as error:
        print(f"Database pool init failed: {error}", file=sys.stderr)

    if pool is not None:
        register_asset_routes(api_router, pool, settings.upload_dir)
        try:
            await ensure_attendee_photo_columns(pool)
            await ensure_asset_library(pool)
            await ensure_analytics_schema(pool)
        except Exception as error:
            print(f"Could not prepare database columns: {error}", file=sys.stderr)

    if settings.serve_static and not getattr(app.state, "spa_mounted", False):
        _mount_spa_routes(app)
        app.state.spa_mounted = True

    yield
    await close_pool()


app = FastAPI(lifespan=lifespan)
app.include_router(api_router)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"message": str(exc.detail)}},
    )


if not settings.is_production and not settings.allowed_origins:
    print("ALLOWED_ORIGINS is empty; browsers from any origin can call the API during development.")

if settings.allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-ConnectHub-Token"],
    )
elif settings.is_production:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-ConnectHub-Token"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-ConnectHub-Token"],
    )


@app.middleware("http")
async def ai_usage_context_middleware(request: Request, call_next):
    """Attach user/route context so any AI call through complete() is logged automatically."""
    if not should_track_ai_usage(request.method, request.url.path):
        return await call_next(request)
    token = None
    try:
        pool = await get_pool()
        try:
            user = await authenticate(request, pool)
            token = set_ai_log_context(
                pool=pool,
                user_id=str(user["id"]),
                route=request.url.path,
            )
        except HTTPException:
            pass
        return await call_next(request)
    finally:
        if token is not None:
            reset_ai_log_context(token)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    for key, value in security_headers().items():
        response.headers.setdefault(key, value)
    return response


@app.middleware("http")
async def uploads_guard_middleware(request: Request, call_next):
    if request.method in ("GET", "HEAD") and request.url.path.startswith("/uploads/"):
        subpath = request.url.path[len("/uploads") :]
        if is_blocked_public_upload_path(subpath):
            bucket, file_name = upload_bucket_and_name(subpath.lstrip("/"))
            if bucket and file_name:
                try:
                    pool = await get_pool()
                    user = await authenticate(request, pool)
                    if await can_access_upload(pool, user, bucket, file_name):
                        full = resolve_upload_file(settings.upload_dir, subpath.lstrip("/"))
                        if full:
                            return FileResponse(
                                full,
                                headers={"Cache-Control": "private, max-age=3600"},
                            )
                except HTTPException:
                    pass
            return JSONResponse(status_code=404, content=None)
    return await call_next(request)


_ensure_upload_dirs()
try:
    app.mount("/uploads", StaticFiles(directory=str(settings.upload_dir)), name="uploads")
except RuntimeError as error:
    print(f"Uploads mount skipped: {error}", file=sys.stderr)


def _mount_spa_routes(app: FastAPI) -> None:
    dist_dir = settings.frontend_dist
    branding = branding_paths(FRONTEND_ROOT)

    @app.get("/connecthub-logo.png")
    async def connecthub_logo():
        path = branding["connectHub"]
        if not path.is_file():
            return JSONResponse(status_code=404, content=None)
        return FileResponse(path, headers={"Cache-Control": "no-cache, must-revalidate"})

    @app.get("/jelly-logo.png")
    async def jelly_logo():
        refresh_jelly_logo(FRONTEND_ROOT)
        path = branding["jelly"]
        if not path.is_file():
            return JSONResponse(status_code=404, content=None)
        return FileResponse(path, headers={"Cache-Control": "no-cache, must-revalidate"})

    if not dist_dir.is_dir():
        print("frontend/dist not found. Run npm run build in frontend before SERVE_STATIC.")
        return

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        if full_path.startswith("api") or full_path.startswith("uploads"):
            return JSONResponse(status_code=404, content={"error": {"message": "Not found"}})
        file_path = dist_dir / full_path
        if full_path and file_path.is_file():
            cache = "no-cache"
            name = file_path.name
            if name in {
                "index.html",
                "sw.js",
                "registerSW.js",
                "connecthub-logo.png",
                "jelly-logo.png",
                "jelly - logo.png",
            } or name.endswith(".webmanifest"):
                cache = "no-cache"
            elif "assets" in file_path.parts:
                cache = "public, max-age=31536000, immutable"
            return FileResponse(file_path, headers={"Cache-Control": cache})
        index = dist_dir / "index.html"
        return FileResponse(index, headers={"Cache-Control": "no-cache"})


def main() -> None:
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=not settings.is_production,
    )


if __name__ == "__main__":
    main()
