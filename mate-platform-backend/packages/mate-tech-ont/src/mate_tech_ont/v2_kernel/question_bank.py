"""G34 题库：50 道真实业务题（三段式），覆盖本体引擎 seed 数据域。

数据域对位 ``seed.py``（``seed_demo`` + ``seed_hr_it_finance_orchestrator``）：

- **CRM**：``crm.customer``（region/credit-level/industry）→ ``crm.order``
  （customer-order 1:N 链接）→ ``crm.product`` / ``crm.contract``，
  含 ``order-review-confirm`` / ``approve-contract`` 动作与
  ``dw-sales-crm`` 数字员工。
- **HR**：``employee`` → ``leave-request``（employee-leave 1:N 链接）、
  ``approve-leave`` 审批动作、``dw-hr-recruiter`` / ``dw-hr-payroll``
  数字员工。
- **IT**：``ticket``（priority/status）、``close-ticket`` 动作、
  ``dw-it-helpdesk`` / ``dw-it-devops`` 数字员工。
- **财务**：``fin.invoice``、``dw-finance-ar``（issue_invoice /
  reconcile_payment / aging_analysis）、``dw-finance-expense``。
- **跨域**：``superai-orchestrate`` 编排链路 + 客户→订单→发票、
  员工→工单→部门 等链路推演。

三段式严格遵循 Palantir 验证方法论：``situation`` 建立情境（业务触发
+ 圈选对象）→ ``cause`` 追踪成因（沿 LinkType / ActionType / 数字员工
能力找根因）→ ``impact`` 评估影响（量化下游波及面）。每题 tags 恰为
「域 + 场景类型」各一枚；``expected_answer`` 给出可验证的答案要点。

版本随题库内容演进：结构变更（增删域/场景类型）应升级
``QUESTION_BANK_VERSION``。
"""

from __future__ import annotations

from mate_tech_ont.v2_kernel.evaluation import (
    EvaluationQuestion,
    QuestionStages,
)

__all__ = ["QUESTION_BANK_VERSION", "build_question_bank"]

#: 题库版本（题库结构/覆盖域变更时升级）。
QUESTION_BANK_VERSION = "1.0"

#: 合法域标签（每题恰一枚）。
DOMAIN_TAGS = ("crm", "hr", "it", "finance", "cross-domain")

#: 合法场景类型标签（每题恰一枚）。
SCENARIO_TAGS = ("lookup", "trend", "root-cause", "impact", "scenario")


def _q(
    qid: str,
    *,
    question: str,
    situation: str,
    cause: str,
    impact: str,
    expected: str,
    domain: str,
    scenario: str,
) -> EvaluationQuestion:
    """构造单题：tags 恒为「域 + 场景类型」两枚。"""
    return EvaluationQuestion(
        id=qid,
        business_question=question,
        stages=QuestionStages(situation=situation, cause=cause, impact=impact),
        expected_answer=expected,
        tags=(domain, scenario),
    )


# ---------------------------------------------------------------------------
# CRM 域（12 题）
# ---------------------------------------------------------------------------

_CRM = (
    _q(
        "q-crm-001",
        question="华东区客户按信用等级的分布如何，A 级客户具体有哪几家？",
        situation="销售例会前需要盘点华东盘面：圈选 crm.customer 中 region 为「华东」的客户对象。",
        cause="按 credit-level 属性对客户分组统计，列出各等级客户名单。",
        impact="计算 A 级客户占华东客户总数的比例，作为授信额度与销售资源投放依据。",
        expected="给出华东区各信用等级客户数量与名单，A 级客户可逐一列名并给出占比。",
        domain="crm",
        scenario="lookup",
    ),
    _q(
        "q-crm-002",
        question="哪些信用等级为 A 级的客户名下有金额超过 50 万且尚未完结的订单？",
        situation="授信复审场景：圈选 credit-level 为「A」的 crm.customer 客户。",
        cause="沿 customer→order 链接（customer-order 1:N）遍历名下订单，过滤 order-status 未完结且 order-amount 超过 50 万的订单。",
        impact="汇总这些客户在手未完结订单总金额，评估当前收入贡献与授信占用。",
        expected="给出同时满足 A 级信用与大额未完结订单两个条件的客户名单及对应订单金额。",
        domain="crm",
        scenario="lookup",
    ),
    _q(
        "q-crm-003",
        question="状态为延迟的订单集中在哪些区域的客户上，主要卡在哪个履约环节？",
        situation="客服收到多家客户催单：圈选 order-status 为「延迟」的 crm.order 订单对象。",
        cause="反向沿 customer-order 链接定位订单所属客户的 region，并核对订单复核（order-review-confirm）是否已完成确认。",
        impact="统计延迟订单 order-amount 合计与受影响客户数，评估对当期履约率的影响。",
        expected="延迟订单按客户区域归组给出集中度，并指出未完成订单复核是主要卡点。",
        domain="crm",
        scenario="root-cause",
    ),
    _q(
        "q-crm-004",
        question="未来 60 天内到期的客户合同有哪些，按到期月份分布如何？",
        situation="续约季启动：圈选 end-date 落在未来 60 天窗口内的 crm.contract 合同对象。",
        cause="按 end-date 逐月分组，并经 contract-name / 客户关联核对每份合同的客户与状态。",
        impact="估算到期合同对应在手订单的续约风险，标出需提前启动续约谈判的合同。",
        expected="列出 60 天内到期合同清单及逐月分布，标出续约风险最高的合同。",
        domain="crm",
        scenario="trend",
    ),
    _q(
        "q-crm-005",
        question="各区域客户的订单金额贡献近几个周期呈什么走势，哪个区域增长最快？",
        situation="季度经营复盘：按 region 分组圈选全部 crm.customer 客户。",
        cause="沿 customer→order 链接聚合各区域客户订单的 order-amount，按周期对比环比变化。",
        impact="识别增长最快与下滑区域，为区域销售资源再分配提供依据。",
        expected="给出各区域订单金额的周期对比与增速排名，指明增长最快区域。",
        domain="crm",
        scenario="trend",
    ),
    _q(
        "q-crm-006",
        question="「办公设备」类目的产品被哪些订单采购，合计采购数量是多少？",
        situation="备货计划编制：定位 crm.product 中 category 为「办公设备」的产品对象。",
        cause="按产品维度检索引用该产品的 crm.order 订单，逐单汇总 order-qty。",
        impact="评估该类目产品的销量占比，判断是否需要调整备货与产能计划。",
        expected="列出采购该类目产品的订单清单及 order-qty 合计。",
        domain="crm",
        scenario="lookup",
    ),
    _q(
        "q-crm-007",
        question="金额 Top 5 的未完结订单若全部延期交付，对整体回款计划影响多大？",
        situation="风控压力测试：按 order-amount 降序取 order-status 为未完结的前 5 笔订单。",
        cause="逐单核对所属客户 credit-level 与关联合同的 end-date，判断延期是否突破授信与合同期限。",
        impact="计算 Top 5 订单金额占全部未完结订单金额的比例，量化回款敞口。",
        expected="给出 Top 5 订单金额合计及其占未结订单总额比例，标注突破授信或合同期限的订单。",
        domain="crm",
        scenario="impact",
    ),
    _q(
        "q-crm-008",
        question="某客户的合同迟迟未生效，是审批流卡住还是合同要素缺失？",
        situation="客户投诉合同迟迟拿不到：定位该客户的 crm.contract 合同对象，检查 start-date/end-date 是否完整。",
        cause="核对合同是否已进入审批合同（approve-contract）流程、审批决定是否已落库。",
        impact="评估未生效合同关联在谈订单能否按期开票，量化滞压金额。",
        expected="给出合同未生效根因（审批未完成或要素缺失）及受影响订单金额。",
        domain="crm",
        scenario="root-cause",
    ),
    _q(
        "q-crm-009",
        question="近几个周期哪些客户下单频次明显上升，哪些客户持续零下单？",
        situation="客户健康度巡检：圈选全部 crm.customer 及其名下订单的周期分布。",
        cause="沿 customer→order 统计每客户各周期订单笔数，计算环比变化并筛出零下单客户。",
        impact="对持续零下单客户列出合同到期时间，提示流失挽回窗口。",
        expected="给出下单频次上升客户名单与零下单客户名单，零下单客户标注合同到期日。",
        domain="crm",
        scenario="trend",
    ),
    _q(
        "q-crm-010",
        question="销售在订单复核中确认了一笔可疑订单，系统会联动产生哪些下游动作？",
        situation="运营演练：定位待复核的 crm.order 订单及其 order-review-confirm 动作定义。",
        cause="追踪 order-review-confirm 的 side_effects：update_order、create_follow_up_task、audit_log。",
        impact="确认后生成的回款跟进单将进入财务应收流程，需评估跟进单时效要求。",
        expected="复核确认会更新订单状态、创建回款跟进单并写审计日志三项副作用。",
        domain="crm",
        scenario="scenario",
    ),
    _q(
        "q-crm-011",
        question="客户按行业的分布如何，哪个行业贡献的订单金额最高？",
        situation="行业线经营分析：对 crm.customer 按 industry 属性分组统计客户数。",
        cause="沿 customer→order 链接汇总各行业客户订单的 order-amount 并排序。",
        impact="识别行业集中度风险：单一行业占比过高时的收入波动敞口。",
        expected="给出行业客户数分布与行业订单金额排名，指出集中度最高的行业。",
        domain="crm",
        scenario="lookup",
    ),
    _q(
        "q-crm-012",
        question="销售助理数字员工能否为临期合同自动起草续签方案，还差哪些人工环节？",
        situation="续约提效试点：定位数字员工 dw-sales-crm 及其 capabilities（follow_customer、draft_contract、advance_opportunity）。",
        cause="经 dw-sales-crm-execute 动作下发 draft_contract 意图，引用 end-date 临近的 crm.contract 对象作为输入。",
        impact="评估草案生成后仍需人工走 approve-contract 审批，量化可提前的续约周期。",
        expected="可以：经 dw-sales-crm-execute 触发 draft_contract 能力生成草案，但合同生效仍需人工审批。",
        domain="crm",
        scenario="scenario",
    ),
)

# ---------------------------------------------------------------------------
# HR 域（10 题）
# ---------------------------------------------------------------------------

_HR = (
    _q(
        "q-hr-001",
        question="研发部现有哪些员工，各自名下有几条请假记录？",
        situation="研发排期评审：筛选 employee 中 dept 为「研发」的员工对象。",
        cause="沿 employee→leave-request 链接（employee-leave 1:N）统计每名员工名下请假申请数量。",
        impact="识别高请假频次员工，评估研发项目排期的人力缺口。",
        expected="给出研发部员工名单及各自名下请假记录条数。",
        domain="hr",
        scenario="lookup",
    ),
    _q(
        "q-hr-002",
        question="当前处于待审批状态的请假申请合计多少天，按请假事由如何分布？",
        situation="月度人力盘点：圈选 status 为「pending」的 leave-request 请假对象。",
        cause="按 reason（年假/事假/调休）分组聚合 days 天数。",
        impact="评估待批请假对近期人力供给的占用量，提示审批时效压力。",
        expected="给出 pending 请假总天数及按事由的分布明细。",
        domain="hr",
        scenario="trend",
    ),
    _q(
        "q-hr-003",
        question="请假审批为什么出现积压：是审批流转断链还是申请集中在长假前后？",
        situation="HR 收到员工投诉审批太慢：统计 status 长期停留在 pending 的 leave-request 清单。",
        cause="逐条核对各申请是否已被审批请假（approve-leave）动作处理，并按申请人部门分析申请时间集中度。",
        impact="按积压天数排序给出优先处理队列，估算对员工体验与用工合规的影响。",
        expected="给出积压根因归因（审批流转断链或申请集中）与优先处理清单。",
        domain="hr",
        scenario="root-cause",
    ),
    _q(
        "q-hr-004",
        question="员工李华名下有哪些请假申请，各多少天、什么状态？",
        situation="部门交接核查：定位 name 为「李华」的 employee 对象（EMP-002）。",
        cause="沿 employee→leave-request 链接枚举名下 leave-request 的 days/status/reason 明细。",
        impact="结合请假天数评估其当前工作交接安排是否充分。",
        expected="列出李华名下请假单明细（如 LR-2026-002 事假 1 天 pending）及状态。",
        domain="hr",
        scenario="lookup",
    ),
    _q(
        "q-hr-005",
        question="薪资专员数字员工如何基于请假数据核算某员工当月应扣薪天数？",
        situation="薪资核算自动化评估：定位数字员工 dw-hr-payroll 及其 capabilities（calculate_salary、verify_social_insurance、compute_overtime_fee）。",
        cause="经 dw-hr-payroll-execute 动作下发 calculate_salary 意图，输入引用该员工名下已批准 leave-request 的 days 合计。",
        impact="核算结果需与社保核验（verify_social_insurance）联动，评估错扣风险面。",
        expected="经 dw-hr-payroll-execute 触发 calculate_salary，扣薪天数取该员工已批准请假的 days 合计。",
        domain="hr",
        scenario="scenario",
    ),
    _q(
        "q-hr-006",
        question="若多名员工的长假期申请同时获批，对哪些部门的人力排班冲击最大？",
        situation="长假前人力预警：圈选 days 大于等于 5 的 leave-request 对象。",
        cause="经申请人关联定位其所属部门（dept），按部门聚合同时缺勤人数。",
        impact="计算各部门同时缺勤人数占比，识别需要启动备岗的部门。",
        expected="给出长请假涉及的部门与同时缺勤人数占比，指出冲击最大的部门。",
        domain="hr",
        scenario="impact",
    ),
    _q(
        "q-hr-007",
        question="新员工入职流程中，招聘数字员工能自动完成哪些环节，哪些必须人工？",
        situation="招聘流程自动化评审：定位数字员工 dw-hr-recruiter 及其 capabilities（screen_resume、schedule_interview、initiate_onboarding）。",
        cause="追踪 dw-hr-recruiter-execute 动作的审计日志与邮件通知副作用，逐项对应招聘环节。",
        impact="评估自动化覆盖后人工介入点的减少量，量化入职周期缩短空间。",
        expected="简历筛选、面试排期、入职发起可自动执行，录用决策等关键判断仍需人工。",
        domain="hr",
        scenario="scenario",
    ),
    _q(
        "q-hr-008",
        question="各部门当前的请假人数与请假天数分布是否均衡？",
        situation="组织健康度月报：圈选全部未完结（pending/已批准）的 leave-request 及其申请人。",
        cause="经 employee→leave-request 链接按 dept 聚合请假人数与 days 合计。",
        impact="识别请假集中部门，评估其对部门连续作业能力的风险。",
        expected="给出各部门请假人数与天数的对比分布，指出最不均衡的部门。",
        domain="hr",
        scenario="trend",
    ),
    _q(
        "q-hr-009",
        question="若驳回某员工的长假期申请，对其在办事项与团队排期会产生什么连锁影响？",
        situation="审批人犹豫是否驳回：定位目标 leave-request 及申请人 employee 对象。",
        cause="沿审批请假（approve-leave）的 reject 决策追踪 notify_email/audit_log 副作用触达的通知链。",
        impact="评估该员工原定假期内的工作交接与团队排期是否需要回滚重排。",
        expected="驳回将触发邮件通知与审计日志，其原假期内的排班与交接安排需回滚。",
        domain="hr",
        scenario="impact",
    ),
    _q(
        "q-hr-010",
        question="员工提交的工单当前积压多少，按优先级如何分布？",
        situation="服务台周会：圈选 status 为「open」的 ticket 工单对象。",
        cause="按 priority（high/medium/low）分组统计工单数量，并核对最早创建工单的滞留时长。",
        impact="评估高优工单积压对提交工单的业务部门的影响面。",
        expected="给出 open 工单总数及按优先级的分布，标出积压最久的工单。",
        domain="hr",
        scenario="lookup",
    ),
)

# ---------------------------------------------------------------------------
# IT 域（8 题）
# ---------------------------------------------------------------------------

_IT = (
    _q(
        "q-it-001",
        question="当前 high 优先级且未关闭的工单有哪些，各自滞留了多久？",
        situation="IT 值班交接：筛选 ticket 中 priority 为「high」且 status 为「open」的工单对象。",
        cause="核对每张工单是否已被 IT Service Desk（dw-it-helpdesk）的 classify_ticket 能力分类处理。",
        impact="评估 high 工单滞留对受影响业务系统的风险敞口与升级条件。",
        expected="列出 high+open 工单清单（含 TK-2026-001 登录页偶发 401）及滞留时长。",
        domain="it",
        scenario="lookup",
    ),
    _q(
        "q-it-002",
        question="「登录页偶发 401」工单反复出现，根因可能在认证链路的哪一环？",
        situation="用户集中报障登录失败：定位 title 为「登录页偶发 401」的 ticket 工单（TK-2026-001）。",
        cause="追踪该工单经 classify_ticket 的分类结果与历次处理记录，比对是否与近期发布变更时间吻合。",
        impact="评估 401 复现对所有登录用户的影响范围，确定是否升级为故障事件。",
        expected="给出 401 工单的分类归因（如认证会话异常或发布回归）及影响用户面。",
        domain="it",
        scenario="root-cause",
    ),
    _q(
        "q-it-003",
        question="新员工申请办公设备，IT Service Desk 数字员工能自动走完哪些环节？",
        situation="入职保障演练：定位数字员工 dw-it-helpdesk 及其 capabilities（classify_ticket、reset_password、request_device）。",
        cause="经 dw-it-helpdesk-execute 动作下发 request_device 意图，追踪其生成的设备申请与审计记录。",
        impact="评估设备申请自动化后的交付时长缩短幅度与人工签收保留点。",
        expected="工单分类、密码重置、设备申请三环节可自动执行，资产交付签收仍需人工。",
        domain="it",
        scenario="scenario",
    ),
    _q(
        "q-it-004",
        question="线上告警触发后，DevOps 数字员工的标准响应链路是什么？",
        situation="故障演练复盘：定位数字员工 dw-it-devops 及其 capabilities（trigger_ci、approve_deploy、alert_monitoring）。",
        cause="追踪 dw-it-devops-execute 动作从 alert_monitoring 到 trigger_ci/approve_deploy 的处置顺序与审计留痕。",
        impact="评估告警到恢复的 MTTR 构成，识别必须人工批准部署的卡点。",
        expected="响应链为告警监测→触发 CI→人工批准部署，approve_deploy 是唯一人工卡点。",
        domain="it",
        scenario="scenario",
    ),
    _q(
        "q-it-005",
        question="「报表导出慢」工单的根因是数据量增长还是查询实现缺陷？",
        situation="运营日报屡次超时：定位 title 为「报表导出慢」的 ticket 工单（TK-2026-002）。",
        cause="沿工单处理记录核对 classify_ticket 分类结果，并对比关联数据对象近几个周期的规模变化。",
        impact="评估导出慢对依赖该报表的运营与财务日报时效的影响。",
        expected="给出根因判定（数据量增长或查询实现缺陷）及受影响报表的时效范围。",
        domain="it",
        scenario="root-cause",
    ),
    _q(
        "q-it-006",
        question="工单按优先级的分布近几个周期如何变化，high 占比是否在上升？",
        situation="IT 服务质量月报：按周期圈选全部 ticket 工单的创建记录。",
        cause="按 priority 分组统计各周期工单数，计算 high 占比的环比变化。",
        impact="high 占比上升预示系统性故障风险，评估是否需要增加 DevOps 值守力量。",
        expected="给出各周期工单优先级分布与 high 占比走势及结论。",
        domain="it",
        scenario="trend",
    ),
    _q(
        "q-it-007",
        question="若认证服务故障引发批量密码重置请求，IT Service Desk 的处理容量是否够用？",
        situation="容量压测推演：假设批量员工同时发起密码重置请求。",
        cause="按 dw-it-helpdesk 的 reset_password 能力测算单时处理容量，与请求到达速率对比。",
        impact="评估批量重置场景下的工单积压时长与业务停摆风险，给出限流阈值建议。",
        expected="给出容量测算结论：批量重置下的积压时长与需要人工支援的阈值。",
        domain="it",
        scenario="impact",
    ),
    _q(
        "q-it-008",
        question="open 状态工单中哪些尚未进入 IT Service Desk 的分类处理流程？",
        situation="服务台流程审计：圈选 status 为「open」的 ticket 工单对象。",
        cause="逐张核对工单是否存在 classify_ticket 分类处理痕迹，筛出从未被认领的工单。",
        impact="未分类工单无法进入排期，量化其积压对整体工单时效的拖累。",
        expected="给出未被分类处理的 open 工单清单及其滞留时长。",
        domain="it",
        scenario="lookup",
    ),
)

# ---------------------------------------------------------------------------
# 财务域（10 题）
# ---------------------------------------------------------------------------

_FIN = (
    _q(
        "q-fin-001",
        question="当前全部发票按状态的分布如何，未回款发票占比多少？",
        situation="月度应收例会：圈选 fin.invoice 发票对象全集。",
        cause="按 invoice-status 分组统计张数与 invoice-amount 金额合计。",
        impact="识别长期停留在未回款状态的发票占比，评估应收组合健康度。",
        expected="给出各状态发票张数与金额合计的分布表及未回款占比。",
        domain="finance",
        scenario="lookup",
    ),
    _q(
        "q-fin-002",
        question="金额最高的几张未回款发票分别对应什么业务，催收优先级如何排？",
        situation="月末催收攻坚：按 invoice-amount 降序圈选 invoice-status 为未回款的发票。",
        cause="逐张核对发票对应的订单复核跟进单与开票来源（dw-finance-ar 的 issue_invoice 能力）。",
        impact="汇总大额未回款金额占应收总额的比例，量化催收优先级。",
        expected="列出金额 Top 的未回款发票、业务来源与催收优先级排序。",
        domain="finance",
        scenario="lookup",
    ),
    _q(
        "q-fin-003",
        question="未回款发票按账龄段（30/60/90 天以上）的金额分布如何，是否在恶化？",
        situation="季度坏账评估：圈选 invoice-status 为未回款的发票，按开票时长划分账龄段。",
        cause="追踪长账龄发票是否已被 dw-finance-ar 执行过 reconcile_payment 对账，以及滞留原因。",
        impact="计算 90 天以上账龄占比的周期变化，评估坏账准备计提压力。",
        expected="给出各账龄段金额分布与趋势判断，标出需计提坏账的发票。",
        domain="finance",
        scenario="trend",
    ),
    _q(
        "q-fin-004",
        question="某批发票开票已超 90 天仍未回款，是客户信用问题还是对账未完成？",
        situation="审计抽凭质疑：定位账龄超过 90 天的 fin.invoice 发票集合。",
        cause="逐张核对 reconcile_payment 对账记录与对应客户 credit-level，区分信用风险与流程滞压。",
        impact="按根因分类给出催收动作建议，估算潜在坏账金额。",
        expected="给出回款滞后根因分类（信用风险或对账滞压）及对应催收建议。",
        domain="finance",
        scenario="root-cause",
    ),
    _q(
        "q-fin-005",
        question="订单复核确认之后为何迟迟未生成发票，卡在开票流程哪一步？",
        situation="关账前差异核查：定位已完成 order-review-confirm 复核但名下无 fin.invoice 的订单。",
        cause="检查 dw-finance-ar 的 issue_invoice 动作是否被触发及执行结果。",
        impact="评估开票滞压对回款起算时点的推迟影响，量化滞压金额。",
        expected="给出开票卡点定位（未触发 issue_invoice 或执行失败）与滞压金额。",
        domain="finance",
        scenario="root-cause",
    ),
    _q(
        "q-fin-006",
        question="Finance AR 专员数字员工名下待处理的任务是否过载，需要分流吗？",
        situation="关账排班评估：定位数字员工 dw-finance-ar 及其 capabilities（issue_invoice、reconcile_payment、aging_analysis）。",
        cause="按三类能力统计当前待处理对象数量：待开票订单、未对账发票、长账龄发票。",
        impact="评估任务过载对月结关账时限的风险，给出向 dw-finance-expense 分流的建议。",
        expected="给出 dw-finance-ar 三类待办数量与负载结论，并明确是否需要分流。",
        domain="finance",
        scenario="impact",
    ),
    _q(
        "q-fin-007",
        question="若账龄 90 天以上的发票全部无法收回，对当季利润的冲击有多大？",
        situation="利润压力测试：圈选账龄超过 90 天的 fin.invoice 发票。",
        cause="关联对应客户 credit-level 与订单复核记录，逐张评估可追回性。",
        impact="计算坏账金额占当季确认收入的比例，给出计提与法务追偿建议。",
        expected="给出超 90 天账龄金额、占收入比例与坏账计提建议。",
        domain="finance",
        scenario="impact",
    ),
    _q(
        "q-fin-008",
        question="开票量与开票金额近几个周期呈什么趋势，与订单复核通过量是否匹配？",
        situation="收入确认节奏分析：按周期圈选 fin.invoice 开票记录与订单复核（order-review-confirm）记录。",
        cause="对比两条序列的增速差异，定位开票滞后于复核通过的具体周期。",
        impact="评估滞后周期对应的收入确认延迟金额。",
        expected="给出开票量/金额趋势及与复核通过量的匹配差异与滞后周期。",
        domain="finance",
        scenario="trend",
    ),
    _q(
        "q-fin-009",
        question="报销审核场景下，Expense Auditor 数字员工如何与 AR 专员协同完成关账？",
        situation="关账自动化设计：定位数字员工 dw-finance-expense 及其 capabilities（audit_expense、reimburse、generate_voucher）。",
        cause="追踪 dw-finance-expense-execute 生成凭证（generate_voucher）与 AR 侧 reconcile_payment 对账的衔接点。",
        impact="评估费用报销与应收对账两条流程合并后的关账提速空间。",
        expected="Expense Auditor 完成费用审计与凭证生成后，与 AR 对账流程在关账节点衔接。",
        domain="finance",
        scenario="scenario",
    ),
    _q(
        "q-fin-010",
        question="某客户名下的发票共有几张、金额合计多少、各处于什么状态？",
        situation="客户信用复审：定位目标 crm.customer 客户对象。",
        cause="检索归属该客户的 fin.invoice 发票清单及各自 invoice-status。",
        impact="汇总该客户应收余额，纳入其信用额度与授信策略复核。",
        expected="给出该客户发票张数、金额合计与状态明细。",
        domain="finance",
        scenario="lookup",
    ),
)

# ---------------------------------------------------------------------------
# 跨域（10 题）
# ---------------------------------------------------------------------------

_CROSS = (
    _q(
        "q-cross-001",
        question="某重点客户的 360 度视图：其订单、合同、发票全景如何？",
        situation="大客户经理拜访前准备：定位目标 crm.customer 客户对象。",
        cause="沿 customer→order 链接枚举名下订单，再检索该客户的 crm.contract 合同与 fin.invoice 发票记录。",
        impact="汇总在手订单金额、生效合同与未回款发票的交叉敞口。",
        expected="给出该客户订单/合同/发票全景及未回款敞口合计。",
        domain="cross-domain",
        scenario="lookup",
    ),
    _q(
        "q-cross-002",
        question="从客户下单到开票的全链路中，哪些订单已完结却从未生成发票？",
        situation="收入完整性审计：圈选 order-status 为完结的 crm.order 订单。",
        cause="逐单核对名下 fin.invoice 是否存在，缺失者回溯订单复核（order-review-confirm）是否完成。",
        impact="量化漏开票金额，评估收入确认完整性风险。",
        expected="给出完结但无发票的订单清单与漏开票金额合计。",
        domain="cross-domain",
        scenario="root-cause",
    ),
    _q(
        "q-cross-003",
        question="某部门 high 优先级工单集中爆发，是人员个案还是系统性故障？",
        situation="值班群告警刷屏：圈选 priority 为 high 的 ticket 集合，按提交部门归类。",
        cause="对比部门间工单密度与工单标题相似度，区分个案操作问题与共性系统故障。",
        impact="共性故障应转 dw-it-devops 事件响应，个案走 dw-it-helpdesk，评估处置路径分流。",
        expected="给出工单集中根因判定（个案或共性）与对应的处置路径分流建议。",
        domain="cross-domain",
        scenario="root-cause",
    ),
    _q(
        "q-cross-004",
        question="合同即将到期的客户，其未完结订单与未回款发票是否面临合同依据缺失风险？",
        situation="法务合规盘点：圈选 end-date 临近的 crm.contract 及其关联客户。",
        cause="沿客户检索名下未完结 crm.order 与未回款 fin.invoice，逐笔核对合同到期日覆盖情况。",
        impact="量化合同到期后失去结算依据的订单与发票金额。",
        expected="给出到期合同客户名下受影响订单/发票的金额清单。",
        domain="cross-domain",
        scenario="root-cause",
    ),
    _q(
        "q-cross-005",
        question="研发员工集中请假期间，其相关的 IT 工单处理是否出现积压恶化？",
        situation="长假后复盘：圈选研发部门员工的 pending leave-request 与同期的 open ticket。",
        cause="对比请假窗口前后 open 工单数量与优先级变化，定位人力缺位与工单积压的关联。",
        impact="量化请假期间工单积压增量，评估备岗机制的有效性。",
        expected="给出请假窗口内外工单积压对比与备岗改进建议。",
        domain="cross-domain",
        scenario="impact",
    ),
    _q(
        "q-cross-006",
        question="客户因发票争议提交的工单若处理超时，会否拖累其后续下单？",
        situation="客户成功预警：定位涉及发票争议的 ticket 工单及关联 crm.customer。",
        cause="追踪 close-ticket 处理时效与该客户后续订单下单间隔的关联。",
        impact="量化服务超时客户与正常客户的复购差异，评估挽留成本。",
        expected="给出发票争议工单处理时效与客户复购变化的关联结论。",
        domain="cross-domain",
        scenario="impact",
    ),
    _q(
        "q-cross-007",
        question="用户一句「把这个月逾期的发票都催一遍」，SuperAI 如何编排数字员工完成？",
        situation="数字员工编排演示：定位 superai-orchestrator 及其 capabilities（detect_intent、match_employee、plan_task、aggregate_result）。",
        cause="追踪 superai-orchestrate 动作链：意图解析→匹配 dw-finance-ar（aging_analysis/reconcile_payment）→汇总结果。",
        impact="评估编排链路每步的审计留痕与失败重试策略对催收完成率的影响。",
        expected="SuperAI 经意图解析匹配 dw-finance-ar 执行催收对账并聚合结果，全程审计留痕。",
        domain="cross-domain",
        scenario="scenario",
    ),
    _q(
        "q-cross-008",
        question="季度结算场景下，财务、HR、IT 三域数字员工应以什么顺序协同？",
        situation="季度关账演练：圈选 dw-finance-ar、dw-hr-payroll、dw-it-devops 三个数字员工及其 capabilities。",
        cause="按依赖排序：dw-it-devops 保障系统可用→dw-hr-payroll 完成薪资核算→dw-finance-ar 关账对账。",
        impact="评估可并行环节与关键路径时长，量化结算周期缩短潜力。",
        expected="给出三域数字员工协同顺序（IT 保障→HR 薪资→AR 关账）与关键路径。",
        domain="cross-domain",
        scenario="scenario",
    ),
    _q(
        "q-cross-009",
        question="客户订单金额、开票金额、回款金额三条曲线是否同步，剪刀差出现在哪个环节？",
        situation="经营现金流分析：按周期对齐 crm.order 的 order-amount、fin.invoice 开票金额与回款金额。",
        cause="逐周期计算订单→开票→回款的转化率，定位衰减最大的环节。",
        impact="量化剪刀差对应的资金占用规模，提示流程改进优先级。",
        expected="给出三曲线转化率、剪刀差定位环节及资金占用规模。",
        domain="cross-domain",
        scenario="trend",
    ),
    _q(
        "q-cross-010",
        question="新客户从签约到回款的完整旅程中，哪些环节有数字员工兜底、哪些纯靠人工？",
        situation="端到端流程盘点：圈选合同审批（approve-contract）→订单复核（order-review-confirm）→开票（dw-finance-ar issue_invoice）→回款（reconcile_payment）各环节。",
        cause="逐环节标注执行主体：人工审批与数字员工能力（dw-sales-crm/dw-finance-ar）的分工边界。",
        impact="识别纯人工环节的自动化优先级，估算端到端周期缩短空间。",
        expected="给出各环节执行主体清单与最值得自动化的优先环节。",
        domain="cross-domain",
        scenario="scenario",
    ),
)


def build_question_bank() -> list[EvaluationQuestion]:
    """构建 50 题业务题库（CRM 12 / HR 10 / IT 8 / 财务 10 / 跨域 10）。

    返回顺序按域分组、组内按 id 递增；每次调用返回等价新列表（frozen
    dataclass，可安全共享）。分布与场景类型由
    ``tests/test_ont_question_bank.py`` 门禁锁定。
    """
    return [*_CRM, *_HR, *_IT, *_FIN, *_CROSS]
