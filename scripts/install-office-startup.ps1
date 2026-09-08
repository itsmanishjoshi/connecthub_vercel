# Run as Administrator after `npm run office` or `npm run build`.
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$runner = Join-Path $PSScriptRoot "run-office-server.bat"
if (-not (Test-Path (Join-Path $RepoRoot "frontend\dist\index.html"))) {
    throw "Build missing. Run npm run build from the repo root first."
}

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$runner`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName "ConnectHub Office Server" `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description "Starts the ConnectHub on-prem web application at Windows startup" `
  -Force | Out-Null

Start-ScheduledTask -TaskName "ConnectHub Office Server"
Write-Host "ConnectHub startup task installed and started." -ForegroundColor Green
