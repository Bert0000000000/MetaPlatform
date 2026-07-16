"""Data access layer for data sources.

Provides an abstract :class:`DataSourceRepository` plus two implementations:

* :class:`InMemoryDataSourceRepository` — thread-safe in-memory store used by
  tests and as the default when no database is configured.
* :class:`SqlAlchemyDataSourceRepository` — async SQLAlchemy 2.0
  implementation backed by the ``data_source`` table.
"""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Any, Optional

from app.models.orm import Base, DataSourceORM
from app.models.schemas import DataSource, DataSourceStatus, DataSourceType


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return f"ds-{uuid.uuid4().hex[:24]}"


def _row_to_model(row: DataSourceORM) -> DataSource:
    return DataSource(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name,
        source_type=DataSourceType(row.source_type),
        connection_config=dict(row.connection_config or {}),
        status=DataSourceStatus(row.status),
        created_at=row.created_at if row.created_at else _now(),
        updated_at=row.updated_at if row.updated_at else _now(),
    )


class DataSourceRepository(ABC):
    """Abstract repository contract."""

    @abstractmethod
    async def create(self, ds: DataSource) -> DataSource: ...

    @abstractmethod
    async def get(self, ds_id: str, tenant_id: str) -> Optional[DataSource]: ...

    @abstractmethod
    async def get_by_name(
        self, tenant_id: str, name: str
    ) -> Optional[DataSource]: ...

    @abstractmethod
    async def list(
        self,
        tenant_id: str,
        *,
        source_type: Optional[DataSourceType] = None,
        status: Optional[DataSourceStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[DataSource], int]: ...

    @abstractmethod
    async def update(
        self, ds_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[DataSource]: ...

    @abstractmethod
    async def delete(self, ds_id: str, tenant_id: str) -> bool: ...


class InMemoryDataSourceRepository(DataSourceRepository):
    """Thread-safe in-memory repository (used by tests & default runtime)."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._store: dict[tuple[str, str], DataSource] = {}

    async def create(self, ds: DataSource) -> DataSource:
        with self._lock:
            if not ds.id:
                ds.id = _new_id()
            ds.created_at = _now()
            ds.updated_at = ds.created_at
            self._store[(ds.tenant_id, ds.id)] = ds
            return ds

    async def get(self, ds_id: str, tenant_id: str) -> Optional[DataSource]:
        with self._lock:
            return self._store.get((tenant_id, ds_id))

    async def get_by_name(
        self, tenant_id: str, name: str
    ) -> Optional[DataSource]:
        with self._lock:
            for (tid, _), ds in self._store.items():
                if tid == tenant_id and ds.name == name:
                    return ds
            return None

    async def list(
        self,
        tenant_id: str,
        *,
        source_type: Optional[DataSourceType] = None,
        status: Optional[DataSourceStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[DataSource], int]:
        with self._lock:
            results = [
                ds
                for (tid, _), ds in self._store.items()
                if tid == tenant_id
                and (source_type is None or ds.source_type == source_type)
                and (status is None or ds.status == status)
            ]
        results.sort(key=lambda d: d.created_at)
        total = len(results)
        start = (page - 1) * page_size
        end = start + page_size
        return results[start:end], total

    async def update(
        self, ds_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[DataSource]:
        with self._lock:
            ds = self._store.get((tenant_id, ds_id))
            if ds is None:
                return None
            updated = ds.model_copy(update=fields)
            updated.updated_at = _now()
            self._store[(tenant_id, ds_id)] = updated
            return updated

    async def delete(self, ds_id: str, tenant_id: str) -> bool:
        with self._lock:
            return self._store.pop((tenant_id, ds_id), None) is not None

    # -- test helpers --------------------------------------------------

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


class SqlAlchemyDataSourceRepository(DataSourceRepository):
    """Async SQLAlchemy 2.0 repository backed by ``data_source`` table."""

    def __init__(self, session_factory) -> None:
        # ``session_factory`` is an async_sessionmaker.
        self._session_factory = session_factory

    @classmethod
    async def create_all(cls, engine) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def create(self, ds: DataSource) -> DataSource:
        if not ds.id:
            ds.id = _new_id()
        ds.created_at = _now()
        ds.updated_at = ds.created_at
        row = DataSourceORM(
            id=ds.id,
            tenant_id=ds.tenant_id,
            name=ds.name,
            source_type=ds.source_type.value,
            connection_config=ds.connection_config,
            status=ds.status.value,
            created_at=ds.created_at,
            updated_at=ds.updated_at,
        )
        async with self._session_factory() as session:
            session.add(row)
            await session.commit()
            return ds

    async def get(self, ds_id: str, tenant_id: str) -> Optional[DataSource]:
        async with self._session_factory() as session:
            row = await session.get(DataSourceORM, ds_id)
            if row is None or row.tenant_id != tenant_id:
                return None
            return _row_to_model(row)

    async def get_by_name(
        self, tenant_id: str, name: str
    ) -> Optional[DataSource]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(DataSourceORM).where(
                DataSourceORM.tenant_id == tenant_id,
                DataSourceORM.name == name,
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            return _row_to_model(row) if row else None

    async def list(
        self,
        tenant_id: str,
        *,
        source_type: Optional[DataSourceType] = None,
        status: Optional[DataSourceStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[DataSource], int]:
        from sqlalchemy import func, select

        async with self._session_factory() as session:
            base = select(DataSourceORM).where(DataSourceORM.tenant_id == tenant_id)
            count_base = select(func.count()).select_from(DataSourceORM).where(
                DataSourceORM.tenant_id == tenant_id
            )
            if source_type is not None:
                base = base.where(DataSourceORM.source_type == source_type.value)
                count_base = count_base.where(
                    DataSourceORM.source_type == source_type.value
                )
            if status is not None:
                base = base.where(DataSourceORM.status == status.value)
                count_base = count_base.where(DataSourceORM.status == status.value)
            total = (await session.execute(count_base)).scalar_one()
            rows = (
                await session.execute(
                    base.order_by(DataSourceORM.created_at)
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).scalars().all()
            return [_row_to_model(r) for r in rows], total

    async def update(
        self, ds_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[DataSource]:
        async with self._session_factory() as session:
            row = await session.get(DataSourceORM, ds_id)
            if row is None or row.tenant_id != tenant_id:
                return None
            if "name" in fields:
                row.name = fields["name"]
            if "source_type" in fields:
                row.source_type = fields["source_type"].value
            if "connection_config" in fields:
                row.connection_config = fields["connection_config"]
            if "status" in fields:
                row.status = fields["status"].value
            row.updated_at = _now()
            await session.commit()
            return _row_to_model(row)

    async def delete(self, ds_id: str, tenant_id: str) -> bool:
        async with self._session_factory() as session:
            row = await session.get(DataSourceORM, ds_id)
            if row is None or row.tenant_id != tenant_id:
                return False
            await session.delete(row)
            await session.commit()
            return True
