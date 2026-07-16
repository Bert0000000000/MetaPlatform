"""Schema discovery service (S-DATA-03).

Reads a persisted data source, decrypts its credentials and delegates to a
:class:`SchemaExplorer` to list databases / tables / columns.
"""

from __future__ import annotations

from typing import Optional

from app.services.connectors import SchemaExplorer, build_schema_explorer
from app.services.datasource_service import DataSourceService
from app.models.schemas import ColumnInfo, DatabaseInfo, TableInfo


class SchemaDiscoveryService:
    def __init__(
        self,
        datasource_service: DataSourceService,
        explorer: Optional[SchemaExplorer] = None,
    ) -> None:
        self._ds_service = datasource_service
        self._explorer = explorer

    def _resolve_explorer(self, source_type) -> SchemaExplorer:
        if self._explorer is not None:
            return self._explorer
        return build_schema_explorer(source_type)

    async def _decrypted_config(self, tenant_id: str, ds_id: str) -> tuple:
        ds = await self._ds_service.get(tenant_id, ds_id)
        config = DataSourceService._decrypt_config(ds.connection_config)
        return ds, config

    async def list_databases(
        self, tenant_id: str, ds_id: str
    ) -> list[DatabaseInfo]:
        ds, config = await self._decrypted_config(tenant_id, ds_id)
        explorer = self._resolve_explorer(ds.source_type)
        names = await explorer.list_databases(config)
        return [DatabaseInfo(name=n) for n in names]

    async def list_tables(
        self, tenant_id: str, ds_id: str, db: str
    ) -> list[TableInfo]:
        ds, config = await self._decrypted_config(tenant_id, ds_id)
        explorer = self._resolve_explorer(ds.source_type)
        return await explorer.list_tables(config, db)

    async def list_columns(
        self, tenant_id: str, ds_id: str, db: str, table: str
    ) -> list[ColumnInfo]:
        ds, config = await self._decrypted_config(tenant_id, ds_id)
        explorer = self._resolve_explorer(ds.source_type)
        return await explorer.list_columns(config, db, table)
