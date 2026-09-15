"""mcp domain ORM models (SQLAlchemy 2.0) — P3-W4 TD-5.

Table names are prefixed with ``mcp_``.
"""

from __future__ import annotations

from datetime import datetime

from mate_tech_db.base import Base
from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column


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
