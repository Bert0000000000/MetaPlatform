"""E2e smoke: copilot → A2A → DeerFlow (mock) → report.

Unit-level end-to-end tests covering the full deep-research link logic
without spinning up real services. All external calls (DeerFlow Engine,
llmgw, A2A delegate) are mocked.

Covers:
  1. test_deep_research_e2e_mock        — invoke endpoint → mock DeerFlow → report
  2. test_simple_query_not_triggered    — short query → not deep research
  3. test_deep_research_query_triggered — long + keyword → deep research
  4. test_complexity_routing_simple      — dispatcher → llmgw (mock)
  5. test_complexity_routing_deep        — dispatcher → a2a (mock)
  6. test_agent_card_registered          — a2a bootstrap registered deep-research
  7. test_outbox_event_on_success        — success → deep.research.completed event
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from mate_app_a2a.bootstrap.agent_registration import (
    get_startup_agent,
    register_deerflow_at_startup,
    reset_startup_agents,
)
from mate_app_copilot.routing.complexity import is_deep_research_query
from mate_app_copilot.routing.dispatcher import dispatch

from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_platform.tenancy.context import AuthMethod, RequestContext, TenantId


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------
def _ctx(tenant: str = "tenant-acme") -> RequestContext:
    return RequestContext(
        request_id="req-e2e",
        trace_id="trace-e2e",
        tenant_id=TenantId(tenant),
        user_id="u-1",
        roles=frozenset({"PLATFORM_SUPER_ADMIN"}),
        permissions=frozenset(),
        auth_method=AuthMethod.USER,
    )


class _MockLlmgwClient:
    """Minimal llmgw client stub with a ``chat`` method."""

    def __init__(self, response: str = "llmgw-answer") -> None:
        self._response = response
        self.chat_calls: list[str] = []

    def chat(self, query: str) -> str:
        self.chat_calls.append(query)
        return self._response


def _mock_a2a_http_client(
    response_body: dict | None = None,
    *,
    status_code: int = 200,
) -> MagicMock:
    """Build a mock async HTTP client (duck-typed to httpx.AsyncClient)."""
    mock = MagicMock()
    mock.aclose = AsyncMock(return_value=None)
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = response_body or {"result": {"report": "# Deep Report"}}
    mock_resp.text = "raw"
    mock.post = AsyncMock(return_value=mock_resp)
    return mock


def _invoke_body(query: str = "调研 LLM 在金融行业的应用") -> dict:
    return {
        "capability_id": "web-research",
        "input": {
            "query": query,
            "depth": "deep",
            "max_sources": 5,
            "output_format": "markdown",
        },
    }


# ---------------------------------------------------------------------------
# 1. E2E mock: invoke endpoint → mock DeerFlow → report
# ---------------------------------------------------------------------------
def test_deep_research_e2e_mock(client, auth_headers_acme, stub_client) -> None:
    """Invoke endpoint with mocked DeerFlow returns report + sources + duration_ms."""
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json=_invoke_body(),
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "report" in data
    assert isinstance(data["report"], str) and data["report"]
    assert "sources" in data
    assert isinstance(data["sources"], list) and len(data["sources"]) >= 1
    assert data["duration_ms"] > 0
    # DeerFlow stub was actually called
    assert stub_client.calls, "DeerFlowClient.research should have been called"


# ---------------------------------------------------------------------------
# 2. Short query is NOT deep research
# ---------------------------------------------------------------------------
def test_simple_query_not_triggered() -> None:
    """Short queries do not trigger the deep-research path."""
    assert is_deep_research_query("你好") is False
    assert is_deep_research_query("分析一下") is False


# ---------------------------------------------------------------------------
# 3. Long + keyword query IS deep research
# ---------------------------------------------------------------------------
def test_deep_research_query_triggered() -> None:
    """Long query with a research keyword triggers the deep-research path."""
    query = "请帮我做一个关于人工智能发展趋势的深入研究报告需要涵盖多个方面"
    assert len(query) >= 30
    assert is_deep_research_query(query) is True


# ---------------------------------------------------------------------------
# 4. Dispatcher routes simple query → llmgw (mock)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_complexity_routing_simple() -> None:
    """A simple query is routed to llmgw, not A2A."""
    llmgw = _MockLlmgwClient("simple answer")
    http = _mock_a2a_http_client()

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


# ---------------------------------------------------------------------------
# 5. Dispatcher routes deep query → a2a (mock)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_complexity_routing_deep() -> None:
    """A long research query is routed to A2A, not llmgw."""
    llmgw = _MockLlmgwClient("should-not-be-used")
    http = _mock_a2a_http_client(
        response_body={"result": {"report": "# Deep Research Report"}},
    )

    query = "请帮我做一个关于人工智能发展趋势的深入研究报告需要涵盖多个方面"
    result = await dispatch(
        query=query,
        llmgw_client=llmgw,
        ctx=_ctx(),
        bearer_token="test-token",  # noqa: S106
        http_client=http,
    )

    assert result["source"] == "a2a"
    assert "Deep Research Report" in result["answer"]
    assert llmgw.chat_calls == []
    http.post.assert_called_once()
    call_kwargs = http.post.call_args
    assert call_kwargs.kwargs["json"]["target_agent_id"] == "deep-research"


# ---------------------------------------------------------------------------
# 6. A2A bootstrap registered the deep-research agent card
# ---------------------------------------------------------------------------
def test_agent_card_registered() -> None:
    """register_deerflow_at_startup materialises the deep-research agent card."""
    reset_startup_agents()
    try:
        register_deerflow_at_startup()
        agent = get_startup_agent("deep-research")
        assert agent is not None
        assert agent["id"] == "deep-research"
        caps = agent["capabilities"]
        assert any(c["id"] == "web-research" for c in caps)
    finally:
        reset_startup_agents()


# ---------------------------------------------------------------------------
# 7. Successful invoke emits deep.research.completed outbox event
# ---------------------------------------------------------------------------
def test_outbox_event_on_success(
    client, auth_headers_acme, outbox: InMemoryOutboxWriter,
) -> None:
    """A successful deep-research call appends a deep.research.completed event."""
    r = client.post(
        "/api/v1/a2a/agent/deep-research/invoke",
        json=_invoke_body(query="outbox e2e"),
        headers=auth_headers_acme,
    )
    assert r.status_code == 200, r.text
    events = [rec.event for rec in outbox.all_records()]
    assert len(events) == 1
    assert events[0].type == "deep.research.completed"
    assert events[0].payload["query"] == "outbox e2e"
