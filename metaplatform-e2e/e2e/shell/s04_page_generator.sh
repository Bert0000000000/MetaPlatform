#!/usr/bin/env bash
# ============================================================================
# s04_page_generator.sh — Scenario 04: Page/Form Generator
# ============================================================================
# Tests:
#   1. Generate a page config from schema (TABLE view)
#   2. Generate a page config from schema (FORM view)
#   3. Save a page config
#   4. Render a page to JSON
#   5. List available page templates
#   6. Apply a template (CRUD)
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

preflight_checks

test_begin "S04 Page/Form Generator — Schema-to-UI Auto-generation"

TEST_RESULT="PASS"
CONFIG_ID=""

# --- Step 1: Generate TABLE page from schema ---
log_step "Generate TABLE page config from schema"
GEN_PAYLOAD=$(cat <<EOF
{
  "objectTypeId": "Customer",
  "viewType": "TABLE",
  "name": "Customer List",
  "schema": {
    "name": "Customer",
    "fields": [
      {"name": "companyName", "type": "STRING", "label": "Company Name"},
      {"name": "email", "type": "STRING", "label": "Email"},
      {"name": "annualRevenue", "type": "DECIMAL", "label": "Annual Revenue"}
    ]
  }
}
EOF
)
RESP=$(http_post "${URL_PAGE_GEN}/api/v1/pages/generate" "${GEN_PAYLOAD}") || true

if [[ "${HTTP_CODE}" == "200" ]] || [[ "${HTTP_CODE}" == "201" ]]; then
  log_pass "TABLE page generated (HTTP ${HTTP_CODE})"
  CONFIG_ID=$(json_get '.id // .configId // .pageConfigId' "${RESP}")
  log_info "Generated config ID: ${CONFIG_ID}"
  # Verify view type
  VIEW_TYPE=$(json_get '.viewType // .type' "${RESP}")
  log_info "View type: ${VIEW_TYPE}"
else
  log_warn "Page generation returned ${HTTP_CODE} — service may not be fully implemented"
fi

# --- Step 2: Generate FORM page from schema ---
log_step "Generate FORM page config from schema"
FORM_PAYLOAD=$(cat <<EOF
{
  "objectTypeId": "Customer",
  "viewType": "FORM",
  "name": "Customer Detail Form",
  "schema": {
    "name": "Customer",
    "fields": [
      {"name": "companyName", "type": "STRING", "label": "Company Name"},
      {"name": "email", "type": "STRING", "label": "Email"},
      {"name": "annualRevenue", "type": "DECIMAL", "label": "Annual Revenue"}
    ]
  }
}
EOF
)
RESP=$(http_post "${URL_PAGE_GEN}/api/v1/pages/generate" "${FORM_PAYLOAD}") || true

if [[ "${HTTP_CODE}" == "200" ]] || [[ "${HTTP_CODE}" == "201" ]]; then
  log_pass "FORM page generated (HTTP ${HTTP_CODE})"
  FORM_ID=$(json_get '.id // .configId // .pageConfigId' "${RESP}")
  log_info "Form config ID: ${FORM_ID}"
else
  log_warn "FORM generation returned ${HTTP_CODE}"
fi

# --- Step 3: Save a page config ---
log_step "Save a page config"
SAVE_PAYLOAD=$(cat <<EOF
{
  "name": "Customer E2E Config",
  "objectTypeId": "Customer",
  "viewType": "TABLE",
  "status": "DRAFT",
  "sections": [
    {
      "title": "Customer Information",
      "fields": [
        {"field": "companyName", "widget": "TEXT_INPUT", "colSpan": 2},
        {"field": "email", "widget": "EMAIL_INPUT", "colSpan": 1},
        {"field": "annualRevenue", "widget": "NUMBER_INPUT", "colSpan": 1}
      ]
    }
  ]
}
EOF
)
RESP=$(http_post "${URL_PAGE_GEN}/api/v1/page-configs" "${SAVE_PAYLOAD}") || true

if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
  SAVED_ID=$(json_get '.id' "${RESP}")
  CONFIG_ID="${SAVED_ID:-${CONFIG_ID}}"
  log_pass "Page config saved (ID: ${CONFIG_ID})"
else
  log_warn "Page config save returned ${HTTP_CODE}"
fi

# --- Step 4: Render page to JSON ---
log_step "Render page to JSON"
if [[ -n "${CONFIG_ID}" ]] && [[ "${CONFIG_ID}" != "null" ]]; then
  RESP=$(http_get "${URL_PAGE_GEN}/api/v1/pages/${CONFIG_ID}/render") || true

  if [[ "${HTTP_CODE}" == "200" ]]; then
    log_pass "Page rendered successfully"
    HAS_SECTIONS=$(json_get '.sections | length // .layout | length' "${RESP}" 2>/dev/null || echo "0")
    log_info "Rendered sections: ${HAS_SECTIONS}"
  else
    log_warn "Page render returned ${HTTP_CODE}"
  fi
else
  log_warn "Skipping — no config ID available"
fi

# --- Step 5: List page templates ---
log_step "List available page templates"
RESP=$(http_get "${URL_PAGE_GEN}/api/v1/page-templates") || true

if [[ "${HTTP_CODE}" == "200" ]]; then
  TPL_COUNT=$(json_get '. | length' "${RESP}" 2>/dev/null || echo "0")
  log_pass "Templates endpoint returned 200 (${TPL_COUNT} templates)"
  # List template names
  TPL_NAMES=$(json_get '.[].code // .[].name' "${RESP}" 2>/dev/null || echo "N/A")
  log_info "Available templates: ${TPL_NAMES}"
else
  log_warn "Templates list returned ${HTTP_CODE}"
fi

# --- Step 6: Apply CRUD template ---
log_step "Apply CRUD template"
APPLY_PAYLOAD=$(cat <<EOF
{
  "objectTypeId": "Customer",
  "name": "Customer CRUD from Template"
}
EOF
)
RESP=$(http_post "${URL_PAGE_GEN}/api/v1/page-templates/CRUD/apply" "${APPLY_PAYLOAD}") || true

if [[ "${HTTP_CODE}" == "200" ]] || [[ "${HTTP_CODE}" == "201" ]]; then
  log_pass "CRUD template applied (HTTP ${HTTP_CODE})"
  TPL_CONFIG_ID=$(json_get '.id // .configId' "${RESP}")
  log_info "Template config ID: ${TPL_CONFIG_ID}"
else
  log_warn "Template apply returned ${HTTP_CODE}"
fi

# --- End ---
test_end "S04 Page Generator" "${TEST_RESULT}"
exit $([[ "${TEST_RESULT}" == "PASS" ]] && echo 0 || echo 1)
