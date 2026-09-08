from __future__ import annotations

import re

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth import hash_password
from app.database import get_pool
from app.dependencies import api_error, authenticate, require_admin
from app.security import validate_password
from app.services.analytics import log_activity
from app.services.event_export import (
    build_user_event_export,
    list_user_export_events,
)

router = APIRouter()


def normalize_username(value: str | None) -> str:
    return str(value or "").strip().lower()


def is_valid_username(value: str) -> bool:
    return (
        bool(re.fullmatch(r"[a-z][a-z0-9]*(?:[._][a-z0-9]+)*", value))
        and 3 <= len(value) <= 40
    )


def ident(name: str) -> str:
    return f'"{name}"'


@router.get("/api/admin/users")
async def list_users(request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    user = await authenticate(request, pool)
    require_admin(user)
    rows = await pool.fetch(
        """
        SELECT u.id, u.username, u.email, u.is_admin, u.is_first_login, u.status,
               u.password_changed, u.password_changed_at, u.last_login_at,
               u.created_at, u.deleted_at,
               CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object(
                 'first_name', p.first_name,
                 'last_name', p.last_name,
                 'company', p.company,
                 'email', p.email,
                 'profile_completed', p.profile_completed
               ) END AS profile
          FROM users u
          LEFT JOIN user_profiles p ON p.user_id = u.id
         WHERE u.deleted_at IS NULL AND u.is_admin = false
         ORDER BY u.created_at DESC
        """
    )
    return {"data": [dict(row) for row in rows]}


@router.post("/api/admin/users", status_code=201)
async def create_user(request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    admin = await authenticate(request, pool)
    require_admin(admin)
    try:
        body = await request.json()
    except Exception:
        body = {}
    username = normalize_username(body.get("username"))
    email = str(body.get("email") or "").strip().lower()
    password = str(body.get("password") or "")
    if not is_valid_username(username):
        raise api_error(
            400,
            "Username should look like john.paul (3–40 characters).",
        )
    if password_error := validate_password(password):
        raise api_error(400, password_error)
    try:
        existing = await pool.fetchrow(
            "SELECT id, deleted_at FROM users WHERE lower(username) = $1",
            username,
        )
        if existing and existing["deleted_at"]:
            user_id = existing["id"]
            await pool.execute(
                """UPDATE users
                      SET email = $1, password_hash = $2, is_admin = false,
                          is_first_login = true, status = 'initialized',
                          password_changed = false, deleted_at = NULL, created_by = $3
                    WHERE id = $4""",
                email or None,
                await hash_password(password),
                admin["id"],
                user_id,
            )
        elif existing:
            raise api_error(409, "Username already exists")
        else:
            inserted = await pool.fetchrow(
                """INSERT INTO users
                    (username, email, password_hash, is_admin, is_first_login, status, created_by)
                   VALUES ($1, $2, $3, false, true, 'initialized', $4)
                   RETURNING id""",
                username,
                email or None,
                await hash_password(password),
                admin["id"],
            )
            user_id = inserted["id"]
        return {"data": {"id": user_id}}
    except asyncpg.UniqueViolationError:
        raise api_error(409, "Username or email already exists")
    except HTTPException:
        raise
    except Exception as error:
        raise api_error(500, "Failed to create user")


@router.patch("/api/admin/users/{user_id}")
async def update_user(
    user_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    admin = await authenticate(request, pool)
    require_admin(admin)
    try:
        body = await request.json()
    except Exception:
        body = {}
    allowed = ["username", "email", "status"]
    entries = [(key, value) for key, value in body.items() if key in allowed]
    if not entries:
        raise api_error(400, "No valid fields supplied")
    sets = []
    values = []
    for index, (key, value) in enumerate(entries, start=1):
        sets.append(f"{ident(key)} = ${index}")
        if key == "email":
            values.append(str(value).lower().strip())
        elif key == "username":
            username = normalize_username(value)
            if not is_valid_username(username):
                raise api_error(400, "Username should look like john.paul")
            values.append(username)
        else:
            values.append(value)
    values.append(user_id)
    try:
        await pool.execute(
            f"UPDATE users SET {', '.join(sets)} WHERE id = ${len(values)} AND is_admin = false",
            *values,
        )
    except asyncpg.UniqueViolationError:
        raise api_error(409, "Username or email already exists")
    return {"ok": True}


@router.post("/api/admin/users/{user_id}/reset-password")
async def reset_password(
    user_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    admin = await authenticate(request, pool)
    require_admin(admin)
    try:
        body = await request.json()
    except Exception:
        body = {}
    password = str(body.get("password") or "")
    if password_error := validate_password(password):
        raise api_error(400, password_error)
    await pool.execute(
        """UPDATE users
              SET password_hash = $1, password_changed = false,
                  is_first_login = true, password_changed_at = NOW(), status = 'active'
            WHERE id = $2 AND is_admin = false""",
        await hash_password(password),
        user_id,
    )
    return {"ok": True}


async def _require_target_user(pool: asyncpg.Pool, user_id: str) -> dict:
    row = await pool.fetchrow(
        """SELECT u.id, u.username, u.email, u.status,
                  p.first_name, p.last_name, p.company
             FROM users u
             LEFT JOIN user_profiles p ON p.user_id = u.id
            WHERE u.id = $1 AND u.deleted_at IS NULL AND u.is_admin = false
            LIMIT 1""",
        user_id,
    )
    if not row:
        raise api_error(404, "User not found")
    return dict(row)


def _display_name(row: dict) -> str:
    name = " ".join(filter(None, [row.get("first_name"), row.get("last_name")])).strip()
    return name or row.get("email") or row.get("username") or "User"


@router.get("/api/admin/users/{user_id}/data")
async def admin_user_data(
    user_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    admin = await authenticate(request, pool)
    require_admin(admin)
    target = await _require_target_user(pool, user_id)
    events = await list_user_export_events(pool, user_id)
    exports = []
    for event in events:
        payload = await build_user_event_export(pool, user_id, str(event["id"]))
        if payload:
            exports.append(payload)
    notes_total = sum(
        len(person.get("notes") or [])
        for payload in exports
        for person in payload.get("people") or []
    )
    flags_total = sum(
        len(person.get("statuses") or [])
        for payload in exports
        for person in payload.get("people") or []
    )
    conversations_total = sum(len(payload.get("conversations") or []) for payload in exports)
    return {
        "user": {
            "id": str(target["id"]),
            "username": target["username"],
            "email": target.get("email"),
            "name": _display_name(target),
            "company": target.get("company"),
            "status": target.get("status"),
        },
        "totals": {
            "events": len(events),
            "notes": notes_total,
            "flags": flags_total,
            "conversations": conversations_total,
        },
        "events": events,
        "exports": exports,
    }


@router.get("/api/admin/users/{user_id}/export/events")
async def admin_user_export_events(
    user_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    admin = await authenticate(request, pool)
    require_admin(admin)
    await _require_target_user(pool, user_id)
    events = await list_user_export_events(pool, user_id)
    return {"events": events}


@router.get("/api/admin/users/{user_id}/export/event/{event_id}")
async def admin_user_export_event(
    user_id: str,
    event_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    admin = await authenticate(request, pool)
    require_admin(admin)
    target = await _require_target_user(pool, user_id)
    export_payload = await build_user_event_export(pool, user_id, event_id)
    if not export_payload:
        raise api_error(404, "Event not found")
    await log_activity(
        pool,
        user_id=str(admin["id"]),
        kind="admin_export",
        event_id=event_id,
        label=_display_name(target),
        meta={"target_user_id": user_id, "format": "user-data"},
    )
    return {"export": export_payload}


@router.delete("/api/admin/users/{user_id}")
async def delete_user(
    user_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    admin = await authenticate(request, pool)
    require_admin(admin)
    await pool.execute(
        "UPDATE users SET deleted_at = NOW(), status = 'dead' WHERE id = $1 AND is_admin = false",
        user_id,
    )
    return {"ok": True}
