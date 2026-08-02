"""mate_app_hub.clients — outbound client stub.

The hub itself is a read-only catalog. In P2-W2 it does not call
out to other services (no arch / kb / ontology lookups yet). The
client class is reserved for P2-W3 where arch / kb consumers will
be added; the shape is locked here to avoid a contract churn when
that lands.

Production wiring uses `mate_clients.security.BearerAuth` +
`OutgoingAuthMiddleware` (ADR-0014 step 4). P2-W3 lands that
wiring together with the first real consumer.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AsyncApphubClient:
    """Reserved outbound client for apphub.

    P2-W2: no methods are implemented yet. P2-W3 adds
    `list_applications` / `list_modules` style calls that proxy
    to the arch registry + ontology concept tree once those are
    backed by persistent stores.
    """

    base_url: str
    timeout_seconds: float = 5.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
