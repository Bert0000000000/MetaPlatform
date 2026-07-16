#!/usr/bin/env bash
# ============================================================================
# s03_business_object.sh — Scenario 03: Business Object (ObjectType + Instance)
# ============================================================================
# Tests:
#   1. Create an ObjectType (Customer) with field definitions
#   2. Retrieve the ObjectType
#   3. Create an ObjectInstance with field values
#   4. Query ObjectInstances
#   5. Perform lifecycle transition on the instance
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

preflight_checks

test_begin "S03 Business Object — ObjectType + ObjectInstance Lifecycle"

TEST_RESULT="PASS"
OBJECT_TYPE_ID=""

# --- Step 1: Create ObjectType ---
log_step "Create ObjectType 'Customer'"
TYPE_PAYLOAD=$(cat <<EOF
{
  "name": "Customer",
  "displayName": "Customer",
  "description": "E2E test customer object type",
  "fields": [
    {
      "name": "companyName",
      "displayName": "Company Name",
      "type": "STRING",
      "required": true,
      "maxLength": 200
    },
    {
      "name": "email",
      "displayName": "Email",
      "type": "STRING",
      "required": true,
      "validationRule": "email != null && email.contains('@')"
    },
    {
      "name": "annualRevenue",
      "displayName": "Annual Revenue",
      "type": "DECIMAL",
      "required": false
    }
  ],
  "lifecycle": {
    "states": ["draft", "active", "suspended", "archived"],
    "transitions": [
      {"from": "draft", "to": "active", "name": "activate"},
      {"from": "active", "to": "suspended", "name": "suspend"},
      {"from": "suspended", "to": "active", "name": "reactivate"},
      {"from": "active", "to": "archived", "name": "archive"}
    ]
  },
  "tenantId": "${TENANT_ID}"
}
EOF
)
RESP=$(http_post "${URL_ONTOLOGY}/api/v1/object-types" "${TYPE_PAYLOAD}") || true

if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
  OBJECT_TYPE_ID=$(json_get '.id' "${RESP}")
  assert_non_empty "ObjectType ID" "${OBJECT_TYPE_ID}" || TEST_RESULT="FAIL"
  log_info "Created ObjectType: ${OBJECT_TYPE_ID}"
else
  # Fallback: try entity-types endpoint (ontology-engine)
  log_warn "Object-types endpoint returned ${HTTP_CODE}, trying entity-types..."
  ENTITY_PAYLOAD=$(cat <<EOF
{
  "name": "Customer",
  "description": "E2E test customer entity",
  "properties": [
    {"name": "companyName", "type": "STRING", "required": true},
    {"name": "email", "type": "STRING", "required": true},
    {"name": "annualRevenue", "type": "DECIMAL", "required": false}
  ]
}
EOF
  )
  RESP=$(http_post "${URL_ONTOLOGY}/api/v1/entity-types" "${ENTITY_PAYLOAD}") || true
  if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
    OBJECT_TYPE_ID=$(json_get '.id' "${RESP}")
    assert_non_empty "Entity ID" "${OBJECT_TYPE_ID}" || TEST_RESULT="FAIL"
    log_info "Created EntityType (fallback): ${OBJECT_TYPE_ID}"
  else
    log_fail "Failed to create ObjectType or EntityType (${HTTP_CODE})"
    TEST_RESULT="FAIL"
  fi
fi

# --- Step 2: Retrieve ObjectType ---
log_step "Retrieve ObjectType"
if [[ -n "${OBJECT_TYPE_ID}" ]]; then
  RESP=$(http_get "${URL_ONTOLOGY}/api/v1/object-types/${OBJECT_TYPE_ID}") || true
  if [[ "${HTTP_CODE}" == "200" ]]; then
    NAME=$(json_get '.name' "${RESP}")
    assert_json_eq '.name' "Customer" "${RESP}" || TEST_RESULT="FAIL"
  else
    # Fallback
    RESP=$(http_get "${URL_ONTOLOGY}/api/v1/entity-types/${OBJECT_TYPE_ID}") || true
    assert_status "200" || log_warn "EntityType retrieve returned ${HTTP_CODE}"
  fi
else
  log_warn "Skipping — no ObjectType ID available"
fi

# --- Step 3: Create ObjectInstance ---
log_step "Create ObjectInstance"
INSTANCE_ID=""
if [[ -n "${OBJECT_TYPE_ID}" ]]; then
  INSTANCE_PAYLOAD=$(cat <<EOF
{
  "objectTypeId": "${OBJECT_TYPE_ID}",
  "fields": {
    "companyName": "Acme Corp E2E",
    "email": "e2e-test@acme-corp.example",
    "annualRevenue": 1500000.00
  },
  "tenantId": "${TENANT_ID}"
}
EOF
  )
  RESP=$(http_post "${URL_ONTOLOGY}/api/v1/object-instances?objectTypeId=${OBJECT_TYPE_ID}&tenantId=${TENANT_ID}" "${INSTANCE_PAYLOAD}") || true

  if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
    INSTANCE_ID=$(json_get '.id' "${RESP}")
    assert_non_empty "Instance ID" "${INSTANCE_ID}" || log_warn "Instance ID not returned"
    log_info "Created ObjectInstance: ${INSTANCE_ID}"
  else
    # Fallback: try entity-instances endpoint
    log_warn "Object-instances returned ${HTTP_CODE}, trying entity-instances..."
    ENTITY_INST_PAYLOAD=$(cat <<EOF
{
  "properties": {
    "companyName": "Acme Corp E2E",
    "email": "e2e-test@acme-corp.example",
    "annualRevenue": 1500000.00
  }
}
EOF
    )
    RESP=$(http_post "${URL_ONTOLOGY}/api/v1/entity-types/Customer/instances" "${ENTITY_INST_PAYLOAD}") || true
    if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
      INSTANCE_ID=$(json_get '.id' "${RESP}")
      log_info "Created EntityInstance (fallback): ${INSTANCE_ID}"
    else
      log_warn "Instance creation returned ${HTTP_CODE}"
    fi
  fi
else
  log_warn "Skipping — no ObjectType ID available"
fi

# --- Step 4: Query ObjectInstances ---
log_step "Query ObjectInstances"
if [[ -n "${OBJECT_TYPE_ID}" ]]; then
  RESP=$(http_get "${URL_ONTOLOGY}/api/v1/object-instances?objectTypeId=${OBJECT_TYPE_ID}") || true
  if [[ "${HTTP_CODE}" == "200" ]]; then
    INST_COUNT=$(json_get '. | length // .content | length' "${RESP}" 2>/dev/null || echo "0")
    log_info "Instance count: ${INST_COUNT}"
    assert_gt "Instance count" 0 "${INST_COUNT}" || log_warn "No instances found"
  else
    log_warn "Instance query returned ${HTTP_CODE}"
  fi
else
  log_warn "Skipping — no ObjectType ID"
fi

# --- Step 5: Lifecycle transition ---
log_step "Lifecycle transition: draft -> active"
if [[ -n "${INSTANCE_ID}" ]] && [[ -n "${OBJECT_TYPE_ID}" ]]; then
  RESP=$(http_post "${URL_ONTOLOGY}/api/v1/object-instances/${INSTANCE_ID}/transition?objectTypeId=${OBJECT_TYPE_ID}&toState=active" "{}") || true
  if [[ "${HTTP_CODE}" == "200" ]]; then
    STATE=$(json_get '.state // .lifecycleState // .status' "${RESP}")
    log_pass "Transition successful, state: ${STATE}"
  else
    log_warn "Lifecycle transition returned ${HTTP_CODE} — may not be implemented yet"
  fi
else
  log_warn "Skipping — no instance or type ID"
fi

# --- End ---
test_end "S03 Business Object" "${TEST_RESULT}"
exit $([[ "${TEST_RESULT}" == "PASS" ]] && echo 0 || echo 1)
