# 关闭由 start-frontends.ps1 启动的前端开发服务器
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$pidFile = "$root\docs\006-TMP\frontend-logs\frontend-pids.json"

if (-not (Test-Path $pidFile)) {
    Write-Host "未找到 PID 文件：$pidFile" -ForegroundColor Yellow
    exit 0
}

$pids = Get-Content -Path $pidFile -Encoding UTF8 | ConvertFrom-Json
foreach ($entry in $pids) {
    try {
        $proc = Get-Process -Id $entry.pid -ErrorAction Stop
        Stop-Process -Id $entry.pid -Force
        Write-Host "已停止 $($entry.name) (PID $($entry.pid))"
    } catch {
        Write-Host "$($entry.name) (PID $($entry.pid)) 已不存在"
    }
}

Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "前端服务已清理"
