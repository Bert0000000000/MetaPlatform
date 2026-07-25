# 批量启动 TECH-* 服务脚本
$ErrorActionPreference = "Stop"

# 配置：要启动的服务
$services = @(
    @{ name = "TECH-OBS"; port = 8301 },
    @{ name = "TECH-WFE"; port = 8202 },
    @{ name = "TECH-MSG"; port = 8102 },
    @{ name = "TECH-LLMGW"; port = 8301 },  # 待确认
    @{ name = "TECH-RAG"; port = 8901 },
    @{ name = "TECH-AGENT"; port = 8401 },
    @{ name = "TECH-ACTION"; port = 8104 },
    @{ name = "TECH-ONT"; port = 8201 },
    @{ name = "TECH-DATA"; port = 8701 }
)

# 已运行的端口
$runningPorts = @(8101)

foreach ($svc in $services) {
    $name = $svc.name
    $port = $svc.port
    $path = "d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\$name"

    if (-not (Test-Path "$path\pom.xml")) {
        Write-Host "[$name] SKIP - no pom.xml"
        continue
    }

    if ($runningPorts -contains $port) {
        Write-Host "[$name] SKIP - port $port in use"
        continue
    }

    # 检查端口是否已被占用
    $portCheck = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($portCheck) {
        Write-Host "[$name] SKIP - port $port already in use"
        continue
    }

    Write-Host "[$name] Starting on port $port..."

    # 用 Start-Process 启动服务
    $proc = Start-Process -FilePath "mvn" `
        -ArgumentList @("spring-boot:run", "-Dspring-boot.run.profiles=dev", "-Dspring-boot.run.jvmArguments=-Dspring.cloud.compatibility-verifier.enabled=false") `
        -WorkingDirectory $path `
        -WindowStyle Hidden `
        -RedirectStandardOutput "$path\stdout.log" `
        -RedirectStandardError "$path\stderr.log" `
        -PassThru

    Write-Host "[$name] Started PID $($proc.Id)"
}
