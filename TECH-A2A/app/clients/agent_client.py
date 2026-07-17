"""HTTP client for calling external A2A agents via JSON-RPC tasks/send.

When ``base_url`` is empty, the client returns a deterministic mock
response so the delegation flow can run without a real external agent.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

import httpx

from app.common.errors import UpstreamUnavailableError


class AgentClient:
    """Async client for external A2A agent JSON-RPC endpoints."""

    def __init__(self, base_url: str = "", timeout: float = 30.0) -> None:
        self._base_url = base_url.rstrip("/") if base_url else ""
        self._timeout = timeout

    async def send_task(
        self,
        target_endpoint: str,
        task_id: str,
        task_type: str,
        payload: Dict[str, Any],
        *,
        trace_id: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a JSON-RPC tasks/send request to an external agent.

        When ``self._base_url`` is empty (mock mode), the target_endpoint
        is ignored and a deterministic mock result is returned.
        """

        if not self._base_url:
            return self._mock_send_task(task_id, task_type, payload)

        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if trace_id:
            headers["X-Trace-Id"] = trace_id
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        jsonrpc_body = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "tasks/send",
            "params": {
                "id": task_id,
                "taskType": task_type,
                "payload": payload,
            },
        }

        url = f"{self._base_url}/{target_endpoint.lstrip('/')}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, json=jsonrpc_body, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                return data.get("result", data)
        except httpx.HTTPError as exc:
            raise UpstreamUnavailableError(
                f"外部 Agent 调用失败: {exc}",
                data={"endpoint": target_endpoint},
            ) from exc

    async def get_task(
        self,
        target_endpoint: str,
        task_id: str,
        *,
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a JSON-RPC tasks/get request to an external agent."""

        if not self._base_url:
            return self._mock_get_task(task_id)

        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if trace_id:
            headers["X-Trace-Id"] = trace_id

        jsonrpc_body = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "tasks/get",
            "params": {"id": task_id},
        }

        url = f"{self._base_url}/{target_endpoint.lstrip('/')}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, json=jsonrpc_body, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                return data.get("result", data)
        except httpx.HTTPError as exc:
            raise UpstreamUnavailableError(
                f"外部 Agent 查询失败: {exc}",
                data={"endpoint": target_endpoint},
            ) from exc

    async def cancel_task(
        self,
        target_endpoint: str,
        task_id: str,
        *,
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a JSON-RPC tasks/cancel request to an external agent."""

        if not self._base_url:
            return {"taskId": task_id, "status": "CANCELLED"}

        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if trace_id:
            headers["X-Trace-Id"] = trace_id

        jsonrpc_body = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "tasks/cancel",
            "params": {"id": task_id},
        }

        url = f"{self._base_url}/{target_endpoint.lstrip('/')}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, json=jsonrpc_body, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                return data.get("result", data)
        except httpx.HTTPError as exc:
            raise UpstreamUnavailableError(
                f"外部 Agent 取消失败: {exc}",
                data={"endpoint": target_endpoint},
            ) from exc

    # ----------------------------------------------------------- mock helpers

    def _mock_send_task(
        self,
        task_id: str,
        task_type: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        # mock 模式：将 artifacts 放在 result 内部，保证消费方从 result 中可直接
        # 拿到产出物占位列表（与真实 Agent 路径在 result 内放置 artifacts 对齐）。
        return {
            "id": task_id,
            "status": "COMPLETED",
            "result": {
                "taskType": task_type,
                "summary": f"Mock execution for task {task_id}",
                "output": payload,
                "artifacts": [],
            },
        }

    def _mock_get_task(self, task_id: str) -> Dict[str, Any]:
        return {
            "id": task_id,
            "status": "COMPLETED",
            "result": {"summary": f"Mock result for task {task_id}"},
            "artifacts": [],
        }
