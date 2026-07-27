# 验证 R2 6 服务是否全部注册到 Nacos 3.0+
# 用法：.\verify-r2-nacos.ps1
$ErrorActionPreference = "Stop"

Write-Host "=== R2 6 服务 Nacos 注册验证 ===" -ForegroundColor Cyan
Write-Host ""

$services = @(
    @{ name = "tech-llmgw";        port = 8210 },
    @{ name = "tech-rag";          port = 8901 },
    @{ name = "mate-data-server";  port = 8701 },
    @{ name = "tech-mcp";          port = 8105 },
    @{ name = "mate-a2a-server";   port = 8502 },
    @{ name = "mate-agent-server"; port = 8511 }
)

# 1. Nacos 命名空间元数据
$namespace = "metaplatform"
$pass = 0; $fail = 0

# 2. 端口监听检查
Write-Host "[1/3] 端口监听检查：" -ForegroundColor White
foreach ($svc in $services) {
    $port = $svc.port
    $name = $svc.name
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Host "  ✅ $name (port $port) - PID $($conn.OwningProcess)" -ForegroundColor Green
        $pass++
    } else {
        Write-Host "  ❌ $name (port $port) - NOT LISTENING" -ForegroundColor Red
        $fail++
    }
}
Write-Host ""

# 3. Health endpoint 检查
Write-Host "[2/3] Spring Boot Actuator /actuator/health：" -ForegroundColor White
foreach ($svc in $services) {
    $port = $svc.port
    $name = $svc.name
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:$port/actuator/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        $body = $resp.Content | ConvertFrom-Json
        $status = $body.status
        if ($status -eq "UP") {
            Write-Host "  ✅ $name - UP" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  $name - $status" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ❌ $name - $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

# 4. Nacos 服务列表（v3 API）
Write-Host "[3/3] Nacos 服务列表（namespace=$namespace）：" -ForegroundColor White
try {
    $listResp = Invoke-WebRequest -Uri "http://localhost:8848/nacos/v3/ns/service/list?namespaceId=$namespace&groupName=DEFAULT_GROUP&pageNo=1&pageSize=20" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    $listBody = $listResp.Content | ConvertFrom-Json
    $registered = @($listBody.data.items | ForEach-Object { $_.serviceName })
    foreach ($svc in $services) {
        if ($registered -contains $svc.name) {
            Write-Host "  ✅ $($svc.name) registered in Nacos" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $($svc.name) NOT registered (got: $($registered -join ', '))" -ForegroundColor Red
        }
    }
} catch {
    # 兜底 v2 API
    try {
        $listResp = Invoke-WebRequest -Uri "http://localhost:8848/nacos/v1/ns/service/list?namespaceId=$namespace&pageNo=1&pageSize=20" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        $listBody = $listResp.Content | ConvertFrom-Json
        $registered = @($listBody.doms)
        foreach ($svc in $services) {
            if ($registered -contains $svc.name) {
                Write-Host "  ✅ $($svc.name) registered in Nacos" -ForegroundColor Green
            } else {
                Write-Host "  ❌ $($svc.name) NOT registered (got: $($registered -join ', '))" -ForegroundColor Red
            }
        }
    } catch {
        Write-Host "  ❌ Nacos service list failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== 验证完成 ===" -ForegroundColor Cyan
