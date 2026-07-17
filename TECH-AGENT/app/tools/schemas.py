"""Pydantic schemas for Agent Tool management (P2-AGT-18/19)."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class ToolType(str, Enum):
    ACTION = "ACTION"
    RAG = "RAG"
    HTTP = "HTTP"
    BEAN = "BEAN"


class AgentTool(BaseModel):
    """A tool registered for an agent."""

    id: str
    tenant_id: str
    agent_id: str
    name: str
    description: str = ""
    tool_type: ToolType = ToolType.ACTION
    config: Dict[str, Any] = Field(default_factory=dict)
    input_schema: Optional[Dict[str, Any]] = None
    output_schema: Optional[Dict[str, Any]] = None
    enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CreateToolRequest(BaseModel):
    agentId: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=256)
    description: str = ""
    toolType: ToolType = ToolType.ACTION
    config: Dict[str, Any] = Field(default_factory=dict)
    inputSchema: Optional[Dict[str, Any]] = None
    outputSchema: Optional[Dict[str, Any]] = None
    enabled: bool = True


class UpdateToolRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=256)
    description: Optional[str] = None
    toolType: Optional[ToolType] = None
    config: Optional[Dict[str, Any]] = None
    inputSchema: Optional[Dict[str, Any]] = None
    outputSchema: Optional[Dict[str, Any]] = None


class InvokeToolRequest(BaseModel):
    input: Dict[str, Any] = Field(default_factory=dict)


def tool_to_dict(tool: AgentTool) -> dict:
    return {
        "toolId": tool.id,
        "tenantId": tool.tenant_id,
        "agentId": tool.agent_id,
        "name": tool.name,
        "description": tool.description,
        "toolType": tool.tool_type.value,
        "config": tool.config,
        "inputSchema": tool.input_schema,
        "outputSchema": tool.output_schema,
        "enabled": tool.enabled,
        "createdAt": tool.created_at,
        "updatedAt": tool.updated_at,
    }
