"""End-to-end integration tests for mate-tech-msg (ST-5.1.12.2)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from mate_tech_msg.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_healthz(client: TestClient) -> None:
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_publish_endpoint_idempotency(client: TestClient, monkeypatch) -> None:
    """完整 publish 端点 + 幂等."""
    from unittest.mock import AsyncMock

    from mate_tech_msg import main
    from mate_tech_msg.schemas import PublishRequest

    # mock kafka send
    send_mock = AsyncMock(return_value=(0, 100))
    monkeypatch.setattr(main.kafka, "send", send_mock)

    # mock dedup
    class FakeDedup:
        async def check_and_store(self, key, payload_id):
            from mate_tech_msg.dedup import DedupResult
            return DedupResult(hit=False, stored=True)

    monkeypatch.setattr(main, "dedup", FakeDedup())

    req = PublishRequest(
        topic="test.topic",
        payload={"x": 1, "tenant_id": "acme"},
        idempotency_key="idem-001",
    )
    resp = client.post(
        "/api/v1/msg/publish",
        json=req.model_dump(),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["topic"] == "test.topic"
    assert body["partition"] == 0
    assert body["offset"] == 100


def test_topics_endpoint(client: TestClient) -> None:
    """GET /api/v1/msg/topics."""
    resp = client.get("/api/v1/msg/topics")
    assert resp.status_code == 200
    body = resp.json()
    assert "topics" in body
    assert "mate.msg.dlq" in body["topics"]
