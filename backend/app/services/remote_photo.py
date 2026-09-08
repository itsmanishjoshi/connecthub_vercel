from __future__ import annotations

import ipaddress
import re
from pathlib import Path
from urllib.parse import urlparse

import httpx

from app.photo_store import mime_from_buffer, parse_data_url
from app.security import is_allowed_photo_proxy_url

MAX_BYTES = 5 * 1024 * 1024
BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal"}


def is_safe_image_url(value: str) -> bool:
    try:
        url = urlparse(str(value))
        if url.scheme not in ("http", "https"):
            return False
        host = (url.hostname or "").lower().strip("[]")
        if host in BLOCKED_HOSTS or host.endswith(".localhost"):
            return False
        if re.fullmatch(r"\d+", host):
            return False
        if re.match(r"^(10|127|169\.254|192\.168)\.", host):
            return False
        if re.match(r"^172\.(1[6-9]|2\d|3[0-1])\.", host):
            return False
        if ":" in host and re.match(r"^(::1|fe80:|fc|fd)", host, re.I):
            return False
        try:
            ip = ipaddress.ip_address(host)
            if ip.is_private or ip.is_loopback or ip.is_link_local:
                return False
        except ValueError:
            pass
        return True
    except Exception:
        return False


def has_image_signature(buffer: bytes) -> bool:
    if len(buffer) < 12:
        return False
    hex_prefix = buffer[:12].hex()
    return (
        hex_prefix.startswith("ffd8ff")
        or hex_prefix.startswith("89504e470d0a1a0a")
        or buffer[:6] in (b"GIF87a", b"GIF89a")
        or (buffer[:4] == b"RIFF" and buffer[8:12] == b"WEBP")
    )


async def resolve_photo_bytes(source_url: str | None, upload_dir: Path) -> dict | None:
    source = str(source_url or "").strip()
    if not source:
        return None
    if source.startswith("/api/attendees/") and "/photo" in source:
        return None

    data = parse_data_url(source)
    if data and has_image_signature(data["buffer"]) and len(data["buffer"]) <= MAX_BYTES:
        return data

    if source.startswith("/uploads/") and upload_dir:
        relative = source.replace("/uploads/", "").replace("\\", "/")
        if ".." in relative:
            return None
        file_path = upload_dir / relative
        if not file_path.is_file():
            return None
        buffer = file_path.read_bytes()
        if not buffer or len(buffer) > MAX_BYTES or not has_image_signature(buffer):
            return None
        return {"buffer": buffer, "mime": mime_from_buffer(buffer)}

    if not is_safe_image_url(source):
        return None
    if not is_allowed_photo_proxy_url(source):
        return None
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=8.0) as client:
            response = await client.get(source, headers={"Accept": "image/*,*/*;q=0.8"})
        if response.status_code in (301, 302, 303, 307, 308):
            location = str(response.headers.get("location") or "")
            if location and is_safe_image_url(location) and is_allowed_photo_proxy_url(location):
                async with httpx.AsyncClient(follow_redirects=False, timeout=8.0) as client:
                    response = await client.get(location, headers={"Accept": "image/*,*/*;q=0.8"})
            else:
                return None
        if response.status_code != 200:
            return None
        content_type = str(response.headers.get("content-type") or "")
        if content_type and not content_type.startswith("image/"):
            return None
        buffer = response.content
        if not buffer or len(buffer) > MAX_BYTES or not has_image_signature(buffer):
            return None
        mime = content_type.split(";")[0].strip() or mime_from_buffer(buffer)
        return {"buffer": buffer, "mime": mime}
    except Exception:
        return None


async def resolve_attendee_photo(
    profile_pic_url: str | None,
    linkedin_url: str | None,
    upload_dir: Path,
) -> dict | None:
    from app.photo_store import is_valid_photo_source, linkedin_avatar_source

    if is_valid_photo_source(profile_pic_url):
        loaded = await resolve_photo_bytes(str(profile_pic_url), upload_dir)
        if loaded:
            return loaded

    avatar_source = linkedin_avatar_source(linkedin_url)
    if avatar_source:
        loaded = await resolve_photo_bytes(avatar_source, upload_dir)
        if loaded:
            return loaded
    return None
