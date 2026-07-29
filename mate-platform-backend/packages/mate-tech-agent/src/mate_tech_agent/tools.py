"""RAG tool bridge (debug version)."""
from __future__ import annotations

import logging
import os

import httpx

_log = logging.getLogger(__name__)


class RAGTool:
    DEFAULT_URL = "http://localhost:8001"

    def __init__(self, base_url=None, timeout=30.0):
        env_url = os.environ.get("RAG_URL", "")
        url = base_url or env_url or self.DEFAULT_URL
        self._base_url = url.rstrip("/")
        self._client = httpx.Client(timeout=timeout)
        _log.info("RAGTool init: RAG_URL env=%r base_url=%r -> %r", env_url, base_url, self._base_url)

    def search(self, query, top_k=5, mode="AUTO"):
        url = f"{self._base_url}/api/v1/rag/search"
        _log.info("RAGTool.search url=%s query=%r top_k=%d mode=%s", url, query, top_k, mode)
        try:
            r = self._client.post(url, json={"query": query, "top_k": top_k, "mode": mode})
            _log.info("RAGTool.search response: %d %s", r.status_code, r.text[:200])
            r.raise_for_status()
            data = r.json()
            hits = list(data.get("hits", []))
            _log.info("RAGTool.search hits: %d", len(hits))
            return hits
        except Exception as exc:
            _log.warning("RAG search failed: %s", exc)
            return []

    def close(self):
        self._client.close()


_rag_tool = None


def get_rag_tool():
    global _rag_tool
    if _rag_tool is None:
        _rag_tool = RAGTool()
    return _rag_tool


def set_rag_tool(tool):
    global _rag_tool
    _rag_tool = tool
