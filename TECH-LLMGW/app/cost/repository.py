"""Usage repository: in-memory (tests/default) + SqlAlchemy (production)."""

from __future__ import annotations

from datetime import datetime
from threading import RLock
from typing import Dict, Iterable, List, Optional

from app.cost.orm import Base, UsageRecordORM
from app.cost.schemas import UsageRecord


def _row_to_usage(row: UsageRecordORM) -> UsageRecord:
    return UsageRecord(
        record_id=row.record_id,
        tenant_id=row.tenant_id,
        user_id=row.user_id,
        application_id=row.application_id,
        model_id=row.model_id,
        provider_id=row.provider_id,
        input_tokens=row.input_tokens or 0,
        output_tokens=row.output_tokens or 0,
        total_tokens=row.total_tokens or 0,
        cost=row.cost or 0.0,
        timestamp=row.timestamp,
    )


def _usage_to_row(record: UsageRecord) -> UsageRecordORM:
    return UsageRecordORM(
        record_id=record.record_id,
        tenant_id=record.tenant_id,
        user_id=record.user_id,
        application_id=record.application_id,
        model_id=record.model_id,
        provider_id=record.provider_id,
        input_tokens=record.input_tokens,
        output_tokens=record.output_tokens,
        total_tokens=record.total_tokens,
        cost=record.cost,
        timestamp=record.timestamp,
    )


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


class SqlAlchemyUsageRepository:
    """Async SQLAlchemy 2.0 repository backed by ``llmgw_usage_records``."""

    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    @classmethod
    async def create_all(cls, engine) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def insert(self, record: UsageRecord) -> UsageRecord:
        async with self._session_factory() as session:
            session.add(_usage_to_row(record))
            await session.commit()
            return record

    async def insert_many(self, records: Iterable[UsageRecord]) -> int:
        async with self._session_factory() as session:
            count = 0
            for r in records:
                session.add(_usage_to_row(r))
                count += 1
            await session.commit()
            return count

    async def list(
        self,
        tenant_id: str,
        *,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[UsageRecord]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(UsageRecordORM).where(UsageRecordORM.tenant_id == tenant_id)
            if start_time is not None:
                stmt = stmt.where(UsageRecordORM.timestamp >= start_time)
            if end_time is not None:
                stmt = stmt.where(UsageRecordORM.timestamp <= end_time)
            stmt = stmt.order_by(UsageRecordORM.timestamp)
            rows = (await session.execute(stmt)).scalars().all()
            return [_row_to_usage(r) for r in rows]

    async def clear(self) -> None:
        async with self._session_factory() as session:
            await session.execute(UsageRecordORM.__table__.delete())
            await session.commit()