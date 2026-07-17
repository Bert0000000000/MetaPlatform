"""Lakehouse service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from app.common.errors import DataSourceNotFoundError, InvalidParamError
from app.lakehouse.orm import (
    IngestMode,
    IngestStatus,
    LakeIngestTaskORM,
    LakeTableORM,
)
from app.lakehouse.repository import (
    InMemoryLakehouseRepository,
    LakehouseRepository,
    _new_task_id,
)
from app.lakehouse.schemas import (
    CreateIngestTaskRequest,
    CreateLakeTableRequest,
    IngestTask,
    LakeTable,
    UpdateLakeTableRequest,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class LakehouseService:
    def __init__(self, repository: LakehouseRepository) -> None:
        self._repo = repository

    # ---------------------------------------------------- tables

    async def create_table(
        self, tenant_id: str, request: CreateLakeTableRequest
    ) -> LakeTable:
        existing = [
            t
            for (tid, _), t in []
        ]
        t = LakeTableORM(
            id="",
            tenant_id=tenant_id,
            name=request.name,
            format=request.format,
            location=request.location,
            partition_config=request.partitionConfig,
            schema=request.schema,
        )
        saved = await self._repo.insert_table(t)
        return self._to_table(saved)

    async def list_tables(
        self,
        tenant_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        items, total = await self._repo.list_tables(
            tenant_id, page=page, page_size=page_size
        )
        return {
            "items": [self._to_table(t).model_dump() for t in items],
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": (total + page_size - 1) // page_size if page_size else 0,
        }

    async def get_table(self, tenant_id: str, table_id: str) -> LakeTable:
        t = await self._repo.get_table(table_id, tenant_id)
        if t is None:
            raise DataSourceNotFoundError(
                f"湖表不存在: id={table_id}", data={"id": table_id}
            )
        return self._to_table(t)

    async def update_table(
        self,
        tenant_id: str,
        table_id: str,
        request: UpdateLakeTableRequest,
    ) -> LakeTable:
        await self.get_table(tenant_id, table_id)
        fields: Dict[str, Any] = {}
        if request.location is not None:
            fields["location"] = request.location
        if request.partitionConfig is not None:
            fields["partition_config"] = request.partitionConfig
        if request.schema is not None:
            fields["schema"] = request.schema
        updated = await self._repo.update_table(table_id, tenant_id, fields)
        if updated is None:
            raise DataSourceNotFoundError(
                f"湖表不存在: id={table_id}", data={"id": table_id}
            )
        return self._to_table(updated)

    async def delete_table(
        self, tenant_id: str, table_id: str
    ) -> Dict[str, Any]:
        await self.get_table(tenant_id, table_id)
        ok = await self._repo.soft_delete_table(table_id, tenant_id)
        if not ok:
            raise DataSourceNotFoundError(
                f"湖表不存在: id={table_id}", data={"id": table_id}
            )
        return {"id": table_id, "deleted": True}

    # ---------------------------------------------------- ingest

    async def create_ingest_task(
        self,
        tenant_id: str,
        table_id: str,
        request: CreateIngestTaskRequest,
    ) -> IngestTask:
        await self.get_table(tenant_id, table_id)
        task = LakeIngestTaskORM(
            id=_new_task_id(),
            tenant_id=tenant_id,
            table_id=table_id,
            source_datasource_id=request.sourceDatasourceId,
            mode=request.mode,
            status=IngestStatus.PENDING,
        )
        saved = await self._repo.insert_task(task)
        return self._to_task(saved)

    async def run_ingest_task(
        self, tenant_id: str, table_id: str, task_id: str
    ) -> IngestTask:
        await self.get_table(tenant_id, table_id)
        tasks = await self._repo.list_tasks(tenant_id, table_id)
        for t in tasks:
            if t.id == task_id:
                t.status = IngestStatus.SUCCESS
                t.last_run_at = _now()
                await self._repo.update_task(t)
                return self._to_task(t)
        raise DataSourceNotFoundError(
            f"摄入任务不存在: id={task_id}", data={"id": task_id}
        )

    async def list_ingest_tasks(
        self, tenant_id: str, table_id: str
    ) -> List[IngestTask]:
        await self.get_table(tenant_id, table_id)
        items = await self._repo.list_tasks(tenant_id, table_id)
        return [self._to_task(t) for t in items]

    # ---------------------------------------------------- helpers

    def _to_table(self, t: LakeTableORM) -> LakeTable:
        return LakeTable(
            id=t.id,
            tenantId=t.tenant_id,
            name=t.name,
            format=t.format,
            location=t.location,
            partitionConfig=t.partition_config,
            schema=t.schema,
            createdAt=t.created_at,
            updatedAt=t.updated_at,
        )

    def _to_task(self, t: LakeIngestTaskORM) -> IngestTask:
        return IngestTask(
            id=t.id,
            tenantId=t.tenant_id,
            tableId=t.table_id,
            sourceDatasourceId=t.source_datasource_id,
            mode=t.mode,
            status=t.status,
            lastRunAt=t.last_run_at,
            createdAt=t.created_at,
        )