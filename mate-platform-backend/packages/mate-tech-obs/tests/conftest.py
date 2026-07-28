"""Conftest for mate-tech-obs (ST-5.2.10)."""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock

from mate_tech_obs.health.aggregator import HealthStatus


@pytest.fixture
def sample_health_status() -> HealthStatus:
    return HealthStatus(name="test", healthy=True, detail="ok", latency_ms=10.0)


@pytest.fixture
def sample_unhealthy() -> HealthStatus:
    return HealthStatus(name="down", healthy=False, detail="err", latency_ms=500.0)


@pytest.fixture
def mock_httpx_client() -> AsyncMock:
    return AsyncMock()