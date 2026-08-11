#!/usr/bin/env bash
# =============================================================================
# GOVERN-11 wait-healthy.sh — 等待端到端 Ontology 闭环最小栈就绪
# -----------------------------------------------------------------------------
# 8 端口 + dw GET /api/v1/dw/employees 探测（mate-tech-dw 无 /healthz）
# 用法：./scripts/wait-healthy.sh
# 退出码：0=全部 PASS；非 0=有 FAIL
# =============================================================================
set -uo pipefail

PASS=0
FAIL=0
PROBE_TRIES=30
SLEEP_SECS=2

check() {
  local name="$1" url="$2" expect="${3:-200}"
  local code="" tries=0
  while (( tries < PROBE_TRIES )); do
    code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "$url" || echo "000")
    if [[ "$code" == "$expect" ]]; then
      printf "  PASS  %-32s  %s\n" "$name" "$url"
      PASS=$((PASS + 1))
      return 0
    fi
    tries=$((tries + 1))
    sleep "$SLEEP_SECS"
  done
  printf "  FAIL  %-32s  %s  (last code=%s)\n" "$name" "$url" "$code"
  FAIL=$((FAIL + 1))
  return 1
}

check_tcp() {
  local name="$1" host="$2" port="$3"
  local tries=0
  while (( tries < PROBE_TRIES )); do
    if (echo > "/dev/tcp/${host}/${port}") 2>/dev/null; then
      printf "  PASS  %-32s  %s:%s\n" "$name" "$host" "$port"
      PASS=$((PASS + 1))
      return 0
    fi
    tries=$((tries + 1))
    sleep "$SLEEP_SECS"
  done
  printf "  FAIL  %-32s  %s:%s (no TCP accept)\n" "$name" "$host" "$port"
  FAIL=$((FAIL + 1))
  return 1
}

# check_any: 任一预期 code 都算 PASS（用于 dw 这类需 auth header 的端点）
check_any() {
  local name="$1" url="$2"; shift 2
  local code="" tries=0
  while (( tries < PROBE_TRIES )); do
    code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "$url" || echo "000")
    for ok in "$@"; do
      if [[ "$code" == "$ok" ]]; then
        printf "  PASS  %-32s  %s (code=%s)\n" "$name" "$url" "$code"
        PASS=$((PASS + 1))
        return 0
      fi
    done
    tries=$((tries + 1))
    sleep "$SLEEP_SECS"
  done
  printf "  FAIL  %-32s  %s (last code=%s)\n" "$name" "$url" "$code"
  FAIL=$((FAIL + 1))
  return 1
}

echo "[GOVERN-11] waiting for healthz (max $((PROBE_TRIES * SLEEP_SECS))s) ..."

check_tcp postgres         localhost 5432 || true
check_tcp redis            localhost 6379 || true
check     neo4j-http       http://localhost:7474/ 200
check     mate-tech-ont    http://localhost:8007/healthz 200
check     mate-tech-agent  http://localhost:8002/healthz 200
check     mate-app-copilot http://localhost:8601/healthz 200
# mate-app-a2a 的 healthz 是 /api/v1/a2a/health（router 内部路径）
check     mate-app-a2a     http://localhost:8502/api/v1/a2a/health 200
check     mate-app-hub     http://localhost:8301/healthz 200
check     mate-api-gateway http://localhost:8100/healthz 200

# dw 无 /healthz；用业务端点。需带 Bearer + X-Tenant-Id，否则会被 tenant guard 401 拒。
# 仅验证进程是否监听 + 通到网关层即可：401 也算"通了"，由 401→200 区分。
check_any mate-tech-dw http://localhost:8021/api/v1/dw/employees 200 401 403

echo "[GOVERN-11] healthz summary: PASS=$PASS  FAIL=$FAIL"
[[ "$FAIL" -eq 0 ]]
