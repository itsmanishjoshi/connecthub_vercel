from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import asyncpg

from app.services.ai_cost import enrich_ai_usage_payload, estimate_cost_usd

MIGRATION_SQL = Path(__file__).resolve().parents[2] / "migrations" / "009_analytics_activity.sql"
MIGRATION_AI_AUDIT_SQL = Path(__file__).resolve().parents[2] / "migrations" / "011_ai_usage_audit.sql"

FEATURE_LABELS = {
    "/api/ai/chat": "General AI chat",
    "/api/ai/jelly/chat": "Jelly chatbot",
    "/api/ai/jelly/analyze": "Jelly assistant",
    "/api/conversations/{id}/analyze": "Conversation intelligence",
    "/api/events/{id}/people/extract": "People card import",
}


def _humanize_segment(segment: str) -> str:
    return segment.replace("-", " ").replace("_", " ").title()


def feature_label(route: str, task: str | None = None, explicit: str | None = None) -> str:
    if explicit:
        return explicit
    normalized = normalize_api_route(route)
    if normalized in FEATURE_LABELS:
        return FEATURE_LABELS[normalized]
    cleaned = normalized.removeprefix("/api/").strip("/")
    parts = [_humanize_segment(part) for part in cleaned.split("/") if part and part != "{id}"]
    if parts:
        return " · ".join(parts)
    if task:
        return f"AI {task.replace('_', ' ')}"
    return "AI request"


async def ensure_analytics_schema(pool: asyncpg.Pool) -> None:
    for migration in (MIGRATION_SQL, MIGRATION_AI_AUDIT_SQL):
        if migration.is_file():
            await pool.execute(migration.read_text(encoding="utf-8"))


async def log_activity(
    pool: asyncpg.Pool,
    *,
    user_id: str | None,
    kind: str,
    event_id: str | None = None,
    label: str | None = None,
    meta: dict | None = None,
) -> None:
    if not user_id or not kind:
        return
    try:
        await pool.execute(
            """INSERT INTO activity_events (user_id, kind, event_id, label, meta)
               VALUES ($1, $2, $3, $4, $5)""",
            user_id,
            kind,
            event_id,
            label,
            json.dumps(meta or {}),
        )
    except Exception as error:
        print(f"Activity log failed: {error}")


async def log_api_usage(
    pool: asyncpg.Pool,
    *,
    user_id: str | None = None,
    route: str,
    provider: str | None = None,
    task: str | None = None,
    feature: str | None = None,
    meta: dict | None = None,
    tokens_in: int | None = None,
    tokens_out: int | None = None,
    status: int = 200,
    duration_ms: int | None = None,
) -> None:
    if not route:
        return
    label = feature_label(route, task, feature)
    try:
        await pool.execute(
            """INSERT INTO api_usage_logs
               (user_id, route, provider, task, feature, meta, tokens_in, tokens_out, status, duration_ms)
               VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)""",
            user_id,
            route,
            provider,
            task,
            label,
            json.dumps(meta or {}),
            tokens_in,
            tokens_out,
            status,
            duration_ms,
        )
    except Exception as error:
        print(f"API usage log failed ({route}): {error}")


async def _api_usage_summary(pool: asyncpg.Pool, user_id: str | None = None, days: int = 30) -> dict:
    if user_id:
        row = await pool.fetchrow(
            """SELECT COUNT(*)::int AS calls,
                      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS calls_24h,
                      COUNT(*) FILTER (WHERE status >= 400)::int AS errors,
                      COALESCE(SUM(tokens_in), 0)::int AS tokens_in,
                      COALESCE(SUM(tokens_out), 0)::int AS tokens_out,
                      COALESCE(SUM(COALESCE(tokens_in, 0) + COALESCE(tokens_out, 0)), 0)::int AS total_tokens,
                      COALESCE(AVG(duration_ms), 0)::int AS avg_duration_ms
                 FROM api_usage_logs
                WHERE created_at > NOW() - ($1::text || ' days')::interval
                  AND user_id = $2::uuid""",
            str(days),
            user_id,
        )
    else:
        row = await pool.fetchrow(
            """SELECT COUNT(*)::int AS calls,
                      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS calls_24h,
                      COUNT(*) FILTER (WHERE status >= 400)::int AS errors,
                      COALESCE(SUM(tokens_in), 0)::int AS tokens_in,
                      COALESCE(SUM(tokens_out), 0)::int AS tokens_out,
                      COALESCE(SUM(COALESCE(tokens_in, 0) + COALESCE(tokens_out, 0)), 0)::int AS total_tokens,
                      COALESCE(AVG(duration_ms), 0)::int AS avg_duration_ms
                 FROM api_usage_logs
                WHERE created_at > NOW() - ($1::text || ' days')::interval""",
            str(days),
        )
    return dict(row) if row else {}


async def _api_daily_activity(pool: asyncpg.Pool, user_id: str | None = None, days: int = 14) -> list[dict]:
    if user_id:
        rows = await pool.fetch(
            """SELECT DATE(created_at) AS day,
                      COUNT(*)::int AS calls,
                      COALESCE(SUM(tokens_in), 0)::int AS tokens_in,
                      COALESCE(SUM(tokens_out), 0)::int AS tokens_out,
                      COALESCE(SUM(COALESCE(tokens_in, 0) + COALESCE(tokens_out, 0)), 0)::int AS tokens,
                      COUNT(*) FILTER (WHERE status >= 400)::int AS errors
                 FROM api_usage_logs
                WHERE created_at > NOW() - ($1::text || ' days')::interval
                  AND user_id = $2::uuid
                GROUP BY day
                ORDER BY day ASC""",
            str(days),
            user_id,
        )
    else:
        rows = await pool.fetch(
            """SELECT DATE(created_at) AS day,
                      COUNT(*)::int AS calls,
                      COALESCE(SUM(tokens_in), 0)::int AS tokens_in,
                      COALESCE(SUM(tokens_out), 0)::int AS tokens_out,
                      COALESCE(SUM(COALESCE(tokens_in, 0) + COALESCE(tokens_out, 0)), 0)::int AS tokens,
                      COUNT(*) FILTER (WHERE status >= 400)::int AS errors
                 FROM api_usage_logs
                WHERE created_at > NOW() - ($1::text || ' days')::interval
                GROUP BY day
                ORDER BY day ASC""",
            str(days),
        )
    return [dict(r) for r in rows]


async def _api_by_provider(pool: asyncpg.Pool, user_id: str | None = None, days: int = 30) -> list[dict]:
    if user_id:
        rows = await pool.fetch(
            """SELECT COALESCE(provider, 'unknown') AS provider,
                      COUNT(*)::int AS calls,
                      COALESCE(SUM(tokens_in), 0)::int AS tokens_in,
                      COALESCE(SUM(tokens_out), 0)::int AS tokens_out,
                      COALESCE(SUM(COALESCE(tokens_in, 0) + COALESCE(tokens_out, 0)), 0)::int AS tokens
                 FROM api_usage_logs
                WHERE created_at > NOW() - ($1::text || ' days')::interval
                  AND user_id = $2::uuid
                GROUP BY provider
                ORDER BY calls DESC""",
            str(days),
            user_id,
        )
    else:
        rows = await pool.fetch(
            """SELECT COALESCE(provider, 'unknown') AS provider,
                      COUNT(*)::int AS calls,
                      COALESCE(SUM(tokens_in), 0)::int AS tokens_in,
                      COALESCE(SUM(tokens_out), 0)::int AS tokens_out,
                      COALESCE(SUM(COALESCE(tokens_in, 0) + COALESCE(tokens_out, 0)), 0)::int AS tokens
                 FROM api_usage_logs
                WHERE created_at > NOW() - ($1::text || ' days')::interval
                GROUP BY provider
                ORDER BY calls DESC""",
            str(days),
        )
    return [dict(r) for r in rows]


async def _api_by_route(pool: asyncpg.Pool, user_id: str | None = None, days: int = 30) -> list[dict]:
    if user_id:
        rows = await pool.fetch(
            """SELECT route,
                      COUNT(*)::int AS calls,
                      COALESCE(SUM(tokens_in), 0)::int AS tokens_in,
                      COALESCE(SUM(tokens_out), 0)::int AS tokens_out,
                      COALESCE(SUM(COALESCE(tokens_in, 0) + COALESCE(tokens_out, 0)), 0)::int AS tokens,
                      COUNT(*) FILTER (WHERE status >= 400)::int AS errors
                 FROM api_usage_logs
                WHERE created_at > NOW() - ($1::text || ' days')::interval
                  AND user_id = $2::uuid
                GROUP BY route
                ORDER BY calls DESC""",
            str(days),
            user_id,
        )
    else:
        rows = await pool.fetch(
            """SELECT route,
                      COUNT(*)::int AS calls,
                      COALESCE(SUM(tokens_in), 0)::int AS tokens_in,
                      COALESCE(SUM(tokens_out), 0)::int AS tokens_out,
                      COALESCE(SUM(COALESCE(tokens_in, 0) + COALESCE(tokens_out, 0)), 0)::int AS tokens,
                      COUNT(*) FILTER (WHERE status >= 400)::int AS errors
                 FROM api_usage_logs
                WHERE created_at > NOW() - ($1::text || ' days')::interval
                GROUP BY route
                ORDER BY calls DESC""",
            str(days),
        )
    return [dict(r) for r in rows]


async def _api_by_task(pool: asyncpg.Pool, user_id: str | None = None, days: int = 30) -> list[dict]:
    if user_id:
        rows = await pool.fetch(
            """SELECT COALESCE(NULLIF(task, ''), 'unknown') AS task,
                      COUNT(*)::int AS calls,
                      COALESCE(SUM(tokens_in), 0)::int AS tokens_in,
                      COALESCE(SUM(tokens_out), 0)::int AS tokens_out,
                      COALESCE(SUM(COALESCE(tokens_in, 0) + COALESCE(tokens_out, 0)), 0)::int AS tokens,
                      COUNT(*) FILTER (WHERE status >= 400)::int AS errors
                 FROM api_usage_logs
                WHERE created_at > NOW() - ($1::text || ' days')::interval
                  AND user_id = $2::uuid
                GROUP BY 1
                ORDER BY tokens DESC, calls DESC""",
            str(days),
            user_id,
        )
    else:
        rows = await pool.fetch(
            """SELECT COALESCE(NULLIF(task, ''), 'unknown') AS task,
                      COUNT(*)::int AS calls,
                      COALESCE(SUM(tokens_in), 0)::int AS tokens_in,
                      COALESCE(SUM(tokens_out), 0)::int AS tokens_out,
                      COALESCE(SUM(COALESCE(tokens_in, 0) + COALESCE(tokens_out, 0)), 0)::int AS tokens,
                      COUNT(*) FILTER (WHERE status >= 400)::int AS errors
                 FROM api_usage_logs
                WHERE created_at > NOW() - ($1::text || ' days')::interval
                GROUP BY 1
                ORDER BY tokens DESC, calls DESC""",
            str(days),
        )
    return [dict(r) for r in rows]


async def _api_by_feature(pool: asyncpg.Pool, user_id: str | None = None, days: int = 30) -> list[dict]:
    if user_id:
        rows = await pool.fetch(
            """SELECT COALESCE(NULLIF(feature, ''), route) AS feature,
                      COUNT(*)::int AS calls,
                      COALESCE(SUM(tokens_in), 0)::int AS tokens_in,
                      COALESCE(SUM(tokens_out), 0)::int AS tokens_out,
                      COALESCE(SUM(COALESCE(tokens_in, 0) + COALESCE(tokens_out, 0)), 0)::int AS tokens
                 FROM api_usage_logs
                WHERE created_at > NOW() - ($1::text || ' days')::interval
                  AND user_id = $2::uuid
                GROUP BY 1
                ORDER BY tokens DESC, calls DESC""",
            str(days),
            user_id,
        )
    else:
        rows = await pool.fetch(
            """SELECT COALESCE(NULLIF(feature, ''), route) AS feature,
                      COUNT(*)::int AS calls,
                      COALESCE(SUM(tokens_in), 0)::int AS tokens_in,
                      COALESCE(SUM(tokens_out), 0)::int AS tokens_out,
                      COALESCE(SUM(COALESCE(tokens_in, 0) + COALESCE(tokens_out, 0)), 0)::int AS tokens
                 FROM api_usage_logs
                WHERE created_at > NOW() - ($1::text || ' days')::interval
                GROUP BY 1
                ORDER BY tokens DESC, calls DESC""",
            str(days),
        )
    return [dict(r) for r in rows]


async def _api_by_user(pool: asyncpg.Pool, days: int = 30) -> list[dict]:
    rows = await pool.fetch(
        """SELECT l.user_id,
                  COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), u.username, 'Unknown') AS name,
                  u.username,
                  COUNT(*)::int AS calls,
                  COALESCE(SUM(l.tokens_in), 0)::int AS tokens_in,
                  COALESCE(SUM(l.tokens_out), 0)::int AS tokens_out,
                  COALESCE(SUM(COALESCE(l.tokens_in, 0) + COALESCE(l.tokens_out, 0)), 0)::int AS tokens,
                  COUNT(*) FILTER (WHERE l.status >= 400)::int AS errors
             FROM api_usage_logs l
             LEFT JOIN users u ON u.id = l.user_id
             LEFT JOIN user_profiles p ON p.user_id = l.user_id
            WHERE l.created_at > NOW() - ($1::text || ' days')::interval
            GROUP BY l.user_id, name, u.username
            ORDER BY tokens DESC, calls DESC""",
        str(days),
    )
    return [dict(r) for r in rows]


async def _api_recent_logs(pool: asyncpg.Pool, user_id: str | None = None, limit: int = 200) -> list[dict]:
    if user_id:
        rows = await pool.fetch(
            """SELECT l.created_at, l.route, l.feature, l.task, l.provider,
                      l.tokens_in, l.tokens_out, l.status, l.duration_ms, l.meta,
                      COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), u.username, 'You') AS user_name
                 FROM api_usage_logs l
                 LEFT JOIN users u ON u.id = l.user_id
                 LEFT JOIN user_profiles p ON p.user_id = l.user_id
                WHERE l.user_id = $1::uuid
                ORDER BY l.created_at DESC
                LIMIT $2""",
            user_id,
            limit,
        )
    else:
        rows = await pool.fetch(
            """SELECT l.created_at, l.route, l.feature, l.task, l.provider,
                      l.tokens_in, l.tokens_out, l.status, l.duration_ms, l.meta,
                      COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), u.username, 'Unknown') AS user_name
                 FROM api_usage_logs l
                 LEFT JOIN users u ON u.id = l.user_id
                 LEFT JOIN user_profiles p ON p.user_id = l.user_id
                ORDER BY l.created_at DESC
                LIMIT $1""",
            limit,
        )
    return [
        {
            **dict(row),
            "meta": json.loads(row["meta"]) if isinstance(row.get("meta"), str) else dict(row.get("meta") or {}),
            "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        }
        for row in rows
    ]


async def build_ai_usage_analytics(pool: asyncpg.Pool, user_id: str | None = None) -> dict[str, Any]:
    payload = {
        "summary": await _api_usage_summary(pool, user_id),
        "dailyActivity": await _api_daily_activity(pool, user_id),
        "byProvider": await _api_by_provider(pool, user_id),
        "byRoute": await _api_by_route(pool, user_id),
        "byFeature": await _api_by_feature(pool, user_id),
        "byTask": await _api_by_task(pool, user_id),
        "recentLogs": await _api_recent_logs(pool, user_id),
    }
    if user_id is None:
        payload["byUser"] = await _api_by_user(pool)
    return enrich_ai_usage_payload(payload)


async def _daily_activity(pool: asyncpg.Pool, user_id: str, days: int = 14) -> list[dict]:
    rows = await pool.fetch(
        """SELECT day,
                  SUM(notes)::int AS notes,
                  SUM(conversations)::int AS conversations,
                  SUM(flags)::int AS flags,
                  SUM(exports)::int AS exports
             FROM (
               SELECT DATE(created_at) AS day, COUNT(*) AS notes, 0 AS conversations, 0 AS flags, 0 AS exports
                 FROM attendee_notes
                WHERE user_id = $1 AND created_at > NOW() - ($2::text || ' days')::interval
                GROUP BY 1
               UNION ALL
               SELECT DATE(created_at), 0, COUNT(*), 0, 0
                 FROM conversations
                WHERE user_id = $1 AND created_at > NOW() - ($2::text || ' days')::interval
                GROUP BY 1
               UNION ALL
               SELECT DATE(created_at), 0, 0, COUNT(*), 0
                 FROM attendee_statuses
                WHERE user_id = $1 AND created_at > NOW() - ($2::text || ' days')::interval
                GROUP BY 1
               UNION ALL
               SELECT DATE(created_at), 0, 0, 0, COUNT(*)
                 FROM activity_events
                WHERE user_id = $1 AND kind IN ('export', 'export_full')
                  AND created_at > NOW() - ($2::text || ' days')::interval
                GROUP BY 1
             ) activity
            GROUP BY day
            ORDER BY day ASC""",
        user_id,
        str(days),
    )
    return [dict(r) for r in rows]


async def _event_breakdown(pool: asyncpg.Pool, user_id: str) -> list[dict]:
    rows = await pool.fetch(
        """SELECT e.id, e.name, e.date, e.place,
                  (SELECT COUNT(*)::int FROM attendee_notes n
                     JOIN attendees a ON a.id = n.attendee_id
                    WHERE n.user_id = $1 AND a.event_id = e.id) AS notes_count,
                  (SELECT COUNT(*)::int FROM attendee_statuses s
                     JOIN attendees a ON a.id = s.attendee_id
                    WHERE s.user_id = $1 AND a.event_id = e.id) AS flags_count,
                  (SELECT COUNT(*)::int FROM conversations c
                   WHERE c.user_id = $1 AND c.event_id = e.id) AS conversations_count
             FROM events e
            WHERE EXISTS (
              SELECT 1 FROM attendee_notes n JOIN attendees a ON a.id = n.attendee_id
               WHERE n.user_id = $1 AND a.event_id = e.id
            ) OR EXISTS (
              SELECT 1 FROM attendee_statuses s JOIN attendees a ON a.id = s.attendee_id
               WHERE s.user_id = $1 AND a.event_id = e.id
            ) OR EXISTS (
              SELECT 1 FROM conversations c WHERE c.user_id = $1 AND c.event_id = e.id
            )
            ORDER BY e.date DESC NULLS LAST, e.name ASC""",
        user_id,
    )
    return [dict(r) for r in rows]


async def _user_totals(pool: asyncpg.Pool, user_id: str) -> dict:
    row = await pool.fetchrow(
        """SELECT
             (SELECT COUNT(*)::int FROM attendee_notes WHERE user_id = $1) AS notes,
             (SELECT COUNT(*)::int FROM attendee_statuses WHERE user_id = $1) AS flags,
             (SELECT COUNT(*)::int FROM conversations WHERE user_id = $1) AS conversations,
             (SELECT COUNT(*)::int FROM attendee_stages WHERE user_id = $1) AS stages,
             (SELECT COUNT(*)::int FROM activity_events WHERE user_id = $1
                AND kind IN ('export', 'export_full')) AS exports""",
        user_id,
    )
    return dict(row) if row else {"notes": 0, "flags": 0, "conversations": 0, "stages": 0, "exports": 0}


async def _recent_feed(pool: asyncpg.Pool, user_id: str, limit: int = 12) -> list[dict]:
    rows = await pool.fetch(
        """SELECT * FROM (
             SELECT 'note' AS kind, n.created_at, COALESCE(e.name, 'Event') AS context,
                    LEFT(n.text, 120) AS detail
               FROM attendee_notes n
               JOIN attendees a ON a.id = n.attendee_id
               LEFT JOIN events e ON e.id = a.event_id
              WHERE n.user_id = $1
             UNION ALL
             SELECT 'conversation', c.created_at, COALESCE(e.name, c.title, 'Conversation'),
                    COALESCE(c.company_name, c.status, '')
               FROM conversations c
               LEFT JOIN events e ON e.id = c.event_id
              WHERE c.user_id = $1
             UNION ALL
             SELECT ae.kind, ae.created_at, COALESCE(ae.label, ae.kind),
                    COALESCE(ae.meta->>'format', '')
               FROM activity_events ae
              WHERE ae.user_id = $1
           ) feed
           ORDER BY created_at DESC
           LIMIT $2""",
        user_id,
        limit,
    )
    return [dict(r) for r in rows]


async def build_personal_analytics(pool: asyncpg.Pool, user_id: str) -> dict[str, Any]:
    from datetime import datetime, timezone

    profile = await pool.fetchrow(
        "SELECT first_name, last_name, email FROM user_profiles WHERE user_id = $1 LIMIT 1",
        user_id,
    )
    profile = dict(profile) if profile else {}
    name = " ".join(filter(None, [profile.get("first_name"), profile.get("last_name")])).strip()
    name = name or profile.get("email") or "You"
    totals, by_event, daily, feed = await _user_totals(pool, user_id), await _event_breakdown(pool, user_id), await _daily_activity(pool, user_id), await _recent_feed(pool, user_id)
    ai_usage = await build_ai_usage_analytics(pool, user_id)
    return {
        "scope": "personal",
        "user": {"id": user_id, "name": name},
        "totals": {
            "notes": totals.get("notes") or 0,
            "flags": totals.get("flags") or 0,
            "conversations": totals.get("conversations") or 0,
            "stages": totals.get("stages") or 0,
            "exports": totals.get("exports") or 0,
            "actions": (totals.get("notes") or 0) + (totals.get("flags") or 0) + (totals.get("conversations") or 0),
        },
        "eventBreakdown": by_event,
        "dailyActivity": daily,
        "recentActivity": feed,
        "aiUsage": ai_usage,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


async def build_org_analytics(pool: asyncpg.Pool) -> dict[str, Any]:
    from datetime import datetime, timezone

    users = await pool.fetchval("SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL")
    events = await pool.fetchval("SELECT COUNT(*)::int FROM events")
    notes = await pool.fetchval("SELECT COUNT(*)::int FROM attendee_notes")
    conversations = await pool.fetchval("SELECT COUNT(*)::int FROM conversations")
    flags = await pool.fetchval("SELECT COUNT(*)::int FROM attendee_statuses")
    exports_count = await pool.fetchval(
        "SELECT COUNT(*)::int FROM activity_events WHERE kind IN ('export', 'export_full')"
    )
    user_cards = await pool.fetch(
        """SELECT u.id, u.username, u.is_admin, u.last_login_at,
                  p.first_name, p.last_name, p.email, p.company, p.designation,
                  (SELECT COUNT(*)::int FROM attendee_notes WHERE user_id = u.id) AS notes,
                  (SELECT COUNT(*)::int FROM attendee_statuses WHERE user_id = u.id) AS flags,
                  (SELECT COUNT(*)::int FROM conversations WHERE user_id = u.id) AS conversations,
                  (SELECT COUNT(*)::int FROM activity_events WHERE user_id = u.id
                     AND kind IN ('export', 'export_full')) AS exports,
                  (SELECT MAX(ts) FROM (
                     SELECT created_at AS ts FROM attendee_notes WHERE user_id = u.id
                     UNION ALL SELECT created_at FROM attendee_statuses WHERE user_id = u.id
                     UNION ALL SELECT created_at FROM conversations WHERE user_id = u.id
                     UNION ALL SELECT created_at FROM activity_events WHERE user_id = u.id
                   ) activity) AS last_activity_at
             FROM users u
             LEFT JOIN user_profiles p ON p.user_id = u.id
            WHERE u.deleted_at IS NULL
            ORDER BY last_activity_at DESC NULLS LAST, u.username ASC"""
    )
    event_engagement = await pool.fetch(
        """SELECT e.id, e.name, e.date,
                  (SELECT COUNT(*)::int FROM attendees a WHERE a.event_id = e.id) AS attendee_count,
                  (SELECT COUNT(DISTINCT n.user_id)::int FROM attendee_notes n
                     JOIN attendees a ON a.id = n.attendee_id WHERE a.event_id = e.id) AS users_with_notes,
                  (SELECT COUNT(*)::int FROM attendee_notes n
                     JOIN attendees a ON a.id = n.attendee_id WHERE a.event_id = e.id) AS notes_count,
                  (SELECT COUNT(*)::int FROM attendee_statuses s
                     JOIN attendees a ON a.id = s.attendee_id WHERE a.event_id = e.id) AS flags_count,
                  (SELECT COUNT(DISTINCT c.user_id)::int FROM conversations c WHERE c.event_id = e.id) AS users_with_conversations,
                  (SELECT COUNT(*)::int FROM conversations c WHERE c.event_id = e.id) AS conversations_count
             FROM events e
            ORDER BY (SELECT COUNT(*) FROM attendee_notes n JOIN attendees a ON a.id = n.attendee_id WHERE a.event_id = e.id)
                   + (SELECT COUNT(*) FROM conversations c WHERE c.event_id = e.id) DESC,
                     e.name ASC
            LIMIT 20"""
    )
    daily_org = await pool.fetch(
        """SELECT day, SUM(notes)::int AS notes, SUM(conversations)::int AS conversations, SUM(flags)::int AS flags
             FROM (
               SELECT DATE(created_at) AS day, COUNT(*) AS notes, 0 AS conversations, 0 AS flags
                 FROM attendee_notes WHERE created_at > NOW() - INTERVAL '14 days' GROUP BY 1
               UNION ALL
               SELECT DATE(created_at), 0, COUNT(*), 0 FROM conversations
                WHERE created_at > NOW() - INTERVAL '14 days' GROUP BY 1
               UNION ALL
               SELECT DATE(created_at), 0, 0, COUNT(*) FROM attendee_statuses
                WHERE created_at > NOW() - INTERVAL '14 days' GROUP BY 1
             ) activity GROUP BY day ORDER BY day ASC"""
    )
    ai_usage = await build_ai_usage_analytics(pool)
    recent_org = await pool.fetch(
        """SELECT u.username,
                  COALESCE(p.first_name || ' ' || p.last_name, u.username) AS name,
                  ae.kind, ae.label, ae.created_at
             FROM activity_events ae
             JOIN users u ON u.id = ae.user_id
             LEFT JOIN user_profiles p ON p.user_id = u.id
            ORDER BY ae.created_at DESC LIMIT 20"""
    )
    active_users_30d = await pool.fetchval(
        """SELECT COUNT(DISTINCT user_id)::int FROM (
             SELECT user_id FROM attendee_notes WHERE created_at > NOW() - INTERVAL '30 days'
             UNION SELECT user_id FROM conversations WHERE created_at > NOW() - INTERVAL '30 days'
             UNION SELECT user_id FROM attendee_statuses WHERE created_at > NOW() - INTERVAL '30 days'
             UNION SELECT user_id FROM activity_events WHERE created_at > NOW() - INTERVAL '30 days'
           ) active"""
    )
    return {
        "scope": "org",
        "totals": {
            "users": users or 0,
            "events": events or 0,
            "activeUsers30d": active_users_30d or 0,
            "notes": notes or 0,
            "flags": flags or 0,
            "conversations": conversations or 0,
            "exports": exports_count or 0,
            "actions": (notes or 0) + (flags or 0) + (conversations or 0),
        },
        "users": [
            {
                "id": row["id"],
                "username": row["username"],
                "name": " ".join(filter(None, [row.get("first_name"), row.get("last_name")])).strip() or row["username"],
                "email": row.get("email"),
                "company": row.get("company"),
                "designation": row.get("designation"),
                "isAdmin": bool(row.get("is_admin")),
                "notes": row.get("notes") or 0,
                "flags": row.get("flags") or 0,
                "conversations": row.get("conversations") or 0,
                "exports": row.get("exports") or 0,
                "actions": (row.get("notes") or 0) + (row.get("flags") or 0) + (row.get("conversations") or 0),
                "lastActivityAt": row.get("last_activity_at"),
                "lastLoginAt": row.get("last_login_at"),
            }
            for row in user_cards
        ],
        "eventEngagement": [dict(r) for r in event_engagement],
        "dailyActivity": [dict(r) for r in daily_org],
        "aiUsage": ai_usage,
        "system": {
            "recentEvents": [dict(r) for r in recent_org],
        },
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
