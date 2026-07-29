"""Permission catalog and role-permission binding for the permission matrix."""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Index
from sqlmodel import Field, SQLModel


class Permission(SQLModel, table=True):
    """Permission catalog item (resource × action)."""

    __tablename__ = "iam_permission"
    __table_args__ = (
        Index("ix_perm_tenant_code", "tenant_id", "code", unique=True),
        Index("ix_perm_resource", "resource_type"),
    )

    id: int | None = Field(default=None, primary_key=True)
    tenant_id: str = Field(index=True, max_length=64)
    code: str = Field(max_length=128, description="权限编码 (e.g. user:create)")
    name: str = Field(max_length=128, description="权限显示名")
    resource_type: str = Field(max_length=64, index=True, description="资源类型 (user/role/org/...)")
    actions: str = Field(default="", max_length=512, description="逗号分隔动作 (create,read,update,delete,...)")
    description: str | None = Field(default=None, max_length=512)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), sa_column=Column(DateTime(timezone=True)))


class RolePermission(SQLModel, table=True):
    """Role-permission binding (the permission matrix)."""

    __tablename__ = "iam_role_permission"
    __table_args__ = (
        Index("ix_role_perm_role", "role_id"),
        Index("ix_role_perm_perm", "permission_id"),
    )

    id: int | None = Field(default=None, primary_key=True)
    role_id: int = Field(foreign_key="iam_role.id", index=True)
    permission_id: int = Field(foreign_key="iam_permission.id", index=True)
    effect: str = Field(default="ALLOW", max_length=16, description="ALLOW / DENY")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), sa_column=Column(DateTime(timezone=True)))
