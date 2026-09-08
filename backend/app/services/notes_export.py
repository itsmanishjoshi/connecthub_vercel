"""Attendee notes CSV export — server-side only."""

from __future__ import annotations

import csv
import io
from typing import Any

import asyncpg

from app.db_handler import get_accessible_event_ids


async def build_attendee_notes_csv(
    pool: asyncpg.Pool,
    user: dict,
    event_ids: list[str] | None = None,
) -> str:
    owner_id = str(user["id"])

    note_rows = await pool.fetch(
        """SELECT attendee_id, COALESCE(text, note) AS note_body, created_at
             FROM attendee_notes
            WHERE user_id = $1
            ORDER BY created_at DESC""",
        owner_id,
    )
    if not note_rows:
        return "Name,Company,Designation,Location,Stages,Notes,Note Created At"

    attendee_ids = list({str(row["attendee_id"]) for row in note_rows})
    accessible_events = {str(eid) for eid in await get_accessible_event_ids(pool, user)}

    attendee_rows = await pool.fetch(
        """SELECT id, event_id, name, company, designation, city, location
             FROM attendees
            WHERE id = ANY($1::uuid[])""",
        attendee_ids,
    )
    attendee_map = {str(row["id"]): dict(row) for row in attendee_rows}

    stage_rows = await pool.fetch(
        """SELECT attendee_id, stage
             FROM attendee_stages
            WHERE user_id = $1 AND attendee_id = ANY($2::uuid[])""",
        owner_id,
        attendee_ids,
    )
    stages_map: dict[str, list[str]] = {}
    for row in stage_rows:
        key = str(row["attendee_id"])
        stages_map.setdefault(key, []).append(str(row["stage"]))

    allowed_event_ids = set(event_ids or []) if event_ids else None
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Name", "Company", "Designation", "Location", "Stages", "Notes", "Note Created At"])

    for note in note_rows:
        attendee = attendee_map.get(str(note["attendee_id"]))
        if not attendee:
            continue
        if str(attendee.get("event_id")) not in accessible_events:
            continue
        if allowed_event_ids is not None and str(attendee.get("event_id")) not in allowed_event_ids:
            continue
        stages = "; ".join(stages_map.get(str(note["attendee_id"]), []))
        writer.writerow(
            [
                attendee.get("name") or "",
                attendee.get("company") or "",
                attendee.get("designation") or "",
                attendee.get("city") or attendee.get("location") or "",
                stages,
                note.get("note_body") or "",
                note.get("created_at").isoformat() if note.get("created_at") else "",
            ]
        )

    return output.getvalue()
