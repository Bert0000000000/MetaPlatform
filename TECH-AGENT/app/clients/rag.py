"""TECH-RAG client used by the Agent execution engine for knowledge retrieval.

When ``base_url`` is empty, the client returns a deterministic mock
response so the execution engine can run without the upstream service.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import httpx

from app.common.errors import LLMGWUnavailableError


class RAGClient:
    """Thin async client for TECH-RAG knowledge retrieval.

    When ``base_url`` is empty, the client returns a deterministic mock
    response so the execution engine can run without the upstream service.
    """

    def __init__(self, base_url: str, timeout: float = 30.0) -> None:
        self._base_url = base_url.rstrip("/") if base_url else ""
        self._timeout = timeout

    async def search(
        self,
        query: str,
        knowledge_base_ids: Optional[List[str]] = None,
        *,
        top_k: int = 5,
        tenant_id: str = "",
        trace_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Search the knowledge base for relevant documents.

        Returns a list of retrieval results, each with ``content``,
        ``score``, ``source``, and ``metadata``.
        """
        if not self._base_url:
            return self._mock_search(query, knowledge_base_ids, top_k)

        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if tenant_id:
            headers["X-Tenant-Id"] = tenant_id
        if trace_id:
            headers["X-Trace-Id"] = trace_id

        payload: Dict[str, Any] = {
            "query": query,
            "topK": top_k,
        }
        if knowledge_base_ids:
            payload["knowledgeBaseIds"] = knowledge_base_ids

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._base_url}/api/v1/rag/search",
                    json=payload,
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()["data"]
                return data.get("items", []) if isinstance(data, dict) else data
        except httpx.HTTPError as exc:
            raise LLMGWUnavailableError(
                f"RAG 检索失败: {exc}",
                data={"query": query},
            ) from exc

    async def list_knowledge_bases(
        self,
        *,
        tenant_id: str = "",
        trace_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List available knowledge bases from TECH-RAG."""
        if not self._base_url:
            return self._mock_list_knowledge_bases()

        headers: Dict[str, str] = {}
        if tenant_id:
            headers["X-Tenant-Id"] = tenant_id
        if trace_id:
            headers["X-Trace-Id"] = trace_id

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(
                    f"{self._base_url}/api/v1/rag/knowledge-bases",
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()["data"]
                return data.get("items", []) if isinstance(data, dict) else data
        except httpx.HTTPError as exc:
            raise LLMGWUnavailableError(
                f"知识库列表查询失败: {exc}",
            ) from exc

    def format_context(self, results: List[Dict[str, Any]]) -> str:
        """Format retrieval results into a context string for the LLM."""
        if not results:
            return ""
        parts: list[str] = []
        for i, r in enumerate(results, 1):
            content = r.get("content", "")
            source = r.get("source", "")
            score = r.get("score", 0.0)
            parts.append(
                f"[{i}] (来源: {source}, 相关度: {score:.2f})\n{content}"
            )
        return "\n\n".join(parts)

    # ----------------------------------------------------------- mock helpers

    def _mock_search(
        self,
        query: str,
        knowledge_base_ids: Optional[List[str]],
        top_k: int,
    ) -> List[Dict[str, Any]]:
        kb = ", ".join(knowledge_base_ids) if knowledge_base_ids else "default"
        results: List[Dict[str, Any]] = []
        for i in range(min(top_k, 3)):
            results.append(
                {
                    "content": f"检索结果 {i + 1}：关于「{query}」的知识片段（来源知识库: {kb}）。",
                    "score": round(0.95 - i * 0.1, 2),
                    "source": f"kb-{kb}",
                    "metadata": {"chunkIndex": i, "query": query},
                }
            )
        return results

    def _mock_list_knowledge_bases(self) -> List[Dict[str, Any]]:
        return [
            {
                "knowledgeBaseId": "kb-procurement",
                "name": "采购知识库",
                "description": "采购流程、供应商管理相关知识",
                "documentCount": 128,
            },
            {
                "knowledgeBaseId": "kb-finance",
                "name": "财务知识库",
                "description": "财务报销、预算管理相关知识",
                "documentCount": 256,
            },
        ]
