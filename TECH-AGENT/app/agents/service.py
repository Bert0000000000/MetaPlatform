"""Agent definition service: orchestrates CRUD and tenant isolation."""

from __future__ import annotations

from typing import Any, Optional

from app.agents.repository import AgentRepository
from app.agents.schemas import (
    Agent,
    AgentOperationLog,
    AgentStatus,
    AgentVersion,
    CloneAgentRequest,
    CreateAgentRequest,
    UpdateAgentRequest,
    to_dict,
)
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
        created = await self._repo.create(agent)

        # 记录初始版本与创建日志
        await self._repo.record_version(
            AgentVersion(
                id="",
                tenant_id=tenant_id,
                agent_id=created.id,
                version="1.0.0",
                change_log="初始创建",
                snapshot=to_dict(created),
                created_by=created_by,
            )
        )
        await self._repo.record_log(
            AgentOperationLog(
                id="",
                tenant_id=tenant_id,
                agent_id=created.id,
                actor=created_by or "system",
                action="create",
                resource="agent",
            )
        )
        return created

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
        *,
        updated_by: Optional[str] = None,
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

        # 记录更新版本与操作日志
        change_log = self._summarize_changes(fields)
        await self._repo.record_version(
            AgentVersion(
                id="",
                tenant_id=tenant_id,
                agent_id=updated.id,
                version=self._bump_version(await self._latest_version(tenant_id, updated.id)),
                change_log=change_log,
                snapshot=to_dict(updated),
                created_by=updated_by,
            )
        )
        await self._repo.record_log(
            AgentOperationLog(
                id="",
                tenant_id=tenant_id,
                agent_id=updated.id,
                actor=updated_by or "system",
                action="update",
                resource="agent",
            )
        )
        return updated

    async def delete(
        self,
        tenant_id: str,
        agent_id: str,
        *,
        deleted_by: Optional[str] = None,
    ) -> bool:
        """软删除 Agent：仅允许删除 DRAFT/DISABLED 状态的 Agent。

        - 物理上保留记录，将 deleted_at 标记为当前时间。
        - 后续的 get/list/get_by_code 等查询会过滤掉已软删除的记录。
        - 记录 delete 操作日志，便于审计追溯。
        """
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
        deleted = await self._repo.delete(agent_id, tenant_id)
        if deleted:
            await self._repo.record_log(
                AgentOperationLog(
                    id="",
                    tenant_id=tenant_id,
                    agent_id=agent_id,
                    actor=deleted_by or "system",
                    action="delete",
                    resource="agent",
                )
            )
        return deleted

    async def clone(
        self,
        tenant_id: str,
        agent_id: str,
        request: CloneAgentRequest,
        *,
        cloned_by: Optional[str] = None,
    ) -> Agent:
        """克隆 Agent：以源 Agent 为模板创建新 Agent。

        - 校验源 Agent 存在（未软删除）。
        - 校验新 code 在同一租户内唯一。
        - 复制源 Agent 的全部能力配置（model、prompt、tools、rag_scopes、温度等）。
        - 新 Agent 状态为 DRAFT，需重新启用后才可执行任务。
        - 在源 Agent 上记录版本快照（changeLog=clone）与操作日志（action=clone），
          用于追溯"哪一份配置被克隆出去"。
        - 在新 Agent 上记录初始版本（1.0.0）与创建日志（action=create）。
        """
        source = await self._repo.get(agent_id, tenant_id)
        if source is None:
            raise AgentNotFoundError(
                f"Agent 不存在: agentId={agent_id}",
                data={"agentId": agent_id},
            )

        existing = await self._repo.get_by_code(tenant_id, request.code)
        if existing is not None:
            raise DuplicateAgentCodeError(
                f"Agent code 已存在: {request.code}",
                data={"code": request.code},
            )

        clone = Agent(
            id="",
            tenant_id=tenant_id,
            agent_code=request.code,
            name=request.name,
            description=source.description,
            model_id=source.model_id,
            system_prompt=source.system_prompt,
            tools=list(source.tools),
            rag_scopes=list(source.rag_scopes),
            temperature=source.temperature,
            max_tokens=source.max_tokens,
            status=AgentStatus.DRAFT,
        )
        created = await self._repo.create(clone)

        # 源 Agent 记录版本快照（保留克隆时的配置快照）与克隆操作日志。
        await self._repo.record_version(
            AgentVersion(
                id="",
                tenant_id=tenant_id,
                agent_id=source.id,
                version=self._bump_version(await self._latest_version(tenant_id, source.id)),
                change_log=f"克隆至新 Agent：{request.name}（{request.code}）",
                snapshot=to_dict(source),
                created_by=cloned_by,
            )
        )
        await self._repo.record_log(
            AgentOperationLog(
                id="",
                tenant_id=tenant_id,
                agent_id=source.id,
                actor=cloned_by or "system",
                action="clone",
                resource="agent",
            )
        )

        # 新 Agent 记录初始版本与创建日志。
        await self._repo.record_version(
            AgentVersion(
                id="",
                tenant_id=tenant_id,
                agent_id=created.id,
                version="1.0.0",
                change_log=f"克隆自 Agent：{source.name}（{source.agent_code}）",
                snapshot=to_dict(created),
                created_by=cloned_by,
            )
        )
        await self._repo.record_log(
            AgentOperationLog(
                id="",
                tenant_id=tenant_id,
                agent_id=created.id,
                actor=cloned_by or "system",
                action="create",
                resource="agent",
            )
        )
        return created

    async def list_versions(
        self,
        tenant_id: str,
        agent_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AgentVersion], int]:
        # 审计端点：允许查询已软删除 Agent 的历史版本，便于追溯。
        if await self._repo.get_including_deleted(agent_id, tenant_id) is None:
            raise AgentNotFoundError(
                f"Agent 不存在: agentId={agent_id}",
                data={"agentId": agent_id},
            )
        return await self._repo.list_versions(
            agent_id, tenant_id, page=page, page_size=page_size
        )

    async def list_logs(
        self,
        tenant_id: str,
        agent_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AgentOperationLog], int]:
        # 审计端点：允许查询已软删除 Agent 的操作日志，便于追溯。
        if await self._repo.get_including_deleted(agent_id, tenant_id) is None:
            raise AgentNotFoundError(
                f"Agent 不存在: agentId={agent_id}",
                data={"agentId": agent_id},
            )
        return await self._repo.list_logs(
            agent_id, tenant_id, page=page, page_size=page_size
        )

    async def _latest_version(self, tenant_id: str, agent_id: str) -> Optional[str]:
        versions, _ = await self._repo.list_versions(
            agent_id, tenant_id, page=1, page_size=1
        )
        if not versions:
            return None
        return versions[0].version

    @staticmethod
    def _bump_version(latest: Optional[str]) -> str:
        """简单语义化版本号递增：patch +1。"""
        if not latest:
            return "1.0.0"
        parts = latest.split(".")
        if len(parts) != 3 or not all(p.isdigit() for p in parts):
            return "1.0.0"
        major, minor, patch = (int(p) for p in parts)
        return f"{major}.{minor}.{patch + 1}"

    @staticmethod
    def _summarize_changes(fields: dict[str, Any]) -> str:
        names = []
        if "name" in fields:
            names.append("名称")
        if "agent_code" in fields:
            names.append("编码")
        if "description" in fields:
            names.append("描述")
        if "model_id" in fields:
            names.append("模型")
        if "system_prompt" in fields:
            names.append("系统提示词")
        if "tools" in fields:
            names.append("工具列表")
        if "rag_scopes" in fields:
            names.append("知识库范围")
        if "temperature" in fields:
            names.append("温度")
        if "max_tokens" in fields:
            names.append("最大 token")
        if "status" in fields:
            names.append("状态")
        return "更新：" + "、".join(names) if names else "更新"
