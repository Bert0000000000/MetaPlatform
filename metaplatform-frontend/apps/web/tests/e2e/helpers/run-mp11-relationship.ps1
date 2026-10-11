param([switch]$KeepHelpers)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../../../../..')).Path
$webRoot = Join-Path $repoRoot 'metaplatform-frontend/apps/web'
$logs = Join-Path $webRoot 'tests/e2e/.artifacts/codex-mp11-relationship-runner'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
foreach($port in @(55498,55499)) {
  if(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw "Test port $port is occupied" }
}
$containerData = @(docker inspect codex-mp11-relationship-pg | ConvertFrom-Json)[0]
if($LASTEXITCODE -ne 0 -or $containerData.State.Status -ne 'running') { throw 'Dedicated MP11 PG unavailable' }
$bindings = @($containerData.NetworkSettings.Ports.'5432/tcp')
if($bindings.Count -ne 1 -or $bindings[0].HostIp -ne '127.0.0.1' -or $bindings[0].HostPort -ne '55497') { throw 'Unexpected PG binding' }
$pgConfig = @{}
foreach($entry in $containerData.Config.Env) { $parts=$entry.Split('=',2); $pgConfig[$parts[0]]=$parts[1] }
if($pgConfig.POSTGRES_DB -ne 'codex_mp11_relationship') { throw 'Unexpected test container' }
$testDb = 'codex_mp11_ui_' + [guid]::NewGuid().ToString('N')
docker exec codex-mp11-relationship-pg createdb -U $pgConfig.POSTGRES_USER $testDb
if($LASTEXITCODE -ne 0) { throw 'Unable to create dedicated UI database' }
$env:MP11_RELATIONSHIP_PG_DSN = 'postgresql://' + [Uri]::EscapeDataString($pgConfig.POSTGRES_USER) + ':' + [Uri]::EscapeDataString($pgConfig.POSTGRES_PASSWORD) + '@127.0.0.1:55497/' + $testDb
$env:MP11_UI_TENANT = 'mp11-ui-' + [guid]::NewGuid().ToString('N')
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:PYTHONPATH = ((Get-ChildItem -LiteralPath (Join-Path $repoRoot 'mate-platform-backend/packages') -Directory | ForEach-Object {
  $candidate=Join-Path $_.FullName 'src'; if(Test-Path -LiteralPath $candidate -PathType Container) { $candidate }
}) -join [IO.Path]::PathSeparator)
$env:KEYCLOAK_URL='http://localhost:8080'
$env:KEYCLOAK_REALM='metaplatform'
$env:KEYCLOAK_AUDIENCE='metaplatform-backend'
$env:SERVICE_CLIENT_ID='metaplatform-backend'
$env:INSECURE_SKIP_SIGNATURE='1'
$env:SERVICE_CLIENT_SECRET=[guid]::NewGuid().ToString('N')
$env:VITE_BACKEND_PORT='55498'
$python=Join-Path $repoRoot 'mate-platform-backend/.venv/Scripts/python.exe'
$apiProcess=$null; $viteProcess=$null
try {
  $apiProcess=Start-Process -FilePath $python -ArgumentList @((Join-Path $PSScriptRoot 'mp11-relationship-api.py')) -WorkingDirectory $repoRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'api.stdout.log') -RedirectStandardError (Join-Path $logs 'api.stderr.log') -PassThru
  $viteCli=Join-Path $repoRoot 'metaplatform-frontend/node_modules/vite/bin/vite.js'
  $viteProcess=Start-Process -FilePath (Get-Command node).Source -ArgumentList @($viteCli,'--config','tests/e2e/mp11-vite.config.ts') -WorkingDirectory $webRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'vite.stdout.log') -RedirectStandardError (Join-Path $logs 'vite.stderr.log') -PassThru
  $ready=$false
  for($i=0;$i -lt 60;$i++) {
    Start-Sleep -Milliseconds 500
    try {
      $health=Invoke-RestMethod -Uri 'http://127.0.0.1:55498/healthz' -TimeoutSec 1
      $web=Invoke-WebRequest -Uri 'http://127.0.0.1:55499' -TimeoutSec 1
      if($health.scope -eq 'mp11-isolated-test-api' -and $web.StatusCode -eq 200) { $ready=$true; break }
    } catch { }
    if($apiProcess.HasExited -or $viteProcess.HasExited) { throw 'Test helper exited; inspect guarded runner logs' }
  }
  if(-not $ready) { throw 'Test helpers not ready' }
  Write-Output ('Dedicated helper PIDs: API=' + $apiProcess.Id + ', Vite=' + $viteProcess.Id + '; PG=55497/' + $testDb + '; tenant=' + $env:MP11_UI_TENANT)
  Push-Location $webRoot
  try { pnpm exec playwright test --config tests/e2e/mp11-relationship.config.ts; $testCode=$LASTEXITCODE } finally { Pop-Location }
  if($testCode -ne 0) { throw "Relationship E2E failed: exit $testCode" }
} finally {
  if(-not $KeepHelpers) {
    foreach($helper in @($apiProcess,$viteProcess)) {
      if($helper -and -not $helper.HasExited) { taskkill /PID $helper.Id /T /F | Out-Null }
    }
    if($testDb -match '^codex_mp11_ui_[0-9a-f]{32}$') {
      docker exec codex-mp11-relationship-pg dropdb -U $pgConfig.POSTGRES_USER --if-exists --force $testDb
    }
  }
}
