param([int]$ProcessId = 0)
try {
    Stop-Process -Id $ProcessId -Force
    Write-Host ("PID {0} stopped" -f $ProcessId)
} catch {
    Write-Host ("Failed to stop PID {0}: {1}" -f $ProcessId, $_.Exception.Message)
}