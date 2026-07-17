"""ETL task management service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.common.errors import (
    DataSourceNotFoundError,
    InvalidParamError,
)
from app.etl.orm import EtlRunORM, EtlRunStatus, EtlTaskORM
from app.etl.repository import EtlTaskRepository, _new_run_id, _new_task_id
from app.etl.schemas import (
    CreateEtlTaskRequest,
    EtlRunInfo,
    EtlTask,
    EtlTaskType,
    UpdateEtlTaskRequest,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class EtlTaskService:
    def __init__(self, repository: EtlTaskRepository) -> None:
        self._repo = repository

    async def create(
        self,
        tenant_id: str,
        request: CreateEtlTaskRequest,
    ) -> EtlTask:
        task = EtlTaskORM(
            id=_new_task_id(),
            tenant_id=tenant_id,
            name=request.name,
            type=request.type,
            config=request.config,
            schedule=request.schedule,
            enabled=request.enabled,
            created_at=_now(),
            updated_at=_now(),
        )
        saved = await self._repo.insert(task)
        return self._to_task(saved)

    async def list(
        self,
        tenant_id: str,
        *,
        type: Optional[EtlTaskType] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        items, total = await self._repo.list(
            tenant_id, type=type, page=page, page_size=page_size
        )
        return {
            "items": [self._to_task(t).model_dump() for t in items],
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": (total + page_size - 1) // page_size if page_size else 0,
        }

    async def get(self, tenant_id: str, task_id: str) -> EtlTask:
        task = await self._repo.get(task_id, tenant_id)
        if task is None:
            raise DataSourceNotFoundError(
                f"ETL 任务不存在: id={task_id}",
                data={"id": task_id},
            )
        return self._to_task(task)

    async def update(
        self,
        tenant_id: str,
        task_id: str,
        request: UpdateEtlTaskRequest,
    ) -> EtlTask:
        task = await self.get(tenant_id, task_id)
        fields: dict[str, Any] = {}
        if request.name is not None:
            fields["name"] = request.name
        if request.config is not None:
            fields["config"] = request.config
        if request.schedule is not None:
            fields["schedule"] = request.schedule
        if request.enabled is not None:
            fields["enabled"] = request.enabled
        if not fields:
            return self._to_task(task)
        updated = await self._repo.update(task_id, tenant_id, fields)
        if updated is None:
            raise DataSourceNotFoundError(
                f"ETL 任务不存在: id={task_id}", data={"id": task_id}
            )
        return self._to_task(updated)

    async def delete(self, tenant_id: str, task_id: str) -> Dict[str, Any]:
        await self.get(tenant_id, task_id)
        await self._repo.delete(task_id, tenant_id)
        return {"id": task_id, "deleted": True}

    async def trigger(
        self, tenant_id: str, task_id: str
    ) -> EtlRunInfo:
        task = await self.get(tenant_id, task_id)
        run = EtlRunORM(
            id=_new_run_id(),
            tenant_id=tenant_id,
            task_id=task.id,
            status=EtlRunStatus.SUCCESS,
            started_at=_now(),
            finished_at=_now(),
            records_processed=0,
            message="manual trigger (mock)",
        )
        saved = await self._repo.insert_run(run)
        # Update task last_run/last_status
        await self._repo.update(
            task_id,
            tenant_id,
            {"last_run_at": _now(), "last_status": EtlRunStatus.SUCCESS},
        )
        return self._to_run(saved)

    async def list_runs(
        self,
        tenant_id: str,
        task_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        await self.get(tenant_id, task_id)
        items, total = await self._repo.list_runs(
            tenant_id, task_id, page=page, page_size=page_size
        )
        return {
            "items": [self._to_run(r).model_dump() for r in items],
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": (total + page_size - 1) // page_size if page_size else 0,
        }

    # ----------------------------------------------------------- helpers

    def _to_task(self, task: EtlTaskORM) -> EtlTask:
        return EtlTask(
            id=task.id,
            tenantId=task.tenant_id,
            name=task.name,
            type=task.type,
            config=task.config,
            schedule=task.schedule,
            enabled=task.enabled,
            lastRunAt=task.last_run_at,
            lastStatus=task.last_status,
            createdAt=task.created_at,
            updatedAt=task.updated_at,
        )

    def _to_run(self, run: EtlRunORM) -> EtlRunInfo:
        return EtlRunInfo(
            runId=run.id,
            taskId=run.task_id,
            status=run.status,
            startedAt=run.started_at,
            finishedAt=run.finished_at,
            recordsProcessed=run.records_processed,
            message=run.message,
        )