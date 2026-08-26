"""Smoke-test the a2a-external-agent service speaks the A2A 1.0 envelope.

W3C envelope contract (from a2a-sdk 1.1.x):

1. ``GET /.well-known/agent-card.json`` returns the AgentCard with
   ``protocol_binding == "JSONRPC"`` and the three expected skills.
2. ``POST /`` with a JSON-RPC 2.0 ``SendMessage`` envelope returns a
   Task whose ``status.state == TASK_STATE_COMPLETED`` and whose
   ``artifacts`` carry the response text.

The test boots the service in-process via ``ASGITransport`` (no Docker
required) so we can run it on the host pipeline today and also inside
the rebuilt image once the compose stack is up.
"""
from __future__ import annotations

from pathlib import Path

import pytest

pytest.importorskip(
    "mate_a2a_external_agent",
    reason="a2a-external-agent service package is not present in this checkout",
)

from fastapi.testclient import TestClient
from mate_a2a_external_agent.server import SKILLS, app


def _client() -> TestClient:
    return TestClient(app)


# The a2a-sdk validator requires the `A2A-Version` header per
# `a2a.utils.constants.VERSION_HEADER`. The official client emits it
# automatically; Starlette's TestClient does not, so we add it on every
# JSON-RPC call. The agent-card GET is unguarded.
A2A_VERSION = "1.0"


def test_agent_card_well_known_path() -> None:
    client = _client()
    resp = client.get("/.well-known/agent-card.json")
    assert resp.status_code == 200, resp.text
    card = resp.json()
    assert card["name"] == "Mate External A2A Agent"
    assert any(
        i["protocolBinding"] == "JSONRPC" for i in card["supportedInterfaces"]
    )
    skill_ids = {s["id"] for s in card["skills"]}
    assert skill_ids == set(SKILLS.keys())


def test_send_message_envelope_returns_completed_task() -> None:
    client = _client()
    envelope = {
        "jsonrpc": "2.0",
        "id": "test-1",
        "method": "SendMessage",
        "params": {
            "message": {
                "messageId": "msg-1",
                "role": "ROLE_USER",
                "parts": [{"text": "对账 2026-Q3 流水"}],
                "metadata": {"role_slug": "finance-recon"},
            }
        },
    }
    resp = client.post("/", json=envelope, headers={"A2A-Version": A2A_VERSION})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["jsonrpc"] == "2.0"
    assert body["id"] == "test-1"
    task = body["result"]["task"]
    assert task["status"]["state"] == "TASK_STATE_COMPLETED"
    assert task["artifacts"], "completed task must carry an artifact"
    text = task["artifacts"][0]["parts"][0]["text"]
    assert "对账分析报告" in text


def test_send_message_falls_back_to_kb_curator() -> None:
    client = _client()
    envelope = {
        "jsonrpc": "2.0",
        "id": "test-2",
        "method": "SendMessage",
        "params": {
            "message": {
                "messageId": "msg-2",
                "role": "ROLE_USER",
                "parts": [{"text": "把这段会议纪要做成知识卡片"}],
            }
        },
    }
    resp = client.post("/", json=envelope, headers={"A2A-Version": A2A_VERSION})
    assert resp.status_code == 200, resp.text
    task = resp.json()["result"]["task"]
    assert task["status"]["state"] == "TASK_STATE_COMPLETED"
    assert "知识卡片" in task["artifacts"][0]["parts"][0]["text"]


def test_healthz() -> None:
    client = _client()
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_docker_requirements_cover_runtime_logging_dependency() -> None:
    """Keep the Docker runtime dependency set aligned with imported modules."""
    backend_root = Path(__file__).resolve().parents[3]
    requirements = (
        backend_root
        / "services"
        / "a2a-external-agent"
        / "requirements.txt"
    ).read_text(encoding="utf-8")
    assert any(
        line.strip().lower().startswith("structlog")
        for line in requirements.splitlines()
    ), "Docker requirements must install structlog used by server.py"
