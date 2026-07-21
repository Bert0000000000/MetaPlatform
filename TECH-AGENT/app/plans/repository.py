"""In-memory repository for autonomous task plans (V15-02)."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Optional

from app.plans.schemas import Plan


def _new_id() -> str:
    return f"plan-{uuid.uuid4().hex[:24]}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


class PlanRepository(ABC):
    """Abstract repository for autonomous task plans."""

    @abstractmethod
    async def create(self, plan: Plan) -> Plan: ...

    @abstractmethod
    async def get(self, plan_id: str, tenant_id: str) -> Optional[Plan]: ...

    @abstractmethod
    async def update(
        self, plan_id: str, tenant_id: str, fields: dict
    ) -> Optional[Plan]: ...

    @abstractmethod
    async def delete(self, plan_id: str, tenant_id: str) -> bool: ...

    @abstractmethod
    async def list(
        self,
        tenant_id: str,
        *,
        agent_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Plan], int]: ...


class InMemoryPlanRepository(PlanRepository):
    """Thread-safe in-memory plan repository."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._store: dict[tuple[str, str], Plan] = {}

    async def create(self, plan: Plan) -> Plan:
        with self._lock:
            if not plan.id:
                plan.id = _new_id()
            now = _now()
            if plan.created_at == plan.updated_at:
                plan.created_at = now
            plan.updated_at = now
            self._store[(plan.tenant_id, plan.id)] = plan
            return plan

    async def get(self, plan_id: str, tenant_id: str) -> Optional[Plan]:
        with self._lock:
            return self._store.get((tenant_id, plan_id))

    async def update(
        self, plan_id: str, tenant_id: str, fields: dict
    ) -> Optional[Plan]:
        with self._lock:
            plan = self._store.get((tenant_id, plan_id))
            if plan is None:
                return None
            updated = plan.model_copy(update=fields)
            updated.updated_at = _now()
            self._store[(tenant_id, plan_id)] = updated
            return updated

    async def delete(self, plan_id: str, tenant_id: str) -> bool:
        with self._lock:
            return self._store.pop((tenant_id, plan_id), None) is not None

    async def list(
        self,
        tenant_id: str,
        *,
        agent_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Plan], int]:
        with self._lock:
            results = [
                p
                for (tid, _), p in self._store.items()
                if tid == tenant_id
                and (agent_id is None or p.agent_id == agent_id)
            ]
        results.sort(key=lambda p: p.created_at, reverse=True)
        total = len(results)
        start = (page - 1) * page_size
        end = start + page_size
        return results[start:end], total

    # -- test helper --

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
