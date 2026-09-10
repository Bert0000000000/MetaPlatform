"""Platform liveness probe tests (GET /healthz)."""

from __future__ import annotations


def test_healthz_is_anonymous_and_ok(client) -> None:
    """GET /healthz needs no bearer token and answers 200 ok."""
    r = client.get("/healthz")
    assert r.status_code == 200, r.text
    assert r.json() == {"status": "ok"}


def test_legacy_health_alias_still_anonymous(client) -> None:
    """The original /api/v1/a2a/health alias stays available for probes."""
    r = client.get("/api/v1/a2a/health")
    assert r.status_code == 200, r.text
    assert r.json() == {"status": "ok"}
