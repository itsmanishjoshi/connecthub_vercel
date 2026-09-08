from __future__ import annotations

from pathlib import Path

import asyncpg
from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse, Response

from app.config import settings
from app.database import get_pool
from app.dependencies import api_error, authenticate
from app.rate_limit import limiter
from app.security import (
    issue_media_token,
    resolve_upload_file,
    upload_bucket_and_name,
    verify_media_token,
)
from app.upload_access import can_access_upload

router = APIRouter()


@router.post("/api/media/token")
@limiter.limit("60/minute")
async def create_media_token(request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    user = await authenticate(request, pool)
    try:
        body = await request.json()
    except Exception:
        body = {}
    relative_path = str(body.get("path") or "").replace("\\", "/").lstrip("/")
    if not relative_path or ".." in relative_path.split("/"):
        raise api_error(400, "Invalid file path")
    bucket, file_name = upload_bucket_and_name(relative_path)
    if not bucket or not file_name:
        raise api_error(400, "Invalid file path")
    if not await can_access_upload(pool, user, bucket, file_name):
        raise api_error(403, "You cannot access this file")
    full = resolve_upload_file(settings.upload_dir, relative_path)
    if not full:
        raise api_error(404, "File not found")
    token = issue_media_token(relative_path)
    return {"token": token, "url": f"/api/media/{token}"}


@router.get("/api/media/{token}")
async def serve_media(token: str):
    relative_path = verify_media_token(token)
    if not relative_path:
        return Response(status_code=401)
    full = resolve_upload_file(settings.upload_dir, relative_path)
    if not full:
        return Response(status_code=404)
    suffix = Path(relative_path).suffix.lower()
    media_type = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".pdf": "application/pdf",
        ".webm": "audio/webm",
        ".mp3": "audio/mpeg",
    }.get(suffix, "application/octet-stream")
    return FileResponse(
        full,
        media_type=media_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )
