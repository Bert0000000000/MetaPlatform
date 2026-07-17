"""Chat service: orchestrates multimodal calls with model validation."""

from __future__ import annotations

import time
from typing import Optional, Protocol

from app.chat.provider_client import (
    MultimodalRequest as ProviderMultimodalRequest,
    MultimodalResponse as ProviderMultimodalResponse,
    ProviderClient,
)
from app.chat.schemas import (
    MultimodalRequest,
    MultimodalResponse,
    TokenUsage,
)
from app.common.errors import (
    AllProvidersFailedError,
    ModelNotAvailableError,
    UnsupportedModalityError,
)
from app.models.schemas import Model, ModelCapability, ModelType
from app.models.service import ModelService


class _ModelProvider(Protocol):
    def resolve_active(self, tenant_id: str, model_id: str) -> Model: ...


class ChatService:
    def __init__(
        self,
        model_service: ModelService,
        provider_client: ProviderClient,
    ) -> None:
        self._models = model_service
        self._client = provider_client

    # ---------------------------------------------------------------- multimodal

    def multimodal(self, tenant_id: str, request: MultimodalRequest) -> MultimodalResponse:
        model = self._models.resolve_active(tenant_id, request.modelId)
        # Capability check happens AFTER the model is resolved so we get
        # the proper 404 / 422 cascade.
        if ModelCapability.VISION.value not in model.capabilities:
            raise UnsupportedModalityError(
                f"模型不支持多模态输入: modelId={request.modelId}",
                data={"modelId": request.modelId, "capabilities": model.capabilities},
            )

        self._client.raise_if_unknown(model.provider)

        provider_req = ProviderMultimodalRequest(
            provider=model.provider,
            model_code=model.model_code,
            text=request.text,
            images=list(request.images),
            temperature=request.temperature,
            max_tokens=request.maxTokens,
            system_prompt=request.systemPrompt,
        )

        start = time.monotonic()
        try:
            provider_resp: ProviderMultimodalResponse = self._client.chat_multimodal(
                provider_req
            )
        except Exception as exc:  # noqa: BLE001 - translate to biz error
            raise AllProvidersFailedError(
                f"调用失败: {exc}",
                data={"modelId": request.modelId, "provider": model.provider},
            ) from exc

        total = provider_resp.prompt_tokens + provider_resp.completion_tokens
        return MultimodalResponse(
            id=provider_resp.id,
            model=model.model_code,
            provider=model.provider,
            content=provider_resp.content,
            finishReason="stop",
            usage=TokenUsage(
                promptTokens=provider_resp.prompt_tokens,
                completionTokens=provider_resp.completion_tokens,
                totalTokens=total,
            ),
            latencyMs=int((time.monotonic() - start) * 1000) + provider_resp.latency_ms,
        )

    # --------------------------------------------------------------- text chat

    def text_chat(
        self,
        tenant_id: str,
        model_id: str,
        text: str,
        *,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> MultimodalResponse:
        """Text-only chat helper used by prompt preview and future endpoints."""

        model = self._models.resolve_active(tenant_id, model_id)
        if model.type not in {ModelType.CHAT, ModelType.MULTIMODAL}:
            raise ModelNotAvailableError(
                f"模型不支持文本对话: modelId={model_id}",
                data={"modelId": model_id, "type": model.type.value},
            )

        self._client.raise_if_unknown(model.provider)

        provider_req = ProviderMultimodalRequest(
            provider=model.provider,
            model_code=model.model_code,
            text=text,
            images=[],
            temperature=temperature if temperature is not None else 0.7,
            max_tokens=max_tokens if max_tokens is not None else 1024,
            system_prompt=system_prompt,
        )

        start = time.monotonic()
        try:
            provider_resp: ProviderMultimodalResponse = self._client.chat_multimodal(
                provider_req
            )
        except Exception as exc:  # noqa: BLE001
            raise AllProvidersFailedError(
                f"调用失败: {exc}",
                data={"modelId": model_id, "provider": model.provider},
            ) from exc

        total = provider_resp.prompt_tokens + provider_resp.completion_tokens
        return MultimodalResponse(
            id=provider_resp.id,
            model=model.model_code,
            provider=model.provider,
            content=provider_resp.content,
            finishReason="stop",
            usage=TokenUsage(
                promptTokens=provider_resp.prompt_tokens,
                completionTokens=provider_resp.completion_tokens,
                totalTokens=total,
            ),
            latencyMs=int((time.monotonic() - start) * 1000) + provider_resp.latency_ms,
        )