"""v2 kernel HTTP 端到端测试（RUNTIME-HTTP-01 验收）。

5 核心端点 + tenant guard + 跨租户拦截：
- POST /v2/object-types        (upsert)
- GET  /v2/object-types        (list)
- POST /v2/individuals         (create)
- GET  /v2/individuals         (list)
- POST /v2/object-sets:evaluate
- POST /v2/action-types:apply

跑法：
    cd mate-platform-backend/packages/mate-tech-ont
    pytest tests/integration/test_v2_kernel_e2e.py -v
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from fastapi.testclient import TestClient

from mate_tech_ont.main import app, on_startup, on_shutdown
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat


@pytest.fixture(scope="module", autouse=True)
def _init_kernel_repo():
    """Module-level fixture: 注入 InMemory repo + run startup hooks."""
    app.state.kernel_repo = InMemoryOntologyRepository()
    # fake ctx 跳过 install_auth 中间件：测试直接覆盖到 endpoint
    yield
    app.state.kernel_repo = None


@pytest.fixture
def client_with_ctx(monkeypatch):
    """构造 TestClient + 注入 fake RequestContext（绕过 AuthMiddleware JWT）。"""
    # fake auth: middleware 需要 ctx，我们手填；client.headers 加 tenant header
    from mate_platform.auth import middleware as auth_mw
    from mate_platform.tenancy.context import AuthMethod, RequestContext, TenantId, UserId

    # monkeypatch middleware 跳过签名校验：直接把 ctx 注入 request.state
    original_dispatch = auth_mw.AuthMiddleware.dispatch

    async def fake_dispatch(self, request, call_next):
        # 任何请求默认注入 acme/tenant 的 ctx
        request.state.ctx = RequestContext(
            request_id="test-req",
            trace_id="test-trace",
            tenant_id=TenantId("acme"),
            user_id=UserId("alice"),
            roles=frozenset({"editor"}),
            permissions=frozenset({"ont.read", "ont.write"}),
            scopes=frozenset({"platform.read", "platform.write"}),
            auth_method=AuthMethod.USER,
        )
        return await call_next(request)

    monkeypatch.setattr(auth_mw.AuthMiddleware, "dispatch", fake_dispatch)
    return TestClient(app)


# ─────────────────── 1) ObjectType CRUD ───────────────────


class TestObjectTypeE2E:
    def test_upsert_and_list(self, client_with_ctx):
        c = client_with_ctx
        ot = {
            "rid": "ont.acme.obj.po.v1",
            "primary_key": ["ont.acme.prop.po-id.v1"],
            "properties": [
                {
                    "rid": "ont.acme.prop.po-id.v1",
                    "type_id": "string", "nullable": False,
                    "primary_key": True, "title": "id",
                    "format": "string",
                },
                {
                    "rid": "ont.acme.prop.po-qty.v1",
                    "type_id": "integer", "nullable": False,
                    "primary_key": False, "title": "qty",
                    "format": "integer",
                },
            ],
            "display_name": "PO",
        }
        r = c.post("/api/v1/ont/v2/object-types", json=ot)
        assert r.status_code == 200, r.text
        assert r.json()["rid"] == "ont.acme.obj.po.v1"

        r2 = c.get("/api/v1/ont/v2/object-types")
        assert r2.status_code == 200
        ids = {x["rid"] for x in r2.json()}
        assert "ont.acme.obj.po.v1" in ids


# ─────────────────── 2) Individual CRUD ───────────────────


class TestIndividualE2E:
    def _seed_ot(self, c):
        ot = {
            "rid": "ont.acme.obj.order.v1",
            "primary_key": ["ont.acme.prop.order-id.v1"],
            "properties": [
                {
                    "rid": "ont.acme.prop.order-id.v1",
                    "type_id": "string", "nullable": False,
                    "primary_key": True, "title": "id",
                    "format": "string",
                },
            ],
        }
        c.post("/api/v1/ont/v2/object-types", json=ot)

    def test_create_and_list(self, client_with_ctx):
        c = client_with_ctx
        self._seed_ot(c)
        ind = {
            "rid": "ont.acme.ind.order.1",
            "class_rid": "ont.acme.obj.order.v1",
            "props": {
                "ont.acme.prop.order-id.v1": {"value": "ORD-1"},
            },
            "primary_key": "ORD-1",
            "marking": [],
        }
        r = c.post("/api/v1/ont/v2/individuals", json=ind)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["primary_key"] == "ORD-1"
        assert body["tenant_id"] == "acme"

        r2 = c.get(
            "/api/v1/ont/v2/individuals",
            params={"class_rid": "ont.acme.obj.order.v1"},
        )
        assert r2.status_code == 200
        pks = {x["primary_key"] for x in r2.json()}
        assert "ORD-1" in pks

    def test_cross_tenant_rid_prefix_rejected(self, client_with_ctx):
        c = client_with_ctx
        ind = {
            "rid": "ont.bob.ind.order.1",
            "class_rid": "ont.bob.obj.order.v1",
            "props": {"x": {"value": 1}},
            "primary_key": "1",
        }
        r = c.post("/api/v1/ont/v2/individuals", json=ind)
        assert r.status_code == 403


# ─────────────────── 3) ObjectSet evaluate ───────────────────


class TestObjectSetEvaluateE2E:
    def _seed(self, c):
        ot = {
            "rid": "ont.acme.obj.po.v1",
            "primary_key": ["ont.acme.prop.po-id.v1"],
            "properties": [
                {
                    "rid": "ont.acme.prop.po-id.v1",
                    "type_id": "string", "nullable": False,
                    "primary_key": True, "title": "id",
                    "format": "string",
                },
                {
                    "rid": "ont.acme.prop.po-qty.v1",
                    "type_id": "integer", "nullable": False,
                    "primary_key": False, "title": "qty",
                    "format": "integer",
                },
            ],
        }
        c.post("/api/v1/ont/v2/object-types", json=ot)
        now = datetime.now(timezone.utc)
        repo = app.state.kernel_repo
        cls = ClassRef(rid="ont.acme.obj.po.v1")
        for i, q in enumerate([5, 10, 15, 20, 25]):
            from mate_kernel.ontology.instances import Individual
            repo.create_individual(Individual(
                rid=f"ont.acme.ind.po.{i}", class_rid=cls,
                props=((ClassRef(rid="ont.acme.prop.po-qty.v1"), q),),
                primary_key=str(i), created_at=now, updated_at=now,
                tenant_id="acme",
            ))

    def test_filter_through_endpoint(self, client_with_ctx):
        c = client_with_ctx
        self._seed(c)
        r = c.post("/api/v1/ont/v2/object-sets:evaluate", json={
            "class_rid": "ont.acme.obj.po.v1",
            "filter_expr": "po-qty >= 15",
            "paging_limit": 100,
        })
        assert r.status_code == 200, r.text
        pks = sorted(x["primary_key"] for x in r.json())
        assert pks == ["2", "3", "4"]

    def test_sort_desc(self, client_with_ctx):
        c = client_with_ctx
        self._seed(c)
        r = c.post("/api/v1/ont/v2/object-sets:evaluate", json={
            "class_rid": "ont.acme.obj.po.v1",
            "filter_expr": "po-qty >= 5",
            "sort": ["-po-qty"],
            "paging_limit": 3,
        })
        assert r.status_code == 200
        pks = [x["primary_key"] for x in r.json()]
        assert pks == ["4", "3", "2"]


# ─────────────────── 4) Action apply ───────────────────


class TestActionApplyE2E:
    def _seed(self, c):
        # 注册一个 ActionType
        from mate_kernel.ontology.identity import ClassRef
        from mate_kernel.ontology.types.action_type import ActionType
        repo = app.state.kernel_repo
        prop = Property(
            rid=ClassRef(rid="ont.acme.prop.reason.v1"),
            type_id="string", nullable=False, primary_key=False,
            title="reason", format=PropertyFormat.STRING,
        )
        repo.upsert_action_type(ActionType(
            rid=ClassRef(rid="ont.acme.act.approve.v1"),
            parameters=(prop,),
            submission_criteria=(),
            side_effects=("notify",),
            function_ref=ClassRef(rid="ont.acme.fn.approve.v1"),
            on=(ClassRef(rid="ont.acme.obj.po.v1"),),
        ))

    def test_apply_returns_audit(self, client_with_ctx):
        c = client_with_ctx
        self._seed(c)
        r = c.post("/api/v1/ont/v2/action-types:apply", json={
            "action_rid": "ont.acme.act.approve.v1",
            "target_iid": "ont.acme.ind.po.0",
            "parameters": {"reason": "ok"},
            "provenance": {},
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["audit_id"]
        assert body["side_effects"] == ["notify"]

    def test_apply_unknown_action_404(self, client_with_ctx):
        c = client_with_ctx
        r = c.post("/api/v1/ont/v2/action-types:apply", json={
            "action_rid": "ont.acme.act.unknown.v1",
            "target_iid": "ont.acme.ind.po.0",
            "parameters": {},
        })
        assert r.status_code == 404