#!/usr/bin/env python3
"""Export ConnectHub Postgres to a Supabase / Vercel SQL editor compatible .sql file.

Embeds attendee profile photos (BYTEA) and converts disk uploads (.png/.jpg/.jpeg)
into data URLs so images survive cloud deploys without a separate uploads volume.

Usage (from repo root):
  npm run db:export
  python backend/scripts/export_supabase_sql.py --output exports/connecthub-dump.sql

Requires DATABASE_URL in backend/.env (or root .env).
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import json
import re
import sys
from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import asyncpg

from app.config import BACKEND_ROOT as APP_BACKEND_ROOT, REPO_ROOT as APP_REPO_ROOT, settings
from app.database import _ssl_context

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}

# FK-safe insert order (tables not listed are appended alphabetically at the end).
PREFERRED_TABLE_ORDER = [
    "users",
    "user_profiles",
    "events",
    "event_access_grants",
    "attendees",
    "attendee_notes",
    "attendee_statuses",
    "attendee_stages",
    "attendee_insights",
    "conversations",
    "transcript_segments",
    "conversation_insights",
    "conversation_audio",
    "qr_codes",
    "gallery_items",
    "notes",
    "user_notes",
    "user_preferences",
    "follow_ups",
    "asset_libraries",
    "asset_folders",
    "asset_items",
    "asset_access",
    "activity_events",
    "api_usage_logs",
    "jelly_chat_sessions",
    "jelly_chat_messages",
    "meeting_notes",
    "calendar_reminders",
    "attendee_sectors",
    "pipeline_workspace",
    "record_versions",
    "schema_migrations",
]


def schema_sql() -> str:
    parts: list[str] = [
        "-- ConnectHub schema for Supabase SQL editor",
        "-- Run once on an empty database, then run the data section (or full dump).",
        "",
    ]
    for candidate in (
        APP_REPO_ROOT / "init-schema.sql",
        APP_BACKEND_ROOT / "init-schema.sql",
    ):
        if candidate.is_file():
            parts.append(candidate.read_text(encoding="utf-8"))
            break
    else:
        raise FileNotFoundError("init-schema.sql not found")

    migrations_dir = APP_BACKEND_ROOT / "migrations"
    if migrations_dir.is_dir():
        parts.append("\n-- ---- migrations ----\n")
        for path in sorted(migrations_dir.glob("*.sql")):
            parts.append(f"-- {path.name}\n")
            parts.append(path.read_text(encoding="utf-8"))
            parts.append("\n")

    parts.append(
        """
CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""
    )
    return "\n".join(parts)


def mime_for_suffix(suffix: str) -> str:
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(suffix.lower(), "application/octet-stream")


def to_data_url(data: bytes, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"


def build_upload_index(upload_dir: Path) -> dict[str, tuple[bytes, str]]:
    """Map /uploads/... paths and bare filenames to (bytes, mime)."""
    index: dict[str, tuple[bytes, str]] = {}
    if not upload_dir.is_dir():
        return index

    for bucket in ("event-images", "profile-pictures", "avatars", "qr-codes"):
        bucket_dir = upload_dir / bucket
        if not bucket_dir.is_dir():
            continue
        for path in bucket_dir.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            data = path.read_bytes()
            mime = mime_for_suffix(path.suffix)
            rel = f"/uploads/{bucket}/{path.name}"
            index[rel] = (data, mime)
            index[path.name.lower()] = (data, mime)
    return index


def resolve_upload_path(value: str | None, index: dict[str, tuple[bytes, str]]) -> tuple[bytes, str] | None:
    if not value:
        return None
    text = str(value).strip()
    if text in index:
        return index[text]
    name = Path(text.replace("\\", "/")).name.lower()
    return index.get(name)


def sql_literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float, Decimal)):
        return str(value)
    if isinstance(value, bytes):
        if not value:
            return "NULL"
        return f"'\\x{value.hex()}'"
    if isinstance(value, UUID):
        return f"'{value}'::uuid"
    if isinstance(value, datetime):
        return f"'{value.isoformat()}'::timestamptz"
    if isinstance(value, date):
        return f"'{value.isoformat()}'::date"
    if isinstance(value, time):
        return f"'{value.isoformat()}'::time"
    if isinstance(value, dict):
        dumped = json.dumps(value, default=str).replace("'", "''")
        return f"'{dumped}'::jsonb"
    if isinstance(value, list):
        if not value:
            return "ARRAY[]::text[]"
        inner = ", ".join(sql_literal(item) for item in value)
        return f"ARRAY[{inner}]"
    text = str(value).replace("'", "''")
    return f"'{text}'"


def patch_row_for_photos(
    table: str,
    row: dict[str, Any],
    upload_index: dict[str, tuple[bytes, str]],
) -> dict[str, Any]:
    patched = dict(row)

    if table == "events":
        url = patched.get("event_picture_url")
        loaded = resolve_upload_path(str(url) if url else None, upload_index)
        if loaded:
            data, mime = loaded
            patched["event_picture_url"] = to_data_url(data, mime)

    if table == "attendees":
        if not patched.get("profile_pic"):
            for candidate in (
                patched.get("profile_pic_url"),
                f"/uploads/profile-pictures/{patched.get('id')}.jpg",
                f"/uploads/profile-pictures/{patched.get('id')}.png",
            ):
                loaded = resolve_upload_path(str(candidate) if candidate else None, upload_index)
                if loaded:
                    data, mime = loaded
                    patched["profile_pic"] = data
                    patched["profile_pic_mime"] = mime
                    patched["profile_pic_url"] = f"/api/attendees/{patched.get('id')}/photo"
                    break

    if table == "user_profiles":
        url = patched.get("avatar_url")
        loaded = resolve_upload_path(str(url) if url else None, upload_index)
        if loaded:
            data, mime = loaded
            patched["avatar_url"] = to_data_url(data, mime)

    if table == "asset_items":
        mime = str(patched.get("mime") or "")
        if not patched.get("content") and patched.get("disk_path"):
            disk = Path(str(patched["disk_path"]))
            if disk.is_file() and disk.suffix.lower() in IMAGE_EXTENSIONS:
                patched["content"] = disk.read_bytes()
                patched["mime"] = mime or mime_for_suffix(disk.suffix)
                patched["storage"] = "db"

    return patched


async def list_public_tables(conn: asyncpg.Connection) -> list[str]:
    rows = await conn.fetch(
        """
        SELECT tablename
          FROM pg_tables
         WHERE schemaname = 'public'
         ORDER BY tablename
        """
    )
    names = [row["tablename"] for row in rows]
    ordered: list[str] = []
    seen: set[str] = set()
    for name in PREFERRED_TABLE_ORDER:
        if name in names:
            ordered.append(name)
            seen.add(name)
    for name in names:
        if name not in seen:
            ordered.append(name)
    return ordered


async def export_table(
    conn: asyncpg.Connection,
    table: str,
    upload_index: dict[str, tuple[bytes, str]],
) -> tuple[list[str], int, int]:
    columns = await conn.fetch(
        """
        SELECT column_name
          FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position
        """,
        table,
    )
    if not columns:
        return [], 0, 0

    col_names = [row["column_name"] for row in columns]
    rows = await conn.fetch(f'SELECT * FROM "{table}"')
    statements: list[str] = []
    photo_count = 0

    for record in rows:
        row = patch_row_for_photos(table, dict(record), upload_index)
        if table == "attendees" and row.get("profile_pic"):
            photo_count += 1
        if table == "events" and str(row.get("event_picture_url") or "").startswith("data:image/"):
            photo_count += 1
        if table == "asset_items" and row.get("content"):
            photo_count += 1

        values = ", ".join(sql_literal(row.get(col)) for col in col_names)
        cols_sql = ", ".join(f'"{col}"' for col in col_names)
        statements.append(f'INSERT INTO "{table}" ({cols_sql}) VALUES ({values}) ON CONFLICT DO NOTHING;')

    return statements, len(rows), photo_count


async def export_data_sql(conn: asyncpg.Connection, upload_dir: Path) -> tuple[str, dict[str, Any]]:
    upload_index = build_upload_index(upload_dir)
    tables = await list_public_tables(conn)
    lines = [
        "-- ConnectHub data export",
        "BEGIN;",
        "SET session_replication_role = replica;",  # defer FK checks during bulk load
        "",
    ]
    stats: dict[str, Any] = {"tables": {}, "upload_files_indexed": len(upload_index), "photos_embedded": 0}

    for table in tables:
        if table == "schema_migrations":
            continue
        stmts, count, photos = await export_table(conn, table, upload_index)
        if not stmts:
            continue
        lines.append(f"-- table: {table} ({count} rows)")
        lines.extend(stmts)
        lines.append("")
        stats["tables"][table] = {"rows": count, "photos": photos}
        stats["photos_embedded"] += photos

    # Mark migrations as applied so migrate.py skips re-running on cloud.
    migration_files = sorted((APP_BACKEND_ROOT / "migrations").glob("*.sql"))
    for path in migration_files:
        lines.append(
            f"INSERT INTO schema_migrations (name) VALUES ({sql_literal(path.name)}) ON CONFLICT DO NOTHING;"
        )

    lines.extend(["SET session_replication_role = DEFAULT;", "COMMIT;", ""])
    return "\n".join(lines), stats


async def run_export(args: argparse.Namespace) -> None:
    ssl_ctx = _ssl_context()
    conn = await asyncpg.connect(
        settings.database_url,
        ssl=ssl_ctx if ssl_ctx else False,
        timeout=60,
    )
    try:
        upload_dir = Path(args.upload_dir) if args.upload_dir else settings.upload_dir
        chunks: list[str] = [
            "-- ConnectHub Supabase SQL dump",
            f"-- Generated: {datetime.now().isoformat(timespec='seconds')}",
            "-- Paste into Supabase → SQL Editor (or run with psql).",
            "-- Large files (>5 MB): use psql or Supabase CLI instead of the web editor.",
            "",
        ]

        if args.mode in ("full", "schema"):
            chunks.append(schema_sql())
            chunks.append("")

        stats: dict[str, Any] = {}
        if args.mode in ("full", "data"):
            data_sql, stats = await export_data_sql(conn, upload_dir)
            chunks.append(data_sql)

        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text("\n".join(chunks), encoding="utf-8")
        size_mb = output.stat().st_size / (1024 * 1024)

        print(f"Wrote {output} ({size_mb:.2f} MB)")
        if stats:
            print(f"Upload files indexed: {stats.get('upload_files_indexed', 0)}")
            print(f"Photos embedded: {stats.get('photos_embedded', 0)}")
            for table, info in sorted(stats.get("tables", {}).items()):
                if info["rows"]:
                    extra = f", {info['photos']} with photos" if info.get("photos") else ""
                    print(f"  {table}: {info['rows']} rows{extra}")
        if size_mb > 5:
            print("Warning: file is large for the Supabase web SQL editor. Prefer:")
            print("  psql \"$DATABASE_URL\" -f exports/connecthub-dump.sql")
    finally:
        await conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Export ConnectHub database to Supabase SQL")
    parser.add_argument(
        "--output",
        default=str(REPO_ROOT / "exports" / "connecthub-dump.sql"),
        help="Output .sql file path",
    )
    parser.add_argument(
        "--mode",
        choices=("full", "schema", "data"),
        default="full",
        help="full=schema+data, schema=tables only, data=rows only",
    )
    parser.add_argument(
        "--upload-dir",
        default="",
        help="Uploads folder (default: UPLOAD_DIR or backend/uploads)",
    )
    args = parser.parse_args()

    if args.mode == "schema":
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(schema_sql(), encoding="utf-8")
        print(f"Wrote schema to {output}")
        return

    try:
        asyncio.run(run_export(args))
    except Exception as error:
        print(f"Export failed: {error}", file=sys.stderr)
        print(
            "\nTips:\n"
            "  1. Fix DATABASE_URL in backend/.env (Supabase pooler URI or local Postgres).\n"
            "  2. Run: python backend/scripts/migrate.py migrate\n"
            "  3. Schema only (no DB): python backend/scripts/export_supabase_sql.py --mode schema\n",
            file=sys.stderr,
        )
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
