"""Model repository: in-memory (tests/default) + SqlAlchemy (production)."""

from __future__ import annotations

from datetime import datetime, timezone
from threading import RLock
from typing import Dict, Iterable, List, Optional

from app.models.orm import Base, LLMModelORM
from app.models.schemas import Model, ModelType


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _row_to_model(row: LLMModelORM) -> Model:
    return Model(
        model_id=row.model_id,
        tenant_id=row.tenant_id,
        provider=row.provider,
        model_code=row.model_code,
        display_name=row.display_name,
        type=ModelType(row.type),
        input_price=row.input_price or 0.0,
        output_price=row.output_price or 0.0,
        context_length=row.context_length or 0,
        capabilities=list(row.capabilities or []),
        enabled=row.enabled if row.enabled is not None else True,
        description=row.description or "",
        created_at=row.created_at if row.created_at else _now(),
        updated_at=row.updated_at if row.updated_at else _now(),
    )


def _model_to_row(model: Model) -> LLMModelORM:
    return LLMModelORM(
        model_id=model.model_id,
        tenant_id=model.tenant_id,
        provider=model.provider,
        model_code=model.model_code,
        display_name=model.display_name,
        type=model.type.value if isinstance(model.type, ModelType) else model.type,
        input_price=model.input_price,
        output_price=model.output_price,
        context_length=model.context_length,
        capabilities=list(model.capabilities),
        enabled=model.enabled,
        description=model.description,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class ModelRepository:
    """Thread-safe in-memory replacement for the ``llm_models`` table.

    Storage layout: ``models[(tenant_id, provider, code)] = Model``.
    """

    def __init__(self) -> None:
        self._lock = RLock()
        self._models: Dict[tuple[str, str, str], Model] = {}

    # ------------------------------------------------------------------ CRUD

    def upsert(self, model: Model) -> tuple[Model, bool]:
        """Insert or update by (tenant_id, provider, code). Returns
        ``(model, created)`` where ``created`` is True on first insert."""

        with self._lock:
            key = (model.tenant_id, model.provider, model.model_code)
            existed = key in self._models
            model.updated_at = _now()
            if not existed:
                model.created_at = _now()
            self._models[key] = model
            return model, not existed

    def remove(self, tenant_id: str, provider: str, code: str) -> bool:
        with self._lock:
            return self._models.pop((tenant_id, provider, code), None) is not None

    def get(self, model_id: str, tenant_id: Optional[str] = None) -> Optional[Model]:
        """Resolve a model by its public id ``m-{provider}-{code}``.

        When ``tenant_id`` is provided the lookup is scoped to that tenant
        plus public models (``_public``); otherwise it scans all tenants.
        """

        with self._lock:
            for (tid, provider, code), model in self._models.items():
                if model.model_id == model_id and (
                    tenant_id is None or tid in {tenant_id, "_public"}
                ):
                    return model
            return None

    def get_for_tenant(self, tenant_id: str, model_id: str) -> Optional[Model]:
        """Resolve a model strictly within ``tenant_id`` (no public fallback)."""

        with self._lock:
            for (tid, _, _), model in self._models.items():
                if model.model_id == model_id and tid == tenant_id:
                    return model
            return None

    def list(
        self,
        tenant_id: str,
        *,
        provider: Optional[str] = None,
        type_: Optional[ModelType] = None,
        enabled: Optional[bool] = None,
    ) -> List[Model]:
        with self._lock:
            results = [
                m
                for (tid, _, _), m in self._models.items()
                if tid == tenant_id
                and (provider is None or m.provider == provider.upper())
                and (type_ is None or m.type == type_)
                and (enabled is None or m.enabled == enabled)
            ]
        results.sort(key=lambda m: (m.provider, m.model_code))
        return results

    def list_global(
        self,
        tenant_id: str,
        *,
        type_: Optional[ModelType] = None,
    ) -> List[Model]:
        """Return models visible to ``tenant_id``: own + public."""

        with self._lock:
            results = [
                m
                for (tid, _, _), m in self._models.items()
                if tid in {tenant_id, "_public"}
                and (type_ is None or m.type == type_)
            ]
        results.sort(key=lambda m: (m.provider, m.model_code))
        return results

    def all(self) -> List[Model]:
        with self._lock:
            return list(self._models.values())

    # ---------------------------------------------------------- bulk helpers

    def list_keys(self, tenant_id: str, provider: str) -> List[str]:
        with self._lock:
            return [
                code
                for (tid, prov, code) in self._models.keys()
                if tid == tenant_id and prov == provider.upper()
            ]

    def clear(self) -> None:
        with self._lock:
            self._models.clear()


class SqlAlchemyModelRepository:
    """Async SQLAlchemy 2.0 repository backed by ``llm_models``.

    Provides the same method signatures as :class:`ModelRepository` but all
    methods are async coroutines. Used when ``database_url`` points at a
    real PostgreSQL instance.
    """

    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    @classmethod
    async def create_all(cls, engine) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def upsert(self, model: Model) -> tuple[Model, bool]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(LLMModelORM).where(
                LLMModelORM.tenant_id == model.tenant_id,
                LLMModelORM.provider == model.provider,
                LLMModelORM.model_code == model.model_code,
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            model.updated_at = _now()
            if row is None:
                model.created_at = _now()
                session.add(_model_to_row(model))
                await session.commit()
                return model, True
            row.provider = model.provider
            row.model_code = model.model_code
            row.display_name = model.display_name
            row.type = model.type.value if isinstance(model.type, ModelType) else model.type
            row.input_price = model.input_price
            row.output_price = model.output_price
            row.context_length = model.context_length
            row.capabilities = list(model.capabilities)
            row.enabled = model.enabled
            row.description = model.description
            row.updated_at = model.updated_at
            await session.commit()
            return _row_to_model(row), False

    async def remove(self, tenant_id: str, provider: str, code: str) -> bool:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(LLMModelORM).where(
                LLMModelORM.tenant_id == tenant_id,
                LLMModelORM.provider == provider,
                LLMModelORM.model_code == code,
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            if row is None:
                return False
            await session.delete(row)
            await session.commit()
            return True

    async def get(self, model_id: str, tenant_id: Optional[str] = None) -> Optional[Model]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(LLMModelORM).where(LLMModelORM.model_id == model_id)
            row = (await session.execute(stmt)).scalar_one_or_none()
            if row is None:
                return None
            if tenant_id is not None and row.tenant_id not in {tenant_id, "_public"}:
                return None
            return _row_to_model(row)

    async def get_for_tenant(self, tenant_id: str, model_id: str) -> Optional[Model]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(LLMModelORM).where(
                LLMModelORM.model_id == model_id,
                LLMModelORM.tenant_id == tenant_id,
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            return _row_to_model(row) if row else None

    async def list(
        self,
        tenant_id: str,
        *,
        provider: Optional[str] = None,
        type_: Optional[ModelType] = None,
        enabled: Optional[bool] = None,
    ) -> List[Model]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(LLMModelORM).where(LLMModelORM.tenant_id == tenant_id)
            if provider is not None:
                stmt = stmt.where(LLMModelORM.provider == provider.upper())
            if type_ is not None:
                stmt = stmt.where(LLMModelORM.type == type_.value)
            if enabled is not None:
                stmt = stmt.where(LLMModelORM.enabled == enabled)
            stmt = stmt.order_by(LLMModelORM.provider, LLMModelORM.model_code)
            rows = (await session.execute(stmt)).scalars().all()
            return [_row_to_model(r) for r in rows]

    async def list_global(
        self,
        tenant_id: str,
        *,
        type_: Optional[ModelType] = None,
    ) -> List[Model]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(LLMModelORM).where(
                LLMModelORM.tenant_id.in_([tenant_id, "_public"])
            )
            if type_ is not None:
                stmt = stmt.where(LLMModelORM.type == type_.value)
            stmt = stmt.order_by(LLMModelORM.provider, LLMModelORM.model_code)
            rows = (await session.execute(stmt)).scalars().all()
            return [_row_to_model(r) for r in rows]

    async def all(self) -> List[Model]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(LLMModelORM)
            rows = (await session.execute(stmt)).scalars().all()
            return [_row_to_model(r) for r in rows]

    async def list_keys(self, tenant_id: str, provider: str) -> List[str]:
        from sqlalchemy import select

        async with self._session_factory() as session:
            stmt = select(LLMModelORM.model_code).where(
                LLMModelORM.tenant_id == tenant_id,
                LLMModelORM.provider == provider.upper(),
            )
            rows = (await session.execute(stmt)).scalars().all()
            return list(rows)

    async def clear(self) -> None:
        async with self._session_factory() as session:
            await session.execute(LLMModelORM.__table__.delete())
            await session.commit()