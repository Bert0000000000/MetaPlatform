"""Provider error classification (P2, LiteLLM retryable-error semantics).

``ProviderCallError`` subclasses RuntimeError so existing route handlers
(``except RuntimeError → 503``) keep working unchanged, while the resilience
layer can catch it specifically and read:

- ``status_code`` — upstream HTTP status when known (None for network errors)
- ``retry_after`` — Retry-After header seconds when the upstream sent one
- ``retryable`` — 5xx / 408 / 429 / timeout / connection errors are retryable;
  every other 4xx is a client error that retrying or falling back cannot fix
  (LiteLLM: retrying a 400 just burns quota and hides bugs).
"""
from __future__ import annotations

from typing import Any

# Statuses that are worth retrying despite being 4xx.
_RETRYABLE_4XX = frozenset({408, 429})


class ProviderCallError(RuntimeError):
    """Upstream provider failure with classification metadata."""

    def __init__(
        self,
        message: str,
        *,
        provider: str = "",
        status_code: int | None = None,
        retry_after: int | None = None,
        cause: BaseException | None = None,
    ) -> None:
        super().__init__(message)
        self.provider = provider
        self.status_code = status_code
        self.retry_after = retry_after
        self.cause = cause

    @property
    def retryable(self) -> bool:
        if self.status_code is None:
            return True  # network/timeout/unknown → worth another attempt
        if self.status_code >= 500:
            return True
        return self.status_code in _RETRYABLE_4XX

    @property
    def non_retryable_client_error(self) -> bool:
        """A 4xx that must surface to the caller, not be retried/fallback."""
        return (
            self.status_code is not None
            and 400 <= self.status_code < 500
            and self.status_code not in _RETRYABLE_4XX
        )


def _parse_retry_after(headers: Any) -> int | None:
    if headers is None:
        return None
    try:
        raw = headers.get("retry-after") or headers.get("Retry-After")
    except Exception:  # noqa: BLE001 — header access must never raise
        return None
    if raw is None:
        return None
    try:
        return max(int(str(raw).strip()), 0)
    except ValueError:
        return None  # HTTP-date form: let the cooldown default apply


def classify_provider_error(provider: str, exc: BaseException) -> ProviderCallError:
    """Wrap any provider failure into a ProviderCallError with metadata."""
    import httpx

    if isinstance(exc, ProviderCallError):
        return exc
    if isinstance(exc, httpx.HTTPStatusError):
        return ProviderCallError(
            f"{provider} upstream returned {exc.response.status_code}: {exc.response.text[:200]}",
            provider=provider,
            status_code=exc.response.status_code,
            retry_after=_parse_retry_after(exc.response.headers),
            cause=exc,
        )
    if isinstance(exc, httpx.TimeoutException):
        return ProviderCallError(
            f"{provider} upstream timed out: {exc}",
            provider=provider,
            cause=exc,
        )
    if isinstance(exc, httpx.HTTPError):
        return ProviderCallError(
            f"{provider} upstream connection failed: {exc}",
            provider=provider,
            cause=exc,
        )
    return ProviderCallError(
        f"{provider} call failed: {exc}",
        provider=provider,
        cause=exc,
    )
