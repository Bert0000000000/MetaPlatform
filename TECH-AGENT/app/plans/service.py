"""Service for autonomous task plan generation & execution (V15-02)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from app.common.errors import InvalidParamError
from app.plans.repository import PlanRepository
from app.plans.schemas import (
    CreatePlanRequest,
    Plan,
    PlanStatus,
    PlanStep,
    PlanStepStatus,
)


def _new_step_id() -> str:
    return f"step-{uuid.uuid4().hex[:16]}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Mock plan templates: rule-based decomposition by keyword matching.
# ---------------------------------------------------------------------------

def _build_data_analysis_steps(user_input: str) -> List[PlanStep]:
    return [
        PlanStep(
            id=_new_step_id(),
            title="查询数据",
            description=f"根据需求「{user_input[:60]}」查询所需数据源",
            action="query_data",
            order=0,
            requires_approval=True,
        ),
        PlanStep(
            id=_new_step_id(),
            title="数据分析",
            description="对查询结果进行统计分析与可视化",
            action="analyze_data",
            order=1,
            requires_approval=True,
        ),
        PlanStep(
            id=_new_step_id(),
            title="生成报告",
            description="汇总分析结果并生成结构化报告",
            action="generate_report",
            order=2,
            requires_approval=True,
        ),
    ]


def _build_report_with_email_steps(user_input: str) -> List[PlanStep]:
    return [
        PlanStep(
            id=_new_step_id(),
            title="查询数据",
            description=f"根据需求「{user_input[:60]}」查询业务数据",
            action="query_data",
            order=0,
            requires_approval=True,
        ),
        PlanStep(
            id=_new_step_id(),
            title="数据分析",
            description="对数据进行统计与趋势分析",
            action="analyze_data",
            order=1,
            requires_approval=True,
        ),
        PlanStep(
            id=_new_step_id(),
            title="生成报告",
            description="生成周报/月报/日报文档",
            action="generate_report",
            order=2,
            requires_approval=True,
        ),
        PlanStep(
            id=_new_step_id(),
            title="发送邮件",
            description="将报告通过邮件发送给相关人",
            action="send_email",
            order=3,
            requires_approval=True,
        ),
    ]


def _build_customer_churn_steps(user_input: str) -> List[PlanStep]:
    return [
        PlanStep(
            id=_new_step_id(),
            title="查询客户数据",
            description=f"拉取客户相关数据：{user_input[:60]}",
            action="query_customer_data",
            order=0,
            requires_approval=True,
        ),
        PlanStep(
            id=_new_step_id(),
            title="分析流失原因",
            description="使用统计模型识别流失关键因子",
            action="analyze_churn",
            order=1,
            requires_approval=True,
        ),
        PlanStep(
            id=_new_step_id(),
            title="生成分析报告",
            description="输出流失原因分析与建议",
            action="generate_report",
            order=2,
            requires_approval=True,
        ),
    ]


def _build_email_steps(user_input: str) -> List[PlanStep]:
    return [
        PlanStep(
            id=_new_step_id(),
            title="准备内容",
            description=f"基于需求「{user_input[:60]}」准备邮件正文与附件",
            action="prepare_content",
            order=0,
            requires_approval=True,
        ),
        PlanStep(
            id=_new_step_id(),
            title="发送邮件",
            description="通过邮件服务发送给目标收件人",
            action="send_email",
            order=1,
            requires_approval=True,
        ),
    ]


def _build_default_steps(user_input: str) -> List[PlanStep]:
    return [
        PlanStep(
            id=_new_step_id(),
            title="理解需求",
            description=f"解析任务意图：{user_input[:60]}",
            action="understand_intent",
            order=0,
            requires_approval=False,
        ),
        PlanStep(
            id=_new_step_id(),
            title="执行任务",
            description="调用相关工具与 Action 完成任务",
            action="execute_task",
            order=1,
            requires_approval=True,
        ),
        PlanStep(
            id=_new_step_id(),
            title="返回结果",
            description="整理结果并返回给用户",
            action="return_result",
            order=2,
            requires_approval=False,
        ),
    ]


def _decompose(user_input: str) -> tuple[str, List[PlanStep]]:
    """Decompose user input into ordered steps via keyword rules."""

    text = user_input.lower()

    has_report = any(
        kw in text for kw in ("周报", "月报", "日报", "报告", "总结")
    )
    has_email = any(kw in text for kw in ("邮件", "发送", "通知"))
    has_analysis = any(kw in text for kw in ("分析", "统计", "趋势"))
    has_data = any(kw in text for kw in ("数据", "销售", "客户", "订单", "业绩"))
    has_churn = "流失" in text

    if has_churn and has_data:
        return "客户流失分析", _build_customer_churn_steps(user_input)
    if has_report and has_email:
        return "报告生成与发送", _build_report_with_email_steps(user_input)
    if has_report and has_analysis and has_data:
        return "数据分析与报告", _build_report_with_email_steps(user_input)
    if has_analysis and has_data:
        return "数据分析", _build_data_analysis_steps(user_input)
    if has_email:
        return "邮件任务", _build_email_steps(user_input)
    return "通用任务", _build_default_steps(user_input)


class PlanService:
    """Service for plan generation, approval, and mock execution."""

    def __init__(self, repository: PlanRepository) -> None:
        self._repo = repository

    async def create(
        self,
        tenant_id: str,
        request: CreatePlanRequest,
    ) -> Plan:
        title, steps = _decompose(request.userInput)
        plan = Plan(
            id="",
            tenant_id=tenant_id,
            title=request.title or title,
            description=f"自主分解任务：{title}",
            user_input=request.userInput,
            agent_id=request.agentId,
            status=PlanStatus.READY,
            steps=steps,
        )
        return await self._repo.create(plan)

    async def get(self, tenant_id: str, plan_id: str) -> Plan:
        plan = await self._repo.get(plan_id, tenant_id)
        if plan is None:
            raise InvalidParamError(
                f"计划不存在: planId={plan_id}",
                data={"planId": plan_id},
            )
        return plan

    async def list(
        self,
        tenant_id: str,
        *,
        agent_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[List[Plan], int]:
        return await self._repo.list(
            tenant_id,
            agent_id=agent_id,
            page=page,
            page_size=page_size,
        )

    async def approve_step(
        self,
        tenant_id: str,
        plan_id: str,
        step_id: str,
    ) -> Plan:
        plan = await self.get(tenant_id, plan_id)
        self._require_status(plan, {PlanStatus.READY, PlanStatus.RUNNING})

        updated_steps: list[PlanStep] = []
        for s in plan.steps:
            if s.id == step_id:
                if s.status != PlanStepStatus.PENDING:
                    raise InvalidParamError(
                        f"步骤当前状态不允许批准: status={s.status.value}",
                        data={"stepId": step_id, "status": s.status.value},
                    )
                updated_steps.append(
                    s.model_copy(update={"status": PlanStepStatus.APPROVED})
                )
            else:
                updated_steps.append(s)

        return await self._repo.update(
            plan_id,
            tenant_id,
            {"steps": updated_steps},
        )

    async def skip_step(
        self,
        tenant_id: str,
        plan_id: str,
        step_id: str,
    ) -> Plan:
        plan = await self.get(tenant_id, plan_id)
        self._require_status(plan, {PlanStatus.READY, PlanStatus.RUNNING})

        updated_steps: list[PlanStep] = []
        for s in plan.steps:
            if s.id == step_id:
                if s.status in {
                    PlanStepStatus.COMPLETED,
                    PlanStepStatus.RUNNING,
                    PlanStepStatus.SKIPPED,
                }:
                    raise InvalidParamError(
                        f"步骤当前状态不允许跳过: status={s.status.value}",
                        data={"stepId": step_id, "status": s.status.value},
                    )
                updated_steps.append(
                    s.model_copy(update={"status": PlanStepStatus.SKIPPED})
                )
            else:
                updated_steps.append(s)

        return await self._repo.update(
            plan_id,
            tenant_id,
            {"steps": updated_steps},
        )

    async def execute(self, tenant_id: str, plan_id: str) -> Plan:
        plan = await self.get(tenant_id, plan_id)
        if plan.status == PlanStatus.RUNNING:
            raise InvalidParamError("计划正在执行中，请勿重复触发")
        if plan.status in {PlanStatus.COMPLETED, PlanStatus.CANCELLED}:
            raise InvalidParamError(
                f"计划已结束，无法执行: status={plan.status.value}"
            )

        # Mark the plan as RUNNING, then iterate through steps:
        # - skipped/approved steps remain unchanged
        # - approved or auto-runnable steps execute to completion (mock)
        # - steps requiring approval without prior approval stay PENDING
        now = _now()
        running_fields: dict[str, Any] = {"status": PlanStatus.RUNNING}
        plan = await self._repo.update(plan_id, tenant_id, running_fields)

        updated_steps: list[PlanStep] = []
        for s in plan.steps:
            if s.status in {
                PlanStepStatus.SKIPPED,
                PlanStepStatus.COMPLETED,
                PlanStepStatus.FAILED,
            }:
                updated_steps.append(s)
                continue

            if s.requires_approval and s.status != PlanStepStatus.APPROVED:
                # Stop execution at the first step that still requires approval.
                updated_steps.append(s)
                continue

            # Mock step execution: always succeeds.
            updated_step = s.model_copy(
                update={
                    "status": PlanStepStatus.COMPLETED,
                    "started_at": now,
                    "completed_at": now,
                    "output": {"mock": True, "action": s.action},
                }
            )
            updated_steps.append(updated_step)

        # Determine final plan status.
        final_status: PlanStatus
        if any(s.status == PlanStepStatus.FAILED for s in updated_steps):
            final_status = PlanStatus.FAILED
        elif all(
            s.status in {PlanStepStatus.COMPLETED, PlanStepStatus.SKIPPED}
            for s in updated_steps
        ):
            final_status = PlanStatus.COMPLETED
        else:
            # Some steps still pending (e.g. awaiting approval) — pause.
            final_status = PlanStatus.RUNNING

        return await self._repo.update(
            plan_id,
            tenant_id,
            {"steps": updated_steps, "status": final_status},
        )

    @staticmethod
    def _require_status(plan: Plan, allowed: set[PlanStatus]) -> None:
        if plan.status not in allowed:
            raise InvalidParamError(
                f"计划当前状态不允许操作: status={plan.status.value}",
                data={"planId": plan.id, "status": plan.status.value},
            )
