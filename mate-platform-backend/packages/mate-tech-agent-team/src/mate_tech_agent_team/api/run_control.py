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

1. 取消针对的是**停在闸门**的 run —— 那正是本产品真正会"挂着"的形态。执行中的
   run 有请求在等它（``POST /runs`` 是同步的），取消它需要图在节点边界自查，
   属 1.4 候选。
2. 每轮的超时值记在**进程内**；进程重启后回落到 ``MATE_AGENT_TEAM_RUN_TIMEOUT_SECONDS``
   这个默认值（0 = 不设超时）。
3. 事件流是**回放**已有步骤后收流，不做长连接尾随。
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass

from ..brain import TERMINAL_STATUSES, BrainService, RunNotFound

#: 运行级超时的默认值（秒）。0 = 不设超时：不是所有部署都想让长跑的计划自己过期。
DEFAULT_TIMEOUT_ENV = "MATE_AGENT_TEAM_RUN_TIMEOUT_SECONDS"


@dataclass
class _RunRecord:
    """一轮运行的截止信息。**只在进程内**——它不参与状态判定，只喂超时裁决。"""

    timeout_seconds: float
    started_at: float


class RunControl:
    """按租户管理 run 的取消 / 超时 / 事件。状态一律落在检查点上。"""

    def __init__(self, service: BrainService, *, default_timeout: float = 0.0) -> None:
        self._service = service
        self._default_timeout = default_timeout
        self._runs: dict[tuple[str, str], _RunRecord] = {}

    @classmethod
    def from_env(cls, service: BrainService) -> RunControl:
        raw = os.getenv(DEFAULT_TIMEOUT_ENV, "0")
        try:
            default_timeout = float(raw)
        except ValueError:
            default_timeout = 0.0
        return cls(service, default_timeout=max(default_timeout, 0.0))

    # -- 登记 --------------------------------------------------------------
    def register(self, *, tenant_id: str, run_id: str, timeout_seconds: float | None) -> None:
        """记下这一轮的截止时间。``timeout_seconds=None`` 用部署默认值。"""
        timeout = self._default_timeout if timeout_seconds is None else max(timeout_seconds, 0.0)
        self._runs[(tenant_id, run_id)] = _RunRecord(
            timeout_seconds=timeout, started_at=time.time()
        )

    def is_due(self, *, tenant_id: str, run_id: str) -> bool:
        record = self._runs.get((tenant_id, run_id))
        if record is None or record.timeout_seconds <= 0:
            return False
        return time.time() - record.started_at >= record.timeout_seconds

    # -- 裁决 --------------------------------------------------------------
    async def refresh(self, *, tenant_id: str, run_id: str) -> dict:
        """查状态：**到期就先落终态**，再返回。所有读路径都该走它。"""
        try:
            state = await self._service.get(tenant_id=tenant_id, run_id=run_id)
        except RunNotFound:
            self._runs.pop((tenant_id, run_id), None)
            raise
        if str(state.get("status", "")) in TERMINAL_STATUSES:
            self._runs.pop((tenant_id, run_id), None)  # 终态了，截止信息没用了
            return state
        if self.is_due(tenant_id=tenant_id, run_id=run_id):
            return await self._service.mark_terminal(
                tenant_id=tenant_id, run_id=run_id, status="timeout"
            )
        return state

    async def cancel(self, *, tenant_id: str, run_id: str) -> dict:
        """取消一轮运行（幂等）。跨租户与不存在同码：:class:`RunNotFound`。"""
        return await self._service.mark_terminal(
            tenant_id=tenant_id, run_id=run_id, status="cancelled"
        )

    # -- 事件流 ------------------------------------------------------------
    async def events(self, *, tenant_id: str, run_id: str) -> AsyncIterator[str]:
        """SSE：逐个步骤快照往外发，最后一条 ``end`` 收流。

        先 ``refresh`` 再回放：到期的运行要能在事件流里看到它已经落成终态。
        """
        await self.refresh(tenant_id=tenant_id, run_id=run_id)
        steps = await self._service.history(tenant_id=tenant_id, run_id=run_id)
        for index, step in enumerate(steps, start=1):
            payload = json.dumps({"seq": index, **step}, ensure_ascii=False)
            yield f"event: step\ndata: {payload}\n\n"
            await asyncio.sleep(0)  # 让出事件循环：这是流，不是一次性响应
        yield "event: end\ndata: {}\n\n"


__all__ = ["DEFAULT_TIMEOUT_ENV", "RunControl"]
