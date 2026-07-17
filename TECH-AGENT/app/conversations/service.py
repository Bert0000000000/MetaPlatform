"""Conversation service: create, send message, stream, list, history, end."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, List, Optional

from app.agents.service import AgentService
from app.common.errors import AgentNotActiveError, InvalidParamError
from app.conversations.repository import ConversationRepository
from app.conversations.schemas import (
    Conversation,
    ConversationMessage,
    ConversationStatus,
    SendMessageRequest,
)
from app.execution.schemas import ExecuteRequest
from app.execution.service import ExecutionService


class ConversationService:
    def __init__(
        self,
        repository: ConversationRepository,
        agent_service: AgentService,
        execution_service: ExecutionService,
    ) -> None:
        self._repo = repository
        self._agent_service = agent_service
        self._execution_service = execution_service

    async def create_conversation(
        self,
        tenant_id: str,
        agent_id: str,
        title: str = "",
    ) -> Conversation:
        # Validate agent exists
        await self._agent_service.get(tenant_id, agent_id)
        return await self._repo.create(tenant_id, agent_id, title)

    async def get_conversation(
        self,
        tenant_id: str,
        conversation_id: str,
    ) -> Conversation:
        conv = await self._repo.get(conversation_id, tenant_id)
        if conv is None:
            raise InvalidParamError(
                f"会话不存在: conversationId={conversation_id}",
                data={"conversationId": conversation_id},
            )
        return conv

    async def list_conversations(
        self,
        tenant_id: str,
        *,
        agent_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[Conversation], int]:
        return await self._repo.list(
            tenant_id, agent_id=agent_id, page=page, page_size=page_size
        )

    async def send_message(
        self,
        tenant_id: str,
        conversation_id: str,
        request: SendMessageRequest,
        *,
        trace_id: Optional[str] = None,
    ) -> ConversationMessage:
        """Send a message and get a synchronous response."""
        conv = await self.get_conversation(tenant_id, conversation_id)
        if conv.status == ConversationStatus.ENDED:
            raise InvalidParamError(
                "会话已结束，无法发送消息",
                data={"conversationId": conversation_id},
            )

        # Store user message
        await self._repo.add_message(
            conversation_id, tenant_id, "user", request.content, request.metadata
        )

        # Execute via the agent engine
        exec_request = ExecuteRequest(
            input=request.content,
            context={"conversationId": conversation_id} if conversation_id else None,
        )
        response = await self._execution_service.execute(
            tenant_id, conv.agent_id, exec_request, trace_id=trace_id
        )

        # Store assistant response
        assistant_msg = await self._repo.add_message(
            conversation_id,
            tenant_id,
            "assistant",
            response.output.content,
            metadata={
                "executionId": response.executionId,
                "traceId": trace_id,
            },
        )
        return assistant_msg

    async def stream_message(
        self,
        tenant_id: str,
        conversation_id: str,
        request: SendMessageRequest,
        *,
        trace_id: Optional[str] = None,
    ) -> AsyncIterator[Dict[str, Any]]:
        """Stream a message response via SSE."""
        conv = await self.get_conversation(tenant_id, conversation_id)
        if conv.status == ConversationStatus.ENDED:
            raise InvalidParamError(
                "会话已结束，无法发送消息",
                data={"conversationId": conversation_id},
            )

        # Store user message
        await self._repo.add_message(
            conversation_id, tenant_id, "user", request.content, request.metadata
        )

        # Stream execution events
        exec_request = ExecuteRequest(
            input=request.content,
            context={"conversationId": conversation_id} if conversation_id else None,
        )
        full_content = ""
        async for event in self._execution_service.stream(
            tenant_id, conv.agent_id, exec_request, trace_id=trace_id
        ):
            if event["event"] == "content.done":
                full_content = event["data"].get("content", "")
            yield event

        # Store the assistant response
        if full_content:
            await self._repo.add_message(
                conversation_id,
                tenant_id,
                "assistant",
                full_content,
                metadata={"traceId": trace_id},
            )

    async def get_history(
        self,
        tenant_id: str,
        conversation_id: str,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[List[ConversationMessage], int]:
        await self.get_conversation(tenant_id, conversation_id)
        return await self._repo.get_messages(
            conversation_id, tenant_id, page=page, page_size=page_size
        )

    async def end_conversation(
        self,
        tenant_id: str,
        conversation_id: str,
    ) -> Conversation:
        conv = await self.get_conversation(tenant_id, conversation_id)
        if conv.status == ConversationStatus.ENDED:
            return conv
        updated = await self._repo.update(
            conversation_id,
            tenant_id,
            {"status": ConversationStatus.ENDED},
        )
        assert updated is not None
        return updated
