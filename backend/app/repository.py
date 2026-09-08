from __future__ import annotations

import os
from pathlib import Path

REPOSITORY_INDUSTRIES = frozenset({"healthcare", "engineering", "bfsi"})
ALLOWED_EXT = frozenset({"pdf", "ppt", "pptx", "pptm", "png", "jpg", "jpeg", "webp"})


def file_kind_from_name(name: str) -> str:
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext == "pdf":
        return "pdf"
    if ext in ("pptx", "pptm"):
        return "pptx"
    if ext == "ppt":
        return "ppt"
    if ext in ("png", "jpg", "jpeg", "webp", "gif"):
        return "slide"
    return "other"


def is_allowed_repository_file(filename: str, mime: str = "") -> bool:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ALLOWED_EXT:
        return True
    return mime in (
        "application/pdf",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
        "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
    )


def safe_repository_name(original: str) -> str:
    base = Path(str(original or "file")).name
    cleaned = "".join(c if c.isalnum() or c in "._- ()" else "_" for c in base)
    return cleaned or "file"


def _list_folder(dir_path: Path, url_prefix: str, source: str) -> list[dict]:
    if not dir_path.is_dir():
        return []
    files = []
    for entry in sorted(dir_path.iterdir()):
        if not entry.is_file() or not is_allowed_repository_file(entry.name):
            continue
        stat = entry.stat()
        files.append(
            {
                "name": entry.name,
                "url": f"{url_prefix}/{entry.name.replace(' ', '%20')}",
                "kind": file_kind_from_name(entry.name),
                "source": source,
                "size": stat.st_size,
            }
        )
    return files


def list_repository_files(
    industry: str,
    *,
    public_dirs: list[Path],
    upload_dir: Path,
) -> list[dict]:
    packaged: list[dict] = []
    for base in public_dirs:
        packaged.extend(
            _list_folder(base / industry, f"/repository/{industry}", "packaged")
        )
    uploaded = _list_folder(
        upload_dir / "repository" / industry,
        f"/uploads/repository/{industry}",
        "uploaded",
    )
    seen: set[str] = set()
    files: list[dict] = []
    for file in uploaded + packaged:
        key = file["name"].lower()
        if key in seen:
            continue
        seen.add(key)
        files.append(file)
    return sorted(files, key=lambda f: f["name"].lower())
