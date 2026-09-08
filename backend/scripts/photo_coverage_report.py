"""Photo coverage report for an event."""
import asyncio
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(BACKEND_ROOT / ".env")

import asyncpg

from app.services.people_spreadsheet import _extract_embedded_sheet_photos, _workbook_rows, people_from_sheet_rows


async def main(event_slug: str) -> None:
    xlsx = BACKEND_ROOT / "uploads" / "private" / "ingest" / "ingest-last.xlsx"
    buffer = xlsx.read_bytes()
    photos = _extract_embedded_sheet_photos(buffer)

    sheet_rows = _workbook_rows(buffer, xlsx.name)
    excel_people: dict[str, bool] = {}
    for _sheet_name, rows in sheet_rows:
        parsed = people_from_sheet_rows(rows, lambda p: p)
        for person in parsed["people"]:
            name = str(person.get("name") or "").strip()
            row = person.get("_sheet_row")
            excel_people[name] = row in photos if row else False

    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    event = await conn.fetchrow("SELECT id, name FROM events WHERE slug = $1", event_slug)
    if not event:
        print(f"Event not found: {event_slug}")
        return

    rows = await conn.fetch(
        """
        SELECT name, profile_pic_url, linkedin_url,
               CASE WHEN profile_pic IS NULL THEN false ELSE true END AS has_bytes
        FROM attendees WHERE event_id = $1 ORDER BY name
        """,
        event["id"],
    )

    print(f"Event: {event['name']} ({event_slug})")
    print(f"Excel embedded photos: {len(photos)}")
    print(f"Attendees: {len(rows)}\n")

    missing = []
    for row in rows:
        name = row["name"]
        has_bytes = row["has_bytes"]
        in_excel = excel_people.get(name, False)
        status = "OK" if has_bytes else "MISSING"
        if not has_bytes:
            missing.append(name)
        print(
            f"{status:7} {name}: bytes={has_bytes} excel_embedded={in_excel} "
            f"linkedin={bool(row['linkedin_url'])} pic_url={row['profile_pic_url']!r}"
        )

    print(f"\nMissing photos: {len(missing)}")
    await conn.close()


if __name__ == "__main__":
    slug = sys.argv[1] if len(sys.argv) > 1 else "test-mtoku6ov"
    asyncio.run(main(slug))
