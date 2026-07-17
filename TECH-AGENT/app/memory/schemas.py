"""Pydantic schemas for short-term memory (conversation context management)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


class Message(BaseModel):
    """A single message in a conversation session."""

    id: str
    session_id: str
    agent_id: str
    tenant_id: str
    role: MessageRole
    content: str
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ConversationSession(BaseModel):
    """A conversation session bound to an agent."""

    session_id: str
    agent_id: str
    tenant_id: str
    title: str = ""
    message_count: int = 0
    last_message_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AddMessageRequest(BaseModel):
    role: MessageRole = MessageRole.USER
    content: str = Field(min_length=1, max_length=16384)
    metadata: Optional[Dict[str, Any]] = None


class CreateSessionRequest(BaseModel):
    agentId: str = Field(min_length=1)
    title: str = ""


def message_to_dict(msg: Message) -> dict:
    return {
        "messageId": msg.id,
        "sessionId": msg.session_id,
        "agentId": msg.agent_id,
        "tenantId": msg.tenant_id,
        "role": msg.role.value,
        "content": msg.content,
        "metadata": msg.metadata,
        "createdAt": msg.created_at,
    }


def session_to_dict(session: ConversationSession) -> dict:
    return {
        "sessionId": session.session_id,
        "agentId": session.agent_id,
        "tenantId": session.tenant_id,
        "title": session.title,
        "messageCount": session.message_count,
        "lastMessageAt": session.last_message_at,
        "createdAt": session.created_at,
    }
