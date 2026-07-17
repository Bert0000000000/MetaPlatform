"""Data access layer for Audit records."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Any, Optional

from app.audit.schemas import AuditAction, AuditRecord


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return f"aud-{uuid.uuid4().hex[:24]}"


class AuditRepository(ABC):
    """Abstract repository contract."""

    @abstractmethod
    async def create(self, record: AuditRecord) -> AuditRecord: ...

    @abstractmethod
    async def get(self, record_id: str, tenant_id: str) -> Optional[AuditRecord]: ...

    @abstractmethod
    async def list(
        self,
        tenant_id: str,
        *,
        action: Optional[AuditAction] = None,
        actor_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AuditRecord], int]: ...

    @abstractmethod
    async def list_all(self, tenant_id: str) -> list[AuditRecord]: ...


class InMemoryAuditRepository(AuditRepository):
    """Thread-safe in-memory repository."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._store: dict[tuple[str, str], AuditRecord] = {}

    async def create(self, record: AuditRecord) -> AuditRecord:
        with self._lock:
            if not record.id:
                record.id = _new_id()
            record.created_at = _now()
            self._store[(record.tenant_id, record.id)] = record
            return record

    async def get(self, record_id: str, tenant_id: str) -> Optional[AuditRecord]:
        with self._lock:
            return self._store.get((tenant_id, record_id))

    async def list(
        self,
        tenant_id: str,
        *,
        action: Optional[AuditAction] = None,
        actor_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AuditRecord], int]:
        with self._lock:
            results = []
            for (tid, _), record in self._store.items():
                if tid != tenant_id:
                    continue
                if action is not None and record.action != action:
                    continue
                if actor_id is not None and record.actor_id != actor_id:
                    continue
                results.append(record)
        results.sort(key=lambda r: r.created_at, reverse=True)
        total = len(results)
        start = (page - 1) * page_size
        end = start + page_size
        return results[start:end], total

    async def list_all(self, tenant_id: str) -> list[AuditRecord]:
        with self._lock:
            results = [
                record
                for (tid, _), record in self._store.items()
                if tid == tenant_id
            ]
        results.sort(key=lambda r: r.created_at)
        return results

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
