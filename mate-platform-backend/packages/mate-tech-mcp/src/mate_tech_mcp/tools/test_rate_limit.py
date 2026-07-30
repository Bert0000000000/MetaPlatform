"""Rate limit tests (ST-5.3.7)."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from mate_tech_mcp.tools.rate_limit import (
    RateLimitConfig,
    RateLimitExceeded,
    ToolRateLimiter,
)


def _make_redis_mock(execute_return):
    """Mock for the redis pipeline used by ToolRateLimiter.check().

    redis-py's ``pipeline()`` is sync (returns a Pipeline); only
    ``execute()`` is async. See `redis.asyncio.client.Redis.pipeline`
    signature. The original tests used bare AsyncMock on every
    attribute, which made `pipeline()` itself awaitable and produced
    the ``'coroutine' object has no attribute 'incr'`` failure.
    """
    mock_redis = AsyncMock()
    pipe = MagicMock()
    pipe.incr.return_value = None
    pipe.expire.return_value = None
    pipe.execute = AsyncMock(return_value=execute_return)
    mock_redis.pipeline = MagicMock(return_value=pipe)
    return mock_redis


@pytest.mark.asyncio
async def test_rate_limit_within() -> None:
    mock_redis = _make_redis_mock(execute_return=[5, True])
    limiter = ToolRateLimiter(redis_client=mock_redis)
    await limiter.check(tenant_id="acme", tool_name="kb_search")


@pytest.mark.asyncio
async def test_rate_limit_exceeded() -> None:
    """超限 → RateLimitExceeded."""
    mock_redis = _make_redis_mock(execute_return=[60, True])
    limiter = ToolRateLimiter(
        redis_client=mock_redis,
        config=RateLimitConfig(limit=50, window_sec=60),
    )
    with pytest.raises(RateLimitExceeded, match="Rate limit exceeded"):
        await limiter.check(tenant_id="acme", tool_name="kb_search")


@pytest.mark.asyncio
async def test_rate_limit_custom_config() -> None:
    mock_redis = _make_redis_mock(execute_return=[100, True])
    limiter = ToolRateLimiter(
        redis_client=mock_redis,
        config=RateLimitConfig(limit=200, window_sec=120),
    )
    # 100 < 200: 通过
    await limiter.check(tenant_id="acme", tool_name="foo")