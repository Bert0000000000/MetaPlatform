"""In-memory model repository used by Phase 2."""

from __future__ import annotations

from datetime import datetime, timezone
from threading import RLock
from typing import Dict, Iterable, List, Optional

from app.models.schemas import Model, ModelType


def _now() -> datetime:
    return datetime.now(timezone.utc)


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