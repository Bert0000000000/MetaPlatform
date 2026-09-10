"""Resilient provider call chain (P2).

One helper shared by router.chat and the /chat/real endpoints:

    cooldown check → bounded retry (retryable errors only) → fallback chain

Per candidate (provider name + call factory):
1. If the provider is in cooldown → skip to the next candidate.
2. Retry at most ``max_attempts`` times, ONLY on retryable errors
   (5xx / 408 / 429 / timeout / connection). Latency stays bounded:
   api-gateway kills the upstream at 60s, so the retry budget is small.
3. Non-retryable 4xx surfaces immediately as HTTPException (LiteLLM
   semantics — retrying a bad request masks the caller's bug).
4. Retryable failure records a cooldown failure for the provider and
   moves to the next candidate; success clears the failure window.

All candidates exhausted (or all cooling) → RuntimeError → 503 upstream.
"""

from __future__ import annotations

import asyncio
import json
import os
from collections.abc import Awaitable, Callable, Sequence
from typing import TypeVar

import structlog
from fastapi import HTTPException

from .cooldown import get_cooldown
from .errors import ProviderCallError

logger = structlog.get_logger(__name__)

T = TypeVar("T")

# Latency budget: 2 attempts, 0.5s→2s backoff (plan risk #7 — copilot-visible
# latency must stay far below the api-gateway 60s upstream timeout).
DEFAULT_MAX_ATTEMPTS = 2
DEFAULT_INITIAL_WAIT = 0.5
DEFAULT_MAX_WAIT = 2.0


def load_fallback_chain(model: str) -> tuple[str, ...]:
    """Fallback model list from LLMGW_FALLBACKS env JSON ({model: [models]})."""
    raw = os.getenv("LLMGW_FALLBACKS", "").strip()
    if not raw:
        return ()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("llmgw.fallbacks.env_invalid")
        return ()
    chain = data.get(model) if isinstance(data, dict) else None
    if not isinstance(chain, list):
        return ()
    return tuple(str(m) for m in chain)


async def call_with_resilience(
    candidates: Sequence[tuple[str, Callable[[], Awaitable[T]]]],
    *,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
    initial_wait: float = DEFAULT_INITIAL_WAIT,
    max_wait: float = DEFAULT_MAX_WAIT,
) -> T:
    """Walk the candidate chain with cooldown + bounded retry."""
    if not candidates:
        raise RuntimeError("no provider candidates configured")

    cooldown = get_cooldown()
    last_error: Exception | None = None

    for provider_name, call in candidates:
        if cooldown is not None:
            remaining = cooldown.check(provider_name)
            if remaining is not None:
                logger.warning(
                    "llmgw.cooldown.skip_candidate",
                    provider=provider_name,
                    remaining_sec=round(remaining, 1),
                )
                continue

        try:
            resp = await _retry_call(
                call,
                max_attempts=max_attempts,
                initial_wait=initial_wait,
                max_wait=max_wait,
            )
            if cooldown is not None:
                await cooldown.record_success(provider_name)
            return resp
        except ProviderCallError as e:
            if e.non_retryable_client_error:
                logger.warning(
                    "llmgw.resilience.client_error",
                    provider=provider_name,
                    status=e.status_code,
                )
                raise HTTPException(status_code=e.status_code or 400, detail=str(e)) from e
            last_error = e
            if cooldown is not None:
                await cooldown.record_failure(provider_name, retry_after_hint=e.retry_after)
            continue
        except Exception as e:
            import httpx

            # Only provider-shaped failures (upstream HTTP/network/RuntimeError)
            # participate in retry/fallback. Programming & input errors
            # (ValueError → 400, TypeError, …) pass through untouched.
            if not isinstance(e, (httpx.HTTPError, RuntimeError)):
                raise
            last_error = e
            if cooldown is not None:
                await cooldown.record_failure(provider_name)
            continue

    if last_error is not None:
        raise RuntimeError(
            f"all provider candidates failed; last_error={last_error}"
        ) from last_error
    raise RuntimeError("all provider candidates are in cooldown")


async def _retry_call(
    call: Callable[[], Awaitable[T]],
    *,
    max_attempts: int,
    initial_wait: float,
    max_wait: float,
) -> T:
    """Plain bounded retry: only retryable ProviderCallErrors get a 2nd shot."""
    delay = initial_wait
    for attempt in range(1, max_attempts + 1):
        try:
            return await call()
        except ProviderCallError as e:
            if not e.retryable or attempt == max_attempts:
                raise
        except Exception:
            raise  # non-provider errors: never retried
        await asyncio.sleep(delay)
        delay = min(delay * 2, max_wait)
    raise RuntimeError("retry loop exited without returning")  # pragma: no cover
