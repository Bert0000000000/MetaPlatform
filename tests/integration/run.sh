#!/usr/bin/env bash
# MetaPlatform — portable integration test runner
#
# Runs all phase integration tests as a single bash script. Designed to
# run unchanged in three contexts:
#   - Local developer: bash tests/integration/run.sh
#   - CI Linux runner: same command, no PowerShell / no Windows paths
#   - Inside docker-compose: same command, baseUrl=http://api:3001
#
# Requirements:
#   - bash 4+
#   - curl
#   - jq (for JSON parsing + assertions)
#   - API server reachable at $BASE_URL (default http://localhost:3001)
#
# Environment overrides:
#   BASE_URL  API base URL          (default: http://localhost:3001)
#   EMAIL     login email           (default: admin@metaplatform.com)
#   PASSWORD  login password        (default: admin123)
#   VERBOSE   set to 1 to print every body
#   FAST      set to 1 to skip ratelimit-sensitive steps

set -u
BASE_URL="${BASE_URL:-http://localhost:3001}"
EMAIL="${EMAIL:-admin@metaplatform.com}"
PASSWORD="${PASSWORD:-admin123}"
VERBOSE="${VERBOSE:-0}"
FAST="${FAST:-0}"

# ─── Colors ───────────────────────────────────────────────
if [[ -t 1 ]]; then
  GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; YELLOW=$'\033[0;33m'
  CYAN=$'\033[0;36m'; NC=$'\033[0m'
else
  GREEN=""; RED=""; YELLOW=""; CYAN=""; NC=""
fi

# ─── Counters ─────────────────────────────────────────────
PASS=0
FAIL=0
SKIP=0
declare -a FAILURES

# ─── Assertion helpers ───────────────────────────────────
PASS_COUNT=0
assert_eq() {
  # assert_eq <name> <expected> <actual>
  local name="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo -e "    ${GREEN}PASS${NC} $name (=$actual)"
    PASS=$((PASS + 1))
  else
    echo -e "    ${RED}FAIL${NC} $name expected='$expected' actual='$actual'"
    FAIL=$((FAIL + 1))
    FAILURES+=("$name: expected '$expected', got '$actual'")
  fi
}

assert_true() {
  # assert_true <name> <condition-as-string>
  local name="$1" cond="$2"
  if [[ "$cond" == "true" ]]; then
    echo -e "    ${GREEN}PASS${NC} $name"
    PASS=$((PASS + 1))
  else
    echo -e "    ${RED}FAIL${NC} $name (cond=$cond)"
    FAIL=$((FAIL + 1))
    FAILURES+=("$name: condition '$cond' was not true")
  fi
}

assert_contains() {
  # assert_contains <name> <haystack> <needle>
  local name="$1" haystack="$2" needle="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo -e "    ${GREEN}PASS${NC} $name contains '$needle'"
    PASS=$((PASS + 1))
  else
    echo -e "    ${RED}FAIL${NC} $name: '$needle' not in '$haystack'"
    FAIL=$((FAIL + 1))
    FAILURES+=("$name: '$needle' not found in '$haystack'")
  fi
}

skip() {
  local name="$1" reason="$2"
  echo -e "    ${YELLOW}SKIP${NC} $name — $reason"
  SKIP=$((SKIP + 1))
}

step() {
  echo ""
  echo -e "${CYAN}[$1] $2${NC}"
}

# ─── HTTP helpers ─────────────────────────────────────────
# JSON body passed as $3, stored in a tmpfile so it works for any size.
JSON_TMP=$(mktemp /tmp/mp.XXXXXX.json)
trap 'rm -f "$JSON_TMP"' EXIT

call() {
  # call <method> <path> [body-json] [auth-token]
  local method="$1" path="$2" body="${3:-}" token="${4:-}"
  local args=(-sS -w '\n%{http_code}' -X "$method" "$BASE_URL$path"
              -H 'Content-Type: application/json')
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  if [[ -n "$body" ]]; then
    printf '%s' "$body" > "$JSON_TMP"
    args+=(--data-binary "@$JSON_TMP")
  fi
  curl "${args[@]}"
}

# Parse last line of response as HTTP code, all preceding lines as body
http_body() { sed '$d' <<<"$1"; }
http_code() { tail -n1 <<<"$1"; }

# ─── 0. Wait for API ──────────────────────────────────────
step 0 "API liveness check"
for i in {1..30}; do
  CODE=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/api/health" 2>/dev/null || echo "000")
  if [[ "$CODE" == "200" ]]; then
    echo -e "  ${GREEN}API ready${NC} at $BASE_URL"
    break
  fi
  if [[ "$i" == "30" ]]; then
    echo -e "  ${RED}API never became ready${NC} — last code=$CODE"
    exit 1
  fi
  sleep 1
done

# ─── Phase 1 — Auth + Storage ───────────────────────────
step 1 "Auth: login + /me"
RESP=$(call POST /api/auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
CODE=$(http_code "$RESP"); BODY=$(http_body "$RESP")
assert_eq "login returns 200" "200" "$CODE"
TOKEN=$(echo "$BODY" | jq -r '.data.token // empty')
[[ -n "$TOKEN" ]] && echo "    token len=${#TOKEN}" || echo -e "    ${RED}no token in response${NC}"

RESP=$(call GET /api/auth/me "" "$TOKEN")
CODE=$(http_code "$RESP"); BODY=$(http_body "$RESP")
assert_eq "/me returns 200" "200" "$CODE"
USER_ID=$(echo "$BODY" | jq -r '.data.id // empty')
USER_EMAIL=$(echo "$BODY" | jq -r '.data.email // empty')
assert_eq "/me echoes email" "$EMAIL" "$USER_EMAIL"
[[ -n "$USER_ID" ]] && PASS=$((PASS + 1)) && echo -e "    ${GREEN}PASS${NC} /me returns user id ($USER_ID)"

step 2 "Storage: backend health"
RESP=$(call GET /api/storage/health "" "$TOKEN")
CODE=$(http_code "$RESP")
assert_eq "storage health returns 200" "200" "$CODE"
if [[ "$CODE" == "200" ]]; then
  # All 7 backends should be reported (postgres, redis, neo4j, es, milvus, minio, kafka)
  SERVICES=$(echo "$RESP" | http_body | jq -r '.data | keys | length')
  echo -e "    ${GREEN}PASS${NC} storage reports $SERVICES services"
  [[ "$SERVICES" -ge 7 ]] && PASS=$((PASS + 1)) || { FAIL=$((FAIL + 1)); FAILURES+=("storage backend count"); }
fi

step 3 "Storage: Neo4j query"
RESP=$(call POST /api/storage/neo4j/query '{"cypher":"MATCH (n) RETURN count(n) AS total LIMIT 1","params":{}}' "$TOKEN")
CODE=$(http_code "$RESP")
assert_eq "neo4j query returns 200" "200" "$CODE"

# ─── Phase 2 — AI ───────────────────────────────────────
step 4 "AI: subsystem status"
RESP=$(call GET /api/ai/status "" "$TOKEN")
CODE=$(http_code "$RESP"); BODY=$(http_body "$RESP")
assert_eq "ai/status returns 200" "200" "$CODE"
assert_contains "ai status has embeddings" "$BODY" '"embeddings"'
assert_contains "ai status has llm" "$BODY" '"llm"'
assert_contains "ai status has ocr" "$BODY" '"ocr"'

step 5 "AI: embed single text"
RESP=$(call POST /api/ai/embed '{"text":"MetaPlatform is an enterprise AI middleware"}' "$TOKEN")
CODE=$(http_code "$RESP"); BODY=$(http_body "$RESP")
assert_eq "embed returns 200" "200" "$CODE"
DIM=$(echo "$BODY" | jq -r '.data.dimension // 0')
[[ "$DIM" -gt 0 ]] && PASS=$((PASS + 1)) && echo -e "    ${GREEN}PASS${NC} embed dimension=$DIM" || { FAIL=$((FAIL + 1)); FAILURES+=("embed dimension"); }

step 6 "AI: chat completion (stub or real)"
RESP=$(call POST /api/ai/chat '{"messages":[{"role":"user","content":"hello"}],"maxTokens":50}' "$TOKEN")
CODE=$(http_code "$RESP"); BODY=$(http_body "$RESP")
assert_eq "chat returns 200" "200" "$CODE"
CONTENT=$(echo "$BODY" | jq -r '.data.content // ""')
[[ -n "$CONTENT" ]] && PASS=$((PASS + 1)) && echo -e "    ${GREEN}PASS${NC} chat returned content len=${#CONTENT}" || { FAIL=$((FAIL + 1)); FAILURES+=("chat content"); }

step 7 "AI: agent tools listing"
RESP=$(call GET /api/ai/agent/tools "" "$TOKEN")
CODE=$(http_code "$RESP")
assert_eq "agent tools returns 200" "200" "$CODE"

# ─── Phase 3 — Analytics ─────────────────────────────────
step 8 "Analytics: status (ClickHouse + CDC)"
RESP=$(call GET /api/analytics/status "" "$TOKEN")
CODE=$(http_code "$RESP"); BODY=$(http_body "$RESP")
assert_eq "analytics status returns 200" "200" "$CODE"
assert_contains "clickhouse status present" "$BODY" '"clickhouse"'
assert_contains "cdc status present" "$BODY" '"cdc"'

step 9 "Analytics: ClickHouse create + insert + query"
# Check if ClickHouse is reachable. If not, skip CH-specific tests.
# In CI the CH container IS up, so this block always proceeds there.
RESP=$(call GET /api/analytics/status "" "$TOKEN")
BODY=$(http_body "$RESP")
CH_STATUS=$(echo "$BODY" | jq -r '.data.clickhouse.status // "unknown"')
if [[ "$CH_STATUS" != "connected" ]]; then
  echo -e "    ${YELLOW}SKIP${NC} clickhouse tests (status=$CH_STATUS — CH container likely not running locally)"
  SKIP=$((SKIP + 3))
else
  # Create a test table (columns is an array, not a string)
  RESP=$(call POST /api/analytics/clickhouse/create-table '{"table":"integration_test","columns":[{"name":"id","type":"UInt32"},{"name":"name","type":"String"}],"engine":"MergeTree()","orderBy":"id"}' "$TOKEN")
  CODE=$(http_code "$RESP")
  [[ "$CODE" == "200" || "$CODE" == "201" ]] && PASS=$((PASS + 1)) && echo -e "    ${GREEN}PASS${NC} create-table" || { FAIL=$((FAIL + 1)); FAILURES+=("create-table code=$CODE"); }

  # Insert
  RESP=$(call POST /api/analytics/clickhouse/insert '{"table":"integration_test","rows":[{"id":1,"name":"alpha"},{"id":2,"name":"beta"}]}' "$TOKEN")
  CODE=$(http_code "$RESP")
  [[ "$CODE" == "200" || "$CODE" == "201" ]] && PASS=$((PASS + 1)) && echo -e "    ${GREEN}PASS${NC} insert rows" || { FAIL=$((FAIL + 1)); FAILURES+=("insert code=$CODE"); }

  # Query (alias the count() to a named field for reliable jq path)
  RESP=$(call POST /api/analytics/clickhouse/query '{"sql":"SELECT count() AS c FROM metaplatform.integration_test LIMIT 1"}' "$TOKEN")
  CODE=$(http_code "$RESP"); BODY=$(http_body "$RESP")
  [[ "$CODE" == "200" ]] && PASS=$((PASS + 1)) && echo -e "    ${GREEN}PASS${NC} query" || { FAIL=$((FAIL + 1)); FAILURES+=("query code=$CODE"); }
  COUNT=$(echo "$BODY" | jq -r '.data[0].c // .data[0]["c"] // 0')
  [[ "$COUNT" -ge 2 ]] && PASS=$((PASS + 1)) && echo -e "    ${GREEN}PASS${NC} count=$COUNT" || { FAIL=$((FAIL + 1)); FAILURES+=("expected count>=2 got $COUNT"); }
fi

step 10 "Analytics: NL2SQL safety"
RESP=$(call POST /api/analytics/nl2sql '{"question":"How many rows in integration_test?","tables":["integration_test"]}' "$TOKEN")
CODE=$(http_code "$RESP")
assert_eq "nl2sql returns 200" "200" "$CODE"

step 11 "Analytics: quality scoring"
RESP=$(call POST /api/analytics/quality/score '{"sample":[{"id":1,"email":"ok@example.com"},{"id":2,"email":"bad"}],"rules":[{"column":"email","type":"regex","pattern":"^[^@]+@[^@]+\\\\.[^@]+$"}]}' "$TOKEN")
CODE=$(http_code "$RESP"); BODY=$(http_body "$RESP")
assert_eq "quality score returns 200" "200" "$CODE"
SCORE=$(echo "$BODY" | jq -r '.data.score // 0')
GRADE=$(echo "$BODY" | jq -r '.data.grade // "F"')
[[ "$SCORE" != "0" ]] && PASS=$((PASS + 1)) && echo -e "    ${GREEN}PASS${NC} score=$SCORE grade=$GRADE" || { FAIL=$((FAIL + 1)); FAILURES+=("quality score"); }

step 12 "Analytics: simulator"
RESP=$(call POST /api/analytics/simulate '{"arrivalsPerHour":50,"serviceTimeSec":60,"resources":3,"durationHours":1,"trials":5}' "$TOKEN")
CODE=$(http_code "$RESP"); BODY=$(http_body "$RESP")
assert_eq "simulator returns 200" "200" "$CODE"
UTIL=$(echo "$BODY" | jq -r '.data.mean.utilization // 0')
[[ "$UTIL" != "0" ]] && PASS=$((PASS + 1)) && echo -e "    ${GREEN}PASS${NC} utilization=$UTIL" || { FAIL=$((FAIL + 1)); FAILURES+=("simulator utilization"); }

# ─── Phase 4 — Observability ────────────────────────────
step 13 "Observability: Prometheus metrics"
RESP=$(curl -sS "$BASE_URL/api/observability/metrics")
assert_contains "metrics text" "$RESP" "# HELP"
assert_contains "metrics has process_cpu" "$RESP" "metaplatform_process_cpu_seconds_total"
assert_contains "metrics has http_requests" "$RESP" "metaplatform_http_requests_total"
assert_contains "metrics has backend_up" "$RESP" "metaplatform_backend_up"

step 14 "Observability: status (tracer/logger/audit)"
RESP=$(call GET /api/observability/status "" "$TOKEN")
CODE=$(http_code "$RESP"); BODY=$(http_body "$RESP")
assert_eq "observability status returns 200" "200" "$CODE"
assert_contains "tracer status" "$BODY" '"tracer"'
assert_contains "logger status" "$BODY" '"logger"'
assert_contains "audit status" "$BODY" '"audit"'

step 15 "Observability: traces endpoint"
RESP=$(call GET /api/observability/traces?limit=5 "" "$TOKEN")
CODE=$(http_code "$RESP")
assert_eq "traces returns 200" "200" "$CODE"

step 16 "Observability: audit endpoint"
RESP=$(call GET /api/observability/audit?action=login.success&limit=5 "" "$TOKEN")
CODE=$(http_code "$RESP")
assert_eq "audit returns 200" "200" "$CODE"

# ─── Phase 5 — Notifications ─────────────────────────────
step 17 "Notifications: send in-app"
RESP=$(call POST /api/notifications/test '{"title":"Integration test","body":"From bash test runner","category":"test.integration","channels":["inapp"]}' "$TOKEN")
CODE=$(http_code "$RESP"); BODY=$(http_body "$RESP")
assert_eq "notifications/test returns 200" "200" "$CODE"
NOTIF_ID=$(echo "$BODY" | jq -r '.data.id // empty')
[[ -n "$NOTIF_ID" ]] && PASS=$((PASS + 1)) && echo -e "    ${GREEN}PASS${NC} notification id=$NOTIF_ID"

step 18 "Notifications: list"
RESP=$(call GET "/api/notifications?limit=5" "" "$TOKEN")
CODE=$(http_code "$RESP"); BODY=$(http_body "$RESP")
assert_eq "notifications list returns 200" "200" "$CODE"
NCOUNT=$(echo "$BODY" | jq -r '.data | length')
[[ "$NCOUNT" -ge 1 ]] && PASS=$((PASS + 1)) && echo -e "    ${GREEN}PASS${NC} list count=$NCOUNT"

step 19 "Notifications: unread count"
RESP=$(call GET /api/notifications/unread-count "" "$TOKEN")
CODE=$(http_code "$RESP")
assert_eq "unread-count returns 200" "200" "$CODE"

step 20 "Notifications: mark read + mark all read"
[[ -n "$NOTIF_ID" ]] && RESP=$(call POST "/api/notifications/$NOTIF_ID/read" "" "$TOKEN") && CODE=$(http_code "$RESP") && assert_eq "mark read returns 200" "200" "$CODE"
RESP=$(call POST /api/notifications/read-all "" "$TOKEN")
CODE=$(http_code "$RESP")
assert_eq "read-all returns 200" "200" "$CODE"

# ─── Phase 6 — Scheduler ─────────────────────────────────
step 21 "Scheduler: status + list jobs"
RESP=$(call GET /api/scheduler/status "" "$TOKEN")
CODE=$(http_code "$RESP"); BODY=$(http_body "$RESP")
assert_eq "scheduler status returns 200" "200" "$CODE"
JOBS=$(echo "$BODY" | jq -r '.data.jobCount // 0')
[[ "$JOBS" -ge 1 ]] && PASS=$((PASS + 1)) && echo -e "    ${GREEN}PASS${NC} $JOBS jobs running"

step 22 "Scheduler: register + run + cleanup"
RESP=$(call POST /api/scheduler/jobs '{"name":"integration.test","cron":"*/15 * * * *","handler":"noop"}' "$TOKEN")
CODE=$(http_code "$RESP")
[[ "$CODE" == "200" ]] && PASS=$((PASS + 1)) && echo -e "    ${GREEN}PASS${NC} registered" || { FAIL=$((FAIL + 1)); FAILURES+=("register code=$CODE"); }

RESP=$(call POST /api/scheduler/jobs/integration.test/run "" "$TOKEN")
CODE=$(http_code "$RESP")
[[ "$CODE" == "200" ]] && PASS=$((PASS + 1)) && echo -e "    ${GREEN}PASS${NC} ran"

# Cleanup
call DELETE /api/scheduler/jobs/integration.test "" "$TOKEN" >/dev/null 2>&1

# ─── Phase 7 — Tenant guard ──────────────────────────────
step 23 "Tenant: admin header override"
RESP=$(curl -sS -w '\n%{http_code}' "$BASE_URL/api/auth/me" \
            -H "Authorization: Bearer $TOKEN" \
            -H "X-Tenant-Id: some-other-tenant")
CODE=$(http_code "$RESP")
assert_eq "tenant override does not break auth" "200" "$CODE"

# ─── Phase 8 — OpenAPI ───────────────────────────────────
step 24 "OpenAPI: spec retrieval"
RESP=$(curl -sS "$BASE_URL/api/openapi.json")
PATHS=$(echo "$RESP" | jq -r '.paths | length')
TAGS=$(echo "$RESP" | jq -r '.tags | length')
[[ "$PATHS" -ge 100 ]] && PASS=$((PASS + 1)) && echo -e "    ${GREEN}PASS${NC} OpenAPI $PATHS paths / $TAGS tags" || { FAIL=$((FAIL + 1)); FAILURES+=("OpenAPI paths=$PATHS"); }

step 25 "OpenAPI: Swagger UI"
RESP=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/api/docs/")
assert_eq "swagger UI HTTP 200" "200" "$RESP"

# ─── Summary ─────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════"
echo -e "  Tests passed:  ${GREEN}$PASS${NC}"
echo -e "  Tests failed:  ${RED}$FAIL${NC}"
echo -e "  Tests skipped: ${YELLOW}$SKIP${NC}"
echo "════════════════════════════════════════════════════════════════"

if [[ "$FAIL" -gt 0 ]]; then
  echo ""
  echo "Failures:"
  for f in "${FAILURES[@]}"; do echo "  - $f"; done
  exit 1
fi

echo -e "\n${GREEN}All integration tests passed!${NC}"
exit 0