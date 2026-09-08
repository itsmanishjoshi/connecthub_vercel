from __future__ import annotations

import os
import re
import uuid
from typing import Any
from urllib.parse import quote, unquote

import httpx

INGEST_BUCKET = "ingest-uploads"
MAX_INGEST_FILE_BYTES = 100 * 1024 * 1024
SIGNED_URL_EXPIRES_SECONDS = 3600


def _env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def _project_ref_from_database_url(database_url: str) -> str | None:
    if not database_url:
        return None
    pooler = re.search(r"postgres\.([a-z0-9]+)@", database_url, re.I)
    if pooler:
        return pooler.group(1)
    direct = re.search(r"db\.([a-z0-9]+)\.supabase\.co", database_url, re.I)
    if direct:
        return direct.group(1)
    return None


def supabase_url() -> str | None:
    explicit = _env("SUPABASE_URL")
    if explicit:
        return explicit.rstrip("/")
    project_ref = _project_ref_from_database_url(_env("DATABASE_URL"))
    if project_ref:
        return f"https://{project_ref}.supabase.co"
    return None


def service_role_key() -> str | None:
    return _env("SUPABASE_SERVICE_ROLE_KEY") or None


def is_configured() -> bool:
    return bool(supabase_url() and service_role_key())


def max_ingest_file_bytes() -> int:
    raw = _env("SUPABASE_INGEST_MAX_BYTES")
    if raw.isdigit():
        return max(4 * 1024 * 1024, int(raw))
    return MAX_INGEST_FILE_BYTES


def _headers() -> dict[str, str]:
    key = service_role_key()
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is not configured")
    return {"Authorization": f"Bearer {key}"}


def sanitize_filename(filename: str) -> str:
    base = os.path.basename(unquote(filename or "roster.xlsx")).strip() or "roster.xlsx"
    safe = re.sub(r"[^\w.\- ()]", "_", base)
    if not re.search(r"\.(xlsx|xls|csv|ods)$", safe, re.I):
        safe = f"{safe}.xlsx"
    return safe[:160]


def build_ingest_object_path(event_id: str, filename: str) -> str:
    safe_event = re.sub(r"[^a-zA-Z0-9\-_]", "", str(event_id or ""))
    if not safe_event:
        raise ValueError("Invalid event id")
    return f"ingest/{safe_event}/{uuid.uuid4().hex}-{sanitize_filename(filename)}"


def validate_ingest_object_path(storage_path: str, event_id: str) -> None:
    if not storage_path or ".." in storage_path or storage_path.startswith("/"):
        raise ValueError("Invalid storage path")
    safe_event = re.sub(r"[^a-zA-Z0-9\-_]", "", str(event_id or ""))
    prefix = f"ingest/{safe_event}/"
    if not storage_path.startswith(prefix):
        raise ValueError("Storage path does not match this event")
    if not re.search(r"\.(xlsx|xls|csv|ods)$", storage_path, re.I):
        raise ValueError("Storage path must point to a spreadsheet file")


async def ensure_ingest_bucket() -> None:
    base = supabase_url()
    if not base:
        raise RuntimeError("SUPABASE_URL is not configured")
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{base}/storage/v1/bucket",
            headers={**_headers(), "Content-Type": "application/json"},
            json={
                "id": INGEST_BUCKET,
                "name": INGEST_BUCKET,
                "public": False,
                "file_size_limit": max_ingest_file_bytes(),
            },
        )
        if response.status_code in (200, 201):
            return
        if response.status_code == 409:
            return
        detail = response.text[:240]
        raise RuntimeError(f"Could not ensure ingest bucket ({response.status_code}): {detail}")


async def create_signed_upload_url(object_path: str) -> dict[str, Any]:
    base = supabase_url()
    if not base:
        raise RuntimeError("SUPABASE_URL is not configured")
    await ensure_ingest_bucket()
    encoded_path = "/".join(quote(part, safe="") for part in object_path.split("/"))
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{base}/storage/v1/object/upload/sign/{INGEST_BUCKET}/{encoded_path}",
            headers={**_headers(), "Content-Type": "application/json"},
            json={"expiresIn": SIGNED_URL_EXPIRES_SECONDS},
        )
        if response.status_code >= 400:
            detail = response.text[:240]
            raise RuntimeError(f"Could not create signed upload URL ({response.status_code}): {detail}")
        payload = response.json()
        signed_url = payload.get("signedUrl") or payload.get("url")
        token = payload.get("token")
        if not signed_url or not token:
            raise RuntimeError("Supabase did not return a signed upload URL")
        return {
            "signedUrl": signed_url,
            "token": token,
            "storagePath": object_path,
            "bucket": INGEST_BUCKET,
            "expiresIn": SIGNED_URL_EXPIRES_SECONDS,
        }


async def download_object(object_path: str) -> bytes:
    base = supabase_url()
    if not base:
        raise RuntimeError("SUPABASE_URL is not configured")
    encoded_path = "/".join(quote(part, safe="") for part in object_path.split("/"))
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.get(
            f"{base}/storage/v1/object/{INGEST_BUCKET}/{encoded_path}",
            headers=_headers(),
        )
        if response.status_code >= 400:
            detail = response.text[:240]
            raise RuntimeError(f"Could not download ingest file ({response.status_code}): {detail}")
        data = response.content
        if len(data) > max_ingest_file_bytes():
            raise RuntimeError("Ingest file exceeds configured Supabase size limit")
        return data


async def delete_object(object_path: str) -> None:
    base = supabase_url()
    if not base:
        return
    encoded_path = "/".join(quote(part, safe="") for part in object_path.split("/"))
    async with httpx.AsyncClient(timeout=30.0) as client:
        await client.delete(
            f"{base}/storage/v1/object/{INGEST_BUCKET}/{encoded_path}",
            headers=_headers(),
        )


def describe_storage() -> dict[str, Any]:
    return {
        "provider": "supabase",
        "configured": is_configured(),
        "ingestBucket": INGEST_BUCKET if is_configured() else None,
        "maxIngestFileMb": max_ingest_file_bytes() // (1024 * 1024),
        "url": supabase_url(),
    }
