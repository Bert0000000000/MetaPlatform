"""In-memory audit log repository."""

from __future__ import annotations

from datetime import datetime
from threading import RLock
from typing import Dict, Iterable, List, Optional

from app.audit.schemas import AuditLogEntry, AuditLogStatus


class AuditLogRepository:
    """Thread-safe in-memory store for audit log entries."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._logs: Dict[str, AuditLogEntry] = {}

    def insert(self, entry: AuditLogEntry) -> AuditLogEntry:
        with self._lock:
            self._logs[entry.log_id] = entry
            return entry

    def insert_many(self, entries: Iterable[AuditLogEntry]) -> int:
        with self._lock:
            count = 0
            for e in entries:
                self._logs[e.log_id] = e
                count += 1
            return count

    def get(self, log_id: str) -> Optional[AuditLogEntry]:
        with self._lock:
            return self._logs.get(log_id)

    def list(
        self,
        tenant_id: str,
        *,
        user_id: Optional[str] = None,
        model_id: Optional[str] = None,
        status: Optional[AuditLogStatus] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        keyword: Optional[str] = None,
    ) -> List[AuditLogEntry]:
        with self._lock:
            results = list(self._logs.values())
        results = [
            r
            for r in results
            if r.tenant_id == tenant_id
            and (user_id is None or r.user_id == user_id)
            and (model_id is None or r.model_id == model_id)
            and (status is None or r.status == status)
            and (start_time is None or r.timestamp >= start_time)
            and (end_time is None or r.timestamp <= end_time)
            and (
                keyword is None
                or keyword.lower() in (r.error_message or "").lower()
                or keyword.lower() in (r.error_code or "").lower()
            )
        ]
        results.sort(key=lambda r: r.timestamp, reverse=True)
        return results

    def clear(self) -> None:
        with self._lock:
            self._logs.clear()