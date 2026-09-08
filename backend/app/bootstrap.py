from __future__ import annotations

import sys

import asyncpg
import bcrypt

from app.config import settings

ADMIN_USER_ID = "00000000-0000-0000-0000-000000000001"
ADMIN_PROFILE_ID = "00000000-0000-0000-0000-000000000011"


async def ensure_admin_user(pool: asyncpg.Pool) -> None:
    """Upsert admin from ADMIN_* env vars (used on Vercel/Supabase first boot)."""
    username = (settings.admin_username or "").strip().lower()
    password = settings.admin_password or ""
    if not username or not password:
        return

    admin_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=10)).decode()
    await pool.execute(
        """INSERT INTO users (
              id, username, email, password_hash, is_admin, is_first_login, status, password_changed
           ) VALUES ($1, $2, $3, $4, true, false, 'active', true)
           ON CONFLICT (username) DO UPDATE SET
              password_hash = EXCLUDED.password_hash,
              is_admin = EXCLUDED.is_admin,
              deleted_at = NULL,
              status = 'active'""",
        ADMIN_USER_ID,
        username,
        settings.admin_email,
        admin_hash,
    )
    await pool.execute(
        """INSERT INTO user_profiles (
              id, user_id, first_name, last_name, email, company, designation, location,
              is_admin, profile_completed
           ) VALUES ($1, $2, 'Admin', 'User', $3, 'ConnectHub', 'Administrator', 'Mumbai', true, true)
           ON CONFLICT (user_id) DO NOTHING""",
        ADMIN_PROFILE_ID,
        ADMIN_USER_ID,
        settings.admin_email,
    )
    print(f"Admin user ready: {username}", file=sys.stderr)


async def bootstrap_database(pool: asyncpg.Pool) -> None:
    try:
        await ensure_admin_user(pool)
    except asyncpg.UndefinedTableError:
        print(
            "Users table missing. Run exports/connecthub-schema-only.sql in Supabase SQL Editor.",
            file=sys.stderr,
        )
    except Exception as error:
        print(f"Admin bootstrap failed: {error}", file=sys.stderr)
