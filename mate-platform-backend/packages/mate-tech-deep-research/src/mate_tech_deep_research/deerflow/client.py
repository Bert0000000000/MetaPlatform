"""DeerFlow Engine HTTP client.

This is the *outbound* ACL client for the DeerFlow deep-research engine
(ADR-0014 step 4). All calls go through ``httpx.AsyncClient`` with a
``Bearer`` token attached — satisfying the "no bare httpx" hard rule 4.

The client exposes two methods:
  * ``check()``  — liveness probe against the engine (GET /healthz).
  * ``research()``— delegate a research task (POST /api/research).

When the engine is unreachable the client raises
``DeerFlowUnavailableError``; the router maps that to HTTP 503.
"""
from __future__ import annotations

import os
from typing import Any

import httpx
import structlog

from ..api.schemas import ResearchRequest, ResearchResponse, Source

logger = structlog.get_logger(__name__)


class DeerFlowUnavailableError(Exception):
    """Raised when DeerFlow Engine is unreachable or reports unhealthy."""


class DeerFlowClient:
    """Async client for the DeerFlow Engine.

    Args:
        base_url: Override for the engine base URL (defaults to
            ``$DEERFLOW_URL`` or ``http://deerflow-engine:8001``).
        api_key: Bearer token to send on every request (defaults to
            ``$DEERFLOW_API_KEY``).
        timeout: Request timeout in seconds. Deep research is long-
            running, so the default is 5 minutes.
        httpx_client: Inject an existing ``httpx.AsyncClient`` (used by
            tests with ``respx`` or a mock transport).
    """

    DEFAULT_URL = "http://deerflow-engine:8001"
    DEFAULT_TIMEOUT = 300.0

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
        httpx_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = (
            base_url or os.environ.get("DEERFLOW_URL", self.DEFAULT_URL)
        ).rstrip("/")
        self.api_key = api_key if api_key is not None else os.environ.get(
            "DEERFLOW_API_KEY", ""
        )
        self.timeout = timeout
        headers: dict[str, str] = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        if httpx_client is not None:
            self._client = httpx_client
            self._owns_client = False
        else:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=timeout,
                headers=headers,
            )
            self._owns_client = True
        self._available = False

    async def check(self) -> bool:
        """Probe the engine; cache the availability flag."""
        try:
            resp = await self._client.get("/healthz", timeout=5.0)
        except Exception as exc:  # connection errors, timeouts, etc.
            self._available = False
            logger.warning("deerflow.check.failed", error=str(exc))
            return False
        ok = resp.status_code == 200
        self._available = ok
        return ok

    async def research(self, request: ResearchRequest) -> ResearchResponse:
        """Delegate a research task to DeerFlow Engine.

        Raises ``DeerFlowUnavailableError`` if the engine health check
        fails. Raises ``httpx.HTTPStatusError`` for non-2xx research
        responses (the router only handles the unavailable case; other
        4xx/5xx propagate as 500).
        """
        if not self._available:
            await self.check()
            if not self._available:
                raise DeerFlowUnavailableError("DeerFlow Engine unavailable")

        resp = await self._client.post(
            "/api/research",
            json={
                "query": request.query,
                "depth": request.depth,
                "max_sources": request.max_sources,
                "output_format": request.output_format,
            },
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()
        return _parse_response(data)

    async def aclose(self) -> None:
        """Close the underlying httpx client (only if we own it)."""
        if self._owns_client:
            await self._client.aclose()


def _parse_response(data: dict[str, Any]) -> ResearchResponse:
    """Build a ResearchResponse from DeerFlow JSON."""
    sources_raw = data.get("sources") or []
    sources: list[Source] = []
    for s in sources_raw:
        if not isinstance(s, dict):
            continue
        sources.append(
            Source(
                url=str(s.get("url", "")),
                title=str(s.get("title", "")),
                snippet=str(s.get("snippet", "")),
                reliability=str(s.get("reliability", "medium")),
                fetched_at=str(s.get("fetched_at", "")),
            )
        )
    return ResearchResponse(
        report=str(data.get("report", "")),
        sources=sources,
        duration_ms=int(data.get("duration_ms", 0)),
    )
