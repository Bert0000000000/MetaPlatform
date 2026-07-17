$JWT = Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\jwt.txt -Raw
$JWT = $JWT.Trim()
Write-Host "JWT_PREFIX=$($JWT.Substring(0,30))..."
$hdr = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $JWT"
    "X-Trace-Id" = "trace-m2v01-create"
    "X-Tenant-Id" = "tenant-m2v01"
}
$body = Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v01_create.json -Raw -Encoding UTF8
$resp = Invoke-RestMethod -Uri "http://localhost:8501/api/v1/agent/agents" -Method POST -Headers $hdr -Body $body
$resp | ConvertTo-Json -Depth 12 | Out-File d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v01_create_resp.json -Encoding UTF8
Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v01_create_resp.json