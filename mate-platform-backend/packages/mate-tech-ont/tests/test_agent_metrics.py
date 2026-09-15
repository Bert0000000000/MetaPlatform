"""agent_metrics 只读 API 测试 —— 纯函数聚合 + TestClient 端点。

数据契约依据 mate_kernel.action.engine.ActionProposal（真实 hydrate 形态）与
PG 表 ont_proposal 列集；口径详见 agent_metrics.py 模块 docstring。
"""

from __future__ import annotations

from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from typing import Any, Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from mate_kernel.action.engine import ActionProposal, ProposalStatus
from mate_tech_ont.v2_kernel.agent_metrics import (
    DEFAULT_WINDOW_DAYS,
    MAX_WINDOW_DAYS,
    UNATTRIBUTED_ACTOR,
    router,
    summarize,
    trend,
)

# 固定"现在"，保证窗口/分桶判定确定性。
NOW = datetime(2026, 9, 14, 12, 0, 0, tzinfo=UTC)
TENANT = "acme"


def ago(**kwargs: int) -> datetime:
    return NOW - timedelta(**kwargs)


def _recent(**kwargs: int) -> datetime:
    """相对**真实当前时间**——供 HTTP 端点用例。

    端点按"真实 now"切分趋势窗口/分桶，而 `NOW` 是硬编码的测试基准
    （2026-09-14 12:00 UTC）。二者跨天即错位：实测 2026-09-15 零点后
    `test_endpoint_trend_shape` 挂（`assert '2026-09-15' == '2026-09-14'`）。
    """
    return datetime.now(UTC) - timedelta(**kwargs)


def rec(
    status: str | ProposalStatus,
    *,
    created_at: datetime | str,
    confirmed_at: datetime | str | None = None,
    confirmed_by: str | None = None,
    kind: str = "action",
    action_rid: str = f"ont.{TENANT}.action.do-thing.v1",
    created_by: str = "",
    rejection_reason: str = "",
    proposal_id: str = "prop-x",
) -> dict[str, Any]:
    return {
        "proposal_id": proposal_id,
        "status": status,
        "kind": kind,
        "action_rid": action_rid,
        "created_at": created_at,
        "confirmed_at": confirmed_at,
        "confirmed_by": confirmed_by,
        "created_by": created_by,
        "rejection_reason": rejection_reason,
    }


# ─────────────────── summarize 纯函数 ───────────────────


def test_summarize_status_distribution_and_acceptance_rate() -> None:
    props = [
        rec("executed", created_at=ago(hours=1), confirmed_at=ago(minutes=30), confirmed_by="alice"),
        rec("executed", created_at=ago(days=2), confirmed_at=ago(days=2)),
        rec("reverted", created_at=ago(days=3), confirmed_at=ago(days=3)),  # 曾被采纳 → accepted
        rec("rejected", created_at=ago(days=4)),
        rec("pending", created_at=ago(hours=2)),
        rec("withdrawn", created_at=ago(days=5)),
        rec("confirmed", created_at=ago(hours=3)),
    ]
    out = summarize(props, days=30, now=NOW)
    assert out["total"] == 7
    assert out["by_status"] == {
        "pending": 1,
        "confirmed": 1,
        "rejected": 1,
        "executed": 2,
        "withdrawn": 1,
        "reverted": 1,
    }
    # 口径：accepted = executed(2) + reverted(1) = 3；分母 = 3 + rejected(1) = 4。
    assert out["acceptance_rate"] == pytest.approx(0.75)
    assert out["window_days"] == 30
    # withdrawn（自撤）/ pending / confirmed 不进分母 —— 无驳回也无接受时另测。


def test_summarize_window_filters_old_proposals() -> None:
    props = [
        rec("executed", created_at=ago(days=31), confirmed_at=ago(days=31)),  # 窗口外
        rec("executed", created_at=ago(days=29), confirmed_at=ago(days=29)),  # 窗口内
        rec("rejected", created_at=ago(hours=1)),
    ]
    out = summarize(props, days=30, now=NOW)
    assert out["total"] == 2
    assert out["by_status"]["executed"] == 1
    assert out["acceptance_rate"] == pytest.approx(0.5)


def test_summarize_acceptance_rate_none_when_no_decided() -> None:
    props = [
        rec("pending", created_at=ago(hours=1)),
        rec("confirmed", created_at=ago(hours=2)),
        rec("withdrawn", created_at=ago(days=1)),
    ]
    out = summarize(props, days=30, now=NOW)
    assert out["acceptance_rate"] is None  # 不编造 0% / 100%


def test_summarize_rejection_reasons_null_when_field_missing() -> None:
    """数据源不存驳回原因（ProposalConfirmDTO 为空 / PG 无 reason 列）→ null。"""
    props = [
        rec("rejected", created_at=ago(hours=1)),
        rec("rejected", created_at=ago(days=1)),
        rec("executed", created_at=ago(days=2), confirmed_at=ago(days=2)),
    ]
    out = summarize(props, days=30, now=NOW)
    assert out["rejection_reasons"] is None
    assert out["by_status"]["rejected"] == 2


def test_summarize_rejection_reasons_distribution_when_present() -> None:
    """前向兼容：记录携带 rejection_reason 时按值聚合，缺值入 (not recorded)。"""
    props = [
        rec("rejected", created_at=ago(hours=1), rejection_reason="wrong-target"),
        rec("rejected", created_at=ago(hours=2), rejection_reason="wrong-target"),
        rec("rejected", created_at=ago(hours=3), rejection_reason="bad-format"),
        rec("rejected", created_at=ago(hours=4)),  # 无原因
        rec("executed", created_at=ago(days=2), confirmed_at=ago(days=2)),
    ]
    out = summarize(props, days=30, now=NOW)
    # 排序：count 降序，同 count 按字典序 —— "(" < "b"，故 (not recorded) 在 bad-format 前。
    assert out["rejection_reasons"] == [
        {"reason": "wrong-target", "count": 2},
        {"reason": "(not recorded)", "count": 1},
        {"reason": "bad-format", "count": 1},
    ]
    # 无驳回时是空列表（事实空），不是 null。
    assert summarize([props[-1]], days=30, now=NOW)["rejection_reasons"] == []


def test_summarize_by_actor_with_unattributed_fallback() -> None:
    """created_by 仅 edit_set 路径记录 'ai-agent'；其余空串 → (unattributed) 桶。"""
    props = [
        rec("executed", created_at=ago(hours=1), kind="edit_set", created_by="ai-agent", confirmed_at=ago(hours=1)),
        rec("rejected", created_at=ago(hours=2), kind="edit_set", created_by="ai-agent"),
        rec("executed", created_at=ago(hours=3), kind="edit_set", created_by="ai-agent", confirmed_at=ago(hours=3)),
        rec("pending", created_at=ago(hours=4)),  # created_by 缺省 ""
        rec("executed", created_at=ago(hours=5), confirmed_at=ago(hours=5)),
    ]
    out = summarize(props, days=30, now=NOW)
    assert out["by_actor"] == [
        {
            "actor": "ai-agent",
            "proposed": 3,
            "executed": 2,
            "acceptance_rate": pytest.approx(0.6667),
        },
        {
            "actor": UNATTRIBUTED_ACTOR,
            "proposed": 2,
            "executed": 1,
            "acceptance_rate": 1.0,
        },
    ]


# ─────────────────── trend 纯函数 ───────────────────


def test_trend_daily_buckets_with_zero_fill() -> None:
    props = [
        rec("executed", created_at=ago(days=6), confirmed_at=ago(days=6)),
        rec("pending", created_at=ago(days=1)),
        rec("rejected", created_at=ago(hours=1)),
    ]
    out = trend(props, days=7, now=NOW)
    # days=7：UTC 日历日对齐 → [NOW-7d, NOW] 共 8 个连续零填充桶。
    assert len(out) == 8
    assert [pt["date"] for pt in out] == [
        (NOW - timedelta(days=7)).date().isoformat(),
        (NOW - timedelta(days=6)).date().isoformat(),
        (NOW - timedelta(days=5)).date().isoformat(),
        (NOW - timedelta(days=4)).date().isoformat(),
        (NOW - timedelta(days=3)).date().isoformat(),
        (NOW - timedelta(days=2)).date().isoformat(),
        (NOW - timedelta(days=1)).date().isoformat(),
        NOW.date().isoformat(),
    ]
    by_date = {pt["date"]: pt for pt in out}
    assert by_date[(NOW - timedelta(days=6)).date().isoformat()] == {
        "date": (NOW - timedelta(days=6)).date().isoformat(),
        "proposed": 1,
        "executed": 1,
        "rejected": 0,
    }
    assert by_date[(NOW - timedelta(days=5)).date().isoformat()]["proposed"] == 0
    assert by_date[NOW.date().isoformat()]["rejected"] == 1


def test_trend_executed_uses_confirmed_at_and_rejected_falls_back_to_created() -> None:
    """executed 无独立时间戳 → confirmed_at 代理；rejected 无转换时间戳 → created_at。"""
    props = [
        # 5 天前提出、1 天前确认并执行：proposed 落 D-5，executed 落 D-1。
        rec("executed", created_at=ago(days=5), confirmed_at=ago(days=1)),
        # 2 天前提出后被驳回（confirmed_at 恒 None）→ rejected 落 D-2。
        rec("rejected", created_at=ago(days=2)),
        # 4 天前提出、落地后撤销：reverted 计入 executed 桶（D-4 落地）。
        rec("reverted", created_at=ago(days=4), confirmed_at=ago(days=4)),
    ]
    out = trend(props, days=7, now=NOW)
    by_date = {pt["date"]: pt for pt in out}
    assert by_date[(NOW - timedelta(days=5)).date().isoformat()]["proposed"] == 1
    assert by_date[(NOW - timedelta(days=5)).date().isoformat()]["executed"] == 0
    assert by_date[(NOW - timedelta(days=1)).date().isoformat()]["executed"] == 1
    assert by_date[(NOW - timedelta(days=2)).date().isoformat()]["rejected"] == 1
    assert by_date[(NOW - timedelta(days=4)).date().isoformat()]["executed"] == 1


def test_empty_data_shapes() -> None:
    out = summarize([], days=30, now=NOW)
    assert out["total"] == 0
    assert all(v == 0 for v in out["by_status"].values())
    assert out["acceptance_rate"] is None
    assert out["rejection_reasons"] == []
    assert out["by_actor"] == []
    pts = trend([], days=6, now=NOW)
    assert len(pts) == 7
    assert all(pt["proposed"] == 0 and pt["executed"] == 0 and pt["rejected"] == 0 for pt in pts)


def test_single_day_window_boundary_inclusive() -> None:
    """days=1 闭区间：恰好 24h 前的记录入窗，24h+1s 前的出窗。"""
    props = [
        rec("executed", created_at=ago(days=1), confirmed_at=ago(days=1)),  # 恰在边界
        rec("rejected", created_at=ago(days=1, seconds=1)),  # 边界外 1 秒
        rec("pending", created_at=NOW),  # 当前时刻
    ]
    out = summarize(props, days=1, now=NOW)
    assert out["total"] == 2
    assert out["by_status"]["executed"] == 1
    assert out["by_status"]["pending"] == 1
    assert out["by_status"]["rejected"] == 0


def test_days_clamped_to_max_window() -> None:
    old = [rec("executed", created_at=ago(days=400), confirmed_at=ago(days=400))]
    # days=10000 收敛到 365：400 天前的记录在 365 天窗口外，不入窗。
    assert summarize(old, days=10_000, now=NOW) == summarize(old, days=MAX_WINDOW_DAYS, now=NOW)
    assert summarize(old, days=MAX_WINDOW_DAYS, now=NOW)["total"] == 0
    # days<=0 收敛为 1（纯函数层兜底；端点层由 Query(ge=1) 422 拦截）。
    recent = [rec("pending", created_at=ago(hours=2))]
    assert summarize(recent, days=0, now=NOW)["window_days"] == 1
    assert summarize(recent, days=0, now=NOW)["total"] == 1
    assert len(trend([], days=-5, now=NOW)) == 2  # days=1 → [NOW-1d, NOW] 两桶


def test_iso_string_created_at_and_enum_status_tolerated() -> None:
    """入参容忍 ISO 字符串时间与 ProposalStatus 枚举状态（hydrate 后真实形态）。"""
    props = [
        rec(ProposalStatus.EXECUTED, created_at=ago(hours=1).isoformat(), confirmed_at=ago(hours=1).isoformat()),
        rec(ProposalStatus.REJECTED, created_at="2026-09-14T10:00:00+00:00"),
    ]
    out = summarize(props, days=1, now=NOW)
    assert out["total"] == 2
    assert out["by_status"]["executed"] == 1
    assert out["by_status"]["rejected"] == 1
    assert out["acceptance_rate"] == pytest.approx(0.5)


# ─────────────────── HTTP 端点（bare FastAPI + 真实 ActionProposal 对象） ───────────────────


def _kernel_prop(
    proposal_id: str,
    status: ProposalStatus,
    created_at: datetime,
    confirmed_at: datetime | None = None,
    action_rid: str = f"ont.{TENANT}.action.do-thing.v1",
    kind: str = "action",
) -> ActionProposal:
    """真实 kernel dataclass —— 证明 _proposal_record 与 hydrate 形态兼容。"""
    return ActionProposal(
        proposal_id=proposal_id,
        action_rid=action_rid,
        target_iid=None,
        parameters={},
        impact_summary="",
        created_at=created_at,
        status=status,
        kind=kind,
        confirmed_by="alice" if confirmed_at else None,
        confirmed_at=confirmed_at,
    )


class StubRepo:
    """list_proposals + tenant_scope 的最小双后端兼容桩（PG / InMemory 形态）。"""

    source_name = "StubOntologyRepository"

    def __init__(self, props: list[ActionProposal]) -> None:
        self._props = props
        self.last_scope: str | None = None

    def tenant_scope(self, tenant_id: str) -> Any:
        @contextmanager
        def _cm() -> Iterator["StubRepo"]:
            self.last_scope = tenant_id
            yield self

        return _cm()

    def list_proposals(self) -> list[ActionProposal]:
        return list(self._props)


@pytest.fixture
def stub_repo() -> StubRepo:
    return StubRepo(
        [
            # 偏移用**秒级**：端点按 UTC 日期分桶，分钟级偏移在刚过 UTC 午夜时
            # 会落到前一天（实测 00:04 UTC 下 minutes=5 即跨天）。
            _kernel_prop("p-1", ProposalStatus.EXECUTED, _recent(seconds=5), confirmed_at=_recent(seconds=3)),
            _kernel_prop("p-2", ProposalStatus.REJECTED, _recent(seconds=10)),
            # 跨租户行：X-Tenant-Id=acme 下必须不可见（GOVERN-06 第 2 层前缀过滤）。
            _kernel_prop(
                "p-3",
                ProposalStatus.EXECUTED,
                _recent(seconds=15),
                confirmed_at=_recent(seconds=15),
                action_rid="ont.other-tenant.action.sneaky.v1",
            ),
        ]
    )


@pytest.fixture
def client(stub_repo: StubRepo) -> TestClient:
    app = FastAPI()
    app.include_router(router)
    app.state.kernel_repo = stub_repo
    return TestClient(app)


def test_endpoint_summary_scopes_tenant_and_aggregates(client: TestClient, stub_repo: StubRepo) -> None:
    resp = client.get(
        "/api/v1/ont/v2/agent-metrics/summary",
        params={"days": 30},
        headers={"X-Tenant-Id": TENANT},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2  # 跨租户 p-3 被过滤
    assert body["by_status"] == {
        "pending": 0,
        "confirmed": 0,
        "rejected": 1,
        "executed": 1,
        "withdrawn": 0,
        "reverted": 0,
    }
    assert body["acceptance_rate"] == pytest.approx(0.5)
    assert body["rejection_reasons"] is None  # 数据源无 reason 字段
    assert stub_repo.last_scope == TENANT  # tenant_scope（RLS 第 1 层）被走过


def test_endpoint_trend_shape(client: TestClient) -> None:
    resp = client.get(
        "/api/v1/ont/v2/agent-metrics/trend",
        params={"days": 1},
        headers={"X-Tenant-Id": TENANT},
    )
    assert resp.status_code == 200
    pts = resp.json()
    assert len(pts) == 2  # days=1 → [NOW-1d, NOW]
    # 端点按**真实 now** 分桶（不能用硬编码 NOW，见 _recent 的注释）
    assert pts[-1]["date"] == datetime.now(UTC).date().isoformat()
    assert pts[-1]["proposed"] == 2  # p-1 / p-2（跨租户 p-3 排除）
    assert pts[-1]["executed"] == 1
    assert pts[-1]["rejected"] == 1


def test_endpoint_days_query_validation(client: TestClient) -> None:
    base = "/api/v1/ont/v2/agent-metrics/summary"
    h = {"X-Tenant-Id": TENANT}
    assert client.get(base, params={"days": 0}, headers=h).status_code == 422
    assert client.get(base, params={"days": MAX_WINDOW_DAYS + 1}, headers=h).status_code == 422
    assert client.get(base, params={"days": -1}, headers=h).status_code == 422
    ok = client.get(base, params={"days": MAX_WINDOW_DAYS}, headers=h)
    assert ok.status_code == 200
    assert ok.json()["window_days"] == MAX_WINDOW_DAYS


def test_endpoint_health_probe(client: TestClient) -> None:
    resp = client.get("/api/v1/ont/v2/agent-metrics/health", headers={"X-Tenant-Id": TENANT})
    assert resp.status_code == 200
    body = resp.json()
    # source = type(repo).__name__（端点上报实现类名，与 pg/in-memory 后端一致）。
    assert body == {"source": "StubRepo", "available": True, "proposal_count": 2}


def test_endpoint_health_without_repo_degrades() -> None:
    """kernel_repo 未初始化：/health 降级 available=False（探针不 500）；/summary 503。"""
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as c:
        h = {"X-Tenant-Id": TENANT}
        health = c.get("/api/v1/ont/v2/agent-metrics/health", headers=h)
        assert health.status_code == 200
        assert health.json() == {"source": "unavailable", "available": False, "proposal_count": 0}
        summary = c.get("/api/v1/ont/v2/agent-metrics/summary", headers=h)
        assert summary.status_code == 503


def test_endpoint_default_tenant_fallback(client: TestClient) -> None:
    """无 ctx 无 header → tenant-default（集成时由 AuthMiddleware ctx 取代）。"""
    resp = client.get("/api/v1/ont/v2/agent-metrics/summary")
    assert resp.status_code == 200
    assert resp.json()["total"] == 0  # ont.tenant-default. 前缀无匹配 —— 空而非报错
    assert resp.json()["window_days"] == DEFAULT_WINDOW_DAYS
