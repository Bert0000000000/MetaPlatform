"""Retry + Fallback (ST-5.5.6, P2 semantics fix).

主模型 5xx/超时/429 → 自动 fallback 到次选。

P2 fix (LiteLLM semantics): non-retryable 4xx client errors (400/401/403/
404/422 …) are NOT retried and do NOT consume the fallback chain — they
surface to the caller with the upstream status, because retrying a bad
request cannot succeed and masks caller bugs.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import structlog
from fastapi import HTTPException
from tenacity import (
    AsyncRetrying,
    RetryError,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from ..chat import ChatMessage, ChatResponse
from ..resilience.errors import ProviderCallError

logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class FallbackChain:
    """主备 fallback 链:依次尝试每个模型."""

    models: tuple[str, ...]
    retry_per_model: int = 1  # 每个模型的重试次数(不重试,靠 fallback)


async def chat_with_fallback(
    chat_fn: Callable[..., Awaitable[ChatResponse]],
    *,
    primary_model: str,
    fallback_models: tuple[str, ...] = (),
    messages: list[ChatMessage],
    temperature: float = 1.0,
    max_tokens: int | None = None,
    tools: list[dict] | None = None,
    **kwargs: object,
) -> ChatResponse:
    """先 primary,失败 fallback 到次选.

    Args:
        chat_fn: router.chat 函数
        primary_model: 主模型
        fallback_models: 备选模型列表
        messages, temperature, max_tokens, tools: 透传参数
    """
    chain = (primary_model, *fallback_models)
    last_error: Exception | None = None
    for model in chain:
        try:
            logger.info("llmgw.fallback.try", model=model)
            resp = await chat_fn(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                tools=tools,
                **kwargs,
            )
            if model != primary_model:
                logger.warning("llmgw.fallback.used", model=model, primary=primary_model)
            return resp
        except ProviderCallError as e:
            if e.non_retryable_client_error:
                # Bad request / bad key / unknown model: falling back would
                # hide the caller's bug and burn fallback quota.
                logger.warning(
                    "llmgw.fallback.client_error_no_retry",
                    model=model,
                    status=e.status_code,
                    error=str(e),
                )
                raise HTTPException(status_code=e.status_code or 400, detail=str(e)) from e
            last_error = e
            _log_fallback_failure(model, e, chain)
            continue
        except Exception as e:
            last_error = e
            _log_fallback_failure(model, e, chain)
            continue
    # 全部失败
    msg = f"All models failed. Primary={primary_model}, fallbacks={fallback_models}"
    if last_error:
        msg += f", last_error={last_error}"
    raise RuntimeError(msg)


def _log_fallback_failure(model: str, error: Exception, chain: tuple[str, ...]) -> None:
    idx = chain.index(model) if model in chain else len(chain) - 1
    nxt = chain[idx + 1] if idx + 1 < len(chain) else None
    logger.warning("llmgw.fallback.failed", model=model, error=str(error), next=nxt)


def with_retry(
    fn: Callable[..., Awaitable[ChatResponse]],
    *,
    max_attempts: int = 3,
    initial_wait: float = 1.0,
    max_wait: float = 10.0,
    exceptions: tuple[type[BaseException], ...] = (Exception,),
) -> Callable[..., Awaitable[ChatResponse]]:
    """用 tenacity 给函数加指数退避重试."""

    async def wrapper(*args: object, **kwargs: object) -> ChatResponse:
        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(max_attempts),
                wait=wait_exponential(multiplier=initial_wait, max=max_wait),
                retry=retry_if_exception_type(exceptions),
                reraise=True,
            ):
                with attempt:
                    return await fn(*args, **kwargs)
        except RetryError as e:
            raise RuntimeError(f"Retry exhausted after {max_attempts} attempts") from e
        raise RuntimeError("retry loop exited without returning")  # unreachable

    return wrapper
