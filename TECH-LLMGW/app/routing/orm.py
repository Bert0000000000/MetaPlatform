from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class RoutingRuleORM(Base):
    __tablename__ = "llmgw_routing_rules"

    rule_id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, default="")
    required_capabilities = Column(ARRAY(String), default=list)
    preferred_provider = Column(String(64), nullable=True)
    strategy = Column(String(32), nullable=False, default="balanced")
    priority = Column(Integer, nullable=False, default=0)
    fallback_model_id = Column(String(64), nullable=True)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
