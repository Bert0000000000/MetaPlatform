"""Multi-provider router (ST-5.5.3.3 + ST-5.5.3.2 已完成).

根据 model 字段路由到 openai / anthropic / qwen / doubao。
P3-W9: chat() 主路径接入 cache + quota + cost 三大模块。
"""
from __future__ import annotations

import os
from typing import Any

import structlog
from fastapi import HTTPException
from mate_platform.runtime import is_production_profile

from .cache.llm_cache import LLMCache, cache_key
from .chat import ChatMessage, ChatProvider, ChatResponse
from .cost.ceiling import MonthlyTokenBucket, UserDailyCap
from .cost.recorder import CostRecorder
from .providers.anthropic import AnthropicChatProvider
from .providers.doubao import DoubaoChatProvider
from .providers.local import LocalStubProvider
from .providers.openai import OpenAIChatProvider
from .providers.qwen import QwenChatProvider
from .quota.bucket import QuotaExceededError, RedisTokenBucket

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Provider 白名单 + 常量
# ---------------------------------------------------------------------------
SUPPORTED_PROVIDERS: dict[str, str] = {
    "openai": "OpenAI GPT models",
    "doubao": "ByteDance Doubao (Ark)",
    "anthropic": "Anthropic Claude",
    "deepseek": "DeepSeek",
    "local": "Local stub provider (testing)",
    "qwen": "Alibaba Qwen",
    "moonshot": "Moonshot Kimi",
}

UNSUPPORTED_ERROR_MSG = (
    "Provider '{name}' is not supported. "
    "Supported providers: {supported}."
)

# OpenAI 兼容 provider 的 base_url
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
MOONSHOT_BASE_URL = "https://api.moonshot.cn/v1"

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
    # DeepSeek 系列 (OpenAI 兼容)
    "deepseek-chat": "deepseek",
    "deepseek-coder": "deepseek",
    "deepseek-reasoner": "deepseek",
    # Moonshot 系列 (OpenAI 兼容)
    "moonshot-v1-8k": "moonshot",
    "moonshot-v1-32k": "moonshot",
    "moonshot-v1-128k": "moonshot",
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
    if lower.startswith("deepseek"):
        return "deepseek"
    if lower.startswith("moonshot") or lower.startswith("kimi"):
        return "moonshot"
    return "openai"


_providers: dict[str, ChatProvider] = {}

# ---------------------------------------------------------------------------
# P3-W9: Cache / Quota / Cost 单例 (lazy-init, 测试环境无 Redis 时降级 no-op)
# ---------------------------------------------------------------------------
_cache: LLMCache | None = None
_quota_bucket: RedisTokenBucket | None = None
_cost_recorder: CostRecorder | None = None
_monthly_bucket: MonthlyTokenBucket | None = None
_user_daily_cap: UserDailyCap | None = None


def set_cache(cache: LLMCache | None) -> None:
    """注入 LLMCache 实例(生产启动或测试注入)."""
    global _cache
    _cache = cache


def set_quota_bucket(bucket: RedisTokenBucket | None) -> None:
    """注入 RedisTokenBucket 实例."""
    global _quota_bucket
    _quota_bucket = bucket


def set_cost_recorder(recorder: CostRecorder | None) -> None:
    """注入 CostRecorder 实例."""
    global _cost_recorder
    _cost_recorder = recorder


def set_monthly_bucket(bucket: MonthlyTokenBucket | None) -> None:
    """注入 MonthlyTokenBucket 实例 (ADR-0018 §2.4)."""
    global _monthly_bucket
    _monthly_bucket = bucket


def set_user_daily_cap(cap: UserDailyCap | None) -> None:
    """注入 UserDailyCap 实例 (ADR-0018 §2.4)."""
    global _user_daily_cap
    _user_daily_cap = cap


def get_cache() -> LLMCache | None:
    """获取当前 cache 单例(管理 API 使用)."""
    return _cache


def get_quota_bucket() -> RedisTokenBucket | None:
    """获取当前 quota bucket 单例."""
    return _quota_bucket


def get_cost_recorder() -> CostRecorder | None:
    """获取当前 cost recorder 单例."""
    return _cost_recorder


def get_monthly_bucket() -> MonthlyTokenBucket | None:
    """获取当前 monthly bucket 单例 (ADR-0018 §2.4)."""
    return _monthly_bucket


def get_user_daily_cap() -> UserDailyCap | None:
    """获取当前 user daily cap 单例 (ADR-0018 §2.4)."""
    return _user_daily_cap


def reset_state() -> None:
    """重置所有单例(测试用)."""
    global _cache, _quota_bucket, _cost_recorder, _monthly_bucket, _user_daily_cap
    _cache = None
    _quota_bucket = None
    _cost_recorder = None
    _monthly_bucket = None
    _user_daily_cap = None


def get_provider(model: str) -> ChatProvider:
    """获取 provider 实例(懒加载 + 单例).

    接受 model 名 (gpt-4o, claude-3-5-sonnet-20241022, ...) 或显式
    provider 名 (openai, anthropic, local, ...)。未知 provider 抛
    ``ValueError`` (含支持的 provider 列表)，替代原先的
    ``NotImplementedError``，使调用方能以 400 而非 500 响应。
    """
    lower = (model or "").lower().strip()

    # 显式 provider 名直达
    if lower in SUPPORTED_PROVIDERS:
        name = lower
    elif "-" not in lower and lower.isalpha():
        # 看起来像 provider 名但不支持 (bare word, 无连字符)
        raise ValueError(
            UNSUPPORTED_ERROR_MSG.format(
                name=lower, supported=", ".join(SUPPORTED_PROVIDERS.keys())
            )
        )
    else:
        # model 名 → provider 名
        name = _provider_name(model)

    if name == "local" and is_production_profile():
        raise RuntimeError("local LLM provider is disabled in production")

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
    elif name == "deepseek":
        provider = OpenAIChatProvider(
            model=model,
            base_url=DEEPSEEK_BASE_URL,
            api_key=os.getenv("DEEPSEEK_API_KEY", ""),
        )
    elif name == "moonshot":
        provider = OpenAIChatProvider(
            model=model,
            base_url=MOONSHOT_BASE_URL,
            api_key=os.getenv("MOONSHOT_API_KEY", ""),
        )
    elif name == "local":
        provider = LocalStubProvider(model=model)
    else:
        raise ValueError(
            UNSUPPORTED_ERROR_MSG.format(
                name=name, supported=", ".join(SUPPORTED_PROVIDERS.keys())
            )
        )
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
    tenant_id: str = "default",
    **kwargs: Any,
) -> ChatResponse:
    """根据 model 路由 chat 调用.

    P3-W9: 接入 cache (命中跳过 provider) + quota (超限 429) + cost (记录用量)。
    三者在无 Redis/PG 的测试环境降级为 no-op (try/except 包裹)。
    """
    # --- 1. Quota check (模拟 @with_quota 效果) ---
    if _quota_bucket is not None:
        estimated_tokens = sum(max(1, len(m.content) // 4) for m in messages)
        try:
            await _quota_bucket.acquire(
                tenant_id=tenant_id, estimated_tokens=estimated_tokens
            )
        except QuotaExceededError as e:
            raise HTTPException(
                status_code=429,
                detail=f"Quota exceeded for tenant '{tenant_id}'; retry after {e.retry_after}s",
                headers={"Retry-After": str(e.retry_after)},
            ) from e
        except Exception as e:
            logger.warning("llmgw.quota.degraded", tenant=tenant_id, error=str(e))

    # --- 2. Cache check (命中则跳过 provider) ---
    ckey: str | None = None
    if _cache is not None:
        ckey = cache_key(
            messages, model=model, temperature=temperature, tenant_id=tenant_id
        )
        try:
            cached = await _cache.get(ckey)
            if cached is not None:
                logger.info("llmgw.cache.hit", tenant=tenant_id, model=model)
                return cached
        except Exception as e:
            logger.warning("llmgw.cache.get_failed", error=str(e))
            ckey = None  # disable set if get failed

    # --- 3. Provider call ---
    provider = get_provider(model)
    resp = await provider.chat(
        messages,
        temperature=temperature,
        max_tokens=max_tokens,
        tools=tools,
        **kwargs,
    )

    # --- 4. Cache set (回填) ---
    if _cache is not None and ckey is not None:
        try:
            await _cache.set(ckey, resp)
        except Exception as e:
            logger.warning("llmgw.cache.set_failed", error=str(e))

    # --- 5. Cost record (记录 token 用量) ---
    if _cost_recorder is not None:
        try:
            await _cost_recorder.record(
                model=model, tenant_id=tenant_id, usage=resp.usage
            )
        except Exception as e:
            logger.warning("llmgw.cost.record_failed", error=str(e))

    return resp


def reset_providers() -> None:
    """测试辅助:清除 provider 缓存."""
    _providers.clear()
