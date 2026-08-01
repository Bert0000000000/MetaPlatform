"""Happy-path tests for the wfe endpoints (FR-WFE-001..002).

Tests exercise:
  * POST /flows/test with inline bpmn_xml (valid + invalid)
  * POST /flows/test with flow_id (stored flow)
  * POST /flows/test error cases (400 missing body, 404 unknown flow)
  * GET  /flows/validate paginated list
  * outbox event emission on test runs
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


def test_post_flows_test_valid_inline(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    """POST /flows/test with valid inline BPMN succeeds + emits outbox event."""
    r = client.post(
        "/api/v1/wfe/flows/test",
        json={"bpmn_xml": _VALID_BPMN, "name": "Adhoc Valid Flow"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "success", body
    assert body["run_id"].startswith("run-"), body
    assert body["flow_id"].startswith("adhoc-"), body
    assert body["output"]["valid"] is True, body
    assert body["output"]["issues"] == [], body

    events = [rec.event for rec in outbox.all_records()]
    types = {e.type for e in events}
    assert "wfe.flow.tested" in types, types


def test_post_flows_test_invalid_inline(client, auth_headers_acme) -> None:
    """POST /flows/test with invalid inline BPMN returns failed status."""
    r = client.post(
        "/api/v1/wfe/flows/test",
        json={"bpmn_xml": _INVALID_BPMN},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "failed", body
    assert body["output"]["valid"] is False, body
    # Invalid BPMN should report structural issues.
    assert len(body["output"]["issues"]) > 0, body


def test_post_flows_test_by_flow_id(client, auth_headers_acme) -> None:
    """POST /flows/test with a known flow_id loads the stored BPMN."""
    # flow-approval is seeded as a valid flow.
    r = client.post(
        "/api/v1/wfe/flows/test",
        json={"flow_id": "flow-approval"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["flow_id"] == "flow-approval", body
    assert body["status"] == "success", body

    # flow-leave is seeded with invalid BPMN.
    r2 = client.post(
        "/api/v1/wfe/flows/test",
        json={"flow_id": "flow-leave"},
        headers=auth_headers_acme,
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["status"] == "failed", r2.json()


def test_post_flows_test_400_missing_body(client, auth_headers_acme) -> None:
    """POST /flows/test with neither flow_id nor bpmn_xml -> 400."""
    r = client.post(
        "/api/v1/wfe/flows/test",
        json={},
        headers=auth_headers_acme,
    )
    assert r.status_code == 400, r.text


def test_post_flows_test_404_unknown_flow(client, auth_headers_acme) -> None:
    """POST /flows/test with unknown flow_id -> 404."""
    r = client.post(
        "/api/v1/wfe/flows/test",
        json={"flow_id": "flow-nope"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text


def test_get_flows_validate_paginated(client, auth_headers_acme) -> None:
    """GET /flows/validate returns a paginated validation list (FR-WFE-WFEGETWFEFLOWSVALIDATE)."""
    r = client.get("/api/v1/wfe/flows/validate", headers=auth_headers_acme)
    assert r.status_code == 200, r.text
    body = r.json()
    # Seed: >= 5 validation records per tenant.
    assert body["total"] >= 5, body
    assert all(v["tenant_id"] == "tenant-acme" for v in body["items"])
    assert {"page", "size", "pages"} <= set(body.keys())
    # Each item carries the valid flag + issues list.
    for item in body["items"]:
        assert "valid" in item, item
        assert "issues" in item, item
        assert "flow_id" in item, item

    # Pagination: size=1 returns 1 item.
    r2 = client.get(
        "/api/v1/wfe/flows/validate",
        params={"page": 1, "size": 1},
        headers=auth_headers_acme,
    )
    assert r2.status_code == 200
    assert len(r2.json()["items"]) == 1
    assert r2.json()["pages"] == r2.json()["total"]


def test_post_flows_test_persists_validation(client, auth_headers_acme) -> None:
    """POST /flows/test also appends a validation record visible via GET /flows/validate."""
    # Baseline count.
    r0 = client.get("/api/v1/wfe/flows/validate", headers=auth_headers_acme)
    baseline = r0.json()["total"]

    # Run a test (valid).
    client.post(
        "/api/v1/wfe/flows/test",
        json={"bpmn_xml": _VALID_BPMN},
        headers=auth_headers_acme,
    )

    # Validate count grew.
    r1 = client.get("/api/v1/wfe/flows/validate", headers=auth_headers_acme)
    assert r1.json()["total"] == baseline + 1, r1.json()
