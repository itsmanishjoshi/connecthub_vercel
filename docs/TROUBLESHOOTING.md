# Troubleshooting (local ConnectHub)

## PostgreSQL not running

Windows: Services → `postgresql-x64-*` → Start. Or `Get-Service postgresql*`

## `db:migrate` / `db:seed` fails with password authentication

Set `DATABASE_URL` in `ConnectHub/server/.env` to a user that can connect. First-time database creation may need the `postgres` superuser (`setup-office-postgres.ps1`).

## `CREATE EXTENSION` permission denied

Run `setup-office-postgres.ps1`; it installs extensions using the PostgreSQL
administrator before the app role applies migrations.

## Login: Invalid username or password

Confirm `ADMIN_USERNAME` and `ADMIN_PASSWORD` exist in `server/.env`, then run
`npm run db:seed`. Clear site localStorage if an old session exists. A
deactivated user is intentionally rejected immediately, including existing
sessions.

## UI loads but events are empty / network errors to `/api/db`

Start both processes: `npm run dev` (not `vite` alone). Check `http://localhost:3001/api/health`.

## Health `database: error`

Wrong `DATABASE_URL`, Postgres not listening on 5432, or user has no access to database `connecthub`.

## AI 501 / unconfigured

Set `GROQ_API_KEY` in `server/.env`. Core event/attendee flows work without it.

## Port 8080 in use

Stop the other Vite process, or change `vite.config.ts` `server.port`.

For office mode set `OFFICE_PORT` in `server/.env`; `PORT` controls the
development API only.

## Offline / pending sync indicator does not clear

Keep the page open after connectivity returns. If it changes to “Sync needs
attention,” tap Retry, verify `/api/health`, then sign in again if the session
expired. Queued operations are stored per user and are not silently assigned to
another login. A conflict means another device saved a newer note or setting;
review it before retrying.

## Event list is empty while offline

Open ConnectHub online once after signing in so events and attendees can be
cached. After that, a reload while offline should show the last saved list with
an amber offline banner.

## Office server exits immediately

`npm run office` requires `AUTH_SECRET` in `ConnectHub/server/.env`. A missing or
default secret is rejected so session tokens cannot be forged.

## Private event opens but attendees are empty

Enter the event PIN from the event list. Verification is server-side. Owners and
admins do not need a grant.

## Upload rejected

Uploads must be JPEG, PNG, WebP, or GIF, no larger than 10 MB, and the generated
filename must belong to the current profile/event. SVG and arbitrary documents
are intentionally rejected.

## Public URL does not work

Confirm `npm run office` works at `http://localhost:8080`, then check the
Cloudflare service and `ALLOWED_ORIGINS`. Never open or tunnel PostgreSQL port
5432.
