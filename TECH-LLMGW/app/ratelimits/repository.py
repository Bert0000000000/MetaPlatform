"""In-memory rate limit configuration repository."""

from __future__ import annotations

from datetime import datetime, timezone
from threading import RLock
from typing import Dict, List, Optional

from app.ratelimits.schemas import RateLimitRecord


def _now() -> datetime:
    return datetime.now(timezone.utc)


class RateLimitRepository:
    """Thread-safe in-memory replacement for llmgw_rate_limits table."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._rules: Dict[str, RateLimitRecord] = {}
        # (tenant_id, scope, target_id, type) -> rate_limit_id
        self._unique_index: Dict[tuple[str, str, str, str], str] = {}

    def insert(self, record: RateLimitRecord) -> RateLimitRecord:
        with self._lock:
            unique_key = (
                record.tenant_id,
                record.scope.value,
                record.target_id,
                record.type.value,
            )
            if unique_key in self._unique_index:
                raise ValueError("rate limit already exists")
            self._rules[record.rate_limit_id] = record
            self._unique_index[unique_key] = record.rate_limit_id
            return record

    def get(self, rate_limit_id: str) -> Optional[RateLimitRecord]:
        with self._lock:
            return self._rules.get(rate_limit_id)

    def update(self, record: RateLimitRecord) -> RateLimitRecord:
        with self._lock:
            record.updated_at = _now()
            self._rules[record.rate_limit_id] = record
            return record

    def remove(self, rate_limit_id: str) -> Optional[RateLimitRecord]:
        with self._lock:
            record = self._rules.pop(rate_limit_id, None)
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
    ) -> List[RateLimitRecord]:
        with self._lock:
            results = [
                r
                for r in self._rules.values()
                if r.tenant_id == tenant_id
                and (scope is None or r.scope.value == scope)
                and (type_ is None or r.type.value == type_)
            ]
        results.sort(key=lambda r: r.updated_at, reverse=True)
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
            self._rules.clear()
            self._unique_index.clear()
