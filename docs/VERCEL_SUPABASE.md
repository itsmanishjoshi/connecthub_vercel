# Deploy ConnectHub on Vercel + Supabase + Grok

Use this when the office server is VPN-only and you need access from anywhere.

**Stack**

| Piece | Service |
|-------|---------|
| UI + API routing | **Vercel** (one project, two services) |
| Database | **Supabase Postgres** (`DATABASE_URL` only) |
| AI (Jelly) | **xAI Grok** (`GROK_API_KEY`) or **Groq** (`GROQ_API_KEY`) |

The browser still talks to `/api` on your Vercel domain. Supabase is **Postgres only** — the app does not use Supabase Auth or Supabase Storage SDKs.

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

5. Copy the same `DATABASE_URL` into Vercel env vars (step 3 below).

**Import existing data (events, people, photos):** see [exports/README.md](../exports/README.md). Run `npm run db:export` against your source database, then paste or `psql` the generated `exports/connecthub-dump.sql` into Supabase. Attendee `.png`/`.jpg` photos are embedded as database bytes; event images become inline `data:image/...` URLs.

---

## 2. Grok API key

1. Sign up at [console.x.ai](https://console.x.ai).
2. Create an API key.
3. In Vercel env:

```env
AI_PROVIDER=grok
GROK_API_KEY=your-xai-key
GROK_MODEL=grok-2-1212
```

**Groq alternative** (faster/cheaper for chat):

```env
AI_PROVIDER=groq
GROQ_API_KEY=your-groq-key
GROQ_MODEL=llama-3.3-70b-versatile
```

Provider auto-order if `AI_PROVIDER` is empty: **Groq → OpenRouter → Gemini → Mistral → Grok** (first with keys wins).

---

## 3. Vercel project setup

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
| `NODE_ENV` | Yes | `production` |
| `ALLOWED_ORIGINS` | Yes | `https://your-project.vercel.app` |
| `AI_PROVIDER` | Yes | `grok` or `groq` |
| `GROK_API_KEY` | If using Grok | |
| `GROQ_API_KEY` | If using Groq | |
| `UPLOAD_DIR` | Recommended | `/tmp/connecthub-uploads` on Vercel |

**Do not** set `VITE_API_URL` — leave empty so the UI uses same-origin `/api`.

**Do not** put DB or AI keys in any `VITE_*` variable.

5. Deploy.

---

## 4. Verify

```text
https://your-project.vercel.app/api/health
```

Expect:

```json
{
  "application": "ok",
  "database": "ok",
  "ai": "configured",
  "aiProviders": ["grok"]
}
```

Login → open an event → Jelly **Brief me** → add a note.

---

## 5. Limitations on Vercel

| Feature | Status |
|---------|--------|
| Login, events, attendees, notes | Works with Supabase |
| Jelly chat (Grok/Groq) | Works |
| Voice recording | Needs **HTTPS** (Vercel provides this) |
| Event / avatar **uploads** | **Ephemeral** on Vercel — files may disappear after redeploy. Re-upload images or use office/Docker for production file storage. |
| Heavy document ingest | Works if Grok/Groq model supports it; vision quality varies by model |

---

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build asks for `vercel.json` | Ensure repo root has `vercel.json` (included in latest `master`) |
| `database: error` | Check Supabase URI, password encoding (`@` → `%40`), `sslmode=require` |
| `ai: missing` | Set `GROK_API_KEY` + `AI_PROVIDER=grok` on Vercel backend env |
| App exits on deploy | Set `ALLOWED_ORIGINS` to your exact Vercel URL |
| Login works, no data | Run `migrate` + `seed` against Supabase URL |
| Gray event images | Uploads not persistent on Vercel — re-upload after deploy |

---

## 7. Local test with same stack

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
