from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import time
from typing import Any

import bcrypt
from fastapi import Request

from app.config import settings
from app.photo_store import strip_photo_bytes

TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000
_BCRYPT_RE = re.compile(r"^\$2[aby]\$")


def auth_secret() -> str:
    return settings.auth_secret


def is_bcrypt_hash(value: Any) -> bool:
    return isinstance(value, str) and bool(_BCRYPT_RE.match(value))


async def hash_password(plain: str) -> str:
    return bcrypt.hashpw(str(plain).encode(), bcrypt.gensalt(rounds=10)).decode()


async def verify_password(plain: str, stored: str | None) -> bool:
    if not stored:
        return False
    if not is_bcrypt_hash(stored):
        return False
    return bcrypt.checkpw(str(plain).encode(), stored.encode())


async def hash_password_fields(row: dict | None) -> dict | None:
    if not row or not isinstance(row, dict):
        return row
    if row.get("password_hash") and not is_bcrypt_hash(row["password_hash"]):
        return {**row, "password_hash": await hash_password(row["password_hash"])}
    return row


async def prepare_event_secrets(row: dict | None) -> dict | None:
    if not row or not isinstance(row, dict) or "access_pin" not in row:
        return row
    pin = row["access_pin"]
    if pin is None or pin == "":
        return {**row, "access_pin": None}
    value = str(pin).strip()
    if is_bcrypt_hash(value):
        return row
    if not re.fullmatch(r"\d{4}", value):
        err = ValueError("Door code must be 4 digits")
        err.status = 400  # type: ignore[attr-defined]
        raise err
    return {**row, "access_pin": await hash_password(value)}


def sanitize_user_row(row: dict | None) -> dict | None:
    if not row or not isinstance(row, dict):
        return row
    copy = dict(row)
    copy.pop("password_hash", None)
    return copy


def sanitize_rows(table: str, rows: list[dict]) -> list[dict]:
    if table == "users":
        return [sanitize_user_row(r) for r in rows]
    if table in ("attendees", "contacts"):
        return [strip_photo_bytes(r) for r in rows]
    return rows


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def sign_token(user_id: str) -> str:
    payload_obj = {"sub": user_id, "exp": int(time.time() * 1000) + TOKEN_TTL_MS}
    payload = _b64url_encode(json.dumps(payload_obj, separators=(",", ":")).encode())
    sig = _b64url_encode(
        hmac.new(auth_secret().encode(), payload.encode(), hashlib.sha256).digest()
    )
    return f"{payload}.{sig}"


def verify_token(token: str | None) -> dict | None:
    if not token or "." not in token:
        return None
    payload, sig = token.split(".", 1)
    expected = _b64url_encode(
        hmac.new(auth_secret().encode(), payload.encode(), hashlib.sha256).digest()
    )
    try:
        a = _b64url_decode(sig)
        b = _b64url_decode(expected)
    except Exception:
        return None
    if len(a) != len(b) or not hmac.compare_digest(a, b):
        return None
    try:
        data = json.loads(_b64url_decode(payload).decode())
        if not data.get("sub") or data.get("exp", 0) < int(time.time() * 1000):
            return None
        return data
    except Exception:
        return None


def read_bearer(request: Request) -> str | None:
    header = request.headers.get("authorization") or ""
    if header.startswith("Bearer "):
        return header[7:]
    return request.headers.get("x-connecthub-token")
