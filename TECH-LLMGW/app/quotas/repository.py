"""Quota repository: in-memory (tests/default) + SqlAlchemy (production)."""

from __future__ import annotations

from datetime import datetime, timezone
from threading import RLock
from typing import Dict, List, Optional

from app.quotas.orm import Base, QuotaORM
from app.quotas.schemas import QuotaRecord, QuotaScope, QuotaType


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _row_to_quota(row: QuotaORM) -> QuotaRecord:
    return QuotaRecord(
        quota_id=row.quota_id,
        tenant_id=row.tenant_id,
        name=row.name,
        scope=QuotaScope(row.scope),
        target_id=row.target_id,
        type=QuotaType(row.type),
        limit_value=row.limit_value,
        used_value=row.used_value or 0,
        alert_threshold=row.alert_threshold or 80,
        enabled=row.enabled if row.enabled is not None else True,
        reset_window=row.reset_window,
        created_by=row.created_by,
        updated_by=row.updated_by,
        created_at=row.created_at if row.created_at else _now(),
        updated_at=row.updated_at if row.updated_at else _now(),
    )


def _quota_to_row(record: QuotaRecord) -> QuotaORM:
    return QuotaORM(
        quota_id=record.quota_id,
        tenant_id=record.tenant_id,
        name=record.name,
        scope=record.scope.value,
        target_id=record.target_id,
        type=record.type.value,
        limit_value=record.limit_value,
        used_value=record.used_value,
        alert_threshold=record.alert_threshold,
        enabled=record.enabled,
        reset_window=record.reset_window,
        created_by=record.created_by,
        updated_by=record.updated_by,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


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


class SqlAlchemyQuotaRepository:
    """Async SQLAlchemy 2.0 repository backed by ``llmgw_quotas``."""

    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    @classmethod
    async def create_all(cls, engine) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def insert(self, record: QuotaRecord) -> QuotaRecord:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(QuotaORM).where(
                QuotaORM.tenant_id == record.tenant_id,
                QuotaORM.scope == record.scope.value,
                QuotaORM.target_id == record.target_id,
                QuotaORM.type == record.type.value,
            )
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if existing is not None:
                raise ValueError("quota already exists")
            session.add(_quota_to_row(record))
            await session.commit()
            return record

    async def get(self, quota_id: str) -> Optional[QuotaRecord]:
        async with self._session_factory() as session:
            row = await session.get(QuotaORM, quota_id)
            return _row_to_quota(row) if row else None

    async def update(self, record: QuotaRecord) -> QuotaRecord:
        async with self._session_factory() as session:
            row = await session.get(QuotaORM, record.quota_id)
            if row is None:
                session.add(_quota_to_row(record))
            else:
                row.name = record.name
                row.limit_value = record.limit_value
                row.used_value = record.used_value
                row.alert_threshold = record.alert_threshold
                row.enabled = record.enabled
                row.reset_window = record.reset_window
                row.updated_by = record.updated_by
                row.updated_at = _now()
            await session.commit()
            return record

    async def remove(self, quota_id: str) -> Optional[QuotaRecord]:
        async with self._session_factory() as session:
            row = await session.get(QuotaORM, quota_id)
            if row is None:
                return None
            record = _row_to_quota(row)
            await session.delete(row)
            await session.commit()
            return record

    async def list(
        self,
        tenant_id: str,
        *,
        scope: Optional[str] = None,
        type_: Optional[str] = None,
    ) -> List[QuotaRecord]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(QuotaORM).where(QuotaORM.tenant_id == tenant_id)
            if scope is not None:
                stmt = stmt.where(QuotaORM.scope == scope)
            if type_ is not None:
                stmt = stmt.where(QuotaORM.type == type_)
            stmt = stmt.order_by(QuotaORM.updated_at.desc())
            rows = (await session.execute(stmt)).scalars().all()
            return [_row_to_quota(r) for r in rows]

    async def exists(
        self,
        tenant_id: str,
        scope: str,
        target_id: str,
        type_: str,
    ) -> bool:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(QuotaORM.quota_id).where(
                QuotaORM.tenant_id == tenant_id,
                QuotaORM.scope == scope,
                QuotaORM.target_id == target_id,
                QuotaORM.type == type_,
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            return row is not None

    async def clear(self) -> None:
        async with self._session_factory() as session:
            await session.execute(QuotaORM.__table__.delete())
            await session.commit()
