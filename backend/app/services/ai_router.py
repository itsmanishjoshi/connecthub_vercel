from __future__ import annotations

import base64
import os
import time
from typing import Any, Literal

import httpx

import app.config  # noqa: F401 — ensure layered env files are loaded

Tier = Literal["lite", "heavy"]
Task = Literal["chat", "vision", "extract", "analyze"]

LITE_INPUT_CHARS = 4000
HEAVY_TASKS = frozenset({"vision", "analyze"})


def _azure_configured() -> bool:
    return bool((os.getenv("AZURE_OPENAI_API_KEY") or "").strip()) and bool(
        (os.getenv("AZURE_OPENAI_ENDPOINT") or "").strip()
    )


def configured_providers() -> list[str]:
    return ["azure"] if _azure_configured() else []


def is_ai_configured() -> bool:
    return _azure_configured()


def describe_ai_routing() -> dict[str, Any]:
    return {
        "strategy": "Azure OpenAI with lite vs heavy deployment routing",
        "providers": configured_providers(),
        "activeProvider": "azure" if _azure_configured() else None,
        "tiers": {
            "lite": "Quick chat, intent checks, small extracts",
            "heavy": "Vision, conversation analysis, large documents",
        },
        "tasks": {
            "chat": "Jelly assistant, general AI chat",
            "vision": "Roster/badge/headshot image reading",
            "extract": "People and fields from documents",
            "analyze": "Conversation summaries, MoM, structured insights",
        },
    }


def resolve_tier(options: dict) -> Tier:
    explicit = options.get("tier")
    if explicit in ("lite", "heavy"):
        return explicit
    task = str(options.get("task") or "chat")
    if task in HEAVY_TASKS or options.get("images"):
        return "heavy"
    if options.get("jsonMode") and task == "analyze":
        return "heavy"
    if _estimate_chars(options) > LITE_INPUT_CHARS:
        return "heavy"
    if task == "extract" and _estimate_chars(options) > 2500:
        return "heavy"
    return "lite"


def _estimate_chars(options: dict) -> int:
    parts: list[str] = []
    if options.get("system"):
        parts.append(str(options["system"]))
    if options.get("user"):
        parts.append(str(options["user"]))
    for message in options.get("messages") or []:
        if isinstance(message, dict):
            parts.append(str(message.get("content") or ""))
        else:
            parts.append(str(message))
    return len("".join(parts))


def _estimate_tokens_in(options: dict) -> int:
    return max(1, int(_estimate_chars(options) / 4))


def _to_chat_messages(
    *,
    system: str | None = None,
    user: str | None = None,
    messages: list[dict] | None = None,
    images: list[dict] | None = None,
) -> list[dict]:
    if messages:
        return messages
    has_images = bool(images)
    result: list[dict] = []
    if system:
        result.append({"role": "system", "content": system})
    if has_images:
        content: Any = [{"type": "text", "text": user or ""}]
        for image in images or []:
            b64 = base64.b64encode(image["buffer"]).decode()
            content.append(
                {"type": "image_url", "image_url": {"url": f"data:{image['mime']};base64,{b64}"}}
            )
        result.append({"role": "user", "content": content})
    else:
        result.append({"role": "user", "content": user or ""})
    return result


def _azure_deployment(options: dict, tier: Tier) -> str:
    default = os.getenv("AZURE_OPENAI_DEPLOYMENT") or "gpt-4o"
    task = str(options.get("task") or "chat")
    if options.get("images") or task == "vision":
        return os.getenv("AZURE_OPENAI_VISION_DEPLOYMENT") or default
    if tier == "lite":
        return os.getenv("AZURE_OPENAI_LITE_DEPLOYMENT") or default
    if task == "extract":
        return os.getenv("AZURE_OPENAI_EXTRACT_DEPLOYMENT") or default
    if task == "analyze":
        return os.getenv("AZURE_OPENAI_ANALYZE_DEPLOYMENT") or default
    return default


async def _complete_with_azure(options: dict, tier: Tier) -> str:
    api_key = (os.getenv("AZURE_OPENAI_API_KEY") or "").strip()
    endpoint = (os.getenv("AZURE_OPENAI_ENDPOINT") or "").rstrip("/")
    if not api_key or not endpoint:
        err = Exception(
            "Azure OpenAI is not configured. Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT."
        )
        err.status = 501  # type: ignore[attr-defined]
        raise err

    deployment = _azure_deployment(options, tier)
    version = os.getenv("AZURE_OPENAI_API_VERSION") or "2025-01-01-preview"
    url = f"{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={version}"
    body: dict[str, Any] = {
        "model": deployment,
        "temperature": options.get("temperature", 0.2),
        "max_tokens": options.get("maxTokens") or options.get("max_tokens") or 1800,
        "messages": _to_chat_messages(
            system=options.get("system"),
            user=options.get("user"),
            messages=options.get("messages"),
            images=options.get("images"),
        ),
    }
    if options.get("jsonMode"):
        body["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            url,
            headers={"api-key": api_key, "Content-Type": "application/json"},
            json=body,
        )
    data = response.json()
    if response.status_code >= 400:
        message = data.get("error", {}).get("message") or data.get("message") or "Azure OpenAI request failed"
        err = Exception(message)
        err.status = response.status_code  # type: ignore[attr-defined]
        raise err

    content = data.get("choices", [{}])[0].get("message", {}).get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(part.get("text", "") for part in content if isinstance(part, dict))
    return ""


async def complete(options: dict) -> dict:
    from app.services.ai_usage_context import merge_ai_log
    from app.services.analytics import log_api_usage
    from app.services.ai_cost import estimate_cost_usd

    log_meta = merge_ai_log(options.get("_log"))
    opts = {key: value for key, value in options.items() if key != "_log"}
    tier = resolve_tier(opts)
    started = time.time()
    tokens_in = _estimate_tokens_in(opts)
    task = str(opts.get("task") or "chat")
    route = (log_meta or {}).get("route") or f"/api/ai/{task}"
    provider = "azure"

    if not _azure_configured():
        err = Exception(
            "AI is not configured. Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT on the server."
        )
        err.status = 501  # type: ignore[attr-defined]
        raise err

    try:
        text = await _complete_with_azure(opts, tier)
        if not text:
            raise Exception("Azure OpenAI returned an empty response")
        result = {"text": text, "provider": provider, "tier": tier}
        if log_meta and log_meta.get("pool"):
            meta = dict(log_meta.get("meta") or {})
            tokens_out = max(1, int(len(str(text)) / 4))
            meta.update({
                "tier": tier,
                "provider": provider,
                "cost_usd": estimate_cost_usd(tokens_in, tokens_out, tier=tier),
            })
            await log_api_usage(
                log_meta["pool"],
                user_id=log_meta.get("user_id"),
                route=route,
                provider=provider,
                task=str(log_meta.get("task") or task),
                feature=log_meta.get("feature"),
                meta=meta,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                status=200,
                duration_ms=int((time.time() - started) * 1000),
            )
        return result
    except Exception as error:
        failed = Exception(str(error) or "AI request failed")
        failed.status = getattr(error, "status", 502)  # type: ignore[attr-defined]
        if log_meta and log_meta.get("pool"):
            await log_api_usage(
                log_meta["pool"],
                user_id=log_meta.get("user_id"),
                route=route,
                provider=provider,
                task=str(log_meta.get("task") or task),
                feature=log_meta.get("feature"),
                meta={**(log_meta.get("meta") or {}), "tier": tier},
                tokens_in=tokens_in,
                status=getattr(failed, "status", 502),
                duration_ms=int((time.time() - started) * 1000),
            )
        raise failed


async def complete_text(options: dict) -> str:
    result = await complete(options)
    return result["text"]
