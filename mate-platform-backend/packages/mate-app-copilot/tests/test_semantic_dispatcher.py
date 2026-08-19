"""Tests for mate_app_copilot.dispatcher (MP-SR-01 fallback chain).

Covers:
  - DEFAULT_CHAIN order
  - First hit wins (a2a priority over kernel_role / embedding / keyword)
  - Each step can be skipped when handler is None / target missing
  - Final fallback to keyword_substring when nothing matches
  - Handler exception → next step
  - source="none" when chain exhausted
  - Default handler factories (keyword / embedding / kernel_role)
  - DispatchResult.to_dict()
"""
from __future__ import annotations

import pytest

from mate_app_copilot.dispatcher import (
    DEFAULT_CHAIN,
    DispatchResult,
    FallbackStep,
    dispatch_by_routing,
    make_embedding_match_handler,
    make_kernel_role_handler,
    make_keyword_substring_handler,
)

# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------
ROLES = [
    {
        "role": "workflow",
        "name": "Workflow Employee",
        "rid": "wfe.acme.flow.approve.v1",
        "capabilities": [{"name": "delegate_run"}, {"name": "approve"}],
    },
    {
        "role": "knowledge",
        "name": "Knowledge Employee",
        "rid": "kb.acme.doc.manual.v1",
        "capabilities": [{"name": "kb_search"}, {"name": "rag_query"}],
    },
    {
        "role": "ontology",
        "name": "Ontology Employee",
        "rid": "ont.acme.cls.employee.v1",
        "capabilities": [{"name": "search_objects"}],
    },
]


def _async_handler(result: DispatchResult | None):
    """Build an async a2a handler that returns a fixed result."""

    async def _fn(target: str, message: str) -> DispatchResult | None:
        return result

    return _fn


def _sync_handler(result: DispatchResult | None):
    """Build a sync kernel_role / embedding / keyword handler that returns fixed."""

    def _fn(*args, **kwargs) -> DispatchResult | None:
        return result

    return _fn


# ---------------------------------------------------------------------------
# DEFAULT_CHAIN
# ---------------------------------------------------------------------------
def test_default_chain_order() -> None:
    kinds = [s.kind for s in DEFAULT_CHAIN]
    assert kinds == ["a2a", "kernel_role", "embedding_match", "keyword_substring"]


# ---------------------------------------------------------------------------
# a2a first
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_a2a_first_wins() -> None:
    a2a_result = DispatchResult(
        source="a2a", target_rid="workflow",
        reason="a2a dispatch accepted",
    )
    result = await dispatch_by_routing(
        user_message="帮我发起审批",
        available_roles=ROLES,
        a2a_handler=_async_handler(a2a_result),
        kernel_role_handler=_sync_handler(DispatchResult(
            source="kernel_role", target_rid="workflow",
            reason="should not be reached",
        )),
        embedding_handler=_sync_handler(DispatchResult(
            source="embedding_match", target_rid="knowledge",
            reason="should not be reached",
        )),
        keyword_substring_handler=_sync_handler(DispatchResult(
            source="keyword_substring", target_rid="ontology",
            reason="should not be reached",
        )),
        target_hint="agent-1",
    )
    assert result.source == "a2a"
    assert result.target_rid == "workflow"


@pytest.mark.asyncio
async def test_a2a_skipped_when_no_target_hint() -> None:
    """a2a step needs target_hint; if missing, falls through."""
    called = {"kw": False}
    kw_handler = _sync_handler(DispatchResult(
        source="keyword_substring", target_rid="workflow",
        reason="role slug workflow in message",
    ))

    def _kw_with_flag(*args, **kwargs):
        called["kw"] = True
        return DispatchResult(
            source="keyword_substring", target_rid="workflow",
            reason="role slug workflow in message",
        )

    result = await dispatch_by_routing(
        user_message="请调度 workflow 处理对账单",
        available_roles=ROLES,
        a2a_handler=_async_handler(DispatchResult(
            source="a2a", target_rid="workflow", reason="would have matched",
        )),
        keyword_substring_handler=_kw_with_flag,
        target_hint=None,  # explicit None
    )
    assert called["kw"] is True
    assert result.source == "keyword_substring"


# ---------------------------------------------------------------------------
# kernel_role second
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_kernel_role_when_a2a_skipped() -> None:
    """a2a step's target is missing → a2a skipped → kernel_role runs."""
    chain = (
        FallbackStep("a2a"),  # no target, no target_hint → skipped
        FallbackStep("kernel_role", target="wfe.acme.flow.approve.v1"),
    )
    result = await dispatch_by_routing(
        user_message="anything",
        available_roles=ROLES,
        fallback_chain=chain,
        a2a_handler=_async_handler(DispatchResult(
            source="a2a", target_rid="workflow", reason="would have matched",
        )),
        kernel_role_handler=lambda hint, msg: DispatchResult(
            source="kernel_role", target_rid="workflow",
            reason=f"AgentSelector classified {hint!r}",
        ),
        target_hint=None,
    )
    assert result.source == "kernel_role"


@pytest.mark.asyncio
async def test_kernel_role_superai_default_is_not_hit() -> None:
    """When AgentSelector returns SUPERAI (default), step is not considered hit."""

    result = await dispatch_by_routing(
        user_message="anything",
        available_roles=ROLES,
        a2a_handler=_async_handler(None),
        kernel_role_handler=_sync_handler(DispatchResult(
            source="kernel_role", target_rid=None,
            reason="AgentSelector classify as SUPERAI (default)",
        )),
        keyword_substring_handler=_sync_handler(DispatchResult(
            source="keyword_substring", target_rid="workflow",
            reason="workflow in message",
        )),
        target_hint="unknown-prefix.foo.bar",
    )
    assert result.source == "keyword_substring"


# ---------------------------------------------------------------------------
# embedding_match third
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_embedding_match_third() -> None:
    """a2a + kernel_role skipped → embedding_match runs."""
    result = await dispatch_by_routing(
        user_message="请帮我发起 approve 审批",
        available_roles=ROLES,
        a2a_handler=_async_handler(None),
        kernel_role_handler=_sync_handler(None),
        embedding_handler=_sync_handler(DispatchResult(
            source="embedding_match", target_rid="workflow",
            reason="top candidate by similarity (0.42)",
        )),
        target_hint=None,
    )
    assert result.source == "embedding_match"
    assert result.target_rid == "workflow"


# ---------------------------------------------------------------------------
# keyword_substring last
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_keyword_substring_last_resort() -> None:
    """Everything before fails → keyword_substring matches."""
    result = await dispatch_by_routing(
        user_message="请调度 workflow 员工",
        available_roles=ROLES,
        a2a_handler=_async_handler(None),
        kernel_role_handler=_sync_handler(None),
        embedding_handler=_sync_handler(None),
        keyword_substring_handler=_sync_handler(DispatchResult(
            source="keyword_substring", target_rid="workflow",
            reason="role slug workflow in message",
        )),
        target_hint=None,
    )
    assert result.source == "keyword_substring"
    assert result.target_rid == "workflow"


@pytest.mark.asyncio
async def test_no_match_returns_none_source() -> None:
    result = await dispatch_by_routing(
        user_message="hello world",
        available_roles=ROLES,
        a2a_handler=_async_handler(None),
        kernel_role_handler=_sync_handler(None),
        embedding_handler=_sync_handler(None),
        keyword_substring_handler=_sync_handler(None),
        target_hint=None,
    )
    assert result.source == "none"
    assert result.target_rid is None
    assert "no fallback step matched" in result.reason


@pytest.mark.asyncio
async def test_empty_roles_returns_none() -> None:
    result = await dispatch_by_routing(
        user_message="anything",
        available_roles=[],
        a2a_handler=_async_handler(DispatchResult(
            source="a2a", target_rid="x", reason="y",
        )),
    )
    assert result.source == "none"
    assert "no available roles" in result.reason


# ---------------------------------------------------------------------------
# Handler exception → next step
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_handler_exception_continues_chain() -> None:
    async def _boom(target: str, message: str):
        raise RuntimeError("a2a exploded")

    result = await dispatch_by_routing(
        user_message="hello workflow",
        available_roles=ROLES,
        a2a_handler=_boom,
        kernel_role_handler=lambda h, m: (_ for _ in ()).throw(RuntimeError("kernel boom")),
        embedding_handler=lambda msg, roles: (_ for _ in ()).throw(RuntimeError("emb boom")),
        keyword_substring_handler=_sync_handler(DispatchResult(
            source="keyword_substring", target_rid="workflow",
            reason="substring match",
        )),
        target_hint="anything",
    )
    assert result.source == "keyword_substring"


# ---------------------------------------------------------------------------
# Unknown kind is skipped
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_unknown_kind_skipped() -> None:
    chain = (
        FallbackStep("unknown_kind"),
        FallbackStep("keyword_substring"),
    )
    result = await dispatch_by_routing(
        user_message="hello workflow",
        available_roles=ROLES,
        fallback_chain=chain,
        keyword_substring_handler=_sync_handler(DispatchResult(
            source="keyword_substring", target_rid="workflow",
            reason="substring match",
        )),
    )
    assert result.source == "keyword_substring"


# ---------------------------------------------------------------------------
# Step.target overrides target_hint
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_step_target_overrides_target_hint() -> None:
    captured = {}

    async def _capture(target: str, message: str):
        captured["target"] = target
        return DispatchResult(source="a2a", target_rid=target, reason="captured")

    await dispatch_by_routing(
        user_message="anything",
        available_roles=ROLES,
        fallback_chain=[FallbackStep("a2a", target="step-target")],
        a2a_handler=_capture,
        target_hint="global-hint",
    )
    assert captured["target"] == "step-target"


# ---------------------------------------------------------------------------
# DispatchResult.to_dict
# ---------------------------------------------------------------------------
def test_dispatch_result_to_dict_no_candidates() -> None:
    r = DispatchResult(source="keyword_substring", target_rid="workflow",
                       reason="substring match")
    d = r.to_dict()
    assert d == {
        "source": "keyword_substring",
        "target_rid": "workflow",
        "reason": "substring match",
        "candidates": [],
    }


def test_dispatch_result_to_dict_with_candidates() -> None:
    from mate_app_copilot.semantic_router import CandidateRole

    c = CandidateRole(
        role_slug="workflow", role_rid="wfe.x.y.v1",
        display_name="Workflow", capability_tags=("approve",),
        similarity=0.42, reason="embedding cosine",
    )
    r = DispatchResult(
        source="embedding_match", target_rid="workflow",
        reason="top candidate", candidates=(c,),
    )
    d = r.to_dict()
    assert len(d["candidates"]) == 1
    assert d["candidates"][0]["role_slug"] == "workflow"


# ---------------------------------------------------------------------------
# Default handler factories
# ---------------------------------------------------------------------------
def test_make_keyword_substring_handler_basic() -> None:
    fn = make_keyword_substring_handler()
    res = fn("请帮我用 workflow 跑一下", ROLES)
    assert res is not None
    assert res.source == "keyword_substring"
    assert res.target_rid == "workflow"


def test_make_keyword_substring_handler_no_match() -> None:
    fn = make_keyword_substring_handler()
    assert fn("hello world", ROLES) is None


def test_make_embedding_match_handler_top_candidate() -> None:
    fn = make_embedding_match_handler(min_similarity=0.0)
    res = fn("请帮我发起 approve 审批", ROLES)
    assert res is not None
    assert res.source == "embedding_match"
    assert res.target_rid in {"workflow", "knowledge", "ontology"}
    assert res.candidates  # carries full top-k


def test_make_embedding_match_handler_below_threshold() -> None:
    """With high threshold + custom embedder producing zero vector → no hit."""
    from mate_app_copilot.semantic_router import SemanticRouter

    class _ZeroEmbedder:
        @property
        def dim(self) -> int:
            return 16

        def embed(self, text: str) -> list[float]:
            return [0.0] * 16

    router = SemanticRouter(embedder=_ZeroEmbedder())
    fn = make_embedding_match_handler(router=router, min_similarity=0.5)
    res = fn("anything", ROLES)
    assert res is not None
    assert res.source == "embedding_match"
    assert res.target_rid is None  # below threshold
    assert "below threshold" in res.reason


def test_make_embedding_match_handler_no_roles_returns_none() -> None:
    fn = make_embedding_match_handler(min_similarity=0.0)
    assert fn("anything", []) is None


def test_make_kernel_role_handler_specific_role() -> None:
    fn = make_kernel_role_handler()
    res = fn("wfe.acme.flow.approve.v1", "msg")
    assert res is not None
    assert res.source == "kernel_role"
    assert res.target_rid == "workflow"


def test_make_kernel_role_handler_superai_default() -> None:
    fn = make_kernel_role_handler()
    res = fn("unknown-prefix.foo.bar", "msg")
    assert res is not None
    assert res.source == "kernel_role"
    assert res.target_rid is None  # SUPERAI default → no hit
    assert "SUPERAI" in res.reason


# ---------------------------------------------------------------------------
# Custom fallback_chain overrides DEFAULT_CHAIN
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_custom_chain_order() -> None:
    """Provide chain in keyword-first order → keyword wins regardless of a2a handler."""
    result = await dispatch_by_routing(
        user_message="请帮我用 workflow 处理",
        available_roles=ROLES,
        fallback_chain=[FallbackStep("keyword_substring"), FallbackStep("a2a")],
        a2a_handler=_async_handler(DispatchResult(
            source="a2a", target_rid="workflow", reason="would have matched",
        )),
        keyword_substring_handler=_sync_handler(DispatchResult(
            source="keyword_substring", target_rid="workflow",
            reason="substring match",
        )),
        target_hint="agent-x",
    )
    assert result.source == "keyword_substring"


# ---------------------------------------------------------------------------
# EmbeddingMatchHandler shares candidates with result
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_embedding_match_result_carries_candidates() -> None:
    fn = make_embedding_match_handler(min_similarity=0.0)
    result = await dispatch_by_routing(
        user_message="approve workflow",
        available_roles=ROLES,
        embedding_handler=fn,
        target_hint=None,
    )
    assert result.source == "embedding_match"
    assert result.candidates  # carries full top-k for trace
    assert all(c.similarity >= 0 for c in result.candidates)