"""Retry + Fallback tests (ST-5.5.6.2)."""
from __future__ import annotations

import pytest

from mate_tech_llmgw.chat import ChatMessage, ChatResponse
from mate_tech_llmgw.retry.fallback import chat_with_fallback, with_retry


@pytest.mark.asyncio
async def test_primary_succeeds_no_fallback() -> None:
    """主模型成功 → 不走 fallback."""
    calls: list[str] = []

    async def fake_chat(model: str, messages: list[ChatMessage], **kwargs: object) -> ChatResponse:
        calls.append(model)
        return ChatResponse(content="ok", model=model)

    resp = await chat_with_fallback(
        fake_chat,
        primary_model="gpt-4o",
        fallback_models=("claude-3-5-sonnet-20241022",),
        messages=[ChatMessage(role="user", content="hi")],
    )
    assert resp.content == "ok"
    assert calls == ["gpt-4o"]


@pytest.mark.asyncio
async def test_primary_fails_uses_fallback() -> None:
    """主模型失败 → 自动 fallback."""
    calls: list[str] = []

    async def fake_chat(model: str, messages: list[ChatMessage], **kwargs: object) -> ChatResponse:
        calls.append(model)
        if model == "gpt-4o":
            raise RuntimeError("primary down")
        return ChatResponse(content="fallback-ok", model=model)

    resp = await chat_with_fallback(
        fake_chat,
        primary_model="gpt-4o",
        fallback_models=("claude-3-5-sonnet-20241022",),
        messages=[ChatMessage(role="user", content="hi")],
    )
    assert resp.content == "fallback-ok"
    assert calls == ["gpt-4o", "claude-3-5-sonnet-20241022"]


@pytest.mark.asyncio
async def test_all_fail_raises() -> None:
    """主 + 全 fallback 失败 → 抛 RuntimeError."""
    async def fake_chat(model: str, **kwargs: object) -> ChatResponse:
        raise RuntimeError(f"{model} down")

    with pytest.raises(RuntimeError, match="All models failed"):
        await chat_with_fallback(
            fake_chat,
            primary_model="gpt-4o",
            fallback_models=("claude-3-5-sonnet-20241022", "gpt-4o-mini"),
            messages=[ChatMessage(role="user", content="hi")],
        )


@pytest.mark.asyncio
async def test_with_retry_succeeds_after_retries() -> None:
    """重试装饰器：失败 2 次后成功."""
    attempts = {"n": 0}

    async def flaky(**kwargs: object) -> ChatResponse:
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise RuntimeError("transient")
        return ChatResponse(content="ok", model="gpt-4o")

    decorated = with_retry(flaky, max_attempts=3, initial_wait=0.01, max_wait=0.05)
    resp = await decorated()
    assert resp.content == "ok"
    assert attempts["n"] == 3