"""System configuration model (FR-DASH-006-05).

Covers SSO, LICENSE, message channels, rate limits and other platform-level
configuration items persisted in TECH-IAM (overridable via Nacos at deploy time).
"""
from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, Index, Text
from sqlmodel import Field, SQLModel


class ConfigCategory(StrEnum):
    """Configuration category used for grouping in admin UI."""

    SSO = "SSO"
    LICENSE = "LICENSE"
    MESSAGE = "MESSAGE"
    RATE_LIMIT = "RATE_LIMIT"
    SECURITY = "SECURITY"
    BRANDING = "BRANDING"
    AI_PROVIDER = "AI_PROVIDER"
    OTHER = "OTHER"


class SystemConfig(SQLModel, table=True):
    """Single config item keyed by ``key`` within tenant scope."""

    __tablename__ = "iam_system_config"
    __table_args__ = (Index("ix_cfg_tenant_key", "tenant_id", "key", unique=True),)

    id: int | None = Field(default=None, primary_key=True)
    tenant_id: str = Field(index=True, max_length=64)
    key: str = Field(max_length=128, description="配置键 (e.g. sso.oidc.issuer)")
    value: str | None = Field(default=None, sa_column=Column(Text), description="配置值 (JSON 序列化)")
    category: ConfigCategory = Field(default=ConfigCategory.OTHER, index=True)
    label: str | None = Field(default=None, max_length=256, description="人可读标签")
    description: str | None = Field(default=None, max_length=512)
    value_type: str = Field(default="string", max_length=32, description="string/int/bool/json/enum")
    enum_options: str | None = Field(default=None, max_length=512, description="可选值，逗号分隔 (当 value_type=enum)")
    is_sensitive: bool = Field(default=False, description="敏感字段（不回显明文）")
    updated_by: str | None = Field(default=None, max_length=128)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), sa_column=Column(DateTime(timezone=True)))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC), sa_column=Column(DateTime(timezone=True)))
