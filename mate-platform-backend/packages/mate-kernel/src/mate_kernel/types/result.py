from dataclasses import dataclass
from typing import TypeVar

T = TypeVar("T")
E = TypeVar("E", bound=Exception)


@dataclass(frozen=True, slots=True)
class Result[T, E]:
    _value: T | E | None
    _is_ok: bool

    @classmethod
    def ok(cls, value: T) -> "Result[T, E]":
        return cls(value, True)

    @classmethod
    def err(cls, error: E) -> "Result[T, E]":
        return cls(error, False)

    def is_ok(self) -> bool:
        return self._is_ok

    def is_err(self) -> bool:
        return not self._is_ok

    def unwrap(self) -> T:
        if not self._is_ok:
            raise RuntimeError(f"unwrap on err: {self._value!r}")
        return self._value  # type: ignore[return-value]

    def unwrap_err(self) -> E:
        if self._is_ok:
            raise RuntimeError(f"unwrap_err on ok: {self._value!r}")
        return self._value  # type: ignore[return-value]
