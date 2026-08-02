"""Unit tests for the DeerFlowClient (httpx + BearerAuth + check/research).

Uses ``respx`` to mock the httpx transport so no real network call
is made. Covers: success, 401, 503, timeout, check() true/false,
unavailable raises, and bearer header attachment.
"""
from __future__ import annotations

import httpx
import pytest
import respx

from mate_tech_deep_research.api.schemas import ResearchRequest, Source
from mate_tech_deep_research.deerflow.client import (
    DeerFlowClient,
    DeerFlowUnavailableError,
)

BASE = "http://deerflow-engine:8001"


@pytest.mark.asyncio
@respx.mock
async def test_check_returns_true_when_healthy() -> None:
    respx.get(f"{BASE}/healthz").mock(return_value=httpx.Response(200, json={"status": "ok"}))
    client = DeerFlowClient(base_url=BASE, api_key="k")
    try:
        assert await client.check() is True
        assert client._available is True
    finally:
        await client.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_check_returns_false_on_503() -> None:
    respx.get(f"{BASE}/healthz").mock(return_value=httpx.Response(503))
    client = DeerFlowClient(base_url=BASE, api_key="k")
    try:
        assert await client.check() is False
        assert client._available is False
    finally:
        await client.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_check_returns_false_on_connection_error() -> None:
    respx.get(f"{BASE}/healthz").mock(side_effect=httpx.ConnectError("boom"))
    client = DeerFlowClient(base_url=BASE, api_key="k")
    try:
        assert await client.check() is False
        assert client._available is False
    finally:
        await client.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_research_success_returns_response() -> None:
    respx.get(f"{BASE}/healthz").mock(return_value=httpx.Response(200, json={"status": "ok"}))
    respx.post(f"{BASE}/api/research").mock(
        return_value=httpx.Response(
            200,
            json={
                "report": "# title",
                "sources": [
                    {
                        "url": "https://example.com",
                        "title": "ex",
                        "snippet": "s",
                        "reliability": "high",
                        "fetched_at": "2026-08-02T00:00:00Z",
                    }
                ],
                "duration_ms": 42,
            },
        )
    )
    client = DeerFlowClient(base_url=BASE, api_key="k")
    try:
        result = await client.research(ResearchRequest(query="hello"))
        assert result.report == "# title"
        assert result.duration_ms == 42
        assert len(result.sources) == 1
        assert isinstance(result.sources[0], Source)
        assert result.sources[0].url == "https://example.com"
    finally:
        await client.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_research_raises_unavailable_when_check_fails() -> None:
    respx.get(f"{BASE}/healthz").mock(return_value=httpx.Response(503))
    client = DeerFlowClient(base_url=BASE, api_key="k")
    try:
        with pytest.raises(DeerFlowUnavailableError):
            await client.research(ResearchRequest(query="hello"))
    finally:
        await client.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_research_raises_unavailable_on_connection_error() -> None:
    respx.get(f"{BASE}/healthz").mock(side_effect=httpx.ConnectError("no engine"))
    client = DeerFlowClient(base_url=BASE, api_key="k")
    try:
        with pytest.raises(DeerFlowUnavailableError):
            await client.research(ResearchRequest(query="hello"))
    finally:
        await client.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_research_propagates_401_as_status_error() -> None:
    respx.get(f"{BASE}/healthz").mock(return_value=httpx.Response(200, json={"status": "ok"}))
    respx.post(f"{BASE}/api/research").mock(return_value=httpx.Response(401, json={"detail": "no"}))
    client = DeerFlowClient(base_url=BASE, api_key="bad")
    try:
        with pytest.raises(httpx.HTTPStatusError) as exc:
            await client.research(ResearchRequest(query="hello"))
        assert exc.value.response.status_code == 401
    finally:
        await client.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_research_propagates_timeout() -> None:
    respx.get(f"{BASE}/healthz").mock(return_value=httpx.Response(200, json={"status": "ok"}))
    respx.post(f"{BASE}/api/research").mock(side_effect=httpx.ReadTimeout("slow"))
    client = DeerFlowClient(base_url=BASE, api_key="k")
    try:
        with pytest.raises(httpx.ReadTimeout):
            await client.research(ResearchRequest(query="hello"))
    finally:
        await client.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_bearer_header_sent_when_api_key_present() -> None:
    route = respx.get(f"{BASE}/healthz").mock(return_value=httpx.Response(200, json={"status": "ok"}))
    client = DeerFlowClient(base_url=BASE, api_key="secret-key")
    try:
        await client.check()
        assert route.calls.last is not None
        auth = route.calls.last.request.headers.get("authorization", "")
        assert auth == "Bearer secret-key"
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_no_bearer_header_when_api_key_empty() -> None:
    # Build with explicit empty api_key (no env lookup).
    client = DeerFlowClient(base_url=BASE, api_key="")
    try:
        # Internal client should have no Authorization header.
        headers = client._client.headers
        assert "authorization" not in {k.lower() for k in headers.keys()}
    finally:
        await client.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_availability_cached_so_check_not_repeated() -> None:
    health = respx.get(f"{BASE}/healthz").mock(return_value=httpx.Response(200, json={"status": "ok"}))
    research = respx.post(f"{BASE}/api/research").mock(
        return_value=httpx.Response(200, json={"report": "r", "sources": [], "duration_ms": 1})
    )
    client = DeerFlowClient(base_url=BASE, api_key="k")
    try:
        await client.research(ResearchRequest(query="a"))
        await client.research(ResearchRequest(query="b"))
        # /healthz hit exactly once (cached _available=True for the 2nd call).
        assert health.call_count == 1
        assert research.call_count == 2
    finally:
        await client.aclose()
