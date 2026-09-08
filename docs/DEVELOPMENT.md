# Development

## Repository layout

```
frontend/     React 18 + TypeScript + Vite (dev port 3556)
backend/      Python FastAPI + asyncpg (dev port 8000)
docs/         Documentation
scripts/      Setup, backup, and office helper scripts
```

## Prerequisites

- Node.js 18+
- Python 3.10+ (3.9 works with `eval_type_backport`)
- PostgreSQL 14+

## Local run

**Terminal 1 — API**

```powershell
cd backend
copy .env.example .env
pip install -r requirements.txt
python scripts/migrate.py migrate
python scripts/migrate.py seed
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 — UI**

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:3556 (UI) and http://localhost:8000/api/health (API).

Or from the repo root: `npm run dev` (starts both).

## Useful commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Frontend + backend together |
| `npm run build` | Production frontend build |
| `npm run office` | Serve built frontend + API on port 8080 |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:seed` | Seed admin user and sample data |
| `python backend/scripts/smoke_requirements.py` | Smoke-test permissions, privacy, photos |

## Backend scripts

| Script | Purpose |
|--------|---------|
| `backend/scripts/migrate.py` | Migrations and seed |
| `backend/scripts/backfill_photos.py` | Fetch and store attendee photos |
| `backend/scripts/import_photos_from_xlsx.py` | Import photos from Excel |
| `backend/scripts/photo_coverage_report.py` | Report photo coverage for an event |

## Rules

- Do not put API keys in `VITE_*` variables — AI and export logic run on the backend.
- User notes, conversations, and priority flags are private unless the user is an admin.
- Attendee card edits require **Edit** access on the event (admin or granted user).
