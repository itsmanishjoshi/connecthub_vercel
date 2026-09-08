from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse

from dotenv import dotenv_values

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
FRONTEND_ROOT = REPO_ROOT / "frontend"


def _load_env_layers(*paths: Path) -> None:
    """Load env files in order; later files fill keys that are missing or blank."""
    for path in paths:
        if not path.exists():
            continue
        for key, value in dotenv_values(path).items():
            if value is None:
                continue
            current = os.environ.get(key)
            if current is None:
                os.environ[key] = value
            elif value.strip() and not str(current).strip():
                os.environ[key] = value


_load_env_layers(
    BACKEND_ROOT / ".env",
    REPO_ROOT / ".env",
    FRONTEND_ROOT / ".env.local",
    FRONTEND_ROOT / ".env",
)


def _env(name: str, default: str | None = None) -> str | None:
    return os.environ.get(name, default)


class Settings:
    database_url: str = (
        _env("DATABASE_URL")
        or _env("VITE_DATABASE_URL")
        or "postgresql://connecthub_user:connecthub_office_local@localhost:5432/connecthub"
    )
    auth_secret: str = _env("AUTH_SECRET") or "connecthub-dev-only-change-me"
    upload_dir: Path = Path(_env("UPLOAD_DIR") or str(BACKEND_ROOT / "uploads"))
    node_env: str = _env("NODE_ENV") or "development"
    allowed_origins: list[str] = [
        o.strip() for o in (_env("ALLOWED_ORIGINS") or "").split(",") if o.strip()
    ]
    serve_static: bool = (
        _env("SERVE_STATIC") == "1"
        or bool(_env("WEBSITE_SITE_NAME"))
    )
    port: int = int(
        _env("PORT")
        or _env("OFFICE_PORT")
        or (8080 if serve_static else 8000)
    )
    admin_username: str | None = _env("ADMIN_USERNAME")
    admin_password: str | None = _env("ADMIN_PASSWORD")
    admin_email: str = _env("ADMIN_EMAIL") or "admin@connecthub.local"
    pgsslmode: str = (_env("PGSSLMODE") or "").lower()
    pgssl_verify: bool = _env("PGSSL_VERIFY") == "1"

    @property
    def is_production(self) -> bool:
        return self.node_env == "production"

    @property
    def insecure_auth_secret(self) -> bool:
        return not _env("AUTH_SECRET") or self.auth_secret == "connecthub-dev-only-change-me"

    @property
    def private_upload_dir(self) -> Path:
        return self.upload_dir / "private"

    @property
    def ingest_upload_dir(self) -> Path:
        return self.private_upload_dir / "ingest"

    @property
    def frontend_dist(self) -> Path:
        return FRONTEND_ROOT / "dist"

    def pg_ssl_required(self) -> bool | None:
        parsed = urlparse(self.database_url.replace("postgresql://", "https://", 1))
        host = parsed.hostname or ""
        ssl_mode = (parsed.query and dict(q.split("=") for q in parsed.query.split("&") if "=" in q).get("sslmode")) or ""
        ssl_mode = (ssl_mode or self.pgsslmode).lower()
        loopback = not host or host in ("localhost", "127.0.0.1", "::1", "db")
        production_remote = self.is_production and not loopback
        use_ssl = ssl_mode in ("require", "verify-ca", "verify-full") or (
            not ssl_mode and production_remote
        )
        if not use_ssl or ssl_mode == "disable":
            return None
        verify = self.pgssl_verify or ssl_mode in ("verify-ca", "verify-full")
        return verify


settings = Settings()
