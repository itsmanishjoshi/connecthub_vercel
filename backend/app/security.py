"""Security helpers: headers, passwords, media tokens, upload access, proxy allowlist."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from app.config import settings

MEDIA_TOKEN_TTL_SECONDS = 3600
MAX_DB_SELECT_ROWS = 5000

PROTECTED_UPLOAD_PREFIXES = (
    "/avatars/",
    "/profile-pictures/",
    "/qr-codes/",
    "/repository/",
    "/conversation-audio/",
)

# Hosts allowed for server-side photo proxy (blocks open SSRF).
PHOTO_PROXY_ALLOWED_HOSTS = frozenset(
    {
        "unavatar.io",
        "www.unavatar.io",
        "media.licdn.com",
        "static.licdn.com",
    }
)

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128


def validate_password(password: str) -> str | None:
    text = str(password or "")
    if len(text) < PASSWORD_MIN_LENGTH:
        return f"Password must be at least {PASSWORD_MIN_LENGTH} characters"
    if len(text) > PASSWORD_MAX_LENGTH:
        return f"Password must be at most {PASSWORD_MAX_LENGTH} characters"
    if re.search(r"[\x00-\x08\x0b-\x1f]", text):
        return "Password contains invalid characters"
    return None


def is_protected_upload_path(request_path: str) -> bool:
    relative = str(request_path or "").replace("\\", "/")
    if not relative.startswith("/"):
        relative = f"/{relative}"
    return any(relative.startswith(prefix) for prefix in PROTECTED_UPLOAD_PREFIXES)


def is_blocked_public_upload_path(request_path: str) -> bool:
    relative = str(request_path or "").replace("\\", "/")
    return (
        relative.startswith("/private")
        or relative.startswith("/assets")
        or relative.startswith("/assets-tmp")
        or relative == "/ingest-last.xlsx"
        or relative == "/ingest-last.docx"
        or is_protected_upload_path(relative)
    )


def upload_bucket_and_name(relative_path: str) -> tuple[str | None, str | None]:
    cleaned = str(relative_path or "").replace("\\", "/").lstrip("/")
    parts = [part for part in cleaned.split("/") if part and part not in (".", "..")]
    if len(parts) < 2:
        return None, None
    return parts[0], parts[-1]


def is_allowed_photo_proxy_url(url: str) -> bool:
    try:
        host = (urlparse(str(url or "")).hostname or "").lower().strip("[]")
        if not host:
            return False
        if host in PHOTO_PROXY_ALLOWED_HOSTS:
            return True
        return host.endswith(".sharepoint.com")
    except Exception:
        return False


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def issue_media_token(relative_path: str) -> str:
    cleaned = str(relative_path or "").replace("\\", "/").lstrip("/")
    if ".." in cleaned.split("/"):
        raise ValueError("Invalid path")
    payload_obj = {
        "p": cleaned,
        "exp": int(time.time()) + MEDIA_TOKEN_TTL_SECONDS,
    }
    payload = _b64url_encode(json.dumps(payload_obj, separators=(",", ":")).encode())
    sig = _b64url_encode(
        hmac.new(settings.auth_secret.encode(), payload.encode(), hashlib.sha256).digest()
    )
    return f"{payload}.{sig}"


def verify_media_token(token: str | None) -> str | None:
    if not token or "." not in token:
        return None
    payload, sig = token.split(".", 1)
    expected = _b64url_encode(
        hmac.new(settings.auth_secret.encode(), payload.encode(), hashlib.sha256).digest()
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
        if data.get("exp", 0) < int(time.time()):
            return None
        path = str(data.get("p") or "").replace("\\", "/").lstrip("/")
        if not path or ".." in path.split("/"):
            return None
        return path
    except Exception:
        return None


def resolve_upload_file(upload_root: Path, relative_path: str) -> Path | None:
    cleaned = str(relative_path or "").replace("\\", "/").lstrip("/")
    if not cleaned or ".." in cleaned.split("/"):
        return None
    full = (upload_root / cleaned).resolve()
    root = upload_root.resolve()
    if not str(full).startswith(str(root)):
        return None
    return full if full.is_file() else None


def security_headers() -> dict[str, str]:
    headers = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(self), geolocation=()",
        "Cross-Origin-Resource-Policy": "same-origin",
    }
    if settings.is_production:
        headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
    return headers
