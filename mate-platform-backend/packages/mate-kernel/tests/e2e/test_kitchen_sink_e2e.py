"""端到端验证（mp-ont-bugfix-01 固化版）。

锁定 v3.1 子计划 6 段核心闭环：
  1) ObjectSet DSL filter 通过 InMemoryRepository 真消费（Bug A 回归）
  2) Security + ActionService 跨租户 / Marking 决策 + apply 真调用 function
  3) SuperAI Copilot 完整 HITL 流程（token 校验 / confirm / 审计）
  4) SANDBOX-02 K8s Job（含 ResourceLimits 上下限 Bug C 回归）
  5) AGENT-EXT-01 Marketplace L3 MicroVM 强制（L2 注册被拒）
  6) examples/01_kitchen_sink.py 11 步串联

跑法：
    cd packages/mate-kernel
    PYTHONPATH=src python -m pytest tests/e2e/test_kitchen_sink_e2e.py -v
"""

from __future__ import annotations

import runpy
from datetime import datetime, timezone
from pathlib import Path

import pytest

from mate_kernel.action.engine import ActionService, SubmissionContext
from mate_kernel.agent.copilot import (
    IntentRouter,
    RetentionPolicy,
    SuperAICopilot,
    SuperAICopilotConfig,
)
from mate_kernel.agent.external import (
    Capability,
    ExtAgentManifest,
    ExtAgentRegistry,
    ExtProtocol,
    MockMicroVMRunner,
    SandboxTier,
)
from mate_kernel.agent.orchestrator import AgentRole
from mate_kernel.agent.security import (
    MarkingRequirement,
    SecurityAgent,
    SecurityRequest,
    UserMarkings,
    check_action_apply,
)
from mate_kernel.manager.protocol import Manager, ManagerContext
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.in_memory import InMemoryOntologyRepository
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.query.object_set import ObjectSet
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat
from mate_kernel.sandbox.k8s import (
    JobPhase,
    K8sSandboxRunner,
    K8sSandboxSpec,
    NetworkPolicy,
    ResourceLimits,
)


# ─────────────────── 1) ObjectSet filter 真消费 ───────────────────


class TestObjectSetFilterE2E:
    """Bug A 回归：repo.evaluate_object_set 必须消费 filter_expr。"""

    def _seed(self) -> tuple[InMemoryOntologyRepository, ClassRef]:
        repo = InMemoryOntologyRepository()
        cls = ClassRef(rid="ont.acme.cls.po.v1")
        prop_pk = Property(
            rid=ClassRef(rid="ont.acme.prop.po-id.v1"),
            type_id="string", nullable=False, primary_key=True,
            title="id", format=PropertyFormat.STRING,
        )
        prop_qty = Property(
            rid=ClassRef(rid="ont.acme.prop.po-qty.v1"),
            type_id="integer", nullable=False, primary_key=False,
            title="qty", format=PropertyFormat.INTEGER,
        )
        repo.upsert_object_type(ObjectType(
            rid=cls, primary_key=(prop_pk.rid,),
            properties=(prop_pk, prop_qty), display_name="PO",
        ))
        now = datetime.now(timezone.utc)
        for i, q in enumerate([5, 10, 15, 20, 25]):
            repo.create_individual(Individual(
                rid=f"ont.acme.ind.po.{i}", class_rid=cls,
                props=((prop_qty.rid, q),), primary_key=str(i),
                created_at=now, updated_at=now, tenant_id="acme",
            ))
        return repo, cls

    def test_range_filter_through_repo(self) -> None:
        repo, cls = self._seed()
        res = repo.evaluate_object_set(ObjectSet(
            class_rid=cls, filter_expr="po-qty >= 15",
        ))
        assert {i.primary_key for i in res} == {"2", "3", "4"}

    def test_compound_and_through_repo(self) -> None:
        repo, cls = self._seed()
        res = repo.evaluate_object_set(ObjectSet(
            class_rid=cls, filter_expr="po-qty >= 10 AND po-qty < 25",
        ))
        assert {i.primary_key for i in res} == {"1", "2", "3"}

    def test_sort_and_paging(self) -> None:
        repo, cls = self._seed()
        res = repo.evaluate_object_set(ObjectSet(
            class_rid=cls, filter_expr="po-qty >= 5",
            sort=("-po-qty",), paging_limit=3, paging_offset=0,
        ))
        assert [i.primary_key for i in res] == ["4", "3", "2"]


# ─────────────────── 2) Security + Action 闭环 ───────────────────


class TestSecurityActionE2E:
    def _ctx(self) -> ManagerContext:
        return ManagerContext(user_id="alice", tenant_id="acme", session_id="s1")

    def test_same_tenant_allow_apply(self) -> None:
        ctx = self._ctx()
        sec = SecurityAgent()
        audit_log: list[dict] = []
        svc = ActionService()
        svc.register_function(
            "ont.acme.act.approve",
            lambda _t, p: audit_log.append(p) or "ok",
        )

        d = check_action_apply(sec, ctx, target_tenant="acme",
                               target_rid="ont.acme.act.approve")
        assert d.decision.value == "allow"

        outcome = svc.apply(
            action_rid="ont.acme.act.approve", submission_criteria=(),
            function_ref="ont.acme.act.approve", on_rid="ont.acme.obj.po",
            target_iid="ont.acme.ind.po.0", parameters={"who": "alice"},
            side_effects=("notify",), ctx=SubmissionContext(
                actor="alice", sandbox_id="sb-1", tenant_id="acme",
            ),
        )
        assert outcome.audit_id
        assert outcome.side_effects_emitted == ["notify"]
        assert audit_log == [{"who": "alice"}]

    def test_cross_tenant_deny(self) -> None:
        ctx = self._ctx()
        sec = SecurityAgent()
        d = check_action_apply(sec, ctx, target_tenant="evil",
                               target_rid="ont.acme.act.approve")
        assert d.decision.value == "deny"
        assert d.rule_id == "R-TENANT-001"

    def test_marking_missing_deny(self) -> None:
        sec = SecurityAgent()
        d = sec.decide(SecurityRequest(
            requester=UserMarkings(user_id="alice", tenant_id="acme"),
            target_tenant="acme",
            required=MarkingRequirement(required_markings=("confidential",)),
            resource_rid="ont.acme.act.approve",
        ))
        assert d.decision.value == "deny"
        assert d.rule_id == "R-MARK-001"


# ─────────────────── 3) SuperAI Copilot HITL ───────────────────


class TestSuperAIHITLE2E:
    def _ctx(self) -> ManagerContext:
        return ManagerContext(user_id="alice", tenant_id="acme", session_id="s1")

    def test_submit_confirm_full_flow(self) -> None:
        ctx = self._ctx()
        mgr = Manager(ctx)
        cop = SuperAICopilot(
            config=SuperAICopilotConfig(retention=RetentionPolicy.PERSIST_7D),
        )

        state, token = cop.submit_query("查找订单 wiki", ctx, mgr)
        assert token.is_valid()
        assert state.current_step is not None
        assert state.current_step.requires_hitl

        # 错 token → PermissionError
        with pytest.raises(PermissionError):
            cop.confirm_step(state.plan.plan_id, "1", "bogus", ctx, mgr)

        # 对 token → confirm step 1，后续 APPLY_ACTION step 自动跑完
        s2 = cop.confirm_step(state.plan.plan_id, "1", token.token, ctx, mgr)
        assert s2.current_step_idx >= 1
        assert s2.aborted is False
        recs = cop.audit.all_records()
        assert len(recs) == 1
        assert recs[0].final_state == "completed"

    def test_intent_router_routes_known_roles(self) -> None:
        r = IntentRouter()
        assert r.route("查看订单对象") == AgentRole.ONTOLOGY
        assert r.route("发起一个审批流程") == AgentRole.WORKFLOW
        assert r.route("查找 wiki 文档") == AgentRole.KNOWLEDGE


# ─────────────────── 4) SANDBOX-02 K8s Job ───────────────────


class TestK8sSandboxE2E:
    def test_handler_executes(self) -> None:
        runner = K8sSandboxRunner()
        result = runner.submit(K8sSandboxSpec(
            function_ref="ont.acme.fn.calc.v1",
            function_source="def handler(x):\n    return x * 2\n",
            arguments=(21,),
            resource_limits=ResourceLimits(),
            network_policy=NetworkPolicy(),
        ))
        assert result.phase == JobPhase.SUCCEEDED
        assert result.exit_code == 0
        # Subprocess executor prints with possible whitespace; check content
        assert "42" in result.stdout

    def test_network_policy_default_deny(self) -> None:
        np = NetworkPolicy()
        assert np.egress_allow_cidrs == ()
        assert np.ingress_allowed is False

    def test_resource_limits_bounds_bug_c(self) -> None:
        with pytest.raises(ValueError, match="cpu_millicores"):
            ResourceLimits(cpu_millicores=200_000)
        with pytest.raises(ValueError, match="memory_mb"):
            ResourceLimits(memory_mb=999_999)
        with pytest.raises(ValueError, match="timeout_seconds"):
            ResourceLimits(timeout_seconds=86_400)
        with pytest.raises(ValueError, match="cpu_millicores"):
            ResourceLimits(cpu_millicores=0)

    def test_failing_handler_returns_nonzero(self) -> None:
        runner = K8sSandboxRunner()
        r = runner.submit(K8sSandboxSpec(
            function_ref="ont.acme.fn.bad.v1",
            function_source="def handler():\n    return 1/0\n",
            arguments=(),
            resource_limits=ResourceLimits(),
            network_policy=NetworkPolicy(),
        ))
        assert r.phase == JobPhase.FAILED
        assert r.exit_code != 0


# ─────────────────── 5) External Agent L3 ───────────────────


class TestExternalAgentE2E:
    def test_l3_invoke_ok(self) -> None:
        runner = MockMicroVMRunner()
        runner.register("echo", lambda p: f"echoed: {p['msg']}")
        reg = ExtAgentRegistry(runner=runner)
        reg.register(ExtAgentManifest(
            agent_rid="ext.acme.agent.echo.v1",
            name="Echo", vendor="mkt",
            protocol=ExtProtocol.HTTP,
            endpoint="http://mkt.example.com/echo",
            capabilities=(Capability(name="echo", description="echo"),),
            sandbox=SandboxTier.L3_MICROVM,
        ))
        inv = reg.invoke("ext.acme.agent.echo.v1", "echo", {"msg": "hi"})
        assert inv.status == "ok"
        assert inv.sandbox_id is not None
        assert inv.output == "echoed: hi"

    def test_l2_register_rejected(self) -> None:
        reg = ExtAgentRegistry(runner=MockMicroVMRunner())
        with pytest.raises(ValueError, match="L3"):
            reg.register(ExtAgentManifest(
                agent_rid="ext.acme.agent.bad.v1",
                name="Bad", vendor="mkt",
                protocol=ExtProtocol.HTTP, endpoint="http://x",
                capabilities=(Capability(name="x", description="x"),),
                sandbox=SandboxTier.L2_CONTAINER,
            ))


# ─────────────────── 6) Kitchen sink 端到端 ───────────────────


class TestKitchenSinkE2E:
    """examples/01_kitchen_sink.py 必须 11 步全过。"""

    def test_main_runs_clean(self, capsys: pytest.CaptureFixture[str]) -> None:
        example = (
            Path(__file__).resolve().parents[2] / "examples" / "01_kitchen_sink.py"
        )
        # runpy 把 stdout 灌到 capsys（不灌，因为 pytest 默认捕获）
        runpy.run_path(str(example), run_name="__main__")
        out = capsys.readouterr().out
        assert "全部 12 步通过" in out
        assert "Manager drained" in out