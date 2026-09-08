from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

import asyncpg

from app.config import settings
from app.database import get_pool
from app.services.ai_router import configured_providers, describe_ai_routing, is_ai_configured
from app.services import supabase_storage

router = APIRouter()


def _database_hint(error: Exception) -> str:
    if isinstance(error, asyncpg.PostgresError):
        code = getattr(error, "sqlstate", "") or ""
        message = str(error).lower()
        if code == "28P01" or "password authentication failed" in message:
            return "PostgreSQL rejected the password in DATABASE_URL."
        if "connection refused" in message or code in ("08001",):
            return "PostgreSQL is not reachable on DATABASE_URL."
        if "prepared statement" in message or code in ("26000", "08P01"):
            return (
                "Supabase pooler connection failed. Use the Session pooler URI "
                "(port 6543) with ?sslmode=require in Vercel DATABASE_URL."
            )
        if code == "42P01":
            return "Database tables missing. Run exports/connecthub-schema-only.sql in Supabase SQL Editor."
    if isinstance(error, OSError):
        return "PostgreSQL is not reachable on DATABASE_URL."
    detail = str(error).strip()
    if detail:
        return f"The API cannot query PostgreSQL. ({detail})"
    return "The API cannot query PostgreSQL."


@router.get("/api/health")
async def health():
    ai_status = "configured" if is_ai_configured() else "missing"
    ingest_storage = supabase_storage.describe_storage()
    result = {
        "application": "ok",
        "database": "error",
        "storage": "ok",
        "ingestStorage": ingest_storage,
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
        result["databaseHint"] = _database_hint(error)
        return JSONResponse(status_code=503, content=result)
    except OSError as error:
        result["databaseHint"] = _database_hint(error)
        return JSONResponse(status_code=503, content=result)
    except Exception as error:
        result["databaseHint"] = _database_hint(error)
        return JSONResponse(status_code=503, content=result)


@router.get("/api/ready")
async def ready():
    try:
        pool = await get_pool()
        await pool.fetchval("SELECT 1")
        return {"ready": True}
    except Exception:
        return JSONResponse(status_code=503, content={"ready": False})

