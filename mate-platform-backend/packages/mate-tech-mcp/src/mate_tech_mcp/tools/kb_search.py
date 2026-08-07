"""kb_search tool (ST-5.3.2).

通过 httpx 调 tech-rag HTTP bridge, 返回 top_k 命中.
"""
from __future__ import annotations

import os
from typing import Any, ClassVar

import httpx
import structlog

logger = structlog.get_logger(__name__)


class KbSearchTool:
    """kb_search(query, top_k, kb_ids) -> 调 tech-rag."""

    name = "kb_search"
    description = "在知识库中检索相关文档(走 tech-rag 的 /api/v1/rag/search 端点)"
    category = "知识检索"
    handler: Any = None
    input_schema: ClassVar[dict[str, Any]] = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "检索查询"},
            "top_k": {"type": "integer", "default": 5, "description": "返回 Top-K"},
            "kb_ids": {
                "type": "array",
                "items": {"type": "string"},
                "description": "限定检索的知识库 ID 列表",
            },
        },
        "required": ["query"],
    }

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float = 30.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url or os.getenv(
            "TECH_RAG_URL", "http://localhost:8006"
        )
        self._client = client or httpx.AsyncClient(
            base_url=self._base_url,
            timeout=timeout,
        )

    async def __call__(
        self,
        *,
        query: str,
        top_k: int = 5,
        kb_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        """执行 kb_search 工具."""
        payload: dict[str, Any] = {"query": query, "top_k": top_k}
        if kb_ids:
            payload["kb_ids"] = kb_ids
        try:
            resp = await self._client.post(
                "/api/v1/rag/search", json=payload
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("kb_search.ok", query=query, hits=len(data.get("hits", [])))
            return {
                "query": query,
                "top_k": top_k,
                "hits": data.get("hits", []),
                "total": data.get("total", 0),
            }
        except httpx.HTTPError as e:
            logger.error("kb_search.http_error", error=str(e))
            return {"error": f"tech-rag unreachable: {e}", "query": query}
        except Exception as e:
            logger.error("kb_search.error", error=str(e))
            return {"error": str(e), "query": query}

    async def aclose(self) -> None:
        await self._client.aclose()


def build_kb_search_tool() -> KbSearchTool:
    """Factory."""
    t = KbSearchTool()
    t.handler = t  # MCPServer.call_tool 通过 handler(**kwargs) 调用
    return t