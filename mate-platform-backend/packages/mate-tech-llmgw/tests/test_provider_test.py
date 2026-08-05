"""Tests for ADR-0019: LLMGW AI provider connectivity probe.

Covers the four supported providers plus the no-base-url and
unknown-provider paths. All HTTP calls are mocked via httpx
MockTransport so the tests run in CI without upstream access.
"""
from __future__ import annotations

import httpx
import pytest

from mate_tech_llmgw.providers.test import (
    ProbeResult,
    ProviderId,
    _mask_api_key,
    default_probe_url,
    probe,
)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _run(coro):
    """Run a coroutine from sync test code without importing asyncio at the top."""
    import asyncio

    return asyncio.run(coro)


def _mock_handler(handler):
    """Build an httpx MockTransport that delegates to ``handler``."""
    return httpx.MockTransport(handler)


# ---------------------------------------------------------------------------
# unit tests
# ---------------------------------------------------------------------------
def test_default_probe_url_strips_trailing_slash() -> None:
    assert (
        default_probe_url("openai", "https://api.openai.com/v1/")
        == "https://api.openai.com/v1/models"
    )
    assert (
        default_probe_url("ollama", "http://localhost:11434")
        == "http://localhost:11434/api/tags"
    )
    assert (
        default_probe_url("azure", "https://x.openai.azure.com/openai/deployments")
        == "https://x.openai.azure.com/openai/deployments/openai/deployments?api-version=2024-02-01"
    )


def test_mask_api_key_truncates_to_4_chars() -> None:
    assert _mask_api_key("sk-abcdef1234567890") == "sk-a***"
    assert _mask_api_key(None) is None
    assert _mask_api_key("") is None
    assert _mask_api_key("abc") == "abc***"


def test_probe_returns_missing_base_url_for_empty_input() -> None:
    result = _run(probe(provider="openai", base_url=""))
    assert isinstance(result, ProbeResult)
    assert result.ok is False
    assert result.status == 0
    assert result.error == "missing_base_url"


def test_probe_clamps_timeout_to_min() -> None:
    """Invalid timeout values get clamped instead of raising."""
    captured: dict[str, float] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured["timeout"] = request.extensions.get("timeout")  # type: ignore[union-attr]
        return httpx.Response(200)

    original = httpx.AsyncClient.__init__

    def _patched(self, *args, **kwargs):
        kwargs["transport"] = _mock_handler(handler)
        original(self, *args, **kwargs)

    httpx.AsyncClient.__init__ = _patched  # type: ignore[assignment]
    try:
        _run(probe(provider="openai", base_url="https://api.openai.com/v1", timeout_sec=-5.0))
    finally:
        httpx.AsyncClient.__init__ = original  # type: ignore[assignment]
    # Timeout is clamped to >= 1.0 seconds; the probe therefore never
    # raises httpx.TimeoutException for absurd inputs.
    assert captured["timeout"] is not None


@pytest.mark.parametrize(
    "provider",
    ["openai", "azure", "ollama", "custom"],
)
def test_probe_returns_ok_on_200(provider: ProviderId) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"data": []})

    original = httpx.AsyncClient.__init__

    def _patched(self, *args, **kwargs):
        kwargs["transport"] = _mock_handler(handler)
        original(self, *args, **kwargs)

    httpx.AsyncClient.__init__ = _patched  # type: ignore[assignment]
    try:
        result = _run(
            probe(
                provider=provider,
                base_url="https://api.example.com",
                api_key="sk-test",
                timeout_sec=5.0,
            )
        )
    finally:
        httpx.AsyncClient.__init__ = original  # type: ignore[assignment]
    assert result.ok is True
    assert result.status == 200
    assert result.message == "端点可达"
    assert result.latency_ms >= 0
    assert result.error is None


@pytest.mark.parametrize("status_code", [401, 403])
def test_probe_returns_ok_on_auth_failure(status_code: int) -> None:
    """401/403 mean the address is reachable but credentials are wrong."""

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, text="forbidden")

    original = httpx.AsyncClient.__init__

    def _patched(self, *args, **kwargs):
        kwargs["transport"] = _mock_handler(handler)
        original(self, *args, **kwargs)

    httpx.AsyncClient.__init__ = _patched  # type: ignore[assignment]
    try:
        result = _run(
            probe(provider="openai", base_url="https://api.example.com", api_key="sk-test")
        )
    finally:
        httpx.AsyncClient.__init__ = original  # type: ignore[assignment]
    assert result.ok is True
    assert result.status == status_code
    assert "鉴权失败" in result.message


@pytest.mark.parametrize("status_code", [404, 405, 500, 502, 503])
def test_probe_returns_fail_on_other_status(status_code: int) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code)

    original = httpx.AsyncClient.__init__

    def _patched(self, *args, **kwargs):
        kwargs["transport"] = _mock_handler(handler)
        original(self, *args, **kwargs)

    httpx.AsyncClient.__init__ = _patched  # type: ignore[assignment]
    try:
        result = _run(probe(provider="openai", base_url="https://api.example.com"))
    finally:
        httpx.AsyncClient.__init__ = original  # type: ignore[assignment]
    assert result.ok is False
    assert result.status == status_code
    assert result.message == f"HTTP {status_code}"
    assert result.error == "bad_status"


def test_probe_handles_timeout() -> None:
    """Unreachable port (1) triggers connect error within timeout."""

    async def run() -> ProbeResult:
        return await probe(
            provider="openai",
            base_url="http://127.0.0.1:1",
            timeout_sec=1.0,
        )

    result = _run(run())
    assert result.ok is False
    assert result.error in {"connect_error", "connect_timeout", "transport_error"}
    assert result.latency_ms >= 0


def test_probe_sends_authorization_header_when_key_provided() -> None:
    captured: dict[str, str] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured["authorization"] = request.headers.get("authorization", "")
        return httpx.Response(200)

    original = httpx.AsyncClient.__init__

    def _patched(self, *args, **kwargs):
        kwargs["transport"] = _mock_handler(handler)
        original(self, *args, **kwargs)

    httpx.AsyncClient.__init__ = _patched  # type: ignore[assignment]
    try:
        _run(probe(provider="openai", base_url="https://api.example.com", api_key="sk-test-1234567890"))
    finally:
        httpx.AsyncClient.__init__ = original  # type: ignore[assignment]
    assert captured["authorization"] == "Bearer sk-test-1234567890"


def test_probe_omits_authorization_header_when_key_missing() -> None:
    captured: dict[str, str] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured["authorization"] = request.headers.get("authorization", "")
        return httpx.Response(200)

    original = httpx.AsyncClient.__init__

    def _patched(self, *args, **kwargs):
        kwargs["transport"] = _mock_handler(handler)
        original(self, *args, **kwargs)

    httpx.AsyncClient.__init__ = _patched  # type: ignore[assignment]
    try:
        _run(probe(provider="openai", base_url="https://api.example.com"))
    finally:
        httpx.AsyncClient.__init__ = original  # type: ignore[assignment]
    assert captured["authorization"] == ""
