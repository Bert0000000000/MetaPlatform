"""Service registry & FastAPI dependencies for TECH-AGENT.

The registry is a process-wide singleton. Tests use ``set_registry`` to
install an isolated registry with an in-memory repository between cases.
"""

from __future__ import annotations

from dataclasses import dataclass
from threading import RLock
from typing import Optional

from fastapi import Request

from app.agents.orm import Base
from app.agents.repository import (
    AgentRepository,
    InMemoryAgentRepository,
    SqlAlchemyAgentRepository,
)
from app.agents.service import AgentService
from app.card.service import AgentCardService
from app.checkpoint.repository import (
    CheckpointRepository,
    InMemoryCheckpointRepository,
    SqlAlchemyCheckpointRepository,
)
from app.checkpoint.service import CheckpointService
from app.clients.action import ActionClient
from app.clients.llmgw import LLMGWClient
from app.clients.rag import RAGClient
from app.config import settings
from app.conversations.repository import (
    ConversationRepository,
    InMemoryConversationRepository,
    SqlAlchemyConversationRepository,
)
from app.conversations.service import ConversationService
from app.events.outbox import OutboxService
from app.execution.engine import ExecutionEngine
from app.execution.service import ExecutionService
from app.memory.repository import (
    InMemoryMemoryRepository,
    MemoryRepository,
    SqlAlchemyMemoryRepository,
)
from app.memory.service import MemoryService
from app.steps.repository import (
    InMemoryStepRepository,
    SqlAlchemyStepRepository,
    StepRepository,
)
from app.steps.service import StepService
from app.tasks.repository import (
    InMemoryTaskRepository,
    SqlAlchemyTaskRepository,
    TaskRepository,
)
from app.tasks.service import TaskService
from app.tools.repository import (
    InMemoryToolRepository,
    SqlAlchemyToolRepository,
    ToolRepository,
)
from app.tools.service import ToolService


def _is_sqlalchemy_backend() -> bool:
    return settings.database_url.startswith("postgresql")


def _create_sqlalchemy_session_factory():
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    engine = create_async_engine(settings.database_url, echo=False)
    return async_sessionmaker(engine, expire_on_commit=False), engine


async def _init_sqlalchemy_tables(engine) -> None:
    import app.tasks.orm  # noqa: F401
    import app.memory.orm  # noqa: F401
    import app.checkpoint.orm  # noqa: F401
    import app.conversations.orm  # noqa: F401
    import app.tools.orm  # noqa: F401
    import app.steps.orm  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@dataclass
class Registry:
    repository: AgentRepository
    agent_service: AgentService
    llm_client: LLMGWClient
    execution_engine: ExecutionEngine
    execution_service: ExecutionService
    action_client: ActionClient
    rag_client: RAGClient
    memory_repository: MemoryRepository
    memory_service: MemoryService
    checkpoint_repository: CheckpointRepository
    checkpoint_service: CheckpointService
    outbox_service: OutboxService
    task_repository: TaskRepository
    task_service: TaskService
    conversation_repository: ConversationRepository
    conversation_service: ConversationService
    tool_repository: ToolRepository
    tool_service: ToolService
    step_repository: StepRepository
    step_service: StepService
    card_service: AgentCardService

    def reset(self) -> None:
        """Clear in-memory state."""

        if isinstance(self.repository, InMemoryAgentRepository):
            self.repository.clear()
        if isinstance(self.memory_repository, InMemoryMemoryRepository):
            self.memory_repository.clear()
        if isinstance(self.checkpoint_repository, InMemoryCheckpointRepository):
            self.checkpoint_repository.clear()
        if isinstance(self.task_repository, InMemoryTaskRepository):
            self.task_repository.clear()
        if isinstance(self.conversation_repository, InMemoryConversationRepository):
            self.conversation_repository.clear()
        if isinstance(self.tool_repository, InMemoryToolRepository):
            self.tool_repository.clear()
        if isinstance(self.step_repository, InMemoryStepRepository):
            self.step_repository.clear()
        self.outbox_service.clear()


_LOCK = RLock()
_REGISTRY: Optional[Registry] = None


def _build_default_registry() -> Registry:
    if _is_sqlalchemy_backend():
        session_factory, engine = _create_sqlalchemy_session_factory()
        import asyncio

        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(_init_sqlalchemy_tables(engine))
        finally:
            loop.close()

        repo: AgentRepository = SqlAlchemyAgentRepository(session_factory)
        memory_repo: MemoryRepository = SqlAlchemyMemoryRepository(
            session_factory
        )
        checkpoint_repo: CheckpointRepository = (
            SqlAlchemyCheckpointRepository(session_factory)
        )
        task_repo: TaskRepository = SqlAlchemyTaskRepository(session_factory)
        conversation_repo: ConversationRepository = (
            SqlAlchemyConversationRepository(session_factory)
        )
        tool_repo: ToolRepository = SqlAlchemyToolRepository(session_factory)
        step_repo: StepRepository = SqlAlchemyStepRepository(session_factory)
    else:
        repo = InMemoryAgentRepository()
        memory_repo = InMemoryMemoryRepository()
        checkpoint_repo = InMemoryCheckpointRepository()
        task_repo = InMemoryTaskRepository()
        conversation_repo = InMemoryConversationRepository()
        tool_repo = InMemoryToolRepository()
        step_repo = InMemoryStepRepository()

    agent_service = AgentService(repo)

    llm_client = LLMGWClient(
        base_url=settings.llmgw_base_url,
        timeout=settings.llmgw_timeout,
    )
    action_client = ActionClient(
        base_url=settings.action_base_url,
        timeout=settings.action_timeout,
    )
    rag_client = RAGClient(
        base_url=settings.rag_base_url,
        timeout=settings.rag_timeout,
    )

    execution_engine = ExecutionEngine(
        llm_client,
        rag_client=rag_client,
        action_client=action_client,
    )
    execution_service = ExecutionService(agent_service, execution_engine)

    # Memory
    memory_service = MemoryService(memory_repo)

    # Checkpoint
    checkpoint_service = CheckpointService(checkpoint_repo)

    # Events / Outbox
    outbox_service = OutboxService(
        kafka_bootstrap_servers=settings.kafka_bootstrap_servers,
        topic=settings.kafka_topic,
    )

    # Tasks
    task_service = TaskService(task_repo)

    # Conversations
    conversation_service = ConversationService(
        conversation_repo, agent_service, execution_service
    )

    # Tools
    tool_service = ToolService(tool_repo, action_client, rag_client)

    # Steps
    step_service = StepService(step_repo)

    # Card
    card_service = AgentCardService(agent_service)

    return Registry(
        repository=repo,
        agent_service=agent_service,
        llm_client=llm_client,
        execution_engine=execution_engine,
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
    )


def get_registry() -> Registry:
    global _REGISTRY
    with _LOCK:
        if _REGISTRY is None:
            _REGISTRY = _build_default_registry()
        return _REGISTRY


def set_registry(registry: Optional[Registry]) -> None:
    """Test helper: install or clear the process-wide registry."""

    global _REGISTRY
    with _LOCK:
        _REGISTRY = registry


# -------------------------------------------------------------- FastAPI deps


def get_agent_service(request: Request) -> AgentService:
    return request.app.state.registry.agent_service


def get_execution_service(request: Request) -> ExecutionService:
    return request.app.state.registry.execution_service


def get_repository(request: Request) -> AgentRepository:
    return request.app.state.registry.repository


def get_memory_service(request: Request) -> MemoryService:
    return request.app.state.registry.memory_service


def get_checkpoint_service(request: Request) -> CheckpointService:
    return request.app.state.registry.checkpoint_service


def get_outbox_service(request: Request) -> OutboxService:
    return request.app.state.registry.outbox_service


def get_task_service(request: Request) -> TaskService:
    return request.app.state.registry.task_service


def get_conversation_service(request: Request) -> ConversationService:
    return request.app.state.registry.conversation_service


def get_tool_service(request: Request) -> ToolService:
    return request.app.state.registry.tool_service


def get_step_service(request: Request) -> StepService:
    return request.app.state.registry.step_service


def get_card_service(request: Request) -> AgentCardService:
    return request.app.state.registry.card_service
