param(
  [switch]$SkipBuild,
  [switch]$SkipMigrate,
  [switch]$SkipUpload,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Info($msg) {
  Write-Host ""
  Write-Host "== $msg ==" -ForegroundColor Cyan
}

function Run($exe, $argList) {
  if ($null -eq $argList) {
    $argList = @()
  }
  Write-Host ""
  Write-Host ("> " + $exe + " " + ($argList -join " ")) -ForegroundColor DarkGray

  if ($DryRun) {
    Write-Host "[DRY RUN] skipped execution" -ForegroundColor Yellow
    return
  }

  # Важно: Start-Process часто ломает аргументы с пробелами/кавычками.
  # Call operator (&) корректно передает массив аргументов в exe.
  & $exe @argList
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed (exit code $LASTEXITCODE): $exe"
  }
}

# --- Настройки по умолчанию (можно переопределить через deploy.config.ps1) ---
$HostName = "85.198.98.16"
$UserName = "root"
$RemoteRoot = "/var/www/sabor-app"
$ServiceName = "sabor.service"
$SshKeyPath = $null

# --- Sentry (frontend): опционально, ТОЛЬКО ошибки ---
# Важно:
# - Эти значения лучше держать в deploy.config.ps1 (он НЕ коммитится).
# - Мы подставляем их только на время "npm run build".
# Пример для deploy.config.ps1:
#   $FrontendSentryEnabled = "true"
#   $FrontendSentryDsn = "https://....@....ingest.sentry.io/...."
$FrontendSentryEnabled = $null
$FrontendSentryDsn = $null

# --- Подхватываем локальный конфиг (НЕ коммитится) ---
$ConfigPath = Join-Path $PSScriptRoot "deploy.config.ps1"
if (Test-Path $ConfigPath) {
  . $ConfigPath
}

$Remote = "$UserName@$HostName"
$RemoteScpPrefix = "${UserName}@${HostName}:${RemoteRoot}"

function SshArgs() {
  $base = @()
  if ($SshKeyPath) {
    $base += @("-i", $SshKeyPath)
  }
  # Don't prompt host key confirmation (good for one-button runs)
  $base += @("-o", "StrictHostKeyChecking=accept-new")
  return $base
}


$CommonSshArgs = @(SshArgs)

Info "Check Split JSON files (data/)"
$menuFiles = @("menu-kitchen.json", "menu-wine.json", "menu-bar.json", "menu-tea.json")
$publicDataDir = Join-Path $PSScriptRoot "frontend\public\data"
if (!(Test-Path $publicDataDir)) {
  New-Item -ItemType Directory -Path $publicDataDir | Out-Null
}

foreach ($f in $menuFiles) {
    $path = Join-Path $PSScriptRoot "data\$f"
    if (Test-Path $path) {
        # Validate JSON
        Run "node" @("-e", "const fs=require('fs'); JSON.parse(fs.readFileSync('$($path.Replace('\','/'))','utf8')); console.log('OK: $f');")
        # Sync to frontend/public for fallback
        Copy-Item -Force $path (Join-Path $publicDataDir $f)
    } else {
        Write-Host "Warning: $f not found" -ForegroundColor Yellow
}

Info "Sync images into frontend/public"
$sourceImages = Join-Path $PSScriptRoot "images"
$publicImagesDir = Join-Path $PSScriptRoot "frontend\public\images"
if (Test-Path $sourceImages) {
    if (!(Test-Path $publicImagesDir)) {
      New-Item -ItemType Directory -Path $publicImagesDir | Out-Null
    }
    Copy-Item -Force -Recurse (Join-Path $sourceImages "*") $publicImagesDir
}

Info "Sync content into frontend/public (legacy check)"
$sourceContent = Join-Path $PSScriptRoot "content"
if (Test-Path $sourceContent) {
    $publicContentDir = Join-Path $PSScriptRoot "frontend\public\content"
    if (!(Test-Path $publicContentDir)) {
      New-Item -ItemType Directory -Path $publicContentDir | Out-Null
    }
    Copy-Item -Force -Recurse (Join-Path $sourceContent "*") $publicContentDir
} else {
    Write-Host "Skipping content sync: 'content' folder no longer exists." -ForegroundColor Gray
}

if (-not $SkipBuild) {
  Info "Build frontend (npm run build)"
  Push-Location (Join-Path $PSScriptRoot "frontend")
  try {
    # npm ci: deterministic install from package-lock.json
    Run "npm" @("ci")

    # Подставляем Sentry DSN в сборку (если задано в deploy.config.ps1)
    $prevSentryEnabled = $env:REACT_APP_SENTRY_ENABLED
    $prevSentryDsn = $env:REACT_APP_SENTRY_DSN
    try {
      if (-not [string]::IsNullOrWhiteSpace($FrontendSentryDsn)) {
        $env:REACT_APP_SENTRY_DSN = $FrontendSentryDsn
        if ([string]::IsNullOrWhiteSpace($FrontendSentryEnabled)) {
          $env:REACT_APP_SENTRY_ENABLED = "true"
        } else {
          $env:REACT_APP_SENTRY_ENABLED = $FrontendSentryEnabled
        }
        Write-Host "Sentry (frontend): enabled for build" -ForegroundColor DarkGray
      } else {
        Write-Host "Sentry (frontend): DSN not set, skipping" -ForegroundColor DarkGray
      }

      Run "npm" @("run", "build")
    } finally {
      # Восстанавливаем окружение (чтобы не “залипало” в текущем PowerShell)
      $env:REACT_APP_SENTRY_ENABLED = $prevSentryEnabled
      $env:REACT_APP_SENTRY_DSN = $prevSentryDsn
    }
  } finally {
    Pop-Location
  }
} else {
  Info "Frontend build skipped (-SkipBuild)"
}

Info "Upload files to server (scp)"

if ($SkipUpload) {
  Info "Upload skipped (-SkipUpload)"
} else {
  # 1) Данные меню (все JSON файлы)
  $jsonItems = Get-ChildItem (Join-Path $PSScriptRoot "data") -Filter "*.json" | ForEach-Object { $_.FullName }
  Run "ssh" ($CommonSshArgs + @($Remote, "sudo mkdir -p $RemoteRoot/data"))
  Run "scp" ($CommonSshArgs + $jsonItems + @("${RemoteScpPrefix}/data/"))
  Start-Sleep -Seconds 2


  # 2) Бэкенд (весь необходимый код)
  # Используем список файлов и папок, чтобы случайно не залить локальную базу database.db или .env
  $backendItems = @(
    "app.py", "app_factory.py", "models.py", "config.py", "extensions.py", 
    "utils.py", "migrate_to_db.py", "requirements.txt", "wsgi.py",
    "routes", "services", "private"
  ) | ForEach-Object { Join-Path $PSScriptRoot ("backend\" + $_) }

  Run "ssh" ($CommonSshArgs + @($Remote, "sudo rm -rf $RemoteRoot/backend/* && sudo mkdir -p $RemoteRoot/backend"))
  
  Run "scp" ($CommonSshArgs + @("-r") + $backendItems + @("${RemoteScpPrefix}/backend/"))
  Start-Sleep -Seconds 2

  # 3) Фронтенд build (если не пропущен)
  if (-not $SkipBuild) {
    $buildPath = Join-Path $PSScriptRoot "frontend\build"
    # Важно: scp НЕ удаляет старые файлы на сервере.
    # Поэтому "мусор" от прошлых сборок (например, старые PDF в /menus/) может остаться и продолжать открываться.
    # KISS-решение: перед загрузкой удаляем старую папку build на сервере.
    Run "ssh" ($CommonSshArgs + @($Remote, "sudo rm -rf $RemoteRoot/frontend/build && sudo mkdir -p $RemoteRoot/frontend"))
    Start-Sleep -Seconds 2
    Run "scp" ($CommonSshArgs + @("-r", $buildPath, "${RemoteScpPrefix}/frontend/"))
    Start-Sleep -Seconds 2
  }
}

if (-not $SkipMigrate) {
  Info "Migrate DB on server (JSON -> SQLite)"
  if ($SkipUpload) {
    Write-Host "Skipping migrate because -SkipUpload is set (no guarantee server has updated JSON/scripts)." -ForegroundColor Yellow
  } else {
    Start-Sleep -Seconds 3
    Run "ssh" ($CommonSshArgs + @($Remote, "cd $RemoteRoot && PYTHONPATH=. ./venv/bin/python3 backend/migrate_to_db.py --yes"))
  }
} else {
  Info "DB migration skipped (-SkipMigrate)"
}

Info "Restart service ($ServiceName)"
if ($SkipUpload) {
  Write-Host "Skipping restart because -SkipUpload is set." -ForegroundColor Yellow
} else {
  Start-Sleep -Seconds 3
  Run "ssh" ($CommonSshArgs + @($Remote, "sudo systemctl restart $ServiceName"))
}

Info "Quick check (open in browser)"
Write-Host "Open in browser:" -ForegroundColor Green
Write-Host "  - https://sabor-dlv.ru/api/menus"
Write-Host "  - https://sabor-dlv.ru/api/wines"
Write-Host "  - https://sabor-dlv.ru/api/bar-items"
Write-Host "  - https://sabor-dlv.ru/"

Write-Host ""
Write-Host "Done." -ForegroundColor Green
