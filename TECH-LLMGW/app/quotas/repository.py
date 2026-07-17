"""In-memory quota configuration repository."""

from __future__ import annotations

from datetime import datetime, timezone
from threading import RLock
from typing import Dict, List, Optional

from app.quotas.schemas import QuotaRecord


def _now() -> datetime:
    return datetime.now(timezone.utc)


class QuotaRepository:
    """Thread-safe in-memory replacement for llmgw_quotas table."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._quotas: Dict[str, QuotaRecord] = {}
        # (tenant_id, scope, target_id, type) -> quota_id
        self._unique_index: Dict[tuple[str, str, str, str], str] = {}

    def insert(self, record: QuotaRecord) -> QuotaRecord:
        with self._lock:
            unique_key = (
                record.tenant_id,
                record.scope.value,
                record.target_id,
                record.type.value,
            )
            if unique_key in self._unique_index:
                raise ValueError("quota already exists")
            self._quotas[record.quota_id] = record
            self._unique_index[unique_key] = record.quota_id
            return record

    def get(self, quota_id: str) -> Optional[QuotaRecord]:
        with self._lock:
            return self._quotas.get(quota_id)

    def update(self, record: QuotaRecord) -> QuotaRecord:
        with self._lock:
            record.updated_at = _now()
            self._quotas[record.quota_id] = record
            return record

    def remove(self, quota_id: str) -> Optional[QuotaRecord]:
        with self._lock:
            record = self._quotas.pop(quota_id, None)
            if record is None:
                return None
            unique_key = (
                record.tenant_id,
                record.scope.value,
                record.target_id,
                record.type.value,
            )
            self._unique_index.pop(unique_key, None)
            return record

    def list(
        self,
        tenant_id: str,
        *,
        scope: Optional[str] = None,
        type_: Optional[str] = None,
    ) -> List[QuotaRecord]:
        with self._lock:
            results = [
                q
                for q in self._quotas.values()
                if q.tenant_id == tenant_id
                and (scope is None or q.scope.value == scope)
                and (type_ is None or q.type.value == type_)
            ]
        results.sort(key=lambda q: q.updated_at, reverse=True)
        return results

    def exists(
        self,
        tenant_id: str,
        scope: str,
        target_id: str,
        type_: str,
    ) -> bool:
        with self._lock:
            return (tenant_id, scope, target_id, type_) in self._unique_index

    def clear(self) -> None:
        with self._lock:
            self._quotas.clear()
            self._unique_index.clear()
