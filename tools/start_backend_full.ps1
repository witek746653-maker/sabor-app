$ErrorActionPreference = "Stop"

# 1. Sync DB
Write-Host "[1/2] Syncing Database..." -ForegroundColor Cyan
$syncScript = Join-Path $PSScriptRoot "sync_prod_db.ps1"
try {
    powershell -ExecutionPolicy Bypass -File $syncScript
} catch {
    Write-Host "Sync failed with error. Skipping..." -ForegroundColor Yellow
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "Sync process exited with code $LASTEXITCODE. Continuing to run local backend..." -ForegroundColor Yellow
}

# 2. Run Backend
Write-Host "[2/2] Starting Backend..." -ForegroundColor Cyan
$backendScript = Join-Path $PSScriptRoot "run_backend_dev.ps1"
powershell -ExecutionPolicy Bypass -File $backendScript

