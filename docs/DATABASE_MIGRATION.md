# Database migration (Supabase cloud → local PostgreSQL)

## Source of truth

Live application queries in `ConnectHub/src` plus `init-schema.sql`.

`ConnectHub/supabase/migrations/` depend on `auth.users` and RLS. **Do not apply them** to vanilla PostgreSQL.

## Extensions

- `pgcrypto` (UUID generation)
- `uuid-ossp` (optional)

## Tables (portable)

`users`, `user_profiles`, `events`, `event_access_grants`, `attendees`,
`attendee_notes`, `attendee_statuses`, `attendee_stages`,
`attendee_insights`, `qr_codes`, `gallery_items`, `notes`, `user_notes`,
`user_preferences`, and `follow_ups`.

Views: `contacts` (attendees), `attendee_stage` (attendee_stages)

## Replacements

| Supabase | Local |
| -------- | ----- |
| PostgREST | `POST /api/db` |
| Storage | `server/uploads` |
| Auth (`auth.uid()`) | Bcrypt login + expiring signed bearer session |
| RLS | Authenticated API ownership enforcement and RBAC |

## Local commands

```bash
cd ConnectHub
npm run db:migrate
npm run db:seed
# destructive:
npm run db:reset
```

`init-schema.sql` is the idempotent baseline. Ordered files in
`ConnectHub/migrations/` are recorded in `schema_migrations` and applied in a
transaction, including `002_record_versions.sql` for conflict-aware
`client_updated_at` columns. Legacy Supabase SQL files are reference material
only.

## Seed

The first admin uses `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_EMAIL` from
`server/.env`; no admin password is committed. Seed also adds fictional events,
attendees and an optional stakeholder account. Passwords are bcrypt-hashed in
`scripts/db.mjs`.
