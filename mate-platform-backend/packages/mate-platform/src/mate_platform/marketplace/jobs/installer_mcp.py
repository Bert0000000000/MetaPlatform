"""MCP installer — [blocked-on: MP-MCP-REGISTER-01]。"""
from __future__ import annotations

from ._base import BaseInstaller


class McpInstaller(BaseInstaller):
    kind = "mcp"
    register_method = "register_server"