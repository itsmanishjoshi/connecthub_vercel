# PowerShell script to set up local PostgreSQL for ConnectHub
# Run as Administrator

param(
    [string]$PostgresPassword = "postgres_office_password",
    [string]$AppDBPassword = "connecthub_office_local"
)

Write-Host "🚀 ConnectHub Local Database Setup" -ForegroundColor Cyan
Write-Host "==================================`n" -ForegroundColor Cyan

# Check if PostgreSQL is installed
Write-Host "Checking PostgreSQL installation..." -ForegroundColor Yellow
$postgresPath = "C:\Program Files\PostgreSQL"
$postgresExists = Test-Path $postgresPath

if (-not $postgresExists) {
    Write-Host "❌ PostgreSQL not found at $postgresPath" -ForegroundColor Red
    Write-Host "Please install PostgreSQL first from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ PostgreSQL found at $postgresPath`n" -ForegroundColor Green

# Function to run psql commands
function Invoke-PSQLCommand {
    param(
        [string]$Command,
        [string]$Database = "postgres"
    )
    
    $pgBin = Get-ChildItem -Path "$postgresPath\*\bin\psql.exe" | Select-Object -First 1
    
    if (-not $pgBin) {
        Write-Host "❌ psql.exe not found" -ForegroundColor Red
        return $false
    }
    
    $env:PGPASSWORD = "postgres"
    & $pgBin.FullName -U postgres -d $Database -c $Command
    $result = $?
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    
    return $result
}

# Create database and user
Write-Host "Creating database 'connecthub'..." -ForegroundColor Yellow
Invoke-PSQLCommand "CREATE DATABASE connecthub;" -Database postgres

Write-Host "Creating user 'connecthub_user'..." -ForegroundColor Yellow
Invoke-PSQLCommand "CREATE USER connecthub_user WITH PASSWORD '$AppDBPassword';" -Database postgres

# Grant privileges
Write-Host "Granting privileges..." -ForegroundColor Yellow
Invoke-PSQLCommand "ALTER ROLE connecthub_user SET client_encoding TO 'utf8';" -Database postgres
Invoke-PSQLCommand "ALTER ROLE connecthub_user SET default_transaction_isolation TO 'read committed';" -Database postgres
Invoke-PSQLCommand "ALTER ROLE connecthub_user SET default_transaction_deferrable TO on;" -Database postgres
Invoke-PSQLCommand "ALTER ROLE connecthub_user SET default_transaction_read_only TO off;" -Database postgres
Invoke-PSQLCommand "GRANT ALL PRIVILEGES ON DATABASE connecthub TO connecthub_user;" -Database postgres

Write-Host "`n✅ Database setup complete!" -ForegroundColor Green
Write-Host "Database: connecthub" -ForegroundColor Cyan
Write-Host "User: connecthub_user" -ForegroundColor Cyan
Write-Host "Password: $AppDBPassword" -ForegroundColor Cyan
Write-Host "Host: localhost" -ForegroundColor Cyan
Write-Host "Port: 5432`n" -ForegroundColor Cyan

Write-Host "📝 Connection string for .env:" -ForegroundColor Yellow
Write-Host "postgresql://connecthub_user:$AppDBPassword@localhost:5432/connecthub`n" -ForegroundColor Green

# Test connection
Write-Host "Testing connection..." -ForegroundColor Yellow
$env:PGPASSWORD = $AppDBPassword
& $pgBin.FullName -U connecthub_user -d connecthub -h localhost -c "SELECT version();" -ErrorVariable pgError | Out-Null
$testResult = $?
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

if ($testResult) {
    Write-Host "✅ Connection test successful!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Connection test failed. Please verify your setup." -ForegroundColor Yellow
}

Write-Host "`n🎉 Setup complete! You can now migrate data from Supabase." -ForegroundColor Green
