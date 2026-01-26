param(
  # Where to save the local dev DB
  [string]$LocalDbPath = ""
)

$ErrorActionPreference = "Stop"

function Info($msg) {
  Write-Host ""
  Write-Host "== $msg ==" -ForegroundColor Cyan
}

function Fail($msg) {
  Write-Host $msg -ForegroundColor Red
  exit 1
}

# Repo root (tools -> root)
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if ([string]::IsNullOrWhiteSpace($LocalDbPath)) {
  $LocalDbPath = Join-Path $RepoRoot "backend\database.dev.db"
}

# --- Defaults (can be overridden by deploy.config.ps1) ---
$HostName = "85.198.98.16"
$UserName = "root"
$SshKeyPath = $null

# --- Load local config (not committed) ---
$ConfigPath = Join-Path $RepoRoot "deploy.config.ps1"
if (Test-Path $ConfigPath) {
  . $ConfigPath
}

$Remote = "$UserName@$HostName"
$RemoteDbPath = "/var/lib/sabor-app/database.db"
$RemoteTmpPath = "/tmp/sabor-db-backup.db"

function SshArgs() {
  $base = @()
  if ($SshKeyPath) {
    $base += @("-i", $SshKeyPath)
  }
  # Skip host key prompt (automation-friendly)
  $base += @("-o", "StrictHostKeyChecking=accept-new")
  return $base
}

$CommonSshArgs = @(SshArgs)

Info "Checking ssh/scp on this PC"
if (-not (Get-Command "ssh" -ErrorAction SilentlyContinue)) {
  Fail "ssh not found. Install OpenSSH Client in Windows."
}
if (-not (Get-Command "scp" -ErrorAction SilentlyContinue)) {
  Fail "scp not found. Install OpenSSH Client in Windows."
}

Info "Creating DB backup on server (Python SQLite backup)"
# Create a temporary Python script locally
$LocalPyScript = Join-Path $env:TEMP "sabor_backup_temp.py"
$RemotePyScript = "/tmp/sabor_backup_temp.py"

# Build Python code line by line to avoid parser issues
$PyCode = @(
  "import sqlite3",
  "src = sqlite3.connect('$RemoteDbPath')",
  "dst = sqlite3.connect('$RemoteTmpPath')",
  "src.backup(dst)",
  "dst.close()",
  "src.close()",
  "print('Backup OK')"
) -join "`n"

Set-Content -Path $LocalPyScript -Value $PyCode -Encoding UTF8

# Upload, run, and remove the temp script
& scp @CommonSshArgs $LocalPyScript "${Remote}:${RemotePyScript}"
if ($LASTEXITCODE -ne 0) {
  Remove-Item $LocalPyScript -ErrorAction SilentlyContinue
  Fail "Failed to upload Python script to server."
}

& ssh @CommonSshArgs $Remote "python3 $RemotePyScript && rm $RemotePyScript"
Remove-Item $LocalPyScript -ErrorAction SilentlyContinue

if ($LASTEXITCODE -ne 0) {
  Fail "Failed to create backup via Python. Check SSH access and DB path."
}

Info "Downloading backup to local PC"
$LocalDir = Split-Path -Parent $LocalDbPath
if (-not (Test-Path $LocalDir)) {
  New-Item -ItemType Directory -Path $LocalDir | Out-Null
}

& scp @CommonSshArgs "${Remote}:${RemoteTmpPath}" "$LocalDbPath"
if ($LASTEXITCODE -ne 0) {
  Fail "Download error. Check SSH access and file path."
}

Info "Done"
Write-Host "Local dev DB saved to: $LocalDbPath" -ForegroundColor Green
