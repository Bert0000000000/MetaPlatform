"""Versioned, bounded policy for SuperAI semantic routing."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class RoutingPolicy:
    """Server-owned settings that make routing decisions reproducible."""

    top_k: int = 3
    minimum_relevance: float = 0.0
    keyword_boost: float = 0.2
    cache_ttl_seconds: float = 300.0
    version: str = "semantic-router-v1"

    def __post_init__(self) -> None:
        if self.top_k < 1:
            raise ValueError("top_k must be at least 1")
        if self.minimum_relevance < 0:
            raise ValueError("minimum_relevance must be non-negative")
        if self.keyword_boost < 0:
            raise ValueError("keyword_boost must be non-negative")
        if self.cache_ttl_seconds <= 0:
            raise ValueError("cache_ttl_seconds must be positive")
        if not self.version.strip():
            raise ValueError("version must not be empty")


__all__ = ["RoutingPolicy"]
