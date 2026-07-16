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


@dataclass
class Registry:
    model_repo: ModelRepository
    model_service: ModelService
    provider_client: ProviderClient
    chat_service: ChatService
    embedding_client: EmbeddingClient
    embedding_service: EmbeddingService

    def reset(self) -> None:
        """Reset all in-memory state and re-seed mock clients."""

        self.model_repo.clear()
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
    return Registry(
        model_repo=repo,
        model_service=model_service,
        provider_client=provider_client,
        chat_service=chat_service,
        embedding_client=embedding_client,
        embedding_service=embedding_service,
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