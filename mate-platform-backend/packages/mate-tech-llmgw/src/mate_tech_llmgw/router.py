"""Multi-provider router (ST-5.5.3.3 + ST-5.5.3.2 已完成).

根据 model 字段路由到 openai / anthropic / qwen / doubao。
"""
from __future__ import annotations

from typing import Any

import structlog

from .chat import ChatMessage, ChatProvider, ChatResponse
from .providers.anthropic import AnthropicChatProvider
from .providers.doubao import DoubaoChatProvider
from .providers.openai import OpenAIChatProvider
from .providers.qwen import QwenChatProvider

logger = structlog.get_logger(__name__)

_ROUTING_RULES: dict[str, str] = {
    # OpenAI 系列
    "gpt-4o": "openai",
    "gpt-4o-mini": "openai",
    "gpt-4-turbo": "openai",
    "gpt-3.5-turbo": "openai",
    # Anthropic 系列
    "claude-3-5-sonnet-20241022": "anthropic",
    "claude-3-opus-20240229": "anthropic",
    "claude-3-haiku-20240307": "anthropic",
    # Qwen 系列 (ST-5.5.3.2)
    "qwen-turbo": "qwen",
    "qwen-plus": "qwen",
    "qwen-max": "qwen",
    "qwen-long": "qwen",
    # Doubao 系列 (ST-5.5.3.2)
    "doubao-pro": "doubao",
    "doubao-pro-32k": "doubao",
    "doubao-lite": "doubao",
}


def _provider_name(model: str) -> str:
    """根据 model 名字解析 provider."""
    if model in _ROUTING_RULES:
        return _ROUTING_RULES[model]
    lower = model.lower()
    if lower.startswith("gpt-"):
        return "openai"
    if lower.startswith("claude-"):
        return "anthropic"
    if lower.startswith("qwen"):
        return "qwen"
    if lower.startswith("doubao"):
        return "doubao"
    return "openai"


_providers: dict[str, ChatProvider] = {}


def get_provider(model: str) -> ChatProvider:
    """获取 provider 实例(懒加载 + 单例)."""
    name = _provider_name(model)
    if name in _providers:
        return _providers[name]

    if name == "openai":
        provider = OpenAIChatProvider(model=model)
    elif name == "anthropic":
        provider = AnthropicChatProvider(model=model)
    elif name == "qwen":
        provider = QwenChatProvider(model=model)
    elif name == "doubao":
        provider = DoubaoChatProvider(model=model)
    else:
        raise NotImplementedError(f"Provider '{name}' not implemented")
    _providers[name] = provider
    logger.info("llmgw.provider.initialized", name=name, model=model)
    return provider


async def chat(
    model: str,
    messages: list[ChatMessage],
    *,
    temperature: float = 1.0,
    max_tokens: int | None = None,
    tools: list[dict[str, Any]] | None = None,
    **kwargs: Any,
) -> ChatResponse:
    """根据 model 路由 chat 调用."""
    provider = get_provider(model)
    return await provider.chat(
        messages,
        temperature=temperature,
        max_tokens=max_tokens,
        tools=tools,
        **kwargs,
    )


def reset_providers() -> None:
    """测试辅助:清除 provider 缓存."""
    _providers.clear()