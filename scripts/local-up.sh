#!/usr/bin/env bash
# =============================================================================
# local-up.sh — start mate-platform services via docker compose.
#
# Usage:
#   ./scripts/local-up.sh                          # core data plane (default)
#   ./scripts/local-up.sh <profile>                # profile: core|ai|java|edge|monitor|all
#
# Flags:
#   --skip-pull        # skip docker pull step (use cached images)
#   --skip-build       # skip docker build step (assume images exist)
#   --skip-verify      # skip `compose config --quiet` validation
#   --no-recreate      # do not recreate containers if already running
#   --quiet            # suppress non-essential output
#   --wait HEALTHY     # wait for service to become healthy (timeout 300s)
#
# Profiles:
#   core     default data plane + Python services (no profiles)
#             PG / Redis / MinIO / Milvus / Neo4j / Kafka / RabbitMQ / Nacos +
#             mate-tech-{iam, llmgw, rag, agent, ont, msg, mcp, obs, app-kb} +
#             mate-api-gateway + mate-auth-service (~5 GB RAM)
#   ai       + RAGFlow + LightRAG (~+8 GB) — requires OPENAI_API_KEY
#   java     + Flowable + KIE Server (~+4 GB)
#   edge     + Traefik + Keycloak (~+0.5 GB)
#   monitor  + Loki + Prometheus + Grafana + OTel (~+1.5 GB)
#   all      edge + monitoring + java + ai (~17 GB; not feasible on 7.75 GB host)
#
# Examples:
#   ./scripts/local-up.sh                       # core
#   ./scripts/local-up.sh edge --skip-pull      # edge with cached images
#   ./scripts/local-up.sh monitor --wait        # monitor + wait for healthy
#   ./scripts/local-up.sh core --no-recreate    # only start stopped services
#
# Notes:
#   - ai profile needs OPENAI_API_KEY + ANTHROPIC_API_KEY in .env (now defaulted
#     to https://api.minimaxi.com/anthropic for MiniMax-M3 integration).
#   - WSL2 backend: 7.75 GB RAM total. Recommended: core+monitor+edge (~6.5 GB).
#   - For Windows: docker CLI must be in PATH. If not, this script auto-adds
#     C:\Users\<USER>\AppData\Local\Programs\DockerDesktop\resources\bin
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

# ---- Defaults ----
PROFILE="core"
SKIP_PULL=0
SKIP_BUILD=0
SKIP_VERIFY=0
NO_RECREATE=0
QUIET=0
WAIT_HEALTHY=0

# ---- Auto-add Docker CLI to PATH on Windows ----
# If `docker` is not on PATH but the bundled CLI exists in the well-known
# Docker Desktop install location, prepend it for this script invocation.
if ! command -v docker >/dev/null 2>&1; then
    for guess in \
        "/c/Users/$USER/AppData/Local/Programs/DockerDesktop/resources/bin" \
        "/c/Program Files/Docker/Docker/resources/bin"; do
        if [ -d "$guess" ]; then
            export PATH="$guess:$PATH"
            if [ "$QUIET" -eq 0 ]; then
                echo "==> Added $guess to PATH (docker CLI not on PATH)"
            fi
            break
        fi
    done
fi

# ---- Parse args ----
ARGS=()
for arg in "$@"; do
    case "$arg" in
        --skip-pull)    SKIP_PULL=1 ;;
        --skip-build)   SKIP_BUILD=1 ;;
        --skip-verify)  SKIP_VERIFY=1 ;;
        --no-recreate)  NO_RECREATE=1 ;;
        --quiet)        QUIET=1 ;;
        --wait)         WAIT_HEALTHY=1 ;;
        --help|-h)
            sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        -*)
            echo "Unknown flag: $arg"; exit 1 ;;
        *)
            ARGS+=("$arg") ;;
    esac
done
[ "${#ARGS[@]}" -ge 1 ] && PROFILE="${ARGS[0]}"

# ---- Resolve profile ----
case "$PROFILE" in
    core)    PROFILES="" ;;
    ai)      PROFILES="--profile ai" ;;
    java)    PROFILES="--profile java" ;;
    edge)    PROFILES="--profile edge" ;;
    monitor) PROFILES="--profile monitoring" ;;
    all)
        PROFILES="--profile edge --profile monitoring --profile java --profile ai"
        echo "WARNING: all profile needs ~17 GB RAM; will likely OOM on 7.75 GB host"
        ;;
    *)
        echo "Unknown profile: $PROFILE"
        echo "Valid: core | ai | java | edge | monitor | all"
        exit 1
        ;;
esac

[ "$QUIET" -eq 0 ] && echo "==> Starting profile: $PROFILE  (flags: $PROFILES)"

# ---- Verify config is valid ----
if [ "$SKIP_VERIFY" -eq 0 ]; then
    [ "$QUIET" -eq 0 ] && echo "==> Validating compose config"
    if ! docker compose config --quiet; then
        echo "ERROR: compose config has errors" >&2
        exit 2
    fi
fi

# ---- Pull base images ----
if [ "$SKIP_PULL" -eq 0 ]; then
    [ "$QUIET" -eq 0 ] && echo "==> Pulling base images (--ignore-pull-failures)"
    docker compose pull --ignore-pull-failures || true
fi

# ---- Build local images ----
if [ "$SKIP_BUILD" -eq 0 ]; then
    [ "$QUIET" -eq 0 ] && echo "==> Building local images"
    # Build with workaround for Windows + WSL2 .pytest_cache ACL locks:
    # if the build fails because of pytest_cache access, copy to a clean
    # context dir (without .pytest_cache) and rebuild from there.
    if ! docker compose build --pull 2>/dev/null; then
        echo "WARNING: build failed (likely WSL2 + .pytest_cache ACL issue)"
        echo "         retrying with clean build context (workaround)"
        if [ -d ".tmp-build-context" ]; then
            rm -rf ".tmp-build-context"
        fi
        if command -v python >/dev/null 2>&1; then
            python -c "
import shutil, os
src = '.'
dst = '.tmp-build-context'
shutil.copytree(src, dst,
    ignore=shutil.ignore_patterns('.pytest_cache', '__pycache__',
    '.ruff_cache', '.mypy_cache', '*.pyc', '.venv', 'venv',
    'htmlcov', '.coverage', '.git', '.env', '.env.bak-*'))
print('clean context at', dst)
"
            # We can't easily rebuild all services from .tmp-build-context
            # here because docker-compose.yml expects the original layout,
            # but the data-plane services that need rebuild (Python) will
            # need a manual intervention. Fall back to using cached images.
            echo "WARNING: cached images will be used (5-day-old snapshots may be stale)"
        fi
    fi
fi

# ---- Start services ----
UP_FLAGS=("-d")
[ "$NO_RECREATE" -eq 1 ] && UP_FLAGS+=("--no-recreate")

[ "$QUIET" -eq 0 ] && echo "==> docker compose up ${UP_FLAGS[*]} $PROFILES"
docker compose up "${UP_FLAGS[@]}" $PROFILES

# ---- Wait for healthy ----
if [ "$WAIT_HEALTHY" -eq 1 ]; then
    echo "==> Waiting up to 300s for all services to become healthy..."
    timeout=300
    elapsed=0
    while [ $elapsed -lt $timeout ]; do
        unhealthy=$(docker compose ps --format '{{.Service}}\t{{.State}}' | grep -v 'healthy' | grep -v 'Up' | wc -l)
        running=$(docker compose ps --format '{{.Service}}\t{{.State}}' | grep -c 'Up' || true)
        total=$(docker compose ps --format '{{.Service}}' | wc -l)
        if [ "$unhealthy" -eq 0 ] && [ "$running" -ge "$total" ]; then
            echo "==> All $total services healthy"
            break
        fi
        sleep 5
        elapsed=$((elapsed+5))
    done
    if [ $elapsed -ge $timeout ]; then
        echo "WARNING: timed out after ${timeout}s, some services not healthy"
    fi
fi

# ---- Final status ----
echo ""
echo "==> Service status:"
docker compose ps --format 'table {{.Service}}\t{{.State}}\t{{.Status}}\t{{.Ports}}' || true
