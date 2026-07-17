"""SQLAlchemy 2.0 ORM model for the ``llmgw_usage_records`` table."""

from __future__ import annotations

from sqlalchemy import Column, DateTime, Float, Integer, String, Index, func
from sqlalchemy.orm import Mapped

from app.common.db import Base


class UsageRecordORM(Base):
    """ORM mapping for ``llmgw_usage_records``."""

    __tablename__ = "llmgw_usage_records"

    record_id: Mapped[str] = Column(String(128), primary_key=True)
    tenant_id: Mapped[str] = Column(String(64), nullable=False, index=True)
    user_id: Mapped[str] = Column(String(128), nullable=False)
    application_id: Mapped[str] = Column(String(128), nullable=True)
    model_id: Mapped[str] = Column(String(128), nullable=False, index=True)
    provider_id: Mapped[str] = Column(String(128), nullable=False)
    input_tokens: Mapped[int] = Column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = Column(Integer, nullable=False, default=0)
    total_tokens: Mapped[int] = Column(Integer, nullable=False, default=0)
    cost: Mapped[float] = Column(Float, nullable=False, default=0.0)
    timestamp: Mapped[DateTime] = Column(DateTime(timezone=True), nullable=False, index=True)

    __table_args__ = (
        Index("ix_usage_tenant_timestamp", "tenant_id", "timestamp"),
    )
