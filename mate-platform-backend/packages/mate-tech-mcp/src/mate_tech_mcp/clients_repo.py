"""In-memory repository for MCP external clients (联调 integration).

Entities: McpClient (external MCP server connection managed from the
MCP center UI). Follows the same tenant-scoped store pattern as
``in_memory.py`` (tools/resources/prompts).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


@dataclass(frozen=True)
class McpClient:
    id: str
    tenant_id: str
    name: str
    endpoint: str = ""
    base_url: str = ""
    client_type: str = "REMOTE"
    transport_type: str = "HTTP"
    auth_type: str = "none"
    auth_token: str = ""
    timeout_ms: int = 30000
    headers: str = ""
    server_ids: str = ""
    config: str = ""
    status: str = "disconnected"
    discovered_tools: int = 0
    last_connected_at: str = ""
    last_sync_at: str = ""
    created_at: str = ""
    updated_at: str = ""


_CLIENTS: dict[str, dict[str, McpClient]] = {}


def _normalize_id(value: str) -> str:
    """Accept either the client id or an SSE/ws endpoint as the key."""
    return value


def list_clients(tenant_id: str) -> list[McpClient]:
    if not tenant_id:
        return []
    return sorted(_CLIENTS.get(tenant_id, {}).values(), key=lambda c: c.created_at, reverse=True)


def get_client(tenant_id: str, cid: str) -> McpClient | None:
    if not tenant_id:
        return None
    return _CLIENTS.get(tenant_id, {}).get(cid)


def put_client(tenant_id: str, client: McpClient) -> McpClient:
    _CLIENTS.setdefault(tenant_id, {})[client.id] = client
    return client


def create_client(tenant_id: str, **fields: Any) -> McpClient:
    now = _now_iso()
    cid = fields.pop("id", None) or _gen_id("mcp-client")
    client = McpClient(
        id=cid,
        tenant_id=tenant_id,
        name=fields.get("name", ""),
        endpoint=fields.get("endpoint", fields.get("server_url", "")),
        base_url=fields.get("base_url", ""),
        client_type=fields.get("client_type", "REMOTE"),
        transport_type=fields.get("transport_type", "HTTP"),
        auth_type=fields.get("auth_type", "none"),
        auth_token=fields.get("auth_token", ""),
        timeout_ms=fields.get("timeout_ms", 30000),
        headers=fields.get("headers", ""),
        server_ids=fields.get("server_ids", ""),
        config=fields.get("config", ""),
        status=fields.get("status", "disconnected"),
        discovered_tools=0,
        last_connected_at="",
        last_sync_at="",
        created_at=now,
        updated_at=now,
    )
    return put_client(tenant_id, client)


def update_client(tenant_id: str, cid: str, **fields: Any) -> McpClient | None:
    existing = get_client(tenant_id, cid)
    if existing is None:
        return None
    updates = {f: v for f, v in fields.items() if v is not None}
    merged = McpClient(
        id=existing.id,
        tenant_id=existing.tenant_id,
        name=updates.get("name", existing.name),
        endpoint=updates.get("endpoint", existing.endpoint),
        base_url=updates.get("base_url", existing.base_url),
        client_type=updates.get("client_type", existing.client_type),
        transport_type=updates.get("transport_type", existing.transport_type),
        auth_type=updates.get("auth_type", existing.auth_type),
        auth_token=updates.get("auth_token", existing.auth_token),
        timeout_ms=updates.get("timeout_ms", existing.timeout_ms),
        headers=updates.get("headers", existing.headers),
        server_ids=updates.get("server_ids", existing.server_ids),
        config=updates.get("config", existing.config),
        status=updates.get("status", existing.status),
        discovered_tools=updates.get("discovered_tools", existing.discovered_tools),
        last_connected_at=updates.get("last_connected_at", existing.last_connected_at),
        last_sync_at=updates.get("last_sync_at", existing.last_sync_at),
        created_at=existing.created_at,
        updated_at=_now_iso(),
    )
    return put_client(tenant_id, merged)


def delete_client(tenant_id: str, cid: str) -> bool:
    if not tenant_id:
        return False
    store = _CLIENTS.get(tenant_id)
    if not store or cid not in store:
        return False
    del store[cid]
    return True


def mark_client_connected(tenant_id: str, cid: str, tools: int) -> McpClient | None:
    now = _now_iso()
    return update_client(
        tenant_id, cid,
        status="connected", discovered_tools=tools,
        last_connected_at=now, last_sync_at=now,
    )


def reset_store() -> None:
    _CLIENTS.clear()
