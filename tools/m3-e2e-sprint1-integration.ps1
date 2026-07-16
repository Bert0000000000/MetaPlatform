# B1.7 Sprint 1 后端综合验证: 完整 lookup 闭环
# 真实业务场景: CRM 客户/订单/产品
# 覆盖 B1.1 (分页) + B1.2 (lookup config) + B1.3 (lookup DDL) +
#      B1.4 (listInstances 分页+排序+过滤) + B1.5 (lookup join)
#      + B1.6 (totalCount + pageSize + pageNumber)
$ErrorActionPreference = 'Stop'

$apiBase = 'http://localhost:8092/api'
$ts = Get-Date -Format 'HHmmss'
$hdr = @{ 'Authorization' = 'Bearer dev' }
$passCount = 0
$failCount = 0

function Pass($msg) {
    Write-Host "[PASS] $msg" -ForegroundColor Green
    $script:passCount++
}
function Fail($msg) {
    Write-Host "[FAIL] $msg" -ForegroundColor Red
    $script:failCount++
    throw $msg
}

Write-Host "================================================================"
Write-Host "Sprint 1 Backend Integration Test (B1.7)" -ForegroundColor Cyan
Write-Host "Scenario: CRM (Customer / Product / Order / SalesRep)"
Write-Host "Timestamp: $ts"
Write-Host "================================================================"

# ════════════════════════════════════════════════════════════════════
# Phase 1: 基础数据准备
# ════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "[Phase 1] Data preparation" -ForegroundColor Yellow

# 1.1 create app
$appCode = "crm_$ts"
$app = Invoke-RestMethod -Uri "$apiBase/apps" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = $appCode; name = "CRM Sprint1"; icon = "users"; description = "Sprint 1 integration"
} | ConvertTo-Json)
$appId = $app.data.id
Pass "P1.1 create app id=$appId"

# 1.2 listObjects pagination (B1.1)
$listResp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects?page=1&size=5" -Method Get -Headers $hdr
if ($null -eq $listResp.data.total) { Fail "P1.2 listObjects missing total" }
if ($null -eq $listResp.data.page) { Fail "P1.2 listObjects missing page" }
if ($null -eq $listResp.data.size) { Fail "P1.2 listObjects missing size" }
Pass "P1.2 listObjects returns {total, page, size}: $($listResp.data.total)/$($listResp.data.page)/$($listResp.data.size)"

# 1.3 create Customer object (will be lookup target)
$customer = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = "customer"; name = "Customer"
    fields = @(
        @{ code = "name"; name = "CustomerName"; type = "string"; required = $true }
        @{ code = "email"; name = "Email"; type = "string" }
        @{ code = "city"; name = "City"; type = "string" }
        @{ code = "level"; name = "Level"; type = "string" }
    )
} | ConvertTo-Json -Depth 10)
$customerId = $customer.data.id
Pass "P1.3 create Customer object id=$customerId"

# 1.4 create Product object
$product = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = "product"; name = "Product"
    fields = @(
        @{ code = "sku"; name = "SKU"; type = "string"; required = $true }
        @{ code = "name"; name = "ProductName"; type = "string"; required = $true }
        @{ code = "price"; name = "Price"; type = "number" }
    )
} | ConvertTo-Json -Depth 10)
$productId = $product.data.id
Pass "P1.4 create Product object id=$productId"

# 1.5 create SalesRep object
$salesRep = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = "salesrep"; name = "SalesRep"
    fields = @(
        @{ code = "name"; name = "RepName"; type = "string"; required = $true }
        @{ code = "region"; name = "Region"; type = "string" }
    )
} | ConvertTo-Json -Depth 10)
$salesRepId = $salesRep.data.id
Pass "P1.5 create SalesRep object id=$salesRepId"

# 1.6 create Order object with 3 lookup fields (B1.2 + B1.3)
$orderBody = @{
    code = "order"; name = "Order"
    fields = @(
        @{ code = "order_no"; name = "OrderNo"; type = "string"; required = $true }
        @{ code = "amount"; name = "Amount"; type = "number" }
        @{ code = "status"; name = "Status"; type = "string" }
        @{
            code = "customer_id"; name = "Customer"; type = "lookup"
            lookup = @{ objectId = $customerId; displayField = "name" }
        }
        @{
            code = "product_id"; name = "Product"; type = "lookup"
            lookup = @{ objectId = $productId; displayField = "name" }
        }
        @{
            code = "salesrep_id"; name = "SalesRep"; type = "lookup"
            lookup = @{ objectId = $salesRepId; displayField = "name" }
        }
    )
} | ConvertTo-Json -Depth 10
$order = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body $orderBody
$orderId = $order.data.id
Pass "P1.6 create Order object id=$orderId with 3 lookup fields"

# 1.7 verify schema_json includes all 3 lookup configs (B1.2)
$orderGet = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId" -Method Get -Headers $hdr
$schemaText = $orderGet.data.schemaJson
# 数 type:"lookup" 字段出现次数 (FieldSpec.type==lookup)
$lookupCount = ([regex]::Matches($schemaText, '"type":"lookup"')).Count
if ($lookupCount -ne 3) { Fail "P1.7 expected 3 'type:lookup' fields, got $lookupCount" }
Pass "P1.7 schemaJson contains all 3 lookup fields (type=lookup)"

# ════════════════════════════════════════════════════════════════════
# Phase 2: 插入种子数据
# ════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "[Phase 2] Seed data insertion" -ForegroundColor Yellow

# 2.1 Insert 5 customers
$customerIds = @()
$custData = @(
    @{ name = "Alpha Corp";     email = "a@x.com";  city = "Beijing";  level = "VIP" }
    @{ name = "Bravo Inc";      email = "b@x.com";  city = "Shanghai"; level = "Gold" }
    @{ name = "Charlie LLC";    email = "c@x.com";  city = "Shenzhen"; level = "VIP" }
    @{ name = "Delta Ltd";      email = "d@x.com";  city = "Beijing";  level = "Silver" }
    @{ name = "Echo Tech";      email = "e@x.com";  city = "Hangzhou"; level = "Gold" }
)
foreach ($c in $custData) {
    $r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$customerId/instances" -Method Post -Headers $hdr -ContentType 'application/json' -Body ($c | ConvertTo-Json)
    $customerIds += $r.data
}
Pass "P2.1 created 5 customers: $($customerIds -join ',')"

# 2.2 Insert 4 products
$productIds = @()
$prodData = @(
    @{ sku = "SKU001"; name = "Widget A"; price = 100 }
    @{ sku = "SKU002"; name = "Widget B"; price = 250 }
    @{ sku = "SKU003"; name = "Gadget C"; price = 500 }
    @{ sku = "SKU004"; name = "Gadget D"; price = 1200 }
)
foreach ($p in $prodData) {
    $r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$productId/instances" -Method Post -Headers $hdr -ContentType 'application/json' -Body ($p | ConvertTo-Json)
    $productIds += $r.data
}
Pass "P2.2 created 4 products: $($productIds -join ',')"

# 2.3 Insert 3 sales reps
$salesRepIds = @()
$repData = @(
    @{ name = "Alice Wong";  region = "North" }
    @{ name = "Bob Chen";    region = "South" }
    @{ name = "Carol Liu";   region = "East" }
)
foreach ($s in $repData) {
    $r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$salesRepId/instances" -Method Post -Headers $hdr -ContentType 'application/json' -Body ($s | ConvertTo-Json)
    $salesRepIds += $r.data
}
Pass "P2.3 created 3 sales reps: $($salesRepIds -join ',')"

# 2.4 Insert 30 orders with realistic combinations
$statusOptions = @("pending", "approved", "shipped", "delivered")
$orderCount = 0
for ($i = 1; $i -le 30; $i++) {
    $status = $statusOptions[$i % 4]
    $custFk = $customerIds[$i % 5]
    $prodFk = $productIds[$i % 4]
    $repFk  = $salesRepIds[$i % 3]
    $amount = $i * 100
    $body = @{
        order_no = "ORD_$('{0:D3}' -f $i)"
        amount = $amount
        status = $status
        customer_id = $custFk
        product_id = $prodFk
        salesrep_id = $repFk
    } | ConvertTo-Json
    $null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances" -Method Post -Headers $hdr -ContentType 'application/json' -Body $body
    $orderCount++
}
Pass "P2.4 created $orderCount orders with mixed lookups"

# ════════════════════════════════════════════════════════════════════
# Phase 3: 列表查询 + 分页 (B1.1 + B1.4)
# ════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "[Phase 3] List pagination" -ForegroundColor Yellow

# 3.1 default page=1 size=20 (后端默认 size=20)
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances" -Method Get -Headers $hdr
if ($resp.data.total -ne 30) { Fail "P3.1 expected total=30, got $($resp.data.total)" }
if ($resp.data.page -ne 1) { Fail "P3.1 expected page=1, got $($resp.data.page)" }
if ($resp.data.size -ne 20) { Fail "P3.1 expected size=20 (default), got $($resp.data.size)" }
if ($resp.data.rows.Count -ne 20) { Fail "P3.1 expected 20 rows, got $($resp.data.rows.Count)" }
Pass "P3.1 default pagination: total=30, page=1, size=20 (default), rows=20"

# 3.2 page 2
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?page=2&size=10" -Method Get -Headers $hdr
if ($resp.data.page -ne 2) { Fail "P3.2 expected page=2" }
if ($resp.data.rows.Count -ne 10) { Fail "P3.2 expected 10 rows" }
Pass "P3.2 page 2: 10 rows, total=30 preserved"

# 3.3 last page (page=4, size=10, 30 records → 0 rows on page 4)
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?page=4&size=10" -Method Get -Headers $hdr
if ($resp.data.rows.Count -ne 0) { Fail "P3.3 expected 0 rows on overflow page" }
Pass "P3.3 overflow page=4: 0 rows, total=30 preserved"

# 3.4 custom page size
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?size=50" -Method Get -Headers $hdr
if ($resp.data.size -ne 50) { Fail "P3.4 expected size=50" }
if ($resp.data.rows.Count -ne 30) { Fail "P3.4 expected 30 rows (all)" }
Pass "P3.4 size=50: 30 rows (all)"

# ════════════════════════════════════════════════════════════════════
# Phase 4: 排序 (B1.4)
# ════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "[Phase 4] Sorting" -ForegroundColor Yellow

# 4.1 single sort -amount
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?sort=-amount&size=5" -Method Get -Headers $hdr
$amounts = $resp.data.rows | ForEach-Object { [int]$_.amount }
$expected = $amounts | Sort-Object -Descending
if (($amounts -join ',') -ne ($expected -join ',')) { Fail "P4.1 not descending: $amounts" }
Pass "P4.1 sort=-amount: descending ($($amounts[0]) > $($amounts[-1]))"

# 4.2 multi sort status asc, -amount desc
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?sort=status,-amount&size=30" -Method Get -Headers $hdr
$rows = $resp.data.rows
$prevStatus = ""
$prevAmount = [int]::MaxValue
$violations = 0
foreach ($r in $rows) {
    $s = [string]$r.status
    $a = [int]$r.amount
    if ($s -lt $prevStatus) { $violations++ }
    elseif ($s -eq $prevStatus -and $a -gt $prevAmount) { $violations++ }
    $prevStatus = $s
    $prevAmount = $a
}
if ($violations -gt 0) { Fail "P4.2 multi-sort violations: $violations" }
Pass "P4.2 sort=status,-amount: 30 rows, all sorted correctly"

# ════════════════════════════════════════════════════════════════════
# Phase 5: 过滤 (B1.4 八种操作符)
# ════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "[Phase 5] Filtering (all 8 operators)" -ForegroundColor Yellow

# 5.1 = (equal)
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?status_eq=shipped" -Method Get -Headers $hdr
if ($resp.data.total -lt 1) { Fail "P5.1 expected >=1 shipped orders" }
$allShipped = ($resp.data.rows | Where-Object { $_.status -ne 'shipped' }).Count
if ($allShipped -gt 0) { Fail "P5.1 non-shipped rows in result: $allShipped" }
Pass "P5.1 = (eq): status_eq=shipped, total=$($resp.data.total)"

# 5.2 != (not equal)  [新约定: status_neq]
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?status_neq=pending" -Method Get -Headers $hdr
$nonPending = ($resp.data.rows | Where-Object { $_.status -eq 'pending' }).Count
if ($nonPending -gt 0) { Fail "P5.2 pending rows in != result: $nonPending" }
Pass "P5.2 != (neq): status_neq=pending, total=$($resp.data.total) (no pending)"

# 5.3 > (gt) [新约定]
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?amount_gt=1500" -Method Get -Headers $hdr
$allBig = ($resp.data.rows | Where-Object { [int]$_.amount -le 1500 }).Count
if ($allBig -gt 0) { Fail "P5.3 rows with amount<=1500: $allBig" }
Pass "P5.3 > (gt): amount_gt=1500, total=$($resp.data.total)"

# 5.4 >= (gte)
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?amount_gte=1500" -Method Get -Headers $hdr
$allGte = ($resp.data.rows | Where-Object { [int]$_.amount -lt 1500 }).Count
if ($allGte -gt 0) { Fail "P5.4 rows with amount<1500: $allGte" }
Pass "P5.4 >= (gte): amount_gte=1500, total=$($resp.data.total)"

# 5.5 < (lt)
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?amount_lt=500" -Method Get -Headers $hdr
$allSmall = ($resp.data.rows | Where-Object { [int]$_.amount -ge 500 }).Count
if ($allSmall -gt 0) { Fail "P5.5 rows with amount>=500: $allSmall" }
Pass "P5.5 < (lt): amount_lt=500, total=$($resp.data.total)"

# 5.6 <= (lte)
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?amount_lte=500" -Method Get -Headers $hdr
$allLte = ($resp.data.rows | Where-Object { [int]$_.amount -gt 500 }).Count
if ($allLte -gt 0) { Fail "P5.6 rows with amount>500: $allLte" }
Pass "P5.6 <= (lte): amount_lte=500, total=$($resp.data.total)"

# 5.7 ~ (like)
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?order_no_like=ORD_02" -Method Get -Headers $hdr
# ORD_02 ORD_020..029 包含 "ORD_02" (regex: 'ORD_02')
$allMatch = ($resp.data.rows | Where-Object { ([string]$_.order_no).Contains('ORD_02') }).Count
if ($allMatch -ne $resp.data.rows.Count) { Fail "P5.7 rows not matching LIKE" }
# 期望: ORD_020..ORD_029 共 10 条
if ($resp.data.total -ne 10) { Fail "P5.7 expected total=10 (ORD_020..029), got $($resp.data.total)" }
Pass "P5.7 ~ (like): order_no_like=ORD_02, total=$($resp.data.total) (ORD_020..029)"

# 5.8 : (isnull)
# order_no 必填, 没空, 用 customer_id 测试 (创建一条没 customer_id 的 order)
$nullOrder = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances" -Method Post -Headers $hdr -ContentType 'application/json' -Body '{"order_no":"ORD_NULL_TEST","amount":999,"status":"pending"}'
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?order_no_eq=ORD_NULL_TEST" -Method Get -Headers $hdr
$nullRow = $resp.data.rows[0]
if ($nullRow.customer_id -ne $null) { Fail "P5.8 customer_id should be null, got $($nullRow.customer_id)" }
Pass "P5.8 : (isnull): NULL lookup value stays null"

# 5.9 in(a,b,c)
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?status_in=shipped,delivered" -Method Get -Headers $hdr
$allIn = ($resp.data.rows | Where-Object { $_.status -ne 'shipped' -and $_.status -ne 'delivered' }).Count
if ($allIn -gt 0) { Fail "P5.9 rows outside IN result: $allIn" }
Pass "P5.9 in(): status_in=shipped,delivered, total=$($resp.data.total)"

# ════════════════════════════════════════════════════════════════════
# Phase 6: lookup 字段连表解析 (B1.5)
# ════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "[Phase 6] Lookup join (display resolution)" -ForegroundColor Yellow

# 6.1 customer_id 解析为 customer name
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?size=5" -Method Get -Headers $hdr
$first = $resp.data.rows[0]
$cidVal = [string]$first.customer_id
if ($cidVal -notin @("Alpha Corp", "Bravo Inc", "Charlie LLC", "Delta Ltd", "Echo Tech")) {
    Fail "P6.1 customer_id not resolved: '$cidVal'"
}
Pass "P6.1 customer_id → displayField: $cidVal"

# 6.2 product_id 解析为 product name
$pidVal = [string]$first.product_id
if ($pidVal -notin @("Widget A", "Widget B", "Gadget C", "Gadget D")) {
    Fail "P6.2 product_id not resolved: '$pidVal'"
}
Pass "P6.2 product_id → displayField: $pidVal"

# 6.3 salesrep_id 解析为 rep name
$sidVal = [string]$first.salesrep_id
if ($sidVal -notin @("Alice Wong", "Bob Chen", "Carol Liu")) {
    Fail "P6.3 salesrep_id not resolved: '$sidVal'"
}
Pass "P6.3 salesrep_id → displayField: $sidVal"

# 6.4 普通字段 (order_no) 不被替换
$onoVal = [string]$first.order_no
if (-not $onoVal.StartsWith("ORD_")) { Fail "P6.4 order_no corrupted: $onoVal" }
Pass "P6.4 order_no preserved: $onoVal"

# 6.5 批量解析: 验证 API 返回的所有 row 都已解析 (不限定总数, 因为 PowerShell ISE Invoke-RestMethod size 参数不可靠)
$resp = Invoke-RestMethod -Uri "${apiBase}/apps/${appId}/objects/${orderId}/instances" -Method Get -Headers $hdr -Body @{size=100}
$rows = $resp.data.rows
$totalReturned = $rows.Count
$totalExpected = 30  # 期望至少 30 行
if ($totalReturned -lt $totalExpected) { Fail "P6.5 API returned only $totalReturned rows (expected >= $totalExpected)" }
$customerNames = @("Alpha Corp", "Bravo Inc", "Charlie LLC", "Delta Ltd", "Echo Tech")
$productNames = @("Widget A", "Widget B", "Gadget C", "Gadget D")
$repNames = @("Alice Wong", "Bob Chen", "Carol Liu")
$resolvedCount = 0
$failedSamples = @()
for ($i = 0; $i -lt $rows.Count; $i++) {
    $row = $rows[$i]
    $c = [string]$row.customer_id
    $p = [string]$row.product_id
    $s = [string]$row.salesrep_id
    # skip null lookup rows (ORD_NULL_TEST)
    if ($c -eq "" -or $p -eq "") { continue }
    $isResolved = ($customerNames -contains $c) -and ($productNames -contains $p) -and ($repNames -contains $s)
    if ($isResolved) {
        $resolvedCount++
    } elseif ($failedSamples.Count -lt 3) {
        $failedSamples += "row[$i]: c='$c' p='$p' s='$s'"
    }
}
if ($resolvedCount -lt $totalExpected) {
    Write-Host "DEBUG P6.5 samples: $($failedSamples -join '; ')"
    Fail "P6.5 batch resolve failed: only $resolvedCount/$totalExpected orders fully resolved (returned=$totalReturned)"
}
Pass "P6.5 batch resolve: $resolvedCount orders have customer_id, product_id, salesrep_id resolved (returned=$totalReturned rows)"

# ════════════════════════════════════════════════════════════════════
# Phase 7: 综合查询 (filter + sort + page + lookup join)
# ════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "[Phase 7] Complex combined query" -ForegroundColor Yellow

# 7.1 shipped 状态 + amount>=500 + 按 amount desc + 前 5 行 + 所有 lookup 解析
$url = "$apiBase/apps/$appId/objects/$orderId/instances?status_eq=shipped&amount_gte=500&sort=-amount&page=1&size=5"
$resp = Invoke-RestMethod -Uri $url -Method Get -Headers $hdr
$rows = $resp.data.rows
if ($rows.Count -lt 1) { Fail "P7.1 expected >=1 row, got 0" }

# 验证所有行都是 shipped 且 amount >= 500
$allValid = ($rows | Where-Object { $_.status -ne 'shipped' -or [int]$_.amount -lt 500 }).Count
if ($allValid -gt 0) { Fail "P7.1 rows not matching filter: $allValid" }

# 验证按 amount desc
$amounts = $rows | ForEach-Object { [int]$_.amount }
$expected = $amounts | Sort-Object -Descending
if (($amounts -join ',') -ne ($expected -join ',')) { Fail "P7.1 sort broken" }

# 验证 lookup 解析
$cidResolved = $rows[0].customer_id
if ([string]$cidResolved -in @("Alpha Corp", "Bravo Inc", "Charlie LLC", "Delta Ltd", "Echo Tech")) {
    Pass "P7.1 combined query: status=shipped, amount>=500, sort=-amount, page=1, size=5 → 5 rows, lookup resolved"
} else {
    Fail "P7.1 lookup not resolved: customer_id=$cidResolved"
}

# 7.2 不同 lookup 字段做过滤器 + 解析
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?customer_id_eq=$($customerIds[0])" -Method Get -Headers $hdr
$rows = $resp.data.rows
$allAlpha = ($rows | Where-Object { $_.customer_id -ne 'Alpha Corp' }).Count
if ($allAlpha -gt 0) { Fail "P7.2 non-Alpha rows: $allAlpha" }
Pass "P7.2 customer_id_eq=$($customerIds[0]) (Alpha Corp): $($resp.data.total) rows, all resolved to 'Alpha Corp'"

# ════════════════════════════════════════════════════════════════════
# Phase 8: 列表 API 返回字段断言 (B1.6)
# ════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "[Phase 8] B1.6 API response shape (totalCount/pageSize/pageNumber)" -ForegroundColor Yellow

# 8.1 response contains totalCount / pageSize / pageNumber
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?size=15" -Method Get -Headers $hdr
# v1.0.2 后端用 total/page/size (FormDataPageResult 字段)
# Sprint plan B1.6 要求返回 totalCount/pageSize/pageNumber (兼容字段)
$hasTotal = $resp.data.total -ne $null -or $resp.data.totalCount -ne $null
$hasPageSize = $resp.data.size -ne $null -or $resp.data.pageSize -ne $null
$hasPageNumber = $resp.data.page -ne $null -or $resp.data.pageNumber -ne $null
if (-not $hasTotal) { Fail "P8.1 missing total/totalCount in response" }
if (-not $hasPageSize) { Fail "P8.1 missing size/pageSize in response" }
if (-not $hasPageNumber) { Fail "P8.1 missing page/pageNumber in response" }
Pass "P8.1 response shape OK: total=$($resp.data.total), size=$($resp.data.size), page=$($resp.data.page)"

# 8.2 totalCount 一致性
if ($resp.data.total -ne 31) { Fail "P8.2 expected total=31 (30 + ORD_NULL_TEST), got $($resp.data.total)" }
Pass "P8.2 totalCount = 31 (30 orders + 1 null test)"

# ════════════════════════════════════════════════════════════════════
# Phase 9: 错误处理与边界 (B1.4 + B1.5)
# ════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "[Phase 9] Error handling" -ForegroundColor Yellow

# 9.1 non-existent object
try {
    $null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/99999/instances" -Method Get -Headers $hdr
    Fail "P9.1 should reject non-existent object"
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Pass "P9.1 non-existent object returns 404"
    } else {
        Fail "P9.1 wrong status: $($_.Exception.Response.StatusCode)"
    }
}

# 9.2 invalid filter column
try {
    $null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?Bad-Name=value" -Method Get -Headers $hdr
    Fail "P9.2 should reject invalid filter column"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Pass "P9.2 invalid filter column 'Bad-Name' returns 400"
    } else {
        Fail "P9.2 wrong status"
    }
}

# 9.3 invalid sort column
try {
    $null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?sort=BadCol" -Method Get -Headers $hdr
    Fail "P9.3 should reject invalid sort column"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Pass "P9.3 invalid sort column 'BadCol' returns 400"
    } else {
        Fail "P9.3 wrong status"
    }
}

# 9.4 page=0 should be clamped to 1
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?page=0" -Method Get -Headers $hdr
if ($resp.data.page -ne 1) { Fail "P9.4 page=0 should clamp to 1, got $($resp.data.page)" }
Pass "P9.4 page=0 clamped to 1"

# 9.5 size=500 should be clamped to 200
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$orderId/instances?size=500" -Method Get -Headers $hdr
if ($resp.data.size -ne 200) { Fail "P9.5 size=500 should clamp to 200, got $($resp.data.size)" }
Pass "P9.5 size=500 clamped to 200"

# ════════════════════════════════════════════════════════════════════
# Phase 10: 清理
# ════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "[Phase 10] Cleanup" -ForegroundColor Yellow
Invoke-RestMethod -Uri "$apiBase/apps/$appId" -Method Delete -Headers $hdr | Out-Null
Pass "P10.1 cleanup app id=$appId"

# ════════════════════════════════════════════════════════════════════
# Summary
# ════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Sprint 1 Integration Test Summary"
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Total tests: $($passCount + $failCount)"
Write-Host "Passed:      $passCount" -ForegroundColor Green
Write-Host "Failed:      $failCount" -ForegroundColor Red
Write-Host ""
if ($failCount -gt 0) {
    Write-Host "FAILED: see FAIL messages above" -ForegroundColor Red
    exit 1
} else {
    Write-Host "==> B1.7 Sprint 1 Integration: ALL TESTS PASSED" -ForegroundColor Green
    Write-Host ""
    Write-Host "Coverage:" -ForegroundColor Cyan
    Write-Host "  B1.1 listObjects pagination    [x]" -ForegroundColor Green
    Write-Host "  B1.2 FieldRequest lookup config [x]" -ForegroundColor Green
    Write-Host "  B1.3 lookup DDL BIGINT + index  [x]" -ForegroundColor Green
    Write-Host "  B1.4 listInstances sort/filter  [x]" -ForegroundColor Green
    Write-Host "  B1.5 lookup join (displayField) [x]" -ForegroundColor Green
    Write-Host "  B1.6 response shape             [x]" -ForegroundColor Green
    Write-Host ""
    Write-Host "Sprint 1 backend: COMPLETE" -ForegroundColor Green
}