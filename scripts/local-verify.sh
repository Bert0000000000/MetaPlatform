#!/usr/bin/env bash
# =============================================================================
# local-verify.sh — verify compose config + reachability of running services.
#
# Usage:
#   ./scripts/local-verify.sh                  # check all services
#   ./scripts/local-verify.sh --service NAME   # check single service
#   ./scripts/local-verify.sh --skip-config    # skip `compose config --quiet`
#   ./scripts/local-verify.sh --llmgw          # also call MiniMax-M3 chat/real
#   ./scripts/local-verify.sh --quiet          # suppress non-essential output
#
# Steps:
#   1. docker compose config --quiet  (static config validation)
#   2. Curl /healthz for every service that exposes 80xx / 81xx / 8180
#   3. Print running containers + health summary
#   4. (optional) call mate-tech-llmgw /api/v1/llmgw/chat/real with MiniMax-M3
#
# Exit codes:
#   0  all checks passed
#   1  one or more services unhealthy
#   2  compose config validation failed
#   3  docker daemon unreachable
# =============================================================================
set -uo pipefail

cd "$(dirname "$0")/.."

# Auto-add docker CLI to PATH on Windows
if ! command -v docker >/dev/null 2>&1; then
    for guess in \
        "/c/Users/$USER/AppData/Local/Programs/DockerDesktop/resources/bin" \
        "/c/Program Files/Docker/Docker/resources/bin"; do
        if [ -d "$guess" ]; then
            export PATH="$guess:$PATH"
            break
        fi
    done
fi

SKIP_CONFIG=0
ONLY_SERVICE=""
LLMGW_PROBE=0
QUIET=0

for arg in "$@"; do
    case "$arg" in
        --skip-config) SKIP_CONFIG=1 ;;
        --service)     shift; ONLY_SERVICE="${1:-}" ;;
        --llmgw)       LLMGW_PROBE=1 ;;
        --quiet)       QUIET=1 ;;
        --help|-h)
            sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) echo "Unknown flag: $arg"; exit 1 ;;
    esac
done

# Check daemon reachable
if ! docker info >/dev/null 2>&1; then
    echo "ERROR: docker daemon unreachable. Is Docker Desktop running?" >&2
    exit 3
fi

# ---- 1. Static config validation ----
if [ "$SKIP_CONFIG" -eq 0 ]; then
    [ "$QUIET" -eq 0 ] && echo "==> Validating compose config"
    if ! docker compose config --quiet 2>/dev/null; then
        echo "FAIL: compose config has errors" >&2
        exit 2
    fi
    [ "$QUIET" -eq 0 ] && echo "OK: compose config"
fi

# ---- 2. Health checks ----
echo ""
echo "==> Checking running services"
declare -A HEALTH_CHECKS=(
    ["mate-postgres"]="nc -z localhost 5432"
    ["mate-redis"]="redis-cli -h localhost ping"
    ["mate-minio"]="curl -fsS http://localhost:9000/minio/health/live"
    ["mate-milvus"]="curl -fsS http://localhost:9091/healthz"
    ["mate-neo4j"]="curl -fsS http://localhost:7474"
    ["mate-kafka"]="nc -z localhost 9092"
    ["mate-rabbitmq"]="curl -fsS http://localhost:15672"
    ["mate-nacos"]="curl -fsS http://localhost:8848/nacos/v1/console/health/readiness"
    ["mate-tech-iam"]="curl -fsS http://localhost:8102/healthz"
    ["mate-tech-llmgw"]="curl -fsS http://localhost:8008/healthz"
    ["mate-tech-rag"]="curl -fsS http://localhost:8001/healthz"
    ["mate-tech-agent"]="curl -fsS http://localhost:8002/healthz"
    ["mate-tech-ont"]="curl -fsS http://localhost:8007/healthz"
    ["mate-tech-msg"]="curl -fsS http://localhost:8082/healthz"
    ["mate-tech-mcp"]="curl -fsS http://localhost:8081/healthz"
    ["mate-tech-obs"]="curl -fsS http://localhost:8083/healthz"
    ["mate-app-kb"]="curl -fsS http://localhost:8003/healthz"
    ["mate-api-gateway"]="curl -fsS http://localhost:8100/healthz"
    ["mate-auth-service"]="curl -fsS http://localhost:8101/healthz"
    ["keycloak"]="curl -fsS http://localhost:8180"
    ["loki"]="curl -fsS http://localhost:3100/ready"
    ["prometheus"]="curl -fsS http://localhost:9090/-/ready"
    ["grafana"]="curl -fsS http://localhost:3000/api/health"
    ["otel-collector"]="curl -fsS http://localhost:4318/v1/traces"
)

UNHEALTHY=0
for service in "${!HEALTH_CHECKS[@]}"; do
    if [ -n "$ONLY_SERVICE" ] && [ "$service" != "$ONLY_SERVICE" ]; then continue; fi
    cmd="${HEALTH_CHECKS[$service]}"
    printf "  %-25s ... " "$service"
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${service}$"; then
        if bash -c "$cmd" >/dev/null 2>&1; then
            echo "OK (healthy)"
        else
            echo "WARN (running, unhealthy)"
            UNHEALTHY=$((UNHEALTHY+1))
        fi
    else
        echo "SKIP (not running)"
    fi
done

# ---- 3. Container summary ----
echo ""
echo "==> All containers:"
docker compose ps --format 'table {{.Service}}\t{{.State}}\t{{.Status}}' || true

# ---- 4. Optional: LLMGW MiniMax-M3 probe ----
if [ "$LLMGW_PROBE" -eq 1 ]; then
    echo ""
    echo "==> Probing mate-tech-llmgw /api/v1/llmgw/chat/real (MiniMax-M3)"
    if docker exec mate-tech-llmgw python -c "
import httpx, json, os, sys
try:
    resp = httpx.post(
        'http://localhost:8008/api/v1/llmgw/chat/real',
        json={'provider': 'anthropic', 'model': 'MiniMax-M3',
              'messages': [{'role': 'user', 'content': '用 10 个字自我介绍'}],
              'max_tokens': 50},
        timeout=60,
    )
    print('STATUS:', resp.status_code)
    body = resp.json()
    print('CONTENT:', body.get('content', body.get('detail', ''))[:120])
    print('FALLBACK:', body.get('fallback', False))
    sys.exit(0 if resp.status_code == 200 and not body.get('fallback') else 1)
except Exception as e:
    print('ERR:', e)
    sys.exit(1)
" 2>&1; then
        echo "LLMGW MiniMax-M3 probe: PASS"
    else
        echo "LLMGW MiniMax-M3 probe: FAIL"
        UNHEALTHY=$((UNHEALTHY+1))
    fi
fi

if [ $UNHEALTHY -gt 0 ]; then
    echo ""
    echo "WARNING: $UNHEALTHY service(s) unhealthy"
    exit 1
fi
echo ""
echo "OK: all checks passed"
exit 0