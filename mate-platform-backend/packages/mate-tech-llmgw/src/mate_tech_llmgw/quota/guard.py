"""Quota guard decorator (ST-5.5.4.2).

包装 chat 调用；超限时：
- 排队 30s 内若释放则重试
- 超时则 raise QuotaExceeded（HTTP 429 含义）
"""
from __future__ import annotations

import asyncio
import functools
from collections.abc import Awaitable, Callable
from typing import Any

import structlog

from .bucket import QuotaConfig, QuotaExceeded, RedisTokenBucket

logger = structlog.get_logger(__name__)


def with_quota(
    bucket: RedisTokenBucket | None = None,
    config: QuotaConfig | None = None,
    queue_timeout: float = 30.0,
    poll_interval: float = 1.0,
) -> Callable[[Callable[..., Awaitable[Any]]], Callable[..., Awaitable[Any]]]:
    """装饰器：包裹 async 函数实现配额 + 排队.

    Usage:
        @with_quota()
        async def chat(...): ...
    """
    cfg = config or QuotaConfig()
    bkt = bucket or RedisTokenBucket(config=cfg)

    def decorator(fn: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        @functools.wraps(fn)
        async def wrapper(*args: Any, tenant_id: str = "default", estimated_tokens: int = 0, **kwargs: Any) -> Any:
            deadline = asyncio.get_event_loop().time() + queue_timeout
            while True:
                try:
                    await bkt.acquire(tenant_id=tenant_id, estimated_tokens=estimated_tokens)
                    return await fn(*args, **kwargs)
                except QuotaExceeded as e:
                    remaining = deadline - asyncio.get_event_loop().time()
                    if remaining <= 0:
                        logger.error("quota.queue_timeout", tenant=tenant_id, retry_after=e.retry_after)
                        raise
                    wait = min(e.retry_after, remaining, poll_interval)
                    logger.info("quota.queued", tenant=tenant_id, wait=wait)
                    await asyncio.sleep(wait)

        return wrapper

    return decorator