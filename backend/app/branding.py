from __future__ import annotations

import os
import subprocess
from pathlib import Path

from app.config import FRONTEND_ROOT


def branding_paths(app_root: Path | None = None) -> dict[str, Path]:
    root = app_root or FRONTEND_ROOT
    public = root / "public"
    return {
        "connectHub": public / "connecthub-logo.png",
        "jellySource": public / "jelly - logo.png",
        "jelly": public / "jelly-logo.png",
        "prepare": root / "scripts" / "prepare-jelly-logo.py",
    }


def refresh_jelly_logo(app_root: Path | None = None) -> None:
    paths = branding_paths(app_root)
    jelly_source = paths["jellySource"]
    jelly = paths["jelly"]
    prepare = paths["prepare"]
    if not jelly_source.exists() or not prepare.exists():
        return
    source_time = jelly_source.stat().st_mtime
    dest_time = jelly.stat().st_mtime if jelly.exists() else 0
    if source_time <= dest_time:
        return
    for cmd in (["python", str(prepare)], ["py", "-3", str(prepare)]):
        try:
            subprocess.run(cmd, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            break
        except OSError:
            continue
