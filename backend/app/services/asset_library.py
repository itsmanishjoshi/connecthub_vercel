from __future__ import annotations

import re
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import asyncpg
from fastapi import APIRouter, File, Form, Query, Request, UploadFile
from fastapi.responses import JSONResponse, Response, StreamingResponse

from app.config import settings
from app.auth import read_bearer, verify_token

GCC_ASSET_FOLDERS = [
    {"name": "01. Master Template", "color": "teal"},
    {"name": "02. Corporate & Capability Decks", "color": "purple"},
    {"name": "03. Global Capability Center", "color": "magenta"},
    {"name": "04. Frameworks & Blueprints", "color": "blue"},
    {"name": "05. Case Studies & Success Stories", "color": "green"},
    {"name": "06. Blogs", "color": "yellow"},
    {"name": "07. Clients", "color": "emerald"},
    {"name": "08. Research", "color": "grey"},
    {"name": "09. Sales Campaign", "color": "rose"},
    {"name": "10. Brochure", "color": "red"},
    {"name": "11. Marketing", "color": "orange"},
    {"name": "12. Videos", "color": "sky"},
]

ROLE_RANK = {"view": 1, "edit": 2, "manage": 3}
DB_STORE_MAX = 8 * 1024 * 1024
MAX_UPLOAD = 80 * 1024 * 1024

ALLOWED_EXT = frozenset(
    {
        "pdf",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "csv",
        "ppt",
        "pptx",
        "pptm",
        "png",
        "jpg",
        "jpeg",
        "webp",
        "gif",
        "mp4",
        "webm",
        "mov",
        "m4v",
        "mp3",
        "wav",
        "m4a",
    }
)

MIGRATION_SQL = Path(__file__).resolve().parents[2] / "migrations" / "008_asset_library.sql"


def kind_from_name(name: str, mime: str = "") -> str:
    ext = name.rsplit(".", 1)[-1].lower() if "." in str(name) else ""
    type_lower = str(mime).lower()
    if ext == "pdf" or "pdf" in type_lower:
        return "pdf"
    if ext in ("doc", "docx") or "word" in type_lower or "msword" in type_lower:
        return "word"
    if ext in ("xls", "xlsx", "csv") or "excel" in type_lower or "spreadsheet" in type_lower:
        return "excel"
    if ext in ("ppt", "pptx", "pptm") or "powerpoint" in type_lower or "presentation" in type_lower:
        return "ppt"
    if type_lower.startswith("image/") or ext in ("png", "jpg", "jpeg", "webp", "gif"):
        return "image"
    if type_lower.startswith("video/") or ext in ("mp4", "webm", "mov", "m4v"):
        return "video"
    if type_lower.startswith("audio/") or ext in ("mp3", "wav", "m4a"):
        return "audio"
    return "other"


def is_allowed_asset_file(name: str, mime: str = "") -> bool:
    ext = name.rsplit(".", 1)[-1].lower() if "." in str(name) else ""
    return ext in ALLOWED_EXT or kind_from_name(name, mime) != "other"


def safe_asset_name(original: str | None) -> str:
    base = Path(str(original or "file")).name
    cleaned = re.sub(r"[^\w.\- ()]", "_", base).strip()
    return cleaned[:180] or "file"


def item_public(row: asyncpg.Record | dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    data = dict(row)
    return {
        "id": data["id"],
        "library_id": data["library_id"],
        "folder_id": data["folder_id"],
        "name": data["name"],
        "mime": data["mime"],
        "kind": data["kind"],
        "size_bytes": int(data.get("size_bytes") or 0),
        "storage": data["storage"],
        "created_at": data["created_at"],
        "updated_at": data["updated_at"],
        "created_by": data["created_by"],
    }


def _rank(role: str | None) -> int:
    return ROLE_RANK.get(role or "", 0)


def _role_name(rank_value: int) -> str:
    for key, value in ROLE_RANK.items():
        if value == rank_value:
            return key
    return "view"


def _require_role(got: str | None, need: str) -> bool:
    return _rank(got) >= _rank(need)


def _error(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"message": message}})


def _uuid_str(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


async def ensure_asset_library(pool: asyncpg.Pool) -> None:
    if MIGRATION_SQL.is_file():
        await pool.execute(MIGRATION_SQL.read_text(encoding="utf-8"))

    libraries = [
        {
            "slug": "gcc-assets",
            "name": "Repository",
            "kind": "assets",
            "description": "Corporate decks, case studies, brochures, and videos",
            "sort": 0,
        },
        {
            "slug": "healthcare",
            "name": "Healthcare",
            "kind": "industry",
            "description": "Healthcare pitch room and files",
            "sort": 1,
        },
        {
            "slug": "engineering",
            "name": "Engineering",
            "kind": "industry",
            "description": "Engineering pitch room and files",
            "sort": 2,
        },
        {
            "slug": "bfsi",
            "name": "BFSI",
            "kind": "industry",
            "description": "BFSI pitch room and files",
            "sort": 3,
        },
    ]
    for lib in libraries:
        await pool.execute(
            """INSERT INTO asset_libraries (slug, name, kind, description, sort_order)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (slug) DO UPDATE
               SET name = EXCLUDED.name,
                   description = EXCLUDED.description,
                   sort_order = EXCLUDED.sort_order""",
            lib["slug"],
            lib["name"],
            lib["kind"],
            lib["description"],
            lib["sort"],
        )

    library_id = await pool.fetchval(
        "SELECT id FROM asset_libraries WHERE slug = 'gcc-assets'"
    )
    existing = await pool.fetchval(
        "SELECT COUNT(*)::int FROM asset_folders WHERE library_id = $1 AND parent_id IS NULL",
        library_id,
    )
    if existing == 0:
        for index, folder in enumerate(GCC_ASSET_FOLDERS):
            await pool.execute(
                """INSERT INTO asset_folders (library_id, name, color, sort_order)
                   VALUES ($1, $2, $3, $4)""",
                library_id,
                folder["name"],
                folder["color"],
                index,
            )


async def _folder_ancestors(pool: asyncpg.Pool, folder_id: Any) -> list[Any]:
    ids: list[Any] = []
    current = folder_id
    while current:
        ids.append(current)
        parent_id = await pool.fetchval(
            "SELECT parent_id FROM asset_folders WHERE id = $1",
            current,
        )
        current = parent_id
    return ids


async def asset_role(
    pool: asyncpg.Pool,
    user: dict[str, Any],
    library_id: Any,
    folder_id: Any = None,
) -> str | None:
    if user.get("is_admin"):
        return "manage"

    library = await pool.fetchrow(
        "SELECT restricted FROM asset_libraries WHERE id = $1",
        library_id,
    )
    if not library:
        return None

    grants = await pool.fetch(
        "SELECT folder_id, role FROM asset_access WHERE library_id = $1 AND user_id = $2",
        library_id,
        user["id"],
    )
    best = 0
    ancestors = await _folder_ancestors(pool, folder_id) if folder_id else []
    ancestor_ids = {_uuid_str(item) for item in ancestors}
    folder_key = _uuid_str(folder_id)

    for grant in grants:
        grant_folder = grant["folder_id"]
        if (
            grant_folder is None
            or _uuid_str(grant_folder) == folder_key
            or _uuid_str(grant_folder) in ancestor_ids
        ):
            best = max(best, _rank(grant["role"]))

    if best >= _rank("view"):
        return _role_name(best)
    if not library["restricted"]:
        return "edit"
    return None


async def _library_by_slug(pool: asyncpg.Pool, slug: str) -> asyncpg.Record | None:
    return await pool.fetchrow("SELECT * FROM asset_libraries WHERE slug = $1", slug)


def register_asset_routes(router: APIRouter, pool: asyncpg.Pool, upload_dir: str | Path) -> None:
    from app.dependencies import get_current_user

    from fastapi import Body, Depends

    upload_path = Path(upload_dir)
    tmp_dir = upload_path / "assets-tmp"
    assets_dir = upload_path / "assets"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    assets_dir.mkdir(parents=True, exist_ok=True)

    @router.get("/api/assets/libraries")
    async def list_libraries(user: dict[str, Any] = Depends(get_current_user)):
        rows = await pool.fetch(
            """SELECT id, slug, name, kind, description, restricted, sort_order
                 FROM asset_libraries
                ORDER BY sort_order, name"""
        )
        libraries: list[dict[str, Any]] = []
        for row in rows:
            role = await asset_role(pool, user, row["id"], None)
            if role:
                libraries.append({**dict(row), "role": role})
        return {"libraries": libraries}

    @router.get("/api/assets/people")
    async def search_people(
        q: str = Query(""),
        user: dict[str, Any] = Depends(get_current_user),
    ):
        query = f"%{q.strip()}%"
        rows = await pool.fetch(
            """SELECT u.id, u.username, u.email, p.first_name, p.last_name
                 FROM users u
                 LEFT JOIN user_profiles p ON p.user_id = u.id
                WHERE u.deleted_at IS NULL
                  AND ($1 = '%%' OR u.username ILIKE $1
                       OR COALESCE(p.first_name, '') ILIKE $1
                       OR COALESCE(p.last_name, '') ILIKE $1)
                ORDER BY u.username
                LIMIT 20""",
            query,
        )
        return {"people": [dict(row) for row in rows]}

    @router.get("/api/assets/libraries/{slug}/contents")
    async def library_contents(
        slug: str,
        folderId: str | None = Query(None),
        user: dict[str, Any] = Depends(get_current_user),
    ):
        library = await _library_by_slug(pool, slug)
        if not library:
            return _error(404, "Library not found")

        role = await asset_role(pool, user, library["id"], folderId)
        if not _require_role(role, "view"):
            return _error(403, "You do not have access to this library")

        if folderId:
            folders = await pool.fetch(
                """SELECT id, library_id, parent_id, name, color, sort_order, created_at, updated_at
                     FROM asset_folders
                    WHERE library_id = $1 AND parent_id = $2
                    ORDER BY sort_order, name""",
                library["id"],
                folderId,
            )
            items = await pool.fetch(
                """SELECT id, library_id, folder_id, name, mime, kind, size_bytes, storage,
                          created_at, updated_at, created_by
                     FROM asset_items
                    WHERE library_id = $1 AND folder_id = $2
                    ORDER BY name""",
                library["id"],
                folderId,
            )
        else:
            folders = await pool.fetch(
                """SELECT id, library_id, parent_id, name, color, sort_order, created_at, updated_at
                     FROM asset_folders
                    WHERE library_id = $1 AND parent_id IS NULL
                    ORDER BY sort_order, name""",
                library["id"],
            )
            items = await pool.fetch(
                """SELECT id, library_id, folder_id, name, mime, kind, size_bytes, storage,
                          created_at, updated_at, created_by
                     FROM asset_items
                    WHERE library_id = $1 AND folder_id IS NULL
                    ORDER BY name""",
                library["id"],
            )

        crumbs: list[dict[str, Any]] = [{"id": None, "name": library["name"]}]
        if folderId:
            ancestors: list[asyncpg.Record] = []
            current: Any = folderId
            while current:
                found = await pool.fetchrow(
                    "SELECT id, parent_id, name FROM asset_folders WHERE id = $1",
                    current,
                )
                if not found:
                    break
                ancestors.insert(0, found)
                current = found["parent_id"]
            crumbs.extend({"id": row["id"], "name": row["name"]} for row in ancestors)

        return {
            "library": {**dict(library), "role": role},
            "folderId": folderId,
            "breadcrumbs": crumbs,
            "folders": [dict(row) for row in folders],
            "items": [item_public(row) for row in items],
        }

    @router.post("/api/assets/libraries/{slug}/folders", status_code=201)
    async def create_folder(
        slug: str,
        body: dict[str, Any] = Body(...),
        user: dict[str, Any] = Depends(get_current_user),
    ):
        library = await _library_by_slug(pool, slug)
        if not library:
            return _error(404, "Library not found")

        parent_id = body.get("parentId") or None
        role = await asset_role(pool, user, library["id"], parent_id)
        if not _require_role(role, "edit"):
            return _error(403, "You can view this library, but you cannot add folders")

        name = str(body.get("name") or "").strip()[:120]
        if not name:
            return _error(400, "Folder name is required")

        row = await pool.fetchrow(
            """INSERT INTO asset_folders (library_id, parent_id, name, color, created_by)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING *""",
            library["id"],
            parent_id,
            name,
            body.get("color") or "blue",
            user["id"],
        )
        return JSONResponse(status_code=201, content={"folder": dict(row)})

    @router.patch("/api/assets/folders/{folder_id}")
    async def rename_folder(
        folder_id: UUID,
        body: dict[str, Any] = Body(...),
        user: dict[str, Any] = Depends(get_current_user),
    ):
        folder = await pool.fetchrow("SELECT * FROM asset_folders WHERE id = $1", folder_id)
        if not folder:
            return _error(404, "Folder not found")

        role = await asset_role(pool, user, folder["library_id"], folder["id"])
        if not _require_role(role, "edit"):
            return _error(403, "You cannot rename this folder")

        name = str(body.get("name") or "").strip()[:120]
        if not name:
            return _error(400, "Folder name is required")

        updated = await pool.fetchrow(
            "UPDATE asset_folders SET name = $2, updated_at = NOW() WHERE id = $1 RETURNING *",
            folder["id"],
            name,
        )
        return {"folder": dict(updated)}

    @router.delete("/api/assets/folders/{folder_id}")
    async def delete_folder(
        folder_id: UUID,
        user: dict[str, Any] = Depends(get_current_user),
    ):
        folder = await pool.fetchrow("SELECT * FROM asset_folders WHERE id = $1", folder_id)
        if not folder:
            return _error(404, "Folder not found")

        role = await asset_role(pool, user, folder["library_id"], folder["id"])
        if not _require_role(role, "edit"):
            return _error(403, "You cannot delete this folder")

        await pool.execute("DELETE FROM asset_folders WHERE id = $1", folder["id"])
        return {"ok": True}

    @router.post("/api/assets/libraries/{slug}/items", status_code=201)
    async def upload_item(
        slug: str,
        file: UploadFile = File(...),
        folderId: str | None = Form(None),
        user: dict[str, Any] = Depends(get_current_user),
    ):
        try:
            library = await _library_by_slug(pool, slug)
            if not library:
                return _error(404, "Library not found")

            role = await asset_role(pool, user, library["id"], folderId or None)
            if not _require_role(role, "edit"):
                return _error(403, "You cannot upload here")

            if not file.filename:
                return _error(400, "Choose a file")

            body = await file.read()
            if len(body) > MAX_UPLOAD:
                return _error(400, "Upload failed")

            name = safe_asset_name(file.filename)
            mime = file.content_type or "application/octet-stream"
            if not is_allowed_asset_file(name, mime):
                return _error(400, "Use PDF, Word, Excel, PowerPoint, photo, or video")

            kind = kind_from_name(name, mime)
            size = len(body)
            use_disk = size > DB_STORE_MAX or kind in ("video", "audio")
            item_id = uuid4()
            storage = "db"
            content: bytes | None = None
            disk_path: str | None = None

            if use_disk:
                storage = "disk"
                ext = Path(name).suffix
                disk_path = f"assets/{item_id}{ext}"
                final_path = upload_path / disk_path
                final_path.parent.mkdir(parents=True, exist_ok=True)
                final_path.write_bytes(body)
            else:
                content = body

            row = await pool.fetchrow(
                """INSERT INTO asset_items
                    (id, library_id, folder_id, name, mime, kind, size_bytes, storage,
                     content, disk_path, created_by, updated_by)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
                   RETURNING id, library_id, folder_id, name, mime, kind, size_bytes, storage,
                             created_at, updated_at, created_by""",
                item_id,
                library["id"],
                folderId or None,
                name,
                mime,
                kind,
                size,
                storage,
                content,
                disk_path,
                user["id"],
            )
            return JSONResponse(status_code=201, content={"item": item_public(row)})
        except Exception as fail:
            print(f"asset upload {fail}")
            return _error(500, "Could not save that file")

    @router.patch("/api/assets/items/{item_id}")
    async def rename_item(
        item_id: UUID,
        body: dict[str, Any] = Body(...),
        user: dict[str, Any] = Depends(get_current_user),
    ):
        item = await pool.fetchrow("SELECT * FROM asset_items WHERE id = $1", item_id)
        if not item:
            return _error(404, "File not found")

        role = await asset_role(pool, user, item["library_id"], item["folder_id"])
        if not _require_role(role, "edit"):
            return _error(403, "You cannot rename this file")

        name = safe_asset_name(body.get("name") or item["name"])
        updated = await pool.fetchrow(
            """UPDATE asset_items
                  SET name = $2, updated_by = $3, updated_at = NOW()
                WHERE id = $1
                RETURNING id, library_id, folder_id, name, mime, kind, size_bytes, storage,
                          created_at, updated_at, created_by""",
            item["id"],
            name,
            user["id"],
        )
        return {"item": item_public(updated)}

    @router.delete("/api/assets/items/{item_id}")
    async def delete_item(
        item_id: UUID,
        user: dict[str, Any] = Depends(get_current_user),
    ):
        item = await pool.fetchrow("SELECT * FROM asset_items WHERE id = $1", item_id)
        if not item:
            return _error(404, "File not found")

        role = await asset_role(pool, user, item["library_id"], item["folder_id"])
        if not _require_role(role, "edit"):
            return _error(403, "You cannot delete this file")

        if item["disk_path"]:
            full = upload_path / item["disk_path"]
            if full.is_file():
                full.unlink()

        await pool.execute("DELETE FROM asset_items WHERE id = $1", item["id"])
        return {"ok": True}

    @router.get("/api/assets/items/{item_id}/content")
    async def item_content(
        item_id: UUID,
        request: Request,
        download: str = Query("0"),
    ):
        token = read_bearer(request)
        if not token and not settings.is_production:
            token = request.query_params.get("access_token")
        session = verify_token(token)
        if not session:
            return Response(status_code=401)

        user = await pool.fetchrow(
            """SELECT id, username, email, is_admin, is_first_login, status, password_changed
                 FROM users
                WHERE id = $1 AND deleted_at IS NULL AND status <> 'dead'
                LIMIT 1""",
            session["sub"],
        )
        if not user:
            return Response(status_code=401)

        item = await pool.fetchrow(
            """SELECT id, library_id, folder_id, name, mime, kind, size_bytes, storage,
                      content, disk_path
                 FROM asset_items
                WHERE id = $1""",
            item_id,
        )
        if not item:
            return Response(status_code=404)

        role = await asset_role(pool, dict(user), item["library_id"], item["folder_id"])
        if not _require_role(role, "view"):
            return Response(status_code=403)

        mime = item["mime"] or "application/octet-stream"
        filename = str(item["name"]).replace('"', "")
        disposition = "attachment" if download == "1" else "inline"
        headers = {
            "Content-Disposition": f'{disposition}; filename="{filename}"',
        }

        if item["storage"] == "disk" and item["disk_path"]:
            full = upload_path / item["disk_path"]
            if not full.is_file():
                return Response(status_code=404)

            file_size = full.stat().st_size
            range_header = request.headers.get("range")
            if range_header and item["kind"] == "video":
                match = re.match(r"bytes=(\d+)-(\d*)", range_header)
                if match:
                    start = int(match.group(1))
                    end = int(match.group(2)) if match.group(2) else file_size - 1
                    end = min(end, file_size - 1)
                    content_length = end - start + 1

                    def iter_range() -> Any:
                        with full.open("rb") as handle:
                            handle.seek(start)
                            remaining = content_length
                            while remaining > 0:
                                chunk = handle.read(min(65536, remaining))
                                if not chunk:
                                    break
                                remaining -= len(chunk)
                                yield chunk

                    headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"
                    headers["Accept-Ranges"] = "bytes"
                    headers["Content-Length"] = str(content_length)
                    return StreamingResponse(
                        iter_range(),
                        status_code=206,
                        media_type=mime,
                        headers=headers,
                    )

            headers["Content-Length"] = str(file_size)
            headers["Accept-Ranges"] = "bytes"

            def iter_file() -> Any:
                with full.open("rb") as handle:
                    while True:
                        chunk = handle.read(65536)
                        if not chunk:
                            break
                        yield chunk

            return StreamingResponse(iter_file(), media_type=mime, headers=headers)

        bytes_data = item["content"]
        if not bytes_data:
            return Response(status_code=404)

        headers["Content-Length"] = str(len(bytes_data))
        return Response(content=bytes_data, media_type=mime, headers=headers)

    @router.get("/api/assets/libraries/{slug}/access")
    async def list_access(
        slug: str,
        folderId: str | None = Query(None),
        user: dict[str, Any] = Depends(get_current_user),
    ):
        library = await _library_by_slug(pool, slug)
        if not library:
            return _error(404, "Library not found")

        role = await asset_role(pool, user, library["id"], folderId)
        if not _require_role(role, "manage"):
            return _error(403, "Only managers can see sharing")

        grants = await pool.fetch(
            """SELECT a.id, a.user_id, a.folder_id, a.role, a.granted_at,
                      u.username, p.first_name, p.last_name
                 FROM asset_access a
                 JOIN users u ON u.id = a.user_id
                 LEFT JOIN user_profiles p ON p.user_id = u.id
                WHERE a.library_id = $1
                ORDER BY u.username""",
            library["id"],
        )
        return {"restricted": library["restricted"], "grants": [dict(row) for row in grants]}

    @router.patch("/api/assets/libraries/{slug}/access")
    async def patch_access(
        slug: str,
        body: dict[str, Any] = Body(...),
        user: dict[str, Any] = Depends(get_current_user),
    ):
        library = await _library_by_slug(pool, slug)
        if not library:
            return _error(404, "Library not found")

        role = await asset_role(pool, user, library["id"], None)
        if not _require_role(role, "manage"):
            return _error(403, "Only managers can change sharing")

        if isinstance(body.get("restricted"), bool):
            await pool.execute(
                "UPDATE asset_libraries SET restricted = $2 WHERE id = $1",
                library["id"],
                body["restricted"],
            )
        return {"ok": True}

    @router.post("/api/assets/libraries/{slug}/access")
    async def grant_access(
        slug: str,
        body: dict[str, Any] = Body(...),
        user: dict[str, Any] = Depends(get_current_user),
    ):
        library = await _library_by_slug(pool, slug)
        if not library:
            return _error(404, "Library not found")

        folder_id = body.get("folderId") or None
        role = await asset_role(pool, user, library["id"], folder_id)
        if not _require_role(role, "manage"):
            return _error(403, "Only managers can give access")

        grant_role = body.get("role") if body.get("role") in ROLE_RANK else "view"
        user_id = body.get("userId")
        if not user_id:
            return _error(400, "Choose a person")

        await pool.execute(
            """DELETE FROM asset_access
                WHERE library_id = $1 AND user_id = $2
                  AND folder_id IS NOT DISTINCT FROM $3""",
            library["id"],
            user_id,
            folder_id,
        )
        await pool.execute(
            """INSERT INTO asset_access (library_id, folder_id, user_id, role, granted_by)
               VALUES ($1, $2, $3, $4, $5)""",
            library["id"],
            folder_id,
            user_id,
            grant_role,
            user["id"],
        )
        return {"ok": True}

    @router.delete("/api/assets/access/{access_id}")
    async def revoke_access(
        access_id: UUID,
        user: dict[str, Any] = Depends(get_current_user),
    ):
        grant = await pool.fetchrow("SELECT * FROM asset_access WHERE id = $1", access_id)
        if not grant:
            return _error(404, "Share not found")

        role = await asset_role(pool, user, grant["library_id"], grant["folder_id"])
        if not _require_role(role, "manage"):
            return _error(403, "Only managers can remove access")

        await pool.execute("DELETE FROM asset_access WHERE id = $1", grant["id"])
        return {"ok": True}
