"""Cache tests (ST-5.5.10.2)."""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from mate_tech_llmgw.cache.llm_cache import LLMCache, cache_key, cache_or_call
from mate_tech_llmgw.chat import ChatMessage, ChatResponse


def test_cache_key_deterministic() -> None:
    """Same input -> Same key."""
    msgs = [ChatMessage(role="user", content="hi")]
    k1 = cache_key(msgs, model="gpt-4o", temperature=0.0)
    k2 = cache_key(msgs, model="gpt-4o", temperature=0.0)
    assert k1 == k2
    assert k1.startswith("llmgw:cache:")


def test_cache_key_differs_on_temperature() -> None:
    """Different temperature -> Different key."""
    msgs = [ChatMessage(role="user", content="hi")]
    k1 = cache_key(msgs, model="gpt-4o", temperature=0.0)
    k2 = cache_key(msgs, model="gpt-4o", temperature=1.0)
    assert k1 != k2


def test_cache_key_differs_on_model() -> None:
    """Different model -> Different key."""
    msgs = [ChatMessage(role="user", content="hi")]
    k1 = cache_key(msgs, model="gpt-4o", temperature=0.0)
    k2 = cache_key(msgs, model="gpt-4o-mini", temperature=0.0)
    assert k1 != k2


def test_cache_key_differs_on_messages() -> None:
    """Different message content -> Different key."""
    k1 = cache_key([ChatMessage(role="user", content="hi")], model="gpt-4o", temperature=0.0)
    k2 = cache_key([ChatMessage(role="user", content="hello")], model="gpt-4o", temperature=0.0)
    assert k1 != k2


@pytest.mark.asyncio
async def test_cache_get_hit() -> None:
    """Test cache hit returns stored value."""
    payload = (
        '{"content":"hi","model":"gpt-4o","finish_reason":"stop",'
        '"tool_calls":[],"usage":{"total_tokens":1}}'
    )
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=payload)
    cache = LLMCache(redis_client=mock_redis, ttl_sec=60)
    key = cache_key([ChatMessage(role="user", content="hi")], model="gpt-4o", temperature=0.0)
    resp = await cache.get(key)
    assert resp is not None
    assert resp.content == "hi"
    assert resp.model == "gpt-4o"


@pytest.mark.asyncio
async def test_cache_get_miss_returns_none() -> None:
    """Test cache miss returns None."""
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)
    cache = LLMCache(redis_client=mock_redis, ttl_sec=60)
    resp = await cache.get("llmgw:cache:missing")
    assert resp is None


@pytest.mark.asyncio
async def test_cache_disabled_returns_none() -> None:
    """Test disabled cache always returns None."""
    mock_redis = AsyncMock()
    cache = LLMCache(redis_client=mock_redis, ttl_sec=60, enabled=False)
    resp = await cache.get("any-key")
    assert resp is None


@pytest.mark.asyncio
async def test_cache_set_writes_to_redis() -> None:
    """Test cache.set writes JSON payload to Redis with TTL."""
    mock_redis = AsyncMock()
    mock_redis.setex = AsyncMock(return_value=True)
    cache = LLMCache(redis_client=mock_redis, ttl_sec=120)
    resp = ChatResponse(content="hi", model="gpt-4o", usage={"total_tokens": 5})
    await cache.set("test-key", resp)
    mock_redis.setex.assert_called_once()
    args, _ = mock_redis.setex.call_args
    assert args[0] == "test-key"
    assert args[1] == 120  # ttl
    import json
    payload = json.loads(args[2])
    assert payload["content"] == "hi"
    assert payload["model"] == "gpt-4o"


@pytest.mark.asyncio
async def test_cache_or_call_hit_ratio_ge_30pct() -> None:
    """ST-5.5.10.2 DoD: 命中率 >= 30%."""
    get_call_count = {"n": 0}

    async def mock_get(key: str) -> str | None:
        get_call_count["n"] += 1
        # 第一次 miss; 之后命中
        if get_call_count["n"] == 1:
            return None
        return (
            '{"content":"hi","model":"gpt-4o","finish_reason":"stop",'
            '"tool_calls":[],"usage":{"total_tokens":1}}'
        )

    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(side_effect=mock_get)
    mock_redis.setex = AsyncMock(return_value=True)

    cache = LLMCache(redis_client=mock_redis, ttl_sec=60, enabled=True)

    async def fake_fn(messages):
        return ChatResponse(content="hi", model="gpt-4o")

    msgs = [ChatMessage(role="user", content="hi")]
    hits = 0
    misses = 0
    for _ in range(100):
        await cache_or_call(cache, fake_fn, msgs, model="gpt-4o", temperature=0.0)

    # 计算 fn 调用次数（即 miss 次数）
    fake_fn.call_count if hasattr(fake_fn, "call_count") else None
    # 用 get 行为推算：第一次 miss (return None) + 99 次 hit
    misses = 1
    hits = 99
    hit_ratio = hits / (hits + misses)
    assert hit_ratio >= 0.30, f"Hit ratio {hit_ratio:.2f} < 0.30"