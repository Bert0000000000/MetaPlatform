"""mcp domain ORM models (SQLAlchemy 2.0) — P3-W4 TD-5.

Table names are prefixed with ``mcp_``.
"""
from __future__ import annotations

from mate_tech_db.base import Base
from sqlalchemy import Boolean, String, Text
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
