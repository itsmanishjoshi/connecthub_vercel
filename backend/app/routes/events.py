from __future__ import annotations

import re
from typing import Any

import asyncpg
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.auth import hash_password, is_bcrypt_hash, verify_password
from app.database import get_pool, record_to_dict
from app.db_handler import (
    attach_attendee_counts,
    enrich_event_rows,
    get_event_role,
    grant_event_access,
    require_event_role,
)
from app.dependencies import api_error, authenticate
from app.rate_limit import limiter

router = APIRouter()


def normalize_username(value: str | None) -> str:
    return str(value or "").strip().lower()


def is_valid_username(value: str) -> bool:
    return (
        bool(re.fullmatch(r"[a-z][a-z0-9]*(?:[._][a-z0-9]+)*", value))
        and 3 <= len(value) <= 40
    )


async def require_access_manager(pool: asyncpg.Pool, user: dict, event_id: str) -> None:
    if user.get("is_admin"):
        return
    event = await pool.fetchrow("SELECT created_by FROM events WHERE id = $1", event_id)
    if not event:
        raise api_error(404, "Event not found")
    if str(event["created_by"]) == str(user["id"]):
        return
    raise api_error(403, "Only an administrator or the event organizer can manage access")


@router.post("/api/events/{event_id}/verify-pin")
@limiter.limit("10/15minutes")
async def verify_pin(
    event_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    user = await authenticate(request, pool)
    try:
        body = await request.json()
    except Exception:
        body = {}
    pin = str(body.get("pin") or "").strip()
    event = await pool.fetchrow(
        "SELECT id, is_private, access_pin, created_by FROM events WHERE id = $1",
        event_id,
    )
    if not event:
        raise api_error(404, "Event not found")
    is_owner_or_admin = user.get("is_admin") or event["created_by"] == user["id"]
    pin_ok = bool(re.fullmatch(r"\d{4}", pin))
    pin_matches = bool(event["access_pin"]) and pin_ok and await verify_password(
        pin, event["access_pin"]
    )
    if not event["is_private"] or is_owner_or_admin or pin_matches:
        if pin_matches and event["access_pin"] and not is_bcrypt_hash(event["access_pin"]):
            await pool.execute(
                "UPDATE events SET access_pin = $1 WHERE id = $2",
                await hash_password(pin),
                event["id"],
            )
        await pool.execute(
            """INSERT INTO event_access_grants (user_id, event_id, role)
               VALUES ($1, $2, 'view')
               ON CONFLICT (user_id, event_id) DO UPDATE SET granted_at = NOW()""",
            user["id"],
            event["id"],
        )
        return {"ok": True, "access": "view"}
    raise api_error(403, "Incorrect door code")


@router.get("/api/events/by-slug/{slug}")
async def event_by_slug(
    slug: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    user = await authenticate(request, pool)
    row = await pool.fetchrow("SELECT * FROM events WHERE slug = $1 LIMIT 1", slug)
    if not row:
        raise api_error(404, "Event not found")
    event = dict(row)
    role = await get_event_role(pool, user, event["id"])
    if not role:
        return JSONResponse(
            status_code=403,
            content={
                "error": {"code": "EVENT_LOCKED", "message": "This event is invite-only"},
                "event": {
                    "id": event["id"],
                    "name": event["name"],
                    "slug": event["slug"],
                    "is_private": True,
                    "date": event.get("date"),
                    "place": event.get("place"),
                    "event_picture_url": event.get("event_picture_url"),
                },
            },
        )
    enriched = await enrich_event_rows(pool, [event], user)
    with_count = await attach_attendee_counts(pool, enriched)
    return {"data": with_count[0], "access": role}


@router.get("/api/events/{event_id}/access")
async def list_event_access(
    event_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    user = await authenticate(request, pool)
    await require_access_manager(pool, user, event_id)
    rows = await pool.fetch(
        """
        SELECT user_id, username, role, granted_at, created_by, first_name, last_name
          FROM (
            SELECT u.id AS user_id, u.username, 'edit'::text AS role, e.created_at AS granted_at,
                   e.created_by, p.first_name, p.last_name
              FROM events e
              JOIN users u ON u.id = e.created_by
              LEFT JOIN user_profiles p ON p.user_id = u.id
             WHERE e.id = $1
            UNION
            SELECT u.id, u.username, COALESCE(g.role, 'view'), g.granted_at,
                   e.created_by, p.first_name, p.last_name
              FROM event_access_grants g
              JOIN events e ON e.id = g.event_id
              JOIN users u ON u.id = g.user_id AND u.deleted_at IS NULL
              LEFT JOIN user_profiles p ON p.user_id = u.id
             WHERE g.event_id = $1
          ) members
         ORDER BY (user_id = created_by) DESC, username ASC
        """,
        event_id,
    )
    members = []
    seen: set[Any] = set()
    for row in rows:
        if row["user_id"] in seen:
            continue
        seen.add(row["user_id"])
        members.append(
            {
                "user_id": row["user_id"],
                "username": row["username"],
                "role": "edit" if row["user_id"] == row["created_by"] else (row["role"] or "view"),
                "is_owner": row["user_id"] == row["created_by"],
                "granted_at": row["granted_at"],
                "first_name": row["first_name"],
                "last_name": row["last_name"],
            }
        )
    return {"data": members}


@router.get("/api/events/{event_id}/access/candidates")
async def list_access_candidates(
    event_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    user = await authenticate(request, pool)
    await require_access_manager(pool, user, event_id)
    rows = await pool.fetch(
        """
        SELECT u.id, u.username, u.email, u.status,
               p.first_name, p.last_name, p.company
          FROM users u
          LEFT JOIN user_profiles p ON p.user_id = u.id
         WHERE u.deleted_at IS NULL
           AND u.is_admin = false
           AND u.status IN ('active', 'onboarding', 'initialized')
           AND u.id <> (SELECT created_by FROM events WHERE id = $1)
           AND NOT EXISTS (
                 SELECT 1 FROM event_access_grants g
                  WHERE g.event_id = $1 AND g.user_id = u.id
               )
         ORDER BY u.username ASC
        """,
        event_id,
    )
    return {
        "data": [
            {
                "id": str(row["id"]),
                "username": row["username"],
                "email": row["email"],
                "status": row["status"],
                "first_name": row["first_name"],
                "last_name": row["last_name"],
                "company": row["company"],
            }
            for row in rows
        ]
    }


@router.post("/api/events/{event_id}/access", status_code=201)
async def add_event_access(
    event_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    user = await authenticate(request, pool)
    await require_access_manager(pool, user, event_id)
    try:
        body = await request.json()
    except Exception:
        body = {}
    username = normalize_username(body.get("username"))
    user_id = str(body.get("user_id") or "").strip()
    role = "edit" if body.get("role") == "edit" else "view"
    found = None
    if user_id:
        found = await pool.fetchrow(
            """SELECT id FROM users
                WHERE id = $1 AND deleted_at IS NULL AND is_admin = false
                LIMIT 1""",
            user_id,
        )
    elif is_valid_username(username):
        found = await pool.fetchrow(
            """SELECT id FROM users
                WHERE lower(username) = $1 AND deleted_at IS NULL AND is_admin = false
                LIMIT 1""",
            username,
        )
    if not found:
        raise api_error(404, "Select an active user from the list")
    if found["id"] == user["id"]:
        raise api_error(400, "You already have access")
    await grant_event_access(pool, str(found["id"]), event_id, role, str(user["id"]))
    return {"ok": True}


@router.patch("/api/events/{event_id}/access/{member_user_id}")
async def update_event_access(
    event_id: str,
    member_user_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    user = await authenticate(request, pool)
    await require_access_manager(pool, user, event_id)
    try:
        body = await request.json()
    except Exception:
        body = {}
    role = "edit" if body.get("role") == "edit" else "view"
    event = await pool.fetchrow("SELECT created_by FROM events WHERE id = $1", event_id)
    if event and str(event["created_by"]) == member_user_id:
        raise api_error(400, "The organizer always keeps edit access")
    existing = await pool.fetchrow(
        "SELECT user_id FROM event_access_grants WHERE event_id = $1 AND user_id = $2",
        event_id,
        member_user_id,
    )
    if not existing:
        raise api_error(404, "That person is not on this event")
    await grant_event_access(pool, member_user_id, event_id, role, str(user["id"]))
    return {"ok": True}


@router.delete("/api/events/{event_id}/access/{member_user_id}")
async def remove_event_access(
    event_id: str,
    member_user_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    user = await authenticate(request, pool)
    await require_access_manager(pool, user, event_id)
    event = await pool.fetchrow("SELECT created_by FROM events WHERE id = $1", event_id)
    if event and str(event["created_by"]) == member_user_id:
        raise api_error(400, "The organizer cannot be removed")
    await pool.execute(
        "DELETE FROM event_access_grants WHERE event_id = $1 AND user_id = $2",
        event_id,
        member_user_id,
    )
    return {"ok": True}
