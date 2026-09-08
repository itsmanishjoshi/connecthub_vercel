# ConnectHub — Deployment team runbook

Fast reference for DevOps. App = **React frontend + Python FastAPI + PostgreSQL**.

**Repository:** `https://coresync.e-zest.in/manish.joshi/connecthub.git`  
**Branch:** `master`

---

## Environment files (where secrets go)

| Purpose | File path | Template |
|--------|-----------|----------|
| **Docker / production (primary)** | **`.env`** at **repo root** | Copy from **`.env.docker.example`** |
| **Backend-only / manual run** | **`backend/.env`** | Copy from **`backend/.env.example`** |
| **Optional shared secrets** | **`.env`** at **repo root** | Same keys as above; loaded after `backend/.env` and **fills blank values** |

**Load order in the backend:** `backend/.env` → repo root `.env` → `frontend/.env.local` (dev only).

> **Never commit** `.env`, `backend/.env`, or any file containing passwords or API keys.

### Minimum required variables

Set these in **repo root `.env`** for Docker, or in **`backend/.env`** for manual deploy:

```env
DATABASE_URL=postgresql://connecthub_user:PASSWORD@HOST:5432/connecthub
AUTH_SECRET=<long-random-string-32+chars>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong-password>
ADMIN_EMAIL=admin@yourcompany.com

# Required for Jelly chat, Brief me, voice analysis, document ingest
AI_PROVIDER=groq
GROQ_API_KEY=<key>
# Or: GROK_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY
```

**Optional but recommended:**

```env
ALLOWED_ORIGINS=https://your-hostname.example.com
OFFICE_PORT=8080
```

**Password in URL:** encode `@` as `%40`. Remote Postgres often needs `?sslmode=require` on `DATABASE_URL`.

**Do not put API keys in `VITE_*` variables** — AI runs on the server only.

---

## First-time deploy (Docker — recommended)

From the server, in the repo root (folder containing `docker-compose.yml`):

```powershell
git clone https://coresync.e-zest.in/manish.joshi/connecthub.git
cd connecthub
copy .env.docker.example .env
# Edit .env — set DATABASE_URL or POSTGRES_PASSWORD, AUTH_SECRET, ADMIN_*, GROQ_API_KEY (or other AI key)
docker compose up --build -d
```

**Using external Postgres (already provisioned):**

1. Set `DATABASE_URL` in root `.env`.
2. Deploy app only (skip waiting on bundled DB if you know connectivity is fine):

```powershell
docker compose up --build -d app
```

**Open app:** `http://<server-ip>:8080` (or your `OFFICE_PORT`).

**Expected time:** first build **10–15 min**; later redeploys **5–10 min**.

---

## Redeploy / update (routine)

```powershell
cd connecthub
git pull origin master
docker compose up --build -d
```

Verify:

```powershell
curl http://127.0.0.1:8080/api/health
curl http://127.0.0.1:8080/api/ready
```

Health should show:

- `"application": "ok"`
- `"database": "ok"`
- `"storage": "ok"`
- `"ai": "configured"` ← required for Jelly chat

**Downtime:** usually **30–60 seconds** while the app container restarts.  
Entrypoint runs **`migrate`** then **`seed`** automatically (seed only upserts admin).

---

## Manual deploy (no Docker)

Use when running directly on the host.

```powershell
git pull origin master
copy backend\.env.example backend\.env
# Edit backend\.env (and/or root .env for AI keys)

pip install -r backend\requirements.txt
npm install --prefix frontend
npm run build
npm run db:migrate
npm run db:seed

# Production: serve UI + API on one port
npm run office
# Or API only:
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Serve `frontend/dist` behind nginx/IIS and proxy **`/api`** and **`/uploads`** to the backend.

---

## Reverse proxy (nginx / IIS / Caddy)

Proxy these paths to the app (default port **8080**):

| Path | Backend |
|------|---------|
| `/` | App (static UI) |
| `/api` | FastAPI |
| `/uploads` | Uploaded files (event images, avatars, audio) |

Set **`ALLOWED_ORIGINS`** to the public browser origin, e.g.:

```env
ALLOWED_ORIGINS=https://connecthub.office.local,http://192.168.1.50:8080
```

**HTTPS:** terminate TLS at the proxy. **Voice recording in Jelly requires HTTPS** in the browser (`getUserMedia`).

---

## Persistent data (do not wipe on redeploy)

| Data | Docker volume / path |
|------|----------------------|
| PostgreSQL | Volume `connecthub_pg` |
| Uploads (event photos, avatars, voice) | Volume `connecthub_uploads` → `/data/uploads` in container |

**Event card images** are files under `/uploads/event-images/`, not in the DB. If DB is remote but uploads are local (or vice versa), images will 404 — keep DB and uploads on the same deployment or sync the uploads folder.

### Backup (quick)

```powershell
docker compose exec db pg_dump -U connecthub_user connecthub > backup-YYYYMMDD.sql
docker compose exec app tar -C /data -cf - uploads > uploads-YYYYMMDD.tar
```

Or from repo root: `.\scripts\backup-postgres.ps1`

---

## Logs & debugging

```powershell
docker compose logs -f app
docker compose logs -f db
docker compose ps
```

| Symptom | Fix |
|---------|-----|
| Jelly: *"Chat needs an AI key"* | Set `GROQ_API_KEY` (or `GROK_API_KEY`, etc.) in **`.env`**, restart app |
| Login fails after container recreate | `AUTH_SECRET` changed — users must log in again; keep `AUTH_SECRET` stable |
| Login: *Unexpected end of JSON input* | API not reachable; check proxy and that app is up on 8080 |
| Event images gray / missing | File missing in `uploads/event-images/`; re-upload or restore uploads volume |
| Notes fail on HTTP LAN | Deploy latest frontend build (UUID fix for non-HTTPS) |
| `database: error` in health | Check `DATABASE_URL`, firewall, Postgres SSL |
| Container restart loop | `docker compose logs app` — usually DB not ready or bad `DATABASE_URL` |

Full health check script (optional):

```powershell
.\scripts\health-check.bat
```

Backend smoke test (on server, after deploy):

```powershell
cd backend
python scripts/smoke_full_check.py
# Uses http://127.0.0.1:8001 by default; set SMOKE_API_BASE=http://127.0.0.1:8080 for Docker
```

---

## Security checklist

- [ ] Strong `AUTH_SECRET`, `ADMIN_PASSWORD`, `POSTGRES_PASSWORD`
- [ ] `.env` not in git
- [ ] `ALLOWED_ORIGINS` set in production
- [ ] HTTPS for production / voice
- [ ] Uploads volume backed up with DB
- [ ] AI keys only on server, never in frontend env

---

## Quick reference

| Item | Value |
|------|--------|
| Default app port | `8080` (`OFFICE_PORT`) |
| Dev UI port | `3556` |
| Dev API port | `8000` |
| Health | `GET /api/health` |
| Ready | `GET /api/ready` |
| Admin login | Values from `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env` |
| Migrations | Auto in Docker entrypoint; manual: `npm run db:migrate` |

**Related docs:** [ON_PREMISE_DEPLOYMENT.md](./ON_PREMISE_DEPLOYMENT.md) · [LOCAL_AND_DEPLOYED_DATABASE.md](./LOCAL_AND_DEPLOYED_DATABASE.md) · [SECURITY.md](./SECURITY.md)
