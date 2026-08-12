"""mate_tech_orchestrator.workers.a2a — A2A-center worker adapter.

Dispatches a task step to the A2A service center by sending a W3C A2A
message (``POST /api/v1/a2a/messages``) via the ACL ``A2AMessagesClient``.
The ``ref`` is the target agent id; it is carried in a data part so the
A2A center's ``/messages`` handler opens a delegation task to it.
"""
from __future__ import annotations

import os
import uuid
from typing import Any

from mate_clients.a2a.messages import A2AMessagesClient

from .identity import build_service_identity


class A2AWorker:
    """Send A2A messages / read tasks at the service center for a tenant."""

    DEFAULT_URL = os.getenv("A2A_URL", "http://localhost:8502")

    def __init__(self, client: A2AMessagesClient | None = None) -> None:
        self._client = client or A2AMessagesClient(
            base_url=self.DEFAULT_URL,
            auth=build_service_identity(),
        )

    async def invoke(
        self,
        *,
        tenant_id: str,
        ref: str,
        arguments: dict[str, Any],
    ) -> Any:
        """Open an A2A delegation task to agent ``ref`` and return the task."""
        self._client.set_tenant(tenant_id)
        message_text = str(arguments.pop("message", "delegated task"))
        envelope: dict[str, Any] = {
            "messageId": f"orch-{uuid.uuid4().hex[:12]}",
            "role": "user",
            "parts": [
                {"kind": "text", "text": message_text},
                {"kind": "data", "data": {"target_agent_id": ref, **arguments}},
            ],
        }
        task = await self._client.post_message(envelope=envelope)
        task["target_agent_id"] = ref
        return task

    async def get_task(self, *, tenant_id: str, task_id: str) -> dict[str, Any]:
        self._client.set_tenant(tenant_id)
        return await self._client.get_task(task_id=task_id)

    async def aclose(self) -> None:
        await self._client.aclose()


_default_worker: A2AWorker | None = None


def get_a2a_worker() -> A2AWorker:
    global _default_worker
    if _default_worker is None:
        _default_worker = A2AWorker()
    return _default_worker


def set_a2a_worker(worker: A2AWorker | None) -> None:
    global _default_worker
    _default_worker = worker
