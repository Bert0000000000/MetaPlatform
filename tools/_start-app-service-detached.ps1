# Build jar and launch as detached java process
Set-Location D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-app-service
. D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\tools\use-maven-3.9.9.ps1

# 1. package
Write-Host "Building jar..."
mvn --% -q -DskipTests package 2>&1 | Select-Object -Last 5

$jar = Get-ChildItem -Path target -Filter 'metaplatform-app-service-*.jar' | Where-Object { $_.Name -notmatch '\.original$' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $jar) { Write-Host "jar not found"; exit 1 }
Write-Host ("jar = " + $jar.FullName)

# 2. launch detached
$env:SPRING_PROFILES_ACTIVE = 'dev'
$logPath = 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-app-service\.dev.log'
Start-Process -FilePath 'java' `
    -ArgumentList '-Xms512m','-Xmx1024m','-jar', $jar.FullName `
    -RedirectStandardOutput $logPath `
    -RedirectStandardError "$logPath.err" `
    -WindowStyle Hidden
Write-Host "started detached pid unknown"
Start-Sleep -Seconds 5
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -eq 8092 } | Select-Object LocalPort, OwningProcess | Format-Table -AutoSize