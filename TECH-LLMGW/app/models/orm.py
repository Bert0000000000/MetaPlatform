"""SQLAlchemy 2.0 ORM model for the ``llm_models`` table.

Used by :class:`SqlAlchemyModelRepository` in production.
"""

from __future__ import annotations

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped

from app.common.db import Base


class LLMModelORM(Base):
    """ORM mapping for ``llm_models``.

    Note: ``model_id`` is NOT the primary key. The same logical model is
    stored once per tenant (and once under ``_public``), so a synthetic
    auto-increment ``id`` is used as the PK. Business uniqueness is
    enforced by ``(tenant_id, provider, model_code)``.
    """

    __tablename__ = "llm_models"

    id: Mapped[int] = Column(BigInteger, primary_key=True, autoincrement=True)
    model_id: Mapped[str] = Column(String(128), nullable=False, index=True)
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
