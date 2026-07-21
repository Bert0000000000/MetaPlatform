# Stop frontend dev servers started by start-frontends.ps1
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$pidFile = "$root\docs\006-TMP\frontend-logs\frontend-pids.json"

if (-not (Test-Path $pidFile)) {
    Write-Host "PID file not found: $pidFile" -ForegroundColor Yellow
    exit 0
}

$pids = Get-Content -Path $pidFile -Encoding UTF8 | ConvertFrom-Json
foreach ($entry in $pids) {
    try {
        $proc = Get-Process -Id $entry.pid -ErrorAction Stop
        Stop-Process -Id $entry.pid -Force
        Write-Host "Stopped $($entry.name) (PID $($entry.pid))"
    } catch {
        Write-Host "$($entry.name) (PID $($entry.pid)) already gone"
    }
}

Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "Frontend services cleaned up"
