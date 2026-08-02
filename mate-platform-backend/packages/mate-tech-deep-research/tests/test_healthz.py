"""Healthz endpoint tests."""
from __future__ import annotations


def test_healthz_returns_200_without_auth(client) -> None:
    # No Authorization header — /healthz is in the DEFAULT anonymous set.
    r = client.get("/healthz")
    assert r.status_code == 200, r.text


def test_healthz_payload_has_status_ok(client) -> None:
    r = client.get("/healthz")
    assert r.status_code == 200
    body = r.json()
    assert body == {"status": "ok"}


def test_healthz_anonymous_does_not_require_tenant(client) -> None:
    """Even with no X-Tenant-Id, /healthz is reachable."""
    r = client.get("/healthz", headers={})
    assert r.status_code == 200, r.text
