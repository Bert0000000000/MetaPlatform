# =============================================================================
# MetaPlatform Python 服务构建脚本
# -----------------------------------------------------------------------------
# 用法:
#   .\scripts\build-tech.ps1                  # 默认顺序构建全部 5 个
#   .\scripts\build-tech.ps1 -Services llmgw  # 只构建指定服务
#   .\scripts\build-tech.ps1 -Parallel        # 并行构建 (需 docker buildx)
#   .\scripts\build-tech.ps1 -NoCache         # 强制无缓存
# =============================================================================

param(
    [string[]]$Services = @("llmgw", "ont", "msg", "mcp", "obs"),
    [switch]$Parallel,
    [switch]$NoCache
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

$serviceMap = @{
    "llmgw" = @{ Port = 8008; Module = "mate_tech_llmgw.main" }
    "ont"   = @{ Port = 8007; Module = "mate_tech_ont.main" }
    "msg"   = @{ Port = 8082; Module = "mate_tech_msg.main" }
    "msgp"  = @{ Port = 8081; Module = "mate_tech_mcp.main" }
    "obs"   = @{ Port = 8083; Module = "mate_tech_obs.main" }
}

# 修正 mcp 键名拼写
$serviceMap["mcp"] = $serviceMap["msgp"]
$serviceMap.Remove("msgp")

$cacheFlag = if ($NoCache) { "--no-cache" } else { "" }
$total = $Services.Count
$start = Get-Date

function Build-One {
    param($svc)
    if (-not $serviceMap.ContainsKey($svc)) {
        Write-Host "❌ Unknown service: $svc" -ForegroundColor Red
        Write-Host "   Available: $($serviceMap.Keys -join ', ')"
        return $false
    }
    Write-Host "`n[$svc] 构建开始 ($(Get-Date -Format 'HH:mm:ss'))" -ForegroundColor Cyan
    $tag = "mate-tech-$svc"
    $cmd = "docker build $cacheFlag -f packages/mate-tech-$svc/Dockerfile -t ${tag}:dev ."
    Write-Host "  $cmd" -ForegroundColor Gray
    Invoke-Expression $cmd
    if ($LASTEXITCODE -eq 0) {
        $dur = (Get-Date) - $script:start
        Write-Host "✅ [$svc] 完成 (总耗时 $($dur.ToString('mm\:ss')))" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ [$svc] 失败 (exit=$LASTEXITCODE)" -ForegroundColor Red
        return $false
    }
}

if ($Parallel) {
    Write-Host "=== 并行构建: $($Services -join ', ') ===" -ForegroundColor Yellow
    $jobs = $Services | ForEach-Object {
        Start-ThreadJob -ScriptBlock {
            param($s)
            Set-Location $using:root
            Build-One -svc $s
        } -ArgumentList $_ -ThrottleLimit 3
    }
    $jobs | Wait-Job | Receive-Job
} else {
    Write-Host "=== 顺序构建: $($Services -join ', ') ===" -ForegroundColor Yellow
    $i = 0
    foreach ($svc in $Services) {
        $i++
        Write-Host "`n[$i/$total] $svc" -ForegroundColor Yellow
        if (-not (Build-One -svc $svc)) { break }
    }
}

$totalDur = (Get-Date) - $start
Write-Host "`n=== 总耗时: $($totalDur.ToString('mm\:ss')) ===" -ForegroundColor Cyan