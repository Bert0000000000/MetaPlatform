"""1.8 轨 3 · 主图在**同一轮 run 内**重规划。

**为什么要有这个**：1.0 的图是"一次定型"——``plan`` 拆出来的子任务跑完就直奔闸门。
可真实的拆解经常是"跑完第一轮才知道还差什么"：核对员指出口径不一致，那就得再派
一个人去把口径对齐。一次定型的图只能靠人重新起一轮，而新的一轮拿不到上一轮的
上下文。

**改法**：在 ``gather`` 与 ``gate`` 之间插一个 ``replan`` 节点。它拿**已经产出的
回执**去问拆解器"还差什么"，拿到新子任务就再扇出一波，拿不到就直接去闸门。
三条纪律：

* **同一轮 run 内**：复用同一份状态与检查点，run_id 不变——重规划不是新起一轮。
* **有界**：``max_rounds`` 是硬上界（默认 2，env 可调）。没有上界的话，一个
  每轮都要求"再补一件"的拆解器会让这一轮永远跑不完。
* **不碰 HITL**：闸门照旧是唯一的人审点，重规划只发生在**闸门之前**；
  ``interrupt()`` 依然不用（暂停仍是"条件边走到 END"，见 :mod:`.graph`）。

**复杂图只做最小形态（写明理由）**：这里做的是**有界回环**（replan ⇄ dispatch）。
**不做嵌套子图**——不是因为难，是因为没有真需求：嵌套子图要解决的是"子任务自己
再拆一层"，而那一层已经由 TeamBus 的 ``maxDepth`` + 子 agent 身份装配负责了
（ADR-0066 §3.2/§5.8）。在图里再嵌一层，等于把深度闸门的语义实现两遍，两遍
迟早会不一致。
"""

from __future__ import annotations

from typing import Any

import pytest
from mate_tech_agent_team import (
    BrainService,
    InMemoryArtifacts,
    InMemoryCheckpointerProvider,
    InMemoryTeamTasks,
    LlmPlanner,
    ProfileRegistry,
    StaticPlanner,
    SubTask,
    SubTaskResult,
    TeamBus,
    builtin_profiles,
)
from mate_tech_agent_team.state import BrainState

TENANT = "tenant-acme"

SETTLED = frozenset({"awaiting_approval", "completed", "failed", "cancelled", "timeout"})


class _Runtime:
    """按 instruction 回显结果 —— 让"重规划派出去的那一件真的跑了"可读。"""

    def __init__(self) -> None:
        self.seen: list[str] = []

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        self.seen.append(subtask["instruction"])
        return SubTaskResult(
            task_id=subtask["task_id"],
            team_task_id=subtask.get("team_task_id", ""),
            profile_id=subtask["profile_id"],
            status="ok",
            output=f"{tenant_id}|{subtask['profile_id']}|{subtask['instruction']}",
            llm_calls=1,
            source="llm",
        )


class _ReplanningPlanner(StaticPlanner):
    """首轮拆 3 件；第二轮再补 1 件，且它**依赖首轮的 t1**。

    依赖是刻意的：它证明补出来的那件必须等首轮有回执才能跑——"按中间结果再规划"
    而不是"再随便派一件"。
    """

    def __init__(self, extra: list[SubTask] | None = None) -> None:
        self.replan_calls: list[dict[str, Any]] = []
        self._extra = (
            extra
            if extra is not None
            else [
                SubTask(
                    task_id="t4",
                    profile_id="EMP-AUDITOR",
                    instruction="对齐首轮结论的口径差异",
                    depends_on=["t1"],
                )
            ]
        )

    async def replan(
        self,
        *,
        goal: str,
        results: dict[str, SubTaskResult],
        round_index: int,
        max_parallel: int,
        tenant_id: str,
    ) -> list[SubTask]:
        self.replan_calls.append(
            {
                "goal": goal,
                "results": dict(results),
                "round_index": round_index,
                "max_parallel": max_parallel,
                "tenant_id": tenant_id,
            }
        )
        return [dict(s) for s in self._extra]  # type: ignore[misc]


class _AlwaysReplanningPlanner(_ReplanningPlanner):
    """每一轮都要"再补一件" —— 用来证明确实有上界（否则这轮永远跑不完）。"""

    def __init__(self) -> None:
        super().__init__(extra=[])
        self._n = 0

    async def replan(self, **kwargs: Any) -> list[SubTask]:
        self.replan_calls.append({"round_index": kwargs.get("round_index")})
        self._n += 1
        return [
            SubTask(
                task_id=f"x{self._n}",
                profile_id="EMP-AUDITOR",
                instruction=f"第 {self._n} 件补充工作",
                depends_on=[],
            )
        ]


class _BarePlanner:
    """没有 ``replan`` 能力的拆解器 —— 既有链路就是这一类。"""

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        del tenant_id
        return [
            SubTask(task_id="t1", profile_id="EMP-ANALYST", instruction="分析 A", depends_on=[]),
            SubTask(task_id="t2", profile_id="EMP-AUDITOR", instruction="核对 B", depends_on=[]),
        ]


class _BadReplanPlanner(_ReplanningPlanner):
    """补出来的那件复用了已存在的 task_id —— 计划内标签必须唯一。"""

    def __init__(self) -> None:
        super().__init__(
            extra=[
                SubTask(
                    task_id="t1",
                    profile_id="EMP-AUDITOR",
                    instruction="顶着别人的编号干活",
                    depends_on=[],
                )
            ]
        )


def _service(planner: Any, *, runtime: Any = None) -> BrainService:
    rt = runtime if runtime is not None else _Runtime()
    return BrainService(
        planner_for=lambda _ctx: planner,
        runtime_for=lambda _ctx: rt,
        checkpointer=InMemoryCheckpointerProvider(),
        team_bus=TeamBus(registry=ProfileRegistry(), tasks=InMemoryTeamTasks()),
        artifacts=InMemoryArtifacts(),
    )


async def _run(
    service: BrainService, token: str, *, goal: str = "对齐本月异常订单的口径"
) -> BrainState:
    """跑一轮。``token`` 是必需的——没有令牌就没有链根包络（fail-closed），派活
    会一律转成待授权提案，员工一个都不会跑，用例就成了自说自话。"""
    return await service.start(tenant_id=TENANT, goal=goal, user_token=token)


# ── 主判据 ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_run_replans_again_within_the_same_run(monkeypatch, admin_token) -> None:
    """首轮不够 → **同一轮 run 内**再规划一波 → 停在闸门。"""
    monkeypatch.setenv("MATE_AGENT_TEAM_MAX_PLAN_ROUNDS", "2")
    planner = _ReplanningPlanner()
    runtime = _Runtime()
    service = _service(planner, runtime=runtime)

    state = await _run(service, admin_token)

    assert state["status"] == "awaiting_approval", state
    assert state["plan_round"] == 2, "第二轮规划没有发生"
    # 首轮 3 件 + 补的 1 件
    assert sorted(state["results"]) == ["t1", "t2", "t3", "t4"], state["results"]
    assert len(state["subtasks"]) == 4
    # 补出来的那件**真的跑了**，而且带着它自己的产出落进了回执。
    assert all(r["status"] == "ok" for r in state["results"].values()), state["results"]
    assert "对齐首轮结论的口径差异" in runtime.seen
    assert "对齐首轮结论的口径差异" in state["results"]["t4"]["output"]

    # 重规划是**按中间结果**做的：它看得见首轮的回执。
    assert len(planner.replan_calls) == 1
    call = planner.replan_calls[0]
    assert call["round_index"] == 1
    assert sorted(call["results"]) == ["t1", "t2", "t3"]
    assert call["tenant_id"] == TENANT


@pytest.mark.asyncio
async def test_replanning_happens_between_waves_not_inside_a_wave(monkeypatch, admin_token) -> None:
    """补出来的那件依赖 t1 → 它只能在首轮**全部**回来之后才被派出去。

    判据用**派活顺序**：首轮三件先跑完，补的那件排在它们后面。组内并行、组间
    等待——这正是"波"的定义。
    """
    monkeypatch.setenv("MATE_AGENT_TEAM_MAX_PLAN_ROUNDS", "2")
    runtime = _Runtime()
    service = _service(_ReplanningPlanner(), runtime=runtime)

    state = await _run(service, admin_token)

    t4 = state["results"]["t4"]
    assert t4["status"] == "ok", t4
    assert state["plan_round"] == 2
    extra_at = runtime.seen.index("对齐首轮结论的口径差异")
    first_wave = [
        i for i, s in enumerate(runtime.seen) if "分析" in s or "复核" in s or "补充" in s
    ]
    assert first_wave and max(first_wave) < extra_at, (
        f"补出来的件与首轮混在同一波里跑了：{runtime.seen}"
    )


@pytest.mark.asyncio
async def test_replanning_is_bounded_by_max_rounds(monkeypatch, admin_token) -> None:
    """上界是硬约束：一个永不满足的拆解器不能把这一轮拖成死循环。"""
    monkeypatch.setenv("MATE_AGENT_TEAM_MAX_PLAN_ROUNDS", "3")
    planner = _AlwaysReplanningPlanner()
    service = _service(planner)

    state = await _run(service, admin_token)

    assert state["status"] == "awaiting_approval", state
    assert state["plan_round"] == 3, f"停在第 {state['plan_round']} 轮，上界没生效"
    assert len(planner.replan_calls) == 2, "轮数 3 = 首轮 + 2 次重规划"
    assert state["max_rounds"] == 3
    # 上界用完就不再补了：最后一轮补出来的件没有第二轮去消费。
    assert sorted(state["results"]) == ["t1", "t2", "t3", "x1", "x2"]


@pytest.mark.asyncio
async def test_max_rounds_of_one_disables_replanning(monkeypatch, admin_token) -> None:
    """把上界设成 1 = 回到 1.0 的"一次定型"。"""
    monkeypatch.setenv("MATE_AGENT_TEAM_MAX_PLAN_ROUNDS", "1")
    planner = _ReplanningPlanner()
    service = _service(planner)

    state = await _run(service, admin_token)

    assert state["plan_round"] == 1
    assert planner.replan_calls == []
    assert sorted(state["results"]) == ["t1", "t2", "t3"]


@pytest.mark.asyncio
async def test_a_planner_without_replan_keeps_the_existing_shape(admin_token) -> None:
    """既有链路（拆解器没有 ``replan``）行为**一个字都不变**。"""
    planner = _BarePlanner()
    service = _service(planner)

    state = await _run(service, admin_token)

    assert state["status"] == "awaiting_approval", state
    assert sorted(state["results"]) == ["t1", "t2"]
    # 没有重规划能力时不该在状态里留下"轮次"的痕迹——它压根没发生。
    assert state.get("plan_round") in (None, 1)


@pytest.mark.asyncio
async def test_replanning_keeps_the_hitl_gate_and_can_be_approved(monkeypatch, admin_token) -> None:
    """重规划**不破**既有 HITL 语义：照旧停在闸门，确认后汇总完成。"""
    monkeypatch.setenv("MATE_AGENT_TEAM_MAX_PLAN_ROUNDS", "2")
    service = _service(_ReplanningPlanner())

    state = await _run(service, admin_token)
    assert state["status"] == "awaiting_approval"
    assert state["hitl_reason"], "闸门没给出人审理由"

    done = await service.resume(
        tenant_id=TENANT, run_id=state["run_id"], approved=True, user_token=admin_token
    )
    assert done["status"] == "completed", done
    assert "t4" in done["summary"] or "对齐首轮结论的口径差异" in done["summary"]


@pytest.mark.asyncio
async def test_replanning_does_not_rerun_the_first_round(monkeypatch, admin_token) -> None:
    """补一波而已：首轮那三件**不重跑**（重规划不是"从头再来一遍"）。"""
    monkeypatch.setenv("MATE_AGENT_TEAM_MAX_PLAN_ROUNDS", "2")
    runtime = _Runtime()
    service = _service(_ReplanningPlanner(), runtime=runtime)

    await _run(service, admin_token)

    analyzed = [s for s in runtime.seen if "分析" in s]
    assert len(analyzed) == 1, f"首轮那件被跑了 {len(analyzed)} 遍：{runtime.seen}"


@pytest.mark.asyncio
async def test_a_colliding_task_id_fails_loudly_instead_of_silently_overwriting(
    monkeypatch,
    admin_token,
) -> None:
    """补出来的件顶着已存在的编号 → 这一轮判失败，而不是把首轮的回执悄悄覆盖掉。"""
    monkeypatch.setenv("MATE_AGENT_TEAM_MAX_PLAN_ROUNDS", "3")
    service = _service(_BadReplanPlanner())

    state = await _run(service, admin_token)

    assert state["status"] == "failed", state
    assert "t1" in str(state.get("error", ""))


# ── 拆解器侧：真的按结果再规划 ──────────────────────────────────────────


class _StubLlm:
    def __init__(self, content: str) -> None:
        self.content = content
        self.calls: list[dict[str, Any]] = []

    async def chat_with_tools(self, *, messages, model, tools=None, temperature=0.7):
        self.calls.append({"messages": messages})
        return {"content": self.content, "tool_calls": []}


@pytest.mark.asyncio
async def test_llm_replanner_asks_for_more_work_using_the_intermediate_results() -> None:
    """重规划的 prompt 里必须带着**已经产出的回执**，否则"按结果再规划"是空话。"""
    import json

    llm = _StubLlm(
        json.dumps(
            {
                "subtasks": [
                    {"profile_id": "EMP-AUDITOR", "instruction": "把 t1 与 t2 的口径对齐"},
                ]
            }
        )
    )
    planner = LlmPlanner(llm_factory=lambda _t: llm, roster=builtin_profiles())
    results = {
        "t1": SubTaskResult(task_id="t1", status="ok", output="异常订单 12 笔，集中在华东"),
        "t2": SubTaskResult(task_id="t2", status="ok", output="口径存疑：是否含退款单"),
    }

    extra = await planner.replan(
        goal="对齐本月异常订单的口径",
        results=results,
        round_index=1,
        max_parallel=3,
        tenant_id=TENANT,
    )

    assert [s["profile_id"] for s in extra] == ["EMP-AUDITOR"]
    # 补出来的件必须拿到**新**编号，不能撞上已存在的 t1/t2。
    assert [s["task_id"] for s in extra] == ["t3"]
    prompt = str(llm.calls[0]["messages"])
    assert "集中在华东" in prompt, "重规划没有带上首轮产出"
    assert "是否含退款单" in prompt


@pytest.mark.asyncio
async def test_llm_replanner_stops_when_the_model_returns_no_more_work() -> None:
    """模型说"够了"就是够了：空数组 = 不再补活，而不是判失败。"""
    import json

    llm = _StubLlm(json.dumps({"subtasks": []}))
    planner = LlmPlanner(llm_factory=lambda _t: llm, roster=builtin_profiles())

    extra = await planner.replan(
        goal="对齐本月异常订单的口径",
        results={"t1": SubTaskResult(task_id="t1", status="ok", output="done")},
        round_index=1,
        max_parallel=3,
        tenant_id=TENANT,
    )

    assert extra == []


@pytest.mark.asyncio
async def test_llm_replanner_can_add_a_dependency_on_an_existing_task() -> None:
    """补出来的件可以依赖首轮的件（这正是"按结果再规划"的用处）。"""
    import json

    llm = _StubLlm(
        json.dumps(
            {
                "subtasks": [
                    {"profile_id": "EMP-RESEARCHER", "instruction": "补背景", "depends_on": ["t1"]},
                ]
            }
        )
    )
    planner = LlmPlanner(llm_factory=lambda _t: llm, roster=builtin_profiles())

    extra = await planner.replan(
        goal="对齐本月异常订单的口径",
        results={"t1": SubTaskResult(task_id="t1", status="ok", output="done")},
        round_index=1,
        max_parallel=3,
        tenant_id=TENANT,
    )

    assert extra[0]["depends_on"] == ["t1"]


@pytest.mark.asyncio
async def test_llm_replanner_rejects_a_dependency_on_an_unknown_task() -> None:
    """依赖指向不存在的标签 → 图上判失败（与首轮拆解同一条边界校验）。"""
    import json

    from mate_tech_agent_team import PlanError

    llm = _StubLlm(
        json.dumps(
            {
                "subtasks": [
                    {
                        "profile_id": "EMP-RESEARCHER",
                        "instruction": "补背景",
                        "depends_on": ["t99"],
                    },
                ]
            }
        )
    )
    planner = LlmPlanner(llm_factory=lambda _t: llm, roster=builtin_profiles())

    with pytest.raises(PlanError, match="t99"):
        await planner.replan(
            goal="对齐本月异常订单的口径",
            results={"t1": SubTaskResult(task_id="t1", status="ok", output="done")},
            round_index=1,
            max_parallel=3,
            tenant_id=TENANT,
        )


@pytest.mark.asyncio
async def test_static_planner_replans_by_doing_nothing() -> None:
    """确定性拆解器没有"再规划"的能力，如实回空——不许编出活来。"""
    planner = StaticPlanner()
    extra = await planner.replan(
        goal="g",
        results={},
        round_index=1,
        max_parallel=3,
        tenant_id=TENANT,
    )
    assert extra == []


def test_the_state_schema_declares_the_round_fields() -> None:
    """状态键必须显式声明 —— 裸 dict 的写入会被 langgraph 静默丢掉（D-5）。"""
    assert "plan_round" in BrainState.__annotations__
    assert "max_rounds" in BrainState.__annotations__


@pytest.mark.asyncio
async def test_a_run_that_cannot_be_split_still_fails_the_same_way(admin_token) -> None:
    """首轮就拆不出来的，重规划救不了它 —— 行为与 1.0 一致。"""

    class _TinyPlanner(StaticPlanner):
        async def plan(self, *, goal, max_parallel, tenant_id):
            return [SubTask(task_id="t1", profile_id="EMP-ANALYST", instruction="唯一一件")]

    service = _service(_TinyPlanner())
    state = await _run(service, admin_token)
    assert state["status"] == "failed"
    assert "≥2" in state["error"]
