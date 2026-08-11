"""v2_kernel ObjectType 增量追加 Property 测试（GOVERN-12-04 + GO-2026-08-11-007）。

覆盖 POST /api/v1/ont/v2/object-types/{rid}/properties：
- happy path：先 seed employee OT → POST 一个 dept-name → 200，返回的 OT 含新 property
- 409：重复追加同 rid → 409
- 404：不存在的 OT rid → 404
- tenant 隔离：跨 tenant POST 不污染源 OT（13 硬规则 §3）
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from mate_tech_ont.main import app
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_tech_ont.v2_kernel.seed import TENANT, seed_demo


@pytest.fixture(scope="module", autouse=True)
def _init_kernel_repo():
    app.state.kernel_repo = InMemoryOntologyRepository()
    yield
    app.state.kernel_repo = None


@pytest.fixture
def client_with_ctx(monkeypatch):
    """与 test_v2_kernel_seed.py 同样模式：monkeypatch AuthMiddleware 注入 tenant ctx。

    接受 tenant_id 形参，让用例能切换租户验证 §3 tenant guard。
    """
    from mate_platform.auth import middleware as auth_mw
    from mate_platform.tenancy.context import (
        AuthMethod, RequestContext, TenantId, UserId,
    )

    tenant_id_in_call = {"value": TENANT}

    original_dispatch = auth_mw.AuthMiddleware.dispatch

    async def fake_dispatch(self, request, call_next):
        request.state.ctx = RequestContext(
            request_id="property-test",
            trace_id="property-trace",
            tenant_id=TenantId(tenant_id_in_call["value"]),
            user_id=UserId("alice"),
            roles=frozenset({"editor"}),
            permissions=frozenset({"ont.read", "ont.write"}),
            scopes=frozenset({"platform.read", "platform.write"}),
            auth_method=AuthMethod.USER,
        )
        return await call_next(request)

    monkeypatch.setattr(auth_mw.AuthMiddleware, "dispatch", fake_dispatch)
    from mate_tech_ont.main import app as _app
    saved_stack = _app.middleware_stack
    _app.middleware_stack = None
    try:
        yield TestClient(_app), tenant_id_in_call
    finally:
        _app.middleware_stack = saved_stack


def _make_prop(rid_suffix: str) -> dict:
    """构造合法 PropertyV2 payload（rid 形如 ont.<tenant>.prop.<slug>.v1）。"""
    return {
        "rid": f"ont.{TENANT}.prop.{rid_suffix}.v1",
        "type_id": "string",
        "nullable": True,
        "primary_key": False,
        "title": rid_suffix.replace("-", " ").title(),
        "format": "string",
    }


class TestAppendObjectTypeProperty:
    """POST /api/v1/ont/v2/object-types/{rid}/properties."""

    def test_append_property_happy_path(self, client_with_ctx) -> None:
        c, _ = client_with_ctx
        seed_demo(app.state.kernel_repo, TENANT)
        ot_rid = f"ont.{TENANT}.obj.employee.v1"

        r = c.post(
            f"/api/v1/ont/v2/object-types/{ot_rid}/properties",
            json=_make_prop("overtime-fee"),
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["rid"] == ot_rid
        prop_rids = {p["rid"] for p in body["properties"]}
        assert f"ont.{TENANT}.prop.overtime-fee.v1" in prop_rids, body

        # 立即 GET 验证真的写回（不只 in-memory）
        r2 = c.get(f"/api/v1/ont/v2/object-types/{ot_rid}")
        assert r2.status_code == 200
        prop_rids2 = {p["rid"] for p in r2.json()["properties"]}
        assert f"ont.{TENANT}.prop.overtime-fee.v1" in prop_rids2

    def test_append_property_duplicate_returns_409(self, client_with_ctx) -> None:
        c, _ = client_with_ctx
        seed_demo(app.state.kernel_repo, TENANT)
        ot_rid = f"ont.{TENANT}.obj.employee.v1"
        prop_payload = _make_prop("dept-name")

        # 第一次 200
        r1 = c.post(
            f"/api/v1/ont/v2/object-types/{ot_rid}/properties",
            json=prop_payload,
        )
        assert r1.status_code == 200, r1.text
        # 第二次 409
        r2 = c.post(
            f"/api/v1/ont/v2/object-types/{ot_rid}/properties",
            json=prop_payload,
        )
        assert r2.status_code == 409, r2.text

    def test_append_property_to_missing_object_type_returns_404(
        self, client_with_ctx,
    ) -> None:
        c, _ = client_with_ctx
        seed_demo(app.state.kernel_repo, TENANT)
        missing_rid = f"ont.{TENANT}.obj.does-not-exist.v1"

        r = c.post(
            f"/api/v1/ont/v2/object-types/{missing_rid}/properties",
            json=_make_prop("foo"),
        )
        assert r.status_code == 404, r.text

    def test_append_property_preserves_existing_properties(
        self, client_with_ctx,
    ) -> None:
        """追加不应丢失既有 property（13 硬规则 §1 不变：幂式 upsert）。"""
        c, _ = client_with_ctx
        seed_demo(app.state.kernel_repo, TENANT)
        ot_rid = f"ont.{TENANT}.obj.leave-request.v1"

        # 取追加前的 property 数
        r0 = c.get(f"/api/v1/ont/v2/object-types/{ot_rid}")
        before = len(r0.json()["properties"])

        r1 = c.post(
            f"/api/v1/ont/v2/object-types/{ot_rid}/properties",
            json=_make_prop("overtime-fee"),
        )
        assert r1.status_code == 200, r1.text
        after = len(r1.json()["properties"])
        assert after == before + 1, r1.json()

        # 既有 property 仍在
        prop_rids = {p["rid"] for p in r1.json()["properties"]}
        # leave-request seed 里有 prop.leave-id / prop.employee / prop.days 等
        assert f"ont.{TENANT}.prop.leave-id.v1" in prop_rids
        assert f"ont.{TENANT}.prop.employee.v1" in prop_rids