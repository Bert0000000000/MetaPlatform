"""W3C A2A `/messages` envelope tests (GOVERN-12-03).

Covers the new canonical `POST /api/v1/a2a/messages` endpoint and the
deprecation signalling on the legacy `POST /api/v1/a2a/delegate`.
"""
from __future__ import annotations

from fastapi.testclient import TestClient


def test_messages_envelope_accepts_w3c_schema(
    client: TestClient, auth_headers_acme: dict[str, str],
) -> None:
    """A well-formed W3C message returns a W3C Task object."""
    payload = {
        "messageId": "msg-001",
        "role": "user",
        "parts": [
            {"kind": "text", "text": "Reconcile the Q3 ledger"},
            {"kind": "data", "data": {"target_agent_id": "agent-recon"}},
        ],
        "contextId": "ctx-001",
    }
    r = client.post(
        "/api/v1/a2a/messages", json=payload, headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()

    assert body["id"]
    assert body["contextId"] == "ctx-001"
    assert body["status"] == {"state": "submitted"}
    assert body["artifacts"] == []
    assert len(body["history"]) == 1
    assert body["history"][0]["messageId"] == "msg-001"

    # The task is persisted and readable through the existing task API,
    # now aligned to the canonical W3C A2A Task shape (W1 contract-drift fix).
    task = client.get(
        f"/api/v1/a2a/tasks/{body['id']}", headers=auth_headers_acme,
    )
    assert task.status_code == 200
    t = task.json()
    assert t["id"] == body["id"]
    assert t["contextId"] == "ctx-001"
    assert t["status"]["state"] == "submitted"
    assert t["status"]["message"] == "Reconcile the Q3 ledger"
    assert t["artifacts"] == []


def test_messages_missing_messageId_422(
    client: TestClient, auth_headers_acme: dict[str, str],
) -> None:
    """A message without `messageId` is rejected by schema validation."""
    payload = {"role": "user", "parts": [{"kind": "text", "text": "hi"}]}
    r = client.post(
        "/api/v1/a2a/messages", json=payload, headers=auth_headers_acme,
    )
    assert r.status_code == 422, r.text


def test_delegate_deprecation_header_present(
    client: TestClient, auth_headers_acme: dict[str, str],
) -> None:
    """The legacy `/delegate` endpoint advertises its sunset."""
    r = client.post(
        "/api/v1/a2a/delegate",
        json={"target_agent_id": "agent-recon", "message": "hi"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    assert r.headers["Deprecation"] == "true"
    assert r.headers["X-Sunset"] == "2026-12-31"
