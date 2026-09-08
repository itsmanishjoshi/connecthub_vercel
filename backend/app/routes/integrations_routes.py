"""Third-party integration proxies — no external calls from the browser."""

from __future__ import annotations

import os
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel

from app.dependencies import api_error, get_current_user

router = APIRouter()


class SharePointTestBody(BaseModel):
    siteUrl: str
    libraryName: str | None = None
    fileName: str | None = None


def _validate_sharepoint_url(site_url: str) -> str:
    parsed = urlparse(site_url.strip())
    if parsed.scheme not in {"https", "http"}:
        raise api_error(400, "SharePoint site URL must use http or https")
    host = (parsed.hostname or "").lower()
    if not host.endswith("sharepoint.com"):
        raise api_error(400, "SharePoint site URL must be a sharepoint.com host")
    return site_url.strip().rstrip("/")


@router.post("/api/integrations/sharepoint/test")
async def test_sharepoint_connection(
    body: SharePointTestBody,
    _user: dict = Depends(get_current_user),
):
    site_url = _validate_sharepoint_url(body.siteUrl)
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.head(site_url)
            if response.status_code >= 400:
                response = await client.get(site_url)
        return {"ok": response.status_code < 400, "status": response.status_code}
    except httpx.HTTPError as error:
        raise api_error(502, f"Could not reach SharePoint: {error}") from error


@router.post("/api/integrations/sharepoint/upload")
async def upload_sharepoint_file(
    site_url: str = Form(...),
    library_name: str = Form(...),
    file_name: str = Form(...),
    file: UploadFile = File(...),
    _user: dict = Depends(get_current_user),
):
    site = _validate_sharepoint_url(site_url)
    token = os.getenv("SHAREPOINT_ACCESS_TOKEN", "").strip()
    if not token:
        raise api_error(
            501,
            "SharePoint upload is not configured. Set SHAREPOINT_ACCESS_TOKEN on the server.",
        )

    library = library_name.strip().strip("/")
    target_name = file_name.strip() or (file.filename or "upload.xlsx")
    upload_url = (
        f"{site}/_api/web/GetFolderByServerRelativeUrl('/{library}/Files')"
        f"/Add(url='{target_name}',overwrite=true)"
    )
    payload = await file.read()
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/octet-stream",
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(upload_url, headers=headers, content=payload)
        if response.status_code >= 400:
            raise api_error(response.status_code, "SharePoint upload failed")
        return {"ok": True}
    except httpx.HTTPError as error:
        raise api_error(502, f"SharePoint upload failed: {error}") from error
