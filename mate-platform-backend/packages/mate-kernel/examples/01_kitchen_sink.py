"""examples/01_kitchen_sink.py —— 端到端串联 7+1 数字员工 + 沙箱 + 编排平面。

场景：
1. 导入一个简单 Order ObjectType + 3 个 Individual
2. Ontology 员工：用户问"open 状态的订单" → ObjectSet
3. Security 员工：跨租户 / Marking 校验
4. Data Product 员工：注册一份订单汇总（含 quality），跑质量告警
5. OBS 员工：定义一条告警，注入 metric → 触发 ActionType.apply 自愈
6. KB 员工：链接一份订单处理 wiki，联合 RAG-ONT-01 检索
7. App 员工：用 build_crud_app 生成 3 页
8. Workflow 员工：定义 approve 流程，HITL 暂停后 abort
9. Action 员工：发起 approve（通过 submission_criteria）
10. External Agent：Marketplace L3 调用
11. SuperAI Copilot：用户问"审批订单"，IntentRouter 路由到 WORKFLOW → 提交 plan → HITL token

运行：
    cd packages/mate-kernel
    PYTHONPATH=src python examples/01_kitchen_sink.py
"""

from __future__ import annotations

from datetime import datetime, timezone

from mate_kernel.action.engine import ActionService, SubmissionContext
from mate_kernel.agent.app import build_crud_app
from mate_kernel.agent.copilot import (
    IntentRouter,
    RetentionPolicy,
    SuperAICopilot,
    SuperAICopilotConfig,
)
from mate_kernel.agent.data_product import (
    DataProduct,
    DataProductAgent,
    DataProductKind,
    QualityDimension,
    QualitySummary,
)
from mate_kernel.agent.external import (
    Capability,
    ExtAgentManifest,
    ExtAgentRegistry,
    ExtProtocol,
    MockMicroVMRunner,
    SandboxTier,
)
from mate_kernel.agent.kb import KbDocument, KnowledgeLibraryAgent
from mate_kernel.agent.obs import (
    AlertRule,
    AlertSeverity,
    Comparator,
    ObservabilityAgent,
)
from mate_kernel.agent.ontology import OntologyAgent, OntologyAgentRequest
from mate_kernel.agent.security import (
    MarkingRequirement,
    SecurityAgent,
    SecurityRequest,
    UserMarkings,
    check_action_apply,
)
from mate_kernel.agent.workflow import FlowDefinition, FlowNode, NodeKind, WorkflowAgent
from mate_kernel.manager.protocol import Manager, ManagerContext
from mate_kernel.ontology.identity.class_ref import ClassRef
from mate_kernel.ontology.instances.individual import Individual
from mate_kernel.ontology.query.object_set import ObjectSet
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat
from mate_kernel.rag.ontology import RagIndex, RagQuery


def banner(s: str) -> None:
    print(f"\n=== {s} ===")


def main() -> None:
    tenant = "acme"
    user = "alice"
    ctx = ManagerContext(user_id=user, tenant_id=tenant, session_id="s-demo")
    mgr = Manager(ctx)

    # ───── 1) Ontology: 注册 Order ObjectType + 3 个 Individual ─────
    banner("1. Ontology 注册 Order")
    cls_order = ClassRef(rid=f"ont.{tenant}.cls.order.v1")

    prop_status = Property(
        rid=ClassRef(rid=f"ont.{tenant}.prop.status.v1"),
        type_id="string",
        nullable=False,
        primary_key=False,
        title="status",
        format=PropertyFormat.STRING,
    )
    prop_amount = Property(
        rid=ClassRef(rid=f"ont.{tenant}.prop.amount.v1"),
        type_id="double",
        nullable=False,
        primary_key=False,
        title="amount",
        format=PropertyFormat.DOUBLE,
    )
    prop_priority = Property(
        rid=ClassRef(rid=f"ont.{tenant}.prop.priority.v1"),
        type_id="string",
        nullable=False,
        primary_key=False,
        title="priority",
        format=PropertyFormat.STRING,
    )
    prop_pk = Property(
        rid=ClassRef(rid=f"ont.{tenant}.prop.order-id.v1"),
        type_id="string",
        nullable=False,
        primary_key=True,
        title="order_id",
        format=PropertyFormat.STRING,
    )
    ot_order = ObjectType(
        rid=cls_order,
        primary_key=(prop_pk.rid,),
        properties=(prop_pk, prop_status, prop_amount, prop_priority),
        display_name="Order",
    )
    print(f"  ObjectType: {ot_order.rid.rid}")
    print(f"  Properties: {[p.title for p in ot_order.properties]}")

    def _ind(pk: str, status: str, amount: float, priority: str) -> Individual:
        return Individual(
            rid=f"ont.{tenant}.ind.order.{pk}",
            class_rid=cls_order,
            props=(
                (prop_status.rid, status),
                (prop_amount.rid, amount),
                (prop_priority.rid, priority),
            ),
            primary_key=pk,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            tenant_id=tenant,
        )
    inds = [
        _ind("1", "open", 2000.0, "rush"),
        _ind("2", "closed", 100.0, "normal"),
        _ind("3", "open", 50.0, "normal"),
    ]
    print(f"  Individuals: {[i.primary_key for i in inds]}")

    # ───── 2) Ontology 员工：自然语言 → ObjectSet ─────
    banner("2. Ontology 员工：自然语言查询")
    onto = OntologyAgent()
    resp = onto.handle(
        OntologyAgentRequest(user_query="状态=open 金额>100"),
        mgr,
        default_class=cls_order,
    )
    print(f"  filter: {resp.proposed_object_set.filter_expr}")
    print(f"  confidence: {resp.confidence}")
    print(f"  explanation: {resp.explanation[:80]}...")

    # ───── 3) Security 员工：跨租户 + Marking ─────
    banner("3. Security 员工：决策")
    sec = SecurityAgent()
    d1 = sec.decide(SecurityRequest(
        requester=UserMarkings(user_id=user, tenant_id=tenant, markings=("confidential",)),
        target_tenant=tenant,
        required=MarkingRequirement(required_markings=("confidential",)),
        resource_rid=f"ont.{tenant}.act.approve",
    ))
    print(f"  same-tenant + marking OK: {d1.decision.value} ({d1.rule_id})")
    d2 = sec.decide(SecurityRequest(
        requester=UserMarkings(user_id=user, tenant_id=tenant),
        target_tenant="evil",
        required=MarkingRequirement(()),
        resource_rid=f"ont.{tenant}.act.approve",
    ))
    print(f"  cross-tenant: {d2.decision.value} ({d2.rule_id})")

    # ───── 4) Data Product 员工 ─────
    banner("4. Data Product 员工")
    dp = DataProductAgent()
    dp.register(DataProduct(
        product_rid=f"data.{tenant}.product.order-summary.v1",
        name="Order Summary",
        kind=DataProductKind.MATERIALIZED_VIEW,
        bound_class_rid=cls_order,
        source_uri="pg://dw/order_summary",
        quality=(
            QualitySummary(dimension=QualityDimension.COMPLETENESS, value=0.99),
            QualitySummary(dimension=QualityDimension.FRESHNESS_SECONDS, value=60.0),
        ),
    ), mgr)
    products = dp.for_class(cls_order)
    print(f"  bound to Order: {[p.product_rid for p in products]}")
    print(f"  alerts (default thresholds): {len(dp.quality_alerts())}")

    # ───── 5) OBS 员工：告警 + 触发 ActionType ─────
    banner("5. OBS 员工：触发自愈")
    obs = ObservabilityAgent()
    rule = AlertRule(
        rule_rid=f"obs.{tenant}.alert.order-backlog.v1",
        name="Order Backlog",
        metric_name="order.backlog.count",
        comparator=Comparator.GT,
        threshold=100.0,
        severity=AlertSeverity.CRITICAL,
        action_rid=f"ont.{tenant}.act.scale_up",
    )
    obs.register_rule(rule, mgr)
    events = obs.evaluate("order.backlog.count", 150.0)
    print(f"  fired events: {len(events)}")
    print(f"  severity: {events[0].severity.value}")
    n = obs.resolve_all("order.backlog.count")
    print(f"  resolved: {n}")

    # ───── 6) KB + RAG：联合检索 ─────
    banner("6. KB + RAG：联合检索")
    kb = KnowledgeLibraryAgent(rag=RagIndex())
    kb.add_document(KbDocument(
        doc_rid=f"kb.{tenant}.doc.order-policy.v1",
        title="Order Policy",
        body_markdown="rush order 优先级最高，需 24h 内处理",
        linked_class_rids=(cls_order.rid,),
    ), mgr)
    kb.rag.add_individual(inds[0])
    rag_hits, kb_hits = kb.combined_retrieve(
        rag_query=RagQuery(
            object_set=ObjectSet(class_rid=cls_order, filter_expr=""),
            text="rush",
            top_k=3,
        ),
        kb_query="rush order",
    )
    print(f"  RAG hits: {len(rag_hits)}")
    print(f"  KB hits: {len(kb_hits)}, via_class={kb_hits[0].matched_via_class if kb_hits else None}")

    # ───── 7) App 员工：CRUD 生成器 ─────
    banner("7. App 员工：CRUD 三页")
    app = build_crud_app(
        app_rid=f"app.{tenant}.app.order.v1",
        bound_class=cls_order,
        list_title="Order",
        action_rids=(f"ont.{tenant}.act.approve", f"ont.{tenant}.act.cancel"),
    )
    print(f"  pages: {[p.kind.value for p in app.pages]}")

    # ───── 8) Workflow 员工 ─────
    banner("8. Workflow 员工")
    action_svc = ActionService()
    action_svc.register_function(f"ont.{tenant}.act.approve", lambda t, p: "approved")
    wa = WorkflowAgent(action_svc)
    flow = FlowDefinition(
        flow_rid=f"wfe.{tenant}.flow.order-approve.v1",
        nodes=(
            FlowNode(node_id="s", kind=NodeKind.START, next="a"),
            FlowNode(node_id="a", kind=NodeKind.ACTION,
                     action_rid=f"ont.{tenant}.act.approve", next="w"),
            FlowNode(node_id="w", kind=NodeKind.WAIT_USER),
        ),
        start_node_id="s",
    )
    state = wa.start(flow, ctx, mgr, initial_parameters={"a": {"approver": "alice"}})
    print(f"  status: {state.status.value}")
    wa.abort(flow.flow_rid, ctx, reason="user cancel")
    print(f"  after abort: {wa.get_state(flow.flow_rid, ctx).status.value}")

    # ───── 9) Action 员工：apply ─────
    banner("9. Action 员工：apply")
    action_svc.register_function(f"ont.{tenant}.act.cancel", lambda t, p: "cancelled")
    ctx_sub = SubmissionContext(actor=user, sandbox_id="demo", tenant_id=tenant)
    sec_d = check_action_apply(
        sec, ctx, target_tenant=tenant, target_rid=f"ont.{tenant}.act.cancel",
    )
    print(f"  Security: {sec_d.decision.value}")
    if sec_d.decision.value == "allow":
        outcome = action_svc.apply(
            action_rid=f"ont.{tenant}.act.cancel",
            submission_criteria=(),
            function_ref=f"ont.{tenant}.act.cancel",
            on_rid=f"ont.{tenant}.obj.order",
            target_iid=f"ont.{tenant}.ind.order.1",
            parameters={"reason": "demo"},
            side_effects=("notify_user",),
            ctx=ctx_sub,
        )
        print(f"  applied: audit_id={outcome.audit_id}")

    # ───── 10) External Agent ─────
    banner("10. External Agent：Marketplace L3")
    reg = ExtAgentRegistry(runner=MockMicroVMRunner())
    reg.runner.register("translate", lambda p: f"translated: {p['text']}")
    reg.register(ExtAgentManifest(
        agent_rid=f"ext.{tenant}.agent.translator.v1",
        name="Translator",
        vendor="acme-mkt",
        protocol=ExtProtocol.HTTP,
        endpoint="http://mkt.example.com/translator",
        capabilities=(Capability(name="translate", description="EN↔ZH"),),
        sandbox=SandboxTier.L3_MICROVM,
    ))
    inv = reg.invoke(f"ext.{tenant}.agent.translator.v1", "translate", {"text": "hello"})
    print(f"  status: {inv.status}, sandbox: {inv.sandbox_id}")
    print(f"  output: {inv.output}")

    # ───── 11) SuperAI Copilot ─────
    banner("11. SuperAI Copilot")
    cop = SuperAICopilot(
        config=SuperAICopilotConfig(retention=RetentionPolicy.PERSIST_7D),
    )
    router = IntentRouter()
    role = router.route("发起一个订单审批流程")
    print(f"  IntentRouter: {role.value}")
    state, token = cop.submit_query("发起一个订单审批流程", ctx, mgr)
    print(f"  plan_id: {state.plan.plan_id}, HITL token issued")
    print(f"  token valid: {token.is_valid()}")

    # ───── 12) MP-SAL-01: 建模即工具(发布 → schema_gen → IR 查询) ─────
    banner("12. MP-SAL-01: 建模即工具")
    from mate_kernel.objectset.ir import (
        Aggregation,
        Condition,
        InMemoryQueryExecutor,
        MetricSpec,
        ObjectSetQuery,
        QueryOp,
    )
    from mate_kernel.tooling.schema_gen import agent_tool_schemas

    tools = agent_tool_schemas([ot_order], [], [])
    print(f"  tools: {[t['function']['name'] for t in tools]}")
    qe = InMemoryQueryExecutor(
        individuals=inds, links=[], object_types=[ot_order],
    )
    objects_res = qe.execute(ObjectSetQuery(
        source=ot_order.rid,
        filters=(Condition("status", QueryOp.EQ, "open"),),
    ))
    print(f"  objects rows: {[(r['status'], r['amount']) for r in objects_res.rows]}")
    agg_res = qe.execute(ObjectSetQuery(
        source=ot_order.rid,
        aggregation=Aggregation(
            group_by=("status",),
            metrics=(MetricSpec(fn="sum", field="amount"), MetricSpec(fn="count")),
        ),
    ))
    print(f"  aggregates rows: {agg_res.rows[0]}")
    assert objects_res.rows and agg_res.rows

    print("\n=== 全部 12 步通过 ===")
    drained = mgr.drain_changes()
    print(f"Manager drained: {len(drained)} changes")


if __name__ == "__main__":
    main()
