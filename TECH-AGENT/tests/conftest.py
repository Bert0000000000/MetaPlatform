"""Shared pytest fixtures for TECH-AGENT tests."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.agents.repository import InMemoryAgentRepository
from app.agents.service import AgentService
from app.api.v1.router import router as v1_router
from app.card.service import AgentCardService
from app.checkpoint.repository import InMemoryCheckpointRepository
from app.checkpoint.service import CheckpointService
from app.clients.action import ActionClient
from app.clients.llmgw import LLMGWClient
from app.clients.rag import RAGClient
from app.collaboration.repository import InMemoryCollaborationRepository
from app.collaboration.service import CollaborationService
from app.common.jwt_auth import create_token
from app.common.middleware import (
    install_exception_handlers,
    install_trace_id_middleware,
)
from app.conversations.repository import InMemoryConversationRepository
from app.conversations.service import ConversationService
from app.deps import Registry, set_registry
from app.evaluation.service import EvaluationService
from app.events.outbox import OutboxService
from app.execution.engine import ExecutionEngine
from app.learning.service import LearningService
from app.execution.service import ExecutionService
from app.memory.repository import InMemoryMemoryRepository
from app.memory.service import MemoryService
from app.plans.repository import InMemoryPlanRepository
from app.plans.service import PlanService
from app.steps.repository import InMemoryStepRepository
from app.steps.service import StepService
from app.tasks.repository import InMemoryTaskRepository
from app.tasks.service import TaskService
from app.tools.repository import InMemoryToolRepository
from app.tools.service import ToolService

TENANT_ID = "tenant-test"
TRACE_ID = "test-trace-001"
USER_ID = "user-test"


def _make_test_jwt(
    *,
    tenant_id: str = TENANT_ID,
    user_id: str = USER_ID,
    username: str = "test-user",
    expires_in_seconds: int = 3600,
) -> str:
    """Mint a valid HS256 JWT for test requests."""

    claims = {
        "sub": user_id,
        "username": username,
        "tenantId": tenant_id,
        "roles": ["user"],
        "type": "access",
    }
    return create_token(claims, expires_in_seconds=expires_in_seconds)


# --------------------------------------------------------------- core fixtures


@pytest.fixture
def repository() -> InMemoryAgentRepository:
    return InMemoryAgentRepository()


@pytest.fixture
def agent_service(repository: InMemoryAgentRepository) -> AgentService:
    return AgentService(repository)


@pytest.fixture
def registry(
    repository: InMemoryAgentRepository,
    agent_service: AgentService,
) -> Registry:
    llm_client = LLMGWClient(base_url="")
    action_client = ActionClient(base_url="")
    rag_client = RAGClient(base_url="")
    engine = ExecutionEngine(
        llm_client,
        rag_client=rag_client,
        action_client=action_client,
    )
    execution_service = ExecutionService(agent_service, engine)

    memory_repo = InMemoryMemoryRepository()
    memory_service = MemoryService(memory_repo)

    checkpoint_repo = InMemoryCheckpointRepository()
    checkpoint_service = CheckpointService(checkpoint_repo)

    outbox_service = OutboxService()

    task_repo = InMemoryTaskRepository()
    task_service = TaskService(task_repo)

    conversation_repo = InMemoryConversationRepository()
    conversation_service = ConversationService(
        conversation_repo, agent_service, execution_service
    )

    tool_repo = InMemoryToolRepository()
    tool_service = ToolService(tool_repo, action_client, rag_client)

    step_repo = InMemoryStepRepository()
    step_service = StepService(step_repo)

    card_service = AgentCardService(agent_service)

    evaluation_service = EvaluationService()

    plan_repo = InMemoryPlanRepository()
    plan_service = PlanService(plan_repo)

    learning_service = LearningService(rag_client=rag_client)

    collaboration_repo = InMemoryCollaborationRepository()
    collaboration_service = CollaborationService(
        collaboration_repo, agent_service=agent_service
    )

    reg = Registry(
        repository=repository,
        agent_service=agent_service,
        llm_client=llm_client,
        execution_engine=engine,
        execution_service=execution_service,
        action_client=action_client,
        rag_client=rag_client,
        memory_repository=memory_repo,
        memory_service=memory_service,
        checkpoint_repository=checkpoint_repo,
        checkpoint_service=checkpoint_service,
        outbox_service=outbox_service,
        task_repository=task_repo,
        task_service=task_service,
        conversation_repository=conversation_repo,
        conversation_service=conversation_service,
        tool_repository=tool_repo,
        tool_service=tool_service,
        step_repository=step_repo,
        step_service=step_service,
        card_service=card_service,
        evaluation_service=evaluation_service,
        plan_repository=plan_repo,
        plan_service=plan_service,
        learning_service=learning_service,
        collaboration_repository=collaboration_repo,
        collaboration_service=collaboration_service,
    )
    set_registry(reg)
    yield reg
    set_registry(None)


# --------------------------------------------------------------- FastAPI app


@pytest.fixture
def app(registry: Registry) -> FastAPI:
    application = FastAPI(title="TECH-AGENT-Test")
    install_trace_id_middleware(application)
    install_exception_handlers(application)
    application.state.registry = registry
    application.include_router(v1_router)

    @application.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "UP"}

    return application


@pytest.fixture
async def client(app: FastAPI) -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def tenant_headers() -> dict[str, str]:
    """Standard authenticated request headers used by controller tests."""

    token = _make_test_jwt()
    return {
        "X-Tenant-Id": TENANT_ID,
        "X-Trace-Id": TRACE_ID,
        "Authorization": f"Bearer {token}",
    }


@pytest.fixture
def create_agent_body() -> dict:
    return {
        "name": "采购助手",
        "code": "purchase-assistant",
        "description": "协助处理采购审批流程的数字员工",
        "modelId": "doubao-pro-32k",
        "systemPrompt": "你是一个专业的采购助手。",
        "tools": ["tool-001", "tool-002"],
        "ragScopes": ["scope-001"],
        "temperature": 0.3,
        "maxTokens": 2048,
        "status": "DRAFT",
    }
