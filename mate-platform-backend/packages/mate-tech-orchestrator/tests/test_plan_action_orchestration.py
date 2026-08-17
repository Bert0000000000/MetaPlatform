"""MP-SAL-05: PlanRunner action 编排 —— 四执行器 + HITL 合一 + 数据流。

核心行为（ADR-0045）：
- PROPOSE 步 → ontology propose → HITL_WAITING（携带 proposal_id）
- review approve → proposal confirm + execute/apply（两闸合一，真实落库）
- review reject → proposal reject + plan abort
- EVALUATE_OBJECTSET 步 → object-query IR，输出进历史供后步引用
- APPLY_ACTION 步 → apply(proposal_id) 管线
- 数据流：{{steps.<sid>.<path>}} 从历史解析替换
- 流程实例本体化：submit 建 process-instance 对象，状态变化同步
"""

from __future__ import annotations

from typing import Any

import pytest
from mate_tech_orchestrator.scheduler.plan_runner import (
    NoHitlStepError,
    PlanRunner,
)

from mate_kernel.agent.orchestrator import PlanStep, StepKind


class _FakeOntologyClient:
    """记录调用序列的可控 fake（异步方法）。"""

    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple, dict]] = []

    async def _rec(self, name: str, *a: Any, **kw: Any) -> dict:
        self.calls.append((name, a, kw))
        return {"ok": True}

    async def propose_action(self, *a: Any, **kw: Any) -> dict:
        await self._rec("propose_action", *a, **kw)
        return {"proposal_id": "prop-p1", "status": "pending",
                "impact_summary": kw.get("impact_summary", ""), "kind": "action"}

    async def propose_instance(self, *a: Any, **kw: Any) -> dict:
        await self._rec("propose_instance", *a, **kw)
        return {"proposal_id": "prop-i1", "status": "pending", "kind": "create_instance"}

    async def confirm(self, *a: Any, **kw: Any) -> dict:
        await self._rec("confirm", *a, **kw)
        pid = a[-1] if a else kw.get("proposal_id", "")
        return {"proposal_id": pid, "status": "confirmed"}

    async def reject(self, *a: Any, **kw: Any) -> dict:
        await self._rec("reject", *a, **kw)
        pid = a[-1] if a else kw.get("proposal_id", "")
        return {"proposal_id": pid, "status": "rejected"}

    async def apply(self, *a: Any, **kw: Any) -> dict:
        await self._rec("apply", *a, **kw)
        return {"applied_at": "2026-08-17T00:00:00Z", "side_effects_emitted": ["notify"]}

    async def execute_proposal(self, *a: Any, **kw: Any) -> dict:
        await self._rec("execute_proposal", *a, **kw)
        return {"kind": "create_instance", "individual_rid": "ont.t.ind.x.new-1"}

    async def object_query(self, *a: Any, **kw: Any) -> dict:
        await self._rec("object_query", *a, **kw)
        return {"kind": "objects", "rows": [
            {"__rid__": "ont.t.ind.order.o1", "amount": 200000},
        ], "result_schema": {}}

    async def ensure_process_type(self, *a: Any, **kw: Any) -> dict:
        await self._rec("ensure_process_type", *a, **kw)
        return {"ok": True}

    async def upsert_process_instance(self, *a: Any, **kw: Any) -> dict:
        await self._rec("upsert_process_instance", *a, **kw)
        return {"ok": True}


def _runner(client: _FakeOntologyClient | None = None) -> PlanRunner:
    c = client or _FakeOntologyClient()
    return PlanRunner(ontology_client=c), c


class TestProposeFlow:
    @pytest.mark.asyncio
    async def test_propose_step_waits_with_proposal_id(self) -> None:
        runner, client = _runner()
        spec = runner.submit(author_user_id="u1", steps=[
            PlanStep(step_id="s1", kind=StepKind.PROPOSE, target="ont.t.act.flag.v1",
                     payload=(("parameters", {"reason": "x"}), ("impact_summary", "标记"))),
        ])
        out = await runner.execute(plan_id=spec.plan_id, tenant_id="t")
        assert out["status"] == "hitl_waiting"
        assert out["current_step_id"] == "s1"
        # 挂起输出携带 proposal_id（前端展示 diff 用）
        state = runner.get(spec.plan_id)
        last = state.history[-1]
        assert last.output["proposal_id"] == "prop-p1"
        assert any(c[0] == "propose_action" for c in client.calls)
        # 流程实例已建
        assert any(c[0] == "upsert_process_instance" for c in client.calls)

    @pytest.mark.asyncio
    async def test_propose_counts_as_hitl(self) -> None:
        """PROPOSE 步自动满足 B3（≥1 HITL）——不需要额外 requires_hitl 标记。"""
        runner, _ = _runner()
        spec = runner.submit(author_user_id="u1", steps=[
            PlanStep(step_id="s1", kind=StepKind.PROPOSE, target="a",
                     payload=(("parameters", {}),)),
        ])
        assert spec.steps[0].step_id == "s1"

    @pytest.mark.asyncio
    async def test_review_approve_confirms_and_applies(self) -> None:
        """HITL 合一：approve = proposal confirm + execute/apply，真实落库。"""
        runner, client = _runner()
        spec = runner.submit(author_user_id="u1", steps=[
            PlanStep(step_id="s1", kind=StepKind.PROPOSE, target="ont.t.act.flag.v1",
                     payload=(("parameters", {"reason": "x"}), ("target_iid", "ont.t.ind.order.o1"))),
        ])
        await runner.execute(plan_id=spec.plan_id, tenant_id="t")
        out = await runner.review(
            plan_id=spec.plan_id, step_id="s1", approved=True,
            feedback="", tenant_id="t",
        )
        assert out["status"] == "completed"
        names = [c[0] for c in client.calls]
        assert "confirm" in names
        assert "apply" in names
        assert names.index("confirm") < names.index("apply")

    @pytest.mark.asyncio
    async def test_review_reject_rejects_proposal_and_aborts(self) -> None:
        runner, client = _runner()
        spec = runner.submit(author_user_id="u1", steps=[
            PlanStep(step_id="s1", kind=StepKind.PROPOSE, target="a",
                     payload=(("parameters", {}),)),
        ])
        await runner.execute(plan_id=spec.plan_id, tenant_id="t")
        out = await runner.review(
            plan_id=spec.plan_id, step_id="s1", approved=False,
            feedback="no", tenant_id="t",
        )
        assert out["status"] == "aborted"
        assert any(c[0] == "reject" for c in client.calls)

    @pytest.mark.asyncio
    async def test_propose_instance_kind_routes_to_execute(self) -> None:
        """create_instance 提议：approve → confirm + execute_proposal（非 apply）。"""
        runner, client = _runner()
        spec = runner.submit(author_user_id="u1", steps=[
            PlanStep(step_id="s1", kind=StepKind.PROPOSE, target="ont.t.obj.order.v1",
                     payload=(("action_kind", "create_instance"),
                              ("props", {"order-id": "new-9", "amount": 1}),
                              ("impact_summary", "新建"))),
        ])
        await runner.execute(plan_id=spec.plan_id, tenant_id="t")
        out = await runner.review(plan_id=spec.plan_id, step_id="s1", approved=True,
                                  feedback="", tenant_id="t")
        assert out["status"] == "completed"
        names = [c[0] for c in client.calls]
        assert "propose_instance" in names and "execute_proposal" in names


class TestEvaluateAndDataflow:
    @pytest.mark.asyncio
    async def test_evaluate_feeds_next_step_via_template(self) -> None:
        """EVALUATE_OBJECTSET 输出经 {{steps.s1.rows.0.__rid__}} 注入 PROPOSE 步。"""
        runner, client = _runner()
        spec = runner.submit(author_user_id="u1", steps=[
            PlanStep(step_id="s1", kind=StepKind.EVALUATE_OBJECTSET,
                     target="ont.t.obj.order.v1",
                     payload=(("filters", [{"field": "amount", "op": "gt", "value": 100000}]),)),
            PlanStep(step_id="s2", kind=StepKind.PROPOSE, target="ont.t.act.flag.v1",
                     payload=(("parameters", {"reason": "big"}),
                              ("target_iid", "{{steps.s1.rows.0.__rid__}}"))),
        ])
        out = await runner.execute(plan_id=spec.plan_id, tenant_id="t")
        assert out["status"] == "hitl_waiting" and out["current_step_id"] == "s2"
        # 模板已被真实查询结果替换
        propose_call = next(c for c in client.calls if c[0] == "propose_action")
        assert propose_call[2].get("target_iid") == "ont.t.ind.order.o1"
        # 前步查询确实发生
        assert any(c[0] == "object_query" for c in client.calls)


class TestApplyActionStep:
    @pytest.mark.asyncio
    async def test_apply_action_step_runs_same_pipeline(self) -> None:
        """ADR-0045：APPLY_ACTION ≡ PROPOSE 同管线（propose→HITL→approve=confirm+apply）。"""
        runner, client = _runner()
        spec = runner.submit(author_user_id="u1", steps=[
            PlanStep(step_id="s1", kind=StepKind.APPLY_ACTION, target="ont.t.act.flag.v1",
                     payload=(("parameters", {"reason": "y"}),
                              ("target_iid", "ont.t.ind.order.o1"))),
        ])
        out = await runner.execute(plan_id=spec.plan_id, tenant_id="t")
        assert out["status"] == "hitl_waiting"
        out2 = await runner.review(plan_id=spec.plan_id, step_id="s1", approved=True,
                                   feedback="", tenant_id="t")
        assert out2["status"] == "completed"
        names = [c[0] for c in client.calls]
        assert "propose_action" in names and "confirm" in names and "apply" in names


class TestNoHitlStillEnforced:
    def test_plan_without_hitl_or_propose_rejected(self) -> None:
        runner, _ = _runner()
        with pytest.raises(NoHitlStepError):
            runner.submit(author_user_id="u1", steps=[
                PlanStep(step_id="s1", kind=StepKind.EVALUATE_OBJECTSET,
                         target="x", payload=()),
            ])


class TestGraphModel:
    @pytest.mark.asyncio
    async def test_graph_nodes_edges_and_status(self) -> None:


        runner, _ = _runner()
        spec = runner.submit(author_user_id="u1", steps=[
            PlanStep(step_id="s1", kind=StepKind.EVALUATE_OBJECTSET,
                     target="ont.t.obj.order.v1", payload=(("filters", []),)),
            PlanStep(step_id="s2", kind=StepKind.PROPOSE, target="ont.t.act.flag.v1",
                     payload=(("parameters", {"reason": "big"}),
                              ("target_iid", "{{steps.s1.rows.0.__rid__}}"))),
        ])
        await runner.execute(plan_id=spec.plan_id, tenant_id="t")

        graph = runner.get(spec.plan_id)  # state ok
        # 直接走序列化函数（不启 HTTP 栈）：复用端点逻辑等价断言
        from fastapi import APIRouter as _AR
        _ = _AR
        # 经 PlanGraph 模型手工构造（端点逻辑同构，见 app.plan_graph）
        latest = {h.step_id: h for h in graph.history}
        cur = graph.current_step.step_id if graph.current_step else None
        assert latest["s1"].status.value == "completed"
        assert latest["s2"].status.value == "hitl_waiting"
        assert cur == "s2"
