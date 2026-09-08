"""Import embedded Excel photos into attendee records for an event."""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(BACKEND_ROOT / ".env")

from app.db_handler import save_attendee_photo
from app.photo_store import attendee_photo_url, is_valid_photo_source, mime_from_buffer, parse_data_url
from app.services.people_ingest import find_matching_person, name_key
from app.services.people_spreadsheet import people_from_spreadsheet_buffer
from app.services.remote_photo import resolve_attendee_photo


DEFAULT_XLSX = BACKEND_ROOT / "uploads" / "private" / "ingest" / "ingest-last.xlsx"


async def resolve_event_id(pool, event_ref: str):
    if len(event_ref) == 36 and event_ref.count("-") == 4:
        return event_ref
    row = await pool.fetchrow("SELECT id FROM events WHERE slug = $1 LIMIT 1", event_ref)
    return str(row["id"]) if row else None


async def import_photos(event_ref: str, xlsx_path: Path) -> None:
    import asyncpg

    if not xlsx_path.is_file():
        raise SystemExit(f"Spreadsheet not found: {xlsx_path}")

    buffer = xlsx_path.read_bytes()
    parsed = await people_from_spreadsheet_buffer(
        buffer,
        {"filename": xlsx_path.name},
    )
    people = parsed.get("people") or []
    print(f"Parsed {len(people)} people from {xlsx_path.name}")

    pool = await asyncpg.create_pool(os.getenv("DATABASE_URL"))
    event_id = await resolve_event_id(pool, event_ref)
    if not event_id:
        raise SystemExit(f"Event not found: {event_ref}")

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
    print(f"Found {len(existing)} attendees in event")

    saved = 0
    skipped = 0
    missing = 0

    for person in people:
        photo_source = person.get("profile_pic_url")
        if not is_valid_photo_source(photo_source) and not parse_data_url(str(photo_source or "")):
            continue

        match = find_matching_person(existing, person)
        if not match:
            same_name = [row for row in existing if name_key(row) == name_key(person)]
            match = same_name[0] if len(same_name) == 1 else None
        if not match:
            missing += 1
            print(f"  no match: {person.get('name')}")
            continue

        if match.get("has_bytes") and is_valid_photo_source(match.get("profile_pic_url")):
            skipped += 1
            continue

        loaded = None
        data_url = parse_data_url(str(photo_source or ""))
        if data_url:
            loaded = data_url
        else:
            loaded = await resolve_attendee_photo(
                str(photo_source or "") or None,
                person.get("linkedin_url") or match.get("linkedin_url"),
                BACKEND_ROOT / "uploads",
            )

        if not loaded:
            print(f"  failed: {person.get('name')}")
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
        saved += 1
        print(f"  saved: {person.get('name')}")

    print(f"Done. saved={saved}, skipped={skipped}, unmatched={missing}")
    await pool.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import attendee photos from an Excel file")
    parser.add_argument("event", help="Event slug or UUID")
    parser.add_argument(
        "--file",
        default=str(DEFAULT_XLSX),
        help=f"Path to .xlsx file (default: {DEFAULT_XLSX})",
    )
    args = parser.parse_args()
    asyncio.run(import_photos(args.event, Path(args.file)))


if __name__ == "__main__":
    main()
