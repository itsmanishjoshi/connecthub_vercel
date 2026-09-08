# Create ConnectHub database on a local PostgreSQL install and write office .env files.
# Run from repo root: powershell -ExecutionPolicy Bypass -File .\scripts\setup-office-postgres.ps1

param(
    [string]$PostgresUser = "postgres",
    [string]$AppDbName = "connecthub",
    [string]$AppUser = "connecthub_user",
    [string]$AppPassword = "",
    [string]$AdminUsername = "Admin",
    [string]$AdminPassword = "",
    [string]$AdminEmail = "admin@connecthub.local"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$FrontendDir = Join-Path $Root "frontend"
$BackendDir = Join-Path $Root "backend"

Write-Host "ConnectHub local PostgreSQL setup" -ForegroundColor Cyan

$psql = Get-ChildItem -Path "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1

if (-not $psql) {
    Write-Host "psql.exe not found under C:\Program Files\PostgreSQL. Add PostgreSQL bin to PATH and retry." -ForegroundColor Red
    exit 1
}

$env:Path = "$(Split-Path $psql.FullName);$env:Path"

$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pgService -and $pgService.Status -ne "Running") {
    Write-Host "Starting $($pgService.Name)..." -ForegroundColor Yellow
    Start-Service -Name $pgService.Name
}

if (-not $env:PGPASSWORD) {
    $secure = Read-Host "Enter password for PostgreSQL user '$PostgresUser'" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
}

if ($AppUser -notmatch '^[A-Za-z_][A-Za-z0-9_]*$' -or $AppDbName -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
    throw "Database and user names may contain only letters, numbers, and underscores."
}
if (-not $AppPassword) {
    $secureApp = Read-Host "Choose password for application database user '$AppUser'" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureApp)
    $AppPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
}
if (-not $AdminPassword) {
    $secureAdmin = Read-Host "Choose initial ConnectHub admin password" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureAdmin)
    $AdminPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
}
if (-not $AdminPassword) {
    throw "Admin password is required."
}

function Invoke-Psql([string]$Database, [string]$Sql) {
    & $psql.FullName -U $PostgresUser -d $Database -v ON_ERROR_STOP=1 -c $Sql
    if ($LASTEXITCODE -ne 0) { throw "psql failed: $Sql" }
}

Write-Host "Creating database and app user..." -ForegroundColor Yellow
$escapedAppPassword = $AppPassword.Replace("'", "''")
$roleExists = & $psql.FullName -U $PostgresUser -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$AppUser';"
if ($roleExists -eq "1") {
    Invoke-Psql "postgres" "ALTER USER $AppUser WITH LOGIN PASSWORD '$escapedAppPassword';"
} else {
    Invoke-Psql "postgres" "CREATE USER $AppUser WITH LOGIN PASSWORD '$escapedAppPassword';"
}
$dbExists = & $psql.FullName -U $PostgresUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$AppDbName';"
if ($dbExists -ne "1") {
    Invoke-Psql "postgres" "CREATE DATABASE $AppDbName OWNER $AppUser;"
}
Invoke-Psql "postgres" "GRANT ALL PRIVILEGES ON DATABASE $AppDbName TO $AppUser;"
Invoke-Psql $AppDbName "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
Invoke-Psql $AppDbName "CREATE EXTENSION IF NOT EXISTS `"uuid-ossp`";"
Invoke-Psql $AppDbName "GRANT ALL ON SCHEMA public TO $AppUser;"

$envFile = Join-Path $FrontendDir ".env.local"
$serverEnv = Join-Path $BackendDir ".env"
$encodedPassword = [Uri]::EscapeDataString($AppPassword)
$connection = "postgresql://${AppUser}:${encodedPassword}@localhost:5432/${AppDbName}"
$authBytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($authBytes)
$rng.Dispose()
$authSecret = -join ($authBytes | ForEach-Object { $_.ToString("x2") })

@"
VITE_USE_LOCAL_DB=true
VITE_API_URL=
VITE_SITE_URL=http://localhost:8080
"@ | Set-Content -Path $envFile -Encoding UTF8

@"
DATABASE_URL=$connection
PORT=8000
OFFICE_PORT=8080
AUTH_SECRET=$authSecret
ADMIN_USERNAME=$AdminUsername
ADMIN_PASSWORD=$AdminPassword
ADMIN_EMAIL=$AdminEmail
"@ | Set-Content -Path $serverEnv -Encoding UTF8

Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Database ready: $AppDbName" -ForegroundColor Green
Write-Host "Wrote $envFile"
Write-Host "Wrote $serverEnv"
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  1. npm install --prefix frontend"
Write-Host "  2. pip install -r backend/requirements.txt"
Write-Host "  3. npm run db:migrate"
Write-Host "  4. npm run db:seed"
Write-Host "  5. Double-click start-office.bat  OR  npm run dev / npm run office"
Write-Host ""
Write-Host "Admin login:" -ForegroundColor Cyan
Write-Host "  Username: $AdminUsername"
Write-Host "  Password: the admin password you entered"
