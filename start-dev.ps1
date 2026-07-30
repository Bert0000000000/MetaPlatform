#Requires -Version 5.1
<#
.SYNOPSIS
    MetaPlatform 一键按场景启动开发环境 (PowerShell)

.DESCRIPTION
    根据当前要改的服务，按 profile 起最小依赖集。
    用法:
        .\start-dev.ps1                   # 交互菜单
        .\start-dev.ps1 -Profile rag      # 起 RAG 开发环境
        .\start-dev.ps1 -Profile full     # 全量
        .\start-dev.ps1 -Stop             # 停掉所有容器
        .\start-dev.ps1 -Status           # 看内存占用

.EXAMPLE
    .\start-dev.ps1 -Profile rag -Native
    # 只起基础设施 + 用本机 venv 跑 mate-tech-rag（推荐）

.NOTES
    Cowork ↔ Claude Code 任务交接入口：docs/handoff/（inbox / outbox）
#>
param(
    [Parameter()]
    [ValidateSet("infra","iam","events","ai","obs","workflow","rag","agent",
                 "kb","llmgw","ont","msg","mcp","gateway","full","")]
    [string]$Profile = "",

    [switch]$Stop,
    [switch]$Status,
    [switch]$Native,    # Python 服务用本机 venv 跑（不依赖容器）
    [switch]$NoBuild,
    [switch]$Help
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

# ---------- 帮助 ----------
if ($Help) {
    Get-Help $MyInvocation.MyCommand.Path -Full | Out-String | Write-Host
    exit 0
}

# ---------- 工具函数 ----------
function Write-Banner($msg) {
    Write-Host ""
    Write-Host "================ $msg ================" -ForegroundColor Cyan
}

function Get-ComposeProfiles([string]$p) {
    # 大多数服务需要基础设施
    $base = @("infra")
    switch ($p) {
        "full"     { return @("full") }
        "infra"    { return @("infra") }
        "iam"      { return @("infra","iam") }
        "events"   { return @("infra","events") }
        "ai"       { return @("infra","ai") }
        "obs"      { return @("infra","obs") }
        "workflow" { return @("infra","events","workflow") }
        "rag"      { return @("infra","rag") }
        "agent"    { return @("infra","agent") }
        "kb"       { return @("infra","kb") }
        "llmgw"    { return @("infra","llmgw") }
        "ont"      { return @("infra","graph","ont") }
        "msg"      { return @("infra","events","msg") }
        "mcp"      { return @("infra","mcp") }
        "gateway"  { return @("infra","gateway") }
        default    { return @() }
    }
}

function Show-Menu {
    Write-Host "MetaPlatform 开发环境快速启动" -ForegroundColor Green
    Write-Host ""
    Write-Host "  [1]  RAG 服务        (infra + rag)" -ForegroundColor White
    Write-Host "  [2]  Agent 服务      (infra + agent)" -ForegroundColor White
    Write-Host "  [3]  KB 业务聚合     (infra + kb)" -ForegroundColor White
    Write-Host "  [4]  LLM Gateway     (infra + llmgw)" -ForegroundColor White
    Write-Host "  [5]  Ontology 引擎   (infra + graph + ont)" -ForegroundColor White
    Write-Host "  [6]  IAM / 鉴权      (infra + iam)" -ForegroundColor White
    Write-Host "  [7]  工作流引擎      (infra + events + workflow)" -ForegroundColor White
    Write-Host "  [8]  消息中心        (infra + events + msg)" -ForegroundColor White
    Write-Host "  [9]  MCP 协议        (infra + mcp)" -ForegroundColor White
    Write-Host "  [10] 可观测栈        (infra + obs)" -ForegroundColor White
    Write-Host "  [11] AI 服务(RagFlow)(infra + ai)" -ForegroundColor White
    Write-Host "  [12] 仅基础设施      (infra)" -ForegroundColor White
    Write-Host "  [13] 全量(CI/冒烟)   (full)" -ForegroundColor White
    Write-Host "  [0]  退出" -ForegroundColor DarkGray
    Write-Host ""
    $choice = Read-Host "选择 [0-13]"
    $map = @{
        "1"="rag"; "2"="agent"; "3"="kb"; "4"="llmgw"; "5"="ont"
        "6"="iam"; "7"="workflow"; "8"="msg"; "9"="mcp"; "10"="obs"
        "11"="ai"; "12"="infra"; "13"="full"; "0"=""
    }
    return $map[$choice]
}

# ---------- 主流程 ----------
if ($Status) {
    Write-Banner "容器内存占用"
    docker stats --no-stream --format "table {{.Name}}`t{{.MemUsage}}`t{{.MemPerc}}" |
        Sort-Object @{Expression={$_}} |
        Out-String | Write-Host
    Write-Banner "WSL2 内存"
    wsl -e free -h 2>$null | Out-String | Write-Host
    exit 0
}

if ($Stop) {
    Write-Banner "停止所有容器"
    docker compose down
    Write-Host "✓ done" -ForegroundColor Green
    exit 0
}

if (-not $Profile) {
    $Profile = Show-Menu
    if (-not $Profile) { exit 0 }
}

$profiles = Get-ComposeProfiles $Profile
if ($profiles.Count -eq 0) {
    Write-Host "未知 profile: $Profile" -ForegroundColor Red
    exit 1
}

Write-Banner "启动 profile = $Profile"
Write-Host ("profiles: " + ($profiles -join ", ")) -ForegroundColor Yellow

$profileArgs = ($profiles | ForEach-Object { "--profile"; $_ })

$upArgs = @("compose") + $profileArgs + @("up", "-d")
if ($NoBuild) { $upArgs += "--no-build" }

& docker @upArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ docker compose 启动失败" -ForegroundColor Red
    exit 1
}

Write-Banner "已启动"
docker compose --profile $Profile ps --format "table {{.Name}}`t{{.Status}}`t{{.Ports}}" | Out-String | Write-Host

Write-Banner "任务交接"
Write-Host "Cowork 方案入站: docs/handoff/inbox/" -ForegroundColor Green
Write-Host "Claude Code 回执:  docs/handoff/outbox/" -ForegroundColor Green

# 提示 Python 服务可裸跑
$pyMap = @{
    "rag"="8001"; "agent"="8002"; "kb"="8003"; "llmgw"="8008"
    "ont"="8007"; "msg"="8006"; "mcp"="8081"
}
if ($pyMap.ContainsKey($Profile) -and $Native) {
    $port = $pyMap[$Profile]
    Write-Banner "裸跑 Python 服务（热重载）"
    Write-Host "cd mate-platform-backend" -ForegroundColor Green
    Write-Host ".venv\Scripts\Activate.ps1" -ForegroundColor Green
    Write-Host "uvicorn services.${Profile}.main:app --reload --port $port" -ForegroundColor Green
}
