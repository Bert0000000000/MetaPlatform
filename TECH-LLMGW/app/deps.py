"""Service registry & FastAPI dependencies.

The registry is a process-wide singleton so all routers share the same
model catalog, repository and provider clients. Tests use ``reset`` to
wipe in-memory state between cases.
"""

from __future__ import annotations

from dataclasses import dataclass
from threading import RLock
from typing import Optional

from fastapi import Request

from app.chat.provider_client import MockProviderClient, ProviderClient
from app.chat.service import ChatService
from app.embeddings.client import EmbeddingClient, MockEmbeddingClient
from app.embeddings.service import EmbeddingService
from app.models.repository import ModelRepository
from app.models.service import ModelService
from app.prompts.repository import PromptRepository
from app.prompts.service import PromptService
from app.quotas.repository import QuotaRepository
from app.quotas.service import QuotaService
from app.ratelimits.repository import RateLimitRepository
from app.ratelimits.service import RateLimitService


@dataclass
class Registry:
    model_repo: ModelRepository
    model_service: ModelService
    provider_client: ProviderClient
    chat_service: ChatService
    embedding_client: EmbeddingClient
    embedding_service: EmbeddingService
    prompt_repo: PromptRepository
    prompt_service: PromptService
    quota_repo: QuotaRepository
    quota_service: QuotaService
    rate_limit_repo: RateLimitRepository
    rate_limit_service: RateLimitService
    usage_repo: UsageRepository
    cost_service: CostReportService
    audit_repo: AuditLogRepository
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
    repo = ModelRepository()
    model_service = ModelService(repo)
    provider_client = MockProviderClient()
    chat_service = ChatService(model_service, provider_client)
    embedding_client = MockEmbeddingClient()
    embedding_service = EmbeddingService(model_service, embedding_client)
    prompt_repo = PromptRepository()
    prompt_service = PromptService(prompt_repo, chat_service)
    quota_repo = QuotaRepository()
    quota_service = QuotaService(quota_repo)
    rate_limit_repo = RateLimitRepository()
    rate_limit_service = RateLimitService(rate_limit_repo)
    return Registry(
        model_repo=repo,
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
    )


def get_registry() -> Registry:
    global _REGISTRY
    with _LOCK:
        if _REGISTRY is None:
            _REGISTRY = _build_default_registry()
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