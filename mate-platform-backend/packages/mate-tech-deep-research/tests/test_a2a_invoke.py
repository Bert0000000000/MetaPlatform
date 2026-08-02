"""A2A invoke endpoint tests for /api/v1/a2a/agent/deep-research/invoke.

Covers: happy path, missing capability_id, 503 mapping on unavailable,
outbox event write, and the response shape contract.
"""
from __future__ import annotations

from mate_platform.messaging.outbox import InMemoryOutboxWriter


def _body(query: str = "What is RAG?", capability: str = "web-research") -> dict:
    return {
        "capability_id": capability,
        "input": {
            "query": query,
            "depth": "deep",
            "max_sources": 5,
            "output_format": "markdown",
        },
    }


def test_invoke_happy_path(client, auth_headers_acme) -> None:
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json=_body(),
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["capability_id"] == "web-research"
    assert isinstance(body["report"], str) and body["report"]
    assert isinstance(body["sources"], list) and len(body["sources"]) >= 1
    assert body["duration_ms"] == 1234
    # Each source should carry the documented fields.
    s = body["sources"][0]
    for key in ("url", "title", "snippet", "reliability", "fetched_at"):
        assert key in s, s


def test_invoke_missing_capability_id(client, auth_headers_acme) -> None:
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json={"input": {"query": "x"}},
        headers=auth_headers_acme,
    )
    assert r.status_code == 400, r.text
    body = r.json()
    assert body["detail"]["code"] == "E_MISSING_CAPABILITY"


def test_invoke_503_when_deerflow_unavailable(
    client, auth_headers_acme, stub_client,
) -> None:
    stub_client.raise_unavailable = True
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json=_body(),
        headers=auth_headers_acme,
    )
    assert r.status_code == 503, r.text
    assert r.json()["detail"]["code"] == "E_DEERFLOW_UNAVAILABLE"


def test_invoke_writes_outbox_event(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json=_body(query="outbox check"),
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    events = [rec.event for rec in outbox.all_records()]
    assert len(events) == 1
    evt = events[0]
    assert evt.type == "deep.research.completed"
    assert evt.tenant_id == "tenant-acme"
    assert evt.payload["query"] == "outbox check"
    assert evt.payload["sources_count"] == 1


def test_invoke_response_includes_capability_id(client, auth_headers_acme) -> None:
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json=_body(),
        headers=auth_headers_acme,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["capability_id"] == "web-research"


def test_invoke_propagates_depth_and_max_sources_to_client(
    client, auth_headers_acme, stub_client,
) -> None:
    body = _body()
    body["input"]["depth"] = "shallow"
    body["input"]["max_sources"] = 2
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json=body,
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    assert stub_client.calls, "research() should have been called"
    sent = stub_client.calls[-1]
    assert sent.depth == "shallow"
    assert sent.max_sources == 2
