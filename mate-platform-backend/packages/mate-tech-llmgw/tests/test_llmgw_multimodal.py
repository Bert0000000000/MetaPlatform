"""Tests for the llmgw multimodal extension (backlog §3.3).

Covers:
  * MultimodalContentPart validation (text/url/base64 invariants).
  * OpenAI-Vision-compatible payload assembly (image_url, image_base64,
    audio_url, audio_base64, video_url, system message handling).
  * Anthropic payload assembly (image_base64 source block, system
    extraction, audio/video graceful text-degradation).
  * End-to-end router dispatch (OpenAI / Anthropic paths).
  * FastAPI endpoint /api/v1/llmgw/chat/multimodal (happy path +
    validation error path).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
import respx
from httpx import Response

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-llmgw"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from mate_tech_llmgw.multimodal import (  # noqa: E402
    MultimodalContentPart,
    MultimodalMessage,
)
from mate_tech_llmgw.providers.multimodal_anthropic import (  # noqa: E402
    _build_anthropic_payload,
    _content_part_to_anthropic,
)
from mate_tech_llmgw.providers.multimodal_openai import (  # noqa: E402
    _audio_format,
    _build_openai_payload,
    _content_part_to_openai,
)
from mate_tech_llmgw.providers.anthropic import AnthropicChatProvider  # noqa: E402
from mate_tech_llmgw.providers.openai import OpenAIChatProvider  # noqa: E402
from mate_tech_llmgw.router import reset_providers  # noqa: E402


# ---------------------------------------------------------------------------
# MultimodalContentPart validation
# ---------------------------------------------------------------------------
class TestMultimodalContentPartValidation:
    def test_text_part_requires_text(self) -> None:
        with pytest.raises(ValueError, match="text content part requires"):
            MultimodalContentPart(type="text", text="")

    def test_image_url_part_requires_url(self) -> None:
        with pytest.raises(ValueError, match="image_url content part requires 'url'"):
            MultimodalContentPart(type="image_url")

    def test_image_base64_part_requires_data(self) -> None:
        with pytest.raises(ValueError, match="image_base64 content part requires 'data'"):
            MultimodalContentPart(type="image_base64")

    def test_audio_url_part_requires_url(self) -> None:
        with pytest.raises(ValueError, match="audio_url content part requires 'url'"):
            MultimodalContentPart(type="audio_url")

    def test_text_part_ok(self) -> None:
        p = MultimodalContentPart(type="text", text="hello")
        assert p.type == "text"
        assert p.text == "hello"


# ---------------------------------------------------------------------------
# OpenAI payload assembly
# ---------------------------------------------------------------------------
class TestOpenAIPayloadAssembly:
    def test_text_part_to_openai(self) -> None:
        p = MultimodalContentPart(type="text", text="hi")
        assert _content_part_to_openai(p) == {"type": "text", "text": "hi"}

    def test_image_url_to_openai(self) -> None:
        p = MultimodalContentPart(
            type="image_url",
            url="https://example.com/cat.png",
            detail="high",
        )
        out = _content_part_to_openai(p)
        assert out["type"] == "image_url"
        assert out["image_url"]["url"] == "https://example.com/cat.png"
        assert out["image_url"]["detail"] == "high"

    def test_image_base64_to_openai_uses_data_uri(self) -> None:
        p = MultimodalContentPart(
            type="image_base64",
            data="iVBORw0KG",
            media_type="image/png",
        )
        out = _content_part_to_openai(p)
        assert out["type"] == "image_url"
        assert out["image_url"]["url"].startswith("data:image/png;base64,")

    def test_audio_base64_to_openai(self) -> None:
        p = MultimodalContentPart(
            type="audio_base64",
            data="AUAIhw",
            media_type="audio/wav",
        )
        out = _content_part_to_openai(p)
        assert out["type"] == "input_audio"
        assert out["input_audio"]["format"] == "wav"

    def test_audio_format_mapping(self) -> None:
        assert _audio_format("audio/mpeg") == "mp3"
        assert _audio_format("audio/wav") == "wav"
        assert _audio_format(None) == "mp3"
        assert _audio_format("audio/unknown") == "mp3"

    def test_video_url_degrades_to_text_hint(self) -> None:
        p = MultimodalContentPart(type="video_url", url="https://x.com/v.mp4")
        out = _content_part_to_openai(p)
        assert out["type"] == "text"
        assert "https://x.com/v.mp4" in out["text"]

    def test_build_openai_payload_system_message_stays_text(self) -> None:
        msgs = [
            MultimodalMessage(
                role="system",
                content=[MultimodalContentPart(type="text", text="be helpful")],
            ),
            MultimodalMessage(
                role="user",
                content=[
                    MultimodalContentPart(type="text", text="what is this?"),
                    MultimodalContentPart(
                        type="image_url", url="https://x.com/a.png"
                    ),
                ],
            ),
        ]
        payload = _build_openai_payload("gpt-4o", msgs, temperature=0.5, max_tokens=100)
        assert payload["model"] == "gpt-4o"
        assert payload["temperature"] == 0.5
        assert payload["max_tokens"] == 100
        assert payload["messages"][0] == {"role": "system", "content": "be helpful"}
        user_msg = payload["messages"][1]
        assert user_msg["role"] == "user"
        assert isinstance(user_msg["content"], list)
        assert len(user_msg["content"]) == 2


# ---------------------------------------------------------------------------
# Anthropic payload assembly
# ---------------------------------------------------------------------------
class TestAnthropicPayloadAssembly:
    def test_image_url_to_anthropic(self) -> None:
        p = MultimodalContentPart(type="image_url", url="https://x.com/a.png")
        out = _content_part_to_anthropic(p)
        assert out["type"] == "image"
        assert out["source"]["type"] == "url"
        assert out["source"]["url"] == "https://x.com/a.png"

    def test_image_base64_to_anthropic(self) -> None:
        p = MultimodalContentPart(
            type="image_base64",
            data="iVBORw0KG",
            media_type="image/jpeg",
        )
        out = _content_part_to_anthropic(p)
        assert out["type"] == "image"
        assert out["source"]["type"] == "base64"
        assert out["source"]["media_type"] == "image/jpeg"
        assert out["source"]["data"] == "iVBORw0KG"

    def test_audio_url_degrades_to_text(self) -> None:
        p = MultimodalContentPart(type="audio_url", url="https://x.com/a.mp3")
        out = _content_part_to_anthropic(p)
        assert out["type"] == "text"
        assert "https://x.com/a.mp3" in out["text"]

    def test_build_anthropic_payload_extracts_system(self) -> None:
        msgs = [
            MultimodalMessage(
                role="system",
                content=[MultimodalContentPart(type="text", text="be terse")],
            ),
            MultimodalMessage(
                role="user",
                content=[
                    MultimodalContentPart(type="text", text="describe"),
                    MultimodalContentPart(
                        type="image_base64",
                        data="iVBORw0KG",
                        media_type="image/png",
                    ),
                ],
            ),
        ]
        payload = _build_anthropic_payload(
            "claude-3-5-sonnet-20241022",
            msgs,
            temperature=0.0,
            max_tokens=512,
            default_max_tokens=4096,
        )
        assert payload["model"] == "claude-3-5-sonnet-20241022"
        assert payload["system"] == "be terse"
        assert payload["max_tokens"] == 512
        assert len(payload["messages"]) == 1
        user_msg = payload["messages"][0]
        assert user_msg["role"] == "user"
        assert len(user_msg["content"]) == 2
        assert user_msg["content"][1]["type"] == "image"


# ---------------------------------------------------------------------------
# End-to-end router dispatch (with mocked httpx)
# ---------------------------------------------------------------------------
class TestMultimodalRouterDispatch:
    @respx.mock
    @pytest.mark.asyncio
    async def test_openai_dispatch(self) -> None:
        reset_providers()
        respx.post("https://api.openai.com/v1/chat/completions").mock(
            return_value=Response(
                200,
                json={
                    "model": "gpt-4o",
                    "choices": [
                        {
                            "index": 0,
                            "message": {"role": "assistant", "content": "a cat"},
                            "finish_reason": "stop",
                        }
                    ],
                    "usage": {"prompt_tokens": 5, "completion_tokens": 2, "total_tokens": 7},
                },
            )
        )
        from mate_tech_llmgw.multimodal_router import multimodal_chat

        msgs = [
            MultimodalMessage(
                role="user",
                content=[
                    MultimodalContentPart(type="text", text="what is this?"),
                    MultimodalContentPart(
                        type="image_url", url="https://x.com/cat.png"
                    ),
                ],
            )
        ]
        resp = await multimodal_chat("gpt-4o", msgs, temperature=0.0)
        assert resp.content == "a cat"
        assert resp.model == "gpt-4o"
        assert resp.usage["total_tokens"] == 7
        assert resp.modality == "text"

    @respx.mock
    @pytest.mark.asyncio
    async def test_anthropic_dispatch(self) -> None:
        reset_providers()
        respx.post("https://api.anthropic.com/v1/messages").mock(
            return_value=Response(
                200,
                json={
                    "model": "claude-3-5-sonnet-20241022",
                    "content": [{"type": "text", "text": "a dog"}],
                    "stop_reason": "end_turn",
                    "usage": {"input_tokens": 8, "output_tokens": 2},
                },
            )
        )
        from mate_tech_llmgw.multimodal_router import multimodal_chat

        msgs = [
            MultimodalMessage(
                role="user",
                content=[
                    MultimodalContentPart(type="text", text="describe"),
                    MultimodalContentPart(
                        type="image_base64",
                        data="iVBORw0KG",
                        media_type="image/png",
                    ),
                ],
            )
        ]
        resp = await multimodal_chat("claude-3-5-sonnet-20241022", msgs)
        assert resp.content == "a dog"
        assert resp.model == "claude-3-5-sonnet-20241022"
        assert resp.usage["input_tokens"] == 8
        assert resp.usage["output_tokens"] == 2


# ---------------------------------------------------------------------------
# FastAPI endpoint
# ---------------------------------------------------------------------------
class TestMultimodalEndpoint:
    @pytest.fixture
    def client(self):
        """Build a TestClient with install_auth mocked out (no JWT needed).

        The handler does ``from ..multimodal_router import multimodal_chat``
        *inside* the function body (lazy import), so we patch the
        symbol on its source module ``mate_tech_llmgw.multimodal_router``
        — that way the lazy ``from`` picks up our fake.
        """
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        async def fake_multimodal_chat(
            model: str,
            messages: list,
            *,
            temperature: float = 1.0,
            max_tokens: int | None = None,
            tools: list | None = None,
            **kwargs: Any,
        ):
            from mate_tech_llmgw.multimodal import MultimodalChatResponse

            text_parts = [
                p.text for m in messages for p in m.content if p.type == "text"
            ]
            media_count = sum(
                1 for m in messages for p in m.content if p.type != "text"
            )
            return MultimodalChatResponse(
                content=f"echo:{'|'.join(text_parts)} media={media_count}",
                model=model,
                finish_reason="stop",
                tool_calls=[],
                usage={"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
                modality="text",
            )

        with patch("mate_platform.auth.install_auth") as mock_install, \
             patch(
                 "mate_tech_llmgw.multimodal_router.multimodal_chat",
                 new=fake_multimodal_chat,
             ):
            mock_install.return_value = None
            from mate_tech_llmgw.api.routes import legacy_router, router

            app = FastAPI(title="llmgw-multimodal-test")
            app.include_router(router)
            app.include_router(legacy_router)
            yield TestClient(app)

    def test_multimodal_endpoint_happy_path(self, client) -> None:
        payload = {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "what is this?"},
                        {"type": "image_url", "url": "https://x.com/cat.png"},
                    ],
                }
            ],
            "temperature": 0.0,
        }
        r = client.post("/api/v1/llmgw/chat/multimodal", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["model"] == "gpt-4o"
        assert body["content"].startswith("echo:")
        assert "media=1" in body["content"]
        assert body["modality"] == "text"

    def test_multimodal_endpoint_validation_error_returns_400(self, client) -> None:
        # text content part without text -> ValueError -> 400.
        payload = {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "text", "text": ""}],
                }
            ],
        }
        r = client.post("/api/v1/llmgw/chat/multimodal", json=payload)
        assert r.status_code == 400

    def test_multimodal_endpoint_openapi_path_registered(self) -> None:
        """The endpoint must appear on the canonical /api/v1/llmgw prefix."""
        from fastapi import FastAPI

        from mate_tech_llmgw.api.routes import router

        app = FastAPI()
        app.include_router(router)
        schema = app.openapi()
        paths = schema.get("paths", {})
        assert "/api/v1/llmgw/chat/multimodal" in paths
        assert "post" in paths["/api/v1/llmgw/chat/multimodal"]
