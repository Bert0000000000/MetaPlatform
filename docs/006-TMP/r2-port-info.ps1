param([int]$Port = 0)
Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
    ForEach-Object {
        $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        Write-Host ("port={0} pid={1} proc={2} start={3}" -f $_.LocalPort, $_.OwningProcess, $proc.ProcessName, $proc.StartTime)
    }