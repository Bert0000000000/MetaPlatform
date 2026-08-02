"""Tests for the v3.2 W2 simplified multimodal engine + endpoint.

Covers:
  * :class:`MultimodalEngine` with the default
    :class:`StubMultimodalProvider` (text-only, images, audio).
  * :class:`StubMultimodalProvider` direct invocation.
  * ``POST /api/v1/llmgw/chat/multimodal`` happy path, with-images,
    missing-prompt 422, quota 429, cost recording, tenant isolation,
    data-URI and URL image references.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-llmgw"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from mate_tech_llmgw.multimodal.engine import (  # noqa: E402
    MultimodalEngine,
    MultimodalRequest,
    MultimodalResponse,
    StubMultimodalProvider,
)


# ---------------------------------------------------------------------------
# Engine-level tests (no HTTP)
# ---------------------------------------------------------------------------
class TestMultimodalEngine:
    @pytest.mark.asyncio
    async def test_multimodal_text_only_returns_response(self) -> None:
        engine = MultimodalEngine()
        resp = await engine.chat(MultimodalRequest(prompt="describe the scene"))
        assert isinstance(resp, MultimodalResponse)
        assert resp.model == "gpt-4o-mini"
        assert "0 images" in resp.content
        assert resp.usage["total_tokens"] == 100

    @pytest.mark.asyncio
    async def test_multimodal_with_images_returns_response(self) -> None:
        engine = MultimodalEngine()
        resp = await engine.chat(
            MultimodalRequest(
                prompt="what is here?",
                images=["data:image/png;base64,AAAA", "https://x.com/b.png"],
            )
        )
        assert "2 images" in resp.content

    @pytest.mark.asyncio
    async def test_multimodal_with_audio_returns_response(self) -> None:
        engine = MultimodalEngine()
        resp = await engine.chat(
            MultimodalRequest(
                prompt="transcribe", audio=["data:audio/wav;base64,AAAA"]
            )
        )
        # audio does not bump the image counter
        assert "0 images" in resp.content
        assert resp.usage["total_tokens"] == 100

    @pytest.mark.asyncio
    async def test_multimodal_stub_provider_returns_content(self) -> None:
        provider = StubMultimodalProvider()
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "hi"},
                    {"type": "image", "image": "data:image/png;base64,AAAA"},
                ],
            }
        ]
        result = await provider.chat(messages, "gpt-4o")
        assert result["content"] == "[stub] Image analysis for 1 images"
        assert result["model"] == "gpt-4o"
        assert result["usage"] == {"total_tokens": 100}


# ---------------------------------------------------------------------------
# HTTP endpoint tests
# ---------------------------------------------------------------------------
@pytest.fixture
def mm_client():
    """TestClient with install_auth mocked and clean engine singletons."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from mate_tech_llmgw.router import set_cost_recorder, set_quota_bucket

    # ensure clean state before the test
    set_quota_bucket(None)
    set_cost_recorder(None)

    with patch("mate_platform.auth.install_auth") as mock_install:
        mock_install.return_value = None
        from mate_tech_llmgw.api.routes import router

        app = FastAPI(title="llmgw-multimodal-v32-test")
        app.include_router(router)
        client = TestClient(app)
        yield client

    # teardown: clear any singletons a test may have injected
    set_quota_bucket(None)
    set_cost_recorder(None)


class TestMultimodalEndpoint:
    def test_multimodal_endpoint_happy_path(self, mm_client) -> None:
        r = mm_client.post(
            "/api/v1/llmgw/chat/multimodal",
            json={"prompt": "hello"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["model"] == "gpt-4o-mini"
        assert body["content"].startswith("[stub]")
        assert body["usage"]["total_tokens"] == 100

    def test_multimodal_endpoint_with_images(self, mm_client) -> None:
        r = mm_client.post(
            "/api/v1/llmgw/chat/multimodal",
            json={"prompt": "see this", "images": ["https://x.com/a.png"]},
        )
        assert r.status_code == 200, r.text
        assert "1 images" in r.json()["content"]

    def test_multimodal_endpoint_missing_prompt_returns_422(self, mm_client) -> None:
        # prompt is required -> Pydantic validation -> 422
        r = mm_client.post("/api/v1/llmgw/chat/multimodal", json={})
        assert r.status_code == 422

    def test_multimodal_quota_check(self, mm_client) -> None:
        from mate_tech_llmgw.quota.bucket import QuotaExceededError
        from mate_tech_llmgw.router import set_quota_bucket

        class FailBucket:
            async def acquire(self, *, tenant_id, estimated_tokens=0):
                raise QuotaExceededError(f"req:{tenant_id}:0", retry_after=30)

        set_quota_bucket(FailBucket())
        try:
            r = mm_client.post(
                "/api/v1/llmgw/chat/multimodal", json={"prompt": "hi"}
            )
            assert r.status_code == 429
            assert "Retry-After" in r.headers
        finally:
            set_quota_bucket(None)

    def test_multimodal_cost_recorded(self, mm_client) -> None:
        from mate_tech_llmgw.cost.recorder import CostRecorder
        from mate_tech_llmgw.router import set_cost_recorder

        recorder = CostRecorder(pool=None)
        set_cost_recorder(recorder)
        try:
            r = mm_client.post(
                "/api/v1/llmgw/chat/multimodal",
                json={"prompt": "charge me", "tenant_id": "t-bill"},
            )
            assert r.status_code == 200, r.text
            summary = recorder.summary("t-bill")
            # one call recorded for the default model
            assert summary["by_model"]["gpt-4o-mini"]["calls"] == 1
        finally:
            set_cost_recorder(None)

    def test_multimodal_tenant_isolation(self, mm_client) -> None:
        from mate_tech_llmgw.cost.recorder import CostRecorder
        from mate_tech_llmgw.router import set_cost_recorder

        recorder = CostRecorder(pool=None)
        set_cost_recorder(recorder)
        try:
            mm_client.post(
                "/api/v1/llmgw/chat/multimodal",
                json={"prompt": "a", "tenant_id": "tenantA"},
            )
            mm_client.post(
                "/api/v1/llmgw/chat/multimodal",
                json={"prompt": "b", "tenant_id": "tenantB"},
            )
            a = recorder.summary("tenantA")
            b = recorder.summary("tenantB")
            # each tenant sees exactly its own single call (isolation)
            assert a["by_model"]["gpt-4o-mini"]["calls"] == 1
            assert b["by_model"]["gpt-4o-mini"]["calls"] == 1
            # a third tenant has no records at all
            assert recorder.summary("tenantC")["by_model"] == {}
        finally:
            set_cost_recorder(None)

    def test_multimodal_supports_data_uri(self, mm_client) -> None:
        r = mm_client.post(
            "/api/v1/llmgw/chat/multimodal",
            json={
                "prompt": "ocr this",
                "images": ["data:image/png;base64,iVBORw0KGgo="],
            },
        )
        assert r.status_code == 200, r.text
        assert "1 images" in r.json()["content"]

    def test_multimodal_supports_url(self, mm_client) -> None:
        r = mm_client.post(
            "/api/v1/llmgw/chat/multimodal",
            json={
                "prompt": "fetch and describe",
                "images": ["https://example.com/photo.jpg"],
            },
        )
        assert r.status_code == 200, r.text
        assert "1 images" in r.json()["content"]
