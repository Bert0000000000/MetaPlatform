"""Invariant I4 — inertia (paper Section 4.3.3).

A target flip during an in-flight transition chains the opposite
transition when the current one completes: no double-apply, no half
state. Provider identity changes (not value changes) trigger reloads.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parents[2] / "src"
sys.path.insert(0, str(SRC))

from mate_platform.composition import Component, FiberState, create_context


def _provider(name: str, key: str, value: str = "v"):
    async def apply(fctx):
        fctx.set(key, value)
    return Component(name=name, inject=frozenset(), provide=frozenset({key}), apply=apply)


@pytest.mark.asyncio
async def test_target_flip_mid_load_chains_unload() -> None:
    ctx = create_context("root")
    gate = asyncio.Event()
    loads: list[str] = []

    async def d_apply(fctx):
        loads.append("begin")
        await gate.wait()  # slow load: dep satisfied then lost mid-flight
        loads.append("committed")
        yield lambda: loads.append("d-unload")

    dep = Component(name="d", inject=frozenset({"svc"}), provide=frozenset(), apply=d_apply)

    p1 = _provider("p1", "svc")
    pf = await ctx.use(p1)
    df = await ctx.use(dep)

    task = asyncio.create_task(ctx.start())
    await asyncio.sleep(0)  # d enters LOADING, blocked on gate
    await pf.dispose()      # target flips to None mid-load
    await asyncio.sleep(0)
    gate.set()              # load completes → must chain unload
    await task

    assert df.state is FiberState.PENDING
    assert loads == ["begin", "committed", "d-unload"]


@pytest.mark.asyncio
async def test_target_flip_mid_unload_chains_reload() -> None:
    ctx = create_context("root")
    unload_gate = asyncio.Event()
    events: list[str] = []

    async def d_apply(fctx):
        events.append("load")

        async def d_unload():
            events.append("unload-begin")
            await unload_gate.wait()
            events.append("unload-end")
        yield d_unload

    dep = Component(name="d", inject=frozenset({"svc"}), provide=frozenset(), apply=d_apply)

    p1 = _provider("p1", "svc")
    p2 = _provider("p2", "svc")
    pf1 = await ctx.use(p1)
    df = await ctx.use(dep)
    await ctx.start()
    assert df.state is FiberState.ACTIVE

    # Provider identity change while d is mid-unload (blocked on the gate).
    task = asyncio.create_task(pf1.dispose())
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    pf2 = await ctx.use(p2)  # svc satisfied again mid-unload
    await asyncio.sleep(0)
    unload_gate.set()        # unload completes → must chain reload
    await task
    await ctx.start()

    assert df.state is FiberState.ACTIVE
    assert events == ["load", "unload-begin", "unload-end", "load"]


@pytest.mark.asyncio
async def test_no_double_apply() -> None:
    ctx = create_context("root")
    apply_count = 0

    async def d_apply(fctx):
        nonlocal apply_count
        apply_count += 1
        await asyncio.sleep(0)

    dep = Component(name="d", inject=frozenset({"svc"}), provide=frozenset(), apply=d_apply)
    await ctx.use(dep)

    unset = ctx.set("svc", "v1")   # satisfy
    await ctx.start()
    await unset()                  # unsatisfy
    await ctx.start()
    ctx.set("svc", "v2")           # satisfy again
    await ctx.start()

    assert apply_count == 2
    assert ctx.fibers()[0].state is FiberState.ACTIVE


@pytest.mark.asyncio
async def test_provider_identity_change_triggers_reload() -> None:
    ctx = create_context("root")
    loads: list[str] = []

    async def d_apply(fctx):
        loads.append(fctx.get("svc"))
        yield lambda: loads.append("unload")

    dep = Component(name="d", inject=frozenset({"svc"}), provide=frozenset(), apply=d_apply)

    p1 = _provider("p1", "svc", "value-a")
    pf1 = await ctx.use(p1)
    df = await ctx.use(dep)
    await ctx.start()
    assert df.state is FiberState.ACTIVE
    assert loads == ["value-a"]

    await pf1.dispose()
    await ctx.start()
    assert df.state is FiberState.PENDING
    assert loads == ["value-a", "unload"]

    p2 = _provider("p2", "svc", "value-b")
    await ctx.use(p2)
    await ctx.start()
    assert df.state is FiberState.ACTIVE
    assert loads == ["value-a", "unload", "value-b"]
