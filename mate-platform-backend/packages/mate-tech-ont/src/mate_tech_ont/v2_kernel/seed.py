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
    ))
    repo.upsert_action_type(ActionType(
        rid=ClassRef(f"ont.{t}.act.close-ticket.v1"),
        parameters=(_prop(f"ont.{t}.prop.resolution.v1", "string", "resolution"),),
        submission_criteria=(),
        side_effects=("notify_customer",),
        function_ref=ClassRef(f"ont.{t}.fn.close-ticket.v1"),
        on=(ClassRef(f"ont.{t}.obj.ticket.v1"),),
    ))

    # ── Function / LinkType / LinkInstance ──
    repo.upsert_function(_function_placeholder(t, "approve-leave.v1"))
    repo.upsert_function(_function_placeholder(t, "close-ticket.v1"))
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

    return 3 + 5 + 2 + 2 + 1 + 3  # obj types + individuals + action types + functions + link type + link instances


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


__all__ = ["seed_demo", "TENANT"]
