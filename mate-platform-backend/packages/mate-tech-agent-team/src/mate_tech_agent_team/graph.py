"""超级大脑的任务图（1.0 主链 + 1.3 轨 1 派活加固 + 1.8 轨 3 有界重规划）。

形状：**按依赖分波**执行，每波内部并行；一波全部回来之后可以**再规划**。

    START → plan ──→ dispatch ──(Send 扇出)──→ worker × N ──→ gather ──┬→ dispatch
                     ▲                                                  └→ replan ─┬→ dispatch
                     └──────────────────────────────────────────────────────────────┘
                                                                                   └→ gate ─┬→ summarize → END
                                                                                             └→ reject → END

``depends_on`` 为空 = 第一波；依赖全部有回执的节点进入下一波。于是"无依赖的
并行、有依赖的后跑"是同一个机制的两个结果，而不是两套代码。

**重规划（1.8 轨 3）**：``gather`` 之后如果这一波没有可派的活了，先问拆解器
"还差不差"（``replan``），而不是直接去闸门。拿到新子任务就接着分波派出去。
三条纪律：同一轮 run 内（复用同一份状态与检查点）、**有界**（``max_rounds``）、
**只发生在闸门之前**（人审语义一个字不动）。拆解器没有 ``replan`` 能力时，
这一步是空转——既有链路的行为不变。

**为什么是有界回环而不是嵌套子图**：嵌套子图要解决的是"子任务自己再拆一层"，
而那一层已经由 TeamBus 的 ``maxDepth`` + 子 agent 身份装配负责（ADR-0066
§3.2/§5.8）。在图里再嵌一层等于把深度闸门的语义实现两遍，两遍迟早不一致。

**派活必须过 :class:`TeamBus`**（闸门在派活入口，不散落各调用点）：
``spawn`` 判包络衰减与深度上限，越权返回提案（**未批就没有权限**，因此不执行），
跨租户 / 深度超限直接硬拒。1.0/1.1 里 worker 直接调运行时，闸门是空转的——
这一段就是那次的修复。

**HITL 用 D-6 的暂停恢复法，不用 ``interrupt()``**：
``interrupt()`` 会重跑它所在节点；本项目要在"跑到闸门停住 → 人确认 → 继续"之间
保证**已完成节点的调用次数不变**，所以暂停 = 让闸门条件边走到 END（图自然结束），
恢复 = ``update_state(as_node="gate")`` + ``invoke(None, cfg)`` 从检查点续跑。
闸门节点本身**不做任何副作用**（不调模型、不调工具），只读状态做路由——
这样重跑它也不会产生重复调用。

**取消在节点边界自查**（1.5 任务 1）：执行中的 run 有请求在等它，取消不能靠
"外部杀"。图在 ``plan`` / ``dispatch`` / ``gather`` / ``replan`` / ``gate``
五个边界查一次 :func:`should_cancel`，看到标志就把自己写成终态 ``cancelled``
并走到 END。粒度是**波与波之间**：在途的那一波允许跑完（不硬断），下一波一个
员工都不派。``worker`` 里刻意不查——同一波是并行发出的，逐个自查会让"停在哪"
变成竞态。

``gate`` 那个边界是 1.9 任务 2 补的：取消信号挪进了**共享通道**（跨副本可见），
而 ``gate`` 是"还没停下来的那一步"的最后一道门——不在这里看一眼，"另一副本的
图刚跑完最后一波、正要落 ``awaiting_approval``"就会把别处刚落下的 ``cancelled``
盖掉。它同样不做任何副作用，重跑它不产生重复调用。
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import Awaitable, Callable
from typing import Any

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from .artifact_store import ArtifactStore, artifact_for_task
from .authority import DepthExceeded, Envelope
from .planner import PlanError, Planner
from .profiles import ProfileNotFound
from .retry import RetryPolicy
from .runtime import EmployeeRuntime, TransientRunError
from .state import BrainState, SubTask, SubTaskResult
from .team_bus import SpawnRequest, TeamBus

#: 根 run 派出去的子任务层号（根任务 0，它的子员工 1）。
ROOT_DISPATCH_DEPTH = 1

#: 硬拒（不是"等授权"）：出现在任何一个子任务上，整轮就是失败。
HARD_REJECT_CODES = frozenset({"E_DEPTH_EXCEEDED", "E_PROFILE_NOT_FOUND"})

CANCELLED_STATUS = "cancelled"

#: 这一轮最多规划几次（含首轮）。1 = 一次定型，也就是 1.0 的行为。
MAX_PLAN_ROUNDS_ENV = "MATE_AGENT_TEAM_MAX_PLAN_ROUNDS"
DEFAULT_MAX_PLAN_ROUNDS = 2


def _configured_max_rounds() -> int:
    """部署默认的规划轮数上界。``<=0`` 视为 1（至少要有一轮）。"""
    try:
        return max(1, int(os.getenv(MAX_PLAN_ROUNDS_ENV, str(DEFAULT_MAX_PLAN_ROUNDS))))
    except ValueError:
        return DEFAULT_MAX_PLAN_ROUNDS


def _cancel_update() -> dict[str, Any]:
    """取消时写进状态的更新。每次返回新 dict——状态更新不该被两处共用同一个对象。"""
    return {
        "status": CANCELLED_STATUS,
        "error": "运行已取消：图在节点边界看到取消标志，不再推进",
    }


def _failure(subtask: SubTask, code: str, message: str, *, attempts: int = 0) -> SubTaskResult:
    return SubTaskResult(
        task_id=subtask.get("task_id", ""),
        team_task_id=subtask.get("team_task_id", ""),
        profile_id=subtask.get("profile_id", ""),
        status="error",
        output="",
        source="llm",
        error=message,
        error_code=code,
        proposal={},
        attempts=attempts,
        evidence=[],
        artifacts=[],
    )


async def _persist_artifact(
    store: ArtifactStore,
    *,
    result: SubTaskResult,
    run_id: str,
    tenant_id: str,
    task_id: str,
) -> SubTaskResult:
    """把一次员工产出落成**可寻址 artifact**（1.6 任务 2），并把地址挂回回执。

    两条判据都在这里守着：

    * 只有 ``status == "ok"`` 且产出**非空白**才落——空产出不是交付物，给它
      建一条记录只会让"这轮交付了什么"变成一句空话；
    * **先落库再挂地址**。反过来的话，落库失败会留下一个取不回的地址，那正是
      1.6 要治的"看着交付了、其实取不回来"。

    落库失败**不吞**：产出拿得到却在回执里给不出地址，等于另一种"假回执"。
    宁可让这一轮明确失败，也不要交付一份查无实据的清单。
    """
    output = str(result.get("output") or "")
    if result.get("status") != "ok" or not output.strip():
        return result
    artifact = await store.put(
        artifact_for_task(
            tenant_id=tenant_id,
            run_id=run_id,
            task_id=task_id,
            profile_id=str(result.get("profile_id") or ""),
            content=output,
        )
    )
    result["artifacts"] = [artifact.to_dict()]
    return result


async def _invoke_employee(
    runtime: EmployeeRuntime,
    *,
    subtask: SubTask,
    tenant_id: str,
    policy: RetryPolicy,
) -> SubTaskResult:
    """调运行时，按策略重试**可重试**的失败（1.5 任务 4）。

    重试循环**只包住这一次调用**：派活（副作用）在调用方，已经发生过一次，
    绝不因为重试再发生一次。回执里记 ``attempts`` = 真正发起了几次。

    重试用尽仍失败 → 这一件记 ``E_RUNTIME_UNAVAILABLE`` 的错误回执，整轮不被
    一件抖动拖垮（"这件没干成"与"整轮崩了"是两件事）。
    """
    attempt = 0
    while True:
        attempt += 1
        try:
            result = await runtime.run(subtask=subtask, tenant_id=tenant_id)
        except TransientRunError as exc:
            if attempt >= policy.max_attempts:
                return _failure(
                    subtask,
                    "E_RUNTIME_UNAVAILABLE",
                    f"可重试失败，重试 {attempt} 次仍不成功：{exc}",
                    attempts=attempt,
                )
            await asyncio.sleep(policy.delay_for(attempt))
            continue
        result["attempts"] = attempt
        return result


def _validate_dependencies(subtasks: list[SubTask]) -> str:
    """依赖必须在计划内、且能拓扑排完。返回错误描述，没问题就是空串。

    依赖是**模型给的**，所以这里是边界校验：指向不存在的标签会让节点永远等
    不到，成环则整波都动不了——两种都必须判失败而不是静默挂住。
    """
    known = {st.get("task_id", "") for st in subtasks}
    for subtask in subtasks:
        for dep in subtask.get("depends_on") or ():
            if dep not in known:
                return f"依赖指向计划里不存在的节点：{dep}"
    remaining = {st.get("task_id", ""): set(st.get("depends_on") or ()) for st in subtasks}
    while remaining:
        ready = [node for node, deps in remaining.items() if not (deps & remaining.keys())]
        if not ready:
            return "依赖成环：" + "、".join(sorted(remaining))
        for node in ready:
            del remaining[node]
    return ""


def _validate_replan(existing: list[SubTask], extra: list[SubTask]) -> str:
    """再补的这批合不合法。返回错误描述，没问题就是空串。

    两条检查，都是**静默出错**的那一类，所以必须显式判：

    * **标签撞号** —— ``results`` 是按计划内标签归类的字典，补出来的件顶着
      ``t1`` 进来，后面那件的回执会把前面那件悄悄覆盖掉，而图上一切正常。
    * **依赖指空 / 成环** —— 与首轮同一条边界校验（:func:`_validate_dependencies`）。

    判失败而不是"丢掉这几件继续跑"：模型给了指错的标签是**计划错误**，按 1.0 的
    口径（拆解不合法 = 这一轮失败）处理，不把它伪装成"不需要补活"。
    """
    known = {st.get("task_id", "") for st in existing}
    fresh = [st.get("task_id", "") for st in extra]
    if len(set(fresh)) != len(fresh):
        return "重规划给出的子任务里有重复的计划内标签：" + "、".join(sorted(fresh))
    collided = sorted(set(fresh) & known)
    if collided:
        return "重规划复用了已存在的计划内标签：" + "、".join(collided)
    return _validate_dependencies([*existing, *extra])


def build_brain_graph(
    *,
    planner: Planner,
    runtime: EmployeeRuntime,
    bus: TeamBus,
    checkpointer: BaseCheckpointSaver,
    artifacts: ArtifactStore,
    initiator_envelope: Envelope | None = None,
    actor: str = "",
    max_parallel: int = 3,
    depth: int = ROOT_DISPATCH_DEPTH,
    should_cancel: Callable[[], Awaitable[bool]] | None = None,
    retry_policy: RetryPolicy | None = None,
    max_rounds: int | None = None,
) -> Any:
    """编译大脑图。依赖（拆解器 / 员工运行时 / 派活闸门 / 产出物存储 / 检查点）全部注入。

    ``initiator_envelope`` 是**发起用户**的包络（ADR-0066 §3.3 的链根），刻意
    与令牌一样**不进图状态**：状态会落进 PG，而它是当次调用的授权，用完即散。
    ``actor``（发起用户标识）同样不进状态，只随派活写进审计行（硬规则 #9）。

    ``should_cancel`` 是运行控制面的取消标志读取函数（1.5 任务 1；1.9 任务 2 起
    是 **async** 的——信号在共享通道里，得真去读一次）。**刻意不进图状态**：
    它是"现在这一刻要不要停"的即时信号，不是这一轮的历史；状态里存它反而会
    被 checkpointer 落库、被后续读取当成事实。没给就永不取消。

    ``retry_policy`` 是失败节点的重试策略（1.5 任务 4）。它只作用在**运行时那次
    调用**上——派活（副作用）在循环外面，重试不会把它再做一遍。刻意不用
    langgraph 的节点级 ``RetryPolicy``，理由见 :mod:`mate_tech_agent_team.retry`。

    ``max_rounds`` 是这一轮的规划轮数上界（1.8 轨 3；``None`` = 取部署默认值）。
    它由 ``plan`` 节点连同 ``plan_round`` 一起写进**状态**：续跑与多副本裁决读的
    是这一轮定下的上界，与 ``timeout_seconds`` 同一个理由。
    """
    root_envelope = initiator_envelope if initiator_envelope is not None else Envelope()
    policy = retry_policy if retry_policy is not None else RetryPolicy()
    rounds = max(1, max_rounds if max_rounds is not None else _configured_max_rounds())
    #: 拆解器的**再规划能力**。用 ``getattr`` 探测而不是把 ``replan`` 塞进
    #: ``Planner`` 协议：能拆一句话与会看结果再拆是两种能力，既有实现的 ``plan``
    #: 签名不该因为这次增量被迫改。
    replan_fn = getattr(planner, "replan", None)
    can_replan = callable(replan_fn)

    async def _cancelled() -> bool:
        """图在**节点边界**问的那一句：现在要不要停。

        ``await`` 是必须的，不是风格问题：取消信号在**共享通道**里（1.9 任务 2），
        跨副本取消时它是**另一个进程**写进去的，只有真去读一次才看得见。进程内的
        即时标志仍然走得通——调用方给的就是一个 async 闭包，快路径在它那一侧。
        """
        if should_cancel is None:
            return False
        return await should_cancel()

    def _stopped(state: BrainState) -> bool:
        """已经没必要往下走了（计划失败 / 被取消）。"""
        return str(state.get("status", "")) in {"failed", CANCELLED_STATUS}

    def _done(state: BrainState) -> set[str]:
        return set(state.get("results", {}))

    def _ready(state: BrainState) -> list[SubTask]:
        """这一波够格被派出去的节点：自己没回执，且依赖全都有回执。"""
        done = _done(state)
        return [
            subtask
            for subtask in state.get("subtasks", [])
            if subtask.get("task_id", "") not in done
            and all(dep in done for dep in subtask.get("depends_on") or ())
        ]

    def _fan_out(state: BrainState) -> list[Send]:
        # 停下来了（取消 / 计划失败）就一个 ``Send`` 都不发：没有下一波 = 图到此为止。
        if _stopped(state):
            return []
        tenant_id = state["tenant_id"]
        return [
            Send(
                "worker",
                {
                    "subtask": subtask,
                    "tenant_id": tenant_id,
                    "run_id": state["run_id"],
                },
            )
            for subtask in _ready(state)
        ]

    def _route_after_plan(state: BrainState) -> str:
        # 计划失败（拆不出 / 依赖不成立）时不再派活，图自然结束。
        # 被取消同理：取消是终态，不该再被派活覆盖成 running。
        if _stopped(state):
            return END
        return "dispatch" if _ready(state) else "gate"

    def _route_after_gather(state: BrainState) -> str:
        if _stopped(state):
            return END
        if _ready(state):
            return "dispatch"
        # 这一波没活了：先问拆解器"还差不差"，再去闸门（1.8 轨 3）。
        # 没有重规划能力时那个节点是空转，路由结果与 1.0 完全一致。
        return "replan"

    def _route_after_replan(state: BrainState) -> str:
        if _stopped(state):
            return END
        return "dispatch" if _ready(state) else "gate"

    def _route_after_gate(state: BrainState) -> str:
        if state.get("approved") is True:
            return "summarize"
        if state.get("approved") is False:
            return "reject"
        return END

    async def plan_node(state: BrainState) -> dict[str, Any]:
        if await _cancelled():
            return _cancel_update()
        goal = state["goal"]
        try:
            subtasks = await planner.plan(
                goal=goal, max_parallel=max_parallel, tenant_id=state["tenant_id"]
            )
        except PlanError as exc:
            return {"status": "failed", "error": str(exc), "subtasks": []}
        if len(subtasks) < 2:
            return {
                "status": "failed",
                "error": "无法拆出 ≥2 个可并行子任务",
                "subtasks": subtasks,
            }
        invalid = _validate_dependencies(subtasks)
        if invalid:
            return {"status": "failed", "error": invalid, "subtasks": subtasks}
        update: dict[str, Any] = {"subtasks": subtasks, "status": "running", "results": {}}
        if can_replan:
            # 只有**会**再规划的拆解器才在状态里留下轮次：没有这个能力的链路，
            # 状态形状与 1.0 一个字都不差（免得多出一个永远不动的字段）。
            update["plan_round"] = 1
            update["max_rounds"] = rounds
        return update

    async def dispatch_node(state: BrainState) -> dict[str, Any]:
        # 扇出节点本身不做事：选择权在 ``_fan_out`` 里（它读 state 算这一波）。
        # 但它是**每一波开始前的边界**，取消要在这里被看见——在途的一波跑完
        # 之后，下一波不该再发出去。
        if await _cancelled():
            return _cancel_update()
        return {}

    async def worker_node(payload: dict[str, Any]) -> dict[str, Any]:
        subtask = dict(payload["subtask"])
        run_id = payload["run_id"]
        tenant_id = payload["tenant_id"]
        # 实例身份**按运行唯一**：拆解器每次都给同样的 ``t1``/``t2``/``t3``，
        # 直接拿它当 ``team_task`` 主键，同租户的两次运行就会共用同一行——
        # 上一轮的终态会挡住新一轮（``send`` 误判 409），并发时更糟：两轮
        # **共用同一个信箱**，A 轮的追问会被 B 轮吃掉。
        subtask["team_task_id"] = f"{run_id[:8]}-{subtask['task_id']}"
        try:
            outcome = await bus.spawn(
                SpawnRequest(
                    tenant_id=tenant_id,
                    profile_id=subtask["profile_id"],
                    initiator_envelope=root_envelope,
                    instruction=subtask["instruction"],
                    tool_scope=tuple(subtask.get("tool_scope") or ()),
                    depth=depth,
                    task_id=subtask["team_task_id"],
                    # 审计用：谁派的、属于哪一轮（硬规则 #9）。
                    actor=actor,
                    run_id=run_id,
                )
            )
        except DepthExceeded as exc:
            return {
                "results": {subtask["task_id"]: _failure(subtask, "E_DEPTH_EXCEEDED", str(exc))}
            }
        except ProfileNotFound as exc:
            return {
                "results": {subtask["task_id"]: _failure(subtask, "E_PROFILE_NOT_FOUND", str(exc))}
            }
        if outcome.requires_approval:
            # 越权：转 proposal，**不执行**。授权只作用本次任务，未批就没有权限。
            proposal = dict(outcome.proposal or {})
            return {
                "results": {
                    subtask["task_id"]: SubTaskResult(
                        task_id=subtask["task_id"],
                        team_task_id=subtask["team_task_id"],
                        profile_id=subtask["profile_id"],
                        status="rejected",
                        output="",
                        source="llm",
                        error=(
                            "派活越权，已转人工授权提案（授权范围只限本次任务）："
                            + "、".join(outcome.escalations)
                        ),
                        error_code="E_AUTHORITY_ESCALATION",
                        proposal=proposal,
                    )
                }
            }

        # 闸门放行的工具面**就是**运行时能绑的那一份（不是两处各说各话）。
        subtask["granted_tools"] = sorted(outcome.envelope.tools)
        # 1.4 任务 1：四维一起发下去。只发工具面的话，action_rids / kb_ids /
        # markings 三维在执行侧无人认领——判完就没人再看一眼。
        subtask["granted_envelope"] = outcome.envelope.as_state()
        # 1.5 任务 4：**到这里**才有重试。派活已经在上面发生过一次（建行、落审计、
        # 越权转 proposal 都是副作用），重试只包住员工运行时那一次调用。
        result = await _invoke_employee(
            runtime, subtask=subtask, tenant_id=tenant_id, policy=policy
        )
        # 1.6 任务 2：产出落成可寻址 artifact，地址挂回回执。**在重试之后**做：
        # 重试可能把这一件跑两遍，落在这里就只落一次（且 id 确定性 → 幂等 upsert）。
        result = await _persist_artifact(
            artifacts, result=result, run_id=run_id, tenant_id=tenant_id, task_id=subtask["task_id"]
        )
        # ``results`` 仍按**计划内标签**归类（``t1``…）：那是计划里的位置，
        # 不是实例身份；调用方要投递时读回执里的 ``team_task_id``。
        return {"results": {subtask["task_id"]: result}}

    async def gather_node(state: BrainState) -> dict[str, Any]:
        # 汇合点：等这一波全部回来，再决定有没有下一波。
        # 这也是**一波结束后的边界**：最后的取消机会——单波计划不会再经过
        # ``dispatch``，漏掉这里的自查会让"取消执行中的 run"对单波无效。
        if await _cancelled():
            return _cancel_update()
        return {}

    async def replan_node(state: BrainState) -> dict[str, Any]:
        """这一波全回来了，问拆解器"还差不差"（1.8 轨 3）。

        刻意**不是**新起一轮 run：状态、检查点、run_id 全部沿用，所以补出来的
        子任务看得见前面那几件的回执，人审闸门也仍然只有一道。

        四条退出路径，每一条都对应一种"到此为止"：

        * **被取消** —— 这一步要调模型，是"还要不要继续往外派活"的决定点，
          取消必须在这里被看见（写在 dispatch/gather 的同一份自查里）。
        * **没有这个能力**（``can_replan`` 为假）—— 空转，行为与 1.0 一致。
        * **上界用尽**（``plan_round >= max_rounds``）—— 有界回环的那条界。
          没有它，一个每轮都说"再补一件"的拆解器会让这一轮永远跑不完。
        * **拆解器回空** —— "够了"是合法答案，不是失败。

        拆解器给出**指错的标签**（撞号 / 依赖指空 / 成环）时判这一轮失败：
        那是计划错误，按 1.0 "拆解不合法 = 这一轮失败"的口径处理，不把它
        伪装成"不需要补活"。
        """
        if await _cancelled():
            return _cancel_update()
        if _stopped(state) or not can_replan:
            return {}
        round_index = int(state.get("plan_round") or 1)
        limit = int(state.get("max_rounds") or rounds)
        if round_index >= limit:
            return {}
        try:
            extra = await replan_fn(
                goal=state.get("goal", ""),
                results=dict(state.get("results", {})),
                round_index=round_index,
                max_parallel=max_parallel,
                tenant_id=state["tenant_id"],
            )
        except PlanError as exc:
            return {"status": "failed", "error": str(exc)}
        if not extra:
            return {}
        existing = list(state.get("subtasks", []))
        invalid = _validate_replan(existing, extra)
        if invalid:
            return {"status": "failed", "error": invalid}
        return {"subtasks": [*existing, *list(extra)], "plan_round": round_index + 1}

    async def gate_node(state: BrainState) -> dict[str, Any]:
        # 纯路由节点：只读状态、写"等人确认"这个事实，不产生外部副作用。
        # 取消也要在这里看一眼（1.9 任务 2）：这是"还没停下来"的最后一道门，
        # 漏掉它，别处刚落下的 cancelled 会被这里的 awaiting_approval 盖掉。
        if await _cancelled():
            return _cancel_update()
        pending = state.get("approved") is None
        if pending:
            return {
                "status": "awaiting_approval",
                "hitl_reason": f"{len(state.get('results', {}))} 个员工已产出，等待人工确认后汇总",
            }
        return {}

    async def summarize_node(state: BrainState) -> dict[str, Any]:
        results = state.get("results", {})
        lines = [
            f"- {r.get('profile_id', '?')}（{tid}）：{r.get('output', '').strip()}"
            for tid, r in sorted(results.items())
        ]
        summary = f"目标：{state['goal']}\n" + "\n".join(lines)
        rejected = {
            tid: r for tid, r in results.items() if r.get("error_code") in HARD_REJECT_CODES
        }
        if rejected:
            # 硬拒不是"这件没干成"——没有授权路径可走，整轮就是失败。
            codes = sorted({str(r["error_code"]) for r in rejected.values()})
            return {
                "status": "failed",
                "summary": summary,
                "error": "派活被硬拒（无授权路径）：" + "、".join(codes),
            }
        pending = [
            tid for tid, r in results.items() if r.get("error_code") == "E_AUTHORITY_ESCALATION"
        ]
        if pending:
            # 待授权项**必须出现在汇总里**，否则人会以为三个员工都跑完了。
            summary += "\n\n待授权（未执行，需人工同意后才派活）：" + "、".join(sorted(pending))
        return {"status": "completed", "summary": summary}

    async def reject_node(state: BrainState) -> dict[str, Any]:
        return {"status": "failed", "error": "人工确认未通过，已中止"}

    graph = StateGraph(BrainState)
    graph.add_node("plan", plan_node)
    graph.add_node("dispatch", dispatch_node)
    graph.add_node("worker", worker_node)
    graph.add_node("gather", gather_node)
    graph.add_node("replan", replan_node)
    graph.add_node("gate", gate_node)
    graph.add_node("summarize", summarize_node)
    graph.add_node("reject", reject_node)

    graph.add_edge(START, "plan")
    graph.add_conditional_edges(
        "plan", _route_after_plan, {"dispatch": "dispatch", "gate": "gate", END: END}
    )
    # 被取消 / 计划失败时 ``_fan_out`` 一个 ``Send`` 都不发（终态已经写进状态）。
    graph.add_conditional_edges("dispatch", _fan_out, ["worker"])
    graph.add_edge("worker", "gather")
    graph.add_conditional_edges(
        "gather",
        _route_after_gather,
        {"dispatch": "dispatch", "replan": "replan", END: END},
    )
    graph.add_conditional_edges(
        "replan",
        _route_after_replan,
        {"dispatch": "dispatch", "gate": "gate", END: END},
    )
    graph.add_conditional_edges(
        "gate",
        _route_after_gate,
        {"summarize": "summarize", "reject": "reject", END: END},
    )
    graph.add_edge("summarize", END)
    graph.add_edge("reject", END)
    return graph.compile(checkpointer=checkpointer)


__all__ = [
    "CANCELLED_STATUS",
    "DEFAULT_MAX_PLAN_ROUNDS",
    "HARD_REJECT_CODES",
    "MAX_PLAN_ROUNDS_ENV",
    "ROOT_DISPATCH_DEPTH",
    "build_brain_graph",
]
