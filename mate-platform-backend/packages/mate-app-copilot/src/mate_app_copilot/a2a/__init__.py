"""mate_app_copilot.a2a — A2A delegation + agent-card discovery (TD-4).

Replaces the P2-W3 in-process proxy to ``mate_app_a2a.repositories``
with a local ``InMemoryA2AClient`` + ``AgentCardRegistry`` so the
copilot handler can delegate tasks and discover external agent cards
without crossing a process boundary.

The shapes follow `docs/active/specs/2026-07-31-prd-a2a-protocol.md`
§2.1 (AgentCard) and §2.2 (A2ATask / DelegationResult). The
``DelegationResult.lineage_hints`` dict carries the cross-service
correlation metadata required by ADR-0016 §3.1 + §13 hard rule 9.
"""
from __future__ import annotations

from .client import A2AClient, InMemoryA2AClient, get_default_client, reset_default_client
from .models import AgentCard, DelegationRequest, DelegationResult, new_agent_id, new_task_id
from .registry import AgentCardRegistry

__all__ = [
    "A2AClient",
    "AgentCard",
    "AgentCardRegistry",
    "DelegationRequest",
    "DelegationResult",
    "InMemoryA2AClient",
    "get_default_client",
    "new_agent_id",
    "new_task_id",
    "reset_default_client",
]
