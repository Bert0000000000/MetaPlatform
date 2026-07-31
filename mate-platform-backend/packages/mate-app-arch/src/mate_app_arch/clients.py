"""mate_app_arch.clients — outbound client stub.

Reserved for P2-W3: arch → ontology / kb / iam cross-service calls
via `mate_clients.security.BearerAuth` + `OutgoingAuthMiddleware`.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AsyncArchClient:
    base_url: str
    timeout_seconds: float = 5.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
