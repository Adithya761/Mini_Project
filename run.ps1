# ECO Collaboration Platform - PowerShell Launcher
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "       ECO COLLABORATION PLATFORM - PROJECT LAUNCHER        " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$rootPath = $PSScriptRoot
Set-Location $rootPath
$env:PATH = "$env:SystemRoot\System32;$env:SystemRoot\System32\WindowsPowerShell\v1.0;" + $env:PATH

# 1. Check Node
Write-Host "[1/4] Checking prerequisites..." -ForegroundColor Yellow
try {
    $nodeVer = node -v
    Write-Host "  [OK] Node.js version: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Node.js is not found!" -ForegroundColor Red
    pause
    exit 1
}

# 2. Check MongoDB
Write-Host "[2/4] Checking MongoDB service..." -ForegroundColor Yellow
$mongoService = Get-Service -Name "*mongo*" -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "Running" }
if ($mongoService) {
    Write-Host "  [OK] MongoDB is running ($($mongoService.DisplayName))" -ForegroundColor Green
} else {
    Write-Host "  [INFO] Attempting to start MongoDB service..." -ForegroundColor Yellow
    try {
        Start-Service -Name "MongoDB" -ErrorAction SilentlyContinue
        Write-Host "  [OK] MongoDB service started successfully." -ForegroundColor Green
    } catch {
        Write-Host "  [WARN] Could not automatically start MongoDB. Ensure mongod is running." -ForegroundColor Yellow
    }
}

# 3. Check Dependencies
Write-Host "[3/4] Checking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "$rootPath\backend\node_modules")) {
    Write-Host "  [INFO] Installing Backend dependencies..." -ForegroundColor Yellow
    npm --prefix "$rootPath\backend" install
} else {
    Write-Host "  [OK] Backend dependencies ready." -ForegroundColor Green
}

if (-not (Test-Path "$rootPath\frontend\node_modules")) {
    Write-Host "  [INFO] Installing Frontend dependencies..." -ForegroundColor Yellow
    npm --prefix "$rootPath\frontend" install
} else {
    Write-Host "  [OK] Frontend dependencies ready." -ForegroundColor Green
}

# 4. Start Services
Write-Host "`n[4/4] Starting services in separate windows..." -ForegroundColor Yellow

# Start Backend
Start-Process cmd.exe -ArgumentList "/k cd /d `"$rootPath\backend`" && title Eco Backend [3000] && npm start"
Write-Host "  [OK] Backend launching on http://localhost:3000" -ForegroundColor Green

Start-Sleep -Seconds 2

# Start Frontend
Start-Process cmd.exe -ArgumentList "/k cd /d `"$rootPath\frontend`" && title Eco Frontend [5173] && npm run dev"
Write-Host "  [OK] Frontend launching on http://localhost:5173" -ForegroundColor Green

Start-Sleep -Seconds 3

# Open Browser
Start-Process "http://localhost:5173"

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "              ALL SERVICES ARE NOW RUNNING!                 " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Backend API:  http://localhost:3000" -ForegroundColor White
Write-Host "  Frontend App: http://localhost:5173" -ForegroundColor White
Write-Host "  To stop: Run .\stop.bat or close the opened terminal windows." -ForegroundColor Gray
Write-Host "============================================================`n" -ForegroundColor Cyan
