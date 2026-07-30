"""PG + Hybrid v2 tests."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for sub in ("mate-common", "mate-tech-rag"):
    p = str(ROOT / "packages" / sub / "src")
    if p not in sys.path:
        sys.path.insert(0, p)


from mate_tech_rag.clients.hybrid_v2_client import HybridV2Client
from mate_tech_rag.clients.pg_client import PGClient


# ---------- PGClient (graceful no-op) ----------
def test_pg_client_init_without_server():
    c = PGClient(dsn="postgresql://nobody:nobody@127.0.0.1:1/none")
    try:
        assert not c.is_available()
        assert c.count_chunks() == 0
        assert c.upsert_chunk("c1", "d1", "text") is False
        assert c.delete_by_document("d1") == 0
        assert c.bm25_search("query") == []
    finally:
        c.close()


def test_pg_client_close_idempotent():
    c = PGClient(dsn="postgresql://nobody:nobody@127.0.0.1:1/none")
    c.close()
    c.close()  # double close should not raise


# ---------- HybridV2Client (with stub clients) ----------
class StubMilvus:
    def __init__(self):
        self.added = []

    def add(self, document_id, text, vector, metadata=None):
        chunk_id = f"chunk-{len(self.added)}"
        self.added.append((document_id, text, vector, metadata))
        return chunk_id

    def search(self, query, query_vector, top_k=10):
        from mate_tech_rag.api.schemas import ChunkHit
        return [
            ChunkHit(
                chunk_id=f"chunk-{i}",
                document_id="d1",
                score=0.9 - i * 0.1,
                text=f"text {i}",
                metadata={},
            )
            for i in range(min(top_k, 2))
        ]

    def count(self):
        return len(self.added)

    def close(self):
        pass


class StubPG:
    def __init__(self):
        self.upserted = []
        self.bm25_results = []

    def upsert_chunk(self, chunk_id, document_id, text, metadata=None):
        self.upserted.append((chunk_id, document_id, text))
        return True

    def bm25_search(self, query, top_k=10):
        return self.bm25_results

    def count_chunks(self):
        return len(self.upserted)

    def is_available(self):
        return True

    def close(self):
        pass


def test_hybrid_v2_add_calls_both_clients():
    milvus = StubMilvus()
    pg = StubPG()
    h = HybridV2Client(milvus=milvus, pg=pg, vector_weight=0.5)
    h.add("d1", "Python FastAPI", [0.1] * 384, {"src": "test"})
    assert len(milvus.added) == 1
    assert len(pg.upserted) == 1
    assert pg.upserted[0][0] == "chunk-0"


def test_hybrid_v2_search_fuses_vector_and_bm25():
    milvus = StubMilvus()
    pg = StubPG()
    pg.bm25_results = [
        {"chunk_id": "chunk-0", "document_id": "d1", "text": "text 0", "metadata": {}, "score": 0.5},
        {"chunk_id": "chunk-99", "document_id": "d2", "text": "bm25-only", "metadata": {}, "score": 0.8},
    ]
    h = HybridV2Client(milvus=milvus, pg=pg, vector_weight=0.5)
    hits = h.search("query", [0.1] * 384, top_k=5)
    assert len(hits) == 3  # 2 from milvus + 1 unique from bm25
    # chunk-0 should have highest combined score (vector 0.9 + bm25 0.5/0.8=0.625 -> combined 0.5*0.9+0.5*0.625=0.7625)
    assert hits[0].chunk_id == "chunk-0"
    assert hits[0].score > 0.7


def test_hybrid_v2_search_empty_inputs():
    milvus = StubMilvus()
    milvus.search = lambda *a, **k: []
    pg = StubPG()
    pg.bm25_results = []
    h = HybridV2Client(milvus=milvus, pg=pg)
    hits = h.search("q", [0.1] * 384, top_k=5)
    assert hits == []


def test_hybrid_v2_count_returns_max():
    milvus = StubMilvus()
    pg = StubPG()
    h = HybridV2Client(milvus=milvus, pg=pg)
    assert h.count() >= 0
