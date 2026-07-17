param([int]$ProcessId = 0)
$p = Get-CimInstance Win32_Process -Filter ("ProcessId = " + $ProcessId)
if ($null -eq $p) {
    Write-Host ("PID {0} not found" -f $ProcessId)
    return
}
Write-Host ("PID {0} CommandLine: {1}" -f $p.ProcessId, $p.CommandLine)
Write-Host ("PID {0} CreationDate: {1}" -f $p.ProcessId, $p.CreationDate)