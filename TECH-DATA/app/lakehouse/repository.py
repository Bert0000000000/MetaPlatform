"""Lakehouse repository."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import List, Optional

from app.lakehouse.orm import (
    IngestMode,
    IngestStatus,
    LakeIngestTaskORM,
    LakeTableORM,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_table_id() -> str:
    return f"lake-{uuid.uuid4().hex[:16]}"


def _new_task_id() -> str:
    return f"ing-{uuid.uuid4().hex[:16]}"


class LakehouseRepository(ABC):
    @abstractmethod
    async def insert_table(self, t: LakeTableORM) -> LakeTableORM: ...

    @abstractmethod
    async def get_table(
        self, table_id: str, tenant_id: str
    ) -> Optional[LakeTableORM]: ...

    @abstractmethod
    async def list_tables(
        self,
        tenant_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[LakeTableORM], int]: ...

    @abstractmethod
    async def update_table(
        self, table_id: str, tenant_id: str, fields: dict
    ) -> Optional[LakeTableORM]: ...

    @abstractmethod
    async def soft_delete_table(
        self, table_id: str, tenant_id: str
    ) -> bool: ...

    @abstractmethod
    async def insert_task(self, t: LakeIngestTaskORM) -> LakeIngestTaskORM: ...

    @abstractmethod
    async def update_task(self, t: LakeIngestTaskORM) -> LakeIngestTaskORM: ...

    @abstractmethod
    async def list_tasks(
        self, tenant_id: str, table_id: str
    ) -> List[LakeIngestTaskORM]: ...


class InMemoryLakehouseRepository(LakehouseRepository):
    def __init__(self) -> None:
        self._lock = RLock()
        self._tables: dict[tuple[str, str], LakeTableORM] = {}
        self._tasks: dict[tuple[str, str], List[LakeIngestTaskORM]] = {}

    async def insert_table(self, t: LakeTableORM) -> LakeTableORM:
        with self._lock:
            if not t.id:
                t.id = _new_table_id()
            t.created_at = _now()
            t.updated_at = t.created_at
            self._tables[(t.tenant_id, t.id)] = t
            return t

    async def get_table(
        self, table_id: str, tenant_id: str
    ) -> Optional[LakeTableORM]:
        with self._lock:
            t = self._tables.get((tenant_id, table_id))
            if t is None or t.deleted_at is not None:
                return None
            return t

    async def list_tables(
        self,
        tenant_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[LakeTableORM], int]:
        with self._lock:
            results = [
                t
                for t in self._tables.values()
                if t.tenant_id == tenant_id and t.deleted_at is None
            ]
        results.sort(key=lambda t: t.updated_at, reverse=True)
        total = len(results)
        start = (page - 1) * page_size
        end = start + page_size
        return results[start:end], total

    async def update_table(
        self, table_id: str, tenant_id: str, fields: dict
    ) -> Optional[LakeTableORM]:
        with self._lock:
            t = self._tables.get((tenant_id, table_id))
            if t is None or t.deleted_at is not None:
                return None
            updated = t.model_copy(update=fields)
            updated.updated_at = _now()
            self._tables[(tenant_id, table_id)] = updated
            return updated

    async def soft_delete_table(
        self, table_id: str, tenant_id: str
    ) -> bool:
        with self._lock:
            t = self._tables.get((tenant_id, table_id))
            if t is None or t.deleted_at is not None:
                return False
            t.deleted_at = _now()
            t.updated_at = t.deleted_at
            return True

    async def insert_task(self, t: LakeIngestTaskORM) -> LakeIngestTaskORM:
        with self._lock:
            if not t.id:
                t.id = _new_task_id()
            self._tasks.setdefault((t.tenant_id, t.table_id), []).append(t)
            return t

    async def update_task(self, t: LakeIngestTaskORM) -> LakeIngestTaskORM:
        with self._lock:
            tasks = self._tasks.setdefault((t.tenant_id, t.table_id), [])
            for idx, existing in enumerate(tasks):
                if existing.id == t.id:
                    tasks[idx] = t
                    return t
            tasks.append(t)
            return t

    async def list_tasks(
        self, tenant_id: str, table_id: str
    ) -> List[LakeIngestTaskORM]:
        with self._lock:
            return list(self._tasks.get((tenant_id, table_id), []))

    def clear(self) -> None:
        with self._lock:
            self._tables.clear()
            self._tasks.clear()