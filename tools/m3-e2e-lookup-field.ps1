# B1.2 verification: FieldRequest supports lookup config
$ErrorActionPreference = 'Stop'

$apiBase = 'http://localhost:8092/api'
$ts = Get-Date -Format 'HHmmss'
$hdr = @{ 'Authorization' = 'Bearer dev' }

function Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; throw $msg }

Write-Host "==> B1.2 lookup field verification" -ForegroundColor Cyan

# 1. create app
$appCode = "b12_$ts"
$app = Invoke-RestMethod -Uri "$apiBase/apps" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = $appCode; name = "B1.2 Lookup Test"; icon = "link"; description = "lookup test"
} | ConvertTo-Json)
$appId = $app.data.id
Pass ("create app id=" + $appId)

# 2. create target object (customer)
$customerCode = "customer_$ts"
$customer = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = $customerCode; name = "Customer"; description = "target for lookup"
    fields = @(@{ code = "name"; name = "CustomerName"; type = "string"; required = $true })
} | ConvertTo-Json)
$customerId = $customer.data.id
Pass ("create target object customer id=" + $customerId)

# === Test 1: create object with lookup field (success) ===
$orderBody = @{
    code = "order_$ts"; name = "Order"; description = "with lookup field"
    fields = @(
        @{ code = "name"; name = "OrderNo"; type = "string"; required = $true },
        @{
            code = "customer_id"; name = "Customer"; type = "lookup"
            lookup = @{ objectId = $customerId; displayField = "name" }
        }
    )
} | ConvertTo-Json -Depth 10
try {
    $order = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body $orderBody
    $orderId = $order.data.id
    Pass "TC1 create object with lookup field: orderId=$orderId"
} catch {
    Fail "TC1 failed: $($_.Exception.Message)"
}

# === Test 2: GET schema_json contains lookup subconfig ===
$orderGet = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId" -Method Get -Headers $hdr
$schemaText = $orderGet.data.schemaJson
if ($schemaText -like '*lookup*') { Pass "TC2 schemaJson contains lookup key" } else { Fail "TC2 missing lookup: $schemaText" }
if ($schemaText -like '*objectId*') { Pass "TC2 schemaJson contains objectId" } else { Fail "TC2 missing objectId" }
if ($schemaText -like '*displayField*') { Pass "TC2 schemaJson contains displayField" } else { Fail "TC2 missing displayField" }

# === Test 3: lookup without objectId rejected ===
$badBody = @{
    code = "bad_$ts"; name = "BadLookup"; description = "test"
    fields = @(@{ code = "x"; name = "X"; type = "lookup"; lookup = @{ displayField = "name" } })
} | ConvertTo-Json -Depth 10
try {
    $r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body $badBody
    Fail "TC3 should reject lookup without objectId"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) { Pass "TC3 rejected 400" } else { Fail "TC3 status: $($_.Exception.Response.StatusCode)" }
}

# === Test 4: lookup without displayField rejected ===
$badBody2 = @{
    code = "bad2_$ts"; name = "BadLookup2"; description = "test"
    fields = @(@{ code = "x"; name = "X"; type = "lookup"; lookup = @{ objectId = $customerId } })
} | ConvertTo-Json -Depth 10
try {
    $r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body $badBody2
    Fail "TC4 should reject lookup without displayField"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) { Pass "TC4 rejected 400" } else { Fail "TC4 status: $($_.Exception.Response.StatusCode)" }
}

# === Test 5: lookup with non-existent objectId rejected ===
$badBody3 = @{
    code = "bad3_$ts"; name = "BadLookup3"; description = "test"
    fields = @(@{ code = "x"; name = "X"; type = "lookup"; lookup = @{ objectId = 99999; displayField = "name" } })
} | ConvertTo-Json -Depth 10
try {
    $r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body $badBody3
    Fail "TC5 should reject lookup with non-existent objectId"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) { Pass "TC5 rejected 400" } else { Fail "TC5 status: $($_.Exception.Response.StatusCode)" }
}

# === Test 6: invalid displayField (uppercase) rejected ===
$badBody4 = @{
    code = "bad4_$ts"; name = "BadLookup4"; description = "test"
    fields = @(@{ code = "x"; name = "X"; type = "lookup"; lookup = @{ objectId = $customerId; displayField = "Name" } })
} | ConvertTo-Json -Depth 10
try {
    $r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body $badBody4
    Fail "TC6 should reject invalid displayField"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) { Pass "TC6 rejected 400" } else { Fail "TC6 status: $($_.Exception.Response.StatusCode)" }
}

# === Test 7: lookup type without subobject rejected ===
$badBody5 = @{
    code = "bad5_$ts"; name = "BadLookup5"; description = "test"
    fields = @(@{ code = "x"; name = "X"; type = "lookup" })
} | ConvertTo-Json -Depth 10
try {
    $r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body $badBody5
    Fail "TC7 should reject lookup without subobject"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) { Pass "TC7 rejected 400" } else { Fail "TC7 status: $($_.Exception.Response.StatusCode)" }
}

# === Test 8: max 5 lookup fields ===
$manyLookups = @()
for ($i = 1; $i -le 5; $i++) {
    $manyLookups += @{ code = "lk_$i"; name = "Lk$i"; type = "lookup"; lookup = @{ objectId = $customerId; displayField = "name" } }
}
$manyBody = @{ code = "many_$ts"; name = "ManyLookups"; description = "5 lookups"; fields = $manyLookups } | ConvertTo-Json -Depth 10
try {
    $r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body $manyBody
    Pass "TC8a 5 lookup fields OK (max)"
} catch { Fail "TC8a: $($_.Exception.Message)" }

$tooMany = @($manyLookups + @{ code = "lk_6"; name = "Lk6"; type = "lookup"; lookup = @{ objectId = $customerId; displayField = "name" } })
$tooManyBody = @{ code = "toomany_$ts"; name = "TooManyLookups"; description = "6 lookups"; fields = $tooMany } | ConvertTo-Json -Depth 10
try {
    $r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body $tooManyBody
    Fail "TC8b should reject 6 lookup fields"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) { Pass "TC8b 6th lookup rejected 400" } else { Fail "TC8b status: $($_.Exception.Response.StatusCode)" }
}

# === Test 9-10: backward-compat (no lookup field) ===
$simpleBody = @{
    code = "simple_$ts"; name = "Simple"; description = "no lookup"
    fields = @(@{ code = "name"; name = "Name"; type = "string"; required = $true })
} | ConvertTo-Json -Depth 10
try {
    $r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body $simpleBody
    Pass "TC9 backward-compat: object without lookup fields still works"
} catch { Fail "TC9: $($_.Exception.Message)" }

# === cleanup ===
Invoke-RestMethod -Uri "$apiBase/apps/$appId" -Method Delete -Headers $hdr | Out-Null
Pass "cleanup app"

Write-Host ""
Write-Host "==> B1.2 lookup field: ALL TESTS PASSED" -ForegroundColor Green