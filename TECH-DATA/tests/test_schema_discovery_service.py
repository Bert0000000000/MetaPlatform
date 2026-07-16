"""Tests for SchemaDiscoveryService (S-DATA-03)."""

from __future__ import annotations

import pytest

from app.common.errors import DataSourceNotFoundError
from app.models.schemas import (
    ColumnInfo,
    ConnectionConfig,
    CreateDataSourceRequest,
    DataSourceType,
)
from app.services.datasource_service import DataSourceService
from app.services.schema_discovery_service import SchemaDiscoveryService

TENANT = "tenant-test"


def _make_request() -> CreateDataSourceRequest:
    return CreateDataSourceRequest(
        name="schema-src",
        source_type=DataSourceType.POSTGRESQL,
        connection_config=ConnectionConfig(
            host="localhost",
            port=5432,
            username="user",
            password="secret",
        ),
    )


async def _create_ds(ds_service: DataSourceService) -> str:
    ds = await ds_service.create(TENANT, _make_request())
    return ds.id


# --------------------------------------------------------- list databases


async def test_list_databases(
    ds_service: DataSourceService,
    schema_service: SchemaDiscoveryService,
    mock_explorer,
) -> None:
    """list_databases returns DatabaseInfo objects from the explorer."""

    ds_id = await _create_ds(ds_service)
    mock_explorer.add_database("app_db")
    mock_explorer.add_database("analytics_db")

    dbs = await schema_service.list_databases(TENANT, ds_id)

    names = [d.name for d in dbs]
    assert names == ["analytics_db", "app_db"]  # sorted


# ------------------------------------------------------------ list tables


async def test_list_tables(
    ds_service: DataSourceService,
    schema_service: SchemaDiscoveryService,
    mock_explorer,
) -> None:
    """list_tables returns TableInfo objects for the given database."""

    ds_id = await _create_ds(ds_service)
    mock_explorer.add_table("app_db", "users", [])
    mock_explorer.add_table("app_db", "orders", [])

    tables = await schema_service.list_tables(TENANT, ds_id, "app_db")

    assert len(tables) == 2
    assert tables[0].name == "orders"  # sorted
    assert tables[1].name == "users"
    assert tables[0].schema == "app_db"


# ----------------------------------------------------------- list columns


async def test_list_columns(
    ds_service: DataSourceService,
    schema_service: SchemaDiscoveryService,
    mock_explorer,
) -> None:
    """list_columns returns ColumnInfo objects for the given table."""

    ds_id = await _create_ds(ds_service)
    cols = [
        ColumnInfo(name="id", type="integer", nullable=False, isPrimaryKey=True),
        ColumnInfo(name="email", type="varchar", nullable=False),
    ]
    mock_explorer.add_table("app_db", "users", cols)

    columns = await schema_service.list_columns(TENANT, ds_id, "app_db", "users")

    assert len(columns) == 2
    assert columns[0].name == "id"
    assert columns[0].isPrimaryKey is True
    assert columns[1].name == "email"
    assert columns[1].nullable is False


# --------------------------------------------------- datasource not found


async def test_list_databases_datasource_not_found(
    schema_service: SchemaDiscoveryService,
) -> None:
    """list_databases raises 40401 when the data source does not exist."""

    with pytest.raises(DataSourceNotFoundError) as exc_info:
        await schema_service.list_databases(TENANT, "ds-nope")

    assert int(exc_info.value.code) == 40401
