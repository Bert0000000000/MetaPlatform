"""Tests for DataSourceService (S-DATA-02)."""

from __future__ import annotations

import pytest

from app.common.errors import DataSourceNameDuplicateError, DataSourceNotFoundError
from app.models.schemas import (
    ConnectionConfig,
    CreateDataSourceRequest,
    DataSourceStatus,
    DataSourceType,
)
from app.services.datasource_service import DataSourceService

TENANT = "tenant-test"


def _make_request(
    name: str = "test-pg",
    source_type: DataSourceType = DataSourceType.POSTGRESQL,
    host: str = "localhost",
    password: str = "s3cret",
) -> CreateDataSourceRequest:
    return CreateDataSourceRequest(
        name=name,
        source_type=source_type,
        connection_config=ConnectionConfig(
            host=host,
            port=5432,
            database="testdb",
            username="user",
            password=password,
        ),
    )


# ----------------------------------------------------------------- create


async def test_create_datasource_success(
    ds_service: DataSourceService,
) -> None:
    """Creating a data source returns a persisted record with encrypted password."""

    ds = await ds_service.create(TENANT, _make_request())

    assert ds.id.startswith("ds-")
    assert ds.tenant_id == TENANT
    assert ds.name == "test-pg"
    assert ds.source_type == DataSourceType.POSTGRESQL
    assert ds.status == DataSourceStatus.ACTIVE
    # Password must be encrypted (not the plaintext).
    assert ds.connection_config["password"] != "s3cret"
    assert len(ds.connection_config["password"]) > 0


async def test_create_datasource_name_duplicate(
    ds_service: DataSourceService,
) -> None:
    """Creating two data sources with the same name in the same tenant raises 40901."""

    req = _make_request(name="dup-name")
    await ds_service.create(TENANT, req)

    with pytest.raises(DataSourceNameDuplicateError) as exc_info:
        await ds_service.create(TENANT, req)

    assert int(exc_info.value.code) == 40901
    assert exc_info.value.http_status == 409


# -------------------------------------------------------- connection test


async def test_test_connection_success(
    ds_service: DataSourceService,
    mock_tester,
) -> None:
    """Connection test succeeds when the mock tester is forced to succeed."""

    ds = await ds_service.create(TENANT, _make_request())
    mock_tester.force_success = True

    result = await ds_service.test_connection(TENANT, ds.id)

    assert result.success is True
    assert "mock" in result.message
    assert len(mock_tester.calls) == 1
    # The tester should receive the *decrypted* password.
    sent_config = mock_tester.calls[0][1]
    assert sent_config["password"] == "s3cret"


async def test_test_connection_failure(
    ds_service: DataSourceService,
    mock_tester,
) -> None:
    """Connection test returns failure when the mock tester is forced to fail."""

    ds = await ds_service.create(TENANT, _make_request())
    mock_tester.force_success = False

    result = await ds_service.test_connection(TENANT, ds.id)

    assert result.success is False


async def test_get_datasource_not_found(
    ds_service: DataSourceService,
) -> None:
    """Getting a non-existent data source raises 40401."""

    with pytest.raises(DataSourceNotFoundError) as exc_info:
        await ds_service.get(TENANT, "ds-nonexistent")

    assert int(exc_info.value.code) == 40401
