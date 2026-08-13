"""Tests for LlmgwEmbedder (RAG -> mate-tech-llmgw gateway -> doubao/openai).

The HTTP call is mocked so these run offline; they lock the request body
(model / input / provider / tenant_id) and the OpenAI-compatible response
parsing, including dim self-correction.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "packages"
for sub in ("mate-tech-rag",):
    sys.path.insert(0, str(PKG / sub / "src"))

from mate_tech_rag.embedder import LlmgwEmbedder, create_embedder  # noqa: E402


class _FakeResponse:
    def __init__(self, payload: dict, status: int = 200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self) -> dict:
        return self._payload


def _make_embedder():
    # Avoid touching real env defaults that could point elsewhere.
    return LlmgwEmbedder(base_url="http://llmgw.test", model="doubao-embedding-text-240715")


class TestLlmgwEmbedder:
    def test_factory_creates_llmgw(self) -> None:
        emb = create_embedder("llmgw")
        assert isinstance(emb, LlmgwEmbedder)

    def test_default_dim_until_resolved(self) -> None:
        emb = _make_embedder()
        # dim is available before any network call (vector stores need it at init).
        assert emb.dim == 2048

    def test_empty_text_returns_zero_vector(self) -> None:
        emb = _make_embedder()
        vec = emb.embed("   ")
        assert vec == [0.0] * emb.dim
        assert len(vec) == 2048

    def test_embed_parses_openai_response_and_sends_correct_body(self) -> None:
        emb = _make_embedder()
        captured: dict = {}

        def fake_post(url, json=None, **_kw):
            captured["url"] = url
            captured["body"] = json
            return _FakeResponse({
                "model": "doubao-embedding-text-240715",
                "dimensions": 2048,
                "data": [{"index": 0, "embedding": [0.1] * 2048}],
                "usage": {"prompt_tokens": 5},
            })

        with patch.object(emb._client, "post", side_effect=fake_post):
            vec = emb.embed("订单审批流程")

        # Request contract: endpoint path, model, input-as-list, provider, tenant_id.
        assert captured["url"] == "http://llmgw.test/api/v1/llmgw/embeddings"
        assert captured["body"]["model"] == "doubao-embedding-text-240715"
        assert captured["body"]["provider"] == "doubao"
        assert captured["body"]["input"] == ["订单审批流程"]
        assert captured["body"]["tenant_id"] == "tenant-default"
        # Response parsing.
        assert len(vec) == 2048
        assert vec[0] == pytest.approx(0.1)

    def test_dim_self_corrects_on_live_response(self) -> None:
        emb = _make_embedder()
        assert emb.dim == 2048  # configured default

        def fake_post(*_a, **_kw):
            return _FakeResponse({
                "model": "doubao-embedding-large-text-240915",
                "dimensions": 2560,
                "data": [{"index": 0, "embedding": [0.2] * 2560}],
            })

        with patch.object(emb._client, "post", side_effect=fake_post):
            vec = emb.embed("hello")
        # Live model returned 2560-dim -> embedder self-corrects.
        assert len(vec) == 2560
        assert emb.dim == 2560
