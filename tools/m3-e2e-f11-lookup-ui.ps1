# F1.1 验证: 前端 ObjectFieldPanel 提交 lookup 字段 → 后端接收 → DDL 落地
#
# 场景: 模拟 UI 选择 "关联" 类型 + 选目标对象 + 选显示字段 → 提交
# 后端验证: listFields 读回包含 lookup 子配置 + schema_json 有 type=lookup
$ErrorActionPreference = 'Stop'

$apiBase = 'http://localhost:8092/api'
$ts = Get-Date -Format 'HHmmss'
$hdr = @{ 'Authorization' = 'Bearer dev' }

function Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; throw $msg }

Write-Host "==> F1.1 ObjectFieldPanel lookup UI verification" -ForegroundColor Cyan

# ════════════════════════════════════════════════════════════════
# Step 1: 创建 app
# ════════════════════════════════════════════════════════════════
$app = Invoke-RestMethod -Uri "$apiBase/apps" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = "f11_$ts"; name = "F1.1 UI Test"; icon = "link"
} | ConvertTo-Json)
$appId = $app.data.id
Pass "create app id=$appId"

# ════════════════════════════════════════════════════════════════
# Step 2: 创建目标对象 (customer) — 模拟前端先创建一个对象
# ════════════════════════════════════════════════════════════════
$customerBody = @{
    code = "customer_$ts"; name = "Customer"
    fields = @(
        @{ code = "name"; name = "CustomerName"; type = "text"; required = $true }
        @{ code = "phone"; name = "Phone"; type = "phone" }
    )
} | ConvertTo-Json -Depth 10
$customer = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body $customerBody
$customerId = $customer.data.id
Pass "create target customer object id=$customerId"

# ════════════════════════════════════════════════════════════════
# Step 3: 模拟前端 ObjectFieldPanel UI: 添加 lookup 字段
#
# 步骤:
#   1. 选择类型 = "lookup"
#   2. 选择目标对象 = customer (id=$customerId)
#   3. 选择显示字段 = name
#   4. 提交
#
# 前端实际发送的 FieldRequest body 形如:
#   {
#     "code": "customer_ref",
#     "name": "关联客户",
#     "type": "lookup",
#     "required": false,
#     "lookup": { "objectId": <customerId>, "displayField": "name" }
#   }
# ════════════════════════════════════════════════════════════════
$orderBody = @{
    code = "order_$ts"; name = "Order"; description = "with lookup field via UI"
    fields = @(
        @{ code = "name"; name = "OrderNo"; type = "text"; required = $true }
        @{
            code = "customer_ref"
            name = "CustomerRef"
            type = "lookup"
            required = $false
            lookup = @{
                objectId = $customerId
                displayField = "name"
            }
        }
    )
} | ConvertTo-Json -Depth 10
$order = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body $orderBody
$orderId = $order.data.id
Pass "create order object with lookup field: id=$orderId"

# ════════════════════════════════════════════════════════════════
# Step 4: 后端验证 — listFields 读回 lookup 子配置
# ════════════════════════════════════════════════════════════════
$orderFields = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/fields" -Method Get -Headers $hdr
$lookupField = $orderFields.data | Where-Object { $_.code -eq 'customer_ref' }
if (-not $lookupField) { Fail "lookup field 'customer_ref' not found in listFields" }
if ($lookupField.type -ne 'lookup') { Fail "field type should be lookup, got $($lookupField.type)" }
Pass "listFields returns lookup field with type=lookup"

# lookup 子配置验证 (虽然后端 listFields 不返回 lookup, schema_json 里存)
$orderGet = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId" -Method Get -Headers $hdr
$schema = $orderGet.data.schemaJson
if ($schema -notmatch '"type":"lookup"') { Fail "schema_json missing type:lookup" }
if ($schema -notmatch '"lookup":\{') { Fail "schema_json missing lookup sub-object" }
if ($schema -notmatch ('"objectId":' + [regex]::Escape([string]$customerId))) { Fail "schema_json missing objectId=$customerId" }
if ($schema -notmatch '"displayField":"name"') { Fail "schema_json missing displayField=name" }
Pass "schema_json contains: type=lookup + lookup{objectId=$customerId, displayField=name}"

# ════════════════════════════════════════════════════════════════
# Step 5: 模拟前端 addField UI 流程 (单加 lookup)
# ════════════════════════════════════════════════════════════════
$newOrderBody = @{
    code = "order2_$ts"; name = "Order2"; description = "no lookup initially"
    fields = @(
        @{ code = "name"; name = "OrderNo"; type = "text"; required = $true }
    )
} | ConvertTo-Json -Depth 10
$newOrder = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body $newOrderBody
$newOrderId = $newOrder.data.id
Pass "create order2 object: id=$newOrderId (no lookup)"

# 模拟用户在 UI 中点击"添加字段" → 选 lookup → 选 customer → 选 name → 提交
$addLookupBody = @{
    code = "supplier_ref"
    name = "Supplier"
    type = "lookup"
    required = $false
    lookup = @{
        objectId = $customerId
        displayField = "name"
    }
} | ConvertTo-Json -Depth 10
$addResult = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$newOrderId/fields" -Method Post -Headers $hdr -ContentType 'application/json' -Body $addLookupBody
Pass "addColumn lookup field (UI addField 流程): $($addResult.data.Count) fields now"

# 读回验证
$newOrderGet = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$newOrderId" -Method Get -Headers $hdr
$newSchema = $newOrderGet.data.schemaJson
if ($newSchema -notmatch '"code":"supplier_ref"') { Fail "addField: supplier_ref not in schema" }
if ($newSchema -notmatch '"type":"lookup"') { Fail "addField: type not lookup" }
if ($newSchema -notmatch '"displayField":"name"') { Fail "addField: displayField missing" }
Pass "schema_json updated with supplier_ref lookup field"

# ════════════════════════════════════════════════════════════════
# Step 6: 错误处理 - 模拟前端缺 lookup 子配置 (后端应拒)
# ════════════════════════════════════════════════════════════════
$errOrderBody = @{
    code = "err_$ts"; name = "ErrOrder"
    fields = @(
        @{ code = "name"; name = "Name"; type = "text"; required = $true }
        @{
            code = "bad_lookup"
            name = "BadLookup"
            type = "lookup"
            # Missing lookup sub-object - should fail
        }
    )
} | ConvertTo-Json -Depth 10
try {
    $null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body $errOrderBody
    Fail "should reject lookup without sub-config (got success)"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Pass "TC6 lookup without sub-config rejected with 400"
    } else {
        Fail "wrong status: $($_.Exception.Response.StatusCode)"
    }
}

# ════════════════════════════════════════════════════════════════
# Step 7: 验证 lookup 字段数据链路 (B1.5 集成验证)
# ════════════════════════════════════════════════════════════════
# 在 customer 对象下插入一条 instance
$cust1 = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$customerId/instances" -Method Post -Headers $hdr -ContentType 'application/json' -Body '{"name":"Alice Corp","phone":"13800000001"}'
$cust1Id = $cust1.data
# 在 order 对象下插入引用 customer 的 row
$orderRow = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{ name = "ORD_001"; customer_ref = $cust1Id } | ConvertTo-Json)
# listInstances 看是否解析为 displayField
$rows = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances" -Method Get -Headers $hdr
$first = $rows.data.rows[0]
$resolved = [string]$first.customer_ref
if ($resolved -eq "Alice Corp") {
    Pass "TC7 lookup join: customer_ref resolved to 'Alice Corp'"
} else {
    Fail "TC7 customer_ref not resolved: '$resolved'"
}

# ════════════════════════════════════════════════════════════════
# Step 8: 清理
# ════════════════════════════════════════════════════════════════
Invoke-RestMethod -Uri "$apiBase/apps/$appId" -Method Delete -Headers $hdr | Out-Null
Pass "cleanup app"

Write-Host ""
Write-Host "==> F1.1 ObjectFieldPanel lookup UI: ALL TESTS PASSED" -ForegroundColor Green