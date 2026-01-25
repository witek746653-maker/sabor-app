param(
  # Путь к dev-базе
  [string]$DbPath = ""
)

$ErrorActionPreference = "Stop"

function Info($msg) {
  Write-Host ""
  Write-Host "== $msg ==" -ForegroundColor Cyan
}

# Путь к корню репозитория (tools -> корень)
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if ([string]::IsNullOrWhiteSpace($DbPath)) {
  $DbPath = Join-Path $RepoRoot "backend\database.dev.db"
}

Info "Запуск локального backend с dev-базой"
$env:SABOR_DB_PATH = $DbPath
Write-Host "SABOR_DB_PATH = $env:SABOR_DB_PATH" -ForegroundColor DarkGray

Push-Location (Join-Path $RepoRoot "backend")
try {
  # Запускаем Flask-приложение
  python app.py
} finally {
  Pop-Location
}
