"""mate_app_copilot.a2a.models — data classes for A2A delegation (TD-4).

Implements the data shapes defined in
`docs/active/specs/2026-07-31-prd-a2a-protocol.md` §2.1 (AgentCard)
and §2.2 (A2ATask / DelegationResult). All shapes are deliberately
framework-agnostic so they can be serialized to JSON without leaking
FastAPI types.

The ``DelegationResult.lineage_hints`` dict carries the cross-service
correlation metadata required by ADR-0016 §3.1 + §13 hard rule 9:
``tenant_id`` (mandatory, hard rule 3) + ``correlation_id`` (the
OTel trace_id of the originating request).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any


def _now_iso() -> str:
    """Return the current UTC timestamp as ISO-8601 (stable helper for defaults)."""
    return datetime.now(UTC).isoformat()


@dataclass(frozen=True, slots=True)
class AgentCard:
    """Federated A2A agent card (PRD-A2A §2.1).

    A card is the discoverable identity of an agent — internal
    (mate-platform service) or external (federated OpenAI / Anthropic
    / Dify / etc.). Cards are tenant-scoped: discovery only returns
    cards that belong to the calling tenant (ADR-0014 step 2).
    """

    id: str
    tenant_id: str
    name: str
    description: str
    endpoint: str = ""
    capabilities: tuple[str, ...] = field(default_factory=tuple)
    status: str = "active"
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=_now_iso)


@dataclass(frozen=True, slots=True)
class DelegationRequest:
    """Inbound A2A delegation request (PRD-A2A §2.2 input side).

    Built by the copilot handler from the inbound HTTP body + the
    tenant context. Carries the ``trace_id`` so the
    ``InMemoryA2AClient`` can attach it to the resulting
    ``DelegationResult``.
    """

    target_agent_id: str
    message: str
    context: dict[str, Any] = field(default_factory=dict)
    tenant_id: str = ""
    trace_id: str = ""
    source_agent_id: str = "agent-copilot"


@dataclass(slots=True)
class DelegationResult:
    """Outbound A2A delegation result (PRD-A2A §2.2 output side).

    The ``InMemoryA2AClient`` returns this after (synchronously in
    tests / in-memory mode) executing the delegated task. The
    ``result`` field carries the agent's payload; ``lineage_hints``
    carries the cross-service correlation metadata that survives all
    the way to the audit log.

    Status machine (PRD-A2A §4.2):
        pending → submitted → running → (completed | failed | cancelled | timeout)
    """

    task_id: str
    tenant_id: str
    target_agent_id: str
    status: str  # "completed" | "failed" | "pending"
    result: dict[str, Any] = field(default_factory=dict)
    error_code: str = ""
    error_message: str = ""
    lineage_hints: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=_now_iso)


def new_task_id() -> str:
    """Return a fresh task id with the conventional ``task-`` prefix."""
    return f"task-{uuid.uuid4().hex[:8]}"


def new_agent_id(prefix: str = "agent") -> str:
    """Return a fresh agent id with the given prefix."""
    return f"{prefix}-{uuid.uuid4().hex[:8]}"
