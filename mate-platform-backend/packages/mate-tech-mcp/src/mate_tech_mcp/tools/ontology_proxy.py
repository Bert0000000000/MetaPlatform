"""MP-SAL-01: ontology 工具三件套(MCP 对外面,ADR-0043 §2.3 消费者)。

mate-tech-mcp 以静态注册模型暴露三个代理工具,转发 tech-ont v2: 
- ``ont_list_classes``   → GET  /api/v1/ont/v2/agent-tools(虚拟注册表,类型发现)
- ``ont_inspect_class``  → GET  /api/v1/ont/v2/classes/{rid}/inspect
- ``ont_object_query``   → POST /api/v1/ont/v2/object-query(结构化 IR)

每类型 query_<slug> 薄外壳在 copilot agent loop(LLM FC)与 /agent-tools
端点侧物化;MCP 静态面暴露通用三件套(与 kb_search 同款 httpx + env URL 模式)。
"""

from __future__ import annotations

import os
from typing import Any, ClassVar

import httpx
import structlog

logger = structlog.get_logger(__name__)


class OntologyProxyTool:
    """tech-ont v2 代理工具基类。"""

    name: str = ""
    description: str = ""
    category: str = "ontology"
    input_schema: ClassVar[dict[str, Any]] = {"type": "object", "properties": {}}

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float = 30.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url or os.getenv(
            "TECH_ONT_URL", "http://localhost:8007"
        )
        self._client = client or httpx.AsyncClient(
            base_url=self._base_url, timeout=timeout,
        )

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        resp = await self._client.get(path, params=params)
        resp.raise_for_status()
        return resp.json()

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        resp = await self._client.post(path, json=payload)
        resp.raise_for_status()
        return resp.json()

    async def aclose(self) -> None:
        await self._client.aclose()


class OntListClassesTool(OntologyProxyTool):
    name = "ont_list_classes"
    description = "列出租户可见的本体对象类型(含 marking),发现可查询的类型"
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "markings": {
                "type": "string",
                "description": "逗号分隔的 agent markings(可见性过滤,可空)",
            },
        },
    }

    async def __call__(self, markings: str = "") -> dict[str, Any]:
        return await self._get(
            "/api/v1/ont/v2/agent-tools",
            params={"markings": markings} if markings else None,
        )


class OntInspectClassTool(OntologyProxyTool):
    name = "ont_inspect_class"
    description = "查看对象类型元数据: 属性(格式/类型)、可遍历 link、绑定动作"
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "class_rid": {"type": "string", "description": "对象类型 rid"},
        },
        "required": ["class_rid"],
    }

    async def __call__(self, class_rid: str) -> dict[str, Any]:
        return await self._get(f"/api/v1/ont/v2/classes/{class_rid}/inspect")


class OntObjectQueryTool(OntologyProxyTool):
    name = "ont_object_query"
    description = (
        "结构化 IR 查询本体对象(filters/aggregation/traversal/multi-key sort),"
        "返回 {kind, rows, result_schema}"
    )
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "source": {"type": "string", "description": "ObjectType rid"},
            "filters": {"type": "array", "items": {"type": "object"}},
            "aggregation": {"type": "object"},
            "traversal": {"type": "array", "items": {"type": "object"}},
            "sort": {"type": "array", "items": {"type": "object"}},
            "paging_limit": {"type": "integer"},
            "paging_offset": {"type": "integer"},
        },
        "required": ["source"],
    }

    async def __call__(self, **kwargs: Any) -> dict[str, Any]:
        payload = {k: v for k, v in kwargs.items() if v is not None}
        return await self._post("/api/v1/ont/v2/object-query", payload)


def build_ontology_proxy_tools() -> tuple[OntologyProxyTool, ...]:
    return (OntListClassesTool(), OntInspectClassTool(), OntObjectQueryTool())
