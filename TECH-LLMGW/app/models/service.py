"""Model service: orchestrates sync, list, detail, global view."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, List, Optional, Sequence

from app.common.context import PUBLIC_TENANT_ID
from app.common.errors import (
    ModelNotAvailableError,
    ModelNotFoundError,
    ProviderNotFoundError,
)
from app.models.catalog import ModelCatalog
from app.models.repository import ModelRepository
from app.models.schemas import (
    Model,
    ModelCapability,
    ModelType,
    to_list_item,
)


def _make_model_id(provider: str, code: str) -> str:
    return f"m-{provider.lower()}-{code.lower()}"


class ModelService:
    def __init__(self, repository: ModelRepository) -> None:
        self._repo = repository

    # -------------------------------------------------------------- providers

    @staticmethod
    def known_providers() -> List[str]:
        return ModelCatalog.providers()

    # ------------------------------------------------------------------ sync

    async def sync(
        self,
        tenant_id: str,
        providers: Optional[Sequence[str]] = None,
    ) -> dict:
        """Sync catalog for ``tenant_id`` (and public catalog)."""

        if providers:
            normalized = [p.upper() for p in providers]
            unknown = [p for p in normalized if p not in ModelCatalog.providers()]
            if unknown:
                raise ProviderNotFoundError(
                    f"供应商不存在: {','.join(unknown)}",
                    data={"unknownProviders": unknown},
                )
            specs = ModelCatalog.filter_by_providers(normalized)
        else:
            specs = ModelCatalog.all()

        provider_stats: dict[str, dict[str, int]] = {}
        total_added = 0
        total_updated = 0

        # Tenant-specific rows
        for spec in specs:
            stat = provider_stats.setdefault(
                spec.provider,
                {"fetched": 0, "added": 0, "updated": 0, "removed": 0},
            )
            model = Model(
                model_id=_make_model_id(spec.provider, spec.code),
                tenant_id=tenant_id,
                provider=spec.provider,
                model_code=spec.code,
                display_name=spec.display_name,
                type=spec.type,
                input_price=spec.input_price,
                output_price=spec.output_price,
                context_length=spec.context_length,
                capabilities=[c.value for c in spec.capabilities],
                enabled=True,
                description=spec.description,
            )
            _, created = await self._repo.upsert(model)
            stat["fetched"] += 1
            if created:
                stat["added"] += 1
                total_added += 1
            else:
                stat["updated"] += 1
                total_updated += 1

        # Public catalog (idempotent across tenants)
        public_specs = list(specs)
        public_added = 0
        public_updated = 0
        for spec in public_specs:
            model = Model(
                model_id=_make_model_id(spec.provider, spec.code),
                tenant_id=PUBLIC_TENANT_ID,
                provider=spec.provider,
                model_code=spec.code,
                display_name=spec.display_name,
                type=spec.type,
                input_price=spec.input_price,
                output_price=spec.output_price,
                context_length=spec.context_length,
                capabilities=[c.value for c in spec.capabilities],
                enabled=True,
                description=spec.description,
            )
            _, created = await self._repo.upsert(model)
            if created:
                public_added += 1
            else:
                public_updated += 1

        provider_stat_list = [
            {
                "provider": provider,
                "fetched": stats["fetched"],
                "added": stats["added"],
                "updated": stats["updated"],
                "removed": stats["removed"],
            }
            for provider, stats in provider_stats.items()
        ]

        return {
            "syncedAt": datetime.now(timezone.utc),
            "providers": provider_stat_list,
            "total": total_added + total_updated,
            "_publicCounts": {
                "added": public_added,
                "updated": public_updated,
            },
        }

    # ------------------------------------------------------------------ list

    async def list(
        self,
        tenant_id: str,
        *,
        provider: Optional[str] = None,
        type_: Optional[ModelType] = None,
        enabled: Optional[bool] = None,
    ) -> List[Model]:
        return await self._repo.list(
            tenant_id,
            provider=provider,
            type_=type_,
            enabled=enabled if enabled is not None else True,
        )

    async def list_multimodal(self, tenant_id: str) -> List[Model]:
        models = await self._repo.list(tenant_id, type_=ModelType.MULTIMODAL)
        return [m for m in models if ModelCapability.VISION.value in m.capabilities]

    async def list_embedding(self, tenant_id: str) -> List[Model]:
        models = await self._repo.list(tenant_id, type_=ModelType.EMBEDDING)
        return [m for m in models if ModelCapability.EMBEDDING.value in m.capabilities]

    async def list_global(
        self,
        tenant_id: str,
        *,
        type_: Optional[ModelType] = None,
    ) -> List[Model]:
        return await self._repo.list_global(tenant_id, type_=type_)

    # ---------------------------------------------------------------- detail

    async def detail(self, tenant_id: str, model_id: str) -> Model:
        model = await self._repo.get_for_tenant(tenant_id, model_id)
        if model is None:
            # Allow public catalog fallback so cross-tenant lookups for the
            # "global" view are still resolvable.
            model = await self._repo.get(model_id, tenant_id=tenant_id)
        if model is None:
            raise ModelNotFoundError(
                f"模型不存在: modelId={model_id}",
                data={"modelId": model_id},
            )
        return model

    # ------------------------------------------------------ runtime helpers

    async def resolve_active(self, tenant_id: str, model_id: str) -> Model:
        """Resolve a model that must be enabled & visible to ``tenant_id``."""

        model = await self._repo.get_for_tenant(tenant_id, model_id)
        if model is None:
            model = await self._repo.get(model_id, tenant_id=tenant_id)
        if model is None:
            raise ModelNotFoundError(
                f"模型不存在: modelId={model_id}",
                data={"modelId": model_id},
            )
        if not model.enabled:
            raise ModelNotAvailableError(
                f"模型未启用: modelId={model_id}",
                data={"modelId": model_id},
            )
        return model

    def to_list_items(self, models: Iterable[Model]) -> List[dict]:
        return [to_list_item(m) for m in models]

    def to_detail(self, model: Model) -> dict:
        return to_list_item(model)