"""LightRAGClient (THEMATIC) — real httpx client for HKUDS LightRAG HTTP API."""
from __future__ import annotations

import logging
import os
from typing import Protocol

import httpx

from mate_tech_rag.api.schemas import ChunkHit

_log = logging.getLogger(__name__)


class LightRAGClient(Protocol):
    def query(self, query, top_k=10): ...
    def insert(self, text, document_id, metadata=None): ...
    def count(self): ...


class HttpxLightRAGClient:
    """httpx client for HKUDS LightRAG (port 9621 by default).

    Endpoints:
    - POST /query       {"query": str, "mode": "local"|"global"|"hybrid", "top_k": int}
    - POST /aquery      (async)
    - POST /insert_text {"text": str, "file_source": str}
    - GET  /health

    Env: LIGHTRAG_URL, LIGHTRAG_API_KEY (optional)
    """

    DEFAULT_URL = "http://localhost:9621"
    DEFAULT_MODE = "hybrid"

    def __init__(self, base_url=None, api_key=None, mode=None, timeout=30.0):
        self._base_url = (base_url or os.environ.get("LIGHTRAG_URL", self.DEFAULT_URL)).rstrip("/")
        self._api_key = api_key or os.environ.get("LIGHTRAG_API_KEY", "")
        self._mode = mode or os.environ.get("LIGHTRAG_MODE", self.DEFAULT_MODE)
        self._client = httpx.Client(timeout=timeout)
        self._available = False
        self._check()

    def _headers(self):
        h = {"Content-Type": "application/json"}
        if self._api_key:
            h["X-API-Key"] = self._api_key
        return h

    def _check(self):
        try:
            r = self._client.get(f"{self._base_url}/health", headers=self._headers(), timeout=5.0)
            self._available = r.status_code == 200
            if self._available:
                _log.info("LightRAG ACTIVE at %s", self._base_url)
            else:
                _log.info("LightRAG responded %d at %s", r.status_code, self._base_url)
        except Exception as exc:
            _log.info("LightRAG unavailable at %s: %s", self._base_url, exc)
            self._available = False

    def query(self, query, top_k=10):
        if not query.strip():
            return []
        if not self._available:
            return []
        try:
            r = self._client.post(
                f"{self._base_url}/query",
                headers=self._headers(),
                json={"query": query, "mode": self._mode, "top_k": max(1, top_k), "only_need_context": True},
            )
            r.raise_for_status()
            data = r.json()
        except Exception as exc:
            _log.warning("LightRAG query failed: %s", exc)
            return []
        chunks = data.get("chunks") or data.get("data") or []
        hits = []
        for i, c in enumerate(chunks[:top_k]):
            if isinstance(c, dict):
                content = c.get("content", "")
                score = float(c.get("score", 1.0 / (1.0 + i)))
                cid = str(c.get("id", f"lrag-remote-{i}"))
            else:
                content = str(c)
                score = 1.0 / (1.0 + i)
                cid = f"lrag-remote-{i}"
            hits.append(
                ChunkHit(
                    chunk_id=cid,
                    document_id="lightrag-remote",
                    score=max(0.0, min(1.0, score)),
                    text=content[:1000],
                    metadata={"mode": "THEMATIC", "source": "lightrag-http"},
                )
            )
        return hits

    def insert(self, text, document_id, metadata=None):
        if not self._available:
            return f"lrag-stub-{document_id}"
        try:
            r = self._client.post(
                f"{self._base_url}/insert_text",
                headers=self._headers(),
                json={"text": text, "file_source": document_id},
            )
            r.raise_for_status()
            data = r.json()
            return str(data.get("id", document_id))
        except Exception as exc:
            _log.warning("LightRAG insert failed: %s", exc)
            return f"lrag-err-{document_id}"

    def count(self):
        if not self._available:
            return 0
        try:
            r = self._client.get(f"{self._base_url}/health", headers=self._headers(), timeout=5.0)
            return 1 if r.status_code == 200 else 0
        except Exception:
            return 0

    def close(self):
        self._client.close()
