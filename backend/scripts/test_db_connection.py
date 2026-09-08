#!/usr/bin/env python3
"""Test PostgreSQL connectivity using backend/.env or an override URL."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import ssl
from urllib.parse import parse_qs, urlparse

import asyncpg

from app.config import settings


def ssl_context_for_url(database_url: str) -> ssl.SSLContext | None:
    parsed = urlparse(database_url.replace("postgresql://", "https://", 1))
    query = {k: v[0] for k, v in parse_qs(parsed.query).items()}
    ssl_mode = (query.get("sslmode") or settings.pgsslmode or "").lower()
    host = parsed.hostname or ""
    loopback = not host or host in ("localhost", "127.0.0.1", "::1", "db")
    use_ssl = ssl_mode in ("require", "verify-ca", "verify-full") or (not ssl_mode and not loopback)
    if not use_ssl or ssl_mode == "disable":
        return None
    ctx = ssl.create_default_context()
    verify = settings.pgssl_verify or ssl_mode in ("verify-ca", "verify-full")
    if not verify:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return ctx


def redact_database_url(url: str) -> str:
    parsed = urlparse(url.replace("postgresql://", "https://", 1))
    host = parsed.hostname or "unknown"
    port = parsed.port or 5432
    user = parsed.username or "unknown"
    database = parsed.path.lstrip("/") or "unknown"
    return f"postgresql://{user}:****@{host}:{port}/{database}"


def is_remote_host(url: str) -> bool:
    host = urlparse(url.replace("postgresql://", "https://", 1)).hostname or ""
    return host not in ("", "localhost", "127.0.0.1", "::1", "db")


async def test_connection(database_url: str) -> dict:
    ssl_ctx = ssl_context_for_url(database_url)
    info = {
        "target": redact_database_url(database_url),
        "remote": is_remote_host(database_url),
        "ssl": ssl_ctx is not None,
        "connected": False,
        "error": None,
        "tables": None,
        "events": None,
        "checked_at": None,
    }
    try:
        conn = await asyncpg.connect(database_url, ssl=ssl_ctx if ssl_ctx else False, timeout=20)
        try:
            row = await conn.fetchrow("SELECT NOW() AS checked_at")
            info["checked_at"] = row["checked_at"].isoformat() if row else None
            info["tables"] = await conn.fetchval(
                """SELECT COUNT(*)::int
                     FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"""
            )
            info["events"] = await conn.fetchval("SELECT COUNT(*)::int FROM events")
            info["connected"] = True
        finally:
            await conn.close()
    except Exception as error:
        info["error"] = str(error)
    return info


async def main() -> None:
    parser = argparse.ArgumentParser(description="Test ConnectHub PostgreSQL connectivity")
    parser.add_argument(
        "--url",
        help="Override DATABASE_URL for this test (otherwise uses backend/.env)",
    )
    args = parser.parse_args()
    database_url = args.url or settings.database_url
    result = await test_connection(database_url)
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["connected"] else 1)


if __name__ == "__main__":
    asyncio.run(main())
