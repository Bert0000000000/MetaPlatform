#!/usr/bin/env bash
# ============================================================================
# run-e2e.sh — One-click E2E test runner for MetaPlatform
# ============================================================================
# Runs all 9 E2E test scenarios sequentially and produces a summary report.
#
# Usage:
#   ./scripts/run-e2e.sh                  # Run all scenarios
#   ./scripts/run-e2e.sh s01 s03 s09     # Run specific scenarios
#   ./scripts/run-e2e.sh --list           # List available scenarios
#   ./scripts/run-e2e.sh --skip-start    # Skip service startup (already running)
#
# Environment:
#   - Reads .env from project root
#   - Requires: curl, jq, bash 4+
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
E2E_DIR="${PROJECT_ROOT}/e2e"
SHELL_DIR="${E2E_DIR}/shell"

# Load .env
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${PROJECT_ROOT}/.env"
  set +a
fi

# ---------------------------------------------------------------------------
# Options
# ---------------------------------------------------------------------------
SKIP_START=false
LIST_ONLY=false
SCENARIOS=()

for arg in "$@"; do
  case "${arg}" in
    --skip-start) SKIP_START=true ;;
    --list)       LIST_ONLY=true ;;
    s[0-9]*)      SCENARIOS+=("${arg}") ;;
    *)            echo "Unknown option: ${arg}"; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Discover scenarios
# ---------------------------------------------------------------------------
ALL_SCENARIOS=()
for f in "${SHELL_DIR}"/s[0-9]*.sh; do
  [[ -f "${f}" ]] && ALL_SCENARIOS+=("$(basename "${f}" .sh)")
done

if [[ "${LIST_ONLY}" == "true" ]]; then
  echo "Available E2E test scenarios:"
  for s in "${ALL_SCENARIOS[@]}"; do
    echo "  - ${s}"
  done
  echo ""
  echo "Total: ${#ALL_SCENARIOS[@]} scenarios"
  exit 0
fi

# Default: run all
if [[ ${#SCENARIOS[@]} -eq 0 ]]; then
  SCENARIOS=("${ALL_SCENARIOS[@]}")
fi

# ---------------------------------------------------------------------------
# Validate
# ---------------------------------------------------------------------------
if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl not found in PATH"
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq not found in PATH"
  exit 1
fi

# Ensure test scripts are executable
chmod +x "${SHELL_DIR}"/*.sh 2>/dev/null || true
chmod +x "${SCRIPT_DIR}"/*.sh 2>/dev/null || true

# ---------------------------------------------------------------------------
# Results directory
# ---------------------------------------------------------------------------
RESULTS_DIR="${E2E_DIR}/results"
mkdir -p "${RESULTS_DIR}"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
RESULTS_FILE="${RESULTS_DIR}/e2e-${TIMESTAMP}.log"

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
{
  echo "================================================"
  echo " MetaPlatform E2E Integration Test Run"
  echo " Date     : $(date '+%Y-%m-%d %H:%M:%S')"
  echo " Scenarios: ${#SCENARIOS[@]}"
  echo " Results  : ${RESULTS_FILE}"
  echo "================================================"
  echo ""
} | tee "${RESULTS_FILE}"

# ---------------------------------------------------------------------------
# Start services (optional)
# ---------------------------------------------------------------------------
if [[ "${SKIP_START}" != "true" ]]; then
  echo "[BOOT] Starting services..." | tee -a "${RESULTS_FILE}"
  "${SCRIPT_DIR}/start-all.sh" --no-wait 2>&1 | tee -a "${RESULTS_FILE}" || true
  echo "" | tee -a "${RESULTS_FILE}"

  echo "[BOOT] Waiting for services to be healthy..." | tee -a "${RESULTS_FILE}"
  "${SCRIPT_DIR}/wait-for-healthy.sh" 2>&1 | tee -a "${RESULTS_FILE}" || true
  echo "" | tee -a "${RESULTS_FILE}"
else
  echo "[SKIP] Service startup skipped (--skip-start)" | tee -a "${RESULTS_FILE}"
  echo "" | tee -a "${RESULTS_FILE}"
fi

# ---------------------------------------------------------------------------
# Run scenarios
# ---------------------------------------------------------------------------
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
FAILED_SCENARIOS=()

for scenario in "${SCENARIOS[@]}"; do
  script="${SHELL_DIR}/${scenario}.sh"

  if [[ ! -f "${script}" ]]; then
    echo "[SKIP] ${scenario} — script not found: ${script}" | tee -a "${RESULTS_FILE}"
    SKIP_COUNT=$(( SKIP_COUNT + 1 ))
    continue
  fi

  echo "" | tee -a "${RESULTS_FILE}"
  echo "================================================================" >> "${RESULTS_FILE}"
  echo "[RUN]  ${scenario}" | tee -a "${RESULTS_FILE}"
  echo "[FILE] ${script}" >> "${RESULTS_FILE}"
  echo "================================================================" >> "${RESULTS_FILE}"

  START_TIME=$(date +%s)

  # Run the scenario and capture exit code
  set +e
  bash "${script}" 2>&1 | tee -a "${RESULTS_FILE}"
  EXIT_CODE=$?
  set -e

  END_TIME=$(date +%s)
  DURATION=$(( END_TIME - START_TIME ))

  echo "" | tee -a "${RESULTS_FILE}"
  if [[ ${EXIT_CODE} -eq 0 ]]; then
    echo "[DONE] ${scenario} — PASS (${DURATION}s)" | tee -a "${RESULTS_FILE}"
    PASS_COUNT=$(( PASS_COUNT + 1 ))
  else
    echo "[DONE] ${scenario} — FAIL (${DURATION}s, exit code: ${EXIT_CODE})" | tee -a "${RESULTS_FILE}"
    FAIL_COUNT=$(( FAIL_COUNT + 1 ))
    FAILED_SCENARIOS+=("${scenario}")
  fi
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
TOTAL=$(( PASS_COUNT + FAIL_COUNT + SKIP_COUNT ))

{
  echo ""
  echo "================================================"
  echo " E2E TEST SUMMARY"
  echo "================================================"
  echo "  Total    : ${TOTAL}"
  echo "  Passed   : ${PASS_COUNT}"
  echo "  Failed   : ${FAIL_COUNT}"
  echo "  Skipped  : ${SKIP_COUNT}"
  echo ""

  if [[ ${FAIL_COUNT} -gt 0 ]]; then
    echo "  Failed scenarios:"
    for fs in "${FAILED_SCENARIOS[@]}"; do
      echo "    - ${fs}"
    done
  fi

  echo ""
  echo "  Results log: ${RESULTS_FILE}"
  echo "================================================"
} | tee -a "${RESULTS_FILE}"

# Exit with failure if any scenario failed
if [[ ${FAIL_COUNT} -gt 0 ]]; then
  exit 1
fi
exit 0
