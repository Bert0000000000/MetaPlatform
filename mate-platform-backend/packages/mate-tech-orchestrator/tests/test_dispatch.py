"""W3 tests: multi-role task dispatch to MCP / A2A workers (mocked)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from mate_tech_orchestrator.scheduler.dispatcher import Dispatcher, set_dispatcher
from mate_tech_orchestrator.scheduler.role_registry import (
    CapabilityBinding,
    get_role_registry,
)

from mate_platform.messaging.outbox import InMemoryOutboxWriter


class FakeMcpWorker:
    def __init__(self) -> None:
        self.calls: list[tuple] = []

    async def invoke(self, *, tenant_id, ref, arguments):
        self.calls.append((tenant_id, ref, arguments))
        return {"source": "mcp", "tool": ref, "answer": 42}


class FakeA2AWorker:
    def __init__(self) -> None:
        self.calls: list[tuple] = []

    async def invoke(self, *, tenant_id, ref, arguments):
        self.calls.append((tenant_id, ref, arguments))
        return {"task_id": "task-a2a-1", "status": {"state": "submitted"}}


@pytest.fixture
def mocked_dispatcher(client: TestClient):
    """A dispatcher with fake MCP/A2A workers bound for the test."""
    mcp = FakeMcpWorker()
    a2a = FakeA2AWorker()
    dispatcher = Dispatcher(get_role_registry(), mcp_worker=mcp, a2a_worker=a2a)
    set_dispatcher(dispatcher)
    get_role_registry().register(
        tenant_id="tenant-acme",
        role="knowledge",
        capabilities=[
            CapabilityBinding(name="kb_search", worker_kind="mcp", ref="kb_search"),
            CapabilityBinding(name="translate", worker_kind="a2a", ref="ext-translator"),
        ],
    )
    yield mcp, a2a
    set_dispatcher(None)
    get_role_registry().reset()


def test_dispatch_by_capability_to_mcp(
    client: TestClient, auth_headers_acme, mocked_dispatcher,
) -> None:
    mcp, a2a = mocked_dispatcher
    r = client.post(
        "/api/v1/orchestrator/dispatch",
        json={"capability": "kb_search", "action": "", "arguments": {"query": "ledger"}},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["role"] == "knowledge"
    assert body["worker_kind"] == "mcp"
    assert body["result"]["answer"] == 42
    assert mcp.calls == [("tenant-acme", "kb_search", {"query": "ledger"})]
    assert a2a.calls == []


def test_dispatch_by_rid_to_a2a(
    client: TestClient, auth_headers_acme, mocked_dispatcher,
) -> None:
    _, a2a = mocked_dispatcher
    r = client.post(
        "/api/v1/orchestrator/dispatch",
        json={
            "target_rid": "kb.tenant-acme.class.mydoc.v1",
            "action": "translate",
            "arguments": {"message": "hello"},
        },
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["role"] == "knowledge"
    assert body["worker_kind"] == "a2a"
    assert body["result"]["task_id"] == "task-a2a-1"
    assert a2a.calls[0][0] == "tenant-acme"
    assert a2a.calls[0][1] == "ext-translator"


def test_dispatch_unknown_capability_404(
    client: TestClient, auth_headers_acme, mocked_dispatcher,
) -> None:
    r = client.post(
        "/api/v1/orchestrator/dispatch",
        json={"capability": "no_such_cap", "arguments": {}},
        headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text


def test_dispatch_unregistered_role_404(
    client: TestClient, auth_headers_acme, mocked_dispatcher,
) -> None:
    r = client.post(
        "/api/v1/orchestrator/dispatch",
        json={"target_rid": "wfe.tenant-acme.flow.v1", "action": "", "arguments": {}},
        headers=auth_headers_acme,
    )
    assert r.status_code == 404, r.text


def test_dispatch_emits_outbox_event(
    client: TestClient, auth_headers_acme, mocked_dispatcher, outbox: InMemoryOutboxWriter,
) -> None:
    r = client.post(
        "/api/v1/orchestrator/dispatch",
        json={"capability": "kb_search", "arguments": {"query": "x"}},
        headers=auth_headers_acme,
    )
    assert r.status_code == 200
    types = {rec.event.type for rec in outbox.all_records()}
    assert "orchestrator.dispatch.completed" in types
