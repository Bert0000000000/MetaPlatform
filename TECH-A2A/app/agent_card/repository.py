"""Data access layer for Agent Cards."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Any, Optional

from app.agent_card.schemas import AgentCard, CardStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return f"card-{uuid.uuid4().hex[:24]}"


class AgentCardRepository(ABC):
    """Abstract repository contract."""

    @abstractmethod
    async def create(self, card: AgentCard) -> AgentCard: ...

    @abstractmethod
    async def get(self, card_id: str, tenant_id: str) -> Optional[AgentCard]: ...

    @abstractmethod
    async def get_by_name(
        self, tenant_id: str, name: str
    ) -> Optional[AgentCard]: ...

    @abstractmethod
    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[CardStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AgentCard], int]: ...

    @abstractmethod
    async def search(
        self,
        tenant_id: str,
        *,
        name: Optional[str] = None,
        capability: Optional[str] = None,
        status: Optional[CardStatus] = None,
    ) -> list[AgentCard]: ...

    @abstractmethod
    async def update(
        self, card_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[AgentCard]: ...

    @abstractmethod
    async def delete(self, card_id: str, tenant_id: str) -> bool: ...

    @abstractmethod
    async def list_published(self) -> list[AgentCard]: ...


class InMemoryAgentCardRepository(AgentCardRepository):
    """Thread-safe in-memory repository."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._store: dict[tuple[str, str], AgentCard] = {}

    async def create(self, card: AgentCard) -> AgentCard:
        with self._lock:
            if not card.id:
                card.id = _new_id()
            card.created_at = _now()
            card.updated_at = card.created_at
            self._store[(card.tenant_id, card.id)] = card
            return card

    async def get(self, card_id: str, tenant_id: str) -> Optional[AgentCard]:
        with self._lock:
            return self._store.get((tenant_id, card_id))

    async def get_by_name(
        self, tenant_id: str, name: str
    ) -> Optional[AgentCard]:
        with self._lock:
            for (tid, _), card in self._store.items():
                if tid == tenant_id and card.name == name:
                    return card
            return None

    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[CardStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AgentCard], int]:
        with self._lock:
            results = [
                card
                for (tid, _), card in self._store.items()
                if tid == tenant_id and (status is None or card.status == status)
            ]
        results.sort(key=lambda c: c.created_at)
        total = len(results)
        start = (page - 1) * page_size
        end = start + page_size
        return results[start:end], total

    async def search(
        self,
        tenant_id: str,
        *,
        name: Optional[str] = None,
        capability: Optional[str] = None,
        status: Optional[CardStatus] = None,
    ) -> list[AgentCard]:
        with self._lock:
            results = []
            for (tid, _), card in self._store.items():
                if tid != tenant_id:
                    continue
                if status is not None and card.status != status:
                    continue
                if name is not None and name.lower() not in card.name.lower():
                    continue
                if capability is not None and capability not in card.capabilities:
                    continue
                results.append(card)
        results.sort(key=lambda c: c.created_at)
        return results

    async def update(
        self, card_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[AgentCard]:
        with self._lock:
            card = self._store.get((tenant_id, card_id))
            if card is None:
                return None
            updated = card.model_copy(update=fields)
            updated.updated_at = _now()
            self._store[(tenant_id, card_id)] = updated
            return updated

    async def delete(self, card_id: str, tenant_id: str) -> bool:
        with self._lock:
            return self._store.pop((tenant_id, card_id), None) is not None

    async def list_published(self) -> list[AgentCard]:
        with self._lock:
            return [
                card
                for (_, _), card in self._store.items()
                if card.status == CardStatus.PUBLISHED
            ]

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
