"""Tests for the scheduler engine adapters (Airflow + Dagster).

Covers happy-path, error, and timeout scenarios for both the
``AirflowEngine`` (REST API) and ``DagsterEngine`` (GraphQL API),
plus the ``AsyncSchedulerClient`` delegation layer.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
import respx

from mate_tech_scheduler.clients import AsyncSchedulerClient
from mate_tech_scheduler.services.airflow_engine import AirflowEngine, AirflowEngineError
from mate_tech_scheduler.services.dagster_engine import DagsterEngine, DagsterEngineError


# ---------------------------------------------------------------------------
# Airflow engine tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
@respx.mock
async def test_airflow_pause_task_success() -> None:
    """PATCH /dags/{dag_id} with is_paused=true → paused status."""
    respx.patch("http://airflow:8081/api/v1/dags/etl_orders").mock(
        return_value=httpx.Response(200, json={
            "dag_id": "etl_orders",
            "is_paused": True,
            "is_active": True,
        })
    )
    engine = AirflowEngine(
        base_url="http://airflow:8081",
        auth_token="test-token",
        max_retries=0,
    )
    result = await engine.pause_task("sch-001", "etl_orders")
    assert result.task_id == "sch-001"
    assert result.dag_id == "etl_orders"
    assert result.status == "paused"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_airflow_trigger_task_success() -> None:
    """POST /dags/{dag_id}/dagRuns → running status with run_id."""
    respx.post("http://airflow:8081/api/v1/dags/etl_orders/dagRuns").mock(
        return_value=httpx.Response(200, json={
            "dag_run_id": "manual__2026-08-01T00:00:00",
            "dag_id": "etl_orders",
            "state": "running",
        })
    )
    engine = AirflowEngine(
        base_url="http://airflow:8081",
        max_retries=0,
    )
    result = await engine.trigger_task(
        "sch-001", "etl_orders",
        conf={"date": "2026-08-01"},
    )
    assert result.status == "running"
    assert result.run_id == "manual__2026-08-01T00:00:00"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_airflow_get_dag_success() -> None:
    """GET /dags/{dag_id} → active status."""
    respx.get("http://airflow:8081/api/v1/dags/etl_orders").mock(
        return_value=httpx.Response(200, json={
            "dag_id": "etl_orders",
            "is_paused": False,
            "is_active": True,
        })
    )
    engine = AirflowEngine(
        base_url="http://airflow:8081",
        max_retries=0,
    )
    result = await engine.get_dag("sch-001", "etl_orders")
    assert result.status == "active"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_airflow_get_dag_paused() -> None:
    """GET /dags/{dag_id} → paused status."""
    respx.get("http://airflow:8081/api/v1/dags/etl_orders").mock(
        return_value=httpx.Response(200, json={
            "dag_id": "etl_orders",
            "is_paused": True,
            "is_active": True,
        })
    )
    engine = AirflowEngine(
        base_url="http://airflow:8081",
        max_retries=0,
    )
    result = await engine.get_dag("sch-001", "etl_orders")
    assert result.status == "paused"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_airflow_http_error() -> None:
    """Airflow returns 404 → AirflowEngineError."""
    respx.get("http://airflow:8081/api/v1/dags/missing").mock(
        return_value=httpx.Response(404, text="DAG not found")
    )
    engine = AirflowEngine(
        base_url="http://airflow:8081",
        max_retries=0,
    )
    with pytest.raises(AirflowEngineError) as exc_info:
        await engine.get_dag("sch-001", "missing")
    assert exc_info.value.status_code == 404
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_airflow_retry_on_server_error() -> None:
    """500 → retried, then succeeds."""
    route = respx.patch("http://airflow:8081/api/v1/dags/etl_orders").mock(
        side_effect=[
            httpx.Response(500, text="Internal error"),
            httpx.Response(200, json={
                "dag_id": "etl_orders", "is_paused": True, "is_active": True,
            }),
        ]
    )
    engine = AirflowEngine(
        base_url="http://airflow:8081",
        max_retries=2,
    )
    result = await engine.pause_task("sch-001", "etl_orders")
    assert result.status == "paused"
    assert route.call_count == 2
    await engine.close()


@pytest.mark.asyncio
async def test_airflow_timeout() -> None:
    """Request exceeds timeout → AirflowEngineError."""
    engine = AirflowEngine(
        base_url="http://10.255.255.1:8081",
        timeout_seconds=0.1,
        max_retries=0,
    )
    with pytest.raises(AirflowEngineError) as exc_info:
        await engine.get_dag("sch-001", "etl_orders")
    assert "timed out" in str(exc_info.value).lower()
    await engine.close()


# ---------------------------------------------------------------------------
# Dagster engine tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
@respx.mock
async def test_dagster_trigger_task_success() -> None:
    """GraphQL LaunchPipelineRun mutation succeeds."""
    respx.post("http://dagster:3000/graphql").mock(
        return_value=httpx.Response(200, json={
            "data": {
                "launchPipelineRun": {
                    "__typename": "LaunchRunSuccess",
                    "run": {
                        "runId": "dagster-run-001",
                        "status": "LAUNCHED",
                    }
                }
            }
        })
    )
    engine = DagsterEngine(
        base_url="http://dagster:3000",
        auth_token="test-token",
        max_retries=0,
    )
    result = await engine.trigger_task(
        "sch-001",
        repository_location_name="repo_loc",
        repository_name="repo",
        pipeline_name="etl_pipeline",
        run_config={"resources": {}},
    )
    assert result.task_id == "sch-001"
    assert result.run_id == "dagster-run-001"
    assert result.status == "launched"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_dagster_get_run_status_success() -> None:
    """GraphQL pipelineRunOrError query succeeds."""
    respx.post("http://dagster:3000/graphql").mock(
        return_value=httpx.Response(200, json={
            "data": {
                "pipelineRunOrError": {
                    "__typename": "Run",
                    "runId": "dagster-run-001",
                    "status": "SUCCESS",
                }
            }
        })
    )
    engine = DagsterEngine(
        base_url="http://dagster:3000",
        max_retries=0,
    )
    result = await engine.get_run_status("sch-001", "dagster-run-001")
    assert result.status == "success"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_dagster_cancel_run_success() -> None:
    """GraphQL terminatePipelineExecution mutation succeeds."""
    respx.post("http://dagster:3000/graphql").mock(
        return_value=httpx.Response(200, json={
            "data": {
                "terminatePipelineExecution": {
                    "__typename": "TerminateRunSuccess",
                    "run": {
                        "runId": "dagster-run-001",
                        "status": "CANCELED",
                    }
                }
            }
        })
    )
    engine = DagsterEngine(
        base_url="http://dagster:3000",
        max_retries=0,
    )
    result = await engine.cancel_run("sch-001", "dagster-run-001")
    assert result.status == "canceled"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_dagster_trigger_launch_failure() -> None:
    """GraphQL LaunchRunSuccess not returned → DagsterEngineError."""
    respx.post("http://dagster:3000/graphql").mock(
        return_value=httpx.Response(200, json={
            "data": {
                "launchPipelineRun": {
                    "__typename": "PythonError",
                    "message": "Pipeline not found",
                }
            }
        })
    )
    engine = DagsterEngine(
        base_url="http://dagster:3000",
        max_retries=0,
    )
    with pytest.raises(DagsterEngineError) as exc_info:
        await engine.trigger_task(
            "sch-001",
            repository_location_name="loc",
            repository_name="repo",
            pipeline_name="missing",
        )
    assert "Pipeline not found" in str(exc_info.value)
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_dagster_graphql_errors() -> None:
    """GraphQL response contains 'errors' → DagsterEngineError."""
    respx.post("http://dagster:3000/graphql").mock(
        return_value=httpx.Response(200, json={
            "errors": [{"message": "Unauthorized"}],
        })
    )
    engine = DagsterEngine(
        base_url="http://dagster:3000",
        max_retries=0,
    )
    with pytest.raises(DagsterEngineError) as exc_info:
        await engine.get_run_status("sch-001", "run-001")
    assert "Unauthorized" in str(exc_info.value)
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_dagster_http_error() -> None:
    """Dagster returns 500 → DagsterEngineError."""
    respx.post("http://dagster:3000/graphql").mock(
        return_value=httpx.Response(500, text="Server error")
    )
    engine = DagsterEngine(
        base_url="http://dagster:3000",
        max_retries=0,
    )
    with pytest.raises(DagsterEngineError) as exc_info:
        await engine.get_run_status("sch-001", "run-001")
    assert exc_info.value.status_code == 500
    await engine.close()


@pytest.mark.asyncio
async def test_dagster_timeout() -> None:
    """Dagster request exceeds timeout → DagsterEngineError."""
    engine = DagsterEngine(
        base_url="http://10.255.255.1:3000",
        timeout_seconds=0.1,
        max_retries=0,
    )
    with pytest.raises(DagsterEngineError) as exc_info:
        await engine.get_run_status("sch-001", "run-001")
    assert "timed out" in str(exc_info.value).lower()
    await engine.close()


# ---------------------------------------------------------------------------
# AsyncSchedulerClient delegation tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_scheduler_client_delegates_to_airflow() -> None:
    """AsyncSchedulerClient.trigger_task dispatches to AirflowEngine."""
    mock_airflow = MagicMock(spec=AirflowEngine)
    mock_airflow.trigger_task = AsyncMock(return_value=MagicMock(
        task_id="sch-001", dag_id="etl_orders",
        status="running", run_id="run-001",
    ))
    mock_airflow.close = AsyncMock()
    mock_dagster = MagicMock(spec=DagsterEngine)
    mock_dagster.close = AsyncMock()

    client = AsyncSchedulerClient(
        base_url="http://localhost",
        airflow_engine=mock_airflow,  # type: ignore[arg-type]
        dagster_engine=mock_dagster,  # type: ignore[arg-type]
    )
    result = await client.trigger_task(
        "sch-001", "etl_orders",
        engine="airflow",
        conf={"date": "2026-08-01"},
    )
    mock_airflow.trigger_task.assert_called_once_with(
        "sch-001", "etl_orders", conf={"date": "2026-08-01"},
    )
    assert result.task_id == "sch-001"
    await client.close()


@pytest.mark.asyncio
async def test_scheduler_client_delegates_to_dagster() -> None:
    """AsyncSchedulerClient.trigger_task dispatches to DagsterEngine."""
    mock_airflow = MagicMock(spec=AirflowEngine)
    mock_airflow.close = AsyncMock()
    mock_dagster = MagicMock(spec=DagsterEngine)
    mock_dagster.trigger_task = AsyncMock(return_value=MagicMock(
        task_id="sch-002", run_id="dagster-run-001",
        status="launched",
    ))
    mock_dagster.close = AsyncMock()

    client = AsyncSchedulerClient(
        base_url="http://localhost",
        airflow_engine=mock_airflow,  # type: ignore[arg-type]
        dagster_engine=mock_dagster,  # type: ignore[arg-type]
    )
    result = await client.trigger_task(
        "sch-002", "ignored",
        engine="dagster",
        repository_location_name="loc",
        repository_name="repo",
        pipeline_name="etl_pipeline",
    )
    mock_dagster.trigger_task.assert_called_once()
    assert result.task_id == "sch-002"
    await client.close()


@pytest.mark.asyncio
async def test_scheduler_client_unknown_engine_raises() -> None:
    """AsyncSchedulerClient with unknown engine → ValueError."""
    mock_airflow = MagicMock(spec=AirflowEngine)
    mock_airflow.close = AsyncMock()
    mock_dagster = MagicMock(spec=DagsterEngine)
    mock_dagster.close = AsyncMock()

    client = AsyncSchedulerClient(
        base_url="http://localhost",
        airflow_engine=mock_airflow,  # type: ignore[arg-type]
        dagster_engine=mock_dagster,  # type: ignore[arg-type]
    )
    with pytest.raises(ValueError, match="Unknown scheduler engine"):
        await client.trigger_task("sch-003", "dag-001", engine="jenkins")
    await client.close()


def test_scheduler_client_requires_base_url() -> None:
    """AsyncSchedulerClient with empty base_url → ValueError."""
    with pytest.raises(ValueError, match="base_url is required"):
        AsyncSchedulerClient(base_url="")
