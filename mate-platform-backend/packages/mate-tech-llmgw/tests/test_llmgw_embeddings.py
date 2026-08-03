"""Tests for llmgw embedding providers + /embeddings route (P1-RED-4).

Covers:
  * ``_hash_embedding`` determinism + L2 normalization
  * ``LocalEmbeddingProvider`` / ``OpenAIEmbeddingProvider`` (fallback + real API)
  * ``get_embedding_provider`` factory (singletons + routing)
  * ``POST /api/v1/llmgw/embeddings`` real provider wiring
"""
from __future__ import annotations

import math
import os
import sys
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest
import respx
from httpx import Response

if TYPE_CHECKING:
    from fastapi.testclient import TestClient

# conftest.py already injects package src/ into sys.path, but we also
# pin the cross-package deps + auth env vars defensively (mirrors
# test_llmgw_path_alias.py) so a standalone pytest run works too.
REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-llmgw"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from mate_tech_llmgw.providers.embeddings import (  # noqa: E402
    LocalEmbeddingProvider,
    OpenAIEmbeddingProvider,
    _hash_embedding,
    get_embedding_provider,
    reset_embedding_providers,
)


# ---------------------------------------------------------------------------
# _hash_embedding
# ---------------------------------------------------------------------------
class TestHashEmbedding:
    def test_deterministic(self) -> None:
        a = _hash_embedding("hello world")
        b = _hash_embedding("hello world")
        assert a == b

    def test_different_text_different_vector(self) -> None:
        a = _hash_embedding("hello world")
        b = _hash_embedding("goodbye world")
        assert a != b

    def test_dimension(self) -> None:
        assert len(_hash_embedding("x")) == 384
        assert len(_hash_embedding("x", dim=128)) == 128

    def test_unit_normalized(self) -> None:
        vec = _hash_embedding("normalize me")
        norm = math.sqrt(sum(v * v for v in vec))
        assert abs(norm - 1.0) < 1e-6


# ---------------------------------------------------------------------------
# LocalEmbeddingProvider
# ---------------------------------------------------------------------------
class TestLocalEmbeddingProvider:
    @pytest.mark.asyncio
    async def test_embed_returns_normalized_vector(self) -> None:
        provider = LocalEmbeddingProvider()
        result = await provider.embed("hello")
        assert len(result.embedding) == 384
        assert result.model == "text-embedding-3-small"
        assert result.usage["prompt_tokens"] >= 1
        norm = math.sqrt(sum(v * v for v in result.embedding))
        assert abs(norm - 1.0) < 1e-6
        await provider.aclose()

    @pytest.mark.asyncio
    async def test_embed_deterministic(self) -> None:
        provider = LocalEmbeddingProvider()
        a = await provider.embed("same text")
        b = await provider.embed("same text")
        assert a.embedding == b.embedding


# ---------------------------------------------------------------------------
# OpenAIEmbeddingProvider
# ---------------------------------------------------------------------------
class TestOpenAIEmbeddingProvider:
    @pytest.mark.asyncio
    async def test_fallback_when_no_key(self) -> None:
        """无 API key → 确定性 hash 回退."""
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("OPENAI_API_KEY", None)
            provider = OpenAIEmbeddingProvider()
            result = await provider.embed("hello", tenant_id="acme")
        assert len(result.embedding) == 384
        assert result.model == "text-embedding-3-small"
        assert result.usage["prompt_tokens"] >= 1
        # 回退向量与直接 hash 一致
        assert result.embedding == _hash_embedding("hello")
        await provider.aclose()

    @pytest.mark.asyncio
    async def test_tenant_scoped_key_resolution(self) -> None:
        """租户 key 优先级: OPENAI_API_KEY_{TENANT} > OPENAI_API_KEY."""
        provider = OpenAIEmbeddingProvider()
        with patch.dict(os.environ, {"OPENAI_API_KEY_ACME": "sk-tenant"}):
            assert provider._resolve_api_key("acme") == "sk-tenant"
        with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-global"}):
            assert provider._resolve_api_key("no-match") == "sk-global"
        await provider.aclose()

    @respx.mock
    @pytest.mark.asyncio
    async def test_real_api_success(self) -> None:
        """真实 OpenAI Embeddings API 路径 (respx mock)."""
        respx.post("https://api.openai.com/v1/embeddings").mock(
            return_value=Response(
                200,
                json={
                    "model": "text-embedding-3-small",
                    "data": [{"index": 0, "embedding": [0.1, 0.2, 0.3]}],
                    "usage": {"prompt_tokens": 3, "total_tokens": 3},
                },
            )
        )
        provider = OpenAIEmbeddingProvider(api_key="sk-test")
        result = await provider.embed("hello")
        assert result.embedding == [0.1, 0.2, 0.3]
        assert result.usage["prompt_tokens"] == 3
        await provider.aclose()

    @respx.mock
    @pytest.mark.asyncio
    async def test_real_api_http_error_falls_back(self) -> None:
        """HTTP 错误 → hash 回退."""
        respx.post("https://api.openai.com/v1/embeddings").mock(
            return_value=Response(500, text="boom")
        )
        provider = OpenAIEmbeddingProvider(api_key="sk-test")
        result = await provider.embed("hello")
        assert len(result.embedding) == 384
        assert result.embedding == _hash_embedding("hello")
        await provider.aclose()


# ---------------------------------------------------------------------------
# get_embedding_provider factory
# ---------------------------------------------------------------------------
class TestGetEmbeddingProvider:
    def setup_method(self) -> None:
        reset_embedding_providers()

    def test_openai_singleton(self) -> None:
        p1 = get_embedding_provider("openai")
        p2 = get_embedding_provider("openai")
        assert p1 is p2
        assert isinstance(p1, OpenAIEmbeddingProvider)

    def test_local_provider(self) -> None:
        p = get_embedding_provider("local")
        assert isinstance(p, LocalEmbeddingProvider)

    def test_doubao_is_openai_compatible(self) -> None:
        p = get_embedding_provider("doubao")
        assert isinstance(p, OpenAIEmbeddingProvider)

    def test_unknown_falls_back_to_openai(self) -> None:
        p = get_embedding_provider("does-not-exist")
        assert isinstance(p, OpenAIEmbeddingProvider)

    def test_empty_defaults_to_openai(self) -> None:
        p = get_embedding_provider("")
        assert isinstance(p, OpenAIEmbeddingProvider)


# ---------------------------------------------------------------------------
# Route integration — POST /api/v1/llmgw/embeddings
# ---------------------------------------------------------------------------
@pytest.fixture
def client():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    # Isolate provider singletons per test so cached state (e.g. a
    # no-key provider from an earlier test) does not leak in.
    reset_embedding_providers()

    with patch("mate_platform.auth.install_auth") as mock_install:
        mock_install.return_value = None
        from mate_tech_llmgw.api.routes import router

        app = FastAPI(title="mate-tech-llmgw-embeddings-test")
        mock_install(app)
        app.include_router(router)
        yield TestClient(app)


class TestEmbeddingsRoute:
    def test_local_provider_returns_real_vector(self, client: TestClient) -> None:
        r = client.post(
            "/api/v1/llmgw/embeddings",
            json={
                "model": "text-embedding-3-small",
                "input": ["hello world", "foo bar"],
                "provider": "local",
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["model"] == "text-embedding-3-small"
        assert body["dimensions"] == 384
        assert len(body["data"]) == 2
        assert body["data"][0]["index"] == 0
        assert body["data"][1]["index"] == 1
        assert len(body["data"][0]["embedding"]) == 384
        assert body["usage"]["prompt_tokens"] >= 1

    def test_default_provider_fallback_no_key(self, client: TestClient) -> None:
        """无 OPENAI_API_KEY 时默认 openai provider 回退到 hash 向量."""
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("OPENAI_API_KEY", None)
            r = client.post(
                "/api/v1/llmgw/embeddings",
                json={"model": "text-embedding-3-small", "input": ["hi"]},
            )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["dimensions"] == 384
        assert len(body["data"]) == 1

    def test_deterministic_same_input(self, client: TestClient) -> None:
        payload = {
            "model": "text-embedding-3-small",
            "input": ["identical text"],
            "provider": "local",
        }
        a = client.post("/api/v1/llmgw/embeddings", json=payload).json()
        b = client.post("/api/v1/llmgw/embeddings", json=payload).json()
        assert a["data"][0]["embedding"] == b["data"][0]["embedding"]

    def test_empty_input(self, client: TestClient) -> None:
        r = client.post(
            "/api/v1/llmgw/embeddings",
            json={"model": "text-embedding-3-small", "input": [], "provider": "local"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["data"] == []
        assert body["dimensions"] == 0

    @respx.mock
    def test_real_openai_api_through_route(self, client: TestClient) -> None:
        respx.post("https://api.openai.com/v1/embeddings").mock(
            return_value=Response(
                200,
                json={
                    "model": "text-embedding-3-small",
                    "data": [{"index": 0, "embedding": [0.4, 0.5]}],
                    "usage": {"prompt_tokens": 2, "total_tokens": 2},
                },
            )
        )
        # Provider short-circuits to hash fallback when no API key is
        # present, so inject one to force the real (respx-mocked) HTTP path.
        with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test"}):
            r = client.post(
                "/api/v1/llmgw/embeddings",
                json={
                    "model": "text-embedding-3-small",
                    "input": ["real call"],
                    "provider": "openai",
                },
            )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["data"][0]["embedding"] == [0.4, 0.5]
        assert body["dimensions"] == 2
        assert body["usage"]["prompt_tokens"] == 2
