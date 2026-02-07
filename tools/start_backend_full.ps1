$ErrorActionPreference = "Stop"

# 1. Sync DB
Write-Host "[1/2] Syncing Database..." -ForegroundColor Cyan
$syncScript = Join-Path $PSScriptRoot "sync_prod_db.ps1"
powershell -ExecutionPolicy Bypass -File $syncScript

if ($LASTEXITCODE -ne 0) {
    Write-Host "Sync failed. Continuing anyway..." -ForegroundColor Yellow
}

# 2. Run Backend
Write-Host "[2/2] Starting Backend..." -ForegroundColor Cyan
$backendScript = Join-Path $PSScriptRoot "run_backend_dev.ps1"
powershell -ExecutionPolicy Bypass -File $backendScript
