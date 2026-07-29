"""Login log model (FR-DASH-006-01 登录日志)."""
from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, Index
from sqlmodel import Field, SQLModel


class LoginResult(StrEnum):
    """Login outcome."""

    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    LOCKED = "LOCKED"
    MFA_REQUIRED = "MFA_REQUIRED"


class LoginLog(SQLModel, table=True):
    """User login attempt record."""

    __tablename__ = "iam_login_log"
    __table_args__ = (
        Index("ix_login_tenant_time", "tenant_id", "occurred_at"),
        Index("ix_login_user", "username"),
    )

    id: int | None = Field(default=None, primary_key=True)
    tenant_id: str = Field(index=True, max_length=64)
    user_id: int | None = Field(default=None, foreign_key="iam_user.id")
    username: str = Field(max_length=64, description="尝试登录的用户名")
    result: LoginResult = Field(default=LoginResult.SUCCESS, index=True)
    ip: str | None = Field(default=None, max_length=64)
    user_agent: str | None = Field(default=None, max_length=512)
    device: str | None = Field(default=None, max_length=128)
    location: str | None = Field(default=None, max_length=128)
    failure_reason: str | None = Field(default=None, max_length=256)
    occurred_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), index=True),
    )
