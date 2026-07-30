"""Conftest for mate-tech-obs (ST-5.2.10)."""
from __future__ import annotations

# BUSINESS-SLICES P1 wave 2: ensure cross-package paths work
# without `pip install -e .`. The block is appended after all
# `from __future__` and standard imports to keep Python happy.
import sys as _bsl_sys
from pathlib import Path as _bsl_Path
from unittest.mock import AsyncMock

import pytest

_BSL_MONOREPO = _bsl_Path(__file__).resolve().parents[3]
for _bsl_sub in (
    "mate-tech-obs",
    "mate-platform",
    "mate-clients",
    "mate-common",
):
    _bsl_p = str(_BSL_MONOREPO / "packages" / _bsl_sub / "src")
    if _bsl_p not in _bsl_sys.path:
        _bsl_sys.path.insert(0, _bsl_p)
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
