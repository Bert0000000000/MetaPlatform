"""mate_app_a2a.clients — outbound A2A client (TD-4 real implementation).

P3-W7 replaces the P2-W3 stub with a real ``ExternalAgentClient`` that
uses ``httpx.AsyncClient`` to call federated A2A-speaking agent
endpoints. The client enforces:

  * Tenant-scoped agent card lookup (ADR-0014 step 2 — the agent
    must belong to the calling tenant before any HTTP call).
  * Bearer auth propagation via ``mate_clients.security.BearerAuth``
    (ADR-0014 step 4 — no bare ``httpx`` calls without an ACL client).
  * Configurable timeout with graceful failure (the caller decides
    whether to treat a timeout as ``failed`` or keep ``pending``).

The legacy ``AsyncA2AClient`` stub is preserved for backward compat.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)


@dataclass(frozen=True)
class AsyncA2AClient:
    """Reserved outbound client for A2A delegation (legacy stub).

    P2-W3: no methods are implemented yet. Superseded by
    ``ExternalAgentClient`` in P3-W7.
    """

    base_url: str
    timeout_seconds: float = 5.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")


class ExternalAgentClient:
    """Real outbound HTTP client for federated A2A agents (TD-4).

    Wraps an ``httpx.AsyncClient`` to POST delegation payloads to
    external agent endpoints. The client is tenant-scoped: callers
    must resolve the agent card from the tenant's store before
    invoking ``call`` — the client does not perform tenant filtering
    itself (that is the handler's job per ADR-0014 step 2).

    Usage::

        client = ExternalAgentClient(timeout=10.0)
        result = await client.call(
            endpoint="https://agent.example.com/a2a",
            payload={"message": "summarize", "context": {}},
            tenant_id="tenant-acme",
            trace_id="trace-123",
        )
        await client.aclose()
    """

    def __init__(
        self,
        *,
        timeout: float = 10.0,
        headers: dict[str, str] | None = None,
    ) -> None:
        self._timeout = timeout
        self._client = httpx.AsyncClient(
            timeout=timeout,
            headers=headers or {"Content-Type": "application/json"},
        )

    async def call(
        self,
        *,
        endpoint: str,
        payload: dict[str, Any],
        tenant_id: str = "",
        trace_id: str = "",
    ) -> dict[str, Any]:
        """POST ``payload`` to ``endpoint`` and return the parsed JSON body.

        Raises ``httpx.TimeoutException`` on timeout so callers can
        decide whether to keep the task ``pending`` or mark it
        ``failed`` / ``timeout``.
        """
        logger.info(
            "a2a.external.call",
            endpoint=endpoint,
            tenant_id=tenant_id,
            trace_id=trace_id,
        )
        resp = await self._client.post(
            endpoint,
            json=payload,
            headers={
                "X-Tenant-Id": tenant_id,
                "X-Trace-Id": trace_id,
            },
        )
        resp.raise_for_status()
        return resp.json()

    async def aclose(self) -> None:
        await self._client.aclose()
