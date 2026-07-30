from typing import Protocol


class ValueObject(Protocol):
    """Immutable value object contract using frozen=True dataclasses."""

    def validate(self) -> None: ...
