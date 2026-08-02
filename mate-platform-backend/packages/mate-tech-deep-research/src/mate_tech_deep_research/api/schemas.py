"""Request / response schemas for the Deep Research A2A agent.

Plain dataclasses (per task spec) — the router serialises them via
``dataclasses.asdict``. The DeerFlow client also constructs these
from upstream JSON.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass(frozen=True, slots=True)
class Source:
    """A single retrieved source that backs the research report."""

    url: str
    title: str
    snippet: str = ""
    reliability: str = "medium"
    fetched_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class ResearchRequest:
    """Input payload for a deep research task."""

    query: str
    depth: str = "deep"
    max_sources: int = 10
    output_format: str = "markdown"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class ResearchResponse:
    """Result returned by DeerFlow Engine."""

    report: str
    sources: list[Source] = field(default_factory=list)
    duration_ms: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "report": self.report,
            "sources": [s.to_dict() for s in self.sources],
            "duration_ms": self.duration_ms,
        }


def now_iso() -> str:
    """ISO-8601 UTC timestamp helper (used by tests / mocks)."""
    return datetime.now(tz=timezone.utc).isoformat()
