"""Marketplace install 表 — 安装记录。

partial unique(同 kind+artifact+version 只允许一条 active)。
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


class Install(Base):
    __tablename__ = "marketplace_install"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True
    )
    # 留痕;不参与 db_filter(SPEC §3.3)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True)
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    artifact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    version: Mapped[str] = mapped_column(String(64), nullable=False)
    digest_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    state: Mapped[str] = mapped_column(String(16), nullable=False)
    installed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    installed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    install_path: Mapped[str | None] = mapped_column(String(512))
    failure_reason: Mapped[str | None] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    __table_args__ = (
        Index("ix_marketplace_install_kind_artifact", "kind", "artifact_id"),
        # PG partial unique;SQLite 上退化为普通 unique(无 where 语义)
        UniqueConstraint(
            "kind",
            "artifact_id",
            "version",
            name="uq_marketplace_install_active",
        ),
    )