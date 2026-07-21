"""In-memory repository for collaboration tasks (V15-04)."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Optional

from app.collaboration.schemas import CollaborationTask


def _new_id() -> str:
    return f"collab-{uuid.uuid4().hex[:24]}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CollaborationRepository(ABC):
    """Abstract repository for collaboration tasks."""

    @abstractmethod
    async def create(self, task: CollaborationTask) -> CollaborationTask: ...

    @abstractmethod
    async def get(self, task_id: str, tenant_id: str) -> Optional[CollaborationTask]: ...

    @abstractmethod
    async def update(
        self, task_id: str, tenant_id: str, fields: dict
    ) -> Optional[CollaborationTask]: ...

    @abstractmethod
    async def delete(self, task_id: str, tenant_id: str) -> bool: ...

    @abstractmethod
    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[CollaborationTask], int]: ...


class InMemoryCollaborationRepository(CollaborationRepository):
    """Thread-safe in-memory collaboration repository."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._store: dict[tuple[str, str], CollaborationTask] = {}

    async def create(self, task: CollaborationTask) -> CollaborationTask:
        with self._lock:
            if not task.id:
                task.id = _new_id()
            now = _now()
            if task.created_at == task.updated_at:
                task.created_at = now
            task.updated_at = now
            self._store[(task.tenant_id, task.id)] = task
            return task

    async def get(self, task_id: str, tenant_id: str) -> Optional[CollaborationTask]:
        with self._lock:
            return self._store.get((tenant_id, task_id))

    async def update(
        self, task_id: str, tenant_id: str, fields: dict
    ) -> Optional[CollaborationTask]:
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

    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[CollaborationTask], int]:
        with self._lock:
            results = [
                t
                for (tid, _), t in self._store.items()
                if tid == tenant_id and (status is None or t.status.value == status)
            ]
        results.sort(key=lambda t: t.created_at, reverse=True)
        total = len(results)
        start = (page - 1) * page_size
        end = start + page_size
        return results[start:end], total

    # -- test helper --

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
