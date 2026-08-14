"""Tests for mate-app-kb _score_hits CJK tokenization (PATCH fix 4).

The previous ``_score_hits`` used ``str.split()`` for both query and
chunk text, which collapses the whole CJK run into a single token. The
keyword-overlap boost therefore never fired for Chinese queries (a
1-token query overlapping with a 1-token chunk never increases the
overlap count).

This test pins the new behaviour: a chunk whose text shares CJK bigrams
with the query should outrank an unrelated chunk that started from the
same vector score.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest

if TYPE_CHECKING:
    from fastapi.testclient import TestClient

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common", "mate-app-kb"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from mate_platform.messaging.outbox import InMemoryOutboxWriter  # noqa: E402


def _make_tenant_ctx(tenant: str = "tenant-acme"):
    from mate_platform.tenancy import AuthMethod, RequestContext, TenantId, UserId

    return RequestContext(
        request_id="r1", trace_id="trace-1", tenant_id=TenantId(tenant),
        user_id=UserId("u1"), roles=frozenset(), permissions=frozenset(),
        client_id="test", auth_method=AuthMethod.USER,
    )


def _build_client(tenant: str, fake_hits: list[dict]) -> "TestClient":
    """Build a TestClient whose /search returns the given raw hits."""
    from fastapi.testclient import TestClient

    from mate_app_kb.api.app import create_app
    from mate_app_kb.clients import AgentClient, RAGClient
    from mate_app_kb.repositories import in_memory as in_memory_repo

    in_memory_repo.reset_store()

    fake_rag = RAGClient()
    fake_rag.search = lambda query, top_k=5, mode="AUTO", rerank_strategy=None: {
        "query": query,
        "mode": mode,
        "total": len(fake_hits),
        "hits": fake_hits,
    }
    fake_rag.stats = lambda: {"total_chunks": 0, "embedder_dim": 0}
    fake_agent = AgentClient()
    fake_agent.chat = lambda message, scenario="S1", thread_id=None: {
        "thread_id": thread_id or "t-1", "scenario": scenario, "answer": "ok",
        "retrieved_chunks": [], "tool_calls": [],
    }

    with patch("mate_app_kb.api.app.install_auth"):
        app = create_app(rag=fake_rag, agent=fake_agent)
        app.state.outbox_writer = InMemoryOutboxWriter()

        async def fake_mw(request, call_next):
            request.state.ctx = _make_tenant_ctx(tenant)
            return await call_next(request)

        app.middleware("http")(fake_mw)
        return TestClient(app)


class TestKbScoreHitsCJK:
    def test_chinese_keyword_overlap_boosts_match(self):
        """A Chinese chunk sharing bigrams with the query scores higher.

        Under the old whitespace-split tokenizer the whole CJK run is one
        token and overlap is 0. With CJK-bigram tokenization the matching
        chunk shares several bigrams with the query and the boost fires.
        """
        fake_hits = [
            # Both chunks start from the same raw vector score.
            {
                "document_id": "doc-match",
                "score": 0.50,
                "content": "本系统的订单审批流程包含三个步骤",
            },
            {
                "document_id": "doc-other",
                "score": 0.50,
                "content": "今天天气真好适合户外运动",
            },
        ]
        client = _build_client("tenant-acme", fake_hits)
        r = client.post(
            "/api/v1/kb/search",
            json={"query": "订单审批流程", "top_k": 5, "mode": "AUTO"},
        )
        assert r.status_code == 200, r.text
        hits = r.json()["hits"]
        assert len(hits) == 2, hits
        # The matching chunk should outrank the unrelated one.
        assert hits[0]["document_id"] == "doc-match", hits
        # And its score should be strictly higher than the unrelated one.
        assert hits[0]["score"] > hits[1]["score"], hits

        from mate_app_kb.repositories import in_memory as in_memory_repo
        in_memory_repo.reset_store()

    def test_english_overlap_still_works(self):
        """Latin / English overlap continues to work after the CJK fix."""
        fake_hits = [
            {
                "document_id": "doc-match",
                "score": 0.40,
                "content": "machine learning algorithms for python",
            },
            {
                "document_id": "doc-other",
                "score": 0.40,
                "content": "cooking pasta recipes with garlic",
            },
        ]
        client = _build_client("tenant-acme", fake_hits)
        r = client.post(
            "/api/v1/kb/search",
            json={"query": "machine learning", "top_k": 5, "mode": "AUTO"},
        )
        assert r.status_code == 200, r.text
        hits = r.json()["hits"]
        assert len(hits) == 2, hits
        # The matching chunk should outrank the unrelated one.
        assert hits[0]["document_id"] == "doc-match", hits
        assert hits[0]["score"] > hits[1]["score"], hits

        from mate_app_kb.repositories import in_memory as in_memory_repo
        in_memory_repo.reset_store()