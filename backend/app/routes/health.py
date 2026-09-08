from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

import asyncpg

from app.config import settings
from app.database import get_pool
from app.services.ai_router import configured_providers, describe_ai_routing, is_ai_configured

router = APIRouter()


@router.get("/api/health")
async def health():
    ai_status = "configured" if is_ai_configured() else "missing"
    result = {
        "application": "ok",
        "database": "error",
        "storage": "ok",
        "ai": ai_status,
    }
    if is_ai_configured():
        result["aiProviders"] = configured_providers()
        result["aiRouting"] = describe_ai_routing()
    try:
        pool = await get_pool()
        await pool.fetchval("SELECT 1")
        result["database"] = "ok"
        return result
    except asyncpg.PostgresError as error:
        code = getattr(error, "sqlstate", "")
        if code == "28P01":
            result["databaseHint"] = "PostgreSQL rejected the password in DATABASE_URL."
        elif "connection refused" in str(error).lower() or code in ("08001", "ECONNREFUSED"):
            result["databaseHint"] = "PostgreSQL is not reachable on DATABASE_URL."
        else:
            result["databaseHint"] = "The API cannot query PostgreSQL."
        return JSONResponse(status_code=503, content=result)
    except OSError:
        result["databaseHint"] = "PostgreSQL is not reachable on DATABASE_URL."
        return JSONResponse(status_code=503, content=result)
    except Exception as error:
        result["databaseHint"] = str(error) or "Database connection failed."
        return JSONResponse(status_code=503, content=result)


@router.get("/api/ready")
async def ready():
    try:
        pool = await get_pool()
        await pool.fetchval("SELECT 1")
        return {"ready": True}
    except Exception:
        return JSONResponse(status_code=503, content={"ready": False})

