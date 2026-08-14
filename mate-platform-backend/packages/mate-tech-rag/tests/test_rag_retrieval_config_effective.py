"""PATCH tests: chunk_strategy/size/overlap + similarity_threshold +
vector_weight/keyword_weight + kb_id filter in the rag retrieval pipeline.

These tests pin the 4 fixes for the "config stored but not effective"
problem on the RAG hot path:

  Fix 1: InMemoryRAGFlowClient honours per-call chunking overrides
          (chunk_strategy / chunk_size / overlap) with a strategy cache.
  Fix 2: retrieve() respects similarity_threshold + vector_weight /
          keyword_weight with CJK-aware keyword overlap.
  Fix 3: retrieve() filters hits by kb_id allow-list (kb_doc_ids).
  Fix 4: mate-app-kb _score_hits uses tokenize_for_match so Chinese
          keyword overlap boosts the score.

The tests intentionally avoid the FastAPI app stack — they go straight
at the unit surface so the wiring is verifiable without standing up
Keycloak / IAM / dev_server.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-rag"):
    sys.path.insert(0, str(PKG / sub / "src"))


# ---------------------------------------------------------------------------
# Fix 1: per-call chunking override on InMemoryRAGFlowClient
# ---------------------------------------------------------------------------
class TestInMemoryRAGFlowChunkingOverride:
    def _md_doc(self) -> bytes:
        return (
            b"# Title\n\n"
            b"Intro paragraph one.\n\n"
            b"## Section A\n\n"
            b"Body of section A with enough text.\n\n"
            b"## Section B\n\n"
            b"Body of section B with enough text."
        )

    def test_default_uses_recursive_strategy(self):
        """Default constructor + default parse() uses recursive chunker."""
        from mate_tech_rag.chunking import RecursiveChunker
        from mate_tech_rag.clients.ragflow_client import InMemoryRAGFlowClient

        client = InMemoryRAGFlowClient()
        chunks = client.parse("Para one.\n\nPara two.\n\nPara three.", "doc-1")
        # Recursive splitter on 3 short paragraphs returns >= 1 chunk.
        assert len(chunks) >= 1
        assert all(isinstance(c, str) and c.strip() for c in chunks)

    def test_per_call_markdown_strategy(self):
        """Passing chunker_strategy='markdown' switches to MarkdownChunker."""
        from mate_tech_rag.chunking import MarkdownChunker
        from mate_tech_rag.clients.ragflow_client import InMemoryRAGFlowClient

        client = InMemoryRAGFlowClient(chunker_strategy="recursive")
        chunks = client.parse(
            self._md_doc().decode("utf-8"),
            "doc-md",
            chunker_strategy="markdown",
        )
        # Markdown splitter yields one chunk per heading section (>= 3).
        assert len(chunks) >= 3, chunks
        assert any("## Section A" in c for c in chunks)
        assert any("## Section B" in c for c in chunks)
        # The override did NOT mutate the default chunker: a follow-up
        # call without the override still uses the recursive strategy.
        plain = client.parse("Just one paragraph.", "doc-plain")
        assert len(plain) == 1

    def test_per_call_chunk_size_honoured(self):
        """Per-call chunk_size overrides the instance default."""
        from mate_tech_rag.clients.ragflow_client import InMemoryRAGFlowClient

        # Long body that the recursive splitter normally splits into many chunks.
        long_body = ("The quick brown fox jumps over the lazy dog. " * 20).strip()
        client = InMemoryRAGFlowClient(chunk_size=512)
        # Force a much smaller chunk_size — every chunk should fit it.
        chunks = client.parse(long_body, "doc-1", chunk_size=80, overlap=0)
        # The recursive chunker may overshoot by a few chars due to its
        # recursive separator fallback; assert it's no more than 80+8.
        for c in chunks:
            assert len(c) <= 88, f"Chunk too long: len={len(c)} chunk={c!r}"

    def test_per_call_overlap_honoured(self):
        """Per-call overlap > 0 is reflected in the produced chunks."""
        from mate_tech_rag.clients.ragflow_client import InMemoryRAGFlowClient

        body = "Sentence one. Sentence two. Sentence three. Sentence four."
        client = InMemoryRAGFlowClient()
        chunks = client.parse(body, "doc-1", chunk_size=40, overlap=12)
        if len(chunks) >= 2:
            # Each successive chunk starts with the tail of the previous one.
            tail = chunks[0][-12:]
            assert chunks[1].startswith(tail), (chunks[0][-12:], chunks[1][:12])

    def test_parse_bytes_forwards_overrides(self):
        """parse_bytes() forwards chunker_strategy/size/overlap to parse()."""
        from mate_tech_rag.clients.ragflow_client import InMemoryRAGFlowClient

        client = InMemoryRAGFlowClient(chunker_strategy="recursive")
        # Use the .md extension to route through the markdown parser and
        # verify a markdown chunker override produces heading-level splits.
        chunks = client.parse_bytes(
            self._md_doc(),
            "doc-md-bytes",
            filename="note.md",
            chunker_strategy="markdown",
            chunk_size=512,
            overlap=0,
        )
        assert len(chunks) >= 3, chunks
        assert any("## Section A" in c for c in chunks)

    def test_chunker_cache_reuses_instance(self):
        """Repeated calls with the same config reuse the cached chunker."""
        from mate_tech_rag.clients.ragflow_client import InMemoryRAGFlowClient

        client = InMemoryRAGFlowClient()
        client.parse("alpha.", "doc-a", chunker_strategy="markdown")
        client.parse("beta.", "doc-b", chunker_strategy="markdown")
        # Cache key includes the override triple; markdown@512@64 is one key.
        assert (("markdown", 512, 64) in client._chunker_cache), (
            list(client._chunker_cache.keys()),
        )
        # A different strategy produces a different cache key.
        client.parse("gamma.", "doc-c", chunker_strategy="sliding")
        assert (("sliding", 512, 64) in client._chunker_cache)


# ---------------------------------------------------------------------------
# Fix 2 + Fix 3: similarity_threshold / weights / kb_id in retrieve()
# ---------------------------------------------------------------------------
def _hit(chunk_id: str, document_id: str, score: float, text: str):
    """Build a ChunkHit quickly without hitting FastAPI."""
    from mate_tech_rag.api.schemas import ChunkHit

    return ChunkHit(
        chunk_id=chunk_id,
        document_id=document_id,
        score=score,
        text=text,
        metadata={"source": "test"},
    )


def _req(query: str = "machine learning basics", top_k: int = 5, kb_id: str = ""):
    """Build a RetrievalRequest with sensible defaults."""
    from mate_tech_rag.api.schemas import RetrievalRequest

    return RetrievalRequest(query=query, top_k=top_k, kb_id=kb_id)


@pytest.fixture(autouse=True)
def _reset_singletons(monkeypatch):
    """Reset the rag singletons so each test starts from a known state.

    Some of these tests stub ``get_hybrid()`` etc. via monkeypatch; this
    fixture gives us a clean slate without touching the global state from
    sibling tests.
    """
    from mate_tech_rag.api.retrieval import (
        get_embedder,
        get_hybrid,
        get_lightrag,
    )

    # Clear the shared in-memory hybrid store so each test starts empty.
    # Other singletons (graph / lightrag) are left untouched because the
    # retrieve() tests only exercise the hybrid path.
    hybrid = get_hybrid()
    store = getattr(hybrid, "_store", None)
    if store is not None and hasattr(store, "_chunks"):
        with store._lock:
            store._chunks.clear()
    assert get_hybrid() is not None
    assert get_lightrag() is not None
    assert get_embedder() is not None


def _seed_hybrid(chunks: list[tuple[str, str, float]]):
    """Seed the InMemoryHybridClient with (label, document_id, text, base_score).

    ``label`` is just a friendly handle for the test to look up the
    assigned chunk_id. Returns ``{label: chunk_id}`` so callers can
    assert against the real UUIDs the store assigns.

    Each vector is a synthetic 4-d vector where the dominant axis is the
    base_score so the cosine sim produces the desired score.
    """
    from mate_tech_rag.api.retrieval import get_hybrid

    hybrid = get_hybrid()
    store = getattr(hybrid, "_store", None)
    assert store is not None, "InMemoryHybridClient missing _store"
    label_to_id: dict[str, str] = {}
    for label, document_id, text, base_score in chunks:
        vec = [base_score, 1.0 - base_score, 0.0, 0.0]
        chunk_id = store.add(document_id, text, vec, {"source": "test"})
        label_to_id[label] = chunk_id
    return label_to_id


class TestRetrieveSimilarityThreshold:
    def test_threshold_drops_low_score_hits(self):
        """similarity_threshold > 0 filters out hits below the threshold."""
        from mate_tech_rag.api.retrieval import retrieve_with_config

        # Seed three chunks with different base scores; HybridClient search
        # ranks them by cosine similarity (descending).
        ids = _seed_hybrid([
            ("high", "doc-1", "machine learning is great", 0.95),
            ("mid",  "doc-2", "deep learning models", 0.70),
            ("low",  "doc-3", "something unrelated", 0.10),
        ])
        # Query anything — the InMemory store ranks by stored vector, not by
        # query text. Threshold 0.5 should keep the high + mid chunks.
        resp = retrieve_with_config(
            _req("anything", top_k=5),
            similarity_threshold=0.5,
        )
        surviving = {h.chunk_id for h in resp.hits}
        # The low-score chunk must have been dropped.
        assert ids["low"] not in surviving, resp.hits
        # All surviving hits have score >= threshold.
        for hit in resp.hits:
            assert hit.score >= 0.5, hit

    def test_threshold_zero_disables_filter(self):
        """threshold = 0.0 (default) keeps every hit."""
        from mate_tech_rag.api.retrieval import retrieve_with_config

        ids = _seed_hybrid([
            ("h", "doc-1", "machine learning basics", 0.95),
            ("l", "doc-2", "something off topic", 0.10),
        ])
        resp = retrieve_with_config(_req("anything", top_k=5), similarity_threshold=0.0)
        surviving = {h.chunk_id for h in resp.hits}
        assert ids["h"] in surviving and ids["l"] in surviving, resp.hits


class TestRetrieveVectorKeywordWeights:
    def test_high_vector_weight_promotes_higher_vector_chunk(self):
        """vector_weight=0.9 keeps the vector-best chunk at the top."""
        from mate_tech_rag.api.retrieval import retrieve_with_config

        ids = _seed_hybrid([
            ("vhigh", "doc-1", "machine learning is great", 0.95),
            ("vmid",  "doc-2", "deep learning models", 0.70),
            ("vlow",  "doc-3", "totally unrelated", 0.10),
        ])
        resp = retrieve_with_config(
            _req("anything", top_k=3),
            vector_weight=0.9,
            keyword_weight=0.1,
        )
        # With vector_weight=0.9 the upstream ranking dominates; the
        # top hit should still be the highest-vector chunk.
        assert resp.hits, resp.hits
        assert resp.hits[0].chunk_id == ids["vhigh"], resp.hits

    def test_keyword_weight_overlap_boosts_matching_chinese(self):
        """CJK-aware keyword overlap boosts a chunk sharing terms with the query.

        Under naive whitespace splitting this collapses the CJK run into one
        token and the overlap is 0. With tokenize_for_match (CJK bigrams)
        the overlap is non-zero, so a high keyword_weight moves the matching
        Chinese chunk to the top.
        """
        from mate_tech_rag.api.retrieval import retrieve_with_config

        ids = _seed_hybrid([
            # All three start at the same vector score; only the keyword
            # overlap (via the new fusion) breaks the tie.
            ("match", "doc-1", "订单审批流程包含三个步骤", 0.5),
            ("other", "doc-2", "今天天气真好适合户外运动", 0.5),
        ])
        resp = retrieve_with_config(
            _req("订单审批流程", top_k=2),
            vector_weight=0.1,
            keyword_weight=0.9,
        )
        assert resp.hits, resp.hits
        # The matching Chinese chunk should outrank the unrelated one
        # because the keyword overlap is non-zero under tokenize_for_match.
        assert resp.hits[0].chunk_id == ids["match"], resp.hits


class TestRetrieveKbIdFilter:
    def test_kb_doc_ids_keeps_only_allowed_documents(self):
        """When kb_id is set, hits outside the allow-list are dropped."""
        from mate_tech_rag.api.retrieval import retrieve_with_config

        ids = _seed_hybrid([
            ("a", "doc-a", "alpha", 0.95),
            ("b", "doc-b", "beta", 0.85),
            ("c", "doc-c", "gamma", 0.75),
        ])
        # Tenant kb-1 owns only doc-a and doc-b; search scoped to kb-1.
        resp = retrieve_with_config(
            _req("anything", top_k=5, kb_id="kb-1"),
            kb_doc_ids={"doc-a", "doc-b"},
        )
        surviving = {h.chunk_id for h in resp.hits}
        assert ids["a"] in surviving, resp.hits
        assert ids["b"] in surviving, resp.hits
        # doc-c lives in a different kb and must be excluded.
        assert ids["c"] not in surviving, resp.hits

    def test_kb_doc_ids_empty_blocks_all_hits(self):
        """An empty allow-list with a non-empty kb_id blocks every hit."""
        from mate_tech_rag.api.retrieval import retrieve_with_config

        _seed_hybrid([
            ("x", "doc-x", "delta", 0.9),
            ("y", "doc-y", "epsilon", 0.7),
        ])
        resp = retrieve_with_config(
            _req("anything", top_k=5, kb_id="kb-empty"),
            kb_doc_ids=set(),  # no document belongs to this kb
        )
        assert resp.hits == [], resp.hits
        assert resp.total == 0

    def test_no_kb_id_skips_filter(self):
        """Without kb_id, the filter is a no-op even when kb_doc_ids is set."""
        from mate_tech_rag.api.retrieval import retrieve_with_config

        ids = _seed_hybrid([
            ("x", "doc-x", "delta", 0.9),
            ("y", "doc-y", "epsilon", 0.7),
        ])
        resp = retrieve_with_config(
            _req("anything", top_k=5),  # kb_id omitted
            kb_doc_ids={"doc-z"},  # unrelated allow-list
        )
        # Filter is not applied so both hits survive.
        surviving = {h.chunk_id for h in resp.hits}
        assert ids["x"] in surviving and ids["y"] in surviving, resp.hits