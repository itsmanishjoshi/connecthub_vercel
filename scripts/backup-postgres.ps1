param(
  [string]$OutputDir = "backups"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dump = Join-Path $OutputDir "connecthub-$stamp.sql"
$uploads = Join-Path $OutputDir "uploads-$stamp.tar"

Write-Host "Backing up PostgreSQL to $dump"
docker compose exec -T db pg_dump -U connecthub_user connecthub | Set-Content -Path $dump -Encoding utf8

Write-Host "Backing up uploads to $uploads"
docker compose exec -T app tar -C /data -cf - uploads | Set-Content -Path $uploads -AsByteStream

Write-Host "Backup complete."
Write-Host "Restore SQL: docker compose exec -T db psql -U connecthub_user connecthub < $dump"
