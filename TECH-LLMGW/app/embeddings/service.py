"""Embedding service: validates model, calls client, normalizes."""

from __future__ import annotations

import math
from typing import List

from app.common.errors import (
    AllProvidersFailedError,
    UnsupportedModelTypeError,
)
from app.embeddings.client import EmbeddingClient
from app.embeddings.schemas import (
    BatchEmbeddingRequest,
    BatchEmbeddingResponse,
    TokenUsage,
)
from app.models.schemas import Model, ModelCapability, ModelType
from app.models.service import ModelService


class EmbeddingService:
    def __init__(
        self,
        model_service: ModelService,
        client: EmbeddingClient,
    ) -> None:
        self._models = model_service
        self._client = client

    async def batch(self, tenant_id: str, request: BatchEmbeddingRequest) -> BatchEmbeddingResponse:
        model = await self._models.resolve_active(tenant_id, request.modelId)
        if model.type != ModelType.EMBEDDING or ModelCapability.EMBEDDING.value not in model.capabilities:
            raise UnsupportedModelTypeError(
                f"模型不支持 Embedding: modelId={request.modelId}",
                data={"modelId": request.modelId, "type": model.type.value},
            )

        try:
            vectors = self._client.embed(model.provider, model.model_code, list(request.inputs))
        except Exception as exc:  # noqa: BLE001 - translate
            raise AllProvidersFailedError(
                f"Embedding 调用失败: {exc}",
                data={"modelId": request.modelId, "provider": model.provider},
            ) from exc

        if request.normalize:
            vectors = [self._l2_normalize(v) for v in vectors]

        # Use the first vector's length as canonical dimension.
        dimension = len(vectors[0]) if vectors else 0
        total_tokens = sum(max(1, len(t) // 4) for t in request.inputs)
        return BatchEmbeddingResponse(
            model=model.model_code,
            provider=model.provider,
            dimension=dimension,
            embeddings=vectors,
            usage=TokenUsage(promptTokens=total_tokens, totalTokens=total_tokens),
        )

    @staticmethod
    def _l2_normalize(vector: List[float]) -> List[float]:
        norm = math.sqrt(sum(x * x for x in vector)) or 1.0
        return [x / norm for x in vector]