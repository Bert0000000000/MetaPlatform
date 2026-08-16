"""mate_platform.composition.errors — kernel error types (ADR-0042)."""
from __future__ import annotations


class CompositionError(Exception):
    """Base error for the composition kernel."""


class CycleError(CompositionError):
    """Raised by ``Context.use`` when the component closes a dependency cycle.

    ``cycle`` lists the component names along the cycle, starting at the
    rejected component (paper Section 6.5: cycles are predictable from
    declarations alone, so they are reported at load time, not detected
    as a hang).
    """

    def __init__(self, cycle: tuple[str, ...]) -> None:
        self.cycle = cycle
        super().__init__("dependency cycle: " + " -> ".join((*cycle, cycle[0])))


class FiberStateError(CompositionError):
    """Raised when an operation is invalid for the fiber's lifecycle state."""
