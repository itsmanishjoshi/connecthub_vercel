from __future__ import annotations

import base64
import os
import time
from typing import Any, Literal

import httpx

import app.config  # noqa: F401 — ensure layered env files are loaded

Tier = Literal["lite", "heavy"]
Task = Literal["chat", "vision", "extract", "analyze"]
Provider = Literal["grok", "groq", "gemini", "mistral", "openrouter"]

ALL_PROVIDERS: tuple[Provider, ...] = ("groq", "openrouter", "gemini", "mistral", "grok")
LITE_INPUT_CHARS = 4000
HEAVY_TASKS = frozenset({"vision", "analyze"})


def _grok_api_key() -> str | None:
    return (os.getenv("GROK_API_KEY") or os.getenv("XAI_API_KEY") or "").strip() or None


def _provider_available(name: Provider) -> bool:
    if name == "grok":
        return bool(_grok_api_key())
    if name == "groq":
        return bool((os.getenv("GROQ_API_KEY") or "").strip())
    if name == "gemini":
        return bool((os.getenv("GEMINI_API_KEY") or "").strip())
    if name == "mistral":
        return bool((os.getenv("MISTRAL_API_KEY") or "").strip())
    if name == "openrouter":
        return bool((os.getenv("OPENROUTER_API_KEY") or "").strip())
    return False


def configured_providers() -> list[str]:
    return [name for name in ALL_PROVIDERS if _provider_available(name)]


def _resolve_provider() -> Provider | None:
    preferred = (os.getenv("AI_PROVIDER") or "").strip().lower()
    if preferred in ALL_PROVIDERS:
        return preferred if _provider_available(preferred) else None  # type: ignore[return-value]
    for candidate in ALL_PROVIDERS:
        if _provider_available(candidate):
            return candidate
    return None


def _provider_for(options: dict, tier: Tier) -> Provider | None:
    task = str(options.get("task") or "chat")
    if options.get("images") or task == "vision":
        env_key = "AI_VISION_PROVIDER"
    elif task == "analyze":
        env_key = "AI_ANALYZE_PROVIDER"
    elif task == "extract":
        env_key = "AI_EXTRACT_PROVIDER"
    elif tier == "lite":
        env_key = "AI_LITE_PROVIDER"
    else:
        env_key = "AI_CHAT_PROVIDER"

    named = (os.getenv(env_key) or os.getenv("AI_PROVIDER") or "").strip().lower()
    if named in ALL_PROVIDERS and _provider_available(named):  # type: ignore[arg-type]
        return named  # type: ignore[return-value]
    return _resolve_provider()


def is_ai_configured() -> bool:
    return bool(configured_providers())


def describe_ai_routing() -> dict[str, Any]:
    return {
        "strategy": "Task-aware routing across Groq, OpenRouter, Gemini, Mistral, and Grok",
        "providers": configured_providers(),
        "activeProvider": _resolve_provider(),
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


def _model_for(provider: Provider, options: dict, tier: Tier) -> str:
    task = str(options.get("task") or "chat")
    if provider == "groq":
        default = os.getenv("GROQ_MODEL") or "llama-3.3-70b-versatile"
        if options.get("images") or task == "vision":
            return os.getenv("GROQ_VISION_MODEL") or default
        if task == "analyze":
            return os.getenv("GROQ_ANALYZE_MODEL") or os.getenv("GROQ_MODEL") or default
        if task == "extract":
            return os.getenv("GROQ_EXTRACT_MODEL") or default
        if tier == "lite":
            return os.getenv("GROQ_LITE_MODEL") or default
        return default
    if provider == "openrouter":
        if options.get("images") or task == "vision":
            return os.getenv("OPENROUTER_VISION_MODEL") or "openai/gpt-4o"
        if task == "analyze":
            return os.getenv("OPENROUTER_ANALYZE_MODEL") or "openai/gpt-4o-mini"
        if task == "extract":
            return os.getenv("OPENROUTER_EXTRACT_MODEL") or "openai/gpt-4o-mini"
        if tier == "lite":
            return os.getenv("OPENROUTER_LITE_MODEL") or "openai/gpt-4o-mini"
        return os.getenv("OPENROUTER_CHAT_MODEL") or os.getenv("OPENROUTER_MODEL") or "anthropic/claude-sonnet-4"
    if provider == "gemini":
        default = os.getenv("GEMINI_MODEL") or "gemini-2.5-flash"
        if options.get("images") or task == "vision":
            return os.getenv("GEMINI_VISION_MODEL") or os.getenv("GEMINI_HEAVY_MODEL") or default
        if task == "analyze":
            return os.getenv("GEMINI_ANALYZE_MODEL") or os.getenv("GEMINI_HEAVY_MODEL") or default
        if task == "extract":
            return os.getenv("GEMINI_EXTRACT_MODEL") or default
        if tier == "lite":
            return os.getenv("GEMINI_LITE_MODEL") or default
        return os.getenv("GEMINI_HEAVY_MODEL") or default
    if provider == "mistral":
        default = os.getenv("MISTRAL_MODEL") or "mistral-small-latest"
        if options.get("images") or task == "vision":
            return os.getenv("MISTRAL_VISION_MODEL") or "pixtral-large-latest"
        if task == "analyze":
            return os.getenv("MISTRAL_ANALYZE_MODEL") or os.getenv("MISTRAL_LARGE_MODEL") or default
        if task == "extract":
            return os.getenv("MISTRAL_EXTRACT_MODEL") or default
        if tier == "lite":
            return os.getenv("MISTRAL_LITE_MODEL") or default
        return os.getenv("MISTRAL_LARGE_MODEL") or default
    if provider == "grok":
        default = os.getenv("GROK_MODEL") or "grok-2-1212"
        if options.get("images"):
            return os.getenv("GROK_VISION_MODEL") or default
        if tier == "lite":
            return os.getenv("GROK_LITE_MODEL") or default
        if task == "extract":
            return os.getenv("GROK_EXTRACT_MODEL") or default
        return default
    raise ValueError(f"Unknown provider: {provider}")


async def _complete_with_openai_compatible(
    options: dict,
    *,
    base_url: str,
    api_key: str,
    model: str,
    provider_label: str,
    extra_headers: dict[str, str] | None = None,
) -> str:
    body: dict[str, Any] = {
        "model": model,
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

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    if extra_headers:
        headers.update(extra_headers)

    url = f"{base_url.rstrip('/')}/chat/completions"
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, headers=headers, json=body)
    data = response.json()
    if response.status_code >= 400:
        message = data.get("error", {}).get("message") or data.get("message") or f"{provider_label} request failed"
        err = Exception(message)
        err.status = response.status_code  # type: ignore[attr-defined]
        raise err

    content = data.get("choices", [{}])[0].get("message", {}).get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(part.get("text", "") for part in content if isinstance(part, dict))
    return ""


async def _complete_with_gemini(options: dict, tier: Tier) -> str:
    api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not api_key:
        err = Exception("Gemini is not configured. Set GEMINI_API_KEY.")
        err.status = 501  # type: ignore[attr-defined]
        raise err

    model = _model_for("gemini", options, tier)
    messages = _to_chat_messages(
        system=options.get("system"),
        user=options.get("user"),
        messages=options.get("messages"),
        images=options.get("images"),
    )

    contents: list[dict[str, Any]] = []
    system_parts: list[str] = []
    for message in messages:
        role = message.get("role")
        content = message.get("content")
        if role == "system":
            system_parts.append(str(content))
            continue
        parts: list[dict[str, Any]] = []
        if isinstance(content, list):
            for block in content:
                if block.get("type") == "text":
                    parts.append({"text": block.get("text") or ""})
                elif block.get("type") == "image_url":
                    url = (block.get("image_url") or {}).get("url") or ""
                    if url.startswith("data:") and ";base64," in url:
                        mime, b64 = url.split(";base64,", 1)
                        parts.append({"inline_data": {"mime_type": mime.replace("data:", ""), "data": b64}})
        else:
            parts.append({"text": str(content or "")})
        contents.append({"role": "user" if role == "user" else "model", "parts": parts})

    body: dict[str, Any] = {"contents": contents}
    if system_parts:
        body["systemInstruction"] = {"parts": [{"text": "\n\n".join(system_parts)}]}
    if options.get("jsonMode"):
        body["generationConfig"] = {"responseMimeType": "application/json"}

    base = (os.getenv("GEMINI_API_BASE") or "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
    url = f"{base}/models/{model}:generateContent?key={api_key}"
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, json=body)
    data = response.json()
    if response.status_code >= 400:
        message = data.get("error", {}).get("message") or "Gemini request failed"
        err = Exception(message)
        err.status = response.status_code  # type: ignore[attr-defined]
        raise err

    candidates = data.get("candidates") or []
    parts = (candidates[0].get("content") or {}).get("parts") or [] if candidates else []
    return "".join(str(part.get("text") or "") for part in parts)


async def _complete_with_provider(provider: Provider, options: dict, tier: Tier) -> str:
    if provider == "groq":
        api_key = (os.getenv("GROQ_API_KEY") or "").strip()
        return await _complete_with_openai_compatible(
            options,
            base_url=os.getenv("GROQ_API_BASE") or "https://api.groq.com/openai/v1",
            api_key=api_key,
            model=_model_for("groq", options, tier),
            provider_label="Groq",
        )
    if provider == "openrouter":
        api_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
        site = os.getenv("OPENROUTER_SITE_URL") or os.getenv("APP_URL") or "https://connecthub.local"
        return await _complete_with_openai_compatible(
            options,
            base_url=os.getenv("OPENROUTER_API_BASE") or "https://openrouter.ai/api/v1",
            api_key=api_key,
            model=_model_for("openrouter", options, tier),
            provider_label="OpenRouter",
            extra_headers={"HTTP-Referer": site, "X-Title": "ConnectHub"},
        )
    if provider == "mistral":
        api_key = (os.getenv("MISTRAL_API_KEY") or "").strip()
        return await _complete_with_openai_compatible(
            options,
            base_url=os.getenv("MISTRAL_API_BASE") or "https://api.mistral.ai/v1",
            api_key=api_key,
            model=_model_for("mistral", options, tier),
            provider_label="Mistral",
        )
    if provider == "gemini":
        return await _complete_with_gemini(options, tier)
    if provider == "grok":
        return await _complete_with_openai_compatible(
            options,
            base_url=os.getenv("GROK_API_BASE") or "https://api.x.ai/v1",
            api_key=_grok_api_key() or "",
            model=_model_for("grok", options, tier),
            provider_label="Grok",
        )

    err = Exception(f"Unknown AI provider: {provider}")
    err.status = 501  # type: ignore[attr-defined]
    raise err


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
    provider = _provider_for(opts, tier)
    if not provider:
        err = Exception(
            "AI is not configured. Set GROQ_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY, or GROK_API_KEY."
        )
        err.status = 501  # type: ignore[attr-defined]
        raise err

    try:
        text = await _complete_with_provider(provider, opts, tier)
        if not text:
            raise Exception(f"{provider} returned an empty response")
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
