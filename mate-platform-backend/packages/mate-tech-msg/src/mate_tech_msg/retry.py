"""Retry with exponential backoff (ST-5.1.10)."""
from __future__ import annotations

import functools
from typing import Any, Awaitable, Callable

import structlog
from tenacity import (
    AsyncRetrying,
    RetryError,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = structlog.get_logger(__name__)


def with_retry(
    max_attempts: int = 3,
    initial_wait: float = 1.0,
    max_wait: float = 30.0,
    exceptions: tuple[type[BaseException], ...] = (Exception,),
) -> Callable[[Callable[..., Awaitable[Any]]], Callable[..., Awaitable[Any]]]:
    def decorator(fn: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        @functools.wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
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
                logger.error("retry.exhausted", attempts=max_attempts)
                raise RuntimeError(f"Retry exhausted: {max_attempts}") from e

        return wrapper

    return decorator