"""Federation health-check heartbeat (v3.2 W1 — federation 真实化).

``HealthChecker`` periodically probes every active federated server
and flips unreachable ones to ``disabled`` so the
``FederationRegistry`` stops routing tool calls at a dead endpoint
(ADR-0014 — graceful degradation). The checker is platform-scoped: it
walks every tenant's servers because liveness is a property of the
remote endpoint, not of any single tenant.

The background loop (``start``) is a thin ``asyncio`` wrapper around
``check_all``; tests exercise ``check_all`` directly without running
the loop.
"""
from __future__ import annotations

import asyncio
import contextlib
from typing import TYPE_CHECKING

import structlog

if TYPE_CHECKING:
    from . import FederationRegistry
    from .mcp_remote_client import McpRemoteClient

logger = structlog.get_logger(__name__)

# The registry persists the logical "inactive" state as ``disabled``
# (its status vocabulary is active | disabled | deleted).
_INACTIVE_STATUS = "disabled"


class HealthChecker:
    """Periodic health probe for all active federated servers.

    Parameters
    ----------
    registry:
        ``FederationRegistry`` whose active servers are probed.
    remote_client:
        ``McpRemoteClient`` used to call ``GET {endpoint}/health``.
    interval_sec:
        Delay between probes in the background loop (default 60s).
    """

    def __init__(
        self,
        registry: FederationRegistry,
        remote_client: McpRemoteClient,
        interval_sec: int = 60,
    ) -> None:
        self._registry = registry
        self._remote = remote_client
        self.interval_sec = interval_sec
        self._task: asyncio.Task[None] | None = None

    async def check_all(self) -> dict[str, str]:
        """Probe every active server across all tenants.

        Returns ``{server_id: state}`` where ``state`` is the logical
        label ``"active"`` or ``"inactive"``. Unreachable servers are
        persisted to the registry as ``disabled``.
        """
        results: dict[str, str] = {}
        # ``_servers`` maps tenant_id -> {server_id: FederatedServer}.
        # Liveness is platform-scoped, so we walk every tenant.
        for tenant_id, bucket in self._registry._servers.items():
            for server_id, srv in list(bucket.items()):
                if srv.status != "active":
                    results[server_id] = "inactive" if srv.status == "disabled" else srv.status
                    continue
                try:
                    ok = await self._remote.health_check(
                        srv.transport_url, srv.auth_token_ref
                    )
                except Exception as e:
                    logger.warning(
                        "federation.heartbeat.check_failed",
                        server_id=server_id,
                        tenant_id=tenant_id,
                        error=str(e),
                    )
                    ok = False
                if ok:
                    results[server_id] = "active"
                else:
                    results[server_id] = "inactive"
                    self._registry.update_server(
                        tenant_id=tenant_id,
                        server_id=server_id,
                        status=_INACTIVE_STATUS,
                    )
                    logger.warning(
                        "federation.heartbeat.marked_inactive",
                        server_id=server_id,
                        tenant_id=tenant_id,
                        endpoint=srv.transport_url,
                    )
        return results

    async def start(self) -> None:
        """Run ``check_all`` in an endless loop.

        Production wires this into the app lifespan; tests do not run
        the loop — they call :meth:`check_all` directly.
        """
        while True:
            try:
                await self.check_all()
            except Exception as e:
                logger.error("federation.heartbeat.loop_error", error=str(e))
            await asyncio.sleep(self.interval_sec)

    async def stop(self) -> None:
        """Cancel the background loop if one is running."""
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None


__all__ = ["HealthChecker"]
