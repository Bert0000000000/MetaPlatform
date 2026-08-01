"""llmgw domain ORM models (SQLAlchemy 2.0) — P3-W4 TD-5.

Table names are prefixed with ``llmgw_``.
"""
from __future__ import annotations

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


class LlmProviderORM(Base):
    __tablename__ = "llmgw_providers"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(256), default="")
    provider_type: Mapped[str] = mapped_column(String(64), default="")
    base_url: Mapped[str] = mapped_column(String(512), default="")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    config: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")


class LlmModelORM(Base):
    __tablename__ = "llmgw_models"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    model_id: Mapped[str] = mapped_column(String(128), default="")
    display_name: Mapped[str] = mapped_column(String(256), default="")
    provider: Mapped[str] = mapped_column(String(64), default="")
    modality: Mapped[str] = mapped_column(String(32), default="text")
    max_tokens: Mapped[int] = mapped_column(Integer, default=4096)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    config: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")


class LlmRouteRuleORM(Base):
    __tablename__ = "llmgw_route_rules"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    model_pattern: Mapped[str] = mapped_column(String(256), default="")
    provider: Mapped[str] = mapped_column(String(64), default="")
    priority: Mapped[int] = mapped_column(Integer, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str] = mapped_column(String(64), default="")
    updated_at: Mapped[str] = mapped_column(String(64), default="")
