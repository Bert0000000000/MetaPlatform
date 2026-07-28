"""HTTP clients to downstream services (mate-tech-rag, mate-tech-agent)."""
from __future__ import annotations

import logging
import os
from typing import Any, Iterator

import httpx

_log = logging.getLogger(__name__)


class RAGClient:
    """HTTP client for mate-tech-rag /api/v1/rag/*."""

    DEFAULT_URL = "http://localhost:8001"

    def __init__(self, base_url=None, timeout=30.0):
        self._base_url = (base_url or os.environ.get("RAG_URL", self.DEFAULT_URL)).rstrip("/")
        self._client = httpx.Client(timeout=timeout)

    def upload(self, file_content, filename, document_id, content_type="text/plain"):
        files = {"file": (filename, file_content, content_type)}
        r = self._client.post(
            f"{self._base_url}/api/v1/rag/upload",
            files=files,
            params={"document_id": document_id},
        )
        r.raise_for_status()
        return r.json()

    def parse(self, document_id, content, metadata=None):
        r = self._client.post(
            f"{self._base_url}/api/v1/rag/parse",
            json={"document_id": document_id, "content": content, "metadata": metadata or {}},
        )
        r.raise_for_status()
        return r.json()

    def search(self, query, top_k=5, mode="AUTO"):
        r = self._client.post(
            f"{self._base_url}/api/v1/rag/search",
            json={"query": query, "top_k": top_k, "mode": mode},
        )
        r.raise_for_status()
        return r.json()

    def stats(self):
        r = self._client.get(f"{self._base_url}/api/v1/rag/stats")
        r.raise_for_status()
        return r.json()

    def status(self):
        r = self._client.get(f"{self._base_url}/api/v1/rag/status")
        r.raise_for_status()
        return r.json()

    def close(self):
        self._client.close()


class AgentClient:
    """HTTP client for mate-tech-agent /api/v1/agent/*."""

    DEFAULT_URL = "http://localhost:8002"

    def __init__(self, base_url=None, timeout=60.0):
        self._base_url = (base_url or os.environ.get("AGENT_URL", self.DEFAULT_URL)).rstrip("/")
        self._client = httpx.Client(timeout=timeout)

    def chat(self, message, scenario="S1", thread_id=None):
        body = {"message": message, "scenario": scenario}
        if thread_id:
            body["thread_id"] = thread_id
        r = self._client.post(f"{self._base_url}/api/v1/agent/chat", json=body)
        r.raise_for_status()
        return r.json()

    def review(self, thread_id, approved, feedback=""):
        r = self._client.post(
            f"{self._base_url}/api/v1/agent/review",
            json={"thread_id": thread_id, "approved": approved, "feedback": feedback},
        )
        r.raise_for_status()
        return r.json()

    def get_state(self, thread_id):
        r = self._client.get(f"{self._base_url}/api/v1/agent/state/{thread_id}")
        r.raise_for_status()
        return r.json()

    def stream_chat(self, message, scenario="S1", thread_id=None):
        body = {"message": message, "scenario": scenario}
        if thread_id:
            body["thread_id"] = thread_id
        with self._client.stream(
            "POST",
            f"{self._base_url}/api/v1/agent/chat/stream",
            json=body,
        ) as r:
            for line in r.iter_lines():
                yield line

    def close(self):
        self._client.close()