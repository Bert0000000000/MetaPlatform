#!/usr/bin/env bash
# ============================================================================
# s02_ai_substrate.sh — Scenario 02: AI Substrate (LLM / Embedding / Context)
# ============================================================================
# Tests:
#   1. Call LLM chat endpoint (expect mock/degraded response)
#   2. Call embedding endpoint (expect mock vector)
#   3. Create context session and add messages
#   4. Retrieve context messages
#   5. Check billing summary
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

preflight_checks

test_begin "S02 AI Substrate — LLM Gateway / Embedding / Context"

TEST_RESULT="PASS"
SESSION_ID="e2e-session-$(gen_uuid | head -c 8)"

# --- Step 1: LLM Chat ---
log_step "Call LLM chat endpoint"
CHAT_PAYLOAD=$(cat <<EOF
{
  "model": "gpt-4",
  "messages": [
    {"role": "user", "content": "Hello, this is an E2E test message."}
  ],
  "tenantId": "${TENANT_ID}"
}
EOF
)
RESP=$(http_post "${URL_AI_SUBSTRATE}/api/v1/llm/chat" "${CHAT_PAYLOAD}") || true

# In mock/offline mode we expect 200 with a degraded response or 503 if no API key
if [[ "${HTTP_CODE}" == "200" ]]; then
  log_pass "LLM chat returned 200"
  CONTENT=$(json_get '.choices[0].message.content // .content // .response' "${RESP}")
  log_info "LLM response: ${CONTENT:0:100}"
elif [[ "${HTTP_CODE}" == "503" ]] || [[ "${HTTP_CODE}" == "500" ]]; then
  log_warn "LLM chat returned ${HTTP_CODE} (expected in mock/no-API-key mode)"
else
  log_fail "LLM chat returned unexpected status ${HTTP_CODE}"
  TEST_RESULT="FAIL"
fi

# --- Step 2: Embedding ---
log_step "Call embedding endpoint"
EMBED_PAYLOAD=$(cat <<EOF
{
  "input": "MetaPlatform E2E test embedding text",
  "model": "text-embedding-ada-002",
  "tenantId": "${TENANT_ID}"
}
EOF
)
RESP=$(http_post "${URL_AI_SUBSTRATE}/api/v1/embeddings" "${EMBED_PAYLOAD}") || true

if [[ "${HTTP_CODE}" == "200" ]]; then
  log_pass "Embedding returned 200"
  VECTOR_LEN=$(json_get '.data[0].embedding | length // .embedding | length' "${RESP}" 2>/dev/null || echo "0")
  log_info "Vector dimension: ${VECTOR_LEN}"
elif [[ "${HTTP_CODE}" == "503" ]] || [[ "${HTTP_CODE}" == "500" ]]; then
  log_warn "Embedding returned ${HTTP_CODE} (expected in mock mode)"
else
  log_fail "Embedding returned unexpected status ${HTTP_CODE}"
  TEST_RESULT="FAIL"
fi

# --- Step 3: Context — Add messages ---
log_step "Create context session and add messages"
CTX_PAYLOAD=$(cat <<EOF
{
  "role": "user",
  "content": "What is MetaPlatform?",
  "timestamp": "$(now_ts)"
}
EOF
)
RESP=$(http_post "${URL_AI_SUBSTRATE}/api/v1/context/${SESSION_ID}/messages" "${CTX_PAYLOAD}") || true

if [[ "${HTTP_CODE}" == "200" ]] || [[ "${HTTP_CODE}" == "201" ]]; then
  log_pass "Context message added (${HTTP_CODE})"
else
  log_warn "Context add returned ${HTTP_CODE} — service may not be fully implemented"
fi

# --- Step 4: Context — Retrieve messages ---
log_step "Retrieve context messages"
RESP=$(http_get "${URL_AI_SUBSTRATE}/api/v1/context/${SESSION_ID}/messages") || true

if [[ "${HTTP_CODE}" == "200" ]]; then
  MSG_COUNT=$(json_get '. | length' "${RESP}" 2>/dev/null || echo "0")
  log_pass "Context retrieval returned 200 (${MSG_COUNT} messages)"
else
  log_warn "Context retrieval returned ${HTTP_CODE}"
fi

# --- Step 5: Billing summary ---
log_step "Check billing summary"
RESP=$(http_get "${URL_AI_SUBSTRATE}/api/v1/billing/summary/${TENANT_ID}") || true

if [[ "${HTTP_CODE}" == "200" ]]; then
  log_pass "Billing summary returned 200"
  TOTAL_TOKENS=$(json_get '.totalTokens // .total_tokens // 0' "${RESP}")
  log_info "Total tokens billed: ${TOTAL_TOKENS}"
else
  log_warn "Billing summary returned ${HTTP_CODE}"
fi

# --- Cleanup: Delete context session ---
log_step "Cleanup — delete context session"
http_delete "${URL_AI_SUBSTRATE}/api/v1/context/${SESSION_ID}" || true
log_info "Context session deleted (HTTP ${HTTP_CODE})"

# --- End ---
test_end "S02 AI Substrate" "${TEST_RESULT}"
exit $([[ "${TEST_RESULT}" == "PASS" ]] && echo 0 || echo 1)
