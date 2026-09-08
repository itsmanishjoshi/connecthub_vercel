@echo off
setlocal
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0\.."

echo ========================================
echo  ConnectHub office / on-prem start
echo ========================================
echo.

tasklist /FI "IMAGENAME eq postgres.exe" 2>NUL | find /I "postgres.exe">NUL
if %ERRORLEVEL% NEQ 0 (
    echo PostgreSQL does not look like it is running.
    echo Start it from Services ^(postgresql-x64-* ^) then run this again.
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo Installing frontend packages...
    pushd frontend
    call npm install
    popd
)

if not exist "backend\.env" (
    echo Missing backend\.env
    echo Copy backend\.env.example to backend\.env and configure it.
    pause
    exit /b 1
)

echo.
echo Choose how to run:
echo   1  Development  ^(Vite + Python API^)
echo   2  Office host  ^(build app, one server on port 8080 for the LAN^)
echo.
set /p CHOICE=Enter 1 or 2: 

if "%CHOICE%"=="2" (
    call npm run office
    goto :eof
)

echo Starting development stack...
call npm run dev
goto :eof
