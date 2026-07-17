"""Data access layer for conversations."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Any, List, Optional

from app.conversations.schemas import (
    Conversation,
    ConversationMessage,
    ConversationStatus,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:24]}"


class ConversationRepository(ABC):
    """Abstract repository for conversations."""

    @abstractmethod
    async def create(
        self, tenant_id: str, agent_id: str, title: str = ""
    ) -> Conversation: ...

    @abstractmethod
    async def get(
        self, conversation_id: str, tenant_id: str
    ) -> Optional[Conversation]: ...

    @abstractmethod
    async def list(
        self,
        tenant_id: str,
        agent_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[Conversation], int]: ...

    @abstractmethod
    async def update(
        self, conversation_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[Conversation]: ...

    @abstractmethod
    async def add_message(
        self,
        conversation_id: str,
        tenant_id: str,
        role: str,
        content: str,
        metadata: Optional[dict] = None,
    ) -> ConversationMessage: ...

    @abstractmethod
    async def get_messages(
        self,
        conversation_id: str,
        tenant_id: str,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[List[ConversationMessage], int]: ...


class InMemoryConversationRepository(ConversationRepository):
    """Thread-safe in-memory conversation repository."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._conversations: dict[tuple[str, str], Conversation] = {}
        self._messages: dict[tuple[str, str], list[ConversationMessage]] = {}

    async def create(
        self, tenant_id: str, agent_id: str, title: str = ""
    ) -> Conversation:
        with self._lock:
            conv = Conversation(
                id=_new_id("conv"),
                tenant_id=tenant_id,
                agent_id=agent_id,
                title=title,
            )
            self._conversations[(tenant_id, conv.id)] = conv
            self._messages[(tenant_id, conv.id)] = []
            return conv

    async def get(
        self, conversation_id: str, tenant_id: str
    ) -> Optional[Conversation]:
        with self._lock:
            return self._conversations.get((tenant_id, conversation_id))

    async def list(
        self,
        tenant_id: str,
        agent_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[Conversation], int]:
        with self._lock:
            results = [
                c
                for (tid, _), c in self._conversations.items()
                if tid == tenant_id and (agent_id is None or c.agent_id == agent_id)
            ]
        results.sort(key=lambda c: c.updated_at, reverse=True)
        total = len(results)
        start = (page - 1) * page_size
        end = start + page_size
        return results[start:end], total

    async def update(
        self, conversation_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[Conversation]:
        with self._lock:
            conv = self._conversations.get((tenant_id, conversation_id))
            if conv is None:
                return None
            updated = conv.model_copy(update=fields)
            updated.updated_at = _now()
            self._conversations[(tenant_id, conversation_id)] = updated
            return updated

    async def add_message(
        self,
        conversation_id: str,
        tenant_id: str,
        role: str,
        content: str,
        metadata: Optional[dict] = None,
    ) -> ConversationMessage:
        with self._lock:
            msg = ConversationMessage(
                id=_new_id("cmsg"),
                conversation_id=conversation_id,
                tenant_id=tenant_id,
                role=role,
                content=content,
                metadata=metadata,
            )
            key = (tenant_id, conversation_id)
            self._messages.setdefault(key, []).append(msg)
            conv = self._conversations.get(key)
            if conv:
                conv.message_count = len(self._messages[key])
                conv.last_message_at = msg.created_at
                conv.updated_at = _now()
            return msg

    async def get_messages(
        self,
        conversation_id: str,
        tenant_id: str,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[List[ConversationMessage], int]:
        with self._lock:
            msgs = list(self._messages.get((tenant_id, conversation_id), []))
        total = len(msgs)
        start = (page - 1) * page_size
        end = start + page_size
        return msgs[start:end], total

    # -- test helper --

    def clear(self) -> None:
        with self._lock:
            self._conversations.clear()
            self._messages.clear()
