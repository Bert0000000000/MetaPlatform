"""In-memory lineage client.

Used by unit / e2e tests and by code paths that want a synchronous,
deterministic lineage graph without talking to Marquez. Mirrors the
public surface of the (future) Marquez HTTP client so swapping
implementations is a one-line change.
"""
from __future__ import annotations

import threading
from collections import defaultdict
from typing import Any

from .client import LineageEdge, LineageNode, LineageQueryResult
from .hints import LineageHints


class TenantIsolationError(ValueError):
    """Raised when a lineage operation would cross tenant boundaries."""


class InMemoryLineageClient:
    """Synchronous, in-process lineage client.

    Stores nodes keyed by ``(tenant_id, correlation_id)`` so queries
    are O(N) over the tenant's chain and never touch another tenant's
    data.

    Thread-safe: a single lock guards both the node map and the
    edge map.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # tenant_id -> correlation_id -> [LineageNode]
        self._nodes: dict[str, dict[str, list[LineageNode]]] = defaultdict(
            lambda: defaultdict(list)
        )
        # tenant_id -> correlation_id -> [LineageEdge]
        self._edges: dict[str, dict[str, list[LineageEdge]]] = defaultdict(
            lambda: defaultdict(list)
        )

    # ------------------------------------------------------------------
    # Write side
    # ------------------------------------------------------------------
    def emit(self, node: LineageNode) -> None:
        if not node.tenant_id:
            raise TenantIsolationError(
                "LineageNode.tenant_id is required (SEC-TENANT-01 hard rule 3)"
            )
        with self._lock:
            self._nodes[node.tenant_id][node.correlation_id].append(node)

    def link(self, edge: LineageEdge) -> None:
        if not edge.tenant_id:
            raise TenantIsolationError(
                "LineageEdge.tenant_id is required (SEC-TENANT-01 hard rule 3)"
            )
        with self._lock:
            self._edges[edge.tenant_id][edge.correlation_id].append(edge)

    def emit_from_hints(self, hints: LineageHints, *, system: str, **meta: Any) -> None:
        """Convenience: emit a single node from a ``LineageHints``.

        Mirrors the call shape a downstream consumer would use:
        build hints from the inbound event, then attach a node for
        *this* service (``system``) to the chain.
        """
        self.emit(
            LineageNode(
                system=system,
                job_name=hints.job_name,
                tenant_id=hints.tenant_id,
                correlation_id=hints.correlation_id,
                emitted_at=hints.emitted_at,
                metadata=dict(meta),
            )
        )

    def link_from_hints(
        self,
        hints: LineageHints,
        *,
        source: str,
        target: str,
        edge_type: str = "data_flow",
    ) -> None:
        """Convenience: link two systems using a ``LineageHints``.

        Tenant isolation is enforced both at the call site (the
        hints carry ``tenant_id``) and inside the lock: if a caller
        tries to forge an edge across tenants, the TenantIsolationError
        raised in :meth:`link` rejects the call.
        """
        self.link(
            LineageEdge(
                source=source,
                target=target,
                tenant_id=hints.tenant_id,
                correlation_id=hints.correlation_id,
                edge_type=edge_type,
            )
        )

    # ------------------------------------------------------------------
    # Read side
    # ------------------------------------------------------------------
    def query(
        self, *, tenant_id: str, correlation_id: str
    ) -> LineageQueryResult:
        if not tenant_id:
            raise TenantIsolationError(
                "LineageClient.query requires tenant_id (SEC-TENANT-01 hard rule 3)"
            )
        with self._lock:
            nodes = tuple(self._nodes.get(tenant_id, {}).get(correlation_id, ()))
            edges = tuple(self._edges.get(tenant_id, {}).get(correlation_id, ()))
        return LineageQueryResult(
            tenant_id=tenant_id,
            correlation_id=correlation_id,
            nodes=nodes,
            edges=edges,
        )

    def list_namespaces(self) -> tuple[str, ...]:
        with self._lock:
            return tuple(sorted(self._nodes.keys()))

    def all_correlation_ids(self, *, tenant_id: str) -> tuple[str, ...]:
        with self._lock:
            return tuple(sorted(self._nodes.get(tenant_id, {}).keys()))
