# 一键启动前端服务、执行全平台冒烟测试、自动关闭服务
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

& "$PSScriptRoot\start-frontends.ps1"

Write-Host ""
Write-Host "等待前端服务就绪 (15s)..."
Start-Sleep -Seconds 15

$python = "C:\Users\houuu\AppData\Local\Python\pythoncore-3.14-64\python.exe"
$smokeScript = "$root\docs\006-TMP\tmp-20260717-full-platform-smoke-test.py"
$logFile = "$root\docs\006-TMP\smoke-run.log"

Write-Host "执行冒烟测试..."
try {
    & $python $smokeScript | Tee-Object -FilePath $logFile
} finally {
    Write-Host ""
    Write-Host "关闭前端服务..."
    & "$PSScriptRoot\stop-frontends.ps1"
}

Write-Host ""
Write-Host "冒烟测试完成，结果文件：$root\docs\006-TMP\smoke-result.json"
Write-Host "日志文件：$logFile"
