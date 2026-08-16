"""Invariant I2 — ordering (paper Theorem 63, Algorithm 5 line 25).

When a provider fiber unloads, every dependent reaches a terminal
inactive state BEFORE any of the provider's own disposers run. The
cascade holds for chains (grandchild → child → provider) and with
async disposers.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parents[2] / "src"
sys.path.insert(0, str(SRC))

from mate_platform.composition import Component, FiberState, create_context


def _provider(name: str, key: str, events: list[str]):
    async def apply(fctx):
        fctx.set(key, f"{name}-value")
        yield lambda: events.append(f"{name}-dispose")
    return Component(name=name, inject=frozenset(), provide=frozenset({key}), apply=apply)


def _dependent(name: str, key: str, events: list[str]):
    async def apply(fctx):
        yield lambda: events.append(f"{name}-dispose")
    return Component(name=name, inject=frozenset({key}), provide=frozenset(), apply=apply)


@pytest.mark.asyncio
async def test_dependent_drains_before_provider_disposer() -> None:
    ctx = create_context("root")
    events: list[str] = []

    provider = _provider("provider", "svc", events)
    dep = _dependent("dep", "svc", events)

    pf = await ctx.use(provider)
    df = await ctx.use(dep)
    await ctx.start()
    assert df.state is FiberState.ACTIVE

    await pf.dispose()
    await ctx.start()
    assert events == ["dep-dispose", "provider-dispose"]
    assert df.state is FiberState.PENDING
    assert pf.state is FiberState.DISPOSED


@pytest.mark.asyncio
async def test_cascade_grandchild_before_child_before_provider() -> None:
    ctx = create_context("root")
    events: list[str] = []

    root_p = _provider("p", "kp", events)
    child = _provider("c", "kc", events)
    # child depends on p and provides kc; grandchild depends on kc.

    async def child_apply(fctx):
        fctx.set("kc", "c-value")
        yield lambda: events.append("c-dispose")

    child = Component(name="c", inject=frozenset({"kp"}), provide=frozenset({"kc"}), apply=child_apply)
    grandchild = _dependent("g", "kc", events)

    pf = await ctx.use(root_p)
    cf = await ctx.use(child)
    gf = await ctx.use(grandchild)
    await ctx.start()
    assert gf.state is FiberState.ACTIVE

    await pf.dispose()
    await ctx.start()
    assert events == ["g-dispose", "c-dispose", "p-dispose"]
    assert cf.state is FiberState.PENDING
    assert gf.state is FiberState.PENDING


@pytest.mark.asyncio
async def test_ordering_holds_with_async_disposers() -> None:
    ctx = create_context("root")
    events: list[str] = []

    async def p_apply(fctx):
        fctx.set("svc", "v")

        async def p_d():
            await asyncio.sleep(0)
            events.append("provider-dispose")
        yield p_d

    async def d_apply(fctx):
        async def d_d():
            await asyncio.sleep(0)
            events.append("dep-dispose")
        yield d_d

    provider = Component(name="p", inject=frozenset(), provide=frozenset({"svc"}), apply=p_apply)
    dep = Component(name="d", inject=frozenset({"svc"}), provide=frozenset(), apply=d_apply)

    pf = await ctx.use(provider)
    df = await ctx.use(dep)
    await ctx.start()

    await pf.dispose()
    await ctx.start()
    assert events == ["dep-dispose", "provider-dispose"]
