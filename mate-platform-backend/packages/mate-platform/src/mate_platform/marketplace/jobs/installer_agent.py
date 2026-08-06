"""Agent installer — registers an Agent artifact with ``mate-tech-agent``."""
from __future__ import annotations

from ._base import BaseInstaller


class AgentInstaller(BaseInstaller):
    kind = "agent"
    register_method = "register_agent"
