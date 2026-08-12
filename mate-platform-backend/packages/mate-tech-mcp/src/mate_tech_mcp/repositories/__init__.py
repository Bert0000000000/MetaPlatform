"""Repository package for mate-tech-mcp (P3-W4 TD-5).

Re-exports the tenant-scoped in-memory catalog (tools / resources /
prompts) plus the W2 dynamic tool registry accessors. A SQL backend
mirror lives in ``sql_store`` (wired when ``MATE_DB_URL`` is set); the
runtime surfaces use the in-memory store by default.
"""
from __future__ import annotations

from .in_memory import (
    McpPrompt,
    McpResource,
    McpTool,
    delete_prompt,
    delete_resource,
    delete_tool,
    get_prompt,
    get_resource,
    get_tool,
    get_tool_by_name,
    list_dynamic_tools,
    list_prompts,
    list_resources,
    list_tools,
    put_prompt,
    put_resource,
    put_tool,
    register_tool,
    reset_store,
    unregister_tool,
    update_tool,
)

__all__ = [
    "McpPrompt",
    "McpResource",
    "McpTool",
    "delete_prompt",
    "delete_resource",
    "delete_tool",
    "get_prompt",
    "get_resource",
    "get_tool",
    "get_tool_by_name",
    "list_dynamic_tools",
    "list_prompts",
    "list_resources",
    "list_tools",
    "put_prompt",
    "put_resource",
    "put_tool",
    "register_tool",
    "reset_store",
    "unregister_tool",
    "update_tool",
]
