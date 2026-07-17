"""DBT repository (in-memory)."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import List, Optional

from app.dbt.orm import DbtModelORM, DbtProjectORM


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_project_id() -> str:
    return f"dbt-{uuid.uuid4().hex[:16]}"


def _new_model_id() -> str:
    return f"dbtm-{uuid.uuid4().hex[:16]}"


class DbtRepository(ABC):
    @abstractmethod
    async def insert_project(self, p: DbtProjectORM) -> DbtProjectORM: ...

    @abstractmethod
    async def get_project(
        self, project_id: str, tenant_id: str
    ) -> Optional[DbtProjectORM]: ...

    @abstractmethod
    async def list_projects(
        self, tenant_id: str
    ) -> List[DbtProjectORM]: ...

    @abstractmethod
    async def update_project(
        self, project_id: str, tenant_id: str, fields: dict
    ) -> Optional[DbtProjectORM]: ...

    @abstractmethod
    async def delete_project(self, project_id: str, tenant_id: str) -> bool: ...

    @abstractmethod
    async def insert_model(self, m: DbtModelORM) -> DbtModelORM: ...

    @abstractmethod
    async def list_models(
        self, project_id: str, tenant_id: str
    ) -> List[DbtModelORM]: ...

    @abstractmethod
    async def get_model(
        self, model_id: str, tenant_id: str
    ) -> Optional[DbtModelORM]: ...


class InMemoryDbtRepository(DbtRepository):
    def __init__(self) -> None:
        self._lock = RLock()
        self._projects: dict[tuple[str, str], DbtProjectORM] = {}
        self._models: dict[tuple[str, str], DbtModelORM] = {}

    async def insert_project(self, p: DbtProjectORM) -> DbtProjectORM:
        with self._lock:
            if not p.id:
                p.id = _new_project_id()
            p.created_at = _now()
            p.updated_at = p.created_at
            self._projects[(p.tenant_id, p.id)] = p
            return p

    async def get_project(
        self, project_id: str, tenant_id: str
    ) -> Optional[DbtProjectORM]:
        with self._lock:
            return self._projects.get((tenant_id, project_id))

    async def list_projects(self, tenant_id: str) -> List[DbtProjectORM]:
        with self._lock:
            return [p for p in self._projects.values() if p.tenant_id == tenant_id]

    async def update_project(
        self, project_id: str, tenant_id: str, fields: dict
    ) -> Optional[DbtProjectORM]:
        with self._lock:
            p = self._projects.get((tenant_id, project_id))
            if p is None:
                return None
            updated = p.model_copy(update=fields)
            updated.updated_at = _now()
            self._projects[(tenant_id, project_id)] = updated
            return updated

    async def delete_project(self, project_id: str, tenant_id: str) -> bool:
        with self._lock:
            if self._projects.pop((tenant_id, project_id), None) is None:
                return False
            for key in [k for k in self._models if k[0] == tenant_id and self._models[k].project_id == project_id]:
                self._models.pop(key, None)
            return True

    async def insert_model(self, m: DbtModelORM) -> DbtModelORM:
        with self._lock:
            if not m.id:
                m.id = _new_model_id()
            m.created_at = _now()
            self._models[(m.tenant_id, m.id)] = m
            return m

    async def list_models(
        self, project_id: str, tenant_id: str
    ) -> List[DbtModelORM]:
        with self._lock:
            return [
                m
                for m in self._models.values()
                if m.tenant_id == tenant_id and m.project_id == project_id
            ]

    async def get_model(
        self, model_id: str, tenant_id: str
    ) -> Optional[DbtModelORM]:
        with self._lock:
            return self._models.get((tenant_id, model_id))

    def clear(self) -> None:
        with self._lock:
            self._projects.clear()
            self._models.clear()