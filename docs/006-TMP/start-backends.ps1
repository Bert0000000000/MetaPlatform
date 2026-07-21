﻿﻿# 启动 Mate Platform 全部后端服务（开发模式）
# 依赖：Docker 基础设施已启动，PostgreSQL/Redis/Kafka 可用

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$logDir = "$root\docs\006-TMP\backend-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$javaExe = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot\bin\java.exe"
if (-not (Test-Path $javaExe)) {
    $javaCmd = Get-Command java -ErrorAction SilentlyContinue
    if ($javaCmd) { $javaExe = $javaCmd.Source }
}
if (-not $javaExe) {
    throw "Java 21 not found"
}

function Start-JavaService($name, $dir, $port) {
    $jarPattern = "$dir\target\*.jar"
    $jar = Get-ChildItem -Path $jarPattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $jar) {
        Write-Host "[$name] packaging..."
        Push-Location $dir
        try {
            & mvn package -DskipTests -q
        } finally {
            Pop-Location
        }
        $jar = Get-ChildItem -Path $jarPattern -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $jar) { throw "[$name] package failed" }
    }

    $outLog = "$logDir\$($name.ToLower())-out.log"
    $errLog = "$logDir\$($name.ToLower())-err.log"
    Write-Host "[$name] starting on port $port -> $outLog"
    $proc = Start-Process -FilePath $javaExe -ArgumentList @(
        "-jar", $jar.FullName,
        "--spring.profiles.active=dev",
        "--server.port=$port"
    ) -WorkingDirectory $dir -RedirectStandardOutput $outLog -RedirectStandardError $errLog -WindowStyle Hidden -PassThru
    return @{ Name = $name; Port = $port; Process = $proc; Log = $outLog }
}

function Start-PythonService($name, $dir, $python, $port) {
    $outLog = "$logDir\$($name.ToLower())-out.log"
    $errLog = "$logDir\$($name.ToLower())-err.log"
    Write-Host "[$name] starting on port $port -> $outLog"
    $proc = Start-Process -FilePath $python -ArgumentList @("main.py") `
        -WorkingDirectory $dir -RedirectStandardOutput $outLog -RedirectStandardError $errLog -WindowStyle Hidden -PassThru
    return @{ Name = $name; Port = $port; Process = $proc; Log = $outLog }
}

$pyProject = "$root\.venv\Scripts\python.exe"
$pyAgent   = "$root\TECH-AGENT\.venv\Scripts\python.exe"
$pyLlm     = "$root\TECH-LLMGW\.venv\Scripts\python.exe"

$wave1 = @(
    @{ Name = "TECH-IAM";   Dir = "$root\TECH-IAM";   Port = 8101; Type = "java" },
    @{ Name = "TECH-ONT";   Dir = "$root\TECH-ONT";   Port = 8201; Type = "java" },
    @{ Name = "TECH-RULE";  Dir = "$root\TECH-RULE";  Port = 8501; Type = "java" },
    @{ Name = "TECH-MSG";   Dir = "$root\TECH-MSG";   Port = 8601; Type = "java" },
    @{ Name = "TECH-EA";    Dir = "$root\TECH-EA";    Port = 8106; Type = "java" },
    @{ Name = "TECH-OBS";   Dir = "$root\TECH-OBS";   Port = 8301; Type = "java" },
    @{ Name = "TECH-LLMGW"; Dir = "$root\TECH-LLMGW"; Port = 8401; Type = "python"; Python = $pyLlm },
    @{ Name = "TECH-DATA";  Dir = "$root\TECH-DATA";  Port = 8701; Type = "python"; Python = $pyProject }
)

$wave2 = @(
    @{ Name = "TECH-WFE";   Dir = "$root\TECH-WFE";   Port = 8801; Type = "java" },
    @{ Name = "TECH-ACTION";Dir = "$root\TECH-ACTION";Port = 8104; Type = "java" },
    @{ Name = "TECH-RAG";   Dir = "$root\TECH-RAG";   Port = 8901; Type = "python"; Python = $pyProject }
)

$wave3 = @(
    @{ Name = "TECH-AGENT"; Dir = "$root\TECH-AGENT"; Port = 8511; Type = "python"; Python = $pyAgent },
    @{ Name = "TECH-A2A";   Dir = "$root\TECH-A2A";   Port = 8502; Type = "python"; Python = $pyProject },
    @{ Name = "TECH-MCP";   Dir = "$root\TECH-MCP";   Port = 8105; Type = "java" }
)

$wave4 = @(
    @{ Name = "TECH-GW";    Dir = "$root\TECH-GW";    Port = 8000; Type = "java" }
)

$jobs = @()

function Start-Wave($wave) {
    $waveJobs = @()
    foreach ($svc in $wave) {
        if ($svc.Type -eq "java") {
            $waveJobs += Start-JavaService $svc.Name $svc.Dir $svc.Port
        } else {
            $waveJobs += Start-PythonService $svc.Name $svc.Dir $svc.Python $svc.Port
        }
    }
    return $waveJobs
}

Write-Host "=== Wave 1: infra services ==="
$jobs += Start-Wave $wave1
Write-Host "Waiting 20s for Wave 1..."
Start-Sleep -Seconds 20

Write-Host "=== Wave 2: core engines ==="
$jobs += Start-Wave $wave2
Write-Host "Waiting 15s for Wave 2..."
Start-Sleep -Seconds 15

Write-Host "=== Wave 3: Agent / A2A / MCP ==="
$jobs += Start-Wave $wave3
Write-Host "Waiting 10s for Wave 3..."
Start-Sleep -Seconds 10

Write-Host "=== Wave 4: API Gateway ==="
$jobs += Start-Wave $wave4

$pidFile = "$logDir\backend-pids.json"
$jobs | ForEach-Object { [PSCustomObject]@{ name = $_.Name; pid = $_.Process.Id; port = $_.Port; log = $_.Log } } |
    ConvertTo-Json | Set-Content -Path $pidFile -Encoding UTF8

Write-Host ""
Write-Host "Backend services started. PID file: $pidFile"
Write-Host "Gateway URL: http://localhost:8000"
Write-Host ""
Write-Host 'Stop with: Stop-Process -Id PID or taskkill /PID PID /F'
