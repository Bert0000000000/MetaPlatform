from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class DomainError(Exception):
    code: str
    message: str = ""

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.code}: {self.message}" if self.message else self.code
