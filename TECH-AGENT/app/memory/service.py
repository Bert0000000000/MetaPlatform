"""Short-term memory service: conversation context management."""

from __future__ import annotations

from typing import List, Optional

from app.common.errors import InvalidParamError
from app.memory.repository import MemoryRepository
from app.memory.schemas import (
    ConversationSession,
    Message,
    MessageRole,
)


class MemoryService:
    def __init__(self, repository: MemoryRepository) -> None:
        self._repo = repository

    async def create_session(
        self,
        tenant_id: str,
        agent_id: str,
        title: str = "",
    ) -> ConversationSession:
        return await self._repo.create_session(tenant_id, agent_id, title)

    async def add_message(
        self,
        tenant_id: str,
        session_id: str,
        agent_id: str,
        role: MessageRole,
        content: str,
        metadata: Optional[dict] = None,
    ) -> Message:
        session = await self._repo.get_session(session_id, tenant_id)
        if session is None:
            raise InvalidParamError(
                f"会话不存在: sessionId={session_id}",
                data={"sessionId": session_id},
            )
        return await self._repo.add_message(
            session_id, tenant_id, agent_id, role, content, metadata
        )

    async def get_context(
        self,
        tenant_id: str,
        session_id: str,
        max_messages: int = 20,
    ) -> List[Message]:
        """Retrieve conversation context (most recent messages)."""
        return await self._repo.get_messages(session_id, tenant_id, max_messages)

    async def clear_session(self, tenant_id: str, session_id: str) -> bool:
        return await self._repo.clear_session(session_id, tenant_id)

    async def list_sessions(
        self,
        tenant_id: str,
        agent_id: str,
    ) -> List[ConversationSession]:
        return await self._repo.list_sessions(tenant_id, agent_id)
