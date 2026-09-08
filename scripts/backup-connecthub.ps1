param(
    [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $RepoRoot "backups" }
$envPath = Join-Path $RepoRoot "backend\.env"
if (-not (Test-Path $envPath)) { throw "Missing backend\.env" }

$databaseUrlLine = Get-Content $envPath |
    Where-Object { $_ -match '^DATABASE_URL=' } |
    Select-Object -First 1
if (-not $databaseUrlLine) { throw "DATABASE_URL is not configured" }
$databaseUrl = $databaseUrlLine.Substring("DATABASE_URL=".Length)

$pgDump = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" |
    Sort-Object FullName -Descending |
    Select-Object -First 1
if (-not $pgDump) { throw "pg_dump.exe was not found" }

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$output = Join-Path $OutputDirectory "connecthub-$timestamp.dump"

& $pgDump.FullName --dbname=$databaseUrl --format=custom --file=$output
if ($LASTEXITCODE -ne 0) { throw "Database backup failed" }
if ((Get-Item $output).Length -le 0) { throw "Database backup is empty" }

$uploadsDir = Join-Path $RepoRoot "backend\uploads"
$uploadsArchive = Join-Path $OutputDirectory "connecthub-$timestamp-uploads.zip"
if (Test-Path $uploadsDir) {
    Compress-Archive -Path (Join-Path $uploadsDir '*') -DestinationPath $uploadsArchive -Force
}

$hash = (Get-FileHash $output -Algorithm SHA256).Hash
Set-Content -Path "$output.sha256" -Value $hash

Write-Host "Backup created: $output" -ForegroundColor Green
if (Test-Path $uploadsArchive) {
    Write-Host "Uploads archive: $uploadsArchive" -ForegroundColor Green
}
Write-Host "Checksum: $hash"
