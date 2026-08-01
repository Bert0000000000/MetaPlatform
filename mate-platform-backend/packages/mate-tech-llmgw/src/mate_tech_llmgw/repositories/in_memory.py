"""In-memory repository for the llmgw domain (P3-W4 TD-5).

Entities: LlmProvider, LlmModel, LlmRouteRule.
These capture the LLM gateway's provider/model registry and routing
configuration so it can be persisted to SQL.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class LlmProvider:
    id: str
    tenant_id: str
    name: str = ""
    provider_type: str = ""
    base_url: str = ""
    enabled: bool = True
    config: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""


@dataclass(frozen=True)
class LlmModel:
    id: str
    tenant_id: str
    model_id: str = ""
    display_name: str = ""
    provider: str = ""
    modality: str = "text"
    max_tokens: int = 4096
    enabled: bool = True
    config: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""


@dataclass(frozen=True)
class LlmRouteRule:
    id: str
    tenant_id: str
    model_pattern: str = ""
    provider: str = ""
    priority: int = 0
    enabled: bool = True
    created_at: str = ""
    updated_at: str = ""


# ---------------------------------------------------------------------------
# Seed builders
# ---------------------------------------------------------------------------
def _seed_providers(tenant_id: str) -> dict[str, LlmProvider]:
    catalog = [
        ("prov-openai", "OpenAI", "openai", "https://api.openai.com/v1", True),
        ("prov-anthropic", "Anthropic", "anthropic", "https://api.anthropic.com", True),
        ("prov-qwen", "Qwen", "qwen", "https://dashscope.aliyuncs.com/api/v1", True),
        ("prov-doubao", "Doubao", "doubao", "https://ark.cn-beijing.volces.com/api/v3", True),
    ]
    return {
        pid: LlmProvider(
            id=pid, tenant_id=tenant_id, name=name, provider_type=pt,
            base_url=url, enabled=en, config={"timeout": 30},
            created_at="2026-08-01T00:00:00Z",
            updated_at="2026-08-01T00:00:00Z",
        )
        for pid, name, pt, url, en in catalog
    }


def _seed_models(tenant_id: str) -> dict[str, LlmModel]:
    catalog = [
        ("model-gpt4o", "gpt-4o", "GPT-4o", "openai", "text", 4096, True),
        ("model-claude35", "claude-3-5-sonnet-20241022", "Claude 3.5 Sonnet", "anthropic", "text", 8192, True),
        ("model-qwen-max", "qwen-max", "Qwen Max", "qwen", "text", 8192, True),
        ("model-doubao-pro", "doubao-pro", "Doubao Pro", "doubao", "text", 4096, True),
    ]
    return {
        mid: LlmModel(
            id=mid, tenant_id=tenant_id, model_id=moid, display_name=dn,
            provider=prov, modality=mod, max_tokens=mt, enabled=en,
            config={"temperature": 1.0},
            created_at="2026-08-01T00:00:00Z",
            updated_at="2026-08-01T00:00:00Z",
        )
        for mid, moid, dn, prov, mod, mt, en in catalog
    }


def _seed_route_rules(tenant_id: str) -> dict[str, LlmRouteRule]:
    catalog = [
        ("route-gpt", "gpt-*", "openai", 10, True),
        ("route-claude", "claude-*", "anthropic", 10, True),
        ("route-qwen", "qwen*", "qwen", 10, True),
        ("route-doubao", "doubao*", "doubao", 10, True),
    ]
    return {
        rid: LlmRouteRule(
            id=rid, tenant_id=tenant_id, model_pattern=pat, provider=prov,
            priority=pri, enabled=en,
            created_at="2026-08-01T00:00:00Z",
            updated_at="2026-08-01T00:00:00Z",
        )
        for rid, pat, prov, pri, en in catalog
    }


# ---------------------------------------------------------------------------
# Stores
# ---------------------------------------------------------------------------
_PROVIDERS: dict[str, dict[str, LlmProvider]] = {}
_MODELS: dict[str, dict[str, LlmModel]] = {}
_ROUTE_RULES: dict[str, dict[str, LlmRouteRule]] = {}


def _ensure_tenant(tenant_id: str) -> None:
    if not tenant_id:
        return
    if tenant_id not in _PROVIDERS:
        _PROVIDERS[tenant_id] = _seed_providers(tenant_id)
    if tenant_id not in _MODELS:
        _MODELS[tenant_id] = _seed_models(tenant_id)
    if tenant_id not in _ROUTE_RULES:
        _ROUTE_RULES[tenant_id] = _seed_route_rules(tenant_id)


def list_providers(tenant_id: str) -> list[LlmProvider]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_PROVIDERS[tenant_id].values(), key=lambda x: x.id)


def get_provider(tenant_id: str, pid: str) -> LlmProvider | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _PROVIDERS[tenant_id].get(pid)


def list_models(tenant_id: str) -> list[LlmModel]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_MODELS[tenant_id].values(), key=lambda x: x.id)


def get_model(tenant_id: str, mid: str) -> LlmModel | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _MODELS[tenant_id].get(mid)


def list_route_rules(tenant_id: str) -> list[LlmRouteRule]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_ROUTE_RULES[tenant_id].values(), key=lambda x: x.id)


def get_route_rule(tenant_id: str, rid: str) -> LlmRouteRule | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _ROUTE_RULES[tenant_id].get(rid)


def put_provider(tenant_id: str, prov: LlmProvider) -> LlmProvider:
    if not tenant_id:
        return prov
    _ensure_tenant(tenant_id)
    _PROVIDERS[tenant_id][prov.id] = prov
    return prov


def delete_provider(tenant_id: str, pid: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if pid not in _PROVIDERS[tenant_id]:
        return False
    del _PROVIDERS[tenant_id][pid]
    return True


def put_model(tenant_id: str, model: LlmModel) -> LlmModel:
    if not tenant_id:
        return model
    _ensure_tenant(tenant_id)
    _MODELS[tenant_id][model.id] = model
    return model


def delete_model(tenant_id: str, mid: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if mid not in _MODELS[tenant_id]:
        return False
    del _MODELS[tenant_id][mid]
    return True


def put_route_rule(tenant_id: str, rule: LlmRouteRule) -> LlmRouteRule:
    if not tenant_id:
        return rule
    _ensure_tenant(tenant_id)
    _ROUTE_RULES[tenant_id][rule.id] = rule
    return rule


def delete_route_rule(tenant_id: str, rid: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if rid not in _ROUTE_RULES[tenant_id]:
        return False
    del _ROUTE_RULES[tenant_id][rid]
    return True


def reset_store() -> None:
    _PROVIDERS.clear()
    _MODELS.clear()
    _ROUTE_RULES.clear()
