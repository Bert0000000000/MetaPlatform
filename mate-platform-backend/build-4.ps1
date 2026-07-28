$ErrorActionPreference = "Continue"
$env:OPENAI_API_KEY = "placeholder"
Set-Location "D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\mate-platform-backend"
$logDir = "build-logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

foreach ($svc in @("mcp","obs","msg","llmgw")) {
    $logFile = "$logDir\$svc.log"
    $logErr = "$logDir\$svc.err"
    Write-Host "Building $svc..."
    docker build -f "packages/mate-tech-$svc/Dockerfile" -t "mate-tech-$svc:dev" . *> $logFile 2> $logErr
    $rc = $LASTEXITCODE
    $tail = Get-Content $logFile -Tail 3 -ErrorAction SilentlyContinue
    if ($rc -eq 0) { Write-Host "  $svc OK" -ForegroundColor Green }
    else { Write-Host "  $svc FAIL (exit=$rc)" -ForegroundColor Red; Write-Host "  tail: $tail" }
}