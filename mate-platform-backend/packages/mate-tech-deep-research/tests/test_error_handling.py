"""Error-handling tests for the invoke endpoint.

Covers the documented error codes:
  * E_UNKNOWN_CAPABILITY  — capability_id not in the supported set.
  * E_EMPTY_QUERY         — input.query missing or whitespace.
  * E_MISSING_CAPABILITY  — capability_id absent entirely.
  * E_DEERFLOW_UNAVAILABLE — engine down → 503.
  * Malformed input payload (input not a dict).
"""
from __future__ import annotations


def test_unknown_capability_returns_400(client, auth_headers_acme) -> None:
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json={"capability_id": "magic", "input": {"query": "x"}},
        headers=auth_headers_acme,
    )
    assert r.status_code == 400, r.text
    body = r.json()
    assert body["detail"]["code"] == "E_UNKNOWN_CAPABILITY"
    assert "magic" in body["detail"]["message"]


def test_empty_query_returns_400(client, auth_headers_acme) -> None:
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json={"capability_id": "web-research", "input": {"query": "   "}},
        headers=auth_headers_acme,
    )
    assert r.status_code == 400, r.text
    assert r.json()["detail"]["code"] == "E_EMPTY_QUERY"


def test_missing_query_returns_400(client, auth_headers_acme) -> None:
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json={"capability_id": "web-research", "input": {}},
        headers=auth_headers_acme,
    )
    assert r.status_code == 400, r.text
    assert r.json()["detail"]["code"] == "E_EMPTY_QUERY"


def test_missing_capability_returns_400(client, auth_headers_acme) -> None:
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json={"input": {"query": "x"}},
        headers=auth_headers_acme,
    )
    assert r.status_code == 400, r.text
    assert r.json()["detail"]["code"] == "E_MISSING_CAPABILITY"


def test_deerflow_unavailable_returns_503(
    client, auth_headers_acme, stub_client,
) -> None:
    stub_client.raise_unavailable = True
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json={"capability_id": "web-research", "input": {"query": "x"}},
        headers=auth_headers_acme,
    )
    assert r.status_code == 503, r.text
    detail = r.json()["detail"]
    assert detail["code"] == "E_DEERFLOW_UNAVAILABLE"
    assert "unavailable" in detail["message"].lower()


def test_malformed_input_field_treated_as_empty_query(
    client, auth_headers_acme,
) -> None:
    """input is a string instead of an object → treated as empty query."""
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json={"capability_id": "web-research", "input": "not an object"},
        headers=auth_headers_acme,
    )
    assert r.status_code == 400, r.text
    assert r.json()["detail"]["code"] == "E_EMPTY_QUERY"


def test_no_outbox_event_on_error(
    client, auth_headers_acme, outbox,
) -> None:
    """When the handler errors out (400), no event is written."""
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json={"capability_id": "web-research", "input": {"query": ""}},
        headers=auth_headers_acme,
    )
    assert r.status_code == 400, r.text
    assert outbox.all_records() == []
