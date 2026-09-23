#!/usr/bin/env bash
# =============================================================================
# ONTOLOGY-CORE-E2E —— 本体核心闭环 E2E 的**唯一命令集**（CI 与本地同一套）
#
# 目标（ONTOLOGY-CORE-E2E）：
#   * 单一 Job 内完成：启动 → 健康 → 前端 → 测试 → always 清理（不跨 Job 假设
#     共享 localhost —— 那是此前 ontology-loop 长期红的根因之一）；
#   * 只启动**本体闭环必要**依赖（postgres/redis/neo4j/keycloak/auth-service/
#     ont/api-gateway），**不要求 Agent / LLM / A2A**；
#   * 真实登录（Keycloak + mate-auth-service）→ 真实网关 → 真实 ont + PG，**不 mock**。
#
# 用法（CI 与本地完全相同）：
#   scripts/ci/ontology-core-e2e.sh all      # up → wait → test → down（推荐）
#   scripts/ci/ontology-core-e2e.sh up       # 仅起栈 + 等待健康
#   scripts/ci/ontology-core-e2e.sh test     # 仅跑 E2E（假定栈已就绪）
#   scripts/ci/ontology-core-e2e.sh down     # 清理（always 语义）
#
# 本地已有一套栈在跑时：`E2E_REUSE=1 scripts/ci/ontology-core-e2e.sh test`
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/metaplatform-frontend"
cd "$REPO_ROOT"

# ── 本体闭环最小依赖（刻意不含 mate-tech-agent / llmgw / a2a / copilot / hub / dw）──
SERVICES=(
  postgres redis neo4j keycloak mate-auth-service mate-tech-ont mate-api-gateway
)
GATEWAY_URL="${E2E_GATEWAY_URL:-http://localhost:8100/api/v1}"
WEB_URL="${E2E_BASE_URL:-http://localhost:9200}"
REUSE="${E2E_REUSE:-0}"          # 1 = 不清栈、不建栈（用已有栈跑步测试）
HEALTH_TIMEOUT="${E2E_HEALTH_TIMEOUT:-420}"   # keycloak 起得慢（start_period 180s）
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-}"

log() { printf '\n[e2e] %s\n' "$*"; }
compose() {
  if [[ -n "$COMPOSE_PROJECT" ]]; then
    docker compose -p "$COMPOSE_PROJECT" "$@"
  else
    docker compose "$@"
  fi
}

# ---------------------------------------------------------------------------
# .env：CI 无本地 .env，从仓库内 realm 导入文件提取 client secret（与 realm 定义一致）
# ---------------------------------------------------------------------------
prepare_env() {
  if [[ -f .env ]]; then
    log ".env 已存在，保留"
    return 0
  fi
  log "生成最小 .env（CI 与干净 Runner 用）"
  local secret
  secret="$(python3 - <<'PY'
import json
realm = json.load(open('infra/keycloak/realm-mate.json', encoding='utf-8'))
print(next(c['secret'] for c in realm['clients'] if c['clientId'] == 'metaplatform-backend'))
PY
)"
  cat > .env <<EOF
KEYCLOAK_CLIENT_SECRET=$secret
SERVICE_CLIENT_SECRET=
OPENAI_API_KEY=placeholder
POSTGRES_USER=meta
POSTGRES_PASSWORD=meta
EOF
  # docker-compose.override.yml 引用本地敏感文件；CI 用空文件让内置默认生效
  : > .env.local
}

# ---------------------------------------------------------------------------
up() {
  prepare_env
  log "构建网关基础镜像（链式 FROM 依赖，先单独 build）"
  compose build mate-api-gateway
  log "启动本体闭环最小栈：${SERVICES[*]}"
  compose up -d --build "${SERVICES[@]}"
  compose ps
}

# ---------------------------------------------------------------------------
wait_healthy() {
  log "等待健康（最多 ${HEALTH_TIMEOUT}s）"
  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  while (( SECONDS < deadline )); do
    local ok=1
    # 网关 / 本体
    curl -fsS --max-time 5 "$GATEWAY_URL/healthz" >/dev/null 2>&1 || ok=0
    curl -fsS --max-time 5 "http://localhost:8007/healthz" >/dev/null 2>&1 || ok=0
    # 真实登录（Keycloak + auth-service 就绪才算）
    local code
    code="$(curl -s -o /tmp/oc-login.json -w '%{http_code}' --max-time 8 \
      -X POST "$GATEWAY_URL/iam/auth/login" \
      -H 'Content-Type: application/json' \
      -d '{"username":"admin","password":"admin123"}' || echo 000)"
    [[ "$code" == "200" ]] || ok=0
    if (( ok == 1 )); then
      log "健康 + 真实登录 OK"
      return 0
    fi
    sleep 6
  done
  log "健康等待超时；导出容器日志"
  compose ps -a || true
  compose logs --tail=120 || true
  return 1
}

# ---------------------------------------------------------------------------
test_e2e() {
  cd "$FRONTEND_DIR"
  if [[ ! -d node_modules ]]; then
    log "安装前端依赖"
    npm install -g pnpm@11.15.1 >/dev/null 2>&1 || true
    pnpm install --frozen-lockfile --ignore-scripts
    pnpm rebuild puppeteer esbuild || true
  fi
  log "运行本体核心闭环 E2E（real 认证 + 真实网关/本体，无 mock）"
  # PG 直连 helper（源表播种 / 对账）——与 compose 默认一致，CI 与本地同源
  E2E_GATEWAY_URL="$GATEWAY_URL" E2E_BASE_URL="$WEB_URL" \
    PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" \
    PGUSER="${PGUSER:-meta}" PGPASSWORD="${PGPASSWORD:-meta}" \
    PGDATABASE="${PGDATABASE:-metaplatform_ont}" \
    pnpm exec playwright test --project=ontology-loop-core --workers=1
}

# ---------------------------------------------------------------------------
down() {
  if [[ "$REUSE" == "1" ]]; then
    log "E2E_REUSE=1 → 跳过清理（保留已有栈）"
    return 0
  fi
  log "清理栈（always 语义）"
  compose down -v --remove-orphans || true
}

all() {
  trap 'down' EXIT
  up
  wait_healthy
  test_e2e
}

case "${1:-all}" in
  up) up ;;
  wait) wait_healthy ;;
  test) test_e2e ;;
  down) down ;;
  all) all ;;
  *) echo "usage: $0 {all|up|wait|test|down}" >&2; exit 2 ;;
esac
