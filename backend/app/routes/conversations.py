from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, Request

from app.database import get_pool
from app.dependencies import api_error, authenticate
from app.services.conversation_ai import analyze_conversation
from app.services.term_corrector import correct_business_terms

router = APIRouter()


@router.post("/api/conversations/{conversation_id}/analyze")
async def analyze_conversation_route(
    conversation_id: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_pool),
):
    user = await authenticate(request, pool)
    try:
        conversation = await pool.fetchrow(
            "SELECT * FROM conversations WHERE id = $1 AND user_id = $2",
            conversation_id,
            user["id"],
        )
        if not conversation:
            raise api_error(404, "Conversation not found")
        segments = await pool.fetch(
            """SELECT * FROM transcript_segments
                WHERE conversation_id = $1 AND user_id = $2 AND is_final = true
                ORDER BY sequence ASC""",
            conversation_id,
            user["id"],
        )
        segment_rows = [dict(row) for row in segments]
        for segment in segment_rows:
            text = correct_business_terms(segment.get("text"))
            if text and text != segment.get("text"):
                await pool.execute(
                    "UPDATE transcript_segments SET text = $1 WHERE id = $2 AND user_id = $3",
                    text,
                    segment["id"],
                    user["id"],
                )
                segment["text"] = text
        await pool.execute(
            """UPDATE conversations SET ai_processing_status = 'analyzing', status = 'analyzing'
                WHERE id = $1 AND user_id = $2""",
            conversation_id,
            user["id"],
        )
        result = await analyze_conversation(
            conversation=dict(conversation),
            segments=segment_rows,
            log={
                "pool": pool,
                "user_id": str(user["id"]),
                "route": "/api/conversations/analyze",
                "feature": "Conversation intelligence",
                "task": "analyze",
                "meta": {"conversation_id": conversation_id},
            },
        )
        await pool.execute(
            "DELETE FROM conversation_insights WHERE conversation_id = $1 AND user_id = $2",
            conversation_id,
            user["id"],
        )
        for row in result.get("rows") or []:
            await pool.execute(
                """INSERT INTO conversation_insights
                    (user_id, conversation_id, kind, title, body, category, owner, due_at, confidence,
                     evidence_kind, evidence_start_ms, evidence_end_ms, sort_order)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)""",
                user["id"],
                conversation_id,
                row.get("kind"),
                row.get("title"),
                row.get("body"),
                row.get("category"),
                row.get("owner"),
                row.get("due_at"),
                row.get("confidence"),
                row.get("evidence_kind"),
                row.get("evidence_start_ms"),
                row.get("evidence_end_ms"),
                row.get("sort_order"),
            )
        await pool.execute(
            """UPDATE conversations
                  SET ai_processing_status = 'complete',
                      status = 'complete',
                      next_action = $3,
                      transcript_version = transcript_version + 1
                WHERE id = $1 AND user_id = $2""",
            conversation_id,
            user["id"],
            result.get("nextAction"),
        )
        insights = await pool.fetch(
            """SELECT * FROM conversation_insights
                WHERE conversation_id = $1 AND user_id = $2
                ORDER BY kind, sort_order""",
            conversation_id,
            user["id"],
        )
        return {
            "data": {
                "insights": [dict(row) for row in insights],
                "nextAction": result.get("nextAction"),
                "pipelineVersion": result.get("pipelineVersion"),
            }
        }
    except Exception as error:
        try:
            await pool.execute(
                "UPDATE conversations SET ai_processing_status = 'failed' WHERE id = $1 AND user_id = $2",
                conversation_id,
                user["id"],
            )
        except Exception:
            pass
        from fastapi import HTTPException

        if isinstance(error, HTTPException):
            raise
        status = getattr(error, "status", 500)
        raise api_error(status, str(error) or "Analysis failed")
