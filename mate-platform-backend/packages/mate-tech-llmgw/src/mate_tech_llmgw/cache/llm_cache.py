"""LLM response cache (ST-5.5.10.1).

key = hash(prompt + temperature + model)
temperature=0 强制命中检查
"""
from __future__ import annotations

import hashlib
import json
import os
from dataclasses import asdict
from typing import Any

import redis.asyncio as redis

from ..chat import ChatMessage, ChatResponse


def cache_key(
    messages: list[ChatMessage],
    *,
    model: str,
    temperature: float,
    extra: dict[str, Any] | None = None,
) -> str:
    """生成缓存 key — hash(prompt + temperature + model)."""
    payload = {
        "model": model,
        "temperature": temperature,
        "messages": [
            {"role": m.role, "content": m.content, "name": m.name}
            for m in messages
        ],
        "extra": extra or {},
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return "llmgw:cache:" + hashlib.sha256(raw).hexdigest()[:32]


class LLMCache:
    """Redis-backed LLM response cache."""

    def __init__(
        self,
        redis_client: redis.Redis | None = None,
        ttl_sec: int = 3600,
        enabled: bool = True,
    ) -> None:
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self._redis = redis_client or redis.from_url(url, decode_responses=True)
        self._ttl = ttl_sec
        self._enabled = enabled

    async def get(self, key: str) -> ChatResponse | None:
        """命中返回；miss 返回 None."""
        if not self._enabled:
            return None
        raw = await self._redis.get(key)
        if raw is None:
            return None
        data = json.loads(raw)
        return ChatResponse(
            content=data["content"],
            model=data["model"],
            finish_reason=data.get("finish_reason"),
            tool_calls=data.get("tool_calls", []),
            usage=data.get("usage", {}),
        )

    async def set(self, key: str, response: ChatResponse) -> None:
        """写入缓存."""
        if not self._enabled:
            return
        payload = {
            "content": response.content,
            "model": response.model,
            "finish_reason": response.finish_reason,
            "tool_calls": response.tool_calls,
            "usage": response.usage,
        }
        await self._redis.setex(key, self._ttl, json.dumps(payload, ensure_ascii=False))

    async def close(self) -> None:
        await self._redis.aclose()


async def cache_or_call(
    cache: LLMCache,
    fn: Any,
    messages: list[ChatMessage],
    *,
    model: str,
    temperature: float,
) -> ChatResponse:
    """先查缓存；miss 调 fn 并写入缓存.

    Args:
        cache: LLMCache 实例
        fn: async callable(messages) -> ChatResponse
    """
    # temperature=0 强制 cache-first 路径
    use_cache = cache._enabled or temperature == 0.0
    key = cache_key(messages, model=model, temperature=temperature)
    if use_cache:
        cached = await cache.get(key)
        if cached is not None:
            return cached
    resp = await fn(messages)
    if use_cache:
        await cache.set(key, resp)
    return resp