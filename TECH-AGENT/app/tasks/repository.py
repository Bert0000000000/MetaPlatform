"""Data access layer for Agent tasks."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Any, List, Optional

from app.tasks.schemas import AgentTask, TaskPriority, TaskStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return f"task-{uuid.uuid4().hex[:24]}"


class TaskRepository(ABC):
    """Abstract repository for agent tasks."""

    @abstractmethod
    async def create(self, task: AgentTask) -> AgentTask: ...

    @abstractmethod
    async def get(self, task_id: str, tenant_id: str) -> Optional[AgentTask]: ...

    @abstractmethod
    async def list(
        self,
        tenant_id: str,
        *,
        agent_id: Optional[str] = None,
        status: Optional[TaskStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[AgentTask], int]: ...

    @abstractmethod
    async def update(
        self, task_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[AgentTask]: ...

    @abstractmethod
    async def delete(self, task_id: str, tenant_id: str) -> bool: ...

    @abstractmethod
    async def list_for_stats(
        self,
        tenant_id: str,
        agent_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[AgentTask]: ...


class InMemoryTaskRepository(TaskRepository):
    """Thread-safe in-memory task repository."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._store: dict[tuple[str, str], AgentTask] = {}

    async def create(self, task: AgentTask) -> AgentTask:
        with self._lock:
            if not task.id:
                task.id = _new_id()
            task.created_at = _now()
            self._store[(task.tenant_id, task.id)] = task
            return task

    async def get(self, task_id: str, tenant_id: str) -> Optional[AgentTask]:
        with self._lock:
            return self._store.get((tenant_id, task_id))

    async def list(
        self,
        tenant_id: str,
        *,
        agent_id: Optional[str] = None,
        status: Optional[TaskStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[AgentTask], int]:
        with self._lock:
            results = [
                t
                for (tid, _), t in self._store.items()
                if tid == tenant_id
                and (agent_id is None or t.agent_id == agent_id)
                and (status is None or t.status == status)
            ]
        results.sort(key=lambda t: t.created_at, reverse=True)
        total = len(results)
        start = (page - 1) * page_size
        end = start + page_size
        return results[start:end], total

    async def update(
        self, task_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[AgentTask]:
        with self._lock:
            task = self._store.get((tenant_id, task_id))
            if task is None:
                return None
            updated = task.model_copy(update=fields)
            self._store[(tenant_id, task_id)] = updated
            return updated

    async def delete(self, task_id: str, tenant_id: str) -> bool:
        with self._lock:
            return self._store.pop((tenant_id, task_id), None) is not None

    async def list_for_stats(
        self,
        tenant_id: str,
        agent_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[AgentTask]:
        with self._lock:
            results = []
            for (tid, _), t in self._store.items():
                if tid != tenant_id or t.agent_id != agent_id:
                    continue
                if start_time and t.created_at < start_time:
                    continue
                if end_time and t.created_at > end_time:
                    continue
                results.append(t)
        return results

    # -- test helper --

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
