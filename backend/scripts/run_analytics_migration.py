import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import close_pool, init_pool
from app.services.analytics import ensure_analytics_schema


async def main() -> None:
    pool = await init_pool()
    try:
        await ensure_analytics_schema(pool)
        count = await pool.fetchval("SELECT COUNT(*)::int FROM api_usage_logs")
        print(f"Migration ok. api_usage_logs rows: {count}")
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
