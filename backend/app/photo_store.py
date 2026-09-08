from __future__ import annotations

import base64
import re
from typing import Any

ATTENDEE_PUBLIC_COLUMNS = (
    "id, event_id, name, designation, company, industry, location, city, "
    "profile_pic_url, linkedin_url, website_url, key_insights, ice_breakers, "
    "event_association, speaker, competitor, extra_data, created_at, updated_at, "
    "(profile_pic IS NOT NULL) AS has_profile_photo"
)


EXCEL_ERROR_RE = re.compile(r"^#(?:VALUE|REF|N/A|NAME|NUM|NULL|DIV/0)!?$", re.I)


def is_valid_photo_source(value: Any) -> bool:
    text = str(value or "").strip()
    if not text or EXCEL_ERROR_RE.match(text):
        return False
    if text.startswith("data:image/") or text.startswith("/uploads/") or text.startswith("/api/attendees/"):
        return True
    if re.search(r"^https?://", text, re.I):
        return True
    return bool(re.search(r"\.(jpe?g|png|webp|gif)(\?|$)", text, re.I))


def sanitize_photo_source(value: Any) -> str | None:
    text = str(value or "").strip()
    return text if is_valid_photo_source(text) else None


def linkedin_username(linkedin_url: Any) -> str | None:
    match = re.search(r"linkedin\.com/in/([^/?#]+)", str(linkedin_url or ""), re.I)
    if not match:
        return None
    return match.group(1).strip("/") or None


def linkedin_avatar_source(linkedin_url: Any) -> str | None:
    username = linkedin_username(linkedin_url)
    if not username:
        return None
    return f"https://unavatar.io/linkedin/{username}"


def can_resolve_attendee_photo(row: dict | None) -> bool:
    if not row:
        return False
    if is_valid_photo_source(row.get("profile_pic_url")):
        return True
    return linkedin_avatar_source(row.get("linkedin_url")) is not None


def attendee_photo_url(attendee_id: str) -> str:
    return f"/api/attendees/{attendee_id}/photo"


def mime_from_buffer(buffer: bytes) -> str:
    hex_prefix = buffer[:12].hex()
    if hex_prefix.startswith("89504e470d0a1a0a"):
        return "image/png"
    if buffer[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if buffer[:4] == b"RIFF" and buffer[8:12] == b"WEBP":
        return "image/webp"
    return "image/jpeg"


def to_data_url(buffer: bytes) -> str:
    return f"data:{mime_from_buffer(buffer)};base64,{base64.b64encode(buffer).decode()}"


def parse_data_url(value: str | None) -> dict | None:
    match = re.match(
        r"^data:(image/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$",
        str(value or ""),
    )
    if not match:
        return None
    buffer = base64.b64decode(re.sub(r"\s", "", match.group(2)))
    if not buffer:
        return None
    return {"buffer": buffer, "mime": match.group(1)}


def strip_photo_bytes(row: dict | None) -> dict | None:
    if not row or not isinstance(row, dict):
        return row
    copy = dict(row)
    copy.pop("profile_pic", None)
    copy.pop("profile_pic_mime", None)
    return copy


def enrich_attendee_photo_urls(rows: list[dict]) -> list[dict]:
    enriched: list[dict] = []
    for row in rows:
        copy = strip_photo_bytes(row) or {}
        attendee_id = copy.get("id")
        has_photo = bool(copy.pop("has_profile_photo", False))
        if not is_valid_photo_source(copy.get("profile_pic_url")):
            copy["profile_pic_url"] = None
        if attendee_id and has_photo:
            copy["profile_pic_url"] = attendee_photo_url(str(attendee_id))
        enriched.append(copy)
    return enriched


def select_sql_for_table(table: str, columns: str) -> str:
    if table in ("attendees", "contacts") and (not columns or columns == "*"):
        return ATTENDEE_PUBLIC_COLUMNS
    return columns
