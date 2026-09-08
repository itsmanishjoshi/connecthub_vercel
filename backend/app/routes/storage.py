from __future__ import annotations

from pathlib import Path

import asyncpg
from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from app.config import settings
from app.database import get_pool
from app.db_handler import save_attendee_photo
from app.dependencies import api_error, get_current_user
from app.services.remote_photo import has_image_signature
from app.upload_access import can_access_upload

router = APIRouter()

ALLOWED_IMAGE_BUCKETS = frozenset({"avatars", "profile-pictures", "event-images", "qr-codes"})
ALLOWED_AUDIO_BUCKETS = frozenset({"conversation-audio"})
ALLOWED_STORAGE_BUCKETS = ALLOWED_IMAGE_BUCKETS | ALLOWED_AUDIO_BUCKETS

ALLOWED_AUDIO_MIMES = frozenset(
    {
        "audio/webm",
        "audio/ogg",
        "audio/mp4",
        "audio/mpeg",
        "audio/wav",
        "video/webm",
    }
)
ALLOWED_IMAGE_MIMES = frozenset(
    {"image/jpeg", "image/png", "image/webp", "image/gif"}
)


@router.post("/api/storage/{bucket}")
async def upload_storage(
    bucket: str,
    request: Request,
    file: UploadFile = File(...),
    path: str | None = Form(default=None),
    user: dict = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    safe_bucket = "".join(ch for ch in bucket if ch.isalnum() or ch in "_-")
    if safe_bucket not in ALLOWED_STORAGE_BUCKETS:
        raise api_error(400, "Unknown storage bucket")
    if safe_bucket in ALLOWED_AUDIO_BUCKETS:
        if (file.content_type or "") not in ALLOWED_AUDIO_MIMES:
            raise api_error(400, "Only WebM, OGG, MP4, MP3 or WAV audio is allowed")
    elif (file.content_type or "") not in ALLOWED_IMAGE_MIMES:
        raise api_error(400, "Only JPEG, PNG, WebP and GIF images are allowed")

    requested = str(path or file.filename or "").replace("\\", "/")
    file_name = Path(requested).name
    if not file_name or not await can_access_upload(pool, user, safe_bucket, file_name):
        raise api_error(403, "File is not allowed for this account")

    dest_dir = settings.upload_dir / safe_bucket
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / file_name
    data = await file.read()
    if len(data) > 12 * 1024 * 1024:
        raise api_error(400, "No file uploaded")

    is_audio = safe_bucket in ALLOWED_AUDIO_BUCKETS
    if not is_audio and not has_image_signature(data):
        raise api_error(403, "File is not allowed for this account")

    dest_path.write_bytes(data)

    public_url = f"/uploads/{safe_bucket}/{file_name}"
    if safe_bucket == "profile-pictures":
        import re

        match = re.search(
            r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            file_name,
            re.I,
        )
        if match:
            await save_attendee_photo(pool, match.group(0), public_url)
    return {"data": {"path": f"{safe_bucket}/{file_name}", "publicUrl": public_url}, "error": None}


@router.post("/api/storage/{bucket}/remove")
async def remove_storage(
    bucket: str,
    request: Request,
    user: dict = Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    if bucket not in ALLOWED_STORAGE_BUCKETS:
        raise api_error(400, "Unknown storage bucket")
    try:
        body = await request.json()
    except Exception:
        body = {}
    paths = body.get("paths") or []
    for item in paths:
        file_name = Path(str(item)).name
        if not await can_access_upload(pool, user, bucket, file_name):
            raise api_error(403, "File is not owned by this account")
        file_path = settings.upload_dir / bucket / file_name
        if file_path.is_file():
            file_path.unlink()
    return {"data": paths, "error": None}
