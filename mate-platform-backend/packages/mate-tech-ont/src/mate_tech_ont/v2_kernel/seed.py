"""员工请假审批 demo 种子数据（ONT_SEED_DEMO=1 时启动注入）。

只通过 OntologyRepository Protocol 方法写（13 硬规则 #3：无裸 SQL），
幂等：list_object_types() 非空即跳过。场景与 /goal 端到端验收一致：
copilot 面板执行 act-approve-leave / act-close-ticket → ActionType.apply
（唯一合法写路径）→ side_effects 回显。

用法：
    ONT_SEED_DEMO=1 KERNEL_BACKEND=memory python -m uvicorn ...
"""

from __future__ import annotations

from datetime import datetime, timezone

from mate_kernel.ontology.api import OntologyRepository
from mate_kernel.ontology.identity import ClassRef
from mate_kernel.ontology.instances import Individual, LinkInstance
from mate_kernel.ontology.reasoning import Function, FunctionLanguage
from mate_kernel.ontology.types.action_type import ActionType
from mate_kernel.ontology.types.interface import Interface
from mate_kernel.ontology.types.link_type import Cardinality, Directionality, LinkType
from mate_kernel.ontology.types.object_type import ObjectType
from mate_kernel.ontology.types.property_ import Property, PropertyFormat

TENANT = "tenant-default"


def _prop(rid: str, type_id: str, title: str, pk: bool = False) -> Property:
    return Property(
        rid=ClassRef(rid),
        type_id=type_id,
        nullable=False,
        primary_key=pk,
        title=title,
        format=PropertyFormat.STRING if type_id == "string" else PropertyFormat.INTEGER,
    )


def _ind(
    rid: str, cls: str, props: list[tuple[str, object]], pk: str, tenant: str,
) -> Individual:
    now = datetime.now(timezone.utc)
    return Individual(
        rid=rid,
        class_rid=ClassRef(cls),
        props=tuple((ClassRef(p), v) for p, v in props),
        primary_key=pk,
        created_at=now,
        updated_at=now,
        tenant_id=tenant,
        marking=tuple(),
    )


def _function_placeholder(t: str, slug: str) -> Function:
    return Function(
        rid=ClassRef(f"ont.{t}.fn.{slug}"),
        language=FunctionLanguage.PYTHON,
        version=1,
        source_ref=f"ref://{slug.replace('.', '_')}",
        signatures=(("decision", "string"),),
    )


def seed_demo(repo: OntologyRepository, tenant_id: str = TENANT) -> int:
    """幂等注入请假审批场景；返回创建资源数（已存在返回 0）。"""
    if repo.list_object_types(limit=1, offset=0):
        return 0

    t = tenant_id
    now = datetime.now(timezone.utc)

    # ── ObjectTypes ──
    repo.upsert_object_type(ObjectType(
        rid=ClassRef(f"ont.{t}.obj.employee.v1"),
        primary_key=(ClassRef(f"ont.{t}.prop.emp-id.v1"),),
        properties=(
            _prop(f"ont.{t}.prop.emp-id.v1", "string", "employee id", pk=True),
            _prop(f"ont.{t}.prop.name.v1", "string", "name"),
            _prop(f"ont.{t}.prop.dept.v1", "string", "department"),
        ),
        display_name="员工",
    ))
    repo.upsert_object_type(ObjectType(
        rid=ClassRef(f"ont.{t}.obj.leave-request.v1"),
        primary_key=(ClassRef(f"ont.{t}.prop.leave-id.v1"),),
        properties=(
            _prop(f"ont.{t}.prop.leave-id.v1", "string", "leave id", pk=True),
            _prop(f"ont.{t}.prop.employee.v1", "string", "employee"),
            _prop(f"ont.{t}.prop.days.v1", "integer", "days"),
            _prop(f"ont.{t}.prop.status.v1", "string", "status"),
            _prop(f"ont.{t}.prop.reason.v1", "string", "reason"),
        ),
        display_name="请假申请",
    ))
    repo.upsert_object_type(ObjectType(
        rid=ClassRef(f"ont.{t}.obj.ticket.v1"),
        primary_key=(ClassRef(f"ont.{t}.prop.ticket-id.v1"),),
        properties=(
            _prop(f"ont.{t}.prop.ticket-id.v1", "string", "ticket id", pk=True),
            _prop(f"ont.{t}.prop.title.v1", "string", "title"),
            _prop(f"ont.{t}.prop.priority.v1", "string", "priority"),
            _prop(f"ont.{t}.prop.status.v1", "string", "status"),
        ),
        display_name="工单",
    ))

    # ── Individuals（真实业务场景：3 员工 / 3 请假 / 2 工单） ──
    employees = [("EMP-001", "王小明", "HR"), ("EMP-002", "李华", "研发"), ("EMP-003", "赵强", "运营")]
    for emp_id, name, dept in employees:
        repo.create_individual(_ind(
            f"ont.{t}.ind.employee.{emp_id.lower()}",
            f"ont.{t}.obj.employee.v1",
            [
                (f"ont.{t}.prop.emp-id.v1", emp_id),
                (f"ont.{t}.prop.name.v1", name),
                (f"ont.{t}.prop.dept.v1", dept),
            ],
            emp_id,
            t,
        ))
    leave_rows = [
        ("LR-2026-001", "王小明", 3, "pending", "年假"),
        ("LR-2026-002", "李华", 1, "pending", "事假"),
        ("LR-2026-003", "赵强", 5, "pending", "调休"),
    ]
    for i, (leave_id, emp, days, status, reason) in enumerate(leave_rows):
        repo.create_individual(_ind(
            f"ont.{t}.ind.leave-request.{i + 1}",
            f"ont.{t}.obj.leave-request.v1",
            [
                (f"ont.{t}.prop.leave-id.v1", leave_id),
                (f"ont.{t}.prop.employee.v1", emp),
                (f"ont.{t}.prop.days.v1", days),
                (f"ont.{t}.prop.status.v1", status),
                (f"ont.{t}.prop.reason.v1", reason),
            ],
            leave_id,
            t,
        ))
    ticket_rows = [
        ("TK-2026-001", "登录页偶发 401", "high"),
        ("TK-2026-002", "报表导出慢", "medium"),
    ]
    for i, (ticket_id, title, priority) in enumerate(ticket_rows):
        repo.create_individual(_ind(
            f"ont.{t}.ind.ticket.{i + 1}",
            f"ont.{t}.obj.ticket.v1",
            [
                (f"ont.{t}.prop.ticket-id.v1", ticket_id),
                (f"ont.{t}.prop.title.v1", title),
                (f"ont.{t}.prop.priority.v1", priority),
                (f"ont.{t}.prop.status.v1", "open"),
            ],
            ticket_id,
            t,
        ))

    # ── ActionTypes（唯一合法写路径） ──
    repo.upsert_action_type(ActionType(
        rid=ClassRef(f"ont.{t}.act.approve-leave.v1"),
        parameters=(_prop(f"ont.{t}.prop.decision.v1", "string", "decision"),),
        submission_criteria=("decision in (approve, reject)",),
        side_effects=("notify_email", "audit_log"),
        function_ref=ClassRef(f"ont.{t}.fn.approve-leave.v1"),
        on=(ClassRef(f"ont.{t}.obj.leave-request.v1"),),
        title="审批请假",
        description="对员工请假申请做出批准 / 驳回决定，通过邮件通知申请人并写审计日志",
    ))
    repo.upsert_action_type(ActionType(
        rid=ClassRef(f"ont.{t}.act.close-ticket.v1"),
        parameters=(_prop(f"ont.{t}.prop.resolution.v1", "string", "resolution"),),
        submission_criteria=(),
        side_effects=("notify_customer",),
        function_ref=ClassRef(f"ont.{t}.fn.close-ticket.v1"),
        on=(ClassRef(f"ont.{t}.obj.ticket.v1"),),
        title="关闭工单",
        description="填写处理结论并关闭客户工单，自动通知工单提交人",
    ))
    repo.upsert_action_type(ActionType(
        rid=ClassRef(f"ont.{t}.act.order-review-confirm.v1"),
        parameters=(_prop(f"ont.{t}.prop.decision.v1", "string", "decision"),),
        submission_criteria=("decision in (confirm, reject)",),
        side_effects=("update_order", "create_follow_up_task", "audit_log"),
        function_ref=ClassRef(f"ont.{t}.fn.order-review-confirm.v1"),
        on=(ClassRef(f"ont.{t}.obj.crm.order.v1"),),
        title="订单复核确认",
        description="人工确认订单复核建议，更新订单并创建回款跟进单",
    ))

    # ── Function / LinkType / LinkInstance ──
    repo.upsert_function(_function_placeholder(t, "approve-leave.v1"))
    repo.upsert_function(_function_placeholder(t, "close-ticket.v1"))
    repo.upsert_function(_function_placeholder(t, "order-review-confirm.v1"))
    repo.upsert_link_type(LinkType(
        rid=ClassRef(f"ont.{t}.link.employee-leave.v1"),
        src=ClassRef(f"ont.{t}.obj.employee.v1"),
        dst=ClassRef(f"ont.{t}.obj.leave-request.v1"),
        cardinality=Cardinality.ONE_TO_MANY,
        directionality=Directionality.DIRECTED,
        link_properties=(),
    ))
    for i, emp_id in enumerate(["emp-001", "emp-002", "emp-003"]):
        repo.create_link_instance(LinkInstance(
            rid=f"ont.{t}.lnk.employee-leave.{i + 1}",
            link_type_rid=ClassRef(f"ont.{t}.link.employee-leave.v1"),
            src=f"ont.{t}.ind.employee.{emp_id}",
            dst=f"ont.{t}.ind.leave-request.{i + 1}",
            props=(),
            created_at=now,
            tenant_id=t,
            marking=(),
        ))

    # ── 企业核心本体（领域分组 → 前端一级/二级本体） ──
    # 概念 rid 形如 ont.<tenant>.obj.<领域>.<概念>.v1，前端按领域段分组生成
    # 一级本体列表，领域内 ObjectType 即二级本体/概念。
    _seed_enterprise_ontology(repo, t, now)

    return 3 + 5 + 3 + 3 + 1 + 3  # obj types + individuals + action types + functions + link type + link instances


def _seed_enterprise_ontology(
    repo: OntologyRepository, t: str, now: datetime,
) -> int:
    """企业核心本体：5 领域 × 9 概念 + 属性 + 2 下钻 ActionType + 关联 LinkType。

    领域（前端一级本体）→ 概念（二级本体/概念）：
      crm 客户关系：customer / order / product / contract
      scm 供应链：  supplier / warehouse
      fin 财务核算： invoice
      org 组织人力： organization / person
    """
    domain_concepts: dict[str, list[tuple[str, str, list[tuple[str, str, str]]]]] = {
        "crm": [
            ("customer", "客户", [
                ("customer-code", "string", "customer code"),
                ("customer-name", "string", "customer name"),
                ("industry", "string", "industry"),
                ("region", "string", "region"),
                ("credit-level", "string", "credit level"),
            ]),
            ("order", "订单", [
                ("order-id", "string", "order id"),
                ("order-qty", "integer", "quantity"),
                ("order-amount", "integer", "amount"),
                ("order-status", "string", "status"),
            ]),
            ("product", "产品", [
                ("product-code", "string", "product code"),
                ("product-name", "string", "product name"),
                ("category", "string", "category"),
            ]),
            ("contract", "合同", [
                ("contract-id", "string", "contract id"),
                ("contract-name", "string", "contract name"),
                ("start-date", "string", "start date"),
                ("end-date", "string", "end date"),
            ]),
        ],
        "scm": [
            ("supplier", "供应商", [
                ("supplier-code", "string", "supplier code"),
                ("supplier-name", "string", "supplier name"),
                ("qualification", "string", "qualification"),
            ]),
            ("warehouse", "仓库", [
                ("warehouse-code", "string", "warehouse code"),
                ("warehouse-name", "string", "warehouse name"),
                ("capacity", "integer", "capacity"),
            ]),
        ],
        "fin": [
            ("invoice", "发票", [
                ("invoice-id", "string", "invoice id"),
                ("invoice-amount", "integer", "amount"),
                ("invoice-status", "string", "status"),
            ]),
        ],
        "org": [
            ("organization", "组织", [
                ("org-code", "string", "org code"),
                ("org-name", "string", "org name"),
                ("parent-org", "string", "parent org"),
            ]),
            ("person", "人员", [
                ("person-id", "string", "person id"),
                ("person-name", "string", "person name"),
                ("person-dept", "string", "department"),
            ]),
        ],
    }

    # ObjectTypes + properties（PK 取第一个属性）
    created = 0
    for domain, concepts in domain_concepts.items():
        for slug, display, props in concepts:
            prop_defs = tuple(
                _prop(f"ont.{t}.prop.{slug}-{p}.v1", typ, title, pk=(i == 0))
                for i, (p, typ, title) in enumerate(props)
            )
            repo.upsert_object_type(ObjectType(
                rid=ClassRef(f"ont.{t}.obj.{domain}.{slug}.v1"),
                primary_key=(prop_defs[0].rid,),
                properties=prop_defs,
                display_name=display,
            ))
            created += 1

    # 下钻 ActionType：合同审批（contract）
    repo.upsert_action_type(ActionType(
        rid=ClassRef(f"ont.{t}.act.approve-contract.v1"),
        parameters=(_prop(f"ont.{t}.prop.decision.v1", "string", "decision"),),
        submission_criteria=("decision in (approve, reject)",),
        side_effects=("notify_email", "audit_log"),
        function_ref=ClassRef(f"ont.{t}.fn.approve-contract.v1"),
        on=(ClassRef(f"ont.{t}.obj.crm.contract.v1"),),
        title="审批合同",
        description="对客户合同进行审批流转（批准 / 驳回），邮件通知相关方并记录审计日志",
    ))
    repo.upsert_function(_function_placeholder(t, "approve-contract.v1"))
    created += 2

    # 关联 LinkType：customer→order 1:N、organization→person 1:N
    repo.upsert_link_type(LinkType(
        rid=ClassRef(f"ont.{t}.link.customer-order.v1"),
        src=ClassRef(f"ont.{t}.obj.crm.customer.v1"),
        dst=ClassRef(f"ont.{t}.obj.crm.order.v1"),
        cardinality=Cardinality.ONE_TO_MANY,
        directionality=Directionality.DIRECTED,
        link_properties=(),
    ))
    repo.upsert_link_type(LinkType(
        rid=ClassRef(f"ont.{t}.link.org-person.v1"),
        src=ClassRef(f"ont.{t}.obj.org.organization.v1"),
        dst=ClassRef(f"ont.{t}.obj.org.person.v1"),
        cardinality=Cardinality.ONE_TO_MANY,
        directionality=Directionality.DIRECTED,
        link_properties=(),
    ))
    created += 2

    return created


# 7+1 数字员工本体（GOVERN-11 Step 2：跨域 Ontology 业务闭环 seed）
#
# 7 域（HR/IT/FINANCE/SALES + 子域）+ 1 编排者 SuperAI：
#   HR Recruiter / HR Payroll / IT Helpdesk / IT DevOps /
#   Finance AR / Finance Expense / Sales CRM / SuperAI Orchestrator
#
# 每个 employee 同时创建 1 Function + 1 ActionType（GOVERN-05 真 invoke 链路）。
# 全部走 OntologyRepository Protocol 方法（13 硬规则 #3：无裸 SQL）。
# 业务语义字段（HR 工单天数、加班费、发票金额、合同金额、优先级）来自 GOVERN-11 §B.2.2。
#
# 幂等：list_interfaces() 已含 dw-employee-if 视为已 seed，返回 0。

_DW_EMPLOYEES: tuple[tuple[str, str, str, str, tuple[str, ...], tuple[str, ...]], ...] = (
    ("hr-recruiter", "HR Recruiter", "HR", "agent",
     ("screen_resume", "schedule_interview", "initiate_onboarding"),
     ("ont.{t}.obj.employee.v1", "ont.{t}.obj.leave-request.v1")),
    ("hr-payroll", "HR Payroll Specialist", "HR", "executor",
     ("calculate_salary", "verify_social_insurance", "compute_overtime_fee"),
     ("ont.{t}.obj.leave-request.v1",)),
    ("it-helpdesk", "IT Service Desk", "IT", "agent",
     ("classify_ticket", "reset_password", "request_device"),
     ("ont.{t}.obj.ticket.v1",)),
    ("it-devops", "IT DevOps Engineer", "IT", "executor",
     ("trigger_ci", "approve_deploy", "alert_monitoring"),
     ("ont.{t}.obj.ticket.v1",)),
    ("finance-ar", "Finance AR Specialist", "FINANCE", "analyst",
     ("issue_invoice", "reconcile_payment", "aging_analysis"),
     ("ont.{t}.obj.fin.invoice.v1",)),
    ("finance-expense", "Finance Expense Auditor", "FINANCE", "executor",
     ("audit_expense", "reimburse", "generate_voucher"),
     ("ont.{t}.obj.fin.invoice.v1",)),
    ("sales-crm", "Sales CRM Assistant", "SALES", "agent",
     ("follow_customer", "draft_contract", "advance_opportunity"),
     ("ont.{t}.obj.crm.contract.v1",)),
)


def seed_hr_it_finance_orchestrator(repo: OntologyRepository, tenant_id: str = TENANT) -> int:
    """幂等注入 7+1 数字员工本体；返回创建资源数。"""
    t = tenant_id
    interface_rid = ClassRef(f"ont.{t}.if.dw-employee.v1")
    if any(i.rid == interface_rid for i in repo.list_interfaces()):
        return 0

    now = datetime.now(timezone.utc)

    # ── Interface（dw-employee 契约） ──
    repo.upsert_interface(Interface(
        rid=interface_rid,
        properties=(
            _prop(f"ont.{t}.prop.dw-role.v1", "string", "role"),
            _prop(f"ont.{t}.prop.dw-role-category.v1", "string", "roleCategory"),
            _prop(f"ont.{t}.prop.dw-capabilities.v1", "string", "capabilities (CSV)"),
            _prop(f"ont.{t}.prop.dw-endpoint.v1", "string", "endpoint_url"),
        ),
        required_links=(ClassRef(f"ont.{t}.obj.employee.v1"),),
    ))

    # ── LinkType 3 条 ──
    repo.upsert_link_type(LinkType(
        rid=ClassRef(f"ont.{t}.link.dw-employee-of.v1"),
        src=ClassRef(f"ont.{t}.obj.employee.v1"),
        dst=ClassRef(f"ont.{t}.if.dw-employee.v1"),
        cardinality=Cardinality.ONE_TO_MANY,
        directionality=Directionality.DIRECTED,
    ))
    repo.upsert_link_type(LinkType(
        rid=ClassRef(f"ont.{t}.link.dw-executes-function.v1"),
        src=ClassRef(f"ont.{t}.if.dw-employee.v1"),
        dst=ClassRef(f"ont.{t}.fn.dw-execute.v1"),
        cardinality=Cardinality.ONE_TO_MANY,
        directionality=Directionality.DIRECTED,
    ))
    repo.upsert_link_type(LinkType(
        rid=ClassRef(f"ont.{t}.link.dw-orchestrated-by.v1"),
        src=ClassRef(f"ont.{t}.if.dw-employee.v1"),
        dst=ClassRef(f"ont.{t}.obj.superai.v1"),
        cardinality=Cardinality.MANY_TO_ONE,
        directionality=Directionality.DIRECTED,
    ))

    # ── ObjectType: obj.superai.v1（编排者本体） ──
    superai_ot = ObjectType(
        rid=ClassRef(f"ont.{t}.obj.superai.v1"),
        primary_key=(ClassRef(f"ont.{t}.prop.superai-id.v1"),),
        properties=(
            _prop(f"ont.{t}.prop.superai-id.v1", "string", "orchestrator id", pk=True),
            _prop(f"ont.{t}.prop.superai-name.v1", "string", "name"),
            _prop(f"ont.{t}.prop.superai-capabilities.v1", "string", "capabilities (CSV)"),
        ),
        display_name="SuperAI 编排者",
    )
    repo.upsert_object_type(superai_ot)

    created = 0
    # ── 7 域数字员工：1 个 ObjectType(if.dw-employee.v1 已是 Interface，再加 1 个 ObjectType.obj.dw-digital-employee.v1 给个体) ──
    dw_ot = ObjectType(
        rid=ClassRef(f"ont.{t}.obj.dw-digital-employee.v1"),
        primary_key=(ClassRef(f"ont.{t}.prop.dw-emp-id.v1"),),
        properties=(
            _prop(f"ont.{t}.prop.dw-emp-id.v1", "string", "digital employee id", pk=True),
            _prop(f"ont.{t}.prop.dw-emp-name.v1", "string", "name"),
            _prop(f"ont.{t}.prop.dw-role.v1", "string", "role"),
            _prop(f"ont.{t}.prop.dw-role-category.v1", "string", "roleCategory"),
            _prop(f"ont.{t}.prop.dw-capabilities.v1", "string", "capabilities (CSV)"),
            _prop(f"ont.{t}.prop.dw-endpoint.v1", "string", "endpoint_url"),
        ),
        display_name="数字员工",
    )
    repo.upsert_object_type(dw_ot)
    created += 1

    # ── 每个员工：Individual + Function + ActionType ──
    for slug, name, role_category, role, capabilities, _targets in _DW_EMPLOYEES:
        endpoint = f"http://localhost:8021/api/v1/dw/employees/dw-{slug}/execute"
        cap_csv = ",".join(capabilities)
        repo.create_individual(_ind(
            f"ont.{t}.ind.dw-{slug}.v1",
            f"ont.{t}.obj.dw-digital-employee.v1",
            [
                (f"ont.{t}.prop.dw-emp-id.v1", f"dw-{slug}"),
                (f"ont.{t}.prop.dw-emp-name.v1", name),
                (f"ont.{t}.prop.dw-role.v1", role),
                (f"ont.{t}.prop.dw-role-category.v1", role_category),
                (f"ont.{t}.prop.dw-capabilities.v1", cap_csv),
                (f"ont.{t}.prop.dw-endpoint.v1", endpoint),
            ],
            f"dw-{slug}",
            t,
        ))
        # 每个员工 1 个 Function + 1 个 ActionType
        fn_rid = f"ont.{t}.fn.dw-{slug}-execute.v1"
        repo.upsert_function(Function(
            rid=ClassRef(fn_rid),
            language=FunctionLanguage.PYTHON,
            version=1,
            source_ref=f"ref://dw_{slug.replace('-', '_')}_execute",
            signatures=(("intent", "string"), ("payload", "string")),
        ))
        repo.upsert_action_type(ActionType(
            rid=ClassRef(f"ont.{t}.act.dw-{slug}-execute.v1"),
            parameters=(
                _prop(f"ont.{t}.prop.intent.v1", "string", "intent"),
                _prop(f"ont.{t}.prop.payload.v1", "string", "payload"),
            ),
            submission_criteria=("len(intent) > 0",),
            side_effects=("audit_log", "notify_email"),
            function_ref=ClassRef(fn_rid),
            on=(ClassRef(f"ont.{t}.obj.dw-digital-employee.v1"),),
            title=f"{name} · 任务执行",
            description=f"触发数字员工「{name}」（{role_category}/{role}）执行任务，能力：{cap_csv}",
        ))
        created += 3

    # ── SuperAI 编排者 ──
    sa_caps = ("detect_intent", "match_employee", "plan_task", "aggregate_result")
    repo.create_individual(_ind(
        f"ont.{t}.ind.superai-orchestrator.v1",
        f"ont.{t}.obj.superai.v1",
        [
            (f"ont.{t}.prop.superai-id.v1", "superai-orchestrator"),
            (f"ont.{t}.prop.superai-name.v1", "SuperAI Orchestrator"),
            (f"ont.{t}.prop.superai-capabilities.v1", ",".join(sa_caps)),
        ],
        "superai-orchestrator",
        t,
    ))
    sa_fn_rid = f"ont.{t}.fn.superai-orchestrate.v1"
    repo.upsert_function(Function(
        rid=ClassRef(sa_fn_rid),
        language=FunctionLanguage.PYTHON,
        version=1,
        source_ref="ref://superai_orchestrate",
        signatures=(("user_intent", "string"), ("tenant_id", "string")),
    ))
    repo.upsert_action_type(ActionType(
        rid=ClassRef(f"ont.{t}.act.superai-orchestrate.v1"),
        parameters=(
            _prop(f"ont.{t}.prop.user-intent.v1", "string", "user intent"),
        ),
        submission_criteria=("len(user_intent) > 0",),
        side_effects=("audit_log",),
        function_ref=ClassRef(sa_fn_rid),
        on=(ClassRef(f"ont.{t}.obj.superai.v1"),),
        title="SuperAI 编排调度",
        description="解析用户意图，匹配并编排数字员工执行任务，汇总各员工返回结果",
    ))
    created += 3

    return created


# rid 末段 → (title, description)。老库 ActionType 行缺展示元数据时按此回填。
_ACTION_DISPLAY_META: dict[str, tuple[str, str]] = {
    "act.approve-leave.v1": ("审批请假", "对员工请假申请做出批准 / 驳回决定，通过邮件通知申请人并写审计日志"),
    "act.close-ticket.v1": ("关闭工单", "填写处理结论并关闭客户工单，自动通知工单提交人"),
    "act.approve-contract.v1": ("审批合同", "对客户合同进行审批流转（批准 / 驳回），邮件通知相关方并记录审计日志"),
    "act.superai-orchestrate.v1": ("SuperAI 编排调度", "解析用户意图，匹配并编排数字员工执行任务，汇总各员工返回结果"),
}


def backfill_action_display(repo: OntologyRepository, tenant_id: str = TENANT) -> int:
    """给已有 ActionType 行补 title/description（幂等：有 title 即跳过该行）。

    新装环境由 seed 直接带元数据；本函数服务"先有数据、后加字段"的老库，
    在 seed_demo 因非空而提前返回时仍能把展示名补齐。
    """
    from dataclasses import replace as _replace

    dw_names = {f"act.dw-{slug}-execute.v1": name for slug, name, *_ in _DW_EMPLOYEES}
    updated = 0
    for at in repo.list_action_types():
        if at.title:
            continue
        tail = ".".join(at.rid.rid.split(".")[-3:])  # act.<slug>.v1
        title = description = ""
        if tail in _ACTION_DISPLAY_META:
            title, description = _ACTION_DISPLAY_META[tail]
        elif tail in dw_names:
            name = dw_names[tail]
            title = f"{name} · 任务执行"
            description = f"触发数字员工「{name}」执行任务"
        if not title:
            continue
        repo.upsert_action_type(_replace(at, title=title, description=description))
        updated += 1
    return updated


__all__ = ["seed_demo", "seed_hr_it_finance_orchestrator", "backfill_action_display", "TENANT"]
