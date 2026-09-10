"""Provider cooldown / circuit-breaking (P2, LiteLLM router pattern).

Redis structure per provider (llmgw has one endpoint per provider; add a
``:{deployment_id}`` suffix if that ever changes):

    llmgw:cd:{provider}:fails     rolling failure count (per-minute window)
    llmgw:cd:{provider}:fails:ts  epoch of the current failure window
    llmgw:cd:{provider}:until     cooldown deadline (TTL = duration, so a
                                  dead provider self-heals out of cooldown)

Semantics — ported from LiteLLM ``deployment_callback_on_failure``:

- ``record_failure``: roll the 1-minute window, increment, and past
  ``allowed_fails`` put the provider in cooldown. Duration priority:
  explicit config > upstream Retry-After header > default.
- ``check``: single GET on the hot path — None = free to call, otherwise
  the remaining cooldown seconds.
- ``record_success``: clear the failure window (LiteLLM resets on success).
- Redis unavailable: every call is a logged no-op; the gateway serves
  without circuit breaking rather than failing closed.
"""

from __future__ import annotations

import time
from typing import Any

import structlog

logger = structlog.get_logger(__name__)

DEFAULT_ALLOWED_FAILS = 2
DEFAULT_COOLDOWN_SEC = 60.0
_WINDOW_SEC = 60.0

# Roll the window + increment + maybe arm cooldown, atomically.
_RECORD_FAILURE_LUA = """
local fails_key = KEYS[1]
local ts_key = KEYS[2]
local until_key = KEYS[3]
local now = tonumber(ARGV[1])
local window_sec = tonumber(ARGV[2])
local allowed = tonumber(ARGV[3])
local cooldown_sec = tonumber(ARGV[4])

local ts = tonumber(redis.call('GET', ts_key) or '0')
if now - ts > window_sec then
  redis.call('SET', fails_key, 0)
  redis.call('SET', ts_key, now)
end
local fails = redis.call('INCR', fails_key)
if fails > allowed and redis.call('TTL', until_key) < 0 then
  redis.call('SET', until_key, now + cooldown_sec)
  redis.call('EXPIRE', until_key, math.ceil(cooldown_sec))
  return {fails, 1}
end
return {fails, 0}
"""


class CooldownManager:
    """Per-provider cooldown state in Redis (soft dependency)."""

    def __init__(
        self,
        redis_client: Any,
        *,
        allowed_fails: int = DEFAULT_ALLOWED_FAILS,
        default_cooldown_sec: float = DEFAULT_COOLDOWN_SEC,
    ) -> None:
        self._redis = redis_client
        self._allowed_fails = allowed_fails
        self._default_cooldown = default_cooldown_sec

    def check(self, provider: str) -> float | None:
        """Remaining cooldown seconds, or None when the provider is free."""
        try:
            until = self._redis.get(f"llmgw:cd:{provider}:until")
        except Exception as exc:
            logger.warning("llmgw.cooldown.check_failed", provider=provider, error=str(exc))
            return None
        if until is None:
            return None
        remaining = float(until) - time.time()
        return remaining if remaining > 0 else None

    async def record_failure(
        self,
        provider: str,
        *,
        retry_after_hint: int | None = None,
        cooldown_sec: float | None = None,
    ) -> None:
        """Count a failure; arm cooldown past allowed_fails within a minute."""
        try:
            result = await self._redis.eval(
                _RECORD_FAILURE_LUA,
                3,
                f"llmgw:cd:{provider}:fails",
                f"llmgw:cd:{provider}:fails:ts",
                f"llmgw:cd:{provider}:until",
                time.time(),
                _WINDOW_SEC,
                self._allowed_fails,
                self._cooldown_duration(retry_after_hint, cooldown_sec),
            )
            fails, armed = int(result[0]), int(result[1])
            if armed:
                logger.warning(
                    "llmgw.cooldown.triggered",
                    provider=provider,
                    fails=fails,
                    allowed_fails=self._allowed_fails,
                    duration_sec=self._cooldown_duration(retry_after_hint, cooldown_sec),
                )
        except Exception as exc:
            logger.warning("llmgw.cooldown.record_failed", provider=provider, error=str(exc))

    async def record_success(self, provider: str) -> None:
        """Reset the failure window on success (LiteLLM semantics)."""
        try:
            await self._redis.delete(f"llmgw:cd:{provider}:fails", f"llmgw:cd:{provider}:fails:ts")
        except Exception as exc:
            logger.warning("llmgw.cooldown.reset_failed", provider=provider, error=str(exc))

    def _cooldown_duration(self, retry_after_hint: int | None, explicit: float | None) -> float:
        # Priority: explicit config > upstream Retry-After > default.
        if explicit is not None and explicit >= 0:
            return float(explicit)
        if retry_after_hint is not None and retry_after_hint > 0:
            return float(retry_after_hint)
        return self._default_cooldown


# --- process-wide singleton (wired in main.py lifespan) ---------------------

_cooldown: CooldownManager | None = None


def set_cooldown(manager: CooldownManager | None) -> None:
    global _cooldown
    _cooldown = manager


def get_cooldown() -> CooldownManager | None:
    return _cooldown
