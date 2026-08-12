"""mate_clients.mcp — ACL clients for the MCP service center.

Outbound calls to ``mate-tech-mcp`` use ``BearerAuth`` +
``OutgoingAuthMiddleware`` so every request carries
``Authorization: Bearer …`` + ``X-Tenant-Id`` (13 硬规则 #4 ACL Client).
"""
