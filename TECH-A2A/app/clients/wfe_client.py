"""HTTP client for TECH-WFE integration.

When ``base_url`` is empty, the client returns a deterministic mock
response so routing to workflow execution can run without TECH-WFE.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

import httpx

from app.common.errors import UpstreamUnavailableError


class WFEClient:
    """Async client for TECH-WFE workflow API."""

    def __init__(self, base_url: str = "", timeout: float = 30.0) -> None:
        self._base_url = base_url.rstrip("/") if base_url else ""
        self._timeout = timeout

    async def start_workflow(
        self,
        workflow_id: str,
        input_data: Dict[str, Any],
        *,
        trace_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Route a task to TECH-WFE as a workflow execution.

        Calls POST /api/v1/wfe/process-instances.
        """

        if not self._base_url:
            return self._mock_start(workflow_id, input_data)

        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if trace_id:
            headers["X-Trace-Id"] = trace_id
        if tenant_id:
            headers["X-Tenant-Id"] = tenant_id

        payload = {
            "processDefinitionKey": workflow_id,
            "variables": input_data,
            "tenantId": tenant_id,
        }

        url = f"{self._base_url}/api/v1/wfe/process-instances"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                return resp.json().get("data", {})
        except httpx.HTTPError as exc:
            raise UpstreamUnavailableError(
                f"TECH-WFE 调用失败: {exc}",
                data={"workflowId": workflow_id},
            ) from exc

    def _mock_start(
        self,
        workflow_id: str,
        input_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        return {
            "instanceId": f"wf-mock-{uuid.uuid4().hex[:12]}",
            "workflowId": workflow_id,
            "status": "RUNNING",
            "input": input_data,
        }
