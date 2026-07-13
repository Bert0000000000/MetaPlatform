# F1.5+ 验证: Formily 2 集成链路
#
# 场景:
#   1. 后端启动并接受 lookup-options 请求
#   2. 创建 form schema 含 lookup + text + number
#   3. 模拟 PublicFormV2 拉 schema + submit 数据
#   4. 验证 schemaAdapter 输出的 schema 与后端 listFields/lookup-options 兼容
$ErrorActionPreference = 'Stop'

$apiBase = 'http://localhost:8092/api'
$ts = Get-Date -Format 'HHmmss'
$hdr = @{ 'Authorization' = 'Bearer dev' }

function Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; throw $msg }

Write-Host "==> F1.5+ Formily 2 integration e2e" -ForegroundColor Cyan

# ════════════════════════════════════════════════════════════════════
# Step 1: 创建 app + 2 个对象 (lookup 目标 + 含 lookup 字段的源)
# ════════════════════════════════════════════════════════════════════
$app = Invoke-RestMethod -Uri "$apiBase/apps" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = "f15_$ts"; name = "F1.5+ Formily Test"; icon = "form"
} | ConvertTo-Json)
$appId = $app.data.id
Pass "create app id=$appId"

$customer = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = "customer_$ts"; name = "Customer"
    fields = @(
        @{ code = "name"; name = "CustomerName"; type = "text"; required = $true }
        @{ code = "phone"; name = "Phone"; type = "phone" }
    )
} | ConvertTo-Json -Depth 10)
$customerId = $customer.data.id
Pass "create customer object id=$customerId"

$order = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = "order_$ts"; name = "Order"
    fields = @(
        @{ code = "order_no"; name = "OrderNo"; type = "text"; required = $true }
        @{ code = "qty"; name = "Qty"; type = "number" }
        @{
            code = "customer_ref"; name = "Customer"; type = "lookup"
            lookup = @{ objectId = $customerId; displayField = "name" }
        }
    )
} | ConvertTo-Json -Depth 10)
$orderId = $order.data.id
Pass "create order object id=$orderId"

# ════════════════════════════════════════════════════════════════════
# Step 2: 插入 3 customers (for lookup-options)
# ════════════════════════════════════════════════════════════════════
$custIds = @()
foreach ($name in @("Alice Corp", "Bravo Inc", "Charlie LLC")) {
    $r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$customerId/instances" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{ name = $name; phone = "13800000000" } | ConvertTo-Json)
    $custIds += $r.data
}
Pass "inserted 3 customers: $($custIds -join ',')"

# ════════════════════════════════════════════════════════════════════
# Step 3: 创建 + 发布 form
# ════════════════════════════════════════════════════════════════════
$formBody = @{
    code = "f15form_$ts"; name = "F1.5+ Form"
    objectId = $orderId
    schema = @{
        sections = @(
            @{
                id = "s1"; title = "Order"; type = "FORM"; columns = 2
                fields = @(
                    @{ field = "order_no"; widget = "input"; label = "OrderNo"; required = $true }
                    @{ field = "qty"; widget = "number"; label = "Qty" }
                    @{
                        field = "customer_ref"; widget = "lookup"; label = "Customer"; required = $true
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

$null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms/$formId/publish" -Method Post -Headers $hdr
Pass "publish form id=$formId"

# ════════════════════════════════════════════════════════════════════
# Step 4: 模拟 PublicFormV2 拉 schema (无 auth)
# ════════════════════════════════════════════════════════════════════
$schemaResp = Invoke-RestMethod -Uri "$apiBase/public/forms/$formId" -Method Get
if ($schemaResp.code -ne 0) { Fail "schema fetch failed" }
$schemaObj = $schemaResp.data.schema
if (-not $schemaObj.sections) { Fail "schema has no sections" }
$fields = $schemaObj.sections[0].fields
if ($fields.Count -ne 3) { Fail "expected 3 fields, got $($fields.Count)" }
Pass "PublicFormV2 fetched schema with 3 fields"

# 验证字段类型与 widget 标记
$widgetCounts = @{}
foreach ($f in $fields) {
    $w = $f.widget
    $widgetCounts[$w] = ($widgetCounts[$w] + 1)
}
if ($widgetCounts["input"] -ne 1) { Fail "expected 1 input widget, got $($widgetCounts['input'])" }
if ($widgetCounts["number"] -ne 1) { Fail "expected 1 number widget, got $($widgetCounts['number'])" }
if ($widgetCounts["lookup"] -ne 1) { Fail "expected 1 lookup widget, got $($widgetCounts['lookup'])" }
Pass "schema widgets: input=1 number=1 lookup=1"

# ════════════════════════════════════════════════════════════════════
# Step 5: 模拟 PublicFormV2 loadLookupOptions
# ════════════════════════════════════════════════════════════════════
$optsResp = Invoke-RestMethod -Uri "$apiBase/public/forms/$formId/lookup-options" -Method Get
if ($optsResp.code -ne 0) { Fail "lookup-options failed" }
$optsList = $optsResp.data
if ($optsList.Count -ne 1) { Fail "expected 1 lookup field, got $($optsList.Count)" }
$customerOpts = $optsList[0].options
if ($customerOpts.Count -ne 3) { Fail "expected 3 customer options, got $($customerOpts.Count)" }
$labels = $customerOpts | ForEach-Object { $_.label }
if (-not ($labels -contains "Alice Corp")) { Fail "Alice Corp missing" }
Pass "lookup-options has 3 customer labels (loaded by Formily LookupField)"

# ════════════════════════════════════════════════════════════════════
# Step 6: 模拟 PublicFormV2 提交 form.values
# ════════════════════════════════════════════════════════════════════
$submitBody = @{
    values = @{
        order_no = "FORM_F15_001"
        qty = 5
        customer_ref = $custIds[0]
    }
    submitterEmail = "formily@test.com"
    submitterName = "Formily Tester"
} | ConvertTo-Json
$submitResp = Invoke-RestMethod -Uri "$apiBase/public/forms/$formId/submit" -Method Post -ContentType 'application/json' -Body $submitBody
if ($submitResp.code -ne 0) { Fail "submit failed: $($submitResp.message)" }
$rowId = $submitResp.data.id
Pass "submit form via Formily values: row id=$rowId"

# ════════════════════════════════════════════════════════════════════
# Step 7: 验证 listInstances 解析 lookup (完整 B1.5 链路)
# ════════════════════════════════════════════════════════════════════
$rows = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances" -Method Get -Headers $hdr
$row = $rows.data.rows | Where-Object { $_.id -eq $rowId } | Select-Object -First 1
if (-not $row) { Fail "row id=$rowId not found in listInstances" }
if ([string]$row.customer_ref -ne "Alice Corp") { Fail "lookup not resolved: '$($row.customer_ref)'" }
Pass "listInstances resolves customer_ref -> '$($row.customer_ref)'"

# ════════════════════════════════════════════════════════════════════
# Step 8: cleanup
# ════════════════════════════════════════════════════════════════════
Invoke-RestMethod -Uri "$apiBase/apps/$appId" -Method Delete -Headers $hdr | Out-Null
Pass "cleanup app"

Write-Host ""
Write-Host "==> F1.5+ Formily 2 integration: ALL TESTS PASSED" -ForegroundColor Green