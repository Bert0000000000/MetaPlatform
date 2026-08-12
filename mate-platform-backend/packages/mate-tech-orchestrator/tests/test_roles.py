"""W3 tests: digital-employee role registry CRUD + tenant isolation."""
from __future__ import annotations

from fastapi.testclient import TestClient

from mate_platform.messaging.outbox import InMemoryOutboxWriter


def _payload(role: str = "knowledge") -> dict:
    return {
        "role": role,
        "name": "知识库员工",
        "capabilities": [
            {"name": "kb_search", "worker_kind": "mcp", "ref": "kb_search"},
            {"name": "summarize", "worker_kind": "local", "ref": ""},
        ],
    }


def test_register_role(client: TestClient, auth_headers_acme) -> None:
    r = client.post("/api/v1/orchestrator/roles", json=_payload(), headers=auth_headers_acme)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["role"] == "knowledge"
    assert body["capabilities"][0] == {
        "name": "kb_search", "worker_kind": "mcp", "ref": "kb_search",
    }

    lst = client.get("/api/v1/orchestrator/roles", headers=auth_headers_acme)
    assert lst.status_code == 200
    assert lst.json()["total"] == 1
    assert lst.json()["items"][0]["role"] == "knowledge"


def test_register_unknown_role_422(client: TestClient, auth_headers_acme) -> None:
    r = client.post(
        "/api/v1/orchestrator/roles",
        json={"role": "quantum", "capabilities": []},
        headers=auth_headers_acme,
    )
    assert r.status_code == 422, r.text
    assert "quantum" in r.json()["detail"]


def test_register_unknown_worker_kind_422(client: TestClient, auth_headers_acme) -> None:
    r = client.post(
        "/api/v1/orchestrator/roles",
        json={"role": "knowledge", "capabilities": [{"name": "x", "worker_kind": "k8s", "ref": ""}]},
        headers=auth_headers_acme,
    )
    assert r.status_code == 422, r.text


def test_unregister_role(client: TestClient, auth_headers_acme) -> None:
    client.post("/api/v1/orchestrator/roles", json=_payload(), headers=auth_headers_acme)
    d = client.delete("/api/v1/orchestrator/roles/knowledge", headers=auth_headers_acme)
    assert d.status_code == 200, d.text
    d2 = client.delete("/api/v1/orchestrator/roles/knowledge", headers=auth_headers_acme)
    assert d2.status_code == 404


def test_tenant_isolation(client: TestClient, auth_headers_acme, auth_headers_globex) -> None:
    client.post("/api/v1/orchestrator/roles", json=_payload(), headers=auth_headers_acme)
    lst = client.get("/api/v1/orchestrator/roles", headers=auth_headers_globex)
    assert lst.json()["total"] == 0


def test_register_emits_outbox_event(client: TestClient, auth_headers_acme, outbox: InMemoryOutboxWriter) -> None:
    client.post("/api/v1/orchestrator/roles", json=_payload(), headers=auth_headers_acme)
    types = {rec.event.type for rec in outbox.all_records()}
    assert "orchestrator.role.registered" in types
