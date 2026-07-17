"""Pydantic schemas for conversation management (P2-AGT-16/17)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ConversationStatus(str, Enum):
    ACTIVE = "ACTIVE"
    ENDED = "ENDED"


class Conversation(BaseModel):
    """A conversation session tied to an agent."""

    id: str
    tenant_id: str
    agent_id: str
    title: str = ""
    status: ConversationStatus = ConversationStatus.ACTIVE
    message_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_message_at: Optional[datetime] = None


class ConversationMessage(BaseModel):
    """A message within a conversation."""

    id: str
    conversation_id: str
    tenant_id: str
    role: str
    content: str
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CreateConversationRequest(BaseModel):
    agentId: str = Field(min_length=1)
    title: str = ""


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=16384)
    metadata: Optional[Dict[str, Any]] = None


def conversation_to_dict(conv: Conversation) -> dict:
    return {
        "conversationId": conv.id,
        "tenantId": conv.tenant_id,
        "agentId": conv.agent_id,
        "title": conv.title,
        "status": conv.status.value,
        "messageCount": conv.message_count,
        "createdAt": conv.created_at,
        "updatedAt": conv.updated_at,
        "lastMessageAt": conv.last_message_at,
    }


def message_to_dict(msg: ConversationMessage) -> dict:
    return {
        "messageId": msg.id,
        "conversationId": msg.conversation_id,
        "tenantId": msg.tenant_id,
        "role": msg.role,
        "content": msg.content,
        "metadata": msg.metadata,
        "createdAt": msg.created_at,
    }
