"""Data access layer for Agent Registry."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Any, Optional

from app.agent_registry.schemas import AgentRegistration, HealthStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return f"reg-{uuid.uuid4().hex[:24]}"


class AgentRegistryRepository(ABC):
    """Abstract repository contract."""

    @abstractmethod
    async def create(self, reg: AgentRegistration) -> AgentRegistration: ...

    @abstractmethod
    async def get(self, reg_id: str, tenant_id: str) -> Optional[AgentRegistration]: ...

    @abstractmethod
    async def get_by_agent_id(
        self, tenant_id: str, agent_id: str
    ) -> Optional[AgentRegistration]: ...

    @abstractmethod
    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[HealthStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AgentRegistration], int]: ...

    @abstractmethod
    async def update(
        self, reg_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[AgentRegistration]: ...

    @abstractmethod
    async def delete(self, reg_id: str, tenant_id: str) -> bool: ...

    @abstractmethod
    async def list_all(self) -> list[AgentRegistration]: ...


class InMemoryAgentRegistryRepository(AgentRegistryRepository):
    """Thread-safe in-memory repository."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._store: dict[tuple[str, str], AgentRegistration] = {}

    async def create(self, reg: AgentRegistration) -> AgentRegistration:
        with self._lock:
            if not reg.id:
                reg.id = _new_id()
            reg.registered_at = _now()
            reg.updated_at = reg.registered_at
            self._store[(reg.tenant_id, reg.id)] = reg
            return reg

    async def get(self, reg_id: str, tenant_id: str) -> Optional[AgentRegistration]:
        with self._lock:
            return self._store.get((tenant_id, reg_id))

    async def get_by_agent_id(
        self, tenant_id: str, agent_id: str
    ) -> Optional[AgentRegistration]:
        with self._lock:
            for (tid, _), reg in self._store.items():
                if tid == tenant_id and reg.agent_id == agent_id:
                    return reg
            return None

    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[HealthStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AgentRegistration], int]:
        with self._lock:
            results = [
                reg
                for (tid, _), reg in self._store.items()
                if tid == tenant_id and (status is None or reg.status == status)
            ]
        results.sort(key=lambda r: r.registered_at)
        total = len(results)
        start = (page - 1) * page_size
        end = start + page_size
        return results[start:end], total

    async def update(
        self, reg_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[AgentRegistration]:
        with self._lock:
            reg = self._store.get((tenant_id, reg_id))
            if reg is None:
                return None
            updated = reg.model_copy(update=fields)
            updated.updated_at = _now()
            self._store[(tenant_id, reg_id)] = updated
            return updated

    async def delete(self, reg_id: str, tenant_id: str) -> bool:
        with self._lock:
            return self._store.pop((tenant_id, reg_id), None) is not None

    async def list_all(self) -> list[AgentRegistration]:
        with self._lock:
            return list(self._store.values())

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
