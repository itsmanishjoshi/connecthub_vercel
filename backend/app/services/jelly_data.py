"""Load ConnectHub app data for Jelly from PostgreSQL."""

from __future__ import annotations

from typing import Any

import asyncpg

from app.db_handler import enrich_event_rows, get_accessible_event_ids, get_profile_id
from app.photo_store import select_sql_for_table, strip_photo_bytes


async def load_app_data(pool: asyncpg.Pool, user: dict) -> dict[str, Any]:
    event_ids = await get_accessible_event_ids(pool, user)
    if not event_ids:
        return {"events": [], "conversations": []}

    event_rows = await pool.fetch(
        "SELECT * FROM events WHERE id = ANY($1::uuid[]) ORDER BY date DESC NULLS LAST, name ASC",
        event_ids,
    )
    events = await enrich_event_rows(pool, [dict(row) for row in event_rows], user)

    attendee_sql = select_sql_for_table("attendees", "*")
    attendee_rows = await pool.fetch(
        f"SELECT {attendee_sql} FROM attendees WHERE event_id = ANY($1::uuid[])",
        event_ids,
    )
    attendees_by_event: dict[str, list[dict[str, Any]]] = {}
    for row in attendee_rows:
        attendee = strip_photo_bytes(dict(row))
        key = str(attendee.get("event_id"))
        attendees_by_event.setdefault(key, []).append(attendee)

    for event in events:
        event["attendees"] = attendees_by_event.get(str(event.get("id")), [])
        event["attendee_count"] = len(event["attendees"])

    profile_id = await get_profile_id(pool, str(user["id"]))
    owner_id = profile_id or user["id"]
    conversation_rows = await pool.fetch(
        """SELECT id, title, company_name, status, next_action, event_id, created_at, updated_at
             FROM conversations
            WHERE user_id = $1
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 40""",
        owner_id,
    )

    return {
        "events": events,
        "conversations": [dict(row) for row in conversation_rows],
    }


async def load_conversation_insights(pool: asyncpg.Pool, conversation_ids: list[Any]) -> dict[str, list[dict[str, Any]]]:
    if not conversation_ids:
        return {}
    rows = await pool.fetch(
        """SELECT conversation_id, kind, body
             FROM conversation_insights
            WHERE conversation_id = ANY($1::uuid[])
              AND kind = ANY($2::text[])""",
        conversation_ids,
        ["summary", "pain_point", "opportunity", "key_point"],
    )
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        key = str(row["conversation_id"])
        grouped.setdefault(key, []).append({"kind": row["kind"], "body": row["body"]})
    return grouped
