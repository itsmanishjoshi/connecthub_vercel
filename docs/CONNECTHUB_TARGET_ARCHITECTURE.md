# ConnectHub Target Architecture

Keep the existing stack. Do not introduce Kubernetes, Redis, Kafka, or a rewrite.

## Principle

```
                 CONNECTHUB
                      |
           -----------------------
           |                     |
       Frontend              Express API
           |                     |
           |              Auth / AI / Files
           |                     |
           ----------------------+
                                 |
                            PostgreSQL
                                 |
                         Disk file storage
                    (later: MinIO if needed)
```

## Keep

- Vite + React SPA
- Express single process (API + optional static `dist/`)
- PostgreSQL as the only database
- HMAC bearer + bcrypt
- `localDbClient` query shape (rename from `supabase` over time, do not break callers)
- `aiRouter` as the only LLM entry
- Browser STT until an office STT service exists
- Docker Compose: `app` + `db`

## Separate cleanly (incremental, not a rewrite)

| Concern | Today | Target |
|---------|--------|--------|
| UI | pages + components | same; no DB in components |
| Data | `supabase.from` shim | keep shim; new code uses named services |
| Auth | `auth.js` + `/api/auth` | same |
| AI | `aiRouter.complete({ task })` | same; add `LLM_PROVIDER` pin + optional fallbacks |
| STT | browser | `SpeechToTextProvider` interface later |
| Files | local disk | `UPLOAD_DIR`; path-only in Postgres |
| Config | scattered `process.env` | `.env.example` + Docker env only |

## AI

Application code calls `complete({ task, ... })` only.

Default: one configured provider per task. Multi-provider fallback only when `AI_FALLBACK=1` (office can leave it on if they have several keys).

Future private models: add a provider that talks to an internal OpenAI-compatible URL. No cloud-only types.

## Speech

Keep browser STT. When the office adds Whisper/on-prem STT, implement `SpeechToTextProvider` behind the same conversation pipeline:

Audio → STT → transcript segments → analyze → insights.

Do not invent speakers, facts, or deadlines.

## Storage

- Postgres: metadata and text
- Disk: images and conversation audio
- Do not store large blobs in Postgres

## AuthZ

- Private tables: force `user_id`
- Events: list only public + owned + granted
- Attendees / insights: only for accessible events
- Uploads: auth on write; tighten read over time (signed paths)

## Deploy

Office LAN, configurable `APP_URL` / `ALLOWED_ORIGINS` / `PORT`. Works behind a reverse proxy without code changes.

## Out of scope

Python Cherry backend, Supabase RLS, Vercel, client-side AI keys.
