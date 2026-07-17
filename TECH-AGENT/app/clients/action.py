"""TECH-ACTION client used by the Agent execution engine to invoke Actions.

When ``base_url`` is empty, the client returns a deterministic mock
response so the execution engine can run without the upstream service.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import httpx

from app.common.errors import LLMGWUnavailableError


class ActionClient:
    """Thin async client for TECH-ACTION synchronous execution.

    When ``base_url`` is empty, the client returns a deterministic mock
    response so the execution engine can run without the upstream service.
    """

    def __init__(self, base_url: str, timeout: float = 30.0) -> None:
        self._base_url = base_url.rstrip("/") if base_url else ""
        self._timeout = timeout

    async def execute(
        self,
        action_code: str,
        input_data: Dict[str, Any],
        *,
        tenant_id: str,
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not self._base_url:
            return self._mock_execute(action_code, input_data)

        headers = {
            "Content-Type": "application/json",
            "X-Tenant-Id": tenant_id,
        }
        if trace_id:
            headers["X-Trace-Id"] = trace_id

        payload = {
            "actionCode": action_code,
            "input": input_data,
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._base_url}/api/v1/action/executions/sync",
                    json=payload,
                    headers=headers,
                )
                resp.raise_for_status()
                return resp.json()["data"]
        except httpx.HTTPError as exc:
            raise LLMGWUnavailableError(
                f"Action 调用失败: {exc}",
                data={"actionCode": action_code},
            ) from exc

    async def list_actions(
        self,
        *,
        tenant_id: str,
        trace_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List available actions from TECH-ACTION."""
        if not self._base_url:
            return self._mock_list_actions()

        headers: Dict[str, str] = {"X-Tenant-Id": tenant_id}
        if trace_id:
            headers["X-Trace-Id"] = trace_id

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(
                    f"{self._base_url}/api/v1/action/actions",
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()["data"]
                return data.get("items", []) if isinstance(data, dict) else data
        except httpx.HTTPError as exc:
            raise LLMGWUnavailableError(
                f"Action 列表查询失败: {exc}",
            ) from exc

    async def get_action(
        self,
        action_code: str,
        *,
        tenant_id: str,
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get a single action definition (includes input/output schema)."""
        if not self._base_url:
            return self._mock_get_action(action_code)

        headers: Dict[str, str] = {"X-Tenant-Id": tenant_id}
        if trace_id:
            headers["X-Trace-Id"] = trace_id

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(
                    f"{self._base_url}/api/v1/action/actions/{action_code}",
                    headers=headers,
                )
                resp.raise_for_status()
                return resp.json()["data"]
        except httpx.HTTPError as exc:
            raise LLMGWUnavailableError(
                f"Action 详情查询失败: {exc}",
                data={"actionCode": action_code},
            ) from exc

    def to_function_definition(
        self,
        action_code: str,
        action_meta: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Convert an Action definition into an LLM function-calling definition."""
        desc = action_meta.get("description", f"Execute action: {action_code}")
        input_schema = action_meta.get("inputSchema") or {
            "type": "object",
            "properties": {},
        }
        return {
            "name": action_code,
            "description": desc,
            "parameters": input_schema,
        }

    # ----------------------------------------------------------- mock helpers

    def _mock_execute(
        self,
        action_code: str,
        input_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        return {
            "executionId": f"act-exec-mock-{action_code}",
            "actionId": f"act-{action_code}",
            "actionCode": action_code,
            "status": "SUCCESS",
            "output": {
                "result": f"Action '{action_code}' executed successfully (mock)",
                "inputEcho": input_data,
            },
        }

    def _mock_list_actions(self) -> List[Dict[str, Any]]:
        return [
            {
                "actionCode": "query-order-status",
                "name": "查询订单状态",
                "description": "根据订单号查询采购订单的当前状态",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "orderNo": {"type": "string", "description": "订单编号"},
                    },
                    "required": ["orderNo"],
                },
            },
            {
                "actionCode": "search-knowledge",
                "name": "搜索知识库",
                "description": "在知识库中检索相关文档",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "检索关键词"},
                    },
                    "required": ["query"],
                },
            },
        ]

    def _mock_get_action(self, action_code: str) -> Dict[str, Any]:
        return {
            "actionCode": action_code,
            "name": action_code,
            "description": f"Mock action: {action_code}",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "input": {"type": "string", "description": "输入参数"},
                },
            },
            "outputSchema": {
                "type": "object",
                "properties": {
                    "result": {"type": "string"},
                },
            },
        }
