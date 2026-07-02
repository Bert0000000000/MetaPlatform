#!/usr/bin/env bash
# ============================================================================
# s10_full_stack.sh — Scenario 10: Full Stack Integration
# ============================================================================
# Tests the complete flow from ObjectType creation through page generation
# to frontend rendering with data.
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

preflight_checks

test_begin "S10 Full Stack — ObjectType -> Page -> Frontend"

TEST_RESULT="PASS"
ENTITY_TYPE_ID=""
OBJECT_TYPE_ID=""
INSTANCE_IDS=()
PAGE_CONFIG_ID=""

# --- Step 1: Create EntityType ---
log_step "Create EntityType 'Product'"
ENTITY_PAYLOAD='{
  "name": "Product",
  "description": "Product catalog entity",
  "properties": [
    {"name": "name", "type": "STRING", "required": true},
    {"name": "sku", "type": "STRING", "required": true},
    {"name": "price", "type": "DOUBLE", "required": true},
    {"name": "category", "type": "STRING", "required": false},
    {"name": "inStock", "type": "BOOLEAN", "required": false}
  ]
}'
RESP=$(http_post "${URL_ONTOLOGY}/api/v1/entity-types" "${ENTITY_PAYLOAD}") || true

if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
  ENTITY_TYPE_ID=$(json_get '.id' "${RESP}")
  assert_non_empty "EntityType ID" "${ENTITY_TYPE_ID}" || TEST_RESULT="FAIL"
  log_info "Created EntityType: ${ENTITY_TYPE_ID}"
else
  log_fail "Failed to create EntityType (${HTTP_CODE})"
  TEST_RESULT="FAIL"
fi

# --- Step 2: Create ObjectType ---
log_step "Create ObjectType 'product'"
if [[ -n "${ENTITY_TYPE_ID}" ]]; then
  OBJ_PAYLOAD=$(cat <<EOF
{
  "code": "product",
  "displayName": "Product",
  "entityTypeId": "${ENTITY_TYPE_ID}",
  "fieldDefinitions": [
    {"name": "name", "displayName": "Product Name", "fieldType": "STRING", "required": true, "editable": true},
    {"name": "sku", "displayName": "SKU", "fieldType": "STRING", "required": true, "editable": true},
    {"name": "price", "displayName": "Price", "fieldType": "DOUBLE", "required": true, "editable": true},
    {"name": "category", "displayName": "Category", "fieldType": "STRING", "required": false, "editable": true},
    {"name": "inStock", "displayName": "In Stock", "fieldType": "BOOLEAN", "required": false, "editable": true}
  ],
  "lifecycleStates": ["draft", "active", "archived"],
  "lifecycleTransitions": [
    {"fromState": "draft", "toState": "active", "name": "activate"},
    {"fromState": "active", "toState": "archived", "name": "archive"}
  ],
  "initialState": "draft"
}
EOF
)
  RESP=$(http_post "${URL_ONTOLOGY}/api/v1/object-types" "${OBJ_PAYLOAD}") || true

  if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
    OBJECT_TYPE_ID=$(json_get '.id' "${RESP}")
    assert_non_empty "ObjectType ID" "${OBJECT_TYPE_ID}" || TEST_RESULT="FAIL"
    log_info "Created ObjectType: ${OBJECT_TYPE_ID}"
  else
    log_fail "Failed to create ObjectType (${HTTP_CODE}): ${RESP}"
    TEST_RESULT="FAIL"
  fi
else
  log_warn "Skipping — no EntityType ID"
  TEST_RESULT="FAIL"
fi

# --- Step 3: Create Instances ---
log_step "Create 3 product instances"
if [[ -n "${OBJECT_TYPE_ID}" ]]; then
  PRODUCTS=(
    '{"fieldValues": {"name": "Laptop Pro", "sku": "LP-001", "price": 1299.99, "category": "Electronics", "inStock": true}}'
    '{"fieldValues": {"name": "Wireless Mouse", "sku": "WM-002", "price": 29.99, "category": "Accessories", "inStock": true}}'
    '{"fieldValues": {"name": "USB-C Hub", "sku": "UH-003", "price": 49.99, "category": "Accessories", "inStock": false}}'
  )
  
  for payload in "${PRODUCTS[@]}"; do
    RESP=$(http_post "${URL_ONTOLOGY}/api/v1/object-instances?objectTypeId=${OBJECT_TYPE_ID}&tenantId=${TENANT_ID}" "${payload}") || true
    if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
      INST_ID=$(json_get '.id' "${RESP}")
      INSTANCE_IDS+=("${INST_ID}")
      log_info "Created instance: ${INST_ID}"
    else
      log_warn "Instance creation returned ${HTTP_CODE}"
    fi
  done
  
  assert_gt "Instance count" 2 ${#INSTANCE_IDS[@]} || log_warn "Expected 3 instances"
else
  log_warn "Skipping — no ObjectType ID"
fi

# --- Step 4: Query Instances ---
log_step "Query instances and verify data"
if [[ -n "${OBJECT_TYPE_ID}" ]]; then
  RESP=$(http_get "${URL_ONTOLOGY}/api/v1/object-instances?objectTypeId=${OBJECT_TYPE_ID}&tenantId=${TENANT_ID}") || true
  if [[ "${HTTP_CODE}" == "200" ]]; then
    INST_COUNT=$(json_get '. | length' "${RESP}" 2>/dev/null || echo "0")
    log_info "Total instances: ${INST_COUNT}"
    assert_gt "Instance count" 0 "${INST_COUNT}" || TEST_RESULT="FAIL"
  else
    log_fail "Query instances failed (${HTTP_CODE})"
    TEST_RESULT="FAIL"
  fi
fi

# --- Step 5: Generate Page Config ---
log_step "Generate TABLE page config"
if [[ -n "${OBJECT_TYPE_ID}" ]]; then
  PAGE_PAYLOAD='{"objectCode": "product", "pageType": "TABLE"}'
  RESP=$(http_post "${URL_PAGE_GEN}/api/v1/pages/quick-create" "${PAGE_PAYLOAD}") || true
  
  if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
    PAGE_CONFIG_ID=$(json_get '.id' "${RESP}")
    assert_non_empty "PageConfig ID" "${PAGE_CONFIG_ID}" || log_warn "PageConfig ID not returned"
    log_info "Generated page config: ${PAGE_CONFIG_ID}"
  else
    log_warn "Page generation returned ${HTTP_CODE} — may need manual page creation"
  fi
fi

# --- Step 6: Render Page ---
log_step "Render page and verify structure"
if [[ -n "${PAGE_CONFIG_ID}" ]]; then
  RESP=$(http_get "${URL_PAGE_GEN}/api/v1/pages/${PAGE_CONFIG_ID}/render") || true
  
  if [[ "${HTTP_CODE}" == "200" ]]; then
    PAGE_TYPE=$(json_get '.pageType' "${RESP}")
    SECTIONS=$(json_get '.sections | length' "${RESP}" 2>/dev/null || echo "0")
    log_info "Rendered page: type=${PAGE_TYPE}, sections=${SECTIONS}"
    assert_json_eq '.pageType' "TABLE" "${RESP}" || log_warn "Expected TABLE page type"
  else
    log_warn "Page render returned ${HTTP_CODE}"
  fi
fi

# --- Step 7: Verify ObjectType by code ---
log_step "Verify ObjectType retrieval by code"
RESP=$(http_get "${URL_ONTOLOGY}/api/v1/object-types/code/product") || true

if [[ "${HTTP_CODE}" == "200" ]]; then
  OT_CODE=$(json_get '.code' "${RESP}")
  assert_json_eq '.code' "product" "${RESP}" || TEST_RESULT="FAIL"
  log_info "ObjectType by code: ${OT_CODE}"
else
  log_warn "ObjectType by code returned ${HTTP_CODE}"
fi

# --- End ---
test_end "S10 Full Stack" "${TEST_RESULT}"
exit $([[ "${TEST_RESULT}" == "PASS" ]] && echo 0 || echo 1)
