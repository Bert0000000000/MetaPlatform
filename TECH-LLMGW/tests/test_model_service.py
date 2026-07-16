"""Model service tests (P1-LLMGW-01)."""

from __future__ import annotations

import pytest

from app.common.context import PUBLIC_TENANT_ID
from app.common.errors import ModelNotFoundError, ProviderNotFoundError
from app.models.catalog import ModelCatalog
from app.models.schemas import ModelType
from app.models.service import ModelService


TENANT = "tenant-test"


def _model_id(provider: str, code: str) -> str:
    return f"m-{provider.lower()}-{code.lower()}"


class TestModelServiceSync:
    def test_sync_models_success(self, registry):
        # Service-level: full catalog sync writes per-tenant + public rows.
        result = registry.model_service.sync(TENANT)
        assert result["total"] == len(ModelCatalog.CATALOG)
        # Per provider stats should be non-empty.
        provider_names = {p["provider"] for p in result["providers"]}
        assert {"OPENAI", "VOLCENGINE"}.issubset(provider_names)

        # Public catalog should also be populated.
        public_models = [
            m for m in registry.model_repo.all() if m.tenant_id == PUBLIC_TENANT_ID
        ]
        assert len(public_models) == len(ModelCatalog.CATALOG)

    def test_sync_models_filters_inactive_provider(self, registry):
        # Only sync OPENAI -> only OPENAI rows appear for the tenant.
        result = registry.model_service.sync(TENANT, providers=["OPENAI"])
        tenant_models = registry.model_service.list(TENANT)
        providers = {m.provider for m in tenant_models}
        assert providers == {"OPENAI"}
        assert result["providers"][0]["fetched"] > 0

    def test_sync_unknown_provider_raises(self, registry):
        with pytest.raises(ProviderNotFoundError):
            registry.model_service.sync(TENANT, providers=["NOT_A_PROVIDER"])


class TestModelServiceList:
    def test_list_filters_by_provider_type_enabled(self, seeded_models):
        # Provider filter
        openai = seeded_models.model_service.list(TENANT, provider="OPENAI")
        assert all(m.provider == "OPENAI" for m in openai)
        # Type filter
        mm = seeded_models.model_service.list(TENANT, type_=ModelType.MULTIMODAL)
        assert all(m.type == ModelType.MULTIMODAL for m in mm)
        # Disabled filter
        seeded_models.model_service.list(TENANT, enabled=False)
        # No filter (all enabled)
        all_models = seeded_models.model_service.list(TENANT)
        assert len(all_models) == len(ModelCatalog.CATALOG)

    def test_global_models_includes_public_and_tenant(self, seeded_models):
        # Tenant-only first.
        tenant_only = seeded_models.model_service.list(TENANT)
        assert len(tenant_only) == len(ModelCatalog.CATALOG)
        # Global includes tenant + public; public adds the same catalog again
        # but may dedupe via different ids; we expect >= tenant count.
        global_models = seeded_models.model_service.list_global(TENANT)
        assert len(global_models) >= len(tenant_only)
        # Public rows are visible too.
        assert any(m.tenant_id == PUBLIC_TENANT_ID for m in global_models)

    def test_tenant_isolation_blocks_cross_tenant_model(self, seeded_models):
        # ``detail()`` falls through to the public catalog, so a tenant
        # can still see a model that was synced into ``_public`` (this is
        # the documented behaviour of ``GET /models/global``).
        # However, ``list()`` MUST be tenant-scoped.
        other_tenant = "tenant-other"
        # List for ``other_tenant`` must be empty before they sync.
        assert seeded_models.model_service.list(other_tenant) == []
        # Now sync for them and verify the rows are theirs only.
        seeded_models.model_service.sync(other_tenant)
        others = seeded_models.model_service.list(other_tenant)
        assert all(m.tenant_id == other_tenant for m in others)
        # And the test tenant's list is independent of the other tenant.
        tenant_models = seeded_models.model_service.list(TENANT)
        assert all(m.tenant_id == TENANT for m in tenant_models)
        assert {m.tenant_id for m in tenant_models} == {TENANT}


class TestModelServiceDetail:
    def test_get_model_detail_404_when_missing(self, registry):
        with pytest.raises(ModelNotFoundError):
            registry.model_service.detail(TENANT, "m-does-not-exist")
