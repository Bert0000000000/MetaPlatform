"""Message schema tests (ST-5.1.2)."""
from __future__ import annotations

from mate_tech_msg.schemas import Message, PublishRequest, PublishResponse


def test_message_default_metadata() -> None:
    m = Message(payload={"x": 1})
    assert m.tenant_id == "default"
    assert m.headers == {}


def test_message_kafka_headers() -> None:
    m = Message(payload={"x": 1}, trace_id="trace-1", tenant_id="acme", headers={"x-h": "v"})
    h = dict(m.to_kafka_headers())
    assert h["trace_id"] == b"trace-1"
    assert h["tenant_id"] == b"acme"
    assert h["x-h"] == b"v"


def test_publish_request_required() -> None:
    pr = PublishRequest(topic="t", payload={"a": 1})
    assert pr.topic == "t"
    assert pr.partition_key is None


def test_publish_response_partition_offset() -> None:
    r = PublishResponse(topic="t", partition=2, offset=100, idempotency_hit=True)
    assert r.partition == 2
    assert r.offset == 100
    assert r.idempotency_hit is True
