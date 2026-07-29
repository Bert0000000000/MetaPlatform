"""Role model and user-role binding."""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, Index
from sqlmodel import Field, SQLModel


class Role(SQLModel, table=True):
    """Role record (FR-DASH-006-02)."""

    __tablename__ = "iam_role"
    __table_args__ = (Index("ix_role_tenant_code", "tenant_id", "code", unique=True),)

    id: int | None = Field(default=None, primary_key=True)
    tenant_id: str = Field(index=True, max_length=64)
    code: str = Field(max_length=64, description="角色编码 (e.g. PLATFORM_ADMIN)")
    name: str = Field(max_length=128, description="角色显示名")
    description: str | None = Field(default=None, max_length=512)
    data_scope: str = Field(default="SELF", max_length=32, description="ALL/DEPT/DEPT_AND_SUB/SELF/CUSTOM")
    is_builtin: bool = Field(default=False, description="是否内置角色")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), sa_column=Column(DateTime(timezone=True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC), sa_column=Column(DateTime(timezone=True)))


class UserRole(SQLModel, table=True):
    """User-role binding."""

    __tablename__ = "iam_user_role"
    __table_args__ = (Index("ix_user_role_user", "user_id"), Index("ix_user_role_role", "role_id"))

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="iam_user.id", index=True)
    role_id: int = Field(foreign_key="iam_role.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), sa_column=Column(DateTime(timezone=True)))
