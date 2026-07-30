#Requires -Version 5.1
param(
    [switch]$Stop,
    [switch]$Status,
    [switch]$E2E,
    [switch]$Help
)$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot
$BackendRoot = Join-Path $ProjectRoot "mate-platform-backend"
$FrontendRoot = Join-Path $ProjectRoot "metaplatform-frontend"
$DashboardDir = Join-Path $FrontendRoot "apps\web"
$VenvPython = Join-Path $BackendRoot ".venv\Scripts\python.exe"
$IamDataDir = Join-Path $BackendRoot ".tmp-iam-data"
$IamPort = 8102
$DashboardPort = 9200
$IamStdout = Join-Path $BackendRoot "stdout-iam.log"
$IamStderr = Join-Path $BackendRoot "stderr-iam.log"
$DashboardStdout = Join-Path $FrontendRoot "dashboard-dev.log"
$DashboardStderr = Join-Path $FrontendRoot "dashboard-dev.err.log"
$IamWrapperPath = Join-Path $BackendRoot "start_iam.py"
function Write-Banner([string]$msg) {
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

if ($Help) {
    Get-Help $MyInvocation.MyCommand.Path -Full | Out-String | Write-Host
    exit 0
}

if ($Stop) {
    Write-Banner "Stopping Dashboard dev environment"
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
    if ($ip) {
        Write-Host "  IAM ($IamPort): running (PID $ip)" -ForegroundColor Green
    } else {
        Write-Host "  IAM ($IamPort): stopped" -ForegroundColor Red
    }
    $dp = Get-DashboardPid
    if ($dp) {
        Write-Host "  Frontend ($DashboardPort): running (PID $dp)" -ForegroundColor Green
    } else {
        Write-Host "  Frontend ($DashboardPort): stopped" -ForegroundColor Red
    }
    exit 0
}

if ($E2E) {
    Write-Banner "End-to-end joint debug verification"
    $loginResp = Invoke-WebRequest -Uri "http://localhost:$DashboardPort/api/v1/iam/auth/login" -Method Post -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}' -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    $tok = ""
    if ($loginResp) { $tok = ($loginResp.Content | ConvertFrom-Json).accessToken }
    $ah = if ($tok) { @{ "Authorization" = "Bearer $tok" } } else { @{} }
    $pass = 0; $fail = 0
    function Run([string]$n, [string]$u, [string]$m="GET", [string]$b="", [hashtable]$h=@{}) {
        try {
            $allHdrs = @{"Content-Type" = "application/json"}
            foreach ($k in $h.Keys) { $allHdrs[$k] = $h[$k] }
            $ba = @{"Uri" = $u; "Method" = $m; "Headers" = $allHdrs; "UseBasicParsing" = $true; "TimeoutSec" = 10}
            if ($m -in @("POST","PUT","DELETE") -and $b) { $ba["Body"] = $b }
            $resp = Invoke-WebRequest @ba -ErrorAction Stop
            $s = $resp.StatusCode
            if ($s -eq 200 -or $s -eq 204) { Write-Host "[OK] $n -> $s" -ForegroundColor Green; $script:pass++ }
            else { Write-Host "[??] $n -> $s" -ForegroundColor Yellow; $script:fail++ }
        } catch {
            $err = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.Value__ } else { "?" }
            Write-Host "[FAIL] $n -> $err" -ForegroundColor Red; $script:fail++
        }
    }
    Run "POST /auth/login"           "http://localhost:$DashboardPort/api/v1/dashboard/auth/login"   "POST" '{"username":"admin","password":"admin"}'
    Run "GET  /profile"              "http://localhost:$DashboardPort/api/v1/dashboard/profile"
    Run "GET  /profile/permissions"  "http://localhost:$DashboardPort/api/v1/dashboard/profile/permissions"
    Run "GET  /settings"             "http://localhost:$DashboardPort/api/v1/dashboard/settings?userId=u-1"
    Run "PUT  /settings"             "http://localhost:$DashboardPort/api/v1/dashboard/settings"   "PUT"  '{"theme":"light"}'
    Run "GET  /sessions"             "http://localhost:$DashboardPort/api/v1/dashboard/sessions"
    Run "GET  /api-keys"             "http://localhost:$DashboardPort/api/v1/dashboard/api-keys"
    Run "POST /api-keys"             "http://localhost:$DashboardPort/api/v1/dashboard/api-keys"  "POST" '{"name":"e2e"}'
    Run "GET  /notifications"        "http://localhost:$DashboardPort/api/v1/dashboard/notifications?status=all&limit=10"
    Run "GET  /notifications/unread-count" "http://localhost:$DashboardPort/api/v1/dashboard/notifications/unread-count"
    Run "GET  /notifications/settings" "http://localhost:$DashboardPort/api/v1/dashboard/notifications/settings"
    Run "PUT  /notifications/settings" "http://localhost:$DashboardPort/api/v1/dashboard/notifications/settings" "PUT" '{"approval":true,"task":true,"system":false,"mention":true,"alert":true,"email":false,"push":true,"userId":"u-1"}'
    Run "GET  /metrics"              "http://localhost:$DashboardPort/api/v1/dashboard/metrics"
    Run "GET  /metrics/trend"        "http://localhost:$DashboardPort/api/v1/dashboard/metrics/trend?range=24h"
    Run "GET  /todos"                "http://localhost:$DashboardPort/api/v1/dashboard/todos"
    Run "GET  /todos/done"           "http://localhost:$DashboardPort/api/v1/dashboard/todos/done"
    Run "POST /todos/action"         "http://localhost:$DashboardPort/api/v1/dashboard/todos/t-9002/action" "POST" '{"action":"approve"}'
    Run "GET  /workers"              "http://localhost:$DashboardPort/api/v1/dashboard/workers"
    Run "GET  /deliverables"         "http://localhost:$DashboardPort/api/v1/dashboard/deliverables"
    Run "POST /deliverables/download" "http://localhost:$DashboardPort/api/v1/dashboard/deliverables/d-1/download" "POST" '{"format":"pdf"}'
    Run "GET  /anomalies"            "http://localhost:$DashboardPort/api/v1/dashboard/anomalies"
    Run "GET  /anomalies/{id}"       "http://localhost:$DashboardPort/api/v1/dashboard/anomalies/an-1"
    Run "POST /anomalies/analyze"    "http://localhost:$DashboardPort/api/v1/dashboard/anomalies/an-1/analyze" "POST" '{}'
    Run "POST /anomalies/remediate"  "http://localhost:$DashboardPort/api/v1/dashboard/anomalies/an-1/remediate" "POST" '{"mode":"ADVISE"}'
    Run "GET  /anomaly-rules"        "http://localhost:$DashboardPort/api/v1/dashboard/anomaly-rules"
    Run "POST /anomaly-rules"        "http://localhost:$DashboardPort/api/v1/dashboard/anomaly-rules" "POST" '{"name":"E2E-R","metricType":"ERROR_RATE","conditionOperator":">","threshold":1,"timeWindowSeconds":60,"aggregationFunction":"avg","severity":"INFO","enabled":true}'
    Run "GET  /search"               "http://localhost:$DashboardPort/api/v1/dashboard/search?keyword=app"
    Run "POST /iam/auth/login"       "http://localhost:$DashboardPort/api/v1/iam/auth/login" "POST" '{"username":"admin","password":"admin123"}'
    Run "GET  /iam/auth/me"          "http://localhost:$DashboardPort/api/v1/iam/auth/me" "GET" "" $ah
    Run "GET  /admin/users"          "http://localhost:$DashboardPort/api/v1/admin/users" "GET" "" $ah
    Run "GET  /admin/permissions/catalog" "http://localhost:$DashboardPort/api/v1/admin/permissions/catalog" "GET" "" $ah
    Write-Host ""
    Write-Host "=== TOTAL: $pass passed, $fail failed ===" -ForegroundColor Cyan
    exit 0
}

# Main start flow
Write-Banner "Starting Frontend (Mate Web) dev environment"
foreach ($p in @((Get-IamPid), (Get-DashboardPid)) | Where-Object { $_ }) {
    Get-Process -Id $p -ErrorAction SilentlyContinue | Stop-Process -Force
}
Start-Sleep -Seconds 1
if (-not (Test-Path $VenvPython)) {
    Write-Host "Python venv not found at $VenvPython" -ForegroundColor Red
    exit 1
}
$wrapper = @"
import os
os.environ['IAM_DATA_DIR'] = r'$IamDataDir'
import sys
sys.path.insert(0, r'$BackendRoot\packages\mate-tech-iam\src')
sys.path.insert(0, r'$BackendRoot\packages\mate-common\src')
import uvicorn
uvicorn.run('mate_tech_iam.main:app', host='127.0.0.1', port=$IamPort)
"@
[System.IO.File]::WriteAllText($IamWrapperPath, $wrapper, (New-Object System.Text.UTF8Encoding($False)))
Write-Host "[1/2] Starting mate-tech-iam (port $IamPort) ..." -ForegroundColor Yellow
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
    exit 1
}
Write-Host "  OK IAM ready (PID $($iamProc.Id))" -ForegroundColor Green
if (-not (Test-Path (Join-Path $DashboardDir "node_modules"))) {
    Write-Host " Frontend node_modules missing. Run: cd $DashboardDir && pnpm install" -ForegroundColor Red
    exit 1
}
Write-Host "[2/2] Starting @mate/dashboard Vite (port $DashboardPort) ..." -ForegroundColor Yellow
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
    Write-Host "Frontend (Mate Web) failed to start within 30s. Check $DashboardStderr" -ForegroundColor Red
    exit 1
}
Write-Host "  OK Dashboard ready (PID $($dashProc.Id))" -ForegroundColor Green
Write-Banner "Started"
Write-Host "  Dashboard: http://localhost:$DashboardPort" -ForegroundColor Cyan
Write-Host "  IAM:       http://localhost:$IamPort" -ForegroundColor Cyan
Write-Host "  Swagger:   http://localhost:$IamPort/docs" -ForegroundColor Cyan
Write-Host "  Vite proxy: /api/v1/{dashboard,iam,admin} -> $IamPort" -ForegroundColor Cyan
Write-Host ""
Write-Host "  IAM account: admin / admin123" -ForegroundColor Yellow
Write-Host "  Workbench: any user / pass (mock)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next: .\start-dashboard-dev.ps1 -E2E" -ForegroundColor Green
