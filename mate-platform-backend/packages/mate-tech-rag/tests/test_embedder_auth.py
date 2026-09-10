"""P4: RAG LlmgwEmbedder auth header behavior (2026-09-09).

Standalone deployments 401'd on /embeddings because the gateway's
AuthMiddleware requires a Bearer token; the embedder never sent one.
Env-gated fix: LLMGW_API_KEY (virtual key) > SERVICE_CLIENT_ID/SECRET
(service identity) > no header (dev parity).
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from mate_tech_rag.embedder import LlmgwEmbedder


@pytest.fixture(autouse=True)
def _clean_auth_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for var in ("LLMGW_API_KEY", "SERVICE_CLIENT_SECRET", "SERVICE_CLIENT_ID"):
        monkeypatch.delenv(var, raising=False)


def _capturing_client(monkeypatch: pytest.MonkeyPatch):
    captured: dict = {}
    response = MagicMock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"data": [{"embedding": [0.1, 0.2]}]}

    class _FakeClient:
        def post(self, url, json=None, headers=None):
            captured["url"] = url
            captured["json"] = json
            captured["headers"] = headers or {}
            return response

        def close(self) -> None:
            pass

    embedder = LlmgwEmbedder(base_url="http://gw:8008")
    monkeypatch.setattr(embedder, "_client", _FakeClient(), raising=False)
    return embedder, captured


def test_no_env_sends_no_auth_header(monkeypatch: pytest.MonkeyPatch) -> None:
    embedder, captured = _capturing_client(monkeypatch)
    vec = embedder.embed("hello")
    assert vec == [0.1, 0.2]
    assert "Authorization" not in captured["headers"]


def test_virtual_key_env_wins(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLMGW_API_KEY", "sk-llmgw-test123")
    monkeypatch.setenv("SERVICE_CLIENT_SECRET", "also-set")
    embedder, captured = _capturing_client(monkeypatch)
    embedder.embed("hello")
    assert captured["headers"]["Authorization"] == "Bearer sk-llmgw-test123"
    assert captured["headers"]["X-Tenant-Id"] == embedder._tenant_id


def test_service_identity_used_when_no_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SERVICE_CLIENT_SECRET", "s3cret")
    monkeypatch.setenv("SERVICE_CLIENT_ID", "metaplatform-backend")

    class _FakeBearer:
        def token(self) -> str:
            return "svc-token-abc"

    import mate_tech_rag.embedder as embedder_mod

    with patch.object(embedder_mod, "LlmgwEmbedder", LlmgwEmbedder):
        embedder = LlmgwEmbedder(base_url="http://gw:8008")
        assert embedder._bearer is not None
        monkeypatch.setattr(embedder, "_bearer", _FakeBearer(), raising=False)
        response = MagicMock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"data": [{"embedding": [0.5]}]}

        class _FakeClient:
            def __init__(self) -> None:
                self.headers: dict = {}

            def post(self, url, json=None, headers=None):
                self.headers = headers or {}
                return response

            def close(self) -> None:
                pass

        client = _FakeClient()
        monkeypatch.setattr(embedder, "_client", client, raising=False)
        embedder.embed("hi")
        assert client.headers["Authorization"] == "Bearer svc-token-abc"


def test_request_body_shape_unchanged(monkeypatch: pytest.MonkeyPatch) -> None:
    """RAG→gateway contract: input/model/provider/tenant_id body shape frozen."""
    embedder, captured = _capturing_client(monkeypatch)
    embedder.embed("hello")
    assert captured["url"].endswith("/api/v1/llmgw/embeddings")
    assert set(captured["json"]) >= {"input", "model", "provider", "tenant_id"}
    assert captured["json"]["input"] == ["hello"]
