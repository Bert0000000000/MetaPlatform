"""Cross-domain lineage client (DATA-D0-D8 D1).

This module is the **query/management** surface for the lineage graph.
The emit-side is owned by ``mate_platform.messaging.lineage`` (D0/D1
commit 2ee18610): every outbox event already carries
``LineageEvent`` and is POSTed to Marquez via
``MarquezHttpLineageEmitter``.

The D1 e2e tests need a *queryable* surface to assert that:

  - emitting an outbox event creates a node in the lineage graph
  - downstream consumers (e.g. obs → dw) chain into a cross-domain
    trace
  - the chain is **strictly** tenant-scoped (no cross-tenant leakage)
  - lineage hints (``tenant_id``, ``correlation_id``) propagate
    end-to-end

In production this is backed by Marquez' GraphQL endpoint (deployed
via the ``marquez`` sub-chart in D0). In tests we ship
``InMemoryLineageClient`` which keeps the same shape in process.

Layered per ADR-0016 §3.1:

  outbox event --> LineageEvent --> MarquezHttpLineageEmitter
                                      |
                                      v
                                 Marquez server
                                      ^
                                      |
        LineageClient (query/list) --+
        (this module)
"""
from .client import LineageClient, LineageEdge, LineageNode, LineageQueryResult
from .hints import (
    LineageHints,
    build_hints_from_event,
    default_hints,
    merge_hints,
)
from .in_memory import InMemoryLineageClient

__all__ = [
    "InMemoryLineageClient",
    "LineageClient",
    "LineageEdge",
    "LineageHints",
    "LineageNode",
    "LineageQueryResult",
    "build_hints_from_event",
    "default_hints",
    "merge_hints",
]
