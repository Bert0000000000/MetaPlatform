"""Pydantic schemas for Agent Card (A2A compatible JSON-LD format, P2-AGT-21)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AgentCardCapabilities(BaseModel):
    """Capabilities advertised in the Agent Card."""

    streaming: bool = True
    pushNotifications: bool = False
    stateTransition: bool = True


class AgentCardEndpoint(BaseModel):
    """An endpoint exposed by the agent."""

    type: str
    url: str
    description: str = ""


class AgentCardAuthentication(BaseModel):
    """Authentication scheme for the agent."""

    scheme: str = "bearer"
    description: str = "JWT Bearer token authentication"


class AgentCard(BaseModel):
    """A2A-compatible Agent Card in JSON-LD format."""

    id: str
    name: str
    description: str = ""
    version: str = "1.0.0"
    protocolVersion: str = "0.3.0"
    capabilities: AgentCardCapabilities = Field(default_factory=AgentCardCapabilities)
    endpoints: List[AgentCardEndpoint] = Field(default_factory=list)
    authentication: AgentCardAuthentication = Field(default_factory=AgentCardAuthentication)
    skills: List[Dict[str, Any]] = Field(default_factory=list)
    defaultInputModes: List[str] = Field(default_factory=lambda: ["text"])
    defaultOutputModes: List[str] = Field(default_factory=lambda: ["text"])
    metadata: Optional[Dict[str, Any]] = None


def card_to_dict(card: AgentCard) -> dict:
    """Serialize AgentCard to a JSON-LD compatible dict."""
    return {
        "@context": "https://www.w3.org/ns/agent-card/v1",
        "@type": "AgentCard",
        "id": card.id,
        "name": card.name,
        "description": card.description,
        "version": card.version,
        "protocolVersion": card.protocolVersion,
        "capabilities": {
            "streaming": card.capabilities.streaming,
            "pushNotifications": card.capabilities.pushNotifications,
            "stateTransition": card.capabilities.stateTransition,
        },
        "endpoints": [
            {
                "type": ep.type,
                "url": ep.url,
                "description": ep.description,
            }
            for ep in card.endpoints
        ],
        "authentication": {
            "scheme": card.authentication.scheme,
            "description": card.authentication.description,
        },
        "skills": card.skills,
        "defaultInputModes": card.defaultInputModes,
        "defaultOutputModes": card.defaultOutputModes,
        "metadata": card.metadata,
    }
