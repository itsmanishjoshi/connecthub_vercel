# ConnectHub: local run, local database, and switching to a deployed database

This is the single reference for:

- how to run ConnectHub on a developer or office machine
- which PostgreSQL database localhost uses
- what data lives where
- how to point the same app at a deployed (office / production) database
- exactly which files and variables to change

ConnectHub does **not** talk to Supabase or Vercel. The browser talks only to the Express API. Express is the only process that opens PostgreSQL.

```
Browser (Vite or dist/)  -->  Express (ConnectHub/server/index.js)  -->  PostgreSQL
                                 |
                                 +--> disk: ConnectHub/server/uploads
```

Never put `DATABASE_URL` or admin passwords in `VITE_` variables. Those are baked into the frontend bundle.

---

## 1. What you install

| Piece | Role |
| ----- | ---- |
| Node.js 18+ | Frontend (Vite/React) and API (Express) |
| PostgreSQL 14+ (16 recommended) | Application database named `connecthub` |
| npm | Dependencies |

Optional: Docker Desktop, if you run Postgres and the app with `docker compose` from the repo root.

Repo layout:

- App and API: `ConnectHub/`
- API entry: `ConnectHub/server/index.js`
- Server secrets: `ConnectHub/server/.env`
- Frontend env (no DB password): `ConnectHub/.env.local`
- Schema: `init-schema.sql` (repo root) plus `ConnectHub/migrations/*.sql`

---

## 2. Which database localhost uses

The API reads **one** connection string:

`DATABASE_URL`

Load order (first file that exists wins for a given key, later files do not override an already-set value from the process environment):

1. Process environment (`$env:DATABASE_URL` in PowerShell)
2. `ConnectHub/server/.env`
3. `ConnectHub/.env.local`
4. `ConnectHub/.env`

If none of those set `DATABASE_URL`, the code falls back to:

```
postgresql://connecthub_user:connecthub_office_local@localhost:5432/connecthub
```

That fallback is **not** your live office database. Always set `DATABASE_URL` explicitly.

### 2.1 Standard local Postgres (port 5432)

Typical URL:

```
postgresql://connecthub_user:YOUR_PASSWORD@127.0.0.1:5432/connecthub
```

| Field | Meaning |
| ----- | ------- |
| User | `connecthub_user` |
| Database name | `connecthub` |
| Host | `127.0.0.1` or `localhost` |
| Port | `5432` (default Postgres) |

Create the role and database once:

```sql
CREATE USER connecthub_user WITH PASSWORD 'YOUR_PASSWORD';
CREATE DATABASE connecthub OWNER connecthub_user;
GRANT ALL ON SCHEMA public TO connecthub_user;
```

Or run `setup-office-postgres.ps1` from the repo root (it writes `ConnectHub/server/.env`).

### 2.2 Docker Compose (office stack)

From the **repo root** (`d:\My Prototypes\ConnectHub`):

- Postgres 16 runs **inside** Docker as service `db`.
- Inside the compose network the URL is:

```
postgresql://connecthub_user:POSTGRES_PASSWORD@db:5432/connecthub
```

- Compose does **not** publish Postgres to the Windows host by default. Node on the host cannot use `localhost:5432` unless you also install Postgres on Windows, or you add a `ports:` mapping on the `db` service.
- App users open `http://THIS-PC-IP:8080` (or `OFFICE_PORT` from the root `.env`).
- Data volume: Docker volume `connecthub_pg`.
- Uploads volume: `connecthub_uploads`.

Copy `.env.docker.example` to `.env` at the repo root. Set `POSTGRES_PASSWORD`, `AUTH_SECRET`, `ADMIN_PASSWORD`. Then:

```powershell
docker compose up --build -d
```

### 2.3 Host Node + Docker Postgres on a mapped port

If Postgres is in Docker but Express runs on Windows (this is a common office-dev setup), you must publish Postgres, for example `55432:5432`. Then:

```
postgresql://connecthub_user:YOUR_PASSWORD@127.0.0.1:55432/connecthub
```

Set that in `ConnectHub/server/.env` **or** only for one session:

```powershell
cd "d:\My Prototypes\ConnectHub\ConnectHub"
$env:DATABASE_URL='postgresql://connecthub_user:YOUR_PASSWORD@127.0.0.1:55432/connecthub'
$env:OFFICE_PORT='3556'
node server/index.js --serve
```

A process environment variable overrides `server/.env`. If login or events look "empty", you are almost certainly pointed at a **different** Postgres than the one you migrated.

Confirm on startup. The API prints a redacted URL:

```
ConnectHub local API on http://0.0.0.0:PORT
Database: postgresql://connecthub_user:****@127.0.0.1:PORT/connecthub
```

### 2.4 How to see what the running API is using

```powershell
cd "d:\My Prototypes\ConnectHub\ConnectHub"
npm run db:health
```

That uses the same `DATABASE_URL` resolution as migrate/seed.

---

## 3. How to run locally

Do this from `ConnectHub/` (the inner app folder) unless a command says repo root.

### 3.1 First-time setup

```powershell
cd "d:\My Prototypes\ConnectHub\ConnectHub"
copy .env.example .env.local
copy server\.env.example server\.env
```

Edit `server\.env` at least:

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | Postgres connection |
| `AUTH_SECRET` | Signs login tokens. Keep it stable. Changing it logs everyone out. Office `--serve` refuses a weak/empty secret. |
| `ADMIN_USERNAME` | First admin account |
| `ADMIN_PASSWORD` | First admin password |
| `ADMIN_EMAIL` | Admin profile email |
| `PORT` | API port in `npm run dev` (default `3001`) |
| `OFFICE_PORT` | Combined UI+API port for `--serve` (default `8080`) |

Optional AI keys (server only): `GROQ_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, `TAVILY_API_KEY`.

Frontend `ConnectHub/.env.local`:

```
VITE_USE_LOCAL_DB=true
VITE_API_URL=
VITE_SITE_URL=http://localhost:8080
```

Leave `VITE_API_URL` empty for local Vite (it proxies `/api` and `/uploads` to `http://127.0.0.1:3001`). Set it only when the UI is hosted on a **different origin** than the API.

Install and create tables:

```powershell
cd "d:\My Prototypes\ConnectHub\ConnectHub"
npm install
cd server
npm install
cd ..
npm run db:migrate
npm run db:seed
```

- `db:migrate` applies `init-schema.sql` plus `ConnectHub/migrations/` in name order.
- `db:seed` creates **only** the admin user and admin profile. It does **not** insert sample events or people.

### 3.2 Daily developer run (two processes)

```powershell
cd "d:\My Prototypes\ConnectHub\ConnectHub"
npm run dev
```

| Process | URL |
| ------- | --- |
| API | `http://localhost:3001` (`GET /api/health`) |
| UI | `http://localhost:8080` (Vite; `/api` proxied to 3001) |

Log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

After UI changes, Vite hot-reloads. After **server** JS or `.env` changes, restart Node.

### 3.3 Office / LAN run (one process, production-style)

Build the frontend, then serve `dist/` from Express:

```powershell
cd "d:\My Prototypes\ConnectHub\ConnectHub"
npx vite build
node server/index.js --serve
```

Or `npm run office` (that script currently runs `tsc && vite build`; if `tsc` fails, use `npx vite build` then `node server/index.js --serve`).

| Setting | Default | Override |
| ------- | ------- | -------- |
| Listen | `0.0.0.0` | n/a |
| Port | `8080` | `OFFICE_PORT` in `server/.env` or `$env:OFFICE_PORT` |

Office PCs open `http://THIS-PC-IP:PORT`. After UI changes you must rebuild `dist/` and hard-refresh (**Ctrl+Shift+R**) because of the PWA cache.

### 3.4 Useful commands

| Command | What it does |
| ------- | ------------ |
| `npm run db:migrate` | Create/upgrade tables on the DB in `DATABASE_URL` |
| `npm run db:seed` | Upsert admin user only |
| `npm run db:reset` | **Destroys** public schema, then migrate + seed |
| `npm run db:health` | Ping the configured database |
| `npm test` | API and sync tests |

Backups from repo root: `backup-connecthub.ps1` (Postgres dump + `server/uploads` zip). Restore: `restore-connecthub.ps1`.

---

## 4. What data the local database has

### 4.1 After migrate + seed only

| Data | Present? |
| ---- | -------- |
| Schema (tables, indexes, FKs) | Yes |
| Admin user | Yes (`ADMIN_USERNAME`) |
| Admin profile | Yes |
| Events | **No** |
| Attendees | **No** |
| Notes, conversations, recordings | **No** |

Seed log line: `User accounts ready. No sample events or people were added.`

### 4.2 After you use the app

Everything created in the UI is stored in **this** Postgres:

- Events (name, slug, date, place, picture URL, privacy, door code)
- Attendees (name, company, designation, city, insights, ice breakers, photos, extra_data)
- Event access (who can view vs edit)
- Your private notes, status tags, stages
- Conversations, transcripts, conversation insights, audio metadata
- User accounts and profiles
- Follow-ups, gallery items, notebook pages, preferences, QR rows

Photos and ingest files are **not** inside Postgres. They sit under:

`ConnectHub/server/uploads/`

The `profile_pic_url` / event picture fields store paths such as `/uploads/...`. If you switch databases but keep the old `uploads` folder, pictures still resolve. If you switch databases **and** machines without copying `uploads`, pictures 404.

### 4.3 Tables (schema + migrations)

From `init-schema.sql` and `ConnectHub/migrations/`:

| Table | Holds |
| ----- | ----- |
| `users` | Login accounts, password hashes, admin flag |
| `user_profiles` | Display name, company, designation |
| `events` | Event directory |
| `event_access_grants` | Per-user view/edit on an event |
| `attendees` | People on an event, including `city`, `location`, `key_insights`, `ice_breakers`, `extra_data` |
| `attendee_notes` | Private notes per user per person |
| `attendee_statuses` | Tags (high priority, follow-up, and so on) |
| `attendee_stages` | Stage per user per person |
| `attendee_insights` | Shared directory brief |
| `conversations` | Voice/chat capture sessions |
| `transcript_segments` | Transcript lines |
| `conversation_insights` | Extracted follow-ups, pain points, and so on |
| `conversation_audio` | Recording metadata |
| `follow_ups` | Follow-up rows |
| `gallery_items` | Gallery |
| `notes` / `user_notes` | Notebook |
| `user_preferences` | Settings |
| `qr_codes` | Profile QR |
| `schema_migrations` | Which SQL files already ran |

### 4.4 What is **not** in Postgres

| Store | What |
| ----- | ---- |
| Browser `localStorage` | Login token, cached offline snapshot, some status/note cache |
| `ConnectHub/server/uploads` | Profile photos, event pictures, ingest files |
| PWA cache | Built JS/CSS; why office users must hard-refresh after a build |
| AI providers | Jelly answers are generated at request time; they are not a second database |

Jelly reads **whatever this API's `DATABASE_URL` contains**. If you ask for an engineering AI case study, it can only find it if that file/text is in this database or in a window that is actually implemented. Repository / Teams / Clients / Meeting rooms on the home page are **closed (coming soon)** and have no tables yet.

### 4.5 Inspect data

```powershell
# Example: native psql on 5432
psql "postgresql://connecthub_user:YOUR_PASSWORD@127.0.0.1:5432/connecthub" -c "SELECT name, slug FROM events;"
psql "postgresql://connecthub_user:YOUR_PASSWORD@127.0.0.1:5432/connecthub" -c "SELECT name, company, city FROM attendees;"
```

Use the same host/port as `DATABASE_URL`.

---

## 5. When to use the deployed database

Use a **deployed** (office or production) database when:

- Several people must see the **same** events and people
- You are serving the office host and must not use a laptop-only Postgres
- You are restoring from a backup onto the office server
- You are promoting a tested schema to the shared instance

Keep using **local** Postgres when:

- You are developing UI/API and do not want to touch live people data
- You are trying ingest, migrations, or `db:reset`

Never run `npm run db:reset` against the deployed database. It drops the public schema.

---

## 6. Switching from local DB to deployed DB (exact changes)

You do **not** change React components or `src/lib/supabaseClient.ts`. That client already calls Express (`/api/db`). You only change **where Express connects**.

### 6.1 Files to edit

| File | Change |
| ---- | ------ |
| `ConnectHub/server/.env` | Set `DATABASE_URL` to the deployed Postgres URL. Keep or align `AUTH_SECRET`, `ADMIN_*`, `ALLOWED_ORIGINS`, `APP_URL`, `OFFICE_PORT`. |
| Repo root `.env` | **Only** if you run Docker Compose. Set `POSTGRES_PASSWORD` (compose builds `DATABASE_URL` for you). Do not commit this file. |
| `ConnectHub/.env.local` | Usually **no** `DATABASE_URL`. If the UI is on another host than the API, set `VITE_API_URL=https://your-api-origin` (no trailing slash) and rebuild. |
| PowerShell session | Optional override: `$env:DATABASE_URL='...'` for one run only. |

Do **not** put the deployed password in `ConnectHub/.env.example` or git.

### 6.2 Deployed URL shapes

Office Postgres on the same machine as Node:

```
postgresql://connecthub_user:DEPLOYED_PASSWORD@127.0.0.1:5432/connecthub
```

Postgres on another office server:

```
postgresql://connecthub_user:DEPLOYED_PASSWORD@OFFICE-DB-HOST:5432/connecthub
```

Docker Compose app talking to Compose Postgres (inside the stack):

```
postgresql://connecthub_user:POSTGRES_PASSWORD@db:5432/connecthub
```

(That last form is set automatically in `docker-compose.yml`. You set `POSTGRES_PASSWORD` in the root `.env`, not `DATABASE_URL`, unless you override compose.)

SSL (some hosted Postgres):

```
postgresql://USER:PASSWORD@HOST:5432/connecthub?sslmode=require
```

### 6.3 Other variables that must match the deployed world

| Variable | Why |
| -------- | --- |
| `AUTH_SECRET` | Tokens minted on machine A are invalid on machine B if secrets differ. Use the **same** secret as the office host if users keep their sessions. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Seed upserts this admin on **that** database. It does not copy local events. |
| `ALLOWED_ORIGINS` | Required if the browser origin is not the API origin (comma-separated, e.g. `http://10.0.0.12:8080`). |
| `APP_URL` | Public origin if you generate absolute links. |
| `UPLOAD_DIR` | Leave empty for `ConnectHub/server/uploads`, or set a shared disk path on the office server. |
| `OFFICE_PORT` | LAN port for `--serve` / Docker publish. |

### 6.4 Steps on the deployed database (first time)

1. Create role + database `connecthub` (or start Compose).
2. Point `DATABASE_URL` at it.
3. From `ConnectHub/`:

```powershell
npm run db:migrate
npm run db:seed
```

4. Restart the API (`node server/index.js` or `node server/index.js --serve` or `docker compose up -d`).
5. Log in. You should see **that** database's events, not your laptop's, unless you restored a dump.

### 6.5 Copying local data to deployed

Dump local, restore deployed (passwords and hosts are yours):

```powershell
pg_dump -h 127.0.0.1 -p 5432 -U connecthub_user -d connecthub -F c -f connecthub_local.dump
pg_restore -h DEPLOYED_HOST -p 5432 -U connecthub_user -d connecthub --clean --if-exists connecthub_local.dump
```

Copy `ConnectHub/server/uploads` to the office `UPLOAD_DIR` or the Compose volume.

Prefer the repo scripts `backup-connecthub.ps1` / `restore-connecthub.ps1` when you want checksums and a pre-restore safety dump.

### 6.6 Switching back to localhost

1. Set `DATABASE_URL` back to `127.0.0.1` and the local port (`5432` or your Docker map).
2. Restart Node.
3. Confirm the startup log host/port.
4. Hard-refresh the browser so it does not reuse an old token against the wrong user table (`AUTH_SECRET` / user ids can differ).

### 6.7 Frontend rebuild when API origin changes

If people open the UI from Vite (`localhost:8080`) against a remote API:

```
VITE_API_URL=http://OFFICE-IP:8080
```

Then `npx vite build` (or `npm run dev` for local Vite). Empty `VITE_API_URL` means same origin (correct for `--serve` and Docker).

---

## 7. Checklist: "am I on the DB I think I am?"

1. Read the API console line `Database: postgresql://...@HOST:PORT/connecthub`.
2. `npm run db:health` in the same shell (same env).
3. Log in. Event list should match `SELECT name FROM events;` on that URL.
4. If events vanished after a restart, you switched `DATABASE_URL` or the process env override expired.
5. If pictures vanished, `uploads` was not copied or `UPLOAD_DIR` is wrong.
6. If everyone is logged out, `AUTH_SECRET` changed.

---

## 8. Architecture notes (so the switch stays small)

- `src/lib/supabaseClient.ts` is a name only. It uses `localDbClient.ts` -> `POST /api/db`.
- Vite `vite.config.ts` proxies `/api` and `/uploads` to `127.0.0.1:3001` in `npm run dev`.
- `--serve` and Docker serve `dist/` and `/api` from **one** port. No proxy.
- Home page windows (Repository, Teams, Clients, Meeting rooms) are UI placeholders. They do not have databases yet. Events are live in the `events` / `attendees` tables.

---

## 9. Security

- Do not commit `ConnectHub/server/.env`, root `.env`, or dumps with live data.
- Do not expose PostgreSQL on the internet. Expose only the HTTP app port, or a reverse proxy with HTTPS.
- Office `--serve` needs a strong `AUTH_SECRET`.
- AI keys stay on the server.

---

## 10. Related files (do not split this guide)

| Path | Use |
| ---- | --- |
| `ConnectHub/server/.env.example` | Template for API secrets |
| `ConnectHub/.env.example` | Template including frontend flags |
| `.env.docker.example` | Compose at repo root |
| `docker-compose.yml` | Office Docker stack |
| `init-schema.sql` | Base tables |
| `ConnectHub/migrations/` | Incremental SQL |
| `ConnectHub/scripts/db.mjs` | migrate / seed / reset / health |
| `ON_PREMISE_DEPLOYMENT.md` | LAN / Docker / backup overview |
| `README_LOCAL_SETUP.md` | Short command list |
