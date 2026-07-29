"""Rate limit tests (ST-5.3.7)."""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from mate_tech_mcp.tools.rate_limit import (
    RateLimitConfig,
    RateLimitExceeded,
    ToolRateLimiter,
)


@pytest.mark.asyncio
async def test_rate_limit_within() -> None:
    mock_redis = AsyncMock()
    mock_redis.pipeline.return_value.execute = AsyncMock(
        return_value=[(5, 60)]
    )
    limiter = ToolRateLimiter(redis_client=mock_redis)
    await limiter.check(tenant_id="acme", tool_name="kb_search")


@pytest.mark.asyncio
async def test_rate_limit_exceeded() -> None:
    """超限 → RateLimitExceeded."""
    mock_redis = AsyncMock()
    mock_redis.pipeline.return_value.execute = AsyncMock(
        return_value=[(60, 60)]
    )
    limiter = ToolRateLimiter(
        redis_client=mock_redis,
        config=RateLimitConfig(limit=50, window_sec=60),
    )
    with pytest.raises(RateLimitExceeded, match="Rate limit exceeded"):
        await limiter.check(tenant_id="acme", tool_name="kb_search")


@pytest.mark.asyncio
async def test_rate_limit_custom_config() -> None:
    mock_redis = AsyncMock()
    mock_redis.pipeline.return_value.execute = AsyncMock(
        return_value=[(100, 120)]
    )
    limiter = ToolRateLimiter(
        redis_client=mock_redis,
        config=RateLimitConfig(limit=200, window_sec=120),
    )
    # 100 < 200: 通过
    await limiter.check(tenant_id="acme", tool_name="foo")