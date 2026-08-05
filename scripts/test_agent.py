"""mate-tech-agent baseline tests (S1 scenario)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for sub in ("mate-common", "mate-tech-rag", "mate-tech-agent"):
    p = str(ROOT / "packages" / sub / "src")
    if p not in sys.path:
        sys.path.insert(0, p)

import pytest
from fastapi.testclient import TestClient

from mate_tech_agent import __version__
from mate_tech_agent.api.app import create_app
from mate_tech_agent.graph import answer_node, build_s1_graph, retrieve_node, should_continue
from mate_tech_agent.state import AgentState
from mate_tech_agent.tools import set_rag_tool


class FakeRAGTool:
    def __init__(self, chunks):
        self._chunks = chunks
    def search(self, query, top_k=5, mode="AUTO"):
        return list(self._chunks)[:top_k]
    def close(self):
        pass


@pytest.fixture
def fake_rag_with_chunks():
    chunks = [
        {"chunk_id": "c1", "document_id": "d1", "score": 0.9, "text": "Python FastAPI is the backend framework.", "metadata": {}},
        {"chunk_id": "c2", "document_id": "d1", "score": 0.7, "text": "MatePlatform uses LangChain for AI.", "metadata": {}},
    ]
    set_rag_tool(FakeRAGTool(chunks))
    return chunks


@pytest.fixture
def fake_rag_empty():
    set_rag_tool(FakeRAGTool([]))
    return []


@pytest.fixture
def client(fake_rag_with_chunks) -> TestClient:
    return TestClient(create_app())


def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "mate-tech-agent"
    assert body["version"] == __version__


def test_chat_s1_with_chunks(client):
    r = client.post("/api/v1/agent/chat", json={"message": "What is the backend framework?"})
    assert r.status_code == 200
    body = r.json()
    assert body["scenario"] == "S1"
    assert "Python FastAPI" in body["answer"]
    assert len(body["retrieved_chunks"]) == 2
    assert body["tool_calls"][0]["name"] == "rag_search"
    assert body["latency_ms"] >= 0
    assert body["thread_id"]


def test_chat_s1_empty_results(client, fake_rag_empty):
    r = client.post("/api/v1/agent/chat", json={"message": "unknown query"})
    assert r.status_code == 200
    body = r.json()
    assert "could not find" in body["answer"]
    assert body["retrieved_chunks"] == []


def test_chat_validation_no_message():
    set_rag_tool(FakeRAGTool([]))
    c = TestClient(create_app())
    r = c.post("/api/v1/agent/chat", json={"message": ""})
    assert r.status_code == 422


def test_chat_s2_returns_501():
    set_rag_tool(FakeRAGTool([]))
    c = TestClient(create_app())
    r = c.post("/api/v1/agent/chat", json={"message": "test", "scenario": "S2"})
    assert r.status_code == 501
    assert "S2" in r.json()["detail"]


def test_sse_stream_endpoint(client):
    r = client.post("/api/v1/agent/chat/stream", json={"message": "What is FastAPI?"})
    assert r.status_code == 200
    assert "text/event-stream" in r.headers["content-type"]
    body = r.text
    assert "event: thread" in body
    assert "event: retrieve_start" in body
    assert "event: answer" in body
    assert "event: done" in body
    assert "Python FastAPI" in body


def test_sse_stream_s2_returns_501():
    set_rag_tool(FakeRAGTool([]))
    c = TestClient(create_app())
    r = c.post("/api/v1/agent/chat/stream", json={"message": "test", "scenario": "S2"})
    assert r.status_code == 501


def test_retrieve_node_extracts_query(fake_rag_with_chunks):
    state: AgentState = {"messages": [{"role": "user", "content": "what is X?"}], "thread_id": "t1"}
    out = retrieve_node(state)
    assert len(out["retrieved_chunks"]) == 2
    assert out["tool_calls"][0]["name"] == "rag_search"


def test_answer_node_synthesizes(fake_rag_with_chunks):
    state = {"messages": [{"role": "user", "content": "What is FastAPI?"}], "retrieved_chunks": fake_rag_with_chunks, "thread_id": "t1"}
    out = answer_node(state)
    assert "Python FastAPI" in out["answer"]
    assert "2 retrieved chunks" in out["answer"]


def test_answer_node_empty(fake_rag_empty):
    state = {"messages": [{"role": "user", "content": "unknown"}], "retrieved_chunks": [], "thread_id": "t1"}
    out = answer_node(state)
    assert "could not find" in out["answer"]


def test_should_continue_with_error():
    state = {"error": "something failed"}
    assert should_continue(state) == "__end__"


def test_should_continue_normal():
    state = {"messages": [], "thread_id": "t1"}
    assert should_continue(state) == "answer"


def test_s1_graph_compiles():
    g = build_s1_graph()
    assert g is not None
