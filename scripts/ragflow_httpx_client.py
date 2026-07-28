"""RAGFlowClient — real httpx client for infiniflow/ragflow HTTP API."""
from __future__ import annotations

import logging
import os
from typing import Protocol

import httpx

_log = logging.getLogger(__name__)


class RAGFlowClient(Protocol):
    def parse(self, content, document_id, *, metadata=None): ...
    def parse_bytes(self, raw, document_id, *, filename="", metadata=None): ...
    def count(self): ...


class HttpxRAGFlowClient:
    """httpx client for infiniflow/ragflow (DeepDoc parser).

    Endpoints:
    - POST /api/v1/datasets/{id}/documents (upload)
    - POST /api/v1/chunks (parse chunks from doc)
    - GET  /api/v1/datasets

    Env: RAGFLOW_URL, RAGFLOW_API_KEY, RAGFLOW_DATASET_ID
    """

    DEFAULT_URL = "http://localhost:9380"
    DEFAULT_DATASET = "mate-kb"

    def __init__(self, base_url=None, api_key=None, dataset_id=None, timeout=60.0):
        self._base_url = (base_url or os.environ.get("RAGFLOW_URL", self.DEFAULT_URL)).rstrip("/")
        self._api_key = api_key or os.environ.get("RAGFLOW_API_KEY", "")
        self._dataset_id = dataset_id or os.environ.get("RAGFLOW_DATASET_ID", self.DEFAULT_DATASET)
        self._client = httpx.Client(timeout=timeout)
        self._available = False
        self._check()

    def _headers(self):
        h = {"Content-Type": "application/json"}
        if self._api_key:
            h["Authorization"] = f"Bearer {self._api_key}"
        return h

    def _check(self):
        try:
            r = self._client.get(f"{self._base_url}/api/v1/datasets", headers=self._headers(), timeout=5.0)
            self._available = r.status_code in (200, 401)  # 401 = no auth but server up
            if self._available:
                _log.info("RAGFlow ACTIVE at %s (status %d)", self._base_url, r.status_code)
        except Exception as exc:
            _log.info("RAGFlow unavailable at %s: %s", self._base_url, exc)
            self._available = False

    def parse(self, content, document_id, *, metadata=None):
        if not content.strip():
            return []
        if not self._available:
            return [content]  # fallback: treat whole content as 1 chunk
        try:
            r = self._client.post(
                f"{self._base_url}/api/v1/datasets/{self._dataset_id}/chunks",
                headers=self._headers(),
                json={"doc_id": document_id, "text": content, "metadata": metadata or {}},
            )
            r.raise_for_status()
            data = r.json()
            chunks = data.get("data", {}).get("chunks", [])
            return [c.get("content", content) for c in chunks] or [content]
        except Exception as exc:
            _log.warning("RAGFlow parse failed: %s", exc)
            return [content]

    def parse_bytes(self, raw, document_id, *, filename="", metadata=None):
        if not raw:
            return []
        for enc in ("utf-8", "utf-8-sig", "gbk", "latin-1"):
            try:
                text = raw.decode(enc)
                meta = dict(metadata or {})
                if filename:
                    meta["filename"] = filename
                return self.parse(text, document_id, metadata=meta)
            except UnicodeDecodeError:
                continue
        return []

    def count(self):
        if not self._available:
            return 0
        try:
            r = self._client.get(f"{self._base_url}/api/v1/datasets/{self._dataset_id}/documents", headers=self._headers(), timeout=5.0)
            if r.status_code == 200:
                data = r.json()
                return len(data.get("data", {}).get("docs", []))
        except Exception:
            pass
        return 0

    def close(self):
        self._client.close()
