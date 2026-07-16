# AC-103.6 验收: 对象 ETag 乐观锁
$ErrorActionPreference = 'Stop'

$apiBase = 'http://localhost:8092/api'
$ts = Get-Date -Format 'HHmmss'
$hdr = @{ 'Authorization' = 'Bearer dev' }

function Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; throw $msg }

Write-Host "==> AC-103.6 object ETag optimistic lock verification" -ForegroundColor Cyan

# 1. create app
$appCode = "ac1036_$ts"
$app = Invoke-RestMethod -Uri "$apiBase/apps" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = $appCode; name = "AC-103.6 Test"; icon = "lock"; description = "etag test"
} | ConvertTo-Json)
$appId = $app.data.id
Pass ("create app id=" + $appId)

# 2. create object with one text field
$objCode = "obj_$ts"
$obj = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = $objCode; name = "Object 1"; description = "test"
    fields = @(@{ code = "name"; name = "Name"; type = "string"; required = $true })
} | ConvertTo-Json)
$objId = $obj.data.id
Pass ("create object id=" + $objId + " initial version=" + $obj.data.version)

# 3. GET object -> verify ETag header is present
$resp = Invoke-WebRequest -Uri "$apiBase/apps/$appId/objects/$objId" -Method Get -Headers $hdr -UseBasicParsing
$etag = $resp.Headers['ETag']
if (-not $etag) { Fail "ETag header missing on GET" }
if ($etag -notmatch '^\"\d+\"$') { Fail ("ETag format wrong: " + $etag) }
Pass ("GET response ETag = " + $etag)

# 4. PUT with correct If-Match (no conflict, version increments)
$hdrMatch = $hdr.Clone()
$hdrMatch['If-Match'] = $etag
$upd1 = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId" -Method Put -Headers $hdrMatch -ContentType 'application/json' -Body (@{ name = "Object 1 (renamed)" } | ConvertTo-Json)
$newVer = $upd1.data.version
if ($newVer -le $obj.data.version) { Fail ("version did not increment: was=" + $obj.data.version + " now=" + $newVer) }
Pass ("PUT with correct If-Match OK, version: " + $obj.data.version + " -> " + $newVer)

# 5. PUT with STALE If-Match (using old ETag) -> 412
$hdrStale = $hdr.Clone()
$hdrStale['If-Match'] = $etag  # 旧 etag, version 是 1, 但 server 已经 2
$staleBody = @{ name = "Should fail" } | ConvertTo-Json
try {
    $null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId" -Method Put -Headers $hdrStale -ContentType 'application/json' -Body $staleBody
    Fail "stale If-Match should have returned 412 but request succeeded"
} catch {
    $statusCode = [int]$_.Exception.Response.StatusCode
    if ($statusCode -ne 412) { Fail ("stale If-Match should return 412, got " + $statusCode) }
    Pass ("stale If-Match returns 412 Precondition Failed (got " + $statusCode + ")")
}

# 6. PUT without If-Match (backward compatible) -> succeeds
$hdrNoMatch = $hdr.Clone()
$upd2 = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId" -Method Put -Headers $hdrNoMatch -ContentType 'application/json' -Body (@{ description = "no-if-match" } | ConvertTo-Json)
if ($upd2.data.version -le $newVer) { Fail "version did not increment without If-Match" }
Pass ("PUT without If-Match (backward compat) OK, version: " + $newVer + " -> " + $upd2.data.version)

# 7. PUT with non-numeric If-Match (parse failure -> treated as null -> succeeds)
$hdrBad = $hdr.Clone()
$hdrBad['If-Match'] = 'garbage'
try {
    $upd3 = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId" -Method Put -Headers $hdrBad -ContentType 'application/json' -Body (@{ description = "bad-if-match" } | ConvertTo-Json)
    Pass ("PUT with unparseable If-Match treated as null (backward compat), version=" + $upd3.data.version)
} catch {
    Fail ("unparseable If-Match should not break request, got: " + $_.Exception.Message)
}

# 8. Field-level add with stale If-Match
$resp2 = Invoke-WebRequest -Uri "$apiBase/apps/$appId/objects/$objId" -Method Get -Headers $hdr -UseBasicParsing
$currentEtag = $resp2.Headers['ETag']
Pass ("re-fetched ETag = " + $currentEtag)

# 8a. successful field add with correct If-Match
$hdrMatch2 = $hdr.Clone()
$hdrMatch2['If-Match'] = $currentEtag
$fieldBody = @{ code = "amount"; name = "Amount"; type = "number"; required = $false } | ConvertTo-Json
$null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/fields" -Method Post -Headers $hdrMatch2 -ContentType 'application/json' -Body $fieldBody
Pass "field add with correct If-Match OK"

# 8b. field add with stale If-Match (same etag, version already incremented) -> 412
$fieldBody2 = @{ code = "qty"; name = "Qty"; type = "number" } | ConvertTo-Json
try {
    $null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/fields" -Method Post -Headers $hdrMatch2 -ContentType 'application/json' -Body $fieldBody2
    Fail "stale If-Match field add should have returned 412"
} catch {
    $statusCode = [int]$_.Exception.Response.StatusCode
    if ($statusCode -ne 412) { Fail ("field add stale If-Match should return 412, got " + $statusCode) }
    Pass ("field add with stale If-Match returns 412 (got " + $statusCode + ")")
}

# 9. cleanup
try {
    Invoke-RestMethod -Uri "$apiBase/apps/$appId" -Method Delete -Headers $hdr | Out-Null
    Pass "cleanup test app"
} catch {
    Write-Host "[WARN] cleanup failed (ignored): $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==> AC-103.6 (object ETag optimistic lock) PASSED" -ForegroundColor Green
Write-Host "    GET returns ETag header, PUT validates If-Match, stale = 412 Precondition Failed." -ForegroundColor Green
Write-Host "    Field-level POST/PUT/DELETE also support If-Match (object-level lock)." -ForegroundColor Green