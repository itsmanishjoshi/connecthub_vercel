from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, List, Optional

import asyncpg
from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import Response

from app.config import settings
from app.database import get_pool
from app.db_handler import require_event_role, save_attendee_photo
from app.dependencies import api_error, authenticate, require_admin
from app.security import is_allowed_photo_proxy_url
from app.photo_store import attendee_photo_url, sanitize_photo_source, select_sql_for_table, strip_photo_bytes
from app.services.people_ingest import (
    coerce_extra_data,
    extract_people,
    finalize_import_people,
    find_matching_person,
    merge_person,
    name_key,
    promote_extra_fields,
)
from app.services.photo_import import DEFAULT_INGEST_XLSX, import_event_photos_from_spreadsheet
from app.services.remote_photo import resolve_attendee_photo, resolve_photo_bytes

router = APIRouter()


def text_photo_url(value: Any) -> str | None:
    return sanitize_photo_source(value)


def incoming_person_from_ingest(person: dict) -> tuple[dict, Any]:
    promoted = promote_extra_fields(dict(person))
    extra = coerce_extra_data(promoted.get("extra_data"))
    extra.pop("possible_duplicate", None)
    extra.pop("duplicate_with", None)
    photo_source = promoted.get("profile_pic_url")
    incoming = {
        "name": promoted.get("name"),
        "designation": promoted.get("designation") or None,
        "company": promoted.get("company") or None,
        "industry": promoted.get("industry") or None,
        "location": promoted.get("location") or None,
        "city": promoted.get("city") or None,
        "linkedin_url": promoted.get("linkedin_url") or None,
        "website_url": promoted.get("website_url") or None,
        "key_insights": promoted.get("key_insights") or None,
        "ice_breakers": promoted.get("ice_breakers") or None,
        "event_association": promoted.get("event_association") or None,
        "speaker": bool(promoted.get("speaker")),
        "competitor": bool(promoted.get("competitor")),
        "priority": promoted.get("priority"),
        "extra_data": extra,
        "profile_pic_url": text_photo_url(photo_source),
    }
    return incoming, photo_source


def incoming_has_notes(incoming: dict) -> bool:
    def text(value: Any) -> str:
        return "" if value is None else str(value).strip()

    return bool(
        text(incoming.get("key_insights"))
        or text(incoming.get("ice_breakers"))
        or text(incoming.get("designation"))
        or text(incoming.get("company"))
        or text(incoming.get("linkedin_url"))
    )


async def update_matched_attendee(
    pool: asyncpg.Pool,
    *,
    match: dict,
    incoming: dict,
    photo_source: Any,
    existing_people: list[dict],
) -> dict:
    merged = merge_person(match, incoming)
    row = await pool.fetchrow(
        f"""UPDATE attendees SET
              name = $2,
              designation = $3,
              company = $4,
              industry = $5,
              location = $6,
              city = $7,
              linkedin_url = $8,
              website_url = $9,
              key_insights = $10,
              ice_breakers = $11,
              event_association = $12,
              speaker = $13,
              competitor = $14,
              extra_data = $15::jsonb,
              profile_pic_url = COALESCE($16, profile_pic_url)
            WHERE id = $1
            RETURNING {select_sql_for_table('attendees', '*')}""",
        match["id"],
        merged["name"],
        merged.get("designation"),
        merged.get("company"),
        merged.get("industry"),
        merged.get("location"),
        merged.get("city"),
        merged.get("linkedin_url"),
        merged.get("website_url"),
        merged.get("key_insights"),
        merged.get("ice_breakers"),
        merged.get("event_association"),
        merged.get("speaker"),
        merged.get("competitor"),
        json.dumps(merged.get("extra_data") or {}),
        incoming.get("profile_pic_url"),
    )
    row = strip_photo_bytes(dict(row) if row else None) or {}
    lacks_photo = not bool(match.get("has_profile_photo"))
    resolved_source = photo_source or (incoming.get("profile_pic_url") if lacks_photo else None)
    if resolved_source:
        row["profile_pic_url"] = await save_attendee_photo(
            pool,
            str(row["id"]),
            resolved_source,
            merged.get("linkedin_url") or match.get("linkedin_url"),
        )
    for index, item in enumerate(existing_people):
        if item.get("id") == match.get("id"):
            existing_people[index] = dict(row)
            break
    return row


async def upsert_ingested_people(pool: asyncpg.Pool, event_id: str, people: list[dict]) -> dict:
    added = 0
    updated = 0
    skipped = 0
    saved: list[dict] = []

    existing_rows = await pool.fetch(
        f"SELECT {select_sql_for_table('attendees', '*')} FROM attendees WHERE event_id = $1",
        event_id,
    )
    existing_people = [
        {
            **(strip_photo_bytes(dict(row)) or {}),
            "extra_data": coerce_extra_data(row["extra_data"]),
        }
        for row in existing_rows
    ]
    prepared = finalize_import_people(people, existing_people)

    for person in prepared:
        action = str(person.get("ingest_action") or person.get("action") or "upsert").lower()
        if action == "skip":
            skipped += 1
            continue

        incoming, photo_source = incoming_person_from_ingest(person)
        match = find_matching_person(existing_people, incoming)
        if not match:
            same_name = [row for row in existing_people if name_key(row) == name_key(incoming)]
            if len(same_name) == 1 and len(name_key(incoming).split()) >= 2:
                match = same_name[0]

        if action == "upsert":
            action = "update" if match else "add"

        if match:
            if action == "add" and not incoming_has_notes(incoming):
                skipped += 1
                continue
            row = await update_matched_attendee(
                pool,
                match=match,
                incoming=incoming,
                photo_source=photo_source,
                existing_people=existing_people,
            )
            updated += 1
            saved.append({**row, "status": "updated"})
            continue

        if action == "update":
            skipped += 1
            continue

        inserted = await pool.fetchrow(
            f"""INSERT INTO attendees
                  (event_id, name, designation, company, industry, location, city, profile_pic_url,
                   linkedin_url, website_url, key_insights, ice_breakers, event_association, speaker, competitor, extra_data)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
                 RETURNING {select_sql_for_table('attendees', '*')}""",
            event_id,
            incoming["name"],
            incoming.get("designation"),
            incoming.get("company"),
            incoming.get("industry"),
            incoming.get("location"),
            incoming.get("city"),
            incoming.get("profile_pic_url"),
            incoming.get("linkedin_url"),
            incoming.get("website_url"),
            incoming.get("key_insights"),
            incoming.get("ice_breakers"),
            incoming.get("event_association"),
            incoming.get("speaker"),
            incoming.get("competitor"),
            json.dumps(incoming.get("extra_data") or {}),
        )
        added += 1
        row = strip_photo_bytes(dict(inserted) if inserted else None) or {}
        row["profile_pic_url"] = await save_attendee_photo(
            pool,
            str(row["id"]),
            photo_source,
            incoming.get("linkedin_url"),
        )
        existing_people.append(dict(row))
        saved.append({**row, "status": "added"})

    photos: dict[str, Any] | None = None
    if DEFAULT_INGEST_XLSX.is_file():
        photos = await import_event_photos_from_spreadsheet(
            pool,
            event_id,
            DEFAULT_INGEST_XLSX.read_bytes(),
            filename=DEFAULT_INGEST_XLSX.name,
        )

    return {
        "added": added,
        "updated": updated,
        "skipped": skipped,
        "people": saved,
        "photos": photos,
    }


class UploadFileWrapper:
    def __init__(self, upload: UploadFile, data: bytes):
        self.originalname = upload.filename
        self.filename = upload.filename
        self.mimetype = upload.content_type
        self.buffer = data
        self.size = len(data)

    def read(self) -> bytes:
        return self.buffer


@router.post("/api/events/{event_id}/people/extract")
async def people_extract(
    event_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
    files: Optional[List[UploadFile]] = File(None),
    text: Optional[str] = Form(default=None),
):
    user = await authenticate(request, pool)
    require_admin(user)
    await require_event_role(pool, user, event_id, "edit")
    try:
        settings.ingest_upload_dir.mkdir(parents=True, exist_ok=True)
        upload_list = files or []
        wrapped_files = []
        for upload in upload_list:
            data = await upload.read()
            wrapped_files.append(UploadFileWrapper(upload, data))
            safe = re.sub(r"[^\w.\- ()]", "_", str(upload.filename or "upload.xlsx"))
            if re.search(r"\.(xlsx|xls|csv)$", safe, re.I):
                (settings.ingest_upload_dir / "ingest-last.xlsx").write_bytes(data)
            if re.search(r"\.docx$", safe, re.I):
                (settings.ingest_upload_dir / "ingest-last.docx").write_bytes(data)

        print(
            "people extract",
            {
                "eventId": event_id,
                "files": [
                    {"name": f.filename, "size": f.size, "mime": f.mimetype}
                    for f in wrapped_files
                ],
            },
        )
        result = await extract_people(
            text=text,
            files=wrapped_files,
            upload_dir=str(settings.upload_dir),
            log={
                "pool": pool,
                "user_id": str(user["id"]),
                "route": "/api/people/extract",
                "feature": "People card import",
                "meta": {"event_id": event_id},
            },
        )
        existing = await pool.fetch(
            """SELECT id, name, company, designation, industry, location, city, linkedin_url, website_url,
                      key_insights, ice_breakers, event_association, speaker, competitor, extra_data
                 FROM attendees WHERE event_id = $1""",
            event_id,
        )
        result["people"] = finalize_import_people(
            result["people"],
            [{**dict(row), "extra_data": coerce_extra_data(row["extra_data"])} for row in existing],
        )
        print(
            f"people extract ok: {len(result['people'])} people "
            f"({'+'.join(result.get('sourceKinds') or ['mixed'])})"
        )
        return {
            "people": result["people"],
            "warnings": result.get("warnings") or [],
            "sourceKinds": result.get("sourceKinds") or [],
        }
    except Exception as error:
        status = getattr(error, "status", 500)
        print(f"people extract failed: {error}")
        raise api_error(status, str(error) or "Could not read people from that source")


@router.post("/api/events/{event_id}/people/commit")
async def people_commit(
    event_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    user = await authenticate(request, pool)
    require_admin(user)
    await require_event_role(pool, user, event_id, "edit")
    try:
        body = await request.json()
    except Exception:
        body = {}
    people = body.get("people") if isinstance(body.get("people"), list) else []
    if not people:
        raise api_error(400, "No people to save")
    try:
        return await upsert_ingested_people(pool, event_id, people)
    except Exception as error:
        raise api_error(500, str(error) or "Could not save people")


@router.post("/api/events/{event_id}/people/import-photos")
async def people_import_photos(
    event_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
    file: UploadFile | None = File(default=None),
):
    user = await authenticate(request, pool)
    require_admin(user)
    await require_event_role(pool, user, event_id, "edit")

    buffer: bytes | None = None
    filename = "ingest-last.xlsx"
    if file and file.filename:
        buffer = await file.read()
        filename = file.filename
    elif DEFAULT_INGEST_XLSX.is_file():
        buffer = DEFAULT_INGEST_XLSX.read_bytes()
        filename = DEFAULT_INGEST_XLSX.name

    if not buffer:
        raise api_error(
            400,
            "Upload the Excel roster (.xlsx) with embedded photos, or import people from Excel first.",
        )

    try:
        return await import_event_photos_from_spreadsheet(
            pool,
            event_id,
            buffer,
            filename=filename,
        )
    except Exception as error:
        raise api_error(500, str(error) or "Could not import photos from that file")


@router.get("/api/photos/proxy")
async def proxy_photo(
    url: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    user = await authenticate(request, pool)
    if not user:
        return Response(status_code=401)
    if not is_allowed_photo_proxy_url(url):
        return Response(status_code=403)
    loaded = await resolve_photo_bytes(url, settings.upload_dir)
    if not loaded:
        return Response(status_code=404)
    return Response(
        content=bytes(loaded["buffer"]),
        media_type=loaded["mime"] or "image/jpeg",
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.get("/api/attendees/{attendee_id}/photo")
async def attendee_photo(
    attendee_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    user = await authenticate(request, pool)
    row = await pool.fetchrow(
        "SELECT event_id, profile_pic, profile_pic_mime, profile_pic_url, linkedin_url FROM attendees WHERE id = $1",
        attendee_id,
    )
    if not row:
        return Response(status_code=404)
    from app.db_handler import get_event_role

    role = await get_event_role(pool, user, row["event_id"])
    if not role:
        return Response(status_code=403)

    bytes_data = row["profile_pic"]
    mime = row["profile_pic_mime"]
    if bytes_data:
        bytes_data = bytes(bytes_data)
    if not bytes_data:
        loaded = await resolve_attendee_photo(
            row["profile_pic_url"],
            row["linkedin_url"],
            settings.upload_dir,
        )
        if loaded:
            bytes_data = loaded["buffer"]
            mime = loaded["mime"]
            await pool.execute(
                """UPDATE attendees SET profile_pic = $2, profile_pic_mime = $3, profile_pic_url = $4
                    WHERE id = $1""",
                attendee_id,
                bytes_data,
                mime,
                attendee_photo_url(attendee_id),
            )
    if not bytes_data:
        return Response(status_code=404)
    return Response(
        content=bytes(bytes_data),
        media_type=mime or "image/jpeg",
        headers={"Cache-Control": "private, max-age=3600"},
    )
