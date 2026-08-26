"""Production profiles must not expose synthetic providers or success paths."""
from __future__ import annotations

import asyncio

import pytest

from mate_tech_llmgw.api.routes import router
from mate_tech_llmgw.chat import ChatMessage
from mate_tech_llmgw.providers.embeddings import (
    LocalEmbeddingProvider,
    OpenAIEmbeddingProvider,
    get_embedding_provider,
    reset_embedding_providers,
)
from mate_tech_llmgw.providers.local import LocalStubProvider
from mate_tech_llmgw.providers.real_anthropic_provider import RealAnthropicProvider
from mate_tech_llmgw.providers.real_openai_provider import RealOpenAIProvider
from mate_tech_llmgw.router import get_provider, reset_providers


def test_production_rejects_local_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")
    reset_providers()

    with pytest.raises(RuntimeError, match="local LLM provider"):
        get_provider("local")


def test_production_rejects_mock_stream(monkeypatch: pytest.MonkeyPatch) -> None:
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    monkeypatch.setenv("MATE_PROFILE", "production")
    app = FastAPI()
    app.include_router(router)

    response = TestClient(app).post(
        "/api/v1/llmgw/chat/stream",
        json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "hi"}]},
    )

    assert response.status_code == 503


@pytest.mark.asyncio
async def test_production_rejects_embedding_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    provider = OpenAIEmbeddingProvider()

    with pytest.raises(RuntimeError, match="embedding provider unavailable"):
        await provider.embed("hello")

    await provider.aclose()


@pytest.mark.asyncio
async def test_production_does_not_reuse_dev_embedding_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MATE_PROFILE", "development")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    reset_embedding_providers()
    get_embedding_provider("openai")

    monkeypatch.setenv("MATE_PROFILE", "production")
    provider = get_embedding_provider("openai")
    with pytest.raises(RuntimeError, match="embedding provider unavailable"):
        await provider.embed("hello")
    await provider.aclose()


@pytest.mark.asyncio
async def test_real_provider_defaults_to_strict_in_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    provider = RealOpenAIProvider()

    with pytest.raises(RuntimeError, match="OpenAI provider unavailable"):
        await provider.chat([ChatMessage(role="user", content="hello")])

    await provider.aclose()


@pytest.mark.asyncio
async def test_production_rejects_direct_local_stub_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")

    with pytest.raises(RuntimeError, match="local LLM provider"):
        await LocalStubProvider().chat([])


@pytest.mark.parametrize("profile", ["production", "staging"])
@pytest.mark.asyncio
async def test_deployed_profiles_ignore_explicit_llm_fallback_override(
    monkeypatch: pytest.MonkeyPatch, profile: str,
) -> None:
    monkeypatch.setenv("MATE_PROFILE", profile)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    openai = RealOpenAIProvider(allow_fallback=True)
    anthropic = RealAnthropicProvider(allow_fallback=True)
    embedding = OpenAIEmbeddingProvider(allow_fallback=True)
    try:
        with pytest.raises(RuntimeError, match="OpenAI provider unavailable"):
            await openai.chat([ChatMessage(role="user", content="hello")])
        with pytest.raises(RuntimeError, match="Anthropic provider unavailable"):
            await anthropic.chat([ChatMessage(role="user", content="hello")])
        with pytest.raises(RuntimeError, match="embedding provider unavailable"):
            await embedding.embed("hello")
    finally:
        await openai.aclose()
        await anthropic.aclose()
        await embedding.aclose()


@pytest.mark.asyncio
async def test_provider_created_in_development_rejects_after_profile_switch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MATE_PROFILE", "development")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    openai = RealOpenAIProvider(allow_fallback=True)
    anthropic = RealAnthropicProvider(allow_fallback=True)
    embedding = OpenAIEmbeddingProvider(allow_fallback=True)
    try:
        monkeypatch.setenv("MATE_PROFILE", "production")
        with pytest.raises(RuntimeError, match="OpenAI provider unavailable"):
            await openai.chat([ChatMessage(role="user", content="hello")])
        with pytest.raises(RuntimeError, match="Anthropic provider unavailable"):
            await anthropic.chat([ChatMessage(role="user", content="hello")])
        with pytest.raises(RuntimeError, match="embedding provider unavailable"):
            await embedding.embed("hello")
    finally:
        await openai.aclose()
        await anthropic.aclose()
        await embedding.aclose()


@pytest.mark.parametrize("profile", ["production", "staging"])
def test_deployed_profiles_reject_multimodal_stub_route(
    monkeypatch: pytest.MonkeyPatch, profile: str,
) -> None:
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    monkeypatch.setenv("MATE_PROFILE", profile)
    app = FastAPI()
    app.include_router(router)

    response = TestClient(app).post(
        "/api/v1/llmgw/chat/multimodal", json={"prompt": "describe"}
    )

    assert response.status_code == 503


def test_production_rejects_direct_multimodal_stub_engine(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from mate_tech_llmgw.multimodal.engine import MultimodalEngine

    monkeypatch.setenv("MATE_PROFILE", "production")

    with pytest.raises(RuntimeError, match="multimodal provider"):
        MultimodalEngine()


@pytest.mark.asyncio
async def test_production_rejects_direct_multimodal_stub_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from mate_tech_llmgw.multimodal.engine import StubMultimodalProvider

    monkeypatch.setenv("MATE_PROFILE", "production")

    with pytest.raises(RuntimeError, match="multimodal provider"):
        await StubMultimodalProvider().chat([], "gpt-4o-mini")


def test_production_rejects_direct_local_embedding_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MATE_PROFILE", "production")

    with pytest.raises(RuntimeError, match="local embedding provider"):
        asyncio.run(LocalEmbeddingProvider().embed("hello"))


def test_production_maps_local_chat_failure_to_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    monkeypatch.setenv("MATE_PROFILE", "production")
    reset_providers()
    app = FastAPI()
    app.include_router(router)

    response = TestClient(app).post(
        "/api/v1/llmgw/chat",
        json={
            "model": "local",
            "messages": [{"role": "user", "content": "hello"}],
        },
    )

    assert response.status_code == 503


@pytest.mark.asyncio
async def test_production_maps_embedding_failure_to_503(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from fastapi import HTTPException

    from mate_tech_llmgw.api.routes import EmbeddingRequest, embeddings_endpoint

    monkeypatch.setenv("MATE_PROFILE", "production")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    reset_embedding_providers()

    with pytest.raises(HTTPException) as exc_info:
        await embeddings_endpoint(
            EmbeddingRequest(model="text-embedding-3-small", input=["hello"]),
            None,
        )

    assert exc_info.value.status_code == 503


def test_production_real_stream_fails_before_sending_200(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    monkeypatch.setenv("MATE_PROFILE", "production")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    app = FastAPI()
    app.include_router(router)

    response = TestClient(app).post(
        "/api/v1/llmgw/chat/real/stream",
        json={
            "provider": "openai",
            "messages": [{"role": "user", "content": "hello"}],
        },
    )

    assert response.status_code == 503
