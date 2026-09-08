from __future__ import annotations

from datetime import datetime
from typing import Any

VERSIONED_TABLES = {"attendee_notes", "user_notes", "user_preferences"}


def extract_expected_updated_at(data: Any) -> str | None:
    if not data or not isinstance(data, dict):
        return None
    return data.get("expected_updated_at")


def strip_conflict_meta(data: Any) -> Any:
    if not data or not isinstance(data, (dict, list)):
        return data
    if isinstance(data, list):
        return [strip_conflict_meta(item) for item in data]
    return {k: v for k, v in data.items() if k != "expected_updated_at"}


def is_stale_write(existing_updated_at: Any, expected_updated_at: Any) -> bool:
    if not existing_updated_at or not expected_updated_at:
        return False
    try:
        existing = datetime.fromisoformat(str(existing_updated_at).replace("Z", "+00:00")).timestamp() * 1000
        expected = datetime.fromisoformat(str(expected_updated_at).replace("Z", "+00:00")).timestamp() * 1000
    except ValueError:
        try:
            existing = datetime.fromisoformat(str(existing_updated_at)).timestamp() * 1000
            expected = datetime.fromisoformat(str(expected_updated_at)).timestamp() * 1000
        except ValueError:
            return False
    return existing > expected + 750
