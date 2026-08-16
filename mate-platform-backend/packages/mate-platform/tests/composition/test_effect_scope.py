"""Composition kernel effect-scope tests (paper Algorithm 1).

Covers: sync/async disposer LIFO composition, guard interruption at
yield boundaries, and partial disposal when apply raises.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parents[2] / "src"
sys.path.insert(0, str(SRC))

from mate_platform.composition import Component, FiberState, create_context


@pytest.mark.asyncio
async def test_sync_disposers_lifo() -> None:
    ctx = create_context("root")
    events: list[str] = []

    def cb():
        events.append("e1")
        yield lambda: events.append("d1")
        events.append("e2")
        yield lambda: events.append("d2")
        events.append("e3")
        yield lambda: events.append("d3")

    await ctx.effect(cb)
    assert events == ["e1", "e2", "e3"]
    await ctx.dispose()
    assert events == ["e1", "e2", "e3", "d3", "d2", "d1"]


@pytest.mark.asyncio
async def test_async_disposers_run_sequentially_in_reverse() -> None:
    ctx = create_context("root")
    events: list[str] = []

    async def d(name: str) -> None:
        await __import__("asyncio").sleep(0)
        events.append(f"d{name}")

    async def cb():
        yield lambda: d("1")
        yield lambda: d("2")
        yield lambda: d("3")

    await ctx.effect(cb)
    await ctx.dispose()
    assert events == ["d3", "d2", "d1"]


@pytest.mark.asyncio
async def test_guard_stops_iteration_keeps_yielded_disposers() -> None:
    ctx = create_context("root")
    events: list[str] = []

    async def apply(fctx):
        events.append("apply:e1")
        yield lambda: events.append("apply:d1")
        # Long-running step: never yields again until interrupted.
        await __import__("asyncio").Event().wait()

    comp = Component(name="stuck", inject=frozenset(), provide=frozenset(), apply=apply)
    fiber = await ctx.use(comp)
    await __import__("asyncio").sleep(0)  # let the drive start
    await fiber.dispose()
    assert fiber.state is FiberState.DISPOSED
    assert events == ["apply:e1", "apply:d1"]


@pytest.mark.asyncio
async def test_apply_raise_runs_partial_disposers() -> None:
    ctx = create_context("root")
    events: list[str] = []

    async def apply(fctx):
        events.append("e1")
        yield lambda: events.append("d1")
        raise RuntimeError("boom")

    comp = Component(name="bad", inject=frozenset(), provide=frozenset(), apply=apply)
    fiber = await ctx.use(comp)
    await ctx.start()
    assert fiber.state is FiberState.FAILED
    assert isinstance(fiber.error, RuntimeError)
    assert events == ["e1", "d1"]
