"""Embedding service tests (P1-LLMGW-03)."""

from __future__ import annotations

import math
import pytest
from pydantic import ValidationError

from app.common.errors import (
    AllProvidersFailedError,
    ModelNotAvailableError,
    ModelNotFoundError,
    UnsupportedModelTypeError,
)
from app.embeddings.schemas import BatchEmbeddingRequest
from app.embeddings.client import MockEmbeddingClient
from app.models.schemas import Model, ModelCapability, ModelType


TENANT = "tenant-test"


def _seed_embedding_model(service, *, enabled: bool = True) -> None:
    service._repo.upsert_sync(  # type: ignore[attr-defined]
        Model(
            model_id="m-volcengine-doubao-embedding-large",
            tenant_id=TENANT,
            provider="VOLCENGINE",
            model_code="doubao-embedding-large",
            display_name="Doubao Embedding Large",
            type=ModelType.EMBEDDING,
            input_price=0.0005,
            output_price=0.0,
            context_length=8192,
            capabilities=[ModelCapability.EMBEDDING.value],
            enabled=enabled,
            description="",
        )
    )


def _seed_chat_model(service) -> None:
    service._repo.upsert_sync(  # type: ignore[attr-defined]
        Model(
            model_id="m-openai-gpt-4o",
            tenant_id=TENANT,
            provider="OPENAI",
            model_code="gpt-4o",
            display_name="GPT-4o",
            type=ModelType.MULTIMODAL,
            input_price=0.005,
            output_price=0.015,
            context_length=128000,
            capabilities=[ModelCapability.CHAT.value, ModelCapability.VISION.value],
            enabled=True,
            description="",
        )
    )


class TestEmbeddingServiceBatch:
    async def test_embedding_batch_normalizes_vectors(self, registry):
        _seed_embedding_model(registry.model_service)
        req = BatchEmbeddingRequest(
            modelId="m-volcengine-doubao-embedding-large",
            inputs=["hello", "world"],
            normalize=True,
        )
        resp = await registry.embedding_service.batch(TENANT, req)
        assert resp.dimension == 16
        assert len(resp.embeddings) == 2
        for vec in resp.embeddings:
            norm = math.sqrt(sum(x * x for x in vec))
            assert abs(norm - 1.0) < 1e-6
        # Mock recorded the batch call.
        assert registry.embedding_client.calls  # type: ignore[attr-defined]

    async def test_embedding_batch_rejects_non_embedding_model(self, registry):
        _seed_chat_model(registry.model_service)
        req = BatchEmbeddingRequest(
            modelId="m-openai-gpt-4o",
            inputs=["hello"],
        )
        with pytest.raises(UnsupportedModelTypeError):
            await registry.embedding_service.batch(TENANT, req)

    def test_embedding_batch_input_too_many(self, registry):
        _seed_embedding_model(registry.model_service)
        with pytest.raises(ValidationError):
            BatchEmbeddingRequest(
                modelId="m-volcengine-doubao-embedding-large",
                inputs=[f"text-{i}" for i in range(101)],
            )

    def test_embedding_batch_blank_input_rejected(self, registry):
        _seed_embedding_model(registry.model_service)
        with pytest.raises(ValidationError):
            BatchEmbeddingRequest(
                modelId="m-volcengine-doubao-embedding-large",
                inputs=["valid", "   "],
            )

    async def test_embedding_batch_404_unknown_model(self, registry):
        req = BatchEmbeddingRequest(
            modelId="m-does-not-exist",
            inputs=["hi"],
        )
        with pytest.raises(ModelNotFoundError):
            await registry.embedding_service.batch(TENANT, req)

    async def test_embedding_batch_422_disabled(self, registry):
        _seed_embedding_model(registry.model_service, enabled=False)
        req = BatchEmbeddingRequest(
            modelId="m-volcengine-doubao-embedding-large",
            inputs=["hi"],
        )
        with pytest.raises(ModelNotAvailableError):
            await registry.embedding_service.batch(TENANT, req)

    async def test_embedding_batch_translates_provider_errors(self, registry):
        _seed_embedding_model(registry.model_service)

        class _Boom(MockEmbeddingClient):
            def embed(self, provider, model_code, inputs):  # noqa: D401
                raise RuntimeError("simulated outage")

        boom = _Boom()
        registry.embedding_service._client = boom  # type: ignore[attr-defined]
        req = BatchEmbeddingRequest(
            modelId="m-volcengine-doubao-embedding-large",
            inputs=["hi"],
        )
        with pytest.raises(AllProvidersFailedError):
            await registry.embedding_service.batch(TENANT, req)