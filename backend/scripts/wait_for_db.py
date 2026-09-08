#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import asyncpg

from app.config import settings


async def main() -> None:
    conn = await asyncpg.connect(settings.database_url)
    try:
        await conn.fetchval("SELECT 1")
    finally:
        await conn.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from error
