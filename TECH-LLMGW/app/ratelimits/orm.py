"""SQLAlchemy 2.0 ORM model for the ``llmgw_rate_limits`` table."""

from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped

from app.common.db import Base


class RateLimitORM(Base):
    """ORM mapping for ``llmgw_rate_limits``."""

    __tablename__ = "llmgw_rate_limits"

    rate_limit_id: Mapped[str] = Column(String(128), primary_key=True)
    tenant_id: Mapped[str] = Column(String(64), nullable=False, index=True)
    name: Mapped[str] = Column(String(256), nullable=False)
    scope: Mapped[str] = Column(String(32), nullable=False)
    target_id: Mapped[str] = Column(String(128), nullable=False)
    type: Mapped[str] = Column(String(32), nullable=False)
    limit_value: Mapped[int] = Column(Integer, nullable=False)
    window_seconds: Mapped[int] = Column(Integer, nullable=False, default=60)
    enabled: Mapped[bool] = Column(Boolean, nullable=False, default=True)
    created_by: Mapped[str] = Column(String(128), nullable=False, default="system")
    updated_by: Mapped[str] = Column(String(128), nullable=True)
    created_at: Mapped[DateTime] = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "scope", "target_id", "type", name="uq_llmgw_rl_tenant_scope_target_type"),
    )
