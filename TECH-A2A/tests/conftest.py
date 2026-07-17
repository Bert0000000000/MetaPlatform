"""Shared pytest fixtures for TECH-A2A tests."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.agent_card.repository import InMemoryAgentCardRepository
from app.agent_card.service import AgentCardService
from app.agent_registry.repository import InMemoryAgentRegistryRepository
from app.agent_registry.service import AgentRegistryService
from app.api.v1.router import public_router, router as v1_router
from app.audit.repository import InMemoryAuditRepository
from app.audit.service import AuditService
from app.auth.service import AuthService
from app.clients.agent_client import AgentClient
from app.clients.agent_service_client import AgentServiceClient
from app.clients.wfe_client import WFEClient
from app.common.jwt_auth import create_token
from app.common.middleware import (
    install_exception_handlers,
    install_trace_id_middleware,
)
from app.delegation.repository import InMemoryDelegationRepository
from app.delegation.service import DelegationService
from app.deps import Registry, set_registry
from app.events.outbox import OutboxService
from app.inbound.service import InboundService
from app.messaging.repository import InMemoryMessageRepository
from app.messaging.service import MessagingService

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
def card_repository() -> InMemoryAgentCardRepository:
    return InMemoryAgentCardRepository()


@pytest.fixture
def registry_repository() -> InMemoryAgentRegistryRepository:
    return InMemoryAgentRegistryRepository()


@pytest.fixture
def delegation_repository() -> InMemoryDelegationRepository:
    return InMemoryDelegationRepository()


@pytest.fixture
def message_repository() -> InMemoryMessageRepository:
    return InMemoryMessageRepository()


@pytest.fixture
def audit_repository() -> InMemoryAuditRepository:
    return InMemoryAuditRepository()


@pytest.fixture
def registry(
    card_repository: InMemoryAgentCardRepository,
    registry_repository: InMemoryAgentRegistryRepository,
    delegation_repository: InMemoryDelegationRepository,
    message_repository: InMemoryMessageRepository,
    audit_repository: InMemoryAuditRepository,
) -> Registry:
    card_service = AgentCardService(card_repository)
    registry_service = AgentRegistryService(registry_repository)

    outbox_service = OutboxService()

    agent_client = AgentClient()
    agent_service_client = AgentServiceClient(base_url="")
    wfe_client = WFEClient(base_url="")

    delegation_service = DelegationService(
        delegation_repository, agent_client, outbox_service
    )
    inbound_service = InboundService(outbox_service)
    auth_service = AuthService()
    message_service = MessagingService(message_repository)
    audit_service = AuditService(audit_repository)

    reg = Registry(
        card_repository=card_repository,
        card_service=card_service,
        registry_repository=registry_repository,
        registry_service=registry_service,
        delegation_repository=delegation_repository,
        delegation_service=delegation_service,
        inbound_service=inbound_service,
        agent_client=agent_client,
        agent_service_client=agent_service_client,
        wfe_client=wfe_client,
        auth_service=auth_service,
        outbox_service=outbox_service,
        message_repository=message_repository,
        message_service=message_service,
        audit_repository=audit_repository,
        audit_service=audit_service,
    )
    set_registry(reg)
    yield reg
    set_registry(None)


# --------------------------------------------------------------- FastAPI app


@pytest.fixture
def app(registry: Registry) -> FastAPI:
    application = FastAPI(title="TECH-A2A-Test")
    install_trace_id_middleware(application)
    install_exception_handlers(application)
    application.state.registry = registry
    application.include_router(v1_router)
    application.include_router(public_router)

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
