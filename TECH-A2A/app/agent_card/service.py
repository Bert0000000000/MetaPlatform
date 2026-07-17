"""Agent Card service: publish, query, search."""

from __future__ import annotations

from typing import Any, Optional

from app.agent_card.repository import AgentCardRepository
from app.agent_card.schemas import (
    AgentCard,
    CardStatus,
    PublishAgentCardRequest,
    UpdateAgentCardRequest,
)
from app.common.errors import CardNotFoundError, DuplicateAgentCardError


class AgentCardService:
    def __init__(self, repository: AgentCardRepository) -> None:
        self._repo = repository

    async def publish(
        self,
        tenant_id: str,
        request: PublishAgentCardRequest,
    ) -> AgentCard:
        existing = await self._repo.get_by_name(tenant_id, request.name)
        if existing is not None:
            raise DuplicateAgentCardError(
                f"Agent Card 名称已存在: {request.name}",
                data={"name": request.name},
            )

        card = AgentCard(
            id="",
            tenant_id=tenant_id,
            name=request.name,
            description=request.description,
            version=request.version,
            protocol_version=request.protocolVersion,
            capabilities=list(request.capabilities),
            endpoints=dict(request.endpoints),
            authentication=dict(request.authentication),
            metadata=request.metadata,
            status=request.status,
        )
        return await self._repo.create(card)

    async def get(self, tenant_id: str, card_id: str) -> AgentCard:
        card = await self._repo.get(card_id, tenant_id)
        if card is None:
            raise CardNotFoundError(
                f"Agent Card 不存在: cardId={card_id}",
                data={"cardId": card_id},
            )
        return card

    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[CardStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AgentCard], int]:
        return await self._repo.list(
            tenant_id,
            status=status,
            page=page,
            page_size=page_size,
        )

    async def search(
        self,
        tenant_id: str,
        *,
        name: Optional[str] = None,
        capability: Optional[str] = None,
        status: Optional[CardStatus] = None,
    ) -> list[AgentCard]:
        return await self._repo.search(
            tenant_id,
            name=name,
            capability=capability,
            status=status,
        )

    async def update(
        self,
        tenant_id: str,
        card_id: str,
        request: UpdateAgentCardRequest,
    ) -> AgentCard:
        card = await self._repo.get(card_id, tenant_id)
        if card is None:
            raise CardNotFoundError(
                f"Agent Card 不存在: cardId={card_id}",
                data={"cardId": card_id},
            )

        fields: dict[str, Any] = {}
        if request.name is not None:
            if request.name != card.name:
                existing = await self._repo.get_by_name(tenant_id, request.name)
                if existing is not None and existing.id != card_id:
                    raise DuplicateAgentCardError(
                        f"Agent Card 名称已存在: {request.name}",
                        data={"name": request.name},
                    )
            fields["name"] = request.name
        if request.description is not None:
            fields["description"] = request.description
        if request.version is not None:
            fields["version"] = request.version
        if request.protocolVersion is not None:
            fields["protocol_version"] = request.protocolVersion
        if request.capabilities is not None:
            fields["capabilities"] = list(request.capabilities)
        if request.endpoints is not None:
            fields["endpoints"] = dict(request.endpoints)
        if request.authentication is not None:
            fields["authentication"] = dict(request.authentication)
        if request.metadata is not None:
            fields["metadata"] = request.metadata
        if request.status is not None:
            fields["status"] = request.status

        if not fields:
            return card

        updated = await self._repo.update(card_id, tenant_id, fields)
        if updated is None:
            raise CardNotFoundError(
                f"Agent Card 不存在: cardId={card_id}",
                data={"cardId": card_id},
            )
        return updated

    async def delete(self, tenant_id: str, card_id: str) -> bool:
        card = await self._repo.get(card_id, tenant_id)
        if card is None:
            raise CardNotFoundError(
                f"Agent Card 不存在: cardId={card_id}",
                data={"cardId": card_id},
            )
        return await self._repo.delete(card_id, tenant_id)

    async def list_published_cards(self) -> list[AgentCard]:
        return await self._repo.list_published()
