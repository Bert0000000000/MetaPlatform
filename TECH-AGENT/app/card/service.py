"""Agent Card service: generate A2A-compatible Agent Cards."""

from __future__ import annotations

from typing import Optional

from app.agents.service import AgentService
from app.card.schemas import (
    AgentCard,
    AgentCardAuthentication,
    AgentCardCapabilities,
    AgentCardEndpoint,
)


class AgentCardService:
    def __init__(self, agent_service: AgentService) -> None:
        self._agent_service = agent_service

    async def generate_card(
        self,
        tenant_id: str,
        agent_id: str,
        *,
        base_url: str = "http://localhost:8501",
    ) -> AgentCard:
        """Generate an A2A-compatible Agent Card for the given agent."""
        agent = await self._agent_service.get(tenant_id, agent_id)

        skills: list[dict] = []
        for tool in agent.tools:
            skills.append(
                {
                    "id": tool,
                    "name": tool,
                    "description": f"Tool: {tool}",
                }
            )

        if agent.rag_scopes:
            skills.append(
                {
                    "id": "rag-retrieval",
                    "name": "Knowledge Retrieval",
                    "description": f"Retrieve from: {', '.join(agent.rag_scopes)}",
                }
            )

        endpoints = [
            AgentCardEndpoint(
                type="sync",
                url=f"{base_url}/api/v1/agent/agents/{agent_id}/execute",
                description="Synchronous execution endpoint",
            ),
            AgentCardEndpoint(
                type="stream",
                url=f"{base_url}/api/v1/agent/agents/{agent_id}/execute/stream",
                description="SSE streaming execution endpoint",
            ),
        ]

        return AgentCard(
            id=f"agent:{agent_id}",
            name=agent.name,
            description=agent.description or f"Agent: {agent.name}",
            version="1.0.0",
            protocolVersion="0.3.0",
            capabilities=AgentCardCapabilities(
                streaming=True,
                pushNotifications=False,
                stateTransition=True,
            ),
            endpoints=endpoints,
            authentication=AgentCardAuthentication(
                scheme="bearer",
                description="JWT Bearer token authentication",
            ),
            skills=skills,
            defaultInputModes=["text"],
            defaultOutputModes=["text"],
            metadata={
                "agentCode": agent.agent_code,
                "modelId": agent.model_id,
                "status": agent.status.value,
                "tenantId": tenant_id,
            },
        )
