from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from app.database import get_pool
from app.db_handler import handle_db_request
from app.dependencies import authenticate
from app.rate_limit import limiter

router = APIRouter()

PG_ERROR_MESSAGES = {
    "23505": "A record with that value already exists",
    "23503": "A related record is missing or still in use",
    "22P02": "One or more values have an invalid format",
}


@router.post("/api/db")
@limiter.limit("120/minute")
async def db_request(request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    try:
        current_user = await authenticate(request, pool)
        try:
            body = await request.json()
        except Exception:
            body = {}
        result = await handle_db_request(pool, body or {}, current_user)
        return result
    except HTTPException:
        raise
    except ValueError as error:
        return JSONResponse(
            status_code=400,
            content={"data": None, "error": {"message": str(error)}},
        )
    except asyncpg.PostgresError as error:
        print(f"DB error: {error}")
        code = getattr(error, "sqlstate", None)
        message = PG_ERROR_MESSAGES.get(code, "Database operation failed")
        status_code = 400 if code else 500
        return JSONResponse(
            status_code=status_code,
            content={"data": None, "error": {"message": message}},
        )
    except Exception as error:
        if isinstance(error, HTTPException):
            raise
        status = getattr(error, "status", None)
        if status == 400:
            return JSONResponse(
                status_code=400,
                content={"data": None, "error": {"message": str(error)}},
            )
        print(f"DB error: {error}")
        return JSONResponse(
            status_code=500,
            content={"data": None, "error": {"message": "Database operation failed"}},
        )
