"""mate_app_wfe.clients — outbound client for the Flowable engine.

P2-W5 shipped an in-memory BPMN structural validator. P3-W8 adds a
real ``FlowableClient`` that proxies to the Flowable 8.0 REST API when
``FLOWABLE_BASE_URL`` is set, and gracefully degrades to an in-memory
deployment record when the engine is unreachable or unconfigured. The
client uses ``httpx`` directly (the Flowable REST API does not need
service-to-service bearer auth in the local profile; production wiring
adds ``mate_clients.security.BearerAuth`` per ADR-0014 step 4).
"""
from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from typing import Any

import httpx


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
    ) -> None:
        resolved = base_url if base_url is not None else os.environ.get(
            "FLOWABLE_BASE_URL", ""
        )
        self.base_url = (resolved or "").strip().rstrip("/")
        self.timeout = timeout

    @property
    def mode(self) -> str:
        """Return ``flowable`` when a base_url is set, else ``in-memory``."""
        return "flowable" if self.base_url else "in-memory"

    async def deploy(self, name: str, bpmn_xml: str) -> dict[str, Any]:
        """Deploy a BPMN definition to Flowable (with in-memory fallback).

        Returns a dict with ``deployment_id``, ``engine`` and ``status``.
        ``engine`` is ``flowable`` on success, ``in-memory`` when the
        engine is unconfigured or unreachable (graceful degradation).
        """
        if not self.base_url:
            return self._in_memory_deploy()

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as http:
                resp = await http.post(
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
            dep = self._in_memory_deploy()
            dep["status"] = "fallback"
            return dep

        return {
            "deployment_id": str(data.get("id", "")),
            "engine": "flowable",
            "status": "deployed",
        }

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
