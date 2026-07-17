"""Agent service unit tests."""

from __future__ import annotations

import pytest

from app.agents.repository import InMemoryAgentRepository
from app.agents.schemas import AgentStatus, CreateAgentRequest, UpdateAgentRequest
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
