"""Tests for SQL query execution, execution plan, export and history (V13-12)."""

from __future__ import annotations

import json

import pytest
from httpx import AsyncClient

from app.models.schemas import ConnectionConfig, CreateDataSourceRequest, DataSourceType
from app.services.query_service import (
    InMemoryQueryHistoryRepository,
    MockQueryExecutor,
    QueryService,
    is_read_only_sql,
)

TENANT = "tenant-test"
TRACE = "test-trace-001"
BASE = "/api/v1/data"

CREATE_BODY = {
    "name": "query-pg",
    "source_type": "POSTGRESQL",
    "connection_config": {
        "host": "localhost",
        "port": 5432,
        "database": "testdb",
        "username": "user",
        "password": "secret",
    },
}


# ---------------------------------------------------------------- read-only check


def test_is_read_only_sql_accepts_select() -> None:
    assert is_read_only_sql("SELECT * FROM users") is True


def test_is_read_only_sql_accepts_with() -> None:
    assert is_read_only_sql("WITH t AS (SELECT 1) SELECT * FROM t") is True


def test_is_read_only_sql_rejects_insert() -> None:
    assert is_read_only_sql("INSERT INTO users VALUES (1)") is False


def test_is_read_only_sql_rejects_update() -> None:
    assert is_read_only_sql("UPDATE users SET name = 'x'") is False


def test_is_read_only_sql_rejects_delete() -> None:
    assert is_read_only_sql("DELETE FROM users") is False


def test_is_read_only_sql_rejects_drop() -> None:
    assert is_read_only_sql("DROP TABLE users") is False


def test_is_read_only_sql_rejects_alter() -> None:
    assert is_read_only_sql("ALTER TABLE users ADD COLUMN age INT") is False


def test_is_read_only_sql_rejects_create() -> None:
    assert is_read_only_sql("CREATE TABLE users (id INT)") is False


def test_is_read_only_sql_rejects_truncate() -> None:
    assert is_read_only_sql("TRUNCATE TABLE users") is False


def test_is_read_only_sql_ignores_keywords_in_strings() -> None:
    assert is_read_only_sql("SELECT * FROM t WHERE name = 'drop table'") is True


def test_is_read_only_sql_rejects_multiple_statements() -> None:
    assert is_read_only_sql("SELECT 1; DROP TABLE t") is False


# ---------------------------------------------------------------- service tests


@pytest.fixture
def query_service(ds_service: object) -> QueryService:
    executor = MockQueryExecutor()
    repo = InMemoryQueryHistoryRepository()
    return QueryService(ds_service, executor, repo)


async def test_execute_query_success(query_service: QueryService) -> None:
    ds_service = query_service._datasource_service
    ds = await ds_service.create(
        TENANT,
        CreateDataSourceRequest(
            name="query-pg",
            source_type=DataSourceType.POSTGRESQL,
            connection_config=ConnectionConfig(
                host="localhost",
                port=5432,
                database="testdb",
                username="user",
                password="secret",
            ),
        ),
    )

    result = await query_service.execute(
        TENANT, ds.id, "SELECT id, name FROM users"
    )

    assert result.query_id.startswith("q-")
    assert result.columns == ["id", "name"]
    assert result.row_count == 2
    assert result.execution_time >= 0


async def test_execute_query_rejects_write_sql(query_service: QueryService) -> None:
    ds_service = query_service._datasource_service
    ds = await ds_service.create(
        TENANT,
        CreateDataSourceRequest(
            name="query-pg-2",
            source_type=DataSourceType.POSTGRESQL,
            connection_config=ConnectionConfig(host="localhost"),
        ),
    )

    from app.common.errors import InvalidParamError

    with pytest.raises(InvalidParamError) as exc_info:
        await query_service.execute(TENANT, ds.id, "DROP TABLE users")

    assert exc_info.value.code == 40001


async def test_execution_plan_returns_stored_plan(query_service: QueryService) -> None:
    ds_service = query_service._datasource_service
    ds = await ds_service.create(
        TENANT,
        CreateDataSourceRequest(
            name="query-pg-3",
            source_type=DataSourceType.POSTGRESQL,
            connection_config=ConnectionConfig(host="localhost"),
        ),
    )

    result = await query_service.execute(
        TENANT, ds.id, "SELECT id FROM users"
    )
    plan = await query_service.execution_plan(TENANT, result.query_id)

    assert plan is not None
    assert plan.get("plan") == "mock"


async def test_export_csv(query_service: QueryService) -> None:
    ds_service = query_service._datasource_service
    ds = await ds_service.create(
        TENANT,
        CreateDataSourceRequest(
            name="query-pg-4",
            source_type=DataSourceType.POSTGRESQL,
            connection_config=ConnectionConfig(host="localhost"),
        ),
    )

    result = await query_service.execute(
        TENANT, ds.id, "SELECT id, name FROM users"
    )
    content, _, _ = await query_service.export(TENANT, result.query_id, "csv")

    assert b"id,name" in content
    assert b"Alice" in content


async def test_export_json(query_service: QueryService) -> None:
    ds_service = query_service._datasource_service
    ds = await ds_service.create(
        TENANT,
        CreateDataSourceRequest(
            name="query-pg-5",
            source_type=DataSourceType.POSTGRESQL,
            connection_config=ConnectionConfig(host="localhost"),
        ),
    )

    result = await query_service.execute(
        TENANT, ds.id, "SELECT id, name FROM users"
    )
    content, _, _ = await query_service.export(TENANT, result.query_id, "json")
    parsed = json.loads(content)

    assert isinstance(parsed, list)
    assert parsed[0]["name"] == "Alice"


async def test_history_lists_executed_queries(query_service: QueryService) -> None:
    ds_service = query_service._datasource_service
    ds = await ds_service.create(
        TENANT,
        CreateDataSourceRequest(
            name="query-pg-6",
            source_type=DataSourceType.POSTGRESQL,
            connection_config=ConnectionConfig(host="localhost"),
        ),
    )

    await query_service.execute(TENANT, ds.id, "SELECT id FROM users")
    items, total = await query_service.history(TENANT)

    assert total == 1
    assert items[0].sql == "SELECT id FROM users"


# ---------------------------------------------------------------- controller tests


async def test_execute_query_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(
        f"{BASE}/datasources", json=CREATE_BODY, headers=tenant_headers
    )
    assert resp.status_code == 200
    ds_id = resp.json()["data"]["id"]

    resp = await client.post(
        f"{BASE}/queries/execute",
        json={"dataSourceId": ds_id, "sql": "SELECT id, name FROM users"},
        headers=tenant_headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["traceId"] == TRACE
    data = body["data"]
    assert data["queryId"].startswith("q-")
    assert data["columns"] == ["id", "name"]
    assert data["rowCount"] == 2


async def test_execute_write_sql_api_returns_error(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(
        f"{BASE}/datasources", json=CREATE_BODY, headers=tenant_headers
    )
    ds_id = resp.json()["data"]["id"]

    resp = await client.post(
        f"{BASE}/queries/execute",
        json={"dataSourceId": ds_id, "sql": "DELETE FROM users"},
        headers=tenant_headers,
    )

    assert resp.status_code == 400
    body = resp.json()
    assert body["code"] == 40001


async def test_execution_plan_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(
        f"{BASE}/datasources", json=CREATE_BODY, headers=tenant_headers
    )
    ds_id = resp.json()["data"]["id"]

    resp = await client.post(
        f"{BASE}/queries/execute",
        json={"dataSourceId": ds_id, "sql": "SELECT id FROM users"},
        headers=tenant_headers,
    )
    query_id = resp.json()["data"]["queryId"]

    resp = await client.get(
        f"{BASE}/queries/{query_id}/execution-plan",
        headers=tenant_headers,
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["plan"]["plan"] == "mock"


async def test_export_csv_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(
        f"{BASE}/datasources", json=CREATE_BODY, headers=tenant_headers
    )
    ds_id = resp.json()["data"]["id"]

    resp = await client.post(
        f"{BASE}/queries/execute",
        json={"dataSourceId": ds_id, "sql": "SELECT id, name FROM users"},
        headers=tenant_headers,
    )
    query_id = resp.json()["data"]["queryId"]

    resp = await client.post(
        f"{BASE}/queries/{query_id}/export?format=csv",
        headers=tenant_headers,
    )

    assert resp.status_code == 200
    assert resp.headers["content-type"] == "text/csv; charset=utf-8"
    assert b"id,name" in resp.content


async def test_query_history_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    resp = await client.post(
        f"{BASE}/datasources", json=CREATE_BODY, headers=tenant_headers
    )
    ds_id = resp.json()["data"]["id"]

    await client.post(
        f"{BASE}/queries/execute",
        json={"dataSourceId": ds_id, "sql": "SELECT id FROM users"},
        headers=tenant_headers,
    )

    resp = await client.get(f"{BASE}/queries/history", headers=tenant_headers)

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["sql"] == "SELECT id FROM users"
