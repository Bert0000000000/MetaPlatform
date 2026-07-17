$JWT = Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\jwt.txt -Raw
$JWT = $JWT.Trim()
$hdr = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $JWT"
    "X-Trace-Id" = "trace-m2v07-embed"
    "X-Tenant-Id" = "tenant-m2v07"
}
$body = '{"modelId":"mock-embed","inputs":["test"]}'
try {
    $resp = Invoke-RestMethod -Uri "http://localhost:8401/api/v1/llmgw/embeddings/batch" -Method POST -Headers $hdr -Body $body
    $resp | ConvertTo-Json -Depth 8 | Out-File d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_embed_resp.json -Encoding UTF8
    Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\m2v07_embed_resp.json
} catch {
    Write-Host "ERR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.ReadToEnd()
    }
}