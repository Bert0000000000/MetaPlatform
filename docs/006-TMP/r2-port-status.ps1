param([int]$Port = 0, [int]$WaitSec = 0)
if ($WaitSec -gt 0) { Start-Sleep -Seconds $WaitSec }
$conns = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if ($conns.Count -eq 0) {
    Write-Host ("port={0} NOT_LISTENING" -f $Port)
} else {
    foreach ($c in $conns) {
        Write-Host ("port={0} pid={1}" -f $c.LocalPort, $c.OwningProcess)
    }
}