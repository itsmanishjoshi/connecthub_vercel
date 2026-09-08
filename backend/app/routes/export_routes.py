from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends

from app.database import get_pool
from app.db_handler import get_accessible_event_ids
from app.dependencies import get_current_user
from app.services.analytics import log_activity
from app.services.event_export import (
    build_full_event_export,
    build_user_event_export,
    list_full_export_events,
    list_user_export_events,
)
from app.services.notes_export import build_attendee_notes_csv

router = APIRouter()


@router.get("/api/me/export/events")
async def export_events(
    user: dict = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    try:
        events = await list_user_export_events(pool, str(user["id"]))
        return {"events": events}
    except Exception as error:
        print(f"Export events error: {error}")
        from app.dependencies import api_error

        raise api_error(500, "Could not list export events")


@router.get("/api/me/export/event/{event_id}")
async def export_event(
    event_id: str,
    user: dict = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    try:
        export_payload = await build_user_event_export(pool, str(user["id"]), event_id)
        if not export_payload:
            from app.dependencies import api_error

            raise api_error(404, "Event not found")
        await log_activity(
            pool,
            user_id=str(user["id"]),
            kind="export",
            event_id=event_id,
            label=export_payload["event"]["name"],
            meta={"format": "my-data"},
        )
        return {"export": export_payload}
    except Exception as error:
        from fastapi import HTTPException

        if isinstance(error, HTTPException):
            raise
        print(f"Export event error: {error}")
        from app.dependencies import api_error

        raise api_error(500, "Could not build export")


@router.get("/api/me/export/full/events")
async def export_full_events(
    user: dict = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    try:
        event_ids = await get_accessible_event_ids(pool, user)
        events = await list_full_export_events(pool, event_ids)
        return {"events": events}
    except Exception as error:
        print(f"Full export events error: {error}")
        from app.dependencies import api_error

        raise api_error(500, "Could not list export events")


@router.get("/api/me/export/full/event/{event_id}")
async def export_full_event(
    event_id: str,
    user: dict = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    try:
        event_ids = await get_accessible_event_ids(pool, user)
        if not any(str(eid) == str(event_id) for eid in event_ids):
            from app.dependencies import api_error

            raise api_error(403, "You do not have access to this event")
        export_payload = await build_full_event_export(pool, str(user["id"]), event_id)
        if not export_payload:
            from app.dependencies import api_error

            raise api_error(404, "Event not found")
        await log_activity(
            pool,
            user_id=str(user["id"]),
            kind="export_full",
            event_id=event_id,
            label=export_payload["event"]["name"],
            meta={"format": "full"},
        )
        return {"export": export_payload}
    except Exception as error:
        from fastapi import HTTPException

        if isinstance(error, HTTPException):
            raise
        print(f"Full export event error: {error}")
        from app.dependencies import api_error

        raise api_error(500, "Could not build full export")


@router.get("/api/me/export/notes-csv")
async def export_notes_csv(
    event_id: str | None = None,
    user: dict = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    try:
        event_ids = [event_id] if event_id else None
        csv_text = await build_attendee_notes_csv(pool, user, event_ids)
        return {"csv": csv_text}
    except Exception as error:
        print(f"Notes CSV export error: {error}")
        from app.dependencies import api_error

        raise api_error(500, "Could not export notes")
