# ConnectHub security

ConnectHub is designed for authenticated access only. Every API route except login and health checks requires a valid session token.

## Authentication

- Username + password login with bcrypt-hashed passwords (no plaintext storage)
- Signed session tokens (HMAC-SHA256, 7-day TTL)
- Tokens sent via `Authorization: Bearer` header only in production
- Login, password change, and account deletion are rate-limited

## Authorization

- **Events:** public events are readable; private events require access grant or organizer role
- **People cards:** shared read; edits require admin or **Edit** grant on the event
- **Notes, conversations, priority flags:** private to the owner; admins can read for support via admin APIs
- **Repository uploads/deletes:** administrators only
- **People ingest:** administrators with event edit access

## Data protection

- Generic database API uses table whitelists, parameterized queries, and row limits (5000 max per select)
- Private tables always scoped to `user_id` unless admin read (select only)
- Sensitive uploads (avatars, profile photos, QR codes, repository files) are not served publicly
- Photo proxy restricted to approved image hosts (blocks open SSRF)

## Production checklist

1. Set `NODE_ENV=production`
2. Set a strong random `AUTH_SECRET` (32+ characters)
3. Set `ALLOWED_ORIGINS` to your exact frontend URL(s)
4. Use PostgreSQL with `sslmode=require` for remote databases
5. Use HTTPS in front of the app (reverse proxy or Cloudflare tunnel)
6. Do not put API keys in `VITE_*` environment variables
7. Change default admin password after first login

See [CONNECTHUB_ARCHITECTURE.md](CONNECTHUB_ARCHITECTURE.md) and [CONNECTHUB_SAST_REPORT.md](CONNECTHUB_SAST_REPORT.md) for full details.
