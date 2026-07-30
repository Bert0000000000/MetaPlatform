"""mate-app-kb tests (business aggregation facade)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for sub in ("mate-common", "mate-app-kb"):
    p = str(ROOT / "packages" / sub / "src")
    if p not in sys.path:
        sys.path.insert(0, p)

import pytest
from fastapi.testclient import TestClient

from mate_app_kb import __version__
from mate_app_kb.api.app import create_app


class FakeRAGClient:
    def __init__(self):
        self.upload_calls = []

    def upload(self, content, filename, document_id, content_type):
        self.upload_calls.append((content, filename, document_id, content_type))
        return {
            "document_id": document_id,
            "filename": filename,
            "size_bytes": len(content),
            "chunk_count": 3,
            "indexed_in": ["hybrid", "graph", "lightrag"],
        }

    def search(self, query, top_k, mode):
        return {
            "query": query,
            "mode": mode,
            "total": 1,
            "hits": [{"chunk_id": "c1", "score": 0.9, "text": "fake hit", "metadata": {}}],
        }

    def stats(self):
        return {"total_chunks": 10, "embedder_dim": 384}

    def close(self):
        pass


class FakeAgentClient:
    def __init__(self):
        self.chat_calls = []

    def chat(self, message, scenario, thread_id):
        self.chat_calls.append((message, scenario, thread_id))
        return {
            "thread_id": thread_id or "auto-tid",
            "scenario": scenario,
            "answer": "fake answer for: " + message,
            "retrieved_chunks": [],
            "tool_calls": [],
        }

    def close(self):
        pass


@pytest.fixture
def client():
    fake_rag = FakeRAGClient()
    fake_agent = FakeAgentClient()
    return TestClient(create_app(rag=fake_rag, agent=fake_agent))


def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "mate-app-kb"
    assert body["version"] == __version__


def test_upload_fanout(client):
    r = client.post(
        "/api/v1/app-kb/upload",
        files={"file": ("test.txt", b"some content here", "text/plain")},
        params={"document_id": "doc-1"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["document_id"] == "doc-1"
    assert body["chunk_count"] == 3
    assert sorted(body["indexed_in"]) == ["graph", "hybrid", "lightrag"]


def test_upload_empty_file_400(client):
    r = client.post(
        "/api/v1/app-kb/upload",
        files={"file": ("empty.txt", b"", "text/plain")},
    )
    assert r.status_code == 400


def test_search_aggregates_rag(client):
    r = client.post(
        "/api/v1/app-kb/search",
        json={"query": "What is FastAPI?", "top_k": 3, "mode": "FACTUAL"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["query"] == "What is FastAPI?"
    assert body["mode"] == "FACTUAL"
    assert body["total"] == 1


def test_search_validation_empty_query(client):
    r = client.post("/api/v1/app-kb/search", json={"query": "", "top_k": 5})
    assert r.status_code == 422


def test_chat_aggregates_agent(client):
    r = client.post(
        "/api/v1/app-kb/chat",
        json={"message": "What is MatePlatform?", "scenario": "S1", "thread_id": "app-kb-1"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["thread_id"] == "app-kb-1"
    assert body["scenario"] == "S1"
    assert "fake answer" in body["answer"]


def test_chat_s3_aggregates_agent(client):
    r = client.post(
        "/api/v1/app-kb/chat",
        json={"message": "test", "scenario": "S3", "thread_id": "app-kb-s3"},
    )
    assert r.status_code == 200
    assert r.json()["scenario"] == "S3"


def test_chat_s4_returns_422_via_validation(client):
    r = client.post(
        "/api/v1/app-kb/chat",
        json={"message": "test", "scenario": "S4"},
    )
    assert r.status_code == 422


def test_stats_aggregates_rag(client):
    r = client.get("/api/v1/app-kb/stats")
    assert r.status_code == 200
    body = r.json()
    assert body["total_chunks"] == 10
    assert body["embedder_dim"] == 384


def test_openapi_has_all_endpoints(client):
    r = client.get("/openapi.json")
    assert r.status_code == 200
    paths = r.json().get("paths", {})
    expected = {
        "/healthz",
        "/api/v1/app-kb/upload",
        "/api/v1/app-kb/search",
        "/api/v1/app-kb/chat",
        "/api/v1/app-kb/chat/stream",
        "/api/v1/app-kb/stats",
    }
    assert expected.issubset(set(paths.keys()))


def test_clients_have_correct_defaults():
    from mate_app_kb.clients import AgentClient, RAGClient

    rag = RAGClient(base_url="http://x:1234")
    assert rag._base_url == "http://x:1234"
    assert rag.DEFAULT_URL == "http://localhost:8001"
    rag.close()

    ag = AgentClient(base_url="http://x:5678")
    assert ag._base_url == "http://x:5678"
    assert ag.DEFAULT_URL == "http://localhost:8002"
    ag.close()
