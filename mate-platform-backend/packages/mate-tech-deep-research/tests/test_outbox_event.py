"""Outbox event shape tests for publish_research_completed.

Verifies:
  * The event type is exactly ``deep.research.completed``.
  * The payload carries the documented fields (query, report_size,
    sources_count, duration_ms).
  * The aggregate_id embeds the tenant_id.
  * Calling without a tenant context raises (hard rule 3).
  * Calling with ``outbox=None`` is a no-op (returns None).
"""
from __future__ import annotations

from dataclasses import replace

import pytest
from mate_tech_deep_research.events.publisher import (
    EVENT_TYPE,
    publish_research_completed,
)

from mate_platform.messaging.outbox import InMemoryOutboxWriter
from mate_platform.tenancy.context import AuthMethod, RequestContext, TenantId


def _ctx(tenant: str = "tenant-acme") -> RequestContext:
    return RequestContext(
        request_id="r-1",
        trace_id="t-1",
        tenant_id=TenantId(tenant),
        user_id="u-1",
        roles=frozenset(),
        permissions=frozenset(),
        scopes=frozenset(),
        auth_method=AuthMethod.USER,
    )


def test_event_type_is_deep_research_completed() -> None:
    assert EVENT_TYPE == "deep.research.completed"


def test_publish_appends_event_with_expected_payload() -> None:
    outbox = InMemoryOutboxWriter()
    ctx = _ctx()
    evt = publish_research_completed(
        outbox=outbox,
        ctx=ctx,
        query="hello",
        report_size=128,
        sources_count=3,
        duration_ms=500,
    )
    assert evt is not None
    records = outbox.all_records()
    assert len(records) == 1
    assert records[0].event.type == "deep.research.completed"
    assert records[0].event.payload == {
        "query": "hello",
        "report_size": 128,
        "sources_count": 3,
        "duration_ms": 500,
    }
    assert records[0].event.aggregate_id == "deep-research-tenant-acme"
    assert records[0].event.tenant_id == "tenant-acme"
    assert records[0].event.trace_id == "t-1"


def test_publish_without_tenant_raises() -> None:
    outbox = InMemoryOutboxWriter()
    ctx = replace(_ctx(), tenant_id=TenantId(""))
    with pytest.raises(ValueError, match="tenant"):
        publish_research_completed(
            outbox=outbox,
            ctx=ctx,
            query="x",
            report_size=1,
            sources_count=1,
            duration_ms=1,
        )
    # Nothing should have been appended.
    assert outbox.all_records() == []


def test_publish_with_none_outbox_is_noop() -> None:
    evt = publish_research_completed(
        outbox=None,
        ctx=_ctx(),
        query="x",
        report_size=1,
        sources_count=1,
        duration_ms=1,
    )
    assert evt is None


def test_publish_with_none_ctx_raises() -> None:
    outbox = InMemoryOutboxWriter()
    with pytest.raises(ValueError, match="tenant"):
        publish_research_completed(
            outbox=outbox,
            ctx=None,
            query="x",
            report_size=1,
            sources_count=1,
            duration_ms=1,
        )
