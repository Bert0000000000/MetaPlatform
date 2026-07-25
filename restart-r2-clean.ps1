# R2 6 服务重新启动脚本（R5 修后验证用）
$jvmArgs = '-Dspring.cloud.compatibility-verifier.enabled=false -Xms256m -Xmx512m'
$argString = "spring-boot:run -Dspring-boot.run.profiles=dev -Dspring-boot.run.jvmArguments=`"$jvmArgs`""

$services = @(
    @{ name = "TECH-LLMGW"; port = 8210 },
    @{ name = "TECH-RAG";   port = 8901 },
    @{ name = "TECH-DATA";  port = 8701 },
    @{ name = "TECH-MCP";   port = 8105 },
    @{ name = "TECH-A2A";   port = 8502 },
    @{ name = "TECH-AGENT"; port = 8511 }
)

$repoRoot = 'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform'

foreach ($svc in $services) {
    $name = $svc.name
    $port = $svc.port
    $path = Join-Path $repoRoot $name

    $portCheck = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($portCheck) {
        Write-Host "[$name] SKIP port $port" -ForegroundColor Yellow
        continue
    }

    Write-Host "[$name] Starting on port $port" -ForegroundColor White
    $p = Start-Process -FilePath mvn -ArgumentList $argString -WorkingDirectory $path -WindowStyle Hidden -RedirectStandardOutput "$path\stdout.log" -RedirectStandardError "$path\stderr.log" -PassThru
    Write-Host "[$name] PID $($p.Id)"
    Start-Sleep -Seconds 10
}
Write-Host "Done. Wait 60-90s for all to start."
