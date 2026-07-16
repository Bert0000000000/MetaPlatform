#!/usr/bin/env bash
# ============================================================================
# wait-for-healthy.sh — Wait for all MetaPlatform services to become healthy
# ============================================================================
# Polls HTTP health endpoints (or TCP ports) for each configured service
# until they respond successfully or the timeout is reached.
#
# Usage:
#   ./scripts/wait-for-healthy.sh                  # wait for all services
#   ./scripts/wait-for-healthy.sh ontology-engine   # wait for specific service
#
# Prerequisites:
#   - .env file in the project root (or environment variables set)
#   - curl available in PATH
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load .env
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${PROJECT_ROOT}/.env"
  set +a
fi

HOST="${POSTGRES_HOST:-localhost}"
TIMEOUT="${HEALTH_TIMEOUT:-120}"
INTERVAL="${HEALTH_INTERVAL:-3}"

# --- Service definitions: name -> port ---
declare -A SERVICES=(
  [ontology-engine]="${ONTOLOGY_ENGINE_PORT:-8080}"
  [data-stack]="${DATA_STACK_PORT:-8081}"
  [platform-base]="${PLATFORM_BASE_PORT:-8082}"
  [ai-substrate]="${AI_SUBSTRATE_PORT:-8083}"
  [page-generator]="${PAGE_GENERATOR_PORT:-8084}"
  [dialogue]="${DIALOGUE_PORT:-8085}"
  [capability-library]="${CAPABILITY_LIBRARY_PORT:-8086}"
  [process-engine]="${PROCESS_ENGINE_PORT:-8087}"
  [rag-mdm]="${RAG_MDM_PORT:-8090}"
)

# Health endpoint paths per service (Spring Boot actuator or custom)
declare -A HEALTH_PATHS=(
  [ontology-engine]="/actuator/health"
  [data-stack]="/health"
  [platform-base]="/actuator/health"
  [ai-substrate]="/actuator/health"
  [page-generator]="/actuator/health"
  [dialogue]="/actuator/health"
  [capability-library]="/actuator/health"
  [process-engine]="/actuator/health"
  [rag-mdm]="/actuator/health"
)

# ---------------------------------------------------------------------------
# Functions
# ---------------------------------------------------------------------------
check_http() {
  local name="$1"
  local port="$2"
  local path="${HEALTH_PATHS[$name]:-/actuator/health}"
  local url="http://${HOST}:${port}${path}"

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 5 "${url}" 2>/dev/null || echo "000")

  if [[ "${http_code}" == "200" ]]; then
    return 0
  fi
  return 1
}

check_tcp() {
  local port="$1"
  # Fallback: just check if the TCP port is open
  (echo >/dev/tcp/"${HOST}"/"${port}") 2>/dev/null
}

wait_for_service() {
  local name="$1"
  local port="${SERVICES[$name]}"

  echo -n "  Waiting for ${name} (port ${port}) ..."

  local elapsed=0
  while (( elapsed < TIMEOUT )); do
    if check_http "${name}" "${port}"; then
      echo " OK (${elapsed}s)"
      return 0
    fi

    # Fallback: check TCP port
    if check_tcp "${port}"; then
      echo " OK-TCP (${elapsed}s)"
      return 0
    fi

    echo -n "."
    sleep "${INTERVAL}"
    elapsed=$(( elapsed + INTERVAL ))
  done

  echo " TIMEOUT after ${TIMEOUT}s"
  return 1
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo "============================================="
echo " MetaPlatform — Health Check"
echo " Timeout : ${TIMEOUT}s"
echo " Interval: ${INTERVAL}s"
echo "============================================="
echo ""

# If a specific service was requested
if [[ $# -gt 0 ]]; then
  target="$1"
  if [[ -z "${SERVICES[$target]+x}" ]]; then
    echo "ERROR: Unknown service '${target}'"
    echo "Available services: ${!SERVICES[*]}"
    exit 1
  fi
  wait_for_service "${target}"
  exit $?
fi

# Wait for all services
FAIL=0
for name in $(echo "${!SERVICES[@]}" | tr ' ' '\n' | sort); do
  if ! wait_for_service "${name}"; then
    FAIL=$(( FAIL + 1 ))
  fi
done

echo ""
echo "============================================="
if (( FAIL > 0 )); then
  echo " RESULT: ${FAIL} service(s) failed health check"
  echo "============================================="
  exit 1
else
  echo " RESULT: All services healthy"
  echo "============================================="
  exit 0
fi
