"""Sprint 1A M2 — outbox→Temporal bridge unit tests (fake starter)."""
from __future__ import annotations

import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
_MATE_PLATFORM = os.path.join(
    os.path.dirname(__file__), "..", "..", "mate-platform", "src",
)
if _MATE_PLATFORM not in sys.path:
    sys.path.insert(0, _MATE_PLATFORM)

from mate_tech_orchestrator.outbox_relay_loop import RelayLoop
from mate_tech_orchestrator.outbox_temporal_bridge import (
    OutboxTemporalBridge,
)

from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import InMemoryOutboxWriter


class FakeStarter:
    def __init__(self, fail_on: set[str] | None = None) -> None:
        self.calls: list[dict] = []
        self.fail_on = fail_on or set()

    async def start_plan(self, *, workflow_id, steps, tenant_id,
                         author_user_id, token="") -> str:
        if workflow_id in self.fail_on:
            raise RuntimeError("boom")
        self.calls.append({
            "workflow_id": workflow_id, "steps": steps,
            "tenant_id": tenant_id, "author": author_user_id,
        })
        return workflow_id


def _evt(event_id: str, etype: str, payload: dict | None = None) -> Event:
    return Event(
        id=event_id, type=etype, tenant_id="tenant-default",
        aggregate_id="agg-1", occurred_at="2026-09-07T00:00:00Z",
        trace_id="", payload=payload or {},
    )


def run(coro):
    return asyncio.run(coro)


class TestBridge:
    def test_matching_event_starts_workflow_and_publishes(self) -> None:
        outbox = InMemoryOutboxWriter()
        starter = FakeStarter()
        outbox.append(_evt("e1", "order.review.requested", {"order_id": "o-9"}))
        bridge = OutboxTemporalBridge(outbox, starter)
        stats = run(bridge.relay_once())
        assert stats == {"started": 1, "skipped": 0, "failed": 0}
        assert starter.calls[0]["workflow_id"] == "outbox-e1"
        assert starter.calls[0]["tenant_id"] == "tenant-default"
        assert outbox.fetch_pending() == []  # published

    def test_unmatched_event_skipped_not_consumed(self) -> None:
        outbox = InMemoryOutboxWriter()
        starter = FakeStarter()
        outbox.append(_evt("e2", "iam.user.created"))
        bridge = OutboxTemporalBridge(outbox, starter)
        stats = run(bridge.relay_once())
        assert stats["skipped"] == 1 and not starter.calls
        assert len(outbox.fetch_pending()) == 1  # 留给 Kafka relay

    def test_starter_failure_counts_attempt_and_stays_pending(self) -> None:
        outbox = InMemoryOutboxWriter()
        starter = FakeStarter(fail_on={"outbox-e3"})
        outbox.append(_evt("e3", "order.review.requested"))
        bridge = OutboxTemporalBridge(outbox, starter)
        stats = run(bridge.relay_once())
        assert stats["failed"] == 1
        rec = outbox.fetch_pending()[0]
        assert rec.attempts == 1 and "boom" in rec.last_error

    def test_template_rendering_from_payload(self) -> None:
        outbox = InMemoryOutboxWriter()
        starter = FakeStarter()
        outbox.append(_evt("e4", "order.review.requested", {"order_id": "o-42"}))
        rules = {
            "order.review.requested": (
                {
                    "step_id": "s1", "kind": "evaluate_object_set",
                    "target": "ont.t.obj.order.v1",
                    "payload": {"note": "review {aggregate_id} / {payload.order_id}"},
                },
            ),
        }
        bridge = OutboxTemporalBridge(outbox, starter, rules=rules)
        run(bridge.relay_once())
        note = starter.calls[0]["steps"][0]["payload"]["note"]
        assert note == "review agg-1 / o-42"

    def test_tenantless_event_rejected_by_outbox_itself(self) -> None:
        outbox = InMemoryOutboxWriter()
        with pytest.raises(Exception):
            outbox.append(Event(
                id="e5", type="order.review.requested", tenant_id="",
                aggregate_id="a", occurred_at="t", trace_id="", payload={},
            ))


class TestRelayLoop:
    def test_loop_ticks_and_stops(self):
        import asyncio

        from mate_tech_orchestrator.outbox_relay_loop import RelayLoop

        class FakeBridge:
            def __init__(self):
                self.n = 0

            async def relay_once(self):
                self.n += 1
                return {"started": 0, "skipped": 0, "failed": 0}

        async def scenario():
            bridge = FakeBridge()
            loop = RelayLoop(bridge, interval_s=0.05)
            loop.start()
            await asyncio.sleep(0.2)
            await loop.stop()
            return bridge.n

        n = asyncio.run(scenario())
        assert n >= 2

    def test_relay_once_manual(self):
        import asyncio

        class FakeBridge:
            async def relay_once(self):
                return {"started": 1, "skipped": 0, "failed": 0}

        loop = RelayLoop(FakeBridge())
        assert asyncio.run(loop.relay_once())["started"] == 1
