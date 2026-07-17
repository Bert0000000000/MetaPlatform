param([int]$Port = 0, [string]$BasePath = '/health')
try {
    $url = "http://127.0.0.1:$Port$BasePath"
    $r = Invoke-RestMethod -Method Get -Uri $url -TimeoutSec 5
    Write-Host ("[{0}] {1} -> {2}" -f $Port, $url, ($r | ConvertTo-Json -Compress))
} catch {
    Write-Host ("[{0}] {1} -> ERROR: {2}" -f $Port, $url, $_.Exception.Message)
}