"""Lineage client protocol + node/edge data classes.

The client surface is intentionally small: a tenant-scoped query API
that returns the cross-domain chain (nodes + edges) for a given
correlation id. The emit-side (``LineageEvent`` /
``MarquezHttpLineageEmitter``) lives in ``mate_platform.messaging``
because every outbox producer already imports it; the *query* side
is only needed by services that visualize or audit lineage, so it
gets its own module.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True, slots=True)
class LineageNode:
    """One node in the lineage graph (a single domain step)."""

    system: str
    job_name: str
    tenant_id: str
    correlation_id: str
    emitted_at: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class LineageEdge:
    """Directed edge between two lineage nodes.

    Edges are always tenant-scoped — the lineage server MUST refuse
    edges that cross tenant boundaries. Per ADR-0016 §3.1 and
    SEC-TENANT-01 hard rule 5.
    """

    source: str
    target: str
    tenant_id: str
    correlation_id: str
    edge_type: str = "data_flow"


@dataclass(frozen=True, slots=True)
class LineageQueryResult:
    """Result of a tenant-scoped lineage query.

    The result is intentionally a flat list of nodes + edges so the
    caller can build any graph visualization without forcing a
    specific layout.
    """

    tenant_id: str
    correlation_id: str
    nodes: tuple[LineageNode, ...]
    edges: tuple[LineageEdge, ...]


class LineageClient(Protocol):
    """Tenant-scoped lineage query / management surface."""

    def emit(self, node: LineageNode) -> None:
        """Append one node (and an implicit self-edge if needed)."""
        ...

    def link(self, edge: LineageEdge) -> None:
        """Append a directed edge between two existing nodes."""
        ...

    def query(
        self, *, tenant_id: str, correlation_id: str
    ) -> LineageQueryResult:
        """Return the cross-domain chain for a correlation id.

        Tenant isolation: the result MUST only contain nodes whose
        ``tenant_id`` matches the requested one. Cross-tenant
        queries are not allowed (per ADR-0016 §6.5).
        """
        ...

    def list_namespaces(self) -> tuple[str, ...]:
        """Return the list of tenant namespaces known to the client.

        Used by tests and operational tooling to assert tenant
        partitioning without poking at internals.
        """
        ...
