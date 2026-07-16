#!/usr/bin/env bash
# ============================================================================
# _common.sh — Bash test helper library for MetaPlatform E2E tests
# ============================================================================
# Sourced by every e2e/shell/s*.sh test script. Provides:
#   - Color-coded step/fail/pass logging
#   - HTTP request helpers (GET, POST, PUT, DELETE)
#   - JSON assertion helpers
#   - Test lifecycle management (begin/end/assert)
#   - Environment variable loading from .env
# ============================================================================

# Prevent double-sourcing
[[ -n "${_COMMON_SH_LOADED:-}" ]] && return 0
_COMMON_SH_LOADED=1

set -euo pipefail

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E2E_ROOT="$(cd "${COMMON_DIR}/.." && pwd)"
PROJECT_ROOT="$(cd "${E2E_ROOT}/.." && pwd)"

# ---------------------------------------------------------------------------
# Load .env
# ---------------------------------------------------------------------------
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${PROJECT_ROOT}/.env"
  set +a
fi

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
HOST="${POSTGRES_HOST:-localhost}"
TENANT_ID="${E2E_TENANT_ID:-00000000-0000-0000-0000-000000000001}"

ONTOLOGY_ENGINE_PORT="${ONTOLOGY_ENGINE_PORT:-8080}"
DATA_STACK_PORT="${DATA_STACK_PORT:-8081}"
PLATFORM_BASE_PORT="${PLATFORM_BASE_PORT:-8082}"
AI_SUBSTRATE_PORT="${AI_SUBSTRATE_PORT:-8083}"
PAGE_GENERATOR_PORT="${PAGE_GENERATOR_PORT:-8084}"
DIALOGUE_PORT="${DIALOGUE_PORT:-8085}"
CAPABILITY_LIBRARY_PORT="${CAPABILITY_LIBRARY_PORT:-8086}"
PROCESS_ENGINE_PORT="${PROCESS_ENGINE_PORT:-8087}"
RAG_MDM_PORT="${RAG_MDM_PORT:-8090}"

# Base URLs
URL_ONTOLOGY="http://${HOST}:${ONTOLOGY_ENGINE_PORT}"
URL_DATA_STACK="http://${HOST}:${DATA_STACK_PORT}"
URL_PLATFORM_BASE="http://${HOST}:${PLATFORM_BASE_PORT}"
URL_AI_SUBSTRATE="http://${HOST}:${AI_SUBSTRATE_PORT}"
URL_PAGE_GEN="http://${HOST}:${PAGE_GENERATOR_PORT}"
URL_DIALOGUE="http://${HOST}:${DIALOGUE_PORT}"
URL_CAPABILITY="http://${HOST}:${CAPABILITY_LIBRARY_PORT}"
URL_PROCESS="http://${HOST}:${PROCESS_ENGINE_PORT}"
URL_RAG="http://${HOST}:${RAG_MDM_PORT}"

# Fixture directory
FIXTURES="${E2E_ROOT}/fixtures"

# ---------------------------------------------------------------------------
# Counters
# ---------------------------------------------------------------------------
_TEST_TOTAL=0
_TEST_PASSED=0
_TEST_FAILED=0
_STEP_NUM=0

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
_RED='\033[0;31m'
_GREEN='\033[0;32m'
_YELLOW='\033[1;33m'
_BLUE='\033[0;34m'
_CYAN='\033[0;36m'
_BOLD='\033[1m'
_RESET='\033[0m'

log_info()  { echo -e "${_CYAN}[INFO]${_RESET}  $*"; }
log_step()  { _STEP_NUM=$(( _STEP_NUM + 1 )); echo -e "${_BLUE}[STEP ${_STEP_NUM}]${_RESET} ${_BOLD}$*${_RESET}"; }
log_pass()  { echo -e "${_GREEN}[PASS]${_RESET}  $*"; }
log_fail()  { echo -e "${_RED}[FAIL]${_RESET}  $*"; }
log_warn()  { echo -e "${_YELLOW}[WARN]${_RESET}  $*"; }
log_debug() { if [[ "${DEBUG:-0}" == "1" ]]; then echo -e "[DEBUG] $*"; fi; }

# Print a section separator
log_section() {
  echo ""
  echo -e "${_BOLD}----------------------------------------------------------------${_RESET}"
  echo -e "${_BOLD}  $*${_RESET}"
  echo -e "${_BOLD}----------------------------------------------------------------${_RESET}"
  echo ""
}

# ---------------------------------------------------------------------------
# Test lifecycle
# ---------------------------------------------------------------------------
test_begin() {
  local name="$1"
  _STEP_NUM=0
  log_section "TEST: ${name}"
  log_info "Started at $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
}

test_end() {
  local name="$1"
  local result="${2:-PASS}"
  echo ""
  if [[ "${result}" == "PASS" ]]; then
    _TEST_PASSED=$(( _TEST_PASSED + 1 ))
    log_pass "TEST PASSED: ${name}"
  else
    _TEST_FAILED=$(( _TEST_FAILED + 1 ))
    log_fail "TEST FAILED: ${name}"
  fi
  _TEST_TOTAL=$(( _TEST_TOTAL + 1 ))
}

# Called at the very end of the entire test run
print_summary() {
  echo ""
  echo -e "${_BOLD}================================================${_RESET}"
  echo -e "${_BOLD}  TEST SUMMARY${_RESET}"
  echo -e "${_BOLD}================================================${_RESET}"
  echo "  Total : ${_TEST_TOTAL}"
  echo -e "  Passed: ${_GREEN}${_TEST_PASSED}${_RESET}"
  echo -e "  Failed: ${_RED}${_TEST_FAILED}${_RESET}"
  echo -e "${_BOLD}================================================${_RESET}"

  if (( _TEST_FAILED > 0 )); then
    return 1
  fi
  return 0
}

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------
# Generic curl wrapper. Returns HTTP body on stdout.
# Sets global variable HTTP_CODE to the response status code.
# Usage: response=$(http_get "http://host:port/path")
HTTP_CODE=""
HTTP_BODY=""

_curl() {
  local method="$1"; shift
  local url="$1"; shift
  local extra_args=("$@")

  local tmpfile
  tmpfile=$(mktemp)

  local code
  code=$(curl -s -o "${tmpfile}" -w "%{http_code}" \
    --connect-timeout 5 --max-time 30 \
    -X "${method}" "${extra_args[@]}" "${url}" 2>/dev/null || echo "000")

  HTTP_CODE="${code}"
  HTTP_BODY=$(cat "${tmpfile}")
  rm -f "${tmpfile}"

  log_debug "HTTP ${method} ${url} -> ${code}"
  if [[ -n "${HTTP_BODY}" ]] && [[ "${#HTTP_BODY}" -lt 2000 ]]; then
    log_debug "Body: ${HTTP_BODY}"
  fi

  echo "${HTTP_BODY}"
}

http_get() {
  local url="$1"
  _curl GET "${url}"
}

http_post() {
  local url="$1"
  local data="$2"
  _curl POST "${url}" -H "Content-Type: application/json" -d "${data}"
}

http_put() {
  local url="$1"
  local data="$2"
  _curl PUT "${url}" -H "Content-Type: application/json" -d "${data}"
}

http_patch() {
  local url="$1"
  local data="$2"
  _curl PATCH "${url}" -H "Content-Type: application/json" -d "${data}"
}

http_delete() {
  local url="$1"
  _curl DELETE "${url}"
}

# POST with custom headers (e.g., tenant context)
http_post_with_headers() {
  local url="$1"
  local data="$2"
  shift 2
  local headers=("$@")
  local header_args=()
  for h in "${headers[@]}"; do
    header_args+=(-H "${h}")
  done
  _curl POST "${url}" -H "Content-Type: application/json" "${header_args[@]}" -d "${data}"
}

# POST multipart (for file upload)
http_post_file() {
  local url="$1"
  local file_path="$2"
  local field_name="${3:-file}"
  _curl POST "${url}" -F "${field_name}=@${file_path}"
}

# ---------------------------------------------------------------------------
# JSON helpers (use jq)
# ---------------------------------------------------------------------------
# Extract a field from a JSON string
# Usage: value=$(json_get '.id' "$response")
json_get() {
  local path="$1"
  local input="$2"
  echo "${input}" | jq -r "${path}" 2>/dev/null
}

# Check that a JSON field equals expected value
# Usage: assert_json_eq '.status' "active" "$response"
assert_json_eq() {
  local path="$1"
  local expected="$2"
  local input="$3"
  local actual
  actual=$(echo "${input}" | jq -r "${path}" 2>/dev/null)

  if [[ "${actual}" == "${expected}" ]]; then
    log_pass "assert ${path} == '${expected}' (got '${actual}')"
    return 0
  else
    log_fail "assert ${path} == '${expected}' (got '${actual}')"
    return 1
  fi
}

# Check that a JSON field is not null
assert_json_not_null() {
  local path="$1"
  local input="$2"
  local actual
  actual=$(echo "${input}" | jq -r "${path}" 2>/dev/null)

  if [[ -n "${actual}" ]] && [[ "${actual}" != "null" ]]; then
    log_pass "assert ${path} is not null (got '${actual}')"
    return 0
  else
    log_fail "assert ${path} is not null (got '${actual}')"
    return 1
  fi
}

# Check that a JSON field contains a substring
assert_json_contains() {
  local path="$1"
  local substring="$2"
  local input="$3"
  local actual
  actual=$(echo "${input}" | jq -r "${path}" 2>/dev/null)

  if [[ "${actual}" == *"${substring}"* ]]; then
    log_pass "assert ${path} contains '${substring}'"
    return 0
  else
    log_fail "assert ${path} contains '${substring}' (got '${actual}')"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# Assertion helpers
# ---------------------------------------------------------------------------
# Assert HTTP status code equals expected
assert_status() {
  local expected="$1"
  local actual="${HTTP_CODE}"

  if [[ "${actual}" == "${expected}" ]]; then
    log_pass "HTTP status == ${expected}"
    return 0
  else
    log_fail "HTTP status == ${expected} (got ${actual})"
    return 1
  fi
}

# Assert that a string is non-empty
assert_non_empty() {
  local label="$1"
  local value="$2"

  if [[ -n "${value}" ]]; then
    log_pass "${label} is non-empty"
    return 0
  else
    log_fail "${label} is empty"
    return 1
  fi
}

# Assert that a string contains substring
assert_contains() {
  local label="$1"
  local substring="$2"
  local value="$3"

  if [[ "${value}" == *"${substring}"* ]]; then
    log_pass "${label} contains '${substring}'"
    return 0
  else
    log_fail "${label} does not contain '${substring}'"
    return 1
  fi
}

# Assert numeric greater-than
assert_gt() {
  local label="$1"
  local expected_min="$2"
  local actual="$3"

  if (( actual > expected_min )); then
    log_pass "${label} > ${expected_min} (got ${actual})"
    return 0
  else
    log_fail "${label} > ${expected_min} (got ${actual})"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------
# Generate a UUID (cross-platform)
gen_uuid() {
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr '[:upper:]' '[:lower:]'
  elif [[ -f /proc/sys/kernel/random/uuid ]]; then
    cat /proc/sys/kernel/random/uuid
  else
    # Fallback: use Python
    python3 -c "import uuid; print(uuid.uuid4())" 2>/dev/null || \
    python -c "import uuid; print(uuid.uuid4())" 2>/dev/null || \
    echo "$(date +%s)-${RANDOM}-${RANDOM}-$(hostname)"
  fi
}

# Generate a timestamp
now_ts() {
  date '+%Y-%m-%dT%H:%M:%S'
}

# Sleep with progress
wait_seconds() {
  local secs="$1"
  local label="${2:-waiting}"
  echo -n "  ${label} "
  for (( i=0; i<secs; i++ )); do
    echo -n "."
    sleep 1
  done
  echo " done"
}

# Check if a command exists
require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    log_fail "Required command '${cmd}' not found in PATH"
    exit 1
  fi
}

# Pre-flight checks
preflight_checks() {
  log_info "Running pre-flight checks..."
  require_cmd curl
  require_cmd jq
  log_info "Pre-flight checks passed."
  echo ""
}
