"""RealOpenAIProvider.stream_chat + /chat/real/stream route tests.

Covers the SuperAI agent-loop streaming decision turn: SSE deltas are
accumulated provider-side into ``content`` / ``reasoning_content`` /
``tool_calls`` (per-index arguments joined), and the route forwards the
``token`` / ``done`` events as SSE lines.
"""
from __future__ import annotations

import json
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
from mate_tech_llmgw.providers.real_openai_provider import RealOpenAIProvider  # noqa: E402


def _sse_body(chunks: list[dict]) -> bytes:
    return (
        "".join(f"data: {json.dumps(c)}\n\n" for c in chunks) + "data: [DONE]\n\n"
    ).encode()


def _decision_chunks() -> list[dict]:
    """A realistic OpenAI stream: reasoning → content → tool_call fragments."""
    return [
        {"choices": [{"delta": {"role": "assistant", "reasoning_content": "让我想想 "}, "index": 0}]},
        {"choices": [{"delta": {"reasoning_content": "选 workflow。"}, "index": 0}]},
        {"choices": [{"delta": {
            "content": "我来调度。",
            "tool_calls": [{
                "index": 0, "id": "call-1", "type": "function",
                "function": {"name": "dispatch_employee", "arguments": '{"target_rid": "'},
            }],
        }, "index": 0}]},
        {"choices": [{"delta": {
            "tool_calls": [{"index": 0, "function": {"arguments": "workflow\"}"}}]},
        "index": 0}]},
        {"choices": [{"delta": {}, "finish_reason": "stop", "index": 0}]},
        {"usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30}},
    ]


# ---------------------------------------------------------------------------
# RealOpenAIProvider.stream_chat
# ---------------------------------------------------------------------------
@respx.mock
@pytest.mark.asyncio
async def test_stream_chat_accumulates_reasoning_content_and_tool_calls() -> None:
    """stream_chat joins reasoning deltas and assembles tool_calls by index."""
    respx.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=Response(200, content=_sse_body(_decision_chunks())),
    )
    provider = RealOpenAIProvider(api_key="sk-test", model="gpt-4o-mini")
    try:
        events = [ev async for ev in provider.stream_chat(
            [ChatMessage(role="user", content="hi")], temperature=0.0,
        )]
    finally:
        await provider.aclose()

    assert events[-1]["type"] == "done"
    done = events[-1]
    assert done["reasoning_content"] == "让我想想 选 workflow。"
    assert done["content"] == "我来调度。"
    assert len(done["tool_calls"]) == 1
    tc = done["tool_calls"][0]
    assert tc["id"] == "call-1"
    assert tc["function"]["name"] == "dispatch_employee"
    assert tc["function"]["arguments"] == '{"target_rid": "workflow"}'
    assert done["usage"]["total_tokens"] == 30

    # reasoning deltas streamed as they arrive (token events carry the suffix).
    reasoning_tokens = [e["reasoning_content"] for e in events if e["type"] == "token"]
    assert reasoning_tokens and "让我想想" in reasoning_tokens[0]
    assert reasoning_tokens[-1] == "让我想想 选 workflow。"


@respx.mock
@pytest.mark.asyncio
async def test_stream_chat_fallback_on_http_error() -> None:
    """stream_chat yields a stub done event when the upstream errors."""
    respx.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=Response(500, text="boom"),
    )
    provider = RealOpenAIProvider(api_key="sk-test", model="gpt-4o-mini")
    try:
        events = [ev async for ev in provider.stream_chat(
            [ChatMessage(role="user", content="hi")], temperature=0.0,
        )]
    finally:
        await provider.aclose()
    assert len(events) == 1
    assert events[0]["type"] == "done"
    assert "[stub-fallback]" in events[0]["content"]


@pytest.mark.asyncio
async def test_stream_chat_no_key_fallback() -> None:
    """stream_chat yields a stub done event when no API key is configured."""
    old_key = os.environ.pop("OPENAI_API_KEY", None)
    try:
        provider = RealOpenAIProvider(model="gpt-4o-mini")
        events = [ev async for ev in provider.stream_chat(
            [ChatMessage(role="user", content="hello")], tenant_id="tenant-test",
        )]
        await provider.aclose()
    finally:
        if old_key is not None:
            os.environ["OPENAI_API_KEY"] = old_key
    assert events[0]["type"] == "done"
    assert "[stub-fallback]" in events[0]["content"]


# ---------------------------------------------------------------------------
# POST /api/v1/llmgw/chat/real/stream route
# ---------------------------------------------------------------------------
def _make_client():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from mate_tech_llmgw.api.routes import router

    app = FastAPI(title="llmgw-stream-test")
    app.include_router(router)
    return TestClient(app)


def _sse_events(text: str) -> list[dict]:
    return [
        json.loads(line[6:])
        for line in text.splitlines()
        if line.startswith("data: ")
    ]


@respx.mock
def test_real_chat_stream_route_assembles_tool_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    """The streaming route forwards token/done events with assembled tool_calls."""
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    respx.post("https://api.openai.com/v1/chat/completions").mock(
        return_value=Response(200, content=_sse_body(_decision_chunks())),
    )
    client = _make_client()
    r = client.post(
        "/api/v1/llmgw/chat/real/stream",
        json={
            "provider": "openai",
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "调度 workflow"}],
            "tools": [{"type": "function", "function": {"name": "dispatch_employee", "parameters": {"type": "object"}}}],
        },
    )
    assert r.status_code == 200, r.text
    events = _sse_events(r.text)
    assert events[0]["type"] == "token"
    done = events[-1]
    assert done["type"] == "done"
    assert done["tool_calls"][0]["function"]["arguments"] == '{"target_rid": "workflow"}'
    assert done["reasoning_content"] == "让我想想 选 workflow。"


def test_real_chat_stream_route_no_key_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    """No API key → the route streams a stub done event (not a 500)."""
    monkeypatch.setenv("OPENAI_API_KEY", "")
    client = _make_client()
    r = client.post(
        "/api/v1/llmgw/chat/real/stream",
        json={"provider": "openai", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert r.status_code == 200, r.text
    events = _sse_events(r.text)
    assert events[-1]["type"] == "done"
    assert "[stub-fallback]" in events[-1]["content"]


def test_real_chat_stream_route_rejects_anthropic() -> None:
    """Streaming only supports openai/custom providers."""
    client = _make_client()
    r = client.post(
        "/api/v1/llmgw/chat/real/stream",
        json={"provider": "anthropic", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert r.status_code == 400, r.text
    assert "streaming only supports" in r.text
