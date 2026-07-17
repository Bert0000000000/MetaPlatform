"""In-memory ETL task & run repositories."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import List, Optional

from app.etl.orm import EtlRunORM, EtlRunStatus, EtlTaskORM, EtlTaskType


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_task_id() -> str:
    return f"etl-{uuid.uuid4().hex[:16]}"


def _new_run_id() -> str:
    return f"run-{uuid.uuid4().hex[:16]}"


class EtlTaskRepository(ABC):
    @abstractmethod
    async def insert(self, task: EtlTaskORM) -> EtlTaskORM: ...

    @abstractmethod
    async def get(self, task_id: str, tenant_id: str) -> Optional[EtlTaskORM]: ...

    @abstractmethod
    async def list(
        self,
        tenant_id: str,
        *,
        type: Optional[EtlTaskType] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[EtlTaskORM], int]: ...

    @abstractmethod
    async def update(
        self, task_id: str, tenant_id: str, fields: dict
    ) -> Optional[EtlTaskORM]: ...

    @abstractmethod
    async def delete(self, task_id: str, tenant_id: str) -> bool: ...

    @abstractmethod
    async def insert_run(self, run: EtlRunORM) -> EtlRunORM: ...

    @abstractmethod
    async def update_run(self, run: EtlRunORM) -> EtlRunORM: ...

    @abstractmethod
    async def list_runs(
        self, tenant_id: str, task_id: str, *, page: int = 1, page_size: int = 20
    ) -> tuple[List[EtlRunORM], int]: ...


class InMemoryEtlTaskRepository(EtlTaskRepository):
    def __init__(self) -> None:
        self._lock = RLock()
        self._tasks: dict[tuple[str, str], EtlTaskORM] = {}
        self._runs: dict[tuple[str, str], List[EtlRunORM]] = {}

    async def insert(self, task: EtlTaskORM) -> EtlTaskORM:
        with self._lock:
            if not task.id:
                task.id = _new_task_id()
            task.created_at = _now()
            task.updated_at = task.created_at
            self._tasks[(task.tenant_id, task.id)] = task
            return task

    async def get(self, task_id: str, tenant_id: str) -> Optional[EtlTaskORM]:
        with self._lock:
            return self._tasks.get((tenant_id, task_id))

    async def list(
        self,
        tenant_id: str,
        *,
        type: Optional[EtlTaskType] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[EtlTaskORM], int]:
        with self._lock:
            results = [
                t
                for t in self._tasks.values()
                if t.tenant_id == tenant_id
                and (type is None or t.type == type)
            ]
        results.sort(key=lambda t: t.updated_at, reverse=True)
        total = len(results)
        start = (page - 1) * page_size
        end = start + page_size
        return results[start:end], total

    async def update(
        self, task_id: str, tenant_id: str, fields: dict
    ) -> Optional[EtlTaskORM]:
        with self._lock:
            task = self._tasks.get((tenant_id, task_id))
            if task is None:
                return None
            updated = task.model_copy(update=fields)
            updated.updated_at = _now()
            self._tasks[(tenant_id, task_id)] = updated
            return updated

    async def delete(self, task_id: str, tenant_id: str) -> bool:
        with self._lock:
            return self._tasks.pop((tenant_id, task_id), None) is not None

    async def insert_run(self, run: EtlRunORM) -> EtlRunORM:
        with self._lock:
            if not run.id:
                run.id = _new_run_id()
            self._runs.setdefault((run.tenant_id, run.task_id), []).append(run)
            return run

    async def update_run(self, run: EtlRunORM) -> EtlRunORM:
        with self._lock:
            runs = self._runs.setdefault((run.tenant_id, run.task_id), [])
            for idx, existing in enumerate(runs):
                if existing.id == run.id:
                    runs[idx] = run
                    return run
            runs.append(run)
            return run

    async def list_runs(
        self, tenant_id: str, task_id: str, *, page: int = 1, page_size: int = 20
    ) -> tuple[List[EtlRunORM], int]:
        with self._lock:
            runs = list(self._runs.get((tenant_id, task_id), []))
        runs.sort(key=lambda r: r.started_at, reverse=True)
        total = len(runs)
        start = (page - 1) * page_size
        end = start + page_size
        return runs[start:end], total

    def clear(self) -> None:
        with self._lock:
            self._tasks.clear()
            self._runs.clear()