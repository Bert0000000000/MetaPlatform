"""mate_platform.composition.effect — revertible effect scopes (ADR-0042).

Realizes paper Algorithm 1: an effect callback is driven as a sync or
async iterator of disposers; each disposer is the explicit inverse of
the effect that yielded it. The scope folds them LIFO and, on disposal,
runs them in reverse order, sequentially awaiting async ones.

The guard is evaluated at every yield boundary: ``interrupt`` stops the
iteration after the pending step settles, keeps only the disposers
already collected, and closes the generator at its suspension point.
An in-flight ``await`` inside the callback cannot be cancelled — the
callback author must eventually yield or return (same property as the
cordis reference implementation).
"""
from __future__ import annotations

import inspect
from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
from typing import Any

Disposer = Callable[[], Awaitable[None] | None]
EffectSource = Iterator[Disposer] | AsyncIterator[Disposer] | Awaitable[Any] | None


def once(disposer: Disposer) -> Callable[[], Awaitable[None]]:
    """Wrap a disposer so it runs at most once and is always awaitable."""
    done = False

    async def run_once() -> None:
        nonlocal done
        if done:
            return
        done = True
        result = disposer()
        if inspect.isawaitable(result):
            await result

    return run_once


class EffectScope:
    """One fiber's (or the root's) accumulator of revertible effects."""

    def __init__(self) -> None:
        self._disposers: list[Callable[[], Awaitable[None]]] = []
        self._source: EffectSource = None
        self._interrupted = False
        self._disposed = False

    @property
    def disposed(self) -> bool:
        return self._disposed

    @property
    def empty(self) -> bool:
        return not self._disposers and not self._disposed

    async def run(self, source: EffectSource) -> None:
        """Drive the effect source to exhaustion, collecting disposers."""
        self._source = source
        if source is None or inspect.isawaitable(source):
            if inspect.isawaitable(source):
                await source
            return
        if isinstance(source, AsyncIterator):
            while not self._interrupted:
                try:
                    disposer = await source.__anext__()
                except StopAsyncIteration:
                    return
                if self._interrupted:
                    await self._aclose(source)
                    return
                self._collect(disposer)
            await self._aclose(source)
        else:
            iterator: Iterator[Disposer] = source
            while not self._interrupted:
                try:
                    disposer = next(iterator)
                except StopIteration:
                    return
                self._collect(disposer)
            self._close(iterator)

    async def interrupt(self) -> None:
        """Stop the iteration at the next yield boundary (guard trip)."""
        self._interrupted = True
        source = self._source
        if isinstance(source, AsyncIterator):
            await self._aclose(source)
        elif isinstance(source, Iterator):
            self._close(source)

    async def dispose(self) -> None:
        """Run all collected disposers in reverse (LIFO) order."""
        if self._disposed:
            return
        self._disposed = True
        while self._disposers:
            await self._disposers.pop()()

    def collect(self, disposer: Disposer) -> Callable[[], Awaitable[None]]:
        """Register a disposer directly (used by coeffect operations)."""
        wrapped = once(disposer)
        self._disposers.append(wrapped)
        return wrapped

    def _collect(self, disposer: Disposer | None) -> None:
        if disposer is None:
            return
        if not callable(disposer):
            raise TypeError(f"invalid effect: {disposer!r} is not callable")
        self._disposers.append(once(disposer))

    async def _aclose(self, source: AsyncIterator[Disposer]) -> None:
        close = getattr(source, "aclose", None)
        if close is None:
            return
        try:
            result = close()
            if inspect.isawaitable(result):
                await result
        except RuntimeError:
            # Generator already running in the drive task — the guard flag
            # stops it at the next yield boundary instead.
            pass

    def _close(self, source: Iterator[Disposer]) -> None:
        close = getattr(source, "close", None)
        if close is not None:
            close()
