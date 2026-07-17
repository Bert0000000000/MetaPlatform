"""Data access layer for Agent tasks."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Any, List, Optional

from app.agents.orm import Base
from app.tasks.orm import TaskORM
from app.tasks.schemas import AgentTask, TaskPriority, TaskStatus


def _row_to_model(row: TaskORM) -> AgentTask:
    return AgentTask(
        id=row.id,
        tenant_id=row.tenant_id,
        agent_id=row.agent_id,
        title=row.title,
        description=row.description or "",
        status=TaskStatus(row.status),
        priority=TaskPriority(row.priority),
        assigned_to=row.assigned_to,
        input=dict(row.input) if row.input else None,
        output=dict(row.output) if row.output else None,
        error_message=row.error_message,
        created_at=row.created_at if row.created_at else _now(),
        started_at=row.started_at,
        completed_at=row.completed_at,
    )


def _model_to_row(task: AgentTask) -> TaskORM:
    return TaskORM(
        id=task.id,
        tenant_id=task.tenant_id,
        agent_id=task.agent_id,
        title=task.title,
        description=task.description,
        status=task.status.value,
        priority=task.priority.value,
        assigned_to=task.assigned_to,
        input=dict(task.input) if task.input else None,
        output=dict(task.output) if task.output else None,
        error_message=task.error_message,
        created_at=task.created_at,
        started_at=task.started_at,
        completed_at=task.completed_at,
    )


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


class SqlAlchemyTaskRepository(TaskRepository):
    """Async SQLAlchemy 2.0 repository backed by ``agent_tasks``."""

    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    @classmethod
    async def create_all(cls, engine) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def create(self, task: AgentTask) -> AgentTask:
        if not task.id:
            task.id = _new_id()
        task.created_at = _now()
        row = _model_to_row(task)
        async with self._session_factory() as session:
            session.add(row)
            await session.commit()
            return task

    async def get(self, task_id: str, tenant_id: str) -> Optional[AgentTask]:
        async with self._session_factory() as session:
            row = await session.get(TaskORM, task_id)
            if row is None or row.tenant_id != tenant_id:
                return None
            return _row_to_model(row)

    async def list(
        self,
        tenant_id: str,
        *,
        agent_id: Optional[str] = None,
        status: Optional[TaskStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[AgentTask], int]:
        from sqlalchemy import func, select

        async with self._session_factory() as session:
            base = select(TaskORM).where(TaskORM.tenant_id == tenant_id)
            count_base = select(func.count()).select_from(TaskORM).where(
                TaskORM.tenant_id == tenant_id
            )
            if agent_id is not None:
                base = base.where(TaskORM.agent_id == agent_id)
                count_base = count_base.where(TaskORM.agent_id == agent_id)
            if status is not None:
                base = base.where(TaskORM.status == status.value)
                count_base = count_base.where(TaskORM.status == status.value)
            total = (await session.execute(count_base)).scalar_one()
            rows = (
                await session.execute(
                    base.order_by(TaskORM.created_at.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).scalars().all()
            return [_row_to_model(r) for r in rows], total

    async def update(
        self, task_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[AgentTask]:
        async with self._session_factory() as session:
            row = await session.get(TaskORM, task_id)
            if row is None or row.tenant_id != tenant_id:
                return None
            if "title" in fields:
                row.title = fields["title"]
            if "description" in fields:
                row.description = fields["description"]
            if "status" in fields:
                row.status = fields["status"].value
            if "priority" in fields:
                row.priority = fields["priority"].value
            if "assigned_to" in fields:
                row.assigned_to = fields["assigned_to"]
            if "input" in fields:
                row.input = dict(fields["input"]) if fields["input"] else None
            if "output" in fields:
                row.output = dict(fields["output"]) if fields["output"] else None
            if "error_message" in fields:
                row.error_message = fields["error_message"]
            if "started_at" in fields:
                row.started_at = fields["started_at"]
            if "completed_at" in fields:
                row.completed_at = fields["completed_at"]
            await session.commit()
            return _row_to_model(row)

    async def delete(self, task_id: str, tenant_id: str) -> bool:
        async with self._session_factory() as session:
            row = await session.get(TaskORM, task_id)
            if row is None or row.tenant_id != tenant_id:
                return False
            await session.delete(row)
            await session.commit()
            return True

    async def list_for_stats(
        self,
        tenant_id: str,
        agent_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[AgentTask]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(TaskORM).where(
                TaskORM.tenant_id == tenant_id,
                TaskORM.agent_id == agent_id,
            )
            if start_time is not None:
                stmt = stmt.where(TaskORM.created_at >= start_time)
            if end_time is not None:
                stmt = stmt.where(TaskORM.created_at <= end_time)
            rows = (await session.execute(stmt)).scalars().all()
            return [_row_to_model(r) for r in rows]
