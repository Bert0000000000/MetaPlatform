"""mate_app_copilot.a2a.registry — in-memory, tenant-scoped AgentCard registry (TD-4).

Stores AgentCards keyed by ``tenant_id → agent_id``. The registry is
the in-process equivalent of the A2A service's ``agent_cards`` table
(PRD-A2A §3.1): it supports register / discover /
filter_by_capability / get.

Tenant isolation is enforced at this layer (ADR-0014 step 2): every
method takes a tenant_id and refuses to return cards belonging to a
different tenant. Empty tenant_id returns empty results — the same
behaviour as ``mate_app_a2a.repositories.in_memory``.
"""
from __future__ import annotations

from typing import Any

from .models import AgentCard, new_agent_id


class AgentCardRegistry:
    """In-memory, tenant-scoped registry of AgentCards.

    Seed data: 3 external agents per tenant (mirroring the catalog
    in ``mate_app_a2a.repositories.in_memory._seed_external``):

        - ext-openai-assistant  (code-interpreter, retrieval, function-call)
        - ext-anthropic-claude  (reasoning, tool-use, long-context)
        - ext-dify-workflow     (workflow-run, chat, knowledge-retrieval)
    """

    def __init__(self) -> None:
        self._cards: dict[str, dict[str, AgentCard]] = {}

    # ------------------------------------------------------------------
    # tenant helpers
    # ------------------------------------------------------------------
    def _ensure_tenant(self, tenant_id: str) -> None:
        """Idempotently seed the default external agents for a tenant."""
        if not tenant_id:
            return
        if tenant_id not in self._cards:
            self._cards[tenant_id] = self._seed(tenant_id)

    @staticmethod
    def _seed(tenant_id: str) -> dict[str, AgentCard]:
        catalog: list[tuple[str, str, str, str, tuple[str, ...]]] = [
            (
                "ext-openai-assistant",
                "OpenAI Assistant",
                "OpenAI Assistants API federated agent",
                "https://api.openai.com/v1/assistants",
                ("code-interpreter", "retrieval", "function-call"),
            ),
            (
                "ext-anthropic-claude",
                "Anthropic Claude",
                "Anthropic Messages API federated agent",
                "https://api.anthropic.com/v1/messages",
                ("reasoning", "tool-use", "long-context"),
            ),
            (
                "ext-dify-workflow",
                "Dify Workflow",
                "Dify Workflow API federated agent",
                "https://api.dify.ai/v1/workflows",
                ("workflow-run", "chat", "knowledge-retrieval"),
            ),
        ]
        return {
            aid: AgentCard(
                id=aid,
                tenant_id=tenant_id,
                name=name,
                description=desc,
                endpoint=endpoint,
                capabilities=caps,
            )
            for aid, name, desc, endpoint, caps in catalog
        }

    # ------------------------------------------------------------------
    # public read API
    # ------------------------------------------------------------------
    def discover(self, tenant_id: str) -> list[AgentCard]:
        """Return all cards for a tenant, sorted by id."""
        if not tenant_id:
            return []
        self._ensure_tenant(tenant_id)
        return sorted(self._cards[tenant_id].values(), key=lambda c: c.id)

    def filter_by_capability(
        self, tenant_id: str, capability: str
    ) -> list[AgentCard]:
        """Return cards whose capabilities tuple contains ``capability``.

        Matching is case-insensitive. An empty ``capability`` returns
        an empty list (no filter means no match).
        """
        if not tenant_id or not capability:
            return []
        self._ensure_tenant(tenant_id)
        cap_lower = capability.lower()
        return [
            c
            for c in self._cards[tenant_id].values()
            if any(cap_lower == cap.lower() for cap in c.capabilities)
        ]

    def get(self, tenant_id: str, agent_id: str) -> AgentCard | None:
        """Return a single card by id, or None if not found / wrong tenant."""
        if not tenant_id:
            return None
        self._ensure_tenant(tenant_id)
        return self._cards[tenant_id].get(agent_id)

    # ------------------------------------------------------------------
    # public write API
    # ------------------------------------------------------------------
    def register(self, card: AgentCard) -> AgentCard:
        """Register a new card (or overwrite an existing one by id)."""
        self._ensure_tenant(card.tenant_id)
        self._cards[card.tenant_id][card.id] = card
        return card

    def register_external(
        self,
        tenant_id: str,
        name: str,
        endpoint: str,
        capabilities: list[str],
        description: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> AgentCard:
        """Convenience builder for external agents."""
        self._ensure_tenant(tenant_id)
        agent_id = new_agent_id("ext")
        card = AgentCard(
            id=agent_id,
            tenant_id=tenant_id,
            name=name,
            description=description or f"External agent {name}",
            endpoint=endpoint,
            capabilities=tuple(capabilities),
            metadata=dict(metadata) if metadata else {},
        )
        self._cards[tenant_id][agent_id] = card
        return card

    # ------------------------------------------------------------------
    # test helpers — DO NOT call from production code paths
    # ------------------------------------------------------------------
    def reset(self) -> None:
        """Drop all seeded data. Used by tests to keep cases isolated."""
        self._cards.clear()
