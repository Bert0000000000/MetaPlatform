"""Tests for the real-provider wiring of ``/chat/multimodal`` (v1.0 收口).

Covers the provider resolution order (request override > env > dev stub),
the engine→OpenAI-Vision message bridge, and the endpoint using the real
provider path end-to-end (provider call mocked, no network).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-llmgw"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from mate_tech_llmgw.api.routes import (
    MultimodalApiRequest,
    _OpenAIMultimodalBridge,
    _resolve_multimodal_provider,
    _to_mm_message,
    router,
)
from mate_tech_llmgw.multimodal import MultimodalMessage
from mate_tech_llmgw.providers import multimodal_openai


class _FakeOpenAIProvider:
    model = "fake-vision-model"

    def __init__(self, captured: list) -> None:
        self._captured = captured

    async def chat(self, *args: Any, **kwargs: Any) -> None:  # pragma: no cover
        raise AssertionError("bridge must route through openai_multimodal_chat")


def test_resolve_provider_prefers_request_override(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    req = MultimodalApiRequest(
        prompt="看图",
        images=["https://x/y.png"],
        model="vision-x",
        base_url="https://ark.example/api/plan/v3",
        api_key="k-1",
    )
    provider, model = _resolve_multimodal_provider(req)
    assert provider is not None
    assert model == "vision-x"


def test_resolve_provider_falls_back_to_env(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_BASE_URL", "https://api.minimaxi.com/v1")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-env")
    monkeypatch.setenv("OPENAI_CHAT_MODEL", "MiniMax-M3")
    req = MultimodalApiRequest(prompt="看图")
    provider, model = _resolve_multimodal_provider(req)
    assert provider is not None
    assert model == "MiniMax-M3"


def test_resolve_provider_without_credentials_returns_stub_path(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    req = MultimodalApiRequest(prompt="看图", model="")
    provider, model = _resolve_multimodal_provider(req)
    assert provider is None
    assert model == "gpt-4o-mini"


def test_bridge_converts_image_and_audio_refs() -> None:
    message = {
        "role": "user",
        "content": [
            {"type": "text", "text": "这是什么？"},
            {"type": "image", "image": "https://x/cat.png"},
            {"type": "image", "image": "data:image/png;base64,QUJD"},
        ],
    }
    mm = _to_mm_message(message)
    assert isinstance(mm, MultimodalMessage)
    types = [p.type for p in mm.content]
    assert types == ["text", "image_url", "image_base64"]
    assert mm.content[1].url == "https://x/cat.png"
    assert mm.content[2].data == "QUJD"


def test_bridge_routes_through_openai_multimodal_chat(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    async def fake_chat(provider: Any, messages: list, **kwargs: Any):
        captured["model"] = provider.model
        captured["messages"] = messages

        class _Resp:
            content = "图里是一只猫"
            model = "fake-vision-model"
            usage = {"total_tokens": 42}

        return _Resp()

    monkeypatch.setattr(multimodal_openai, "openai_multimodal_chat", fake_chat)
    bridge = _OpenAIMultimodalBridge(_FakeOpenAIProvider(captured))
    result = {
        "content": "",
        "model": "",
        "usage": {},
    }
    import asyncio

    out = asyncio.run(
        bridge.chat(
            [{"role": "user", "content": [{"type": "text", "text": "hi"}]}],
            "fake-vision-model",
        )
    )
    assert out["content"] == "图里是一只猫"
    assert out["model"] == "fake-vision-model"
    assert out["usage"] == {"total_tokens": 42}
    assert captured["model"] == "fake-vision-model"


def test_endpoint_uses_real_provider_not_stub(monkeypatch) -> None:
    """端到端：带 env 凭证时 /chat/multimodal 走真实 provider，不落 stub 文案。"""
    monkeypatch.setenv("OPENAI_BASE_URL", "https://llm.test/v1")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("OPENAI_CHAT_MODEL", "vision-test")

    async def fake_chat(provider: Any, messages: list, **kwargs: Any):
        class _Resp:
            content = "真实视觉回复：图片包含一个红色圆形"
            model = "vision-test"
            usage = {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}

        return _Resp()

    monkeypatch.setattr(multimodal_openai, "openai_multimodal_chat", fake_chat)

    from mate_tech_llmgw.api import routes as routes_mod

    monkeypatch.setattr(routes_mod, "get_quota_bucket", lambda: None)
    monkeypatch.setattr(routes_mod, "get_cost_recorder", lambda: None)

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)
    resp = client.post(
        "/api/v1/llmgw/chat/multimodal",
        json={"prompt": "描述图片", "images": ["https://x/red-circle.png"]},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["content"].startswith("真实视觉回复")
    assert body["model"] == "vision-test"
    assert body["usage"]["total_tokens"] == 15
    assert "[stub]" not in body["content"]
