"""Data access layer for short-term memory (conversation sessions & messages)."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Any, List, Optional

from app.memory.schemas import ConversationSession, Message, MessageRole


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:24]}"


class MemoryRepository(ABC):
    """Abstract repository for conversation memory."""

    @abstractmethod
    async def create_session(
        self, tenant_id: str, agent_id: str, title: str = ""
    ) -> ConversationSession: ...

    @abstractmethod
    async def get_session(
        self, session_id: str, tenant_id: str
    ) -> Optional[ConversationSession]: ...

    @abstractmethod
    async def list_sessions(
        self, tenant_id: str, agent_id: str
    ) -> List[ConversationSession]: ...

    @abstractmethod
    async def add_message(
        self,
        session_id: str,
        tenant_id: str,
        agent_id: str,
        role: MessageRole,
        content: str,
        metadata: Optional[dict] = None,
    ) -> Message: ...

    @abstractmethod
    async def get_messages(
        self, session_id: str, tenant_id: str, max_messages: int = 20
    ) -> List[Message]: ...

    @abstractmethod
    async def clear_session(self, session_id: str, tenant_id: str) -> bool: ...


class InMemoryMemoryRepository(MemoryRepository):
    """Thread-safe in-memory repository for conversation memory."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._sessions: dict[tuple[str, str], ConversationSession] = {}
        self._messages: dict[tuple[str, str], list[Message]] = {}

    async def create_session(
        self, tenant_id: str, agent_id: str, title: str = ""
    ) -> ConversationSession:
        with self._lock:
            session = ConversationSession(
                session_id=_new_id("sess"),
                tenant_id=tenant_id,
                agent_id=agent_id,
                title=title,
            )
            self._sessions[(tenant_id, session.session_id)] = session
            self._messages[(tenant_id, session.session_id)] = []
            return session

    async def get_session(
        self, session_id: str, tenant_id: str
    ) -> Optional[ConversationSession]:
        with self._lock:
            return self._sessions.get((tenant_id, session_id))

    async def list_sessions(
        self, tenant_id: str, agent_id: str
    ) -> List[ConversationSession]:
        with self._lock:
            results = [
                s
                for s in self._sessions.values()
                if s.tenant_id == tenant_id and s.agent_id == agent_id
            ]
        results.sort(key=lambda s: s.last_message_at or s.created_at, reverse=True)
        return results

    async def add_message(
        self,
        session_id: str,
        tenant_id: str,
        agent_id: str,
        role: MessageRole,
        content: str,
        metadata: Optional[dict] = None,
    ) -> Message:
        with self._lock:
            msg = Message(
                id=_new_id("msg"),
                session_id=session_id,
                agent_id=agent_id,
                tenant_id=tenant_id,
                role=role,
                content=content,
                metadata=metadata,
            )
            key = (tenant_id, session_id)
            self._messages.setdefault(key, []).append(msg)

            session = self._sessions.get(key)
            if session:
                session.message_count = len(self._messages[key])
                session.last_message_at = msg.created_at
            return msg

    async def get_messages(
        self, session_id: str, tenant_id: str, max_messages: int = 20
    ) -> List[Message]:
        with self._lock:
            msgs = list(self._messages.get((tenant_id, session_id), []))
        if max_messages > 0:
            msgs = msgs[-max_messages:]
        return msgs

    async def clear_session(self, session_id: str, tenant_id: str) -> bool:
        with self._lock:
            key = (tenant_id, session_id)
            existed = key in self._sessions
            self._sessions.pop(key, None)
            self._messages.pop(key, None)
            return existed

    # -- test helper --

    def clear(self) -> None:
        with self._lock:
            self._sessions.clear()
            self._messages.clear()
