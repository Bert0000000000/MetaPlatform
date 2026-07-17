# 启动 Mate Platform 四个前端开发服务器
# 用法：右键 PowerShell 执行，或在终端运行 .\docs\006-TMP\start-frontends.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$apps = @(
    @{ Name = "ONTSTUDIO"; Dir = "$root\APP-ONTSTUDIO"; Port = 9101 },
    @{ Name = "APPHUB";    Dir = "$root\APP-APPHUB";    Port = 9201 },
    @{ Name = "SUPERAI";   Dir = "$root\APP-SUPERAI";   Port = 9301 },
    @{ Name = "DW";        Dir = "$root\APP-DW";        Port = 9401 }
)

$logDir = "$root\docs\006-TMP\frontend-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$jobs = @()
foreach ($app in $apps) {
    $logFile = "$logDir\$($app.Name.ToLower())-dev.log"
    Write-Host "启动 $($app.Name) (port $($app.Port)) -> $logFile"
    $proc = Start-Process -FilePath "npm" -ArgumentList "run", "dev" `
        -WorkingDirectory $app.Dir `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError $logFile `
        -WindowStyle Hidden -PassThru
    $jobs += @{ Name = $app.Name; Port = $app.Port; Process = $proc; Log = $logFile }
}

# 保存 PID 文件便于后续关闭
$pidFile = "$logDir\frontend-pids.json"
$jobs | ForEach-Object { [PSCustomObject]@{ name = $_.Name; pid = $_.Process.Id; port = $_.Port; log = $_.Log } } |
    ConvertTo-Json | Set-Content -Path $pidFile -Encoding UTF8

Write-Host ""
Write-Host "前端服务已启动，PID 文件：$pidFile"
Write-Host "访问地址："
foreach ($j in $jobs) {
    Write-Host "  $($j.Name): http://localhost:$($j.Port)"
}
Write-Host ""
Write-Host "关闭服务请运行： .\stop-frontends.ps1"
