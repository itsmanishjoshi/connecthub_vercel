# ConnectHub architecture (local / on-prem)

```text
Browser
  Vite SPA  :8080
     |  /api  /uploads  (proxy in development)
     v
  Express   :3001  (or :8080 with npm run office)
     |
     +--> PostgreSQL  DATABASE_URL
     +--> Disk        UPLOAD_DIR
     +--> Groq        GROQ_API_KEY (optional)
```

- **Auth:** username/password against `users`; bcrypt hashes; HMAC session token in `Authorization: Bearer`.
- **Data:** existing React services still call a Supabase-shaped client (`localDbClient`) which hits `/api/db`.
- **No Supabase cloud, no Vercel runtime.** `vercel.json` is leftover SPA config only.

## Authorization and data ownership

- Every database, upload, AI and search request requires a current, non-revoked
  user.
- Admin endpoints create, edit, deactivate and reset users. Password hashes are
  never returned.
- Events and attendees are shared. Event writes are limited to the creator or
  an admin. Private attendee data requires a server-recorded PIN access grant.
- Attendee notes/statuses/stages, notebook pages, preferences, gallery, QR data
  and follow-ups are forcibly scoped by the API to the authenticated user (QR
  and gallery use that user's profile ID).
- Browser storage is a user-namespaced cache/draft queue, not authoritative.
  Events and attendees also snapshot into IndexedDB so the last successful
  fetch can render offline. Online recovery flushes queued private writes,
  retries transient failures, and rejects stale note/setting writes with HTTP 409.
- The office build is installable. The service worker caches the application
  shell and hashed assets only. `/api` and `/uploads` stay network-only.

## Office delivery

`npm run office` builds the SPA and serves `/`, `/api`, and `/uploads` from one
Express origin on port 8080. Cloudflare Tunnel may publish that HTTP service as
HTTPS. PostgreSQL remains bound to the host/private network and is never
tunneled.

Local uploads are limited to approved image buckets, MIME types, signatures,
sizes and owner-derived filenames. Database backups use `pg_dump` custom format.

## Next architecture phase

Conversation, transcript, pain-point, opportunity, solution, follow-up-content,
RAG/vector, consent/audit and provider-adapter domains are intentionally not
fabricated in this foundation. They should be added behind explicit APIs and
repositories on top of the current auth/ownership model.
