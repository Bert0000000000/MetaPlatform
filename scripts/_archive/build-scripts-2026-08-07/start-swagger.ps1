param([int]$Port = 8200)
$ErrorActionPreference = "Stop"
$Workspace = Split-Path -Parent $MyInvocation.MyCommand.Path
$Contracts = Join-Path $Workspace "mate-platform-backend\contracts"

Push-Location $Contracts
try {
  npm ci
  npm run check
} finally {
  Pop-Location
}

Write-Host "Swagger: http://localhost:$Port/docs/swagger/index.html" -ForegroundColor Cyan
Push-Location $Workspace
try {
  python -m http.server $Port
} finally {
  Pop-Location
}
