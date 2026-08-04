"""Tests for llmgw provider registry enhancement.

Covers:
  - SUPPORTED_PROVIDERS whitelist
  - get_provider() by name (openai, local, unknown)
  - /providers endpoint
  - chat with unsupported provider → 400
"""
from __future__ import annotations

import pytest

from mate_tech_llmgw.providers.local import LocalStubProvider
from mate_tech_llmgw.providers.openai import OpenAIChatProvider
from mate_tech_llmgw.router import (
    SUPPORTED_PROVIDERS,
    get_provider,
    reset_providers,
)


@pytest.fixture(autouse=True)
def _clean_providers():
    """每个测试前清空 provider 缓存，避免单例污染."""
    reset_providers()
    yield
    reset_providers()


# ---------------------------------------------------------------------------
# SUPPORTED_PROVIDERS 白名单
# ---------------------------------------------------------------------------
class TestSupportedProvidersRegistry:
    def test_supported_providers_list_contains_openai(self) -> None:
        assert "openai" in SUPPORTED_PROVIDERS

    def test_supported_providers_list_contains_doubao(self) -> None:
        assert "doubao" in SUPPORTED_PROVIDERS

    def test_supported_providers_list_contains_all_seven(self) -> None:
        expected = {"openai", "doubao", "anthropic", "deepseek", "local", "qwen", "moonshot"}
        assert expected == set(SUPPORTED_PROVIDERS.keys())


# ---------------------------------------------------------------------------
# get_provider — name-based lookup
# ---------------------------------------------------------------------------
class TestGetProviderByName:
    def test_get_provider_openai_returns_instance(self) -> None:
        p = get_provider("openai")
        assert isinstance(p, OpenAIChatProvider)

    def test_get_provider_local_returns_stub(self) -> None:
        p = get_provider("local")
        assert isinstance(p, LocalStubProvider)

    def test_get_provider_unknown_raises_value_error(self) -> None:
        with pytest.raises(ValueError):
            get_provider("grok")

    def test_get_provider_unknown_error_includes_supported_list(self) -> None:
        with pytest.raises(ValueError) as exc_info:
            get_provider("grok")
        msg = str(exc_info.value)
        assert "grok" in msg
        assert "openai" in msg
        assert "Supported providers" in msg

    def test_get_provider_by_model_name_still_works(self) -> None:
        """回归: model 名路由不受影响."""
        p = get_provider("gpt-4o")
        assert isinstance(p, OpenAIChatProvider)


# ---------------------------------------------------------------------------
# /providers endpoint
# ---------------------------------------------------------------------------
@pytest.fixture
def client():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from mate_tech_llmgw.api.routes import router

    app = FastAPI()
    app.include_router(router)
    yield TestClient(app)


class TestProvidersEndpoint:
    def test_list_providers_endpoint_returns_200(self, client) -> None:
        r = client.get("/api/v1/llmgw/providers")
        assert r.status_code == 200

    def test_list_providers_endpoint_contains_all(self, client) -> None:
        r = client.get("/api/v1/llmgw/providers")
        body = r.json()
        provs = body["providers"]
        for name in ("openai", "doubao", "anthropic", "deepseek", "local", "qwen", "moonshot"):
            assert name in provs


# ---------------------------------------------------------------------------
# chat with unsupported provider → 400
# ---------------------------------------------------------------------------
class TestChatUnsupportedProvider:
    def test_chat_with_unsupported_provider_returns_400(self, client) -> None:
        r = client.post(
            "/api/v1/llmgw/chat",
            json={"model": "grok", "messages": [{"role": "user", "content": "hi"}]},
        )
        assert r.status_code == 400

    def test_chat_with_unsupported_provider_includes_list(self, client) -> None:
        r = client.post(
            "/api/v1/llmgw/chat",
            json={"model": "grok", "messages": [{"role": "user", "content": "hi"}]},
        )
        detail = r.json()["detail"]
        assert "grok" in detail
        assert "openai" in detail
