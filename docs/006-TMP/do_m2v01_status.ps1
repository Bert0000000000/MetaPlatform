$JWT = Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\jwt.txt -Raw
$JWT = $JWT.Trim()
$hdr = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $JWT"
    "X-Trace-Id" = "trace-m2v01-list"
    "X-Tenant-Id" = "tenant-m2v01"
}
# list agents to confirm creation succeeded
$resp = Invoke-RestMethod -Uri "http://localhost:8501/api/v1/agent/agents?page=1&pageSize=20" -Method GET -Headers $hdr
$resp | ConvertTo-Json -Depth 12 | Out-File d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v01_list_resp.json -Encoding UTF8
Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v01_list_resp.json