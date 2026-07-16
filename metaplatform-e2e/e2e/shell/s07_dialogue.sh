#!/usr/bin/env bash
# ============================================================================
# s07_dialogue.sh — Scenario 07: Dialogue Layer (Conversation + Intent)
# ============================================================================
# Tests:
#   1. Create a conversation
#   2. Send a user message (triggers NL parsing)
#   3. Retrieve message history
#   4. List registered intents
#   5. Export conversation
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

preflight_checks

test_begin "S07 Dialogue Layer — Conversation + Intent Routing"

TEST_RESULT="PASS"
CONV_ID=""

# --- Step 1: Create a conversation ---
log_step "Create a conversation"
CONV_PAYLOAD=$(cat <<EOF
{
  "title": "E2E Test Conversation",
  "userId": "e2e-test-user",
  "tenantId": "${TENANT_ID}"
}
EOF
)
RESP=$(http_post "${URL_DIALOGUE}/api/v1/conversations" "${CONV_PAYLOAD}") || true

if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
  CONV_ID=$(json_get '.id // .conversationId' "${RESP}")
  assert_non_empty "Conversation ID" "${CONV_ID}" || TEST_RESULT="FAIL"
  log_info "Created conversation: ${CONV_ID}"
else
  log_fail "Conversation creation returned ${HTTP_CODE}"
  TEST_RESULT="FAIL"
fi

# --- Step 2: Send a user message ---
log_step "Send a user message"
if [[ -n "${CONV_ID}" ]]; then
  MSG_PAYLOAD=$(cat <<EOF
{
  "role": "user",
  "content": "Hello! Can you help me find customer information?",
  "timestamp": "$(now_ts)"
}
EOF
  )
  RESP=$(http_post "${URL_DIALOGUE}/api/v1/conversations/${CONV_ID}/messages" "${MSG_PAYLOAD}") || true

  if [[ "${HTTP_CODE}" == "200" ]] || [[ "${HTTP_CODE}" == "201" ]]; then
    log_pass "Message sent successfully (HTTP ${HTTP_CODE})"
    # Check for assistant reply
    ASSISTANT_REPLY=$(json_get '.assistantReply // .response // .content' "${RESP}" 2>/dev/null || echo "")
    if [[ -n "${ASSISTANT_REPLY}" ]] && [[ "${ASSISTANT_REPLY}" != "null" ]]; then
      log_info "Assistant reply: ${ASSISTANT_REPLY:0:100}"
    else
      log_info "No immediate assistant reply (may be async)"
    fi
  else
    log_warn "Message send returned ${HTTP_CODE}"
  fi
else
  log_warn "Skipping — no conversation ID"
fi

# --- Step 3: Retrieve message history ---
log_step "Retrieve message history"
if [[ -n "${CONV_ID}" ]]; then
  RESP=$(http_get "${URL_DIALOGUE}/api/v1/conversations/${CONV_ID}/messages") || true

  if [[ "${HTTP_CODE}" == "200" ]]; then
    MSG_COUNT=$(json_get '. | length // .content | length' "${RESP}" 2>/dev/null || echo "0")
    log_pass "Message history returned 200 (${MSG_COUNT} messages)"
    # Show last message
    LAST_MSG=$(json_get '.[-1].content // .content[-1].content' "${RESP}" 2>/dev/null || echo "N/A")
    log_info "Last message: ${LAST_MSG:0:100}"
  else
    log_warn "Message history returned ${HTTP_CODE}"
  fi
else
  log_warn "Skipping — no conversation ID"
fi

# --- Step 4: List registered intents ---
log_step "List registered intents"
RESP=$(http_get "${URL_DIALOGUE}/api/v1/intents") || true

if [[ "${HTTP_CODE}" == "200" ]]; then
  INTENT_COUNT=$(json_get '. | length // .content | length' "${RESP}" 2>/dev/null || echo "0")
  log_pass "Intents list returned 200 (${INTENT_COUNT} intents)"
  # Show intent names
  INTENT_NAMES=$(json_get '.[].name // .content[].name' "${RESP}" 2>/dev/null || echo "N/A")
  log_info "Registered intents: ${INTENT_NAMES:0:200}"
else
  log_warn "Intents list returned ${HTTP_CODE}"
fi

# --- Step 5: Export conversation ---
log_step "Export conversation"
if [[ -n "${CONV_ID}" ]]; then
  RESP=$(http_get "${URL_DIALOGUE}/api/v1/conversations/${CONV_ID}/export") || true

  if [[ "${HTTP_CODE}" == "200" ]]; then
    log_pass "Conversation exported successfully"
    EXPORT_FORMAT=$(json_get '.format // .type' "${RESP}" 2>/dev/null || echo "unknown")
    log_info "Export format: ${EXPORT_FORMAT}"
  else
    log_warn "Conversation export returned ${HTTP_CODE}"
  fi
else
  log_warn "Skipping — no conversation ID"
fi

# --- End ---
test_end "S07 Dialogue" "${TEST_RESULT}"
exit $([[ "${TEST_RESULT}" == "PASS" ]] && echo 0 || echo 1)
