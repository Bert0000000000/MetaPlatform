"""In-memory repository for the A2A protocol center (P2-W3 batch).

Data shape:
    _AGENTS / _CAPABILITIES / _EXTERNAL / _TASKS:
        outer key = tenant_id (string)
        inner key = entity_id (string)
        value    = entity dataclass

The store is intentionally tenant-scoped: callers MUST pass the
tenant binding (`ctx.tenant_id`) and the lookup rejects entities
that don't belong to that tenant. This is the layer at which the
ADR-0014 cross-tenant rule is enforced.

Seed data:
    >= 5 agents, >= 8 capabilities, >= 3 external agents,
    >= 5 delegation tasks per tenant. Tests rely on these minima;
    bumping them is allowed but tests assert `>= N` rather than
    equality.

The `DelegationTask` is mutable (not frozen) so that
`update_delegation_result` can patch the status / result fields
in place.
"""
from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class Agent:
    id: str
    tenant_id: str
    name: str
    description: str
    endpoint: str = ""
    status: str = "active"


@dataclass(frozen=True)
class AgentCapability:
    id: str
    tenant_id: str
    agent_id: str
    name: str
    description: str
    input_schema: dict[str, Any] = field(default_factory=dict)
    output_schema: dict[str, Any] = field(default_factory=dict)


@dataclass
class DelegationTask:
    """Mutable: update_delegation_result patches status / result."""

    id: str
    tenant_id: str
    target_agent_id: str
    message: str
    context: dict[str, Any]
    status: str = "pending"
    result: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""


@dataclass(frozen=True)
class ExternalAgent:
    id: str
    tenant_id: str
    name: str
    endpoint: str
    capabilities: tuple[str, ...] = field(default_factory=tuple)
    status: str = "registered"


@dataclass(frozen=True)
class TaskResult:
    task_id: str
    tenant_id: str
    result: dict[str, Any]
    status: str


# ---------------------------------------------------------------------------
# Seed builders
# ---------------------------------------------------------------------------
def _seed_agents(tenant_id: str) -> dict[str, Agent]:
    catalog: list[tuple[str, str, str]] = [
        ("agent-copilot", "Copilot Agent", "AI business assistant for platform users"),
        ("agent-recon", "Finance Recon Bot", "Automated financial reconciliation"),
        ("agent-curator", "KB Curator", "Knowledge-base indexing and curation"),
        ("agent-archivist", "CRM Archivist", "CRM data archival and cleanup"),
        ("agent-scheduler", "Scheduling Agent", "Task scheduling and employee matching"),
        ("agent-analyst", "Data Analyst", "Data warehouse query and analysis"),
    ]
    return {
        aid: Agent(
            id=aid,
            tenant_id=tenant_id,
            name=name,
            description=desc,
            endpoint=f"a2a://{aid}",
        )
        for aid, name, desc in catalog
    }


def _seed_capabilities(tenant_id: str) -> dict[str, AgentCapability]:
    catalog: list[tuple[str, str, str, str]] = [
        ("cap-search", "agent-copilot", "search", "Semantic search across knowledge bases"),
        ("cap-summarize", "agent-copilot", "summarize", "Summarize documents and conversations"),
        ("cap-reconcile", "agent-recon", "reconcile", "Reconcile financial transactions"),
        ("cap-report", "agent-recon", "report", "Generate reconciliation reports"),
        ("cap-index", "agent-curator", "index", "Index documents into the knowledge base"),
        ("cap-archive", "agent-archivist", "archive", "Archive stale CRM records"),
        ("cap-schedule", "agent-scheduler", "schedule", "Match employees to tasks"),
        ("cap-query", "agent-analyst", "query", "Execute analytical SQL queries"),
        ("cap-visualize", "agent-analyst", "visualize", "Generate charts from query results"),
    ]
    return {
        cid: AgentCapability(
            id=cid,
            tenant_id=tenant_id,
            agent_id=agent_id,
            name=name,
            description=desc,
        )
        for cid, agent_id, name, desc in catalog
    }


def _seed_external(tenant_id: str) -> dict[str, ExternalAgent]:
    catalog: list[tuple[str, str, str, tuple[str, ...]]] = [
        (
            "ext-openai-assistant",
            "OpenAI Assistant",
            "https://api.openai.com/v1/assistants",
            ("code-interpreter", "retrieval", "function-call"),
        ),
        (
            "ext-anthropic-claude",
            "Anthropic Claude",
            "https://api.anthropic.com/v1/messages",
            ("reasoning", "tool-use", "long-context"),
        ),
        (
            "ext-dify-workflow",
            "Dify Workflow",
            "https://api.dify.ai/v1/workflows",
            ("workflow-run", "chat", "knowledge-retrieval"),
        ),
    ]
    return {
        eid: ExternalAgent(
            id=eid,
            tenant_id=tenant_id,
            name=name,
            endpoint=endpoint,
            capabilities=caps,
        )
        for eid, name, endpoint, caps in catalog
    }


def _seed_tasks(tenant_id: str) -> dict[str, DelegationTask]:
    catalog: list[tuple[str, str, str]] = [
        ("task-001", "agent-recon", "Reconcile Q3 ledger entries"),
        ("task-002", "agent-curator", "Re-index product docs after schema change"),
        ("task-003", "agent-analyst", "Build revenue trend dashboard"),
        ("task-004", "agent-copilot", "Summarize weekly standup notes"),
        ("task-005", "agent-scheduler", "Assign on-call rotation for next sprint"),
    ]
    return {
        tid: DelegationTask(
            id=tid,
            tenant_id=tenant_id,
            target_agent_id=agent_id,
            message=msg,
            context={},
        )
        for tid, agent_id, msg in catalog
    }


# ---------------------------------------------------------------------------
# Tenant-scoped stores
# ---------------------------------------------------------------------------
_AGENTS: dict[str, dict[str, Agent]] = {}
_CAPABILITIES: dict[str, dict[str, AgentCapability]] = {}
_EXTERNAL: dict[str, dict[str, ExternalAgent]] = {}
_TASKS: dict[str, dict[str, DelegationTask]] = {}


def _ensure_tenant(tenant_id: str) -> None:
    """Idempotently seed the store for a given tenant."""
    if not tenant_id:
        return  # anonymous lookups return empty, see list_*() functions
    if tenant_id not in _AGENTS:
        _AGENTS[tenant_id] = _seed_agents(tenant_id)
    if tenant_id not in _CAPABILITIES:
        _CAPABILITIES[tenant_id] = _seed_capabilities(tenant_id)
    if tenant_id not in _EXTERNAL:
        _EXTERNAL[tenant_id] = _seed_external(tenant_id)
    if tenant_id not in _TASKS:
        _TASKS[tenant_id] = _seed_tasks(tenant_id)


# ---------------------------------------------------------------------------
# Public read API
# ---------------------------------------------------------------------------
def list_agents(tenant_id: str) -> list[Agent]:
    """Return the registered agents for a tenant."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_AGENTS[tenant_id].values(), key=lambda a: a.id)


def get_agent(tenant_id: str, agent_id: str) -> Agent | None:
    """Return a single agent by id, or None if not found."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _AGENTS[tenant_id].get(agent_id)


def list_capabilities(tenant_id: str, agent_id: str | None = None) -> list[AgentCapability]:
    """Return capabilities for a tenant, optionally filtered by agent."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    caps = list(_CAPABILITIES[tenant_id].values())
    if agent_id:
        caps = [c for c in caps if c.agent_id == agent_id]
    return sorted(caps, key=lambda c: c.id)


def list_external_agents(tenant_id: str) -> list[ExternalAgent]:
    """Return the external (federated) agents for a tenant."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_EXTERNAL[tenant_id].values(), key=lambda e: e.id)


def list_delegations(tenant_id: str) -> list[DelegationTask]:
    """Return the delegation tasks for a tenant."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_TASKS[tenant_id].values(), key=lambda t: t.id)


def get_delegation(tenant_id: str, task_id: str) -> DelegationTask | None:
    """Return a single delegation task by id, or None if not found."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _TASKS[tenant_id].get(task_id)


# ---------------------------------------------------------------------------
# Public write API
# ---------------------------------------------------------------------------
def create_delegation(
    tenant_id: str,
    target_agent_id: str,
    message: str,
    context: dict[str, Any],
) -> DelegationTask:
    """Create a new delegation task and store it."""
    _ensure_tenant(tenant_id)
    task_id = f"task-{uuid.uuid4().hex[:8]}"
    task = DelegationTask(
        id=task_id,
        tenant_id=tenant_id,
        target_agent_id=target_agent_id,
        message=message,
        context=dict(context),
        status="pending",
    )
    _TASKS[tenant_id][task_id] = task
    return task


def update_delegation_result(
    tenant_id: str,
    task_id: str,
    result: dict[str, Any],
    status: str,
) -> DelegationTask | None:
    """Patch the status / result of an existing delegation task."""
    _ensure_tenant(tenant_id)
    task = _TASKS[tenant_id].get(task_id)
    if task is None:
        return None
    task.result = dict(result)
    task.status = status
    return task


def register_external_agent(
    tenant_id: str,
    name: str,
    endpoint: str,
    capabilities: list[str],
) -> ExternalAgent:
    """Register a new external (federated) agent."""
    _ensure_tenant(tenant_id)
    agent_id = f"ext-{uuid.uuid4().hex[:8]}"
    agent = ExternalAgent(
        id=agent_id,
        tenant_id=tenant_id,
        name=name,
        endpoint=endpoint,
        capabilities=tuple(capabilities),
    )
    _EXTERNAL[tenant_id][agent_id] = agent
    return agent


def task_to_dict(task: DelegationTask) -> dict[str, Any]:
    """Serialize a DelegationTask to a JSON-friendly dict."""
    return asdict(task)


# ---------------------------------------------------------------------------
# Test helpers — DO NOT call from production code paths
# ---------------------------------------------------------------------------
def reset_store() -> None:
    """Drop all seeded data. Used by tests to keep cases isolated."""
    _AGENTS.clear()
    _CAPABILITIES.clear()
    _EXTERNAL.clear()
    _TASKS.clear()
