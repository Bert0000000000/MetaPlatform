"""Tests for v0.7: memory + LLM + S2."""
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

from mate_tech_agent.api.app import create_app
from mate_tech_agent.graph import build_s2_graph, planner_node, worker_node
from mate_tech_agent.llm import EchoLLM, NoOpLLM, get_llm, synthesize_answer
from mate_tech_agent.memory import delete_state, load_state, save_state
from mate_tech_agent.tools import set_rag_tool


class FakeRAGTool:
    def __init__(self, chunks):
        self._chunks = chunks

    def search(self, query, top_k=5, mode="AUTO"):
        return list(self._chunks)[:top_k]

    def close(self):
        pass


@pytest.fixture
def rag_with_chunks():
    chunks = [
        {"chunk_id": "c1", "document_id": "d1", "score": 0.9, "text": "Python FastAPI is the backend framework.", "metadata": {}},
        {"chunk_id": "c2", "document_id": "d1", "score": 0.7, "text": "MatePlatform uses LangChain.", "metadata": {}},
        {"chunk_id": "c3", "document_id": "d2", "score": 0.5, "text": "External AI engines include LightRAG and Flowable.", "metadata": {}},
    ]
    set_rag_tool(FakeRAGTool(chunks))
    return chunks


@pytest.fixture
def client(rag_with_chunks):
    return TestClient(create_app())


# memory tests
def test_memory_save_load_roundtrip(tmp_path, monkeypatch):
    from mate_tech_agent import memory
    monkeypatch.setattr(memory, "_STORAGE_DIR", tmp_path)
    save_state("t-1", {"messages": [{"role": "user", "content": "hi"}], "answer": "hello"})
    loaded = load_state("t-1")
    assert loaded is not None
    assert loaded["state"]["answer"] == "hello"


def test_memory_load_missing_returns_none(tmp_path, monkeypatch):
    from mate_tech_agent import memory
    monkeypatch.setattr(memory, "_STORAGE_DIR", tmp_path)
    assert load_state("nonexistent") is None


def test_memory_delete(tmp_path, monkeypatch):
    from mate_tech_agent import memory
    monkeypatch.setattr(memory, "_STORAGE_DIR", tmp_path)
    save_state("t-2", {"x": 1})
    assert delete_state("t-2") is True
    assert load_state("t-2") is None
    assert delete_state("t-2") is False


# LLM tests
def test_noop_llm():
    llm = NoOpLLM()
    out = llm.invoke("hello world")
    assert "NoOpLLM" in out
    assert "hello world" in out


def test_echo_llm():
    llm = EchoLLM()
    out = llm.invoke("test query")
    assert "test query" in out


def test_get_llm_default_is_echo(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    llm = get_llm()
    assert type(llm).__name__ == "EchoLLM"


def test_synthesize_answer_with_chunks():
    chunks = [{"text": "FastAPI is Python web framework.", "score": 0.9}]
    out = synthesize_answer(EchoLLM(), "What is FastAPI?", chunks)
    assert "FastAPI" in out


def test_synthesize_answer_no_chunks():
    out = synthesize_answer(EchoLLM(), "unknown", [])
    assert "No context" in out


# S2 graph tests
def test_planner_node_decomposes(rag_with_chunks):
    state = {"messages": [{"role": "user", "content": "What is MetaPlatform?"}]}
    out = planner_node(state)
    assert len(out["sub_questions"]) >= 2


def test_worker_node_runs_rag(rag_with_chunks):
    state = {"sub_questions": ["q1 (overview)", "q2 (details)"]}
    out = worker_node(state)
    assert len(out["retrieved_chunks"]) > 0


def test_s2_graph_compiles():
    assert build_s2_graph() is not None


# API tests
def test_chat_s2_with_chunks(client):
    r = client.post("/api/v1/agent/chat", json={"message": "What is FastAPI?", "scenario": "S2"})
    assert r.status_code == 200
    body = r.json()
    assert body["scenario"] == "S2"
    assert body["thread_id"]


def test_chat_s3_returns_200(client):
    r = client.post("/api/v1/agent/chat", json={"message": "test", "scenario": "S3"})
    assert r.json()["scenario"] == "S3"


def test_state_get_after_chat(client, tmp_path, monkeypatch):
    from mate_tech_agent import memory
    monkeypatch.setattr(memory, "_STORAGE_DIR", tmp_path)
    r = client.post(
        "/api/v1/agent/chat",
        json={"message": "What is FastAPI?", "scenario": "S1", "thread_id": "test-thread-1"},
    )
    assert r.status_code == 200
    r2 = client.get("/api/v1/agent/state/test-thread-1")
    assert r2.status_code == 200
    body = r2.json()
    assert body["state"]["thread_id"] == "test-thread-1"


def test_state_get_404(client):
    r = client.get("/api/v1/agent/state/nonexistent-thread")
    assert r.status_code == 404


def test_state_delete_endpoint(client, tmp_path, monkeypatch):
    from mate_tech_agent import memory
    monkeypatch.setattr(memory, "_STORAGE_DIR", tmp_path)
    client.post(
        "/api/v1/agent/chat",
        json={"message": "test", "scenario": "S1", "thread_id": "del-thread"},
    )
    r = client.delete("/api/v1/agent/state/del-thread")
    assert r.status_code == 200
    assert r.json()["deleted"] == "del-thread"
    r2 = client.delete("/api/v1/agent/state/del-thread")
    assert r2.status_code == 404


def test_sse_stream_s2(client):
    r = client.post("/api/v1/agent/chat/stream", json={"message": "What is FastAPI?", "scenario": "S2"})
    assert r.status_code == 200
    assert "text/event-stream" in r.headers["content-type"]
    body = r.text
    assert "event: thread" in body


def test_thread_id_persists_across_calls(client, tmp_path, monkeypatch):
    from mate_tech_agent import memory
    monkeypatch.setattr(memory, "_STORAGE_DIR", tmp_path)
    r1 = client.post(
        "/api/v1/agent/chat",
        json={"message": "first", "scenario": "S1", "thread_id": "persist-1"},
    )
    assert r1.status_code == 200
    r2 = client.post(
        "/api/v1/agent/chat",
        json={"message": "second", "scenario": "S1", "thread_id": "persist-1"},
    )
    assert r2.status_code == 200
    assert r1.json()["thread_id"] == r2.json()["thread_id"] == "persist-1"
