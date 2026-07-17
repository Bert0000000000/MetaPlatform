"""Shared pytest fixtures for TECH-DATA tests.

Every test gets a fresh in-memory registry with mock connectors so no real
database connection is ever required.
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.v1.router import router as v1_router
from app.common.middleware import (
    install_exception_handlers,
    install_trace_id_middleware,
)
from app.deps import Registry
from app.models.repository import InMemoryDataSourceRepository
from app.services.connectors import (
    MockConnectionTester,
    MockSchemaExplorer,
)
from app.services.datasource_service import DataSourceService
from app.services.schema_discovery_service import SchemaDiscoveryService
from app.etl.repository import InMemoryEtlTaskRepository
from app.etl.service import EtlTaskService
from app.dbt.repository import InMemoryDbtRepository
from app.dbt.service import DbtService
from app.lakehouse.repository import InMemoryLakehouseRepository
from app.lakehouse.service import LakehouseService
from app.warehouse.service import WarehouseService
from app.catalog.service import CatalogService
from app.quality.service import QualityService
from app.monitoring.service import MonitoringService

TENANT_ID = "tenant-default"
TRACE_ID = "test-trace-001"


# --------------------------------------------------------------- core fixtures


@pytest.fixture
def mock_repository() -> InMemoryDataSourceRepository:
    return InMemoryDataSourceRepository()


@pytest.fixture
def mock_tester() -> MockConnectionTester:
    return MockConnectionTester()


@pytest.fixture
def mock_explorer() -> MockSchemaExplorer:
    return MockSchemaExplorer()


@pytest.fixture
def ds_service(
    mock_repository: InMemoryDataSourceRepository,
    mock_tester: MockConnectionTester,
) -> DataSourceService:
    return DataSourceService(mock_repository, tester=mock_tester)


@pytest.fixture
def schema_service(
    ds_service: DataSourceService,
    mock_explorer: MockSchemaExplorer,
) -> SchemaDiscoveryService:
    return SchemaDiscoveryService(ds_service, explorer=mock_explorer)


@pytest.fixture
def registry(
    mock_repository: InMemoryDataSourceRepository,
    mock_tester: MockConnectionTester,
    mock_explorer: MockSchemaExplorer,
    ds_service: DataSourceService,
    schema_service: SchemaDiscoveryService,
) -> Registry:
    return Registry(
        repository=mock_repository,
        tester=mock_tester,
        explorer=mock_explorer,
        datasource_service=ds_service,
        schema_discovery_service=schema_service,
        etl_service=EtlTaskService(InMemoryEtlTaskRepository()),
        dbt_service=DbtService(InMemoryDbtRepository()),
        lakehouse_service=LakehouseService(InMemoryLakehouseRepository()),
        warehouse_service=WarehouseService(),
        catalog_service=CatalogService(),
        quality_service=QualityService(),
        monitoring_service=MonitoringService(),
    )


# --------------------------------------------------------------- FastAPI app


@pytest.fixture
def app(registry: Registry) -> FastAPI:
    application = FastAPI(title="TECH-DATA-Test")
    install_trace_id_middleware(application)
    install_exception_handlers(application)
    application.state.registry = registry
    application.include_router(v1_router)

    @application.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "UP"}

    return application


@pytest.fixture
async def client(app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def tenant_headers() -> dict[str, str]:
    """Standard request headers used by controller tests."""
    return {
        "X-Tenant-Id": TENANT_ID,
        "X-Trace-Id": TRACE_ID,
    }
