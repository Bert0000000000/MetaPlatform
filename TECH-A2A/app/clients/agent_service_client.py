"""HTTP client for TECH-AGENT integration.

When ``base_url`` is empty, the client returns a deterministic mock
response so routing to agent execution can run without TECH-AGENT.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

import httpx

from app.common.errors import UpstreamUnavailableError


class AgentServiceClient:
    """Async client for TECH-AGENT execution API."""

    def __init__(self, base_url: str = "", timeout: float = 30.0) -> None:
        self._base_url = base_url.rstrip("/") if base_url else ""
        self._timeout = timeout

    async def execute_agent(
        self,
        agent_id: str,
        input_text: str,
        *,
        trace_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Route a task to TECH-AGENT for execution.

        Calls POST /api/v1/agent/agents/{agent_id}/execute.
        """

        if not self._base_url:
            return self._mock_execute(agent_id, input_text)

        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if trace_id:
            headers["X-Trace-Id"] = trace_id
        if tenant_id:
            headers["X-Tenant-Id"] = tenant_id

        payload = {"input": input_text}

        url = f"{self._base_url}/api/v1/agent/agents/{agent_id}/execute"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                return resp.json().get("data", {})
        except httpx.HTTPError as exc:
            raise UpstreamUnavailableError(
                f"TECH-AGENT 调用失败: {exc}",
                data={"agentId": agent_id},
            ) from exc

    def _mock_execute(self, agent_id: str, input_text: str) -> Dict[str, Any]:
        return {
            "executionId": f"exec-mock-{uuid.uuid4().hex[:12]}",
            "agentId": agent_id,
            "status": "COMPLETED",
            "output": f"Mock agent execution for: {input_text}",
        }
