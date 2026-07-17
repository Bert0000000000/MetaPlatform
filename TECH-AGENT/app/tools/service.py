"""Agent tool service: register, get, list, invoke, update, enable/disable, delete."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.clients.action import ActionClient
from app.clients.rag import RAGClient
from app.common.errors import InvalidParamError
from app.tools.repository import ToolRepository
from app.tools.schemas import (
    AgentTool,
    CreateToolRequest,
    ToolType,
    UpdateToolRequest,
)


class ToolService:
    def __init__(
        self,
        repository: ToolRepository,
        action_client: Optional[ActionClient] = None,
        rag_client: Optional[RAGClient] = None,
    ) -> None:
        self._repo = repository
        self._action_client = action_client
        self._rag_client = rag_client

    async def register(
        self,
        tenant_id: str,
        request: CreateToolRequest,
    ) -> AgentTool:
        tool = AgentTool(
            id="",
            tenant_id=tenant_id,
            agent_id=request.agentId,
            name=request.name,
            description=request.description,
            tool_type=request.toolType,
            config=request.config,
            input_schema=request.inputSchema,
            output_schema=request.outputSchema,
            enabled=request.enabled,
        )
        return await self._repo.create(tool)

    async def get(self, tenant_id: str, tool_id: str) -> AgentTool:
        tool = await self._repo.get(tool_id, tenant_id)
        if tool is None:
            raise InvalidParamError(
                f"工具不存在: toolId={tool_id}",
                data={"toolId": tool_id},
            )
        return tool

    async def list(
        self,
        tenant_id: str,
        agent_id: str,
        *,
        enabled_only: bool = False,
    ) -> List[AgentTool]:
        return await self._repo.list(tenant_id, agent_id, enabled_only=enabled_only)

    async def update(
        self,
        tenant_id: str,
        tool_id: str,
        request: UpdateToolRequest,
    ) -> AgentTool:
        tool = await self.get(tenant_id, tool_id)
        fields: dict[str, Any] = {}
        if request.name is not None:
            fields["name"] = request.name
        if request.description is not None:
            fields["description"] = request.description
        if request.toolType is not None:
            fields["tool_type"] = request.toolType
        if request.config is not None:
            fields["config"] = request.config
        if request.inputSchema is not None:
            fields["input_schema"] = request.inputSchema
        if request.outputSchema is not None:
            fields["output_schema"] = request.outputSchema

        if not fields:
            return tool

        updated = await self._repo.update(tool_id, tenant_id, fields)
        assert updated is not None
        return updated

    async def enable(self, tenant_id: str, tool_id: str) -> AgentTool:
        updated = await self._repo.update(tool_id, tenant_id, {"enabled": True})
        if updated is None:
            raise InvalidParamError(
                f"工具不存在: toolId={tool_id}",
                data={"toolId": tool_id},
            )
        return updated

    async def disable(self, tenant_id: str, tool_id: str) -> AgentTool:
        updated = await self._repo.update(tool_id, tenant_id, {"enabled": False})
        if updated is None:
            raise InvalidParamError(
                f"工具不存在: toolId={tool_id}",
                data={"toolId": tool_id},
            )
        return updated

    async def delete(self, tenant_id: str, tool_id: str) -> bool:
        await self.get(tenant_id, tool_id)
        return await self._repo.delete(tool_id, tenant_id)

    async def invoke(
        self,
        tenant_id: str,
        tool_id: str,
        input_data: Dict[str, Any],
        *,
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Execute a tool based on its type."""
        tool = await self.get(tenant_id, tool_id)
        if not tool.enabled:
            raise InvalidParamError(
                f"工具已禁用: toolId={tool_id}",
                data={"toolId": tool_id},
            )

        if tool.tool_type == ToolType.ACTION:
            if self._action_client is None:
                raise InvalidParamError("Action 客户端未配置")
            action_code = tool.config.get("actionCode", tool.name)
            result = await self._action_client.execute(
                action_code,
                input_data,
                tenant_id=tenant_id,
                trace_id=trace_id,
            )
            return {"status": "SUCCESS", "output": result.get("output", result)}

        if tool.tool_type == ToolType.RAG:
            if self._rag_client is None:
                raise InvalidParamError("RAG 客户端未配置")
            query = input_data.get("query", str(input_data))
            knowledge_base_ids = tool.config.get("knowledgeBaseIds")
            results = await self._rag_client.search(
                query,
                knowledge_base_ids,
                tenant_id=tenant_id,
                trace_id=trace_id,
            )
            return {"status": "SUCCESS", "output": {"results": results}}

        if tool.tool_type == ToolType.HTTP:
            return {
                "status": "SUCCESS",
                "output": {"message": "HTTP tool invocation (mock)", "input": input_data},
            }

        if tool.tool_type == ToolType.BEAN:
            return {
                "status": "SUCCESS",
                "output": {"message": "Bean tool invocation (mock)", "input": input_data},
            }

        raise InvalidParamError(f"不支持的工具类型: {tool.tool_type}")
