$JWT = Get-Content d:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\docs\006-TMP\jwt.txt -Raw
$JWT = $JWT.Trim()
$hdr = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $JWT"
    "X-Trace-Id" = "trace-m2v07-embed-3"
    "X-Tenant-Id" = "tenant-m2v07"
}
$body = '{"modelId":"mock-embed","inputs":["test"]}'
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:8401/api/v1/llmgw/embeddings/batch" -Method POST -Headers $hdr -Body $body
    Write-Host "STATUS: $($resp.StatusCode)"
    Write-Host "BODY: $($resp.Content)"
} catch {
    Write-Host "ERR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "RESPONSE: $($reader.ReadToEnd())"
    }
}
# Also try models/embedding
try {
    $resp2 = Invoke-WebRequest -Uri "http://localhost:8401/api/v1/llmgw/models/embedding" -Method GET -Headers $hdr
    Write-Host "EMBEDDING-MODELS STATUS: $($resp2.StatusCode)"
    Write-Host "EMBEDDING-MODELS BODY: $($resp2.Content)"
} catch {
    Write-Host "EMBEDDING-MODELS ERR: $($_.Exception.Message)"
}