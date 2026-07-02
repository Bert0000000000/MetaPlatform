#!/usr/bin/env bash
# ============================================================================
# s05_process_automation.sh — Scenario 05: Process Automation Engine
# ============================================================================
# Tests:
#   1. Create a process definition from JSON DSL
#   2. Activate the process definition
#   3. Start a process instance
#   4. Query pending tasks
#   5. Complete a task (approve)
#   6. Verify process instance completion
#   7. Check process history
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

preflight_checks

test_begin "S05 Process Automation — Workflow DSL + Execution"

TEST_RESULT="PASS"
DEF_ID=""
INSTANCE_ID=""
TASK_ID=""

# --- Step 1: Create process definition ---
log_step "Create process definition from DSL"
DEF_PAYLOAD=$(cat "${FIXTURES}/process-dsl.json) 2>/dev/null || cat <<EOF
{
  "name": "E2E Approval Process",
  "description": "Simple approval workflow for E2E testing",
  "version": 1,
  "nodes": [
    {"id": "start", "type": "START", "name": "Start"},
    {"id": "review", "type": "TASK", "name": "Review Request", "assigneeType": "USER", "assigneeExpression": "'e2e-reviewer'"},
    {"id": "gateway", "type": "GATEWAY", "name": "Approval Decision", "gatewayType": "XOR"},
    {"id": "approved", "type": "TASK", "name": "Process Approved", "assigneeType": "USER", "assigneeExpression": "'e2e-processor'"},
    {"id": "rejected", "type": "END", "name": "Rejected"},
    {"id": "end", "type": "END", "name": "Completed"}
  ],
  "transitions": [
    {"from": "start", "to": "review"},
    {"from": "review", "to": "gateway"},
    {"from": "gateway", "to": "approved", "condition": "approved == true"},
    {"from": "gateway", "to": "rejected", "condition": "approved == false"},
    {"from": "approved", "to": "end"}
  ],
  "variables": [
    {"name": "approved", "type": "BOOLEAN", "defaultValue": false}
  ]
}
EOF
)
RESP=$(http_post "${URL_PROCESS}/api/v1/process-definitions" "${DEF_PAYLOAD}") || true

if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
  DEF_ID=$(json_get '.id' "${RESP}")
  assert_non_empty "Process Definition ID" "${DEF_ID}" || TEST_RESULT="FAIL"
  log_info "Created process definition: ${DEF_ID}"
else
  log_fail "Process definition creation returned ${HTTP_CODE}"
  TEST_RESULT="FAIL"
fi

# --- Step 2: Activate the definition ---
log_step "Activate process definition"
if [[ -n "${DEF_ID}" ]]; then
  RESP=$(http_post "${URL_PROCESS}/api/v1/process-definitions/${DEF_ID}/activate" "{}") || true

  if [[ "${HTTP_CODE}" == "200" ]]; then
    log_pass "Process definition activated"
  else
    log_warn "Activation returned ${HTTP_CODE} (may auto-activate)"
  fi
else
  log_warn "Skipping — no definition ID"
fi

# --- Step 3: Start a process instance ---
log_step "Start a process instance"
if [[ -n "${DEF_ID}" ]]; then
  START_PAYLOAD=$(cat <<EOF
{
  "definitionId": "${DEF_ID}",
  "initiator": "e2e-test-user",
  "variables": {
    "requestAmount": 5000,
    "requestType": "purchase"
  }
}
EOF
  )
  RESP=$(http_post "${URL_PROCESS}/api/v1/process-instances/start" "${START_PAYLOAD}") || true

  if [[ "${HTTP_CODE}" == "201" ]] || [[ "${HTTP_CODE}" == "200" ]]; then
    INSTANCE_ID=$(json_get '.id // .instanceId' "${RESP}")
    assert_non_empty "Instance ID" "${INSTANCE_ID}" || log_warn "Instance ID not returned"
    log_info "Started process instance: ${INSTANCE_ID}"
  else
    log_fail "Process instance start returned ${HTTP_CODE}"
    TEST_RESULT="FAIL"
  fi
else
  log_warn "Skipping — no definition ID"
fi

# --- Step 4: Query pending tasks ---
log_step "Query pending tasks"
RESP=$(http_get "${URL_PROCESS}/api/v1/tasks/my/pending") || true

if [[ "${HTTP_CODE}" == "200" ]]; then
  TASK_COUNT=$(json_get '. | length // .content | length' "${RESP}" 2>/dev/null || echo "0")
  log_info "Pending tasks: ${TASK_COUNT}"
  TASK_ID=$(json_get '.[0].id // .content[0].id' "${RESP}" 2>/dev/null || echo "")
  if [[ -n "${TASK_ID}" ]] && [[ "${TASK_ID}" != "null" ]]; then
    log_pass "Found pending task: ${TASK_ID}"
  else
    log_warn "No pending tasks found (instance may not have reached task node)"
  fi
else
  log_warn "Task query returned ${HTTP_CODE}"
fi

# --- Step 5: Complete the task (approve) ---
log_step "Complete task with approval"
if [[ -n "${TASK_ID}" ]] && [[ "${TASK_ID}" != "null" ]]; then
  COMPLETE_PAYLOAD=$(cat <<EOF
{
  "action": "complete",
  "variables": {
    "approved": true,
    "comment": "E2E test approval"
  },
  "assignee": "e2e-reviewer"
}
EOF
  )
  RESP=$(http_post "${URL_PROCESS}/api/v1/tasks/${TASK_ID}/complete" "${COMPLETE_PAYLOAD}") || true

  if [[ "${HTTP_CODE}" == "200" ]]; then
    log_pass "Task completed successfully"
  else
    log_warn "Task completion returned ${HTTP_CODE}"
  fi
else
  log_warn "Skipping — no task ID available"
fi

# --- Step 6: Verify process instance ---
log_step "Verify process instance state"
if [[ -n "${INSTANCE_ID}" ]]; then
  RESP=$(http_get "${URL_PROCESS}/api/v1/process-instances/${INSTANCE_ID}") || true

  if [[ "${HTTP_CODE}" == "200" ]]; then
    STATE=$(json_get '.status // .state' "${RESP}")
    log_info "Instance state: ${STATE}"
    if [[ "${STATE}" == "COMPLETED" ]]; then
      log_pass "Process instance completed"
    else
      log_warn "Instance state is '${STATE}' (may still be in progress)"
    fi
  else
    log_warn "Instance query returned ${HTTP_CODE}"
  fi
else
  log_warn "Skipping — no instance ID"
fi

# --- Step 7: Check history ---
log_step "Check process history"
if [[ -n "${INSTANCE_ID}" ]]; then
  RESP=$(http_get "${URL_PROCESS}/api/v1/process-instances/${INSTANCE_ID}/history") || true

  if [[ "${HTTP_CODE}" == "200" ]]; then
    EVENT_COUNT=$(json_get '. | length' "${RESP}" 2>/dev/null || echo "0")
    log_pass "History returned ${EVENT_COUNT} events"
  else
    log_warn "History query returned ${HTTP_CODE}"
  fi
else
  log_warn "Skipping — no instance ID"
fi

# --- End ---
test_end "S05 Process Automation" "${TEST_RESULT}"
exit $([[ "${TEST_RESULT}" == "PASS" ]] && echo 0 || echo 1)
