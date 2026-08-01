"""Tests for the Debezium CDC engine adapter.

Covers happy-path, error, and timeout scenarios for the
``DebeziumEngine`` (Kafka Connect REST API) and the
``AsyncDataClient`` delegation layer.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
import respx

from mate_tech_data.clients import AsyncDataClient
from mate_tech_data.services.debezium_engine import DebeziumEngine, DebeziumEngineError


# ---------------------------------------------------------------------------
# start_cdc_task tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
@respx.mock
async def test_debezium_start_cdc_task_success() -> None:
    """POST /connectors → connector created and running."""
    respx.post("http://kafka-connect:8083/connectors").mock(
        return_value=httpx.Response(201, json={
            "name": "orders-connector",
            "config": {
                "connector.class": "io.debezium.connector.mysql.MySqlConnector",
                "database.hostname": "mysql.example.com",
            },
            "tasks": [{"id": 0, "state": "RUNNING"}],
        })
    )
    engine = DebeziumEngine(
        base_url="http://kafka-connect:8083",
        max_retries=0,
    )
    result = await engine.start_cdc_task(
        "cdc-001",
        connector_name="orders-connector",
        connector_class="io.debezium.connector.mysql.MySqlConnector",
        config={
            "database.hostname": "mysql.example.com",
            "database.port": "3306",
            "database.user": "debezium",
            "database.password": "secret",
            "database.server.id": "184054",
            "database.server.name": "dbserver1",
            "database.include.list": "orders",
            "table.include.list": "orders.orders",
        },
    )
    assert result.task_id == "cdc-001"
    assert result.connector_name == "orders-connector"
    assert result.status == "running"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_debezium_start_cdc_task_conflict() -> None:
    """POST /connectors returns 409 (already exists) → DebeziumEngineError."""
    respx.post("http://kafka-connect:8083/connectors").mock(
        return_value=httpx.Response(409, text="Connector already exists")
    )
    engine = DebeziumEngine(
        base_url="http://kafka-connect:8083",
        max_retries=0,
    )
    with pytest.raises(DebeziumEngineError) as exc_info:
        await engine.start_cdc_task(
            "cdc-002",
            connector_name="orders-connector",
            connector_class="io.debezium.connector.mysql.MySqlConnector",
            config={},
        )
    assert exc_info.value.status_code == 409
    await engine.close()


# ---------------------------------------------------------------------------
# stop_cdc_task tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
@respx.mock
async def test_debezium_stop_cdc_task_success() -> None:
    """DELETE /connectors/{name} → stopped status."""
    respx.delete("http://kafka-connect:8083/connectors/orders-connector").mock(
        return_value=httpx.Response(204)
    )
    engine = DebeziumEngine(
        base_url="http://kafka-connect:8083",
        max_retries=0,
    )
    result = await engine.stop_cdc_task("cdc-001", "orders-connector")
    assert result.status == "stopped"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_debezium_stop_cdc_task_not_found() -> None:
    """DELETE /connectors/{name} returns 404 → DebeziumEngineError."""
    respx.delete("http://kafka-connect:8083/connectors/missing").mock(
        return_value=httpx.Response(404, text="Connector not found")
    )
    engine = DebeziumEngine(
        base_url="http://kafka-connect:8083",
        max_retries=0,
    )
    with pytest.raises(DebeziumEngineError) as exc_info:
        await engine.stop_cdc_task("cdc-003", "missing")
    assert exc_info.value.status_code == 404
    await engine.close()


# ---------------------------------------------------------------------------
# get_status tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
@respx.mock
async def test_debezium_get_status_running() -> None:
    """GET /connectors/{name}/status → all tasks RUNNING."""
    respx.get("http://kafka-connect:8083/connectors/orders-connector/status").mock(
        return_value=httpx.Response(200, json={
            "name": "orders-connector",
            "connector": {"state": "RUNNING", "worker_id": "worker-1"},
            "tasks": [{"id": 0, "state": "RUNNING", "worker_id": "worker-1"}],
        })
    )
    engine = DebeziumEngine(
        base_url="http://kafka-connect:8083",
        max_retries=0,
    )
    result = await engine.get_status("cdc-001", "orders-connector")
    assert result.status == "running"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_debezium_get_status_paused() -> None:
    """GET /connectors/{name}/status → tasks PAUSED."""
    respx.get("http://kafka-connect:8083/connectors/orders-connector/status").mock(
        return_value=httpx.Response(200, json={
            "name": "orders-connector",
            "connector": {"state": "PAUSED", "worker_id": "worker-1"},
            "tasks": [{"id": 0, "state": "PAUSED", "worker_id": "worker-1"}],
        })
    )
    engine = DebeziumEngine(
        base_url="http://kafka-connect:8083",
        max_retries=0,
    )
    result = await engine.get_status("cdc-001", "orders-connector")
    assert result.status == "paused"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_debezium_get_status_failed() -> None:
    """GET /connectors/{name}/status → task FAILED."""
    respx.get("http://kafka-connect:8083/connectors/orders-connector/status").mock(
        return_value=httpx.Response(200, json={
            "name": "orders-connector",
            "connector": {"state": "RUNNING", "worker_id": "worker-1"},
            "tasks": [{"id": 0, "state": "FAILED", "worker_id": "worker-1"}],
        })
    )
    engine = DebeziumEngine(
        base_url="http://kafka-connect:8083",
        max_retries=0,
    )
    result = await engine.get_status("cdc-001", "orders-connector")
    assert result.status == "failed"
    await engine.close()


# ---------------------------------------------------------------------------
# pause/resume/restart tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
@respx.mock
async def test_debezium_pause_cdc_task_success() -> None:
    """PUT /connectors/{name}/pause → paused status."""
    respx.put("http://kafka-connect:8083/connectors/orders-connector/pause").mock(
        return_value=httpx.Response(202, json={"name": "orders-connector"})
    )
    engine = DebeziumEngine(
        base_url="http://kafka-connect:8083",
        max_retries=0,
    )
    result = await engine.pause_cdc_task("cdc-001", "orders-connector")
    assert result.status == "paused"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_debezium_resume_cdc_task_success() -> None:
    """PUT /connectors/{name}/resume → running status."""
    respx.put("http://kafka-connect:8083/connectors/orders-connector/resume").mock(
        return_value=httpx.Response(202, json={"name": "orders-connector"})
    )
    engine = DebeziumEngine(
        base_url="http://kafka-connect:8083",
        max_retries=0,
    )
    result = await engine.resume_cdc_task("cdc-001", "orders-connector")
    assert result.status == "running"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_debezium_restart_cdc_task_success() -> None:
    """POST /connectors/{name}/restart → running status."""
    respx.post("http://kafka-connect:8083/connectors/orders-connector/restart").mock(
        return_value=httpx.Response(204)
    )
    engine = DebeziumEngine(
        base_url="http://kafka-connect:8083",
        max_retries=0,
    )
    result = await engine.restart_cdc_task("cdc-001", "orders-connector")
    assert result.status == "running"
    await engine.close()


# ---------------------------------------------------------------------------
# Error and timeout tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
@respx.mock
async def test_debezium_retry_on_server_error() -> None:
    """500 → retried, then succeeds."""
    route = respx.get(
        "http://kafka-connect:8083/connectors/orders-connector/status"
    ).mock(
        side_effect=[
            httpx.Response(500, text="Internal error"),
            httpx.Response(200, json={
                "name": "orders-connector",
                "connector": {"state": "RUNNING"},
                "tasks": [{"id": 0, "state": "RUNNING"}],
            }),
        ]
    )
    engine = DebeziumEngine(
        base_url="http://kafka-connect:8083",
        max_retries=2,
    )
    result = await engine.get_status("cdc-001", "orders-connector")
    assert result.status == "running"
    assert route.call_count == 2
    await engine.close()


@pytest.mark.asyncio
async def test_debezium_timeout() -> None:
    """Request exceeds timeout → DebeziumEngineError."""
    engine = DebeziumEngine(
        base_url="http://10.255.255.1:8083",
        timeout_seconds=0.1,
        max_retries=0,
    )
    with pytest.raises(DebeziumEngineError) as exc_info:
        await engine.get_status("cdc-001", "orders-connector")
    assert "timed out" in str(exc_info.value).lower()
    await engine.close()


# ---------------------------------------------------------------------------
# discover_source_schema tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
@respx.mock
async def test_debezium_discover_schema_success() -> None:
    """GET /connectors/{name} → schema parsed from config."""
    respx.get("http://kafka-connect:8083/connectors/orders-connector").mock(
        return_value=httpx.Response(200, json={
            "name": "orders-connector",
            "config": {
                "connector.class": "io.debezium.connector.mysql.MySqlConnector",
                "database.hostname": "mysql.example.com",
                "table.include.list": "orders.orders,orders.order_items",
            },
        })
    )
    engine = DebeziumEngine(
        base_url="http://kafka-connect:8083",
        max_retries=0,
    )
    result = await engine.discover_source_schema("cdc-001", "orders-connector")
    assert result["source_id"] == "orders-connector"
    assert len(result["tables"]) == 2
    assert result["tables"][0]["name"] == "orders.orders"
    assert result["tables"][1]["name"] == "orders.order_items"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_debezium_discover_schema_no_tables() -> None:
    """GET /connectors/{name} with no table whitelist → empty tables."""
    respx.get("http://kafka-connect:8083/connectors/bare-connector").mock(
        return_value=httpx.Response(200, json={
            "name": "bare-connector",
            "config": {
                "connector.class": "io.debezium.connector.mysql.MySqlConnector",
            },
        })
    )
    engine = DebeziumEngine(
        base_url="http://kafka-connect:8083",
        max_retries=0,
    )
    result = await engine.discover_source_schema("cdc-001", "bare-connector")
    assert result["tables"] == []
    await engine.close()


# ---------------------------------------------------------------------------
# test_connection tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
@respx.mock
async def test_debezium_test_connection_success() -> None:
    """test_connection creates a connector, checks status, and cleans up."""
    respx.post("http://kafka-connect:8083/connectors").mock(
        return_value=httpx.Response(201, json={
            "name": "test-cdc-001",
            "config": {},
            "status": {
                "connector": {"state": "RUNNING"},
                "tasks": [{"id": 0, "state": "RUNNING"}],
            },
        })
    )
    respx.get("http://kafka-connect:8083/connectors/test-cdc-001/status").mock(
        return_value=httpx.Response(200, json={
            "name": "test-cdc-001",
            "connector": {"state": "RUNNING"},
            "tasks": [{"id": 0, "state": "RUNNING"}],
        })
    )
    respx.delete("http://kafka-connect:8083/connectors/test-cdc-001").mock(
        return_value=httpx.Response(204)
    )
    engine = DebeziumEngine(
        base_url="http://kafka-connect:8083",
        max_retries=0,
    )
    result = await engine.test_connection(
        "cdc-001",
        connector_class="io.debezium.connector.mysql.MySqlConnector",
        config={"database.hostname": "mysql.example.com"},
    )
    assert result["ok"] is True
    assert result["status"] == "running"
    await engine.close()


@pytest.mark.asyncio
@respx.mock
async def test_debezium_test_connection_failure() -> None:
    """test_connection returns ok=False when connector creation fails."""
    respx.post("http://kafka-connect:8083/connectors").mock(
        return_value=httpx.Response(400, text="Bad config")
    )
    # The cleanup (DELETE) is called even on failure — but connector was not
    # created, so DELETE will also fail. The engine handles this silently.
    respx.delete("http://kafka-connect:8083/connectors/test-cdc-001").mock(
        return_value=httpx.Response(404, text="Not found")
    )
    engine = DebeziumEngine(
        base_url="http://kafka-connect:8083",
        max_retries=0,
    )
    result = await engine.test_connection(
        "cdc-001",
        connector_class="io.debezium.connector.mysql.MySqlConnector",
        config={"bad": "config"},
    )
    assert result["ok"] is False
    assert "error" in result
    await engine.close()


# ---------------------------------------------------------------------------
# AsyncDataClient delegation tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_data_client_delegates_start() -> None:
    """AsyncDataClient.start_cdc_task delegates to DebeziumEngine."""
    mock_debezium = MagicMock(spec=DebeziumEngine)
    mock_debezium.start_cdc_task = AsyncMock(return_value=MagicMock(
        task_id="cdc-001", connector_name="orders-connector",
        status="running",
    ))
    mock_debezium.close = AsyncMock()

    client = AsyncDataClient(
        base_url="http://localhost",
        debezium_engine=mock_debezium,  # type: ignore[arg-type]
    )
    result = await client.start_cdc_task(
        "cdc-001",
        connector_name="orders-connector",
        connector_class="io.debezium.connector.mysql.MySqlConnector",
        config={"database.hostname": "mysql.example.com"},
    )
    mock_debezium.start_cdc_task.assert_called_once()
    assert result.task_id == "cdc-001"
    await client.close()


@pytest.mark.asyncio
async def test_data_client_delegates_stop() -> None:
    """AsyncDataClient.stop_cdc_task delegates to DebeziumEngine."""
    mock_debezium = MagicMock(spec=DebeziumEngine)
    mock_debezium.stop_cdc_task = AsyncMock(return_value=MagicMock(
        task_id="cdc-001", connector_name="orders-connector",
        status="stopped",
    ))
    mock_debezium.close = AsyncMock()

    client = AsyncDataClient(
        base_url="http://localhost",
        debezium_engine=mock_debezium,  # type: ignore[arg-type]
    )
    result = await client.stop_cdc_task("cdc-001", "orders-connector")
    mock_debezium.stop_cdc_task.assert_called_once_with("cdc-001", "orders-connector")
    assert result.status == "stopped"
    await client.close()


@pytest.mark.asyncio
async def test_data_client_delegates_test_connection() -> None:
    """AsyncDataClient.test_connection delegates to DebeziumEngine."""
    mock_debezium = MagicMock(spec=DebeziumEngine)
    mock_debezium.test_connection = AsyncMock(return_value={
        "task_id": "cdc-001", "ok": True, "status": "running",
    })
    mock_debezium.close = AsyncMock()

    client = AsyncDataClient(
        base_url="http://localhost",
        debezium_engine=mock_debezium,  # type: ignore[arg-type]
    )
    result = await client.test_connection(
        "cdc-001",
        connector_class="io.debezium.connector.mysql.MySqlConnector",
        config={"database.hostname": "mysql.example.com"},
    )
    mock_debezium.test_connection.assert_called_once()
    assert result["ok"] is True
    await client.close()


def test_data_client_requires_base_url() -> None:
    """AsyncDataClient with empty base_url → ValueError."""
    with pytest.raises(ValueError, match="base_url is required"):
        AsyncDataClient(base_url="")
