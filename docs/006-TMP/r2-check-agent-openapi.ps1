try {
    $r = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:8501/openapi.json' -TimeoutSec 5
    Write-Host 'OPENAPI paths:'
    $paths = @($r.paths.PSObject.Properties.Name)
    foreach ($p in ($paths | Sort-Object)) {
        Write-Host ("  {0}" -f $p)
    }
} catch {
    Write-Host ("ERROR: {0}" -f $_.Exception.Message)
}