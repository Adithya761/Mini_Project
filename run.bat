@echo off
setlocal enabledelayedexpansion
title ECO Platform - One-Click Launcher
color 0B

echo ============================================================
echo        ECO COLLABORATION PLATFORM - PROJECT LAUNCHER        
echo ============================================================
echo.

:: Ensure we are in the project root directory
cd /d "%~dp0"

echo [1/4] Checking prerequisites...

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   [ERROR] Node.js is not found in PATH!
    echo   Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo   [OK] Node.js version: !NODE_VERSION!

:: Check MongoDB
echo [2/4] Checking MongoDB service...
sc query MongoDB 2>nul | findstr /i "STATE" | findstr /i "RUNNING" >nul 2>nul
if %errorlevel% equ 0 (
    echo   [OK] MongoDB is running.
) else (
    echo   [INFO] Attempting to start MongoDB service...
    net start MongoDB >nul 2>nul
    if !errorlevel! equ 0 (
        echo   [OK] MongoDB service started successfully.
    ) else (
        echo   [WARN] Could not automatically start MongoDB service.
        echo   If using a local MongoDB, please ensure mongod is active.
    )
)

:: Check Backend node_modules
echo [3/4] Verifying dependencies...
if not exist "backend\node_modules\" (
    echo   [INFO] Installing Backend dependencies...
    cd backend && call npm install && cd ..
) else (
    echo   [OK] Backend dependencies installed.
)

:: Check Frontend node_modules
if not exist "frontend\node_modules\" (
    echo   [INFO] Installing Frontend dependencies...
    cd frontend && call npm install && cd ..
) else (
    echo   [OK] Frontend dependencies installed.
)

:: Launch Services
echo.
echo [4/4] Starting services in separate windows...
echo.

:: Start Backend
echo Starting Backend on port 3000...
start "Eco Backend - Port 3000" /d "%~dp0backend" cmd /k "title Eco Backend [3000] && echo Starting Eco Backend Server... && npm start"

:: Give backend a moment
timeout /t 2 /nobreak >nul

:: Start Frontend
echo Starting Frontend on port 5173...
start "Eco Frontend - Port 5173" /d "%~dp0frontend" cmd /k "title Eco Frontend [5173] && echo Starting Eco Frontend Vite Server... && npm run dev"

:: Give frontend a moment
timeout /t 3 /nobreak >nul

:: Open browser automatically
echo Opening browser to http://localhost:5173 ...
start http://localhost:5173

echo.
echo ============================================================
echo               ALL SERVICES ARE NOW RUNNING!                 
echo ============================================================
echo   Backend API:  http://localhost:3000
echo   Frontend App: http://localhost:5173
echo   MongoDB:      Running
echo.
echo   To stop all services later, run 'stop.bat' or close the windows.
echo ============================================================
echo.
pause
