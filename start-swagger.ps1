#Requires -Version 5.1
<#
.SYNOPSIS
    Serve the canonical Swagger UI / Redoc for the Mate Platform API contract.

.DESCRIPTION
    GOVERN gate (API-GOV-01): the docs pages under docs/swagger/ consume
    mate-platform-backend/contracts/openapi/generated/bundled.yaml — the
    single canonical contract bundle. Never serve a stale bundle: run the
    full contract check (redocly bundle + lint, spectral) FIRST, and abort
    instead of serving when validation fails.

    Wiring is asserted by mate-platform-backend/contracts/tests/test_docs_assets.py
    (validate-before-serve order + docs/swagger/index.html reference).

.EXAMPLE
    .\start-swagger.ps1              # validate then serve on http://localhost:8200
    .\start-swagger.ps1 -SkipCheck   # serve only (NOT recommended)

.NOTES
    Swagger UI: http://localhost:8200/docs/swagger/index.html
    Redoc:      http://localhost:8200/docs/swagger/redoc.html
#>
param(
    [switch]$SkipCheck,
    [int]$Port = 8200
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

# ---------- 1) Validate the contract before serving ----------
if (-not $SkipCheck) {
    Write-Host "== Running contract check (npm run check) ..." -ForegroundColor Cyan
    Push-Location "mate-platform-backend/contracts"
    try {
        # bundle + redocly lint + spectral lint; throws on failure
        npm run check
        if ($LASTEXITCODE -ne 0) {
            throw "npm run check failed with exit code $LASTEXITCODE - refusing to serve a stale/invalid bundle"
        }
    }
    finally {
        Pop-Location
    }
    Write-Host "== Contract check passed." -ForegroundColor Green
}

# ---------- 2) Serve docs/swagger ----------
$DocsIndex = Join-Path $ProjectRoot "docs/swagger/index.html"
if (-not (Test-Path $DocsIndex)) {
    throw "docs/swagger/index.html not found at $DocsIndex"
}

Write-Host "== Serving API docs from repository root on http://localhost:$Port" -ForegroundColor Cyan
Write-Host "   Swagger UI: http://localhost:$Port/docs/swagger/index.html"
Write-Host "   Redoc:      http://localhost:$Port/docs/swagger/redoc.html"
Write-Host "   Bundle:     /mate-platform-backend/contracts/openapi/generated/bundled.yaml"
python -m http.server $Port
