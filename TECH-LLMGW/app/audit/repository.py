"""Audit log repository: in-memory (tests/default) + SqlAlchemy (production)."""

from __future__ import annotations

from datetime import datetime
from threading import RLock
from typing import Dict, Iterable, List, Optional

from app.audit.orm import Base, AuditLogORM
from app.audit.schemas import AuditLogEntry, AuditLogStatus


def _row_to_audit(row: AuditLogORM) -> AuditLogEntry:
    return AuditLogEntry(
        log_id=row.log_id,
        tenant_id=row.tenant_id,
        user_id=row.user_id,
        application_id=row.application_id,
        model_id=row.model_id,
        provider_id=row.provider_id,
        status=AuditLogStatus(row.status),
        error_code=row.error_code,
        error_message=row.error_message,
        input_tokens=row.input_tokens or 0,
        output_tokens=row.output_tokens or 0,
        latency_ms=row.latency_ms or 0,
        cost=row.cost or 0.0,
        trace_id=row.trace_id,
        timestamp=row.timestamp,
    )


def _audit_to_row(entry: AuditLogEntry) -> AuditLogORM:
    return AuditLogORM(
        log_id=entry.log_id,
        tenant_id=entry.tenant_id,
        user_id=entry.user_id,
        application_id=entry.application_id,
        model_id=entry.model_id,
        provider_id=entry.provider_id,
        status=entry.status.value,
        error_code=entry.error_code,
        error_message=entry.error_message,
        input_tokens=entry.input_tokens,
        output_tokens=entry.output_tokens,
        latency_ms=entry.latency_ms,
        cost=entry.cost,
        trace_id=entry.trace_id,
        timestamp=entry.timestamp,
    )


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


class SqlAlchemyAuditLogRepository:
    """Async SQLAlchemy 2.0 repository backed by ``llmgw_audit_logs``."""

    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    @classmethod
    async def create_all(cls, engine) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def insert(self, entry: AuditLogEntry) -> AuditLogEntry:
        async with self._session_factory() as session:
            session.add(_audit_to_row(entry))
            await session.commit()
            return entry

    async def insert_many(self, entries: Iterable[AuditLogEntry]) -> int:
        async with self._session_factory() as session:
            count = 0
            for e in entries:
                session.add(_audit_to_row(e))
                count += 1
            await session.commit()
            return count

    async def get(self, log_id: str) -> Optional[AuditLogEntry]:
        async with self._session_factory() as session:
            row = await session.get(AuditLogORM, log_id)
            return _row_to_audit(row) if row else None

    async def list(
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
        from sqlalchemy import or_, select

        async with self._session_factory() as session:
            stmt = select(AuditLogORM).where(AuditLogORM.tenant_id == tenant_id)
            if user_id is not None:
                stmt = stmt.where(AuditLogORM.user_id == user_id)
            if model_id is not None:
                stmt = stmt.where(AuditLogORM.model_id == model_id)
            if status is not None:
                stmt = stmt.where(AuditLogORM.status == status.value)
            if start_time is not None:
                stmt = stmt.where(AuditLogORM.timestamp >= start_time)
            if end_time is not None:
                stmt = stmt.where(AuditLogORM.timestamp <= end_time)
            stmt = stmt.order_by(AuditLogORM.timestamp.desc())
            rows = (await session.execute(stmt)).scalars().all()
            results = [_row_to_audit(r) for r in rows]
        if keyword:
            keyword_lower = keyword.lower()
            results = [
                r
                for r in results
                if keyword_lower in (r.error_message or "").lower()
                or keyword_lower in (r.error_code or "").lower()
            ]
        return results

    async def clear(self) -> None:
        async with self._session_factory() as session:
            await session.execute(AuditLogORM.__table__.delete())
            await session.commit()