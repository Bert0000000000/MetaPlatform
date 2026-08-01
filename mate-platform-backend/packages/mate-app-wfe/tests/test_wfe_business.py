"""BUSINESS-SLICES deep tests for mate-app-wfe.

Covers the P0 business logic added in the second batch:
  - Flow definition CRUD (POST/GET/PATCH/DELETE /flows)
  - Flow lifecycle state machine (draft -> active -> deprecated)
  - BPMN validation rules (draft -> active requires valid BPMN)
  - Outbox event emission (wfe.flow.created / status_changed / deleted)
  - Cross-tenant isolation (tenant A's flows invisible to tenant B)
"""
from __future__ import annotations

from mate_platform.messaging.outbox import InMemoryOutboxWriter

_VALID_BPMN = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">'
    '<bpmn:process id="proc-1" isExecutable="true">'
    '<bpmn:startEvent id="start-1"/>'
    '<bpmn:endEvent id="end-1"/>'
    '</bpmn:process>'
    '</bpmn:definitions>'
)

_INVALID_BPMN = "<not-bpmn>hello</not-bpmn>"


# ---------------------------------------------------------------------------
# Flow CRUD
# ---------------------------------------------------------------------------
def test_create_flow_valid_bpmn(client, auth_headers_acme) -> None:
    """POST /flows with valid BPMN creates a draft flow + validation record."""
    r = client.post(
        "/api/v1/wfe/flows",
        json={"name": "New Approval", "bpmn_xml": _VALID_BPMN, "version": "1.0"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["flow"]["name"] == "New Approval"
    assert body["flow"]["status"] == "draft"
    assert body["validation"]["valid"] is True
    assert body["validation"]["issues"] == []


def test_create_flow_invalid_bpmn_still_persists(client, auth_headers_acme) -> None:
    """POST /flows with invalid BPMN is still persisted (draft) but issues are returned."""
    r = client.post(
        "/api/v1/wfe/flows",
        json={"name": "Bad Flow", "bpmn_xml": _INVALID_BPMN},
        headers=auth_headers_acme,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["flow"]["status"] == "draft"
    assert body["validation"]["valid"] is False
    assert len(body["validation"]["issues"]) > 0


def test_create_flow_missing_name(client, auth_headers_acme) -> None:
    """POST /flows with empty name -> 422."""
    r = client.post(
        "/api/v1/wfe/flows",
        json={"name": "", "bpmn_xml": _VALID_BPMN},
        headers=auth_headers_acme,
    )
    assert r.status_code == 422, r.text


def test_create_flow_missing_bpmn(client, auth_headers_acme) -> None:
    """POST /flows with empty bpmn_xml -> 422."""
    r = client.post(
        "/api/v1/wfe/flows",
        json={"name": "No BPMN", "bpmn_xml": ""},
        headers=auth_headers_acme,
    )
    assert r.status_code == 422, r.text


def test_create_flow_emits_outbox_event(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    """POST /flows emits a wfe.flow.created outbox event."""
    client.post(
        "/api/v1/wfe/flows",
        json={"name": "Event Flow", "bpmn_xml": _VALID_BPMN},
        headers=auth_headers_acme,
    )
    events = [rec.event for rec in outbox.all_records()]
    types = {e.type for e in events}
    assert "wfe.flow.created" in types, types
    created = [e for e in events if e.type == "wfe.flow.created"][0]
    assert created.tenant_id == "tenant-acme"


def test_list_flows_paginated(client, auth_headers_acme) -> None:
    """GET /flows returns a paginated list of flow definitions."""
    r = client.get("/api/v1/wfe/flows", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 5  # 5 seeded flows
    assert all(f["tenant_id"] == "tenant-acme" for f in body["items"])


def test_get_flow_by_id(client, auth_headers_acme) -> None:
    """GET /flows/{fid} returns the flow definition."""
    r = client.get("/api/v1/wfe/flows/flow-approval", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    assert r.json()["id"] == "flow-approval"
    assert r.json()["status"] == "active"


def test_get_flow_not_found(client, auth_headers_acme) -> None:
    """GET /flows/{fid} with unknown id -> 404."""
    r = client.get("/api/v1/wfe/flows/flow-nope", headers=auth_headers_acme)
    assert r.status_code == 404, r.text


# ---------------------------------------------------------------------------
# Flow lifecycle state machine
# ---------------------------------------------------------------------------
def test_transition_draft_to_active_valid_bpmn(client, auth_headers_acme) -> None:
    """draft -> active succeeds when BPMN is valid (flow-reimbursement is draft+valid)."""
    r = client.patch(
        "/api/v1/wfe/flows/flow-reimbursement/status",
        json={"status": "active"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "active"


def test_transition_draft_to_active_invalid_bpmn(client, auth_headers_acme) -> None:
    """draft -> active rejected (422) when BPMN is invalid (flow-leave is draft+invalid)."""
    r = client.patch(
        "/api/v1/wfe/flows/flow-leave/status",
        json={"status": "active"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 422, r.text
    assert "BPMN invalid" in r.json()["detail"]


def test_transition_active_to_deprecated(client, auth_headers_acme) -> None:
    """active -> deprecated succeeds (flow-approval is active)."""
    r = client.patch(
        "/api/v1/wfe/flows/flow-approval/status",
        json={"status": "deprecated"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "deprecated"


def test_transition_active_to_draft(client, auth_headers_acme) -> None:
    """active -> draft succeeds (flow-onboarding is active)."""
    r = client.patch(
        "/api/v1/wfe/flows/flow-onboarding/status",
        json={"status": "draft"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "draft"


def test_transition_deprecated_is_terminal(client, auth_headers_acme) -> None:
    """deprecated is terminal — any transition is rejected (409)."""
    # First deprecate flow-procurement (active -> deprecated).
    client.patch(
        "/api/v1/wfe/flows/flow-procurement/status",
        json={"status": "deprecated"},
        headers=auth_headers_acme,
    )
    # Now try to go back to active.
    r = client.patch(
        "/api/v1/wfe/flows/flow-procurement/status",
        json={"status": "active"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 409, r.text


def test_transition_invalid_path(client, auth_headers_acme) -> None:
    """draft -> deprecated is not a valid transition (409)."""
    r = client.patch(
        "/api/v1/wfe/flows/flow-reimbursement/status",
        json={"status": "deprecated"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 409, r.text
    assert "invalid transition" in r.json()["detail"]


def test_transition_unknown_flow(client, auth_headers_acme) -> None:
    """PATCH /flows/{fid}/status with unknown flow -> 404."""
    r = client.patch(
        "/api/v1/wfe/flows/flow-nope/status",
        json={"status": "active"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text


def test_transition_emits_outbox_event(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    """PATCH /flows/{fid}/status emits wfe.flow.status_changed."""
    client.patch(
        "/api/v1/wfe/flows/flow-reimbursement/status",
        json={"status": "active"},
        headers=auth_headers_acme,
    )
    events = [rec.event for rec in outbox.all_records()]
    changed = [e for e in events if e.type == "wfe.flow.status_changed"]
    assert len(changed) >= 1
    assert changed[0].payload["from"] == "draft"
    assert changed[0].payload["to"] == "active"


# ---------------------------------------------------------------------------
# Flow deletion
# ---------------------------------------------------------------------------
def test_delete_draft_flow_succeeds(client, auth_headers_acme) -> None:
    """DELETE /flows/{fid} succeeds for a draft flow."""
    r = client.delete(
        "/api/v1/wfe/flows/flow-reimbursement", headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    assert r.json()["deleted"] == "flow-reimbursement"


def test_delete_active_flow_rejected(client, auth_headers_acme) -> None:
    """DELETE /flows/{fid} rejected (409) for an active flow."""
    r = client.delete(
        "/api/v1/wfe/flows/flow-approval", headers=auth_headers_acme,
    )
    assert r.status_code == 409, r.text
    assert "active" in r.json()["detail"]


def test_delete_flow_not_found(client, auth_headers_acme) -> None:
    """DELETE /flows/{fid} with unknown id -> 404."""
    r = client.delete(
        "/api/v1/wfe/flows/flow-nope", headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text


def test_delete_emits_outbox_event(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    """DELETE /flows/{fid} emits wfe.flow.deleted."""
    client.delete(
        "/api/v1/wfe/flows/flow-reimbursement", headers=auth_headers_acme,
    )
    events = [rec.event for rec in outbox.all_records()]
    deleted = [e for e in events if e.type == "wfe.flow.deleted"]
    assert len(deleted) >= 1


# ---------------------------------------------------------------------------
# Cross-tenant isolation
# ---------------------------------------------------------------------------
def test_flow_tenant_isolation(client, auth_headers_acme, auth_headers_globex) -> None:
    """Tenant A's flows are invisible to tenant B."""
    # Tenant acme creates a flow.
    r_acme = client.post(
        "/api/v1/wfe/flows",
        json={"name": "Acme Private", "bpmn_xml": _VALID_BPMN},
        headers=auth_headers_acme,
    )
    assert r_acme.status_code == 201
    acme_fid = r_acme.json()["flow"]["id"]

    # Tenant globex cannot see it.
    r_globex = client.get(
        f"/api/v1/wfe/flows/{acme_fid}", headers=auth_headers_globex,
    )
    assert r_globex.status_code == 404


def test_transition_tenant_isolation(
    client, auth_headers_acme, auth_headers_globex,
) -> None:
    """Tenant B cannot transition tenant A's flow."""
    r_acme = client.post(
        "/api/v1/wfe/flows",
        json={"name": "Acme Only", "bpmn_xml": _VALID_BPMN},
        headers=auth_headers_acme,
    )
    fid = r_acme.json()["flow"]["id"]

    r_globex = client.patch(
        f"/api/v1/wfe/flows/{fid}/status",
        json={"status": "active"},
        headers=auth_headers_globex,
    )
    assert r_globex.status_code == 404


def test_delete_tenant_isolation(
    client, auth_headers_acme, auth_headers_globex,
) -> None:
    """Tenant B cannot delete tenant A's flow."""
    r_acme = client.post(
        "/api/v1/wfe/flows",
        json={"name": "Acme Protected", "bpmn_xml": _VALID_BPMN},
        headers=auth_headers_acme,
    )
    fid = r_acme.json()["flow"]["id"]

    r_globex = client.delete(
        f"/api/v1/wfe/flows/{fid}", headers=auth_headers_globex,
    )
    assert r_globex.status_code == 404

    # Acme can still see it.
    r_acme_check = client.get(
        f"/api/v1/wfe/flows/{fid}", headers=auth_headers_acme,
    )
    assert r_acme_check.status_code == 200
