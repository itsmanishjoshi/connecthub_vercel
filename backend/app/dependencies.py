from __future__ import annotations

from typing import Any

import asyncpg
from fastapi import Depends, HTTPException, Request

from app.auth import read_bearer, verify_token
from app.database import get_pool, record_to_dict


def api_error(status_code: int, message: str, **extra: Any) -> HTTPException:
    body: dict[str, Any] = {"error": {"message": message}}
    if extra:
        body.update(extra)
    return HTTPException(status_code=status_code, detail=body)


def db_error(status_code: int, message: str, code: str | None = None) -> HTTPException:
    err: dict[str, Any] = {"message": message}
    if code:
        err["code"] = code
    return HTTPException(status_code=status_code, detail={"data": None, "error": err})


from app.config import settings


async def authenticate(
    request: Request,
    pool: asyncpg.Pool,
    allow_query_token: bool = False,
) -> dict[str, Any]:
    token = read_bearer(request)
    if not token and allow_query_token and not settings.is_production:
        token = request.query_params.get("access_token")
    session = verify_token(token)
    if not session:
        raise api_error(401, "Authentication required")

    row = await pool.fetchrow(
        """SELECT id, username, email, is_admin, is_first_login, status, password_changed
             FROM users
            WHERE id = $1 AND deleted_at IS NULL AND status <> 'dead'
            LIMIT 1""",
        session["sub"],
    )
    if not row:
        raise api_error(401, "Session is no longer valid")
    return record_to_dict(row) or {}


async def get_current_user(
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
) -> dict[str, Any]:
    return await authenticate(request, pool)


def require_admin(user: dict[str, Any] | None) -> None:
    if not user or not user.get("is_admin"):
        raise api_error(403, "Administrator access required")
