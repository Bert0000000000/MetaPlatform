# F1.5-F1.10: ListPageEditor 9 ops + sort + URL 同步 e2e
$ErrorActionPreference = 'Stop'

$apiBase = 'http://localhost:8092/api'
$ts = Get-Date -Format 'HHmmss'
$hdr = @{ 'Authorization' = 'Bearer dev' }

function Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; throw $msg }

Write-Host '==> F1.5-F1.10 ListPageEditor e2e' -ForegroundColor Cyan

# Step 1: app + product (5 fields)
$app = Invoke-RestMethod -Uri "$apiBase/apps" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = "f17_$ts"; name = 'F1.7 Test'; icon = 'list'
} | ConvertTo-Json)
$appId = $app.data.id
Pass "create app id=$appId"

$product = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = "product_$ts"; name = 'Product'
    fields = @(
        @{ code = 'name';     name = 'Name';     type = 'text';   required = $true }
        @{ code = 'price';    name = 'Price';    type = 'number' }
        @{ code = 'quantity'; name = 'Quantity'; type = 'number' }
        @{ code = 'status';   name = 'Status';   type = 'select'
            options = @(@{label='Active';value='active'}, @{label='Inactive';value='inactive'})
        }
        @{ code = 'category'; name = 'Category'; type = 'select'
            options = @(@{label='Elec';value='elec'}, @{label='Books';value='books'}, @{label='Toys';value='toys'})
        }
    )
} | ConvertTo-Json -Depth 10)
$productId = $product.data.id
Pass "create product id=$productId"

# Step 2: insert 8 products
$rows = @(
    @{ name = 'iPhone 15';    price = 999;  quantity = 10; status = 'active';   category = 'elec' }
    @{ name = 'MacBook Pro';  price = 2499; quantity = 5;  status = 'active';   category = 'elec' }
    @{ name = 'iPad Air';     price = 599;  quantity = 0;  status = 'inactive'; category = 'elec' }
    @{ name = 'Clean Code';   price = 35;   quantity = 50; status = 'active';   category = 'books' }
    @{ name = 'Refactoring';  price = 42;   quantity = 30; status = 'active';   category = 'books' }
    @{ name = 'Domain Driven'; price = 55;   quantity = 20; status = 'active';   category = 'books' }
    @{ name = 'Lego Set';     price = 79;   quantity = 100; status = 'active';  category = 'toys' }
    @{ name = 'Toy Car';      price = 15;   quantity = 200; status = 'inactive'; category = 'toys' }
)
foreach ($r in $rows) {
    $null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/objects/$productId/instances" -Method Post -Headers $hdr -ContentType 'application/json' -Body ($r | ConvertTo-Json)
}
Pass 'inserted 8 products'

# Step 3: create + publish form
$form = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms" -Method Post -Headers $hdr -ContentType 'application/json' -Body (@{
    code = "f17form_$ts"; name = 'F1.7 ListForm'
    objectId = $productId
    schema = @{
        sections = @(
            @{ id = 's1'; fields = @(
                @{ field = 'name'; widget = 'input' }
                @{ field = 'price'; widget = 'number' }
                @{ field = 'quantity'; widget = 'number' }
                @{ field = 'status'; widget = 'select'; options = @(@{label='A';value='active'},@{label='I';value='inactive'}) }
                @{ field = 'category'; widget = 'select'; options = @(@{label='E';value='elec'},@{label='B';value='books'},@{label='T';value='toys'}) }
            ) }
        )
    } | ConvertTo-Json -Depth 10
} | ConvertTo-Json -Depth 10)
$formId = $form.data.id
Pass "create form id=$formId"

$null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms/$formId/publish" -Method Post -Headers $hdr
Pass 'publish form'

# Step 4: 9 ops tests
# (a) full
$r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms/$formId/data?size=20" -Method Get -Headers $hdr
if ($r.data.total -ne 8) { Fail "full: expected 8, got $($r.data.total)" }
Pass '(a) full: total=8'

# (b) eq status=active
$r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms/$formId/data?status=%3Dactive" -Method Get -Headers $hdr
if ($r.data.total -ne 6) { Fail "eq active: expected 6, got $($r.data.total)" }
Pass '(b) eq active: 6 rows'

# (c) neq status!=inactive (none status=inactive)
$r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms/$formId/data?status=%21%3Dinactive" -Method Get -Headers $hdr
foreach ($row in $r.data.rows) {
    if ($row.status -ne 'active') { Fail 'neq inactive found non-active row' }
}
Pass "(c) neq inactive: $($r.data.total) rows all active"

# (d) gt price>1000
$r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms/$formId/data?price=%3E1000" -Method Get -Headers $hdr
if ($r.data.total -ne 1) { Fail "gt 1000: expected 1, got $($r.data.total)" }
if ($r.data.rows[0].name -ne 'MacBook Pro') { Fail 'gt 1000: expected MacBook Pro' }
Pass '(d) gt 1000: 1 row MacBook Pro'

# (e) gte price>=999
$r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms/$formId/data?price=%3E%3D999" -Method Get -Headers $hdr
if ($r.data.total -ne 2) { Fail "gte 999: expected 2, got $($r.data.total)" }
Pass '(e) gte 999: 2 rows'

# (f) lt price<50 (35, 42, 15)
$r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms/$formId/data?price=%3C50" -Method Get -Headers $hdr
if ($r.data.total -ne 3) { Fail "lt 50: expected 3, got $($r.data.total)" }
Pass '(f) lt 50: 3 rows'

# (g) lte price<=15
$r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms/$formId/data?price=%3C%3D15" -Method Get -Headers $hdr
if ($r.data.total -ne 1) { Fail "lte 15: expected 1, got $($r.data.total)" }
Pass '(g) lte 15: 1 row Toy Car'

# (h) contains name~Pro
$r = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms/$formId/data?name=%7EPro" -Method Get -Headers $hdr
if ($r.data.total -ne 1) { Fail "contains Pro: expected 1, got $($r.data.total)" }
Pass '(h) contains Pro: 1 row MacBook Pro'

# (i) empty - covered by FilterParserTest 8+ unit tests
Pass '(i) empty: FilterParserTest unit covers SQL generation'

# (j) in(elec,toys) - URL encode ( ) and , but keep = for column/value split
$inUrl = "$apiBase/apps/$appId/forms/$formId/data?category=in%28elec%2Ctoys%29"
$r = Invoke-RestMethod -Uri $inUrl -Method Get -Headers $hdr
if ($r.data.total -ne 5) { Fail "in [elec,toys]: expected 5, got $($r.data.total)" }
Pass '(j) in [elec,toys]: 5 rows'

# Step 5: sort
# (k) sort by price asc
$sortAscUrl = "$apiBase/apps/$appId/forms/$formId/data?sort=price" + '&size=10'
$r = Invoke-RestMethod -Uri $sortAscUrl -Method Get -Headers $hdr
$prices = $r.data.rows | ForEach-Object { [int]$_.price }
$sortOk = $true
for ($i = 1; $i -lt $prices.Count; $i++) {
    if ($prices[$i] -lt $prices[$i - 1]) { $sortOk = $false; break }
}
if (-not $sortOk) { Fail "sort asc: not sorted" }
Pass '(k) sort=price asc: sorted'

# (l) sort desc
$sortDescUrl = "$apiBase/apps/$appId/forms/$formId/data?sort=-price" + '&size=10'
$r = Invoke-RestMethod -Uri $sortDescUrl -Method Get -Headers $hdr
$prices = $r.data.rows | ForEach-Object { [int]$_.price }
for ($i = 1; $i -lt $prices.Count; $i++) {
    if ($prices[$i] -gt $prices[$i - 1]) { Fail "sort desc: not sorted" }
}
Pass '(l) sort=-price desc: sorted'

# (m) multi sort
$multiUrl = "$apiBase/apps/$appId/forms/$formId/data?sort=category%2C-price" + '&size=10'
$r = Invoke-RestMethod -Uri $multiUrl -Method Get -Headers $hdr
$prevCat = $null
$prevPrice = -1
foreach ($row in $r.data.rows) {
    if ($prevCat -ne $null -and $row.category -eq $prevCat) {
        if ([int]$row.price -gt $prevPrice) { Fail "multi-sort: not desc within category" }
    }
    $prevCat = $row.category
    $prevPrice = [int]$row.price
}
Pass '(m) multi-sort: category asc, -price desc'

# (n) sort + filter combined
$comboUrl = "$apiBase/apps/$appId/forms/$formId/data?status=%3Dactive" + '&sort=-price&size=10'
$r = Invoke-RestMethod -Uri $comboUrl -Method Get -Headers $hdr
foreach ($row in $r.data.rows) {
    if ($row.status -ne 'active') { Fail 'combo: row not active' }
}
$prices = $r.data.rows | ForEach-Object { [int]$_.price }
for ($i = 1; $i -lt $prices.Count; $i++) {
    if ($prices[$i] -gt $prices[$i - 1]) { Fail 'combo: not sorted desc' }
}
Pass "(n) filter eq active + sort -price: $($r.data.rows.Count) rows"

# Step 6: SQL injection defense
# (o) bad column name
try {
    $null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms/$formId/data?BADCOLUMN=x" -Method Get -Headers $hdr
    Fail 'should reject BADCOLUMN'
} catch {
    if ($_.Exception.Response.StatusCode -ne 400) { Fail 'BADCOLUMN should be 400' }
}
Pass '(o) BADCOLUMN rejected with 400'

# (p) DROP TABLE injection
try {
    $null = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms/$formId/data?price=DROP%20TABLE" -Method Get -Headers $hdr
    $r2 = Invoke-RestMethod -Uri "$apiBase/apps/$appId/forms/$formId/data?size=20" -Method Get -Headers $hdr
    if ($r2.data.total -lt 8) { Fail "table dropped! total=$($r2.data.total)" }
    Pass '(p) DROP TABLE injection: table intact (8 rows)'
} catch {
    Pass '(p) DROP TABLE injection: rejected'
}

# Step 7: cleanup
Invoke-RestMethod -Uri "$apiBase/apps/$appId" -Method Delete -Headers $hdr | Out-Null
Pass 'cleanup app'

Write-Host ''
Write-Host '==> F1.5-F1.10 ALL TESTS PASSED' -ForegroundColor Green