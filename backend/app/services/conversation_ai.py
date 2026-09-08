from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.services.ai_router import complete_text, is_ai_configured
from app.services.term_corrector import KNOWN_TOOLS, correct_business_terms, extract_mentioned_tools

logger = logging.getLogger(__name__)

PIPELINE_VERSION = "conversation-intelligence-v3"

SYSTEM_PROMPT = """You are Jelly, a senior business analyst and solutions analyst sitting in this meeting.
Listen like a personal meeting assistant: gather requirements, map current and target systems, catch commitments, and do not miss critical detail.
Nobody told you in advance what to listen for. Detect keywords, products, platforms, integrations, owners, dates, constraints, and risks yourself.
Return ONLY JSON with this shape:
{
  "summary": {"body":"", "evidence_kind":"source_derived"},
  "key_points": [{"title":"","body":"","evidence_kind":"fact|source_derived|ai_inference","evidence_start_ms":0,"evidence_end_ms":0,"confidence":"high|medium|low"}],
  "pain_points": [{"title":"","body":"","category":"","evidence_kind":"","evidence_start_ms":0,"evidence_end_ms":0,"confidence":""}],
  "requirements": [{"title":"","body":"","evidence_kind":"","evidence_start_ms":0,"confidence":""}],
  "stakeholders": [{"title":"role or name","body":"interest or responsibility","evidence_kind":"fact"}],
  "constraints": [{"title":"","body":"","evidence_kind":"fact"}],
  "decisions": [{"body":"","owner":"","evidence_kind":"fact"}],
  "action_items": [{"task":"","owner":"Unassigned","due":"Not specified","evidence_kind":"fact"}],
  "open_questions": [{"body":""}],
  "tools": [{"title":"Power Platform","body":"how it is used or planned","evidence_kind":"fact","evidence_start_ms":0}],
  "business_impact": {"body":"","evidence_kind":"ai_inference"},
  "opportunity": {"title":"","body":"","confidence":""},
  "mom": {"body":"markdown minutes without a Minutes of Meeting heading"},
  "followup": {"body":"contextual follow-up message"},
  "solution": {"body":"AI-generated preliminary solution"},
  "next_action": {"body":""}
}
Rules:
- Be exhaustive on requirements, systems, commitments, owners, dates, and open questions. Prefer missing nothing over a short answer.
- Never invent quotes, owners, dates, or numbers.
- Preserve product, platform, and tool names exactly. Never replace them with generic words like automation, AI, or tools.
- Extract every named system, product, cloud, ERP, CRM, or integration mentioned — including misheard names such as "power play form" → Power Platform.
- When a named platform is discussed, keep that name in the summary, key points, pain points, tools, requirements, MoM, and solution.
- Capture functional and non-functional requirements, current-state vs desired-state, integrations, data, security, and success criteria when they appear.
- If a field is unknown, say Unassigned, Not specified, or No formal decisions identified.
- Distinguish fact vs ai_inference.
- Do not turn every sentence into a pain point.
- Follow-up must reference actual discussion, not "great meeting you"."""


def _repair_json(raw: str) -> str:
    cleaned = raw.strip()
    cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)
    return cleaned


def extract_json(text: str | None) -> dict | None:
    if not text:
        return None

    candidates: list[str] = []
    for match in re.finditer(r"```(?:json)?\s*([\s\S]*?)```", text, re.I):
        block = match.group(1).strip()
        if block:
            candidates.append(block)

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        candidates.append(text[start : end + 1])

    stripped = text.strip()
    if stripped and stripped not in candidates:
        candidates.append(stripped)

    for raw in candidates:
        for attempt in (raw, _repair_json(raw)):
            try:
                parsed = json.loads(attempt)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                return parsed
    return None


def format_transcript(segments: list[dict]) -> str:
    lines = []
    for segment in segments:
        start = max(0, int(segment.get("start_ms") or 0))
        mm = str(start // 60000).zfill(2)
        ss = str((start % 60000) // 1000).zfill(2)
        text = correct_business_terms(segment.get("text") or "")
        lines.append(f"[{mm}:{ss}] {segment.get('speaker_label') or 'Speaker'}: {text}")
    return "\n".join(lines)


def to_insight_rows(user_id: str, conversation_id: str, payload: dict) -> list[dict]:
    rows: list[dict] = []

    def push(kind: str, item: Any, index: int) -> None:
        if not item:
            return
        if isinstance(item, str):
            body = item
            title = None
            category = owner = due_at = confidence = evidence_kind = None
            evidence_start_ms = evidence_end_ms = None
        else:
            body = item.get("body") or item.get("summary") or item.get("text") or item.get("task") or ""
            title = item.get("title") or item.get("task")
            category = item.get("category")
            owner = item.get("owner")
            due_at = item.get("due") or item.get("due_at")
            confidence = item.get("confidence")
            evidence_kind = item.get("evidence_kind") or "ai_inference"
            evidence_start_ms = item.get("evidence_start_ms")
            evidence_end_ms = item.get("evidence_end_ms")
        if not body:
            return
        rows.append(
            {
                "user_id": user_id,
                "conversation_id": conversation_id,
                "kind": kind,
                "title": title,
                "body": body,
                "category": category,
                "owner": owner,
                "due_at": due_at,
                "confidence": confidence,
                "evidence_kind": evidence_kind,
                "evidence_start_ms": evidence_start_ms,
                "evidence_end_ms": evidence_end_ms,
                "sort_order": index,
            }
        )

    push("summary", payload.get("summary"), 0)
    for key, kind in [
        ("key_points", "key_point"),
        ("pain_points", "pain_point"),
        ("requirements", "requirement"),
        ("stakeholders", "stakeholder"),
        ("constraints", "constraint"),
        ("decisions", "decision"),
        ("action_items", "action_item"),
        ("open_questions", "open_question"),
    ]:
        for index, item in enumerate(payload.get(key) or []):
            push(kind, item, index)
    for index, item in enumerate(payload.get("tools") or payload.get("platforms") or []):
        push("tool", item, index)
    for kind in ("business_impact", "opportunity", "mom", "followup", "solution", "next_action"):
        push(kind, payload.get(kind), 0)
    return rows


def split_segments(segments: list[dict], max_chars: int = 6000) -> list[list[dict]]:
    chunks: list[list[dict]] = []
    current: list[dict] = []
    size = 0
    for segment in segments:
        line = format_transcript([segment])
        if current and size + len(line) > max_chars:
            chunks.append(current)
            current = []
            size = 0
        current.append(segment)
        size += len(line)
    if current:
        chunks.append(current)
    return chunks


async def ask_model(
    *,
    system: str,
    user: str,
    max_tokens: int = 1800,
    json_mode: bool = True,
    log: dict | None = None,
) -> str:
    payload = {
        "task": "analyze",
        "tier": "heavy",
        "system": system,
        "user": user,
        "temperature": 0.2,
        "maxTokens": max_tokens,
        "jsonMode": json_mode,
    }
    if log:
        payload["_log"] = log
    try:
        return await complete_text(payload)
    except Exception as error:
        message = str(error).lower()
        if json_mode and ("response_format" in message or "json" in message):
            logger.info("Retrying analysis without JSON response mode: %s", error)
            payload["jsonMode"] = False
            return await complete_text(payload)
        raise


def _payload_is_usable(payload: dict | None) -> bool:
    if not payload:
        return False
    if payload.get("summary"):
        return True
    for key in ("key_points", "pain_points", "requirements", "action_items", "mom", "followup"):
        if payload.get(key):
            return True
    return False


def merge_detected_tools(rows: list[dict], user_id: str, conversation_id: str, mentioned_tools: list[str]) -> list[dict]:
    existing = [
        f"{row.get('title') or ''} {row.get('body') or ''}".lower()
        for row in rows
        if row.get("kind") == "tool"
    ]
    for index, name in enumerate(mentioned_tools):
        needle = name.lower()
        if any(needle in text for text in existing):
            continue
        rows.append(
            {
                "user_id": user_id,
                "conversation_id": conversation_id,
                "kind": "tool",
                "title": name,
                "body": f"{name} was named in this conversation.",
                "category": "platform",
                "owner": None,
                "due_at": None,
                "confidence": "high",
                "evidence_kind": "source_derived",
                "evidence_start_ms": None,
                "evidence_end_ms": None,
                "sort_order": len(existing) + index,
            }
        )
    return rows


async def analyze_conversation(*, conversation: dict, segments: list[dict], log: dict | None = None) -> dict:
    if not is_ai_configured():
        err = Exception("AI is not configured. Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT on the server.")
        err.status = 501  # type: ignore[attr-defined]
        raise err
    if not segments:
        err = Exception("No transcript is available to analyze")
        err.status = 400  # type: ignore[attr-defined]
        raise err
    mentioned_tools = extract_mentioned_tools("\n".join(segment.get("text") or "" for segment in segments))
    header = "\n".join(
        filter(
            None,
            [
                f"Title: {conversation['title']}" if conversation.get("title") else "",
                f"Company: {conversation['company_name']}" if conversation.get("company_name") else "",
                f"Automatically detect products, platforms, integrations, requirements, stakeholders, constraints, and commitments. Known names to preserve if misheard: {', '.join(KNOWN_TOOLS)}",
                f"These product names appear in the transcript. Use them verbatim in every field and never replace them with \"automation\": {', '.join(mentioned_tools)}"
                if mentioned_tools
                else "",
            ],
        )
    )
    material = format_transcript(segments)
    if len(material) > 9000:
        chunk_summaries = []
        for chunk in split_segments(segments, 6000):
            raw = await ask_model(
                max_tokens=700,
                system="Summarize this transcript chunk as compact JSON with summary, key_points, pain_points, requirements, stakeholders, constraints, tools, decisions, action_items. Keep product names. Do not invent facts.",
                user=f"{header}\n\n{format_transcript(chunk)}",
                log=log,
            )
            chunk_summaries.append(raw)
        material = "Rolling chunk summaries:\n" + "\n---\n".join(chunk_summaries)
    content = await ask_model(
        max_tokens=3500,
        system=SYSTEM_PROMPT,
        user=f"{header}\n\nTranscript:\n{material}",
        log=log,
    )
    parsed = extract_json(content)
    if not _payload_is_usable(parsed):
        logger.warning(
            "Conversation intelligence JSON parse failed (first attempt). Sample: %s",
            (content or "")[:500],
        )
        retry_system = (
            f"{SYSTEM_PROMPT}\n\n"
            "CRITICAL: Respond with ONE valid JSON object only. "
            "No markdown fences. No commentary before or after the JSON."
        )
        content = await ask_model(
            max_tokens=3500,
            system=retry_system,
            user=f"{header}\n\nTranscript:\n{material}",
            json_mode=True,
            log=log,
        )
        parsed = extract_json(content)
    if not _payload_is_usable(parsed):
        logger.warning(
            "Conversation intelligence JSON parse failed (retry). Sample: %s",
            (content or "")[:500],
        )
        err = Exception("AI returned an unreadable intelligence result")
        err.status = 502  # type: ignore[attr-defined]
        raise err
    next_action = parsed.get("next_action")
    if isinstance(next_action, dict):
        next_action = next_action.get("body")
    return {
        "rows": merge_detected_tools(
            to_insight_rows(conversation["user_id"], conversation["id"], parsed),
            conversation["user_id"],
            conversation["id"],
            mentioned_tools,
        ),
        "nextAction": next_action,
        "pipelineVersion": PIPELINE_VERSION,
        "mentionedTools": mentioned_tools,
    }
