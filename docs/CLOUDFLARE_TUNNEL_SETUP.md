# Public HTTPS access with Cloudflare Tunnel

This publishes only the ConnectHub web server. PostgreSQL port 5432 must remain
private and must never be forwarded through the router or tunnel.

## Prerequisites

- A domain managed in Cloudflare
- ConnectHub working locally at `http://localhost:8080`
- `cloudflared` installed on the Windows host

## Recommended dashboard-managed setup

1. In Cloudflare Zero Trust, open **Networks → Tunnels**.
2. Create a Cloudflared tunnel named `connecthub-office`.
3. Select Windows and copy the generated service-install command.
4. Run that command in an Administrator PowerShell on the host PC.
5. Add a public hostname, for example `connecthub.example.com`.
6. Set its service to `http://localhost:8080`.
7. In `ConnectHub/server/.env`, set:

   ```env
   ALLOWED_ORIGINS=https://connecthub.example.com
   OFFICE_PORT=8080
   ```

8. Restart ConnectHub and the Cloudflared service.

## Security requirements

- Use HTTPS only; Cloudflare supplies the public certificate.
- Enable Cloudflare Access if company policy requires an additional identity
  check before the ConnectHub login page.
- Keep the tunnel token secret.
- Do not publish `/api/health` details beyond the statuses already returned.
- Rotate `AUTH_SECRET`, database credentials, and any AI keys before office use.
- Run `backup-connecthub.ps1` on a schedule.

## Verify

1. Open the public hostname on a phone using mobile data (not office Wi-Fi).
2. Sign in as a non-admin user.
3. Add a note to an attendee.
4. Sign in as the same user on a PC and confirm the note appears.
5. Sign in as another user and confirm that note does not appear.

Cloudflare Tunnel is transport only; all ConnectHub authorization is still
enforced by the Express API and PostgreSQL ownership model.
