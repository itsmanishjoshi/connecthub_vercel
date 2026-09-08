from __future__ import annotations

import re
from contextvars import ContextVar
from typing import Any

_UUID = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.I,
)
_NUMERIC_ID = re.compile(r"^\d+$")

_ai_log_context: ContextVar[dict[str, Any] | None] = ContextVar("ai_log_context", default=None)


def normalize_api_route(path: str) -> str:
    """Collapse UUIDs and numeric IDs so new endpoints group cleanly in analytics."""
    if not path:
        return path
    segments = []
    for segment in path.strip("/").split("/"):
        if _UUID.match(segment) or _NUMERIC_ID.match(segment):
            segments.append("{id}")
        else:
            segments.append(segment)
    return "/" + "/".join(segments) if segments else path


def set_ai_log_context(**kwargs: Any):
    return _ai_log_context.set(kwargs)


def reset_ai_log_context(token) -> None:
    _ai_log_context.reset(token)


def get_ai_log_context() -> dict[str, Any] | None:
    return _ai_log_context.get()


def merge_ai_log(explicit: dict[str, Any] | None) -> dict[str, Any] | None:
    """Merge request-scoped context with per-call overrides from complete()."""
    base = get_ai_log_context() or {}
    if explicit:
        merged = {**base, **explicit}
    else:
        merged = dict(base)
    if not merged.get("pool"):
        return explicit if explicit and explicit.get("pool") else None
    route = merged.get("route")
    if route:
        merged["route"] = normalize_api_route(str(route))
    return merged


def should_track_ai_usage(method: str, path: str) -> bool:
    if method not in ("POST", "PUT", "PATCH"):
        return False
    if path.startswith("/api/ai/"):
        return True
    if path.endswith("/analyze"):
        return True
    if "/people/extract" in path:
        return True
    return False
