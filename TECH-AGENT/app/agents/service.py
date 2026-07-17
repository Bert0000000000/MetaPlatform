"""Agent definition service: orchestrates CRUD and tenant isolation."""

from __future__ import annotations

from typing import Any, Optional

from app.agents.repository import AgentRepository
from app.agents.schemas import Agent, AgentStatus, CreateAgentRequest, UpdateAgentRequest
from app.common.errors import (
    AgentNotFoundError,
    DuplicateAgentCodeError,
    InvalidParamError,
)


class AgentService:
    def __init__(self, repository: AgentRepository) -> None:
        self._repo = repository

    async def create(
        self,
        tenant_id: str,
        request: CreateAgentRequest,
        *,
        created_by: Optional[str] = None,
    ) -> Agent:
        existing = await self._repo.get_by_code(tenant_id, request.code)
        if existing is not None:
            raise DuplicateAgentCodeError(
                f"Agent code 已存在: {request.code}",
                data={"code": request.code},
            )

        agent = Agent(
            id="",
            tenant_id=tenant_id,
            agent_code=request.code,
            name=request.name,
            description=request.description,
            model_id=request.modelId,
            system_prompt=request.systemPrompt,
            tools=list(request.tools),
            rag_scopes=list(request.ragScopes),
            temperature=request.temperature,
            max_tokens=request.maxTokens,
            status=request.status,
        )
        return await self._repo.create(agent)

    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[AgentStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Agent], int]:
        return await self._repo.list(
            tenant_id,
            status=status,
            page=page,
            page_size=page_size,
        )

    async def get(self, tenant_id: str, agent_id: str) -> Agent:
        agent = await self._repo.get(agent_id, tenant_id)
        if agent is None:
            raise AgentNotFoundError(
                f"Agent 不存在: agentId={agent_id}",
                data={"agentId": agent_id},
            )
        return agent

    async def update(
        self,
        tenant_id: str,
        agent_id: str,
        request: UpdateAgentRequest,
    ) -> Agent:
        agent = await self._repo.get(agent_id, tenant_id)
        if agent is None:
            raise AgentNotFoundError(
                f"Agent 不存在: agentId={agent_id}",
                data={"agentId": agent_id},
            )

        fields: dict[str, Any] = {}
        if request.name is not None:
            fields["name"] = request.name
        if request.code is not None:
            # Ensure uniqueness within tenant excluding current agent.
            if request.code != agent.agent_code:
                existing = await self._repo.get_by_code(tenant_id, request.code)
                if existing is not None and existing.id != agent_id:
                    raise DuplicateAgentCodeError(
                        f"Agent code 已存在: {request.code}",
                        data={"code": request.code},
                    )
            fields["agent_code"] = request.code
        if request.description is not None:
            fields["description"] = request.description
        if request.modelId is not None:
            fields["model_id"] = request.modelId
        if request.systemPrompt is not None:
            fields["system_prompt"] = request.systemPrompt
        if request.tools is not None:
            fields["tools"] = list(request.tools)
        if request.ragScopes is not None:
            fields["rag_scopes"] = list(request.ragScopes)
        if request.temperature is not None:
            fields["temperature"] = request.temperature
        if request.maxTokens is not None:
            fields["max_tokens"] = request.maxTokens
        if request.status is not None:
            fields["status"] = request.status

        if not fields:
            return agent

        updated = await self._repo.update(agent_id, tenant_id, fields)
        if updated is None:
            raise AgentNotFoundError(
                f"Agent 不存在: agentId={agent_id}",
                data={"agentId": agent_id},
            )
        return updated

    async def delete(self, tenant_id: str, agent_id: str) -> bool:
        agent = await self._repo.get(agent_id, tenant_id)
        if agent is None:
            raise AgentNotFoundError(
                f"Agent 不存在: agentId={agent_id}",
                data={"agentId": agent_id},
            )
        if agent.status == AgentStatus.ACTIVE:
            raise InvalidParamError(
                "无法删除 ACTIVE 状态的 Agent，请先禁用",
                data={"agentId": agent_id, "status": agent.status.value},
            )
        return await self._repo.delete(agent_id, tenant_id)
