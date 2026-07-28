"""Conftest for mate-tech-llmgw (ST-5.5.12.1 enhanced)."""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from mate_tech_llmgw.cache.llm_cache import LLMCache
from mate_tech_llmgw.chat import ChatMessage, ChatResponse
from mate_tech_llmgw.cost.recorder import CostRecorder
from mate_tech_llmgw.providers.anthropic import AnthropicChatProvider
from mate_tech_llmgw.providers.doubao import DoubaoChatProvider
from mate_tech_llmgw.providers.openai import OpenAIChatProvider
from mate_tech_llmgw.providers.qwen import QwenChatProvider
from mate_tech_llmgw.quota.bucket import QuotaConfig, RedisTokenBucket


@pytest.fixture
def sample_messages() -> list[ChatMessage]:
    return [
        ChatMessage(role="system", content="You are helpful"),
        ChatMessage(role="user", content="Hello"),
    ]


@pytest.fixture
def sample_response() -> ChatResponse:
    return ChatResponse(
        content="Hi there!",
        model="gpt-4o",
        finish_reason="stop",
        tool_calls=[],
        usage={"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8},
    )


@pytest.fixture
def openai_provider() -> OpenAIChatProvider:
    return OpenAIChatProvider(api_key="sk-test", model="gpt-4o")


@pytest.fixture
def anthropic_provider() -> AnthropicChatProvider:
    return AnthropicChatProvider(api_key="sk-ant-test", model="claude-3-5-sonnet-20241022")


@pytest.fixture
def qwen_provider() -> QwenChatProvider:
    return QwenChatProvider(api_key="sk-qwen-test", model="qwen-turbo")


@pytest.fixture
def doubao_provider() -> DoubaoChatProvider:
    return DoubaoChatProvider(api_key="sk-doubao-test", model="doubao-pro-32k")


@pytest.fixture
def quota_config() -> QuotaConfig:
    return QuotaConfig(rpm_limit=10, tpm_limit=10_000, window_sec=60)


@pytest.fixture
def mock_redis_bucket(quota_config: QuotaConfig) -> RedisTokenBucket:
    mock_redis = AsyncMock()
    mock_redis.pipeline.return_value.execute = AsyncMock(
        return_value=[(1, 60, 100, 60), (1, 60, 100, 60)]
    )
    return RedisTokenBucket(redis_client=mock_redis, config=quota_config)


@pytest.fixture
def cost_recorder() -> CostRecorder:
    return CostRecorder()


@pytest.fixture
def llm_cache_mock() -> LLMCache:
    mock_redis = AsyncMock()
    return LLMCache(redis_client=mock_redis, ttl_sec=60, enabled=True)