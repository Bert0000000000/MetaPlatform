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
    # BaseHTTPMiddleware binds self.dispatch_func at construction time and the
    # app caches the middleware stack on first request — reset the stack so the
    # patched dispatch is picked up even when a previous test module built it.
    app.middleware_stack = None
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
        # apply 语义（ACTION-03）：目标 individual 必须存在
        now = datetime.now(timezone.utc)
        from mate_kernel.ontology.instances import Individual
        repo.create_individual(Individual(
            rid="ont.acme.ind.po.0", class_rid=ClassRef(rid="ont.acme.obj.po.v1"),
            props=((ClassRef(rid="ont.acme.prop.po-qty.v1"), 5),),
            primary_key="0", created_at=now, updated_at=now,
            tenant_id="acme",
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
        assert body["action_rid"] == "ont.acme.act.approve.v1"
        assert body["side_effects_emitted"] == ["notify"]

    def test_apply_unknown_action_404(self, client_with_ctx):
        c = client_with_ctx
        r = c.post("/api/v1/ont/v2/action-types:apply", json={
            "action_rid": "ont.acme.act.unknown.v1",
            "target_iid": "ont.acme.ind.po.0",
            "parameters": {},
        })
        assert r.status_code == 404

    def test_apply_contract_path(self, client_with_ctx):
        """契约路径 /action-types/{rid}/apply —— rid 在 path，body 只有 parameters。"""
        c = client_with_ctx
        self._seed(c)
        r = c.post(
            "/api/v1/ont/v2/action-types/ont.acme.act.approve.v1/apply",
            json={
                "parameters": {"reason": "ok"},
                "target_iid": "ont.acme.ind.po.0",
                "provenance": {"actor": "alice"},
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["action_rid"] == "ont.acme.act.approve.v1"
        assert body["side_effects_emitted"] == ["notify"]
        assert body["applied_at"]

    def test_apply_contract_path_cross_tenant_403(self, client_with_ctx):
        c = client_with_ctx
        r = c.post(
            "/api/v1/ont/v2/action-types/ont.bob.act.approve.v1/apply",
            json={"parameters": {}},
        )
        assert r.status_code == 403


# ─────────────────── 5) ActionType CRUD（契约补齐） ───────────────────


class TestActionTypeCrudE2E:
    def test_upsert_list_get(self, client_with_ctx):
        c = client_with_ctx
        at = {
            "rid": "ont.acme.act.approve-leave.v1",
            "parameters": [
                {"rid": "ont.acme.prop.decision.v1", "type_id": "string",
                 "nullable": False, "primary_key": False, "title": "decision",
                 "format": "string"},
            ],
            "submission_criteria": ["decision in (approve, reject)"],
            "side_effects": ["notify_email", "audit_log"],
            "function_ref": "ont.acme.fn.approve-leave.v1",
            "on": ["ont.acme.obj.leave-request.v1"],
        }
        r = c.post("/api/v1/ont/v2/action-types", json=at)
        assert r.status_code == 200, r.text
        assert r.json()["rid"] == "ont.acme.act.approve-leave.v1"
        assert r.json()["side_effects"] == ["notify_email", "audit_log"]

        r2 = c.get("/api/v1/ont/v2/action-types")
        assert r2.status_code == 200
        rids = {x["rid"] for x in r2.json()}
        assert "ont.acme.act.approve-leave.v1" in rids

        r3 = c.get("/api/v1/ont/v2/action-types/ont.acme.act.approve-leave.v1")
        assert r3.status_code == 200
        assert r3.json()["function_ref"] == "ont.acme.fn.approve-leave.v1"

    def test_cross_tenant_403(self, client_with_ctx):
        c = client_with_ctx
        r = c.post("/api/v1/ont/v2/action-types", json={
            "rid": "ont.bob.act.approve-leave.v1",
            "function_ref": "ont.bob.fn.approve-leave.v1",
        })
        assert r.status_code == 403


# ─────────────────── 6) LinkType / Interface CRUD ───────────────────


class TestLinkTypeInterfaceE2E:
    def test_link_type_upsert_list_get(self, client_with_ctx):
        c = client_with_ctx
        lt = {
            "rid": "ont.acme.link.employee-leave.v1",
            "src": "ont.acme.obj.employee.v1",
            "dst": "ont.acme.obj.leave-request.v1",
            "cardinality": "1:N",
            "directionality": "directed",
            "link_properties": [],
        }
        r = c.post("/api/v1/ont/v2/link-types", json=lt)
        assert r.status_code == 200, r.text
        assert r.json()["cardinality"] == "1:N"

        r2 = c.get("/api/v1/ont/v2/link-types")
        assert r2.status_code == 200
        assert "ont.acme.link.employee-leave.v1" in {x["rid"] for x in r2.json()}

        r3 = c.get("/api/v1/ont/v2/link-types/ont.acme.link.employee-leave.v1")
        assert r3.status_code == 200

    def test_interface_upsert_list(self, client_with_ctx):
        c = client_with_ctx
        i = {
            "rid": "ont.acme.if.has-owner.v1",
            "properties": [
                {"rid": "ont.acme.prop.owner.v1", "type_id": "string",
                 "nullable": False, "primary_key": False, "title": "owner",
                 "format": "string"},
            ],
            "required_links": [],
            "polymorphic_action_constraints": [],
        }
        r = c.post("/api/v1/ont/v2/interfaces", json=i)
        assert r.status_code == 200, r.text
        assert r.json()["rid"] == "ont.acme.if.has-owner.v1"

        r2 = c.get("/api/v1/ont/v2/interfaces")
        assert r2.status_code == 200
        assert "ont.acme.if.has-owner.v1" in {x["rid"] for x in r2.json()}


# ─────────────────── 7) Individual by rid ───────────────────


class TestIndividualGetE2E:
    def test_get_by_rid(self, client_with_ctx):
        c = client_with_ctx
        ot = {
            "rid": "ont.acme.obj.leave-request.v1",
            "primary_key": ["ont.acme.prop.leave-id.v1"],
            "properties": [
                {"rid": "ont.acme.prop.leave-id.v1", "type_id": "string",
                 "nullable": False, "primary_key": True, "title": "leave id",
                 "format": "string"},
            ],
        }
        c.post("/api/v1/ont/v2/object-types", json=ot)
        c.post("/api/v1/ont/v2/individuals", json={
            "rid": "ont.acme.ind.leave-request.1",
            "class_rid": "ont.acme.obj.leave-request.v1",
            "props": {"ont.acme.prop.leave-id.v1": {"value": "L-1"}},
            "primary_key": "L-1",
        })
        r = c.get("/api/v1/ont/v2/individuals/ont.acme.ind.leave-request.1")
        assert r.status_code == 200, r.text
        assert r.json()["primary_key"] == "L-1"
        assert r.json()["tenant_id"] == "acme"

    def test_get_unknown_404(self, client_with_ctx):
        c = client_with_ctx
        r = c.get("/api/v1/ont/v2/individuals/ont.acme.ind.nope.1")
        assert r.status_code == 404


# ─────────────────── 8) Axiom / Function CRUD ───────────────────


class TestAxiomFunctionE2E:
    def test_axiom_upsert_list(self, client_with_ctx):
        c = client_with_ctx
        ax = {
            "rid": "ont.acme.ax.employee-is-person.v1",
            "kind": "subclass",
            "operands": ["ont.acme.obj.employee.v1", "ont.acme.obj.person.v1"],
            "rule_ref": "r1",
            "metadata": [["weight", "1.0"]],
        }
        r = c.post("/api/v1/ont/v2/axioms", json=ax)
        assert r.status_code == 200, r.text
        assert r.json()["kind"] == "subclass"

        r2 = c.get("/api/v1/ont/v2/axioms")
        assert r2.status_code == 200
        assert "ont.acme.ax.employee-is-person.v1" in {x["rid"] for x in r2.json()}

    def test_function_upsert_list(self, client_with_ctx):
        c = client_with_ctx
        fn = {
            "rid": "ont.acme.fn.approve-leave.v1",
            "language": "python",
            "version": 1,
            "source_ref": "ref://approve_leave",
            "signatures": [["decision", "string"]],
        }
        r = c.post("/api/v1/ont/v2/functions", json=fn)
        assert r.status_code == 200, r.text
        assert r.json()["language"] == "python"

        r2 = c.get("/api/v1/ont/v2/functions")
        assert r2.status_code == 200
        assert "ont.acme.fn.approve-leave.v1" in {x["rid"] for x in r2.json()}


# ─────────────────── 9) ObjectSet query（契约路径） ───────────────────


class TestObjectSetQueryE2E:
    CLS = "ont.acme.obj.query-target.v1"

    def _seed(self, c):
        ot = {
            "rid": self.CLS,
            "primary_key": ["ont.acme.prop.q-target-id.v1"],
            "properties": [
                {"rid": "ont.acme.prop.q-target-id.v1", "type_id": "string",
                 "nullable": False, "primary_key": True, "title": "id",
                 "format": "string"},
                {"rid": "ont.acme.prop.q-target-qty.v1", "type_id": "integer",
                 "nullable": False, "primary_key": False, "title": "qty",
                 "format": "integer"},
            ],
        }
        c.post("/api/v1/ont/v2/object-types", json=ot)
        now = datetime.now(timezone.utc)
        repo = app.state.kernel_repo
        cls = ClassRef(rid=self.CLS)
        for i, q in enumerate([5, 10, 15]):
            from mate_kernel.ontology.instances import Individual
            repo.create_individual(Individual(
                rid=f"ont.acme.ind.query-target.{i}", class_rid=cls,
                props=((ClassRef(rid="ont.acme.prop.q-target-qty.v1"), q),),
                primary_key=str(i), created_at=now, updated_at=now,
                tenant_id="acme",
            ))

    def test_query_returns_results_and_count(self, client_with_ctx):
        c = client_with_ctx
        self._seed(c)
        r = c.post("/api/v1/ont/v2/object-sets/query", json={
            "class_rid": self.CLS,
            "filter_expr": "q-target-qty >= 10",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["count"] == 2
        assert {x["primary_key"] for x in body["results"]} == {"1", "2"}


# ─────────────────── 10) Version snapshot ───────────────────


class TestVersionE2E:
    def test_snapshot_and_list(self, client_with_ctx):
        c = client_with_ctx
        ot = {
            "rid": "ont.acme.obj.po.v1",
            "primary_key": ["ont.acme.prop.po-id.v1"],
            "properties": [
                {"rid": "ont.acme.prop.po-id.v1", "type_id": "string",
                 "nullable": False, "primary_key": True, "title": "id",
                 "format": "string"},
            ],
        }
        c.post("/api/v1/ont/v2/object-types", json=ot)
        r = c.post(
            "/api/v1/ont/v2/versions/ont.acme.obj.po.v1",
            json={"class_ref": "ont.acme.obj.po.v1", "author": "alice",
                  "change_set": ["add leave-request"]},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["class_ref"] == "ont.acme.obj.po.v1"
        assert body["author"] == "alice"

        r2 = c.get("/api/v1/ont/v2/versions/ont.acme.obj.po.v1")
        assert r2.status_code == 200
        assert any(v["author"] == "alice" for v in r2.json())