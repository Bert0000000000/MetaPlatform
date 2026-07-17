"""SQLAlchemy 2.0 ORM models for prompt templates.

Tables:
- ``llmgw_prompts`` — latest/current prompt records
- ``llmgw_prompt_versions`` — historical prompt versions
"""

from __future__ import annotations

from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped

from app.common.db import Base


class PromptORM(Base):
    """ORM mapping for ``llmgw_prompts`` (latest version of each prompt)."""

    __tablename__ = "llmgw_prompts"

    prompt_id: Mapped[str] = Column(String(128), primary_key=True)
    tenant_id: Mapped[str] = Column(String(64), nullable=False, index=True)
    prompt_key: Mapped[str] = Column(String(128), nullable=False)
    name: Mapped[str] = Column(String(256), nullable=False)
    description: Mapped[str] = Column(String(1024), nullable=True)
    category: Mapped[str] = Column(String(128), nullable=True)
    template: Mapped[str] = Column(Text, nullable=False)
    variables: Mapped[list] = Column(JSON, nullable=False, default=list)
    default_model: Mapped[str] = Column(String(256), nullable=True)
    default_params: Mapped[dict] = Column(JSON, nullable=True)
    tags: Mapped[list] = Column(JSON, nullable=False, default=list)
    version: Mapped[int] = Column(Integer, nullable=False, default=1)
    is_latest: Mapped[bool] = Column(Boolean, nullable=False, default=True)
    status: Mapped[str] = Column(String(32), nullable=False, default="ACTIVE")
    change_log: Mapped[str] = Column(String(1024), nullable=True)
    created_by: Mapped[str] = Column(String(128), nullable=False)
    updated_by: Mapped[str] = Column(String(128), nullable=True)
    created_at: Mapped[DateTime] = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "prompt_key", name="uq_llmgw_prompt_tenant_key"),
    )


class PromptVersionORM(Base):
    """ORM mapping for ``llmgw_prompt_versions`` (historical versions)."""

    __tablename__ = "llmgw_prompt_versions"

    id: Mapped[int] = Column(Integer, primary_key=True, autoincrement=True)
    prompt_id: Mapped[str] = Column(String(128), nullable=False, index=True)
    tenant_id: Mapped[str] = Column(String(64), nullable=False, index=True)
    prompt_key: Mapped[str] = Column(String(128), nullable=False)
    name: Mapped[str] = Column(String(256), nullable=False)
    description: Mapped[str] = Column(String(1024), nullable=True)
    category: Mapped[str] = Column(String(128), nullable=True)
    template: Mapped[str] = Column(Text, nullable=False)
    variables: Mapped[list] = Column(JSON, nullable=False, default=list)
    default_model: Mapped[str] = Column(String(256), nullable=True)
    default_params: Mapped[dict] = Column(JSON, nullable=True)
    tags: Mapped[list] = Column(JSON, nullable=False, default=list)
    version: Mapped[int] = Column(Integer, nullable=False)
    is_latest: Mapped[bool] = Column(Boolean, nullable=False, default=False)
    status: Mapped[str] = Column(String(32), nullable=False, default="ACTIVE")
    change_log: Mapped[str] = Column(String(1024), nullable=True)
    created_by: Mapped[str] = Column(String(128), nullable=False)
    updated_by: Mapped[str] = Column(String(128), nullable=True)
    previous_version: Mapped[int] = Column(Integer, nullable=True)
    rolled_back_from: Mapped[int] = Column(Integer, nullable=True)
    rolled_back_to: Mapped[int] = Column(Integer, nullable=True)
    created_at: Mapped[DateTime] = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("prompt_id", "version", name="uq_llmgw_prompt_version_prompt_version"),
    )
