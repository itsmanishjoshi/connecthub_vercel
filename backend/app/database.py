from __future__ import annotations

import ssl
from typing import Any

import asyncpg

from app.config import settings

_pool: asyncpg.Pool | None = None


def _ssl_context() -> ssl.SSLContext | None:
    required = settings.pg_ssl_required()
    if required is None:
        return None
    ctx = ssl.create_default_context()
    if required is False:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return ctx


async def init_pool() -> asyncpg.Pool:
    global _pool
    if _pool is not None:
        return _pool
    ssl_ctx = _ssl_context()
    _pool = await asyncpg.create_pool(
        settings.database_url,
        ssl=ssl_ctx if ssl_ctx else False,
        min_size=1,
        max_size=20,
        command_timeout=60,
    )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def get_pool() -> asyncpg.Pool:
    if _pool is None:
        return await init_pool()
    return _pool


async def fetch(pool: asyncpg.Pool, query: str, *args: Any) -> list[asyncpg.Record]:
    async with pool.acquire() as conn:
        return await conn.fetch(query, *args)


async def fetchrow(pool: asyncpg.Pool, query: str, *args: Any) -> asyncpg.Record | None:
    async with pool.acquire() as conn:
        return await conn.fetchrow(query, *args)


async def fetchval(pool: asyncpg.Pool, query: str, *args: Any) -> Any:
    async with pool.acquire() as conn:
        return await conn.fetchval(query, *args)


async def execute(pool: asyncpg.Pool, query: str, *args: Any) -> str:
    async with pool.acquire() as conn:
        return await conn.execute(query, *args)


def record_to_dict(row: asyncpg.Record | None) -> dict | None:
    if row is None:
        return None
    return dict(row)
