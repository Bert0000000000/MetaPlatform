$env:DB_USER='meta'
$env:DB_PASSWORD='meta'
$services = @(
  @{ name = 'TECH-LLMGW'; port = 8210; appName = 'tech-llmgw' },
  @{ name = 'TECH-RAG';   port = 8901; appName = 'tech-rag' },
  @{ name = 'TECH-DATA';  port = 8701; appName = 'mate-data-server' },
  @{ name = 'TECH-MCP';   port = 8105; appName = 'tech-mcp' },
  @{ name = 'TECH-A2A';   port = 8502; appName = 'mate-a2a-server' },
  @{ name = 'TECH-ONT';   port = 8201; appName = 'tech-ont' }
)
$repoRoot = 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform'
$logDir = Join-Path $repoRoot 'acceptance\logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
foreach ($svc in $services) {
  $name = $svc.name
  $port = $svc.port
  $path = Join-Path $repoRoot $name
  if (-not (Test-Path (Join-Path $path 'pom.xml'))) {
    Write-Host "[$name] SKIP - no pom.xml"
    continue
  }
  $existing = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "[$name] ALREADY_UP on $port"
    continue
  }
  $logPath = Join-Path $logDir ($name + '.log')
  Write-Host "[$name] Starting on $port -> $logPath"
  Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command',"Set-Location '$path'; & mvn spring-boot:run '-Dspring-boot.run.profiles=dev' '-Dspring-boot.run.jvmArguments=-Dspring.cloud.compatibility-verifier.enabled=false' *> '$logPath'") -WindowStyle Hidden | Out-Null
  Start-Sleep -Seconds 3
}
