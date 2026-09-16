"""运行控制面：取消 / 超时 / Run 事件流（1.3 轨 2）。

三件事都围着**检查点**做，而不是另建一套 run 存储：``GET /runs/{id}`` 读的就是
检查点里的状态，控制面再记一份等于两个真相。

* **取消** —— 把 run 写进终态 ``cancelled``。之后 ``approve`` 一律 409（闸门已
  经不在了）。取消是幂等的：重复取消不会把更早的终态覆盖掉。
* **超时** —— 运行级截止时间。到点后**第一个观察者**（GET / approve / cancel /
  events）把它落成终态 ``timeout``，而不是让它一直停在 ``awaiting_approval``。
  用惰性裁决而不是后台定时器：定时器在进程重启后消失，反而制造"有时管用"的
  错觉；惰性裁决的语义是确定的（见下面的边界登记）。
* **事件流** —— SSE，内容是检查点里的**步骤快照**（哪一步写了哪些节点、那一步
  之后的状态）。它就是"步骤级事件"，不需要给图加埋点。

**边界登记（诚实说清，别当成没做）**：

1. 取消信号是**进程内**的：只有与运行中的图**同进程**时才精确生效（那正是
   ``POST /runs`` / ``approve`` 在等它的那个进程）。跨副本取消执行中的 run 需要
   共享信号通道，属后续候选；停在闸门的 run 跨副本取消仍然有效（终态写在检查点）。
2. 事件流是**回放 + 尾随**：连上先补历史，之后新步骤即推送，直到 run 终态才
   关流。尾随靠**轮询**检查点（没有引入消息总线），代价见 :meth:`RunControl.events`。
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from uuid import uuid4

from ..brain import TERMINAL_STATUSES, BrainService
from ..state import BrainState

#: 运行级超时的默认值（秒）。0 = 不设超时：不是所有部署都想让长跑的计划自己过期。
DEFAULT_TIMEOUT_ENV = "MATE_AGENT_TEAM_RUN_TIMEOUT_SECONDS"

#: 尾随事件流时两次轮询之间的间隔（秒）。
DEFAULT_POLL_INTERVAL = 0.25


@dataclass
class _LiveRun:
    """一个**正在跑**的 run（有请求在等它）。

    这不是第二份 run 状态——run 状态仍然只在检查点里。这里只有两件**即时信号**：

    * ``cancel_requested`` —— 图在节点边界读它（1.5 任务 1）。历史里不留痕，
      所以它不该进图状态。
    * ``finished`` —— 图跑完时置位。取消要**等它停**再回话：``POST /cancel``
      返回时，这轮已经不再推进了，而不是"请求已受理、请稍后再查"。
    """

    cancel_requested: bool = False
    finished: asyncio.Event = field(default_factory=asyncio.Event)

    def cancelled(self) -> bool:
        """给图看的取消标志读取函数。"""
        return self.cancel_requested


class RunControl:
    """按租户管理 run 的取消 / 超时 / 事件。状态一律落在检查点上。"""

    def __init__(
        self,
        service: BrainService,
        *,
        default_timeout: float = 0.0,
        poll_interval: float = DEFAULT_POLL_INTERVAL,
    ) -> None:
        self._service = service
        self._default_timeout = default_timeout
        self._poll_interval = poll_interval
        self._live: dict[tuple[str, str], _LiveRun] = {}

    @classmethod
    def from_env(cls, service: BrainService) -> RunControl:
        raw = os.getenv(DEFAULT_TIMEOUT_ENV, "0")
        try:
            default_timeout = float(raw)
        except ValueError:
            default_timeout = 0.0
        return cls(service, default_timeout=max(default_timeout, 0.0))

    # -- 起跑 / 续跑 --------------------------------------------------------
    async def start(
        self,
        *,
        tenant_id: str,
        goal: str,
        user_token: str = "",
        max_parallel: int | None = None,
        timeout_seconds: float | None = None,
    ) -> dict:
        """起一轮运行，并**在开跑之前**认领它（这样执行中的它也能被取消）。

        run_id 由控制面生成：图要能在自己开跑前就拿到"这轮会不会被取消"的
        读取函数，而那个函数按 run_id 索引。超时值在这里定下，由服务层连同
        绝对截止时刻一起写进状态（**随 run 走，不留在进程里**）。
        """
        run_id = uuid4().hex
        live = self._open(tenant_id=tenant_id, run_id=run_id)
        try:
            return await self._service.start(
                tenant_id=tenant_id,
                run_id=run_id,
                goal=goal,
                user_token=user_token,
                max_parallel=max_parallel,
                should_cancel=live.cancelled,
                timeout_seconds=self._effective_timeout(timeout_seconds),
            )
        finally:
            self._close(tenant_id=tenant_id, run_id=run_id, live=live)

    async def resume(
        self,
        *,
        tenant_id: str,
        run_id: str,
        approved: bool = True,
        user_token: str = "",
    ) -> dict:
        """人工确认后续跑。续跑同样"有请求在等它"，因此同样可被取消。"""
        live = self._open(tenant_id=tenant_id, run_id=run_id)
        try:
            return await self._service.resume(
                tenant_id=tenant_id,
                run_id=run_id,
                approved=approved,
                user_token=user_token,
                should_cancel=live.cancelled,
            )
        finally:
            self._close(tenant_id=tenant_id, run_id=run_id, live=live)

    def _open(self, *, tenant_id: str, run_id: str) -> _LiveRun:
        live = _LiveRun()
        self._live[(tenant_id, run_id)] = live
        return live

    def _close(self, *, tenant_id: str, run_id: str, live: _LiveRun) -> None:
        # 先置位再摘牌：正在 await 的取消请求要能被唤醒。
        live.finished.set()
        self._live.pop((tenant_id, run_id), None)

    def _effective_timeout(self, timeout_seconds: float | None) -> float:
        """这一轮实际生效的超时值：调用方没给就用部署默认值。"""
        if timeout_seconds is None:
            return self._default_timeout
        return max(timeout_seconds, 0.0)

    # -- 裁决 --------------------------------------------------------------
    def is_due(self, state: BrainState) -> bool:
        """本轮是否已经过了截止时刻。

        读的是**状态里**的 ``deadline_at``（开跑时写进去的绝对时刻），不是
        进程里的计时器——所以换个进程来裁决也不会"忘了"这轮的约定。
        """
        deadline_at = float(state.get("deadline_at") or 0.0)
        return deadline_at > 0 and time.time() >= deadline_at

    async def refresh(self, *, tenant_id: str, run_id: str) -> dict:
        """查状态：**到期就先落终态**，再返回。所有读路径都该走它。"""
        state = await self._service.get(tenant_id=tenant_id, run_id=run_id)
        if str(state.get("status", "")) in TERMINAL_STATUSES:
            return state
        if self.is_due(state):
            return await self._service.mark_terminal(
                tenant_id=tenant_id, run_id=run_id, status="timeout"
            )
        return state

    async def cancel(self, *, tenant_id: str, run_id: str) -> dict:
        """取消一轮运行（幂等）。跨租户与不存在同码：:class:`RunNotFound`。

        **执行中的 run**（有请求在等它）走的是另一条路：置取消标志 → 等图在
        节点边界自己停下 → 回话。不硬断在途调用（那一波允许跑完），也不重跑
        已完成的节点。等在闸门的 run 没有 live 记录，直接落终态即可（1.3 语义）。
        """
        live = self._live.get((tenant_id, run_id))
        if live is not None:
            live.cancel_requested = True
            await live.finished.wait()
        return await self._service.mark_terminal(
            tenant_id=tenant_id, run_id=run_id, status="cancelled"
        )

    # -- 事件流 ------------------------------------------------------------
    async def events(self, *, tenant_id: str, run_id: str) -> AsyncIterator[str]:
        """SSE：先**回放**已有步骤，再**尾随**后续步骤，直到 run 终态才收流。

        只回放的话，连上之后发生的推进要靠重连才看得到——"步骤级事件流"这个
        名分就落空了。所以连上先补历史（到此刻为止一条不少），之后每有新步骤
        就推，run 落终态才发 ``end``。

        尾随靠**轮询检查点**，没有引入消息总线（不新增基础设施，也就没有
        "两个真相"的余地）。代价写在这里：新步骤最多晚一个
        :data:`DEFAULT_POLL_INTERVAL` 才推出去，且每轮轮询开一次检查点连接。
        终态也一并从状态里读——"run 落终态"与"流关掉"因此是同一个事实。
        """
        await self.refresh(tenant_id=tenant_id, run_id=run_id)
        seq = 0
        while True:
            steps = await self._service.history(tenant_id=tenant_id, run_id=run_id)
            for step in steps[seq:]:
                seq += 1
                payload = json.dumps({"seq": seq, **step}, ensure_ascii=False)
                yield f"event: step\ndata: {payload}\n\n"
            if steps and str(steps[-1].get("status", "")) in TERMINAL_STATUSES:
                break
            await asyncio.sleep(self._poll_interval)
        yield "event: end\ndata: {}\n\n"


__all__ = ["DEFAULT_TIMEOUT_ENV", "RunControl"]
