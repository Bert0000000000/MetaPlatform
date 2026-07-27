# Restart TECH-MCP cleanly
# Kill any old java on port 8105
$old = Get-NetTCPConnection -LocalPort 8105 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $old) {
    Write-Host "Killing old MCP PID $($c.OwningProcess)..."
    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

# Start fresh
$jvmArgs = '-Dspring.cloud.compatibility-verifier.enabled=false -Xms256m -Xmx512m'
$argString = "spring-boot:run -Dspring-boot.run.profiles=dev -Dspring-boot.run.jvmArguments=`"$jvmArgs`""

Write-Host "Starting TECH-MCP..."
$p = Start-Process -FilePath mvn -ArgumentList $argString -WorkingDirectory 'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-MCP' -WindowStyle Hidden -RedirectStandardOutput 'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-MCP\stdout.log' -RedirectStandardError 'd:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\TECH-MCP\stderr.log' -PassThru
Write-Host "  PID $($p.Id)"
