"""Authorization checks for uploaded files."""

from __future__ import annotations

import re

import asyncpg

from app.db_handler import get_accessible_attendee_ids, get_profile_id


async def can_access_upload(
    pool: asyncpg.Pool,
    user: dict,
    bucket: str,
    file_name: str,
) -> bool:
    if user.get("is_admin"):
        return True
    if bucket == "repository":
        return True
    if bucket == "event-images":
        row = await pool.fetchrow(
            """SELECT 1 FROM events e
                WHERE e.created_by = $1
                  AND $2 ~ ('^' || e.id::text)
                LIMIT 1""",
            user["id"],
            file_name,
        )
        if row:
            return True
        match = re.search(
            r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            file_name,
            re.I,
        )
        if not match:
            return False
        from app.db_handler import get_event_role

        role = await get_event_role(pool, user, match.group(0))
        return role is not None
    if bucket == "conversation-audio":
        return str(user["id"]) in file_name
    if bucket == "avatars":
        profile_id = await get_profile_id(pool, str(user["id"]))
        return str(user["id"]) in file_name or bool(profile_id and str(profile_id) in file_name)
    if bucket == "profile-pictures":
        attendee_ids = await get_accessible_attendee_ids(pool, user)
        return any(str(attendee_id) in file_name for attendee_id in attendee_ids)
    if bucket == "qr-codes":
        profile_id = await get_profile_id(pool, str(user["id"]))
        return bool(profile_id and str(profile_id) in file_name)
    return False
