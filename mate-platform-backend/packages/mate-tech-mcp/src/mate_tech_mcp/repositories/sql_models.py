"""mcp domain ORM models (SQLAlchemy 2.0) — P3-W4 TD-5.

Table names are prefixed with ``mcp_``.
"""

from __future__ import annotations

from datetime import datetime

from mate_tech_db.base import Base
from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column


class McpClientORM(Base):
    """External MCP server connection managed from the MCP center UI.

    Was a module-level dict until 1.1 task 1b: the center's client list
    vanished on every restart and was per-replica. ``tenant_id`` carries the
    isolation; reads always filter by it.
    """

    __tablename__ = "mcp_clients"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), default="")
    endpoint: Mapped[str] = mapped_column(String(512), default="")
    base_url: Mapped[str] = mapped_column(String(512), default="")
    client_type: Mapped[str] = mapped_column(String(32), default="REMOTE")
    transport_type: Mapped[str] = mapped_column(String(32), default="HTTP")
    auth_type: Mapped[str] = mapped_column(String(32), default="none")
    # Outbound credential for the *remote* server. Never logged, never
    # returned in a list payload other than to its own tenant.
    auth_token: Mapped[str] = mapped_column(Text, default="")
    timeout_ms: Mapped[int] = mapped_column(Integer, default=30000)
    headers: Mapped[str] = mapped_column(Text, default="")
    server_ids: Mapped[str] = mapped_column(Text, default="")
    config: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="disconnected")
    discovered_tools: Mapped[int] = mapped_column(Integer, default=0)
    last_connected_at: Mapped[str] = mapped_column(String(64), default="")
    last_sync_at: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")


class McpToolORM(Base):
    __tablename__ = "mcp_tools"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    input_schema: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")


class McpResourceORM(Base):
    __tablename__ = "mcp_resources"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    uri: Mapped[str] = mapped_column(String(512), default="")
    name: Mapped[str] = mapped_column(String(256), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    mime_type: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[str] = mapped_column(String(64), default="")


class McpPromptORM(Base):
    __tablename__ = "mcp_prompts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    template: Mapped[str] = mapped_column(Text, default="")
    arguments: Mapped[str] = mapped_column(Text, default="")  # newline-separated
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")


class McpApiKeyORM(Base):
    """Long-lived API key for external MCP clients (ADR-0062).

    Only the sha256 of the plaintext is stored (hard rule 12); the plaintext
    is returned exactly once at creation and is unrecoverable afterwards.

    Deliberately NOT covered by tenant RLS (see ADR-0062 §2.1): verification
    looks the row up by ``key_hash`` *before* any tenant context exists, so an
    RLS policy keyed on ``current_setting('app.tenant_id')`` would reject every
    lookup. The hash is an unguessable 256-bit value and only identifies the
    key's own tenant.
    """

    __tablename__ = "mcp_api_keys"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    key_name: Mapped[str] = mapped_column(String(128), default="")
    key_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    key_prefix: Mapped[str] = mapped_column(String(16), default="")
    blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), default="")
    created_by: Mapped[str] = mapped_column(String(64), default="")
