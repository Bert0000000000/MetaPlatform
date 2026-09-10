"""Sprint 1A M3 — REST 双轨开关单测（fake temporal 网关，无真 server）。"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
for _p in (
    "mate-kernel",
    "mate-common",
    "mate-platform",
    "mate-clients",
    "mate-tech-db",
    "mate-app-a2a",
):
    _d = os.path.join(os.path.dirname(__file__), "..", "..", _p, "src")
    if os.path.isdir(_d) and _d not in sys.path:
        sys.path.insert(0, _d)

from fastapi.testclient import TestClient
from mate_tech_orchestrator import temporal_rest
from mate_tech_orchestrator.main import create_app
from mate_tech_orchestrator.temporal_rest import engine_from, is_temporal_plan


def run(coro):
    return asyncio.run(coro)


def _client() -> TestClient:
    app = create_app()
    return TestClient(app)


def _headers() -> dict:
    # conftest 环境已 INSECURE_SKIP_SIGNATURE；给个带 tenant 的 HS256
    import jwt

    tok = jwt.encode(
        {
            "sub": "t",
            "tenant_id": "tenant-default",
            "attributes": {"tenant_id": ["tenant-default"]},
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
        },
        "test-secret",
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {tok}", "X-Tenant-Id": "tenant-default"}


H = _headers()
BODY = {
    "steps": [
        {
            "step_id": "s1",
            "kind": "run_function",
            "target": "inline",
            "payload": {"source": "print(1)"},
        },
        {
            "step_id": "s2",
            "kind": "run_function",
            "target": "inline",
            "payload": {"source": "print(2)"},
            "requires_hitl": True,
        },
    ],
}


class TestEngineSelection:
    def test_defaults_legacy(self) -> None:
        assert engine_from(None, None) == "legacy"
        assert engine_from(None, "") == "legacy"

    def test_param_beats_env(self) -> None:
        assert engine_from("legacy", "temporal") == "temporal"
        assert engine_from("temporal", "legacy") == "legacy"

    def test_env_used_when_no_param(self) -> None:
        os.environ["WORKFLOW_ENGINE"] = "temporal"
        try:
            assert engine_from(None, None) == "temporal"
        finally:
            del os.environ["WORKFLOW_ENGINE"]

    def test_plan_id_prefix(self) -> None:
        assert is_temporal_plan("twf-123")
        assert not is_temporal_plan("abcdef")


class TestRestDualRail:
    def test_submit_temporal_routes_to_gateway(self, monkeypatch) -> None:
        captured: dict = {}

        async def fake_submit(**kw):
            captured.update(kw)
            return {
                "plan_id": "twf-x1",
                "status": "hitl_waiting:s2",
                "engine": "temporal",
                "step_count": 2,
            }

        monkeypatch.setattr(temporal_rest, "submit_and_run", fake_submit)
        monkeypatch.setattr(temporal_rest, "is_available", lambda: True)
        with _client() as c:
            r = c.post("/api/v1/orchestrator/plans?engine=temporal", json=BODY, headers=H)
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["plan_id"] == "twf-x1" and data["engine"] == "temporal"
        assert captured["tenant_id"] == "tenant-default"
        assert captured["raw_steps"][1]["requires_hitl"] is True

    def test_review_temporal_routes_to_gateway(self, monkeypatch) -> None:
        async def fake_review(**kw):
            return {"plan_id": kw["plan_id"], "status": "completed", "engine": "temporal"}

        monkeypatch.setattr(temporal_rest, "review", fake_review)
        monkeypatch.setattr(temporal_rest, "is_available", lambda: True)
        with _client() as c:
            r = c.post(
                "/api/v1/orchestrator/plans/twf-x1/steps/s2/review",
                json={"approved": True},
                headers=H,
            )
        assert r.status_code == 200, r.text
        assert r.json()["engine"] == "temporal"

    def test_status_temporal_routes_to_gateway(self, monkeypatch) -> None:
        async def fake_status(pid: str):
            return {
                "plan_id": pid,
                "status": "hitl_waiting:s2",
                "current_step_id": "s2",
                "engine": "temporal",
            }

        monkeypatch.setattr(temporal_rest, "status", fake_status)
        monkeypatch.setattr(temporal_rest, "is_available", lambda: True)
        with _client() as c:
            r = c.get("/api/v1/orchestrator/plans/twf-x1", headers=H)
        assert r.status_code == 200, r.text
        assert r.json()["current_step_id"] == "s2"

    def test_legacy_submit_still_works(self) -> None:
        with _client() as c:
            r = c.post("/api/v1/orchestrator/plans", json=BODY, headers=H)
        assert r.status_code == 201, r.text
        assert r.json()["status"] == "submitted"
        assert not is_temporal_plan(r.json()["plan_id"])

    def test_temporal_execute_conflicts(self, monkeypatch) -> None:
        monkeypatch.setattr(temporal_rest, "is_available", lambda: True)
        with _client() as c:
            r = c.post("/api/v1/orchestrator/plans/twf-x1/execute", headers=H)
        assert r.status_code == 409
