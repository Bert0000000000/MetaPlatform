"""In-memory repositories for MCP management entities (联调 integration).

Entities: AgentTrust, ExternalAgent, Policy, plus a connection-monitor view.
Follows the same tenant-scoped store pattern as clients_repo.py.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


@dataclass(frozen=True)
class AgentTrust:
    id: str
    tenant_id: str
    agent_id: str
    agent_name: str = ""
    trust_level: str = "TRUSTED"
    reason: str = ""
    allowed_operations: str = ""
    expires_at: str = ""
    created_at: str = ""
    updated_at: str = ""


@dataclass(frozen=True)
class ExternalAgent:
    id: str
    tenant_id: str
    name: str
    description: str = ""
    endpoint: str = ""
    protocol_type: str = "MCP"
    status: str = "ACTIVE"
    trust_level: str = "UNTRUSTED"
    auth_type: str = "none"
    auth_config: str = ""
    capabilities: str = ""
    last_connected_at: str = ""
    last_error_message: str = ""
    created_at: str = ""
    updated_at: str = ""


@dataclass(frozen=True)
class Policy:
    id: str
    tenant_id: str
    name: str
    subject_type: str = "agent"
    subject_id: str = ""
    resource_type: str = "tool"
    resource_ids: tuple[str, ...] = ()
    action: str = "call"
    effect: str = "ALLOW"
    condition_expression: str = ""
    effective_start_at: str = ""
    effective_end_at: str = ""
    priority: int = 0
    enabled: bool = True
    created_at: str = ""
    updated_at: str = ""


_TRUSTS: dict[str, dict[str, AgentTrust]] = {}
_AGENTS: dict[str, dict[str, ExternalAgent]] = {}
_POLICIES: dict[str, dict[str, Policy]] = {}


def list_trusts(tenant_id: str) -> list[AgentTrust]:
    if not tenant_id:
        return []
    return sorted(_TRUSTS.get(tenant_id, {}).values(), key=lambda t: t.created_at, reverse=True)


def get_trust(tenant_id: str, tid: str) -> AgentTrust | None:
    return _TRUSTS.get(tenant_id, {}).get(tid)


def put_trust(tenant_id: str, trust: AgentTrust) -> AgentTrust:
    _TRUSTS.setdefault(tenant_id, {})[trust.id] = trust
    return trust


def delete_trust(tenant_id: str, tid: str) -> bool:
    store = _TRUSTS.get(tenant_id)
    if not store or tid not in store:
        return False
    del store[tid]
    return True


def list_external_agents(tenant_id: str) -> list[ExternalAgent]:
    if not tenant_id:
        return []
    return sorted(_AGENTS.get(tenant_id, {}).values(), key=lambda a: a.created_at, reverse=True)


def get_external_agent(tenant_id: str, aid: str) -> ExternalAgent | None:
    return _AGENTS.get(tenant_id, {}).get(aid)


def put_external_agent(tenant_id: str, agent: ExternalAgent) -> ExternalAgent:
    _AGENTS.setdefault(tenant_id, {})[agent.id] = agent
    return agent


def delete_external_agent(tenant_id: str, aid: str) -> bool:
    store = _AGENTS.get(tenant_id)
    if not store or aid not in store:
        return False
    del store[aid]
    return True


def list_policies(tenant_id: str) -> list[Policy]:
    if not tenant_id:
        return []
    return sorted(_POLICIES.get(tenant_id, {}).values(), key=lambda p: (-p.priority, p.created_at))


def get_policy(tenant_id: str, pid: str) -> Policy | None:
    return _POLICIES.get(tenant_id, {}).get(pid)


def put_policy(tenant_id: str, policy: Policy) -> Policy:
    _POLICIES.setdefault(tenant_id, {})[policy.id] = policy
    return policy


def delete_policy(tenant_id: str, pid: str) -> bool:
    store = _POLICIES.get(tenant_id)
    if not store or pid not in store:
        return False
    del store[pid]
    return True


def reset_management_store() -> None:
    _TRUSTS.clear()
    _AGENTS.clear()
    _POLICIES.clear()
