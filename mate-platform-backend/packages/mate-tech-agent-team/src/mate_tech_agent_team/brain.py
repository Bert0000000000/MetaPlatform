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

from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol
from uuid import uuid4

from langgraph.checkpoint.base import BaseCheckpointSaver

from .checkpoint import thread_id_for
from .graph import build_brain_graph
from .planner import Planner
from .runtime import EmployeeRuntime
from .state import BrainState


@dataclass(frozen=True, slots=True)
class RunContext:
    """一次运行的调用方上下文（**不含**会话状态，只是当次授权）。"""

    tenant_id: str
    user_token: str = ""


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


class BrainService:
    def __init__(
        self,
        *,
        planner_for: PlannerFactory,
        runtime_for: RuntimeFactory,
        checkpointer: CheckpointerProvider,
        max_parallel: int = 3,
    ) -> None:
        self._planner_for = planner_for
        self._runtime_for = runtime_for
        self._checkpointer = checkpointer
        self._max_parallel = max_parallel

    def _config(self, tenant_id: str, run_id: str) -> dict:
        return {"configurable": {"thread_id": thread_id_for(tenant_id, run_id)}}

    async def _graph_for(self, saver: BaseCheckpointSaver, ctx: RunContext, max_parallel: int):
        return build_brain_graph(
            planner=self._planner_for(ctx),
            runtime=self._runtime_for(ctx),
            checkpointer=saver,
            max_parallel=max_parallel,
        )

    async def start(
        self,
        *,
        tenant_id: str,
        goal: str,
        user_token: str = "",
        max_parallel: int | None = None,
    ) -> BrainState:
        """一句话 → 拆图 → 并行派活 → 停在人工确认闸门。"""
        run_id = uuid4().hex
        cfg = self._config(tenant_id, run_id)
        ctx = RunContext(tenant_id=tenant_id, user_token=user_token)
        parallel = max_parallel or self._max_parallel
        async with self._checkpointer.for_tenant(tenant_id) as saver:  # type: ignore[attr-defined]
            graph = await self._graph_for(saver, ctx, parallel)
            out = await graph.ainvoke(
                {"run_id": run_id, "tenant_id": tenant_id, "goal": goal},
                cfg,
            )
        return dict(out)

    async def resume(
        self,
        *,
        tenant_id: str,
        run_id: str,
        approved: bool = True,
        user_token: str = "",
    ) -> BrainState:
        """人工确认后续跑。已完成的节点不会被重跑（D-6）。"""
        cfg = self._config(tenant_id, run_id)
        ctx = RunContext(tenant_id=tenant_id, user_token=user_token)
        async with self._checkpointer.for_tenant(tenant_id) as saver:  # type: ignore[attr-defined]
            graph = await self._graph_for(saver, ctx, self._max_parallel)
            snapshot = await graph.aget_state(cfg)
            if not snapshot.values:
                raise RunNotFound(run_id)
            if snapshot.values.get("status") != AWAITING:
                raise RunNotAwaitingApproval(run_id)
            await graph.aupdate_state(cfg, {"approved": approved}, as_node="gate")
            out = await graph.ainvoke(None, cfg)
        return dict(out)

    async def get(self, *, tenant_id: str, run_id: str) -> BrainState:
        cfg = self._config(tenant_id, run_id)
        ctx = RunContext(tenant_id=tenant_id)
        async with self._checkpointer.for_tenant(tenant_id) as saver:  # type: ignore[attr-defined]
            graph = await self._graph_for(saver, ctx, self._max_parallel)
            snapshot = await graph.aget_state(cfg)
        if not snapshot.values:
            raise RunNotFound(run_id)
        return dict(snapshot.values)


__all__ = [
    "AWAITING",
    "BrainService",
    "CheckpointerProvider",
    "PlannerFactory",
    "RunContext",
    "RunNotFound",
    "RunNotAwaitingApproval",
    "RuntimeFactory",
]
