"""Rate limit tests (ST-5.3.7)."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from mate_tech_mcp.tools.rate_limit import (
    RateLimitConfig,
    RateLimitExceeded,
    ToolRateLimiter,
)


def _build_pipeline_mock(execute_return: tuple[int, int]) -> MagicMock:
    """Build a redis mock where ``pipeline().execute()`` returns the tuple.

    The pipeline object is sync (matches real redis-py Pipeline); only
    ``execute()`` is awaited. ``incr`` / ``expire`` are sync attribute
    calls on the pipeline (mocked away by default).
    """
    mock_redis = MagicMock()
    pipe = MagicMock()
    pipe.execute = AsyncMock(return_value=execute_return)
    mock_redis.pipeline.return_value = pipe
    return mock_redis


@pytest.mark.asyncio
async def test_rate_limit_within() -> None:
    mock_redis = _build_pipeline_mock((5, 60))
    limiter = ToolRateLimiter(redis_client=mock_redis)
    await limiter.check(tenant_id="acme", tool_name="kb_search")


@pytest.mark.asyncio
async def test_rate_limit_exceeded() -> None:
    """超限 → RateLimitExceeded."""
    mock_redis = _build_pipeline_mock((60, 60))
    limiter = ToolRateLimiter(
        redis_client=mock_redis,
        config=RateLimitConfig(limit=50, window_sec=60),
    )
    with pytest.raises(RateLimitExceeded, match="Rate limit exceeded"):
        await limiter.check(tenant_id="acme", tool_name="kb_search")


@pytest.mark.asyncio
async def test_rate_limit_custom_config() -> None:
    mock_redis = _build_pipeline_mock((100, 120))
    limiter = ToolRateLimiter(
        redis_client=mock_redis,
        config=RateLimitConfig(limit=200, window_sec=120),
    )
    # 100 < 200: 通过
    await limiter.check(tenant_id="acme", tool_name="foo")