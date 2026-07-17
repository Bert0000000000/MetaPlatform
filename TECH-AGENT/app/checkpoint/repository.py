"""Data access layer for checkpoint persistence (PG + Redis simulation)."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from threading import RLock
from typing import List, Optional

from app.checkpoint.schemas import Checkpoint, CheckpointState


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
