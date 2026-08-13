"""mate_app_copilot.clients.orchestrator — copilot → orchestrator dispatch client.

The SuperAI agent loop lets the LLM decide which digital employee to
schedule, then calls the orchestrator's dispatch endpoint. This client is
the single outbound boundary for that call (hard rule 4: no bare httpx in
business code — every call goes through ``OutgoingAuthMiddleware``).

Targets the orchestrator's public HTTP surface:

  GET  /api/v1/orchestrator/roles    — registered digital-employee roles
  POST /api/v1/orchestrator/dispatch — dispatch one task to a role/worker

``base_url`` comes from ``MATE_ORCHESTRATOR_URL`` (default the
docker-compose service name + port). When ``fallback_token`` is given the
caller's inbound user token is passed through (dev mode where the keycloak
client secret is a stub).
"""
from __future__ import annotations

import os
from typing import Any

import httpx

from mate_clients.security.outgoing import OutgoingAuthMiddleware


class OrchestratorClientError(RuntimeError):
    """Raised when an orchestrator call fails (non-2xx / transport)."""


def _default_base_url() -> str:
    return os.getenv("MATE_ORCHESTRATOR_URL", "http://mate-tech-orchestrator:8505").rstrip("/")


class OrchestratorClient:
    """Async client for the orchestrator dispatch / roles surface."""

    def __init__(
        self,
        *,
        base_url: str | None = None,
        auth: Any = None,
        timeout_seconds: float = 30.0,
    ) -> None:
        self._base_url = (base_url or _default_base_url()).rstrip("/")
        self._auth = auth  # BearerAuth (service identity)
        self._timeout = timeout_seconds

    def _middleware(self, tenant_id: str) -> OutgoingAuthMiddleware:
        if self._auth is None:
            raise OrchestratorClientError("auth is required to call the orchestrator")
        return OutgoingAuthMiddleware(self._auth, tenant_id=tenant_id)

    async def list_roles(
        self,
        tenant_id: str,
        fallback_token: str | None = None,
    ) -> list[dict[str, Any]]:
        """GET /api/v1/orchestrator/roles → registered digital-employee roles."""
        headers = {"X-Tenant-Id": tenant_id}
        if fallback_token:
            headers["Authorization"] = f"Bearer {fallback_token}"
        try:
            async with httpx.AsyncClient(
                auth=self._middleware(tenant_id) if not fallback_token else None,
                timeout=self._timeout,
            ) as client:
                resp = await client.get(
                    f"{self._base_url}/api/v1/orchestrator/roles",
                    headers=headers,
                )
        except httpx.HTTPError as exc:
            raise OrchestratorClientError(f"orchestrator roles transport error: {exc}") from exc
        if resp.status_code != 200:
            raise OrchestratorClientError(
                f"orchestrator roles returned {resp.status_code}: {resp.text[:200]}"
            )
        body = resp.json()
        items = body.get("items", []) if isinstance(body, dict) else []
        return [dict(r) for r in items]

    async def dispatch(
        self,
        *,
        tenant_id: str,
        target_rid: str,
        action: str = "",
        arguments: dict[str, Any] | None = None,
        fallback_token: str | None = None,
    ) -> dict[str, Any]:
        """POST /api/v1/orchestrator/dispatch → dispatch a task to a role.

        Response: ``{task_id, role, capability, worker_kind, result, status}``.
        Raises `OrchestratorClientError` on non-2xx (e.g. 404 = role not
        registered).
        """
        payload: dict[str, Any] = {
            "target_rid": target_rid,
            "action": action,
            "arguments": arguments or {},
        }
        headers = {"X-Tenant-Id": tenant_id}
        if fallback_token:
            headers["Authorization"] = f"Bearer {fallback_token}"
        try:
            async with httpx.AsyncClient(
                auth=self._middleware(tenant_id) if not fallback_token else None,
                timeout=self._timeout,
            ) as client:
                resp = await client.post(
                    f"{self._base_url}/api/v1/orchestrator/dispatch",
                    json=payload,
                    headers=headers,
                )
        except httpx.HTTPError as exc:
            raise OrchestratorClientError(f"orchestrator dispatch transport error: {exc}") from exc
        if resp.status_code != 200:
            raise OrchestratorClientError(
                f"orchestrator dispatch returned {resp.status_code}: {resp.text[:200]}"
            )
        return resp.json()
