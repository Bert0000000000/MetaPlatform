"""Tests for the copilot query dispatcher (PR-4).

Covers:
  - simple query → llmgw
  - deep research query → A2A (mock httpx)
  - A2A error → fallback to llmgw
  - require_tenant enforcement
  - timeout handling
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from mate_app_copilot.routing.dispatcher import dispatch
from mate_platform.tenancy.context import AuthMethod, RequestContext, TenantId, UserId
from mate_platform.tenancy.guards import TenantAccessError


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
def _ctx(tenant: str = "tenant-acme") -> RequestContext:
    return RequestContext(
        request_id="req-test",
        trace_id="trace-test",
        tenant_id=TenantId(tenant),
        user_id=UserId("u-1"),
        roles=frozenset({"PLATFORM_SUPER_ADMIN"}),
        permissions=frozenset(),
        auth_method=AuthMethod.USER,
    )


def _ctx_anonymous() -> RequestContext:
    return RequestContext(
        request_id="req-anon",
        trace_id="trace-anon",
        tenant_id=TenantId(""),
        user_id=UserId(""),
        roles=frozenset(),
        permissions=frozenset(),
        auth_method=AuthMethod.ANONYMOUS,
    )


class _MockLlmgwClient:
    """Minimal llmgw client stub with a ``chat`` method."""

    def __init__(self, response: str = "llmgw-answer") -> None:
        self._response = response
        self.chat_calls: list[str] = []

    def chat(self, query: str) -> str:
        self.chat_calls.append(query)
        return self._response


def _mock_http_client(
    response_body: dict | None = None,
    *,
    status_code: int = 200,
    raise_exc: Exception | None = None,
) -> MagicMock:
    """Build a mock async HTTP client (duck-typed to httpx.AsyncClient)."""
    mock = MagicMock()
    mock.aclose = AsyncMock(return_value=None)
    if raise_exc is not None:
        mock.post = AsyncMock(side_effect=raise_exc)
    else:
        mock_resp = MagicMock()
        mock_resp.status_code = status_code
        mock_resp.json.return_value = response_body or {"result": {"report": "deep report"}}
        mock_resp.text = "raw text"
        mock.post = AsyncMock(return_value=mock_resp)
    return mock


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_dispatch_simple_query_calls_llmgw() -> None:
    """A short simple query should go to llmgw, not A2A."""
    llmgw = _MockLlmgwClient("simple answer")
    http = _mock_http_client()

    result = await dispatch(
        query="hello",
        llmgw_client=llmgw,
        ctx=_ctx(),
        http_client=http,
    )

    assert result["source"] == "llmgw"
    assert result["answer"] == "simple answer"
    assert llmgw.chat_calls == ["hello"]
    http.post.assert_not_called()


@pytest.mark.asyncio
async def test_dispatch_deep_research_calls_a2a() -> None:
    """A long query with research keywords should go to A2A."""
    llmgw = _MockLlmgwClient("should-not-be-used")
    http = _mock_http_client(
        response_body={"result": {"report": "# Deep Research Report\n..."}},
    )

    query = "请帮我做一个关于人工智能发展趋势的深入研究报告需要涵盖多个方面"
    result = await dispatch(
        query=query,
        llmgw_client=llmgw,
        ctx=_ctx(),
        bearer_token="test-token",
        http_client=http,
    )

    assert result["source"] == "a2a"
    assert "Deep Research Report" in result["answer"]
    # llmgw should NOT have been called
    assert llmgw.chat_calls == []
    # A2A POST should have been called once
    http.post.assert_called_once()
    call_kwargs = http.post.call_args
    assert call_kwargs.kwargs["json"]["target_agent_id"] == "deep-research"
    assert call_kwargs.kwargs["headers"]["Authorization"] == "Bearer test-token"


@pytest.mark.asyncio
async def test_dispatch_fallback_on_a2a_error() -> None:
    """When A2A fails, fall back to llmgw so the user gets an answer."""
    llmgw = _MockLlmgwClient("fallback answer")
    http = _mock_http_client(raise_exc=ConnectionError("a2a down"))

    query = "请帮我做一个关于人工智能发展趋势的深入研究报告需要涵盖多个方面"
    result = await dispatch(
        query=query,
        llmgw_client=llmgw,
        ctx=_ctx(),
        http_client=http,
    )

    assert result["source"] == "fallback"
    assert result["answer"] == "fallback answer"
    assert "error" in result


@pytest.mark.asyncio
async def test_dispatch_uses_require_tenant() -> None:
    """Anonymous ctx (no tenant) → TenantAccessError."""
    llmgw = _MockLlmgwClient()
    http = _mock_http_client()

    with pytest.raises(TenantAccessError):
        await dispatch(
            query="hello",
            llmgw_client=llmgw,
            ctx=_ctx_anonymous(),
            http_client=http,
        )


@pytest.mark.asyncio
async def test_dispatch_timeout_returns_error() -> None:
    """A2A timeout falls back to llmgw with an error field."""
    llmgw = _MockLlmgwClient("timeout fallback")
    http = _mock_http_client(raise_exc=TimeoutError("request timed out"))

    query = "请帮我做一个关于人工智能发展趋势的深入研究报告需要涵盖多个方面"
    result = await dispatch(
        query=query,
        llmgw_client=llmgw,
        ctx=_ctx(),
        http_client=http,
    )

    assert result["source"] == "fallback"
    assert result["answer"] == "timeout fallback"
    assert "timed out" in result["error"]
