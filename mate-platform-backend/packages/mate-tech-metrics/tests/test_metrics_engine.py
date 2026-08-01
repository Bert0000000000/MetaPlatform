"""Tests for the dbt metrics engine adapter.

Covers happy-path, error, and timeout scenarios for the
``DbtMetricsEngine`` (subprocess-based) and the
``AsyncMetricsClient`` delegation layer.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mate_tech_metrics.clients import AsyncMetricsClient
from mate_tech_metrics.services.dbt_engine import DbtMetricsEngine, DbtMetricsError


# ---------------------------------------------------------------------------
# Helpers — mock subprocess
# ---------------------------------------------------------------------------
class _MockProcess:
    """Minimal mock of asyncio.subprocess.Process."""

    def __init__(
        self, *, returncode: int = 0,
        stdout: bytes = b"", stderr: bytes = b"",
    ) -> None:
        self.returncode = returncode
        self._stdout = stdout
        self._stderr = stderr
        self.killed = False

    async def communicate(self) -> tuple[bytes, bytes]:
        return self._stdout, self._stderr

    def kill(self) -> None:
        self.killed = True
        self.returncode = -9

    async def wait(self) -> int:
        return self.returncode


# ---------------------------------------------------------------------------
# compute_metric tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_dbt_compute_metric_success() -> None:
    """dbt run succeeds → DbtResult with status='success'."""
    proc = _MockProcess(
        returncode=0,
        stdout=b"Running with dbt=1.7.0\nOK 3 models\n",
        stderr=b"",
    )
    engine = DbtMetricsEngine(
        dbt_bin="/usr/local/bin/dbt",
        project_dir="/opt/dbt",
        timeout_seconds=10,
    )
    with patch(
        "mate_tech_metrics.services.dbt_engine.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
        return_value=proc,
    ) as mock_exec:
        result = await engine.compute_metric(
            "mtc-revenue",
            select="stg_orders+",
            full_refresh=True,
            vars={"date": "2026-08-01"},
        )

    assert result.metric_id == "mtc-revenue"
    assert result.status == "success"
    assert result.returncode == 0
    # Verify the CLI command was built correctly
    args_called = mock_exec.call_args[0]
    assert "/usr/local/bin/dbt" in args_called
    assert "run" in args_called
    assert "--project-dir" in args_called
    assert "/opt/dbt" in args_called
    assert "--select" in args_called
    assert "stg_orders+" in args_called
    assert "--full-refresh" in args_called
    assert "--vars" in args_called


@pytest.mark.asyncio
async def test_dbt_compute_metric_failure() -> None:
    """dbt run returns non-zero → DbtMetricsError."""
    proc = _MockProcess(
        returncode=1,
        stdout=b"",
        stderr=b"Compilation Error in model stg_orders\n",
    )
    engine = DbtMetricsEngine(timeout_seconds=10)
    with patch(
        "mate_tech_metrics.services.dbt_engine.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
        return_value=proc,
    ):
        with pytest.raises(DbtMetricsError) as exc_info:
            await engine.compute_metric("mtc-bad")

    assert exc_info.value.returncode == 1
    assert "Compilation Error" in exc_info.value.stderr


@pytest.mark.asyncio
async def test_dbt_compute_metric_timeout() -> None:
    """dbt run exceeds timeout → DbtMetricsError with kill."""
    proc = _MockProcess(returncode=0, stdout=b"", stderr=b"")

    async def slow_communicate() -> tuple[bytes, bytes]:
        await asyncio.sleep(100)
        return b"", b""

    proc.communicate = slow_communicate  # type: ignore[method-assign]

    engine = DbtMetricsEngine(timeout_seconds=0.1)
    with patch(
        "mate_tech_metrics.services.dbt_engine.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
        return_value=proc,
    ):
        with pytest.raises(DbtMetricsError) as exc_info:
            await engine.compute_metric("mtc-slow")

    assert "timed out" in str(exc_info.value).lower()
    assert proc.killed is True


# ---------------------------------------------------------------------------
# get_lineage tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_dbt_get_lineage_success() -> None:
    """dbt list --output json → parsed lineage."""
    jsonl_output = (
        b'{"name": "stg_orders", "resource_type": "model", "depends_on": []}\n'
        b'{"name": "dwd_orders", "resource_type": "model", "depends_on": ["stg_orders"]}\n'
    )
    proc = _MockProcess(returncode=0, stdout=jsonl_output, stderr=b"")
    engine = DbtMetricsEngine(timeout_seconds=10)
    with patch(
        "mate_tech_metrics.services.dbt_engine.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
        return_value=proc,
    ) as mock_exec:
        result = await engine.get_lineage("mtc-revenue", select="stg_orders+")

    assert result.status == "success"
    assert len(result.lineage) == 2
    assert result.lineage[0]["name"] == "stg_orders"
    assert result.lineage[1]["name"] == "dwd_orders"
    # Verify dbt list was called with correct flags
    args_called = mock_exec.call_args[0]
    assert "list" in args_called
    assert "--resource-type" in args_called
    assert "model" in args_called
    assert "--output" in args_called
    assert "json" in args_called


@pytest.mark.asyncio
async def test_dbt_get_lineage_failure() -> None:
    """dbt list fails → DbtMetricsError."""
    proc = _MockProcess(
        returncode=2, stdout=b"", stderr=b"dbt project not found\n",
    )
    engine = DbtMetricsEngine(timeout_seconds=10)
    with patch(
        "mate_tech_metrics.services.dbt_engine.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
        return_value=proc,
    ):
        with pytest.raises(DbtMetricsError) as exc_info:
            await engine.get_lineage("mtc-bad")
    assert exc_info.value.returncode == 2


@pytest.mark.asyncio
async def test_dbt_get_lineage_empty_output() -> None:
    """dbt list returns empty → empty lineage list."""
    proc = _MockProcess(returncode=0, stdout=b"", stderr=b"")
    engine = DbtMetricsEngine(timeout_seconds=10)
    with patch(
        "mate_tech_metrics.services.dbt_engine.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
        return_value=proc,
    ):
        result = await engine.get_lineage("mtc-empty")
    assert result.status == "success"
    assert result.lineage == []


# ---------------------------------------------------------------------------
# get_values tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_dbt_get_values_success() -> None:
    """dbt run-operation returns JSON array → parsed values."""
    stdout = (
        b'Running with dbt=1.7.0\n'
        b'[{"date": "2026-08-01", "value": 12500.0}, '
        b'{"date": "2026-08-02", "value": 13200.0}]\n'
    )
    proc = _MockProcess(returncode=0, stdout=stdout, stderr=b"")
    engine = DbtMetricsEngine(timeout_seconds=10)
    with patch(
        "mate_tech_metrics.services.dbt_engine.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
        return_value=proc,
    ) as mock_exec:
        result = await engine.get_values(
            "mtc-revenue",
            expression="SUM(orders.amount)",
            limit=50,
        )

    assert result.status == "success"
    assert len(result.values) == 2
    assert result.values[0]["date"] == "2026-08-01"
    assert result.values[0]["value"] == 12500.0
    # Verify run-operation command
    args_called = mock_exec.call_args[0]
    assert "run-operation" in args_called
    assert "get_metric_values" in args_called


@pytest.mark.asyncio
async def test_dbt_get_values_failure() -> None:
    """dbt run-operation fails → DbtMetricsError."""
    proc = _MockProcess(
        returncode=1, stdout=b"", stderr=b"Macro not found\n",
    )
    engine = DbtMetricsEngine(timeout_seconds=10)
    with patch(
        "mate_tech_metrics.services.dbt_engine.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
        return_value=proc,
    ):
        with pytest.raises(DbtMetricsError) as exc_info:
            await engine.get_values("mtc-bad", expression="SUM(x)")
    assert "Macro not found" in exc_info.value.stderr


@pytest.mark.asyncio
async def test_dbt_get_values_no_json() -> None:
    """dbt run-operation returns non-JSON → empty values list."""
    proc = _MockProcess(
        returncode=0,
        stdout=b"Running with dbt=1.7.0\nNo data returned.\n",
        stderr=b"",
    )
    engine = DbtMetricsEngine(timeout_seconds=10)
    with patch(
        "mate_tech_metrics.services.dbt_engine.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
        return_value=proc,
    ):
        result = await engine.get_values("mtc-empty", expression="COUNT(*)")
    assert result.status == "success"
    assert result.values == []


# ---------------------------------------------------------------------------
# test_metric tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_dbt_test_metric_success() -> None:
    """dbt test succeeds → DbtResult with status='success'."""
    proc = _MockProcess(
        returncode=0,
        stdout=b"PASS=3 WARN=0 ERROR=0 SKIP=0 TOTAL=3\n",
        stderr=b"",
    )
    engine = DbtMetricsEngine(timeout_seconds=10)
    with patch(
        "mate_tech_metrics.services.dbt_engine.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
        return_value=proc,
    ) as mock_exec:
        result = await engine.test_metric("mtc-revenue", select="stg_orders+")

    assert result.status == "success"
    args_called = mock_exec.call_args[0]
    assert "test" in args_called


@pytest.mark.asyncio
async def test_dbt_test_metric_failure() -> None:
    """dbt test returns non-zero → status='failed' (no exception)."""
    proc = _MockProcess(
        returncode=1,
        stdout=b"PASS=2 WARN=0 ERROR=1 SKIP=0 TOTAL=3\n",
        stderr=b"",
    )
    engine = DbtMetricsEngine(timeout_seconds=10)
    with patch(
        "mate_tech_metrics.services.dbt_engine.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
        return_value=proc,
    ):
        result = await engine.test_metric("mtc-bad")
    assert result.status == "failed"
    assert result.returncode == 1


# ---------------------------------------------------------------------------
# AsyncMetricsClient delegation tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_metrics_client_delegates_compute() -> None:
    """AsyncMetricsClient.compute_metric delegates to DbtMetricsEngine."""
    mock_dbt = MagicMock(spec=DbtMetricsEngine)
    mock_dbt.compute_metric = AsyncMock(return_value=MagicMock(
        metric_id="mtc-001", status="success", returncode=0,
        stdout="", stderr="",
    ))
    client = AsyncMetricsClient(
        base_url="http://localhost",
        dbt_engine=mock_dbt,  # type: ignore[arg-type]
    )
    result = await client.compute_metric("mtc-001", select="stg_orders+")
    mock_dbt.compute_metric.assert_called_once()
    assert result.metric_id == "mtc-001"


@pytest.mark.asyncio
async def test_metrics_client_delegates_lineage() -> None:
    """AsyncMetricsClient.get_lineage delegates to DbtMetricsEngine."""
    mock_dbt = MagicMock(spec=DbtMetricsEngine)
    mock_dbt.get_lineage = AsyncMock(return_value=MagicMock(
        metric_id="mtc-002", status="success", lineage=[],
    ))
    client = AsyncMetricsClient(
        base_url="http://localhost",
        dbt_engine=mock_dbt,  # type: ignore[arg-type]
    )
    result = await client.get_lineage("mtc-002")
    mock_dbt.get_lineage.assert_called_once_with("mtc-002", select=None)
    assert result.metric_id == "mtc-002"


@pytest.mark.asyncio
async def test_metrics_client_delegates_values() -> None:
    """AsyncMetricsClient.get_values delegates to DbtMetricsEngine."""
    mock_dbt = MagicMock(spec=DbtMetricsEngine)
    mock_dbt.get_values = AsyncMock(return_value=MagicMock(
        metric_id="mtc-003", status="success", values=[],
    ))
    client = AsyncMetricsClient(
        base_url="http://localhost",
        dbt_engine=mock_dbt,  # type: ignore[arg-type]
    )
    result = await client.get_values("mtc-003", expression="SUM(x)")
    mock_dbt.get_values.assert_called_once_with(
        "mtc-003", expression="SUM(x)", limit=100,
    )
    assert result.metric_id == "mtc-003"


def test_metrics_client_requires_base_url() -> None:
    """AsyncMetricsClient with empty base_url → ValueError."""
    with pytest.raises(ValueError, match="base_url is required"):
        AsyncMetricsClient(base_url="")
