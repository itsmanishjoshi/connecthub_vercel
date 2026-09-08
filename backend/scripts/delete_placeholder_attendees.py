"""Delete placeholder attendees from the database."""
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
    placeholders = [r for r in rows if _is_placeholder_name(r["name"] or "")]
    if not placeholders:
        print("No placeholder attendees found.")
        await conn.close()
        return

    for row in placeholders:
        result = await conn.execute("DELETE FROM attendees WHERE id = $1", row["id"])
        print(f"Deleted {row['name']!r} ({row['id']}): {result}")

    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
