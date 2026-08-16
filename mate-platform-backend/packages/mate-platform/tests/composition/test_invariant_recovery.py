"""Invariant I1 — recovery (paper Theorem 7, up to observational equivalence).

After any load→unload sequence the coeffect store returns to the
observationally equivalent state: keys bound before are bound again with
≃-equivalent values; keys introduced only by the unloaded fiber are gone.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parents[2] / "src"
sys.path.insert(0, str(SRC))

from mate_platform.composition import Component, FiberState, create_context


def _snapshot(ctx) -> dict[str, tuple[str, object]]:
    """Public observation: value + owner identity per (realm, key)."""
    return dict(ctx.bindings())


@pytest.mark.asyncio
async def test_store_returns_to_equivalent_state_after_load_unload() -> None:
    ctx = create_context("root")
    baseline_unset = ctx.set("baseline", "kept")

    async def provider_apply(fctx):
        fctx.set("svc", "v1")

    provider = Component(
        name="provider", inject=frozenset(), provide=frozenset({"svc"}),
        apply=provider_apply,
    )

    async def dep_apply(fctx):
        yield lambda: None

    dep = Component(name="dep", inject=frozenset({"svc"}), provide=frozenset(), apply=dep_apply)

    pf = await ctx.use(provider)
    df = await ctx.use(dep)
    await ctx.start()
    assert df.state is FiberState.ACTIVE

    before = _snapshot(ctx)
    await pf.dispose()
    await ctx.start()
    after = _snapshot(ctx)

    assert after == {"main:baseline": ("root", "kept")}
    assert before["main:svc"] == (pf.id, "v1")
    assert baseline_unset is not None
    await baseline_unset()
    assert ctx.get("baseline") is None


@pytest.mark.asyncio
async def test_per_key_equivalence_custom_comparator() -> None:
    ctx = create_context("root")

    class Ref:
        def __init__(self, rid: str) -> None:
            self.rid = rid

    def same_ref(a: object, b: object) -> bool:
        return isinstance(a, Ref) and isinstance(b, Ref) and a.rid == b.rid

    unset = ctx.set("svc", Ref("tool-1"), equivalence=same_ref)
    ctx.set("svc", Ref("tool-1"))  # equivalent value — observation unchanged
    assert ctx.get("svc") is not None
    await unset()
    assert ctx.get("svc") is None

    # The equivalence feeds the kernel's neutral-change check: an equivalent
    # rebinding of the same owner is observationally the same state.
    first = ctx.set("svc", Ref("tool-1"), equivalence=same_ref)
    await first()
    second = ctx.set("svc", Ref("tool-1"), equivalence=same_ref)
    await second()
    assert ctx.get("svc") is None
