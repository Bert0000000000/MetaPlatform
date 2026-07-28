"""mate-tech-rag 3-strategy router tests (v0.2: GraphRAG/FlowRAG aligned)."""
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
from mate_tech_rag.api.retrieval import set_dependencies
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
    body = r.json()
    assert body["total_chunks"] == 0
    assert body["embedder_dim"] == 16


def test_ingest_fanout_to_three_clients(client: TestClient) -> None:
    """Ingest writes to Hybrid + Graph + LightRAG simultaneously."""
    r = client.post(
        "/api/v1/rag/ingest",
        json={
            "document_id": "doc-1",
            "chunks": [
                "Python backend uses FastAPI for RAG service",
                "MatePlatform uses LangChain to call LLMs",
            ],
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
    """FACTUAL mode goes through hybrid (vector + BM25)."""
    client.post(
        "/api/v1/rag/ingest",
        json={
            "document_id": "doc-f",
            "chunks": [
                "Python FastAPI is an async web framework",
                "Java Spring is a sync blocking framework",
            ],
        },
    )
    r = client.post(
        "/api/v1/rag/search",
        json={"query": "Python FastAPI", "top_k": 2, "mode": "FACTUAL"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "FACTUAL"
    assert body["total"] == 2
    top = body["hits"][0]
    assert "Python" in top["text"] and "FastAPI" in top["text"]


def test_entity_mode_returns_graph_results(client: TestClient) -> None:
    """ENTITY mode matches by extracted entities (PascalCase / Chinese)."""
    client.post(
        "/api/v1/rag/ingest",
        json={
            "document_id": "doc-e",
            "chunks": [
                "MatePlatform uses FastAPI framework",
                "Flowable provides BPMN engine",
            ],
        },
    )
    r = client.post(
        "/api/v1/rag/search",
        json={"query": "FastAPI author", "top_k": 5, "mode": "ENTITY"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "ENTITY"
    assert body["total"] >= 1
    assert all("entity" in h["metadata"] for h in body["hits"])


def test_thematic_mode_returns_lightrag_results(client: TestClient) -> None:
    """THEMATIC mode goes through LightRAG thematic similarity."""
    client.post(
        "/api/v1/rag/ingest",
        json={
            "document_id": "doc-t",
            "chunks": [
                "MatePlatform is a meta platform foundation",
                "MatePlatform supports multi-tenant",
            ],
        },
    )
    r = client.post(
        "/api/v1/rag/search",
        json={"query": "MatePlatform multi-tenant", "top_k": 5, "mode": "THEMATIC"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "THEMATIC"
    assert body["total"] >= 1
    assert all(h["metadata"].get("mode") == "THEMATIC" for h in body["hits"])


def test_auto_mode_routes_by_pascalcase(client: TestClient) -> None:
    """AUTO mode: PascalCase -> ENTITY, else FACTUAL/THEMATIC."""
    r1 = client.post(
        "/api/v1/rag/search",
        json={"query": "FastAPI", "top_k": 3, "mode": "AUTO"},
    )
    assert r1.json()["mode"] == "ENTITY"

    r2 = client.post(
        "/api/v1/rag/search",
        json={"query": "python backend", "top_k": 3, "mode": "AUTO"},
    )
    assert r2.json()["mode"] in ("FACTUAL", "THEMATIC")


def test_search_validation_error(client: TestClient) -> None:
    r = client.post(
        "/api/v1/rag/search",
        json={"query": "", "top_k": 5, "mode": "FACTUAL"},
    )
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

def test_ragflow_parse_paragraphs(client: TestClient) -> None:
    """RAGFlow parses paragraphs into chunks, fans out to 3 indices."""
    r = client.post(
        "/api/v1/rag/parse",
        json={
            "document_id": "doc-parse",
            "content": (
                "First paragraph about Python backend with FastAPI.\n\n"
                "Second paragraph about MatePlatform RAG service.\n\n"
                "Third paragraph about LightRAG thematic retrieval."
            ),
            "metadata": {"source": "ragflow-test"},
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["document_id"] == "doc-parse"
    assert body["chunk_count"] == 3
    assert body["ragflow_parsed"] == 3
    assert sorted(body["indexed_in"]) == ["graph", "hybrid", "lightrag"]

    # 检索应能找到（任意模式）
    r2 = client.post(
        "/api/v1/rag/search",
        json={"query": "FastAPI", "top_k": 3, "mode": "FACTUAL"},
    )
    assert r2.status_code == 200
    assert r2.json()["total"] >= 1


def test_ragflow_parse_long_content_chunks(client: TestClient) -> None:
    """Long content gets split into multiple chunks via RAGFlow."""
    long_text = ". ".join([f"Sentence number {i} about something." for i in range(50)])
    r = client.post(
        "/api/v1/rag/parse",
        json={"document_id": "doc-long", "content": long_text},
    )
    assert r.status_code == 200
    body = r.json()
    # 50 sentences each ~30 chars, chunk_size=256 -> expect multiple chunks
    assert body["chunk_count"] > 1
    assert body["ragflow_parsed"] == body["chunk_count"]


def test_ragflow_parse_validation_empty_content(client: TestClient) -> None:
    r = client.post(
        "/api/v1/rag/parse",
        json={"document_id": "d", "content": ""},
    )
    assert r.status_code == 422

def test_upload_text_file_fanout(client: TestClient) -> None:
    """Upload a .txt file -> RAGFlow parses -> 3-index fan-out."""
    text_content = (
        b"First section about Python FastAPI backend architecture.\n\n"
        b"Second section about MatePlatform GraphRAG knowledge graph.\n\n"
        b"Third section about LightRAG thematic retrieval engine."
    )
    r = client.post(
        "/api/v1/rag/upload",
        files={"file": ("doc.txt", text_content, "text/plain")},
        params={"document_id": "upload-test-1"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["document_id"] == "upload-test-1"
    assert body["filename"] == "doc.txt"
    assert body["size_bytes"] == len(text_content)
    assert body["chunk_count"] == 3
    assert sorted(body["indexed_in"]) == ["graph", "hybrid", "lightrag"]

    # 检索可发现
    r2 = client.post(
        "/api/v1/rag/search",
        json={"query": "FastAPI architecture", "top_k": 3, "mode": "FACTUAL"},
    )
    assert r2.json()["total"] >= 1


def test_upload_markdown_file(client: TestClient) -> None:
    """Upload .md file -> RAGFlow parses -> 3-index fan-out."""
    md_content = b"# Heading\n\n## Section A\n\nText about MatePlatform.\n\n## Section B\n\nMore about LightRAG."
    r = client.post(
        "/api/v1/rag/upload",
        files={"file": ("readme.md", md_content, "text/markdown")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["filename"] == "readme.md"
    assert body["chunk_count"] >= 2
    assert body["document_id"]  # auto-generated uuid


def test_upload_empty_file_400(client: TestClient) -> None:
    """Empty file -> 400."""
    r = client.post(
        "/api/v1/rag/upload",
        files={"file": ("empty.txt", b"", "text/plain")},
    )
    assert r.status_code == 400

def test_embedder_factory_default() -> None:
    """Default embedder is local tiny (no API key required)."""
    from mate_tech_rag.embedder import LocalTinyEmbedder, create_embedder

    e = create_embedder("local")
    assert isinstance(e, LocalTinyEmbedder)
    assert e.dim == 384


def test_embedder_factory_hash_legacy() -> None:
    """Hash provider returns 16-dim legacy."""
    from mate_tech_rag.embedder import HashEmbedder, create_embedder

    e = create_embedder("hash")
    assert isinstance(e, HashEmbedder)
    assert e.dim == 16


def test_embedder_factory_unknown_raises() -> None:
    from mate_tech_rag.embedder import create_embedder

    with pytest.raises(ValueError, match="Unknown embedder provider"):
        create_embedder("not-a-provider")


def test_local_tiny_embedder_normalized() -> None:
    """LocalTinyEmbedder output is L2-normalized and non-zero for non-empty input."""
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
    assert len(v) == 384
    assert all(x == 0.0 for x in v)


def test_local_tiny_embedder_similar_texts_close() -> None:
    """Similar texts should produce vectors with high cosine similarity."""
    from mate_tech_rag.embedder import LocalTinyEmbedder

    e = LocalTinyEmbedder()
    v1 = e.embed("Python FastAPI web framework backend")
    v2 = e.embed("FastAPI Python backend web framework")
    v3 = e.embed("Completely unrelated topic about cooking recipes")

    def cosine(a, b):
        dot = sum(x * y for x, y in zip(a, b))
        na = sum(x * x for x in a) ** 0.5
        nb = sum(x * x for x in b) ** 0.5
        return dot / (na * nb) if na and nb else 0.0

    sim_12 = cosine(v1, v2)
    sim_13 = cosine(v1, v3)
    assert sim_12 > sim_13, f"similar texts {sim_12} should beat unrelated {sim_13}"


def test_openai_embedder_requires_api_key() -> None:
    from mate_tech_rag.embedder import OpenAIEmbedder

    with pytest.raises(ValueError, match="OPENAI_API_KEY"):
        OpenAIEmbedder(api_key="")


def test_openai_embedder_calls_api(respx_mock) -> None:
    """OpenAIEmbedder makes real HTTP POST to /v1/embeddings (mocked via respx)."""
    import respx
    from mate_tech_rag.embedder import OpenAIEmbedder

    fake_vector = [0.1] * 1536
    respx_mock.post("https://api.openai.com/v1/embeddings").mock(
        return_value=respx.MockResponse(
            200,
            json={"data": [{"embedding": fake_vector, "index": 0, "object": "embedding"}]},
        )
    )

    e = OpenAIEmbedder(api_key="sk-test", base_url="https://api.openai.com")
    v = e.embed("hello world")
    assert v == fake_vector
    e.close()


def test_status_endpoint(client: TestClient) -> None:
    """/status reports embedder + 3 indexes."""
    r = client.get("/api/v1/rag/status")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "mate-tech-rag"
    assert body["embedder"]["provider"] in ("local", "hash", "openai")
    assert body["embedder"]["dim"] > 0
    assert len(body["indexes"]) == 3
    assert {i["name"] for i in body["indexes"]} == {"hybrid", "graph", "lightrag"}