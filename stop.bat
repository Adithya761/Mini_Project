@echo off
title ECO Platform - Stop Services
color 0C

echo ============================================================
echo             ECO PLATFORM - STOPPING SERVICES                
echo ============================================================
echo.

cd /d "%~dp0"

echo Stopping any processes listening on port 3000 (Backend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo   Terminating PID %%a
    taskkill /F /PID %%a >nul 2>nul
)

echo Stopping any processes listening on port 5173 (Frontend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo   Terminating PID %%a
    taskkill /F /PID %%a >nul 2>nul
)

echo.
echo [OK] All Eco services have been stopped.
echo.
timeout /t 3 >nul
