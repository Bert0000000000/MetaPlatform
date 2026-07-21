"""Chat service tests (P1-LLMGW-02)."""

from __future__ import annotations

import pytest

from app.chat.provider_client import MultimodalRequest, ProviderClient
from app.chat.schemas import MultimodalImage, MultimodalRequest as ServiceRequest
from app.common.errors import (
    AllProvidersFailedError,
    ModelNotAvailableError,
    ModelNotFoundError,
    UnsupportedModalityError,
)
from app.models.schemas import Model, ModelCapability, ModelType


TENANT = "tenant-test"


def _seed_gpt4o(service, *, enabled: bool = True, vision: bool = True) -> None:
    caps = [ModelCapability.CHAT, ModelCapability.FUNCTION_CALLING]
    if vision:
        caps.append(ModelCapability.VISION)
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
            capabilities=[c.value for c in caps],
            enabled=enabled,
            description="",
        )
    )


class _ExplodingProvider:
    def chat_multimodal(self, request: MultimodalRequest):  # noqa: D401
        raise RuntimeError("simulated provider outage")

    def raise_if_unknown(self, provider: str) -> None:  # noqa: D401
        return None


class TestChatServiceMultimodal:
    async def test_multimodal_requires_vision_capability(self, registry):
        _seed_gpt4o(registry.model_service, vision=False)
        req = ServiceRequest(
            modelId="m-openai-gpt-4o",
            text="describe",
            images=[MultimodalImage(url="https://example.com/x.png")],
        )
        with pytest.raises(UnsupportedModalityError):
            await registry.chat_service.multimodal(TENANT, req)

    async def test_multimodal_chat_success_with_url_image(self, registry):
        _seed_gpt4o(registry.model_service)
        req = ServiceRequest(
            modelId="m-openai-gpt-4o",
            text="describe",
            images=[MultimodalImage(url="https://example.com/x.png")],
            temperature=0.1,
            maxTokens=64,
        )
        resp = await registry.chat_service.multimodal(TENANT, req)
        assert resp.provider == "OPENAI"
        assert resp.model == "gpt-4o"
        assert resp.usage.promptTokens > 0
        assert resp.usage.completionTokens > 0
        assert resp.usage.totalTokens == resp.usage.promptTokens + resp.usage.completionTokens
        # Mock recorded exactly one call.
        assert len(registry.provider_client.calls) == 1  # type: ignore[attr-defined]

    async def test_multimodal_chat_success_with_base64_image(self, registry):
        _seed_gpt4o(registry.model_service)
        req = ServiceRequest(
            modelId="m-openai-gpt-4o",
            text="describe",
            images=[MultimodalImage(base64="data:image/png;base64,iVBORw0KGgo=")],
        )
        resp = await registry.chat_service.multimodal(TENANT, req)
        assert resp.finishReason == "stop"

    async def test_multimodal_404_unknown_model(self, registry):
        req = ServiceRequest(
            modelId="m-nope",
            text="hi",
            images=[MultimodalImage(url="https://example.com/x.png")],
        )
        with pytest.raises(ModelNotFoundError):
            await registry.chat_service.multimodal(TENANT, req)

    async def test_multimodal_422_disabled_model(self, registry):
        _seed_gpt4o(registry.model_service, enabled=False)
        req = ServiceRequest(
            modelId="m-openai-gpt-4o",
            text="hi",
            images=[MultimodalImage(url="https://example.com/x.png")],
        )
        with pytest.raises(ModelNotAvailableError):
            await registry.chat_service.multimodal(TENANT, req)

    async def test_multimodal_translates_provider_errors(self, registry):
        _seed_gpt4o(registry.model_service)
        # Replace the provider client with an exploding one.
        registry.provider_client = _ExplodingProvider()  # type: ignore[assignment]
        # Re-wire service to the new client so the call routes through it.
        registry.chat_service._client = registry.provider_client  # type: ignore[attr-defined]
        req = ServiceRequest(
            modelId="m-openai-gpt-4o",
            text="hi",
            images=[MultimodalImage(url="https://example.com/x.png")],
        )
        with pytest.raises(AllProvidersFailedError):
            await registry.chat_service.multimodal(TENANT, req)
