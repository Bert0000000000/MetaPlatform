"""In-memory usage repository for cost aggregation."""

from __future__ import annotations

from datetime import datetime
from threading import RLock
from typing import Dict, Iterable, List, Optional

from app.cost.schemas import UsageRecord


class UsageRepository:
    """Thread-safe in-memory store of LLM usage events."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._records: Dict[str, UsageRecord] = {}

    def insert(self, record: UsageRecord) -> UsageRecord:
        with self._lock:
            self._records[record.record_id] = record
            return record

    def insert_many(self, records: Iterable[UsageRecord]) -> int:
        with self._lock:
            count = 0
            for r in records:
                self._records[r.record_id] = r
                count += 1
            return count

    def list(
        self,
        tenant_id: str,
        *,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[UsageRecord]:
        with self._lock:
            results = [
                r
                for r in self._records.values()
                if r.tenant_id == tenant_id
                and (start_time is None or r.timestamp >= start_time)
                and (end_time is None or r.timestamp <= end_time)
            ]
        return sorted(results, key=lambda r: r.timestamp)

    def clear(self) -> None:
        with self._lock:
            self._records.clear()