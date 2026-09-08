import asyncio
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(BACKEND_ROOT / ".env")


async def main() -> None:
    import asyncpg

    pool = await asyncpg.create_pool(os.getenv("DATABASE_URL"))
    rows = await pool.fetch(
        """
        SELECT name, profile_pic_url, linkedin_url,
               CASE WHEN profile_pic IS NULL THEN false ELSE true END AS has_bytes
        FROM attendees
        ORDER BY name
        LIMIT 20
        """
    )
    for row in rows:
        print(f"{row['name']}: pic={row['profile_pic_url']!r} linkedin={row['linkedin_url']!r} bytes={row['has_bytes']}")
    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
