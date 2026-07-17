"""SQLAlchemy 2.0 ORM model for the ``llm_models`` table.

Used by :class:`SqlAlchemyModelRepository` in production.
"""

from __future__ import annotations

from sqlalchemy import JSON, Boolean, Column, DateTime, Float, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped

from app.common.db import Base


class LLMModelORM(Base):
    """ORM mapping for ``llm_models``."""

    __tablename__ = "llm_models"

    model_id: Mapped[str] = Column(String(128), primary_key=True)
    tenant_id: Mapped[str] = Column(String(64), nullable=False, index=True)
    provider: Mapped[str] = Column(String(64), nullable=False)
    model_code: Mapped[str] = Column(String(128), nullable=False)
    display_name: Mapped[str] = Column(String(256), nullable=False)
    type: Mapped[str] = Column(String(32), nullable=False)
    input_price: Mapped[float] = Column(Float, nullable=False, default=0.0)
    output_price: Mapped[float] = Column(Float, nullable=False, default=0.0)
    context_length: Mapped[int] = Column(Integer, nullable=False, default=0)
    capabilities: Mapped[list] = Column(JSON, nullable=False, default=list)
    enabled: Mapped[bool] = Column(Boolean, nullable=False, default=True)
    description: Mapped[str] = Column(String(1024), nullable=True)
    created_at: Mapped[DateTime] = Column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "provider", "model_code", name="uq_llm_model_tenant_provider_code"),
    )
