"""P3-W7 Real LLM provider tests (TD-6).

Tests cover:
  - test_real_openai_provider_call: mock OpenAI API → real response
  - test_real_anthropic_provider_call: mock Anthropic API → real response
  - test_real_provider_fallback_to_stub_on_error: HTTP error → stub
  - test_real_provider_api_key_from_env: key resolved from env var
  - test_real_provider_tenant_isolation: tenant-scoped key resolution
  - test_real_chat_route_openai: POST /llmgw/chat/real with openai
  - test_real_chat_route_fallback: no key → fallback=true
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
import respx
from httpx import Response

# Ensure src paths are on sys.path + Keycloak env vars are set for app import.
_REPO = Path(__file__).resolve().parents[3]
_PKG = _REPO / "mate-platform-backend" / "packages"
for _sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-llmgw"):
    _p = str(_PKG / _sub / "src")
    if _p not in sys.path:
        sys.path.insert(0, _p)

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from mate_tech_llmgw.chat import ChatMessage  # noqa: E402
from mate_tech_llmgw.providers.real_anthropic_provider import (  # noqa: E402
    RealAnthropicProvider,
)
from mate_tech_llmgw.providers.real_openai_provider import (  # noqa: E402
    RealOpenAIProvider,
)


# ---------------------------------------------------------------------------
# Real OpenAI provider
# ---------------------------------------------------------------------------
@respx.mock
@pytest.mark.asyncio
async def test_real_openai_provider_call() -> None:
    """RealOpenAIProvider calls the OpenAI API and returns the response."""
    respx.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=Response(
            200,
            json={
                "id": "chatcmpl-1",
                "model": "gpt-4o-mini",
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": "hello world"},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 5, "completion_tokens": 2, "total_tokens": 7},
            },
        )
    )
    provider = RealOpenAIProvider(api_key="sk-test", model="gpt-4o-mini")
    msgs = [ChatMessage(role="user", content="hi")]
    resp = await provider.chat(msgs, temperature=0.0)
    assert resp.content == "hello world"
    assert resp.model == "gpt-4o-mini"
    assert resp.usage["total_tokens"] == 7
    await provider.aclose()


# ---------------------------------------------------------------------------
# Real Anthropic provider
# ---------------------------------------------------------------------------
@respx.mock
@pytest.mark.asyncio
async def test_real_anthropic_provider_call() -> None:
    """RealAnthropicProvider calls the Anthropic API and returns the response."""
    respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=Response(
            200,
            json={
                "model": "claude-3-5-sonnet-20241022",
                "stop_reason": "end_turn",
                "content": [{"type": "text", "text": "hello from claude"}],
                "usage": {"input_tokens": 10, "output_tokens": 5},
            },
        )
    )
    provider = RealAnthropicProvider(api_key="sk-ant-test", model="claude-3-5-sonnet-20241022")
    msgs = [
        ChatMessage(role="system", content="You are helpful."),
        ChatMessage(role="user", content="say hi"),
    ]
    resp = await provider.chat(msgs, temperature=0.0)
    assert resp.content == "hello from claude"
    assert resp.model == "claude-3-5-sonnet-20241022"
    assert resp.usage["input_tokens"] == 10
    await provider.aclose()


# ---------------------------------------------------------------------------
# Fallback on error
# ---------------------------------------------------------------------------
@respx.mock
@pytest.mark.asyncio
async def test_real_provider_fallback_to_stub_on_error() -> None:
    """RealOpenAIProvider falls back to stub when the API returns HTTP 500."""
    respx.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=Response(500, text="Internal Server Error"),
    )
    provider = RealOpenAIProvider(api_key="sk-test", model="gpt-4o-mini")
    msgs = [ChatMessage(role="user", content="hello")]
    resp = await provider.chat(msgs)
    # Should contain the stub fallback marker
    assert "[stub-fallback]" in resp.content
    assert resp.finish_reason == "stop"
    await provider.aclose()


@pytest.mark.asyncio
async def test_real_provider_fallback_no_key() -> None:
    """RealOpenAIProvider falls back to stub when no API key is available."""
    # Ensure no key in env
    old_key = os.environ.pop("OPENAI_API_KEY", None)
    try:
        provider = RealOpenAIProvider(model="gpt-4o-mini")
        msgs = [ChatMessage(role="user", content="hello")]
        resp = await provider.chat(msgs, tenant_id="tenant-test")
        assert "[stub-fallback]" in resp.content
        await provider.aclose()
    finally:
        if old_key is not None:
            os.environ["OPENAI_API_KEY"] = old_key


# ---------------------------------------------------------------------------
# API key from env
# ---------------------------------------------------------------------------
def test_real_provider_api_key_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """RealOpenAIProvider resolves the API key from OPENAI_API_KEY env var."""
    monkeypatch.setenv("OPENAI_API_KEY", "sk-env-test")
    monkeypatch.delenv("OPENAI_API_KEY_TENANT_ACME", raising=False)
    provider = RealOpenAIProvider(model="gpt-4o-mini")
    key = provider._resolve_api_key("tenant-acme")
    assert key == "sk-env-test"


# ---------------------------------------------------------------------------
# Tenant-scoped API key isolation
# ---------------------------------------------------------------------------
def test_real_provider_tenant_isolation(monkeypatch: pytest.MonkeyPatch) -> None:
    """Tenant-specific key takes priority over the global key."""
    monkeypatch.setenv("OPENAI_API_KEY", "sk-global")
    monkeypatch.setenv("OPENAI_API_KEY_TENANT_ACME", "sk-acme-specific")

    provider = RealOpenAIProvider(model="gpt-4o-mini")

    # tenant-acme gets the tenant-specific key
    key_acme = provider._resolve_api_key("tenant-acme")
    assert key_acme == "sk-acme-specific"

    # tenant-globex falls back to the global key
    key_globex = provider._resolve_api_key("tenant-globex")
    assert key_globex == "sk-global"

    # No tenant → global key
    key_none = provider._resolve_api_key("")
    assert key_none == "sk-global"


def test_real_anthropic_tenant_isolation(monkeypatch: pytest.MonkeyPatch) -> None:
    """Anthropic tenant-specific key takes priority over the global key."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-global")
    monkeypatch.setenv("ANTHROPIC_API_KEY_TENANT_ACME", "sk-ant-acme")

    provider = RealAnthropicProvider(model="claude-3-5-sonnet-20241022")

    key_acme = provider._resolve_api_key("tenant-acme")
    assert key_acme == "sk-ant-acme"

    key_globex = provider._resolve_api_key("tenant-globex")
    assert key_globex == "sk-ant-global"


# ---------------------------------------------------------------------------
# Route integration: POST /llmgw/chat/real
# ---------------------------------------------------------------------------
def _make_client():
    """Build a TestClient with just the router (no auth middleware)."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from mate_tech_llmgw.api.routes import router

    app = FastAPI(title="llmgw-real-test")
    app.include_router(router)
    return TestClient(app)


def test_real_chat_route_openai(monkeypatch: pytest.MonkeyPatch) -> None:
    """POST /llmgw/chat/real with provider=openai returns a response."""
    monkeypatch.setenv("OPENAI_API_KEY", "")

    client = _make_client()
    r = client.post(
        "/api/v1/llmgw/chat/real",
        json={
            "provider": "openai",
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "hello"}],
            "tenant_id": "tenant-test",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # No API key → fallback
    assert body["fallback"] is True
    assert "[stub-fallback]" in body["content"]
    assert body["provider"] == "openai"


def test_real_chat_route_unknown_provider() -> None:
    """POST /llmgw/chat/real with unknown provider returns 400."""
    client = _make_client()
    r = client.post(
        "/api/v1/llmgw/chat/real",
        json={
            "provider": "unknown",
            "messages": [{"role": "user", "content": "hi"}],
        },
    )
    assert r.status_code == 400, r.text
    assert "unknown provider" in r.text


@respx.mock
def test_real_chat_route_openai_real_call(monkeypatch: pytest.MonkeyPatch) -> None:
    """POST /llmgw/chat/real with a valid key calls the real API."""
    respx.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=Response(
            200,
            json={
                "model": "gpt-4o-mini",
                "choices": [
                    {
                        "message": {"role": "assistant", "content": "real reply"},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 3, "completion_tokens": 2, "total_tokens": 5},
            },
        )
    )
    monkeypatch.setenv("OPENAI_API_KEY", "sk-real-test")

    client = _make_client()
    r = client.post(
        "/api/v1/llmgw/chat/real",
        json={
            "provider": "openai",
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "hello"}],
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["content"] == "real reply"
    assert body["fallback"] is False
    assert body["provider"] == "openai"
