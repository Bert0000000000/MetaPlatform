"""Data access layer for conversations."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from threading import RLock
from typing import Any, List, Optional

from app.agents.orm import Base
from app.conversations.orm import ConversationMessageORM, ConversationORM
from app.conversations.schemas import (
    Conversation,
    ConversationMessage,
    ConversationStatus,
)


def _conv_row_to_model(row: ConversationORM) -> Conversation:
    return Conversation(
        id=row.id,
        tenant_id=row.tenant_id,
        agent_id=row.agent_id,
        title=row.title or "",
        status=ConversationStatus(row.status),
        message_count=row.message_count,
        created_at=row.created_at if row.created_at else _now(),
        updated_at=row.updated_at if row.updated_at else _now(),
        last_message_at=row.last_message_at,
    )


def _msg_row_to_model(row: ConversationMessageORM) -> ConversationMessage:
    return ConversationMessage(
        id=row.id,
        conversation_id=row.conversation_id,
        tenant_id=row.tenant_id,
        role=row.role,
        content=row.content,
        metadata=dict(row.meta_data) if row.meta_data else None,
        created_at=row.created_at if row.created_at else _now(),
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


class SqlAlchemyConversationRepository(ConversationRepository):
    """Async SQLAlchemy 2.0 repository backed by conversation tables."""

    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    @classmethod
    async def create_all(cls, engine) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def create(
        self, tenant_id: str, agent_id: str, title: str = ""
    ) -> Conversation:
        conv_id = _new_id("conv")
        now = _now()
        row = ConversationORM(
            id=conv_id,
            tenant_id=tenant_id,
            agent_id=agent_id,
            title=title,
            status=ConversationStatus.ACTIVE.value,
            message_count=0,
            created_at=now,
            updated_at=now,
        )
        async with self._session_factory() as session:
            session.add(row)
            await session.commit()
            return _conv_row_to_model(row)

    async def get(
        self, conversation_id: str, tenant_id: str
    ) -> Optional[Conversation]:
        async with self._session_factory() as session:
            row = await session.get(ConversationORM, conversation_id)
            if row is None or row.tenant_id != tenant_id:
                return None
            return _conv_row_to_model(row)

    async def list(
        self,
        tenant_id: str,
        agent_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[Conversation], int]:
        from sqlalchemy import func, select

        async with self._session_factory() as session:
            base = select(ConversationORM).where(
                ConversationORM.tenant_id == tenant_id
            )
            count_base = select(func.count()).select_from(ConversationORM).where(
                ConversationORM.tenant_id == tenant_id
            )
            if agent_id is not None:
                base = base.where(ConversationORM.agent_id == agent_id)
                count_base = count_base.where(
                    ConversationORM.agent_id == agent_id
                )
            total = (await session.execute(count_base)).scalar_one()
            rows = (
                await session.execute(
                    base.order_by(ConversationORM.updated_at.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).scalars().all()
            return [_conv_row_to_model(r) for r in rows], total

    async def update(
        self, conversation_id: str, tenant_id: str, fields: dict[str, Any]
    ) -> Optional[Conversation]:
        async with self._session_factory() as session:
            row = await session.get(ConversationORM, conversation_id)
            if row is None or row.tenant_id != tenant_id:
                return None
            if "title" in fields:
                row.title = fields["title"]
            if "status" in fields:
                row.status = fields["status"].value
            if "message_count" in fields:
                row.message_count = fields["message_count"]
            if "last_message_at" in fields:
                row.last_message_at = fields["last_message_at"]
            row.updated_at = _now()
            await session.commit()
            return _conv_row_to_model(row)

    async def add_message(
        self,
        conversation_id: str,
        tenant_id: str,
        role: str,
        content: str,
        metadata: Optional[dict] = None,
    ) -> ConversationMessage:
        msg_id = _new_id("cmsg")
        now = _now()
        msg_row = ConversationMessageORM(
            id=msg_id,
            conversation_id=conversation_id,
            tenant_id=tenant_id,
            role=role,
            content=content,
            meta_data=dict(metadata) if metadata else None,
            created_at=now,
        )
        async with self._session_factory() as session:
            session.add(msg_row)
            conv_row = await session.get(ConversationORM, conversation_id)
            if conv_row and conv_row.tenant_id == tenant_id:
                conv_row.message_count = conv_row.message_count + 1
                conv_row.last_message_at = now
                conv_row.updated_at = now
            await session.commit()
            return _msg_row_to_model(msg_row)

    async def get_messages(
        self,
        conversation_id: str,
        tenant_id: str,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[List[ConversationMessage], int]:
        from sqlalchemy import func, select

        async with self._session_factory() as session:
            base = select(ConversationMessageORM).where(
                ConversationMessageORM.conversation_id == conversation_id,
                ConversationMessageORM.tenant_id == tenant_id,
            )
            count_base = (
                select(func.count())
                .select_from(ConversationMessageORM)
                .where(
                    ConversationMessageORM.conversation_id == conversation_id,
                    ConversationMessageORM.tenant_id == tenant_id,
                )
            )
            total = (await session.execute(count_base)).scalar_one()
            rows = (
                await session.execute(
                    base.order_by(ConversationMessageORM.created_at)
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).scalars().all()
            return [_msg_row_to_model(r) for r in rows], total
