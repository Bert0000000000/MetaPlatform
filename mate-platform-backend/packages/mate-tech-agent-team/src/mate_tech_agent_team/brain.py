"""超级大脑服务层：起一次运行 / 查一次运行 / 人工确认续跑。

这一层负责把**租户**落到两处：``thread_id`` 前缀（命名隔离）与连接的
``app.tenant_id`` GUC（数据库强制隔离）。两者缺一：只有命名隔离时，任何能猜到
thread_id 的调用方都能读到别人的状态；只有 GUC 而 thread_id 不带前缀时，
策略匹配不到任何行（fail-closed），业务直接跑不通。

**发起用户的 token 也在这里传递**，走 :class:`RunContext` —— 且**刻意不进图状态**：
状态会被 checkpointer 落进 PG，令牌不该落库（硬规则 #12 的同一精神）。
它只在本次调用构建图时被闭包捕获，用完即散。
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Protocol
from uuid import uuid4

from langgraph.checkpoint.base import BaseCheckpointSaver

from .artifact_store import ArtifactStore
from .audit import AUDIT_APPROVAL, AuditLog
from .authority import Envelope, actor_of, resolve_initiator_envelope
from .checkpoint import thread_id_for
from .graph import build_brain_graph
from .planner import Planner
from .retry import RetryPolicy
from .runtime import EmployeeRuntime
from .state import BrainState
from .team_bus import TeamBus


@dataclass(frozen=True, slots=True)
class RunContext:
    """一次运行的调用方上下文（**不含**会话状态，只是当次授权）。

    ``initiator_envelope`` 是 ADR-0066 §3.3 的**链根**：派活的每一层都对着它
    比，而不是对着"父 agent 当时拿到了什么"比。它从发起用户的令牌解析，且
    与令牌一样**不进图状态**（状态会落库）。

    ``actor`` 是发起用户的标识（令牌 ``sub``），**只用于审计行**（硬规则 #9）。
    """

    tenant_id: str
    user_token: str = ""
    initiator_envelope: Envelope = field(default_factory=Envelope)
    actor: str = ""


class CheckpointerProvider(Protocol):
    """按租户产出检查点存储。见 :mod:`mate_tech_agent_team.checkpoint`。"""

    def for_tenant(self, tenant_id: str) -> object: ...


PlannerFactory = Callable[[RunContext], Planner]
RuntimeFactory = Callable[[RunContext], EmployeeRuntime]


class RunNotFound(LookupError):
    """该租户下查无此 run（跨租户与不存在同码，不泄露存在性）。"""


class RunNotAwaitingApproval(RuntimeError):
    """该 run 不在待确认状态（E_RUN_NOT_AWAITING_APPROVAL）。"""


AWAITING = "awaiting_approval"

#: 终态：到了这里就不再变（取消 / 超时也落进来，见 1.3 轨 2 的运行控制面）。
TERMINAL_STATUSES: frozenset[str] = frozenset(
    {"completed", "failed", "rejected", "cancelled", "timeout"}
)


def _new_evidence(results: Any, emitted: set[str]) -> list[dict[str, Any]]:
    """从这一份快照的 ``results`` 里挑出**还没出过**的证据条目（1.6 任务 1）。

    按 ``evidenceId`` 去重；没有编号的条目（正常不会出现）退回"任务 + 位置"的
    确定性编号，避免它每步都被重发一遍。
    """
    fresh: list[dict[str, Any]] = []
    for task_id in sorted(results or {}):
        row = (results or {}).get(task_id) or {}
        for index, item in enumerate(row.get("evidence") or []):
            if not isinstance(item, dict):
                continue
            key = str(item.get("evidenceId") or f"{task_id}:{index}")
            if key in emitted:
                continue
            emitted.add(key)
            fresh.append(item)
    return fresh


class BrainService:
    def __init__(
        self,
        *,
        planner_for: PlannerFactory,
        runtime_for: RuntimeFactory,
        checkpointer: CheckpointerProvider,
        team_bus: TeamBus,
        artifacts: ArtifactStore,
        max_parallel: int = 3,
        audit: AuditLog | None = None,
        retry_policy: RetryPolicy | None = None,
    ) -> None:
        self._planner_for = planner_for
        self._runtime_for = runtime_for
        self._checkpointer = checkpointer
        #: 派活闸门：**派活的唯一入口**（包络衰减 + 深度闸门 + 越权转提案）。
        #: 刻意没有默认值——漏接它，闸门就退回空转，而且不会有任何报错。
        self._team_bus = team_bus
        #: 产出物的落地存储（1.6 任务 2）。同样**刻意没有默认值**——漏接它，
        #: 员工照跑照出报告，只是交付物一件都不落库，"跑完了却交不出东西"。
        self._artifacts = artifacts
        self._max_parallel = max_parallel
        #: 失败节点的重试策略（1.5 任务 4）：只作用于员工运行时那一次调用，
        #: 派活（副作用）不在重试范围内。
        self._retry_policy = retry_policy if retry_policy is not None else RetryPolicy()
        #: 审计账本（硬规则 #9）。默认复用闸门那一本——派活 / 越权 / 审批落在
        #: 同一本账上，读的时候不必记得去两个地方捞。
        self.audit: AuditLog = audit if audit is not None else team_bus.audit

    def _config(self, tenant_id: str, run_id: str) -> dict:
        return {"configurable": {"thread_id": thread_id_for(tenant_id, run_id)}}

    async def _graph_for(
        self,
        saver: BaseCheckpointSaver,
        ctx: RunContext,
        max_parallel: int,
        should_cancel: Callable[[], bool] | None = None,
    ):
        return build_brain_graph(
            planner=self._planner_for(ctx),
            runtime=self._runtime_for(ctx),
            bus=self._team_bus,
            checkpointer=saver,
            artifacts=self._artifacts,
            initiator_envelope=ctx.initiator_envelope,
            actor=ctx.actor,
            max_parallel=max_parallel,
            should_cancel=should_cancel,
            retry_policy=self._retry_policy,
        )

    async def start(
        self,
        *,
        tenant_id: str,
        goal: str,
        user_token: str = "",
        max_parallel: int | None = None,
        run_id: str | None = None,
        should_cancel: Callable[[], bool] | None = None,
        timeout_seconds: float = 0.0,
    ) -> BrainState:
        """一句话 → 拆图 → 并行派活 → 停在人工确认闸门。

        ``run_id`` 由调用方给时就用它：运行控制面需要**在开跑之前**就认领这轮
        运行，才能把它纳入取消范围（1.5 任务 1）。不给则现生成一个。

        ``should_cancel`` 是取消标志的读取函数（同样是运行控制面的），图在节点
        边界自查；与令牌一样**不进状态**（状态会落库）。

        ``timeout_seconds`` 是**本轮**生效的运行级超时值（0 = 不设），它和由它
        算出的绝对截止时刻一起**写进状态**（1.5 任务 2）：重启后仍按本轮的约定
        裁决，而不是回落成当时的部署默认值。
        """
        run_id = run_id or uuid4().hex
        cfg = self._config(tenant_id, run_id)
        ctx = self._context(tenant_id=tenant_id, user_token=user_token)
        parallel = max_parallel or self._max_parallel
        timeout = max(timeout_seconds, 0.0)
        deadline_at = time.time() + timeout if timeout > 0 else 0.0
        async with self._checkpointer.for_tenant(tenant_id) as saver:  # type: ignore[attr-defined]
            graph = await self._graph_for(saver, ctx, parallel, should_cancel)
            out = await graph.ainvoke(
                {
                    "run_id": run_id,
                    "tenant_id": tenant_id,
                    "goal": goal,
                    "timeout_seconds": timeout,
                    "deadline_at": deadline_at,
                },
                cfg,
            )
        return dict(out)

    def _context(self, *, tenant_id: str, user_token: str = "") -> RunContext:
        """解析本次运行的链根。**没有令牌 = 空包络**（fail-closed）。"""
        return RunContext(
            tenant_id=tenant_id,
            user_token=user_token,
            initiator_envelope=resolve_initiator_envelope(user_token),
            actor=actor_of(user_token),
        )

    async def resume(
        self,
        *,
        tenant_id: str,
        run_id: str,
        approved: bool = True,
        user_token: str = "",
        should_cancel: Callable[[], bool] | None = None,
    ) -> BrainState:
        """人工确认后续跑。已完成的节点不会被重跑（D-6）。

        续跑也是"执行中的 run"（有请求在等它），所以同样把取消标志交给图。
        """
        cfg = self._config(tenant_id, run_id)
        ctx = self._context(tenant_id=tenant_id, user_token=user_token)
        async with self._checkpointer.for_tenant(tenant_id) as saver:  # type: ignore[attr-defined]
            graph = await self._graph_for(saver, ctx, self._max_parallel, should_cancel)
            snapshot = await graph.aget_state(cfg)
            if not snapshot.values:
                raise RunNotFound(run_id)
            if snapshot.values.get("status") != AWAITING:
                raise RunNotAwaitingApproval(run_id)
            await graph.aupdate_state(cfg, {"approved": approved}, as_node="gate")
            out = await graph.ainvoke(None, cfg)
        # 审批落审计行（硬规则 #9）：谁批的、批的是哪一轮、批还是驳。
        # 记在**闸门真的动了之后**——被 409 挡下的确认不是一次审批。
        self.audit.append(
            action=AUDIT_APPROVAL,
            tenant_id=tenant_id,
            actor=ctx.actor,
            run_id=run_id,
            outcome="approved" if approved else "rejected",
            detail={"scope": "run", "level": "plan_gate"},
        )
        return dict(out)

    async def get(self, *, tenant_id: str, run_id: str) -> BrainState:
        cfg = self._config(tenant_id, run_id)
        ctx = self._context(tenant_id=tenant_id)
        async with self._checkpointer.for_tenant(tenant_id) as saver:  # type: ignore[attr-defined]
            graph = await self._graph_for(saver, ctx, self._max_parallel)
            snapshot = await graph.aget_state(cfg)
        if not snapshot.values:
            raise RunNotFound(run_id)
        return dict(snapshot.values)

    # -- 运行控制面（1.3 轨 2）---------------------------------------------
    async def mark_terminal(self, *, tenant_id: str, run_id: str, status: str) -> BrainState:
        """把 run 置为终态（取消 / 超时）。

        **写进检查点**而不是只在控制面记一份：``GET /runs/{id}`` 读的就是检查点，
        另记一份等于两个真相，重启/多副本立刻互相打脸。已经是终态时原样返回
        （幂等），不覆盖更早的终态。
        """
        if status not in TERMINAL_STATUSES:
            raise ValueError(f"mark_terminal 只接受终态，收到 {status!r}")
        cfg = self._config(tenant_id, run_id)
        ctx = self._context(tenant_id=tenant_id)
        async with self._checkpointer.for_tenant(tenant_id) as saver:  # type: ignore[attr-defined]
            graph = await self._graph_for(saver, ctx, self._max_parallel)
            snapshot = await graph.aget_state(cfg)
            if not snapshot.values:
                raise RunNotFound(run_id)
            if str(snapshot.values.get("status", "")) in TERMINAL_STATUSES:
                return dict(snapshot.values)
            await graph.aupdate_state(cfg, {"status": status})
            snapshot = await graph.aget_state(cfg)
        return dict(snapshot.values)

    async def history(self, *, tenant_id: str, run_id: str, limit: int = 100) -> list[dict]:
        """检查点里的**步骤快照**（最早 → 最新），供事件流回放。

        每条 = 图推进一步时的那一刻状态 + 那一步**跑了哪些节点** + 那一步**新
        出现的证据**。租户隔离与 :meth:`get` 同一条路（thread_id 前缀 + 连接上
        的 GUC）。

        "这步跑了谁"由**上一条快照的 ``next``** 反推（本版 langgraph 的
        ``metadata`` 里已经没有 ``writes``，实测确认）：快照 N 记的是"接下来要跑
        谁"，所以快照 N-1 的 ``next`` 就是快照 N 之前真的跑掉的那些节点。

        **证据按增量出**（1.6 任务 1）：回执整份都在快照里，整份重发的话，连上后
        每来一步都要重传全部历史证据。这里只出**这一步新增的**（按 ``evidenceId``
        去重），前端顺序 append 即可；重复读同一份检查点得到的增量也完全一样，
        因为证据的编号是在**捕获时**定死的，不是读的时候现算的。
        """
        cfg = self._config(tenant_id, run_id)
        ctx = self._context(tenant_id=tenant_id)
        async with self._checkpointer.for_tenant(tenant_id) as saver:  # type: ignore[attr-defined]
            graph = await self._graph_for(saver, ctx, self._max_parallel)
            snapshots = [snap async for snap in graph.aget_state_history(cfg, limit=limit)]
        if not snapshots:
            raise RunNotFound(run_id)
        snapshots.reverse()
        steps: list[dict] = []
        pending: tuple[str, ...] = ()
        emitted: set[str] = set()
        for snapshot in snapshots:
            metadata = snapshot.metadata or {}
            values = snapshot.values or {}
            steps.append(
                {
                    "step": int(metadata.get("step", 0)),
                    "ran": [name for name in pending if not name.startswith("__")],
                    "next": [name for name in (snapshot.next or ()) if not name.startswith("__")],
                    "status": str(values.get("status", "")),
                    "at": str(snapshot.created_at or ""),
                    "evidence": _new_evidence(values.get("results"), emitted),
                }
            )
            pending = tuple(snapshot.next or ())
        return steps


__all__ = [
    "AWAITING",
    "TERMINAL_STATUSES",
    "BrainService",
    "CheckpointerProvider",
    "PlannerFactory",
    "RunContext",
    "RunNotFound",
    "RunNotAwaitingApproval",
    "RuntimeFactory",
]
