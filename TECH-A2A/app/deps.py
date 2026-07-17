"""Service registry & FastAPI dependencies for TECH-A2A.

The registry is a process-wide singleton. Tests use ``set_registry`` to
install an isolated registry with in-memory repositories between cases.
"""

from __future__ import annotations

from dataclasses import dataclass
from threading import RLock
from typing import Optional

from fastapi import Request

from app.agent_card.repository import (
    AgentCardRepository,
    InMemoryAgentCardRepository,
)
from app.agent_card.service import AgentCardService
from app.agent_registry.repository import (
    AgentRegistryRepository,
    InMemoryAgentRegistryRepository,
)
from app.agent_registry.service import AgentRegistryService
from app.audit.repository import InMemoryAuditRepository, AuditRepository
from app.audit.service import AuditService
from app.auth.service import AuthService
from app.clients.agent_client import AgentClient
from app.clients.agent_service_client import AgentServiceClient
from app.clients.wfe_client import WFEClient
from app.config import settings
from app.delegation.repository import (
    DelegationRepository,
    InMemoryDelegationRepository,
)
from app.delegation.service import DelegationService
from app.events.outbox import OutboxService
from app.inbound.service import InboundService
from app.messaging.repository import (
    InMemoryMessageRepository,
    MessageRepository,
)
from app.messaging.service import MessagingService


@dataclass
class Registry:
    card_repository: AgentCardRepository
    card_service: AgentCardService
    registry_repository: AgentRegistryRepository
    registry_service: AgentRegistryService
    delegation_repository: DelegationRepository
    delegation_service: DelegationService
    inbound_service: InboundService
    agent_client: AgentClient
    agent_service_client: AgentServiceClient
    wfe_client: WFEClient
    auth_service: AuthService
    outbox_service: OutboxService
    message_repository: MessageRepository
    message_service: MessagingService
    audit_repository: AuditRepository
    audit_service: AuditService

    def reset(self) -> None:
        """Clear in-memory state."""

        if isinstance(self.card_repository, InMemoryAgentCardRepository):
            self.card_repository.clear()
        if isinstance(self.registry_repository, InMemoryAgentRegistryRepository):
            self.registry_repository.clear()
        if isinstance(self.delegation_repository, InMemoryDelegationRepository):
            self.delegation_repository.clear()
        if isinstance(self.message_repository, InMemoryMessageRepository):
            self.message_repository.clear()
        if isinstance(self.audit_repository, InMemoryAuditRepository):
            self.audit_repository.clear()
        self.inbound_service.clear()
        self.outbox_service.clear()
        self.auth_service.clear()


_LOCK = RLock()
_REGISTRY: Optional[Registry] = None


def _build_default_registry() -> Registry:
    # Agent Card
    card_repo: AgentCardRepository = InMemoryAgentCardRepository()
    card_service = AgentCardService(card_repo)

    # Agent Registry
    registry_repo: AgentRegistryRepository = InMemoryAgentRegistryRepository()
    registry_service = AgentRegistryService(registry_repo)

    # Events / Outbox
    outbox_service = OutboxService(
        kafka_bootstrap_servers=settings.kafka_bootstrap_servers,
        topic=settings.kafka_topic,
    )

    # Clients
    agent_client = AgentClient()
    agent_service_client = AgentServiceClient(
        base_url=settings.agent_base_url,
        timeout=settings.agent_timeout,
    )
    wfe_client = WFEClient(
        base_url=settings.wfe_base_url,
        timeout=settings.wfe_timeout,
    )

    # Delegation
    delegation_repo: DelegationRepository = InMemoryDelegationRepository()
    delegation_service = DelegationService(delegation_repo, agent_client, outbox_service)

    # Inbound
    inbound_service = InboundService(outbox_service)

    # Auth
    auth_service = AuthService()

    # Messaging
    message_repo: MessageRepository = InMemoryMessageRepository()
    message_service = MessagingService(message_repo)

    # Audit
    audit_repo: AuditRepository = InMemoryAuditRepository()
    audit_service = AuditService(audit_repo)

    return Registry(
        card_repository=card_repo,
        card_service=card_service,
        registry_repository=registry_repo,
        registry_service=registry_service,
        delegation_repository=delegation_repo,
        delegation_service=delegation_service,
        inbound_service=inbound_service,
        agent_client=agent_client,
        agent_service_client=agent_service_client,
        wfe_client=wfe_client,
        auth_service=auth_service,
        outbox_service=outbox_service,
        message_repository=message_repo,
        message_service=message_service,
        audit_repository=audit_repo,
        audit_service=audit_service,
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


def get_card_service(request: Request) -> AgentCardService:
    return request.app.state.registry.card_service


def get_registry_service(request: Request) -> AgentRegistryService:
    return request.app.state.registry.registry_service


def get_delegation_service(request: Request) -> DelegationService:
    return request.app.state.registry.delegation_service


def get_inbound_service(request: Request) -> InboundService:
    return request.app.state.registry.inbound_service


def get_auth_service(request: Request) -> AuthService:
    return request.app.state.registry.auth_service


def get_outbox_service(request: Request) -> OutboxService:
    return request.app.state.registry.outbox_service


def get_message_service(request: Request) -> MessagingService:
    return request.app.state.registry.message_service


def get_audit_service(request: Request) -> AuditService:
    return request.app.state.registry.audit_service


def get_agent_service_client(request: Request) -> AgentServiceClient:
    return request.app.state.registry.agent_service_client


def get_wfe_client(request: Request) -> WFEClient:
    return request.app.state.registry.wfe_client
