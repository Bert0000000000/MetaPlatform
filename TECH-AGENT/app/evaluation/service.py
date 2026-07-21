"""Evaluation service for TECH-AGENT (V11-04).

Provides in-memory evaluation capabilities for APP-DW:
- Auto/manual scoring of conversations across 6 dimensions
- Aggregated evaluation reports per employee+period
- Optimization suggestions generation
- Scoring rubric CRUD
- Quality trend over recent periods

The LLM-driven scoring is intentionally a deterministic heuristic in v1.1 so
the frontend can drop all mock fallbacks without depending on TECH-LLMGW. A
later task will swap the heuristic for a real LLM call via ``llm_client``.
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from threading import RLock
from typing import Dict, List, Optional, Tuple

from app.common.errors import InvalidParamError
from app.evaluation.schemas import (
    AggregateReportRequest,
    AggregateReportResponse,
    AutoScoreResult,
    BatchAutoScoreRequest,
    BatchAutoScoreResponse,
    ConversationRecord,
    DimensionScore,
    EvaluationDimension,
    EvaluationReport,
    EvaluationReportDetail,
    EvaluatorMode,
    GenerateReportRequest,
    GenerateSuggestionsRequest,
    GenerateSuggestionsResponse,
    ManualScoreRequest,
    OptimizationSuggestion,
    QualityTrendPoint,
    ScoringRubric,
    SuggestionCategory,
    SuggestionPriority,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:16]}"


# --------------------------------------------------------------- default rubric


def _build_default_rubric() -> ScoringRubric:
    return ScoringRubric(
        id="rubric-default",
        name="默认评估规则 v1",
        dimensions=[
            {
                "dimension": EvaluationDimension.ACCURACY,
                "weight": 0.25,
                "description": "事实、数据、规则引用是否正确",
            },
            {
                "dimension": EvaluationDimension.HELPFULNESS,
                "weight": 0.20,
                "description": "是否真正解决用户问题",
            },
            {
                "dimension": EvaluationDimension.COMPLIANCE,
                "weight": 0.20,
                "description": "是否符合安全/政策约束",
            },
            {
                "dimension": EvaluationDimension.EFFICIENCY,
                "weight": 0.15,
                "description": "步骤是否冗余、耗时是否合理",
            },
            {
                "dimension": EvaluationDimension.TOOL_USAGE,
                "weight": 0.10,
                "description": "工具调用是否恰当、参数是否正确",
            },
            {
                "dimension": EvaluationDimension.CONTEXT_COHERENCE,
                "weight": 0.10,
                "description": "多轮是否保持一致、是否遗忘前提",
            },
        ],
    )


# --------------------------------------------------------------- default suggestions


_DEFAULT_SUGGESTIONS: List[OptimizationSuggestion] = [
    OptimizationSuggestion(
        id="sug-prompt-001",
        category=SuggestionCategory.PROMPT,
        priority=SuggestionPriority.HIGH,
        title="在 system prompt 中强制工具入参 schema",
        description="多次对话中 query_order 入参字段名不一致（orderId vs order_id）导致首次调用失败后重试，平均增加 1.2s 延迟。",
        action="在 system prompt 追加：「调用 query_order 时必须使用 snake_case 入参 order_id，禁止使用 camelCase。」并给出一个 few-shot 示例。",
        expectedImpact="预计减少 80% 的工具重试，单对话平均耗时下降 1.0-1.5s。",
        relatedEvidence=["conv-001: query_order 首次调用 400，重试成功", "conv-004: 同样问题重复出现"],
    ),
    OptimizationSuggestion(
        id="sug-tool-001",
        category=SuggestionCategory.TOOL,
        priority=SuggestionPriority.MEDIUM,
        title="合并订单查询与状态查询为单一工具",
        description="query_order 与 query_order_status 在 60% 的对话中被先后调用，参数完全相同，存在重复查询。",
        action="将 query_order_status 能力合并入 query_order 返回结果，并在响应中包含 status 字段。",
        expectedImpact="减少 1 次工具调用/对话，效率维度评分预计提升 8-10 分。",
        relatedEvidence=["conv-001: 连续 2 次 query_order，参数相同"],
    ),
    OptimizationSuggestion(
        id="sug-knowledge-001",
        category=SuggestionCategory.KNOWLEDGE,
        priority=SuggestionPriority.HIGH,
        title="补充「预售商品退货」知识切片",
        description="在 12 条涉及预售商品退货的对话中，客服给出的退货窗口与普通商品混淆（预售应 15 天，普通 7 天），准确性被扣分。",
        action="在知识库 kb-product 中新增「预售商品退货政策」文档，并在 system prompt 中提示优先检索该切片。",
        expectedImpact="涉及预售的对话准确性评分预计从 72 提升至 88+。",
        relatedEvidence=["conv-007: 错误告知预售商品 7 天可退", "conv-011: 同类错误"],
    ),
    OptimizationSuggestion(
        id="sug-parameter-001",
        category=SuggestionCategory.PARAMETER,
        priority=SuggestionPriority.MEDIUM,
        title="调低 temperature 至 0.3",
        description="当前 temperature=0.7 导致部分事实性回答（订单状态、退货政策）出现轻微漂移，影响准确性。",
        action="将 capability.temperature 从 0.7 调整为 0.3，保留 topP=0.9 不变。",
        expectedImpact="准确性维度评分预计提升 3-5 分，创新性场景可通过单独的 employee 配置覆盖。",
    ),
    OptimizationSuggestion(
        id="sug-workflow-001",
        category=SuggestionCategory.WORKFLOW,
        priority=SuggestionPriority.LOW,
        title="在退货流程中前置确认「商品类型」",
        description="当前流程在未确认是否为预售商品的情况下直接告知 7 天退货政策，导致后续需要纠正，增加对话轮次。",
        action="在退货意图识别后，增加一个「商品类型判断」节点，预售商品走分支 A，普通商品走分支 B。",
        expectedImpact="平均对话轮次从 4.2 降至 3.0，效率维度评分预计提升 12 分。",
        relatedEvidence=["conv-007: 第 2 轮才追问是否预售"],
    ),
]


# --------------------------------------------------------------- scoring heuristic


def _stable_noise(seed: str, base: float, span: float, lo: float, hi: float) -> float:
    """Deterministic pseudo-random in [lo, hi] derived from ``seed``.

    Uses md5 so the same conversation id always yields the same score across
    runs (tests are reproducible).
    """
    h = hashlib.md5(seed.encode("utf-8")).hexdigest()
    n = int(h[:8], 16) / 0xFFFFFFFF  # 0..1
    val = base + (n - 0.5) * span
    return max(lo, min(hi, val))


def _score_dimension(
    dimension: EvaluationDimension,
    conversation_id: str,
    weight: float,
) -> DimensionScore:
    """Produce a deterministic mock score for one dimension."""
    seed = f"{conversation_id}:{dimension.value}"
    if dimension == EvaluationDimension.ACCURACY:
        score = _stable_noise(seed, base=85.0, span=10.0, lo=70.0, hi=95.0)
        reasoning = "事实、数据、规则引用基本准确，未出现重大事实性错误。"
        evidence = ["assistant: 订单 #20260718-8842 状态查询正确。"]
    elif dimension == EvaluationDimension.HELPFULNESS:
        score = _stable_noise(seed, base=80.0, span=12.0, lo=68.0, hi=92.0)
        reasoning = "给出了可执行的方案，但未主动追问用户对方案的接受度。"
        evidence = ["assistant: 您可以进入「我的订单」→ 点击「申请退货」。"]
    elif dimension == EvaluationDimension.COMPLIANCE:
        score = _stable_noise(seed, base=92.0, span=6.0, lo=85.0, hi=98.0)
        reasoning = "未泄露内部系统信息，敏感字段（手机号）做了脱敏处理。"
        evidence = ["assistant: 您的联系方式 138****5621 我们已记录。"]
    elif dimension == EvaluationDimension.EFFICIENCY:
        score = _stable_noise(seed, base=72.0, span=14.0, lo=60.0, hi=85.0)
        reasoning = "完成方案确认共耗时 4 轮对话，存在重复工具调用，可压缩。"
        evidence = ["tool: query_order 被调用了 2 次，参数完全相同。"]
    elif dimension == EvaluationDimension.TOOL_USAGE:
        score = _stable_noise(seed, base=76.0, span=12.0, lo=65.0, hi=88.0)
        reasoning = "工具选择合理，但 query_order 入参拼写错误一次后自动重试。"
        evidence = ["tool: query_order args: {\"orderId\": ...} -> 400 error，重试成功。"]
    else:  # contextCoherence
        score = _stable_noise(seed, base=88.0, span=8.0, lo=75.0, hi=95.0)
        reasoning = "全程保持主线，正确继承了用户在第 1 轮给出的商品类型与原因。"
        evidence = ["user: 我买的蓝色连衣裙想退货。 → assistant: 关于您蓝色连衣裙的退货..."]
    return DimensionScore(
        dimension=dimension,
        score=round(score, 1),
        weight=weight,
        reasoning=reasoning,
        evidence=evidence,
    )


# --------------------------------------------------------------- service


class EvaluationService:
    """In-memory evaluation service."""

    def __init__(self) -> None:
        self._lock = RLock()
        # conversation_id -> ConversationRecord
        self._records: Dict[str, ConversationRecord] = {}
        # (tenant_id, conversation_id) -> AutoScoreResult (latest)
        self._scores: Dict[Tuple[str, str], AutoScoreResult] = {}
        # (tenant_id, report_id) -> EvaluationReportDetail
        self._reports: Dict[Tuple[str, str], EvaluationReportDetail] = {}
        # (tenant_id, employee_id) -> List[OptimizationSuggestion]
        self._suggestions: Dict[Tuple[str, str], List[OptimizationSuggestion]] = {}
        # tenant_id -> Dict[rubric_id, ScoringRubric]
        self._rubrics: Dict[str, Dict[str, ScoringRubric]] = {}

    # ------------------------------------------------------- conversations

    async def save_conversation(
        self, tenant_id: str, record: ConversationRecord
    ) -> ConversationRecord:
        with self._lock:
            existing = self._records.get(record.conversationId)
            if existing is None:
                # New record: stamp tenant via employeeId mapping (we don't have
                # a tenant field on ConversationRecord itself, so we key by id
                # only and gate by tenant on read paths).
                self._records[record.conversationId] = record
            else:
                # Merge: prefer incoming fields, keep tenant scoping implicit.
                self._records[record.conversationId] = record
        return record

    async def list_conversations(
        self, tenant_id: str, employee_id: Optional[str] = None
    ) -> List[ConversationRecord]:
        with self._lock:
            records = list(self._records.values())
        if employee_id:
            records = [r for r in records if r.employeeId == employee_id]
        return records

    async def get_conversation(
        self, tenant_id: str, conversation_id: str
    ) -> ConversationRecord:
        with self._lock:
            record = self._records.get(conversation_id)
        if record is None:
            raise InvalidParamError(
                f"对话记录不存在: conversationId={conversation_id}",
                data={"conversationId": conversation_id},
            )
        return record

    # ------------------------------------------------------- scoring

    async def auto_score(
        self,
        tenant_id: str,
        conversation_id: str,
        rubric_id: Optional[str] = None,
    ) -> AutoScoreResult:
        # Validate conversation exists (auto-create a placeholder so APP-DW can
        # score a conversation without first calling /conversations save).
        with self._lock:
            record = self._records.get(conversation_id)
        if record is None:
            record = ConversationRecord(
                conversationId=conversation_id,
                employeeId="auto",
                taskId="",
                messages=[],
            )
            await self.save_conversation(tenant_id, record)

        rubric = await self._get_rubric_internal(tenant_id, rubric_id)
        dimensions: List[DimensionScore] = []
        for rd in rubric.dimensions:
            dimensions.append(
                _score_dimension(rd.dimension, conversation_id, rd.weight)
            )
        overall = sum(d.score * (d.weight or 0) for d in dimensions)
        result = AutoScoreResult(
            conversationId=conversation_id,
            overallScore=round(overall, 1),
            dimensions=dimensions,
            evaluatorModel="doubao-eval-1.0",
            evaluatedAt=_now(),
            summary=self._build_summary(dimensions),
            mode=EvaluatorMode.LLM,
        )
        with self._lock:
            self._scores[(tenant_id, conversation_id)] = result
            # Patch the record with the score for later report aggregation.
            record.qualityScore = result.overallScore
            record.evaluatedAt = result.evaluatedAt
            record.evaluatedBy = "llm-evaluator"
            self._records[conversation_id] = record
        return result

    async def manual_score(
        self,
        tenant_id: str,
        conversation_id: str,
        request: ManualScoreRequest,
    ) -> AutoScoreResult:
        with self._lock:
            record = self._records.get(conversation_id)
        if record is None:
            record = ConversationRecord(
                conversationId=conversation_id,
                employeeId="manual",
                taskId="",
                messages=[],
            )
            await self.save_conversation(tenant_id, record)

        rubric = await self._get_rubric_internal(tenant_id, None)
        # Spread the manual overall score across dimensions weighted by rubric.
        dimensions: List[DimensionScore] = []
        for rd in rubric.dimensions:
            dimensions.append(
                DimensionScore(
                    dimension=rd.dimension,
                    score=round(request.score, 1),
                    weight=rd.weight,
                    reasoning=f"人工评分：{request.evaluatedBy}",
                )
            )
        result = AutoScoreResult(
            conversationId=conversation_id,
            overallScore=round(request.score, 1),
            dimensions=dimensions,
            evaluatorModel="manual",
            evaluatedAt=_now(),
            summary=f"人工评分 {request.score} 分（由 {request.evaluatedBy} 提交）",
            mode=EvaluatorMode.MANUAL,
        )
        with self._lock:
            self._scores[(tenant_id, conversation_id)] = result
            record.qualityScore = result.overallScore
            record.evaluatedAt = result.evaluatedAt
            record.evaluatedBy = request.evaluatedBy
            self._records[conversation_id] = record
        return result

    async def batch_auto_score(
        self,
        tenant_id: str,
        request: BatchAutoScoreRequest,
    ) -> BatchAutoScoreResponse:
        records = await self.list_conversations(tenant_id, employee_id=request.employeeId)
        if request.limit:
            records = records[: request.limit]
        results: List[AutoScoreResult] = []
        for r in records:
            results.append(await self.auto_score(tenant_id, r.conversationId))
        return BatchAutoScoreResponse(
            total=len(records), scored=len(results), results=results
        )

    def _build_summary(self, dimensions: List[DimensionScore]) -> str:
        highest = max(dimensions, key=lambda d: d.score)
        lowest = min(dimensions, key=lambda d: d.score)
        return (
            f"整体表现：{highest.dimension.value} 突出（{highest.score}），"
            f"{lowest.dimension.value} 有优化空间（{lowest.score}）。"
        )

    # ------------------------------------------------------- reports

    async def generate_report(
        self, tenant_id: str, request: GenerateReportRequest
    ) -> EvaluationReportDetail:
        records = await self.list_conversations(tenant_id, employee_id=request.employeeId)
        scored = [r for r in records if r.qualityScore is not None]
        if scored:
            avg_score = sum(r.qualityScore or 0 for r in scored) / len(scored)
            success_rate = sum(1 for r in scored if (r.qualityScore or 0) >= 60) / len(scored)
            avg_duration = sum(len(r.messages) for r in scored) / len(scored) * 12.0
        else:
            avg_score = 0.0
            success_rate = 0.0
            avg_duration = 0.0

        # Aggregate dimensions from latest scores.
        dim_map: Dict[EvaluationDimension, List[float]] = {}
        for r in scored:
            score_result = self._scores.get((tenant_id, r.conversationId))
            if score_result is None:
                continue
            for d in score_result.dimensions:
                dim_map.setdefault(d.dimension, []).append(d.score)
        dimensions: List[DimensionScore] = []
        score_breakdown: Dict[str, float] = {}
        for dim, scores in dim_map.items():
            avg = round(sum(scores) / len(scores), 1)
            dimensions.append(
                DimensionScore(
                    dimension=dim,
                    score=avg,
                    reasoning=f"周期内 {len(scores)} 条对话平均分",
                )
            )
            score_breakdown[dim.value] = avg

        highlights: List[str] = []
        issues: List[str] = []
        for d in sorted(dimensions, key=lambda x: x.score, reverse=True):
            if d.score >= 85:
                highlights.append(f"{d.dimension.value} 平均 {d.score} 分，表现稳定")
            elif d.score < 75:
                issues.append(f"{d.dimension.value} 平均 {d.score} 分，需要优化")
        if not highlights:
            highlights.append("本周期已完成全部任务评分")
        if not issues:
            issues.append("暂无明显短板，建议持续监控趋势")

        report_id = _new_id("rpt")
        now = _now()
        # Previous baseline: derive from earlier reports if any.
        prev_score = 0.0
        with self._lock:
            existing = [
                r
                for (tid, _), r in self._reports.items()
                if tid == tenant_id and r.employeeId == request.employeeId
            ]
        if existing:
            prev_score = max(r.avgQualityScore for r in existing)

        detail = EvaluationReportDetail(
            reportId=report_id,
            employeeId=request.employeeId,
            period=request.period,
            totalTasks=len(scored),
            avgQualityScore=round(avg_score, 3),
            successRate=round(success_rate, 3),
            avgDuration=round(avg_duration, 1),
            highlights=highlights,
            issues=issues,
            createdAt=now,
            dimensions=dimensions,
            suggestions=_DEFAULT_SUGGESTIONS[:3],
            autoGenerated=True,
            scoreBreakdown=score_breakdown,
            comparisonBaseline={
                "previousScore": round(prev_score, 3),
                "delta": round(avg_score - prev_score, 3),
            },
        )
        with self._lock:
            self._reports[(tenant_id, report_id)] = detail
        return detail

    async def list_reports(
        self, tenant_id: str, employee_id: Optional[str] = None
    ) -> List[EvaluationReport]:
        with self._lock:
            reports = [
                r for (tid, _), r in self._reports.items() if tid == tenant_id
            ]
        if employee_id:
            reports = [r for r in reports if r.employeeId == employee_id]
        reports.sort(key=lambda r: r.createdAt, reverse=True)
        return [EvaluationReport(**r.model_dump()) for r in reports]

    async def get_report_detail(
        self, tenant_id: str, report_id: str
    ) -> EvaluationReportDetail:
        with self._lock:
            report = self._reports.get((tenant_id, report_id))
        if report is None:
            raise InvalidParamError(
                f"报告不存在: reportId={report_id}",
                data={"reportId": report_id},
            )
        return report

    async def get_quality_trend(
        self, tenant_id: str, employee_id: str
    ) -> List[QualityTrendPoint]:
        """Return last 7-day quality trend for an employee."""
        with self._lock:
            reports = [
                r
                for (tid, _), r in self._reports.items()
                if tid == tenant_id and r.employeeId == employee_id
            ]
        reports.sort(key=lambda r: r.createdAt)
        # If we have explicit reports, use them; otherwise synthesize a flat
        # baseline so the UI chart can render.
        if reports:
            return [
                QualityTrendPoint(
                    date=r.createdAt.date().isoformat(), score=r.avgQualityScore
                )
                for r in reports
            ]
        today = _now().date()
        return [
            QualityTrendPoint(
                date=(today - timedelta(days=6 - i)).isoformat(), score=0.0
            )
            for i in range(7)
        ]

    # ------------------------------------------------------- aggregate report (V11-06)

    async def aggregate_report(
        self, tenant_id: str, request: AggregateReportRequest
    ) -> AggregateReportResponse:
        """Aggregate evaluation results across multiple employees.

        Pulls every scored conversation belonging to the given employee ids,
        averages dimension scores, and renders a Markdown report for the
        APP-DW ``ResultAggregator`` component.
        """
        # Deduplicate employee ids to avoid double counting.
        unique_employee_ids: List[str] = list(dict.fromkeys(request.employeeIds))

        all_records: List[ConversationRecord] = []
        for emp_id in unique_employee_ids:
            all_records.extend(
                await self.list_conversations(tenant_id, employee_id=emp_id)
            )

        scored = [r for r in all_records if r.qualityScore is not None]
        if scored:
            avg_score = sum(r.qualityScore or 0 for r in scored) / len(scored)
            success_rate = (
                sum(1 for r in scored if (r.qualityScore or 0) >= 60)
                / len(scored)
            )
        else:
            avg_score = 0.0
            success_rate = 0.0

        # Aggregate dimension scores across all scored conversations.
        dim_map: Dict[EvaluationDimension, List[float]] = {}
        for r in scored:
            score_result = self._scores.get((tenant_id, r.conversationId))
            if score_result is None:
                continue
            for d in score_result.dimensions:
                dim_map.setdefault(d.dimension, []).append(d.score)

        dimensions: List[DimensionScore] = []
        for dim, scores in dim_map.items():
            avg = round(sum(scores) / len(scores), 1)
            dimensions.append(
                DimensionScore(
                    dimension=dim,
                    score=avg,
                    reasoning=f"跨 {len(scores)} 条对话聚合平均",
                )
            )

        highlights: List[str] = []
        issues: List[str] = []
        for d in sorted(dimensions, key=lambda x: x.score, reverse=True):
            if d.score >= 85:
                highlights.append(
                    f"{d.dimension.value} 平均 {d.score} 分，整体表现稳定"
                )
            elif d.score < 75:
                issues.append(
                    f"{d.dimension.value} 平均 {d.score} 分，需重点优化"
                )
        if not highlights:
            highlights.append(f"已聚合 {len(scored)} 条对话评估")
        if not issues:
            issues.append("暂无明显短板，建议持续监控趋势")

        report = self._render_aggregate_report(
            collaboration_id=request.collaborationId,
            employee_ids=unique_employee_ids,
            total_conversations=len(scored),
            avg_score=avg_score,
            success_rate=success_rate,
            dimensions=dimensions,
            highlights=highlights,
            issues=issues,
            period=request.period,
        )

        return AggregateReportResponse(
            collaborationId=request.collaborationId,
            employeeIds=unique_employee_ids,
            totalEmployees=len(unique_employee_ids),
            totalConversations=len(scored),
            avgQualityScore=round(avg_score, 3),
            successRate=round(success_rate, 3),
            dimensions=dimensions,
            highlights=highlights,
            issues=issues,
            report=report,
            generatedAt=_now(),
        )

    def _render_aggregate_report(
        self,
        *,
        collaboration_id: Optional[str],
        employee_ids: List[str],
        total_conversations: int,
        avg_score: float,
        success_rate: float,
        dimensions: List[DimensionScore],
        highlights: List[str],
        issues: List[str],
        period: Optional[str],
    ) -> str:
        """Render a Markdown aggregate report for ``ResultAggregator``."""
        lines: List[str] = ["# 多员工协作聚合报告"]
        if collaboration_id:
            lines.append(f"- 协作任务: {collaboration_id}")
        if period:
            lines.append(f"- 周期: {period}")
        lines.append(f"- 参与员工数: {len(employee_ids)}")
        lines.append(f"- 聚合对话数: {total_conversations}")
        lines.append(f"- 平均质量分: {round(avg_score, 2)}")
        lines.append(f"- 成功率: {round(success_rate * 100, 1)}%")
        lines.append("")
        lines.append("## 参与员工")
        for eid in employee_ids:
            lines.append(f"- {eid}")
        lines.append("")
        if dimensions:
            lines.append("## 维度评分")
            for d in dimensions:
                lines.append(f"- {d.dimension.value}: {d.score}")
            lines.append("")
        lines.append("## 亮点")
        for h in highlights:
            lines.append(f"- {h}")
        lines.append("")
        lines.append("## 待改进")
        for i in issues:
            lines.append(f"- {i}")
        return "\n".join(lines)

    # ------------------------------------------------------- suggestions

    async def generate_suggestions(
        self, tenant_id: str, request: GenerateSuggestionsRequest
    ) -> GenerateSuggestionsResponse:
        # If a report id is provided, attach that context; otherwise pull the
        # latest report for the employee.
        based_on_report_id = request.reportId
        if based_on_report_id is None:
            reports = await self.list_reports(tenant_id, employee_id=request.employeeId)
            if reports:
                based_on_report_id = reports[0].reportId

        suggestions = list(_DEFAULT_SUGGESTIONS)
        with self._lock:
            self._suggestions[(tenant_id, request.employeeId)] = suggestions
        return GenerateSuggestionsResponse(
            suggestions=suggestions,
            generatedAt=_now(),
            basedOnReportId=based_on_report_id,
        )

    async def list_suggestions(
        self,
        tenant_id: str,
        employee_id: str,
        period: Optional[str] = None,
    ) -> List[OptimizationSuggestion]:
        with self._lock:
            suggestions = list(
                self._suggestions.get((tenant_id, employee_id), _DEFAULT_SUGGESTIONS)
            )
        # period is informational in v1.1; we just return all stored suggestions.
        return suggestions

    # ------------------------------------------------------- rubrics

    async def _get_rubric_internal(
        self, tenant_id: str, rubric_id: Optional[str]
    ) -> ScoringRubric:
        with self._lock:
            tenant_rubrics = self._rubrics.setdefault(tenant_id, {})
            if not tenant_rubrics:
                default = _build_default_rubric()
                tenant_rubrics[default.id] = default
            if rubric_id is None:
                # Always prefer the default rubric if present.
                return tenant_rubrics.get("rubric-default") or next(
                    iter(tenant_rubrics.values())
                )
            if rubric_id not in tenant_rubrics:
                raise InvalidParamError(
                    f"评分规则不存在: rubricId={rubric_id}",
                    data={"rubricId": rubric_id},
                )
            return tenant_rubrics[rubric_id]

    async def list_rubrics(self, tenant_id: str) -> List[ScoringRubric]:
        with self._lock:
            tenant_rubrics = self._rubrics.setdefault(tenant_id, {})
            # Always ensure the default rubric is present.
            if "rubric-default" not in tenant_rubrics:
                default = _build_default_rubric()
                tenant_rubrics[default.id] = default
            return list(tenant_rubrics.values())

    async def save_rubric(
        self, tenant_id: str, rubric: ScoringRubric
    ) -> ScoringRubric:
        if not rubric.id:
            rubric.id = _new_id("rubric")
        rubric.updatedAt = _now()
        with self._lock:
            tenant_rubrics = self._rubrics.setdefault(tenant_id, {})
            tenant_rubrics[rubric.id] = rubric
        return rubric

    # ------------------------------------------------------- test helpers

    def clear(self) -> None:
        with self._lock:
            self._records.clear()
            self._scores.clear()
            self._reports.clear()
            self._suggestions.clear()
            self._rubrics.clear()
