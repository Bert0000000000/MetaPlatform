$JWT = Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\jwt.txt -Raw
$JWT = $JWT.Trim()
$hdr = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $JWT"
    "X-Trace-Id" = "trace-m2v07"
    "X-Tenant-Id" = "tenant-m2v07"
}
Write-Host "=== M2-VERIFY-07-1: create prompt ==="
$body = Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_prompt_create.json -Raw -Encoding UTF8
$resp = Invoke-RestMethod -Uri "http://localhost:8401/api/v1/llmgw/prompts" -Method POST -Headers $hdr -Body $body
$resp | ConvertTo-Json -Depth 12 | Out-File d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_create_resp.json -Encoding UTF8
Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_create_resp.json
Write-Host "`n=== M2-VERIFY-07-2: render prompt ==="
$PROMPT_ID = $resp.data.promptId
$body2 = Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_prompt_render.json -Raw -Encoding UTF8
$resp2 = Invoke-RestMethod -Uri "http://localhost:8401/api/v1/llmgw/prompts/$PROMPT_ID/render" -Method POST -Headers $hdr -Body $body2
$resp2 | ConvertTo-Json -Depth 8 | Out-File d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_render_resp.json -Encoding UTF8
Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_render_resp.json