"""Rate limit repository: in-memory (tests/default) + SqlAlchemy (production)."""

from __future__ import annotations

from datetime import datetime, timezone
from threading import RLock
from typing import Dict, List, Optional

from app.ratelimits.orm import Base, RateLimitORM
from app.ratelimits.schemas import RateLimitRecord, RateLimitScope, RateLimitType


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _row_to_rate_limit(row: RateLimitORM) -> RateLimitRecord:
    return RateLimitRecord(
        rate_limit_id=row.rate_limit_id,
        tenant_id=row.tenant_id,
        name=row.name,
        scope=RateLimitScope(row.scope),
        target_id=row.target_id,
        type=RateLimitType(row.type),
        limit_value=row.limit_value,
        window_seconds=row.window_seconds or 60,
        enabled=row.enabled if row.enabled is not None else True,
        created_by=row.created_by,
        updated_by=row.updated_by,
        created_at=row.created_at if row.created_at else _now(),
        updated_at=row.updated_at if row.updated_at else _now(),
    )


def _rate_limit_to_row(record: RateLimitRecord) -> RateLimitORM:
    return RateLimitORM(
        rate_limit_id=record.rate_limit_id,
        tenant_id=record.tenant_id,
        name=record.name,
        scope=record.scope.value,
        target_id=record.target_id,
        type=record.type.value,
        limit_value=record.limit_value,
        window_seconds=record.window_seconds,
        enabled=record.enabled,
        created_by=record.created_by,
        updated_by=record.updated_by,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


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


class SqlAlchemyRateLimitRepository:
    """Async SQLAlchemy 2.0 repository backed by ``llmgw_rate_limits``."""

    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    @classmethod
    async def create_all(cls, engine) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def insert(self, record: RateLimitRecord) -> RateLimitRecord:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(RateLimitORM).where(
                RateLimitORM.tenant_id == record.tenant_id,
                RateLimitORM.scope == record.scope.value,
                RateLimitORM.target_id == record.target_id,
                RateLimitORM.type == record.type.value,
            )
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if existing is not None:
                raise ValueError("rate limit already exists")
            session.add(_rate_limit_to_row(record))
            await session.commit()
            return record

    async def get(self, rate_limit_id: str) -> Optional[RateLimitRecord]:
        async with self._session_factory() as session:
            row = await session.get(RateLimitORM, rate_limit_id)
            return _row_to_rate_limit(row) if row else None

    async def update(self, record: RateLimitRecord) -> RateLimitRecord:
        async with self._session_factory() as session:
            row = await session.get(RateLimitORM, record.rate_limit_id)
            if row is None:
                session.add(_rate_limit_to_row(record))
            else:
                row.name = record.name
                row.limit_value = record.limit_value
                row.window_seconds = record.window_seconds
                row.enabled = record.enabled
                row.updated_by = record.updated_by
                row.updated_at = _now()
            await session.commit()
            return record

    async def remove(self, rate_limit_id: str) -> Optional[RateLimitRecord]:
        async with self._session_factory() as session:
            row = await session.get(RateLimitORM, rate_limit_id)
            if row is None:
                return None
            record = _row_to_rate_limit(row)
            await session.delete(row)
            await session.commit()
            return record

    async def list(
        self,
        tenant_id: str,
        *,
        scope: Optional[str] = None,
        type_: Optional[str] = None,
    ) -> List[RateLimitRecord]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(RateLimitORM).where(RateLimitORM.tenant_id == tenant_id)
            if scope is not None:
                stmt = stmt.where(RateLimitORM.scope == scope)
            if type_ is not None:
                stmt = stmt.where(RateLimitORM.type == type_)
            stmt = stmt.order_by(RateLimitORM.updated_at.desc())
            rows = (await session.execute(stmt)).scalars().all()
            return [_row_to_rate_limit(r) for r in rows]

    async def exists(
        self,
        tenant_id: str,
        scope: str,
        target_id: str,
        type_: str,
    ) -> bool:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(RateLimitORM.rate_limit_id).where(
                RateLimitORM.tenant_id == tenant_id,
                RateLimitORM.scope == scope,
                RateLimitORM.target_id == target_id,
                RateLimitORM.type == type_,
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            return row is not None

    async def clear(self) -> None:
        async with self._session_factory() as session:
            await session.execute(RateLimitORM.__table__.delete())
            await session.commit()
