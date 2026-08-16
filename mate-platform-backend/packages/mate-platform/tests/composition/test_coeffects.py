"""Composition kernel coeffect tests (paper Algorithms 2-3).

Covers: set/unset with notification, realm isolation, parent-chain
resolution, and the identity-vs-value reload distinction.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pytest

SRC = Path(__file__).resolve().parents[2] / "src"
sys.path.insert(0, str(SRC))

from mate_platform.composition import Component, FiberState, create_context


@pytest.mark.asyncio
async def test_set_notifies_and_unset_reverts() -> None:
    ctx = create_context("root")
    loads: list[str] = []

    async def apply(fctx):
        loads.append("load")
        yield lambda: loads.append("unload")

    comp = Component(name="dep", inject=frozenset({"k"}), provide=frozenset(), apply=apply)
    fiber = await ctx.use(comp)
    assert fiber.state is FiberState.PENDING

    unset = ctx.set("k", 1)
    await ctx.start()
    assert fiber.state is FiberState.ACTIVE
    assert loads == ["load"]

    await unset()
    await ctx.start()
    assert fiber.state is FiberState.PENDING
    assert loads == ["load", "unload"]
    assert ctx.get("k") is None


@pytest.mark.asyncio
async def test_isolate_resolves_realm_override() -> None:
    ctx = create_context("root")
    ctx.set("k", "main-value")
    seen: dict[str, Any] = {}

    async def apply(fctx):
        iso = fctx.isolate("k", "iso1")
        yield iso
        fctx.set("k", "iso-value")
        seen["own"] = fctx.get("k")

    comp = Component(name="isolated", inject=frozenset(), provide=frozenset(), apply=apply)
    await ctx.use(comp)
    await ctx.start()
    assert seen["own"] == "iso-value"
    assert ctx.get("k") == "main-value"


@pytest.mark.asyncio
async def test_get_falls_through_parent() -> None:
    ctx = create_context("root")
    ctx.set("k", "from-root")
    seen: dict[str, Any] = {}

    async def apply(fctx):
        seen["value"] = fctx.get("k")

    comp = Component(name="reader", inject=frozenset(), provide=frozenset(), apply=apply)
    await ctx.use(comp)
    await ctx.start()
    assert seen["value"] == "from-root"


@pytest.mark.asyncio
async def test_value_change_without_identity_change_does_not_reload() -> None:
    ctx = create_context("root")
    apply_count = 0

    async def apply(fctx):
        nonlocal apply_count
        apply_count += 1

    comp = Component(name="dep", inject=frozenset({"k"}), provide=frozenset(), apply=apply)
    await ctx.use(comp)
    ctx.set("k", "v1")
    await ctx.start()
    assert apply_count == 1

    ctx.set("k", "v2")  # same owner (root) — neutral for identity purposes
    await ctx.start()
    assert apply_count == 1
    assert ctx.get("k") == "v2"
