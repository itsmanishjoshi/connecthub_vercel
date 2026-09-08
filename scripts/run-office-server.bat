@echo off
setlocal
cd /d "%~dp0\.."
if not exist "frontend\dist\index.html" (
  echo Frontend has not been built. Run npm run build from the repo root first.
  exit /b 1
)
cd backend
set SERVE_STATIC=1
set OFFICE_PORT=8080
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
