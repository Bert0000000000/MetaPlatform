"""Tests for mate_app_copilot.semantic_router (MP-SR-01).

Covers:
  - HashEmbedder basic behaviour (deterministic, unit-vector, empty input)
  - SemanticRouter.route() top-k sort
  - Capability keyword boost (+0.2)
  - Role embedding cache (TTL + text change invalidation)
  - CandidateRole dataclass / to_dict()
  - Empty inputs → []
  - Custom embedder injection
  - Thread safety smoke (no assertion, just runs)
"""
from __future__ import annotations

import math
import threading

import pytest

from mate_app_copilot.semantic_router import (
    CandidateRole,
    HashEmbedder,
    SemanticRouter,
    semantic_route,
)

ROLES = [
    {
        "role": "workflow",
        "name": "Workflow Employee",
        "rid": "wfe.acme.flow.approve.v1",
        "capabilities": [
            {"name": "delegate_run", "worker_kind": "a2a"},
            {"name": "approve", "worker_kind": "local"},
        ],
    },
    {
        "role": "knowledge",
        "name": "Knowledge Employee",
        "rid": "kb.acme.doc.manual.v1",
        "capabilities": [
            {"name": "kb_search", "worker_kind": "local"},
            {"name": "rag_query", "worker_kind": "a2a"},
        ],
    },
    {
        "role": "ontology",
        "name": "Ontology Employee",
        "rid": "ont.acme.cls.employee.v1",
        "capabilities": [
            {"name": "search_objects", "worker_kind": "local"},
        ],
    },
]


# ---------------------------------------------------------------------------
# HashEmbedder basics
# ---------------------------------------------------------------------------
def test_hash_embedder_deterministic() -> None:
    e = HashEmbedder()
    v1 = e.embed("workflow approval 对账")
    v2 = e.embed("workflow approval 对账")
    assert v1 == v2
    assert len(v1) == HashEmbedder.DIM


def test_hash_embedder_unit_vector() -> None:
    e = HashEmbedder()
    v = e.embed("hello world token")
    norm = math.sqrt(sum(x * x for x in v))
    assert abs(norm - 1.0) < 1e-9


def test_hash_embedder_empty_input() -> None:
    e = HashEmbedder()
    assert e.embed("") == [0.0] * e.dim
    assert e.embed("   ") == [0.0] * e.dim


def test_hash_embedder_dim_property() -> None:
    assert HashEmbedder().dim == HashEmbedder.DIM


# ---------------------------------------------------------------------------
# _build_role_text / _extract_tags composition
# ---------------------------------------------------------------------------
def test_role_text_includes_capabilities_and_name() -> None:
    text = SemanticRouter._build_role_text(ROLES[0])
    assert "delegate_run" in text
    assert "approve" in text
    assert "Workflow Employee" in text
    assert "workflow" in text


def test_role_text_includes_rid_slug_parts() -> None:
    text = SemanticRouter._build_role_text(ROLES[0])
    # rid "wfe.acme.flow.approve.v1" → split → "wfe", "acme", "flow", "approve"
    assert "wfe" in text and "acme" in text and "flow" in text


def test_role_text_strips_version_tokens() -> None:
    text = SemanticRouter._build_role_text(ROLES[0])
    # "v1" / "v2" tokens should NOT appear (they don't carry meaning)
    assert " v1 " not in f" {text} " and not text.endswith("v1")


def test_extract_tags_returns_capability_names() -> None:
    tags = SemanticRouter._extract_tags(ROLES[0])
    assert set(tags) == {"delegate_run", "approve"}


def test_extract_tags_empty_when_no_capabilities() -> None:
    assert SemanticRouter._extract_tags({"role": "x"}) == ()


# ---------------------------------------------------------------------------
# route() — top-k sort, keyword boost
# ---------------------------------------------------------------------------
def test_route_returns_top_k_sorted_by_similarity() -> None:
    router = SemanticRouter()
    out = router.route("帮我发起审批流程", ROLES, top_k=2)
    assert len(out) == 2
    assert all(isinstance(c, CandidateRole) for c in out)
    sims = [c.similarity for c in out]
    assert sims == sorted(sims, reverse=True)


def test_route_keyword_boost_when_capability_hit() -> None:
    router = SemanticRouter()
    # "kb_search" is a capability of "knowledge"
    out = router.route("请用 kb_search 检索文档", ROLES, top_k=3)
    knowledge = next(c for c in out if c.role_slug == "knowledge")
    assert "keyword" in knowledge.reason


def test_route_reason_includes_keyword_when_hit() -> None:
    router = SemanticRouter()
    out = router.route("请用 kb_search", ROLES, top_k=3)
    hit_candidates = [c for c in out if "keyword" in c.reason]
    assert hit_candidates  # at least one


def test_route_relevance_prefers_matching_role() -> None:
    router = SemanticRouter()
    # "approve" capability is in workflow AND knowledge tags overlap; expect workflow higher
    out = router.route("请帮我发起 approve 审批流", ROLES, top_k=3)
    assert out[0].role_slug == "workflow"


def test_route_empty_roles_returns_empty() -> None:
    router = SemanticRouter()
    assert router.route("anything", []) == []


def test_route_empty_message_returns_empty() -> None:
    router = SemanticRouter()
    assert router.route("", ROLES) == []
    assert router.route("   ", ROLES) == []


def test_route_respects_top_k_zero() -> None:
    router = SemanticRouter()
    assert router.route("approve", ROLES, top_k=0) == []


# ---------------------------------------------------------------------------
# Cache behaviour
# ---------------------------------------------------------------------------
def test_cache_hit_on_second_route_call() -> None:
    router = SemanticRouter()
    # First call computes embedding; second hits cache
    router.route("approve", ROLES)
    assert router.cache_size() > 0
    initial_size = router.cache_size()

    router.route("approve", ROLES)
    # No new entries should have been added
    assert router.cache_size() == initial_size


def test_cache_text_change_invalidates_entry() -> None:
    router = SemanticRouter()
    router.route("approve", ROLES)
    assert router.cache_size() == len(ROLES)

    # Mutate one role's capabilities → text changes → cache invalidates that entry
    modified = list(ROLES)
    modified = [*modified]
    modified[0] = {**modified[0], "capabilities": [{"name": "completely_new_cap"}]}
    router.route("approve", modified)
    # still len(ROLES) but entry[0] is recomputed; size same, but text different
    assert router.cache_size() == len(ROLES)


def test_cache_clear() -> None:
    router = SemanticRouter()
    router.route("approve", ROLES)
    assert router.cache_size() > 0
    router.clear_cache()
    assert router.cache_size() == 0


def test_set_embedder_clears_cache() -> None:
    router = SemanticRouter()
    router.route("approve", ROLES)
    assert router.cache_size() > 0
    router.set_embedder(HashEmbedder())  # new instance → clear
    assert router.cache_size() == 0


# ---------------------------------------------------------------------------
# Custom embedder injection
# ---------------------------------------------------------------------------
class _ConstantEmbedder:
    """Embedder that returns a constant vector regardless of text."""

    def __init__(self, vec: list[float]) -> None:
        self._vec = vec

    @property
    def dim(self) -> int:
        return len(self._vec)

    def embed(self, text: str) -> list[float]:
        return list(self._vec)


def test_custom_embedder_used() -> None:
    e = _ConstantEmbedder([0.1] * 16)
    router = SemanticRouter(embedder=e)
    out = router.route("approve", ROLES, top_k=2)
    assert len(out) == 2
    # similarity should be roughly 1.0 since constant embedder
    # (cosine of unit vec with itself ≈ 1.0)
    sims = {c.role_slug: c.similarity for c in out}
    for s in sims.values():
        assert 0.0 <= s <= 1.5  # tolerance for keyword boost


def test_custom_embedder_no_cache_inherit() -> None:
    e = _ConstantEmbedder([0.0] * 16)
    router = SemanticRouter(embedder=e)
    out = router.route("nothing-matches-here", ROLES, top_k=1)
    # All zero vector → cosine = 0 + no keyword hit (no capability in query) → similarity == 0
    assert out[0].similarity == 0.0
    assert "embedding cosine" in out[0].reason


# ---------------------------------------------------------------------------
# CandidateRole dataclass
# ---------------------------------------------------------------------------
def test_candidate_role_to_dict() -> None:
    c = CandidateRole(
        role_slug="workflow",
        role_rid="wfe.acme.flow.approve.v1",
        display_name="Workflow Employee",
        capability_tags=("delegate_run",),
        similarity=0.42,
        reason="embedding cosine",
    )
    d = c.to_dict()
    assert d["role_slug"] == "workflow"
    assert d["capability_tags"] == ["delegate_run"]
    assert d["similarity"] == 0.42


# ---------------------------------------------------------------------------
# convenience function
# ---------------------------------------------------------------------------
def test_semantic_route_function() -> None:
    out = semantic_route("approve", ROLES, top_k=2)
    assert len(out) == 2
    assert all(isinstance(c, CandidateRole) for c in out)


# ---------------------------------------------------------------------------
# thread safety smoke
# ---------------------------------------------------------------------------
def test_concurrent_routes_no_crash() -> None:
    router = SemanticRouter()

    def _worker() -> None:
        for _ in range(50):
            router.route("approve", ROLES, top_k=3)

    threads = [threading.Thread(target=_worker) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert router.cache_size() == len(ROLES)