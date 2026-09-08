# Deploy ConnectHub on Vercel + Supabase + Grok

Use this when the office server is VPN-only and you need access from anywhere.

**Stack**

| Piece | Service |
|-------|---------|
| UI + API routing | **Vercel** (one project, two services) |
| Database | **Supabase Postgres** (`DATABASE_URL`) + **Storage** (large Excel ingest) |
| AI (Jelly) | **Azure OpenAI** (`AZURE_OPENAI_*`) |

The browser still talks to `/api` on your Vercel domain. Supabase is **Postgres + Storage for large Excel ingest** — the app does not use Supabase Auth or the Supabase JS SDK in the browser.

---

## 1. Supabase database

1. Create a project at [supabase.com](https://supabase.com).
2. **Settings → Database → Connection string → URI** (Session pooler, port **6543**).
3. Append `?sslmode=require` if not present.
4. From your laptop (once):

```powershell
cd backend
$env:DATABASE_URL="postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres?sslmode=require"
python scripts/migrate.py migrate
python scripts/migrate.py seed
```

5. Copy the same `DATABASE_URL` into Vercel env vars (step 4 below).

**Import existing data (events, people, photos):** see [exports/README.md](../exports/README.md). Run `npm run db:export` against your source database, then paste or `psql` the generated `exports/connecthub-dump.sql` into Supabase. Attendee `.png`/`.jpg` photos are embedded as database bytes; event images become inline `data:image/...` URLs.

---

## 2. Supabase Storage (large Excel photo import)

Large speaker rosters with embedded photos (often 15–50 MB) cannot pass through Vercel’s ~4 MB API upload limit. ConnectHub uploads those files **directly to Supabase Storage**, then the backend downloads and imports photos into Postgres.

1. In Supabase Dashboard → **Project Settings → API**, copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (backend only — never expose as `VITE_*`)
2. Add both to **Vercel → Environment Variables** (Production + Preview).
3. The backend auto-creates a private bucket `ingest-uploads` on first use (max **100 MB** per file by default).
4. After deploy, confirm `/api/health` includes `"ingestStorage": { "configured": true, ... }`.

**User flow on Vercel:** Stage 1 reads roster text in the browser → Save selected people → **Import photos from Excel** uploads the large `.xlsx` to Supabase Storage, then imports embedded photos into attendee records.

---

## 3. Azure OpenAI

1. In [Azure Portal](https://portal.azure.com), open your Azure OpenAI resource.
2. Copy the **endpoint** and **API key** from Keys and Endpoint.
3. Confirm deployment names (e.g. `gpt-4o`).
4. In Vercel env:

```env
AI_PROVIDER=azure
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_VERSION=2025-01-01-preview
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_LITE_DEPLOYMENT=gpt-4o
AZURE_OPENAI_EXTRACT_DEPLOYMENT=gpt-4o
AZURE_OPENAI_VISION_DEPLOYMENT=gpt-4o
```

Remove any old `GROQ_*`, `GROK_*`, `OPENROUTER_*`, `GEMINI_*`, or `MISTRAL_*` variables from Vercel.

---

## 4. Vercel project setup

1. Import git repo: `https://coresync.e-zest.in/manish.joshi/connecthub.git`
2. **Root Directory:** `./` (repo root — `vercel.json` is already there)
3. Preset: **Services** (frontend Vite + backend FastAPI)
4. **Environment Variables** (Production + Preview) — copy from [`.env.vercel.example`](../.env.vercel.example):

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Supabase pooler URI |
| `AUTH_SECRET` | Yes | Long random string; keep stable |
| `ADMIN_USERNAME` | Yes | |
| `ADMIN_PASSWORD` | Yes | |
| `ADMIN_EMAIL` | Yes | |
| `SUPABASE_URL` | For large Excel photo import | Project URL from Supabase API settings |
| `SUPABASE_SERVICE_ROLE_KEY` | For large Excel photo import | service_role key (server only) |
| `NODE_ENV` | Yes | `production` |
| `ALLOWED_ORIGINS` | Yes | `https://your-project.vercel.app` |
| `AI_PROVIDER` | Yes | `azure` |
| `AZURE_OPENAI_API_KEY` | Yes | From Azure Portal |
| `AZURE_OPENAI_ENDPOINT` | Yes | e.g. `https://your-resource.openai.azure.com` |
| `AZURE_OPENAI_API_VERSION` | Yes | e.g. `2025-01-01-preview` |
| `AZURE_OPENAI_DEPLOYMENT` | Yes | e.g. `gpt-4o` |
| `UPLOAD_DIR` | Recommended | `/tmp/connecthub-uploads` on Vercel |

**Do not** set `VITE_API_URL` — leave empty so the UI uses same-origin `/api`.

**Do not** put DB or AI keys in any `VITE_*` variable.

5. Deploy.

---

## 5. Verify

```text
https://your-project.vercel.app/api/health
```

Expect:

```json
{
  "application": "ok",
  "database": "ok",
  "ai": "configured",
  "aiProviders": ["azure"]
}
```

Login → open an event → Jelly **Brief me** → add a note.

---

## 6. Limitations on Vercel

| Feature | Status |
|---------|--------|
| Login, events, attendees, notes | Works with Supabase |
| Jelly chat (Azure OpenAI) | Works |
| Voice recording | Needs **HTTPS** (Vercel provides this) |
| Event / avatar **uploads** | **Ephemeral** on Vercel — files may disappear after redeploy. Re-upload images or use office/Docker for production file storage. |
| Large Excel **photo** import | Works when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set |

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build asks for `vercel.json` | Ensure repo root has `vercel.json` (included in latest `master`) |
| `database: error` | Check Supabase URI, password encoding (`@` → `%40`), `sslmode=require` |
| `ai: missing` | Set `GROK_API_KEY` + `AI_PROVIDER=grok` on Vercel backend env |
| App exits on deploy | Set `ALLOWED_ORIGINS` to your exact Vercel URL |
| Login works, no data | Run `migrate` + `seed` against Supabase URL |
| Photo import fails on large Excel | Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; check `/api/health` → `ingestStorage.configured` |
| Cloud upload failed (CORS) | Supabase → Storage → Configuration → add your Vercel URL to allowed origins |

---

## 8. Local test with same stack

```powershell
copy .env.vercel.example .env
# Edit DATABASE_URL, GROK_API_KEY, ALLOWED_ORIGINS=http://127.0.0.1:3556

cd backend
python scripts/migrate.py migrate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001

cd frontend
npm run dev
```

---

See also: [DEPLOYMENT_TEAM.md](./DEPLOYMENT_TEAM.md) for office/Docker deploy.
