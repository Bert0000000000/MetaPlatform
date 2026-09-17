"""1.9 任务 1 · 续跑的真授权（与令牌分离的 per-run 派活授权）。

**现状**（`run_control.py` 边界 5 自述）：受理制把执行放在本进程里，进程一没，
在途的 run 就卡住；续跑靠"扫检查点"（1.8 轨 1）。但**令牌刻意不进状态**，
所以重启之后**没有链根包络**——需要授权的那一步 fail-closed 转成待授权提案。
安全上没错，代价是那一轮**永远跑不完**：它只会停在"等人授权"，而人授权之后
走的是另一条路（``resume``），不是"接着跑"。

**怎么治**：给每一轮 run 发一份**与令牌分离**的派活授权（:mod:`delegation`），
随 run 落进检查点。它满足三条：

* **不是令牌** —— 里面只有"能碰什么"（包络四维的集合），没有任何凭据。原始
  Bearer 仍然一个字节都不落库（硬规则 #12 的同一精神）。
* **按 run 发** —— 授权里带 ``run_id``，只认发出去的那一轮；搬到别的 run 上
  不算数（见下面"不能跨 run 复用"的负例）。
* **只是一条天花板** —— 派活时仍要过闸门的衰减判定（``child ⊆ 授权``），
  所以续跑**做不了**原轮派活做不了的事。

**判据**：
① 起 run → 执行中重启 → 续跑**真跑到底**（那一波员工真的被调起来、回执 ``ok``）；
② 授权**不能跨 run 复用**（负例）；
③ 令牌仍未落库（断言）。
"""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import Iterator
from contextlib import ExitStack
from typing import Any

import pytest
from mate_tech_agent_team import (
    BrainService,
    Envelope,
    InMemoryArtifacts,
    InMemoryCheckpointerProvider,
    InMemoryTeamTasks,
    ProfileRegistry,
    StaticPlanner,
    SubTask,
    SubTaskResult,
    TeamBus,
)
from mate_tech_agent_team.api.run_control import RunControl
from mate_tech_agent_team.brain import RunNotFound
from mate_tech_agent_team.checkpoint import UnfinishedRun
from mate_tech_agent_team.delegation import RunDelegation

TENANT = "tenant-acme"

SETTLED = frozenset({"awaiting_approval", "completed", "failed", "cancelled", "timeout"})


class _SlowRuntime:
    """每次员工调用睡一会儿 —— 给"死在员工波次在途"制造一个稳定的窗口。"""

    def __init__(self, delay: float = 0.3) -> None:
        self.delay = delay
        self.started: list[str] = []

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        self.started.append(subtask["task_id"])
        await asyncio.sleep(self.delay)
        return SubTaskResult(
            task_id=subtask["task_id"],
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{tenant_id}|{subtask['profile_id']}|已处理",
            llm_calls=1,
            source="llm",
        )


def _chain(goal: str) -> list[SubTask]:
    """两件**串成一条链**（t2 依赖 t1）—— 把崩溃点钉在"第一波跑完、第二波在途"。"""
    return [
        SubTask(task_id="t1", profile_id="EMP-ANALYST", instruction=f"分析：{goal}", depends_on=[]),
        SubTask(
            task_id="t2",
            profile_id="EMP-AUDITOR",
            instruction=f"复核：{goal}",
            depends_on=["t1"],
        ),
    ]


class _ChainPlanner(StaticPlanner):
    def __init__(self, counter: list[int]) -> None:
        self._counter = counter

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        del max_parallel, tenant_id
        self._counter[0] += 1
        return _chain(goal)


class _SlowPlanner(_ChainPlanner):
    """拆解慢一点 —— 把"死在拆解这一步"钉成一个**确定**的崩溃点。

    比"死在员工波次在途"稳得多，而且是无令牌用例**只能**选的那种：无令牌那一轮的
    员工根本不会被调起来（越权直接转提案，毫秒级），它不会停在某一波里等着被撞见
    ——靠"跑得快慢去撞一个窗口"的用例在慢一点的机器上会变成"还没崩，它已经跑到
    闸门了"（实测：本批两条用例在 CI 上就是这么红的）。
    """

    def __init__(self, counter: list[int], delay: float) -> None:
        super().__init__(counter)
        self._delay = delay

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        # 先计数再睡：被中断的那一次也算"发起过"，否则看不出续跑时它被重跑了。
        self._counter[0] += 1
        await asyncio.sleep(self._delay)
        del max_parallel, tenant_id
        return _chain(goal)


class _FakeIndex:
    """假索引：直接报"哪些 run 没跑完"，把 PG 扫描挡在用例之外。"""

    def __init__(self, runs: list[tuple[str, str]]) -> None:
        self._runs = runs

    async def unfinished(self, *, statuses: frozenset[str]) -> list[UnfinishedRun]:
        del statuses
        return [UnfinishedRun(tenant_id=tenant, run_id=run_id) for tenant, run_id in self._runs]


_clients: ExitStack = ExitStack()


@pytest.fixture(autouse=True)
def _close_test_clients() -> Iterator[None]:
    yield
    _clients.close()


def _service(*, runtime: Any = None, planner: Any = None, counter: list[int] | None = None):
    counts = counter if counter is not None else [0]
    rt = runtime if runtime is not None else _SlowRuntime()
    plan = planner(counts) if planner is not None else _ChainPlanner(counts)
    service = BrainService(
        planner_for=lambda _ctx: plan,
        runtime_for=lambda _ctx: rt,
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks()),
        artifacts=InMemoryArtifacts(),
    )
    return service, rt, counts


async def _until(predicate, *, timeout: float = 8.0, interval: float = 0.01):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = await predicate()
        if value:
            return value
        await asyncio.sleep(interval)
    return None


async def _has_result(service: BrainService, run_id: str, task_id: str) -> bool:
    try:
        state = await service.get(tenant_id=TENANT, run_id=run_id)
    except RunNotFound:
        return False
    return task_id in (state.get("results") or {})


async def _settle(service: BrainService, run_id: str, *, timeout: float = 8.0) -> dict[str, Any]:
    async def _done():
        try:
            state = await service.get(tenant_id=TENANT, run_id=run_id)
        except RunNotFound:
            return None
        return state if str(state.get("status", "")) in SETTLED else None

    return await _until(_done, timeout=timeout) or await service.get(
        tenant_id=TENANT, run_id=run_id
    )


async def _all_checkpoint_values(service: BrainService, run_id: str) -> list[dict[str, Any]]:
    """这一轮的**每一份**检查点里的状态值（不只是最新那份）。

    "令牌没落库"要在**全部**历史快照上成立才有意义：只查最新那份的话，一个
    "早期落过、后来被覆盖"的令牌会被漏掉。
    """
    cfg = service._config(TENANT, run_id)
    async with service._checkpointer.for_tenant(TENANT) as saver:
        graph = await service._graph_for(saver, service._context(tenant_id=TENANT), 3)
        return [dict(snap.values or {}) async for snap in graph.aget_state_history(cfg)]


# ── ① 续跑真跑到底 ──────────────────────────────────────────────────────


def test_a_resumed_run_really_executes_the_wave_it_was_in_the_middle_of(admin_token) -> None:
    """**主判据**：起 run → 执行中重启 → 续跑**真的**把那一波跑完。

    与 1.8 的同名场景的区别只有一处，也正是本批要治的那处：1.8 里续跑那一波
    因为没有链根包络而 fail-closed 转成待授权提案（那一轮永远跑不完）；现在
    续跑读的是**这一轮自己**的派活授权，于是它真的被派出去、真的跑出了产出。

    三件事一起验：① 那一波回执是 ``ok`` 且有产出（不是提案）；② 已完成的不重跑
    （1.8 语义不破）；③ 续跑用的是**本轮的**授权（同一份，不是新涨的）。
    """

    async def _scenario() -> None:
        runtime = _SlowRuntime()
        service, _runtime, counts = _service(runtime=runtime)
        before = RunControl(service)
        run_id = (
            await before.submit(tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token)
        )["run_id"]

        # 等第一波（t1）跑完 —— 此刻第二波（t2）在途。
        assert await _until(lambda: _has_result(service, run_id, "t1")), "第一波没落检查点"
        issued = (await service.get(tenant_id=TENANT, run_id=run_id))["delegation"]

        # 进程没了：在途的后台任务被拆掉，检查点留在原地。
        await before.shutdown()
        stuck = await service.get(tenant_id=TENANT, run_id=run_id)
        assert stuck["status"] == "running", "该死在这一轮的执行中，而不是别的状态"
        t1_output = stuck["results"]["t1"]["output"]

        # 新进程启动：扫出没跑完的 run，从它自己的检查点接着跑。
        after = RunControl(service, run_index=_FakeIndex([(TENANT, run_id)]))
        assert await after.recover() == [run_id], "启动扫描没有认领这一轮"
        body = await _settle(service, run_id)

        assert body["status"] == "awaiting_approval", body
        # ① 续跑那一波**真的跑了** —— 不是 fail-closed 的提案，也不是伪造的"跑完了"。
        t2 = body["results"]["t2"]
        assert t2["status"] == "ok", f"续跑那一波没被真派出去：{t2}"
        assert not t2.get("error_code"), t2
        assert t2["output"].strip(), f"回了 ok 却没有产出（另一种假回执）：{t2}"
        assert "t2" in runtime.started, f"员工根本没被调起来：{runtime.started}"
        # ② 已完成的不重跑：拆解一次，t1 只跑一次、产出原样（1.8 语义不破）。
        assert counts[0] == 1, f"plan() 跑了 {counts[0]} 次 —— 已完成的节点被重跑了"
        assert body["results"]["t1"]["output"] == t1_output, "已完成的那件被重跑了"
        assert runtime.started.count("t1") == 1, f"t1 被跑了多次：{runtime.started}"
        # ③ 续跑读的是**同一份**授权，不是续跑时现发的另一份。
        assert body["delegation"] == issued, "续跑的授权与开跑时那一份对不上"

    asyncio.run(_scenario())


def test_a_run_started_without_a_token_still_fails_closed_after_a_restart() -> None:
    """**反例**：没有令牌起的那一轮，重启后仍然 fail-closed。

    授权不是"重启就自动发一份"——它是**开跑那一刻**从发起用户的令牌解析出来、
    随这轮落库的。开跑时就没有（无令牌 = 空包络），续跑也不会凭空长出来。
    """

    async def _scenario() -> None:
        counts = [0]
        service, _runtime, _counts = _service(
            planner=lambda c: _SlowPlanner(c, 1.0), counter=counts
        )
        before = RunControl(service)
        run_id = (
            await before.submit(tenant_id=TENANT, goal="分析本月异常订单")  # 刻意不带令牌
        )["run_id"]
        await before.shutdown()
        stuck = await service.get(tenant_id=TENANT, run_id=run_id)
        assert stuck["status"] == "running", "该死在这一轮的执行中，而不是别的状态"

        after = RunControl(service, run_index=_FakeIndex([(TENANT, run_id)]))
        assert await after.recover() == [run_id]
        body = await _settle(service, run_id)

        assert body["status"] == "awaiting_approval", body
        t2 = body["results"]["t2"]
        assert t2["status"] == "rejected", t2
        assert t2["error_code"] == "E_AUTHORITY_ESCALATION", t2
        # 拆解**没跑完**（死在中途），所以续跑把它重跑了一次——这正是"已完成的
        # 不重跑"的另一面：它当时根本没完成。
        assert counts[0] == 2, f"没跑完的拆解应当被重跑一次，实际 {counts[0]} 次"

    asyncio.run(_scenario())


# ── ② 授权不能跨 run 复用 ───────────────────────────────────────────────


def test_a_delegation_issued_for_one_run_never_authorizes_another(admin_token) -> None:
    """把 A 轮的授权原样搬到 B 轮上：**不认**。

    授权里带 ``run_id``，续跑时比的是"这份授权是不是发给**这一轮**的"。少这一条，
    它就成了一把万能钥匙——任何能读到 A 轮检查点的地方都能拿它去授权 B 轮。
    """

    async def _scenario() -> None:
        service, _runtime, _counts = _service()
        envelope = service._context(tenant_id=TENANT, user_token=admin_token).initiator_envelope
        assert envelope.tools, "前提：管理员令牌应当解析出非空的能力基线"

        issued = RunDelegation.issue(run_id="run-a", envelope=envelope, granted_by="u-1").as_state()
        assert RunDelegation.of_state(issued).authorizes("run-a") is True
        assert RunDelegation.of_state(issued).authorizes("run-b") is False

        # 端到端形态：把 A 轮那份授权放进 B 轮的状态里，B 轮的链根仍然是空的。
        stolen = await service._context_from_delegation(
            tenant_id=TENANT, state={"delegation": issued}, run_id="run-b"
        )
        assert stolen.initiator_envelope == Envelope(), "别的 run 的授权被当成本轮的链根了"
        assert stolen.actor == "", "授权不能连发起人身份一起搬过去"

    asyncio.run(_scenario())


def test_a_tokenless_run_does_not_inherit_a_neighbouring_runs_authority(admin_token) -> None:
    """同一次启动扫描里的两轮：有令牌的那轮真跑，没令牌的那轮照旧转提案。

    这是"不能跨 run 复用"的端到端形态——两轮**同时**被扫描认领、同一个进程、
    同一个闸门实例：第二轮没有因为第一轮拿到了授权就跟着一起拿到。

    崩溃点是**构造**出来的（两轮都停在慢拆解器里），不是靠跑得快慢去撞一个窗口：
    无令牌那一轮的员工根本不会被调起来（越权直接转提案），它不会停在某一波里等
    你撞见。
    """

    async def _scenario() -> None:
        counts = [0]
        service, _runtime, _counts = _service(
            planner=lambda c: _SlowPlanner(c, 1.0), counter=counts
        )
        before = RunControl(service)
        authorized = (
            await before.submit(tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token)
        )["run_id"]
        anonymous = (
            await before.submit(tenant_id=TENANT, goal="盘点本月库存")  # 不带令牌
        )["run_id"]

        await before.shutdown()
        for run_id in (authorized, anonymous):
            state = await service.get(tenant_id=TENANT, run_id=run_id)
            assert state["status"] == "running", state

        after = RunControl(
            service, run_index=_FakeIndex([(TENANT, authorized), (TENANT, anonymous)])
        )
        assert sorted(await after.recover()) == sorted([authorized, anonymous])

        a_body = await _settle(service, authorized)
        b_body = await _settle(service, anonymous)
        assert a_body["results"]["t2"]["status"] == "ok", a_body["results"]["t2"]
        assert b_body["results"]["t2"]["status"] == "rejected", b_body["results"]["t2"]
        assert b_body["results"]["t2"]["error_code"] == "E_AUTHORITY_ESCALATION"

    asyncio.run(_scenario())


def test_an_expired_delegation_is_not_authorization(admin_token) -> None:
    """授权可以有**寿命**：过期之后与"没有授权"同义（fail-closed）。

    默认不过期（``ttl=0``）——重启续跑的窗口多长是运维的事，不该由代码悄悄定。
    但"能过期"必须是**真的**，否则它就是一句写在文档里的空话。
    """

    async def _scenario() -> None:
        service, _runtime, _counts = _service()
        envelope = service._context(tenant_id=TENANT, user_token=admin_token).initiator_envelope
        issued = RunDelegation.issue(
            run_id="run-a", envelope=envelope, granted_by="u-1", ttl=60.0, now=1_000.0
        )
        blob = issued.as_state()
        assert RunDelegation.of_state(blob).authorizes("run-a", now=1_030.0) is True
        assert RunDelegation.of_state(blob).authorizes("run-a", now=1_060.0) is False

        expired = await service._context_from_delegation(
            tenant_id=TENANT, state={"delegation": blob}, run_id="run-a", now=2_000.0
        )
        assert expired.initiator_envelope == Envelope(), "过期授权仍被当成了链根"

    asyncio.run(_scenario())


def test_a_run_with_no_delegation_at_all_is_not_authorized() -> None:
    """老检查点 / 手工造的 run 没有这一项时，读出来是"没有授权"，不是崩。"""

    async def _scenario() -> None:
        service, _runtime, _counts = _service()
        for state in ({}, {"delegation": None}, {"delegation": {}}, {"delegation": "garbage"}):
            ctx = await service._context_from_delegation(
                tenant_id=TENANT, state=state, run_id="run-a"
            )
            assert ctx.initiator_envelope == Envelope(), state

    asyncio.run(_scenario())


# ── ③ 令牌仍未落库 ──────────────────────────────────────────────────────


def test_the_raw_token_is_never_written_into_any_checkpoint(admin_token) -> None:
    """续跑要授权，但**落地的是授权，不是令牌**。

    硬规则 #12 的同一精神：令牌是凭据，凭据不该躺在检查点里被人翻出来。这一条
    就是"与令牌分离"的字面兑现——全量历史快照里一个字节的 Bearer 都不许有。
    """

    async def _scenario() -> None:
        service, _runtime, _counts = _service()
        control = RunControl(service)
        run_id = (
            await control.submit(tenant_id=TENANT, goal="分析本月异常订单", user_token=admin_token)
        )["run_id"]
        body = await _settle(service, run_id)

        snapshots = await _all_checkpoint_values(service, run_id)
        assert snapshots, "这一轮一份检查点都没有，用例前提不成立"
        dumped = json.dumps(snapshots, ensure_ascii=False, default=str)
        assert admin_token not in dumped, "原始令牌被落进了检查点"
        assert "Bearer" not in dumped, "检查点里出现了 Bearer 字样"

        # 落地的那一份只装"能碰什么"与归属，一个凭据字段都没有（ADR-0067 N1）。
        # 用**精确集合**断言而不是"搜不到 token 字样"：以后加了字段要在这里被看见，
        # 而不是靠事后 grep 猜。
        delegation = RunDelegation.of_state(body.get("delegation"))
        assert delegation is not None, "管理员令牌起的那一轮应当有派活授权"
        assert delegation.envelope.tools, "授权里应当有从令牌解析出的能力基线"
        assert set(delegation.as_state()) == {
            "run_id",
            "granted_by",
            "envelope",
            "expires_at",
            "tenant_id",
            "subject_id",
            "policy_version",
            "issued_at",
            "revocation_version",
        }
        assert not [
            key
            for key in delegation.as_state()
            if "token" in key.lower() or "bearer" in key.lower()
        ]

    asyncio.run(_scenario())
