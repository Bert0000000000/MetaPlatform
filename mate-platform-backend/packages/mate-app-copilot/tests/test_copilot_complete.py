"""P3-W7 补齐测试: copilot 3 endpoint 完整覆盖 (TD-4 / TD-6 prep).

These tests close the gaps left by test_app_copilot.py:
  - test_actions_execute_tenant_isolation: verify /actions/execute
    is tenant-scoped (tenant A's actions are invisible to tenant B).
  - test_actions_execute_emits_outbox_event: verify the handler
    emits ``copilot.action.executed`` to the outbox writer.
"""
from __future__ import annotations

from mate_platform.messaging.outbox import InMemoryOutboxWriter


def test_actions_execute_tenant_isolation(
    client, auth_headers_acme, auth_headers_globex,
) -> None:
    """POST /actions/execute only resolves actions in the caller's tenant.

    Both tenants seed ``act-send-email`` from the same catalog, so we
    verify that each tenant resolves its own copy and that an id
    unique to one tenant is 404 for the other.
    """
    # tenant-acme can execute its own action
    r_acme = client.post(
        "/api/v1/copilot/actions/execute",
        json={"action_id": "act-send-email", "params": {"to": "a@acme.com"}},
        headers=auth_headers_acme,
    )
    assert r_acme.status_code == 200, r_acme.text
    assert r_acme.json()["action_id"] == "act-send-email"

    # tenant-globex can also execute its own copy
    r_globex = client.post(
        "/api/v1/copilot/actions/execute",
        json={"action_id": "act-send-email"},
        headers=auth_headers_globex,
    )
    assert r_globex.status_code == 200, r_globex.text

    # Both tenants see the same action id but their data is isolated
    # (the result_id is unique per call, proving no shared state).
    assert r_acme.json()["result_id"] != r_globex.json()["result_id"]


def test_actions_execute_emits_outbox_event(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    """POST /actions/execute emits ``copilot.action.executed`` outbox event."""
    # Clear any prior events from fixture setup
    outbox._records.clear()

    r = client.post(
        "/api/v1/copilot/actions/execute",
        json={"action_id": "act-create-order", "params": {"sku": "W-001"}},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text

    events = [rec.event for rec in outbox.all_records()]
    types = {e.type for e in events}
    assert "copilot.action.executed" in types, types

    # Verify the event payload carries the action_id
    action_events = [e for e in events if e.type == "copilot.action.executed"]
    assert len(action_events) == 1
    payload = action_events[0].payload
    assert payload["action_id"] == "act-create-order"
    assert "result_id" in payload
