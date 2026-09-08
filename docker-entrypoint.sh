#!/bin/sh
set -eu

UPLOAD_DIR="${UPLOAD_DIR:-/data/uploads}"
mkdir -p "$UPLOAD_DIR"

if [ -z "${AUTH_SECRET:-}" ] || [ "$AUTH_SECRET" = "generate-a-long-random-string" ]; then
  AUTH_SECRET="$(python -c 'import secrets; print(secrets.token_hex(32))')"
  export AUTH_SECRET
  echo "AUTH_SECRET was empty; generated one for this process. Set AUTH_SECRET in .env so logins survive container recreate."
fi

if [ "${ADMIN_PASSWORD:-}" = "changeme_admin" ] || [ "${POSTGRES_PASSWORD:-}" = "changeme_office_db" ]; then
  echo "WARNING: example default passwords are in use. Set ADMIN_PASSWORD and POSTGRES_PASSWORD in .env before office use."
fi

echo "Waiting for PostgreSQL..."
ready=0
i=0
while [ "$i" -lt 60 ]; do
  if python scripts/wait_for_db.py; then
    ready=1
    break
  fi
  i=$((i + 1))
  sleep 2
done

if [ "$ready" -ne 1 ]; then
  echo "PostgreSQL did not become ready"
  exit 1
fi

python scripts/migrate.py migrate
python scripts/migrate.py seed

export SERVE_STATIC=1
export OFFICE_PORT="${OFFICE_PORT:-8080}"
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${OFFICE_PORT}"
