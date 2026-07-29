"""User model for IAM admin."""
from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, Index
from sqlmodel import Field, SQLModel


class UserStatus(StrEnum):
    """User account status (FR-DASH-006-01)."""

    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    LOCKED = "LOCKED"


class User(SQLModel, table=True):
    """User record managed via TECH-IAM admin APIs."""

    __tablename__ = "iam_user"
    __table_args__ = (Index("ix_user_tenant_username", "tenant_id", "username", unique=True),)

    id: int | None = Field(default=None, primary_key=True)
    tenant_id: str = Field(index=True, max_length=64, description="Tenant ID")
    username: str = Field(max_length=64, description="登录名")
    real_name: str | None = Field(default=None, max_length=128, description="真实姓名")
    email: str | None = Field(default=None, max_length=128, description="邮箱")
    phone: str | None = Field(default=None, max_length=32, description="手机号")
    avatar: str | None = Field(default=None, max_length=512, description="头像 URL")
    department: str | None = Field(default=None, max_length=128, description="所属部门")
    position: str | None = Field(default=None, max_length=128, description="职位")
    status: UserStatus = Field(default=UserStatus.ACTIVE, index=True)
    is_super_admin: bool = Field(default=False, description="超级管理员标记")
    password_hash: str | None = Field(default=None, max_length=256, description="密码哈希")
    last_login_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    last_login_ip: str | None = Field(default=None, max_length=64)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), sa_column=Column(DateTime(timezone=True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC), sa_column=Column(DateTime(timezone=True)))
