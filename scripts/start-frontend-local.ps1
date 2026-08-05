#Requires -Version 5.1
<#
.SYNOPSIS
    MetaPlatform 前端本地启动 (绕过 Keycloak,使用 LEGACY_LOGIN_COMPAT=true)
.NOTES
    标准 start-dashboard-dev.ps1 在 production profile 下要求 KEYCLOAK_URL,
    本地开发无 Keycloak 时,设置 LEGACY_LOGIN_COMPAT=true 即可绕过。
#>
param(
    [switch]$Stop,
    [switch]$Status
)
$ErrorActionPreference = "Stop"
$ProjectRoot = (Split-Path -Parent $MyInvocation.MyCommand.Path)
# scripts/ is one level below project root
$ProjectRoot = Split-Path -Parent $ProjectRoot
Set-Location $ProjectRoot

$BackendRoot  = Join-Path $ProjectRoot "mate-platform-backend"
$FrontendRoot = Join-Path $ProjectRoot "metaplatform-frontend"
$DashboardDir = Join-Path $FrontendRoot "apps\web"
$VenvPython   = Join-Path $BackendRoot ".venv\Scripts\python.exe"
$IamDataDir   = Join-Path $BackendRoot ".tmp-iam-data"
$IamPort      = 8102
$DashboardPort= 9200
$IamStdout    = Join-Path $BackendRoot "stdout-iam.log"
$IamStderr    = Join-Path $BackendRoot "stderr-iam.log"
$DashboardStdout = Join-Path $FrontendRoot "dashboard-dev.log"
$DashboardStderr = Join-Path $FrontendRoot "dashboard-dev.err.log"
$IamWrapperPath  = Join-Path $BackendRoot "start_iam.py"

function Write-Banner($msg) {
    Write-Host ""
    Write-Host "================ $msg ================" -ForegroundColor Cyan
}
function Test-Port([int]$port) {
    return (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue).Count -gt 0
}
function Get-IamPid() {
    $c = Get-NetTCPConnection -LocalPort $IamPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) { return $c.OwningProcess } else { return $null }
}
function Get-DashboardPid() {
    $c = Get-NetTCPConnection -LocalPort $DashboardPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) { return $c.OwningProcess } else { return $null }
}

if ($Stop) {
    Write-Banner "Stopping local frontend dev environment"
    $pids = @()
    $pids += Get-IamPid
    $pids += Get-DashboardPid
    $pids = $pids | Where-Object { $_ }
    foreach ($p in $pids) {
        Get-Process -Id $p -ErrorAction SilentlyContinue | Stop-Process -Force
        Write-Host "  Stopped PID $p" -ForegroundColor Yellow
    }
    Write-Host "Done." -ForegroundColor Green
    exit 0
}

if ($Status) {
    Write-Banner "Frontend status"
    $ip = Get-IamPid
    if ($ip) { Write-Host "  IAM ($IamPort): running (PID $ip)" -ForegroundColor Green }
    else     { Write-Host "  IAM ($IamPort): stopped" -ForegroundColor Red }
    $dp = Get-DashboardPid
    if ($dp) { Write-Host "  Dashboard ($DashboardPort): running (PID $dp)" -ForegroundColor Green }
    else     { Write-Host "  Dashboard ($DashboardPort): stopped" -ForegroundColor Red }
    exit 0
}

# ---------- Main start ----------
Write-Banner "Starting Frontend (Mate Web) dev environment (LEGACY_LOGIN_COMPAT=true)"

foreach ($p in @((Get-IamPid), (Get-DashboardPid)) | Where-Object { $_ }) {
    Get-Process -Id $p -ErrorAction SilentlyContinue | Stop-Process -Force
}
Start-Sleep -Seconds 1

if (-not (Test-Path $VenvPython)) {
    Write-Host "Python venv not found at $VenvPython" -ForegroundColor Red
    exit 1
}

# Inject LEGACY_LOGIN_COMPAT=true so mate-platform/auth skips KEYCLOAK_URL requirement
$wrapper = @"
import os
os.environ['IAM_DATA_DIR'] = r'$IamDataDir'
os.environ['LEGACY_LOGIN_COMPAT'] = 'true'
os.environ['INSECURE_SKIP_SIGNATURE'] = 'true'
import sys
sys.path.insert(0, r'$BackendRoot\packages\mate-tech-iam\src')
sys.path.insert(0, r'$BackendRoot\packages\mate-common\src')
import uvicorn
uvicorn.run('mate_tech_iam.main:app', host='127.0.0.1', port=$IamPort)
"@
[System.IO.File]::WriteAllText($IamWrapperPath, $wrapper, (New-Object System.Text.UTF8Encoding($False)))

Write-Host "[1/2] Starting mate-tech-iam (port $IamPort) [LEGACY mode] ..." -ForegroundColor Yellow
$iamProc = Start-Process -FilePath $VenvPython `
    -ArgumentList @("$IamWrapperPath") `
    -WorkingDirectory $BackendRoot `
    -RedirectStandardOutput $IamStdout `
    -RedirectStandardError $IamStderr `
    -WindowStyle Hidden `
    -PassThru

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Port $IamPort) { $ready = $true; break }
}
if (-not $ready) {
    Write-Host "IAM failed to start within 30s. Check $IamStderr" -ForegroundColor Red
    Get-Content $IamStderr | Select-Object -Last 30 | Write-Host
    exit 1
}
Write-Host "  OK IAM ready (PID $($iamProc.Id))" -ForegroundColor Green

if (-not (Test-Path (Join-Path $DashboardDir "node_modules"))) {
    Write-Host "Frontend node_modules missing. Run: cd $DashboardDir && pnpm install" -ForegroundColor Red
    exit 1
}

Write-Host "[2/2] Starting Vite (port $DashboardPort) ..." -ForegroundColor Yellow
$dashProc = Start-Process -FilePath "node" `
    -ArgumentList @("./node_modules/vite/bin/vite.js", "--host", "0.0.0.0", "--port", "$DashboardPort", "--strictPort") `
    -WorkingDirectory $DashboardDir `
    -RedirectStandardOutput $DashboardStdout `
    -RedirectStandardError $DashboardStderr `
    -WindowStyle Hidden `
    -PassThru

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Port $DashboardPort) { $ready = $true; break }
}
if (-not $ready) {
    Write-Host "Frontend failed to start within 30s. Check $DashboardStderr" -ForegroundColor Red
    exit 1
}
Write-Host "  OK Dashboard ready (PID $($dashProc.Id))" -ForegroundColor Green

Write-Banner "Started"
Write-Host "  Dashboard: http://localhost:$DashboardPort" -ForegroundColor Cyan
Write-Host "  IAM:       http://localhost:$IamPort" -ForegroundColor Cyan
Write-Host "  Swagger:   http://localhost:$IamPort/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "  IAM account: admin / admin123" -ForegroundColor Yellow
Write-Host ""
Write-Host "Stop:  .\scripts\start-frontend-local.ps1 -Stop" -ForegroundColor Green