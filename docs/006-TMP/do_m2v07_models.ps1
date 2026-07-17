$JWT = Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\jwt.txt -Raw
$JWT = $JWT.Trim()
$hdr = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $JWT"
    "X-Trace-Id" = "trace-m2v07-models"
    "X-Tenant-Id" = "tenant-m2v07"
}
try {
    $resp = Invoke-RestMethod -Uri "http://localhost:8401/api/v1/llmgw/models" -Method GET -Headers $hdr
    $resp | ConvertTo-Json -Depth 5 | Out-File d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_models_resp.json -Encoding UTF8
    Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_models_resp.json
} catch {
    Write-Host "ERR: $($_.Exception.Message)"
}