# ConnectHub SQL exports

Generated files for Supabase / Vercel Postgres import.

| File | Purpose |
|------|---------|
| `connecthub-schema-only.sql` | **Tables only** — paste into Supabase SQL Editor on an empty project |
| `connecthub-dump.sql` | **Schema + all data + embedded photos** — generate locally (see below) |

## Generate full dump (with .png / .jpg photos embedded)

1. Point `DATABASE_URL` in `backend/.env` at the database that has your events and people (local or office VPN).

2. From repo root:

```powershell
npm run db:export
```

Output: `exports/connecthub-dump.sql`

The script:
- Creates all tables (if `--mode full`, default)
- Exports every row
- Embeds **attendee photos** in `attendees.profile_pic` (BYTEA)
- Converts **event images** from `backend/uploads/event-images/` into `data:image/...;base64,...` URLs
- Embeds **avatars** and **asset library** images when found on disk

## Import into Supabase

**Option A — SQL Editor (small dumps only, under ~5 MB)**

1. Supabase → **SQL Editor** → New query
2. Paste `connecthub-schema-only.sql` → Run (if database is empty)
3. Paste `connecthub-dump.sql` data section, or run full dump if it fits

**Option B — psql (recommended for large dumps with many photos)**

```powershell
$env:DATABASE_URL="postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres?sslmode=require"
psql $env:DATABASE_URL -f exports/connecthub-dump.sql
```

**Option C — schema via migrate, then data only**

```powershell
cd backend
$env:DATABASE_URL="your-supabase-uri"
python scripts/migrate.py migrate
python scripts/migrate.py seed
python scripts/export_supabase_sql.py --mode data --output ../exports/connecthub-data-only.sql
```

Then import `connecthub-data-only.sql` in Supabase.

## After import

Set Vercel env `DATABASE_URL` to the same Supabase URI and deploy.

Verify: `https://your-app.vercel.app/api/health` → `"database": "ok"`
