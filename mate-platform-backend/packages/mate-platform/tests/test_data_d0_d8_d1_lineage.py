"""DATA-D0-D8 D1 lineage tests."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "mate-platform-backend" / "packages"
for sub in ("mate-platform", "mate-clients", "mate-common"):
    sys.path.insert(0, str(PKG / sub / "src"))

os.environ.setdefault("LEGACY_LOGIN_COMPAT", "true")
os.environ.setdefault("KEYCLOAK_URL", "https://keycloak.test.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")


class TestLineageEventFormat:
    def test_to_openlineage_dict_has_required_fields(self) -> None:
        from mate_platform.messaging import LineageEvent

        e = LineageEvent(
            event_type="iam.user.created",
            tenant_id="acme",
            aggregate_id="user-1",
            trace_id="trace-abc",
            occurred_at="2026-07-30T00:00:00+00:00",
        )
        d = e.to_openlineage_dict()
        assert d["eventType"] == "COMPLETE"
        assert d["job"]["namespace"] == "metaplatform.acme"
        assert d["job"]["name"] == "iam.user.created"
        assert d["run"]["runId"] == e.event_id
        assert d["run"]["facets"]["tenant_id"] == "acme"
        assert d["run"]["facets"]["debugMessage"] == "trace_id=trace-abc"
        assert d["inputs"][0]["name"] == "user-1"
        assert d["outputs"][0]["name"] == "user-1.processed"

    def test_unique_event_ids(self) -> None:
        from mate_platform.messaging import LineageEvent

        ids = set()
        for _ in range(100):
            ids.add(
                LineageEvent(
                    event_type="x",
                    tenant_id="t",
                    aggregate_id="a",
                    trace_id="t",
                    occurred_at="x",
                ).event_id
            )
        assert len(ids) == 100


class TestInMemoryLineageEmitter:
    def test_emit_collects(self) -> None:
        from mate_platform.messaging import (
            InMemoryLineageEmitter,
            LineageEvent,
        )

        e = InMemoryLineageEmitter()
        e.emit(LineageEvent("a", "t1", "ag", "trace", "x"))
        e.emit(LineageEvent("b", "t2", "ag2", "trace2", "x"))
        all_events = e.all()
        assert len(all_events) == 2
        assert all_events[0].tenant_id == "t1"
        assert all_events[1].tenant_id == "t2"

    def test_emit_rejects_empty_tenant(self) -> None:
        from mate_platform.messaging import MarquezHttpLineageEmitter

        m = MarquezHttpLineageEmitter()
        # Build a minimal event with empty tenant
        class EmptyTenantEvent:
            event_type = "x"
            tenant_id = ""
            aggregate_id = "a"
            trace_id = "t"
            occurred_at = "x"
            event_id = "id"
            producer = "test"
            def to_openlineage_dict(self):
                return {}

        with pytest.raises(ValueError, match="tenant_id is required"):
            m.emit(EmptyTenantEvent())


class TestLineageEventFromOutbox:
    def test_helper_builds_event(self) -> None:
        from mate_platform.messaging import lineage_event_from_outbox

        e = lineage_event_from_outbox(
            event_type="iam.user.created",
            tenant_id="acme",
            aggregate_id="user-1",
            trace_id="trace-abc",
        )
        assert e.event_type == "iam.user.created"
        assert e.tenant_id == "acme"
        assert e.aggregate_id == "user-1"
        assert e.trace_id == "trace-abc"
        assert e.occurred_at


class TestLineageConfigFromEnv:
    def test_default_marquez_url(self) -> None:
        from mate_platform.messaging import LineageConfig
        c = LineageConfig.from_env()
        assert "marquez" in c.marquez_url
        assert c.namespace_template == "metaplatform.<tenant>"


class TestLineageTenantScoping:
    def test_namespace_includes_tenant(self) -> None:
        from mate_platform.messaging import LineageEvent

        e1 = LineageEvent("x", "tenant-a", "a", "t", "x")
        e2 = LineageEvent("x", "tenant-b", "a", "t", "x")
        ns1 = e1.to_openlineage_dict()["job"]["namespace"]
        ns2 = e2.to_openlineage_dict()["job"]["namespace"]
        assert "tenant-a" in ns1
        assert "tenant-b" in ns2
        assert ns1 != ns2
