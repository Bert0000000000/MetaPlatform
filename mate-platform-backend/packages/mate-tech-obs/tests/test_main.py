"""Tests for mate_tech_obs.main FastAPI app."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def obs_client() -> TestClient:
    from mate_tech_obs.main import app  # noqa: PLC0415

    return TestClient(app)


class TestRootEndpoints:
    def test_healthz_returns_ok(self, obs_client: TestClient) -> None:
        r = obs_client.get("/healthz")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert body["version"] == "0.1.0"

    def test_metrics_endpoint_returns_text(
        self, obs_client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        r = obs_client.get("/metrics", headers=auth_headers)
        # 200 with prom text OR 500 if registry is empty in unit-test env
        assert r.status_code in (200, 500)
        if r.status_code == 200:
            ct = r.headers.get("content-type", "")
            # Prometheus content type usually contains "text/plain"
            assert "text" in ct.lower()

    def test_health_aggregate_returns_report(
        self, obs_client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        r = obs_client.get("/api/v1/obs/health", headers=auth_headers)
        # The aggregate hits DEFAULT_TARGETS (16 docker-network URLs),
        # so in a host env (no docker) it returns 200 with all components
        # marked unhealthy.
        assert r.status_code in (200, 503)
        if r.status_code == 200:
            body = r.json()
            assert "overall" in body
            assert "components" in body
            assert isinstance(body["components"], list)

    def test_instrument_status_endpoint(
        self, obs_client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        r = obs_client.get("/api/v1/obs/instrument", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert "instrumented" in body
        # Value is bool but pyright isn't always sure; coerce for the check.
        instrumented = body["instrumented"]
        assert isinstance(instrumented, dict), f"expected dict, got {instrumented!r}"
        for lib, status in instrumented.items():
            assert isinstance(status, bool), (
                f"library {lib!r} status must be bool, got {type(status).__name__}"
            )


class TestAdminRouterMounted:
    def test_admin_routes_registered(self, obs_client: TestClient) -> None:
        # The admin router must be mounted on /api/v1/admin/operations/*
        # Hit one of the admin paths and confirm it's routed (not 404).
        r = obs_client.get("/api/v1/admin/operations/health")
        # 200 (aggregate report ok) or 503 (all targets unreachable) are
        # both fine; we just need a response != 404 to prove the route
        # exists.
        assert r.status_code != 404, (
            f"admin path returned 404; router not mounted. body={r.text!r}"
        )
