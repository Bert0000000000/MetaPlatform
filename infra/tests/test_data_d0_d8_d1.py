"""DATA-D0-D8 D1 cross-domain lineage e2e tests.

Per ADR-0016 §3.2 + §6.5 (D1): the lineage graph must stitch
cross-domain chains end-to-end (msg → obs → dw) under strict
tenant isolation.

These tests are the *integration* complement to the unit tests
in ``mate-platform-backend/packages/mate-platform/tests/test_data_d0_d8_d1_lineage.py``.
They drive the full outbox flow:

    business event --> InMemoryOutboxWriter --> OutboxRelay -->
        Producer (LineageEvent) --> InMemoryLineageClient (query)

and assert that:

  - ``test_lineage_event_emitted_from_outbox``:
        an outbox event triggers a ``LineageEvent`` whose payload
        contains the same tenant_id + correlation_id as the source.
  - ``test_lineage_query_returns_cross_domain_chain``:
        msg → obs → dw appear as three nodes + two edges in the
        same query result.
  - ``test_lineage_tenant_isolation``:
        tenant-b's chain is invisible when querying tenant-a.
  - ``test_lineage_hints_carry_correlation_id``:
        every node carries the same correlation_id.
  - ``test_lineage_hints_carry_tenant_id``:
        every node carries the same tenant_id.

These tests run with the in-memory ``InMemoryLineageClient`` so the
suite stays hermetic (no Marquez or Kafka dependency) per the
ADR-0016 D1 acceptance scope. The HTTP emitter is exercised in the
package-level test suite.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

import pytest

# ---------------------------------------------------------------------------
# Path setup: mate-platform source + the audit/lineage packages must be
# importable from this repo-root-style test.
# ---------------------------------------------------------------------------
REPO = Path(__file__).resolve().parents[2]
PKG_SRC = REPO / "mate-platform-backend" / "packages" / "mate-platform" / "src"
if str(PKG_SRC) not in sys.path:
    sys.path.insert(0, str(PKG_SRC))

os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

from mate_platform.lineage import (  # noqa: E402  (path-adjusted import)
    InMemoryLineageClient,
    LineageHints,
    build_hints_from_event,
    default_hints,
    merge_hints,
)
from mate_platform.lineage.in_memory import TenantIsolationError  # noqa: E402
from mate_platform.messaging import (  # noqa: E402
    Event,
    EventTypeTopicResolver,
    InMemoryOutboxWriter,
    OutboxRelay,
    Producer,
    lineage_event_from_outbox,
)


# ---------------------------------------------------------------------------
# Test doubles
# ---------------------------------------------------------------------------
class CapturingProducer(Producer):
    """Fake Kafka producer that also feeds the in-memory lineage graph.

    Each ``send`` call:

      1. Captures the headers + body for assertions.
      2. Emits a ``LineageNode`` for the **source** system (the one
         that called the relay) using the event's lineage hints.
      3. Emits a ``LineageNode`` for the **target** system (this
         producer's system) chained off the same correlation id.

    The query result then contains both the source and target nodes,
    letting tests assert the cross-domain chain.
    """

    def __init__(
        self,
        *,
        target_system: str,
        lineage: InMemoryLineageClient,
    ) -> None:
        self.target_system = target_system
        self.lineage = lineage
        self.sent: list[dict[str, Any]] = []

    def send(
        self,
        *,
        topic: str,
        key: str,
        value: bytes,
        headers: dict[str, str],
    ) -> None:
        self.sent.append(
            {
                "topic": topic,
                "key": key,
                "value": value,
                "headers": dict(headers),
            }
        )
        # Reconstruct the Event from headers + body so we can emit
        # lineage nodes consistent with the original event.
        body = json.loads(value.decode("utf-8"))
        event = Event.from_dict(body)
        hints = event.lineage_hints or build_hints_from_event(
            event,
            source_system=headers.get("event_type", "msg").split(".", 1)[0],
        )
        # Source node: the relay / domain that originally emitted.
        # Prefer the lineage_hints.source_system (set by the producer)
        # over the event_type prefix so cross-domain tests get the
        # domain they actually emitted from.
        source_system = (
            hints.source_system
            or headers.get("event_type", "msg").split(".", 1)[0]
        )
        self.lineage.emit_from_hints(
            hints,
            system=source_system,
            topic=topic,
            event_id=event.id,
        )
        # Target node: this producer's system, chained via the edge.
        self.lineage.emit_from_hints(
            hints,
            system=self.target_system,
            topic=topic,
            event_id=event.id,
        )
        self.lineage.link_from_hints(
            hints,
            source=source_system,
            target=self.target_system,
        )


class _DomainConsumer:
    """A second-stage consumer (e.g. ``obs``) that re-emits to ``dw``.

    Models the cross-domain chain. The relay writes to ``obs`` first;
    ``obs`` then publishes a downstream event consumed by ``dw``.
    """

    def __init__(
        self,
        *,
        system: str,
        upstream: CapturingProducer,
        lineage: InMemoryLineageClient,
    ) -> None:
        self.system = system
        self.upstream = upstream
        self.lineage = lineage

    def consume(self, event_type: str, tenant: str, aggregate: str) -> None:
        # Read the upstream message, derive hints from the inbound event,
        # then emit a node in the new domain with the same correlation.
        assert self.upstream.sent, "upstream produced nothing"
        msg = self.upstream.sent[-1]
        body = json.loads(msg["value"].decode("utf-8"))
        event = Event.from_dict(body)
        hints = event.lineage_hints
        assert hints is not None, "upstream event missing lineage_hints"
        merged = merge_hints(
            hints,
            source_system=self.system,
            target_system="dw",
            job_name=event_type,
        )
        # ``self.upstream.target_system`` is the system the producer
        # wrote to (e.g. ``msg``); the consumer reads from there.
        upstream_system = self.upstream.target_system
        self.lineage.emit_from_hints(
            merged,
            system=self.system,
            event_id=event.id,
        )
        self.lineage.link_from_hints(
            merged,
            source=upstream_system,
            target=self.system,
        )
        # Forward to the final domain (dw).
        self.lineage.emit_from_hints(
            merged,
            system="dw",
            event_id=event.id,
        )
        self.lineage.link_from_hints(
            merged,
            source=self.system,
            target="dw",
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _make_event(
    *,
    tenant: str = "acme",
    event_type: str = "iam.user.created",
    aggregate: str = "user-1",
    trace: str = "trace-abc",
    event_id: str | None = None,
) -> Event:
    return Event.create(
        type=event_type,
        tenant_id=tenant,
        aggregate_id=aggregate,
        payload={"name": "alice"},
        trace_id=trace,
        event_id=event_id,
        source_system="iam",
    )


def _setup_relay(
    *,
    target_system: str,
    lineage: InMemoryLineageClient | None = None,
) -> tuple[InMemoryOutboxWriter, CapturingProducer, OutboxRelay]:
    """Build an outbox + relay + capturing producer wired into the
    shared lineage client. Returns the outbox so callers can append
    events before calling ``relay.drain_once()``.
    """
    outbox = InMemoryOutboxWriter()
    lineage = lineage or InMemoryLineageClient()
    producer = CapturingProducer(
        target_system=target_system,
        lineage=lineage,
    )
    relay = OutboxRelay(
        outbox=outbox,
        producer=producer,
        topic_resolver=EventTypeTopicResolver(),
    )
    return outbox, producer, relay


def _drain(
    *,
    tenant: str,
    event_type: str = "iam.user.created",
    aggregate: str = "user-1",
    trace: str = "trace-abc",
    target_system: str = "msg",
    lineage: InMemoryLineageClient | None = None,
) -> tuple[CapturingProducer, InMemoryLineageClient]:
    outbox, producer, relay = _setup_relay(
        target_system=target_system, lineage=lineage
    )
    outbox.append(
        _make_event(
            tenant=tenant,
            event_type=event_type,
            aggregate=aggregate,
            trace=trace,
        )
    )
    relay.drain_once()
    assert producer.lineage is not None
    return producer, producer.lineage


# ---------------------------------------------------------------------------
# 1. Lineage event emitted from outbox
# ---------------------------------------------------------------------------
class TestLineageEventEmittedFromOutbox:
    def test_lineage_event_emitted_from_outbox(self) -> None:
        """A business event outbox'd → a LineageEvent lands with the
        matching tenant_id + correlation_id (= trace_id).

        This is the simplest possible D1 happy path: one outbox event,
        one relay drain, one LineageEvent visible to the client.
        """
        producer, lineage = _drain(
            tenant="acme",
            event_type="iam.user.created",
            aggregate="user-1",
            trace="trace-abc",
            target_system="msg",
        )

        # The producer captured exactly one outbound Kafka message.
        assert len(producer.sent) == 1
        # The lineage graph has at least one node keyed by
        # (acme, trace-abc).
        result = lineage.query(tenant_id="acme", correlation_id="trace-abc")
        assert result.tenant_id == "acme"
        assert result.correlation_id == "trace-abc"
        # At least the source + target system nodes were emitted.
        systems = {n.system for n in result.nodes}
        assert "iam" in systems, f"expected iam in chain, got {sorted(systems)}"
        assert "msg" in systems, f"expected msg in chain, got {sorted(systems)}"

        # The OpenLineage payload itself is still wired through the
        # existing ``LineageEvent`` path (mate_platform.messaging).
        ev = lineage_event_from_outbox(
            event_type="iam.user.created",
            tenant_id="acme",
            aggregate_id="user-1",
            trace_id="trace-abc",
        )
        olp = ev.to_openlineage_dict()
        assert olp["job"]["namespace"] == "metaplatform.acme"
        assert olp["run"]["facets"]["tenant_id"] == "acme"
        assert olp["run"]["facets"]["debugMessage"] == "trace_id=trace-abc"


# ---------------------------------------------------------------------------
# 2. Cross-domain chain query
# ---------------------------------------------------------------------------
class TestLineageQueryReturnsCrossDomainChain:
    def test_lineage_query_returns_cross_domain_chain(self) -> None:
        """msg → obs → dw must all appear in one query result."""
        lineage = InMemoryLineageClient()
        outbox, producer_msg, relay = _setup_relay(
            target_system="msg", lineage=lineage
        )
        event = _make_event(
            tenant="acme",
            event_type="order.placed.created",
            aggregate="order-99",
            trace="trace-cross-domain",
        )
        outbox.append(event)
        relay.drain_once()

        # ``obs`` consumes the message and forwards to ``dw``.
        obs = _DomainConsumer(
            system="obs",
            upstream=producer_msg,
            lineage=lineage,
        )
        obs.consume(
            event_type="order.placed.created",
            tenant="acme",
            aggregate="order-99",
        )

        result = lineage.query(
            tenant_id="acme", correlation_id="trace-cross-domain"
        )
        systems = [n.system for n in result.nodes]
        # Every domain step must appear in the chain.
        assert "iam" in systems, f"missing iam: {systems}"
        assert "msg" in systems, f"missing msg: {systems}"
        assert "obs" in systems, f"missing obs: {systems}"
        assert "dw" in systems, f"missing dw: {systems}"

        # At least one edge per cross-domain hop (iam→msg, msg→obs, obs→dw).
        edge_pairs = {(e.source, e.target) for e in result.edges}
        assert ("iam", "msg") in edge_pairs
        assert ("msg", "obs") in edge_pairs
        assert ("obs", "dw") in edge_pairs

        # The query is keyed by the original event's correlation id.
        assert result.correlation_id == "trace-cross-domain"
        assert result.tenant_id == "acme"


# ---------------------------------------------------------------------------
# 3. Tenant isolation
# ---------------------------------------------------------------------------
class TestLineageTenantIsolation:
    def test_lineage_tenant_isolation(self) -> None:
        """tenant-b's chain MUST NOT be visible from tenant-a queries.

        Per ADR-0016 §6.5 + SEC-TENANT-01 hard rule 5: the lineage
        graph is partitioned by tenant_id.
        """
        lineage = InMemoryLineageClient()

        # tenant-a chain
        outbox_a, _, relay_a = _setup_relay(
            target_system="msg", lineage=lineage
        )
        outbox_a.append(
            _make_event(
                tenant="tenant-a",
                event_type="order.placed.created",
                aggregate="order-a",
                trace="trace-a",
            )
        )
        relay_a.drain_once()

        # tenant-b chain
        outbox_b, _, relay_b = _setup_relay(
            target_system="msg", lineage=lineage
        )
        outbox_b.append(
            _make_event(
                tenant="tenant-b",
                event_type="order.placed.created",
                aggregate="order-b",
                trace="trace-b",
            )
        )
        relay_b.drain_once()

        # Querying tenant-a's correlation returns ONLY tenant-a nodes.
        a_result = lineage.query(tenant_id="tenant-a", correlation_id="trace-a")
        assert a_result.tenant_id == "tenant-a"
        assert all(n.tenant_id == "tenant-a" for n in a_result.nodes)
        assert all(e.tenant_id == "tenant-a" for e in a_result.edges)
        assert len(a_result.nodes) > 0, "tenant-a chain should not be empty"

        # tenant-b has its own namespace, invisible from tenant-a's query.
        b_result = lineage.query(tenant_id="tenant-b", correlation_id="trace-b")
        assert b_result.tenant_id == "tenant-b"
        assert all(n.tenant_id == "tenant-b" for n in b_result.nodes)

        # list_namespaces shows both, but querying with one tenant
        # never returns the other's nodes.
        assert set(lineage.list_namespaces()) == {"tenant-a", "tenant-b"}
        assert not any(
            n.tenant_id == "tenant-b" for n in a_result.nodes
        ), "tenant-a query leaked tenant-b nodes"

        # Direct attempt to query without tenant_id is refused.
        with pytest.raises(TenantIsolationError):
            lineage.query(tenant_id="", correlation_id="trace-a")


# ---------------------------------------------------------------------------
# 4. Correlation id propagation
# ---------------------------------------------------------------------------
class TestLineageHintsCarryCorrelationId:
    def test_lineage_hints_carry_correlation_id(self) -> None:
        """Every node in a single chain shares the same correlation_id.

        Without this guarantee, the lineage server cannot stitch
        the chain back together.
        """
        lineage = InMemoryLineageClient()
        outbox, producer_msg, relay = _setup_relay(
            target_system="msg", lineage=lineage
        )
        outbox.append(
            _make_event(
                tenant="acme",
                event_type="order.placed.created",
                aggregate="order-1",
                trace="trace-corr-id",
            )
        )
        relay.drain_once()
        obs = _DomainConsumer(
            system="obs", upstream=producer_msg, lineage=lineage
        )
        obs.consume(
            event_type="order.placed.created",
            tenant="acme",
            aggregate="order-1",
        )

        result = lineage.query(
            tenant_id="acme", correlation_id="trace-corr-id"
        )
        assert result.nodes, "chain empty"
        # Every node + edge must carry the same correlation_id.
        correlation_ids = {n.correlation_id for n in result.nodes}
        edge_correlation_ids = {e.correlation_id for e in result.edges}
        assert correlation_ids == {"trace-corr-id"}
        assert edge_correlation_ids == {"trace-corr-id"}

        # The hints helper ties correlation to trace_id by default.
        ev = _make_event(
            tenant="acme",
            event_type="order.placed.created",
            aggregate="order-1",
            trace="trace-corr-id",
        )
        hints = build_hints_from_event(ev, source_system="iam")
        assert hints.correlation_id == "trace-corr-id"
        assert hints.tenant_id == "acme"
        assert hints.job_name == "order.placed.created"


# ---------------------------------------------------------------------------
# 5. Tenant id propagation + hints injection into Event.create
# ---------------------------------------------------------------------------
class TestLineageHintsCarryTenantId:
    def test_lineage_hints_carry_tenant_id(self) -> None:
        """Every node in the chain carries the originating tenant_id
        AND every auto-created Event carries a populated LineageHints.

        Per ADR-0016 §6.5 + SEC-TENANT-01 hard rule 3: tenant_id is
        mandatory at every hop.
        """
        lineage = InMemoryLineageClient()
        outbox, _, relay = _setup_relay(
            target_system="msg", lineage=lineage
        )
        outbox.append(
            _make_event(
                tenant="acme",
                event_type="order.placed.created",
                aggregate="order-1",
                trace="trace-tenant",
            )
        )
        relay.drain_once()

        result = lineage.query(
            tenant_id="acme", correlation_id="trace-tenant"
        )
        assert result.nodes, "chain empty"
        tenant_ids = {n.tenant_id for n in result.nodes}
        edge_tenant_ids = {e.tenant_id for e in result.edges}
        assert tenant_ids == {"acme"}
        assert edge_tenant_ids == {"acme"}

        # Event.create auto-injects LineageHints when None is passed.
        ev = Event.create(
            type="order.placed.created",
            tenant_id="acme",
            aggregate_id="order-1",
            payload={},
            trace_id="trace-tenant",
            source_system="iam",
        )
        assert ev.lineage_hints is not None
        assert isinstance(ev.lineage_hints, LineageHints)
        assert ev.lineage_hints.tenant_id == "acme"
        assert ev.lineage_hints.correlation_id == "trace-tenant"
        assert ev.lineage_hints.job_name == "order.placed.created"
        assert ev.lineage_hints.source_system == "iam"

        # Explicitly passing a LineageHints is honored (used by CDC
        # envelopes that bring their own correlation id).
        explicit = default_hints(tenant_id="acme", job_name="cdc.order")
        ev2 = Event.create(
            type="order.placed.created",
            tenant_id="acme",
            aggregate_id="order-1",
            payload={},
            trace_id="trace-tenant",
            lineage_hints=explicit,
        )
        assert ev2.lineage_hints is explicit


# ---------------------------------------------------------------------------
# Bonus: list_namespaces + tenant isolation of namespace list
# ---------------------------------------------------------------------------
class TestLineageListNamespaces:
    def test_list_namespaces_isolated_per_tenant(self) -> None:
        """list_namespaces returns tenant ids, never correlation ids
        or aggregate ids. Used by operational tooling to enumerate
        tenant scopes.
        """
        lineage = InMemoryLineageClient()
        outbox_a, _, relay_a = _setup_relay(
            target_system="msg", lineage=lineage
        )
        outbox_a.append(
            _make_event(
                tenant="acme",
                event_type="iam.user.created",
                aggregate="u1",
                trace="t-a",
            )
        )
        relay_a.drain_once()
        # A second correlation id under the same tenant.
        outbox_a.append(
            _make_event(
                tenant="acme",
                event_type="iam.user.created",
                aggregate="u2",
                trace="t-a-2",
            )
        )
        relay_a.drain_once()

        namespaces = lineage.list_namespaces()
        assert namespaces == ("acme",)
        # all_correlation_ids exposes the chain ids without leaking nodes.
        assert set(lineage.all_correlation_ids(tenant_id="acme")) == {
            "t-a",
            "t-a-2",
        }
