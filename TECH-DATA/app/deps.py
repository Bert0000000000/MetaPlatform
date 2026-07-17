"""Service registry & FastAPI dependencies for TECH-DATA.

The registry is a process-wide singleton. Tests use ``set_registry`` to
install an isolated registry (with mock connectors) between cases.
"""

from __future__ import annotations

from dataclasses import dataclass
from threading import RLock
from typing import Optional

from fastapi import Request

from app.catalog.service import CatalogService
from app.dbt.repository import InMemoryDbtRepository
from app.dbt.service import DbtService
from app.etl.repository import InMemoryEtlTaskRepository
from app.etl.service import EtlTaskService
from app.lakehouse.repository import InMemoryLakehouseRepository
from app.lakehouse.service import LakehouseService
from app.models.repository import DataSourceRepository, InMemoryDataSourceRepository
from app.monitoring.service import MonitoringService
from app.quality.service import QualityService
from app.services.connectors import ConnectionTester, SchemaExplorer
from app.services.datasource_service import DataSourceService
from app.services.schema_discovery_service import SchemaDiscoveryService
from app.warehouse.service import WarehouseService


@dataclass
class Registry:
    repository: DataSourceRepository
    tester: Optional[ConnectionTester]
    explorer: Optional[SchemaExplorer]
    datasource_service: DataSourceService
    schema_discovery_service: SchemaDiscoveryService
    etl_service: EtlTaskService
    dbt_service: DbtService
    lakehouse_service: LakehouseService
    warehouse_service: WarehouseService
    catalog_service: CatalogService
    quality_service: QualityService
    monitoring_service: MonitoringService

    def reset(self) -> None:
        """Clear in-memory state and rebind mock connectors."""

        if isinstance(self.repository, InMemoryDataSourceRepository):
            self.repository.clear()
        self.datasource_service._tester = self.tester  # type: ignore[attr-defined]
        self.schema_discovery_service._explorer = self.explorer  # type: ignore[attr-defined]


_LOCK = RLock()
_REGISTRY: Optional[Registry] = None


def _build_default_registry() -> Registry:
    repo = InMemoryDataSourceRepository()
    ds_service = DataSourceService(repo, tester=None)
    schema_service = SchemaDiscoveryService(ds_service, explorer=None)
    etl_service = EtlTaskService(InMemoryEtlTaskRepository())
    dbt_service = DbtService(InMemoryDbtRepository())
    lakehouse_service = LakehouseService(InMemoryLakehouseRepository())
    warehouse_service = WarehouseService()
    catalog_service = CatalogService()
    quality_service = QualityService()
    monitoring_service = MonitoringService()
    return Registry(
        repository=repo,
        tester=None,
        explorer=None,
        datasource_service=ds_service,
        schema_discovery_service=schema_service,
        etl_service=etl_service,
        dbt_service=dbt_service,
        lakehouse_service=lakehouse_service,
        warehouse_service=warehouse_service,
        catalog_service=catalog_service,
        quality_service=quality_service,
        monitoring_service=monitoring_service,
    )


def get_registry() -> Registry:
    global _REGISTRY
    with _LOCK:
        if _REGISTRY is None:
            _REGISTRY = _build_default_registry()
        return _REGISTRY


def set_registry(registry: Optional[Registry]) -> None:
    """Test helper: install or clear the process-wide registry."""

    global _REGISTRY
    with _LOCK:
        _REGISTRY = registry


# -------------------------------------------------------------- FastAPI deps


def get_datasource_service(request: Request) -> DataSourceService:
    return request.app.state.registry.datasource_service


def get_schema_discovery_service(request: Request) -> SchemaDiscoveryService:
    return request.app.state.registry.schema_discovery_service


def get_repository(request: Request) -> DataSourceRepository:
    return request.app.state.registry.repository


def get_etl_service(request: Request) -> EtlTaskService:
    return request.app.state.registry.etl_service


def get_dbt_service(request: Request) -> DbtService:
    return request.app.state.registry.dbt_service


def get_lakehouse_service(request: Request) -> LakehouseService:
    return request.app.state.registry.lakehouse_service


def get_warehouse_service(request: Request) -> WarehouseService:
    return request.app.state.registry.warehouse_service


def get_catalog_service(request: Request) -> CatalogService:
    return request.app.state.registry.catalog_service


def get_quality_service(request: Request) -> QualityService:
    return request.app.state.registry.quality_service


def get_monitoring_service(request: Request) -> MonitoringService:
    return request.app.state.registry.monitoring_service
