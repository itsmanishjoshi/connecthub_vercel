#!/bin/sh
set -eu
OUTPUT_DIR="${1:-backups}"
mkdir -p "$OUTPUT_DIR"
stamp="$(date +%Y%m%d-%H%M%S)"
dump="$OUTPUT_DIR/connecthub-$stamp.sql"
uploads="$OUTPUT_DIR/uploads-$stamp.tar"

echo "Backing up PostgreSQL to $dump"
docker compose exec -T db pg_dump -U connecthub_user connecthub > "$dump"

echo "Backing up uploads to $uploads"
docker compose exec -T app tar -C /data -cf - uploads > "$uploads"

echo "Backup complete."
echo "Restore SQL: docker compose exec -T db psql -U connecthub_user connecthub < $dump"
