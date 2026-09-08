#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import asyncpg
import bcrypt

from app.config import BACKEND_ROOT, REPO_ROOT, settings

FOLDER_IMPORTED_EVENT_NAMES = [
    "Machine Con",
    "The Mainstream",
    "HR Meet",
    "AI Impact Summit",
    "Business Hub",
    "ConnectHub - List of speakers",
]


def schema_path() -> Path:
    for candidate in (
        REPO_ROOT / "init-schema.sql",
        BACKEND_ROOT / "init-schema.sql",
        Path("/init-schema.sql"),
    ):
        if candidate.is_file():
            return candidate
    raise FileNotFoundError("init-schema.sql not found")


MIGRATIONS_DIR = BACKEND_ROOT / "migrations"


async def run_sql(conn: asyncpg.Connection, sql: str) -> None:
    await conn.execute(sql)


async def migrate(conn: asyncpg.Connection) -> None:
    async with conn.transaction():
        sql = schema_path().read_text(encoding="utf-8")
        await run_sql(conn, sql)
        await run_sql(
            conn,
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
              name TEXT PRIMARY KEY,
              applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """,
        )
        files = (
            sorted(path.name for path in MIGRATIONS_DIR.glob("*.sql"))
            if MIGRATIONS_DIR.is_dir()
            else []
        )
        for name in files:
            applied = await conn.fetchrow(
                "SELECT 1 FROM schema_migrations WHERE name = $1",
                name,
            )
            if applied:
                continue
            await run_sql(conn, (MIGRATIONS_DIR / name).read_text(encoding="utf-8"))
            await conn.execute("INSERT INTO schema_migrations (name) VALUES ($1)", name)
            print(f"Applied migration {name}")
    print("Database migrations complete")


async def seed(conn: asyncpg.Connection) -> None:
    admin_username = settings.admin_username
    admin_password = settings.admin_password
    admin_email = settings.admin_email
    if not admin_username or not admin_password:
        raise RuntimeError("Set ADMIN_USERNAME and ADMIN_PASSWORD in backend/.env before seeding")
    admin_hash = bcrypt.hashpw(admin_password.encode(), bcrypt.gensalt(rounds=10)).decode()
    await conn.execute(
        """INSERT INTO users (id, username, email, password_hash, is_admin, is_first_login, status, password_changed)
           VALUES ('00000000-0000-0000-0000-000000000001', $1, $2, $3, true, false, 'active', true)
           ON CONFLICT (username) DO UPDATE SET
              password_hash = EXCLUDED.password_hash,
              is_admin = EXCLUDED.is_admin,
              deleted_at = NULL,
              status = 'active'""",
        admin_username,
        admin_email,
        admin_hash,
    )
    await conn.execute(
        """INSERT INTO user_profiles
             (id, user_id, first_name, last_name, email, company, designation, location, is_admin, profile_completed)
           VALUES
             ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001',
              'Admin', 'User', $1, 'ConnectHub', 'Administrator', 'Mumbai', true, true)
           ON CONFLICT (user_id) DO NOTHING""",
        admin_email,
    )
    print("User accounts ready. No sample events or people were added.")
    print(f"Admin login: {admin_username} / (password from ADMIN_PASSWORD)")


async def purge_imported(conn: asyncpg.Connection) -> None:
    listed = await conn.fetch(
        "SELECT id, name, slug FROM events WHERE name = ANY($1::text[])",
        FOLDER_IMPORTED_EVENT_NAMES,
    )
    if not listed:
        print("No leftover folder-imported events to remove.")
        return
    removed = await conn.fetch(
        "DELETE FROM events WHERE name = ANY($1::text[]) RETURNING name, slug",
        FOLDER_IMPORTED_EVENT_NAMES,
    )
    print(f"Removed {len(removed)} leftover event(s) from the old local folder import:")
    for row in removed:
        print(f"  - {row['name']}")


async def reset(conn: asyncpg.Connection) -> None:
    await conn.execute("DROP SCHEMA public CASCADE")
    await conn.execute("CREATE SCHEMA public")
    await conn.execute("GRANT ALL ON SCHEMA public TO PUBLIC")
    await migrate(conn)
    await seed(conn)
    print("Database reset complete.")


async def health(conn: asyncpg.Connection) -> None:
    ping = await conn.fetchrow("SELECT 1 AS ok, NOW() AS checked_at")
    tables = await conn.fetchval(
        """SELECT COUNT(*)::int
             FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"""
    )
    print(
        json.dumps(
            {
                "database": "ok",
                "checked_at": ping["checked_at"].isoformat() if ping else None,
                "tables": tables,
            },
            default=str,
        )
    )


async def main(command: str) -> None:
    from app.database import _ssl_context

    ssl_ctx = _ssl_context()
    conn = await asyncpg.connect(
        settings.database_url,
        ssl=ssl_ctx if ssl_ctx else False,
        timeout=30,
    )
    try:
        if command == "migrate":
            await migrate(conn)
        elif command == "seed":
            await seed(conn)
        elif command == "reset":
            await reset(conn)
        elif command == "health":
            await health(conn)
        elif command == "purge-imported":
            await purge_imported(conn)
        else:
            print("Usage: python scripts/migrate.py [migrate|seed|reset|health|purge-imported]")
            raise SystemExit(1)
    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ConnectHub database maintenance")
    parser.add_argument(
        "command",
        nargs="?",
        default="migrate",
        choices=["migrate", "seed", "reset", "health", "purge-imported"],
    )
    try:
        asyncio.run(main(parser.parse_args().command))
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from error
