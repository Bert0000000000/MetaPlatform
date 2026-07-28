"""RAG HTTP tool (calls mate-tech-rag /api/v1/rag/search)."""
from __future__ import annotations

import logging
import os
from typing import Any

import httpx

_log = logging.getLogger(__name__)


class RAGTool:
    DEFAULT_URL = "http://localhost:8001"

    def __init__(self, base_url=None, timeout=30.0):
        self._base_url = (base_url or os.environ.get("RAG_URL", self.DEFAULT_URL)).rstrip("/")
        self._client = httpx.Client(timeout=timeout)

    def search(self, query, top_k=5, mode="AUTO"):
        try:
            r = self._client.post(
                f"{self._base_url}/api/v1/rag/search",
                json={"query": query, "top_k": top_k, "mode": mode},
            )
            r.raise_for_status()
            return list(r.json().get("hits", []))
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