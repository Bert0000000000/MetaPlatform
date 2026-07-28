"""mate-tech-rag full tests (v0.4): health + 3 strategies + RAGFlow parse + upload + embedder + status."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for sub in ("mate-common", "mate-tech-rag"):
    p = str(ROOT / "packages" / sub / "src")
    if p not in sys.path:
        sys.path.insert(0, p)

import pytest
from fastapi.testclient import TestClient

from mate_tech_rag import __version__
from mate_tech_rag.api.app import create_app
from mate_tech_rag.api.retrieval import fake_chunk, set_dependencies
from mate_tech_rag.clients.graphrag_client import InMemoryGraphRAGClient
from mate_tech_rag.clients.hybrid_client import InMemoryHybridClient
from mate_tech_rag.clients.lightrag_client import InMemoryLightRAGClient
from mate_tech_rag.embedder import HashEmbedder


@pytest.fixture
def fresh_clients():
    """Reset all 3 clients per test for isolation."""
    set_dependencies(
        embedder=HashEmbedder(),
        hybrid=InMemoryHybridClient(),
        graph=InMemoryGraphRAGClient(),
        lightrag=InMemoryLightRAGClient(),
    )


@pytest.fixture
def client(fresh_clients) -> TestClient:
    return TestClient(create_app())


def test_healthz(client: TestClient) -> None:
    r = client.get("/healthz")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "mate-tech-rag"
    assert body["version"] == __version__


def test_stats_empty(client: TestClient) -> None:
    r = client.get("/api/v1/rag/stats")
    assert r.status_code == 200
    assert r.json() == {"total_chunks": 0, "embedder_dim": 16}


def test_ingest_fanout_to_three_clients(client: TestClient) -> None:
    r = client.post(
        "/api/v1/rag/ingest",
        json={
            "document_id": "doc-1",
            "chunks": ["Python backend uses FastAPI for RAG service", "MatePlatform uses LangChain"],
            "metadata": {"source": "unit-test"},
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["chunk_count"] == 2
    from mate_tech_rag.api.retrieval import get_graph, get_hybrid, get_lightrag
    assert get_hybrid().count() == 2
    assert get_graph().count() > 0
    assert get_lightrag().count() == 2


def test_factual_mode_returns_hybrid_results(client: TestClient) -> None:
    client.post("/api/v1/rag/ingest", json={"document_id": "doc-f", "chunks": ["Python FastAPI is an async web framework", "Java Spring is a sync blocking framework"]})
    r = client.post("/api/v1/rag/search", json={"query": "Python FastAPI", "top_k": 2, "mode": "FACTUAL"})
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "FACTUAL"
    assert body["total"] == 2
    assert "Python" in body["hits"][0]["text"] and "FastAPI" in body["hits"][0]["text"]


def test_entity_mode_returns_graph_results(client: TestClient) -> None:
    client.post("/api/v1/rag/ingest", json={"document_id": "doc-e", "chunks": ["MatePlatform uses FastAPI framework", "Flowable provides BPMN engine"]})
    r = client.post("/api/v1/rag/search", json={"query": "FastAPI author", "top_k": 5, "mode": "ENTITY"})
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "ENTITY"
    assert body["total"] >= 1
    assert all("entity" in h["metadata"] for h in body["hits"])


def test_thematic_mode_returns_lightrag_results(client: TestClient) -> None:
    client.post("/api/v1/rag/ingest", json={"document_id": "doc-t", "chunks": ["MatePlatform is a meta platform foundation", "MatePlatform supports multi-tenant"]})
    r = client.post("/api/v1/rag/search", json={"query": "MatePlatform multi-tenant", "top_k": 5, "mode": "THEMATIC"})
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "THEMATIC"
    assert body["total"] >= 1
    assert all(h["metadata"].get("mode") == "THEMATIC" for h in body["hits"])


def test_auto_mode_routes_by_pascalcase(client: TestClient) -> None:
    r1 = client.post("/api/v1/rag/search", json={"query": "FastAPI", "top_k": 3, "mode": "AUTO"})
    assert r1.json()["mode"] == "ENTITY"
    r2 = client.post("/api/v1/rag/search", json={"query": "python backend", "top_k": 3, "mode": "AUTO"})
    assert r2.json()["mode"] in ("FACTUAL", "THEMATIC")


def test_search_validation_error(client: TestClient) -> None:
    r = client.post("/api/v1/rag/search", json={"query": "", "top_k": 5, "mode": "FACTUAL"})
    assert r.status_code == 422


def test_ingest_validation_no_chunks(client: TestClient) -> None:
    r = client.post("/api/v1/rag/ingest", json={"document_id": "d", "chunks": []})
    assert r.status_code == 422


def test_mate_common_error_typed() -> None:
    from mate_common import NotFoundError
    with pytest.raises(NotFoundError) as exc:
        raise NotFoundError("kb not found", details={"kb_id": "x"})
    assert exc.value.http_status == 404
    payload = exc.value.to_dict()
    assert payload["code"] == "E404_NOT_FOUND"
    assert payload["message"] == "kb not found"
    assert payload["details"] == {"kb_id": "x"}


def test_fake_chunk_factory() -> None:
    c = fake_chunk("hello")
    assert c.text == "hello"
    assert 0.0 <= c.score <= 1.0
    assert c.metadata == {"source": "test"}


def test_ragflow_parse_paragraphs(client: TestClient) -> None:
    r = client.post("/api/v1/rag/parse", json={"document_id": "doc-parse", "content": "Para 1 about Python FastAPI.\n\nPara 2 about MatePlatform.\n\nPara 3 about LightRAG.", "metadata": {"src": "rf"}})
    assert r.status_code == 200
    body = r.json()
    assert body["chunk_count"] == 1  # InMemoryRAGFlow puts short content in 1 chunk
    assert body["ragflow_parsed"] == 1
    assert sorted(body["indexed_in"]) == ["graph", "hybrid", "lightrag"]


def test_ragflow_parse_long_content_chunks(client: TestClient) -> None:
    long_text = ". ".join([f"Sentence number {i} about something." for i in range(50)])
    r = client.post("/api/v1/rag/parse", json={"document_id": "doc-long", "content": long_text})
    assert r.status_code == 200
    body = r.json()
    assert body["chunk_count"] >= 1  # short content stays as 1 chunk in InMemory fallback
    assert body["ragflow_parsed"] == body["chunk_count"]


def test_ragflow_parse_validation_empty_content(client: TestClient) -> None:
    r = client.post("/api/v1/rag/parse", json={"document_id": "d", "content": ""})
    assert r.status_code == 422


def test_upload_text_file_fanout(client: TestClient) -> None:
    text_content = b"First section about Python FastAPI.\n\nSecond section about MatePlatform.\n\nThird section about LightRAG."
    r = client.post("/api/v1/rag/upload", files={"file": ("doc.txt", text_content, "text/plain")}, params={"document_id": "upload-test-1"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["chunk_count"] >= 1
    assert sorted(body["indexed_in"]) == ["graph", "hybrid", "lightrag"]


def test_upload_markdown_file(client: TestClient) -> None:
    md_content = b"# Heading\n\n## Section A\n\nText about MatePlatform.\n\n## Section B\n\nMore about LightRAG."
    r = client.post("/api/v1/rag/upload", files={"file": ("readme.md", md_content, "text/markdown")})
    assert r.status_code == 200
    body = r.json()
    assert body["chunk_count"] >= 1
    assert body["document_id"]


def test_upload_empty_file_400(client: TestClient) -> None:
    r = client.post("/api/v1/rag/upload", files={"file": ("empty.txt", b"", "text/plain")})
    assert r.status_code == 400


def test_embedder_factory_default() -> None:
    from mate_tech_rag.embedder import LocalTinyEmbedder, create_embedder
    e = create_embedder("local")
    assert isinstance(e, LocalTinyEmbedder)
    assert e.dim == 384


def test_embedder_factory_hash_legacy() -> None:
    from mate_tech_rag.embedder import HashEmbedder, create_embedder
    e = create_embedder("hash")
    assert isinstance(e, HashEmbedder)
    assert e.dim == 16


def test_embedder_factory_unknown_raises() -> None:
    from mate_tech_rag.embedder import create_embedder
    with pytest.raises(ValueError, match="Unknown embedder provider"):
        create_embedder("not-a-provider")


def test_local_tiny_embedder_normalized() -> None:
    from mate_tech_rag.embedder import LocalTinyEmbedder
    e = LocalTinyEmbedder()
    v = e.embed("hello world this is a test")
    assert len(v) == 384
    norm = sum(x * x for x in v) ** 0.5
    assert abs(norm - 1.0) < 1e-6


def test_local_tiny_embedder_empty_returns_zeros() -> None:
    from mate_tech_rag.embedder import LocalTinyEmbedder
    e = LocalTinyEmbedder()
    v = e.embed("")
    assert all(x == 0.0 for x in v)


def test_local_tiny_embedder_similar_texts_close() -> None:
    from mate_tech_rag.embedder import LocalTinyEmbedder
    e = LocalTinyEmbedder()
    v1 = e.embed("Python FastAPI web framework backend")
    v2 = e.embed("FastAPI Python backend web framework")
    v3 = e.embed("Completely unrelated topic about cooking recipes")
    def cos(a, b):
        dot = sum(x * y for x, y in zip(a, b))
        na = sum(x * x for x in a) ** 0.5
        nb = sum(x * x for x in b) ** 0.5
        return dot / (na * nb) if na and nb else 0.0
    assert cos(v1, v2) > cos(v1, v3)


def test_openai_embedder_requires_api_key() -> None:
    from mate_tech_rag.embedder import OpenAIEmbedder
    with pytest.raises(ValueError, match="OPENAI_API_KEY"):
        OpenAIEmbedder(api_key="")


def test_openai_embedder_calls_api(respx_mock) -> None:
    import respx
    from mate_tech_rag.embedder import OpenAIEmbedder
    fake_vector = [0.1] * 1536
    respx_mock.post("https://api.openai.com/v1/embeddings").mock(return_value=respx.MockResponse(200, json={"data": [{"embedding": fake_vector, "index": 0, "object": "embedding"}]}))
    e = OpenAIEmbedder(api_key="sk-test", base_url="https://api.openai.com")
    v = e.embed("hello world")
    assert v == fake_vector
    e.close()


def test_status_endpoint(client: TestClient) -> None:
    r = client.get("/api/v1/rag/status")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "mate-tech-rag"
    assert body["embedder"]["provider"] in ("local", "hash", "openai")
    assert body["embedder"]["dim"] > 0
    assert len(body["indexes"]) == 3
    assert {i["name"] for i in body["indexes"]} == {"hybrid", "graph", "lightrag"}


def test_status_reports_dynamic_backend_labels(client: TestClient) -> None:
    r = client.get("/api/v1/rag/status")
    body = r.json()
    backends = {i["name"]: i["backend"] for i in body["indexes"]}
    assert backends["hybrid"] in ("memory", "milvus")
    assert backends["graph"] in ("memory", "neo4j")
    assert backends["lightrag"] in ("memory", "lightrag")
