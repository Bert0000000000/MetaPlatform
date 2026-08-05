"""Marketplace instance 表 — 已在本地 mate-tech-* 注册的实例。

硬规则 #14:registered_digest 必须 == manifest.digest。
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


class Instance(Base):
    __tablename__ = "marketplace_instance"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True
    )
    install_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("marketplace_install.id", ondelete="CASCADE"),
        nullable=False,
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    instance_uid: Mapped[str] = mapped_column(String(256), nullable=False)
    registered_digest: Mapped[str] = mapped_column(
        String(64), nullable=False
    )
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )

    __table_args__ = (
        Index("ix_marketplace_instance_install", "install_id"),
    )