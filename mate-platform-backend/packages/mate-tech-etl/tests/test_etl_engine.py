"""Tests for the ETL engine adapters (Spark + Flink).

Covers happy-path, error, and timeout scenarios for both the
``SparkSubmitEngine`` (subprocess-based) and ``FlinkSubmitEngine``
(HTTP-based), plus the ``AsyncEtlClient`` delegation layer.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
import respx

from mate_tech_etl.clients import AsyncEtlClient
from mate_tech_etl.services.flink_engine import FlinkSubmitEngine, FlinkSubmitError
from mate_tech_etl.services.spark_engine import SparkSubmitEngine, SparkSubmitError


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
# Spark engine tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_spark_run_task_success() -> None:
    """spark-submit succeeds and submission ID is parsed from stdout."""
    proc = _MockProcess(
        returncode=0,
        stdout=b"submissionId: driver-20240101-0001-0001\n",
        stderr=b"",
    )
    engine = SparkSubmitEngine(
        spark_submit_path="/usr/bin/spark-submit",
        spark_master="spark://localhost:7077",
        timeout_seconds=10,
    )
    with patch(
        "mate_tech_etl.services.spark_engine.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
        return_value=proc,
    ) as mock_exec:
        result = await engine.run_task(
            "etl-001",
            script_path="/jobs/etl.py",
            app_name="Orders ETL",
            conf={"spark.executor.memory": "2g"},
            args=["--date", "2026-08-01"],
        )

    assert result.task_id == "etl-001"
    assert result.submission_id == "driver-20240101-0001-0001"
    assert result.status == "submitted"
    assert result.returncode == 0
    # Verify the CLI command was built correctly
    args_called = mock_exec.call_args[0]
    assert "/usr/bin/spark-submit" in args_called
    assert "--master" in args_called
    assert "spark://localhost:7077" in args_called
    assert "--name" in args_called
    assert "Orders ETL" in args_called
    assert "--conf" in args_called
    assert "spark.executor.memory=2g" in args_called
    assert "/jobs/etl.py" in args_called
    assert "--date" in args_called


@pytest.mark.asyncio
async def test_spark_run_task_failure() -> None:
    """spark-submit returns non-zero exit code → SparkSubmitError."""
    proc = _MockProcess(
        returncode=1,
        stdout=b"",
        stderr=b"Error: ClassNotFound\n",
    )
    engine = SparkSubmitEngine(timeout_seconds=10)
    with patch(
        "mate_tech_etl.services.spark_engine.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
        return_value=proc,
    ):
        with pytest.raises(SparkSubmitError) as exc_info:
            await engine.run_task("etl-002", script_path="/bad.py")

    assert exc_info.value.returncode == 1
    assert "ClassNotFound" in exc_info.value.stderr


@pytest.mark.asyncio
async def test_spark_run_task_timeout() -> None:
    """spark-submit exceeds timeout → SparkSubmitError with kill."""
    proc = _MockProcess(returncode=0, stdout=b"", stderr=b"")

    async def slow_communicate() -> tuple[bytes, bytes]:
        await asyncio.sleep(100)
        return b"", b""

    proc.communicate = slow_communicate  # type: ignore[method-assign]

    engine = SparkSubmitEngine(timeout_seconds=0.1)
    with patch(
        "mate_tech_etl.services.spark_engine.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
        return_value=proc,
    ):
        with pytest.raises(SparkSubmitError) as exc_info:
            await engine.run_task("etl-003", script_path="/slow.py")

    assert "timed out" in str(exc_info.value).lower()
    assert proc.killed is True


@pytest.mark.asyncio
async def test_spark_stop_task_success() -> None:
    """spark-submit --kill succeeds."""
    proc = _MockProcess(
        returncode=0,
        stdout=b"Killed driver-20240101-0001-0001\n",
        stderr=b"",
    )
    engine = SparkSubmitEngine(timeout_seconds=10)
    with patch(
        "mate_tech_etl.services.spark_engine.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
        return_value=proc,
    ) as mock_exec:
        result = await engine.stop_task("etl-001", "driver-20240101-0001-0001")

    assert result.status == "killed"
    assert result.returncode == 0
    args_called = mock_exec.call_args[0]
    assert "--kill" in args_called
    assert "driver-20240101-0001-0001" in args_called


@pytest.mark.asyncio
async def test_spark_get_status_success() -> None:
    """spark-submit --status returns the parsed status."""
    proc = _MockProcess(
        returncode=0,
        stdout=b"Driver Status: running\n",
        stderr=b"",
    )
    engine = SparkSubmitEngine(timeout_seconds=10)
    with patch(
        "mate_tech_etl.services.spark_engine.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
        return_value=proc,
    ):
        result = await engine.get_status("etl-001", "driver-20240101-0001-0001")

    assert result.status == "running"


@pytest.mark.asyncio
async def test_spark_get_status_failure() -> None:
    """spark-submit --status fails → SparkSubmitError."""
    proc = _MockProcess(
        returncode=1, stdout=b"", stderr=b"submission not found\n",
    )
    engine = SparkSubmitEngine(timeout_seconds=10)
    with patch(
        "mate_tech_etl.services.spark_engine.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
        return_value=proc,
    ):
        with pytest.raises(SparkSubmitError) as exc_info:
            await engine.get_status("etl-001", "driver-bad")

    assert exc_info.value.returncode == 1


# ---------------------------------------------------------------------------
# Flink engine tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
@respx.mock
async def test_flink_run_task_success() -> None:
    """POST /jars/:jarid/run returns jobid → FlinkJobResult."""
    respx.post("http://flink:8081/jars/jar-001/run").mock(
        return_value=httpx.Response(200, json={"jobid": "flink-job-123"})
    )
    engine = FlinkSubmitEngine(
        rest_url="http://flink:8081",
        timeout_seconds=10,
    )
    result = await engine.run_task(
        "etl-flink-001",
        jar_id="jar-001",
        entry_class="com.example.ETLJob",
        parallelism=4,
        program_args=["--date", "2026-08-01"],
    )
    assert result.task_id == "etl-flink-001"
    assert result.job_id == "flink-job-123"
    assert result.status == "submitted"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_flink_run_task_http_error() -> None:
    """POST /jars/:jarid/run returns 400 → FlinkSubmitError."""
    respx.post("http://flink:8081/jars/jar-bad/run").mock(
        return_value=httpx.Response(400, text="Jar not found")
    )
    engine = FlinkSubmitEngine(rest_url="http://flink:8081", max_retries=0)
    with pytest.raises(FlinkSubmitError) as exc_info:
        await engine.run_task("etl-002", jar_id="jar-bad")
    assert exc_info.value.status_code == 400
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_flink_run_task_missing_jobid() -> None:
    """POST /jars/:jarid/run returns 200 but no jobid → FlinkSubmitError."""
    respx.post("http://flink:8081/jars/jar-001/run").mock(
        return_value=httpx.Response(200, json={"errors": "something"})
    )
    engine = FlinkSubmitEngine(rest_url="http://flink:8081", max_retries=0)
    with pytest.raises(FlinkSubmitError) as exc_info:
        await engine.run_task("etl-003", jar_id="jar-001")
    assert "missing 'jobid'" in str(exc_info.value)
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_flink_stop_task_success() -> None:
    """PATCH /jobs/:jobid → canceled status."""
    respx.patch("http://flink:8081/jobs/flink-job-123").mock(
        return_value=httpx.Response(200, json={"status": "canceled"})
    )
    engine = FlinkSubmitEngine(rest_url="http://flink:8081", max_retries=0)
    result = await engine.stop_task("etl-001", "flink-job-123")
    assert result.status == "canceled"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_flink_get_status_success() -> None:
    """GET /jobs/:jobid → parsed status."""
    respx.get("http://flink:8081/jobs/flink-job-123").mock(
        return_value=httpx.Response(200, json={
            "jid": "flink-job-123",
            "name": "Orders ETL",
            "state": "RUNNING",
        })
    )
    engine = FlinkSubmitEngine(rest_url="http://flink:8081", max_retries=0)
    result = await engine.get_status("etl-001", "flink-job-123")
    assert result.status == "running"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_flink_get_status_failed_state() -> None:
    """GET /jobs/:jobid with FAILED state → failed status."""
    respx.get("http://flink:8081/jobs/flink-job-456").mock(
        return_value=httpx.Response(200, json={
            "jid": "flink-job-456",
            "state": "FAILED",
        })
    )
    engine = FlinkSubmitEngine(rest_url="http://flink:8081", max_retries=0)
    result = await engine.get_status("etl-001", "flink-job-456")
    assert result.status == "failed"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_flink_retry_on_server_error() -> None:
    """500 → retried once, then succeeds."""
    route = respx.post("http://flink:8081/jars/jar-001/run").mock(
        side_effect=[
            httpx.Response(500, text="Internal error"),
            httpx.Response(200, json={"jobid": "flink-job-retry"}),
        ]
    )
    engine = FlinkSubmitEngine(
        rest_url="http://flink:8081", max_retries=2, timeout_seconds=10,
    )
    result = await engine.run_task("etl-retry", jar_id="jar-001")
    assert result.job_id == "flink-job-retry"
    assert route.call_count == 2
    await engine.close()


@pytest.mark.asyncio
async def test_flink_timeout() -> None:
    """Request exceeds timeout → FlinkSubmitError."""
    engine = FlinkSubmitEngine(
        rest_url="http://10.255.255.1:8081",  # non-routable → fast timeout
        timeout_seconds=0.1,
        max_retries=0,
    )
    with pytest.raises(FlinkSubmitError) as exc_info:
        await engine.run_task("etl-timeout", jar_id="jar-001")
    assert "timed out" in str(exc_info.value).lower()
    await engine.close()


# ---------------------------------------------------------------------------
# AsyncEtlClient delegation tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_etl_client_delegates_to_spark() -> None:
    """AsyncEtlClient.run_task dispatches to SparkSubmitEngine."""
    mock_spark = MagicMock(spec=SparkSubmitEngine)
    mock_spark.run_task = AsyncMock(return_value=MagicMock(
        task_id="etl-001", submission_id="driver-001",
        status="submitted", returncode=0, stdout="", stderr="",
    ))
    mock_flink = MagicMock(spec=FlinkSubmitEngine)
    mock_flink.close = AsyncMock()

    client = AsyncEtlClient(
        base_url="http://localhost",
        spark_engine=mock_spark,  # type: ignore[arg-type]
        flink_engine=mock_flink,  # type: ignore[arg-type]
    )
    result = await client.run_task(
        "etl-001", engine="spark", script_path="/jobs/etl.py",
    )
    mock_spark.run_task.assert_called_once_with("etl-001", script_path="/jobs/etl.py")
    assert result.task_id == "etl-001"
    await client.close()


@pytest.mark.asyncio
async def test_etl_client_delegates_to_flink() -> None:
    """AsyncEtlClient.run_task dispatches to FlinkSubmitEngine."""
    mock_spark = MagicMock(spec=SparkSubmitEngine)
    mock_flink = MagicMock(spec=FlinkSubmitEngine)
    mock_flink.run_task = AsyncMock(return_value=MagicMock(
        task_id="etl-002", job_id="flink-job-001",
        status="submitted",
    ))
    mock_flink.close = AsyncMock()

    client = AsyncEtlClient(
        base_url="http://localhost",
        spark_engine=mock_spark,  # type: ignore[arg-type]
        flink_engine=mock_flink,  # type: ignore[arg-type]
    )
    result = await client.run_task(
        "etl-002", engine="flink", jar_id="jar-001",
    )
    mock_flink.run_task.assert_called_once_with("etl-002", jar_id="jar-001")
    assert result.task_id == "etl-002"
    await client.close()


@pytest.mark.asyncio
async def test_etl_client_unknown_engine_raises() -> None:
    """AsyncEtlClient.run_task with unknown engine → ValueError."""
    mock_spark = MagicMock(spec=SparkSubmitEngine)
    mock_flink = MagicMock(spec=FlinkSubmitEngine)
    mock_flink.close = AsyncMock()

    client = AsyncEtlClient(
        base_url="http://localhost",
        spark_engine=mock_spark,  # type: ignore[arg-type]
        flink_engine=mock_flink,  # type: ignore[arg-type]
    )
    with pytest.raises(ValueError, match="Unknown ETL engine"):
        await client.run_task("etl-003", engine="dataflow")
    await client.close()


def test_etl_client_requires_base_url() -> None:
    """AsyncEtlClient with empty base_url → ValueError."""
    with pytest.raises(ValueError, match="base_url is required"):
        AsyncEtlClient(base_url="")
