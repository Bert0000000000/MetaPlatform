"""Agent service unit tests."""

from __future__ import annotations

import pytest

from app.agents.repository import InMemoryAgentRepository
from app.agents.schemas import (
    AgentStatus,
    CloneAgentRequest,
    CreateAgentRequest,
    UpdateAgentRequest,
)
from app.agents.service import AgentService
from app.common.errors import (
    AgentNotFoundError,
    DuplicateAgentCodeError,
    InvalidParamError,
)

TENANT = "tenant-test"


def _build_create_request(**overrides) -> CreateAgentRequest:
    defaults = {
        "name": "采购助手",
        "code": "purchase-assistant",
        "description": "协助处理采购审批流程的数字员工",
        "modelId": "doubao-pro-32k",
        "systemPrompt": "你是一个专业的采购助手。",
        "tools": ["tool-001"],
        "ragScopes": ["scope-001"],
        "temperature": 0.3,
        "maxTokens": 2048,
        "status": "DRAFT",
    }
    defaults.update(overrides)
    return CreateAgentRequest(**defaults)


class TestAgentServiceCreate:
    async def test_create_agent_success(self, agent_service: AgentService):
        request = _build_create_request()
        agent = await agent_service.create(TENANT, request)

        assert agent.id.startswith("agt-")
        assert agent.tenant_id == TENANT
        assert agent.agent_code == "purchase-assistant"
        assert agent.name == "采购助手"
        assert agent.model_id == "doubao-pro-32k"
        assert agent.system_prompt == "你是一个专业的采购助手。"
        assert agent.tools == ["tool-001"]
        assert agent.rag_scopes == ["scope-001"]
        assert agent.temperature == 0.3
        assert agent.max_tokens == 2048
        assert agent.status == AgentStatus.DRAFT

    async def test_create_agent_rejects_duplicate_code(
        self, agent_service: AgentService
    ):
        request = _build_create_request()
        await agent_service.create(TENANT, request)

        with pytest.raises(DuplicateAgentCodeError):
            await agent_service.create(TENANT, request)

    async def test_create_agent_allows_same_code_in_different_tenant(
        self, agent_service: AgentService
    ):
        request = _build_create_request()
        await agent_service.create(TENANT, request)

        other = await agent_service.create("tenant-other", request)
        assert other.tenant_id == "tenant-other"
        assert other.agent_code == "purchase-assistant"


class TestAgentServiceGet:
    async def test_get_agent_success(self, agent_service: AgentService):
        created = await agent_service.create(TENANT, _build_create_request())
        found = await agent_service.get(TENANT, created.id)
        assert found.id == created.id

    async def test_get_agent_not_found(self, agent_service: AgentService):
        with pytest.raises(AgentNotFoundError):
            await agent_service.get(TENANT, "agt-does-not-exist")

    async def test_get_agent_is_tenant_isolated(
        self, agent_service: AgentService
    ):
        created = await agent_service.create(TENANT, _build_create_request())
        with pytest.raises(AgentNotFoundError):
            await agent_service.get("tenant-other", created.id)


class TestAgentServiceList:
    async def test_list_pagination(self, agent_service: AgentService):
        for i in range(3):
            request = _build_create_request(code=f"agent-{i}", name=f"Agent {i}")
            await agent_service.create(TENANT, request)

        items, total = await agent_service.list(TENANT, page=1, page_size=2)
        assert total == 3
        assert len(items) == 2

    async def test_list_status_filter(self, agent_service: AgentService):
        await agent_service.create(
            TENANT, _build_create_request(code="draft-agent", status="DRAFT")
        )
        await agent_service.create(
            TENANT, _build_create_request(code="active-agent", status="ACTIVE")
        )

        items, total = await agent_service.list(TENANT, status=AgentStatus.ACTIVE)
        assert total == 1
        assert items[0].agent_code == "active-agent"

    async def test_list_is_tenant_isolated(
        self, agent_service: AgentService, repository: InMemoryAgentRepository
    ):
        await agent_service.create(TENANT, _build_create_request(code="t1"))
        await agent_service.create("tenant-other", _build_create_request(code="t2"))

        items, total = await agent_service.list(TENANT)
        assert total == 1
        assert items[0].tenant_id == TENANT


class TestAgentServiceUpdate:
    async def test_update_agent_success(self, agent_service: AgentService):
        created = await agent_service.create(TENANT, _build_create_request())
        update = UpdateAgentRequest(name="updated-name", temperature=0.5)
        updated = await agent_service.update(TENANT, created.id, update)

        assert updated.name == "updated-name"
        assert updated.temperature == 0.5
        assert updated.agent_code == created.agent_code

    async def test_update_agent_rejects_duplicate_code(
        self, agent_service: AgentService
    ):
        first = await agent_service.create(
            TENANT, _build_create_request(code="first")
        )
        await agent_service.create(TENANT, _build_create_request(code="second"))

        update = UpdateAgentRequest(code="second")
        with pytest.raises(DuplicateAgentCodeError):
            await agent_service.update(TENANT, first.id, update)

    async def test_update_agent_not_found(self, agent_service: AgentService):
        update = UpdateAgentRequest(name="x")
        with pytest.raises(AgentNotFoundError):
            await agent_service.update(TENANT, "agt-does-not-exist", update)

    async def test_update_agent_no_changes_returns_unchanged(
        self, agent_service: AgentService
    ):
        created = await agent_service.create(TENANT, _build_create_request())
        update = UpdateAgentRequest()
        result = await agent_service.update(TENANT, created.id, update)
        assert result.id == created.id


class TestAgentServiceDelete:
    async def test_delete_draft_agent_success(self, agent_service: AgentService):
        created = await agent_service.create(TENANT, _build_create_request())
        ok = await agent_service.delete(TENANT, created.id)
        assert ok is True

        with pytest.raises(AgentNotFoundError):
            await agent_service.get(TENANT, created.id)

    async def test_delete_active_agent_fails(self, agent_service: AgentService):
        created = await agent_service.create(
            TENANT, _build_create_request(status="ACTIVE")
        )
        with pytest.raises(InvalidParamError):
            await agent_service.delete(TENANT, created.id)

    async def test_delete_agent_not_found(self, agent_service: AgentService):
        with pytest.raises(AgentNotFoundError):
            await agent_service.delete(TENANT, "agt-does-not-exist")

    async def test_delete_is_soft_delete(
        self, agent_service: AgentService, repository: InMemoryAgentRepository
    ):
        """V12-07: 删除应软删除（保留记录，标记 deleted_at），而非物理移除。"""

        created = await agent_service.create(TENANT, _build_create_request())
        ok = await agent_service.delete(TENANT, created.id)
        assert ok is True

        # 公开 API 不可见
        with pytest.raises(AgentNotFoundError):
            await agent_service.get(TENANT, created.id)

        # 但底层记录仍保留，deleted_at 已被标记
        with repository._lock:
            record = repository._store.get((TENANT, created.id))
        assert record is not None
        assert record.deleted_at is not None

    async def test_delete_records_audit_log(
        self, agent_service: AgentService, repository: InMemoryAgentRepository
    ):
        """V12-07: 删除必须记录 audit log，actor 来自 deleted_by 参数。"""

        created = await agent_service.create(TENANT, _build_create_request())
        await agent_service.delete(TENANT, created.id, deleted_by="user-001")

        with repository._lock:
            logs = list(repository._logs.get((TENANT, created.id), []))
        delete_logs = [l for l in logs if l.action == "delete"]
        assert len(delete_logs) == 1
        assert delete_logs[0].actor == "user-001"

    async def test_double_delete_returns_false(
        self, agent_service: AgentService
    ):
        """V12-07: 对已软删除的 Agent 再次调用 delete 应抛出 NotFound。"""

        created = await agent_service.create(TENANT, _build_create_request())
        await agent_service.delete(TENANT, created.id)

        with pytest.raises(AgentNotFoundError):
            await agent_service.delete(TENANT, created.id)

    async def test_deleted_agent_excluded_from_list(
        self, agent_service: AgentService
    ):
        """V12-07: 软删除后，Agent 不应出现在 list 结果中。"""

        await agent_service.create(
            TENANT, _build_create_request(code="to-delete")
        )
        keep = await agent_service.create(
            TENANT, _build_create_request(code="to-keep")
        )
        await agent_service.delete(TENANT, keep.id)

        items, total = await agent_service.list(TENANT)
        assert total == 1
        assert items[0].agent_code == "to-delete"


class TestAgentServiceClone:
    """V12-07: 克隆 Agent 必须复制配置、触发版本快照与审计日志。"""

    async def test_clone_copies_full_configuration(
        self, agent_service: AgentService
    ):
        source = await agent_service.create(
            TENANT,
            _build_create_request(
                tools=["tool-A", "tool-B"],
                ragScopes=["scope-X"],
                temperature=0.5,
                maxTokens=8192,
                systemPrompt="custom prompt",
                modelId="doubao-pro-32k",
                description="source desc",
            ),
        )
        request = CloneAgentRequest(name="克隆副本", code="purchase-assistant-clone")
        cloned = await agent_service.clone(TENANT, source.id, request)

        assert cloned.id != source.id
        assert cloned.name == "克隆副本"
        assert cloned.agent_code == "purchase-assistant-clone"
        assert cloned.description == source.description
        assert cloned.model_id == source.model_id
        assert cloned.system_prompt == source.system_prompt
        assert cloned.tools == source.tools
        assert cloned.rag_scopes == source.rag_scopes
        assert cloned.temperature == source.temperature
        assert cloned.max_tokens == source.max_tokens
        # 克隆出的新 Agent 状态固定为 DRAFT
        assert cloned.status == AgentStatus.DRAFT

    async def test_clone_rejects_duplicate_code(
        self, agent_service: AgentService
    ):
        source = await agent_service.create(TENANT, _build_create_request())
        request = CloneAgentRequest(
            name="重复编码克隆", code="purchase-assistant"
        )
        with pytest.raises(DuplicateAgentCodeError):
            await agent_service.clone(TENANT, source.id, request)

    async def test_clone_source_not_found(self, agent_service: AgentService):
        request = CloneAgentRequest(name="x", code="y")
        with pytest.raises(AgentNotFoundError):
            await agent_service.clone(TENANT, "agt-does-not-exist", request)

    async def test_clone_records_version_snapshot_on_source(
        self,
        agent_service: AgentService,
        repository: InMemoryAgentRepository,
    ):
        source = await agent_service.create(TENANT, _build_create_request())
        request = CloneAgentRequest(name="克隆", code="clone-001")
        await agent_service.clone(TENANT, source.id, request, cloned_by="user-007")

        versions, total = await repository.list_versions(source.id, TENANT)
        # 创建时记一条 1.0.0，克隆再追加一条
        assert total == 2
        clone_version = versions[0]
        assert clone_version.version == "1.0.1"
        assert "克隆" in clone_version.change_log
        assert clone_version.snapshot is not None
        assert clone_version.created_by == "user-007"

    async def test_clone_records_audit_log_on_both(
        self,
        agent_service: AgentService,
        repository: InMemoryAgentRepository,
    ):
        source = await agent_service.create(TENANT, _build_create_request())
        request = CloneAgentRequest(name="克隆", code="clone-002")
        cloned = await agent_service.clone(TENANT, source.id, request)

        source_logs, _ = await repository.list_logs(source.id, TENANT)
        source_actions = [log.action for log in source_logs]
        assert "create" in source_actions
        assert "clone" in source_actions

        target_logs, _ = await repository.list_logs(cloned.id, TENANT)
        target_actions = [log.action for log in target_logs]
        assert "create" in target_actions
        # 克隆出来的新 Agent 不应自带 clone 日志，clone 动作只挂在源 Agent 上
        assert "clone" not in target_actions

    async def test_clone_initial_version_is_1_0_0(
        self,
        agent_service: AgentService,
        repository: InMemoryAgentRepository,
    ):
        source = await agent_service.create(TENANT, _build_create_request())
        request = CloneAgentRequest(name="克隆", code="clone-003")
        cloned = await agent_service.clone(TENANT, source.id, request)

        versions, total = await repository.list_versions(cloned.id, TENANT)
        assert total == 1
        assert versions[0].version == "1.0.0"
        assert "克隆自" in versions[0].change_log

    async def test_clone_uses_cloned_by_as_actor(
        self,
        agent_service: AgentService,
        repository: InMemoryAgentRepository,
    ):
        source = await agent_service.create(TENANT, _build_create_request())
        request = CloneAgentRequest(name="克隆", code="clone-004")
        await agent_service.clone(TENANT, source.id, request, cloned_by="actor-001")

        source_logs, _ = await repository.list_logs(source.id, TENANT)
        clone_log = next(l for l in source_logs if l.action == "clone")
        assert clone_log.actor == "actor-001"
