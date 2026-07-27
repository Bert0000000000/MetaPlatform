# 停止 R2 6 个服务（按 start-r2-services.ps1 反序）
$ErrorActionPreference = "Stop"

$ports = @(8511, 8502, 8105, 8701, 8901, 8210)

foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $pid_ = $conn.OwningProcess
        Write-Host "Killing PID $pid_ on port $port..."
        Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "Port $port : no listener"
    }
}

# 同时清理 mvn spring-boot:run 进程
$mvnProcs = Get-Process -Name "mvn" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*spring-boot:run*"
}
foreach ($p in $mvnProcs) {
    Write-Host "Killing mvn spring-boot:run PID $($p.Id)"
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
}

Write-Host "Done."
