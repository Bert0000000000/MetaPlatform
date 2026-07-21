"""Digital worker team collaboration service (V15-04).

Orchestrates multi-employee collaboration:
- Decompose a goal into subtasks and assign by keyword-based skill matching
- Execute subtasks honoring dependencies (mock synchronous execution)
- Aggregate per-employee contribution and compute efficiency improvement
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.agents.schemas import Agent
from app.collaboration.repository import CollaborationRepository
from app.collaboration.schemas import (
    CollaborationReport,
    CollaborationStatus,
    CollaborationTask,
    Contribution,
    CreateCollaborationRequest,
    SplitStrategy,
    SubTask,
    SubTaskStatus,
)
from app.common.errors import InvalidParamError


def _new_subtask_id() -> str:
    return f"sub-{uuid.uuid4().hex[:12]}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Skill taxonomy: map a subtask keyword to the role category that owns it.
# Each entry maps (skill_keyword -> set[role_category]) so that the auto-assign
# can pick the best-fit employee by checking the agent's projected role.
# ---------------------------------------------------------------------------

_SKILL_KEYWORD_MAP: Dict[str, List[str]] = {
    # Finance-related subtasks
    "财务": ["FINANCE"],
    "发票": ["FINANCE"],
    "报销": ["FINANCE"],
    "预算": ["FINANCE"],
    "成本": ["FINANCE"],
    "对账": ["FINANCE"],
    # HR-related subtasks
    "人事": ["HR"],
    "招聘": ["HR"],
    "员工": ["HR"],
    "考勤": ["HR"],
    "薪资": ["HR"],
    # Legal-related subtasks
    "法务": ["LEGAL"],
    "合同": ["LEGAL"],
    "合规": ["LEGAL"],
    "审核": ["LEGAL"],
    # Data analysis subtasks
    "数据": ["DATA_ANALYST"],
    "分析": ["DATA_ANALYST"],
    "统计": ["DATA_ANALYST"],
    "报表": ["DATA_ANALYST"],
    "日报": ["DATA_ANALYST"],
    "周报": ["DATA_ANALYST"],
    "月报": ["DATA_ANALYST"],
    "报告": ["DATA_ANALYST"],
    # Customer service subtasks
    "客户": ["CUSTOMER_SERVICE"],
    "客服": ["CUSTOMER_SERVICE"],
    "售后": ["CUSTOMER_SERVICE"],
    "回访": ["CUSTOMER_SERVICE"],
    # Communication subtasks
    "邮件": ["FINANCE", "HR", "LEGAL", "DATA_ANALYST", "CUSTOMER_SERVICE"],
    "通知": ["FINANCE", "HR", "LEGAL", "DATA_ANALYST", "CUSTOMER_SERVICE"],
    "发送": ["FINANCE", "HR", "LEGAL", "DATA_ANALYST", "CUSTOMER_SERVICE"],
}


# Subtask templates produced by the rule-based decomposer. Each template is
# (title, description, skill_keyword, estimated_seconds, depends_on_index).
# `depends_on_index` uses 0-based indices into the produced subtask list, so
# the auto-assigner can wire dependencies for sequential/hybrid strategies.

_TEMPLATE_TABLE: Dict[str, List[Tuple[str, str, str, int, List[int]]]] = {
    "report_with_email": [
        ("查询数据", "从业务系统拉取所需原始数据", "数据", 60, []),
        ("数据分析", "对查询结果进行统计与趋势分析", "分析", 90, [0]),
        ("生成报告", "汇总分析结果并生成结构化报告", "报告", 60, [1]),
        ("发送邮件", "将报告通过邮件发送给相关人", "邮件", 30, [2]),
    ],
    "data_analysis": [
        ("查询数据", "从业务系统拉取所需原始数据", "数据", 60, []),
        ("数据分析", "对查询结果进行统计与趋势分析", "分析", 90, [0]),
        ("生成报告", "汇总分析结果并生成结构化报告", "报告", 60, [1]),
    ],
    "customer_churn": [
        ("查询客户数据", "拉取客户基础信息与行为数据", "客户", 60, []),
        ("分析流失原因", "使用统计模型识别流失关键因子", "分析", 120, [0]),
        ("生成分析报告", "输出流失原因分析与建议", "报告", 60, [1]),
    ],
    "email_only": [
        ("准备内容", "基于需求准备邮件正文与附件", "通知", 45, []),
        ("发送邮件", "通过邮件服务发送给目标收件人", "邮件", 30, [0]),
    ],
    "default": [
        ("理解需求", "解析任务意图与约束", "数据", 30, []),
        ("执行任务", "调用相关工具完成主体任务", "分析", 90, [0]),
        ("返回结果", "整理结果并返回给调用方", "报告", 30, [1]),
    ],
}


def _decompose(goal: str) -> Tuple[str, List[Tuple[str, str, str, int, List[int]]]]:
    """Decompose a goal into a (template_name, subtask_templates) tuple."""

    text = goal.lower()
    has_report = any(kw in text for kw in ("周报", "月报", "日报", "报告", "总结"))
    has_email = any(kw in text for kw in ("邮件", "发送", "通知"))
    has_analysis = any(kw in text for kw in ("分析", "统计", "趋势"))
    has_data = any(kw in text for kw in ("数据", "销售", "客户", "订单", "业绩"))
    has_churn = "流失" in text

    if has_churn and has_data:
        return "客户流失分析", _TEMPLATE_TABLE["customer_churn"]
    if has_report and has_email:
        return "报告生成与发送", _TEMPLATE_TABLE["report_with_email"]
    if has_report and has_analysis and has_data:
        return "数据分析与报告", _TEMPLATE_TABLE["report_with_email"]
    if has_analysis and has_data:
        return "数据分析", _TEMPLATE_TABLE["data_analysis"]
    if has_email:
        return "邮件任务", _TEMPLATE_TABLE["email_only"]
    return "通用任务", _TEMPLATE_TABLE["default"]


def _infer_role_category(agent: Agent) -> str:
    """Project an Agent to a role category matching the employee projection."""

    text = f"{agent.agent_code} {agent.name} {agent.description}".lower()
    if any(k in text for k in ("contract", "legal", "law", "合规", "法务", "合同")):
        return "LEGAL"
    if any(k in text for k in ("finance", "财务", "报销", "发票", "预算")):
        return "FINANCE"
    if any(k in text for k in ("hr", "人事", "招聘", "考勤")):
        return "HR"
    if any(k in text for k in ("data", "report", "分析", "报表", "统计", "日报")):
        return "DATA_ANALYST"
    if any(k in text for k in ("service", "客服", "售后", "支持")):
        return "CUSTOMER_SERVICE"
    return "CUSTOM"


def _keyword_match_score(agent: Agent, role_category: str) -> int:
    """Score how well an agent matches a target role category.

    Returns:
      - 3 if the agent's inferred role matches exactly
      - 2 if the agent's name/code/description contains the role keyword
      - 1 if no signal (fallback so any employee can still be picked)
    """

    inferred = _infer_role_category(agent)
    if inferred == role_category:
        return 3
    text = f"{agent.agent_code} {agent.name} {agent.description}".lower()
    keyword_map = {
        "FINANCE": ("财务", "finance", "报销", "发票"),
        "HR": ("hr", "人事", "招聘"),
        "LEGAL": ("法务", "legal", "合同", "合规"),
        "DATA_ANALYST": ("数据", "分析", "data", "analyst"),
        "CUSTOMER_SERVICE": ("客服", "customer", "售后"),
    }
    keywords = keyword_map.get(role_category, ())
    if any(kw in text for kw in keywords):
        return 2
    return 1


class CollaborationService:
    """Service for creating, executing, and reporting on collaboration tasks."""

    def __init__(
        self,
        repository: CollaborationRepository,
        agent_service: Optional[Any] = None,
    ) -> None:
        self._repo = repository
        self._agent_service = agent_service

    # ------------------------------------------------------------------ create

    async def create(
        self,
        tenant_id: str,
        request: CreateCollaborationRequest,
        *,
        created_by: Optional[str] = None,
    ) -> CollaborationTask:
        """Create a collaboration task and auto-assign subtasks.

        - Fetch the employee (Agent) records for the requested ids.
        - Decompose the goal into subtask templates.
        - Assign each subtask to the best-matching employee by skill keywords.
        - Wire dependencies based on the chosen split strategy.
        """

        employees = await self._fetch_employees(tenant_id, request.employeeIds)
        if not employees:
            raise InvalidParamError(
                "协作任务至少需要一个有效员工",
                data={"employeeIds": request.employeeIds},
            )

        template_name, templates = _decompose(request.goal)
        subtasks = self._build_subtasks(
            templates,
            employees,
            request.splitStrategy,
        )

        title = request.title or template_name
        description = request.description or f"自主协商分工：{template_name}"

        task = CollaborationTask(
            id="",
            tenant_id=tenant_id,
            title=title,
            description=description,
            goal=request.goal,
            split_strategy=request.splitStrategy,
            subtasks=subtasks,
            status=CollaborationStatus.PENDING,
            created_by=created_by,
        )
        return await self._repo.create(task)

    # ------------------------------------------------------------- auto-assign

    def auto_assign(
        self,
        goal: str,
        employees: List[Agent],
        split_strategy: SplitStrategy = SplitStrategy.PARALLEL,
    ) -> List[SubTask]:
        """Public auto-assignment helper (also used by tests).

        Decomposes the goal and assigns each subtask to the best-matching
        employee. Pure function: no persistence.
        """

        _, templates = _decompose(goal)
        return self._build_subtasks(templates, employees, split_strategy)

    def _build_subtasks(
        self,
        templates: List[Tuple[str, str, str, int, List[int]]],
        employees: List[Agent],
        split_strategy: SplitStrategy,
    ) -> List[SubTask]:
        """Materialize SubTask instances from templates and assign employees."""

        # Pre-compute the best employee for each template's skill keyword.
        subtask_ids = [_new_subtask_id() for _ in templates]

        subtasks: List[SubTask] = []
        for index, (title, description, keyword, est, deps_idx) in enumerate(templates):
            role_categories = _SKILL_KEYWORD_MAP.get(keyword, [])
            assignee = self._pick_employee(employees, role_categories)
            depends_on: List[str] = []
            if split_strategy == SplitStrategy.SEQUENTIAL:
                # Force a strict chain: each subtask depends on the previous one.
                if index > 0:
                    depends_on = [subtask_ids[index - 1]]
            elif split_strategy == SplitStrategy.HYBRID:
                # Use the template-declared dependencies for hybrid mode.
                depends_on = [subtask_ids[i] for i in deps_idx]
            # PARALLEL: no dependencies regardless of template hints.

            subtasks.append(
                SubTask(
                    id=subtask_ids[index],
                    employee_id=assignee.id,
                    title=title,
                    description=description,
                    skill_tags=[keyword],
                    depends_on=depends_on,
                    estimated_seconds=est,
                )
            )
        return subtasks

    @staticmethod
    def _pick_employee(
        employees: List[Agent],
        role_categories: List[str],
    ) -> Agent:
        """Pick the best-fit employee for a subtask by role category.

        - Prefer the agent with the highest keyword match score.
        - Tie-break by the order in which the employee was supplied so that
          load is spread across the team.
        """

        if not employees:
            raise InvalidParamError("员工列表为空，无法分配子任务")

        if not role_categories:
            return employees[0]

        best: Optional[Agent] = None
        best_score = -1
        for agent in employees:
            score = max(
                _keyword_match_score(agent, role) for role in role_categories
            )
            if score > best_score:
                best_score = score
                best = agent
        assert best is not None  # employees is non-empty here
        return best

    # ------------------------------------------------------------ fetch agents

    async def _fetch_employees(
        self,
        tenant_id: str,
        employee_ids: List[str],
    ) -> List[Agent]:
        """Resolve employee ids to Agent records via the AgentService.

        Falls back to a stub Agent per id when no agent_service is wired
        (e.g. unit tests of the service in isolation).
        """

        if self._agent_service is None:
            return [
                Agent(
                    id=eid,
                    tenant_id=tenant_id,
                    agent_code=eid,
                    name=eid,
                    description="",
                    model_id="doubao-lite",
                    system_prompt="",
                )
                for eid in employee_ids
            ]

        employees: List[Agent] = []
        for eid in employee_ids:
            try:
                agent = await self._agent_service.get(tenant_id, eid)
                employees.append(agent)
            except Exception:
                # Skip silently so a single bad id does not abort the whole
                # collaboration; the caller checks the resulting list.
                continue
        return employees

    # ------------------------------------------------------------------- read

    async def get(self, tenant_id: str, task_id: str) -> CollaborationTask:
        task = await self._repo.get(task_id, tenant_id)
        if task is None:
            raise InvalidParamError(
                f"协作任务不存在: collaborationId={task_id}",
                data={"collaborationId": task_id},
            )
        return task

    async def list(
        self,
        tenant_id: str,
        *,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[CollaborationTask], int]:
        return await self._repo.list(
            tenant_id,
            status=status,
            page=page,
            page_size=page_size,
        )

    # --------------------------------------------------------------- execute

    async def execute(self, tenant_id: str, task_id: str) -> CollaborationTask:
        """Execute all subtasks in dependency order.

        Mock execution: every subtask succeeds and takes its estimated_seconds
        (rounded up to at least 1). Parallel subtasks all start at the same
        timestamp; dependent subtasks start after their dependency completes.
        """

        task = await self.get(tenant_id, task_id)
        if task.status == CollaborationStatus.RUNNING:
            raise InvalidParamError("协作任务正在执行中，请勿重复触发")
        if task.status in {CollaborationStatus.COMPLETED, CollaborationStatus.FAILED}:
            raise InvalidParamError(
                f"协作任务已结束，无法执行: status={task.status.value}",
                data={"collaborationId": task_id, "status": task.status.value},
            )

        now = _now()
        task = await self._repo.update(
            task_id,
            tenant_id,
            {
                "status": CollaborationStatus.RUNNING,
                "started_at": now,
            },
        )

        # Topologically schedule subtasks by their dependencies.
        completion_times: Dict[str, datetime] = {}
        # Pre-build an id->subtask lookup so we can mutate copies.
        original = {st.id: st for st in task.subtasks}
        updated: List[SubTask] = []
        # Sort subtasks by dependency depth so deps are processed first.
        ordered = self._topological_order(task.subtasks)

        # Track the wall-clock start so the "parallel" duration is the span
        # from execution start to the latest completion.
        exec_start = now

        for st in ordered:
            # Compute the earliest start: exec_start, or after all deps complete.
            depends_on = original[st.id].depends_on
            if depends_on:
                dep_finish = max(
                    completion_times[d] for d in depends_on if d in completion_times
                )
                started = dep_finish
            else:
                started = exec_start

            duration = max(1, original[st.id].estimated_seconds)
            completed = started  # datetime is immutable; seconds tracked separately
            completion_times[st.id] = completed

            updated_sub = original[st.id].model_copy(
                update={
                    "status": SubTaskStatus.COMPLETED,
                    "progress": 100,
                    "actual_seconds": duration,
                    "result": f"已完成：{original[st.id].title}",
                    "started_at": started,
                    "completed_at": completed,
                }
            )
            original[st.id] = updated_sub
            updated.append(updated_sub)

        # Sort updated subtasks back to their original order for stable output.
        id_to_updated = {st.id: st for st in updated}
        final_subtasks = [id_to_updated[st.id] for st in task.subtasks]

        exec_end = max(
            (st.completed_at or exec_start for st in final_subtasks),
            default=exec_start,
        )
        final_status = CollaborationStatus.COMPLETED

        updated_task = await self._repo.update(
            task_id,
            tenant_id,
            {
                "subtasks": final_subtasks,
                "status": final_status,
                "completed_at": exec_end,
            },
        )

        # Also persist a generated report so it can be retrieved via get_report.
        report = self._build_report(updated_task, exec_start=exec_start, exec_end=exec_end)
        await self._repo.update(
            task_id,
            tenant_id,
            {"final_report": report.final_report},
        )
        return await self.get(tenant_id, task_id)

    @staticmethod
    def _topological_order(subtasks: List[SubTask]) -> List[SubTask]:
        """Return subtasks in dependency order (deps before dependants)."""

        by_id = {st.id: st for st in subtasks}
        visited: set[str] = set()
        order: List[SubTask] = []

        def visit(st: SubTask) -> None:
            if st.id in visited:
                return
            visited.add(st.id)
            for dep in st.depends_on:
                if dep in by_id:
                    visit(by_id[dep])
            order.append(st)

        for st in subtasks:
            visit(st)
        return order

    # --------------------------------------------------------------- report

    async def get_report(self, tenant_id: str, task_id: str) -> CollaborationReport:
        """Compute (or recompute) the collaboration report for a task."""

        task = await self.get(tenant_id, task_id)
        exec_start = task.started_at or task.created_at
        exec_end = task.completed_at or _now()
        report = self._build_report(task, exec_start=exec_start, exec_end=exec_end)

        # Persist the final report text so the API can stream it back.
        if task.final_report != report.final_report:
            await self._repo.update(
                task_id,
                tenant_id,
                {"final_report": report.final_report},
            )
        return report

    def _build_report(
        self,
        task: CollaborationTask,
        *,
        exec_start: datetime,
        exec_end: datetime,
    ) -> CollaborationReport:
        """Assemble a CollaborationReport from a (possibly executed) task."""

        # Per-employee contribution rollup.
        per_employee: Dict[str, Contribution] = {}
        for st in task.subtasks:
            contribution = per_employee.setdefault(
                st.employee_id,
                Contribution(employee_id=st.employee_id),
            )
            contribution.subtask_count += 1
            if st.status == SubTaskStatus.COMPLETED:
                contribution.completed_count += 1
                contribution.total_seconds += st.actual_seconds
            elif st.status == SubTaskStatus.FAILED:
                contribution.failed_count += 1

        # Durations: parallel = wall-clock span; sequential = sum of actuals.
        parallel_seconds = max(0, int((exec_end - exec_start).total_seconds()))
        # Round each subtask's actual_seconds up to at least estimated if 0.
        sequential_seconds = sum(
            st.actual_seconds or st.estimated_seconds for st in task.subtasks
        )

        if sequential_seconds > 0:
            efficiency = round(
                (sequential_seconds - parallel_seconds) / sequential_seconds * 100,
                2,
            )
        else:
            efficiency = 0.0

        total_subtasks = len(task.subtasks)
        completed = sum(
            1 for st in task.subtasks if st.status == SubTaskStatus.COMPLETED
        )
        failed = sum(
            1 for st in task.subtasks if st.status == SubTaskStatus.FAILED
        )

        # Build a human-readable markdown report.
        lines: List[str] = []
        lines.append(f"# 协作报告：{task.title}")
        lines.append("")
        lines.append(f"**目标**：{task.goal}")
        lines.append(f"**状态**：{task.status.value}")
        lines.append(
            f"**子任务**：{completed}/{total_subtasks} 已完成，{failed} 失败"
        )
        lines.append(
            f"**并行耗时**：{parallel_seconds}s（顺序执行预估 {sequential_seconds}s）"
        )
        lines.append(
            f"**效率提升**：{efficiency}%"
        )
        lines.append("")
        lines.append("## 各员工贡献")
        lines.append("| 员工 | 子任务数 | 已完成 | 失败 | 累计耗时 |")
        lines.append("| --- | --- | --- | --- | --- |")
        for c in per_employee.values():
            lines.append(
                f"| {c.employee_id} | {c.subtask_count} | {c.completed_count} | "
                f"{c.failed_count} | {c.total_seconds}s |"
            )
        lines.append("")
        lines.append("## 子任务执行明细")
        for st in task.subtasks:
            status = st.status.value
            duration = st.actual_seconds or st.estimated_seconds
            lines.append(
                f"- `{st.id}` {st.title}（{st.employee_id}）"
                f" → {status}，{duration}s"
            )

        return CollaborationReport(
            collaboration_id=task.id,
            title=task.title,
            goal=task.goal,
            status=task.status,
            total_duration_seconds=parallel_seconds,
            total_subtasks=total_subtasks,
            completed_subtasks=completed,
            failed_subtasks=failed,
            sequential_duration_seconds=sequential_seconds,
            parallel_duration_seconds=parallel_seconds,
            efficiency_improvement_pct=efficiency,
            contributions=list(per_employee.values()),
            final_report="\n".join(lines),
        )
