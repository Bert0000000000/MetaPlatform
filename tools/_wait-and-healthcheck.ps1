# Wait for app-service ready
Write-Host "Waiting 20 seconds for app-service to start..."
Start-Sleep -Seconds 20
try {
    $r = Invoke-RestMethod -Uri 'http://localhost:8092/actuator/health' -TimeoutSec 5
    Write-Host ("health: " + $r.status)
} catch {
    Write-Host ("not ready: " + $_.Exception.Message)
}