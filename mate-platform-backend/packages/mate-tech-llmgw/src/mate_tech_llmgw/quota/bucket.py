"""Redis token bucket (ST-5.5.4.1).

每租户 RPM + TPM 限制。token-bucket 算法。
"""
from __future__ import annotations

import os
from dataclasses import dataclass

import redis.asyncio as redis
import structlog

logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class QuotaConfig:
    """每租户的配额配置."""

    rpm_limit: int = 100       # requests per minute
    tpm_limit: int = 100_000   # tokens per minute
    window_sec: int = 60


class QuotaExceededError(Exception):
    """触发限流时抛出."""

    def __init__(self, key: str, retry_after: int) -> None:
        super().__init__(f"Quota exceeded for {key}; retry after {retry_after}s")
        self.key = key
        self.retry_after = retry_after


class RedisTokenBucket:
    """基于 Redis 的滑动窗口 token bucket.

    使用两个 key:
    - req:{tenant}:{minute}    -> 当前分钟已用 request 数
    - tok:{tenant}:{minute}    -> 当前分钟已用 token 数
    """

    def __init__(self, redis_client: redis.Redis | None = None, config: QuotaConfig | None = None) -> None:
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self._redis = redis_client or redis.from_url(url, decode_responses=True)
        self._config = config or QuotaConfig()

    async def acquire(
        self,
        *,
        tenant_id: str,
        estimated_tokens: int = 0,
    ) -> None:
        """检查并扣减配额;超额抛 QuotaExceededError.

        Args:
            tenant_id: 租户 id
            estimated_tokens: 预估本次请求 token 数(TPM)

        Raises:
            QuotaExceededError: RPM 或 TPM 超限
        """
        import time
        minute = int(time.time()) // self._config.window_sec
        req_key = f"req:{tenant_id}:{minute}"
        tok_key = f"tok:{tenant_id}:{minute}"

        pipe = self._redis.pipeline()
        pipe.incr(req_key, 1)
        pipe.expire(req_key, self._config.window_sec * 2)
        pipe.incr(tok_key, max(estimated_tokens, 0))
        pipe.expire(tok_key, self._config.window_sec * 2)
        req_count, _, tok_count, _ = await pipe.execute()

        if int(req_count) > self._config.rpm_limit:
            retry_after = self._config.window_sec - (int(time.time()) % self._config.window_sec)
            logger.warning("quota.exceeded.rpm", tenant=tenant_id, count=req_count)
            raise QuotaExceededError(req_key, retry_after)

        if int(tok_count) > self._config.tpm_limit:
            retry_after = self._config.window_sec - (int(time.time()) % self._config.window_sec)
            logger.warning("quota.exceeded.tpm", tenant=tenant_id, count=tok_count)
            raise QuotaExceededError(tok_key, retry_after)

        logger.debug("quota.acquired", tenant=tenant_id, req=req_count, tok=tok_count)

    async def close(self) -> None:
        await self._redis.aclose()