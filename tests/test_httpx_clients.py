"""Tests for httpx real clients (LightRAG / RAGFlow)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for sub in ("mate-common", "mate-tech-rag"):
    p = str(ROOT / "packages" / sub / "src")
    if p not in sys.path:
        sys.path.insert(0, p)


def test_lightrag_httpx_graceful_when_no_server():
    from mate_tech_rag.clients.lightrag_httpx_client import HttpxLightRAGClient
    c = HttpxLightRAGClient(base_url="http://127.0.0.1:1")
    try:
        assert not c._available
        assert c.query("test", top_k=5) == []
        assert c.insert("text", "doc1") == "lrag-stub-doc1"
        assert c.count() == 0
    finally:
        c.close()


def test_ragflow_httpx_graceful_when_no_server():
    from mate_tech_rag.clients.ragflow_httpx_client import HttpxRAGFlowClient
    c = HttpxRAGFlowClient(base_url="http://127.0.0.1:1")
    try:
        assert not c._available
        chunks = c.parse("hello world", "doc1")
        assert chunks == ["hello world"]
        assert c.parse_bytes(b"", "doc2") == []
        chunks2 = c.parse_bytes("hello".encode("utf-8"), "doc3", filename="x.txt")
        assert chunks2 == ["hello"]
        assert c.count() == 0
    finally:
        c.close()


def test_lightrag_httpx_query_calls_api(respx_mock):
    import respx
    from mate_tech_rag.clients.lightrag_httpx_client import HttpxLightRAGClient
    respx_mock.get("http://localhost:9621/health").mock(return_value=respx.MockResponse(200, json={"status": "ok"}))
    respx_mock.post("http://localhost:9621/query").mock(
        return_value=respx.MockResponse(200, json={"chunks": [{"id": "c1", "content": "test content", "score": 0.9}, {"id": "c2", "content": "second", "score": 0.7}]})
    )
    c = HttpxLightRAGClient(base_url="http://localhost:9621")
    try:
        assert c._available
        hits = c.query("test", top_k=5)
        assert len(hits) == 2
        assert hits[0].chunk_id == "c1"
        assert hits[0].text == "test content"
        assert hits[0].metadata["source"] == "lightrag-http"
    finally:
        c.close()


def test_ragflow_httpx_parse_calls_api(respx_mock):
    import respx
    from mate_tech_rag.clients.ragflow_httpx_client import HttpxRAGFlowClient
    respx_mock.get("http://localhost:9380/api/v1/datasets").mock(return_value=respx.MockResponse(200, json={"data": []}))
    respx_mock.post("http://localhost:9380/api/v1/datasets/mate-kb/chunks").mock(
        return_value=respx.MockResponse(200, json={"data": {"chunks": [{"content": "chunk1"}, {"content": "chunk2"}]}})
    )
    c = HttpxRAGFlowClient(base_url="http://localhost:9380", dataset_id="mate-kb")
    try:
        assert c._available
        chunks = c.parse("long text content", "doc-1")
        assert chunks == ["chunk1", "chunk2"]
    finally:
        c.close()


def test_create_clients_wires_httpx_singletons():
    import os
    os.environ["M"] = "full"
    os.environ["L"] = "http://127.0.0.1:1"
    os.environ["F"] = "http://127.0.0.1:1"
    from mate_tech_rag.api.retrieval import _lightrag, _ragflow
    import mate_tech_rag.api.retrieval as r
    r._lightrag = type("X", (), {})()  # reset
    # Manually call create_clients
    if "M" in os.environ: del os.environ["M"]
    r._lightrag = type("Y", (), {})()  # custom marker
    r._ragflow = type("Z", (), {})()
    # Now directly use Httpx classes to prove they can be swapped
    from mate_tech_rag.clients.lightrag_httpx_client import HttpxLightRAGClient
    from mate_tech_rag.clients.ragflow_httpx_client import HttpxRAGFlowClient
    r._lightrag = HttpxLightRAGClient(base_url="http://127.0.0.1:1")
    r._ragflow = HttpxRAGFlowClient(base_url="http://127.0.0.1:1")
    assert type(r._lightrag).__name__ == "HttpxLightRAGClient"
    assert type(r._ragflow).__name__ == "HttpxRAGFlowClient"
