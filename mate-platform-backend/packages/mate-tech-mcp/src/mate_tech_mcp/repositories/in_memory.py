"""In-memory repository for the mcp domain (P3-W4 TD-5).

Entities: McpTool, McpResource, McpPrompt.
These capture the registry state of the MCP server (tools, resources,
prompt templates) so it can be persisted to SQL.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC
from typing import Any


@dataclass(frozen=True)
class McpTool:
    id: str
    tenant_id: str
    name: str = ""
    description: str = ""
    input_schema: dict[str, Any] = field(default_factory=dict)
    enabled: bool = True
    endpoint: str = ""  # W2: forwarding target for dynamically-registered tools
    created_at: str = ""
    updated_at: str = ""


@dataclass(frozen=True)
class McpResource:
    id: str
    tenant_id: str
    uri: str = ""
    name: str = ""
    description: str = ""
    mime_type: str = ""
    created_at: str = ""


@dataclass(frozen=True)
class McpPrompt:
    id: str
    tenant_id: str
    name: str = ""
    description: str = ""
    template: str = ""
    arguments: tuple[str, ...] = ()
    created_at: str = ""
    updated_at: str = ""


# ---------------------------------------------------------------------------
# Seed builders
# ---------------------------------------------------------------------------
def _seed_tools(tenant_id: str) -> dict[str, McpTool]:
    catalog = [
        ("tool-kb-search", "kb_search", "Search the knowledge base", True),
        ("tool-ont-query", "ontology_query", "Query the ontology graph", True),
        ("tool-rate-limit", "rate_limit", "Check rate limit quota", True),
    ]
    return {
        tid: McpTool(
            id=tid, tenant_id=tenant_id, name=name, description=desc,
            enabled=en, input_schema={"type": "object"},
            created_at="2026-08-01T00:00:00Z",
            updated_at="2026-08-01T00:00:00Z",
        )
        for tid, name, desc, en in catalog
    }


def _seed_resources(tenant_id: str) -> dict[str, McpResource]:
    catalog = [
        ("res-ontology", "ont://default", "Ontology", "The default ontology", "application/json"),
        ("res-kb-index", "kb://default", "KB Index", "Knowledge base index", "application/json"),
    ]
    return {
        rid: McpResource(
            id=rid, tenant_id=tenant_id, uri=uri, name=name,
            description=desc, mime_type=mt,
            created_at="2026-08-01T00:00:00Z",
        )
        for rid, uri, name, desc, mt in catalog
    }


def _seed_prompts(tenant_id: str) -> dict[str, McpPrompt]:
    catalog = [
        ("prompt-sales", "sales_assistant", "Sales assistant prompt",
         "You are a sales assistant.", ("product", "region")),
        ("prompt-research", "research_bot", "Research bot prompt",
         "You are a research bot.", ("topic",)),
    ]
    return {
        pid: McpPrompt(
            id=pid, tenant_id=tenant_id, name=name, description=desc,
            template=tpl, arguments=args,
            created_at="2026-08-01T00:00:00Z",
            updated_at="2026-08-01T00:00:00Z",
        )
        for pid, name, desc, tpl, args in catalog
    }


# ---------------------------------------------------------------------------
# Stores
# ---------------------------------------------------------------------------
_TOOLS: dict[str, dict[str, McpTool]] = {}
_RESOURCES: dict[str, dict[str, McpResource]] = {}
_PROMPTS: dict[str, dict[str, McpPrompt]] = {}


def _ensure_tenant(tenant_id: str) -> None:
    if not tenant_id:
        return
    if tenant_id not in _TOOLS:
        _TOOLS[tenant_id] = _seed_tools(tenant_id)
    if tenant_id not in _RESOURCES:
        _RESOURCES[tenant_id] = _seed_resources(tenant_id)
    if tenant_id not in _PROMPTS:
        _PROMPTS[tenant_id] = _seed_prompts(tenant_id)


def list_tools(tenant_id: str) -> list[McpTool]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_TOOLS[tenant_id].values(), key=lambda x: x.id)


def get_tool(tenant_id: str, tid: str) -> McpTool | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _TOOLS[tenant_id].get(tid)


def list_resources(tenant_id: str) -> list[McpResource]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_RESOURCES[tenant_id].values(), key=lambda x: x.id)


def get_resource(tenant_id: str, rid: str) -> McpResource | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _RESOURCES[tenant_id].get(rid)


def list_prompts(tenant_id: str) -> list[McpPrompt]:
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return sorted(_PROMPTS[tenant_id].values(), key=lambda x: x.id)


def get_prompt(tenant_id: str, pid: str) -> McpPrompt | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return _PROMPTS[tenant_id].get(pid)


def put_tool(tenant_id: str, tool: McpTool) -> McpTool:
    if not tenant_id:
        return tool
    _ensure_tenant(tenant_id)
    _TOOLS[tenant_id][tool.id] = tool
    return tool


def delete_tool(tenant_id: str, tid: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if tid not in _TOOLS[tenant_id]:
        return False
    del _TOOLS[tenant_id][tid]
    return True


# ---------------------------------------------------------------------------
# W2: dynamic (runtime) tool registry — name-keyed, tenant-scoped
#
# Static tools are registered at import time via `MCPServer.register_tool`
# (e.g. kb_search). W2 adds a runtime registry so digital-employee roles /
# external workers can register their capabilities as MCP tools with a
# forwarding `endpoint`. The registry lives in the tenant-scoped catalog
# (persisted via `sql_store` when `MATE_DB_URL` is set) and is merged into
# the `GET /tools` / `POST /tools/{name}` surfaces at request time.
# ---------------------------------------------------------------------------
def get_tool_by_name(tenant_id: str, name: str) -> McpTool | None:
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    return next((t for t in _TOOLS[tenant_id].values() if t.name == name), None)


def register_tool(tenant_id: str, name: str, *, description: str = "", input_schema: dict[str, Any] | None = None, endpoint: str = "") -> McpTool:
    """Register (or upsert) a dynamic tool for a tenant. Idempotent by name."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    _ensure_tenant(tenant_id)
    existing = get_tool_by_name(tenant_id, name)
    tid = existing.id if existing else f"dyn-{name}-{id(name) & 0xffff:x}"
    tool = McpTool(
        id=tid,
        tenant_id=tenant_id,
        name=name,
        description=description,
        input_schema=input_schema or {"type": "object"},
        enabled=True,
        endpoint=endpoint,
        created_at=existing.created_at if existing else _now(),
        updated_at=_now(),
    )
    _TOOLS[tenant_id][tid] = tool
    return tool


def update_tool(tenant_id: str, name: str, *, description: str | None = None, input_schema: dict[str, Any] | None = None, endpoint: str | None = None, enabled: bool | None = None) -> McpTool | None:
    """Update fields of a dynamic tool (by name). Returns None if unknown."""
    if not tenant_id:
        return None
    _ensure_tenant(tenant_id)
    existing = get_tool_by_name(tenant_id, name)
    if existing is None:
        return None
    tool = McpTool(
        id=existing.id,
        tenant_id=tenant_id,
        name=name,
        description=description if description is not None else existing.description,
        input_schema=input_schema if input_schema is not None else existing.input_schema,
        enabled=enabled if enabled is not None else existing.enabled,
        endpoint=endpoint if endpoint is not None else existing.endpoint,
        created_at=existing.created_at,
        updated_at=_now(),
    )
    _TOOLS[tenant_id][tool.id] = tool
    return tool


def unregister_tool(tenant_id: str, name: str) -> bool:
    """Remove a dynamic tool by name. Returns False if unknown."""
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    existing = get_tool_by_name(tenant_id, name)
    if existing is None:
        return False
    del _TOOLS[tenant_id][existing.id]
    return True


def list_dynamic_tools(tenant_id: str) -> list[McpTool]:
    """List the tenant's dynamically-registered tools (with an endpoint)."""
    if not tenant_id:
        return []
    _ensure_tenant(tenant_id)
    return [t for t in _TOOLS[tenant_id].values() if t.endpoint]


def _now() -> str:
    from datetime import datetime

    return datetime.now(UTC).isoformat()


def put_resource(tenant_id: str, res: McpResource) -> McpResource:
    if not tenant_id:
        return res
    _ensure_tenant(tenant_id)
    _RESOURCES[tenant_id][res.id] = res
    return res


def delete_resource(tenant_id: str, rid: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if rid not in _RESOURCES[tenant_id]:
        return False
    del _RESOURCES[tenant_id][rid]
    return True


def put_prompt(tenant_id: str, prompt: McpPrompt) -> McpPrompt:
    if not tenant_id:
        return prompt
    _ensure_tenant(tenant_id)
    _PROMPTS[tenant_id][prompt.id] = prompt
    return prompt


def delete_prompt(tenant_id: str, pid: str) -> bool:
    if not tenant_id:
        return False
    _ensure_tenant(tenant_id)
    if pid not in _PROMPTS[tenant_id]:
        return False
    del _PROMPTS[tenant_id][pid]
    return True


def reset_store() -> None:
    _TOOLS.clear()
    _RESOURCES.clear()
    _PROMPTS.clear()
