# V15-08 智能成本优化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 TECH-LLMGW 中实现基于价格与能力的模型路由优化器，为 APP-SUPERAI 提供成本优化推荐与自动路由能力，帮助平台自动选择性价比最高的模型。

**Architecture:** 新增 `app.routing` 模块负责候选模型筛选与评分；`CostReportService` 扩展历史成本聚合用于估算潜在节省；`chat_completions.py` 增加 `autoRoute` 模式，在请求体未指定模型或显式启用时由优化器自动选择；APP-SUPERAI 新增 `CostOptimizationPage` 展示推荐结果、节省估算与路由规则管理。

**Tech Stack:** Python 3.13 + FastAPI, Pydantic v2, React 19 + TypeScript + Ant Design 6.0, pytest

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `TECH-LLMGW/app/routing/schemas.py` | 路由请求/响应、候选模型、评分规则、路由规则 DTO |
| `TECH-LLMGW/app/routing/service.py` | `ModelRoutingOptimizer`：按能力、价格、上下文长度、历史表现评分 |
| `TECH-LLMGW/app/routing/repository.py` | 路由规则内存/SQLAlchemy 双实现 |
| `TECH-LLMGW/app/routing/orm.py` | 路由规则表 ORM |
| `TECH-LLMGW/app/api/v1/routing.py` | 路由优化与规则管理 REST 端点 |
| `TECH-LLMGW/app/api/v1/chat_completions.py` | 扩展 autoRoute 模式，调用优化器 |
| `TECH-LLMGW/app/deps.py` | 注册 routing_repo / routing_service |
| `TECH-LLMGW/app/api/v1/router.py` | 挂载 routing 路由 |
| `APP-SUPERAI/src/api/costOptimization.ts` | 前端 API 封装 |
| `APP-SUPERAI/src/pages/CostOptimizationPage.tsx` | 成本优化仪表盘 |
| `APP-SUPERAI/src/App.tsx` | 注册 `/cost-optimization` 路由 |
| `APP-SUPERAI/src/components/AppLayout.tsx` | 菜单添加「成本优化」入口（若需要，也可依赖统一 PlatformMenu） |
| `TECH-LLMGW/tests/test_routing.py` | 路由服务与端点测试 |

---

### Task 1: 路由优化器 schemas 与评分服务

**Files:**
- Create: `TECH-LLMGW/app/routing/__init__.py`
- Create: `TECH-LLMGW/app/routing/schemas.py`
- Create: `TECH-LLMGW/app/routing/service.py`
- Test: `TECH-LLMGW/tests/test_routing.py`

- [ ] **Step 1: 创建 routing 包与 schemas**

```python
# TECH-LLMGW/app/routing/__init__.py
"""Model routing optimizer for cost-aware LLM selection."""
```

```python
# TECH-LLMGW/app/routing/schemas.py
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class OptimizationStrategy(str, Enum):
    CHEAPEST = "cheapest"
    BALANCED = "balanced"
    BEST_QUALITY = "best_quality"


class RoutingRequest(BaseModel):
    promptTokens: int = Field(default=512, ge=1)
    completionTokens: int = Field(default=256, ge=1)
    requiredCapabilities: List[str] = Field(default_factory=lambda: ["CHAT"])
    preferredProvider: Optional[str] = None
    strategy: OptimizationStrategy = OptimizationStrategy.BALANCED
    maxLatencyMs: Optional[int] = None


class CandidateModel(BaseModel):
    modelId: str
    provider: str
    modelCode: str
    displayName: str
    type: str
    inputPrice: float
    outputPrice: float
    contextLength: int
    capabilities: List[str]
    estimatedCost: float
    estimatedLatencyMs: int
    score: float
    reason: str


class RoutingRecommendation(BaseModel):
    tenantId: str
    request: RoutingRequest
    recommendedModelId: str
    recommendedDisplayName: str
    estimatedCost: float
    potentialSavings: float
    savingsRate: float
    candidates: List[CandidateModel]
    strategy: str
    generatedAt: datetime = Field(default_factory=datetime.utcnow)


class RoutingRule(BaseModel):
    ruleId: str
    tenantId: str
    name: str
    description: str = ""
    requiredCapabilities: List[str] = Field(default_factory=list)
    preferredProvider: Optional[str] = None
    strategy: OptimizationStrategy = OptimizationStrategy.BALANCED
    priority: int = Field(default=0, ge=0)
    fallbackModelId: Optional[str] = None
    enabled: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)


class CreateRoutingRuleRequest(BaseModel):
    name: str
    description: str = ""
    requiredCapabilities: List[str] = Field(default_factory=list)
    preferredProvider: Optional[str] = None
    strategy: OptimizationStrategy = OptimizationStrategy.BALANCED
    priority: int = Field(default=0, ge=0)
    fallbackModelId: Optional[str] = None
    enabled: bool = True


class UpdateRoutingRuleRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    requiredCapabilities: Optional[List[str]] = None
    preferredProvider: Optional[str] = None
    strategy: Optional[OptimizationStrategy] = None
    priority: Optional[int] = None
    fallbackModelId: Optional[str] = None
    enabled: Optional[bool] = None
```

- [ ] **Step 2: 创建优化器服务**

```python
# TECH-LLMGW/app/routing/service.py
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

    def recommend(
        self,
        tenant_id: str,
        request: RoutingRequest,
    ) -> RoutingRecommendation:
        models = self._model_service.list_active(tenant_id)
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
        savings_rate = baseline / recommended.estimatedCost - 1.0 if recommended.estimatedCost > 0 else 0.0

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
            caps = {c.upper() if isinstance(c, str) else c.value.upper() for c in m.capabilities}
            if not required.issubset(caps):
                continue
            if request.preferredProvider and m.provider.upper() != request.preferredProvider.upper():
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
            c.upper() if isinstance(c, str) else c.value.upper() for c in model.capabilities
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

    def _baseline_cost(self, candidates: List[CandidateModel], request: RoutingRequest) -> float:
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
```

- [ ] **Step 3: 创建路由规则 repository（内存版 + ORM）**

```python
# TECH-LLMGW/app/routing/repository.py
from __future__ import annotations

from threading import RLock
from typing import Dict, List, Optional

from app.routing.orm import Base, RoutingRuleORM
from app.routing.schemas import RoutingRule


def _row_to_rule(row: RoutingRuleORM) -> RoutingRule:
    return RoutingRule(
        ruleId=row.rule_id,
        tenantId=row.tenant_id,
        name=row.name,
        description=row.description or "",
        requiredCapabilities=list(row.required_capabilities or []),
        preferredProvider=row.preferred_provider,
        strategy=row.strategy,
        priority=row.priority,
        fallbackModelId=row.fallback_model_id,
        enabled=row.enabled,
        createdAt=row.created_at,
        updatedAt=row.updated_at,
    )


def _rule_to_row(rule: RoutingRule) -> RoutingRuleORM:
    return RoutingRuleORM(
        rule_id=rule.ruleId,
        tenant_id=rule.tenantId,
        name=rule.name,
        description=rule.description,
        required_capabilities=rule.requiredCapabilities,
        preferred_provider=rule.preferredProvider,
        strategy=rule.strategy.value,
        priority=rule.priority,
        fallback_model_id=rule.fallbackModelId,
        enabled=rule.enabled,
        created_at=rule.createdAt,
        updated_at=rule.updatedAt,
    )


class RoutingRuleRepository:
    def __init__(self) -> None:
        self._lock = RLock()
        self._rules: Dict[str, RoutingRule] = {}

    def insert(self, rule: RoutingRule) -> RoutingRule:
        with self._lock:
            self._rules[rule.ruleId] = rule
        return rule

    def update(self, rule: RoutingRule) -> RoutingRule:
        with self._lock:
            self._rules[rule.ruleId] = rule
        return rule

    def get(self, tenant_id: str, rule_id: str) -> RoutingRule:
        with self._lock:
            rule = self._rules.get(rule_id)
        if rule is None or rule.tenantId != tenant_id:
            raise KeyError(f"routing rule not found: {rule_id}")
        return rule

    def list(self, tenant_id: str) -> List[RoutingRule]:
        with self._lock:
            items = [r for r in self._rules.values() if r.tenantId == tenant_id]
        return sorted(items, key=lambda r: (-r.priority, r.createdAt))

    def delete(self, tenant_id: str, rule_id: str) -> None:
        with self._lock:
            rule = self._rules.get(rule_id)
            if rule is None or rule.tenantId != tenant_id:
                raise KeyError(f"routing rule not found: {rule_id}")
            del self._rules[rule_id]

    def clear(self) -> None:
        with self._lock:
            self._rules.clear()


class SqlAlchemyRoutingRuleRepository:
    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory

    @classmethod
    async def create_all(cls, engine) -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def insert(self, rule: RoutingRule) -> RoutingRule:
        async with self._session_factory() as session:
            session.add(_rule_to_row(rule))
            await session.commit()
            return rule

    async def update(self, rule: RoutingRule) -> RoutingRule:
        async with self._session_factory() as session:
            existing = await session.get(RoutingRuleORM, rule.ruleId)
            if existing is None:
                raise KeyError(f"routing rule not found: {rule.ruleId}")
            row = _rule_to_row(rule)
            for col in ["name", "description", "required_capabilities", "preferred_provider",
                        "strategy", "priority", "fallback_model_id", "enabled", "updated_at"]:
                setattr(existing, col, getattr(row, col))
            await session.commit()
            return rule

    async def get(self, tenant_id: str, rule_id: str) -> RoutingRule:
        async with self._session_factory() as session:
            row = await session.get(RoutingRuleORM, rule_id)
        if row is None or row.tenant_id != tenant_id:
            raise KeyError(f"routing rule not found: {rule_id}")
        return _row_to_rule(row)

    async def list(self, tenant_id: str) -> List[RoutingRule]:
        from sqlalchemy import select
        async with self._session_factory() as session:
            stmt = (
                select(RoutingRuleORM)
                .where(RoutingRuleORM.tenant_id == tenant_id)
                .order_by(RoutingRuleORM.priority.desc(), RoutingRuleORM.created_at)
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [_row_to_rule(r) for r in rows]

    async def delete(self, tenant_id: str, rule_id: str) -> None:
        async with self._session_factory() as session:
            row = await session.get(RoutingRuleORM, rule_id)
            if row is None or row.tenant_id != tenant_id:
                raise KeyError(f"routing rule not found: {rule_id}")
            await session.delete(row)
            await session.commit()

    async def clear(self) -> None:
        async with self._session_factory() as session:
            await session.execute(RoutingRuleORM.__table__.delete())
            await session.commit()
```

```python
# TECH-LLMGW/app/routing/orm.py
from __future__ import annotations

from datetime import datetime
from typing import List

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class RoutingRuleORM(Base):
    __tablename__ = "llmgw_routing_rules"

    rule_id = Column(String(64), primary_key=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, default="")
    required_capabilities = Column(ARRAY(String), default=list)
    preferred_provider = Column(String(64), nullable=True)
    strategy = Column(String(32), nullable=False, default="balanced")
    priority = Column(Integer, nullable=False, default=0)
    fallback_model_id = Column(String(64), nullable=True)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

- [ ] **Step 4: 添加 Flyway 迁移（生产 PostgreSQL）**

```sql
-- TECH-LLMGW/app/resources/db/migration/V14__init_routing_rules.sql
CREATE TABLE IF NOT EXISTS llmgw_routing_rules (
    rule_id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT DEFAULT '',
    required_capabilities VARCHAR(32)[],
    preferred_provider VARCHAR(64),
    strategy VARCHAR(32) NOT NULL DEFAULT 'balanced',
    priority INT NOT NULL DEFAULT 0,
    fallback_model_id VARCHAR(64),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_routing_rules_tenant ON llmgw_routing_rules(tenant_id);
```

> 注：若项目当前 Flyway 位于 `src/main/resources/db/migration`，则本文件路径应跟随 TECH-LLMGW 的 Python 项目约定；请检查实际目录。当前 TECH-LLMGW 为 Python 项目，无 Flyway，ORM 由 `create_all` 自动建表，因此本迁移文件可选，测试环境可跳过。

- [ ] **Step 5: 编写服务层测试**

```python
# TECH-LLMGW/tests/test_routing.py（新增/追加）
import pytest
from datetime import datetime
from app.routing.schemas import OptimizationStrategy, RoutingRequest
from app.routing.service import ModelRoutingOptimizer
from app.routing.repository import RoutingRuleRepository
from app.cost.service import CostReportService
from app.cost.repository import UsageRepository
from app.models.service import ModelService
from app.models.repository import ModelRepository


@pytest.fixture
def routing_optimizer():
    model_repo = ModelRepository()
    model_service = ModelService(model_repo)
    usage_repo = UsageRepository()
    cost_service = CostReportService(usage_repo)
    rule_repo = RoutingRuleRepository()
    return ModelRoutingOptimizer(model_service, cost_service, rule_repo)


def test_recommend_cheapest_chat(routing_optimizer):
    req = RoutingRequest(
        promptTokens=1000,
        completionTokens=500,
        requiredCapabilities=["CHAT"],
        strategy=OptimizationStrategy.CHEAPEST,
    )
    rec = routing_optimizer.recommend("tenant-1", req)
    assert rec.recommendedModelId
    assert rec.estimatedCost >= 0
    assert rec.potentialSavings >= 0
    assert any(c.modelId == rec.recommendedModelId for c in rec.candidates)


def test_recommend_requires_vision(routing_optimizer):
    req = RoutingRequest(
        promptTokens=1000,
        completionTokens=500,
        requiredCapabilities=["VISION"],
        strategy=OptimizationStrategy.BALANCED,
    )
    rec = routing_optimizer.recommend("tenant-1", req)
    recommended = next(c for c in rec.candidates if c.modelId == rec.recommendedModelId)
    assert "VISION" in [c.upper() for c in recommended.capabilities]
```

- [ ] **Step 6: 运行测试确认失败（类未定义）**

Run: `python -m pytest TECH-LLMGW/tests/test_routing.py -v`
Expected: 2 FAIL with `ModuleNotFoundError: No module named 'app.routing'`

- [ ] **Step 7: 运行测试确认通过**

Run: `python -m pytest TECH-LLMGW/tests/test_routing.py -v`
Expected: 2 PASS

---

### Task 2: 路由优化 REST 端点

**Files:**
- Create: `TECH-LLMGW/app/api/v1/routing.py`
- Modify: `TECH-LLMGW/app/api/v1/router.py`
- Modify: `TECH-LLMGW/app/deps.py`
- Test: `TECH-LLMGW/tests/test_routing.py`

- [ ] **Step 1: 创建 routing API 端点**

```python
# TECH-LLMGW/app/api/v1/routing.py
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Request

from app.common.api_response import success
from app.common.context import RequestContext, request_context_dep
from app.deps import get_routing_optimizer
from app.routing.schemas import (
    CreateRoutingRuleRequest,
    OptimizationStrategy,
    RoutingRequest,
    UpdateRoutingRuleRequest,
)
from app.routing.service import ModelRoutingOptimizer

router = APIRouter(tags=["routing"])


@router.post("/routing/recommend", summary="模型路由推荐")
async def recommend_model(
    request: Request,
    body: RoutingRequest,
    ctx: RequestContext = Depends(request_context_dep),
    optimizer: ModelRoutingOptimizer = Depends(get_routing_optimizer),
):
    rec = optimizer.recommend(ctx.tenant_id, body)
    return success(rec.model_dump(), trace_id=ctx.trace_id)


@router.get("/routing/rules", summary="路由规则列表")
async def list_rules(
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    optimizer: ModelRoutingOptimizer = Depends(get_routing_optimizer),
):
    items = [r.model_dump() for r in optimizer.list_rules(ctx.tenant_id)]
    return success({"items": items}, trace_id=ctx.trace_id)


@router.post("/routing/rules", summary="创建路由规则")
async def create_rule(
    request: Request,
    body: CreateRoutingRuleRequest,
    ctx: RequestContext = Depends(request_context_dep),
    optimizer: ModelRoutingOptimizer = Depends(get_routing_optimizer),
):
    rule = optimizer.create_rule(ctx.tenant_id, body)
    return success(rule.model_dump(), trace_id=ctx.trace_id)


@router.get("/routing/rules/{rule_id}", summary="路由规则详情")
async def get_rule(
    rule_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    optimizer: ModelRoutingOptimizer = Depends(get_routing_optimizer),
):
    rule = optimizer.get_rule(ctx.tenant_id, rule_id)
    return success(rule.model_dump(), trace_id=ctx.trace_id)


@router.put("/routing/rules/{rule_id}", summary="更新路由规则")
async def update_rule(
    rule_id: str,
    request: Request,
    body: UpdateRoutingRuleRequest,
    ctx: RequestContext = Depends(request_context_dep),
    optimizer: ModelRoutingOptimizer = Depends(get_routing_optimizer),
):
    rule = optimizer.update_rule(ctx.tenant_id, rule_id, body)
    return success(rule.model_dump(), trace_id=ctx.trace_id)


@router.delete("/routing/rules/{rule_id}", summary="删除路由规则")
async def delete_rule(
    rule_id: str,
    request: Request,
    ctx: RequestContext = Depends(request_context_dep),
    optimizer: ModelRoutingOptimizer = Depends(get_routing_optimizer),
):
    optimizer.delete_rule(ctx.tenant_id, rule_id)
    return success(None, trace_id=ctx.trace_id)
```

- [ ] **Step 2: 注册 deps 与 router**

```python
# TECH-LLMGW/app/deps.py 修改
from app.routing.repository import RoutingRuleRepository, SqlAlchemyRoutingRuleRepository
from app.routing.service import ModelRoutingOptimizer

# 在 Registry 中新增字段
@dataclass
class Registry:
    # ... 现有字段 ...
    routing_repo: Any
    routing_service: ModelRoutingOptimizer

    def reset(self) -> None:
        # ... 现有清理 ...
        self.routing_repo.clear()

# 在 _build_default_registry 中初始化
    if _use_sqlalchemy():
        # ... 现有 ...
        routing_repo: Any = SqlAlchemyRoutingRuleRepository(session_factory)
    else:
        # ... 现有 ...
        routing_repo = RoutingRuleRepository()

    routing_service = ModelRoutingOptimizer(model_service, cost_service, routing_repo)

    return Registry(
        # ... 现有 ...
        routing_repo=routing_repo,
        routing_service=routing_service,
    )

# 新增 FastAPI dep
def get_routing_optimizer(request: Request) -> ModelRoutingOptimizer:
    return request.app.state.registry.routing_service
```

```python
# TECH-LLMGW/app/api/v1/router.py 修改
from app.api.v1 import (
    # ... 现有 ...
    routing,
)

router.include_router(routing.router)
```

- [ ] **Step 3: 添加端点测试**

```python
# TECH-LLMGW/tests/test_routing.py 追加
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_api_recommend(client):
    payload = {
        "promptTokens": 1000,
        "completionTokens": 500,
        "requiredCapabilities": ["CHAT"],
        "strategy": "cheapest",
    }
    resp = client.post("/api/v1/llmgw/routing/recommend", json=payload, headers={"X-Tenant-Id": "tenant-1"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["recommendedModelId"]
    assert data["estimatedCost"] >= 0


def test_api_routing_rules_crud(client):
    # create
    resp = client.post(
        "/api/v1/llmgw/routing/rules",
        json={"name": " vision 任务", "requiredCapabilities": ["VISION"], "strategy": "cheapest"},
        headers={"X-Tenant-Id": "tenant-1"},
    )
    assert resp.status_code == 200
    rule_id = resp.json()["data"]["ruleId"]

    # list
    resp = client.get("/api/v1/llmgw/routing/rules", headers={"X-Tenant-Id": "tenant-1"})
    assert any(r["ruleId"] == rule_id for r in resp.json()["data"]["items"])

    # update
    resp = client.put(
        f"/api/v1/llmgw/routing/rules/{rule_id}",
        json={"priority": 10},
        headers={"X-Tenant-Id": "tenant-1"},
    )
    assert resp.json()["data"]["priority"] == 10

    # delete
    resp = client.delete(f"/api/v1/llmgw/routing/rules/{rule_id}", headers={"X-Tenant-Id": "tenant-1"})
    assert resp.status_code == 200
```

- [ ] **Step 4: 运行测试**

Run: `python -m pytest TECH-LLMGW/tests/test_routing.py -v`
Expected: 6 PASS

---

### Task 3: Chat Completions 自动路由集成

**Files:**
- Modify: `TECH-LLMGW/app/api/v1/chat_completions.py`
- Test: `TECH-LLMGW/tests/test_chat_completions.py`（若无则新建）

- [ ] **Step 1: 扩展请求体支持 autoRoute**

```python
# TECH-LLMGW/app/api/v1/chat_completions.py 修改
from app.deps import get_chat_service, get_rate_limit_guard, get_routing_optimizer
from app.routing.schemas import OptimizationStrategy, RoutingRequest

class ChatCompletionRequest(BaseModel):
    model: Optional[str] = Field(default=None)  # 允许 autoRoute 时为空
    messages: List[ChatCompletionMessage] = Field(min_length=1, max_length=64)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=8192)
    system: Optional[str] = None
    autoRoute: bool = Field(default=False)
    strategy: Optional[str] = Field(default="balanced")  # cheapest / balanced / best_quality
    requiredCapabilities: Optional[List[str]] = Field(default=None)

    @model_validator(mode="after")
    def check_model_or_auto_route(self):
        if not self.model and not self.autoRoute:
            raise ValueError("model 与 autoRoute 必须指定其一")
        return self
```

> 需要在文件顶部 import：`from pydantic import model_validator`

- [ ] **Step 2: 在端点中应用路由**

```python
# 在 chat_completions 端点内部，model_id 解析处替换为：
model_id = body.model
if body.autoRoute or not model_id:
    strategy = OptimizationStrategy(body.strategy or "balanced")
    caps = body.requiredCapabilities or ["CHAT"]
    # 简单按请求估算 token
    prompt_tokens = len(_flatten_text(body.messages, body.system)) // 4
    rec = optimizer.recommend(
        ctx.tenant_id,
        RoutingRequest(
            promptTokens=max(1, prompt_tokens),
            completionTokens=body.max_tokens or 256,
            requiredCapabilities=caps,
            strategy=strategy,
        ),
    )
    model_id = rec.recommendedModelId
```

- [ ] **Step 3: 在响应中返回实际路由模型与推荐信息**

```python
# 最终 return 中增加 routed 字段
return success(
    {
        "id": resp.id,
        "model": model_id,
        "provider": resp.provider,
        "autoRouted": body.autoRoute or not body.model,
        "recommendedModelId": model_id,
        "choices": [...],
        "usage": {...},
        "latencyMs": elapsed_ms,
    },
    trace_id=ctx.trace_id,
)
```

- [ ] **Step 4: 运行 chat_completions 相关测试**

Run: `python -m pytest TECH-LLMGW/tests/ -k chat_completions -v`
Expected: PASS

---

### Task 4: APP-SUPERAI 成本优化仪表盘

**Files:**
- Create: `APP-SUPERAI/src/api/costOptimization.ts`
- Create: `APP-SUPERAI/src/pages/CostOptimizationPage.tsx`
- Modify: `APP-SUPERAI/src/App.tsx`
- Modify: `APP-SUPERAI/src/components/AppLayout.tsx`（若需要显式菜单；当前统一 PlatformMenu 已包含 schedule 子菜单，建议新增 `cost-optimization` 到 platformMenu）

- [ ] **Step 1: 创建前端 API 封装**

```typescript
// APP-SUPERAI/src/api/costOptimization.ts
import axios from 'axios';

const BASE = '/api/v1/llmgw';

export interface RoutingRequest {
  promptTokens: number;
  completionTokens: number;
  requiredCapabilities?: string[];
  preferredProvider?: string;
  strategy?: 'cheapest' | 'balanced' | 'best_quality';
  maxLatencyMs?: number;
}

export interface CandidateModel {
  modelId: string;
  provider: string;
  modelCode: string;
  displayName: string;
  type: string;
  inputPrice: number;
  outputPrice: number;
  contextLength: number;
  capabilities: string[];
  estimatedCost: number;
  estimatedLatencyMs: number;
  score: number;
  reason: string;
}

export interface RoutingRecommendation {
  tenantId: string;
  recommendedModelId: string;
  recommendedDisplayName: string;
  estimatedCost: number;
  potentialSavings: number;
  savingsRate: number;
  candidates: CandidateModel[];
  strategy: string;
}

export async function recommendModel(req: RoutingRequest): Promise<RoutingRecommendation> {
  const resp = await axios.post(`${BASE}/routing/recommend`, req);
  return resp.data.data;
}

export interface RoutingRule {
  ruleId: string;
  name: string;
  description: string;
  requiredCapabilities: string[];
  preferredProvider?: string;
  strategy: string;
  priority: number;
  fallbackModelId?: string;
  enabled: boolean;
}

export async function listRoutingRules(): Promise<RoutingRule[]> {
  const resp = await axios.get(`${BASE}/routing/rules`);
  return resp.data.data.items;
}

export async function createRoutingRule(rule: Omit<RoutingRule, 'ruleId'>): Promise<RoutingRule> {
  const resp = await axios.post(`${BASE}/routing/rules`, rule);
  return resp.data.data;
}

export async function updateRoutingRule(
  ruleId: string,
  updates: Partial<RoutingRule>,
): Promise<RoutingRule> {
  const resp = await axios.put(`${BASE}/routing/rules/${ruleId}`, updates);
  return resp.data.data;
}

export async function deleteRoutingRule(ruleId: string): Promise<void> {
  await axios.delete(`${BASE}/routing/rules/${ruleId}`);
}
```

- [ ] **Step 2: 创建 CostOptimizationPage**

```tsx
// APP-SUPERAI/src/pages/CostOptimizationPage.tsx
import { useState } from 'react';
import { Card, Form, InputNumber, Select, Button, Table, Tag, Space, Alert, Statistic, Row, Col } from 'antd';
import { PageContainer } from '@mate/shared';
import { recommendModel, type CandidateModel, type RoutingRecommendation } from '@/api/costOptimization';

const { Option } = Select;

export default function CostOptimizationPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RoutingRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    setError(null);
    try {
      const rec = await recommendModel({
        promptTokens: values.promptTokens,
        completionTokens: values.completionTokens,
        requiredCapabilities: values.requiredCapabilities || ['CHAT'],
        strategy: values.strategy || 'balanced',
      });
      setResult(rec);
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: '模型', dataIndex: 'displayName', key: 'displayName' },
    { title: '供应方', dataIndex: 'provider', key: 'provider' },
    { title: '预估成本', dataIndex: 'estimatedCost', key: 'estimatedCost', render: (v: number) => `$${v.toFixed(6)}` },
    { title: '预计延迟', dataIndex: 'estimatedLatencyMs', key: 'estimatedLatencyMs', render: (v: number) => `${v} ms` },
    { title: '评分', dataIndex: 'score', key: 'score' },
    { title: '原因', dataIndex: 'reason', key: 'reason' },
  ];

  return (
    <PageContainer title="成本优化" subTitle="选择性价比最高的模型">
      <Card title="路由模拟" style={{ marginBottom: 24 }}>
        <Form form={form} layout="inline" onFinish={handleSubmit} initialValues={{ promptTokens: 1000, completionTokens: 500, strategy: 'balanced', requiredCapabilities: ['CHAT'] }}>
          <Form.Item name="promptTokens" label="输入 Token">
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="completionTokens" label="输出 Token">
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="strategy" label="策略">
            <Select style={{ width: 140 }}>
              <Option value="cheapest">最便宜</Option>
              <Option value="balanced">均衡</Option>
              <Option value="best_quality">质量优先</Option>
            </Select>
          </Form.Item>
          <Form.Item name="requiredCapabilities" label="必需能力">
            <Select mode="multiple" style={{ width: 180 }}>
              <Option value="CHAT">对话</Option>
              <Option value="VISION">视觉</Option>
              <Option value="FUNCTION_CALLING">函数调用</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>获取推荐</Button>
          </Form.Item>
        </Form>
      </Card>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />}

      {result && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card><Statistic title="推荐模型" value={result.recommendedDisplayName} /></Card>
            </Col>
            <Col span={8}>
              <Card><Statistic title="预估成本" value={`$${result.estimatedCost.toFixed(6)}`} /></Card>
            </Col>
            <Col span={8}>
              <Card><Statistic title="可节省" value={`$${result.potentialSavings.toFixed(6)}`} suffix={`(${Math.round(result.savingsRate * 100)}%)`} /></Card>
            </Col>
          </Row>
          <Card title="候选模型排名">
            <Table
              rowKey="modelId"
              dataSource={result.candidates}
              columns={columns}
              pagination={false}
              rowClassName={(record) => (record.modelId === result.recommendedModelId ? 'ant-table-row-selected' : '')}
            />
          </Card>
        </>
      )}
    </PageContainer>
  );
}
```

- [ ] **Step 3: 注册路由与菜单**

```tsx
// APP-SUPERAI/src/App.tsx 修改
import CostOptimizationPage from '@/pages/CostOptimizationPage';

<Route path="cost-optimization" element={<CostOptimizationPage />} />
```

```typescript
// packages/shared/src/config/platformMenu.ts 修改
// 在 superai children 中追加
{ key: 'superai-cost-optimization', label: '成本优化', path: '/cost-optimization' },
```

- [ ] **Step 4: 运行前端类型检查**

Run: `cd APP-SUPERAI && npx tsc --noEmit`
Expected: PASS

---

### Task 5: 全链路验证

- [ ] **Step 1: 后端测试全绿**

Run: `cd TECH-LLMGW && python -m pytest tests/test_routing.py -v`
Expected: PASS

- [ ] **Step 2: 前端类型检查通过**

Run: `cd APP-SUPERAI && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: 本地启动后通过浏览器验证**

1. 访问 http://localhost:9301/cost-optimization
2. 输入 promptTokens=1000, completionTokens=500, strategy=cheapest
3. 点击「获取推荐」，确认返回推荐模型、预估成本、可节省金额
4. 切换 strategy=best_quality，确认推荐模型变化

---

## 验收标准

1. `POST /api/v1/llmgw/routing/recommend` 能根据能力要求与策略返回推荐模型与候选列表。
2. `POST /api/v1/llmgw/chat/completions` 在 `autoRoute=true` 时自动选择模型，响应中标识 `autoRouted=true`。
3. APP-SUPERAI `/cost-optimization` 页面可交互展示推荐结果与节省估算。
4. 路由规则 CRUD 端点可用，支持按租户隔离。
5. 新增测试全部通过，前端 `tsc --noEmit` 通过。

---

## 关联文档

- `docs/004-PLAN/PLAN-Mate_Platform-PRD交叉验证与迭代主线规划_v2.0-20260719.md` §5.6 V15-08
- `TECH-LLMGW/docs/SPEC-TECH-LLMGW-LLM网关服务规范_v1.0-20260716.md`
