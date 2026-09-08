from __future__ import annotations

import re

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth import (
    hash_password,
    sign_token,
    verify_password,
)
from app.database import get_pool, record_to_dict
from app.dependencies import api_error, authenticate, get_current_user
from app.rate_limit import limiter
from app.security import validate_password

router = APIRouter()


def public_user(row: dict | None) -> dict | None:
    if not row:
        return None
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "isAdmin": bool(row.get("is_admin")),
        "status": row.get("status"),
        "passwordChanged": row.get("password_changed") is True,
        "isFirstLogin": row.get("is_first_login") is True,
        "mustChangePassword": (
            not row.get("is_admin")
            and row.get("password_changed") is not True
            and (
                row.get("is_first_login") is True
                or row.get("status") == "initialized"
            )
        ),
    }


def map_profile(row: dict | None, is_admin: bool) -> dict | None:
    if not row:
        return None
    return {
        "id": row["id"],
        "email": row.get("email"),
        "first_name": row.get("first_name"),
        "last_name": row.get("last_name"),
        "company": row.get("company"),
        "avatar_url": row.get("avatar_url"),
        "designation": row.get("designation"),
        "location": row.get("location"),
        "mobile_no": row.get("mobile_no"),
        "linkedin_url": row.get("linkedin_url"),
        "profile_completed": row.get("profile_completed"),
        "is_admin": is_admin,
    }


def normalize_username(value: str | None) -> str:
    return str(value or "").strip().lower()


@router.post("/api/auth/login")
@limiter.limit("10/15minutes")
async def login(request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    try:
        try:
            body = await request.json()
        except Exception:
            body = {}
        username = normalize_username(body.get("username"))
        password = str(body.get("password") or "")
        if not username or not password:
            raise api_error(400, "Username and password required")
        row = await pool.fetchrow(
            "SELECT * FROM users WHERE lower(username) = $1 AND deleted_at IS NULL LIMIT 1",
            username,
        )
        user = record_to_dict(row)
        if not user or not await verify_password(password, user.get("password_hash")):
            raise api_error(401, "Invalid username or password")
        await pool.execute("UPDATE users SET last_login_at = NOW() WHERE id = $1", user["id"])
        profile_row = await pool.fetchrow(
            "SELECT * FROM user_profiles WHERE user_id = $1 LIMIT 1",
            user["id"],
        )
        profile = record_to_dict(profile_row)
        token = sign_token(str(user["id"]))
        return {
            "token": token,
            "user": public_user(user),
            "profile": map_profile(profile, bool(user.get("is_admin"))),
        }
    except HTTPException:
        raise
    except Exception as error:
        print(f"Login error: {error}")
        raise api_error(500, "Login failed")


@router.get("/api/auth/me")
async def me(request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    user = await authenticate(request, pool)
    profile_row = await pool.fetchrow(
        "SELECT * FROM user_profiles WHERE user_id = $1 LIMIT 1",
        user["id"],
    )
    profile = record_to_dict(profile_row)
    return {
        "user": public_user(user),
        "profile": map_profile(profile, bool(user.get("is_admin"))),
    }


@router.post("/api/auth/change-password")
@limiter.limit("10/15minutes")
async def change_password(request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    user = await authenticate(request, pool)
    try:
        body = await request.json()
    except Exception:
        body = {}
    current_password = str(body.get("currentPassword") or "")
    new_password = str(body.get("newPassword") or "")
    if password_error := validate_password(new_password):
        raise api_error(400, password_error)
    found = await pool.fetchrow("SELECT password_hash FROM users WHERE id = $1", user["id"])
    if not found or not await verify_password(current_password, found["password_hash"]):
        raise api_error(400, "Current password is incorrect")
    await pool.execute(
        """UPDATE users
              SET password_hash = $1, password_changed = true,
                  password_changed_at = NOW(), status = 'active'
            WHERE id = $2""",
        await hash_password(new_password),
        user["id"],
    )
    return {"ok": True}


@router.delete("/api/auth/account")
@limiter.limit("10/15minutes")
async def delete_account(request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    user = await authenticate(request, pool)
    try:
        body = await request.json()
    except Exception:
        body = {}
    password = str(body.get("password") or "")
    found = await pool.fetchrow("SELECT password_hash FROM users WHERE id = $1", user["id"])
    if not found or not await verify_password(password, found["password_hash"]):
        raise api_error(400, "Password is incorrect")
    await pool.execute(
        "UPDATE users SET deleted_at = NOW(), status = 'dead' WHERE id = $1",
        user["id"],
    )
    return {"ok": True}
