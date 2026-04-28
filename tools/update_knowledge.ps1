$ErrorActionPreference = "Stop"

# Repo root (tools -> root)
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

Push-Location $RepoRoot
try {
  python tools/update_knowledge.py
}
finally {
  Pop-Location
}

