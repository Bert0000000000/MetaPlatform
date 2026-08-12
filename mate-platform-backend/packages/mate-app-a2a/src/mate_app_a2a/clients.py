"""mate_app_a2a.clients — outbound A2A client (official a2a-sdk transport).

W1 (2026-08-12) replaces the P3-W7 hand-rolled HTTP JSON POST with the
official ``a2a-sdk`` client, so outbound delegation speaks the real
A2A 1.0 wire protocol (agent-card discovery + message send + task
artifacts) instead of a bespoke ``{message, context, tenant_id,
trace_id}`` payload. The public ``ExternalAgentClient.call`` interface
is unchanged — the delegator and its tests are unaffected.

The client enforces:
  * Bearer/tenant headers are the handler's job (ADR-0014 step 2 —
    the agent must belong to the calling tenant before any HTTP call).
  * A ``client_factory`` seam so tests can inject a fake A2A client
    without a real network (mirrors the ``set_default_delegator`` DI
    pattern in ``delegate.py``).
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import httpx
import structlog
from a2a.client import ClientConfig, create_client
from a2a.helpers import new_text_message
from a2a.types import Role, SendMessageRequest, TaskState

logger = structlog.get_logger(__name__)

# An async factory ``(endpoint) -> a2a Client``. Injectable for tests.
A2AClientFactory = Callable[[str], Awaitable[Any]]


async def _default_sdk_client_factory(endpoint: str) -> Any:
    """Resolve the agent card at ``endpoint`` and build an A2A client.

    ``create_client(agent=<str>)`` discovers the agent card via
    ``/.well-known/agent.json`` (the standard A2A discovery path), then
    creates a JSON-RPC / REST client per the card's supported
    interfaces. Raises ``httpx`` errors on resolution failure.
    """
    return await create_client(
        agent=endpoint,
        client_config=ClientConfig(streaming=False),
    )


@dataclass(frozen=True)
class AsyncA2AClient:
    """Reserved outbound client for A2A delegation (legacy stub).

    P2-W3: no methods are implemented yet. Superseded by
    ``ExternalAgentClient``.
    """

    base_url: str
    timeout_seconds: float = 5.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")


def _artifact_text(task: Any) -> str:
    """Flatten the text parts of every task artifact."""
    parts: list[str] = []
    for artifact in task.artifacts:
        for part in artifact.parts:
            if getattr(part, "text", ""):
                parts.append(part.text)
    return "\n".join(parts)


def _artifact_payloads(task: Any) -> list[dict[str, Any]]:
    """Serialize task artifacts into JSON-friendly dicts."""
    out: list[dict[str, Any]] = []
    for artifact in task.artifacts:
        entry: dict[str, Any] = {"name": getattr(artifact, "name", ""), "parts": []}
        for part in artifact.parts:
            p: dict[str, Any] = {}
            if getattr(part, "text", ""):
                p["text"] = part.text
            if getattr(part, "filename", ""):
                p["filename"] = part.filename
            if getattr(part, "media_type", ""):
                p["media_type"] = part.media_type
            if p:
                entry["parts"].append(p)
        out.append(entry)
    return out


def _final_task(chunks: list[Any]) -> Any:
    """Return the final Task carried by a StreamResponse chunk."""
    for chunk in reversed(chunks):
        task = getattr(chunk, "task", None)
        if task is not None:
            return task
    raise httpx.HTTPError("no final task in A2A response")


def _state_name(state: Any) -> str:
    """Map the protobuf TaskState enum to a stable name."""
    try:
        return TaskState.Name(state)
    except Exception:
        return str(state)


class ExternalAgentClient:
    """Real outbound A2A client for federated agents (official SDK).

    Wraps the ``a2a-sdk`` client to send a proper A2A 1.0 message to an
    external agent endpoint and extract the agent's final Task
    artifacts. The client is tenant-scoped by the handler: callers must
    resolve the agent card from the tenant's store before invoking
    ``call`` (ADR-0014 step 2).

    Usage::

        client = ExternalAgentClient(timeout=10.0)
        result = await client.call(
            endpoint="https://agent.example.com",
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
        client_factory: A2AClientFactory | None = None,
    ) -> None:
        self._timeout = timeout
        self._headers = headers or {}
        # Per-call A2A client builder (injectable for tests).
        self._client_factory = client_factory or _default_sdk_client_factory

    async def call(
        self,
        *,
        endpoint: str,
        payload: dict[str, Any],
        tenant_id: str = "",
        trace_id: str = "",
    ) -> dict[str, Any]:
        """Send an A2A message to ``endpoint`` and return the result.

        ``payload`` carries the delegation message text under ``message``
        (context is best-effort attached as message metadata). Returns::

            {"text": ..., "artifacts": [...], "task_id": ..., "state": ...}

        Raises ``httpx.TimeoutException`` on timeout and
        ``httpx.HTTPError`` on other failures so the delegator can map
        them to ``timeout`` / ``failed``.
        """
        message_text = str(payload.get("message", "") or "")
        if not message_text:
            raise httpx.HTTPError("a2a message text is empty")

        logger.info(
            "a2a.external.call",
            endpoint=endpoint,
            tenant_id=tenant_id,
            trace_id=trace_id,
        )

        client = None
        try:
            client = await self._client_factory(endpoint)
        except httpx.TimeoutException:
            raise
        except Exception as e:
            raise httpx.HTTPError(
                f"a2a client init failed for {endpoint}: {e}"
            ) from e
        try:
            msg = new_text_message(message_text, role=Role.ROLE_USER)
            context = payload.get("context")
            if isinstance(context, dict) and context:
                try:
                    msg.metadata.update(context)
                except Exception:
                    logger.debug("a2a.external.metadata_skip", endpoint=endpoint)

            chunks: list[Any] = []
            async for chunk in client.send_message(SendMessageRequest(message=msg)):
                chunks.append(chunk)

            task = _final_task(chunks)
            return {
                "text": _artifact_text(task),
                "artifacts": _artifact_payloads(task),
                "task_id": task.id,
                "state": _state_name(task.status.state),
            }
        finally:
            close = getattr(client, "close", None)
            if close is not None:
                await close()

    async def aclose(self) -> None:
        # Each call closes its own A2A client; nothing to release here.
        return None
