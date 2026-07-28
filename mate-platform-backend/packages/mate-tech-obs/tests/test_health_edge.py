"""Health aggregator edge cases (ST-5.2.9)."""
from __future__ import annotations

import pytest
import respx
from httpx import Response
import time

from mate_tech_obs.health.aggregator import (
    DEFAULT_TARGETS,
    HealthReport,
    HealthStatus,
    _check_endpoint,
    aggregate_health,
)


@pytest.mark.asyncio
@respx.mock
async def test_check_endpoint_4xx() -> None:
    """4xx 仍算 healthy (< 500)."""
    respx.get("http://test/healthz").mock(return_value=Response(404))
    s = await _check_endpoint("test", "http://test/healthz")
    # 4xx < 500 → healthy
    assert s.healthy is True
    assert s.detail == "HTTP 404"


@pytest.mark.asyncio
@respx.mock
async def test_check_endpoint_3xx() -> None:
    """3xx redirect → healthy."""
    respx.get("http://test/healthz").mock(return_value=Response(301))
    s = await _check_endpoint("test", "http://test/healthz")
    assert s.healthy is True


@pytest.mark.asyncio
async def test_check_endpoint_timeout() -> None:
    """超时 → unhealthy."""
    import asyncio
    # 用不可达的 IP + 短 timeout
    s = await _check_endpoint(
        "test",
        "http://192.0.2.1:9999/healthz",  # TEST-NET-1 RFC 5737
        timeout=0.3,
    )
    assert s.healthy is False
    assert s.latency_ms >= 300  # at least the timeout


@pytest.mark.asyncio
async def test_aggregate_health_mixed_partial_down() -> None:
    """部分 down → overall=False."""
    import respx
    from httpx import Response
    with respx.mock:
        respx.get("http://a/healthz").mock(return_value=Response(200))
        respx.get("http://b/healthz").mock(return_value=Response(500))
        respx.get("http://c/healthz").mock(return_value=Response(200))
        targets = [
            ("app", "a", "http://a/healthz"),
            ("app", "b", "http://b/healthz"),
            ("app", "c", "http://c/healthz"),
        ]
        report = await aggregate_health(targets=targets, timeout=1.0)
    assert report.overall is False
    assert report.summary["down"] == 1
    assert report.summary["healthy"] == 2
    assert report.summary["total"] == 3


def test_default_targets_count() -> None:
    """9 apps + 7 infra = 16 默认目标."""
    assert len(DEFAULT_TARGETS) == 16
    apps = [t for t in DEFAULT_TARGETS if t[0] == "app"]
    infra = [t for t in DEFAULT_TARGETS if t[0] == "infra"]
    assert len(apps) == 9
    assert len(infra) == 7


def test_health_report_to_dict() -> None:
    r = HealthReport(overall=False)
    r.components = [
        HealthStatus(name="a", healthy=True),
        HealthStatus(name="b", healthy=False),
    ]
    r.summary = {"total": 2, "healthy": 1, "down": 1}
    d = r.to_dict()
    assert d["overall"] is False
    assert len(d["components"]) == 2
    assert d["summary"]["down"] == 1