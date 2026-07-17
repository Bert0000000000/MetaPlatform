"""Pydantic schemas for Agent Registry."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class HealthStatus(str, Enum):
    HEALTHY = "HEALTHY"
    UNHEALTHY = "UNHEALTHY"
    UNKNOWN = "UNKNOWN"


class AgentRegistration(BaseModel):
    """A registered agent in the A2A registry."""

    id: str
    tenant_id: str
    agent_id: str
    name: str
    description: str = ""
    endpoints: List[str] = Field(default_factory=list)
    capabilities: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    status: HealthStatus = HealthStatus.UNKNOWN
    last_heartbeat: Optional[datetime] = None
    registered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RegisterAgentRequest(BaseModel):
    agentId: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=256)
    description: str = ""
    endpoints: List[str] = Field(default_factory=list)
    capabilities: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


def registration_to_dict(reg: AgentRegistration) -> dict:
    status_value = reg.status.value if isinstance(reg.status, HealthStatus) else reg.status
    return {
        "registrationId": reg.id,
        "tenantId": reg.tenant_id,
        "agentId": reg.agent_id,
        "name": reg.name,
        "description": reg.description,
        "endpoints": list(reg.endpoints),
        "capabilities": list(reg.capabilities),
        "metadata": dict(reg.metadata),
        "status": status_value,
        "lastHeartbeat": reg.last_heartbeat,
        "registeredAt": reg.registered_at,
        "updatedAt": reg.updated_at,
    }
