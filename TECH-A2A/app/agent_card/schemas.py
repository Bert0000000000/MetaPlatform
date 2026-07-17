"""Pydantic schemas for Agent Card (A2A protocol)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CardStatus(str, Enum):
    PUBLISHED = "PUBLISHED"
    UNPUBLISHED = "UNPUBLISHED"
    REVOKED = "REVOKED"


class AgentCard(BaseModel):
    """A2A-compatible Agent Card."""

    id: str
    tenant_id: str
    name: str
    description: str = ""
    version: str = "1.0.0"
    protocol_version: str = "0.3.0"
    capabilities: List[str] = Field(default_factory=list)
    endpoints: Dict[str, str] = Field(default_factory=dict)
    authentication: Dict[str, Any] = Field(default_factory=dict)
    metadata: Optional[Dict[str, Any]] = None
    status: CardStatus = CardStatus.PUBLISHED
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PublishAgentCardRequest(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    description: str = ""
    version: str = "1.0.0"
    protocolVersion: str = "0.3.0"
    capabilities: List[str] = Field(default_factory=list)
    endpoints: Dict[str, str] = Field(default_factory=dict)
    authentication: Dict[str, Any] = Field(default_factory=dict)
    metadata: Optional[Dict[str, Any]] = None
    status: CardStatus = CardStatus.PUBLISHED


class UpdateAgentCardRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=256)
    description: Optional[str] = None
    version: Optional[str] = None
    protocolVersion: Optional[str] = None
    capabilities: Optional[List[str]] = None
    endpoints: Optional[Dict[str, str]] = None
    authentication: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    status: Optional[CardStatus] = None


def card_to_dict(card: AgentCard) -> dict:
    """Serialize AgentCard to API response shape (camelCase)."""

    status_value = card.status.value if isinstance(card.status, CardStatus) else card.status
    return {
        "cardId": card.id,
        "tenantId": card.tenant_id,
        "name": card.name,
        "description": card.description,
        "version": card.version,
        "protocolVersion": card.protocol_version,
        "capabilities": list(card.capabilities),
        "endpoints": dict(card.endpoints),
        "authentication": dict(card.authentication),
        "metadata": card.metadata,
        "status": status_value,
        "createdAt": card.created_at,
        "updatedAt": card.updated_at,
    }


def card_to_public_dict(card: AgentCard) -> dict:
    """Serialize AgentCard to the public .well-known/agent.json shape."""

    return {
        "@context": "https://www.w3.org/ns/agent-card/v1",
        "@type": "AgentCard",
        "id": card.id,
        "name": card.name,
        "description": card.description,
        "version": card.version,
        "protocolVersion": card.protocol_version,
        "capabilities": list(card.capabilities),
        "endpoints": dict(card.endpoints),
        "authentication": dict(card.authentication),
        "metadata": card.metadata,
    }
