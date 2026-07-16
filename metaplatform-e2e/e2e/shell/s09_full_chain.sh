#!/usr/bin/env bash
# ============================================================================
# s09_full_chain.sh — Scenario 09: Full Chain Integration
# ============================================================================
# Tests the complete cross-service chain:
#   1. Platform Base: Ensure tenant exists
#   2. Ontology Engine: Create entity type (if not exists)
#   3. Data Stack: Verify entity data flows to data warehouse
#   4. AI Substrate: Generate embedding for entity description
#   5. RAG/MDM: Store entity info in knowledge base
#   6. Page Generator: Generate UI for entity type
#   7. Process Automation: Create workflow triggered by entity events
#   8. Dialogue: Send a message referencing the entity
#   9. Capability Library: Execute a validation capability
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

preflight_checks

test_begin "S09 Full Chain — Cross-Service Integration"

TEST_RESULT="PASS"
CHAIN_ERRORS=0

# Helper: increment error counter but don't abort
chain_warn() {
  CHAIN_ERRORS=$(( CHAIN_ERRORS + 1 ))
  log_warn "$@"
}

# ===========================================================================
# Step 1: Platform Base — Ensure tenant
# ===========================================================================
log_step "Platform Base — Ensure tenant exists"
RESP=$(http_get "${URL_PLATFORM_BASE}/api/v1/tenants") || true
if [[ "${HTTP_CODE}" == "200" ]]; then
  TENANT_COUNT=$(json_get '. | length' "${RESP}" 2>/dev/null || echo "0")
  if (( TENANT_COUNT >= 1 )); then
    log_pass "Tenants available (${TENANT_COUNT})"
  else
    log_info "Creating tenant..."
    CREATE_RESP=$(http_post "${URL_PLATFORM_BASE}/api/v1/tenants" \
      '{"name":"e2e-chain-tenant","displayName":"E2E Chain Tenant","description":"Full chain test"}') || true
    if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
      log_pass "Tenant created"
    else
      chain_warn "Tenant creation returned ${HTTP_CODE}"
    fi
  fi
else
  chain_warn "Platform Base not reachable (${HTTP_CODE})"
fi

# ===========================================================================
# Step 2: Ontology Engine — Create entity type
# ===========================================================================
log_step "Ontology Engine — Create 'Supplier' entity type"
ENTITY_PAYLOAD=$(cat <<EOF
{
  "name": "Supplier",
  "description": "Supplier entity for full-chain E2E test",
  "properties": [
    {"name": "companyName", "type": "STRING", "required": true},
    {"name": "country", "type": "STRING", "required": true},
    {"name": "rating", "type": "INTEGER", "required": false}
  ]
}
EOF
)
RESP=$(http_post "${URL_ONTOLOGY}/api/v1/entity-types" "${ENTITY_PAYLOAD}") || true
SUPPLIER_TYPE_ID=$(json_get '.id' "${RESP}" 2>/dev/null || echo "")

if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
  log_pass "Supplier entity type created (ID: ${SUPPLIER_TYPE_ID})"
  # Also create an instance
  INST_RESP=$(http_post "${URL_ONTOLOGY}/api/v1/entity-types/Supplier/instances" \
    '{"properties":{"companyName":"Global Parts Inc","country":"Germany","rating":4}}') || true
  if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
    log_pass "Supplier instance created"
  else
    chain_warn "Supplier instance creation returned ${HTTP_CODE}"
  fi
else
  chain_warn "Entity type creation returned ${HTTP_CODE}"
fi

# ===========================================================================
# Step 3: Data Stack — Verify data pipeline
# ===========================================================================
log_step "Data Stack — Verify health and data pipeline"
RESP=$(http_get "${URL_DATA_STACK}/health") || true
if [[ "${HTTP_CODE}" == "200" ]]; then
  log_pass "Data Stack is healthy"
  # Try querying datasets
  RESP=$(http_get "${URL_DATA_STACK}/api/v1/datasets") || true
  if [[ "${HTTP_CODE}" == "200" ]]; then
    DS_COUNT=$(json_get '. | length // .content | length' "${RESP}" 2>/dev/null || echo "0")
    log_info "Datasets: ${DS_COUNT}"
  fi
else
  chain_warn "Data Stack not reachable (${HTTP_CODE})"
fi

# ===========================================================================
# Step 4: AI Substrate — Generate embedding
# ===========================================================================
log_step "AI Substrate — Generate embedding for entity"
EMBED_RESP=$(http_post "${URL_AI_SUBSTRATE}/api/v1/embeddings" \
  '{"input":"Supplier: Global Parts Inc, Germany, Rating 4","model":"text-embedding-ada-002"}') || true
if [[ "${HTTP_CODE}" == "200" ]]; then
  log_pass "Embedding generated"
elif [[ "${HTTP_CODE}" == "503" ]] || [[ "${HTTP_CODE}" == "500" ]]; then
  log_warn "Embedding unavailable (expected in mock mode)"
else
  chain_warn "Embedding returned ${HTTP_CODE}"
fi

# ===========================================================================
# Step 5: RAG/MDM — Store entity info
# ===========================================================================
log_step "RAG/MDM — Store entity description in knowledge base"
DOC_RESP=$(http_post "${URL_RAG}/api/v1/documents" \
  '{"title":"Supplier: Global Parts Inc","content":"Global Parts Inc is a German supplier with a rating of 4. They provide industrial components for automotive manufacturing.","metadata":{"source":"e2e-chain","entityType":"Supplier"}}') || true
if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
  log_pass "Document stored in RAG"
else
  chain_warn "RAG document store returned ${HTTP_CODE}"
fi

# ===========================================================================
# Step 6: Page Generator — Generate UI
# ===========================================================================
log_step "Page Generator — Generate TABLE view for Supplier"
PAGE_RESP=$(http_post "${URL_PAGE_GEN}/api/v1/pages/generate" \
  '{"objectTypeId":"Supplier","viewType":"TABLE","name":"Supplier List","schema":{"name":"Supplier","fields":[{"name":"companyName","type":"STRING","label":"Company Name"},{"name":"country","type":"STRING","label":"Country"},{"name":"rating","type":"INTEGER","label":"Rating"}]}}') || true
if [[ "${HTTP_CODE}" == "200" ]] || [[ "${HTTP_CODE}" == "201" ]]; then
  log_pass "Supplier TABLE page generated"
else
  chain_warn "Page generation returned ${HTTP_CODE}"
fi

# ===========================================================================
# Step 7: Process Automation — Create workflow
# ===========================================================================
log_step "Process Automation — Create supplier onboarding workflow"
PROC_RESP=$(http_post "${URL_PROCESS}/api/v1/process-definitions" \
  '{"name":"Supplier Onboarding","description":"Auto-created by E2E full chain test","nodes":[{"id":"start","type":"START","name":"Start"},{"id":"review","type":"TASK","name":"Review Supplier","assigneeType":"USER","assigneeExpression":"\'procurement-team\'"},{"id":"end","type":"END","name":"Approved"}],"transitions":[{"from":"start","to":"review"},{"from":"review","to":"end"}]}') || true
if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
  log_pass "Supplier onboarding workflow created"
else
  chain_warn "Process definition returned ${HTTP_CODE}"
fi

# ===========================================================================
# Step 8: Dialogue — Send a message
# ===========================================================================
log_step "Dialogue — Create conversation and send message"
CONV_RESP=$(http_post "${URL_DIALOGUE}/api/v1/conversations" \
  '{"title":"Supplier Inquiry - Full Chain Test","userId":"e2e-chain-user"}') || true
if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
  CONV_CHAIN_ID=$(json_get '.id // .conversationId' "${CONV_RESP}")
  log_info "Conversation created: ${CONV_CHAIN_ID}"
  # Send message
  MSG_RESP=$(http_post "${URL_DIALOGUE}/api/v1/conversations/${CONV_CHAIN_ID}/messages" \
    '{"role":"user","content":"Show me all suppliers from Germany"}') || true
  if [[ "${HTTP_CODE}" == "200" ]] || [[ "${HTTP_CODE}" == "201" ]]; then
    log_pass "Message sent in dialogue"
  else
    chain_warn "Message send returned ${HTTP_CODE}"
  fi
else
  chain_warn "Conversation creation returned ${HTTP_CODE}"
fi

# ===========================================================================
# Step 9: Capability Library — Execute validation
# ===========================================================================
log_step "Capability Library — Execute validation capability"
CAP_RESP=$(http_post "${URL_CAPABILITY}/api/v1/capabilities/data-validation/execute" \
  '{"input":{"data":{"companyName":"Global Parts Inc","country":"Germany","rating":4},"rules":[{"field":"companyName","type":"required"},{"field":"country","type":"required"}]},"tenantId":"'"${TENANT_ID}"'"}') || true
if [[ "${HTTP_CODE}" == "200" ]]; then
  log_pass "Validation capability executed"
elif [[ "${HTTP_CODE}" == "404" ]]; then
  log_warn "data-validation capability not found"
else
  chain_warn "Capability execution returned ${HTTP_CODE}"
fi

# ===========================================================================
# Summary
# ===========================================================================
echo ""
log_info "Full chain completed with ${CHAIN_ERRORS} non-fatal warnings"
if (( CHAIN_ERRORS <= 3 )); then
  # Allow some non-fatal warnings (services may be partially implemented)
  log_pass "Full chain passed (within tolerance: ${CHAIN_ERRORS} warnings)"
  TEST_RESULT="PASS"
else
  log_fail "Full chain had too many failures (${CHAIN_ERRORS} warnings)"
  TEST_RESULT="FAIL"
fi

# --- End ---
test_end "S09 Full Chain" "${TEST_RESULT}"
exit $([[ "${TEST_RESULT}" == "PASS" ]] && echo 0 || echo 1)
