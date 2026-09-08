param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [string]$UploadsArchive = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path $BackupFile)) { throw "Backup file not found: $BackupFile" }

$confirmation = Read-Host "Restore will replace ConnectHub data. Type RESTORE to continue"
if ($confirmation -ne "RESTORE") {
    Write-Host "Restore cancelled."
    exit 0
}

$envPath = Join-Path $RepoRoot "backend\.env"
$databaseUrlLine = Get-Content $envPath |
    Where-Object { $_ -match '^DATABASE_URL=' } |
    Select-Object -First 1
if (-not $databaseUrlLine) { throw "DATABASE_URL is not configured" }
$databaseUrl = $databaseUrlLine.Substring("DATABASE_URL=".Length)

$pgDump = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" |
    Sort-Object FullName -Descending |
    Select-Object -First 1
$pgRestore = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_restore.exe" |
    Sort-Object FullName -Descending |
    Select-Object -First 1
if (-not $pgRestore) { throw "pg_restore.exe was not found" }

$checksumFile = "$BackupFile.sha256"
if (Test-Path $checksumFile) {
    $expected = (Get-Content $checksumFile -Raw).Trim()
    $actual = (Get-FileHash $BackupFile -Algorithm SHA256).Hash
    if ($expected -ne $actual) { throw "Backup checksum does not match $checksumFile" }
}

$safetyDir = Join-Path $RepoRoot "backups"
New-Item -ItemType Directory -Force -Path $safetyDir | Out-Null
$safety = Join-Path $safetyDir ("pre-restore-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".dump")
if ($pgDump) {
    & $pgDump.FullName --dbname=$databaseUrl --format=custom --file=$safety
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Safety backup written: $safety"
    }
}

& $pgRestore.FullName --dbname=$databaseUrl --clean --if-exists --no-owner $BackupFile
if ($LASTEXITCODE -ne 0) { throw "Database restore failed" }

if (-not $UploadsArchive) {
    $sibling = $BackupFile -replace '\.dump$', '-uploads.zip'
    if (Test-Path $sibling) { $UploadsArchive = $sibling }
}
if ($UploadsArchive -and (Test-Path $UploadsArchive)) {
    $uploadsDir = Join-Path $RepoRoot "backend\uploads"
    New-Item -ItemType Directory -Force -Path $uploadsDir | Out-Null
    Expand-Archive -Path $UploadsArchive -DestinationPath $uploadsDir -Force
    Write-Host "Uploads restored from: $UploadsArchive"
}

Write-Host "Database restored from: $BackupFile" -ForegroundColor Green
