"""Service registry & FastAPI dependencies for TECH-DATA.

The registry is a process-wide singleton. Tests use ``set_registry`` to
install an isolated registry (with mock connectors) between cases.
"""

from __future__ import annotations

from dataclasses import dataclass
from threading import RLock
from typing import Optional

from fastapi import Request

from app.models.repository import DataSourceRepository, InMemoryDataSourceRepository
from app.services.connectors import ConnectionTester, SchemaExplorer
from app.services.datasource_service import DataSourceService
from app.services.schema_discovery_service import SchemaDiscoveryService


@dataclass
class Registry:
    repository: DataSourceRepository
    tester: Optional[ConnectionTester]
    explorer: Optional[SchemaExplorer]
    datasource_service: DataSourceService
    schema_discovery_service: SchemaDiscoveryService

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
    return Registry(
        repository=repo,
        tester=None,
        explorer=None,
        datasource_service=ds_service,
        schema_discovery_service=schema_service,
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
