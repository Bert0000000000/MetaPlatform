# Stop app-service running on port 8092
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -eq 8092 } | ForEach-Object {
    Write-Host ("Stopping PID " + $_.OwningProcess)
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2
$remaining = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 8092 }
if ($remaining) {
    Write-Host "WARN: port 8092 still listening"
} else {
    Write-Host "port 8092 freed"
}