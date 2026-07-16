# Start MetaPlatform 9-service docker stack (Trae sandbox-compatible)
# Pattern: Start-Process -WindowStyle Hidden (same as _start-app-service-detached.ps1)
# Usage: powershell -File _start-docker.ps1

Set-Location D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform

$logPath = "D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-frontend\.docker.log"
$errPath = "D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-frontend\.docker.err.log"

# 1. check docker
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    Write-Host "[start-docker] [ERROR] docker not in PATH"
    exit 1
}
$dockerVersion = & docker --version 2>&1
Write-Host "[start-docker] docker: $dockerVersion"

# 2. check daemon
$dockerInfo = & docker info 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Host "[start-docker] [ERROR] Docker daemon not running"
    Write-Host $dockerInfo
    exit 1
}
Write-Host "[start-docker] Docker daemon: OK"

# 3. start docker compose (detached)
Write-Host "[start-docker] docker compose up -d ..."
$proc = Start-Process -FilePath "docker" `
    -ArgumentList "compose","up","-d" `
    -WorkingDirectory "D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform" `
    -RedirectStandardOutput $logPath `
    -RedirectStandardError $errPath `
    -WindowStyle Hidden `
    -PassThru
Write-Host "[start-docker] PID: $($proc.Id)"

# 4. wait for compose to spawn children + pull images (if first time)
Write-Host "[start-docker] waiting 90s for first-time pull + healthcheck ..."
Start-Sleep -Seconds 90

# 5. status
Write-Host "[start-docker] docker compose ps:"
& docker compose ps 2>&1 | Out-Host

# 6. ports
Write-Host "[start-docker] port check:"
$ports = 3001,8092,5173,5432,6379,7687,9200,9000,9001,9092,8081,8123,80
foreach ($p in $ports) {
    $listen = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
    if ($listen) {
        Write-Host "  [OK]  port $p"
    } else {
        Write-Host "  [WAIT] port $p not yet"
    }
}

Write-Host "[start-docker] [DONE]"
