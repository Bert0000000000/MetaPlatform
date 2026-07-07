# MetaPlatform — Windows-native integration test runner (PowerShell)
#
# Mirror of tests/integration/run.sh for local Windows development.
# Identical assertions, identical BASE_URL/EMAIL/PASSWORD env overrides.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File tests/integration/run.ps1
#
# Environment overrides (same as the bash version):
#   BASE_URL  API base URL          (default: http://localhost:3001)
#   EMAIL     login email           (default: admin@metaplatform.com)
#   PASSWORD  login password        (default: admin123)
#   VERBOSE   set to 1 to print every body

$ErrorActionPreference = 'Continue'
$BASE_URL = if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost:3001' }
$EMAIL = if ($env:EMAIL) { $env:EMAIL } else { 'admin@metaplatform.com' }
$PASSWORD = if ($env:PASSWORD) { $env:PASSWORD } else { 'admin123' }
$VERBOSE = ($env:VERBOSE -eq '1')

# ─── Counters ─────────────────────────────────────────────
$script:PASS = 0
$script:FAIL = 0
$script:SKIP = 0
$script:FAILURES = New-Object System.Collections.ArrayList

function Pass($msg) { Write-Host "    PASS $msg" -ForegroundColor Green; $script:PASS++ }
function Fail($msg) { Write-Host "    FAIL $msg" -ForegroundColor Red; $script:FAIL++; $script:FAILURES.Add($msg) | Out-Null }
function Step($n, $name) { Write-Host "`n[$n] $name" -ForegroundColor Cyan }

function Assert-Equal($name, $expected, $actual) {
  if ("$expected" -eq "$actual") { Pass "$name (=$actual)" }
  else { Fail "$name expected='$expected' actual='$actual'" }
}

function Assert-Contains($name, $haystack, $needle) {
  if ($haystack -and $haystack.ToString().Contains($needle)) { Pass "$name contains '$needle'" }
  else { Fail "$name : '$needle' not in '$haystack'" }
}

function Assert-True($name, $cond, $hint = '') {
  if ($cond) { Pass "$name" }
  else { Fail "$name ${hint}" }
}

# ─── HTTP helpers ─────────────────────────────────────────
function Call($method, $path, $body = $null, $token = $null) {
  $headers = @{ 'Content-Type' = 'application/json' }
  if ($token) { $headers['Authorization'] = "Bearer $token" }
  $params = @{
    Uri = "$BASE_URL$path"
    Method = $method
    Headers = $headers
    TimeoutSec = 30
  }
  if ($null -ne $body) {
    $params['Body'] = $body
    $params['ContentType'] = 'application/json'
  }
  try {
    $resp = Invoke-RestMethod @params -ErrorAction Stop
    return @{ Status = 200; Body = $resp; Raw = ($resp | ConvertTo-Json -Depth 16 -Compress) }
  } catch {
    $status = 0
    $body = $null
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $body = $reader.ReadToEnd()
      $reader.Close()
      try { $body = $body | ConvertFrom-Json } catch {}
    } elseif ($_.Exception.InnerException) {
      $body = $_.Exception.InnerException.Message
    }
    return @{ Status = $status; Body = $body; Raw = ($body | ConvertTo-Json -Compress -Depth 16) }
  }
}

function Get-RawText($path) {
  try { (Invoke-WebRequest -Uri "$BASE_URL$path" -UseBasicParsing -TimeoutSec 30).Content }
  catch { $_.Exception.Message }
}

# ─── 0. Wait for API ──────────────────────────────────────
Step 0 "API liveness check"
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    $code = (Invoke-WebRequest -Uri "$BASE_URL/api/health" -UseBasicParsing -TimeoutSec 5).StatusCode
    if ($code -eq 200) { Write-Host "  API ready at $BASE_URL" -ForegroundColor Green; $ready = $true; break }
  } catch {}
  Start-Sleep -Seconds 1
}
if (-not $ready) { Write-Host "  API never became ready" -ForegroundColor Red; exit 1 }

# ─── Phase 1 — Auth + Storage ───────────────────────────
Step 1 "Auth: login + /me"
$r = Call POST /api/auth/login "{`"email`":`"$EMAIL`",`"password`":`"$PASSWORD`"}"
Assert-Equal "login returns 200" 200 $r.Status
$TOKEN = $r.Body.data.token
if ($TOKEN) { Write-Host "    token len=$($TOKEN.Length)" } else { Fail "no token" }

$r = Call GET /api/auth/me $null $TOKEN
Assert-Equal "/me returns 200" 200 $r.Status
$USER_ID = $r.Body.data.id
$USER_EMAIL = $r.Body.data.email
Assert-Equal "/me echoes email" $EMAIL $USER_EMAIL
if ($USER_ID) { Pass "/me returns user id ($USER_ID)" } else { Fail "no user id" }

Step 2 "Storage: backend health"
$r = Call GET /api/storage/health $null $TOKEN
Assert-Equal "storage health returns 200" 200 $r.Status
if ($r.Status -eq 200) {
  $services = @($r.Body.data.PSObject.Properties | ForEach-Object { $_.Name })
  $n = $services.Count
  # Either full 7-service report or a degraded aggregate_timeout is acceptable
  if ($n -ge 7) {
    Pass "storage reports $n services: $($services -join ',')"
  } elseif ($r.Body.data.PSObject.Properties.Name -contains 'status' -and $r.Body.data.status -eq 'aggregate_timeout') {
    Write-Host "    SKIP storage services check (aggregate_timeout — backends slow but API responded)" -ForegroundColor Yellow
    $script:SKIP++
  } else {
    Fail "storage reports $n services: $($services -join ',')"
  }
}

Step 3 "Storage: Neo4j query"
$r = Call POST /api/storage/neo4j/query '{"cypher":"MATCH (n) RETURN count(n) AS total LIMIT 1","params":{}}' $TOKEN
Assert-Equal "neo4j query returns 200" 200 $r.Status

# ─── Phase 2 — AI ───────────────────────────────────────
Step 4 "AI: subsystem status"
$r = Call GET /api/ai/status $null $TOKEN
Assert-Equal "ai/status returns 200" 200 $r.Status
$body = $r.Raw
Assert-Contains "ai status has embeddings" $body '"embeddings"'
Assert-Contains "ai status has llm" $body '"llm"'
Assert-Contains "ai status has ocr" $body '"ocr"'

Step 5 "AI: embed single text"
$r = Call POST /api/ai/embed '{"text":"MetaPlatform is an enterprise AI middleware"}' $TOKEN
Assert-Equal "embed returns 200" 200 $r.Status
$DIM = $r.Body.data.dimension
Assert-True "embed dimension>0" ($DIM -gt 0) "got dim=$DIM"

Step 6 "AI: chat completion"
$r = Call POST /api/ai/chat '{"messages":[{"role":"user","content":"hello"}],"maxTokens":50}' $TOKEN
Assert-Equal "chat returns 200" 200 $r.Status
$content = $r.Body.data.content
if ($content) { Pass "chat returned content len=$($content.Length)" }
else { Fail "no chat content" }

Step 7 "AI: agent tools listing"
$r = Call GET /api/ai/agent/tools $null $TOKEN
Assert-Equal "agent tools returns 200" 200 $r.Status

# ─── Phase 3 — Analytics ─────────────────────────────────
Step 8 "Analytics: status (ClickHouse + CDC)"
$r = Call GET /api/analytics/status $null $TOKEN
Assert-Equal "analytics status returns 200" 200 $r.Status
$body = $r.Raw
Assert-Contains "clickhouse status present" $body '"clickhouse"'
Assert-Contains "cdc status present" $body '"cdc"'

Step 9 "Analytics: ClickHouse create + insert + query"
# First check if ClickHouse is reachable. If not, skip the CH-specific tests.
$r = Call GET /api/analytics/status $null $TOKEN
$chStatus = ($r.Body.data.clickhouse.status | Out-String).Trim()
if ($chStatus -ne 'connected') {
  Write-Host "    SKIP clickhouse tests (status=$chStatus — likely CH container not running locally)" -ForegroundColor Yellow
  $script:SKIP += 3
} else {
  # columns is an array of {name, type} objects, not a string
  $r = Call POST /api/analytics/clickhouse/create-table '{"table":"integration_test","columns":[{"name":"id","type":"UInt32"},{"name":"name","type":"String"}],"engine":"MergeTree()","orderBy":"id"}' $TOKEN
  Assert-True "create-table" ($r.Status -eq 200 -or $r.Status -eq 201) "code=$($r.Status)"

  $r = Call POST /api/analytics/clickhouse/insert '{"table":"integration_test","rows":[{"id":1,"name":"alpha"},{"id":2,"name":"beta"}]}' $TOKEN
  Assert-True "insert rows" ($r.Status -eq 200 -or $r.Status -eq 201) "code=$($r.Status)"

  # Alias count() to a named column for reliable PS access
  $r = Call POST /api/analytics/clickhouse/query '{"sql":"SELECT count() AS c FROM metaplatform.integration_test LIMIT 1"}' $TOKEN
  Assert-True "query" ($r.Status -eq 200) "code=$($r.Status)"
  if ($r.Body.data -and @($r.Body.data).Count -gt 0) {
    $firstRow = $r.Body.data[0]
    # Use regex on JSON-serialized row to extract count value safely
    # API returns numeric values as strings from ClickHouse, so accept both forms
    $rawJson = $firstRow | ConvertTo-Json -Compress
    $count = 0
    if ($rawJson -match '"c"\s*:\s*"?(\d+)"?') { $count = [int]$Matches[1] }
    else { Write-Host "    (could not extract 'c' from: $rawJson)" }
    Assert-True "count>=2" ($count -ge 2) "got count=$count (raw: $rawJson)"
  }
}

Step 10 "Analytics: NL2SQL safety"
$r = Call POST /api/analytics/nl2sql '{"question":"How many rows in integration_test?","tables":["integration_test"]}' $TOKEN
Assert-Equal "nl2sql returns 200" 200 $r.Status

Step 11 "Analytics: quality scoring"
$r = Call POST /api/analytics/quality/score '{"sample":[{"id":1,"email":"ok@example.com"},{"id":2,"email":"bad"}],"rules":[{"column":"email","type":"regex","pattern":"^[^@]+@[^@]+\\.[^@]+$"}]}' $TOKEN
Assert-Equal "quality score returns 200" 200 $r.Status
$score = $r.Body.data.score
$grade = $r.Body.data.grade
if ($score -gt 0) { Pass "score=$score grade=$grade" } else { Fail "no quality score" }

Step 12 "Analytics: simulator"
$r = Call POST /api/analytics/simulate '{"arrivalsPerHour":50,"serviceTimeSec":60,"resources":3,"durationHours":1,"trials":5}' $TOKEN
Assert-Equal "simulator returns 200" 200 $r.Status
$util = $r.Body.data.mean.utilization
if ($util -gt 0) { Pass "utilization=$util" } else { Fail "no simulator utilization" }

# ─── Phase 4 — Observability ────────────────────────────
Step 13 "Observability: Prometheus metrics"
$text = Get-RawText /api/observability/metrics
Assert-Contains "metrics has HELP" $text "# HELP"
Assert-Contains "metrics has process_cpu" $text "metaplatform_process_cpu_seconds_total"
Assert-Contains "metrics has http_requests" $text "metaplatform_http_requests_total"
Assert-Contains "metrics has backend_up" $text "metaplatform_backend_up"

Step 14 "Observability: status"
$r = Call GET /api/observability/status $null $TOKEN
Assert-Equal "observability status returns 200" 200 $r.Status
$body = $r.Raw
Assert-Contains "tracer status" $body '"tracer"'
Assert-Contains "logger status" $body '"logger"'
Assert-Contains "audit status" $body '"audit"'

Step 15 "Observability: traces endpoint"
$r = Call GET "/api/observability/traces?limit=5" $null $TOKEN
Assert-Equal "traces returns 200" 200 $r.Status

Step 16 "Observability: audit endpoint"
$r = Call GET "/api/observability/audit?action=login.success&limit=5" $null $TOKEN
Assert-Equal "audit returns 200" 200 $r.Status

# ─── Phase 5 — Notifications ─────────────────────────────
Step 17 "Notifications: send in-app"
$r = Call POST /api/notifications/test '{"title":"Integration test","body":"From PS runner","category":"test.integration","channels":["inapp"]}' $TOKEN
Assert-Equal "notifications/test returns 200" 200 $r.Status
$NOTIF_ID = $r.Body.data.id
if ($NOTIF_ID) { Pass "notification id=$NOTIF_ID" }

Step 18 "Notifications: list"
$r = Call GET "/api/notifications?limit=5" $null $TOKEN
Assert-Equal "notifications list returns 200" 200 $r.Status
if ($r.Body.data -and @($r.Body.data).Count -ge 1) { Pass "list count=$(@($r.Body.data).Count)" }

Step 19 "Notifications: unread count"
$r = Call GET /api/notifications/unread-count $null $TOKEN
Assert-Equal "unread-count returns 200" 200 $r.Status

Step 20 "Notifications: mark read + mark all read"
if ($NOTIF_ID) {
  $r = Call POST "/api/notifications/$NOTIF_ID/read" $null $TOKEN
  Assert-Equal "mark read returns 200" 200 $r.Status
}
$r = Call POST /api/notifications/read-all $null $TOKEN
Assert-Equal "read-all returns 200" 200 $r.Status

# ─── Phase 6 — Scheduler ─────────────────────────────────
Step 21 "Scheduler: status + list jobs"
$r = Call GET /api/scheduler/status $null $TOKEN
Assert-Equal "scheduler status returns 200" 200 $r.Status
$jobs = $r.Body.data.jobCount
if ($jobs -ge 1) { Pass "$jobs jobs running" } else { Fail "no scheduler jobs" }

Step 22 "Scheduler: register + run + cleanup"
$r = Call POST /api/scheduler/jobs '{"name":"integration.test","cron":"*/15 * * * *","handler":"noop"}' $TOKEN
Assert-True "registered" ($r.Status -eq 200) "code=$($r.Status)"

$r = Call POST /api/scheduler/jobs/integration.test/run $null $TOKEN
Assert-True "ran" ($r.Status -eq 200) "code=$($r.Status)"

# Cleanup
Call DELETE /api/scheduler/jobs/integration.test $null $TOKEN | Out-Null

# ─── Phase 7 — Tenant guard ──────────────────────────────
Step 23 "Tenant: admin header override"
try {
  $headers = @{ 'Authorization' = "Bearer $TOKEN"; 'X-Tenant-Id' = 'some-other-tenant' }
  $resp = Invoke-WebRequest -Uri "$BASE_URL/api/auth/me" -Headers $headers -UseBasicParsing -TimeoutSec 10
  Assert-Equal "tenant override does not break auth" 200 ([int]$resp.StatusCode)
} catch {
  Fail "tenant override failed: $($_.Exception.Message)"
}

# ─── Phase 8 — OpenAPI ───────────────────────────────────
Step 24 "OpenAPI: spec retrieval"
$spec = Get-RawText /api/openapi.json
try {
  $parsed = $spec | ConvertFrom-Json
  $paths = @($parsed.paths.PSObject.Properties).Count
  $tags = @($parsed.tags).Count
  Assert-True "OpenAPI paths>=100" ($paths -ge 100) "got $paths"
  Pass "OpenAPI $paths paths / $tags tags"
} catch {
  Fail "Could not parse OpenAPI JSON"
}

Step 25 "OpenAPI: Swagger UI"
try {
  $code = (Invoke-WebRequest -Uri "$BASE_URL/api/docs/" -UseBasicParsing -TimeoutSec 10).StatusCode
  Assert-Equal "swagger UI HTTP 200" 200 $code
} catch {
  Fail "swagger UI request failed: $($_.Exception.Message)"
}

# ─── Summary ─────────────────────────────────────────────
Write-Host "`n════════════════════════════════════════════════════════════════"
Write-Host "  Tests passed:  $($script:PASS)" -ForegroundColor Green
Write-Host "  Tests failed:  $($script:FAIL)" -ForegroundColor $(if ($script:FAIL -eq 0) { 'Green' } else { 'Red' })
Write-Host "  Tests skipped: $($script:SKIP)" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════════"

if ($script:FAIL -gt 0) {
  Write-Host "`nFailures:"
  foreach ($f in $script:FAILURES) { Write-Host "  - $f" -ForegroundColor Red }
  exit 1
}

Write-Host "`nAll integration tests passed!" -ForegroundColor Green
exit 0