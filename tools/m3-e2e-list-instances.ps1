# B1.4 verification: listInstances pagination + sort + filter
$ErrorActionPreference = 'Stop'

$apiBase = 'http://localhost:8092/api'
$ts = Get-Date -Format 'HHmmss'
$hdr = @{ 'Authorization' = 'Bearer dev' }

function Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; throw $msg }

Write-Host "==> B1.4 listInstances verification" -ForegroundColor Cyan

# 1. create app + object with multiple fields (number, string, enum)
$appCode = "b14_$ts"
$app = Invoke-RestMethod -Uri "$apiBase/apps" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = $appCode; name = "B1.4 List Test"; icon = "list"; description = "list test"
} | ConvertTo-Json)
$appId = $app.data.id
Pass ("create app id=" + $appId)

$objBody = @{
    code = "order_$ts"; name = "Order"; description = "for list test"
    fields = @(
        @{ code = "name"; name = "OrderNo"; type = "string"; required = $true }
        @{ code = "amount"; name = "Amount"; type = "number" }
        @{ code = "status"; name = "Status"; type = "string" }
    )
} | ConvertTo-Json -Depth 10
$obj = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body $objBody
$objId = $obj.data.id
Pass ("create object id=" + $objId)

# 2. Insert 25 test instances via POST /instances
for ($i = 1; $i -le 25; $i++) {
    $status = if (($i % 3) -eq 0) { "approved" } elseif (($i % 3) -eq 1) { "pending" } else { "rejected" }
    $row = @{
        name = "ORD_$('{0:D2}' -f $i)"
        amount = ($i * 100)
        status = $status
    }
    $null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/instances" -Method Post -Headers $hdr -ContentType 'application/json' -Body ($row | ConvertTo-Json)
}
Pass "inserted 25 instances"

# === Test 1: list all (no params) ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/instances" -Method Get -Headers $hdr
if ($resp.data.total -ne 25) { Fail "TC1 expected total=25, got $($resp.data.total)" }
if ($resp.data.page -ne 1) { Fail "TC1 expected page=1, got $($resp.data.page)" }
if ($resp.data.size -ne 20) { Fail "TC1 expected size=20 (default), got $($resp.data.size)" }
if ($resp.data.rows.Count -ne 20) { Fail "TC1 expected rows=20, got $($resp.data.rows.Count)" }
Pass "TC1 list all: total=25, page=1, size=20, rows=20"

# === Test 2: pagination - page 2 ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/instances?page=2&size=10" -Method Get -Headers $hdr
if ($resp.data.total -ne 25) { Fail "TC2 expected total=25, got $($resp.data.total)" }
if ($resp.data.page -ne 2) { Fail "TC2 expected page=2, got $($resp.data.page)" }
if ($resp.data.rows.Count -ne 10) { Fail "TC2 expected rows=10, got $($resp.data.rows.Count)" }
Pass "TC2 page=2 size=10: rows=10, total=25"

# === Test 3: pagination - last page (page 3, size 10, only 5 rows) ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/instances?page=3&size=10" -Method Get -Headers $hdr
if ($resp.data.rows.Count -ne 5) { Fail "TC3 expected rows=5, got $($resp.data.rows.Count)" }
Pass "TC3 page=3 size=10: rows=5 (last page)"

# === Test 4: pagination - beyond total ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/instances?page=99&size=10" -Method Get -Headers $hdr
if ($resp.data.rows.Count -ne 0) { Fail "TC4 expected rows=0, got $($resp.data.rows.Count)" }
if ($resp.data.total -ne 25) { Fail "TC4 expected total=25 preserved" }
Pass "TC4 page=99: rows=0 (empty), total=25 preserved"

# === Test 5: sort -amount (descending by amount) ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/instances?sort=-amount&size=3" -Method Get -Headers $hdr
$firstAmount = $resp.data.rows[0].amount
$lastAmount = $resp.data.rows[2].amount
if ($firstAmount -lt $lastAmount) { Fail "TC5 not descending: first=$firstAmount last=$lastAmount" }
Pass "TC5 sort=-amount: descending OK (first=$firstAmount, last=$lastAmount)"

# === Test 6: sort +name (ascending) ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/instances?sort=name&size=3" -Method Get -Headers $hdr
$firstName = $resp.data.rows[0].name
$lastName = $resp.data.rows[2].name
if ($firstName -gt $lastName) { Fail "TC6 not ascending: first=$firstName last=$lastName" }
Pass "TC6 sort=name: ascending OK (first=$firstName, last=$lastName)"

# === Test 7: multi-sort -status, -amount ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/instances?sort=status,-amount&size=5" -Method Get -Headers $hdr
Pass "TC7 multi-sort: sort=status,-amount returns $($resp.data.rows.Count) rows"

# === Test 8: filter status=approved ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/instances?status=approved" -Method Get -Headers $hdr
$approvedCount = ($resp.data.rows | Where-Object { $_.status -eq 'approved' }).Count
if ($approvedCount -ne $resp.data.rows.Count) { Fail "TC8 filter not working: all rows should be approved" }
if ($resp.data.total -ne 8 -and $resp.data.total -ne 9) { Fail "TC8 expected 8 or 9 approved (i%3==0), got $($resp.data.total)" }
Pass "TC8 filter status=approved: total=$($resp.data.total), all rows match"

# === Test 9: filter amount>=2000 (new convention: column_gte) ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/instances?amount_gte=2000" -Method Get -Headers $hdr
$bigCount = ($resp.data.rows | Where-Object { [int]$_.amount -ge 2000 }).Count
if ($bigCount -ne $resp.data.rows.Count) { Fail "TC9 amount_gte filter not working" }
Pass "TC9 filter amount_gte=2000: total=$($resp.data.total) (amount >= 2000)"

# === Test 10: filter amount<500 (column_lt) ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/instances?amount_lt=500" -Method Get -Headers $hdr
$smallCount = ($resp.data.rows | Where-Object { [int]$_.amount -lt 500 }).Count
if ($smallCount -ne $resp.data.rows.Count) { Fail "TC10 amount_lt filter broken" }
Pass "TC10 filter amount_lt=500: total=$($resp.data.total) (amount < 500)"

# === Test 11: filter ~ (LIKE, new convention: column_like) ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/instances?name_like=ORD_01" -Method Get -Headers $hdr
$rows = $resp.data.rows
# 简单判断: 总数应该是 1 (ORD_01), 而不是 25
if ($resp.data.total -ne 1) { Fail "TC11 expected total=1 (ORD_01 only), got $($resp.data.total)" }
$firstName = if ($rows[0]) { [string]$rows[0].name } else { '' }
if (-not $firstName.Contains('ORD_01')) { Fail "TC11 first row.name='$firstName' should contain ORD_01" }
Pass "TC11 filter name_like=ORD_01: total=$($resp.data.total), first.name=$firstName (LIKE substring match OK)"

# === Test 12: in (a,b,c) (new convention: column_in=a,b,c) ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/instances?status_in=approved,rejected" -Method Get -Headers $hdr
$matches = ($resp.data.rows | Where-Object { $_.status -eq 'approved' -or $_.status -eq 'rejected' }).Count
if ($matches -ne $resp.data.rows.Count) { Fail "TC12 IN not working" }
Pass "TC12 filter status_in=approved,rejected: total=$($resp.data.total)"

# === Test 13: != (not equals, new convention: column_neq) ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/instances?status_neq=approved" -Method Get -Headers $hdr
$nonApproved = ($resp.data.rows | Where-Object { $_.status -ne 'approved' }).Count
if ($nonApproved -ne $resp.data.rows.Count) { Fail "TC13 _neq not working" }
Pass "TC13 filter status_neq=approved: total=$($resp.data.total) (all non-approved)"

# === Test 14: combined filter + sort + page ===
$url14 = "$apiBase/apps/$appId/objects/$objId/instances?status=approved&sort=-amount&page=1&size=3"
$resp = Invoke-RestMethod -Uri $url14 -Method Get -Headers $hdr
if ($resp.data.rows.Count -ne 3) { Fail "TC14 expected 3 rows, got $($resp.data.rows.Count)" }
$amounts = $resp.data.rows | ForEach-Object { $_.amount }
$sorted = $amounts | Sort-Object -Descending
if (($amounts -join ',') -ne ($sorted -join ',')) { Fail "TC14 combined sort+filter broken" }
Pass "TC14 combined (filter+sort+page): 3 rows, descending amounts"

# === Test 15: column selection ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/instances?columns=id,name&size=1" -Method Get -Headers $hdr
$first = $resp.data.rows[0]
if (-not $first.id) { Fail "TC15 expected id column" }
if (-not $first.name) { Fail "TC15 expected name column" }
if ($first.PSObject.Properties['amount']) { Fail "TC15 amount should NOT be returned (column filter)" }
Pass "TC15 column selection: only id,name returned"

# === Test 16: invalid filter column rejected ===
try {
    $null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/instances?Bad-Name=value" -Method Get -Headers $hdr
    Fail "TC16 should reject invalid column"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Pass "TC16 invalid column 'Bad-Name' rejected with 400"
    } else {
        Fail "TC16 wrong status: $($_.Exception.Response.StatusCode)"
    }
}

# === Test 17: invalid sort column rejected ===
try {
    $null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$objId/instances?sort=BadCol" -Method Get -Headers $hdr
    Fail "TC17 should reject invalid sort column"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Pass "TC17 invalid sort column rejected with 400"
    } else {
        Fail "TC17 wrong status: $($_.Exception.Response.StatusCode)"
    }
}

# === Test 18: non-existent object returns 404 ===
try {
    $null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/99999/instances" -Method Get -Headers $hdr
    Fail "TC18 should reject non-existent object"
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Pass "TC18 non-existent objectId returns 404"
    } else {
        Fail "TC18 wrong status: $($_.Exception.Response.StatusCode)"
    }
}

# === cleanup ===
Invoke-RestMethod -Uri "$apiBase/apps/$appId" -Method Delete -Headers $hdr | Out-Null
Pass "cleanup app"

Write-Host ""
Write-Host "==> B1.4 listInstances: ALL TESTS PASSED" -ForegroundColor Green