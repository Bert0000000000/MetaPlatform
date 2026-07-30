"""v0.8 tests: LLM streaming + S3 HITL."""
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

from mate_tech_agent.api.app import _PENDING_REVIEWS, create_app
from mate_tech_agent.graph import build_s3_graph, human_review_node, post_review_node
from mate_tech_agent.llm import EchoLLM, NoOpLLM, stream_answer
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
    ]
    set_rag_tool(FakeRAGTool(chunks))
    return chunks


@pytest.fixture
def client(rag_with_chunks):
    return TestClient(create_app())


# ---------- LLM streaming ----------
def test_noop_llm_stream_yields_words():
    llm = NoOpLLM()
    tokens = list(llm.stream("hello world foo bar"))
    assert len(tokens) >= 4
    assert "".join(tokens).strip()


def test_echo_llm_stream_yields_words():
    llm = EchoLLM()
    tokens = list(llm.stream("test query"))
    assert len(tokens) >= 2


def test_stream_answer_yields_tokens():
    llm = EchoLLM()
    chunks = [{"text": "FastAPI is Python.", "score": 0.9}]
    tokens = list(stream_answer(llm, "What is FastAPI?", chunks))
    assert len(tokens) >= 3
    full = "".join(tokens)
    assert "FastAPI" in full


def test_stream_answer_no_chunks():
    llm = EchoLLM()
    tokens = list(stream_answer(llm, "unknown", []))
    assert "".join(tokens)


# ---------- S3 HITL ----------
def test_s3_graph_compiles():
    assert build_s3_graph() is not None


def test_human_review_node_marks_pending():
    state = {"answer": "draft", "thread_id": "t-1"}
    out = human_review_node(state)
    assert out["pending_review"] is True
    assert "AWAITING" in out["answer"]


def test_post_review_approved():
    state = {"answer": "draft", "thread_id": "t-1", "approved": True, "feedback": "looks good"}
    out = post_review_node(state)
    assert out["pending_review"] is False
    assert "REVIEWED" in out["answer"]
    assert "looks good" in out["answer"]


def test_post_review_aborted():
    state = {"answer": "draft", "thread_id": "t-1", "approved": False}
    out = post_review_node(state)
    assert "ABORTED" in out["answer"]


def test_chat_s3_creates_pending_review(client):
    r = client.post(
        "/api/v1/agent/chat",
        json={"message": "What is FastAPI?", "scenario": "S3", "thread_id": "hitl-1"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "AWAITING" in body["answer"] or "awaiting" in body["answer"].lower()
    assert "hitl-1" in _PENDING_REVIEWS


def test_review_approve_completes(client):
    client.post(
        "/api/v1/agent/chat",
        json={"message": "What is FastAPI?", "scenario": "S3", "thread_id": "hitl-2"},
    )
    r = client.post(
        "/api/v1/agent/review",
        json={"thread_id": "hitl-2", "approved": True, "feedback": "ok"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "approved"
    assert "REVIEWED" in body["message"]


def test_review_abort(client):
    client.post(
        "/api/v1/agent/chat",
        json={"message": "What is FastAPI?", "scenario": "S3", "thread_id": "hitl-3"},
    )
    r = client.post(
        "/api/v1/agent/review",
        json={"thread_id": "hitl-3", "approved": False, "feedback": "rejected"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "aborted"
    assert "ABORTED" in body["message"]


def test_review_no_pending(client):
    r = client.post(
        "/api/v1/agent/review",
        json={"thread_id": "no-pending-1", "approved": True, "feedback": ""},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "no_pending"


def test_chat_s4_returns_200(client):
    r = client.post(
        "/api/v1/agent/chat",
        json={"message": "test", "scenario": "S4"},
    )
    assert r.status_code == 200
    assert r.json()["scenario"] == "S4"


# ---------- SSE streaming ----------
def test_sse_stream_s1_emits_token_events(client):
    r = client.post(
        "/api/v1/agent/chat/stream",
        json={"message": "What is FastAPI?", "scenario": "S1"},
    )
    assert r.status_code == 200
    assert "text/event-stream" in r.headers["content-type"]
    body = r.text
    assert "event: thread" in body
    assert "event: retrieve_done" in body
    assert "event: llm_start" in body
    assert "event: token" in body
    assert "event: llm_done" in body
    assert "event: done" in body


def test_sse_stream_s3_emits_awaiting_review_event(client):
    r = client.post(
        "/api/v1/agent/chat/stream",
        json={"message": "What is FastAPI?", "scenario": "S3"},
    )
    assert r.status_code == 200
    body = r.text
    assert "event: awaiting_review" in body
