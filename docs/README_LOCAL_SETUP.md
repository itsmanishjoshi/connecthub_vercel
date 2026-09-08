# Local and office setup - ConnectHub

For the full local-vs-deployed database guide (ports, tables, env files, and how to switch `DATABASE_URL`), see [LOCAL_AND_DEPLOYED_DATABASE.md](LOCAL_AND_DEPLOYED_DATABASE.md).

ConnectHub is a **React + Vite** frontend with a **Python FastAPI** backend and PostgreSQL. It does not require Supabase or Vercel.

## Project layout

```
frontend/   React 18 + TypeScript + Vite (port 3556 in dev)
backend/    Python FastAPI + asyncpg (port 8000 in dev, 8080 office)
```

## Prerequisites

- Node.js 18+
- Python 3.10+ (3.9 works with `eval_type_backport` from `requirements.txt`)
- PostgreSQL 14+ running on port 5432 (or 5433 for local dev cluster)
- npm

## 1. Automated database setup

Run PowerShell and enter the PostgreSQL installer password, a new application
database password, and a strong initial ConnectHub admin password when asked:

```powershell
cd "d:\My Prototypes\ConnectHub"
powershell -ExecutionPolicy Bypass -File .\scripts\setup-office-postgres.ps1
```

The script creates/updates the application role and database, installs required
extensions, generates `AUTH_SECRET`, and writes server-only configuration.

For manual setup:

```sql
CREATE USER connecthub_user WITH PASSWORD 'your_password';
CREATE DATABASE connecthub OWNER connecthub_user;
```

On PostgreSQL 15+, also:

```sql
GRANT ALL ON SCHEMA public TO connecthub_user;
```

## 2. Environment

```powershell
cd backend
copy .env.example .env
```

Set these in `backend\.env`: `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_USERNAME`,
`ADMIN_PASSWORD`, and `ADMIN_EMAIL`. Database/admin/AI secrets must never be
placed in `VITE_` variables.

Optional: Groq, Grok, OpenRouter, Gemini, or Mistral keys in `backend\.env` for Jelly, conversations, and people import.

## 3. Install, migrate, seed

```powershell
cd frontend
npm install
cd ..\backend
pip install -r requirements.txt
python scripts/migrate.py migrate
python scripts/migrate.py seed
```

Or from the repo root:

```powershell
npm install --prefix frontend
pip install -r backend/requirements.txt
npm run db:migrate
npm run db:seed
```

## 4. Run

```powershell
npm run dev
```

This starts:

- API: `http://localhost:8000` (`GET /api/health`)
- UI: `http://localhost:3556` (Vite dev server proxies `/api` and `/uploads`)

The initial admin login is the username/password configured in `backend\.env`.
The fictional optional demo user is `Priya.Nair` / `Stakeholder@2026`.

## 5. Office host (single process)

```powershell
npm run office
```

Builds the frontend and serves the UI + API from one origin on port 8080. Other office devices
can use `http://THIS-PC-IP:8080` after the Windows firewall permits inbound TCP
8080. Office serving refuses to start without a strong `AUTH_SECRET`. After the
first online visit, the app can be installed and will reopen cached events and
attendees if the network drops. Notes still sync when the connection returns.
For secure internet access, follow `CLOUDFLARE_TUNNEL_SETUP.md`; do not expose
PostgreSQL.

## Commands

| Script | Purpose |
| ------ | ------- |
| `npm run dev` | Python API + Vite |
| `npm run db:migrate` | Apply the base schema and ordered migrations |
| `npm run db:seed` | Demo users/events/attendees |
| `npm run db:reset` | Drop public schema, migrate, seed |
| `npm run office` | Production-style local host |
| `npm test` | Frontend sync/conflict unit tests |

Useful root scripts:

- `scripts/health-check.bat`
- `scripts/backup-connecthub.ps1` (PostgreSQL dump, SHA-256 checksum, and upload files)
- `scripts/restore-connecthub.ps1` (verifies checksum, writes a pre-restore safety dump, then restores DB and uploads)
- `scripts/install-office-startup.ps1` (run as Administrator after building)

AI provider keys in `backend/.env` are optional. The event/attendee app
works when AI is unconfigured.
