# start-swagger.ps1
# 一键启动 Swagger UI 聚合页（聚合 mate-platform 所有 OpenAPI yaml）
# 访问 http://localhost:8200

param(
    [int]$Port = 8200,
    [string]$SpecDir = "docs\swagger"
)

$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$specPath = Join-Path $root $SpecDir

if (-not (Test-Path $specPath)) {
    Write-Error "Swagger UI dir not found: $specPath"
    exit 1
}

# 检查 yaml 数量
$yamls = Get-ChildItem -Path $specPath\specs -Filter *.yaml -ErrorAction SilentlyContinue
if ($yamls.Count -lt 11) {
    Write-Host "WARNING: 期望 11 个 yaml, 实际找到 $($yamls.Count) 个" -ForegroundColor Yellow
}

Write-Host "Swagger UI 聚合页:" -ForegroundColor Cyan
Write-Host "  dir: $specPath"
Write-Host "  url: http://localhost:$Port"
Write-Host "  specs: $($yamls.Count)"
Write-Host ""

# 检查端口占用
$used = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($used) {
    Write-Warning "Port $Port 已被占用 (PID=$($used.OwningProcess))。将尝试切换到 8201"
    $Port = 8201
}

# 切换目录并启动
Push-Location $specPath
try {
    Write-Host "Starting python -m http.server $Port ..." -ForegroundColor Green
    Write-Host "Ctrl+C 停止`n"
    python -m http.server $Port
} finally {
    Pop-Location
}
