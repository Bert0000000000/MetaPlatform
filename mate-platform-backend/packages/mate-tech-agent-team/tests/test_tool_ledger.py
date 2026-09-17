"""A-3 / `MP-TOOL-IDEMPOTENCY-01`：工具调用级幂等账本。

判据（本文件逐条断言）：

1. **副作用最多一次**（主判据）—— 在工具**执行完成、回执未落**的窗口里把进程杀掉，
   恢复后那一次工具**不会**再执行。用带计数的假外部系统作桩，断言计数 ≤ 1。
2. **重放不重复** —— 已完成的调用再遇到，回放记下的结果，不再打到后端。
3. **失败不挡重试** —— 工具抛错 = 这一次没落地，允许重来。
4. **键是算出来的** —— ``tool_call_id`` 只取决于（工具名 + 规范化参数），与键序、
   进程、轮次都无关；否则跨重启的账本永远记不中。
5. **跨副本一致**（PG）—— 换一个账本实例（= 重启）读得到同一条记录；两个实例
   同时抢同一个键，只有一个拿到"真执行"。
6. **租户隔离**（PG）—— RLS 挡住跨租户读。
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest
from mate_tech_agent_team.employee import LlmEmployeeRuntime, _EvidenceCollector
from mate_tech_agent_team.profiles import ProfileRegistry
from mate_tech_agent_team.tool_ledger import (
    COMPLETED,
    RUNNING,
    InMemoryToolLedger,
    PgToolLedger,
    call_id,
)

TENANT = "tenant-acme"
OTHER = "tenant-other"
RUN = "run-abc123"
TASK = "t1"
TOOL = "ont_object_query"


# ── 带计数的假外部系统（可观测的副作用桩）──────────────────────────────


class _CountingToolbox:
    """每次 ``invoke`` 计数 +1 —— 这就是"副作用发生了几次"的观测面。"""

    def __init__(self, *, die_after: bool = False, fail: bool = False) -> None:
        self.count = 0
        self.die_after = die_after
        self.fail = fail

    async def descriptors(self, *, allowed: list[str]) -> list[dict[str, Any]]:
        return [{"name": TOOL, "description": "查对象", "inputSchema": {"type": "object"}}]

    async def schemas(self, *, allowed: list[str]) -> list[dict[str, Any]]:
        return []

    async def invoke(self, *, name: str, arguments: dict[str, Any], allowed: list[str]) -> Any:
        self.count += 1
        if self.die_after:
            # **进程被杀**的真实形态：BaseException 不被 ``except Exception`` 接住，
            # 于是账本行留在 ``running``——正是"执行了、回执没落"那个窗口。
            raise KeyboardInterrupt("进程在工具执行后被杀")
        if self.fail:
            raise RuntimeError("后端 schema 不合")
        return {"rows": [1, 2, 3]}


def _runtime(ledger: Any, toolbox: Any, log: list[dict[str, Any]] | None = None) -> Any:
    """真运行时里**只管工具闸门**的那一段（不需要模型）。"""
    runtime = LlmEmployeeRuntime(
        registry=ProfileRegistry(),
        llm_factory=lambda _ctx: None,
        toolbox_factory=lambda _tenant: toolbox,
        tool_ledger=ledger,
    )
    descriptor = {"name": TOOL, "description": "查对象", "inputSchema": {"type": "object"}}
    tool = runtime._gated_tool(
        descriptor,
        allowed=(TOOL,),
        toolbox=toolbox,
        log=log if log is not None else [],
        evidence=_EvidenceCollector("t1"),
        tenant_id=TENANT,
        run_id=RUN,
        task_id=TASK,
    )
    return tool


async def _invoke(tool: Any, **arguments: Any) -> str:
    return await tool.coroutine(**arguments)


def json_rows(value: Any) -> Any:
    """回放的结果是 dict（PG 存的是 JSONB）；回执是 JSON 字符串——比内容不比形态。"""
    return json.loads(value) if isinstance(value, str) else value


# ── 判据 1：最多一次（主判据）──────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_kill_after_the_side_effect_never_repeats_it() -> None:
    """**主判据**：工具执行完就被杀 → 恢复后那一次调用**不再执行**，计数 ≤ 1。"""
    ledger = InMemoryToolLedger()
    toolbox = _CountingToolbox(die_after=True)
    tool = _runtime(ledger, toolbox)

    with pytest.raises(KeyboardInterrupt):
        await _invoke(tool, class_rid="Order")
    assert toolbox.count == 1, "前提：这一次真的打到后端了"

    # 恢复：同一本账（同一进程内模拟）再走一次同样的调用。
    recovered = _CountingToolbox()  # 新进程里那个"真的后端"
    again = _runtime(ledger, recovered)
    receipt = await _invoke(again, class_rid="Order")

    assert recovered.count == 0, "被杀过的那一次调用又被执行了——副作用可能发生两次"
    assert "not re-executed" in receipt
    rows = await ledger.rows(tenant_id=TENANT, run_id=RUN)
    assert [row.status for row in rows] == [RUNNING]


@pytest.mark.asyncio
async def test_a_kill_before_the_side_effect_also_stays_at_most_once() -> None:
    """死在执行**之前**（意图已落、后端没碰）：同样不重跑 —— at-most-once 就是这么定义的。"""
    ledger = InMemoryToolLedger()
    toolbox = _CountingToolbox()
    await ledger.begin(
        tenant_id=TENANT,
        run_id=RUN,
        task_id=TASK,
        tool_call_id=call_id(TOOL, {"class_rid": "Order"}),
        tool_name=TOOL,
        arguments={"class_rid": "Order"},
    )
    # 这一步之后进程死了，工具一次都没执行。
    again = _runtime(ledger, toolbox)
    await _invoke(again, class_rid="Order")
    assert toolbox.count == 0


# ── 判据 2 / 3：回放与重试 ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_completed_call_replays_its_recorded_result() -> None:
    """已完成 → 回放记录，不再打到后端；回放的那一份与当初那一次是同一份。"""
    ledger = InMemoryToolLedger()
    toolbox = _CountingToolbox()
    log: list[dict[str, Any]] = []
    tool = _runtime(ledger, toolbox, log)

    first = await _invoke(tool, class_rid="Order")
    second = await _invoke(tool, class_rid="Order")

    assert toolbox.count == 1, "同样的调用被打到了后端两次"
    assert second == first, "回放的结果与当初那一次不一致"
    rows = await ledger.rows(tenant_id=TENANT, run_id=RUN)
    assert [row.status for row in rows] == [COMPLETED]
    assert rows[0].result_digest, "回执要留下摘要，回放才可检"
    deduplicated = [entry for entry in log if entry.get("deduplicated")]
    assert deduplicated and deduplicated[0]["deduplicated"] == "already_completed"
    assert (
        deduplicated[0]["invocation_id"] == f"{RUN}:{TASK}:{call_id(TOOL, {'class_rid': 'Order'})}"
    )


@pytest.mark.asyncio
async def test_a_failed_call_may_be_retried() -> None:
    """工具抛错 = 这一次没落地：账本记 failed，下一次允许真执行。"""
    ledger = InMemoryToolLedger()
    failing = _CountingToolbox(fail=True)
    log: list[dict[str, Any]] = []
    await _invoke(_runtime(ledger, failing, log), class_rid="Order")
    assert failing.count == 1
    rows = await ledger.rows(tenant_id=TENANT, run_id=RUN)
    assert [row.status for row in rows] == ["failed"]

    healthy = _CountingToolbox()
    receipt = await _invoke(_runtime(ledger, healthy, log), class_rid="Order")
    assert healthy.count == 1, "失败过的调用被永久挡住，等于一次抖动吃掉一个工具面"
    assert "rows" in receipt
    rows = await ledger.rows(tenant_id=TENANT, run_id=RUN)
    assert [row.status for row in rows] == [COMPLETED]


# ── 判据 4：键的形状 ────────────────────────────────────────────────────


def test_the_call_id_depends_only_on_the_intent() -> None:
    assert call_id(TOOL, {"a": 1, "b": 2}) == call_id(TOOL, {"b": 2, "a": 1}), "键序不该改变身份"
    assert call_id(TOOL, {"a": 1}) != call_id(TOOL, {"a": 2}), "参数不同就是两次调用"
    assert call_id(TOOL, {"a": 1}) != call_id("ont_list_classes", {"a": 1}), "工具名要参与"
    assert call_id(TOOL, None) == call_id(TOOL, {}), "没有参数与空参数是同一个意图"


@pytest.mark.asyncio
async def test_the_key_is_run_task_and_call_scoped() -> None:
    """同一份意图在不同 run / 不同子任务下是**不同的**调用（键的第一、二段）。"""
    ledger = InMemoryToolLedger()
    for run_id, task_id in ((RUN, TASK), (RUN, "t2"), ("run-other", TASK)):
        admission = await ledger.begin(
            tenant_id=TENANT,
            run_id=run_id,
            task_id=task_id,
            tool_call_id=call_id(TOOL, {"a": 1}),
            tool_name=TOOL,
            arguments={"a": 1},
        )
        assert admission.execute, f"{run_id}/{task_id} 被别的键挡住了"
    assert len(await ledger.rows(tenant_id=TENANT)) == 3


# ── 判据 5 / 6：PG（跨副本、跨重启、租户隔离）──────────────────────────


@pytest.mark.asyncio
async def test_pg_ledger_survives_a_restart(rls_schema: str, pg_dsns: tuple[str, str]) -> None:
    """换一个账本实例（= 进程重启）读到同一条：被杀过的那一次不会重跑。"""
    _, app_dsn = pg_dsns
    before = PgToolLedger(app_dsn, schema=rls_schema)
    toolbox = _CountingToolbox(die_after=True)
    with pytest.raises(KeyboardInterrupt):
        await _invoke(_runtime(before, toolbox), class_rid="Order")
    assert toolbox.count == 1

    after = PgToolLedger(app_dsn, schema=rls_schema)  # 新进程
    recovered = _CountingToolbox()
    await _invoke(_runtime(after, recovered), class_rid="Order")
    assert recovered.count == 0, "重启后把被杀过的那一次工具调用又跑了一遍"


@pytest.mark.asyncio
async def test_pg_two_replicas_only_one_executes(rls_schema: str, pg_dsns: tuple[str, str]) -> None:
    """两个副本同时抢同一个键：只有一个拿到"真执行"（原子 insert ... do nothing）。"""
    _, app_dsn = pg_dsns
    replicas = [PgToolLedger(app_dsn, schema=rls_schema) for _ in range(2)]
    key = call_id(TOOL, {"a": 1})

    admissions = await asyncio.gather(
        *(
            replica.begin(
                tenant_id=TENANT,
                run_id=RUN,
                task_id=TASK,
                tool_call_id=key,
                tool_name=TOOL,
                arguments={"a": 1},
                owner=f"replica-{index}",
            )
            for index, replica in enumerate(replicas)
        )
    )
    assert sum(1 for admission in admissions if admission.execute) == 1, (
        f"两个副本都拿到了执行权：{[a.reason for a in admissions]}"
    )
    assert {admission.reason for admission in admissions} == {"fresh", "in_flight"}


@pytest.mark.asyncio
async def test_pg_rows_are_tenant_scoped(rls_schema: str, pg_dsns: tuple[str, str]) -> None:
    _, app_dsn = pg_dsns
    ledger = PgToolLedger(app_dsn, schema=rls_schema)
    for tenant in (TENANT, OTHER):
        await ledger.begin(
            tenant_id=tenant,
            run_id=RUN,
            task_id=TASK,
            tool_call_id=call_id(TOOL, {"t": tenant}),
            tool_name=TOOL,
            arguments={"t": tenant},
        )

    assert len(await ledger.rows(tenant_id=TENANT)) == 1
    assert len(await ledger.rows(tenant_id=OTHER)) == 1
    assert (await ledger.rows(tenant_id=TENANT))[0].tenant_id == TENANT


@pytest.mark.asyncio
async def test_pg_a_recorded_result_is_replayed_after_restart(
    rls_schema: str, pg_dsns: tuple[str, str]
) -> None:
    """回执跨重启仍然读得回来（回放靠的是**记下来的结果**，不是内存里的残影）。"""
    _, app_dsn = pg_dsns
    first = PgToolLedger(app_dsn, schema=rls_schema)
    toolbox = _CountingToolbox()
    receipt = await _invoke(_runtime(first, toolbox), class_rid="Order")

    after = PgToolLedger(app_dsn, schema=rls_schema)
    recorded = await after.begin(
        tenant_id=TENANT,
        run_id=RUN,
        task_id=TASK,
        tool_call_id=call_id(TOOL, {"class_rid": "Order"}),
        tool_name=TOOL,
        arguments={"class_rid": "Order"},
    )
    assert not recorded.execute
    assert recorded.reason == "already_completed"
    assert json_rows(recorded.reuse) == json_rows(receipt)
