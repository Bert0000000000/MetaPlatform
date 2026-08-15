"""A2A `POST /api/v1/a2a/execute` tests (sync execution path).

The SuperAI agent loop relies on the orchestrator A2AWorker calling
``/execute`` so a dispatch returns a real outcome (``completed`` with a
result payload) instead of a dangling ``submitted`` task. These tests
verify the endpoint runs an internal agent inline and exposes the result
through the task read surface.
"""
from __future__ import annotations

from fastapi.testclient import TestClient


def _execute_payload(message: str = "Reconcile Q3 ledger") -> dict:
    return {
        "messageId": "msg-exec-001",
        "role": "user",
        "parts": [
            {"kind": "text", "text": message},
            {"kind": "data", "data": {"target_agent_id": "agent-recon"}},
        ],
        "contextId": "ctx-exec-001",
    }


def test_execute_runs_internal_agent_synchronously(
    client: TestClient, auth_headers_acme: dict[str, str],
) -> None:
    """An internal agent executes inline → completed with a result payload."""
    r = client.post(
        "/api/v1/a2a/execute", json=_execute_payload(), headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "completed"
    assert body["task_id"]
    assert body["target_agent_id"] == "agent-recon"
    # The internal-agent stub result carries the task context.
    assert isinstance(body.get("result"), dict)
    assert body["result"].get("message") == "Reconcile Q3 ledger"

    # The task is persisted and now exposes its result via GET /tasks/{id}.
    task = client.get(
        f"/api/v1/a2a/tasks/{body['task_id']}", headers=auth_headers_acme,
    )
    assert task.status_code == 200
    t = task.json()
    assert t["status"]["state"] == "completed"
    assert t["artifacts"], "execute must surface the result as a data artifact"
    result_part = t["artifacts"][0]["parts"][0]
    assert result_part["kind"] == "data"
    assert result_part["data"]["result"]["message"] == "Reconcile Q3 ledger"


def test_execute_unknown_agent_404(
    client: TestClient, auth_headers_acme: dict[str, str],
) -> None:
    """An unregistered target agent → 404 (E_AGENT_NOT_FOUND)."""
    payload = _execute_payload()
    payload["parts"][1]["data"]["target_agent_id"] = "ghost-agent"
    r = client.post(
        "/api/v1/a2a/execute", json=payload, headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text
    assert "ghost-agent" in r.text


def test_execute_requires_tenant(
    client: TestClient,
) -> None:
    """Without a tenant-scoped token the tenant guard rejects the call."""
    r = client.post("/api/v1/a2a/execute", json=_execute_payload())
    assert r.status_code in (401, 403), r.text
