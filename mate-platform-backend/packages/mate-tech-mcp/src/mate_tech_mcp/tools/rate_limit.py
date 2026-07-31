"""Per-tenant rate limit (ST-5.3.7).

每个工具按 tenant 50 req/min (用 Redis 滑动窗口).
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass

import redis.asyncio as redis
import structlog

logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class RateLimitConfig:
    """限流配置."""

    limit: int = 50       # requests per minute
    window_sec: int = 60


class RateLimitExceeded(Exception):  # noqa: N818
    """触发限流."""

    def __init__(self, key: str, retry_after: int) -> None:
        super().__init__(f"Rate limit exceeded for {key}; retry after {retry_after}s")
        self.key = key
        self.retry_after = retry_after


class ToolRateLimiter:
    """Per-tenant per-tool rate limit."""

    def __init__(
        self,
        redis_client: redis.Redis | None = None,
        config: RateLimitConfig | None = None,
    ) -> None:
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self._redis = redis_client or redis.from_url(url, decode_responses=True)
        self._config = config or RateLimitConfig()

    async def check(self, *, tenant_id: str, tool_name: str) -> None:
        """检查并扣减, 超限抛 RateLimitExceeded."""
        minute = int(time.time()) // self._config.window_sec
        key = f"ratelimit:{tenant_id}:{tool_name}:{minute}"

        pipe = self._redis.pipeline()
        pipe.incr(key, 1)
        pipe.expire(key, self._config.window_sec * 2)
        count, _ = await pipe.execute()

        if int(count) > self._config.limit:
            retry_after = self._config.window_sec - (int(time.time()) % self._config.window_sec)
            logger.warning("ratelimit.exceeded", tenant=tenant_id, tool=tool_name, count=count)
            raise RateLimitExceeded(key, retry_after)

    async def close(self) -> None:
        await self._redis.aclose()