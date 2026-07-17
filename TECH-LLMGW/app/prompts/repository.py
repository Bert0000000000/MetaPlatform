"""Prompt repository: in-memory (tests/default) + SqlAlchemy (production)."""

from __future__ import annotations

from datetime import datetime, timezone
from threading import RLock
from typing import Dict, List, Optional

from app.prompts.orm import Base, PromptORM, PromptVersionORM
from app.prompts.schemas import PromptRecord, PromptStatus, PromptVariableDef, PromptVersionRecord


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _row_to_prompt(row: PromptORM) -> PromptRecord:
    return PromptRecord(
        prompt_id=row.prompt_id,
        tenant_id=row.tenant_id,
        prompt_key=row.prompt_key,
        name=row.name,
        description=row.description,
        category=row.category,
        template=row.template,
        variables=[PromptVariableDef(**v) for v in (row.variables or [])],
        default_model=row.default_model,
        default_params=row.default_params,
        tags=list(row.tags or []),
        version=row.version,
        is_latest=row.is_latest,
        status=PromptStatus(row.status),
        change_log=row.change_log,
        created_by=row.created_by,
        updated_by=row.updated_by,
        created_at=row.created_at if row.created_at else _now(),
        updated_at=row.updated_at if row.updated_at else _now(),
    )


def _prompt_to_row(record: PromptRecord) -> PromptORM:
    return PromptORM(
        prompt_id=record.prompt_id,
        tenant_id=record.tenant_id,
        prompt_key=record.prompt_key,
        name=record.name,
        description=record.description,
        category=record.category,
        template=record.template,
        variables=[v.model_dump() for v in record.variables],
        default_model=record.default_model,
        default_params=record.default_params,
        tags=list(record.tags),
        version=record.version,
        is_latest=record.is_latest,
        status=record.status.value,
        change_log=record.change_log,
        created_by=record.created_by,
        updated_by=record.updated_by,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _version_row_to_model(row: PromptVersionORM) -> PromptVersionRecord:
    return PromptVersionRecord(
        prompt_id=row.prompt_id,
        tenant_id=row.tenant_id,
        prompt_key=row.prompt_key,
        name=row.name,
        description=row.description,
        category=row.category,
        template=row.template,
        variables=[PromptVariableDef(**v) for v in (row.variables or [])],
        default_model=row.default_model,
        default_params=row.default_params,
        tags=list(row.tags or []),
        version=row.version,
        is_latest=row.is_latest,
        status=PromptStatus(row.status),
        change_log=row.change_log,
        created_by=row.created_by,
        updated_by=row.updated_by,
        created_at=row.created_at if row.created_at else _now(),
        updated_at=row.updated_at if row.updated_at else _now(),
        previous_version=row.previous_version,
        rolled_back_from=row.rolled_back_from,
        rolled_back_to=row.rolled_back_to,
    )


def _version_to_row(version: PromptVersionRecord) -> PromptVersionORM:
    return PromptVersionORM(
        prompt_id=version.prompt_id,
        tenant_id=version.tenant_id,
        prompt_key=version.prompt_key,
        name=version.name,
        description=version.description,
        category=version.category,
        template=version.template,
        variables=[v.model_dump() for v in version.variables],
        default_model=version.default_model,
        default_params=version.default_params,
        tags=list(version.tags),
        version=version.version,
        is_latest=version.is_latest,
        status=version.status.value,
        change_log=version.change_log,
        created_by=version.created_by,
        updated_by=version.updated_by,
        created_at=version.created_at,
        updated_at=version.updated_at,
        previous_version=version.previous_version,
        rolled_back_from=version.rolled_back_from,
        rolled_back_to=version.rolled_back_to,
    )


class PromptRepository:
    """Thread-safe in-memory replacement for llmgw_prompts + llmgw_prompt_versions."""

    def __init__(self) -> None:
        self._lock = RLock()
        # prompt_id -> latest PromptRecord
        self._prompts: Dict[str, PromptRecord] = {}
        # (prompt_id, version) -> PromptVersionRecord
        self._versions: Dict[tuple[str, int], PromptVersionRecord] = {}
        # (tenant_id, prompt_key) -> prompt_id
        self._key_index: Dict[tuple[str, str], str] = {}

    # ------------------------------------------------------------------ CRUD

    def insert(
        self,
        record: PromptRecord,
        versions: List[PromptVersionRecord],
    ) -> PromptRecord:
        with self._lock:
            self._prompts[record.prompt_id] = record
            self._key_index[(record.tenant_id, record.prompt_key)] = record.prompt_id
            for v in versions:
                self._versions[(v.prompt_id, v.version)] = v
            return record

    def get(self, prompt_id: str) -> Optional[PromptRecord]:
        with self._lock:
            return self._prompts.get(prompt_id)

    def get_by_key(self, tenant_id: str, prompt_key: str) -> Optional[PromptRecord]:
        with self._lock:
            prompt_id = self._key_index.get((tenant_id, prompt_key))
            if prompt_id is None:
                return None
            return self._prompts.get(prompt_id)

    def update(self, record: PromptRecord) -> PromptRecord:
        with self._lock:
            record.updated_at = _now()
            self._prompts[record.prompt_id] = record
            return record

    def save_version(self, version: PromptVersionRecord) -> PromptVersionRecord:
        with self._lock:
            self._versions[(version.prompt_id, version.version)] = version
            return version

    def remove(self, prompt_id: str) -> Optional[PromptRecord]:
        with self._lock:
            record = self._prompts.pop(prompt_id, None)
            if record is None:
                return None
            self._key_index.pop((record.tenant_id, record.prompt_key), None)
            # Cascade delete versions.
            keys_to_drop = [
                key for key in self._versions.keys() if key[0] == prompt_id
            ]
            for key in keys_to_drop:
                del self._versions[key]
            return record

    def list(
        self,
        tenant_id: str,
        *,
        keyword: Optional[str] = None,
        tags: Optional[List[str]] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[PromptRecord]:
        with self._lock:
            results = [
                p
                for p in self._prompts.values()
                if p.tenant_id == tenant_id
                and (category is None or p.category == category)
                and (status is None or p.status.value == status)
                and (tags is None or any(t in p.tags for t in tags))
            ]
        if keyword:
            keyword_lower = keyword.lower()
            results = [
                p
                for p in results
                if (p.name and keyword_lower in p.name.lower())
                or (p.description and keyword_lower in p.description.lower())
                or (p.prompt_key and keyword_lower in p.prompt_key.lower())
            ]
        results.sort(key=lambda p: p.updated_at, reverse=True)
        return results

    def list_versions(self, prompt_id: str) -> List[PromptVersionRecord]:
        with self._lock:
            versions = [
                v for (pid, _), v in self._versions.items() if pid == prompt_id
            ]
        versions.sort(key=lambda v: v.version, reverse=True)
        return versions

    def get_version(self, prompt_id: str, version: int) -> Optional[PromptVersionRecord]:
        with self._lock:
            return self._versions.get((prompt_id, version))

    def key_exists(self, tenant_id: str, prompt_key: str) -> bool:
        with self._lock:
            return (tenant_id, prompt_key) in self._key_index

    def clear(self) -> None:
        with self._lock:
            self._prompts.clear()
            self._versions.clear()
            self._key_index.clear()


class SqlAlchemyPromptRepository:
    """Async SQLAlchemy 2.0 repository backed by llmgw_prompts + versions."""

    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    @classmethod
    async def create_all(cls, engine) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def insert(
        self,
        record: PromptRecord,
        versions: List[PromptVersionRecord],
    ) -> PromptRecord:
        async with self._session_factory() as session:
            session.add(_prompt_to_row(record))
            for v in versions:
                session.add(_version_to_row(v))
            await session.commit()
            return record

    async def get(self, prompt_id: str) -> Optional[PromptRecord]:
        async with self._session_factory() as session:
            row = await session.get(PromptORM, prompt_id)
            return _row_to_prompt(row) if row else None

    async def get_by_key(self, tenant_id: str, prompt_key: str) -> Optional[PromptRecord]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(PromptORM).where(
                PromptORM.tenant_id == tenant_id,
                PromptORM.prompt_key == prompt_key,
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            return _row_to_prompt(row) if row else None

    async def update(self, record: PromptRecord) -> PromptRecord:
        async with self._session_factory() as session:
            row = await session.get(PromptORM, record.prompt_id)
            if row is None:
                session.add(_prompt_to_row(record))
            else:
                row.prompt_key = record.prompt_key
                row.name = record.name
                row.description = record.description
                row.category = record.category
                row.template = record.template
                row.variables = [v.model_dump() for v in record.variables]
                row.default_model = record.default_model
                row.default_params = record.default_params
                row.tags = list(record.tags)
                row.version = record.version
                row.is_latest = record.is_latest
                row.status = record.status.value
                row.change_log = record.change_log
                row.updated_by = record.updated_by
                row.updated_at = _now()
            await session.commit()
            return record

    async def save_version(self, version: PromptVersionRecord) -> PromptVersionRecord:
        async with self._session_factory() as session:
            session.add(_version_to_row(version))
            await session.commit()
            return version

    async def remove(self, prompt_id: str) -> Optional[PromptRecord]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            row = await session.get(PromptORM, prompt_id)
            if row is None:
                return None
            record = _row_to_prompt(row)
            await session.delete(row)
            stmt = select(PromptVersionORM).where(PromptVersionORM.prompt_id == prompt_id)
            version_rows = (await session.execute(stmt)).scalars().all()
            for vr in version_rows:
                await session.delete(vr)
            await session.commit()
            return record

    async def list(
        self,
        tenant_id: str,
        *,
        keyword: Optional[str] = None,
        tags: Optional[List[str]] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[PromptRecord]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(PromptORM).where(PromptORM.tenant_id == tenant_id)
            if category is not None:
                stmt = stmt.where(PromptORM.category == category)
            if status is not None:
                stmt = stmt.where(PromptORM.status == status)
            stmt = stmt.order_by(PromptORM.updated_at.desc())
            rows = (await session.execute(stmt)).scalars().all()
            results = [_row_to_prompt(r) for r in rows]
        if tags:
            results = [p for p in results if any(t in p.tags for t in tags)]
        if keyword:
            keyword_lower = keyword.lower()
            results = [
                p
                for p in results
                if (p.name and keyword_lower in p.name.lower())
                or (p.description and keyword_lower in p.description.lower())
                or (p.prompt_key and keyword_lower in p.prompt_key.lower())
            ]
        return results

    async def list_versions(self, prompt_id: str) -> List[PromptVersionRecord]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = (
                select(PromptVersionORM)
                .where(PromptVersionORM.prompt_id == prompt_id)
                .order_by(PromptVersionORM.version.desc())
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [_version_row_to_model(r) for r in rows]

    async def get_version(self, prompt_id: str, version: int) -> Optional[PromptVersionRecord]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(PromptVersionORM).where(
                PromptVersionORM.prompt_id == prompt_id,
                PromptVersionORM.version == version,
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            return _version_row_to_model(row) if row else None

    async def key_exists(self, tenant_id: str, prompt_key: str) -> bool:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(PromptORM.prompt_id).where(
                PromptORM.tenant_id == tenant_id,
                PromptORM.prompt_key == prompt_key,
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            return row is not None

    async def clear(self) -> None:
        async with self._session_factory() as session:
            await session.execute(PromptVersionORM.__table__.delete())
            await session.execute(PromptORM.__table__.delete())
            await session.commit()
