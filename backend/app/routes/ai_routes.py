from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, Request

from app.database import get_pool
from app.dependencies import api_error, authenticate
from app.rate_limit import limiter
from app.services.ai_router import complete, is_ai_configured
from app.services.jelly_agent import analyze_query, execute_action, jelly_chat, undo_action

router = APIRouter()


@router.post("/api/ai/chat")
@limiter.limit("30/minute")
async def ai_chat(request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    user = await authenticate(request, pool)
    if not is_ai_configured():
        raise api_error(501, "AI is not configured. Set GROQ_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY, or GROK_API_KEY on the server.")
    try:
        body = await request.json()
    except Exception:
        body = {}
    messages = body.get("messages") or []
    try:
        result = await complete(
            {
                "task": "chat",
                "messages": messages,
                "temperature": body.get("temperature", 0.7),
                "maxTokens": body.get("max_tokens", 800),
                "_log": {
                    "pool": pool,
                    "user_id": str(user["id"]),
                    "route": "/api/ai/chat",
                    "feature": "General AI chat",
                    "task": "chat",
                },
            }
        )
        return {
            "choices": [{"message": {"role": "assistant", "content": result.get("text")}}],
            "provider": result.get("provider"),
        }
    except Exception:
        raise api_error(500, "AI request failed")


@router.post("/api/ai/jelly/chat")
@limiter.limit("30/minute")
async def jelly_chat_route(request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    user = await authenticate(request, pool)
    if not is_ai_configured():
        raise api_error(501, "AI is not configured. Set GROQ_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY, or GROK_API_KEY on the server.")
    try:
        body = await request.json()
    except Exception:
        body = {}
    query = str(body.get("query") or "").strip()
    if not query:
        raise api_error(400, "Query is required")
    history = body.get("history") or []
    try:
        text = await jelly_chat(pool, user, query, history)
        return {"message": text}
    except Exception as error:
        status = getattr(error, "status", 502)
        raise api_error(status, str(error) or "Jelly request failed")


@router.post("/api/ai/jelly/analyze")
@limiter.limit("30/minute")
async def jelly_analyze_route(request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    user = await authenticate(request, pool)
    try:
        body = await request.json()
    except Exception:
        body = {}
    query = str(body.get("query") or "").strip()
    if not query:
        raise api_error(400, "Query is required")
    return await analyze_query(pool, user, query)


@router.post("/api/ai/jelly/execute")
@limiter.limit("30/minute")
async def jelly_execute_route(request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    user = await authenticate(request, pool)
    try:
        body = await request.json()
    except Exception:
        body = {}
    action = body.get("action")
    if not action or not action.get("type"):
        raise api_error(400, "Action is required")
    return await execute_action(pool, user, action)


@router.post("/api/ai/jelly/undo")
async def jelly_undo_route(request: Request, pool: asyncpg.Pool = Depends(get_pool)):
    user = await authenticate(request, pool)
    try:
        body = await request.json()
    except Exception:
        body = {}
    undo_data = body.get("undoData")
    if not undo_data:
        raise api_error(400, "undoData is required")
    return await undo_action(pool, user, undo_data)
