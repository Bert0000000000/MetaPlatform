"""Pydantic schemas for Agent Messaging."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class MessageStatus(str, Enum):
    PENDING = "PENDING"
    DELIVERED = "DELIVERED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    EXPIRED = "EXPIRED"


class AgentMessage(BaseModel):
    """A message between agents."""

    id: str
    tenant_id: str
    from_agent_id: str
    to_agent_id: str
    message_type: str = "text"
    content: Dict[str, Any] = Field(default_factory=dict)
    status: MessageStatus = MessageStatus.PENDING
    acknowledged_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SendMessageRequest(BaseModel):
    fromAgentId: str = Field(min_length=1, max_length=128)
    toAgentId: str = Field(min_length=1, max_length=128)
    messageType: str = "text"
    content: Dict[str, Any] = Field(default_factory=dict)
    ttlSeconds: Optional[int] = None


def message_to_dict(msg: AgentMessage) -> dict:
    status_value = msg.status.value if isinstance(msg.status, MessageStatus) else msg.status
    return {
        "messageId": msg.id,
        "tenantId": msg.tenant_id,
        "fromAgentId": msg.from_agent_id,
        "toAgentId": msg.to_agent_id,
        "messageType": msg.message_type,
        "content": msg.content,
        "status": status_value,
        "acknowledgedAt": msg.acknowledged_at,
        "expiresAt": msg.expires_at,
        "createdAt": msg.created_at,
        "updatedAt": msg.updated_at,
    }
