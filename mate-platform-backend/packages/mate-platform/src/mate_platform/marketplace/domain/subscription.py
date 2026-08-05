"""Marketplace subscription 表 — license 持有记录。

KMS 加密 license_key 后存盘;license_payload 存 SaaS 返回的元数据。
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Index, String, types
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from mate_tech_db.base import Base


# JSONB 在 PostgreSQL;其他方言(JSON) 回退为普通 JSON,保证 SQLite 测试也能 create_all
JSONType = JSONB().with_variant(JSON(), "sqlite")


class Subscription(Base):
    __tablename__ = "marketplace_subscription"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    sku: Mapped[str] = mapped_column(String(128), nullable=False)
    # KMS 加密后的 license_key(密文)。Task 8 写入。
    license_key: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    license_payload: Mapped[dict] = mapped_column(JSONType, nullable=False)
    purchased_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    __table_args__ = (
        Index(
            "ix_marketplace_subscription_tenant",
            "tenant_id",
        ),
    )