# 启动 R2 阶段 6 个核心 TECH-* 服务
# ----------------------------------------------------
# 适用阶段：v1.3 重构期 R2（6 服务骨架 + Nacos 3.0+）
# 创建于 2026-07-24
#
# 前置：
#   1. docker compose up -d         # 启动 postgres + redis + nacos 3.0+
#   2. curl -sf http://localhost:8848/nacos  # 确认 Nacos Console 起来
#
# 启动顺序（按依赖）：
#   LLMGW (8210) → RAG (8901) → DATA (8701) → MCP (8105) → A2A (8502) → AGENT (8511)
#
# 端口分配表（已在 application.yml 锁定）：
#   TECH-LLMGW  8210  tech-llmgw         LLM 统一网关
#   TECH-MCP    8105  tech-mcp           MCP Server/Client
#   TECH-A2A    8502  mate-a2a-server    A2A 协议层
#   TECH-RAG    8901  tech-rag           RAG 检索
#   TECH-DATA   8701  mate-data-server   数据集成
#   TECH-AGENT  8511  mate-agent-server  Agent 运行时
#
# 验证：
#   1. Nacos Console: http://localhost:8848/nacos  (nacos/nacos)
#      应看到 6 个服务注册到 metaplatform 命名空间
#   2. 健康检查：curl http://localhost:8210/actuator/health 等
#
# 停止：
#   .\stop-r2-services.ps1
# ----------------------------------------------------

$ErrorActionPreference = "Stop"

# 配置：要启动的服务（按依赖顺序）
$services = @(
    @{ name = "TECH-LLMGW"; port = 8210; appName = "tech-llmgw" },
    @{ name = "TECH-RAG";   port = 8901; appName = "tech-rag" },
    @{ name = "TECH-DATA";  port = 8701; appName = "mate-data-server" },
    @{ name = "TECH-MCP";   port = 8105; appName = "tech-mcp" },
    @{ name = "TECH-A2A";   port = 8502; appName = "mate-a2a-server" },
    @{ name = "TECH-AGENT"; port = 8511; appName = "mate-agent-server" }
)

$repoRoot = "d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform"

# 0. 前置：检查 Nacos 3.0+ 是否已启动
Write-Host "=== R2 启动前检查 ===" -ForegroundColor Cyan
$nacosHealth = $null
try {
    $nacosResp = Invoke-WebRequest -Uri "http://localhost:8848/nacos/v3/console/health/readiness" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($nacosResp.StatusCode -eq 200) {
        $nacosHealth = $true
    }
} catch {
    try {
        # 兜底用 v1 API
        $nacosResp = Invoke-WebRequest -Uri "http://localhost:8848/nacos/v1/console/health/readiness" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ($nacosResp.StatusCode -eq 200) {
            $nacosHealth = $true
        }
    } catch {
        Write-Host "[Nacos] 不可达 http://localhost:8848 — 请先 'docker compose up -d' 启动" -ForegroundColor Red
        exit 1
    }
}
if ($nacosHealth) {
    Write-Host "[Nacos] OK 8848 8848/9848/9849 — Nacos 3.0+ 健康" -ForegroundColor Green
}

# 1. 启动服务
Write-Host ""
Write-Host "=== 启动 R2 6 个服务（按依赖顺序） ===" -ForegroundColor Cyan
Write-Host ""

foreach ($svc in $services) {
    $name = $svc.name
    $port = $svc.port
    $appName = $svc.appName
    $path = Join-Path $repoRoot $name

    if (-not (Test-Path "$path\pom.xml")) {
        Write-Host "[$name] SKIP - no pom.xml at $path" -ForegroundColor Yellow
        continue
    }

    # 检查端口是否已被占用
    $portCheck = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($portCheck) {
        Write-Host "[$name] SKIP - port $port already in use (PID $($portCheck.OwningProcess))" -ForegroundColor Yellow
        continue
    }

    Write-Host "[$name] Starting on port $port (spring.application.name=$appName)..." -ForegroundColor White

    # 注意：Start-Process -ArgumentList 数组会被按空格 split，导致
    # `-Xms256m -Xmx512m` 被误识为独立 Maven 阶段（"ms256m" 报 Unknown phase）。
    # 解决：把整段当一个引号包起来的字符串传入 PowerShell 自己处理。
    $jvmArgs = "-Dspring.cloud.compatibility-verifier.enabled=false -Xms256m -Xmx512m"
    $argString = "spring-boot:run -Dspring-boot.run.profiles=dev -Dspring-boot.run.jvmArguments=`"$jvmArgs`""

    $proc = Start-Process -FilePath "mvn" `
        -ArgumentList $argString `
        -WorkingDirectory $path `
        -WindowStyle Hidden `
        -RedirectStandardOutput "$path\stdout.log" `
        -RedirectStandardError "$path\stderr.log" `
        -PassThru

    Write-Host "[$name] Started PID $($proc.Id) — logs: $path\stdout.log" -ForegroundColor Green

    # 间隔 8s 启动下一个，让上一个先把端口占住
    Start-Sleep -Seconds 8
}

Write-Host ""
Write-Host "=== R2 启动指令已全部下发 ===" -ForegroundColor Cyan
Write-Host "等待 30-60s 让所有服务注册到 Nacos，然后访问：" -ForegroundColor White
Write-Host "  Nacos Console:    http://localhost:8848/nacos (nacos/nacos)" -ForegroundColor White
Write-Host "  LLMGW 健康检查:   curl http://localhost:8210/actuator/health" -ForegroundColor White
Write-Host "  RAG 健康检查:     curl http://localhost:8901/actuator/health" -ForegroundColor White
Write-Host "  AGENT 健康检查:   curl http://localhost:8511/actuator/health" -ForegroundColor White
Write-Host ""
Write-Host "日志位置：每个服务的 stdout.log / stderr.log" -ForegroundColor Gray
Write-Host "停止服务：.\stop-r2-services.ps1" -ForegroundColor Gray
