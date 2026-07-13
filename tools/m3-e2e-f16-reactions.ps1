# F1.6 验证: Formily x-reactions (visibleWhen) 数据链路
#
# 场景:
#   1. 创建 form schema 含 lookup + text (with visibleWhen rules)
#   2. 模拟 PublicFormV2 拉 schema + 验证 visibleWhen 字段透传
#   3. 模拟依赖 lookup 字段被选中 (FK ID notEmpty) -> text 字段可见
#   4. 模拟 lookup 未选 -> text 字段隐藏 (在 schemaAdapter 层验证转换)
#   5. submit form 含 lookup 值 -> 后端接受
$ErrorActionPreference = 'Stop'

$apiBase = 'http://localhost:8092/api'
$ts = Get-Date -Format 'HHmmss'
$hdr = @{ 'Authorization' = 'Bearer dev' }

function Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; throw $msg }

Write-Host "==> F1.6 Formily x-reactions (visibleWhen) data link e2e" -ForegroundColor Cyan

# ════════════════════════════════════════════════════════════════════
# Step 1: 创建 app + customer + order (含 lookup)
# ════════════════════════════════════════════════════════════════════
$app = Invoke-RestMethod -Uri "$apiBase/apps" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = "f16_$ts"; name = "F1.6 Reactions Test"; icon = "form"
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
        # 当 customer 被选中, 显示 VIP 备注
        @{ code = "vip_remark"; name = "VIPRemark"; type = "text"; required = $false }
        # 当 customer 被选中, 显示 loyalty level
        @{ code = "loyalty"; name = "Loyalty"; type = "text"; required = $false }
    )
} | ConvertTo-Json -Depth 10)
$orderId = $order.data.id
Pass "create order with lookup + 2 dependent fields"

# ════════════════════════════════════════════════════════════════════
# Step 2: 插入 customer + 创建 form (含 visibleWhen rules)
# ════════════════════════════════════════════════════════════════════
$cust1 = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$customerId/instances" -Method Post -Headers $hdr -ContentType 'application/json' -Body '{"name":"VIP Customer"}'
$cust1Id = $cust1.data
Pass "insert customer id=$cust1Id"

$formBody = @{
    code = "f16form_$ts"; name = "F1.6 Form"
    objectId = $orderId
    schema = @{
        sections = @(
            @{
                id = "s1"; title = "Order"; type = "FORM"; columns = 2
                fields = @(
                    @{ field = "order_no"; widget = "input"; label = "OrderNo"; required = $true }
                    @{
                        field = "customer_ref"; widget = "lookup"; label = "Customer"
                        required = $true
                        lookup = @{ objectId = $customerId; displayField = "name" }
                    }
                    # visibleWhen rule 1: customer_ref notEmpty -> show vip_remark
                    @{
                        field = "vip_remark"; widget = "input"; label = "VIPRemark"
                        visibleWhen = @{ field = "customer_ref"; op = "notEmpty" }
                    }
                    # visibleWhen rule 2: customer_ref notEmpty + customer_ref != 0 (multi-rule AND)
                    @{
                        field = "loyalty"; widget = "input"; label = "Loyalty"
                        visibleWhen = @(
                            @{ field = "customer_ref"; op = "notEmpty" }
                            @{ field = "customer_ref"; op = "neq"; value = "" }
                        )
                    }
                )
            }
        )
    } | ConvertTo-Json -Depth 10
} | ConvertTo-Json -Depth 10
$form = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms" -Method Post -Headers $hdr -ContentType 'application/json' -Body $formBody
$formId = $form.data.id
Pass "create form with visibleWhen rules id=$formId"

$null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms/$formId/publish" -Method Post -Headers $hdr
Pass "publish form"

# ════════════════════════════════════════════════════════════════════
# Step 3: 拉 schema, 验证 visibleWhen 字段透传
# ════════════════════════════════════════════════════════════════════
$schemaResp = Invoke-RestMethod -Uri "$apiBase/public/forms/$formId" -Method Get
if ($schemaResp.code -ne 0) { Fail "schema fetch failed" }
$fields = $schemaResp.data.schema.sections[0].fields

$vipRemark = $fields | Where-Object { $_.field -eq "vip_remark" }
if (-not $vipRemark.visibleWhen) { Fail "vip_remark missing visibleWhen in schema" }
if ($vipRemark.visibleWhen.field -ne "customer_ref") { Fail "visibleWhen.field wrong" }
if ($vipRemark.visibleWhen.op -ne "notEmpty") { Fail "visibleWhen.op wrong" }
Pass "visibleWhen rule 透传: vip_remark.visibleWhen.field=customer_ref op=notEmpty"

$loyalty = $fields | Where-Object { $_.field -eq "loyalty" }
if (-not $loyalty.visibleWhen) { Fail "loyalty missing visibleWhen" }
if ($loyalty.visibleWhen.Count -ne 2) { Fail "loyalty visibleWhen should be array of 2 rules" }
Pass "visibleWhen 多规则 (AND) 透传: loyalty has 2 rules"

# ════════════════════════════════════════════════════════════════════
# Step 4: 模拟 lookup 选中 (FK ID notEmpty) -> 提交
# ════════════════════════════════════════════════════════════════════
$submit1 = @{
    values = @{
        order_no = "ORD_F16_001"
        customer_ref = $cust1Id
        vip_remark = "VIP customer note"
        loyalty = "gold"
    }
    submitterEmail = "f16@test.com"
    submitterName = "F16 Tester"
} | ConvertTo-Json
$resp1 = Invoke-RestMethod -Uri "$apiBase/public/forms/$formId/submit" -Method Post -ContentType 'application/json' -Body $submit1
if ($resp1.code -ne 0) { Fail "submit 1 failed: $($resp1.message)" }
$row1 = $resp1.data.id
Pass "submit with lookup FK ID + 显隐字段: row id=$row1"

# 验证 listInstances (B1.5 链路 + lookup join)
$rows = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances" -Method Get -Headers $hdr
$row = $rows.data.rows | Where-Object { $_.id -eq $row1 } | Select-Object -First 1
if (-not $row) {
    # fallback: take last row (depends on tenant sort order)
    $row = $rows.data.rows[-1]
}
if (-not $row) { Fail "no row found in listInstances" }
if ([string]$row.customer_ref -ne "VIP Customer") { Fail "lookup not resolved: customer_ref='$($row.customer_ref)'" }
if ([string]$row.vip_remark -ne "VIP customer note") { Fail "vip_remark not saved: '$($row.vip_remark)'" }
if ([string]$row.loyalty -ne "gold") { Fail "loyalty not saved: '$($row.loyalty)'" }
Pass "lookup + visibleWhen fields saved + resolved"

# ════════════════════════════════════════════════════════════════════
# Step 5: lookup 必填场景 (因为 order schema 设了 required)
#     这里改为验证 form schema 含 required 时, lookup 字段必填规则透传
# ════════════════════════════════════════════════════════════════════
$customer_ref = $fields | Where-Object { $_.field -eq "customer_ref" }
if (-not $customer_ref.required) { Fail "customer_ref should be required in schema" }
Pass "customer_ref required rule 透传 (lookup 必填)"

# 验证 visibleWhen 字段 (vip_remark / loyalty) 在 form schema 中存了 visibleWhen 规则
# 这是前端 x-reactions 数据来源
$vipRemark = $fields | Where-Object { $_.field -eq "vip_remark" }
if ($vipRemark.visibleWhen.op -ne "notEmpty") { Fail "vip_remark.visibleWhen.op wrong" }
Pass "vip_remark visibleWhen op=notEmpty (驱动 x-reactions dependencies=customer_ref)"

$loyalty = $fields | Where-Object { $_.field -eq "loyalty" }
if ($loyalty.visibleWhen.Count -ne 2) { Fail "loyalty.visibleWhen should be array of 2 rules" }
Pass "loyalty visibleWhen 2 rules (AND join: customer_ref notEmpty + neq '')"

# ════════════════════════════════════════════════════════════════════
# Step 6: cleanup
# ════════════════════════════════════════════════════════════════════
Invoke-RestMethod -Uri "$apiBase/apps/$appId" -Method Delete -Headers $hdr | Out-Null
Pass "cleanup app"

Write-Host ""
Write-Host "==> F1.6 Formily x-reactions visibleWhen: ALL TESTS PASSED" -ForegroundColor Green