"""SQLAlchemy 2.0 ORM model for the ``llmgw_audit_logs`` table."""

from __future__ import annotations

from sqlalchemy import Column, DateTime, Float, Integer, String, Index, func
from sqlalchemy.orm import Mapped

from app.common.db import Base


class AuditLogORM(Base):
    """ORM mapping for ``llmgw_audit_logs``."""

    __tablename__ = "llmgw_audit_logs"

    log_id: Mapped[str] = Column(String(128), primary_key=True)
    tenant_id: Mapped[str] = Column(String(64), nullable=False, index=True)
    user_id: Mapped[str] = Column(String(128), nullable=False)
    application_id: Mapped[str] = Column(String(128), nullable=True)
    model_id: Mapped[str] = Column(String(128), nullable=False, index=True)
    provider_id: Mapped[str] = Column(String(128), nullable=False)
    status: Mapped[str] = Column(String(32), nullable=False, default="SUCCESS")
    error_code: Mapped[str] = Column(String(128), nullable=True)
    error_message: Mapped[str] = Column(String(1024), nullable=True)
    input_tokens: Mapped[int] = Column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = Column(Integer, nullable=False, default=0)
    latency_ms: Mapped[int] = Column(Integer, nullable=False, default=0)
    cost: Mapped[float] = Column(Float, nullable=False, default=0.0)
    trace_id: Mapped[str] = Column(String(128), nullable=True)
    timestamp: Mapped[DateTime] = Column(DateTime(timezone=True), nullable=False, index=True)

    __table_args__ = (
        Index("ix_audit_tenant_timestamp", "tenant_id", "timestamp"),
    )
