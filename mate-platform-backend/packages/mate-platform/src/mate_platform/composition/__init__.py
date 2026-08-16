"""mate_platform.composition — spatiotemporal composability kernel (ADR-0042).

Self-built Python realization of the cordis paradigm (paper: "A
Programming Paradigm for Spatiotemporal Composability"): revertible
effects + reactive coeffects + inertial fibers. Zero I/O, zero
external dependencies. See ``docs/active/decisions/ADR-0042``.
"""
from __future__ import annotations

from .context import DEFAULT_REALM, ROOT_OWNER, Binding, Context, create_context
from .effect import Disposer, EffectScope, once
from .errors import CompositionError, CycleError, FiberStateError
from .fiber import Component, Fiber, FiberState

__all__ = [
    "DEFAULT_REALM",
    "ROOT_OWNER",
    "Binding",
    "Component",
    "CompositionError",
    "Context",
    "CycleError",
    "Disposer",
    "EffectScope",
    "Fiber",
    "FiberState",
    "FiberStateError",
    "create_context",
    "once",
]
