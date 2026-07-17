$JWT = Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\jwt.txt -Raw
$JWT = $JWT.Trim()
$AGENT_ID = "agt-93f605b0c6f146349f7e21e8"
$URL = "http://localhost:8501/api/v1/agent/agents/$AGENT_ID/execute"
$hdr = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $JWT"
    "X-Trace-Id" = "trace-m2v01-exec"
    "X-Tenant-Id" = "tenant-m2v01"
}
$body = Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v01_exec.json -Raw -Encoding UTF8
try {
    $resp = Invoke-RestMethod -Uri $URL -Method POST -Headers $hdr -Body $body -TimeoutSec 90
    $resp | ConvertTo-Json -Depth 16 | Out-File d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v01_exec_resp.json -Encoding UTF8
    Write-Host "STATUS=ok"
} catch {
    Write-Host "STATUS=error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.ReadToEnd() | Out-File d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v01_exec_resp.json -Encoding UTF8
    }
}
Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v01_exec_resp.json