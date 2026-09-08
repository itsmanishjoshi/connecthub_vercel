"""List attendees whose name looks like a spreadsheet placeholder."""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

import asyncpg

from app.services.people_ingest import _is_placeholder_name


async def main() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    rows = await conn.fetch("SELECT id, name, event_id FROM attendees ORDER BY name")
    matches = [dict(r) for r in rows if _is_placeholder_name(r["name"] or "")]
    for row in matches:
        print(row)
    print(f"Found {len(matches)} placeholder attendee(s)")
    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
