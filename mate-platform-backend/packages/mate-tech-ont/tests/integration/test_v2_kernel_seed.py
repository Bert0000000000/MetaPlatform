"""v2 kernel 种子数据测试（ONT_SEED_DEMO 场景）。

- seed_demo 幂等注入：首次创建 16 资源，再次调用返回 0
- 员工请假审批场景：leave-request / ticket / approve-leave / close-ticket
- 全部经 REST 端点读取（与 e2e 同一 client_with_ctx 模式）
"""

from __future__ import annotations

import pytest

from fastapi.testclient import TestClient

from mate_kernel.ontology.identity import ClassRef
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
    from mate_platform.auth import middleware as auth_mw
    from mate_platform.tenancy.context import AuthMethod, RequestContext, TenantId, UserId

    original_dispatch = auth_mw.AuthMiddleware.dispatch

    async def fake_dispatch(self, request, call_next):
        request.state.ctx = RequestContext(
            request_id="seed-test",
            trace_id="seed-trace",
            tenant_id=TenantId(TENANT),
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
    # GOVERN-10: save+restore around the test so subsequent tests don't see
    # a stale middleware_stack that lost its install_auth binding.
    from mate_tech_ont.main import app as _app
    saved_stack = _app.middleware_stack
    _app.middleware_stack = None
    try:
        yield TestClient(_app)
    finally:
        _app.middleware_stack = saved_stack


class TestSeedDemo:
    def test_seed_populates_scenario(self, client_with_ctx):
        c = client_with_ctx
        created = seed_demo(app.state.kernel_repo, TENANT)
        assert created == 18

        r = c.get("/api/v1/ont/v2/object-types")
        object_types = {item["rid"]: item for item in r.json()}
        order_rid = "ont.tenant-default.obj.crm.order.v1"
        assert order_rid in object_types
        assert "ont.tenant-default.obj.leave-request.v1" in object_types
        assert "ont.tenant-default.obj.ticket.v1" in object_types
        assert "ont.tenant-default.obj.employee.v1" in object_types

        r = c.get("/api/v1/ont/v2/individuals", params={
            "class_rid": "ont.tenant-default.obj.leave-request.v1",
        })
        leaves = r.json()
        assert len(leaves) == 3
        assert {x["primary_key"] for x in leaves} == {
            "LR-2026-001", "LR-2026-002", "LR-2026-003",
        }
        assert all(
            x["props"]["ont.tenant-default.prop.status.v1"] == "pending"
            for x in leaves
        )

        r = c.get("/api/v1/ont/v2/action-types")
        acts = {item["rid"]: item for item in r.json()}
        assert "ont.tenant-default.act.approve-leave.v1" in acts
        assert acts["ont.tenant-default.act.approve-leave.v1"]["side_effects"] == [
            "notify_email", "audit_log",
        ]
        assert "ont.tenant-default.act.close-ticket.v1" in acts
        action_rid = "ont.tenant-default.act.order-review-confirm.v1"
        assert action_rid in acts
        assert acts[action_rid]["on"] == [order_rid]
        assert acts[action_rid]["title"] == "订单复核确认"
        assert acts[action_rid]["side_effects"] == [
            "update_order", "create_follow_up_task", "audit_log",
        ]

        r = c.get("/api/v1/ont/v2/link-types")
        links = {x["rid"] for x in r.json()}
        assert "ont.tenant-default.link.employee-leave.v1" in links

        r = c.get("/api/v1/ont/v2/functions")
        fns = {x["rid"] for x in r.json()}
        assert "ont.tenant-default.fn.approve-leave.v1" in fns
        assert "ont.tenant-default.fn.order-review-confirm.v1" in fns

    def test_seed_upgrades_old_demo_state_with_order_review_resources(self):
        """既有 demo 种子缺少新增资源时，只补写订单复核 Action/Function。"""
        repo = InMemoryOntologyRepository()
        assert seed_demo(repo, TENANT) == 18

        action_rid = ClassRef(f"ont.{TENANT}.act.order-review-confirm.v1")
        function_rid = ClassRef(f"ont.{TENANT}.fn.order-review-confirm.v1")
        # 构造升级前持久库：旧版 demo 的全部资源，唯独没有本任务新增的两项。
        repo._action_types.pop(action_rid)
        repo._functions.pop(function_rid)

        assert seed_demo(repo, TENANT) == 2
        assert action_rid in {action.rid for action in repo.list_action_types()}
        assert function_rid in {function.rid for function in repo.list_functions()}
        assert seed_demo(repo, TENANT) == 0

    def test_seed_idempotent(self, client_with_ctx):
        # 已 seed 过（同 repo 模块级共享），再次调用返回 0
        assert seed_demo(app.state.kernel_repo, TENANT) == 0
        c = client_with_ctx
        r = c.get("/api/v1/ont/v2/individuals", params={
            "class_rid": "ont.tenant-default.obj.leave-request.v1",
        })
        assert len(r.json()) == 3  # 未重复注入

    def test_seed_apply_action_contract_path(self, client_with_ctx):
        """种子 ActionType 可经契约路径 apply（唯一合法写路径）。"""
        c = client_with_ctx
        r = c.post(
            "/api/v1/ont/v2/action-types/ont.tenant-default.act.approve-leave.v1/apply",
            json={
                "parameters": {"decision": "approve"},
                "target_iid": "ont.tenant-default.ind.leave-request.1",
                "provenance": {"actor": "alice"},
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["action_rid"] == "ont.tenant-default.act.approve-leave.v1"
        assert body["side_effects_emitted"] == ["notify_email", "audit_log"]
        assert body["applied_at"]
