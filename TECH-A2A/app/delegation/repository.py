"""Data access layer for Delegated Tasks."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Any, Optional

from app.delegation.schemas import DelegatedTask, TaskStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return f"task-{uuid.uuid4().hex[:24]}"


class DelegationRepository(ABC):
    """Abstract repository contract."""

    @abstractmethod
    async def create(self, task: DelegatedTask) -> DelegatedTask: ...

    @abstractmethod
    async def get(self, task_id: str, tenant_id: str) -> Optional[DelegatedTask]: ...

    @abstractmethod
    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[TaskStatus] = None,
        source_agent_id: Optional[str] = None,
        target_agent_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[DelegatedTask], int]: ...

    @abstractmethod
    async def update(
        self, task_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[DelegatedTask]: ...

    @abstractmethod
    async def delete(self, task_id: str, tenant_id: str) -> bool: ...

    @abstractmethod
    async def list_all(self) -> list[DelegatedTask]: ...


class InMemoryDelegationRepository(DelegationRepository):
    """Thread-safe in-memory repository."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._store: dict[tuple[str, str], DelegatedTask] = {}

    async def create(self, task: DelegatedTask) -> DelegatedTask:
        with self._lock:
            if not task.id:
                task.id = _new_id()
            task.created_at = _now()
            task.updated_at = task.created_at
            self._store[(task.tenant_id, task.id)] = task
            return task

    async def get(self, task_id: str, tenant_id: str) -> Optional[DelegatedTask]:
        with self._lock:
            return self._store.get((tenant_id, task_id))

    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[TaskStatus] = None,
        source_agent_id: Optional[str] = None,
        target_agent_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[DelegatedTask], int]:
        with self._lock:
            results = []
            for (tid, _), task in self._store.items():
                if tid != tenant_id:
                    continue
                if status is not None and task.status != status:
                    continue
                if source_agent_id is not None and task.source_agent_id != source_agent_id:
                    continue
                if target_agent_id is not None and task.target_agent_id != target_agent_id:
                    continue
                results.append(task)
        results.sort(key=lambda t: t.created_at)
        total = len(results)
        start = (page - 1) * page_size
        end = start + page_size
        return results[start:end], total

    async def update(
        self, task_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[DelegatedTask]:
        with self._lock:
            task = self._store.get((tenant_id, task_id))
            if task is None:
                return None
            updated = task.model_copy(update=fields)
            updated.updated_at = _now()
            self._store[(tenant_id, task_id)] = updated
            return updated

    async def delete(self, task_id: str, tenant_id: str) -> bool:
        with self._lock:
            return self._store.pop((tenant_id, task_id), None) is not None

    async def list_all(self) -> list[DelegatedTask]:
        with self._lock:
            return list(self._store.values())

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
