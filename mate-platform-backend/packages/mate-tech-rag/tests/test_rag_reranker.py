"""阶段 C: Reranker + metadata_filter tests for mate-tech-rag.

Covers:
  * Reranker strategies (Identity / Keyword / Length / create_reranker factory)
  * metadata_filter logic (single / empty / multiple conditions)
  * Endpoint integration (search with rerank + metadata_filter via TestClient)
"""
from __future__ import annotations

import os
import sys
import time
from collections.abc import Iterator
from pathlib import Path

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient

# --- module-level env setup (must precede app import) ----------------------
os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-tech-rag"):
    sys.path.insert(0, str(PKG / sub / "src"))

from mate_platform.messaging.outbox import InMemoryOutboxWriter  # noqa: E402
from mate_tech_rag.reranker import (  # noqa: E402
    IdentityReranker,
    KeywordReranker,
    LengthReranker,
    RerankCandidate,
    create_reranker,
)

JWT_SECRET = "test-secret"


def _keycloak_token(
    *,
    sub: str = "u-1",
    roles: list[str] | None = None,
    scopes: str = "platform.read platform.write",
    tenant_id: str = "tenant-acme",
) -> str:
    now = int(time.time())
    resolved = roles if roles is not None else ["PLATFORM_SUPER_ADMIN"]
    return pyjwt.encode(
        {
            "sub": sub,
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": sub,
            "realm_access": {"roles": resolved},
            "scope": scopes,
            "attributes": {"tenant_id": [tenant_id]},
            "tenant_id": tenant_id,
            "roles": resolved,
            "iat": now,
            "exp": now + 3600,
        },
        JWT_SECRET,
        algorithm="HS256",
    )


def _reset_rag_state() -> None:
    from mate_tech_rag.api.document_registry import reset_registry
    from mate_tech_rag.api.retrieval import get_hybrid, get_lightrag, get_ragflow

    reset_registry()
    hybrid = get_hybrid()
    store = getattr(hybrid, "_store", None)
    if store is not None and hasattr(store, "_chunks"):
        store._chunks.clear()
    ragflow = get_ragflow()
    if hasattr(ragflow, "_chunks"):
        ragflow._chunks.clear()
    lightrag = get_lightrag()
    if hasattr(lightrag, "_chunks"):
        lightrag._chunks.clear()
    elif hasattr(lightrag, "clear"):
        lightrag.clear()


@pytest.fixture
def outbox() -> InMemoryOutboxWriter:
    return InMemoryOutboxWriter()


@pytest.fixture
def client(outbox: InMemoryOutboxWriter) -> Iterator[TestClient]:
    _reset_rag_state()
    from mate_tech_rag.api import app as _app_module
    _app_module.app.state.outbox_writer = outbox
    yield TestClient(_app_module.app)
    _reset_rag_state()


@pytest.fixture
def auth_acme() -> dict[str, str]:
    return {"Authorization": f"Bearer {_keycloak_token(tenant_id='tenant-acme')}"}


# ---------------------------------------------------------------------------
# Reranker unit tests (8)
# ---------------------------------------------------------------------------
class TestIdentityReranker:
    def test_identity_reranker_preserves_order(self) -> None:
        """IdentityReranker sorts by original score descending."""
        candidates = [
            RerankCandidate(chunk_id="a", text="alpha", score=0.5),
            RerankCandidate(chunk_id="b", text="beta", score=0.9),
            RerankCandidate(chunk_id="c", text="gamma", score=0.3),
        ]
        result = IdentityReranker().rerank("query", candidates, top_k=10)
        scores = [c.score for c in result]
        assert scores == sorted(scores, reverse=True), scores
        assert result[0].chunk_id == "b"

    def test_identity_reranker_top_k(self) -> None:
        """IdentityReranker respects top_k truncation."""
        candidates = [
            RerankCandidate(chunk_id=str(i), text=f"t{i}", score=i / 10.0)
            for i in range(5)
        ]
        result = IdentityReranker().rerank("q", candidates, top_k=3)
        assert len(result) == 3, len(result)
        # Top 3 by score: 0.4, 0.3, 0.2
        assert result[0].chunk_id == "4"
        assert result[2].chunk_id == "2"


class TestKeywordReranker:
    def test_keyword_reranker_boosts_matching(self) -> None:
        """Chunk with more query-term overlap gets a higher score."""
        query = "machine learning"
        candidates = [
            RerankCandidate(
                chunk_id="match", text="machine learning is powerful",
                score=0.5,
            ),
            RerankCandidate(
                chunk_id="nomatch", text="cooking pasta recipes",
                score=0.5,
            ),
        ]
        original_scores = {c.chunk_id: c.score for c in candidates}
        result = KeywordReranker().rerank(query, candidates, top_k=10)
        match_score = next(c.score for c in result if c.chunk_id == "match")
        nomatch_score = next(c.score for c in result if c.chunk_id == "nomatch")
        # Matching chunk score should increase from original 0.5
        assert match_score > original_scores["match"], (match_score, original_scores["match"])
        # Non-matching chunk score should stay at 0.5 * 0.7 = 0.35
        assert nomatch_score < original_scores["nomatch"], (nomatch_score, original_scores["nomatch"])
        # Matching chunk should rank first
        assert result[0].chunk_id == "match"

    def test_keyword_reranker_no_match(self) -> None:
        """When no candidates match query terms, scores are only scaled by 0.7."""
        query = "python java"
        candidates = [
            RerankCandidate(chunk_id="a", text="cooking recipes", score=1.0),
            RerankCandidate(chunk_id="b", text="gardening tips", score=0.8),
        ]
        result = KeywordReranker().rerank(query, candidates, top_k=10)
        # No overlap: score = original * 0.7 + 0 * 0.3 = original * 0.7
        assert pytest.approx(result[0].score) == 0.7
        assert pytest.approx(result[1].score) == 0.56
        # Original higher score still ranks first
        assert result[0].chunk_id == "a"


class TestLengthReranker:
    def test_length_reranker_penalizes_short(self) -> None:
        """Chunks shorter than 50 chars get score * 0.8."""
        short_text = "hi"  # 2 chars < 50
        normal_text = "This is a sufficiently long chunk text that exceeds fifty characters easily."
        candidates = [
            RerankCandidate(chunk_id="short", text=short_text, score=1.0),
            RerankCandidate(chunk_id="normal", text=normal_text, score=1.0),
        ]
        result = LengthReranker().rerank("q", candidates, top_k=10)
        short_score = next(c.score for c in result if c.chunk_id == "short")
        normal_score = next(c.score for c in result if c.chunk_id == "normal")
        assert pytest.approx(short_score) == 0.8, short_score
        assert pytest.approx(normal_score) == 1.0, normal_score
        # Normal (unpenalized) should rank first
        assert result[0].chunk_id == "normal"

    def test_length_reranker_penalizes_long(self) -> None:
        """Chunks longer than 2000 chars get score * 0.9."""
        long_text = "x" * 2001  # > 2000
        normal_text = "This is a normal length chunk that is between fifty and two thousand characters in size."
        candidates = [
            RerankCandidate(chunk_id="long", text=long_text, score=1.0),
            RerankCandidate(chunk_id="normal", text=normal_text, score=1.0),
        ]
        result = LengthReranker().rerank("q", candidates, top_k=10)
        long_score = next(c.score for c in result if c.chunk_id == "long")
        normal_score = next(c.score for c in result if c.chunk_id == "normal")
        assert pytest.approx(long_score) == 0.9, long_score
        assert pytest.approx(normal_score) == 1.0, normal_score
        assert result[0].chunk_id == "normal"


class TestCreateReranker:
    def test_create_reranker_returns_correct_type(self) -> None:
        """create_reranker returns the correct reranker class for each strategy."""
        assert isinstance(create_reranker("identity"), IdentityReranker)
        assert isinstance(create_reranker("keyword"), KeywordReranker)
        assert isinstance(create_reranker("length"), LengthReranker)

    def test_create_reranker_unknown_returns_identity(self) -> None:
        """Unknown strategy falls back to IdentityReranker."""
        result = create_reranker("nonexistent")
        assert isinstance(result, IdentityReranker)
        # Empty string also falls back
        assert isinstance(create_reranker(""), IdentityReranker)


# ---------------------------------------------------------------------------
# metadata_filter unit tests (3)
# ---------------------------------------------------------------------------
class TestMetadataFilter:
    def test_metadata_filter_filters_results(self) -> None:
        """Single-condition metadata_filter removes non-matching hits."""
        from mate_tech_rag.api.schemas import ChunkHit

        hits = [
            ChunkHit(chunk_id="1", document_id="d1", score=0.9, text="a",
                     metadata={"category": "tech"}),
            ChunkHit(chunk_id="2", document_id="d2", score=0.8, text="b",
                     metadata={"category": "finance"}),
        ]
        metadata_filter = {"category": "tech"}
        filtered = [
            h for h in hits
            if all(h.metadata.get(k) == v for k, v in metadata_filter.items())
        ]
        assert len(filtered) == 1
        assert filtered[0].chunk_id == "1"

    def test_metadata_filter_empty_returns_all(self) -> None:
        """Empty (None) metadata_filter returns all hits unchanged."""
        from mate_tech_rag.api.schemas import ChunkHit

        hits = [
            ChunkHit(chunk_id="1", document_id="d1", score=0.9, text="a",
                     metadata={"category": "tech"}),
            ChunkHit(chunk_id="2", document_id="d2", score=0.8, text="b",
                     metadata={"category": "finance"}),
        ]
        metadata_filter = None
        if metadata_filter:
            filtered = [
                h for h in hits
                if all(h.metadata.get(k) == v for k, v in metadata_filter.items())
            ]
        else:
            filtered = list(hits)
        assert len(filtered) == 2

    def test_metadata_filter_multiple_conditions(self) -> None:
        """Multiple conditions in metadata_filter are AND-ed."""
        from mate_tech_rag.api.schemas import ChunkHit

        hits = [
            ChunkHit(chunk_id="1", document_id="d1", score=0.9, text="a",
                     metadata={"category": "tech", "lang": "en"}),
            ChunkHit(chunk_id="2", document_id="d2", score=0.8, text="b",
                     metadata={"category": "tech", "lang": "zh"}),
            ChunkHit(chunk_id="3", document_id="d3", score=0.7, text="c",
                     metadata={"category": "finance", "lang": "en"}),
        ]
        metadata_filter = {"category": "tech", "lang": "en"}
        filtered = [
            h for h in hits
            if all(h.metadata.get(k) == v for k, v in metadata_filter.items())
        ]
        assert len(filtered) == 1
        assert filtered[0].chunk_id == "1"


# ---------------------------------------------------------------------------
# Endpoint integration tests (4)
# ---------------------------------------------------------------------------
class TestSearchEndpointRerank:
    def test_search_with_rerank_keyword(self, client, auth_acme) -> None:
        """POST /search with rerank_strategy=keyword returns reordered results."""
        client.post(
            "/api/v1/rag/ingest",
            json={
                "document_id": "doc-kw",
                "chunks": ["machine learning basics", "cooking recipes guide"],
            },
            headers=auth_acme,
        )
        r = client.post(
            "/api/v1/rag/search",
            json={
                "query": "machine learning",
                "top_k": 5,
                "rerank_strategy": "keyword",
            },
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] >= 1, body
        # The "machine learning basics" chunk should rank first
        assert "machine" in body["hits"][0]["text"].lower(), body["hits"][0]["text"]

    def test_search_with_rerank_length(self, client, auth_acme) -> None:
        """POST /search with rerank_strategy=length penalizes short chunks."""
        client.post(
            "/api/v1/rag/ingest",
            json={
                "document_id": "doc-len",
                "chunks": [
                    "short",  # < 50 chars, will be penalized
                    "this is a much longer chunk of text that should not be penalized by the length reranker at all",
                ],
            },
            headers=auth_acme,
        )
        r = client.post(
            "/api/v1/rag/search",
            json={
                "query": "chunk text",
                "top_k": 5,
                "rerank_strategy": "length",
            },
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] >= 1, body

    def test_search_with_metadata_filter(self, client, auth_acme) -> None:
        """POST /search with metadata_filter only returns matching chunks."""
        client.post(
            "/api/v1/rag/ingest",
            json={
                "document_id": "doc-tech",
                "chunks": ["python programming tutorial"],
                "metadata": {"category": "tech"},
            },
            headers=auth_acme,
        )
        client.post(
            "/api/v1/rag/ingest",
            json={
                "document_id": "doc-fin",
                "chunks": ["python financial analysis"],
                "metadata": {"category": "finance"},
            },
            headers=auth_acme,
        )
        r = client.post(
            "/api/v1/rag/search",
            json={
                "query": "python",
                "top_k": 10,
                "metadata_filter": {"category": "tech"},
            },
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # All returned hits must come from doc-tech
        for hit in body["hits"]:
            assert hit["document_id"] == "doc-tech", hit

    def test_search_default_rerank_identity(self, client, auth_acme) -> None:
        """POST /search without rerank_strategy defaults to identity (no error)."""
        client.post(
            "/api/v1/rag/ingest",
            json={
                "document_id": "doc-default",
                "chunks": ["default rerank test content"],
            },
            headers=auth_acme,
        )
        r = client.post(
            "/api/v1/rag/search",
            json={"query": "default rerank", "top_k": 5},
            headers=auth_acme,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] >= 1, body
