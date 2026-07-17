"""Agent Messaging service: send, receive, acknowledge, queue, cleanup."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from app.common.errors import MessageNotFoundError
from app.messaging.repository import MessageRepository
from app.messaging.schemas import (
    AgentMessage,
    MessageStatus,
    SendMessageRequest,
    message_to_dict,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class MessagingService:
    def __init__(self, repository: MessageRepository) -> None:
        self._repo = repository

    async def send(
        self,
        tenant_id: str,
        request: SendMessageRequest,
    ) -> AgentMessage:
        expires_at = None
        if request.ttlSeconds is not None:
            expires_at = _now() + timedelta(seconds=request.ttlSeconds)

        msg = AgentMessage(
            id="",
            tenant_id=tenant_id,
            from_agent_id=request.fromAgentId,
            to_agent_id=request.toAgentId,
            message_type=request.messageType,
            content=dict(request.content),
            status=MessageStatus.DELIVERED,
            expires_at=expires_at,
        )
        return await self._repo.create(msg)

    async def receive(
        self,
        tenant_id: str,
        agent_id: str,
        *,
        limit: int = 10,
    ) -> list[AgentMessage]:
        """Receive pending messages for an agent (marks them as DELIVERED)."""
        messages = await self._repo.list_queue(
            tenant_id, agent_id, status=MessageStatus.PENDING
        )
        received = messages[:limit]
        for msg in received:
            await self._repo.update(msg.id, tenant_id, {"status": MessageStatus.DELIVERED})
        return received

    async def acknowledge(
        self,
        tenant_id: str,
        message_id: str,
    ) -> AgentMessage:
        msg = await self._repo.get(message_id, tenant_id)
        if msg is None:
            raise MessageNotFoundError(
                f"消息不存在: messageId={message_id}",
                data={"messageId": message_id},
            )
        updated = await self._repo.update(message_id, tenant_id, {
            "status": MessageStatus.ACKNOWLEDGED,
            "acknowledged_at": _now(),
        })
        if updated is None:
            raise MessageNotFoundError(
                f"消息不存在: messageId={message_id}",
                data={"messageId": message_id},
            )
        return updated

    async def list_queue(
        self,
        tenant_id: str,
        agent_id: str,
        *,
        status: Optional[MessageStatus] = None,
    ) -> list[AgentMessage]:
        return await self._repo.list_queue(tenant_id, agent_id, status=status)

    async def cleanup_expired(self) -> int:
        """Mark expired messages as EXPIRED. Returns count cleaned up."""
        expired = await self._repo.list_expired()
        count = 0
        for msg in expired:
            updated = await self._repo.update(msg.id, msg.tenant_id, {
                "status": MessageStatus.EXPIRED,
            })
            if updated is not None:
                count += 1
        return count

    async def get(self, tenant_id: str, message_id: str) -> AgentMessage:
        msg = await self._repo.get(message_id, tenant_id)
        if msg is None:
            raise MessageNotFoundError(
                f"消息不存在: messageId={message_id}",
                data={"messageId": message_id},
            )
        return msg
