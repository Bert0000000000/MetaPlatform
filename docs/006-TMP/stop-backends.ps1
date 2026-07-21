# 关闭 Mate Platform 全部后端服务

$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$pidFile = "$root\docs\006-TMP\backend-logs\backend-pids.json"

if (-not (Test-Path $pidFile)) {
    Write-Host "PID file not found: $pidFile"
    exit 0
}

$pids = Get-Content -Path $pidFile -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($entry in $pids) {
    $proc = Get-Process -Id $entry.pid -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "Stopping $($entry.name) (pid $($entry.pid))..."
        Stop-Process -Id $entry.pid -Force
    } else {
        Write-Host "$($entry.name) already stopped"
    }
}

Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "All backend services stopped."
