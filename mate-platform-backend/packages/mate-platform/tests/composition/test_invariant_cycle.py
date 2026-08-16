"""Invariant I3 — cycle liveness (paper Theorem 66).

A dependency cycle never becomes ACTIVE (satisfaction is unreachable),
is detected and reported at use() time, and cannot deadlock the runtime.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parents[2] / "src"
sys.path.insert(0, str(SRC))

from mate_platform.composition import Component, CycleError, FiberState, create_context


def _cyclic(name: str, provide_key: str, inject_key: str):
    async def apply(fctx):
        fctx.set(provide_key, f"{name}-v")
    return Component(
        name=name, inject=frozenset({inject_key}), provide=frozenset({provide_key}),
        apply=apply,
    )


@pytest.mark.asyncio
async def test_use_raises_cycle_error_with_path() -> None:
    ctx = create_context("root")
    a = _cyclic("a", "ka", "kb")
    b = _cyclic("b", "kb", "ka")

    await ctx.use(a)
    with pytest.raises(CycleError) as exc_info:
        await ctx.use(b)
    cycle = exc_info.value.cycle
    assert set(cycle) == {"a", "b"}
    # b was rejected — the registered graph (a alone) holds no cycle.
    assert ctx.detect_cycles() == []


@pytest.mark.asyncio
async def test_cyclic_fiber_stays_pending_no_deadlock() -> None:
    ctx = create_context("root")
    a = _cyclic("a", "ka", "kb")

    fa = await ctx.use(a)
    # No provider for kb exists — a stays inactive; start() must return
    # promptly (bounded by wait_for) instead of hanging.
    await asyncio.wait_for(ctx.start(), timeout=2.0)
    assert fa.state is FiberState.PENDING
