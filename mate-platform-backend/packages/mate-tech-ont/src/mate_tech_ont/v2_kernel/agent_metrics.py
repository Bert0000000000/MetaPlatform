"""AI Agent 回归指标（只读 API）—— proposal 接受率 / 驳回原因分布 / 趋势。

平台铁律（ADR-0044 / MP-SAL-04）：AI 输出全部是 proposal，永不直写库；用户
confirm → execute 后才落库。因此 proposal 的接受/驳回统计就是数字员工 Agent
质量的回归基线。本模块只读，不产生任何写路径。

挂载方式（主会话集成；本文件不修改 api.py / main.py）::

    from .agent_metrics import router as agent_metrics_router
    app.include_router(agent_metrics_router)

契约对齐（13 硬规则 #1：Swagger 没有接口不写 route）：集成时需在
``contracts/openapi/services/ont.yaml`` 补录三个 operationId —— ``ontAgentMetricsSummary``
/ ``ontAgentMetricsTrend`` / ``ontAgentMetricsHealth``。

────────────────── 数据源调查结论（2026-09-14，代码考古） ──────────────────

① 状态机真实取值 —— ``mate_kernel/action/engine.py::ProposalStatus``（StrEnum）::

       pending → confirmed → executed
       pending → rejected        （人审显式驳回，终态）
       pending → withdrawn       （作者确认前自行撤回，终态；PRD-02）
       executed → reverted       （人审撤销 + 补偿，终态；PRD-02，7 天窗口）

   六个合法值：``pending / confirmed / rejected / executed / withdrawn / reverted``。
   持久化在 PG 表 ``ont_proposal.status``（TEXT，默认 'pending'；历史 'applied'
   已被 pg_repo 迁移语句归一为 'executed'）。

② 存储 —— 两套 ``list_proposals()`` 实现（本 API 的唯一数据入口）：
   - PG：``PgOntologyRepository.list_proposals()``（pg_repo.py）读 ``ont_proposal``
     表 ``ORDER BY created_at DESC LIMIT 200``，hydrate 成 kernel ``ActionProposal``。
     **注意 LIMIT 200 上限**：超长窗口（大租户 >200 条 proposal）时指标基于最近
     200 条计算，属上游既有行为，此处不放大窗口。
   - 内存（dev/test）：``InMemoryOntologyRepository.list_proposals()`` 读引擎
     ``ActionService._proposals`` 镜像。

③ 可用字段（hydrate 后的 ``ActionProposal`` dataclass）：
   - ``proposal_id`` / ``action_rid``（形如 ``ont.<tenant>.action.<slug>.<v>``）/
     ``target_iid`` / ``parameters`` / ``impact_summary`` / ``expected_diff``
   - ``kind``：``action / create_instance / model_type / edit_set / merge_suggestion``
   - ``status``（ProposalStatus）/ ``requires_hitl``
   - ``created_at``（datetime，UTC，恒有）/ ``confirmed_at``（datetime|None）/
     ``confirmed_by``（str|None）
   - **缺失**（PG 行有列但 ``_hydrate_proposal`` 不回填，或根本没写）：
     - ``created_by``：PG 列存在（pg_repo.py L493），但仅 ``_propose_edit_set_pg``
       写入硬编码 ``'ai-agent'``；``propose_action`` 的 INSERT 不含该列（空串）。
     - ``applied_at`` / ``updated_at``：PG 列存在，未 hydrate。
     - **驳回原因：任何层都不存在** —— ``ProposalConfirmDTO`` 为空（"reserved for
       future user-provided rationale"），``ont_proposal`` / ``ont_proposal_event``
       表均无 reason 列。

④ 时间戳口径（对 trend 分桶至关重要）：
   - ``created_at``：propose 时写入，恒有。
   - ``confirmed_at``：**仅在转 CONFIRMED 时写入**；rejected 转换保持 None
     （engine ``_transition_proposal``）；withdrawn 也不写。
   - executed 无独立时间戳（``applied_at`` 只在 PG 行里）。
   → 因此 trend 分桶口径：
     - ``proposed``  → ``created_at``
     - ``executed``  → ``confirmed_at``（confirm 紧邻 execute 于同一 HITL 流程，
       是执行时刻的最佳可得代理；缺失时回退 ``created_at``）
     - ``rejected``  → ``confirmed_at`` or ``created_at``（rejected 无转换时间戳，
       ``confirmed_at`` 恒为 None → 实际退化为按 ``created_at`` 锚定，见注释）

⑤ 「驳回 / 接受」判定口径（回归基线语义）：
   - **accepted = executed + reverted**：都曾被用户采纳并落库（reverted 是落地
     后 7 天内的人审撤销，proposal 本身确实被接受过）。
   - **rejected = 显式 rejected 终态**：存在显式驳回状态，无需用「pending 过期」
     等等价信号伪造。
   - **withdrawn 不计入分母**：作者（含 AI 代理）在评审前主动撤回，不是人审驳回。
   - **pending / confirmed 不计入分母**：尚未决策（在途）。
   - ``acceptance_rate = accepted / (accepted + rejected)``；分母为 0 时置 None
     （不编造 0% 或 100%）。
   - 驳回原因分布：数据源不存原因 → 有驳回记录但无原因字段时整体置 ``null``
     （维度缺失，不编造）；若记录携带 ``rejection_reason`` / ``reject_reason`` /
     ``reason`` 键（前向兼容），按值聚合，缺原因的驳回归入 ``(not recorded)`` 桶。

⑥ 租户守门（13 硬规则 #3，跟随 api.py GOVERN-06 模式）：
   - 第 0 层：``request.state.ctx``（AuthMiddleware 注入）→ ``ctx.tenant_id``。
   - 兜底（独立挂载 / 集成前测试用）：可选 header ``X-Tenant-Id``，缺省
     ``tenant-default``；**集成进主 app 后 AuthMiddleware 恒有 ctx，此兜底自然
     失效**，届时可删。
   - 第 1 层：``repo.tenant_scope(tenant)``（PG RLS SET LOCAL，若 repo 实现）。
   - 第 2 层：``action_rid`` 前缀 ``ont.<tenant>.`` 客户端过滤（镜像 api.py 的
     字符串前缀兜底；PG ``list_proposals()`` 本身无 WHERE tenant 条件，靠 RLS +
     本层过滤）。in-memory repo 的镜像对象同样带租户前缀，行为一致。
"""

from __future__ import annotations

import asyncio
from collections import Counter
from datetime import UTC, date, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

_logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/ont/v2/agent-metrics", tags=["ont-agent-metrics"])

DEFAULT_WINDOW_DAYS = 30
MAX_WINDOW_DAYS = 365
FALLBACK_TENANT = "tenant-default"  # 集成时由 AuthMiddleware 的 ctx 取代（见 docstring ⑥）
UNATTRIBUTED_ACTOR = "(unattributed)"  # created_by 缺失（现状：除 edit_set 外全缺）时的显式兜底桶
NOT_RECORDED_REASON = "(not recorded)"

# ProposalStatus（mate_kernel.action.engine）的六个合法值；未知历史值原样保留在 by_status。
CANONICAL_STATUSES: tuple[str, ...] = (
    "pending",
    "confirmed",
    "rejected",
    "executed",
    "withdrawn",
    "reverted",
)
# 口径⑤：accepted = executed + reverted（曾被采纳落地）；rejected 为显式驳回终态。
ACCEPTED_STATUSES: tuple[str, ...] = ("executed", "reverted")
REJECTED_STATUS = "rejected"


# ─────────────────── 纯函数区（可脱离 HTTP 单测） ───────────────────


def _clamp_days(days: int) -> int:
    """窗口天数收敛到 [1, 365]；非法值回退默认 30（端点另有 Query(ge/le) 双保险）。"""
    try:
        d = int(days)
    except (TypeError, ValueError):
        return DEFAULT_WINDOW_DAYS
    return max(1, min(d, MAX_WINDOW_DAYS))


def _to_utc(value: Any) -> datetime | None:
    """宽松解析 datetime / ISO 字符串 → tz-aware UTC datetime；naive 视作 UTC。"""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        if s.endswith(("Z", "z")):
            s = s[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(s)
        except ValueError:
            return None
        return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
    return None


def _status_value(raw: Any) -> str:
    """ProposalStatus 枚举 / str 统一成 str（StrEnum 的 .value 与自身字符串相等）。"""
    v = getattr(raw, "value", raw)
    return str(v) if v is not None else "unknown"


def _rejection_reason_of(p: dict[str, Any]) -> str:
    """前向兼容取驳回原因：数据源现状不存任何 reason 字段（见 docstring ③）。"""
    for key in ("rejection_reason", "reject_reason", "reason"):
        v = str(p.get(key) or "").strip()
        if v:
            return v
    return ""


def summarize(proposals: list[dict[str, Any]], *, days: int = DEFAULT_WINDOW_DAYS, now: datetime | None = None) -> dict[str, Any]:
    """窗口内 proposal 回归汇总（纯函数）。

    入参每条是归一化 dict：``status``（str|enum）、``created_at``（datetime|ISO）、
    ``confirmed_at``、``created_by``、``rejection_reason`` 等键（缺省容忍）。
    窗口 = ``created_at ∈ [now - days, now]``（闭区间，UTC）。无法解析 created_at
    的记录不进窗口（无时间锚点，不编造）。

    返回 ``{total, by_status, acceptance_rate, rejection_reasons, by_actor, window_days}``；
    口径详见模块 docstring ⑤。
    """
    days = _clamp_days(days)
    now_utc = _to_utc(now) or datetime.now(UTC)
    cutoff = now_utc - timedelta(days=days)

    window: list[dict[str, Any]] = []
    for p in proposals:
        created = _to_utc(p.get("created_at"))
        if created is not None and created >= cutoff:
            window.append(p)

    by_status: dict[str, int] = dict.fromkeys(CANONICAL_STATUSES, 0)
    for p in window:
        s = _status_value(p.get("status"))
        by_status[s] = by_status.get(s, 0) + 1  # 未知历史状态原样保留

    accepted = sum(by_status.get(s, 0) for s in ACCEPTED_STATUSES)
    rejected_n = by_status.get(REJECTED_STATUS, 0)
    decided = accepted + rejected_n
    # 口径⑤：pending/confirmed 在途、withdrawn 自撤 —— 均不入分母；分母 0 → None。
    acceptance_rate = round(accepted / decided, 4) if decided > 0 else None

    # 驳回原因分布：现状数据源不存原因 → 有驳回但无原因时整体置 null（不编造）。
    rejected_rows = [p for p in window if _status_value(p.get("status")) == REJECTED_STATUS]
    rejection_reasons: list[dict[str, Any]] | None
    if not rejected_rows:
        rejection_reasons = []  # 窗口内无驳回：空分布是事实，不是维度缺失
    else:
        counter: Counter[str] = Counter()
        has_any_reason = False
        for p in rejected_rows:
            r = _rejection_reason_of(p)
            if r:
                has_any_reason = True
            counter[r or NOT_RECORDED_REASON] += 1
        if has_any_reason:
            rejection_reasons = [
                {"reason": k, "count": v}
                for k, v in sorted(counter.items(), key=lambda kv: (-kv[1], kv[0]))
            ]
        else:
            rejection_reasons = None  # 维度缺失：schema 无 reason 字段（docstring ③⑤）

    # by_actor：按 created_by 聚合。注意覆盖度是部分的——现状仅 kind=edit_set 的
    # PG 行写 'ai-agent'，其余路径 created_by 为空 → 落 "(unattributed)" 显式桶
    # （不是编造，是标注不可归因）。confirmed_by 是评审人不是提议人，不用于本维度。
    actors: dict[str, dict[str, int]] = {}
    for p in window:
        actor = str(p.get("created_by") or "").strip() or UNATTRIBUTED_ACTOR
        b = actors.setdefault(actor, {"proposed": 0, "executed": 0, "rejected": 0})
        b["proposed"] += 1
        s = _status_value(p.get("status"))
        if s in ACCEPTED_STATUSES:
            b["executed"] += 1
        elif s == REJECTED_STATUS:
            b["rejected"] += 1
    by_actor: list[dict[str, Any]] = []
    for actor, b in sorted(actors.items(), key=lambda kv: (-kv[1]["proposed"], kv[0])):
        denom = b["executed"] + b["rejected"]
        by_actor.append(
            {
                "actor": actor,
                "proposed": b["proposed"],
                "executed": b["executed"],
                "acceptance_rate": round(b["executed"] / denom, 4) if denom > 0 else None,
            }
        )

    return {
        "total": len(window),
        "by_status": by_status,
        "acceptance_rate": acceptance_rate,
        "rejection_reasons": rejection_reasons,
        "by_actor": by_actor,
        "window_days": days,
    }


def trend(
    proposals: list[dict[str, Any]],
    *,
    days: int = DEFAULT_WINDOW_DAYS,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    """窗口内 proposal 按天分桶趋势（纯函数，UTC 日历日，零填充连续序列）。

    口径（docstring ④）：
    - 窗口过滤按 ``created_at``（cohort 口径：近 N 天提出的 proposal 及其结局）；
    - ``proposed`` 桶 = ``created_at`` 的 UTC 日期；
    - ``executed`` 桶 = ``confirmed_at`` 日期（executed 无独立时间戳，confirm 紧邻
      execute，是最优代理）；缺失回退 ``created_at``；
    - ``rejected`` 桶 = ``confirmed_at`` or ``created_at``（rejected 转换不写
      ``confirmed_at``，恒退化为 ``created_at`` 锚定）；
    - reverted 计入 executed（曾被采纳落地，口径⑤）；
    - days=N 时由于 UTC 日历日对齐，最多产出 N+1 个桶（含首尾零桶）。
    """
    days = _clamp_days(days)
    now_utc = _to_utc(now) or datetime.now(UTC)
    cutoff = now_utc - timedelta(days=days)

    buckets: dict[date, dict[str, int]] = {}
    d = cutoff.date()
    while d <= now_utc.date():
        buckets[d] = {"proposed": 0, "executed": 0, "rejected": 0}
        d += timedelta(days=1)

    for p in proposals:
        created = _to_utc(p.get("created_at"))
        if created is None or created < cutoff:
            continue
        cdate = created.date()
        if cdate in buckets:
            buckets[cdate]["proposed"] += 1
        s = _status_value(p.get("status"))
        if s in ACCEPTED_STATUSES or s == REJECTED_STATUS:
            decision = _to_utc(p.get("confirmed_at")) or created
            key = "executed" if s in ACCEPTED_STATUSES else REJECTED_STATUS
            if decision.date() in buckets:
                buckets[decision.date()][key] += 1

    return [{"date": k.isoformat(), **v} for k, v in sorted(buckets.items())]


# ─────────────────── HTTP 适配区（跟随 v2 api.py 只读端点模式） ───────────────────


class RejectionReasonBucket(BaseModel):
    reason: str
    count: int


class ActorSummary(BaseModel):
    actor: str
    proposed: int
    executed: int
    acceptance_rate: float | None = None  # 分母 0（无已决策 proposal）→ None


class AgentMetricsSummary(BaseModel):
    total: int
    by_status: dict[str, int]
    acceptance_rate: float | None = None
    rejection_reasons: list[RejectionReasonBucket] | None = None  # 维度缺失 → null（docstring ⑤）
    by_actor: list[ActorSummary] = Field(default_factory=list)
    window_days: int


class TrendPoint(BaseModel):
    date: str  # YYYY-MM-DD（UTC）
    proposed: int
    executed: int
    rejected: int


class AgentMetricsHealth(BaseModel):
    source: str  # kernel_repo 具体实现类名（PgOntologyRepository / InMemoryOntologyRepository / unavailable）
    available: bool
    proposal_count: int


def _tenant_id(request: Request) -> str:
    """三层取租户：AuthMiddleware ctx → X-Tenant-Id header → tenant-default。

    集成进主 app 后第 0 层恒命中（api.py 同款守门）；header / 默认值仅服务
    独立挂载与本地测试，集成时可删（docstring ⑥）。
    """
    ctx = getattr(request.state, "ctx", None)
    tenant = getattr(ctx, "tenant_id", None) if ctx is not None else None
    if tenant:
        return str(tenant)
    header = (request.headers.get("X-Tenant-Id") or "").strip()
    return header or FALLBACK_TENANT


def _proposal_record(p: Any) -> dict[str, Any]:
    """hydrate 后的 ActionProposal（或鸭子类型同构体）→ 归一化 dict。

    created_by / rejection_reason 现状不在 ActionProposal 上（PG 有 created_by
    列但 _hydrate_proposal 不回填；reason 全链路不存在）→ getattr 兜底空串，
    前向兼容：kernel 补字段后本 API 无需改动即开始聚合。
    """
    return {
        "proposal_id": str(getattr(p, "proposal_id", "") or ""),
        "status": _status_value(getattr(p, "status", None)),
        "kind": str(getattr(p, "kind", "action") or "action"),
        "action_rid": str(getattr(p, "action_rid", "") or ""),
        "created_at": getattr(p, "created_at", None),
        "confirmed_at": getattr(p, "confirmed_at", None),
        "confirmed_by": getattr(p, "confirmed_by", None),
        "created_by": str(getattr(p, "created_by", "") or ""),
        "rejection_reason": str(getattr(p, "rejection_reason", "") or ""),
    }


def _get_repo(request: Request) -> Any:
    """镜像 api.py ``_repo``：app.state.kernel_repo 缺位 → 503。"""
    repo = getattr(request.app.state, "kernel_repo", None)
    if repo is None:
        raise HTTPException(status_code=503, detail="kernel_repo not initialized")
    return repo


def _tenant_visible(records: list[dict[str, Any]], tenant: str) -> list[dict[str, Any]]:
    """GOVERN-06 第 2 层：action_rid 前缀 ``ont.<tenant>..`` 客户端过滤。

    PG ``list_proposals()`` 的 SELECT 无 tenant WHERE（靠 RLS）；in-memory 镜像
    完全无租户概念 —— 本层保证两后端一致的租户可见性。
    """
    prefix = f"ont.{tenant}."
    return [r for r in records if r["action_rid"].startswith(prefix)]


def _fetch_raw_proposals(repo: Any, tenant: str) -> list[Any]:
    """同步取数（由端点推 threadpool，镜像 api.py ``_call`` 模式）。

    有 ``tenant_scope``（PgOntologyRepository，RLS SET LOCAL）则进 scope 取；
    in-memory 无 scope 直取，租户隔离由 ``_tenant_visible`` 兜底。
    注意：PG 路径受上游 ``LIMIT 200`` 约束（docstring ②）。
    """
    lister = getattr(repo, "list_proposals", None)
    if not callable(lister):
        return []
    scope = getattr(repo, "tenant_scope", None)
    if callable(scope):
        with scope(tenant) as scoped:  # type: ignore[operator]
            return list(scoped.list_proposals())
    return list(lister())


async def _load_records(request: Request, tenant: str) -> list[dict[str, Any]]:
    repo = _get_repo(request)
    raw = await asyncio.to_thread(_fetch_raw_proposals, repo, tenant)
    return _tenant_visible([_proposal_record(p) for p in raw], tenant)


@router.get(
    "/summary",
    response_model=AgentMetricsSummary,
    operation_id="ontAgentMetricsSummary",
)
async def agent_metrics_summary(
    request: Request,
    days: int = Query(DEFAULT_WINDOW_DAYS, ge=1, le=MAX_WINDOW_DAYS, description="统计窗口天数（默认 30，上限 365）"),
) -> AgentMetricsSummary:
    """Agent proposal 回归汇总：总量 / 状态分布 / 接受率 / 驳回原因 / 按提议方。"""
    tenant = _tenant_id(request)
    records = await _load_records(request, tenant)
    _logger.info(
        "ont.agent_metrics.summary",
        tenant_id=tenant,
        days=days,
        visible_records=len(records),
    )
    return AgentMetricsSummary(**summarize(records, days=days))


@router.get(
    "/trend",
    response_model=list[TrendPoint],
    operation_id="ontAgentMetricsTrend",
)
async def agent_metrics_trend(
    request: Request,
    days: int = Query(DEFAULT_WINDOW_DAYS, ge=1, le=MAX_WINDOW_DAYS, description="趋势窗口天数（默认 30，上限 365）"),
) -> list[TrendPoint]:
    """Agent proposal 按天趋势：{date, proposed, executed, rejected}（UTC 零填充）。"""
    tenant = _tenant_id(request)
    records = await _load_records(request, tenant)
    _logger.info(
        "ont.agent_metrics.trend",
        tenant_id=tenant,
        days=days,
        visible_records=len(records),
    )
    return [TrendPoint(**pt) for pt in trend(records, days=days)]


@router.get(
    "/health",
    response_model=AgentMetricsHealth,
    operation_id="ontAgentMetricsHealth",
)
async def agent_metrics_health(request: Request) -> AgentMetricsHealth:
    """数据源探针：kernel_repo 类型 / 可用性 / 当前租户可见 proposal 数。

    任何取数异常都降级为 ``available=False``（探针不 500），异常细节走日志。
    """
    tenant = _tenant_id(request)
    repo = getattr(request.app.state, "kernel_repo", None)
    if repo is None:
        return AgentMetricsHealth(source="unavailable", available=False, proposal_count=0)
    source = type(repo).__name__
    try:
        records = await _load_records(request, tenant)
    except Exception as e:
        _logger.warning("ont.agent_metrics.health_failed", source=source, error=str(e))
        return AgentMetricsHealth(source=source, available=False, proposal_count=0)
    return AgentMetricsHealth(source=source, available=True, proposal_count=len(records))
