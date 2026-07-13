# F1.4 验证: PublicForm lookup 运行时下拉框
#
# 场景:
#   1. 创建 app + customer object (含 name 字段) + order object (含 lookup 字段)
#   2. 插入 3 条 customer instances
#   3. 创建 published form (order 表单, 1 个 lookup 字段)
#   4. GET /api/public/forms/{formId}/lookup-options -> 返回 customer 列表
#   5. POST /api/public/forms/{formId}/submit -> 提交 FK ID
#   6. GET /api/public/forms/{formId}/data -> lookup 字段被解析为 displayField
$ErrorActionPreference = 'Stop'

$apiBase = 'http://localhost:8092/api'
$ts = Get-Date -Format 'HHmmss'
$hdr = @{ 'Authorization' = 'Bearer dev' }

function Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; throw $msg }

Write-Host "==> F1.4 PublicForm lookup dropdown e2e" -ForegroundColor Cyan

# ════════════════════════════════════════════════════════════════════
# Step 1: app + customer object + lookup-enabled order object
# ════════════════════════════════════════════════════════════════════
$app = Invoke-RestMethod -Uri "$apiBase/apps" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = "f14_$ts"; name = "F1.4 Lookup Dropdown"; icon = "link"
} | ConvertTo-Json)
$appId = $app.data.id
Pass "create app id=$appId"

$customer = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = "customer_$ts"; name = "Customer"
    fields = @(
        @{ code = "name"; name = "CustomerName"; type = "text"; required = $true }
    )
} | ConvertTo-Json -Depth 10)
$customerId = $customer.data.id
Pass "create customer object id=$customerId"

$order = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = "order_$ts"; name = "Order"
    fields = @(
        @{ code = "order_no"; name = "OrderNo"; type = "text"; required = $true }
        @{
            code = "customer_ref"; name = "Customer"; type = "lookup"
            lookup = @{ objectId = $customerId; displayField = "name" }
        }
    )
} | ConvertTo-Json -Depth 10)
$orderId = $order.data.id
Pass "create order object with lookup: id=$orderId"

# ════════════════════════════════════════════════════════════════════
# Step 2: Insert 3 customer instances
# ════════════════════════════════════════════════════════════════════
$custIds = @()
foreach ($name in @("Alice Corp", "Bravo Inc", "Charlie LLC")) {
    $r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$customerId/instances" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{ name = $name } | ConvertTo-Json)
    $custIds += $r.data
}
Pass "inserted 3 customers: $($custIds -join ',')"

# ════════════════════════════════════════════════════════════════════
# Step 3: Create form (linking to order object)
# ════════════════════════════════════════════════════════════════════
$formBody = @{
    code = "orderform_$ts"; name = "Order Form"
    objectId = $orderId
    schema = @{
        sections = @(
            @{
                id = "s1"; title = "Order Info"; type = "FORM"; columns = 2
                fields = @(
                    @{ field = "order_no"; widget = "input"; label = "OrderNo"; required = $true }
                    @{
                        field = "customer_ref"; widget = "lookup"; label = "Customer"
                        required = $false
                        lookup = @{ objectId = $customerId; displayField = "name" }
                    }
                )
            }
        )
    } | ConvertTo-Json -Depth 10
} | ConvertTo-Json -Depth 10
$form = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms" -Method Post -Headers $hdr -ContentType 'application/json' -Body $formBody
$formId = $form.data.id
Pass "create form id=$formId"

# Publish
$null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms/$formId/publish" -Method Post -Headers $hdr
Pass "publish form id=$formId"

# ════════════════════════════════════════════════════════════════════
# Step 4: GET /api/public/forms/{formId}/lookup-options  (no auth)
# ════════════════════════════════════════════════════════════════════
$optsResp = Invoke-RestMethod -Uri "$apiBase/public/forms/$formId/lookup-options" -Method Get
if ($optsResp.code -ne 0) { Fail "lookup-options failed: $($optsResp.message)" }
$optsList = $optsResp.data
if ($optsList.Count -ne 1) { Fail "expected 1 lookup field response, got $($optsList.Count)" }
$entry = $optsList[0]
if ($entry.field -ne "customer_ref") { Fail "expected field=customer_ref, got $($entry.field)" }
if ($entry.options.Count -ne 3) { Fail "expected 3 options, got $($entry.options.Count)" }
$labels = $entry.options | ForEach-Object { $_.label }
if (-not ($labels -contains "Alice Corp")) { Fail "Alice Corp not in options: $labels" }
if (-not ($labels -contains "Bravo Inc")) { Fail "Bravo Inc not in options: $labels" }
if (-not ($labels -contains "Charlie LLC")) { Fail "Charlie LLC not in options: $labels" }
Pass "lookup-options returns 3 customer labels: [$labels]"

# ════════════════════════════════════════════════════════════════════
# Step 5: Submit form with lookup FK ID (no auth)
# ════════════════════════════════════════════════════════════════════
$submitBody = @{
    values = @{
        order_no = "ORD_001"
        customer_ref = $custIds[0]   # Alice Corp id
    }
    submitterEmail = "alice@test.com"
    submitterName = "Alice"
} | ConvertTo-Json
$submitResp = Invoke-RestMethod -Uri "$apiBase/public/forms/$formId/submit" -Method Post -ContentType 'application/json' -Body $submitBody
if ($submitResp.code -ne 0) { Fail "submit failed: $($submitResp.message)" }
Pass "submit form with FK ID=$($custIds[0]) -> row id=$($submitResp.data.id)"

# ════════════════════════════════════════════════════════════════════
# Step 6: GET /api/public/forms/{formId}/data -> contains FK ID
# (lookup join in public data is reserved for Sprint 3; F1.4 only validates
#  that the FK value is stored and readable)
# ════════════════════════════════════════════════════════════════════
$dataResp = Invoke-RestMethod -Uri "$apiBase/public/forms/$formId/data" -Method Get
if ($dataResp.code -ne 0) { Fail "data fetch failed" }
$rows = $dataResp.data.rows
if ($rows.Count -lt 1) { Fail "expected >=1 row, got $($rows.Count)" }
$row = $rows[0]
$fk = [string]$row.customer_ref
if ($fk -ne "1") { Fail "customer_ref FK not persisted correctly: '$fk'" }
Pass "public data stores FK ID correctly: customer_ref=$fk (Alice Corp)"

# Lookup join in private API (already exists from Sprint 1 B1.5)
$privateRows = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances" -Method Get -Headers $hdr
$priv = $privateRows.data.rows[0]
$resolved = [string]$priv.customer_ref
if ($resolved -ne "Alice Corp") { Fail "private lookup join failed: '$resolved'" }
Pass "private listInstances lookup join: customer_ref -> '$resolved'"

# ════════════════════════════════════════════════════════════════════
# Step 7: form without any lookup field -> empty array
# ════════════════════════════════════════════════════════════════════
$plainFormBody = @{
    code = "plainform_$ts"; name = "Plain Form"
    objectId = $orderId
    schema = @{
        sections = @(
            @{ id = "s1"; title = "Info"; type = "FORM"; columns = 1; fields = @(
                @{ field = "order_no"; widget = "input"; label = "OrderNo" }
            ) }
        )
    } | ConvertTo-Json -Depth 10
} | ConvertTo-Json -Depth 10
$plainForm = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms" -Method Post -Headers $hdr -ContentType 'application/json' -Body $plainFormBody
$plainFormId = $plainForm.data.id
$null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms/$plainFormId/publish" -Method Post -Headers $hdr
$plainOpts = Invoke-RestMethod -Uri "$apiBase/public/forms/$plainFormId/lookup-options" -Method Get
if ($plainOpts.data.Count -ne 0) { Fail "expected 0 lookups in plain form, got $($plainOpts.data.Count)" }
Pass "form without lookup: lookup-options returns empty array"

# ════════════════════════════════════════════════════════════════════
# Step 8: form with malformed lookup (missing displayField) -> skip
# ════════════════════════════════════════════════════════════════════
$badFormBody = @{
    code = "badform_$ts"; name = "Bad Lookup"
    objectId = $orderId
    schema = @{
        sections = @(
            @{ id = "s1"; title = "S"; type = "FORM"; columns = 1; fields = @(
                @{ field = "x"; widget = "lookup"; label = "X"; lookup = @{ objectId = $customerId } }
            ) }
        )
    } | ConvertTo-Json -Depth 10
} | ConvertTo-Json -Depth 10
$badForm = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms" -Method Post -Headers $hdr -ContentType 'application/json' -Body $badFormBody
$badFormId = $badForm.data.id
$null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms/$badFormId/publish" -Method Post -Headers $hdr
$badOpts = Invoke-RestMethod -Uri "$apiBase/public/forms/$badFormId/lookup-options" -Method Get
# missing displayField should be skipped (lookupOptions is empty)
if ($badOpts.data.Count -ne 0) { Fail "expected 0 valid lookups (displayField missing), got $($badOpts.data.Count)" }
Pass "form with missing displayField: lookup-options returns empty (correctly skipped)"

# ════════════════════════════════════════════════════════════════════
# Step 9: cleanup
# ════════════════════════════════════════════════════════════════════
Invoke-RestMethod -Uri "$apiBase/apps/$appId" -Method Delete -Headers $hdr | Out-Null
Pass "cleanup app"

Write-Host ""
Write-Host "==> F1.4 PublicForm lookup dropdown: ALL TESTS PASSED" -ForegroundColor Green