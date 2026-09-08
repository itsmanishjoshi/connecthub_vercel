"""Jelly agent — intent detection, analyze, and execute on the server."""

from __future__ import annotations

import re
import uuid
from typing import Any

import asyncpg

from app.auth import prepare_event_secrets
from app.db_handler import get_event_role, get_profile_id
from app.services.ai_context import (
    build_smart_context,
    filter_attendees,
    jelly_messages,
    try_direct_attendee_answer,
    _combined_query,
)
from app.services.ai_router import complete
from app.services.jelly_data import load_app_data, load_conversation_insights

WRITE_PATTERN = re.compile(
    r"^(please\s+)?(add|create|delete|remove|update|edit|rename)\b",
    re.I,
)
WRITE_ENTITY = re.compile(r"(event|attendee|person|people|note|contact)", re.I)
CONVERSATION_QUERY = re.compile(
    r"conversation|transcript|pain point|said about|meeting|opportunity|mom|minutes",
    re.I,
)


def _extract_event_params(query: str) -> dict[str, Any]:
    params: dict[str, Any] = {}
    name_match = re.search(r'event\s+(?:called|named)?\s*["\']([^"\']+)["\']', query, re.I) or re.search(
        r'["\']([^"\']+)["\']\s+event', query, re.I
    )
    if name_match:
        params["name"] = name_match.group(1)
    date_match = re.search(r"on\s+(\d{4}-\d{2}-\d{2})|date\s+(\d{4}-\d{2}-\d{2})", query, re.I)
    if date_match:
        params["date"] = date_match.group(1) or date_match.group(2)
    place_match = re.search(r"(?:at|in|location)\s+([A-Za-z\s]+?)(?:\s+on|\s+with|$)", query, re.I)
    if place_match:
        params["place"] = place_match.group(1).strip()
    return params


def _extract_attendee_params(query: str) -> dict[str, Any]:
    params: dict[str, Any] = {}
    name_match = re.search(
        r'(?:named|called)\s+["\']?([A-Za-z\s]+?)["\']?(?:\s+from|\s+at|\s+as|$)', query, re.I
    )
    if name_match:
        params["name"] = name_match.group(1).strip()
    company_match = re.search(r"(?:from|at|company)\s+([A-Z][A-Za-z\s]+?)(?:\s+as|\s+in|$)", query)
    if company_match:
        params["company"] = company_match.group(1).strip()
    designation_match = re.search(r"as\s+([A-Za-z\s]+?)(?:\s+from|\s+at|$)", query, re.I)
    if designation_match:
        params["designation"] = designation_match.group(1).strip()
    location_match = re.search(r"in\s+([A-Za-z\s]+?)$", query, re.I)
    if location_match:
        params["city"] = location_match.group(1).strip()
    return params


def _extract_note_params(query: str) -> dict[str, Any]:
    params: dict[str, Any] = {}
    note_match = re.search(r'note\s+["\']([^"\']+)["\']', query, re.I) or re.search(
        r':\s*["\']?([^"\']+)["\']?$', query, re.I
    )
    if note_match:
        params["note"] = note_match.group(1)
    person_match = re.search(r"about\s+([A-Za-z\s]+?)(?:\s+:|$)", query, re.I)
    if person_match:
        params["personName"] = person_match.group(1).strip()
    return params


def detect_intent(query: str) -> tuple[str, dict[str, Any]]:
    lower = query.lower()
    if re.search(r"create|add|new.*event", lower):
        return "create_event", _extract_event_params(query)
    if re.search(r"update|change|modify|edit.*event", lower):
        return "update_event", _extract_event_params(query)
    if re.search(r"delete|remove.*event", lower):
        return "delete_event", _extract_event_params(query)
    if re.search(r"add|create.*attendee|add.*person|add.*people", lower):
        return "create_attendee", _extract_attendee_params(query)
    if re.search(r"update|change|modify.*attendee|change.*person", lower):
        return "update_attendee", _extract_attendee_params(query)
    if re.search(r"delete|remove.*attendee|remove.*person", lower):
        return "delete_attendee", _extract_attendee_params(query)
    if re.search(r"add.*note|write.*note|note.*about", lower):
        return "add_note", _extract_note_params(query)
    if re.search(r"\bexport\b.*\b(my|notes|data|conversations|priority|activity)\b", lower) or re.search(
        r"download.*(my notes|my data|export)", lower
    ):
        return "export_my_data", {}
    return "read", {}


def _find_event(app_data: dict[str, Any], name: str | None) -> dict[str, Any] | None:
    if not name:
        return None
    for event in app_data.get("events") or []:
        if name.lower() in str(event.get("name") or "").lower():
            return event
    return None


def _find_attendee(app_data: dict[str, Any], name: str | None) -> dict[str, Any] | None:
    if not name:
        return None
    for event in app_data.get("events") or []:
        for attendee in event.get("attendees") or []:
            if name.lower() in str(attendee.get("name") or "").lower():
                return attendee
    return None


def _action(action_type: str, description: str, data: dict[str, Any] | None = None, *, confirm: bool = False) -> dict[str, Any]:
    return {
        "message": description,
        "action": {
            "type": action_type,
            "description": description,
            "data": data or {},
            "requiresConfirmation": confirm,
            "reversible": confirm,
        },
        "needsConfirmation": confirm,
    }


async def analyze_query(pool: asyncpg.Pool, user: dict, query: str) -> dict[str, Any]:
    app_data = await load_app_data(pool, user)
    intent_type, params = detect_intent(query)

    if intent_type == "create_event":
        if not params.get("name"):
            return {"message": "I'd love to create an event! But I need at least a name.", "needsConfirmation": False}
        return _action("create_event", f"I'll create a new event:\n\nEvent: {params['name']}", params, confirm=True)

    if intent_type == "update_event":
        event = _find_event(app_data, params.get("name"))
        if not event:
            return {"message": f'I could not find an event matching "{params.get("name")}".', "needsConfirmation": False}
        return _action("update_event", f'I\'ll update "{event["name"]}".', {"id": event["id"], **params}, confirm=True)

    if intent_type == "delete_event":
        event = _find_event(app_data, params.get("name"))
        if not event:
            return {"message": f'I could not find an event matching "{params.get("name")}".', "needsConfirmation": False}
        return _action(
            "delete_event",
            f'This will permanently delete "{event["name"]}" and all its attendees.',
            {"id": event["id"], "backup": event},
            confirm=True,
        )

    if intent_type in ("create_attendee", "update_attendee", "delete_attendee"):
        events = app_data.get("events") or []
        editable = [e for e in events if e.get("can_edit")]
        if not editable and not user.get("is_admin"):
            return {
                "message": "You can view people cards, but only administrators or people with edit access can change them. Ask an admin to grant edit access from the Access button.",
                "needsConfirmation": False,
            }

    if intent_type == "create_attendee":
        if not params.get("name"):
            return {"message": "I need a name to add someone.", "needsConfirmation": False}
        events = app_data.get("events") or []
        if len(events) == 1:
            params["event_id"] = events[0]["id"]
        return _action("create_attendee", f"I'll add {params['name']}.", params, confirm=True)

    if intent_type in ("update_attendee", "delete_attendee"):
        attendee = _find_attendee(app_data, params.get("name"))
        if not attendee:
            return {"message": f'I could not find "{params.get("name")}".', "needsConfirmation": False}
        action_type = "update_attendee" if intent_type == "update_attendee" else "delete_attendee"
        payload = {"id": attendee["id"], **params}
        if action_type == "delete_attendee":
            payload["backup"] = attendee
        verb = "update" if action_type == "update_attendee" else "remove"
        return _action(action_type, f"I'll {verb} {attendee['name']}.", payload, confirm=True)

    if intent_type == "add_note":
        if not params.get("note") or not params.get("personName"):
            return {"message": "I need both a person's name and the note content.", "needsConfirmation": False}
        attendee = _find_attendee(app_data, params.get("personName"))
        if not attendee:
            return {"message": f'I could not find "{params.get("personName")}".', "needsConfirmation": False}
        return _action(
            "add_note",
            f'I\'ll add this note to {attendee["name"]}:\n\n"{params["note"]}"',
            {"attendee_id": attendee["id"], "note": params["note"]},
            confirm=True,
        )

    if intent_type == "export_my_data":
        events = app_data.get("events") or []
        if not events:
            return {
                "message": "You do not have any personal activity to export yet. Add notes, conversations, or priority flags first.",
                "needsConfirmation": False,
            }
        return {
            "message": (
                "Open **Account menu → Export my data** to download your notes, conversations, and priority flags "
                "as Markdown or JSON. Only your private activity is included."
            ),
            "action": {
                "type": "read",
                "description": "Export personal data",
                "requiresConfirmation": False,
                "reversible": False,
            },
            "needsConfirmation": False,
        }

    context = build_smart_context(query, app_data)
    if CONVERSATION_QUERY.search(query) and app_data.get("conversations"):
        insights = await load_conversation_insights(
            pool, [item["id"] for item in app_data["conversations"][:4]]
        )
        blocks = []
        for conversation in app_data["conversations"][:4]:
            useful = (insights.get(str(conversation["id"])) or [])[:6]
            lines = "\n".join(f"- {item['kind']}: {item['body']}" for item in useful)
            blocks.append(f"{conversation.get('title') or 'Conversation'}:\n{lines}")
        if blocks:
            context = f"{context}\n\nSAVED CONVERSATIONS:\n" + "\n\n".join(blocks)

    result = await complete(
        {
            "task": "chat",
            "tier": "lite",
            "messages": jelly_messages(query, context),
            "temperature": 0.35,
            "maxTokens": 900,
            "_log": {
                "pool": pool,
                "user_id": str(user["id"]),
                "route": "/api/ai/jelly/analyze",
                "feature": "Jelly assistant",
                "task": "chat",
            },
        }
    )
    return {
        "message": result.get("text") or "I couldn't generate a response.",
        "action": {
            "type": "read",
            "description": "Read data from database",
            "requiresConfirmation": False,
            "reversible": False,
        },
        "needsConfirmation": False,
    }


async def jelly_chat(pool: asyncpg.Pool, user: dict, query: str, history: list[dict[str, str]] | None = None) -> str:
    app_data = await load_app_data(pool, user)
    direct = try_direct_attendee_answer(query, app_data, history)
    if direct:
        return direct
    context = build_smart_context(query, app_data, history)
    filtered, _ = filter_attendees(_combined_query(query, history), app_data)
    max_tokens = 2800 if filtered and len(filtered) > 12 else 1600
    result = await complete(
        {
            "task": "chat",
            "tier": "lite",
            "messages": jelly_messages(query, context, history),
            "temperature": 0.25,
            "maxTokens": max_tokens,
            "_log": {
                "pool": pool,
                "user_id": str(user["id"]),
                "route": "/api/ai/jelly/chat",
                "feature": "Jelly chatbot",
                "task": "chat",
            },
        }
    )
    return str(result.get("text") or "I couldn't generate a response.")


async def execute_action(pool: asyncpg.Pool, user: dict, action: dict[str, Any]) -> dict[str, Any]:
    action_type = action.get("type")
    data = action.get("data") or {}

    try:
        if action_type == "create_event":
            prepared = await prepare_event_secrets(dict(data))
            row = await pool.fetchrow(
                """INSERT INTO events (name, date, place, slug, created_by)
                   VALUES ($1, $2, $3, $4, $5)
                   RETURNING id, name""",
                prepared.get("name"),
                prepared.get("date"),
                prepared.get("place"),
                prepared.get("slug") or str(uuid.uuid4())[:8],
                user["id"],
            )
            await pool.execute(
                """INSERT INTO event_access_grants (user_id, event_id, role, granted_by)
                   VALUES ($1, $2, 'edit', $1)
                   ON CONFLICT (user_id, event_id) DO NOTHING""",
                user["id"],
                row["id"],
            )
            return {"success": True, "message": f'Created event "{row["name"]}".', "undoData": {"type": "delete_event", "id": str(row["id"])}}

        if action_type == "update_event":
            await require_event_edit(pool, user, data["id"])
            row = await pool.fetchrow(
                """UPDATE events SET name = COALESCE($2, name), date = COALESCE($3, date), place = COALESCE($4, place)
                   WHERE id = $1 RETURNING id, name""",
                data["id"],
                data.get("name"),
                data.get("date"),
                data.get("place"),
            )
            return {"success": True, "message": f'Updated event "{row["name"]}".', "undoData": {"type": "update_event", "id": str(row["id"]), "data": data}}

        if action_type == "delete_event":
            await require_event_edit(pool, user, data["id"])
            await pool.execute("DELETE FROM events WHERE id = $1", data["id"])
            return {"success": True, "message": "Deleted event.", "undoData": {"type": "create_event", "data": data.get("backup")}}

        if action_type == "create_attendee":
            event_id = data.get("event_id")
            if not event_id:
                raise ValueError("Event is required to add an attendee")
            await require_event_edit(pool, user, event_id)
            row = await pool.fetchrow(
                """INSERT INTO attendees (event_id, name, company, designation, city)
                   VALUES ($1, $2, $3, $4, $5)
                   RETURNING id, name""",
                event_id,
                data.get("name"),
                data.get("company"),
                data.get("designation"),
                data.get("city"),
            )
            return {"success": True, "message": f"Added {row['name']}.", "undoData": {"type": "delete_attendee", "id": str(row["id"])}}

        if action_type == "update_attendee":
            event_id = await _attendee_event_id(pool, data["id"])
            await require_event_edit(pool, user, event_id)
            row = await pool.fetchrow(
                """UPDATE attendees
                      SET name = COALESCE($2, name),
                          company = COALESCE($3, company),
                          designation = COALESCE($4, designation),
                          city = COALESCE($5, city)
                    WHERE id = $1
                RETURNING id, name""",
                data["id"],
                data.get("name"),
                data.get("company"),
                data.get("designation"),
                data.get("city"),
            )
            return {"success": True, "message": f"Updated {row['name']}.", "undoData": {"type": "update_attendee", "id": str(row["id"]), "data": data}}

        if action_type == "delete_attendee":
            event_id = await _attendee_event_id(pool, data["id"])
            await require_event_edit(pool, user, event_id)
            await pool.execute("DELETE FROM attendees WHERE id = $1", data["id"])
            return {"success": True, "message": "Removed attendee.", "undoData": {"type": "create_attendee", "data": data.get("backup")}}

        if action_type == "add_note":
            profile_id = await get_profile_id(pool, str(user["id"]))
            owner_id = profile_id or user["id"]
            event_id = await _attendee_event_id(pool, data["attendee_id"])
            if not await get_event_role(pool, user, event_id):
                raise PermissionError("You do not have access to this event")
            row = await pool.fetchrow(
                """INSERT INTO attendee_notes (user_id, attendee_id, text)
                   VALUES ($1, $2, $3)
                   RETURNING id""",
                owner_id,
                data["attendee_id"],
                data["note"],
            )
            return {
                "success": True,
                "message": "Note added.",
                "undoData": {"type": "delete_note", "id": str(row["id"]), "attendee_id": data["attendee_id"]},
            }

        if action_type == "delete_note":
            profile_id = await get_profile_id(pool, str(user["id"]))
            owner_id = profile_id or user["id"]
            await pool.execute(
                "DELETE FROM attendee_notes WHERE id = $1 AND user_id = $2",
                data["id"],
                owner_id,
            )
            return {"success": True, "message": "Undone."}

        return {"success": False, "message": "Unknown action type"}
    except Exception as error:
        return {"success": False, "message": f"Error: {error}"}


async def undo_action(pool: asyncpg.Pool, user: dict, undo_data: dict[str, Any]) -> dict[str, Any]:
    action = {
        "type": undo_data.get("type"),
        "data": undo_data.get("data") or undo_data,
    }
    result = await execute_action(pool, user, action)
    if result.get("success"):
        result["message"] = "Undone."
    return result


async def require_event_edit(pool: asyncpg.Pool, user: dict, event_id: Any) -> None:
    role = await get_event_role(pool, user, event_id)
    if role != "edit":
        raise PermissionError("You can view this event, but you cannot change it")


async def _attendee_event_id(pool: asyncpg.Pool, attendee_id: Any) -> Any:
    row = await pool.fetchrow("SELECT event_id FROM attendees WHERE id = $1", attendee_id)
    if not row:
        raise ValueError("Attendee not found")
    return row["event_id"]


def is_write_query(query: str) -> bool:
    trimmed = query.strip()
    return bool(WRITE_PATTERN.search(trimmed) and WRITE_ENTITY.search(trimmed))
