"""Auto-register DeerFlow as an A2A agent at startup.

The agent card built here is stored in a module-level registry
(``_STARTUP_AGENTS``) so tests can verify the registration without
spinning up a tenant-scoped store. The card follows the same shape
as the ``Agent`` / ``AgentCapability`` dataclasses in
``repositories.in_memory`` — when a real tenant requests the agent,
``register_startup_agent_for_tenant()`` can materialise it into the
tenant store.
"""
from __future__ import annotations

import os
from typing import Any

# ---------------------------------------------------------------------------
# Module-level startup registry
# ---------------------------------------------------------------------------
# Key   = agent_id (str)
# Value = agent card dict (id / name / description / endpoint /
#         auth_type / capabilities)
_STARTUP_AGENTS: dict[str, dict[str, Any]] = {}


def _build_deerflow_agent_card() -> dict[str, Any]:
    """Build the DeerFlow deep-research agent card from env config."""
    base_url = os.environ.get(
        "DEERFLOW_RESEARCH_URL",
        "http://mate-tech-deep-research:8200/api/v1/a2a/agent/deep-research/invoke",
    )
    return {
        "id": "deep-research",
        "name": "深度调研 Agent",
        "description": "多 Agent 协作研究,支持网页搜索 / 文档分析 / 报告生成",
        "endpoint": base_url,
        "auth_type": "bearer",
        "capabilities": [
            {
                "id": "web-research",
                "description": "Web 搜索 + 多源调研",
                "input_schema": {
                    "query": "string",
                    "depth": "shallow|medium|deep",
                    "max_sources": "integer",
                },
                "output_schema": {
                    "report": "string (markdown)",
                    "sources": "array of {url, title, snippet}",
                },
            },
        ],
    }


def register_deerflow_at_startup() -> dict[str, Any]:
    """Auto-register DeerFlow as an A2A agent at startup.

    Stores the agent card in the module-level startup registry.
    Returns the registered agent card dict.
    """
    card = _build_deerflow_agent_card()
    _STARTUP_AGENTS[card["id"]] = card
    return card


def register_deerflow_at_startup_if_enabled() -> bool:
    """Only register if ``DEERFLOW_RESEARCH_ENABLED=true`` (default true).

    Returns ``True`` if the agent was registered, ``False`` if disabled.
    """
    if os.environ.get("DEERFLOW_RESEARCH_ENABLED", "true").lower() == "true":
        register_deerflow_at_startup()
        return True
    return False


# ---------------------------------------------------------------------------
# Read helpers (used by tests and the API layer)
# ---------------------------------------------------------------------------
def get_startup_agents() -> list[dict[str, Any]]:
    """Return all startup-registered agent cards."""
    return list(_STARTUP_AGENTS.values())


def get_startup_agent(agent_id: str) -> dict[str, Any] | None:
    """Return a single startup-registered agent card by id, or None."""
    return _STARTUP_AGENTS.get(agent_id)


def reset_startup_agents() -> None:
    """Clear all startup agents. Used by tests to keep cases isolated."""
    _STARTUP_AGENTS.clear()
