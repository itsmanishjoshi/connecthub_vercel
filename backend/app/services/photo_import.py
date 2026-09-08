from __future__ import annotations

from pathlib import Path
from typing import Any

import asyncpg

from app.config import settings
from app.db_handler import save_attendee_photo
from app.photo_store import attendee_photo_url, is_valid_photo_source, mime_from_buffer, parse_data_url
from app.services.people_ingest import find_matching_person, name_key
from app.services.people_spreadsheet import people_from_spreadsheet_buffer
from app.services.remote_photo import resolve_attendee_photo

DEFAULT_INGEST_XLSX = settings.ingest_upload_dir / "ingest-last.xlsx"


async def import_event_photos_from_spreadsheet(
    pool: asyncpg.Pool,
    event_id: str,
    buffer: bytes,
    *,
    filename: str,
) -> dict[str, Any]:
    parsed = await people_from_spreadsheet_buffer(buffer, {"filename": filename})
    people = parsed.get("people") or []

    rows = await pool.fetch(
        """
        SELECT id, name, company, designation, linkedin_url, profile_pic_url,
               CASE WHEN profile_pic IS NULL THEN false ELSE true END AS has_bytes
        FROM attendees
        WHERE event_id = $1
        """,
        event_id,
    )
    existing = [dict(row) for row in rows]

    saved = 0
    skipped = 0
    unmatched: list[str] = []
    embedded = sum(
        1
        for person in people
        if parse_data_url(str(person.get("profile_pic_url") or ""))
        or is_valid_photo_source(person.get("profile_pic_url"))
    )

    for person in people:
        photo_source = person.get("profile_pic_url")
        data_url = parse_data_url(str(photo_source or ""))
        if not data_url and not is_valid_photo_source(photo_source):
            continue

        match = find_matching_person(existing, person)
        if not match:
            same_name = [row for row in existing if name_key(row) == name_key(person)]
            match = same_name[0] if len(same_name) == 1 else None
        if not match:
            unmatched.append(str(person.get("name") or "Unknown"))
            continue

        if match.get("has_bytes"):
            skipped += 1
            continue

        loaded = data_url
        if not loaded:
            loaded = await resolve_attendee_photo(
                str(photo_source or "") or None,
                person.get("linkedin_url") or match.get("linkedin_url"),
                settings.upload_dir,
            )
        if not loaded:
            unmatched.append(str(person.get("name") or "Unknown"))
            continue

        await pool.execute(
            """
            UPDATE attendees
               SET profile_pic = $2,
                   profile_pic_mime = $3,
                   profile_pic_url = $4
             WHERE id = $1
            """,
            match["id"],
            loaded["buffer"],
            loaded.get("mime") or mime_from_buffer(loaded["buffer"]),
            attendee_photo_url(str(match["id"])),
        )
        match["has_bytes"] = True
        saved += 1

    return {
        "saved": saved,
        "skipped": skipped,
        "unmatched": unmatched,
        "embedded_photos_in_file": embedded,
        "people_in_file": len(people),
    }
