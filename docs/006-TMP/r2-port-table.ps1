$ports = @(8401,8501,8901,8104,8201,8502,8105)
foreach ($port in $ports) {
    Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | ForEach-Object {
        $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        Write-Host ("port={0} pid={1} proc={2} start={3} path={4}" -f $_.LocalPort, $_.OwningProcess, $p.ProcessName, $p.StartTime, $p.Path)
    }
}