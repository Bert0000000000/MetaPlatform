"""Agent Registry service: register, deregister, heartbeat, health check."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.agent_registry.repository import AgentRegistryRepository
from app.agent_registry.schemas import (
    AgentRegistration,
    HealthStatus,
    RegisterAgentRequest,
    registration_to_dict,
)
from app.common.errors import AgentAlreadyRegisteredError, AgentNotFoundError


HEARTBEAT_TIMEOUT_SECONDS = 60


class AgentRegistryService:
    def __init__(self, repository: AgentRegistryRepository) -> None:
        self._repo = repository

    async def register(
        self,
        tenant_id: str,
        request: RegisterAgentRequest,
    ) -> AgentRegistration:
        existing = await self._repo.get_by_agent_id(tenant_id, request.agentId)
        if existing is not None:
            raise AgentAlreadyRegisteredError(
                f"Agent 已注册: agentId={request.agentId}",
                data={"agentId": request.agentId},
            )

        reg = AgentRegistration(
            id="",
            tenant_id=tenant_id,
            agent_id=request.agentId,
            name=request.name,
            description=request.description,
            endpoints=list(request.endpoints),
            capabilities=list(request.capabilities),
            metadata=dict(request.metadata),
            status=HealthStatus.HEALTHY,
            last_heartbeat=datetime.now(timezone.utc),
        )
        return await self._repo.create(reg)

    async def deregister(self, tenant_id: str, agent_id: str) -> bool:
        reg = await self._repo.get_by_agent_id(tenant_id, agent_id)
        if reg is None:
            raise AgentNotFoundError(
                f"Agent 未注册: agentId={agent_id}",
                data={"agentId": agent_id},
            )
        return await self._repo.delete(reg.id, tenant_id)

    async def heartbeat(self, tenant_id: str, agent_id: str) -> AgentRegistration:
        reg = await self._repo.get_by_agent_id(tenant_id, agent_id)
        if reg is None:
            raise AgentNotFoundError(
                f"Agent 未注册: agentId={agent_id}",
                data={"agentId": agent_id},
            )
        now = datetime.now(timezone.utc)
        updated = await self._repo.update(reg.id, tenant_id, {
            "last_heartbeat": now,
            "status": HealthStatus.HEALTHY,
        })
        if updated is None:
            raise AgentNotFoundError(
                f"Agent 未注册: agentId={agent_id}",
                data={"agentId": agent_id},
            )
        return updated

    async def health_check(self, tenant_id: str, agent_id: str) -> AgentRegistration:
        reg = await self._repo.get_by_agent_id(tenant_id, agent_id)
        if reg is None:
            raise AgentNotFoundError(
                f"Agent 未注册: agentId={agent_id}",
                data={"agentId": agent_id},
            )
        now = datetime.now(timezone.utc)
        if reg.last_heartbeat is not None:
            elapsed = (now - reg.last_heartbeat).total_seconds()
            if elapsed > HEARTBEAT_TIMEOUT_SECONDS:
                updated = await self._repo.update(reg.id, tenant_id, {
                    "status": HealthStatus.UNHEALTHY,
                })
                if updated is not None:
                    return updated
        return reg

    async def check_all_health(self) -> list[AgentRegistration]:
        """Periodic health check for all registered agents."""
        all_regs = await self._repo.list_all()
        now = datetime.now(timezone.utc)
        updated: list[AgentRegistration] = []
        for reg in all_regs:
            if reg.last_heartbeat is not None:
                elapsed = (now - reg.last_heartbeat).total_seconds()
                if elapsed > HEARTBEAT_TIMEOUT_SECONDS and reg.status != HealthStatus.UNHEALTHY:
                    u = await self._repo.update(reg.id, reg.tenant_id, {
                        "status": HealthStatus.UNHEALTHY,
                    })
                    if u is not None:
                        updated.append(u)
                        continue
            updated.append(reg)
        return updated

    async def get(self, tenant_id: str, agent_id: str) -> AgentRegistration:
        reg = await self._repo.get_by_agent_id(tenant_id, agent_id)
        if reg is None:
            raise AgentNotFoundError(
                f"Agent 未注册: agentId={agent_id}",
                data={"agentId": agent_id},
            )
        return reg

    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[HealthStatus] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AgentRegistration], int]:
        return await self._repo.list(
            tenant_id,
            status=status,
            page=page,
            page_size=page_size,
        )
