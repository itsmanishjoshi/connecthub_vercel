"""Clean invalid Excel photo values and prefetch LinkedIn avatars."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(BACKEND_ROOT / ".env")

from app.config import settings
from app.photo_store import attendee_photo_url, is_valid_photo_source
from app.services.remote_photo import resolve_attendee_photo


async def main() -> None:
    import asyncpg

    pool = await asyncpg.create_pool(os.getenv("DATABASE_URL"))
    cleaned = await pool.execute(
        """
        UPDATE attendees
           SET profile_pic_url = NULL
         WHERE profile_pic_url IS NOT NULL
           AND profile_pic_url ~ '^#(VALUE|REF|N/A|NAME|NUM|NULL|DIV/0)!?$'
        """
    )
    print(f"Cleaned invalid photo URLs: {cleaned}")

    rows = await pool.fetch(
        """
        SELECT id, name, profile_pic_url, linkedin_url
          FROM attendees
         WHERE profile_pic IS NULL
           AND linkedin_url IS NOT NULL
           AND linkedin_url <> ''
        ORDER BY name
        """
    )
    saved = 0
    for row in rows:
        loaded = await resolve_attendee_photo(
            row["profile_pic_url"],
            row["linkedin_url"],
            settings.upload_dir,
        )
        if not loaded:
            print(f"  skip: {row['name']}")
            continue
        await pool.execute(
            """
            UPDATE attendees
               SET profile_pic = $2,
                   profile_pic_mime = $3,
                   profile_pic_url = $4
             WHERE id = $1
            """,
            row["id"],
            loaded["buffer"],
            loaded["mime"],
            attendee_photo_url(str(row["id"])),
        )
        saved += 1
        print(f"  saved: {row['name']}")

    print(f"Prefetched {saved} photos.")
    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
