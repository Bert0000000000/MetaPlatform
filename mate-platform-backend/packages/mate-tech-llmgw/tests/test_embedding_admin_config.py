"""Tests for admin-configured embedding resolution (后台 AI Provider → llmgw).

Verifies the bridge: ai.embedding.default_provider + ai.provider.{id}.* read
from IAM → llmgw builds a provider with the resolved base_url/api_key/model.
Fallback path (disabled / IAM unreachable) returns {} so the request/env
provider is used.
"""
from __future__ import annotations

import os
import sys
import types
from pathlib import Path

import pytest
import respx
from httpx import Response

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-llmgw"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from mate_tech_llmgw.providers.embeddings import (  # noqa: E402
    OpenAIEmbeddingProvider,
    build_configured_embedding_provider,
    reset_embedding_providers,
    resolve_effective_embedding,
)
from mate_tech_llmgw.api.routes import EmbeddingRequest, _run_embeddings  # noqa: E402

IAM = "http://localhost:8100"
ARK = "https://ark.example/api/v3"


def _fake_request() -> types.SimpleNamespace:
    """A request-like object exposing app.state.service_identity (None = no auth)."""
    return types.SimpleNamespace(
        app=types.SimpleNamespace(state=types.SimpleNamespace(service_identity=None))
    )


def _configs(items: list[dict]) -> dict:
    return {"code": 0, "data": {"items": items, "total": len(items)}}


@pytest.fixture(autouse=True)
def _clean():
    reset_embedding_providers()
    yield
    reset_embedding_providers()


class TestResolveEffectiveEmbedding:
    @respx.mock
    @pytest.mark.asyncio
    async def test_resolves_provider_config(self) -> None:
        respx.get(url__startswith=f"{IAM}/api/v1/admin/configs").mock(
            return_value=Response(200, json=_configs([
                {"key": "ai.embedding.default_provider", "value": "custom_ark"},
                {"key": "ai.provider.custom_ark.base_url", "value": ARK},
                {"key": "ai.provider.custom_ark.api_key", "value": "ark-key-123"},
                {"key": "ai.provider.custom_ark.embedding_model", "value": "doubao-embedding-text-240715"},
            ]))
        )
        resolved = await resolve_effective_embedding(_fake_request(), "tenant-default")
        assert resolved == {
            "provider": "custom_ark",
            "base_url": ARK,
            "api_key": "ark-key-123",
            "model": "doubao-embedding-text-240715",
        }

    @respx.mock
    @pytest.mark.asyncio
    async def test_disabled_returns_empty(self) -> None:
        respx.get(url__startswith=f"{IAM}/api/v1/admin/configs").mock(
            return_value=Response(200, json=_configs([
                {"key": "ai.embedding.default_provider", "value": "disabled"},
            ]))
        )
        assert await resolve_effective_embedding(_fake_request(), "t1") == {}

    @respx.mock
    @pytest.mark.asyncio
    async def test_iam_unreachable_returns_empty(self) -> None:
        respx.get(url__startswith=f"{IAM}/api/v1/admin/configs").mock(
            return_value=Response(500)
        )
        # Must not raise; returns {} so the fallback path runs.
        assert await resolve_effective_embedding(_fake_request(), "t1") == {}

    @respx.mock
    @pytest.mark.asyncio
    async def test_missing_base_url_returns_empty(self) -> None:
        respx.get(url__startswith=f"{IAM}/api/v1/admin/configs").mock(
            return_value=Response(200, json=_configs([
                {"key": "ai.embedding.default_provider", "value": "openai"},
                # no base_url configured → cannot use
            ]))
        )
        assert await resolve_effective_embedding(_fake_request(), "t1") == {}


class TestBuildConfiguredProvider:
    def test_caches_by_config(self) -> None:
        p1 = build_configured_embedding_provider(
            base_url=ARK, api_key="ark-key", model="doubao-embedding-text-240715"
        )
        p2 = build_configured_embedding_provider(
            base_url=ARK, api_key="ark-key", model="doubao-embedding-text-240715"
        )
        assert p1 is p2  # cached → same instance (reuses http client across chunks)
        assert isinstance(p1, OpenAIEmbeddingProvider)
        assert p1.model == "doubao-embedding-text-240715"


class TestRunEmbeddingsUsesAdminConfig:
    @respx.mock
    @pytest.mark.asyncio
    async def test_run_embeddings_threads_resolved_config_to_upstream(self) -> None:
        # IAM returns an enabled embedding provider config.
        respx.get(url__startswith=f"{IAM}/api/v1/admin/configs").mock(
            return_value=Response(200, json=_configs([
                {"key": "ai.embedding.default_provider", "value": "custom_ark"},
                {"key": "ai.provider.custom_ark.base_url", "value": ARK},
                {"key": "ai.provider.custom_ark.api_key", "value": "ark-key-123"},
                {"key": "ai.provider.custom_ark.embedding_model", "value": "doubao-embedding-text-240715"},
            ]))
        )
        # The upstream ARK /embeddings call must be hit with the configured model.
        upstream = respx.post(f"{ARK}/embeddings").mock(
            return_value=Response(200, json={
                "model": "doubao-embedding-text-240715",
                "data": [{"index": 0, "embedding": [0.1] * 8}],
                "usage": {"prompt_tokens": 3},
            })
        )

        req = EmbeddingRequest(input=["订单审批"], model="text-embedding-3-small", tenant_id="t1")
        resp = await _run_embeddings(req, _fake_request())

        assert upstream.called, "upstream ARK /embeddings was not called"
        # The configured model (not the request default) was sent upstream.
        sent = upstream.calls.last.request.read()
        assert b"doubao-embedding-text-240715" in sent, sent
        # Authorization carried the configured api_key.
        assert "ark-key-123" in upstream.calls.last.request.headers.get("authorization", "")
        assert resp.model == "doubao-embedding-text-240715"
        assert len(resp.data[0]["embedding"]) == 8
