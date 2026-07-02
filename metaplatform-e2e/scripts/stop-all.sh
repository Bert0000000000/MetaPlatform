#!/usr/bin/env bash
# ============================================================================
# stop-all.sh — Stop all MetaPlatform E2E services
# ============================================================================
# Tears down infrastructure containers and any running application services.
#
# Usage:
#   ./scripts/stop-all.sh          # stop all
#   ./scripts/stop-all.sh --clean  # stop all and remove volumes/networks
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PARENT_ROOT="$(cd "${PROJECT_ROOT}/.." && pwd)"

# Load .env
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${PROJECT_ROOT}/.env"
  set +a
fi

CLEAN=false
for arg in "$@"; do
  case "${arg}" in
    --clean) CLEAN=true ;;
    *)       echo "Unknown option: ${arg}"; exit 1 ;;
  esac
done

COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"
NET="mp-e2e-net"

echo "==============================================="
echo " MetaPlatform E2E — Stop All Services"
echo "==============================================="
echo ""

# --- Stop application services (per-module docker-compose) ---
echo "[Step 1/3] Stopping application services..."

APP_SERVICES=(
  "metaplatform-ontology-engine"
  "metaplatform-data-stack"
  "metaplatform-platform-base"
  "metaplatform-ai-substrate"
  "metaplatform-page-generator"
  "metaplatform-dialogue"
  "metaplatform-capability-library"
  "metaplatform-process-engine"
  "metaplatform-knowledge"
)

for svc_dir in "${APP_SERVICES[@]}"; do
  local_compose="${PARENT_ROOT}/${svc_dir}/docker-compose.yml"
  if [[ -f "${local_compose}" ]]; then
    echo "  Stopping ${svc_dir}..."
    (cd "$(dirname "${local_compose}")" && docker compose down) 2>/dev/null || true
  fi
done

# --- Stop infrastructure via docker-compose ---
echo ""
echo "[Step 2/3] Stopping infrastructure..."

if [[ -f "${COMPOSE_FILE}" ]]; then
  docker compose -f "${COMPOSE_FILE}" down
else
  # Fallback: stop individual containers
  for ctr in mp-e2e-pg mp-e2e-redis mp-e2e-kafka mp-e2e-neo4j; do
    if docker ps --format '{{.Names}}' | grep -q "^${ctr}$"; then
      echo "  Stopping ${ctr}..."
      docker stop "${ctr}" >/dev/null 2>&1 || true
      docker rm "${ctr}" >/dev/null 2>&1 || true
    fi
  done

  # Remove network
  if docker network inspect "${NET}" >/dev/null 2>&1; then
    docker network rm "${NET}" 2>/dev/null || true
  fi
fi

# --- Clean up volumes if requested ---
if [[ "${CLEAN}" == "true" ]]; then
  echo ""
  echo "[Step 3/3] Cleaning up volumes and dangling images..."
  docker volume prune -f 2>/dev/null || true
  docker image prune -f 2>/dev/null || true
else
  echo ""
  echo "[Step 3/3] Skipping volume cleanup (use --clean to remove)."
fi

echo ""
echo "==============================================="
echo " MetaPlatform E2E — All services stopped"
echo "==============================================="
