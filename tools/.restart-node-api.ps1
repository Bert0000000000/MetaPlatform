# Restart metaplatform-api (Node.js, port 3001) in detached mode
$logOut = 'C:\Users\Public\node-api.log'
$logErr = 'C:\Users\Public\node-api.err.log'
$apiDir = 'D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-api'

# Ensure no stale log
foreach ($p in @($logOut, $logErr)) { if (Test-Path $p) { Remove-Item $p -Force } }

# Start detached via cmd.exe (Trae sandbox-friendly pattern, same as vite)
Start-Process -FilePath 'cmd.exe' -ArgumentList "/c","cd /d $apiDir && node src/index.js > $logOut 2> $logErr" -WindowStyle Hidden

# Wait & report
Start-Sleep -Seconds 4
$pid_ = (Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
$status = if ($pid_) { "UP (pid=$pid_)" } else { "DOWN" }
$outSize = if (Test-Path $logOut) { (Get-Item $logOut).Length } else { -1 }
$errSize = if (Test-Path $logErr) { (Get-Item $logErr).Length } else { -1 }
Write-Output "STATUS=$status"
Write-Output "LOG_OUT=$logOut (size=$outSize)"
Write-Output "LOG_ERR=$logErr (size=$errSize)"