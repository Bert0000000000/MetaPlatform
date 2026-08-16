"""mate_platform.composition.fiber — components and inertial fibers (ADR-0042).

Realizes paper Section 4: a component is the triple (inject, provide,
apply); a fiber is one instantiation carrying a lifecycle state and a
committed view. Transitions are inertial (Section 4.3.3): once a load
or unload begins it runs to completion, and only then is the target
re-examined — a flip mid-transition chains the opposite transition.

Lifecycle: PENDING → LOADING → ACTIVE | FAILED, and UNLOADING →
PENDING (dependencies lost, reactivatable) or DISPOSED (retired,
terminal). Unloading stops providing BEFORE any inverse runs and waits
for every live dependent to react first (Theorem 63 / Algorithm 5).

A fiber whose apply raised stays FAILED until an explicit ``reload()``
or a target change — the loop never retries a failed load against the
same target.
"""
# Context and Fiber are cooperating kernel classes: their underscore
# hooks are the kernel-internal protocol between the two.
# pyright: reportPrivateUsage=false
from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING, Any

from .effect import EffectScope
from .errors import FiberStateError

if TYPE_CHECKING:
    from .context import Context


class FiberState(StrEnum):
    PENDING = "pending"
    LOADING = "loading"
    ACTIVE = "active"
    FAILED = "failed"
    UNLOADING = "unloading"
    DISPOSED = "disposed"


ApplyFn = Callable[["Context"], Any]


@dataclass(frozen=True, slots=True)
class Component:
    """A composable unit: what it reads, what it writes, how it loads."""

    name: str
    inject: frozenset[str]
    provide: frozenset[str]
    apply: ApplyFn

    def __post_init__(self) -> None:
        overlap = self.inject & self.provide
        if overlap:
            raise ValueError(
                f"component {self.name!r} injects its own keys: {sorted(overlap)}"
            )


class Fiber:
    """One instantiation of a Component inside a Context tree."""

    def __init__(self, root: Context, component: Component) -> None:
        self._root = root
        self.component = component
        self.id: str = root._next_fiber_id()
        self.ctx: Context = root._make_child_context(self)
        self.state: FiberState = FiberState.PENDING
        self.error: BaseException | None = None
        self.target: dict[str, str] | None = None
        self._scope: EffectScope | None = None
        self._loaded_for: dict[str, str] | None = None
        self._failed_for: dict[str, str] | None = None
        self._retired = False
        self._drive_task: asyncio.Task[None] | None = None

    @property
    def inject(self) -> frozenset[str]:
        return self.component.inject

    @property
    def provide(self) -> frozenset[str]:
        return self.component.provide

    def _schedule(self) -> None:
        if self.state is FiberState.DISPOSED:
            return
        if self._drive_task is not None and not self._drive_task.done():
            return  # the running drive re-examines its target each loop
        # Retired fibers still need one final drive (the unload pass).
        self._drive_task = asyncio.create_task(self._drive())

    async def _join(self) -> None:
        if self._drive_task is not None:
            await self._drive_task

    async def _drive(self) -> None:
        """Inertial transition loop — runs to quiescence, never cancels."""
        while True:
            desired = self._root._compute_target(self)
            self.target = desired
            if self._retired:
                if self._loaded_for is not None:
                    await self._unload(final=True)
                elif self._scope is not None and not self._scope.disposed:
                    await self._scope.dispose()
                self.state = FiberState.DISPOSED
                return
            if self._loaded_for is None:
                if desired is None:
                    return  # inactive: awaiting satisfaction
                if (
                    self.state is FiberState.FAILED
                    and desired == self._failed_for
                ):
                    return  # already failed against this exact target
                await self._load(desired)
            else:
                if desired is not None and desired == self._loaded_for:
                    return  # committed view unchanged — neutral change
                await self._unload(final=False)
                # loop: re-examine target (inertia — may chain a reload)

    async def _load(self, target: dict[str, str]) -> None:
        self.state = FiberState.LOADING
        self.error = None
        self._failed_for = None
        scope = EffectScope()
        self._scope = scope
        source = self.component.apply(self.ctx)
        try:
            await scope.run(source)
        except Exception as exc:  # L-Raise: keep partial inverses, record error
            self.error = exc
            await scope.dispose()
            self._loaded_for = None
            self._failed_for = target
            self.state = FiberState.FAILED
            return
        self._loaded_for = target
        self.state = FiberState.ACTIVE
        self._root._notify_keys(self.component.provide)

    async def _unload(self, *, final: bool) -> None:
        scope = self._scope
        # L-Leave: stop providing before any inverse is scheduled, so
        # dependents recompute an unsatisfied target and drain first.
        self._loaded_for = None
        self.state = FiberState.UNLOADING
        await self._root._drain_dependents(self)
        if scope is not None:
            await scope.dispose()
        self.state = FiberState.DISPOSED if final else FiberState.PENDING

    async def reload(self) -> None:
        """Explicitly re-run the transition loop (e.g. after a FAILED load)."""
        if self._retired or self.state is FiberState.DISPOSED:
            raise FiberStateError(f"fiber {self.id} is disposed")
        self._failed_for = None
        self._schedule()
        await self._join()

    async def dispose(self) -> None:
        """Retire the fiber: interrupt, drain dependents, revert effects."""
        self._retired = True
        if self._scope is not None:
            await self._scope.interrupt()
        self._schedule()
        await self._join()
        if self.state is not FiberState.DISPOSED:
            self.state = FiberState.DISPOSED
