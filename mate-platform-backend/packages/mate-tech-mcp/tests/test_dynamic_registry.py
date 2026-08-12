"""W2 tests: dynamic tool registry on mate-tech-mcp.

Covers runtime registration / update / delete of MCP tools with a
forwarding endpoint, the local → dynamic → federation → 404 execution
chain, tenant isolation, and outbox events.
"""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mate_platform.messaging.outbox import InMemoryOutboxWriter

from mate_tech_mcp.repositories import reset_store


@pytest.fixture
def client() -> TestClient:
    """Bare app with the origin router + a fresh MCPServer.

    Deliberately does NOT re-import ``mate_tech_mcp.main`` (module
    eviction would invalidate other test modules' top-of-module imports
    in the same session) — a fresh ``create_server()`` is bound instead.
    """
    from mate_tech_mcp.api.origin_routes import router as origin_router
    from mate_tech_mcp.server import create_server

    app = FastAPI(title="mate-tech-mcp-dynamic-test")
    app.state.mcp_server = create_server("test-dynamic-server")
    app.state.rate_limiter = AsyncMock()
    app.state.outbox_writer = InMemoryOutboxWriter()
    app.include_router(origin_router)
    reset_store()
    yield TestClient(app)
    reset_store()


def _bearer(tenant: str = "tenant-acme") -> dict[str, str]:
    from mate_tech_mcp.auth import make_test_token

    return {"Authorization": f"Bearer {make_test_token(tenant_id=tenant)}"}


def _register(client: TestClient, *, name="hr_tool", endpoint="http://hr-worker:9000", tenant="tenant-acme"):
    return client.post(
        "/api/v1/mcp/tools",
        json={"name": name, "description": "HR capability", "endpoint": endpoint},
        headers=_bearer(tenant),
    )


def test_register_tool_appears_in_list(client: TestClient) -> None:
    r = _register(client)
    assert r.status_code == 201, r.text
    assert r.json()["endpoint"] == "http://hr-worker:9000"

    lst = client.get("/api/v1/mcp/tools", headers=_bearer())
    assert lst.status_code == 200
    names = {t["name"] for t in lst.json()["tools"]}
    assert "hr_tool" in names


def test_register_tool_then_invoke_forwards(client: TestClient) -> None:
    _register(client, name="hr_tool", endpoint="http://hr-worker:9000")

    class FakeInvoker:
        def __init__(self):
            self.calls = []

        async def invoke(self, *, tenant_id, name, endpoint, arguments):
            self.calls.append((tenant_id, name, endpoint, arguments))
            return {"ok": True, "answer": 42}

    invoker = FakeInvoker()
    client.app.state.dynamic_invoker = invoker  # type: ignore[attr-defined]
    r = client.post(
        "/api/v1/mcp/tools/hr_tool",
        json={"arguments": {"q": "hire"}},
        headers=_bearer(),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["source"] == "dynamic"
    assert body["result"] == {"ok": True, "answer": 42}
    assert invoker.calls[0][0] == "tenant-acme"
    assert invoker.calls[0][1] == "hr_tool"
    assert invoker.calls[0][2] == "http://hr-worker:9000"


def test_update_and_delete_tool(client: TestClient) -> None:
    _register(client, name="hr_tool")

    upd = client.put(
        "/api/v1/mcp/tools/hr_tool",
        json={"endpoint": "http://new-worker:9000", "enabled": False},
        headers=_bearer(),
    )
    assert upd.status_code == 200, upd.text
    assert upd.json()["endpoint"] == "http://new-worker:9000"
    assert upd.json()["enabled"] is False

    # Disabled dynamic tool → not listed, not invoked.
    lst = client.get("/api/v1/mcp/tools", headers=_bearer())
    assert "hr_tool" not in {t["name"] for t in lst.json()["tools"]}

    # Re-enable and delete.
    client.put("/api/v1/mcp/tools/hr_tool", json={"enabled": True}, headers=_bearer())
    d = client.delete("/api/v1/mcp/tools/hr_tool", headers=_bearer())
    assert d.status_code == 200, d.text
    assert d.json()["deleted"] == "hr_tool"

    r = client.post("/api/v1/mcp/tools/hr_tool", json={"arguments": {}}, headers=_bearer())
    assert r.status_code == 404, r.text


def test_unknown_tool_404(client: TestClient) -> None:
    r = client.post("/api/v1/mcp/tools/nope", json={"arguments": {}}, headers=_bearer())
    assert r.status_code == 404, r.text


def test_tenant_isolation(client: TestClient) -> None:
    _register(client, name="acme_only_tool", tenant="tenant-acme")
    lst = client.get("/api/v1/mcp/tools", headers=_bearer("tenant-globex"))
    assert "acme_only_tool" not in {t["name"] for t in lst.json()["tools"]}


def test_register_emits_outbox_event(client: TestClient, monkeypatch) -> None:
    # Bind a real outbox writer so the emitted event is observable.
    writer = InMemoryOutboxWriter()
    client.app.state.outbox_writer = writer  # type: ignore[attr-defined]
    _register(client, name="audit_tool")
    types = {rec.event.type for rec in writer.all_records()}
    assert "mcp.tool.registered" in types
