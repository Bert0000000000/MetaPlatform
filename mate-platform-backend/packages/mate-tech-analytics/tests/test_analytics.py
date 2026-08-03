"""Tests for mate-tech-analytics (>= 15 cases).

Covers: each of the 5 endpoints, the `days` query param, cross-tenant
isolation, require_tenant guard (no tenant -> 400), and auth enforcement.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

ENDPOINTS = (
    "/api/v1/analytics/overview",
    "/api/v1/analytics/usage",
    "/api/v1/analytics/users",
    "/api/v1/analytics/services",
    "/api/v1/analytics/trends",
)


class TestOverview:
    def test_get_overview_returns_stats(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        r = client.get("/api/v1/analytics/overview", headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert {"total_users", "total_apps", "total_requests", "active_tenants", "period_days"} <= set(body)
        for key in ("total_users", "total_apps", "total_requests", "active_tenants", "period_days"):
            assert isinstance(body[key], int)

    def test_get_overview_default_7_days(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        r = client.get("/api/v1/analytics/overview", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["period_days"] == 7

    def test_get_overview_custom_days(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        r = client.get("/api/v1/analytics/overview?days=30", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["period_days"] == 30

    def test_overview_total_requests_positive(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        r = client.get("/api/v1/analytics/overview?days=7", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["total_requests"] > 0

    def test_overview_rejects_out_of_range_days(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        # ge=1 / le=30 -> 0 and 31 must be rejected with 422.
        assert client.get("/api/v1/analytics/overview?days=0", headers=auth_headers).status_code == 422
        assert client.get("/api/v1/analytics/overview?days=31", headers=auth_headers).status_code == 422


class TestUsage:
    def test_get_usage_returns_points(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        r = client.get("/api/v1/analytics/usage", headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "points" in body and "summary" in body
        assert isinstance(body["points"], list)
        assert len(body["points"]) > 0
        first = body["points"][0]
        assert {"date", "service", "request_count", "token_count"} <= set(first)

    def test_get_usage_filters_by_days(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        # 10 services * 7 days = 70 points; 10 services * 3 days = 30.
        r7 = client.get("/api/v1/analytics/usage?days=7", headers=auth_headers)
        r3 = client.get("/api/v1/analytics/usage?days=3", headers=auth_headers)
        assert r7.status_code == 200 and r3.status_code == 200
        assert len(r7.json()["points"]) == 7 * 10
        assert len(r3.json()["points"]) == 3 * 10

    def test_get_usage_summary_totals(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        r = client.get("/api/v1/analytics/usage?days=5", headers=auth_headers)
        body = r.json()
        s = body["summary"]
        assert s["total_requests"] == sum(p["request_count"] for p in body["points"])
        assert s["total_tokens"] == sum(p["token_count"] for p in body["points"])
        assert s["service_count"] == 10


class TestUsers:
    def test_get_users_returns_dau(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        r = client.get("/api/v1/analytics/users", headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "points" in body
        assert len(body["points"]) == 7  # default 7 days
        assert {"date", "dau", "new_users"} <= set(body["points"][0])

    def test_get_users_returns_mau(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        r = client.get("/api/v1/analytics/users", headers=auth_headers)
        body = r.json()
        assert isinstance(body["mau"], int)
        # MAU aggregates the full 30-day window, so it exceeds any 7-day DAU sum.
        assert body["mau"] > 0
        assert isinstance(body["growth_rate"], (int, float))


class TestServices:
    def test_get_services_returns_rankings(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        r = client.get("/api/v1/analytics/services", headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "rankings" in body
        assert len(body["rankings"]) == 10
        first = body["rankings"][0]
        assert {"service", "request_count", "avg_latency_ms", "error_rate"} <= set(first)
        assert first["avg_latency_ms"] >= 0
        assert 0.0 <= first["error_rate"] <= 1.0

    def test_get_services_sorted_by_requests(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        r = client.get("/api/v1/analytics/services?days=14", headers=auth_headers)
        rankings = r.json()["rankings"]
        counts = [x["request_count"] for x in rankings]
        assert counts == sorted(counts, reverse=True), (
            f"rankings not sorted desc by request_count: {counts}"
        )


class TestTrends:
    def test_get_trends_returns_points(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        r = client.get("/api/v1/analytics/trends", headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "points" in body
        assert len(body["points"]) == 7
        first = body["points"][0]
        assert {"date", "requests", "tokens", "storage_gb"} <= set(first)
        assert first["requests"] > 0
        assert first["storage_gb"] >= 0.0

    def test_get_trends_period_days(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        for d in (1, 7, 30):
            r = client.get(f"/api/v1/analytics/trends?days={d}", headers=auth_headers)
            body = r.json()
            assert body["period_days"] == d, f"days={d}"
            assert len(body["points"]) == d

    def test_get_trends_storage_monotonic(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        r = client.get("/api/v1/analytics/trends?days=30", headers=auth_headers)
        stores = [p["storage_gb"] for p in r.json()["points"]]
        assert stores == sorted(stores), "storage must grow monotonically across the window"


class TestTenantGuard:
    def test_no_tenant_returns_400(
        self, client: TestClient, no_tenant_headers: dict[str, str]
    ) -> None:
        # Token resolves but carries no tenant binding -> require_tenant -> 400.
        r = client.get("/api/v1/analytics/overview", headers=no_tenant_headers)
        assert r.status_code == 400, r.text
        body = r.json()
        assert body.get("code") == "E_TENANT_REQUIRED" or body.get("error") == "TENANT_ACCESS_DENIED"

    def test_all_endpoints_require_tenant(
        self, client: TestClient, no_tenant_headers: dict[str, str]
    ) -> None:
        for ep in ENDPOINTS:
            r = client.get(ep, headers=no_tenant_headers)
            assert r.status_code == 400, f"{ep} returned {r.status_code}: {r.text}"


class TestAuth:
    def test_all_endpoints_have_auth_headers(
        self, client: TestClient
    ) -> None:
        # No Authorization header at all -> middleware rejects with 401.
        for ep in ENDPOINTS:
            r = client.get(ep)
            assert r.status_code == 401, f"{ep} without auth returned {r.status_code}"


class TestCrossTenantIsolation:
    def test_cross_tenant_isolation(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        second_tenant_headers: dict[str, str],
    ) -> None:
        # Different tenants must observe different overview totals.
        a = client.get("/api/v1/analytics/overview?days=7", headers=auth_headers).json()
        b = client.get("/api/v1/analytics/overview?days=7", headers=second_tenant_headers).json()
        assert a["total_requests"] != b["total_requests"], (
            "cross-tenant data must differ (seed not tenant-specific)"
        )
        assert a["total_users"] != b["total_users"]

    def test_cross_tenant_usage_differs(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        second_tenant_headers: dict[str, str],
    ) -> None:
        a = client.get("/api/v1/analytics/usage?days=7", headers=auth_headers).json()
        b = client.get("/api/v1/analytics/usage?days=7", headers=second_tenant_headers).json()
        assert a["summary"]["total_requests"] != b["summary"]["total_requests"]


class TestInstallAuthWired:
    def test_auth_middleware_mounted(self) -> None:
        from mate_tech_analytics.main import app

        classes = [m.cls.__name__ for m in app.user_middleware]
        assert "AuthMiddleware" in classes, f"AuthMiddleware missing: {classes}"

    def test_healthz_anonymous(self, client: TestClient) -> None:
        r = client.get("/healthz")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"
