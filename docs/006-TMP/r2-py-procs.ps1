Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" |
    Where-Object { $_.CommandLine -match 'TECH-(LLMGW|AGENT|RAG|MCP)' } |
    ForEach-Object {
        Write-Host ("pid={0} cmd={1}" -f $_.ProcessId, $_.CommandLine)
    }