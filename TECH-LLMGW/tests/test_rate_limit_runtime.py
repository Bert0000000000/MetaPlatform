"""Runtime enforcement of configured rate limits (Phase 2 acceptance)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.ratelimits.schemas import RateLimitScope, RateLimitType


def _create_rule(client: TestClient, headers, *, limit: int) -> str:
    body = {
        "name": "Chat RPM",
        "scope": "USER",
        "targetId": "phase2-user",
        "type": "RPM",
        "limitValue": limit,
        "windowSeconds": 60,
        "enabled": True,
    }
    resp = client.post("/api/v1/llmgw/rate-limits", json=body, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["rateLimitId"]


def test_rate_limit_guard_enforces_limit(registry, client: TestClient, tenant_headers):
    from app.ratelimits.runtime import RateLimitGuard

    # The conftest attaches a guard instance to the service.
    service = registry.rate_limit_service
    assert isinstance(getattr(service, "_guard", None), RateLimitGuard)

    _create_rule(client, tenant_headers, limit=2)

    decisions = [
        service._guard.check_and_increment(  # type: ignore[attr-defined]
            "tenant-test",
            RateLimitScope.USER,
            "phase2-user",
            RateLimitType.RPM,
        )
        for _ in range(3)
    ]
    assert [d.allowed for d in decisions] == [True, True, False]
    assert decisions[2].reason == "limit_exceeded"
    assert decisions[2].current == 2
    assert decisions[2].remaining == 0


def test_rate_limit_reset_clears_counter(registry, client: TestClient, tenant_headers):
    from app.ratelimits.runtime import RateLimitGuard

    service = registry.rate_limit_service
    rule_id = _create_rule(client, tenant_headers, limit=1)

    service._guard.check_and_increment(  # type: ignore[attr-defined]
        "tenant-test",
        RateLimitScope.USER,
        "phase2-user",
        RateLimitType.RPM,
    )
    blocked = service._guard.check_and_increment(  # type: ignore[attr-defined]
        "tenant-test",
        RateLimitScope.USER,
        "phase2-user",
        RateLimitType.RPM,
    )
    assert blocked.allowed is False

    client.post(f"/api/v1/llmgw/rate-limits/{rule_id}/reset", headers=tenant_headers)
    after = service._guard.check_and_increment(  # type: ignore[attr-defined]
        "tenant-test",
        RateLimitScope.USER,
        "phase2-user",
        RateLimitType.RPM,
    )
    assert after.allowed is True
    assert after.current == 1
