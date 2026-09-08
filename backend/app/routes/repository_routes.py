from __future__ import annotations

from pathlib import Path

import asyncpg
from fastapi import APIRouter, Depends, File, Request, UploadFile

from app.config import FRONTEND_ROOT, settings
from app.database import get_pool
from app.dependencies import api_error, get_current_user, require_admin
from app.repository import (
    REPOSITORY_INDUSTRIES,
    is_allowed_repository_file,
    list_repository_files,
    safe_repository_name,
)

router = APIRouter()


def repository_file_list(industry: str) -> list[dict]:
    return list_repository_files(
        industry,
        public_dirs=[
            FRONTEND_ROOT / "public" / "repository",
            FRONTEND_ROOT / "dist" / "repository",
        ],
        upload_dir=settings.upload_dir / "repository",
    )


@router.get("/api/repository/{industry}/files")
async def list_files(industry: str, user: dict = Depends(get_current_user)):
    if industry not in REPOSITORY_INDUSTRIES:
        raise api_error(404, "Unknown industry")
    return {"files": repository_file_list(industry)}


@router.post("/api/repository/{industry}/files")
async def upload_file(
    industry: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    require_admin(user)
    if industry not in REPOSITORY_INDUSTRIES:
        raise api_error(404, "Unknown industry")
    if not file.filename or not is_allowed_repository_file(file.filename, file.content_type or ""):
        raise api_error(400, "Use a PDF or PowerPoint file")
    name = safe_repository_name(file.filename)
    dest_dir = settings.upload_dir / "repository" / industry
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / name
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise api_error(400, "Could not upload that file")
    dest_path.write_bytes(data)
    return {
        "file": {
            "name": name,
            "url": f"/uploads/repository/{industry}/{name.replace(' ', '%20')}",
            "kind": "pdf" if name.lower().endswith(".pdf") else "pptx",
            "source": "uploaded",
            "size": len(data),
        }
    }


@router.delete("/api/repository/{industry}/files")
async def delete_file(
    industry: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    require_admin(user)
    if industry not in REPOSITORY_INDUSTRIES:
        raise api_error(404, "Unknown industry")
    try:
        body = await request.json()
    except Exception:
        body = {}
    name = safe_repository_name(body.get("name"))
    file_path = settings.upload_dir / "repository" / industry / name
    if file_path.is_file():
        file_path.unlink()
    return {"ok": True}
