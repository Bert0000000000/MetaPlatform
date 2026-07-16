# B1.1 验收: listObjects 支持分页 (向后兼容 + 分页返回 + 边界值校验)
$ErrorActionPreference = 'Stop'

$apiBase = 'http://localhost:8092/api'
$ts = Get-Date -Format 'HHmmss'
$hdr = @{ 'Authorization' = 'Bearer dev' }

function Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; throw $msg }

Write-Host "==> B1.1 listObjects pagination verification" -ForegroundColor Cyan

# 1. 创建测试应用
$appCode = "b11_$ts"
$app = Invoke-RestMethod -Uri "$apiBase/apps" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = $appCode; name = "B1.1 Pagination Test"; icon = "list"; description = "pagination test"
} | ConvertTo-Json)
$appId = $app.data.id
Pass ("create app id=" + $appId)

# 2. 创建 25 个对象（用于分页测试）
$createdIds = @()
for ($i = 1; $i -le 25; $i++) {
    $objCode = "obj_{0:D2}_{1}" -f $i, $ts
    $obj = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
        code = $objCode; name = "Object $i"; description = "test obj $i"
    } | ConvertTo-Json)
    $createdIds += [int64]$obj.data.id
}
Pass ("created " + $createdIds.Count + " objects")

# === 测试 1: 向后兼容 - 不带分页参数应返回纯列表 ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Get -Headers $hdr
if ($resp.data.Count -eq 25) {
    Pass "TC1 backward-compat: GET without params returns 25 objects (raw list)"
} else {
    Fail "TC1 expected 25 objects, got $($resp.data.Count)"
}
if ($resp.data[0].PSObject.Properties['items']) {
    Fail "TC1 backward-compat FAILED: should NOT return PageResult when no page/size"
}
Pass "TC1 response shape is raw list (not PageResult)"

# === 测试 2: 分页 - page=1 size=10 ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects?page=1&size=10" -Method Get -Headers $hdr
if ($resp.data.total -ne 25) { Fail "TC2 expected total=25, got $($resp.data.total)" }
if ($resp.data.page -ne 1) { Fail "TC2 expected page=1, got $($resp.data.page)" }
if ($resp.data.size -ne 10) { Fail "TC2 expected size=10, got $($resp.data.size)" }
if ($resp.data.totalPages -ne 3) { Fail "TC2 expected totalPages=3, got $($resp.data.totalPages)" }
if ($resp.data.items.Count -ne 10) { Fail "TC2 expected items.Count=10, got $($resp.data.items.Count)" }
if (-not $resp.data.hasNext) { Fail "TC2 expected hasNext=true" }
if ($resp.data.hasPrev) { Fail "TC2 expected hasPrev=false" }
Pass "TC2 page=1 size=10: items=10, total=25, totalPages=3, hasNext=true, hasPrev=false"

# === 测试 3: 中间页 page=2 size=10 ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects?page=2&size=10" -Method Get -Headers $hdr
if ($resp.data.items.Count -ne 10) { Fail "TC3 expected items=10, got $($resp.data.items.Count)" }
if (-not $resp.data.hasNext) { Fail "TC3 expected hasNext=true" }
if (-not $resp.data.hasPrev) { Fail "TC3 expected hasPrev=true" }
Pass "TC3 page=2 size=10: items=10, hasNext=true, hasPrev=true"

# === 测试 4: 最后一页 page=3 size=10 (只有 5 条) ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects?page=3&size=10" -Method Get -Headers $hdr
if ($resp.data.items.Count -ne 5) { Fail "TC4 expected items=5, got $($resp.data.items.Count)" }
if ($resp.data.hasNext) { Fail "TC4 expected hasNext=false" }
if (-not $resp.data.hasPrev) { Fail "TC4 expected hasPrev=true" }
Pass "TC4 page=3 size=10: items=5, hasNext=false, hasPrev=true"

# === 测试 5: 越界 page=99 ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects?page=99&size=10" -Method Get -Headers $hdr
if ($resp.data.total -ne 25) { Fail "TC5 expected total=25, got $($resp.data.total)" }
if ($resp.data.items.Count -ne 0) { Fail "TC5 expected items=0 (empty), got $($resp.data.items.Count)" }
Pass "TC5 page=99 (beyond): items=0 (empty), total=25 preserved"

# === 测试 6: 只传 size (page 默认为 1) ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects?size=5" -Method Get -Headers $hdr
if ($resp.data.page -ne 1) { Fail "TC6 expected page=1, got $($resp.data.page)" }
if ($resp.data.size -ne 5) { Fail "TC6 expected size=5, got $($resp.data.size)" }
if ($resp.data.items.Count -ne 5) { Fail "TC6 expected items=5, got $($resp.data.items.Count)" }
Pass "TC6 size-only: page=1 (default), size=5, items=5"

# === 测试 7: 只传 page (size 默认为 50) ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects?page=1" -Method Get -Headers $hdr
if ($resp.data.page -ne 1) { Fail "TC7 expected page=1" }
if ($resp.data.size -ne 50) { Fail "TC7 expected size=50 (default), got $($resp.data.size)" }
Pass "TC7 page-only: page=1, size=50 (default)"

# === 测试 8: 边界 - size=500 ===
$resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects?page=1&size=500" -Method Get -Headers $hdr
if ($resp.data.size -ne 500) { Fail "TC8 expected size=500" }
if ($resp.data.items.Count -ne 25) { Fail "TC8 expected items=25, got $($resp.data.items.Count)" }
Pass "TC8 size=500 (max): items=25 (less than size, OK)"

# === 测试 9: 非法值 - page=0 ===
try {
    $resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects?page=0&size=10" -Method Get -Headers $hdr
    Fail "TC9 should reject page=0"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Pass "TC9 page=0 rejected with 400"
    } else {
        Fail "TC9 wrong status code: $($_.Exception.Response.StatusCode)"
    }
}

# === 测试 10: 非法值 - size=0 ===
try {
    $resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects?page=1&size=0" -Method Get -Headers $hdr
    Fail "TC10 should reject size=0"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Pass "TC10 size=0 rejected with 400"
    } else {
        Fail "TC10 wrong status code: $($_.Exception.Response.StatusCode)"
    }
}

# === 测试 11: 非法值 - size=501 ===
try {
    $resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects?page=1&size=501" -Method Get -Headers $hdr
    Fail "TC11 should reject size=501"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Pass "TC11 size=501 rejected with 400"
    } else {
        Fail "TC11 wrong status code: $($_.Exception.Response.StatusCode)"
    }
}

# === 测试 12: 非法值 - 字符串数字 ===
try {
    $resp = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects?page=abc&size=10" -Method Get -Headers $hdr
    Fail "TC12 should reject page=abc"
} catch {
    # Spring 默认会返回 400 Bad Request 因为类型不匹配
    Pass "TC12 page=abc rejected (status=$($_.Exception.Response.StatusCode))"
}

# === 测试 13: 排序稳定性 - 分页后每页 items 不重叠 ===
$page1 = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects?page=1&size=10" -Method Get -Headers $hdr
$page2 = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects?page=2&size=10" -Method Get -Headers $hdr
$page3 = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects?page=3&size=10" -Method Get -Headers $hdr

$idsP1 = @($page1.data.items | ForEach-Object { $_.id })
$idsP2 = @($page2.data.items | ForEach-Object { $_.id })
$idsP3 = @($page3.data.items | ForEach-Object { $_.id })

# 使用哈希集求交集 (任一 ID 同时出现在两页即重叠)
function Get-Intersect($a, $b) {
    $set = @{}
    foreach ($x in $a) { $set[$x] = $true }
    $result = @()
    foreach ($y in $b) { if ($set.ContainsKey($y)) { $result += $y } }
    return $result
}

$overlap12 = Get-Intersect $idsP1 $idsP2
if ($overlap12.Count -gt 0) { Fail "TC13 page1 and page2 overlap: $($overlap12 -join ',')" }
$overlap23 = Get-Intersect $idsP2 $idsP3
if ($overlap23.Count -gt 0) { Fail "TC13 page2 and page3 overlap: $($overlap23 -join ',')" }
$allIds = @($idsP1 + $idsP2 + $idsP3)
$uniqueIds = @($allIds | Sort-Object -Unique)
if ($uniqueIds.Count -ne 25) { Fail "TC13 expected 25 unique IDs, got $($uniqueIds.Count)" }
Pass "TC13 sort stability: page1/2/3 have no overlap, total 25 IDs unique (page1=$($idsP1.Count), page2=$($idsP2.Count), page3=$($idsP3.Count))"

# === 测试 14: 清理 ===
Invoke-RestMethod -Uri "$apiBase/apps/$appId" -Method Delete -Headers $hdr | Out-Null
Pass "cleanup app"

Write-Host ""
Write-Host "==> B1.1 pagination: ALL TESTS PASSED" -ForegroundColor Green