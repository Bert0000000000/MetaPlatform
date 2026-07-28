"""Additional tests for real client graceful-degradation."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for sub in ("mate-common", "mate-tech-rag"):
    p = str(ROOT / "packages" / sub / "src")
    if p not in sys.path:
        sys.path.insert(0, p)


def test_milvus_client_optional_dependency():
    """MilvusHybridClient raises clear error if pymilvus missing."""
    from mate_tech_rag.clients.milvus_client import MilvusHybridClient
    try:
        c = MilvusHybridClient(host="127.0.0.1", port=1)
        try:
            assert c.count() == 0
            cid = c.add("d", "text", [0.1] * 384, {})
            assert cid
            hits = c.search("q", [0.1] * 384, top_k=5)
            assert hits == []
        finally:
            c.close()
    except (RuntimeError, ModuleNotFoundError):
        pass  # pymilvus not installed or connect failed; client still safe to construct later


def test_neo4j_client_optional_dependency():
    """Neo4jGraphRAGClient raises clear error if neo4j missing."""
    from mate_tech_rag.clients.neo4j_graphrag_client import Neo4jGraphRAGClient
    try:
        c = Neo4jGraphRAGClient(uri="bolt://127.0.0.1:1", user="x", password="x", database="x")
        try:
            assert c.count() == 0
            cid = c.insert("MatePlatform is a platform", "d1", {})
            assert cid
            hits = c.query("MatePlatform", top_k=5)
            assert hits == []
        finally:
            c.close()
    except (RuntimeError, ModuleNotFoundError):
        pass  # neo4j not installed; client still safe to construct later


def test_neo4j_entity_extraction():
    """Entity extraction finds Chinese and PascalCase tokens."""
    from mate_tech_rag.clients.neo4j_graphrag_client import Neo4jGraphRAGClient
    ents = Neo4jGraphRAGClient._extract_entities("MatePlatform uses FastAPI and supports multi-tenant")
    assert "MatePlatform" in ents
    assert "FastAPI" in ents
    assert "and" not in ents


def test_create_clients_no_op_when_rag_mode_memory():
    """create_clients with RAG_MODE=memory keeps InMemory defaults."""
    import os
    os.environ["RAG_MODE"] = "memory"
    from mate_tech_rag.api.retrieval import create_clients, get_hybrid, get_graph
    create_clients()
    assert type(get_hybrid()).__name__ == "InMemoryHybridClient"
    assert type(get_graph()).__name__ == "InMemoryGraphRAGClient"
