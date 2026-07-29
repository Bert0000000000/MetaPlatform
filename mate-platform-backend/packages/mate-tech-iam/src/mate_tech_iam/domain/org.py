"""Organization, position and employee-position models (FR-DASH-006-03)."""
from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, Index
from sqlmodel import Field, SQLModel


class OrgType(StrEnum):
    """Organization node type."""

    COMPANY = "COMPANY"
    DEPARTMENT = "DEPARTMENT"
    TEAM = "TEAM"
    VIRTUAL = "VIRTUAL"


class Org(SQLModel, table=True):
    """Organization tree node."""

    __tablename__ = "iam_org"
    __table_args__ = (
        Index("ix_org_tenant_code", "tenant_id", "code", unique=True),
        Index("ix_org_parent", "parent_id"),
    )

    id: int | None = Field(default=None, primary_key=True)
    tenant_id: str = Field(index=True, max_length=64)
    parent_id: int | None = Field(default=None, foreign_key="iam_org.id", index=True)
    code: str = Field(max_length=64, description="组织编码")
    name: str = Field(max_length=128, description="组织名称")
    type: OrgType = Field(default=OrgType.DEPARTMENT)
    leader_id: int | None = Field(default=None, foreign_key="iam_user.id", description="负责人 user_id")
    sort_order: int = Field(default=0, description="同级排序")
    description: str | None = Field(default=None, max_length=512)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), sa_column=Column(DateTime(timezone=True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC), sa_column=Column(DateTime(timezone=True)))


class Position(SQLModel, table=True):
    """Position / job-posting inside an organization."""

    __tablename__ = "iam_position"
    __table_args__ = (Index("ix_position_org", "org_id"),)

    id: int | None = Field(default=None, primary_key=True)
    tenant_id: str = Field(index=True, max_length=64)
    org_id: int = Field(foreign_key="iam_org.id", index=True)
    code: str = Field(max_length=64)
    name: str = Field(max_length=128)
    level: str | None = Field(default=None, max_length=32, description="P1-P12 / M1-M5 / etc.")
    description: str | None = Field(default=None, max_length=512)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), sa_column=Column(DateTime(timezone=True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC), sa_column=Column(DateTime(timezone=True)))


class EmployeePosition(SQLModel, table=True):
    """User ↔ Position binding with reporting relation."""

    __tablename__ = "iam_employee_position"
    __table_args__ = (
        Index("ix_emp_pos_user", "user_id"),
        Index("ix_emp_pos_pos", "position_id"),
    )

    id: int | None = Field(default=None, primary_key=True)
    tenant_id: str = Field(index=True, max_length=64)
    user_id: int = Field(foreign_key="iam_user.id", index=True)
    position_id: int = Field(foreign_key="iam_position.id", index=True)
    reports_to: int | None = Field(default=None, foreign_key="iam_user.id", description="汇报对象 user_id")
    is_primary: bool = Field(default=True, description="是否主岗")
    effective_from: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    effective_to: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), sa_column=Column(DateTime(timezone=True)))
