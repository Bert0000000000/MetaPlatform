"""Persistent repository for MCP external clients (联调 integration).

Entities: McpClient (external MCP server connection managed from the
MCP center UI).

Was a module-level ``dict`` until 1.1 task 1b — the MCP center's client list
was per-process, so it disappeared on restart and diverged across replicas.
It is now a tenant-scoped table (``mcp_clients``), following the same
SQLAlchemy pattern as ``repositories/sql_store.py``.

Tenant isolation
----------------
Every read and write filters on ``tenant_id``; the caller's tenant comes
from ``require_tenant(request.state.ctx)`` in ``api/clients_routes.py``
(hard rule 3). A row belonging to another tenant is indistinguishable from
a missing one — no existence oracle. PostgreSQL additionally carries a
``tenant_isolation`` RLS policy with ``FORCE ROW LEVEL SECURITY`` (migration
``0020_mcp_clients``), so the filter holds even for a caller that reaches
the database without going through this module.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from mate_tech_db.base import get_session
from sqlalchemy import delete, select


def _model() -> Any:
    """Lazily resolve the ORM class.

    Deliberately not a module-level import (same reason as
    ``security/api_keys.py``): ``mate_tech_mcp.main`` imports this module and
    test fixtures re-import the package after evicting it from ``sys.modules``.
    A module-level ORM import would re-execute ``sql_models`` on that
    re-import and re-register its tables on the shared ``Base``, which
    SQLAlchemy rejects with "Table already defined".
    """
    from .repositories.sql_models import McpClientORM

    return McpClientORM


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


def _to_client(row: Any) -> McpClient:
    return McpClient(
        id=row.id,
        tenant_id=row.tenant_id,
        name=row.name or "",
        endpoint=row.endpoint or "",
        base_url=row.base_url or "",
        client_type=row.client_type or "REMOTE",
        transport_type=row.transport_type or "HTTP",
        auth_type=row.auth_type or "none",
        auth_token=row.auth_token or "",
        timeout_ms=row.timeout_ms if row.timeout_ms is not None else 30000,
        headers=row.headers or "",
        server_ids=row.server_ids or "",
        config=row.config or "",
        status=row.status or "disconnected",
        discovered_tools=row.discovered_tools or 0,
        last_connected_at=row.last_connected_at or "",
        last_sync_at=row.last_sync_at or "",
        created_at=row.created_at or "",
        updated_at=row.updated_at or "",
    )


def list_clients(tenant_id: str) -> list[McpClient]:
    if not tenant_id:
        return []
    model = _model()
    session = get_session()
    try:
        rows = (
            session.execute(
                select(model)
                .where(model.tenant_id == tenant_id)
                .order_by(model.created_at.desc(), model.id)
            )
            .scalars()
            .all()
        )
        return [_to_client(r) for r in rows]
    finally:
        session.close()


def get_client(tenant_id: str, cid: str) -> McpClient | None:
    if not tenant_id:
        return None
    model = _model()
    session = get_session()
    try:
        row = session.execute(
            select(model).where(
                model.id == cid,
                model.tenant_id == tenant_id,
            )
        ).scalar_one_or_none()
        return _to_client(row) if row is not None else None
    finally:
        session.close()


def put_client(tenant_id: str, client: McpClient) -> McpClient:
    """Upsert ``client`` under ``tenant_id`` (idempotent by id)."""
    if not tenant_id:
        raise ValueError("tenant_id is required")
    model = _model()
    session = get_session()
    try:
        row = session.get(model, client.id)
        if row is None:
            row = model(id=client.id, tenant_id=tenant_id)
            session.add(row)
        elif row.tenant_id != tenant_id:
            # Refuse to re-home a row onto another tenant.
            raise ValueError(f"client {client.id!r} belongs to another tenant")
        for field in (
            "name",
            "endpoint",
            "base_url",
            "client_type",
            "transport_type",
            "auth_type",
            "auth_token",
            "timeout_ms",
            "headers",
            "server_ids",
            "config",
            "status",
            "discovered_tools",
            "last_connected_at",
            "last_sync_at",
            "created_at",
            "updated_at",
        ):
            setattr(row, field, getattr(client, field))
        session.commit()
        return _to_client(row)
    finally:
        session.close()


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
    model = _model()
    session = get_session()
    try:
        result = session.execute(
            delete(model).where(
                model.id == cid,
                model.tenant_id == tenant_id,
            )
        )
        session.commit()
        return bool(result.rowcount)
    finally:
        session.close()


def mark_client_connected(tenant_id: str, cid: str, tools: int) -> McpClient | None:
    now = _now_iso()
    return update_client(
        tenant_id,
        cid,
        status="connected",
        discovered_tools=tools,
        last_connected_at=now,
        last_sync_at=now,
    )


def reset_store() -> None:
    """Delete every client row. Test helper — not exposed over HTTP."""
    session = get_session()
    try:
        session.execute(delete(_model()))
        session.commit()
    finally:
        session.close()
