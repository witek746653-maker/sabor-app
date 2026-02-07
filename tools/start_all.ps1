$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Sabor App: Full Dev Start" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$root = Resolve-Path "$PSScriptRoot\.."

# 0. Sync Database
Write-Host "[0/3] Syncing Database (DataFrame/DB)..." -ForegroundColor Yellow
$syncScript = Join-Path $PSScriptRoot "sync_prod_db.ps1"
powershell -ExecutionPolicy Bypass -File $syncScript
if ($LASTEXITCODE -ne 0) {
    Write-Host "DB Sync Error! Stopping." -ForegroundColor Red
    exit
}
Write-Host "Database sync complete." -ForegroundColor Green

# 1. Start Backend
Write-Host "[1/2] Starting Backend (Flask)..." -ForegroundColor Yellow
$backendScript = Join-Path $PSScriptRoot "run_backend_dev.ps1"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy Bypass", "-File `"$backendScript`"" -WorkingDirectory $root

# 2. Start Frontend
Write-Host "[2/2] Starting Frontend (React)..." -ForegroundColor Yellow
$frontendDir = Join-Path $root "frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start" -WorkingDirectory $frontendDir

Write-Host "Done! Services started." -ForegroundColor Green
Write-Host "Remember to run deploy.ps1 when you are finished." -ForegroundColor Gray
