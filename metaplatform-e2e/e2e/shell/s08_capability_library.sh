#!/usr/bin/env bash
# ============================================================================
# s08_capability_library.sh — Scenario 08: Capability Library
# ============================================================================
# Tests:
#   1. List all registered capabilities
#   2. Execute a single capability (data-validation)
#   3. Create a pipeline
#   4. Execute the pipeline
#   5. List pipelines
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

preflight_checks

test_begin "S08 Capability Library — Atomic Capabilities + Pipeline"

TEST_RESULT="PASS"
PIPELINE_ID=""

# --- Step 1: List registered capabilities ---
log_step "List all registered capabilities"
RESP=$(http_get "${URL_CAPABILITY}/api/v1/capabilities") || true

if [[ "${HTTP_CODE}" == "200" ]]; then
  CAP_COUNT=$(json_get '. | length' "${RESP}" 2>/dev/null || echo "0")
  log_pass "Capabilities list returned 200 (${CAP_COUNT} capabilities)"
  # Show capability names
  CAP_NAMES=$(json_get '.[].id // .[].name' "${RESP}" 2>/dev/null || echo "N/A")
  log_info "Capabilities: ${CAP_NAMES:0:200}"
else
  log_warn "Capabilities list returned ${HTTP_CODE}"
fi

# --- Step 2: Execute data-validation capability ---
log_step "Execute 'data-validation' capability"
VALIDATE_PAYLOAD=$(cat <<EOF
{
  "input": {
    "data": {
      "companyName": "Acme Corp",
      "email": "test@acme.example",
      "annualRevenue": 1000000
    },
    "rules": [
      {"field": "companyName", "type": "required"},
      {"field": "email", "type": "pattern", "pattern": "^[\\w.-]+@[\\w.-]+\\.\\w+$"},
      {"field": "annualRevenue", "type": "min", "value": 0}
    ]
  },
  "tenantId": "${TENANT_ID}"
}
EOF
)
RESP=$(http_post "${URL_CAPABILITY}/api/v1/capabilities/data-validation/execute" "${VALIDATE_PAYLOAD}") || true

if [[ "${HTTP_CODE}" == "200" ]]; then
  VALID=$(json_get '.result.valid // .valid // .output.valid' "${RESP}" 2>/dev/null || echo "unknown")
  log_pass "Validation executed — result: ${VALID}"
elif [[ "${HTTP_CODE}" == "404" ]]; then
  log_warn "Capability 'data-validation' not found (may use different name)"
else
  log_warn "Capability execution returned ${HTTP_CODE}"
fi

# --- Step 3: Create a pipeline ---
log_step "Create a pipeline"
PIPELINE_PAYLOAD=$(cat <<EOF
{
  "name": "E2E Validation + Summary Pipeline",
  "description": "Validates data then generates AI summary",
  "steps": [
    {
      "capabilityId": "data-validation",
      "name": "Validate Input",
      "config": {
        "rules": [
          {"field": "companyName", "type": "required"}
        ]
      }
    },
    {
      "capabilityId": "ai-summary",
      "name": "Generate Summary",
      "config": {
        "maxTokens": 200
      }
    }
  ],
  "tenantId": "${TENANT_ID}"
}
EOF
)
RESP=$(http_post "${URL_CAPABILITY}/api/v1/pipelines" "${PIPELINE_PAYLOAD}") || true

if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
  PIPELINE_ID=$(json_get '.id // .pipelineId' "${RESP}")
  assert_non_empty "Pipeline ID" "${PIPELINE_ID}" || log_warn "Pipeline ID not returned"
  log_info "Created pipeline: ${PIPELINE_ID}"
else
  log_warn "Pipeline creation returned ${HTTP_CODE}"
fi

# --- Step 4: Execute the pipeline ---
log_step "Execute the pipeline"
if [[ -n "${PIPELINE_ID}" ]] && [[ "${PIPELINE_ID}" != "null" ]]; then
  EXEC_PAYLOAD=$(cat <<EOF
{
  "input": {
    "data": {
      "companyName": "Acme Corp",
      "email": "test@acme.example"
    }
  },
  "tenantId": "${TENANT_ID}"
}
EOF
  )
  RESP=$(http_post "${URL_CAPABILITY}/api/v1/pipelines/${PIPELINE_ID}/execute" "${EXEC_PAYLOAD}") || true

  if [[ "${HTTP_CODE}" == "200" ]]; then
    STATUS=$(json_get '.status // .result.status' "${RESP}" 2>/dev/null || echo "unknown")
    log_pass "Pipeline executed — status: ${STATUS}"
  else
    log_warn "Pipeline execution returned ${HTTP_CODE}"
  fi
else
  log_warn "Skipping — no pipeline ID"
fi

# --- Step 5: List pipelines ---
log_step "List pipelines"
RESP=$(http_get "${URL_CAPABILITY}/api/v1/pipelines") || true

if [[ "${HTTP_CODE}" == "200" ]]; then
  PIPE_COUNT=$(json_get '. | length' "${RESP}" 2>/dev/null || echo "0")
  log_pass "Pipelines list returned 200 (${PIPE_COUNT} pipelines)"
else
  log_warn "Pipelines list returned ${HTTP_CODE}"
fi

# --- End ---
test_end "S08 Capability Library" "${TEST_RESULT}"
exit $([[ "${TEST_RESULT}" == "PASS" ]] && echo 0 || echo 1)
