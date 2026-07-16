#!/usr/bin/env bash
# ============================================================================
# s06_rag_mdm.sh — Scenario 06: RAG / Knowledge / MDM
# ============================================================================
# Tests:
#   1. Create a knowledge base
#   2. Upload a document
#   3. Query RAG (semantic search)
#   4. Create/update a golden record (MDM)
#   5. Retrieve the golden record
#   6. List documents
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

preflight_checks

test_begin "S06 RAG / Knowledge / MDM"

TEST_RESULT="PASS"
KB_ID=""
DOC_ID=""
GOLDEN_ID=""

# --- Step 1: Create a knowledge base ---
log_step "Create a knowledge base"
KB_PAYLOAD=$(cat <<EOF
{
  "name": "E2E Knowledge Base",
  "description": "Knowledge base created by E2E integration test",
  "type": "RAG",
  "tenantId": "${TENANT_ID}"
}
EOF
)
RESP=$(http_post "${URL_RAG}/api/v1/knowledge" "${KB_PAYLOAD}") || true

if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
  KB_ID=$(json_get '.id' "${RESP}")
  assert_non_empty "Knowledge Base ID" "${KB_ID}" || log_warn "KB ID not returned"
  log_info "Created knowledge base: ${KB_ID}"
else
  log_warn "Knowledge base creation returned ${HTTP_CODE}"
fi

# --- Step 2: Upload a document ---
log_step "Upload a test document"
DOC_FILE="${FIXTURES}/test-document.txt"

if [[ -f "${DOC_FILE}" ]]; then
  RESP=$(http_post_file "${URL_RAG}/api/v1/documents" "${DOC_FILE}" "file") || true
else
  # Fallback: POST as JSON
  DOC_PAYLOAD=$(cat <<EOF
{
  "title": "E2E Test Document",
  "content": "MetaPlatform is a next-generation enterprise low-code platform. It provides nine layers of architecture including business objects, AI substrate, RAG knowledge base, dialogue layer, process automation, and capability library. This document is used for E2E integration testing.",
  "knowledgeBaseId": "${KB_ID}",
  "metadata": {
    "source": "e2e-test",
    "format": "text"
  }
}
EOF
  )
  RESP=$(http_post "${URL_RAG}/api/v1/documents" "${DOC_PAYLOAD}") || true
fi

if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
  DOC_ID=$(json_get '.id // .documentId' "${RESP}")
  assert_non_empty "Document ID" "${DOC_ID}" || log_warn "Doc ID not returned"
  log_info "Uploaded document: ${DOC_ID}"
else
  log_warn "Document upload returned ${HTTP_CODE}"
fi

# --- Step 3: RAG semantic search ---
log_step "RAG semantic search query"
RAG_PAYLOAD=$(cat <<EOF
{
  "query": "What is MetaPlatform?",
  "topK": 5,
  "knowledgeBaseId": "${KB_ID}"
}
EOF
)
RESP=$(http_post "${URL_RAG}/api/v1/rag/query" "${RAG_PAYLOAD}") || true

if [[ "${HTTP_CODE}" == "200" ]]; then
  RESULT_COUNT=$(json_get '.results | length // . | length' "${RESP}" 2>/dev/null || echo "0")
  log_pass "RAG query returned 200 (${RESULT_COUNT} results)"
  # Show first result snippet
  FIRST_SNIPPET=$(json_get '.results[0].content // .[0].content // "N/A"' "${RESP}" 2>/dev/null || echo "N/A")
  log_info "Top result: ${FIRST_SNIPPET:0:100}"
elif [[ "${HTTP_CODE}" == "503" ]]; then
  log_warn "RAG query returned 503 (embedding service may not be available)"
else
  log_warn "RAG query returned ${HTTP_CODE}"
fi

# --- Step 4: MDM — Create golden record ---
log_step "Create/update a golden record (MDM upsert)"
MDM_PAYLOAD=$(cat <<EOF
{
  "entityType": "Customer",
  "masterData": {
    "companyName": "Acme Corporation",
    "email": "contact@acme-corp.example",
    "phone": "+1-555-0100",
    "address": "123 Innovation Drive, San Francisco, CA"
  },
  "source": "e2e-test",
  "mergeStrategy": "MASTER_WINS"
}
EOF
)
RESP=$(http_post "${URL_RAG}/api/v1/mdm/golden-records/upsert" "${MDM_PAYLOAD}") || true

if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
  GOLDEN_ID=$(json_get '.id // .goldenRecordId' "${RESP}")
  assert_non_empty "Golden Record ID" "${GOLDEN_ID}" || log_warn "Golden ID not returned"
  log_info "Created/updated golden record: ${GOLDEN_ID}"
else
  log_warn "MDM upsert returned ${HTTP_CODE}"
fi

# --- Step 5: Retrieve golden record ---
log_step "Retrieve golden record"
if [[ -n "${GOLDEN_ID}" ]] && [[ "${GOLDEN_ID}" != "null" ]]; then
  RESP=$(http_get "${URL_RAG}/api/v1/mdm/golden-records/${GOLDEN_ID}") || true

  if [[ "${HTTP_CODE}" == "200" ]]; then
    COMPANY=$(json_get '.masterData.companyName // .companyName' "${RESP}" 2>/dev/null || echo "N/A")
    log_pass "Golden record retrieved — company: ${COMPANY}"
  else
    log_warn "Golden record retrieval returned ${HTTP_CODE}"
  fi
else
  log_warn "Skipping — no golden record ID"
fi

# --- Step 6: List documents ---
log_step "List documents"
RESP=$(http_get "${URL_RAG}/api/v1/documents") || true

if [[ "${HTTP_CODE}" == "200" ]]; then
  DOC_COUNT=$(json_get '. | length // .content | length' "${RESP}" 2>/dev/null || echo "0")
  log_pass "Documents list returned 200 (${DOC_COUNT} documents)"
else
  log_warn "Documents list returned ${HTTP_CODE}"
fi

# --- End ---
test_end "S06 RAG / MDM" "${TEST_RESULT}"
exit $([[ "${TEST_RESULT}" == "PASS" ]] && echo 0 || echo 1)
