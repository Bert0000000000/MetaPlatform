from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from app.cost.service import CostReportService
from app.models.schemas import Model, ModelCapability
from app.models.service import ModelService
from app.routing.repository import RoutingRuleRepository
from app.routing.schemas import (
    CandidateModel,
    CreateRoutingRuleRequest,
    OptimizationStrategy,
    RoutingRecommendation,
    RoutingRequest,
    RoutingRule,
    UpdateRoutingRuleRequest,
)


class ModelRoutingOptimizer:
    def __init__(
        self,
        model_service: ModelService,
        cost_service: CostReportService,
        rule_repo: RoutingRuleRepository,
    ) -> None:
        self._model_service = model_service
        self._cost_service = cost_service
        self._rule_repo = rule_repo

    async def recommend(
        self,
        tenant_id: str,
        request: RoutingRequest,
    ) -> RoutingRecommendation:
        models = await self._model_service.list(tenant_id)
        candidates = self._build_candidates(models, request)

        if not candidates:
            raise ValueError("无满足能力要求的可用模型")

        # 默认按 score 降序；CHEAPEST 时按价格升序作为最终排序
        if request.strategy == OptimizationStrategy.CHEAPEST:
            candidates.sort(key=lambda c: (c.estimatedCost, -c.score))
        else:
            candidates.sort(key=lambda c: -c.score)

        recommended = candidates[0]
        baseline = self._baseline_cost(candidates, request)
        potential_savings = max(0.0, baseline - recommended.estimatedCost)
        savings_rate = (
            baseline / recommended.estimatedCost - 1.0
            if recommended.estimatedCost > 0
            else 0.0
        )

        return RoutingRecommendation(
            tenantId=tenant_id,
            request=request,
            recommendedModelId=recommended.modelId,
            recommendedDisplayName=recommended.displayName,
            estimatedCost=recommended.estimatedCost,
            potentialSavings=round(potential_savings, 6),
            savingsRate=round(savings_rate, 4),
            candidates=candidates,
            strategy=request.strategy.value,
        )

    def _build_candidates(
        self, models: List[Model], request: RoutingRequest
    ) -> List[CandidateModel]:
        required = {c.upper() for c in request.requiredCapabilities}
        candidates: List[CandidateModel] = []
        for m in models:
            caps = {
                c.upper() if isinstance(c, str) else c.value.upper()
                for c in m.capabilities
            }
            if not required.issubset(caps):
                continue
            if (
                request.preferredProvider
                and m.provider.upper() != request.preferredProvider.upper()
            ):
                continue
            est_cost = (
                request.promptTokens * m.input_price / 1000.0
                + request.completionTokens * m.output_price / 1000.0
            )
            est_latency = self._estimate_latency(m)
            if request.maxLatencyMs and est_latency > request.maxLatencyMs:
                continue
            score = self._score(m, est_cost, est_latency, request.strategy)
            reason = self._reason(m, est_cost, request.strategy)
            candidates.append(
                CandidateModel(
                    modelId=m.model_id,
                    provider=m.provider,
                    modelCode=m.model_code,
                    displayName=m.display_name,
                    type=m.type.value if hasattr(m.type, "value") else str(m.type),
                    inputPrice=m.input_price,
                    outputPrice=m.output_price,
                    contextLength=m.context_length,
                    capabilities=list(m.capabilities),
                    estimatedCost=round(est_cost, 6),
                    estimatedLatencyMs=est_latency,
                    score=round(score, 4),
                    reason=reason,
                )
            )
        return candidates

    @staticmethod
    def _estimate_latency(model: Model) -> int:
        # 启发式：价格越高通常延迟越高；embedding 模型固定 80ms
        if str(model.type).upper() == "EMBEDDING":
            return 80
        base = 150
        price_factor = (model.input_price + model.output_price) * 10000
        return int(base + price_factor * 2)

    @staticmethod
    def _score(
        model: Model,
        est_cost: float,
        est_latency: int,
        strategy: OptimizationStrategy,
    ) -> float:
        # 价格得分：越便宜越高（使用倒数归一化）
        cost_score = 1.0 / (1.0 + est_cost * 1000.0)
        # 能力得分：上下文窗口越大、支持 FUNCTION_CALLING 越高
        cap_score = min(1.0, model.context_length / 128_000.0)
        if ModelCapability.FUNCTION_CALLING.value.upper() in {
            c.upper() if isinstance(c, str) else c.value.upper()
            for c in model.capabilities
        }:
            cap_score += 0.15
        # 延迟得分：越低越好
        latency_score = 1.0 / (1.0 + est_latency / 1000.0)

        if strategy == OptimizationStrategy.CHEAPEST:
            return cost_score * 0.8 + latency_score * 0.1 + cap_score * 0.1
        if strategy == OptimizationStrategy.BEST_QUALITY:
            return cap_score * 0.6 + latency_score * 0.25 + cost_score * 0.15
        # BALANCED
        return cost_score * 0.45 + cap_score * 0.35 + latency_score * 0.20

    @staticmethod
    def _reason(model: Model, est_cost: float, strategy: OptimizationStrategy) -> str:
        if strategy == OptimizationStrategy.CHEAPEST:
            return f"单价最低，预估成本 ${est_cost:.6f}"
        if strategy == OptimizationStrategy.BEST_QUALITY:
            return f"上下文 {model.context_length}，能力最强"
        return f"性价比均衡，预估成本 ${est_cost:.6f}"

    def _baseline_cost(
        self, candidates: List[CandidateModel], request: RoutingRequest
    ) -> float:
        if not candidates:
            return 0.0
        # 基线取最贵候选的预估成本，用于计算节省
        return max(c.estimatedCost for c in candidates)

    # ------------------------------- routing rules

    def list_rules(self, tenant_id: str) -> List[RoutingRule]:
        return self._rule_repo.list(tenant_id)

    def create_rule(
        self, tenant_id: str, req: CreateRoutingRuleRequest
    ) -> RoutingRule:
        rule = RoutingRule(
            ruleId=str(uuid.uuid4()),
            tenantId=tenant_id,
            name=req.name,
            description=req.description,
            requiredCapabilities=req.requiredCapabilities,
            preferredProvider=req.preferredProvider,
            strategy=req.strategy,
            priority=req.priority,
            fallbackModelId=req.fallbackModelId,
            enabled=req.enabled,
        )
        return self._rule_repo.insert(rule)

    def update_rule(
        self, tenant_id: str, rule_id: str, req: UpdateRoutingRuleRequest
    ) -> RoutingRule:
        existing = self._rule_repo.get(tenant_id, rule_id)
        data = existing.model_dump()
        update = req.model_dump(exclude_unset=True)
        data.update(update)
        data["updatedAt"] = datetime.utcnow()
        updated = RoutingRule(**data)
        return self._rule_repo.update(updated)

    def get_rule(self, tenant_id: str, rule_id: str) -> RoutingRule:
        return self._rule_repo.get(tenant_id, rule_id)

    def delete_rule(self, tenant_id: str, rule_id: str) -> None:
        self._rule_repo.delete(tenant_id, rule_id)
