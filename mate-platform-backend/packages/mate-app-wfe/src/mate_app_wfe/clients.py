"""mate_app_wfe.clients — outbound client for the Flowable engine.

P2-W5 shipped an in-memory BPMN structural validator. P3-W8 adds a
real ``FlowableClient`` that proxies to the Flowable 8.0 REST API when
``FLOWABLE_BASE_URL`` is set, and gracefully degrades to an in-memory
deployment record when the engine is unreachable or unconfigured.

ACL (ADR-0014 step 4 / 13 硬规则 #4):
  - ``BearerAuth``: client_credentials token cache.
  - ``OutgoingAuthMiddleware``: injects Authorization + X-Tenant-Id.

The client constructor takes an optional ``auth`` (BearerAuth) and
``tenant_id`` so the caller can scope calls to a specific tenant.
In the FastAPI handler the auth is read from ``app.state.bearer_auth``
and the tenant_id from ``request.state.ctx.tenant_id`` (set by the
auth middleware).
"""
from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from typing import Any

import httpx

from mate_clients.security import BearerAuth, OutgoingAuthMiddleware
from mate_platform.runtime import is_production_profile, require_real_dependency


class FlowableClient:
    """Outbound client for the Flowable 8.0 BPMN engine.

    Configuration:
        base_url: Flowable REST root. Defaults to the
            ``FLOWABLE_BASE_URL`` env var. When empty the client runs
            in ``in-memory`` mode (no network calls).

    Behaviour:
        * ``mode`` is ``"flowable"`` when a base_url is configured,
          otherwise ``"in-memory"``.
        * ``deploy()`` POSTs the BPMN to Flowable's deployment endpoint.
          On any transport/HTTP error it falls back to an in-memory
          synthetic deployment so the caller can still record the flow.
    """

    def __init__(
        self,
        base_url: str | None = None,
        *,
        timeout: float = 5.0,
        auth: BearerAuth | None = None,
        tenant_id: str = "",
    ) -> None:
        resolved = base_url if base_url is not None else os.environ.get(
            "FLOWABLE_BASE_URL", ""
        )
        self.base_url = (resolved or "").strip().rstrip("/")
        require_real_dependency("Flowable", bool(self.base_url))
        self.timeout = timeout
        # Build the AsyncClient once; attach OutgoingAuthMiddleware so
        # every outbound call carries Authorization + X-Tenant-Id.
        self._client = httpx.AsyncClient(timeout=timeout)
        if auth is not None and tenant_id:
            self._client.auth = OutgoingAuthMiddleware(auth, tenant_id=tenant_id)
        self._auth = auth
        self._tenant_id = tenant_id

    @property
    def mode(self) -> str:
        """Return ``flowable`` when a base_url is set, else ``in-memory``."""
        return "flowable" if self.base_url else "in-memory"

    def set_tenant(self, tenant_id: str) -> None:
        """Re-bind the client to a different tenant."""
        self._tenant_id = tenant_id
        if self._auth is not None and tenant_id:
            self._client.auth = OutgoingAuthMiddleware(self._auth, tenant_id=tenant_id)

    async def deploy(self, name: str, bpmn_xml: str) -> dict[str, Any]:
        """Deploy a BPMN definition to Flowable (with in-memory fallback).

        Returns a dict with ``deployment_id``, ``engine`` and ``status``.
        ``engine`` is ``flowable`` on success, ``in-memory`` when the
        engine is unconfigured or unreachable (graceful degradation).
        """
        if not self.base_url:
            if is_production_profile():
                raise RuntimeError(
                    "Flowable is unavailable in production; "
                    "in-memory deployment is disabled"
                )
            return self._in_memory_deploy()

        try:
            resp = await self._client.post(
                f"{self.base_url}/process-engine/repository/deployments",
                data={"name": name},
                files={
                    "file": (
                        f"{name}.bpmn20.xml",
                        bpmn_xml.encode("utf-8"),
                        "application/xml",
                    )
                },
            )
            resp.raise_for_status()
            data = resp.json()
        except (httpx.HTTPError, OSError, ValueError):
            # Engine unreachable / bad response -> degrade to in-memory.
            if is_production_profile():
                raise RuntimeError(
                    "Flowable is unavailable in production; "
                    "in-memory deployment is disabled"
                ) from None
            dep = self._in_memory_deploy()
            dep["status"] = "fallback"
            return dep

        return {
            "deployment_id": str(data.get("id", "")),
            "engine": "flowable",
            "status": "deployed",
        }

    async def aclose(self) -> None:
        """Close the underlying httpx client."""
        await self._client.aclose()

    @staticmethod
    def _in_memory_deploy() -> dict[str, Any]:
        return {
            "deployment_id": f"inmem-{uuid.uuid4().hex[:8]}",
            "engine": "in-memory",
            "status": "deployed",
        }


@dataclass(frozen=True)
class AsyncFlowableClient:
    """Reserved outbound client for the Flowable 8.0 engine.

    P2-W5: no methods are implemented yet. P2-W6 adds
    `test_flow(bpmn_xml)` / `validate_flow(bpmn_xml)` calls that
    proxy to the Flowable REST API once it is wired into
    docker-compose.
    """

    base_url: str
    timeout_seconds: float = 10.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
