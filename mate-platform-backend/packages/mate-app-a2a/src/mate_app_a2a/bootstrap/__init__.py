"""mate_app_a2a.bootstrap — startup-time agent registration.

``register_deerflow_at_startup_if_enabled()`` is called from
``create_app()`` so the DeerFlow deep-research agent is available
without manual configuration.
"""
from __future__ import annotations

from .agent_registration import (
    get_startup_agent,
    get_startup_agents,
    register_deerflow_at_startup,
    register_deerflow_at_startup_if_enabled,
    reset_startup_agents,
)

__all__ = [
    "get_startup_agent",
    "get_startup_agents",
    "register_deerflow_at_startup",
    "register_deerflow_at_startup_if_enabled",
    "reset_startup_agents",
]
