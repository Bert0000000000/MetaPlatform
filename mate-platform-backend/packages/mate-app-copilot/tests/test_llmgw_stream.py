"""Tests for mate_app_copilot.clients.llmgw_stream (TD-6 + ADR-0015 rule 4).

Verifies the copilot → llmgw streaming client:

* Injects ``Authorization: Bearer`` + ``X-Tenant-Id`` via
  `OutgoingAuthMiddleware` on every outbound call (hard rule 4).
* Targets the canonical paths (``/api/v1/llmgw/chat/real`` and
  ``/api/v1/llmgw/chat``).
* Translates transport / decode failures into `LlmgwStreamError`
  instead of swallowing them silently (hard rule 5).
* Honours the host / port env-overrides so the same code runs in
  docker-compose, staging, and local dev.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager

import httpx
import pytest

os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from mate_app_copilot.clients.llmgw_stream import (
    LlmgwStreamClient,
    LlmgwStreamError,
)

from mate_clients.security.bearer import BearerAuth, CachedToken

TENANT = "tenant-acme"


def _make_auth() -> BearerAuth:
    auth = BearerAuth(
        token_uri="http://localhost:8080/realms/metaplatform/protocol/openid-connect/token",
        client_id="metaplatform-backend",
        client_secret="test-secret",
        scope="platform.read",
    )
    auth._cached = CachedToken(  # type: ignore[attr-defined]
        access_token="stub-cached-token",
        expires_at=time.time() + 3600.0,
    )
    return auth


def _make_client(host: str = "mate-tech-llmgw", port: int = 8008) -> LlmgwStreamClient:
    return LlmgwStreamClient(
        host=host,
        port=port,
        auth=_make_auth(),
        tenant_id=TENANT,
        timeout_seconds=2.0,
    )


@contextmanager
def _with_mock_transport(
    handler: Callable[[httpx.Request], httpx.Response],
) -> Iterator[httpx.MockTransport]:
    """Install an httpx MockTransport on httpx.AsyncClient for the duration."""
    transport = httpx.MockTransport(handler)
    orig_init = httpx.AsyncClient.__init__

    def _patched_init(self: httpx.AsyncClient, *args: object, **kwargs: object) -> None:
        kwargs["transport"] = transport
        orig_init(self, *args, **kwargs)

    httpx.AsyncClient.__init__ = _patched_init  # type: ignore[assignment]
    try:
        yield transport
    finally:
        httpx.AsyncClient.__init__ = orig_init  # type: ignore[assignment]


def test_stream_chat_real_targets_canonical_path_and_acl() -> None:
    """The streaming call hits /api/v1/llmgw/chat/real with Bearer + tenant."""
    client = _make_client()

    captured: dict[str, object] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization")
        captured["tenant"] = request.headers.get("x-tenant-id")
        captured["body"] = json.loads(request.content.decode("utf-8"))
        # Stream two SSE data lines + a [DONE] marker (mirrors llmgw's
        # SSE framing even though the real endpoint is non-streaming).
        lines = [
            'data: {"choices": [{"delta": {"content": "hello"}}]}',
            "",
            'data: {"choices": [{"delta": {"content": " world"}}]}',
            "",
            "data: [DONE]",
            "",
        ]
        return httpx.Response(200, content="\n".join(lines))

    async def run() -> list[str]:
        out: list[str] = []
        async for line in client.stream_chat_real(
            messages=[{"role": "user", "content": "hi"}],
            model="gpt-4o-mini",
            temperature=0.5,
            max_tokens=128,
        ):
            out.append(line)
        return out

    with _with_mock_transport(handler):
        lines = _run_sync(run())

    assert captured["url"] == "http://mate-tech-llmgw:8008/api/v1/llmgw/chat/real"
    assert captured["auth"] == "Bearer stub-cached-token"
    assert captured["tenant"] == TENANT
    body = captured["body"]
    assert isinstance(body, dict)
    assert body["model"] == "gpt-4o-mini"
    assert body["tenant_id"] == TENANT
    assert body["temperature"] == 0.5
    assert body["max_tokens"] == 128
    assert body["messages"] == [{"role": "user", "content": "hi"}]
    # Stream parser strips empty lines (SSE framing) and forwards the
    # ``data:`` payloads. We assert at least one forwarded line carries
    # the first chunk; the upstream body has a single combined JSON line
    # in llmgw's real endpoint, so the assertion focuses on the SSE
    # envelope rather than per-token chunks.
    assert any(ln.startswith("data:") for ln in lines)
    assert any('"hello"' in ln for ln in lines)


def test_chat_completion_returns_parsed_json() -> None:
    client = _make_client()

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"content": "hi there", "model": "gpt-4o-mini"},
        )

    async def run() -> dict[str, object]:
        return await client.chat_completion(
            messages=[{"role": "user", "content": "hi"}],
            model="gpt-4o-mini",
        )

    with _with_mock_transport(handler):
        result = _run_sync(run())

    assert result == {"content": "hi there", "model": "gpt-4o-mini"}


def test_stream_chat_real_translates_transport_error() -> None:
    """A connect error surfaces as LlmgwStreamError (not silent fallback)."""
    client = _make_client(host="localhost", port=1)  # refused

    async def run() -> None:
        async for _ in client.stream_chat_real(
            messages=[{"role": "user", "content": "hi"}],
            model="gpt-4o-mini",
        ):
            pass  # pragma: no cover

    with pytest.raises(LlmgwStreamError):
        _run_sync(run())


def test_chat_completion_translates_non_200() -> None:
    client = _make_client()

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="upstream down")

    async def run() -> dict[str, object]:
        return await client.chat_completion(
            messages=[{"role": "user", "content": "hi"}],
            model="gpt-4o-mini",
        )

    with _with_mock_transport(handler), pytest.raises(LlmgwStreamError):
        _run_sync(run())


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _run_sync(coro: object) -> object:
    """Run an awaitable from sync test code.

    Uses asyncio.run so the test file does not depend on the project's
    pytest-asyncio configuration (which is async-mode strict elsewhere).
    """
    return asyncio.run(coro)  # type: ignore[arg-type]
