"""Pydantic schemas for the Agent domain."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class AgentStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"


class Agent(BaseModel):
    """Persisted agent record."""

    id: str
    tenant_id: str
    agent_code: str
    name: str
    description: str = ""
    model_id: str
    system_prompt: str
    tools: List[str] = Field(default_factory=list)
    rag_scopes: List[str] = Field(default_factory=list)
    temperature: float = 0.7
    max_tokens: int = 4096
    status: AgentStatus = AgentStatus.DRAFT
    deleted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AgentVersion(BaseModel):
    """Agent 配置变更的版本快照。"""

    id: str
    tenant_id: str
    agent_id: str
    version: str
    change_log: str = ""
    snapshot: Optional[dict[str, Any]] = None
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AgentOperationLog(BaseModel):
    """Agent 操作审计日志。"""

    id: str
    tenant_id: str
    agent_id: str
    actor: str = "system"
    action: str
    resource: str = "agent"
    ip: Optional[str] = None
    status: str = "success"
    trace_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ----------------------------------------------------------- request schemas


class CreateAgentRequest(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    code: str = Field(min_length=1, max_length=128)
    description: str = ""
    modelId: str = Field(min_length=1, max_length=256)
    systemPrompt: str = Field(min_length=1, max_length=8192)
    tools: List[str] = Field(default_factory=list)
    ragScopes: List[str] = Field(default_factory=list)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    maxTokens: int = Field(default=4096, ge=1, le=65536)
    status: AgentStatus = AgentStatus.DRAFT


class UpdateAgentRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=256)
    code: Optional[str] = Field(default=None, min_length=1, max_length=128)
    description: Optional[str] = None
    modelId: Optional[str] = Field(default=None, min_length=1, max_length=256)
    systemPrompt: Optional[str] = Field(default=None, min_length=1, max_length=8192)
    tools: Optional[List[str]] = None
    ragScopes: Optional[List[str]] = None
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    maxTokens: Optional[int] = Field(default=None, ge=1, le=65536)
    status: Optional[AgentStatus] = None


class CloneAgentRequest(BaseModel):
    """克隆 Agent 请求：以源 Agent 为模板创建新 Agent，仅指定新名称与编码。"""

    name: str = Field(min_length=1, max_length=256)
    code: str = Field(min_length=1, max_length=128)


# ------------------------------------------------------------ response schemas


def to_dict(agent: Agent) -> dict:
    """Serialize an Agent to the API response shape (camelCase)."""

    status_value = agent.status.value if isinstance(agent.status, AgentStatus) else agent.status
    return {
        "agentId": agent.id,
        "tenantId": agent.tenant_id,
        "code": agent.agent_code,
        "name": agent.name,
        "description": agent.description,
        "modelId": agent.model_id,
        "systemPrompt": agent.system_prompt,
        "tools": list(agent.tools),
        "ragScopes": list(agent.rag_scopes),
        "temperature": agent.temperature,
        "maxTokens": agent.max_tokens,
        "status": status_value,
        "deletedAt": agent.deleted_at,
        "createdAt": agent.created_at,
        "updatedAt": agent.updated_at,
    }


def version_to_dict(version: AgentVersion) -> dict:
    """Serialize an AgentVersion to the API response shape (camelCase)."""
    return {
        "version": version.version,
        "timestamp": version.created_at,
        "changeLog": version.change_log,
        "snapshot": version.snapshot,
        "createdBy": version.created_by,
    }


def operation_log_to_dict(log: AgentOperationLog) -> dict:
    """Serialize an AgentOperationLog to the API response shape (camelCase)."""
    return {
        "id": log.id,
        "actor": log.actor,
        "action": log.action,
        "resource": log.resource,
        "timestamp": log.created_at,
        "ip": log.ip,
        "status": log.status,
        "traceId": log.trace_id,
    }
