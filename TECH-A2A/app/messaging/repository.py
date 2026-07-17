"""Data access layer for Agent Messages."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Any, Optional

from app.messaging.schemas import AgentMessage, MessageStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return f"msg-{uuid.uuid4().hex[:24]}"


class MessageRepository(ABC):
    """Abstract repository contract."""

    @abstractmethod
    async def create(self, msg: AgentMessage) -> AgentMessage: ...

    @abstractmethod
    async def get(self, msg_id: str, tenant_id: str) -> Optional[AgentMessage]: ...

    @abstractmethod
    async def list_queue(
        self,
        tenant_id: str,
        agent_id: str,
        *,
        status: Optional[MessageStatus] = None,
    ) -> list[AgentMessage]: ...

    @abstractmethod
    async def update(
        self, msg_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[AgentMessage]: ...

    @abstractmethod
    async def delete(self, msg_id: str, tenant_id: str) -> bool: ...

    @abstractmethod
    async def list_expired(self) -> list[AgentMessage]: ...


class InMemoryMessageRepository(MessageRepository):
    """Thread-safe in-memory repository."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._store: dict[tuple[str, str], AgentMessage] = {}

    async def create(self, msg: AgentMessage) -> AgentMessage:
        with self._lock:
            if not msg.id:
                msg.id = _new_id()
            msg.created_at = _now()
            msg.updated_at = msg.created_at
            self._store[(msg.tenant_id, msg.id)] = msg
            return msg

    async def get(self, msg_id: str, tenant_id: str) -> Optional[AgentMessage]:
        with self._lock:
            return self._store.get((tenant_id, msg_id))

    async def list_queue(
        self,
        tenant_id: str,
        agent_id: str,
        *,
        status: Optional[MessageStatus] = None,
    ) -> list[AgentMessage]:
        with self._lock:
            results = [
                msg
                for (tid, _), msg in self._store.items()
                if tid == tenant_id
                and msg.to_agent_id == agent_id
                and (status is None or msg.status == status)
            ]
        results.sort(key=lambda m: m.created_at)
        return results

    async def update(
        self, msg_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[AgentMessage]:
        with self._lock:
            msg = self._store.get((tenant_id, msg_id))
            if msg is None:
                return None
            updated = msg.model_copy(update=fields)
            updated.updated_at = _now()
            self._store[(tenant_id, msg_id)] = updated
            return updated

    async def delete(self, msg_id: str, tenant_id: str) -> bool:
        with self._lock:
            return self._store.pop((tenant_id, msg_id), None) is not None

    async def list_expired(self) -> list[AgentMessage]:
        now = _now()
        with self._lock:
            return [
                msg
                for (_, _), msg in self._store.items()
                if msg.expires_at is not None and msg.expires_at < now and msg.status != MessageStatus.EXPIRED
            ]

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
