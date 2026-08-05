"""Agent installer — [blocked-on: MP-AGENT-REGISTER-01]。"""
from __future__ import annotations

from ._base import BaseInstaller


class AgentInstaller(BaseInstaller):
    kind = "agent"
    register_method = "register_agent"