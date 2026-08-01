"""Flowable BPMN deploy integration tests for mate-app-wfe (P3-W8).

Covers:
  * FlowableClient env initialization + in-memory fallback
  * POST /flows/deploy happy path (degrades to in-memory without engine)
  * wfe.flow.deployed outbox event emission
  * cross-tenant isolation for deployments
"""
from __future__ import annotations

import asyncio

import httpx
import pytest
import respx

from mate_app_wfe.clients import FlowableClient
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


@pytest.fixture(autouse=True)
def _clear_flowable_env(monkeypatch):
    """Ensure no FLOWABLE_BASE_URL leaks across tests."""
    monkeypatch.delenv("FLOWABLE_BASE_URL", raising=False)


# ---------------------------------------------------------------------------
# FlowableClient unit tests
# ---------------------------------------------------------------------------
def test_flowable_client_initializes_from_env(monkeypatch) -> None:
    """FlowableClient reads FLOWABLE_BASE_URL from the environment."""
    monkeypatch.setenv("FLOWABLE_BASE_URL", "http://flowable:8080")
    c = FlowableClient()
    assert c.base_url == "http://flowable:8080"
    assert c.mode == "flowable"


def test_flowable_client_fallback_to_inmemory() -> None:
    """Without a base_url the client runs in-memory; an unreachable engine
    gracefully degrades to an in-memory fallback deployment."""
    # 1. No base_url -> in-memory mode, no network.
    c = FlowableClient(base_url="")
    assert c.mode == "in-memory"
    res = asyncio.run(c.deploy("My Flow", _VALID_BPMN))
    assert res["engine"] == "in-memory"
    assert res["status"] == "deployed"
    assert res["deployment_id"].startswith("inmem-")

    # 2. base_url set but engine unreachable -> fallback to in-memory.
    c2 = FlowableClient(base_url="http://flowable.local:8080")
    assert c2.mode == "flowable"
    with respx.mock:
        respx.post(
            "http://flowable.local:8080/process-engine/repository/deployments"
        ).mock(side_effect=httpx.ConnectError("no route to host"))
        res2 = asyncio.run(c2.deploy("My Flow", _VALID_BPMN))
    assert res2["engine"] == "in-memory"
    assert res2["status"] == "fallback"


# ---------------------------------------------------------------------------
# POST /flows/deploy endpoint
# ---------------------------------------------------------------------------
def test_deploy_flow_happy_path(client, auth_headers_acme) -> None:
    """POST /flows/deploy deploys inline BPMN (in-memory engine)."""
    r = client.post(
        "/api/v1/wfe/flows/deploy",
        json={"name": "Deploy Test", "bpmn_xml": _VALID_BPMN},
        headers=auth_headers_acme,
    )
    assert r.status_code == 201, r.text
    dep = r.json()["deployment"]
    assert dep["engine"] == "in-memory"
    assert dep["status"] == "deployed"
    assert dep["tenant_id"] == "tenant-acme"
    assert dep["name"] == "Deploy Test"
    assert dep["deployment_id"].startswith("inmem-")


def test_deploy_flow_emits_outbox(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    """POST /flows/deploy emits a wfe.flow.deployed outbox event."""
    client.post(
        "/api/v1/wfe/flows/deploy",
        json={"name": "Event Deploy", "bpmn_xml": _VALID_BPMN},
        headers=auth_headers_acme,
    )
    events = [rec.event for rec in outbox.all_records()]
    deployed = [e for e in events if e.type == "wfe.flow.deployed"]
    assert len(deployed) == 1, [e.type for e in events]
    assert deployed[0].tenant_id == "tenant-acme"
    assert deployed[0].payload["engine"] == "in-memory"
    assert deployed[0].payload["status"] == "deployed"


def test_deploy_flow_tenant_isolation(
    client, auth_headers_acme, auth_headers_globex, outbox: InMemoryOutboxWriter,
) -> None:
    """Deployments are tenant-scoped: each tenant's records + events are isolated."""
    client.post(
        "/api/v1/wfe/flows/deploy",
        json={"name": "Acme Deploy", "bpmn_xml": _VALID_BPMN},
        headers=auth_headers_acme,
    )
    client.post(
        "/api/v1/wfe/flows/deploy",
        json={"name": "Globex Deploy", "bpmn_xml": _VALID_BPMN},
        headers=auth_headers_globex,
    )
    events = [rec.event for rec in outbox.all_records()]
    deployed = [e for e in events if e.type == "wfe.flow.deployed"]
    assert len(deployed) == 2
    assert {e.tenant_id for e in deployed} == {"tenant-acme", "tenant-globex"}

    # Per-tenant store isolation.
    from mate_app_wfe.repositories import in_memory as repo

    acme_deps = repo.list_deployments("tenant-acme")
    globex_deps = repo.list_deployments("tenant-globex")
    assert all(d.tenant_id == "tenant-acme" for d in acme_deps)
    assert all(d.tenant_id == "tenant-globex" for d in globex_deps)
    assert len(acme_deps) >= 1
    assert len(globex_deps) >= 1
