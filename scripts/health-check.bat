@echo off
setlocal
set "PATH=C:\Program Files\nodejs;C:\Program Files\PostgreSQL\18\bin;%PATH%"
cd /d "%~dp0\.."

echo ConnectHub health check
echo -----------------------

node --version >nul 2>&1 && (echo [OK] Node.js) || (echo [FAIL] Node.js)
npm --version >nul 2>&1 && (echo [OK] npm) || (echo [FAIL] npm)
python --version >nul 2>&1 && (echo [OK] Python) || (echo [FAIL] Python)

powershell -NoProfile -Command "if (Get-Service 'postgresql*' -ErrorAction SilentlyContinue | Where-Object Status -eq Running) { Write-Host '[OK] PostgreSQL service' } else { Write-Host '[FAIL] PostgreSQL service' }"

if exist "backend\.env" (echo [OK] backend\.env) else (echo [FAIL] backend\.env)
if exist "frontend\node_modules" (echo [OK] frontend dependencies) else (echo [FAIL] run npm install in frontend)

powershell -NoProfile -Command "try { $h=Invoke-RestMethod http://127.0.0.1:8000/api/health -TimeoutSec 3; $h | ConvertTo-Json -Compress } catch { Write-Host '[INFO] Development API not running' }"
powershell -NoProfile -Command "try { $h=Invoke-RestMethod http://127.0.0.1:8080/api/health -TimeoutSec 3; $h | ConvertTo-Json -Compress } catch { Write-Host '[INFO] Office server not running' }"

echo.
echo Start development: npm run dev
echo Start office host: npm run office
pause
