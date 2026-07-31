"""mate_app_a2a.repositories — storage layer for A2A entities.

This batch exposes only an in-memory implementation. The `Agent` /
`AgentCapability` / `DelegationTask` / `ExternalAgent` /
`TaskResult` dataclasses are deliberately framework-agnostic so the
upcoming Paimon / Postgres adapter (v3.2) can reuse them without
leaking FastAPI types.
"""
from __future__ import annotations

from . import sql_store
from .in_memory import (
    Agent,
    AgentCapability,
    DelegationTask,
    ExternalAgent,
    TaskResult,
    create_delegation,
    get_agent,
    get_delegation,
    list_agents,
    list_capabilities,
    list_delegations,
    list_external_agents,
    register_external_agent,
    reset_store,
    task_to_dict,
    update_delegation_result,
)

__all__ = [
    "Agent",
    "AgentCapability",
    "DelegationTask",
    "ExternalAgent",
    "TaskResult",
    "create_delegation",
    "get_agent",
    "get_delegation",
    "list_agents",
    "list_capabilities",
    "list_delegations",
    "list_external_agents",
    "register_external_agent",
    "reset_store",
    "sql_store",
    "task_to_dict",
    "update_delegation_result",
]
