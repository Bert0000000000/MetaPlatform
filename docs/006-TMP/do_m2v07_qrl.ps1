$JWT = Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\jwt.txt -Raw
$JWT = $JWT.Trim()
$hdr = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $JWT"
    "X-Trace-Id" = "trace-m2v07-qrl"
    "X-Tenant-Id" = "tenant-m2v07"
}
Write-Host "=== M2-VERIFY-07-3: create quota ==="
$body = Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_quota_create.json -Raw -Encoding UTF8
try {
    $resp = Invoke-RestMethod -Uri "http://localhost:8401/api/v1/llmgw/quotas" -Method POST -Headers $hdr -Body $body
    $resp | ConvertTo-Json -Depth 12 | Out-File d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_quota_create_resp.json -Encoding UTF8
    Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_quota_create_resp.json
    Write-Host "`n=== M2-VERIFY-07-4: list quotas ==="
    $resp2 = Invoke-RestMethod -Uri "http://localhost:8401/api/v1/llmgw/quotas?scope=TENANT&page=1&pageSize=20" -Method GET -Headers $hdr
    $resp2 | ConvertTo-Json -Depth 8 | Out-File d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_quota_list_resp.json -Encoding UTF8
    Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_quota_list_resp.json
} catch {
    Write-Host "QUOTA_ERROR: $($_.Exception.Message)"
}
Write-Host "`n=== M2-VERIFY-07-5: create rate-limit ==="
$body = Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_ratelimit_create.json -Raw -Encoding UTF8
try {
    $resp = Invoke-RestMethod -Uri "http://localhost:8401/api/v1/llmgw/rate-limits" -Method POST -Headers $hdr -Body $body
    $resp | ConvertTo-Json -Depth 12 | Out-File d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_ratelimit_create_resp.json -Encoding UTF8
    Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_ratelimit_create_resp.json
    Write-Host "`n=== M2-VERIFY-07-6: rate-limit summary ==="
    $resp2 = Invoke-RestMethod -Uri "http://localhost:8401/api/v1/llmgw/rate-limits/stats/summary" -Method GET -Headers $hdr
    $resp2 | ConvertTo-Json -Depth 8 | Out-File d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_ratelimit_summary_resp.json -Encoding UTF8
    Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_ratelimit_summary_resp.json
} catch {
    Write-Host "RATELIMIT_ERROR: $($_.Exception.Message)"
}
Write-Host "`n=== M2-VERIFY-07-7: trigger rate-limit (use embedding api repeatedly) ==="
# Trigger embedding to potentially hit rate-limit (we send > 1 req)
for ($i=1; $i -le 3; $i++) {
    try {
        $rb = '{"modelId":"mock-embed","inputs":["rate limit test"]}'
        $rh = $hdr.Clone(); $rh["X-Trace-Id"] = "trace-m2v07-rl-$i"
        $resp = Invoke-RestMethod -Uri "http://localhost:8401/api/v1/llmgw/embeddings/batch" -Method POST -Headers $rh -Body $rb
        Write-Host "embed-$i OK"
    } catch {
        Write-Host "embed-$i ERR: $($_.Exception.Message)"
    }
}