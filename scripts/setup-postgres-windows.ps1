# PowerShell Script to Install PostgreSQL and Setup ConnectHub Database
# Run as Administrator

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║    ConnectHub - Local PostgreSQL Setup Automation             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Host "⚠️  Please run this script as Administrator!" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Step 1: Check if PostgreSQL is already installed
Write-Host "Step 1: Checking PostgreSQL Installation..." -ForegroundColor Yellow
$postgresPath = "C:\Program Files\PostgreSQL"
$postgresExists = Test-Path $postgresPath

if ($postgresExists) {
    Write-Host "✅ PostgreSQL found at $postgresPath" -ForegroundColor Green
    $version = Get-ChildItem $postgresPath | Select-Object -First 1 -ExpandProperty Name
    Write-Host "   Version directory: $version" -ForegroundColor Cyan
} else {
    Write-Host "❌ PostgreSQL not found at $postgresPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "📥 PostgreSQL Installation Required" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Cyan
    Write-Host "1. Download from: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "2. Or use Chocolatey: choco install postgresql" -ForegroundColor White
    Write-Host ""
    Write-Host "After installation, run this script again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Step 2: Find psql executable
Write-Host "Step 2: Locating psql executable..." -ForegroundColor Yellow
$psqlPath = Get-ChildItem -Path "$postgresPath\*\bin\psql.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $psqlPath) {
    Write-Host "❌ psql.exe not found" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✅ Found psql at: $($psqlPath.FullName)" -ForegroundColor Green

Write-Host ""

# Step 3: Check PostgreSQL service status
Write-Host "Step 3: Checking PostgreSQL Service..." -ForegroundColor Yellow
$pgServices = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgServices) {
    $service = $pgServices | Select-Object -First 1
    if ($service.Status -eq "Running") {
        Write-Host "✅ PostgreSQL service is running: $($service.Name)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  PostgreSQL service found but not running. Starting..." -ForegroundColor Yellow
        Start-Service -Name $service.Name
        Start-Sleep -Seconds 3
        if ((Get-Service -Name $service.Name).Status -eq "Running") {
            Write-Host "✅ PostgreSQL service started successfully" -ForegroundColor Green
        } else {
            Write-Host "❌ Failed to start PostgreSQL service" -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }
    }
} else {
    Write-Host "❌ PostgreSQL service not found" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Step 4: Create database and user
Write-Host "Step 4: Creating Database and User..." -ForegroundColor Yellow

$env:PGPASSWORD = "postgres"

# SQL commands to execute
$sqlCommands = @(
    "CREATE DATABASE connecthub_local;",
    "CREATE USER connecthub_user WITH PASSWORD 'connecthub_local_password';",
    "ALTER ROLE connecthub_user SET client_encoding TO 'utf8';",
    "ALTER ROLE connecthub_user SET default_transaction_isolation TO 'read committed';",
    "ALTER ROLE connecthub_user SET default_transaction_deferrable TO on;",
    "ALTER ROLE connecthub_user SET default_transaction_read_only TO off;",
    "GRANT ALL PRIVILEGES ON DATABASE connecthub_local TO connecthub_user;"
)

foreach ($cmd in $sqlCommands) {
    Write-Host "  Executing: $cmd" -ForegroundColor Gray
    try {
        & $psqlPath.FullName -U postgres -c $cmd 2>&1 | ForEach-Object {
            if ($_ -match "already exists" -or $_ -match "ERROR") {
                Write-Host "  ⚠️  $_" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "  ⚠️  Error: $_" -ForegroundColor Yellow
    }
}

Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
Write-Host "✅ Database and user creation attempted" -ForegroundColor Green

Write-Host ""

# Step 5: Test connection
Write-Host "Step 5: Testing Database Connection..." -ForegroundColor Yellow
$env:PGPASSWORD = "connecthub_local_password"

try {
    $output = & $psqlPath.FullName -U connecthub_user -d connecthub_local -h localhost -c "SELECT NOW();" 2>&1
    if ($output -match "\d{4}-\d{2}-\d{2}") {
        Write-Host "✅ Connection successful!" -ForegroundColor Green
        Write-Host "   Server time: $output" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️  Connection returned unexpected output: $output" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Connection test warning: $_" -ForegroundColor Yellow
}

Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

Write-Host ""

# Step 6: Display connection information
Write-Host "Step 6: Connection Information" -ForegroundColor Yellow
Write-Host ""
Write-Host "Database Configuration:" -ForegroundColor Cyan
Write-Host "  Host:     localhost" -ForegroundColor White
Write-Host "  Port:     5432" -ForegroundColor White
Write-Host "  Database: connecthub_local" -ForegroundColor White
Write-Host "  User:     connecthub_user" -ForegroundColor White
Write-Host "  Password: connecthub_local_password" -ForegroundColor White
Write-Host ""
Write-Host "Connection String:" -ForegroundColor Cyan
Write-Host "  postgresql://connecthub_user:connecthub_local_password@localhost:5432/connecthub_local" -ForegroundColor Green
Write-Host ""

# Step 7: Summary
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Copy the connection string above" -ForegroundColor White
Write-Host "2. Update your .env file with the connection string" -ForegroundColor White
Write-Host "3. Initialize database schema (run init-schema.sql)" -ForegroundColor White
Write-Host "4. Start your application" -ForegroundColor White
Write-Host ""
Write-Host "For pgAdmin GUI access:" -ForegroundColor Cyan
Write-Host "  Download: https://www.pgadmin.org/download/" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter to exit"
