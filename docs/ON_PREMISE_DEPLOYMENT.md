# On-premise deployment

ConnectHub runs on the office LAN. No Supabase. No Vercel.

## 1. Server requirements

- Linux or Windows with Docker Desktop
- 2+ CPU, 4 GB RAM minimum (8 GB if several people use Jelly/voice)
- 20+ GB disk (Postgres + uploads + images)

## 2. Docker

- Docker Engine 24+ and Docker Compose v2
- From the repo root (`d:\My Prototypes\ConnectHub` or the folder that contains `docker-compose.yml`):

```powershell
copy .env.docker.example .env
# edit .env — set POSTGRES_PASSWORD, AUTH_SECRET, ADMIN_PASSWORD, API keys
docker compose up --build -d
```

## 3. PostgreSQL

Compose starts Postgres 16. Data lives in volume `connecthub_pg`.

Without Docker: install Postgres 16, create DB/user, set `DATABASE_URL` in `backend/.env`, then:

```powershell
npm install --prefix frontend
pip install -r backend/requirements.txt
npm run build
npm run db:migrate
npm run db:seed
npm run office
```

## 4. Environment variables

See `.env.docker.example` and `backend/.env.example`.

Required in production:

- `DATABASE_URL`
- `AUTH_SECRET` (long random; keep it stable or everyone must log in again)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- `ALLOWED_ORIGINS` if the UI is on a different origin than the API (comma-separated)

Optional AI keys stay on the **server** only: `GROQ_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, `TAVILY_API_KEY`.

Never set `VITE_*` API keys.

## 5. Network

- Office users open `http://<server-ip>:8080` (or the port in `OFFICE_PORT`)
- Bind is `0.0.0.0` so LAN clients work
- No internet required for login, events, people, notes
- Internet required only for cloud LLMs / Tavily / fetching photo URLs

## 6. Ports

| Port | Service |
|------|---------|
| 8080 | App (API + UI) in Docker / `--serve` |
| 5432 | Postgres (Compose: internal only unless you publish it) |

## 7. Reverse proxy

Put nginx/Caddy in front if you want a hostname or HTTPS. Proxy `/` and `/api` and `/uploads` to `http://127.0.0.1:8080`. Set `ALLOWED_ORIGINS` to the public origin (e.g. `https://connecthub.office.local`).

## 8. HTTPS

Use an internal CA or office certificate on the proxy. The Node app can stay HTTP on localhost.

## 9. Backup

From the repo root:

```powershell
.\scripts\backup-postgres.ps1
```

Or:

```powershell
docker compose exec db pg_dump -U connecthub_user connecthub > backup-YYYYMMDD.sql
docker compose exec app tar -C /data -cf - uploads > uploads-YYYYMMDD.tar
```

Schedule this daily on the office server.

## 10. Restore

```powershell
docker compose exec -T db psql -U connecthub_user connecthub < backup-YYYYMMDD.sql
docker compose exec -T app tar -C /data -xf - < uploads-YYYYMMDD.tar
```

## 11. Update

```powershell
git pull
docker compose up --build -d
```

Entrypoint runs migrations then seed (seed only upserts the admin user).

## 12. Rollback

Keep the previous image tag or git commit. `docker compose down` then check out the old commit and `up --build`. Restore DB dump if a migration is incompatible.

## 13. Logs

```powershell
docker compose logs -f app
docker compose logs -f db
```

Do not log API keys or passwords.

## 14. Health

- `GET /api/health` — app, database, storage, whether AI keys exist
- `GET /api/ready` — 200 only if the database answers

Docker uses `/api/health`.

## 15. Troubleshooting

| Symptom | Check |
|---------|--------|
| Container restart loop | `AUTH_SECRET` empty with `--serve`; DB not healthy; see `docker compose logs app` |
| Login fails after recreate | `AUTH_SECRET` changed |
| Blank UI | Hard-refresh; PWA cache; confirm `dist/` built |
| AI “not configured” | Keys in Compose env, not in a browser `.env` |
| Photos missing | Volume `connecthub_uploads` not mounted |
| Private event unlocks with blank PIN | Upgrade to the build that rejects empty PINs |
