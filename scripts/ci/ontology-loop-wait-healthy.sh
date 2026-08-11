#!/usr/bin/env bash
# =============================================================================
# GOVERN-11 Ontology-loop 栈健康等待脚本
# -----------------------------------------------------------------------------
# 等待 docker compose 启动的本体闭环栈全部健康：
#   postgres / redis / neo4j (TCP) +
#   mate-tech-ont (8501) / mate-tech-dw (8531) / mate-tech-agent (8521) /
#   mate-app-copilot (8511) / mate-app-a2a (8502) / mate-app-hub (8512) /
#   mate-api-gateway (8100) +
#   seed probe (dw /employees, ont /v2/object-types)
#
# 用法：./scripts/ci/ontology-loop-wait-healthy.sh [max_seconds=180]
# 退出码：0=全部 PASS；非 0=超时或存在 FAIL。
# =============================================================================
set -uo pipefail

MAX="${1:-180}"
DEADLINE=$((SECONDS + MAX))
PASS=0
FAIL=0

check_http() {
  local name="$1"
  local url="$2"
  local expect="${3:-200}"
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "$url" || echo "000")
  if [[ "$code" == "$expect" ]]; then
    echo "  PASS  $name  ($code)"
    PASS=$((PASS+1))
    return 0
  else
    echo "  FAIL  $name  expected=$expect got=$code"
    FAIL=$((FAIL+1))
    return 1
  fi
}

# TCP probe via /dev/tcp；curl 0/000 表端口未开
check_tcp() {
  local name="$1"
  local host="$2"
  local port="$3"
  if timeout 3 bash -c "exec 3<>/dev/tcp/$host/$port" 2>/dev/null; then
    echo "  PASS  $name  (tcp)"
    PASS=$((PASS+1))
    return 0
  else
    echo "  FAIL  $name  (tcp)"
    FAIL=$((FAIL+1))
    return 1
  fi
}

probe_token() {
  curl -sS -o /tmp/jwt.txt -w "%{http_code}" --max-time 5 \
    -X POST http://localhost:8100/api/v1/iam/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"admin123"}' || echo "000"
}

probe_ont() {
  local token="$1"
  curl -sS -o /tmp/ont.json -w "%{http_code}" --max-time 5 \
    -H "Authorization: Bearer $token" \
    'http://localhost:8100/api/v1/ont/v2/object-types?size=20' || echo "000"
}

probe_dw() {
  local token="$1"
  curl -sS -o /tmp/dw.json -w "%{http_code}" --max-time 5 \
    -H "Authorization: Bearer $token" \
    'http://localhost:8100/api/v1/dw/employees?size=20' || echo "000"
}

# 阶段 1：基础设施 TCP + 健康端点
echo "== Phase 1：基础设施（最多 ${MAX}s）=="
while (( SECONDS < DEADLINE )); do
  check_tcp postgres  localhost 5432  || true
  check_tcp redis     localhost 6379  || true
  check_tcp neo4j     localhost 7687  || true
  if (( PASS >= 3 )); then break; fi
  sleep 3
done
PASS=0; FAIL=0

echo "== Phase 2：服务 HTTP 健康 =="
while (( SECONDS < DEADLINE )); do
  check_http "mate-tech-ont  /healthz"     http://localhost:8501/healthz     200 || true
  check_http "mate-tech-dw   /healthz"     http://localhost:8531/healthz     200 || true
  check_http "mate-tech-agent /healthz"    http://localhost:8521/healthz     200 || true
  check_http "mate-app-copilot /healthz"   http://localhost:8511/healthz     200 || true
  check_http "mate-app-a2a   /healthz"     http://localhost:8502/healthz     200 || true
  check_http "mate-app-hub   /healthz"     http://localhost:8512/healthz     200 || true
  check_http "mate-api-gateway /healthz"   http://localhost:8100/api/v1/healthz 200 || true
  if (( FAIL == 0 )); then break; fi
  PASS=0; FAIL=0
  sleep 5
done
PASS=0; FAIL=0

echo "== Phase 3：种子数据 =="
TOKEN=""
TOKEN_CODE=$(probe_token)
if [[ "$TOKEN_CODE" == "200" ]]; then
  TOKEN=$(grep -oE '"accessToken":"[^"]+"' /tmp/jwt.txt | head -1 | sed 's/"accessToken":"//; s/"$//')
fi
if [[ -z "$TOKEN" ]]; then
  # dev 栈 keycloak 关闭，绕过 SSO — 走 ont/dw GET schema 容错
  echo "  WARN  login skipped (token=$TOKEN_CODE); falling back to schema-only probes"
  while (( SECONDS < DEADLINE )); do
    check_http "ont /openapi.json"     http://localhost:8501/openapi.json  200 || true
    check_http "dw  /openapi.json"     http://localhost:8531/openapi.json  200 || true
    if (( FAIL == 0 )); then break; fi
    PASS=0; FAIL=0
    sleep 3
  done
else
  while (( SECONDS < DEADLINE )); do
    ONT_CODE=$(probe_ont "$TOKEN")
    DW_CODE=$(probe_dw "$TOKEN")
    if [[ "$ONT_CODE" == "200" && "$DW_CODE" == "200" ]]; then
      echo "  PASS  ont /v2/object-types  ($ONT_CODE)"
      echo "  PASS  dw  /employees        ($DW_CODE)"
      PASS=$((PASS+2))
      break
    fi
    sleep 3
  done
fi

echo "-----"
echo "PASS=$PASS  FAIL=$FAIL"
[[ "$FAIL" -eq 0 && "$PASS" -ge 6 ]] && exit 0 || exit 1