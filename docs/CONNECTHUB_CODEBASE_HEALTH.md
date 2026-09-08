# ConnectHub Codebase Health

Inspected: 2 September 2026. This describes the **actual** running stack, not the old Supabase/Vercel path.

## 1. Architecture

ConnectHub is a Vite + React SPA and a Node Express API that talks to PostgreSQL. The browser never calls Groq/Gemini/Mistral/OpenRouter directly. The Python `ConnectHub/backend` (Cherry) is **not wired** and must not be treated as production.

```
Browser (React SPA)
    |  Bearer token (HMAC)
    v
Express (ConnectHub/server/index.js)
    |-- /api/auth/*          custom users table
    |-- /api/db              Supabase-shaped query proxy
    |-- /api/ai/*            LLM + Tavily
    |-- /api/conversations   analyze
    |-- /api/events/*/people ingest
    |-- /api/storage         files
    v
PostgreSQL + local disk uploads
```

- **Frontend:** `ConnectHub/src` — pages, Jelly chatbot, Conversation Intelligence, event/people UI.
- **Backend:** `ConnectHub/server` — one Express process. In office/Docker mode it also serves `dist/`.
- **Database:** `init-schema.sql` + `ConnectHub/migrations/*.sql` via `scripts/db.mjs`.
- **Auth:** bcrypt passwords, HMAC bearer (`connecthub_token`), 7-day expiry. No Supabase Auth.
- **AI:** `server/aiRouter.js` routes chat / analyze / extract / vision across Groq, Gemini, Mistral, OpenRouter.
- **Speech:** browser Web Speech API + term correction. No server STT yet.
- **Storage:** `server/uploads` or `/data/uploads` in Docker. Audio metadata in Postgres, files on disk.
- **Docker:** repo-root `Dockerfile` + `docker-compose.yml` (app + Postgres 16).
- **Offline:** IndexedDB snapshots + `syncQueue` for notes/statuses.

## 2. Directory structure

| Path | Role |
|------|------|
| `ConnectHub/src/pages` | Landing, EventPage, Settings, Admin, Notes, Profile |
| `ConnectHub/src/components` | UI, Jelly, crop, ingest, attendee cards |
| `ConnectHub/src/lib` | `localDbClient` (exported as `supabase`), auth, events API |
| `ConnectHub/src/services` | notes, sync, conversation, AI helpers |
| `ConnectHub/server` | Express API, AI router, ingest, auth |
| `ConnectHub/migrations` | Incremental SQL after `init-schema.sql` |
| `init-schema.sql` | Base office Postgres schema |
| `ConnectHub/backend` | Unwired Python Cherry — ignore for deploy |
| `ConnectHub/supabase` | Legacy RLS migrations — **do not run** |
| Root `Dockerfile`, `docker-compose.yml` | Office container deploy |

Many `*.md` and `FIX_*.sql` files are leftover from the cloud era.

## 3. Database

**Core tables:** `users`, `user_profiles`, `events`, `event_access_grants`, `attendees`, `attendee_notes`, `attendee_statuses`, `attendee_stages`, `attendee_insights`, `user_notes`, `user_preferences`, `qr_codes`, `gallery_items`, `follow_ups`, `conversations`, `transcript_segments`, `conversation_insights`, `conversation_audio`.

**Relationships:** events → attendees; attendees → notes/statuses/stages/insights; conversations owned by `user_id`, optionally linked to event/attendee; audio files referenced by path.

**Migrations:** `001` multi-user/FKs, `002` client timestamps, `003` conversation intelligence, `004` flexible attendee fields.

**Seed:** admin user only (`ADMIN_USERNAME` / `ADMIN_PASSWORD`). No fictional events.

**Gaps found:**
- `events` SELECT was not scoped (private metadata readable by UUID).
- `attendee_insights` not event-scoped (shared by design, but any user could hit any attendee).
- Missing indexes on `events.created_by`, `event_access_grants.event_id`.
- Conflict detection uses DB `updated_at` while `002` added `client_updated_at`.

## 4. API

Generic pattern: `POST /api/db` with `{ table, action, filters, data }` — table whitelist + `ident()` for columns.

Specialized: login, admin users, event PIN, people extract/commit, conversation analyze, AI chat/search, storage.

Auth on almost everything except `/api/health` and static `/uploads` (except conversation-audio).

Validation is uneven: auth has min password length; `/api/db` trusts column names after regex.

## 5. AI architecture

| Task | First provider | Fallbacks |
|------|----------------|-----------|
| Chat | OpenRouter | Mistral, Gemini, Groq |
| Analyze | Groq | Mistral, OpenRouter, Gemini |
| Extract / vision | Gemini | OpenRouter, Mistral, Groq |

Speech is **browser STT**, not a cloud STT provider. Prompts live in `conversationAI.js` and `peopleIngest.js`. JSON is parsed with `extractJson` (not a formal schema). Automatic multi-provider fallback is always on when keys exist.

## 6. Security (at inspection)

- Server keys in `server/.env` (gitignored). `.env.production` is now placeholders + gitignored.
- HMAC fallback secret `connecthub-dev-only-change-me` if `AUTH_SECRET` unset (blocked when `--serve`).
- CORS allows all origins if `ALLOWED_ORIGINS` is empty (warned in production).
- Uploads (except conversation audio) are still world-readable; writes for avatars/profile pictures are owner/event-scoped.
- `remotePhoto.js` no longer follows redirects; requires image magic bytes.
- Empty PIN on a private event is rejected.
- Unused `localAuthService.ts` (hardcoded password) was removed.
- Event catalog listing is intentionally visible (needed for PIN unlock). Attendees and insights are event-scoped.
- No client `VITE_*` AI keys in live `src`.

## 7. Performance

- Landing/EventPage load full attendee lists client-side (OK for office event sizes; will not scale to tens of thousands).
- People ingest and analyze do per-row SQL loops.
- React Query is installed but unused; many `console.log`s in settings/auth/QR.
- Large unused frontend modules (old chatbots, Excel/notebook stack).

## 8. UX

- Jelly + Conversation Intelligence have decent loading/error copy.
- EventPage empty/error states are strong; Landing shows a retryable load error.
- Event route no longer defaults to slug `machinecon`.
- Mobile: physical `mm`/`cm` offsets, Notes page tab row, Admin table scroll.
- Event photo crop is a fixed 16:9 window; person photos are square.

## 9. Deployment

Required: Docker + Compose, or Node 22 + Postgres 16, env vars (`DATABASE_URL`, `AUTH_SECRET`, admin password, optional AI keys), port 8080 (or `OFFICE_PORT`), persistent upload volume, backups of Postgres.

Must not depend on Supabase, Vercel, or browser-held API keys.

## 10. Remediation applied (2 September 2026)

P0/P1 fixes without a rewrite:

- Scoped `attendee_insights` to attendees on accessible events
- Rejected empty private-event PINs
- Hardened remote photo fetch (no redirect follow, magic bytes, private-host block)
- Neutralized and gitignored `.env.production`
- Removed unused local auth with a hardcoded password
- Added `/api/ready`, access indexes, backup scripts, `db:health`
- EventPage missing-slug and Landing fetch-error states
- Documented target architecture and office deploy

Intentionally not changed: event catalog SELECT (private events must remain listable so users can enter a PIN). Python Cherry backend remains unwired.
