"""Diagnose attendees whose photo endpoint returns 404."""
import asyncio
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(BACKEND_ROOT / ".env")

import asyncpg

from app.photo_store import can_resolve_attendee_photo, is_valid_photo_source

IDS = [
    "1f11eead-fd30-4f19-af96-b6371c4ea99e",
    "d918f222-a7ad-4a6a-b10c-c851262b74c6",
    "15c77ff4-db10-4ef6-85bc-b0786c3d6a76",
    "5a623cdd-99f8-4564-a6ba-e41294bf4f36",
    "cf2c2cc3-723a-4a28-a64c-18c6ce444cc2",
    "0c12e1c2-736c-4f80-9454-9163cb3b8a57",
    "1c6edbb6-9119-4e6b-b771-4ea9dd7a060d",
    "18f69eec-6126-45c2-99b2-0ff1a411c0a6",
    "75d851c4-dbdb-42a4-998d-c4c90a90a9c5",
    "b6708fc8-f10e-4814-973a-38b098b856e4",
    "12b3ac5e-e65f-425c-a70d-709a585ddfe3",
    "c7242b80-f06e-4404-a092-6e46fde23335",
    "2af052d2-f4da-4152-8f87-e468ce6ea9ef",
    "63a25a81-2242-448c-bafa-7d597d9f69da",
    "e60488dc-6e21-48c3-8a33-f442d5599645",
    "af91dcb6-5018-4ce9-accb-ad23f151c1ca",
    "f6800db5-2c3e-4af1-be97-876559b0dc42",
]


async def main() -> None:
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    rows = await conn.fetch(
        """
        SELECT id, name, profile_pic_url, linkedin_url,
               CASE WHEN profile_pic IS NULL THEN false ELSE true END AS has_bytes
        FROM attendees
        WHERE id = ANY($1::uuid[])
        ORDER BY name
        """,
        IDS,
    )
    print(f"Checked {len(IDS)} IDs, found {len(rows)} in DB\n")
    for row in rows:
        data = dict(row)
        can = can_resolve_attendee_photo(data)
        valid = is_valid_photo_source(data.get("profile_pic_url"))
        print(
            f"{data['name']!r}: bytes={data['has_bytes']} valid_url={valid} "
            f"can_resolve={can} pic={data['profile_pic_url']!r} linkedin={data['linkedin_url']!r}"
        )

    summary = await conn.fetchrow(
        """
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE profile_pic IS NOT NULL) AS with_bytes,
          COUNT(*) FILTER (WHERE linkedin_url IS NOT NULL AND linkedin_url <> '') AS with_linkedin,
          COUNT(*) FILTER (
            WHERE profile_pic IS NULL
              AND (profile_pic_url IS NULL OR profile_pic_url = '' OR profile_pic_url ~ '^#')
          ) AS no_photo_source
        FROM attendees
        """
    )
    print("\nEvent totals:", dict(summary))
    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
