# Start all Mate Platform frontend dev servers

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$apps = @(
    @{ Name = "DASHBOARD"; Dir = "$root\APP-DASHBOARD"; Port = 9202 },
    @{ Name = "ONTSTUDIO"; Dir = "$root\APP-ONTSTUDIO"; Port = 9101 },
    @{ Name = "APPHUB";    Dir = "$root\APP-APPHUB";    Port = 9201 },
    @{ Name = "SUPERAI";   Dir = "$root\APP-SUPERAI";   Port = 9301 },
    @{ Name = "DW";        Dir = "$root\APP-DW";        Port = 9401 },
    @{ Name = "ARCH";      Dir = "$root\APP-ARCH";      Port = 9206 },
    @{ Name = "MCPHUB";    Dir = "$root\APP-MCPHUB";    Port = 9501 }
)

$logDir = "$root\docs\006-TMP\frontend-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$jobs = @()
foreach ($app in $apps) {
    $logFile = "$logDir\$($app.Name.ToLower())-dev.log"
    Write-Host "Starting $($app.Name) (port $($app.Port)) -> $logFile"
    $cmd = "npm run dev > `"$logFile`" 2>&1"
    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", $cmd) `
        -WorkingDirectory $app.Dir -WindowStyle Hidden -PassThru
    $jobs += @{ Name = $app.Name; Port = $app.Port; Process = $proc; Log = $logFile }
}

$pidFile = "$logDir\frontend-pids.json"
$jobs | ForEach-Object { [PSCustomObject]@{ name = $_.Name; pid = $_.Process.Id; port = $_.Port; log = $_.Log } } |
    ConvertTo-Json | Set-Content -Path $pidFile -Encoding UTF8

Write-Host ""
Write-Host "Frontend services started. PID file: $pidFile"
Write-Host "URLs:"
foreach ($j in $jobs) {
    Write-Host "  $($j.Name): http://localhost:$($j.Port)"
}
Write-Host ""
Write-Host 'Stop with: .\stop-frontends.ps1'
