$ports = @(8101,8201,8501,8601,8106,8301,8401,8701,8801,8104,8901,8511,8502,8105,8000)
foreach ($p in $ports) {
    $c = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
    if ($c) {
        $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
        Write-Host ('port={0} pid={1} proc={2}' -f $p, $c.OwningProcess, $proc.ProcessName)
    } else {
        Write-Host ('port={0} NOT LISTENING' -f $p)
    }
}
