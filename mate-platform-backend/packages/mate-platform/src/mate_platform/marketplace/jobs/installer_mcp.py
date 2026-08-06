"""MCP installer — registers an MCP artifact with ``mate-tech-mcp``.

The installer delegates to ``McpMarketplaceClient.register_server``
(MP-MCP-REGISTER-01) which lives in ``mate-clients.marketplace.mcp``.
"""
from __future__ import annotations

from ._base import BaseInstaller


class McpInstaller(BaseInstaller):
    kind = "mcp"
    register_method = "register_server"
