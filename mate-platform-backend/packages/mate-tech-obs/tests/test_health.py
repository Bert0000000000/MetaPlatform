"""Health aggregator tests."""
from __future__ import annotations

import pytest
import respx
from httpx import Response

from mate_tech_obs.health.aggregator import (
    HealthStatus,
    _check_endpoint,
    aggregate_health,
)


@pytest.mark.asyncio
@respx.mock
async def test_check_endpoint_success() -> None:
    respx.get("http://test/healthz").mock(return_value=Response(200, json={"ok": True}))
    s = await _check_endpoint("test", "http://test/healthz")
    assert s.healthy is True


@pytest.mark.asyncio
@respx.mock
async def test_check_endpoint_5xx() -> None:
    respx.get("http://test/healthz").mock(return_value=Response(503))
    s = await _check_endpoint("test", "http://test/healthz")
    assert s.healthy is False


@pytest.mark.asyncio
async def test_check_endpoint_unreachable() -> None:
    s = await _check_endpoint("missing", "http://does-not-exist.invalid:9999/healthz", timeout=0.5)
    assert s.healthy is False


@pytest.mark.asyncio
async def test_aggregate_health_empty() -> None:
    report = await aggregate_health(targets=[], timeout=0.5)
    assert report.overall is True


@pytest.mark.asyncio
@respx.mock
async def test_aggregate_health_mixed() -> None:
    respx.get("http://a/healthz").mock(return_value=Response(200))
    respx.get("http://b/healthz").mock(return_value=Response(503))
    targets = [("app", "a", "http://a/healthz"), ("app", "b", "http://b/healthz")]
    report = await aggregate_health(targets=targets, timeout=1.0)
    assert report.overall is False
    assert report.summary["down"] == 1


def test_health_status_dataclass() -> None:
    s = HealthStatus(name="x", healthy=True, detail="ok", latency_ms=1.0)
    assert s.name == "x"
