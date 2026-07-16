"""HTTP controller tests for TECH-DATA API endpoints."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.models.schemas import ColumnInfo

TENANT = "tenant-test"
TRACE = "test-trace-001"

CREATE_BODY = {
    "name": "api-pg",
    "source_type": "POSTGRESQL",
    "connection_config": {
        "host": "localhost",
        "port": 5432,
        "database": "testdb",
        "username": "user",
        "password": "secret",
    },
}

BASE = "/api/v1/data"


# --------------------------------------------------- POST /datasources


async def test_create_datasource_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """POST /datasources creates a data source and returns code 0."""

    resp = await client.post(
        f"{BASE}/datasources",
        json=CREATE_BODY,
        headers=tenant_headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["traceId"] == TRACE
    data = body["data"]
    assert data["name"] == "api-pg"
    assert data["sourceType"] == "POSTGRESQL"
    assert data["status"] == "ACTIVE"
    # Password must be masked in the response.
    assert data["connectionConfig"]["password"] == "********"


# ---------------------------------------------------- GET /datasources


async def test_list_datasources_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
) -> None:
    """GET /datasources returns a paginated list."""

    # Create two data sources.
    for i in range(2):
        body = dict(CREATE_BODY)
        body["name"] = f"api-pg-{i}"
        resp = await client.post(f"{BASE}/datasources", json=body, headers=tenant_headers)
        assert resp.status_code == 200

    resp = await client.get(f"{BASE}/datasources", headers=tenant_headers)

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 2
    assert data["page"] == 1
    assert len(data["items"]) == 2


# ----------------------------------------------- POST /datasources/{id}/test


async def test_test_connection_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
    mock_tester,
) -> None:
    """POST /datasources/{id}/test runs a connection test."""

    # Create data source.
    resp = await client.post(
        f"{BASE}/datasources",
        json=CREATE_BODY,
        headers=tenant_headers,
    )
    ds_id = resp.json()["data"]["id"]

    mock_tester.force_success = True
    resp = await client.post(
        f"{BASE}/datasources/{ds_id}/test",
        headers=tenant_headers,
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["success"] is True


# ------------------------------------- GET /datasources/{id}/schemas


async def test_schema_discovery_api(
    client: AsyncClient,
    tenant_headers: dict[str, str],
    mock_explorer,
) -> None:
    """GET /datasources/{id}/schemas returns the list of databases."""

    # Create data source.
    resp = await client.post(
        f"{BASE}/datasources",
        json=CREATE_BODY,
        headers=tenant_headers,
    )
    ds_id = resp.json()["data"]["id"]

    mock_explorer.add_database("db_alpha")
    mock_explorer.add_database("db_beta")
    mock_explorer.add_table(
        "db_alpha",
        "users",
        [ColumnInfo(name="id", type="bigint", nullable=False, isPrimaryKey=True)],
    )

    # List databases.
    resp = await client.get(
        f"{BASE}/datasources/{ds_id}/schemas",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 2
    db_names = [d["name"] for d in data["items"]]
    assert "db_alpha" in db_names
    assert "db_beta" in db_names

    # List tables in db_alpha.
    resp = await client.get(
        f"{BASE}/datasources/{ds_id}/schemas/db_alpha/tables",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["name"] == "users"

    # List columns in db_alpha.users.
    resp = await client.get(
        f"{BASE}/datasources/{ds_id}/schemas/db_alpha/tables/users/columns",
        headers=tenant_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["name"] == "id"
    assert data["items"][0]["isPrimaryKey"] is True
