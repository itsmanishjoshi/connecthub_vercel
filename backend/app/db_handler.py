from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

import asyncpg

from app.auth import (
    hash_password_fields,
    prepare_event_secrets,
    sanitize_rows,
    sanitize_user_row,
)
from app.conflicts import (
    VERSIONED_TABLES,
    extract_expected_updated_at,
    is_stale_write,
    strip_conflict_meta,
)
from app.config import settings
from app.dependencies import db_error
from app.security import MAX_DB_SELECT_ROWS
from app.photo_store import (
    attendee_photo_url,
    enrich_attendee_photo_urls,
    is_valid_photo_source,
    sanitize_photo_source,
    select_sql_for_table,
    strip_photo_bytes,
)
from app.services.remote_photo import resolve_attendee_photo, resolve_photo_bytes

CONFLICT_DEFAULTS: dict[str, str] = {
    "user_preferences": "user_id",
    "qr_codes": "user_id",
    "attendee_insights": "attendee_id",
    "user_notes": "user_id,page_number",
    "attendee_stages": "user_id,attendee_id",
    "users": "username",
    "user_profiles": "user_id",
    "events": "slug",
    "pipeline_workspace": "user_id",
    "attendee_sectors": "user_id,attendee_id",
}

ALLOWED_TABLES = frozenset(
    {
        "users",
        "user_profiles",
        "events",
        "attendees",
        "contacts",
        "attendee_notes",
        "attendee_statuses",
        "attendee_stages",
        "attendee_stage",
        "attendee_insights",
        "qr_codes",
        "notes",
        "user_notes",
        "user_preferences",
        "follow_ups",
        "gallery_items",
        "conversations",
        "transcript_segments",
        "conversation_insights",
        "conversation_audio",
        "jelly_chat_sessions",
        "jelly_chat_messages",
        "meeting_notes",
        "calendar_reminders",
        "attendee_sectors",
        "pipeline_workspace",
    }
)

PRIVATE_TABLES = frozenset(
    {
        "attendee_notes",
        "attendee_statuses",
        "attendee_stages",
        "notes",
        "user_notes",
        "user_preferences",
        "qr_codes",
        "follow_ups",
        "gallery_items",
        "conversations",
        "transcript_segments",
        "conversation_insights",
        "conversation_audio",
        "jelly_chat_sessions",
        "jelly_chat_messages",
        "meeting_notes",
        "calendar_reminders",
        "attendee_sectors",
        "pipeline_workspace",
    }
)


def ident(name: str) -> str:
    if not re.fullmatch(r"[a-zA-Z_][a-zA-Z0-9_]*", name):
        raise ValueError(f"Invalid identifier: {name}")
    return f'"{name}"'


def normalize_timestamps(payload: dict | None) -> dict:
    if not payload:
        return {}
    normalized: dict[str, Any] = {}
    for key, value in payload.items():
        if isinstance(value, (dict, list)):
            normalized[key] = json.dumps(value)
            continue
        if isinstance(value, str) and re.match(r"^\d{4}-\d{2}-\d{2}", value):
            try:
                normalized[key] = datetime.fromisoformat(value.replace("Z", "+00:00"))
                continue
            except ValueError:
                pass
        normalized[key] = value
    return normalized


def parse_select(select: str | None) -> dict[str, Any]:
    if not select or select.strip() == "*" or "*" in select:
        return {
            "columns": "*",
            "nestedAttendeeCount": bool(re.search(r"attendees\s*\(\s*count\s*\)", select or "", re.I)),
        }
    cleaned = [
        part.replace(" ", " ").strip()
        for part in re.sub(r"attendees\s*\(\s*count\s*\)", "", select, flags=re.I)
        .split(",")
        if part.replace(" ", " ").strip()
    ]
    return {
        "columns": ", ".join(ident(part) for part in cleaned) if cleaned else "*",
        "nestedAttendeeCount": bool(re.search(r"attendees\s*\(\s*count\s*\)", select, re.I)),
    }


def build_where(filters: list[dict] | None = None, start_index: int = 0) -> dict[str, Any]:
    clauses: list[str] = []
    values: list[Any] = []
    for filter_item in filters or []:
        col = ident(filter_item["column"])
        op = filter_item.get("op")
        if op == "eq":
            values.append(filter_item["value"])
            clauses.append(f"{col} = ${start_index + len(values)}")
        elif op == "neq":
            values.append(filter_item["value"])
            clauses.append(f"{col} <> ${start_index + len(values)}")
        elif op == "is":
            if filter_item.get("value") is None:
                clauses.append(f"{col} IS NULL")
            else:
                values.append(filter_item["value"])
                clauses.append(f"{col} IS ${start_index + len(values)}")
        elif op == "in":
            items = filter_item.get("value") if isinstance(filter_item.get("value"), list) else []
            if not items:
                clauses.append("FALSE")
            else:
                values.append(items)
                clauses.append(f"{col} = ANY(${start_index + len(values)})")
    return {
        "sql": f" WHERE {' AND '.join(clauses)}" if clauses else "",
        "values": values,
    }


async def attach_attendee_counts(pool: asyncpg.Pool, rows: list[dict]) -> list[dict]:
    if not rows:
        return rows
    ids = [str(row["id"]) for row in rows]
    result = await pool.fetch(
        """SELECT event_id::text AS event_id, COUNT(*)::int AS count
             FROM attendees
            WHERE event_id::text = ANY($1::text[])
            GROUP BY event_id""",
        ids,
    )
    counts = {str(row["event_id"]): row["count"] for row in result}
    return [
        {**row, "attendees": [{"count": counts.get(str(row["id"]), 0)}]}
        for row in rows
    ]


def result_payload(rows: list[dict], *, single: bool = False, maybe_single: bool = False) -> dict:
    if single:
        if not rows:
            return {"data": None, "error": {"message": "No rows", "code": "PGRST116"}}
        return {"data": rows[0], "error": None}
    if maybe_single:
        return {"data": rows[0] if rows else None, "error": None}
    return {"data": rows, "error": None}


def scope_private_request(
    *,
    table: str,
    filters: list[dict] | None,
    data: Any,
    user_id: str,
    profile_id: str | None,
) -> dict[str, Any]:
    identity = profile_id if table in ("qr_codes", "gallery_items") else user_id
    if not identity:
        raise ValueError("User profile is required for this operation")
    scoped_filters = [f for f in (filters or []) if f.get("column") != "user_id"]
    scoped_filters.append({"op": "eq", "column": "user_id", "value": identity})
    scoped_data = data
    if isinstance(data, list):
        scoped_data = [{**row, "user_id": identity} for row in data]
    elif isinstance(data, dict):
        scoped_data = {**data, "user_id": identity}
    return {"filters": scoped_filters, "data": scoped_data}


async def get_profile_id(pool: asyncpg.Pool, user_id: str) -> str | None:
    row = await pool.fetchrow(
        "SELECT id FROM user_profiles WHERE user_id = $1 LIMIT 1",
        user_id,
    )
    return str(row["id"]) if row else None


async def get_accessible_event_ids(pool: asyncpg.Pool, user: dict) -> list[Any]:
    if user.get("is_admin"):
        rows = await pool.fetch("SELECT id FROM events")
        return [row["id"] for row in rows]
    rows = await pool.fetch(
        """SELECT e.id
             FROM events e
             LEFT JOIN event_access_grants grant_row
               ON grant_row.event_id = e.id AND grant_row.user_id = $1
            WHERE e.is_private = false
               OR e.created_by = $1
               OR grant_row.user_id IS NOT NULL""",
        user["id"],
    )
    return [row["id"] for row in rows]


async def get_accessible_attendee_ids(pool: asyncpg.Pool, user: dict) -> list[Any]:
    event_ids = await get_accessible_event_ids(pool, user)
    if not event_ids:
        return []
    rows = await pool.fetch(
        "SELECT id FROM attendees WHERE event_id = ANY($1::uuid[])",
        event_ids,
    )
    return [row["id"] for row in rows]


def hide_private_event_pins(rows: list[dict], user: dict) -> list[dict]:
    result = []
    for row in rows:
        if user.get("is_admin") or row.get("created_by") == user["id"]:
            result.append(row)
            continue
        safe = dict(row)
        safe.pop("access_pin", None)
        result.append(safe)
    return result


def filter_value(filters: list[dict] | None, column: str) -> Any:
    for filter_item in filters or []:
        if filter_item.get("column") == column:
            return filter_item.get("value")
    return None


def filter_eq_value(filters: list[dict] | None, column: str) -> Any:
    for filter_item in filters or []:
        if filter_item.get("column") == column and filter_item.get("op") == "eq":
            return filter_item.get("value")
    return None


async def get_event_role(pool: asyncpg.Pool, user: dict, event_id: Any) -> str | None:
    if not event_id:
        return None
    if user.get("is_admin"):
        return "edit"
    event = await pool.fetchrow(
        "SELECT created_by, is_private FROM events WHERE id = $1",
        event_id,
    )
    if not event:
        return None
    if event["created_by"] == user["id"]:
        return "edit"
    grant = await pool.fetchrow(
        "SELECT role FROM event_access_grants WHERE user_id = $1 AND event_id = $2",
        user["id"],
        event_id,
    )
    if grant:
        return "edit" if grant["role"] == "edit" else "view"
    if event["is_private"] is True or str(event["is_private"]).lower() == "true":
        return None
    return "view"


async def require_event_role(
    pool: asyncpg.Pool,
    user: dict,
    event_id: Any,
    min_role: str,
) -> str:
    role = await get_event_role(pool, user, event_id)
    if not role:
        raise db_error(404, "Event not found")
    if min_role == "edit" and role != "edit":
        raise db_error(403, "You can view this event, but you cannot change it")
    return role


async def enrich_event_rows(pool: asyncpg.Pool, rows: list[dict], user: dict) -> list[dict]:
    if not rows:
        return rows
    ids = [row["id"] for row in rows]
    grants = await pool.fetch(
        """SELECT event_id, role FROM event_access_grants
            WHERE user_id = $1 AND event_id = ANY($2::uuid[])""",
        user["id"],
        ids,
    )
    role_by_event = {str(row["event_id"]): row["role"] for row in grants}
    enriched = []
    for row in rows:
        granted = role_by_event.get(str(row["id"]))
        if user.get("is_admin") or row.get("created_by") == user["id"]:
            access_role = "edit"
        elif granted == "edit":
            access_role = "edit"
        elif granted:
            access_role = "view"
        elif row.get("is_private") is True or str(row.get("is_private")).lower() == "true":
            access_role = None
        else:
            access_role = "view"
        safe = {
            **row,
            "access_role": access_role,
            "can_edit": access_role == "edit",
            "has_door_code": bool(row.get("access_pin")),
        }
        safe.pop("access_pin", None)
        enriched.append(safe)
    return enriched


async def grant_event_access(
    pool: asyncpg.Pool,
    user_id: str,
    event_id: Any,
    role: str,
    granted_by: str | None = None,
) -> None:
    await pool.execute(
        """INSERT INTO event_access_grants (user_id, event_id, role, granted_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, event_id) DO UPDATE
             SET role = EXCLUDED.role,
                 granted_by = EXCLUDED.granted_by,
                 granted_at = NOW()""",
        user_id,
        event_id,
        role,
        granted_by,
    )


def text_photo_url(value: Any) -> str | None:
    return sanitize_photo_source(value)


async def save_attendee_photo(
    pool: asyncpg.Pool,
    attendee_id: str,
    source_url: Any,
    linkedin_url: Any = None,
) -> str | None:
    if linkedin_url is None:
        existing = await pool.fetchrow(
            "SELECT profile_pic_url, linkedin_url FROM attendees WHERE id = $1",
            attendee_id,
        )
        if existing:
            linkedin_url = existing["linkedin_url"]
            if not is_valid_photo_source(source_url):
                source_url = existing["profile_pic_url"]

    photo = await resolve_attendee_photo(
        str(source_url or "") or None,
        str(linkedin_url or "") or None,
        settings.upload_dir,
    )
    public_url = attendee_photo_url(attendee_id)
    if not photo:
        if str(source_url or "").startswith(f"/api/attendees/{attendee_id}/"):
            return str(source_url)
        return sanitize_photo_source(source_url)
    await pool.execute(
        """UPDATE attendees
              SET profile_pic = $2, profile_pic_mime = $3, profile_pic_url = $4
            WHERE id = $1""",
        attendee_id,
        photo["buffer"],
        photo["mime"],
        public_url,
    )
    return public_url


async def ensure_attendee_photo_columns(pool: asyncpg.Pool) -> None:
    await pool.execute("ALTER TABLE attendees ADD COLUMN IF NOT EXISTS profile_pic BYTEA")
    await pool.execute("ALTER TABLE attendees ADD COLUMN IF NOT EXISTS profile_pic_mime TEXT")


async def load_existing_updated_at(
    pool: asyncpg.Pool,
    table: str,
    filters: list[dict],
    data: Any,
    action: str,
    on_conflict: str | None,
) -> Any:
    row = data[0] if isinstance(data, list) else data
    if action == "update":
        existing_where = build_where(filters)
        if not existing_where["sql"]:
            return None
        result = await pool.fetchrow(
            f"SELECT updated_at FROM {ident(table)}{existing_where['sql']} LIMIT 1",
            *existing_where["values"],
        )
        return result["updated_at"] if result else None
    conflict_cols = [
        part.strip()
        for part in str(on_conflict or CONFLICT_DEFAULTS.get(table) or "id").split(",")
        if part.strip()
    ]
    conflict_filters = [
        {"op": "eq", "column": column, "value": row[column]}
        for column in conflict_cols
        if row and row.get(column) is not None
    ]
    if not conflict_filters:
        return None
    existing_where = build_where(conflict_filters)
    result = await pool.fetchrow(
        f"SELECT updated_at FROM {ident(table)}{existing_where['sql']} LIMIT 1",
        *existing_where["values"],
    )
    return result["updated_at"] if result else None


def _records_to_dicts(rows: list[asyncpg.Record]) -> list[dict]:
    return [dict(row) for row in rows]


async def handle_db_request(
    pool: asyncpg.Pool,
    body: dict,
    current_user: dict,
) -> dict:
    table = body.get("table")
    action = body.get("action")
    select = body.get("select", "*")
    filters = list(body.get("filters") or [])
    order = body.get("order")
    ascending = body.get("ascending", True)
    single = bool(body.get("single"))
    maybe_single = bool(body.get("maybeSingle"))
    data = body.get("data")
    on_conflict = body.get("onConflict")

    if table not in ALLOWED_TABLES:
        raise db_error(400, f"Unknown table: {table}")

    profile_id = await get_profile_id(pool, current_user["id"])

    if table in PRIVATE_TABLES:
        admin_read_all = action == "select" and current_user.get("is_admin")
        if not admin_read_all:
            scoped = scope_private_request(
                table=table,
                filters=filters,
                data=data,
                user_id=current_user["id"],
                profile_id=profile_id,
            )
            filters = scoped["filters"]
            data = scoped["data"]

    if table == "user_profiles" and not current_user.get("is_admin"):
        filters = [f for f in filters if f.get("column") != "user_id"]
        filters.append({"op": "eq", "column": "user_id", "value": current_user["id"]})
        if isinstance(data, dict):
            data = {**data, "user_id": current_user["id"]}

    if table == "users":
        if action != "select" or not current_user.get("is_admin"):
            filters = [f for f in filters if f.get("column") != "id"]
            filters.append({"op": "eq", "column": "id", "value": current_user["id"]})
        if action != "select":
            allowed = ["last_login_at", "status", "is_first_login"]
            keys = list((data or {}).keys()) if isinstance(data, dict) else []
            if action != "update" or any(key not in allowed for key in keys):
                raise db_error(403, "Use the account management API")

    select_lower = str(select).lower()
    if "password_hash" in select_lower or any(
        str(f.get("column", "")).lower() == "password_hash" for f in filters
    ):
        raise db_error(403, "Password data is not accessible")

    if table == "events":
        if action == "insert":
            if isinstance(data, list):
                data = [{**row, "created_by": current_user["id"]} for row in data]
            else:
                data = {**(data or {}), "created_by": current_user["id"]}
        elif action == "select":
            accessible_event_ids = await get_accessible_event_ids(pool, current_user)
            filters = [f for f in filters if not (f.get("column") == "id" and f.get("op") == "in")]
            filters.append({"op": "in", "column": "id", "value": accessible_event_ids})
        else:
            event_id = filter_value(filters, "id")
            if not event_id and filter_value(filters, "slug"):
                found = await pool.fetchrow(
                    "SELECT id FROM events WHERE slug = $1 LIMIT 1",
                    filter_value(filters, "slug"),
                )
                event_id = found["id"] if found else None
            if not event_id:
                raise db_error(400, "Event id is required")
            if action == "delete":
                owner = await pool.fetchrow(
                    "SELECT created_by FROM events WHERE id = $1",
                    event_id,
                )
                if not current_user.get("is_admin") and owner and owner["created_by"] != current_user["id"]:
                    raise db_error(403, "Only the organizer or an administrator can delete this event")
            else:
                role = await get_event_role(pool, current_user, event_id)
                if role != "edit":
                    raise db_error(403, "You can view this event, but you cannot change it")

    if table in ("contacts", "attendee_stage") and action != "select":
        raise db_error(403, "View is read-only")

    if table in ("attendees", "contacts"):
        accessible_event_ids = await get_accessible_event_ids(pool, current_user)
        filters = [f for f in filters if not (f.get("column") == "event_id" and f.get("op") == "in")]
        if action == "select":
            filters.append({"op": "in", "column": "event_id", "value": accessible_event_ids})
        rows_to_check = data if isinstance(data, list) else ([data] if data else [])
        if any(
            row.get("event_id")
            and not any(str(eid) == str(row["event_id"]) for eid in accessible_event_ids)
            for row in rows_to_check
        ):
            raise db_error(403, "Event access required")
        if table == "attendees" and action != "select":
            event_id = next((row.get("event_id") for row in rows_to_check if row.get("event_id")), None)
            if not event_id:
                event_id = filter_eq_value(filters, "event_id")
            if not event_id:
                attendee_id = filter_eq_value(filters, "id")
                if attendee_id:
                    found = await pool.fetchrow(
                        "SELECT event_id FROM attendees WHERE id = $1",
                        attendee_id,
                    )
                    event_id = found["event_id"] if found else None
            role = await get_event_role(pool, current_user, event_id)
            if role != "edit":
                raise db_error(
                    403,
                    "You can view people in this event, but you cannot change them unless an administrator grants you edit access",
                )

    if table == "attendee_insights":
        accessible_attendee_ids = await get_accessible_attendee_ids(pool, current_user)
        filters = [
            f for f in filters if not (f.get("column") == "attendee_id" and f.get("op") == "in")
        ]
        if action == "select":
            filters.append({"op": "in", "column": "attendee_id", "value": accessible_attendee_ids})
        insight_rows = data if isinstance(data, list) else ([data] if data else [])
        if any(
            row.get("attendee_id")
            and not any(str(aid) == str(row["attendee_id"]) for aid in accessible_attendee_ids)
            for row in insight_rows
        ):
            raise db_error(403, "Event access required")
        if action != "select":
            attendee_id = next(
                (row.get("attendee_id") for row in insight_rows if row.get("attendee_id")),
                None,
            )
            if not attendee_id:
                attendee_id = filter_eq_value(filters, "attendee_id")
            if not attendee_id:
                insight_id = filter_eq_value(filters, "id")
                if insight_id:
                    found = await pool.fetchrow(
                        "SELECT attendee_id FROM attendee_insights WHERE id = $1",
                        insight_id,
                    )
                    attendee_id = found["attendee_id"] if found else None
            event_row = (
                await pool.fetchrow("SELECT event_id FROM attendees WHERE id = $1", attendee_id)
                if attendee_id
                else None
            )
            role = await get_event_role(pool, current_user, event_row["event_id"] if event_row else None)
            if role != "edit":
                raise db_error(
                    403,
                    "Directory briefs are shared on the event. Only people with edit access can change them.",
                )

    if table == "events" and action in ("insert", "update", "upsert"):
        try:
            if isinstance(data, list):
                data = [await prepare_event_secrets(row) for row in data]
            else:
                data = await prepare_event_secrets(data)
        except ValueError as error:
            status = getattr(error, "status", 400)
            raise db_error(status, str(error))

    if table in VERSIONED_TABLES and action in ("update", "upsert"):
        expected_updated_at = extract_expected_updated_at(data[0] if isinstance(data, list) else data)
        existing_updated_at = await load_existing_updated_at(
            pool, table, filters, data, action, on_conflict
        )
        if is_stale_write(existing_updated_at, expected_updated_at):
            raise db_error(409, "A newer version exists on another device", code="CONFLICT")

    data = strip_conflict_meta(data)

    table_sql = ident(table)
    parsed = parse_select(select)
    columns = parsed["columns"]
    nested_attendee_count = parsed["nestedAttendeeCount"]
    where = build_where(filters)

    if action == "select":
        sql = f"SELECT {select_sql_for_table(table, columns)} FROM {table_sql}{where['sql']}"
        values = list(where["values"])
        if order:
            sql += f" ORDER BY {ident(order)} {'ASC' if ascending else 'DESC'}"
        sql += f" LIMIT {MAX_DB_SELECT_ROWS}"
        rows = _records_to_dicts(await pool.fetch(sql, *values))
        rows = sanitize_rows(table, rows)
        if table in ("attendees", "contacts"):
            rows = enrich_attendee_photo_urls(rows)
        if table == "events":
            rows = await enrich_event_rows(pool, rows, current_user)
        if nested_attendee_count and table == "events":
            rows = await attach_attendee_counts(pool, rows)
        return result_payload(rows, single=single, maybe_single=maybe_single)

    if action == "insert":
        rows_in = data if isinstance(data, list) else [data]
        if not rows_in:
            return {"data": [], "error": None}
        keys = list({key for row in rows_in for key in (row or {}).keys()})
        inserted: list[dict] = []
        for row in rows_in:
            photo_source = (row or {}).get("profile_pic_url")
            prepared = normalize_timestamps(dict(await hash_password_fields(row) or {}))
            prepared.pop("profile_pic", None)
            prepared.pop("profile_pic_mime", None)
            if str(prepared.get("profile_pic_url") or "").startswith("data:"):
                prepared["profile_pic_url"] = None
            cols = [
                key
                for key in keys
                if key not in ("profile_pic", "profile_pic_mime") and prepared.get(key) is not None
            ]
            values = [prepared[key] for key in cols]
            placeholders = [f"${index + 1}" for index in range(len(cols))]
            returning = (
                select_sql_for_table("attendees", "*")
                if table in ("attendees", "contacts")
                else "*"
            )
            if cols:
                sql = (
                    f"INSERT INTO {table_sql} ({', '.join(ident(key) for key in cols)}) "
                    f"VALUES ({', '.join(placeholders)}) RETURNING {returning}"
                )
            else:
                sql = f"INSERT INTO {table_sql} DEFAULT VALUES RETURNING {returning}"
            saved_row = await pool.fetchrow(sql, *values)
            saved = strip_photo_bytes(sanitize_user_row(dict(saved_row) if saved_row else None))
            if table == "attendees" and saved and saved.get("id"):
                saved["profile_pic_url"] = await save_attendee_photo(
                    pool, str(saved["id"]), photo_source
                )
            inserted.append(saved or {})
        if table == "events":
            for row in inserted:
                await pool.execute(
                    """INSERT INTO event_access_grants (user_id, event_id, role, granted_by)
                       VALUES ($1, $2, 'edit', $1)
                       ON CONFLICT (user_id, event_id) DO NOTHING""",
                    current_user["id"],
                    row["id"],
                )
            enriched = await enrich_event_rows(pool, inserted, current_user)
            return result_payload(enriched, single=single, maybe_single=maybe_single)
        if table in ("attendees", "contacts"):
            inserted = enrich_attendee_photo_urls(inserted)
        return result_payload(inserted, single=single, maybe_single=maybe_single)

    if action == "update":
        payload = normalize_timestamps(dict(await hash_password_fields(data or {}) or {}))
        photo_source = payload.get("profile_pic_url")
        payload.pop("profile_pic", None)
        payload.pop("profile_pic_mime", None)
        if str(payload.get("profile_pic_url") or "").startswith("data:"):
            payload["profile_pic_url"] = None
        cols = list(payload.keys())
        if not cols:
            return result_payload([], single=single, maybe_single=maybe_single)
        sets = [f"{ident(key)} = ${index + 1}" for index, key in enumerate(cols)]
        update_where = build_where(filters, len(cols))
        values = [payload[key] for key in cols] + update_where["values"]
        returning = (
            select_sql_for_table("attendees", "*")
            if table in ("attendees", "contacts")
            else "*"
        )
        sql = f"UPDATE {table_sql} SET {', '.join(sets)}{update_where['sql']} RETURNING {returning}"
        rows = _records_to_dicts(await pool.fetch(sql, *values))
        rows = sanitize_rows(table, rows)
        if table == "attendees":
            for row in rows:
                row["profile_pic_url"] = await save_attendee_photo(
                    pool, str(row["id"]), photo_source
                )
        if table in ("attendees", "contacts"):
            rows = enrich_attendee_photo_urls(rows)
        return result_payload(rows, single=single, maybe_single=maybe_single)

    if action == "delete":
        sql = f"DELETE FROM {table_sql}{where['sql']} RETURNING *"
        rows = _records_to_dicts(await pool.fetch(sql, *where["values"]))
        return result_payload(sanitize_rows(table, rows), single=single, maybe_single=maybe_single)

    if action == "upsert":
        row = normalize_timestamps(
            dict(await hash_password_fields(data[0] if isinstance(data, list) else data) or {})
        )
        conflict_cols = [
            part.strip()
            for part in str(on_conflict or CONFLICT_DEFAULTS.get(table) or "id").split(",")
            if part.strip()
        ]
        photo_source = row.get("profile_pic_url")
        row.pop("profile_pic", None)
        row.pop("profile_pic_mime", None)
        if str(row.get("profile_pic_url") or "").startswith("data:"):
            row["profile_pic_url"] = None
        cols = list(row.keys())
        values = [row[key] for key in cols]
        placeholders = [f"${index + 1}" for index in range(len(cols))]
        update_cols = [key for key in cols if key not in conflict_cols]
        if update_cols:
            updates = ", ".join(f"{ident(key)} = EXCLUDED.{ident(key)}" for key in update_cols)
        else:
            updates = f"{ident(cols[0])} = EXCLUDED.{ident(cols[0])}"
        returning = (
            select_sql_for_table("attendees", "*")
            if table in ("attendees", "contacts")
            else "*"
        )
        sql = f"""
            INSERT INTO {table_sql} ({', '.join(ident(key) for key in cols)})
            VALUES ({', '.join(placeholders)})
            ON CONFLICT ({', '.join(ident(key) for key in conflict_cols)})
            DO UPDATE SET {updates}
            RETURNING {returning}
        """
        rows = _records_to_dicts(await pool.fetch(sql, *values))
        rows = sanitize_rows(table, rows)
        if table == "attendees":
            for saved in rows:
                saved["profile_pic_url"] = await save_attendee_photo(
                    pool, str(saved["id"]), photo_source
                )
        if table in ("attendees", "contacts"):
            rows = enrich_attendee_photo_urls(rows)
        return result_payload(rows, single=single, maybe_single=maybe_single)

    raise db_error(400, f"Unknown action: {action}")
