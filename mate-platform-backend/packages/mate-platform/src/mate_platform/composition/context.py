"""mate_platform.composition.context — unified context (ADR-0042).

Realizes paper Algorithms 2–4: the context is the single carrier of
effects (as the owner of scopes) and coeffects (as the two-layer store
``key → realm → binding``). ``set`` is itself an effect — installing a
binding registers its removal into the current scope, so unloading the
owning fiber reverts it automatically (temporal composability), and
every change notifies the fibers that inject the key (spatial
composability).

The root context owns the store, the fiber registry, and the drive
scheduler; fiber contexts are children that attribute bindings to
their owning fiber and may shadow realms via ``isolate``.
"""
# Context and Fiber are cooperating kernel classes: their underscore
# hooks are the kernel-internal protocol between the two.
# pyright: reportPrivateUsage=false
from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass

from .effect import Disposer, EffectScope, EffectSource
from .errors import CycleError, FiberStateError
from .fiber import Component, Fiber, FiberState

ROOT_OWNER = "root"
DEFAULT_REALM = "main"
_LIVE_STATES = (FiberState.LOADING, FiberState.ACTIVE, FiberState.UNLOADING)

Equivalence = Callable[[object, object], bool]


def _default_equivalence(a: object, b: object) -> bool:
    return a == b


@dataclass(frozen=True, slots=True)
class Binding:
    """One coeffect binding: value, owning fiber id, and its ≃ relation."""

    value: object
    owner: str
    equivalence: Equivalence


class Context:
    """First-class context: effect carrier + coeffect carrier (paper §3.3)."""

    def __init__(
        self,
        *,
        name: str = "root",
        _parent: Context | None = None,
        _fiber: Fiber | None = None,
    ) -> None:
        self._name = name
        self._parent = _parent
        self._fiber = _fiber
        self._realm: dict[str, str] = {}
        if _parent is None:
            self._root_ctx: Context = self
            self._store: dict[str, dict[str, Binding]] = {}
            self._fibers: list[Fiber] = []
            self._by_id: dict[str, Fiber] = {}
            self._uid = 0
            self._root_scope = EffectScope()
        else:
            self._root_ctx = _parent._root_ctx

    @property
    def name(self) -> str:
        return self._name

    # ------------------------------------------------------------------
    # Effects (paper §3.1)

    async def effect(self, callback: Callable[[], EffectSource]) -> None:
        """Drive an effect callback, tracking every yielded disposer."""
        await self._current_scope().run(callback())

    # ------------------------------------------------------------------
    # Coeffects (paper §3.2)

    def set(
        self,
        key: str,
        value: object,
        *,
        equivalence: Equivalence | None = None,
    ) -> Disposer:
        """Install a binding for ``key``; returns the (idempotent) unset handle.

        Installing is an effect: the removal is registered on the current
        scope and the change is notified to injecting fibers — unless it is
        observationally neutral (same owner, ≃-equivalent value).
        """
        scope = self._current_scope()
        realm = self._resolve_realm(key)
        owner = self._owner_id
        root = self._root_ctx
        bucket = root._store.setdefault(realm, {})
        previous = bucket.get(key)
        bucket[key] = Binding(
            value=value,
            owner=owner,
            equivalence=equivalence or _default_equivalence,
        )

        def unset() -> None:
            current = root._store.get(realm, {}).get(key)
            if current is not None and current.owner == owner:
                del root._store[realm][key]
                root._notify(key)  # Algorithm 2: removal notifies too

        handle = scope.collect(unset)
        if (
            previous is None
            or previous.owner != owner
            or not previous.equivalence(previous.value, value)
        ):
            root._notify(key)
        return handle

    def get(self, key: str) -> object | None:
        """Resolve ``key`` through the context chain's realm table."""
        realm = self._resolve_realm(key)
        binding = self._root_ctx._store.get(realm, {}).get(key)
        return binding.value if binding is not None else None

    def isolate(self, key: str, realm: str) -> Disposer:
        """Shadow ``key``'s realm for this context subtree (multi-instance)."""
        self._realm[key] = realm
        scope = self._current_scope()

        def remove() -> None:
            if self._realm.get(key) == realm:
                del self._realm[key]

        return scope.collect(remove)

    def bindings(self) -> dict[str, tuple[str, object]]:
        """Public observation: ``"realm:key" -> (owner, value)`` (for I1)."""
        return {
            f"{realm}:{key}": (binding.owner, binding.value)
            for realm, bucket in self._root_ctx._store.items()
            for key, binding in bucket.items()
        }

    # ------------------------------------------------------------------
    # Components (paper §4)

    async def use(self, component: Component) -> Fiber:
        """Instantiate a component as a fiber; raises on a dependency cycle."""
        cycle = self._find_cycle_with(component)
        if cycle is not None:
            raise CycleError(cycle)
        root = self._root_ctx
        fiber = Fiber(root, component)
        root._fibers.append(fiber)
        root._by_id[fiber.id] = fiber
        fiber._schedule()
        return fiber

    def fibers(self) -> tuple[Fiber, ...]:
        return tuple(self._root_ctx._fibers)

    def detect_cycles(self) -> list[tuple[str, ...]]:
        """All dependency cycles among registered components (I3 report)."""
        components = [f.component for f in self._root_ctx._fibers]
        cycles: list[tuple[str, ...]] = []
        seen: set[frozenset[str]] = set()
        for start in components:
            stack: list[str] = [start.name]
            found = self._dfs_cycle(start, components, stack, {start.name})
            if found is not None:
                key = frozenset(found)
                if key not in seen:
                    seen.add(key)
                    cycles.append(found)
        return cycles

    async def start(self) -> None:
        """Drive every scheduled fiber transition to quiescence."""
        while True:
            tasks = [
                f._drive_task
                for f in self._root_ctx._fibers
                if f._drive_task is not None and not f._drive_task.done()
            ]
            if not tasks:
                return
            await asyncio.gather(*tasks)

    async def dispose(self) -> None:
        """Tear down fibers in reverse creation order, then the root scope."""
        for fiber in reversed(list(self._root_ctx._fibers)):
            await fiber.dispose()
        await self._root_ctx._root_scope.dispose()

    # ------------------------------------------------------------------
    # Kernel internals — fiber plumbing

    def _next_fiber_id(self) -> str:
        self._uid += 1
        return f"f{self._uid}"

    def _make_child_context(self, fiber: Fiber) -> Context:
        return Context(_parent=self, _fiber=fiber, name=fiber.component.name)

    @property
    def _owner_id(self) -> str:
        return self._fiber.id if self._fiber is not None else ROOT_OWNER

    def _current_scope(self) -> EffectScope:
        if self._fiber is not None:
            scope = self._fiber._scope
            if scope is None or scope.disposed:
                raise FiberStateError("cannot create effect on inactive context")
            return scope
        if self._root_ctx._root_scope.disposed:
            raise FiberStateError("cannot create effect on disposed context")
        return self._root_ctx._root_scope

    def _resolve_realm(self, key: str) -> str:
        node: Context | None = self
        while node is not None:
            realm = node._realm.get(key)
            if realm is not None:
                return realm
            node = node._parent
        return DEFAULT_REALM

    def _notify(self, key: str) -> None:
        for fiber in self._fibers:
            if key in fiber.component.inject:
                fiber._schedule()

    def _notify_keys(self, keys: frozenset[str]) -> None:
        for key in keys:
            self._notify(key)

    def _compute_target(self, fiber: Fiber) -> dict[str, str] | None:
        """Target view (Definition 46): key -> provider id, or None."""
        if fiber._retired:
            return None
        result: dict[str, str] = {}
        for key in sorted(fiber.component.inject):
            realm = fiber.ctx._resolve_realm(key)
            binding = self._store.get(realm, {}).get(key)
            if binding is None:
                return None
            owner = binding.owner
            if owner != ROOT_OWNER:
                provider = self._by_id.get(owner)
                if provider is None or provider.state is not FiberState.ACTIVE:
                    return None
            result[key] = owner
        return result

    async def _drain_dependents(self, provider: Fiber) -> None:
        """Wait for live dependents to react to the withdrawal (Theorem 63).

        Each dependent gets one scheduled drive and is awaited once — the
        drive recomputes its target against the provider's UNLOADING state
        and settles accordingly (reactivation on a different provider does
        not extend the wait).
        """
        for fiber in self._fibers:
            if fiber is provider or fiber.state not in _LIVE_STATES:
                continue
            if not (fiber.component.inject & provider.component.provide):
                continue
            fiber._schedule()
            await fiber._join()

    # ------------------------------------------------------------------
    # Cycle detection (paper §6.5 — predictable from declarations)

    def _find_cycle_with(self, candidate: Component) -> tuple[str, ...] | None:
        components = [f.component for f in self._fibers] + [candidate]
        return self._dfs_cycle(candidate, components, [candidate.name], {candidate.name})

    def _dfs_cycle(
        self,
        node: Component,
        components: list[Component],
        path: list[str],
        on_path: set[str],
    ) -> tuple[str, ...] | None:
        for other in components:
            if other is node or not (node.inject & other.provide):
                continue
            if other.name in on_path:
                start = path.index(other.name)
                return tuple(path[start:])
            path.append(other.name)
            on_path.add(other.name)
            found = self._dfs_cycle(other, components, path, on_path)
            path.pop()
            on_path.discard(other.name)
            if found is not None:
                return found
        return None


def create_context(name: str = "root") -> Context:
    """Create a root context."""
    return Context(name=name)
