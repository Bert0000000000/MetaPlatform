"""Real HTTP remote MCP client (v3.2 W1 — federation 真实化).

A thin ``httpx``-based client that talks to a federated MCP server over
its conventional REST surface:

  GET  {endpoint}/tools          — discover the tool catalogue
  POST {endpoint}/tools/{name}   — invoke a tool
  GET  {endpoint}/health         — liveness probe

The client is transport-agnostic: any ``httpx.AsyncClient`` can be
injected (``httpx_client=...``) so tests can substitute a mock without
touching the network. When no client is injected a default
``httpx.AsyncClient`` is lazily created.

Error mapping (ADR-0014 — explicit failure modes instead of a single
``RuntimeError``):

  * HTTP 401            → ``AuthError``
  * HTTP 503 / timeout  → ``RemoteUnavailableError``
  * any other failure   → ``RemoteError``

``health_check`` is the one exception: it returns a plain ``bool`` and
never raises, so the heartbeat loop (``heartbeat.HealthChecker``) can
treat a dead server as a state transition rather than an exception.
"""
from __future__ import annotations

from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)


class FederationClientError(Exception):
    """Base class for remote MCP federation client errors."""


class AuthError(FederationClientError):
    """Remote server rejected the auth token (HTTP 401)."""


class RemoteUnavailableError(FederationClientError):
    """Remote server is unavailable (HTTP 503 / timeout / transport error)."""


class RemoteError(FederationClientError):
    """Generic remote MCP failure (any non-401 / non-503 error)."""


class McpRemoteClient:
    """Real HTTP client for a federated MCP server.

    Parameters
    ----------
    httpx_client:
        Optional ``httpx.AsyncClient`` injected for testing. When
        ``None`` a default client (30s timeout) is created lazily on
        the first call and reused for subsequent calls.
    """

    def __init__(self, httpx_client: httpx.AsyncClient | None = None) -> None:
        self._client = httpx_client

    async def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    @staticmethod
    def _base(endpoint: str) -> str:
        return endpoint.rstrip("/")

    @staticmethod
    def _headers(auth_token: str | None) -> dict[str, str]:
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
        return headers

    def _check_status(
        self, resp: httpx.Response, *, action: str, endpoint: str
    ) -> None:
        """Map a non-2xx response to the right federation exception."""
        if resp.status_code == 401:
            raise AuthError(f"{action} rejected (401) by {endpoint}")
        if resp.status_code == 503:
            raise RemoteUnavailableError(
                f"{action} unavailable (503) at {endpoint}"
            )
        if resp.status_code >= 400:
            raise RemoteError(
                f"{action} failed ({resp.status_code}) at {endpoint}: "
                f"{resp.text[:200]}"
            )

    async def discover_tools(
        self, server_endpoint: str, auth_token: str | None
    ) -> list[dict[str, Any]]:
        """GET ``{endpoint}/tools`` and return the tool catalogue.

        Accepts either a bare JSON list or ``{"tools": [...]}``.
        """
        client = await self._ensure_client()
        url = f"{self._base(server_endpoint)}/tools"
        try:
            resp = await client.get(url, headers=self._headers(auth_token))
        except httpx.TimeoutException as e:
            raise RemoteUnavailableError(
                f"discover_tools timed out at {server_endpoint}: {e}"
            ) from e
        except httpx.RequestError as e:
            raise RemoteUnavailableError(
                f"discover_tools transport error at {server_endpoint}: {e}"
            ) from e
        self._check_status(resp, action="discover_tools", endpoint=server_endpoint)
        data: Any = resp.json()
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and isinstance(data.get("tools"), list):
            return data["tools"]
        return []

    async def invoke_tool(
        self,
        server_endpoint: str,
        auth_token: str | None,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        """POST ``{endpoint}/tools/{name}`` and return the response body."""
        client = await self._ensure_client()
        url = f"{self._base(server_endpoint)}/tools/{tool_name}"
        try:
            resp = await client.post(
                url,
                json={"arguments": arguments},
                headers=self._headers(auth_token),
            )
        except httpx.TimeoutException as e:
            raise RemoteUnavailableError(
                f"invoke_tool {tool_name!r} timed out at {server_endpoint}: {e}"
            ) from e
        except httpx.RequestError as e:
            raise RemoteUnavailableError(
                f"invoke_tool {tool_name!r} transport error at {server_endpoint}: {e}"
            ) from e
        self._check_status(resp, action=f"invoke_tool {tool_name!r}", endpoint=server_endpoint)
        data: Any = resp.json()
        if isinstance(data, dict):
            return data
        # Non-dict bodies are wrapped so the contract (-> dict) holds.
        return {"result": data}

    async def health_check(
        self, server_endpoint: str, auth_token: str | None
    ) -> bool:
        """GET ``{endpoint}/health``; return ``True`` only on HTTP 200.

        Never raises — any transport error or non-200 status maps to
        ``False`` so the heartbeat loop can flip the server to
        inactive without exception handling.
        """
        client = await self._ensure_client()
        url = f"{self._base(server_endpoint)}/health"
        try:
            resp = await client.get(url, headers=self._headers(auth_token))
        except httpx.HTTPError as e:
            logger.warning(
                "federation.health_check.error",
                endpoint=server_endpoint,
                error=str(e),
            )
            return False
        return resp.status_code == 200

    async def aclose(self) -> None:
        """Close the underlying client when we own it."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None


__all__ = [
    "AuthError",
    "FederationClientError",
    "McpRemoteClient",
    "RemoteError",
    "RemoteUnavailableError",
]
