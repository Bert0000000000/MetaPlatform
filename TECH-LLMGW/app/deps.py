"""Service registry & FastAPI dependencies.

The registry is a process-wide singleton so all routers share the same
model catalog, repository and provider clients. Tests use ``reset`` to
wipe in-memory state between cases.

Repository backend selection:
- Default (SQLite / empty URL): In-memory repositories (synchronous,
  used by tests and local development).
- PostgreSQL (``postgresql+asyncpg://...``): SqlAlchemy async repositories
  backed by the ``llm_*`` / ``llmgw_*`` tables.
"""

from __future__ import annotations

from dataclasses import dataclass
from threading import RLock
from typing import Any, Optional

from fastapi import Request

from app.audit.repository import AuditLogRepository, SqlAlchemyAuditLogRepository
from app.audit.service import AuditLogService
from app.chat.provider_client import MockProviderClient, ProviderClient
from app.chat.service import ChatService
from app.config import settings
from app.cost.repository import SqlAlchemyUsageRepository, UsageRepository
from app.cost.service import CostReportService
from app.embeddings.client import EmbeddingClient, MockEmbeddingClient
from app.embeddings.service import EmbeddingService
from app.models.repository import ModelRepository, SqlAlchemyModelRepository
from app.models.service import ModelService
from app.prompts.repository import PromptRepository, SqlAlchemyPromptRepository
from app.prompts.service import PromptService
from app.quotas.repository import QuotaRepository, SqlAlchemyQuotaRepository
from app.quotas.service import QuotaService
from app.ratelimits.repository import RateLimitRepository, SqlAlchemyRateLimitRepository
from app.ratelimits.runtime import RateLimitGuard
from app.ratelimits.service import RateLimitService


def _use_sqlalchemy() -> bool:
    """Return True when ``database_url`` points at PostgreSQL."""
    return settings.database_url.startswith("postgresql")


@dataclass
class Registry:
    model_repo: Any
    model_service: ModelService
    provider_client: ProviderClient
    chat_service: ChatService
    embedding_client: EmbeddingClient
    embedding_service: EmbeddingService
    prompt_repo: Any
    prompt_service: PromptService
    quota_repo: Any
    quota_service: QuotaService
    rate_limit_repo: Any
    rate_limit_service: RateLimitService
    usage_repo: Any
    cost_service: CostReportService
    audit_repo: Any
    audit_service: AuditLogService

    def reset(self) -> None:
        """Reset all in-memory state and re-seed mock clients."""

        self.model_repo.clear()
        self.prompt_repo.clear()
        self.quota_repo.clear()
        self.rate_limit_repo.clear()
        self.usage_repo.clear()
        self.audit_repo.clear()
        if isinstance(self.provider_client, MockProviderClient):
            self.provider_client.reset()
        if isinstance(self.embedding_client, MockEmbeddingClient):
            self.embedding_client.reset()


_LOCK = RLock()
_REGISTRY: Optional[Registry] = None


def _build_default_registry() -> Registry:
    provider_client = MockProviderClient()
    embedding_client = MockEmbeddingClient()

    if _use_sqlalchemy():
        from app.common.db import get_session_factory

        session_factory = get_session_factory()
        model_repo: Any = SqlAlchemyModelRepository(session_factory)
        prompt_repo: Any = SqlAlchemyPromptRepository(session_factory)
        quota_repo: Any = SqlAlchemyQuotaRepository(session_factory)
        rate_limit_repo: Any = SqlAlchemyRateLimitRepository(session_factory)
        usage_repo: Any = SqlAlchemyUsageRepository(session_factory)
        audit_repo: Any = SqlAlchemyAuditLogRepository(session_factory)
    else:
        model_repo = ModelRepository()
        prompt_repo = PromptRepository()
        quota_repo = QuotaRepository()
        rate_limit_repo = RateLimitRepository()
        usage_repo = UsageRepository()
        audit_repo = AuditLogRepository()

    model_service = ModelService(model_repo)
    chat_service = ChatService(model_service, provider_client)
    embedding_service = EmbeddingService(model_service, embedding_client)
    prompt_service = PromptService(prompt_repo, chat_service)
    quota_service = QuotaService(quota_repo)
    rate_limit_service = RateLimitService(rate_limit_repo)
    cost_service = CostReportService(usage_repo)
    audit_service = AuditLogService(audit_repo)

    return Registry(
        model_repo=model_repo,
        model_service=model_service,
        provider_client=provider_client,
        chat_service=chat_service,
        embedding_client=embedding_client,
        embedding_service=embedding_service,
        prompt_repo=prompt_repo,
        prompt_service=prompt_service,
        quota_repo=quota_repo,
        quota_service=quota_service,
        rate_limit_repo=rate_limit_repo,
        rate_limit_service=rate_limit_service,
        usage_repo=usage_repo,
        cost_service=cost_service,
        audit_repo=audit_repo,
        audit_service=audit_service,
    )


# Attach the runtime limit evaluator after the registry has been built so
# the forward reference between Service and Guard is satisfied.
# (Circular import: ratelimits.runtime imports schemas/service from
#  ratelimits, deps imports ratelimits.* in the same module.)
from app.ratelimits.runtime import RateLimitGuard as _RateLimitGuard  # noqa: E402

_attach_guard = _RateLimitGuard
del _RateLimitGuard


def _wire_default_guard(reg: "Registry") -> None:
    guard = _attach_guard(reg.rate_limit_service)
    reg.rate_limit_service._guard = guard


def _maybe_wire_guard(reg: "Registry") -> None:
    try:
        _wire_default_guard(reg)
    except Exception:
        # The default registry path is non-fatal if the runtime module is
        # unavailable; tests can still inject a guard manually.
        pass


def get_registry() -> Registry:
    global _REGISTRY
    with _LOCK:
        if _REGISTRY is None:
            _REGISTRY = _build_default_registry()
            _maybe_wire_guard(_REGISTRY)
        return _REGISTRY


def set_registry(registry: Optional[Registry]) -> None:
    """Test helper: install or clear the process-wide registry."""

    global _REGISTRY
    with _LOCK:
        _REGISTRY = registry


# -------------------------------------------------------------- FastAPI deps


def get_model_service(request: Request) -> ModelService:
    return request.app.state.registry.model_service


def get_chat_service(request: Request) -> ChatService:
    return request.app.state.registry.chat_service


def get_embedding_service(request: Request) -> EmbeddingService:
    return request.app.state.registry.embedding_service


def get_provider_client(request: Request) -> ProviderClient:
    return request.app.state.registry.provider_client


def get_embedding_client(request: Request) -> EmbeddingClient:
    return request.app.state.registry.embedding_client


def get_model_repo(request: Request) -> ModelRepository:
    return request.app.state.registry.model_repo


def get_prompt_service(request: Request) -> PromptService:
    return request.app.state.registry.prompt_service


def get_quota_service(request: Request) -> QuotaService:
    return request.app.state.registry.quota_service


def get_rate_limit_service(request: Request) -> RateLimitService:
    return request.app.state.registry.rate_limit_service


def get_audit_service(request: Request) -> AuditLogService:
    return request.app.state.registry.audit_service


def get_cost_service(request: Request) -> CostReportService:
    return request.app.state.registry.cost_service