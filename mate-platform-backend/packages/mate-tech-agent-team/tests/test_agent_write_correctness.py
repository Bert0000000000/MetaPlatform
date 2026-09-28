"""Agent 正确性（本体审批与写入面）：租约门禁 + 并发审批 + 工具结果三态。

本文件只覆盖**影响本体审批与写入**的四类缺陷，不引入任何新 Agent 能力：

1. ``resume`` 拿不到有效租约却照样推进图（``_claim_lease`` 的返回值被丢掉）；
2. 两位审批者并发时闸门的读-改-写丢决定 / 重复推进；
3. 工具结果把"结果不确定"当成 ``failed``（于是远端可能已成功的调用被重放）；
4. 失租之后仍然可以发起新的写操作。

判据是"**不产生重复本体写入**"，在用例里落成两件可数的事：
拆解（``plan``）只跑一次、员工（``run``）只跑一次。
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest
from mate_tech_agent_team import (
    BrainService,
    InMemoryArtifacts,
    InMemoryCheckpointerProvider,
    InMemoryTeamTasks,
    ProfileRegistry,
    StaticPlanner,
    SubTask,
    SubTaskResult,
    TeamBus,
)
from mate_tech_agent_team.api.run_control import RunControl, RunLeaseHeld
from mate_tech_agent_team.coordination import InMemoryCancelSignals
from mate_tech_agent_team.run_lease import InMemoryRunLeases

TENANT = "tenant-acme"


class _Runtime:
    def __init__(self) -> None:
        self.started: list[str] = []

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        self.started.append(subtask["task_id"])
        return SubTaskResult(
            task_id=subtask["task_id"],
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{tenant_id}|{subtask['profile_id']}|已处理",
            llm_calls=1,
            source="llm",
        )


class _CountingPlanner(StaticPlanner):
    """数 ``plan()`` 被调了几次 —— "闸门只推进了一次"的可读证据。"""

    def __init__(self, counter: list[int]) -> None:
        self._counter = counter

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        self._counter[0] += 1
        return await super().plan(goal=goal, max_parallel=max_parallel, tenant_id=tenant_id)


def _service() -> tuple[BrainService, _Runtime, list[int]]:
    counter = [0]
    runtime = _Runtime()
    service = BrainService(
        planner_for=lambda _ctx: _CountingPlanner(counter),
        runtime_for=lambda _ctx: runtime,
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks()),
        artifacts=InMemoryArtifacts(),
    )
    return service, runtime, counter


class _SerializationProbe:
    """数"同一时刻有几个审批读-改-写在里面"。"""

    def __init__(self) -> None:
        self.active = 0
        self.max_active = 0


def _probe_resume(service: BrainService, probes: _SerializationProbe) -> None:
    """给 ``BrainService.resume`` 套一层探针：**进入前让出一次控制权**。

    让出这一次是刻意的：单事件循环 + 内存检查点器时，读-改-写之间可能根本不发生
    交错，"竞态"于是永远复现不出来（用例就会变成"怎么改都绿"）。让出之后，没有
    串行化的实现**必然**是两边同时在场（``max_active == 2``），于是用例断言的是
    **机制**，不是时序运气。
    """
    real = service.resume

    async def probed(**kwargs: Any) -> Any:
        probes.active += 1
        probes.max_active = max(probes.max_active, probes.active)
        try:
            await asyncio.sleep(0)
            return await real(**kwargs)
        finally:
            probes.active -= 1

    service.resume = probed  # type: ignore[method-assign]


async def _at_gate(control: RunControl, *, run_id: str) -> dict[str, Any]:
    """等到这一轮停在闸门上（受理制：终态/闸门都要主动查）。"""
    deadline = asyncio.get_running_loop().time() + 8.0
    while asyncio.get_running_loop().time() < deadline:
        state = await control.refresh(tenant_id=TENANT, run_id=run_id)
        if str(state.get("status", "")) == "awaiting_approval":
            return state
        await asyncio.sleep(0.01)
    raise AssertionError(f"run {run_id} never reached the gate: {state!r}")


async def _lease_free(leases: InMemoryRunLeases, *, run_id: str, timeout: float = 5.0) -> None:
    """等这一轮的租约被跑完那一轮的后台任务归还。

    闸门状态落检查点与 ``_execute`` 的 ``_close`` 之间有一个极小窗口，测试要**先
    等租约空出来**再去"扮演另一个副本"，否则会撞上自己刚刚那一手。
    """
    deadline = asyncio.get_running_loop().time() + timeout
    while asyncio.get_running_loop().time() < deadline:
        if await leases.get(tenant_id=TENANT, run_id=run_id) is None:
            return
        await asyncio.sleep(0.01)
    raise AssertionError(f"lease for {run_id} was never released")


# ── 1. 没有有效租约就不推进图 ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_resume_without_the_lease_refuses_to_advance(admin_token: str) -> None:
    """另一个副本正持有活跃租约时：本副本**回绝**，且图一步都不许动。

    改之前这里 ``await self._claim_lease(...)`` 的返回值被丢掉 —— 拿不到租约也照样
    走 ``_service.resume``，两个副本就会同时进闸门的读-改-写。
    """
    service, runtime, counter = _service()
    leases = InMemoryRunLeases()
    submitter = RunControl(service, leases=leases)
    other = RunControl(service, leases=leases, approve_wait=0.0)

    accepted = await submitter.submit(tenant_id=TENANT, goal="目标", user_token=admin_token)
    run_id = accepted["run_id"]
    await _at_gate(submitter, run_id=run_id)
    await _lease_free(leases, run_id=run_id)
    runtime_before = list(runtime.started)

    # 模拟"另一个副本正拿着这一轮的活跃租约"（它正在推进/正在写）
    assert await leases.acquire(tenant_id=TENANT, run_id=run_id, owner="another-replica", ttl=60)

    with pytest.raises(RunLeaseHeld):
        await other.resume(tenant_id=TENANT, run_id=run_id, approved=True, user_token=admin_token)

    state = await service.get(tenant_id=TENANT, run_id=run_id)
    assert state["status"] == "awaiting_approval", "拿不到租约却把图推进了"
    assert runtime.started == runtime_before, "拿不到租约却重跑了员工"
    assert counter[0] == 1, "拿不到租约却重跑了拆解"
    # 别人的租约也不许被我们顺手释放掉
    held = await leases.get(tenant_id=TENANT, run_id=run_id)
    assert held is not None and held.owner_instance == "another-replica"


# ── 2. 两位审批者并发：决定不丢、闸门不重复推进 ────────────────────────


@pytest.mark.asyncio
async def test_two_approvers_concurrently_lose_no_vote_and_advance_once(
    monkeypatch: pytest.MonkeyPatch, admin_token: str, issue_token
) -> None:
    """会签 2 人：并发提交两张**不同审批人**的同意票 → 两张都在，且闸门只推进一次。

    改之前这段读-改-写没有串行化：两边各读到**同一份**空决定表，各自写回自己那一票，
    后写的把先写的覆盖掉 —— 会签永远停在 1/2（决定丢失）；而单级闸门下两边会各自
    ``ainvoke`` 一次，后续节点与本体写入跑两遍（重复推进）。

    **怎么把竞态变成确定的东西**：单事件循环下这段读-改-写**可能**自己就串起来了
    （内存检查点器没有真 I/O），所以这里探针测的是**机制本身**——"同一个 run 的
    审批读-改-写不允许被并发进入"。探针在进入 ``service.resume`` 前主动让出一次
    控制权（模拟真 I/O 的交错），于是没有租约门禁时 ``max_active`` 必然是 2。
    机制成立 + 结果是"两票都在、只推进一次"，两者一起才构成证据。

    注意两张票必须来自**不同 actor**：闸门按 actor 去重（同一个人批两次算一次），
    用同一个身份跑这条用例只会得到 1 票，那是闸门语义、不是并发缺陷。
    """
    monkeypatch.setenv("MATE_AGENT_TEAM_GATE_REQUIRED_APPROVALS", "2")
    second_approver = issue_token(subject="u-2")
    service, runtime, counter = _service()
    probes = _SerializationProbe()
    _probe_resume(service, probes)
    leases = InMemoryRunLeases()
    signals = InMemoryCancelSignals()  # 两个副本共享协作面（同进程模拟多副本）
    replica_a = RunControl(service, leases=leases, signals=signals)
    replica_b = RunControl(service, leases=leases, signals=signals)

    accepted = await replica_a.submit(tenant_id=TENANT, goal="目标", user_token=admin_token)
    run_id = accepted["run_id"]
    await _at_gate(replica_a, run_id=run_id)

    await asyncio.gather(
        replica_a.resume(tenant_id=TENANT, run_id=run_id, approved=True, user_token=admin_token),
        replica_b.resume(
            tenant_id=TENANT, run_id=run_id, approved=True, user_token=second_approver
        ),
    )

    assert probes.max_active == 1, "同一个 run 的审批读-改-写被并发进入了"
    state = await service.get(tenant_id=TENANT, run_id=run_id)
    gate = state.get("approval_gate") or {}
    decisions = list(gate.get("decisions") or [])
    assert len(decisions) == 2, f"并发审批丢了决定：{decisions}"
    assert {d.get("actor") for d in decisions} == {"u-1", "u-2"}
    assert all(d.get("decision") == "approved" for d in decisions)
    assert state["status"] == "completed", f"凑齐两张同意票却没续跑：{state['status']}"
    assert counter[0] == 1, "闸门被重复推进（拆解跑了不止一次）"
    assert len(runtime.started) == len(set(runtime.started)), "员工被重复派活"


@pytest.mark.asyncio
async def test_resume_does_not_clobber_a_live_run_in_this_process(admin_token: str) -> None:
    """本进程已有请求在驱动这一轮时：**不覆盖它的 live 记录**，直接回绝。

    `_live` 里那一条属于正在执行（或刚跑到闸门、还在收尾）的请求。覆盖它会换掉它
    的心跳与执行代次语境，退出时还会把**它的**租约释放掉。`submit` 与 `recover`
    早就有这道检查，只有 `resume` 漏了 —— 这条用例把它钉住。
    """
    service, runtime, counter = _service()
    leases = InMemoryRunLeases()
    # 等待预算调小：这条用例要的是"等不到就回绝"，不必真等默认 2s
    control = RunControl(service, leases=leases, approve_wait=0.05)

    accepted = await control.submit(tenant_id=TENANT, goal="目标", user_token=admin_token)
    run_id = accepted["run_id"]
    await _at_gate(control, run_id=run_id)

    holder = control._open(tenant_id=TENANT, run_id=run_id)  # 模拟"本进程还有请求在驱动它"
    try:
        with pytest.raises(RunLeaseHeld):
            await control.resume(
                tenant_id=TENANT, run_id=run_id, approved=True, user_token=admin_token
            )
        assert control._live.get((TENANT, run_id)) is holder, "别人的 live 记录被覆盖了"
        assert await service.get(tenant_id=TENANT, run_id=run_id) is not None
        assert counter[0] == 1, "被回绝的那次审批却推进了图"
    finally:
        await control._close(tenant_id=TENANT, run_id=run_id, live=holder)


@pytest.mark.asyncio
async def test_a_single_approver_still_advances_once(admin_token: str) -> None:
    """正对照：单级闸门下一次审批照旧正常续跑（租约门禁不该挡住正常路径）。"""
    service, runtime, counter = _service()
    leases = InMemoryRunLeases()
    control = RunControl(service, leases=leases)

    accepted = await control.submit(tenant_id=TENANT, goal="目标", user_token=admin_token)
    run_id = accepted["run_id"]
    await _at_gate(control, run_id=run_id)

    done = await control.resume(
        tenant_id=TENANT, run_id=run_id, approved=True, user_token=admin_token
    )
    assert done["status"] == "completed"
    assert counter[0] == 1


# ── 3. 工具结果三态：明确成功 / 明确未执行 / 结果不确定 ────────────────

WRITE_TOOL = "ont_propose_model_type"  # 有副作用的工具（改状态面）
READ_TOOL = "ont_object_query"  # 只读工具


class _FlakyToolbox:
    """第 N 次调用抛指定异常；同时数"真正打出去几次"（= 副作用发生次数）。"""

    def __init__(self, *, exc: BaseException | None = None, name: str = WRITE_TOOL) -> None:
        self.count = 0
        self._exc = exc
        self._name = name

    async def descriptors(self, *, allowed: list[str]) -> list[dict[str, Any]]:
        return [{"name": self._name, "description": "桩", "inputSchema": {"type": "object"}}]

    async def schemas(self, *, allowed: list[str]) -> list[dict[str, Any]]:
        return []

    async def invoke(self, *, name: str, arguments: dict[str, Any], allowed: list[str]) -> Any:
        self.count += 1
        if self._exc is not None:
            raise self._exc
        return {"proposal_id": "p-1"}


def _gated_tool(
    ledger: Any, toolbox: _FlakyToolbox, *, tool_name: str, log: list[dict[str, Any]] | None = None
) -> Any:
    """真运行时里**只管工具闸门 + 幂等账本**的那一段（不需要模型）。"""
    from mate_tech_agent_team.employee import LlmEmployeeRuntime, _EvidenceCollector

    runtime = LlmEmployeeRuntime(
        registry=ProfileRegistry(),
        llm_factory=lambda _ctx: None,
        toolbox_factory=lambda _tenant: toolbox,
        tool_ledger=ledger,
    )
    return runtime._gated_tool(
        {"name": tool_name, "description": "桩", "inputSchema": {"type": "object"}},
        allowed=(tool_name,),
        toolbox=toolbox,
        log=log if log is not None else [],
        evidence=_EvidenceCollector("t1"),
        tenant_id=TENANT,
        run_id="run-write",
        task_id="t1",
    )


def _httpx_exc(name: str) -> BaseException:
    """取一个**真的** httpx 异常（分类判据就是按这类异常名写的）。"""
    import httpx

    return getattr(httpx, name)("boom")


@pytest.mark.asyncio
async def test_a_write_timeout_is_indeterminate_and_its_retry_is_refused() -> None:
    """**主判据（写入面）**：超时不等于失败 —— 远端可能已经成功，不许照原样重放。

    改之前这里记 ``failed``，而 ``failed`` **允许重试**：于是一次"远端写成功、
    本地读超时"的调用会被重放，本体上写第二遍。
    """
    from mate_tech_agent_team.tool_ledger import INDETERMINATE, InMemoryToolLedger

    ledger = InMemoryToolLedger()
    toolbox = _FlakyToolbox(exc=_httpx_exc("ReadTimeout"))
    tool = _gated_tool(ledger, toolbox, tool_name=WRITE_TOOL)

    first = json.loads(await tool.coroutine(x=1))
    assert "UNKNOWN" in first["error"], first
    rows = await ledger.rows(tenant_id=TENANT, run_id="run-write")
    assert [r.status for r in rows] == [INDETERMINATE], "超时被记成了可重试的失败"

    # 同一个意图再来一次：**不执行**（否则就是第二遍本体写入）
    second = json.loads(await tool.coroutine(x=1))
    assert toolbox.count == 1, "结果不确定的调用被重放了"
    assert "UNKNOWN" in second["error"] and second["invocation_id"], second


@pytest.mark.asyncio
async def test_a_connect_error_on_a_write_is_definitely_not_sent_so_retry_is_allowed() -> None:
    """请求**根本没发出去**（建连失败）→ 记 ``failed``，重试是应当的。"""
    from mate_tech_agent_team.tool_ledger import FAILED, InMemoryToolLedger

    ledger = InMemoryToolLedger()
    toolbox = _FlakyToolbox(exc=_httpx_exc("ConnectError"))
    tool = _gated_tool(ledger, toolbox, tool_name=WRITE_TOOL)

    await tool.coroutine(x=1)
    rows = await ledger.rows(tenant_id=TENANT, run_id="run-write")
    assert [r.status for r in rows] == [FAILED]

    # 修好之后重试 → 真的又打了一次（这次成功）
    toolbox._exc = None
    out = json.loads(await tool.coroutine(x=1))
    assert toolbox.count == 2 and out.get("proposal_id") == "p-1"


@pytest.mark.asyncio
async def test_a_read_only_timeout_stays_retryable() -> None:
    """只读工具超时照旧 ``failed``：重试一次读没有副作用，不该被永久锁掉。"""
    from mate_tech_agent_team.tool_ledger import FAILED, InMemoryToolLedger

    ledger = InMemoryToolLedger()
    toolbox = _FlakyToolbox(exc=_httpx_exc("ReadTimeout"), name=READ_TOOL)
    tool = _gated_tool(ledger, toolbox, tool_name=READ_TOOL)

    await tool.coroutine(x=1)
    rows = await ledger.rows(tenant_id=TENANT, run_id="run-write")
    assert [r.status for r in rows] == [FAILED]

    toolbox._exc = None
    await tool.coroutine(x=1)
    assert toolbox.count == 2, "只读调用被误判成不确定，重试被挡掉了"


# ── 4. 失租之后禁止发起新的写操作（含执行代次）────────────────────────


def _permit(*, leases: InMemoryRunLeases, owner: str, live: Any) -> Any:
    from mate_tech_agent_team.api.run_control import RunWritePermit

    return RunWritePermit(leases=leases, instance_id=owner, live_of=lambda _t, _r: live)


class _Live:
    """够用的 ``_LiveRun`` 替身（写许可只读 ``lease_lost`` / ``lease_epoch``）。"""

    def __init__(self, *, epoch: int = 1, lost: bool = False) -> None:
        self.lease_epoch = epoch
        self.lease_lost = lost


@pytest.mark.asyncio
async def test_write_permit_refuses_without_a_valid_lease() -> None:
    """写许可的六种结论 —— 没有一条是"猜着放行"。"""
    from mate_tech_agent_team.run_lease import InMemoryRunLeases

    leases = InMemoryRunLeases()
    mine = _Live(epoch=1)
    permit = _permit(leases=leases, owner="me", live=mine)

    assert await permit.allowed(tenant_id=TENANT, run_id="r") == (False, "no_lease")

    # 我持有：epoch 一致 → 放行
    assert await leases.acquire(tenant_id=TENANT, run_id="r", owner="me", ttl=60)
    assert await permit.allowed(tenant_id=TENANT, run_id="r") == (True, "")

    # 心跳已确认失租（快路径）→ 拒
    mine.lease_lost = True
    assert await permit.allowed(tenant_id=TENANT, run_id="r") == (False, "lease_lost")
    mine.lease_lost = False

    # **执行代次被顶掉**：主人还是我（重入），但代次不是我这手 → 拒
    assert await leases.acquire(tenant_id=TENANT, run_id="r", owner="me", ttl=60)
    mine.lease_epoch = 1
    assert await permit.allowed(tenant_id=TENANT, run_id="r") == (False, "superseded_epoch")

    # 被别人接管 → 拒
    other = InMemoryRunLeases()
    await other.acquire(tenant_id=TENANT, run_id="r", owner="someone-else", ttl=60)
    assert await _permit(leases=other, owner="me", live=mine).allowed(
        tenant_id=TENANT, run_id="r"
    ) == (False, "lease_taken_over")


@pytest.mark.asyncio
async def test_write_permit_denies_when_the_lease_store_is_unreadable() -> None:
    """读不动租约表 → **拒绝写**（fail-closed）：宁可少写一次，不要写第二遍。"""

    class _Broken:
        async def get(self, **_kwargs: Any) -> Any:
            raise RuntimeError("db down")

    from mate_tech_agent_team.api.run_control import RunWritePermit

    permit = RunWritePermit(leases=_Broken(), instance_id="me", live_of=lambda _t, _r: _Live())
    assert await permit.allowed(tenant_id=TENANT, run_id="r") == (False, "lease_unreadable")


@pytest.mark.asyncio
async def test_a_lost_lease_stops_the_write_tool_but_not_the_read_tool() -> None:
    """失租后：**写工具一次都不许发出去**，只读工具照旧（这一轮还能接着读）。"""
    from mate_tech_agent_team.tool_ledger import FAILED, InMemoryToolLedger

    class _Denied:
        async def allowed(self, *, tenant_id: str, run_id: str) -> tuple[bool, str]:
            return False, "lease_taken_over"

    ledger = InMemoryToolLedger()
    write_box = _FlakyToolbox(name=WRITE_TOOL)
    # 接一个**明确拒绝写**的许可（租约已被接管）
    from mate_tech_agent_team.employee import LlmEmployeeRuntime, _EvidenceCollector

    runtime = LlmEmployeeRuntime(
        registry=ProfileRegistry(),
        llm_factory=lambda _ctx: None,
        toolbox_factory=lambda _tenant: write_box,
        tool_ledger=ledger,
        write_permit=_Denied(),
    )
    gated = runtime._gated_tool(
        {"name": WRITE_TOOL, "description": "桩", "inputSchema": {"type": "object"}},
        allowed=(WRITE_TOOL,),
        toolbox=write_box,
        log=[],
        evidence=_EvidenceCollector("t1"),
        tenant_id=TENANT,
        run_id="run-write",
        task_id="t1",
    )
    out = json.loads(await gated.coroutine(x=1))
    assert write_box.count == 0, "失租后写操作还是发出去了"
    assert "write denied" in out["error"] and "lease_taken_over" in out["error"]
    rows = await ledger.rows(tenant_id=TENANT, run_id="run-write")
    assert [r.status for r in rows] == [FAILED], "没发出去的写应记 failed（接管方要补上）"

    # 只读工具不受写许可影响
    read_box = _FlakyToolbox(name=READ_TOOL)
    read_gated = runtime._gated_tool(
        {"name": READ_TOOL, "description": "桩", "inputSchema": {"type": "object"}},
        allowed=(READ_TOOL,),
        toolbox=read_box,
        log=[],
        evidence=_EvidenceCollector("t1"),
        tenant_id=TENANT,
        run_id="run-write",
        task_id="t1",
    )
    await read_gated.coroutine(x=1)
    assert read_box.count == 1, "只读工具被写许可误挡"


# ── 5. 本体写入面：只有 propose 形状，不绕过治理 ────────────────────────


@pytest.mark.asyncio
async def test_ontology_writes_stay_proposal_shaped_and_hitl_tools_are_refused() -> None:
    """Agent 碰得到的本体写入面只有 ``propose``；confirm / reject / execute 被拒。

    这是"复用 Proposal + 审批 + 统一执行器"的**机器判据**：本体落库那一步
    （execute）与人工闸门那两步（confirm / reject）在**两个面**上同时关闭 ——
    MCP 中心按 ``agent_invokable=False`` 拒，agent-team 的闸门在**发现面**
    （不摆到模型面前）与**派发面**（照旧拒）各拦一次。
    """
    from mate_tech_agent_team.tool_ledger import has_side_effects
    from mate_tech_agent_team.toolbox import McpToolbox, ToolNotAllowed

    class _FakeCenter:
        """MCP 中心的最小替身：描述符带 agentInvokable 标志（与注册中心同形）。"""

        async def list_tools(self) -> list[dict[str, Any]]:
            return [
                {"name": "ont_propose_model_type", "agentInvokable": True},
                {"name": "ont_object_query", "agentInvokable": True},
                {"name": "ont_confirm_proposal", "agentInvokable": False},
                {"name": "ont_execute_proposal", "agentInvokable": False},
                {"name": "ont_reject_proposal", "agentInvokable": False},
            ]

        async def call_tool(self, *, name: str, arguments: dict[str, Any]) -> Any:
            return {"called": name}

    toolbox = McpToolbox(_FakeCenter())
    allowed = (
        "ont_propose_model_type",
        "ont_object_query",
        "ont_confirm_proposal",
        "ont_execute_proposal",
        "ont_reject_proposal",
    )
    offered = {d["name"] for d in await toolbox.descriptors(allowed=allowed)}
    assert offered == {"ont_propose_model_type", "ont_object_query"}, (
        f"HITL 工具被摆到模型面前了：{offered}"
    )

    for name in ("ont_confirm_proposal", "ont_execute_proposal", "ont_reject_proposal"):
        with pytest.raises(ToolNotAllowed) as excinfo:
            await toolbox.invoke(name=name, arguments={}, allowed=allowed)
        assert excinfo.value.reason == "center_marks_not_agent_invokable"

    # 写入面只有 propose 形状：它有副作用（因而受幂等/写许可约束），只读没有。
    assert has_side_effects("ont_propose_model_type") is True
    assert has_side_effects("ont_object_query") is False


def test_the_composition_root_wires_and_an_unbound_permit_allows() -> None:
    """组合根能导入（迟绑定壳的装配点就写在它里面），且**没 bind 时一律放行**。

    没 bind = 单进程/测试形态（没有租约可言）：这条断言保证加了写许可之后，
    那些形态的行为与加它之前逐字一致。
    """
    import mate_tech_agent_team.main as main_module  # noqa: F401 —— 导入本身就是断言
    from mate_tech_agent_team.wiring import WritePermitHolder

    holder = WritePermitHolder()
    assert asyncio.run(holder.allowed(tenant_id=TENANT, run_id="r")) == (True, "")
