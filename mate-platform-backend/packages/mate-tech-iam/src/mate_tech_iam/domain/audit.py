"""Audit log model for FR-DASH-006-04."""
from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, Index, Text
from sqlmodel import Field, SQLModel


class AuditAction(StrEnum):
    """Categorized admin operation verbs."""

    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    ENABLE = "ENABLE"
    DISABLE = "DISABLE"
    RESET_PASSWORD = "RESET_PASSWORD"
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    ASSIGN = "ASSIGN"
    REVOKE = "REVOKE"
    EXPORT = "EXPORT"
    CONFIG_CHANGE = "CONFIG_CHANGE"
    IMPORT = "IMPORT"
    OTHER = "OTHER"


class AuditLog(SQLModel, table=True):
    """Append-only audit log entry (不可篡改)."""

    __tablename__ = "iam_audit_log"
    __table_args__ = (
        Index("ix_audit_tenant_time", "tenant_id", "occurred_at"),
        Index("ix_audit_module", "module"),
        Index("ix_audit_actor", "actor_id"),
    )

    id: int | None = Field(default=None, primary_key=True)
    tenant_id: str = Field(index=True, max_length=64)
    actor_id: str = Field(max_length=64, description="操作者 user_id (字符串以兼容 SSO sub)")
    actor_name: str | None = Field(default=None, max_length=128, description="操作者姓名")
    module: str = Field(max_length=64, index=True, description="模块 (user/role/org/config/...)")
    action: AuditAction = Field(default=AuditAction.OTHER)
    resource_type: str | None = Field(default=None, max_length=64)
    resource_id: str | None = Field(default=None, max_length=64)
    resource_name: str | None = Field(default=None, max_length=256)
    summary: str | None = Field(default=None, max_length=512, description="一句话说明")
    detail: str | None = Field(default=None, sa_column=Column(Text), description="JSON 详情 / diff")
    ip: str | None = Field(default=None, max_length=64)
    user_agent: str | None = Field(default=None, max_length=512)
    occurred_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), index=True),
    )
