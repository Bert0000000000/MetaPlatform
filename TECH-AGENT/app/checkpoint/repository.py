"""Data access layer for checkpoint persistence (PG + Redis simulation)."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from threading import RLock
from typing import List, Optional

from datetime import datetime, timezone

from app.agents.orm import Base
from app.checkpoint.orm import CheckpointORM
from app.checkpoint.schemas import Checkpoint, CheckpointState


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _row_to_model(row: CheckpointORM) -> Checkpoint:
    return Checkpoint(
        checkpoint_id=row.checkpoint_id,
        execution_id=row.execution_id,
        agent_id=row.agent_id,
        tenant_id=row.tenant_id,
        state=CheckpointState(**(row.state or {})),
        created_at=row.created_at if row.created_at else _now(),
    )


def _new_id() -> str:
    return f"ckpt-{uuid.uuid4().hex[:24]}"


class CheckpointRepository(ABC):
    """Abstract repository for execution checkpoints."""

    @abstractmethod
    async def save(
        self,
        execution_id: str,
        agent_id: str,
        tenant_id: str,
        state: CheckpointState,
    ) -> Checkpoint: ...

    @abstractmethod
    async def load(
        self, execution_id: str, tenant_id: str
    ) -> Optional[Checkpoint]: ...

    @abstractmethod
    async def list_by_agent(
        self, agent_id: str, tenant_id: str
    ) -> List[Checkpoint]: ...

    @abstractmethod
    async def delete(self, execution_id: str, tenant_id: str) -> bool: ...


class InMemoryCheckpointRepository(CheckpointRepository):
    """Thread-safe in-memory checkpoint repository.

    Simulates PG (durable) + Redis (fast access) with a single dict.
    """

    def __init__(self) -> None:
        self._lock = RLock()
        self._store: dict[tuple[str, str], Checkpoint] = {}

    async def save(
        self,
        execution_id: str,
        agent_id: str,
        tenant_id: str,
        state: CheckpointState,
    ) -> Checkpoint:
        with self._lock:
            key = (tenant_id, execution_id)
            existing = self._store.get(key)
            checkpoint_id = existing.checkpoint_id if existing else _new_id()
            checkpoint = Checkpoint(
                checkpoint_id=checkpoint_id,
                execution_id=execution_id,
                agent_id=agent_id,
                tenant_id=tenant_id,
                state=state,
            )
            self._store[key] = checkpoint
            return checkpoint

    async def load(
        self, execution_id: str, tenant_id: str
    ) -> Optional[Checkpoint]:
        with self._lock:
            return self._store.get((tenant_id, execution_id))

    async def list_by_agent(
        self, agent_id: str, tenant_id: str
    ) -> List[Checkpoint]:
        with self._lock:
            results = [
                c
                for c in self._store.values()
                if c.tenant_id == tenant_id and c.agent_id == agent_id
            ]
        results.sort(key=lambda c: c.created_at, reverse=True)
        return results

    async def delete(self, execution_id: str, tenant_id: str) -> bool:
        with self._lock:
            return self._store.pop((tenant_id, execution_id), None) is not None

    # -- test helper --

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


class SqlAlchemyCheckpointRepository(CheckpointRepository):
    """Async SQLAlchemy 2.0 repository backed by ``agent_checkpoints``."""

    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    @classmethod
    async def create_all(cls, engine) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def save(
        self,
        execution_id: str,
        agent_id: str,
        tenant_id: str,
        state: CheckpointState,
    ) -> Checkpoint:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(CheckpointORM).where(
                CheckpointORM.execution_id == execution_id,
                CheckpointORM.tenant_id == tenant_id,
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            if row:
                row.state = state.model_dump(mode="json")
                row.agent_id = agent_id
                checkpoint_id = row.checkpoint_id
            else:
                checkpoint_id = _new_id()
                row = CheckpointORM(
                    checkpoint_id=checkpoint_id,
                    execution_id=execution_id,
                    tenant_id=tenant_id,
                    agent_id=agent_id,
                    state=state.model_dump(mode="json"),
                )
                session.add(row)
            await session.commit()
            return _row_to_model(row)

    async def load(
        self, execution_id: str, tenant_id: str
    ) -> Optional[Checkpoint]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(CheckpointORM).where(
                CheckpointORM.execution_id == execution_id,
                CheckpointORM.tenant_id == tenant_id,
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            return _row_to_model(row) if row else None

    async def list_by_agent(
        self, agent_id: str, tenant_id: str
    ) -> List[Checkpoint]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = (
                select(CheckpointORM)
                .where(
                    CheckpointORM.agent_id == agent_id,
                    CheckpointORM.tenant_id == tenant_id,
                )
                .order_by(CheckpointORM.created_at.desc())
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [_row_to_model(r) for r in rows]

    async def delete(self, execution_id: str, tenant_id: str) -> bool:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(CheckpointORM).where(
                CheckpointORM.execution_id == execution_id,
                CheckpointORM.tenant_id == tenant_id,
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            if row is None:
                return False
            await session.delete(row)
            await session.commit()
            return True
