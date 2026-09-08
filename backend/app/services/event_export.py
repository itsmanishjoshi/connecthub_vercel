from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

import asyncpg

STATUS_LABELS = {
    "high_priority": "High priority",
    "meeting_required": "Meeting required",
    "follow_up_needed": "Follow-up needed",
    "strong_connect": "Strong connect",
    "deal_potential": "Deal potential",
    "watchlist": "Watchlist",
    "grey": "Neutral",
}


def safe_file_name(value: str | None) -> str:
    text = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", str(value or "export"))
    text = re.sub(r"\s+", " ", text).strip()[:120]
    return text or "export"


def export_file_base(user_name: str, event_name: str) -> str:
    return safe_file_name(f"{user_name} - {event_name}")


async def list_user_export_events(pool: asyncpg.Pool, user_id: str) -> list[dict]:
    rows = await pool.fetch(
        """WITH note_events AS (
             SELECT DISTINCT a.event_id FROM attendee_notes n
             JOIN attendees a ON a.id = n.attendee_id WHERE n.user_id = $1
           ), status_events AS (
             SELECT DISTINCT a.event_id FROM attendee_statuses s
             JOIN attendees a ON a.id = s.attendee_id WHERE s.user_id = $1
           ), convo_events AS (
             SELECT DISTINCT event_id FROM conversations WHERE user_id = $1 AND event_id IS NOT NULL
           ), follow_events AS (
             SELECT DISTINCT event_id FROM follow_ups WHERE user_id = $1 AND event_id IS NOT NULL
           ), all_events AS (
             SELECT event_id FROM note_events UNION SELECT event_id FROM status_events
             UNION SELECT event_id FROM convo_events UNION SELECT event_id FROM follow_events
           )
           SELECT e.id, e.name, e.slug, e.date, e.place,
                  (SELECT COUNT(*) FROM attendee_notes n JOIN attendees a ON a.id = n.attendee_id
                   WHERE n.user_id = $1 AND a.event_id = e.id) AS notes_count,
                  (SELECT COUNT(*) FROM conversations c WHERE c.user_id = $1 AND c.event_id = e.id) AS conversations_count,
                  (SELECT COUNT(*) FROM attendee_statuses s JOIN attendees a ON a.id = s.attendee_id
                   WHERE s.user_id = $1 AND a.event_id = e.id) AS flags_count
             FROM events e JOIN all_events ae ON ae.event_id = e.id
            ORDER BY e.date DESC NULLS LAST, e.name ASC""",
        user_id,
    )
    return [dict(r) for r in rows]


def _render_export_markdown(payload: dict) -> str:
    lines = [
        f"# {payload['user']['name']} — {payload['event']['name']}",
        "",
        f"Exported: {datetime.fromisoformat(payload['exportedAt'].replace('Z', '+00:00')).strftime('%x %X') if payload.get('exportedAt') else ''}",
    ]
    if payload["event"].get("date"):
        lines.append(f"Event date: {payload['event']['date']}")
    if payload["event"].get("place"):
        lines.append(f"Location: {payload['event']['place']}")
    lines.extend(["", "> Private export — only your notes, flags, and conversations are included.", "", "## People & notes"])
    if not payload["people"]:
        lines.extend(["", "_No personal notes or flags for this event._"])
    for person in payload["people"]:
        lines.extend(["", f"### {person['name']}" + (f" ({person['company']})" if person.get("company") else "")])
        if person.get("designation"):
            lines.append(f"Role: {person['designation']}")
        if person.get("location"):
            lines.append(f"Location: {person['location']}")
        if person.get("statuses"):
            lines.extend(["", "Flags:"])
            for status in person["statuses"]:
                lines.append(f"- {status['label']}")
        if person.get("stages"):
            lines.append(f"Stages: {', '.join(person['stages'])}")
        if person.get("notes"):
            lines.extend(["", "Notes:"])
            for note in person["notes"]:
                when = f" _({note['createdAt']})_" if note.get("createdAt") else ""
                lines.append(f"- {note['text']}{when}")
    lines.extend(["", "## Recorded conversations"])
    if not payload["conversations"]:
        lines.extend(["", "_No recorded conversations for this event._"])
    for conversation in payload["conversations"]:
        title = conversation.get("title") or "Conversation"
        company = f" — {conversation['companyName']}" if conversation.get("companyName") else ""
        lines.extend(["", f"### {title}{company}"])
        summary = next((i for i in conversation.get("insights", []) if i.get("kind") == "summary"), None)
        if summary and summary.get("body"):
            lines.extend(["", "Summary:", summary["body"]])
        if conversation.get("segments"):
            lines.extend(["", "Transcript:"])
            for segment in conversation["segments"]:
                lines.append(f"{segment.get('speaker_label') or 'Speaker'}: {segment.get('text')}")
    return "\n".join(lines)


async def build_user_event_export(pool: asyncpg.Pool, user_id: str, event_id: str) -> dict | None:
    event = await pool.fetchrow("SELECT id, name, slug, date, place FROM events WHERE id = $1 LIMIT 1", event_id)
    if not event:
        return None
    event = dict(event)
    profile = await pool.fetchrow(
        "SELECT first_name, last_name, email FROM user_profiles WHERE user_id = $1 LIMIT 1", user_id
    )
    profile = dict(profile) if profile else {}
    user_name = " ".join(filter(None, [profile.get("first_name"), profile.get("last_name")])).strip()
    user_name = user_name or profile.get("email") or "User"
    attendees = await pool.fetch(
        """SELECT DISTINCT a.* FROM attendees a
           LEFT JOIN attendee_notes n ON n.attendee_id = a.id AND n.user_id = $1
           LEFT JOIN attendee_statuses s ON s.attendee_id = a.id AND s.user_id = $1
           LEFT JOIN conversations c ON c.attendee_id = a.id AND c.user_id = $1
          WHERE a.event_id = $2 AND (n.id IS NOT NULL OR s.id IS NOT NULL OR c.id IS NOT NULL)""",
        user_id,
        event_id,
    )
    notes = await pool.fetch(
        """SELECT n.*, a.name AS attendee_name, a.company, a.designation
             FROM attendee_notes n JOIN attendees a ON a.id = n.attendee_id
            WHERE n.user_id = $1 AND a.event_id = $2 ORDER BY a.name ASC, n.created_at ASC""",
        user_id,
        event_id,
    )
    statuses = await pool.fetch(
        """SELECT s.*, a.name AS attendee_name FROM attendee_statuses s
           JOIN attendees a ON a.id = s.attendee_id WHERE s.user_id = $1 AND a.event_id = $2""",
        user_id,
        event_id,
    )
    stages = await pool.fetch(
        """SELECT st.*, a.name AS attendee_name FROM attendee_stages st
           JOIN attendees a ON a.id = st.attendee_id WHERE st.user_id = $1 AND a.event_id = $2""",
        user_id,
        event_id,
    )
    conversations = await pool.fetch(
        """SELECT * FROM conversations WHERE user_id = $1 AND event_id = $2
           ORDER BY started_at DESC NULLS LAST, created_at DESC""",
        user_id,
        event_id,
    )
    conversation_ids = [r["id"] for r in conversations]
    segments: list = []
    insights: list = []
    if conversation_ids:
        segments = await pool.fetch(
            """SELECT * FROM transcript_segments WHERE user_id = $1 AND conversation_id = ANY($2::uuid[])
               ORDER BY conversation_id, sequence ASC""",
            user_id,
            conversation_ids,
        )
        insights = await pool.fetch(
            """SELECT * FROM conversation_insights WHERE user_id = $1 AND conversation_id = ANY($2::uuid[])
               ORDER BY conversation_id, sort_order ASC""",
            user_id,
            conversation_ids,
        )
    follow_ups = await pool.fetch(
        """SELECT f.*, a.name AS attendee_name FROM follow_ups f
           LEFT JOIN attendees a ON a.id = f.attendee_id
          WHERE f.user_id = $1 AND f.event_id = $2 ORDER BY f.created_at DESC""",
        user_id,
        event_id,
    )
    notes_list = [dict(n) for n in notes]
    statuses_list = [dict(s) for s in statuses]
    stages_list = [dict(s) for s in stages]
    conversations_list = [dict(c) for c in conversations]
    segments_list = [dict(s) for s in segments]
    insights_list = [dict(i) for i in insights]
    people = []
    for attendee in attendees:
        aid = attendee["id"]
        people.append(
            {
                "id": aid,
                "name": attendee["name"],
                "company": attendee.get("company"),
                "designation": attendee.get("designation"),
                "location": attendee.get("city") or attendee.get("location"),
                "notes": [
                    {"id": n["id"], "text": n.get("text") or n.get("note"), "createdAt": n.get("created_at")}
                    for n in notes_list
                    if n["attendee_id"] == aid
                ],
                "statuses": [
                    {
                        "color": s["status_color"],
                        "label": STATUS_LABELS.get(s["status_color"], s["status_color"]),
                    }
                    for s in statuses_list
                    if s["attendee_id"] == aid
                ],
                "stages": [s["stage"] for s in stages_list if s["attendee_id"] == aid],
            }
        )
    payload = {
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "user": {"id": user_id, "name": user_name},
        "event": event,
        "people": people,
        "conversations": [
            {
                "id": c["id"],
                "title": c.get("title"),
                "companyName": c.get("company_name"),
                "attendeeId": c.get("attendee_id"),
                "startedAt": c.get("started_at"),
                "durationSeconds": c.get("duration_seconds"),
                "status": c.get("status"),
                "segments": [s for s in segments_list if s["conversation_id"] == c["id"]],
                "insights": [i for i in insights_list if i["conversation_id"] == c["id"]],
            }
            for c in conversations_list
        ],
        "followUps": [dict(f) for f in follow_ups],
        "fileName": export_file_base(user_name, event["name"]),
    }
    payload["markdown"] = _render_export_markdown(payload)
    return payload


async def list_full_export_events(pool: asyncpg.Pool, event_ids: list[str]) -> list[dict]:
    if not event_ids:
        return []
    rows = await pool.fetch(
        """SELECT e.id, e.name, e.slug, e.date, e.place,
                  (SELECT COUNT(*)::int FROM attendees a WHERE a.event_id = e.id) AS attendee_count
             FROM events e WHERE e.id = ANY($1::uuid[])
             ORDER BY e.date DESC NULLS LAST, e.name ASC""",
        event_ids,
    )
    return [dict(r) for r in rows]


async def build_full_event_export(pool: asyncpg.Pool, user_id: str, event_id: str) -> dict | None:
    personal = await build_user_event_export(pool, user_id, event_id)
    if not personal:
        return None
    all_attendees = await pool.fetch(
        """SELECT id, name, company, designation, city, location, industry, speaker, competitor,
                  key_insights, linkedin_url FROM attendees WHERE event_id = $1 ORDER BY name ASC""",
        event_id,
    )
    personal_by_id = {p["id"]: p for p in personal["people"]}
    people = []
    for attendee in all_attendees:
        mine = personal_by_id.get(attendee["id"], {})
        people.append(
            {
                "id": attendee["id"],
                "name": attendee["name"],
                "company": attendee.get("company"),
                "designation": attendee.get("designation"),
                "location": attendee.get("city") or attendee.get("location"),
                "industry": attendee.get("industry"),
                "speaker": bool(attendee.get("speaker")),
                "competitor": bool(attendee.get("competitor")),
                "keyInsights": attendee.get("key_insights"),
                "linkedinUrl": attendee.get("linkedin_url"),
                "notes": mine.get("notes", []),
                "statuses": mine.get("statuses", []),
                "stages": mine.get("stages", []),
            }
        )
    payload = {
        **personal,
        "exportKind": "full",
        "people": people,
        "fileName": export_file_base(personal["user"]["name"], f"{personal['event']['name']} (full)"),
    }
    payload["markdown"] = _render_export_markdown(payload)
    return payload
