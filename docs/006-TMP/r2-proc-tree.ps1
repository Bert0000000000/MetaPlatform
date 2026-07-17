param([int]$RootPid = 0)
Write-Host ("Inspecting process tree rooted at PID {0}" -f $RootPid)
$queue = @($RootPid)
$visited = @{}
while ($queue.Count -gt 0) {
    $p = $queue[0]
    $queue = $queue | Select-Object -Skip 1
    if ($visited.ContainsKey($p)) { continue }
    $visited[$p] = $true
    $info = Get-CimInstance Win32_Process -Filter ("ProcessId = " + $p)
    if ($null -eq $info) { continue }
    Write-Host ("  pid={0} ppid={1} name={2} cmd={3}" -f $info.ProcessId, $info.ParentProcessId, $info.Name, $info.CommandLine)
    $children = Get-CimInstance Win32_Process -Filter ("ParentProcessId = " + $p)
    foreach ($c in $children) {
        if (-not $visited.ContainsKey([int]$c.ProcessId)) {
            $queue += ,[int]$c.ProcessId
        }
    }
}