"""运行控制面：受理 / 取消 / 超时 / Run 事件流（1.3 轨 2 建面；1.5 补全；1.7 受理制）。

三件事都围着**检查点**做，而不是另建一套 run 存储：``GET /runs/{id}`` 读的就是
检查点里的状态，控制面再记一份等于两个真相。控制面自己只持有**即时信号**
（取消标志、正在跑的 run 集合），不持有任何 run 历史。

* **受理**（1.7 任务 1）—— 起一轮运行改成**受理制**：提交立刻拿 ``run_id``，
  图在后台跑。同步版实测量级是分钟，而网关读超时 60s，客户端拿到 504 时这一轮
  其实已经建好了，重试一次就多跑一轮。受理制把"提交"与"等结果"拆开：终态只能
  从 :meth:`refresh`（``GET /runs/{id}``）或 :meth:`events` 取。带
  ``Idempotency-Key`` 时同一个键（同租户内）永远映射到同一轮运行。
* **取消** —— 把 run 写进终态 ``cancelled``。之后 ``approve`` 一律 409（闸门已
  经不在了）。取消是幂等的：重复取消不会把更早的终态覆盖掉。
  **执行中的 run 也能取消**（1.5 任务 1）：不靠外部杀——图在节点边界自查取消
  标志，看到就自己落终态。粒度是**波与波之间**：在途那一波允许跑完（不硬断），
  已完成节点不重跑，下一波一个员工都不派。
* **超时** —— 运行级截止时间。到点后**第一个观察者**（GET / approve / cancel /
  events）把它落成终态 ``timeout``，而不是让它一直停在 ``awaiting_approval``。
  用惰性裁决而不是后台定时器：定时器在进程重启后消失，反而制造"有时管用"的
  错觉。裁决读的是**状态里的绝对截止时刻**（1.5 任务 2），所以换进程来裁决也
  还是本轮的约定，不会回落到重启后进程的默认值。
* **事件流** —— SSE，内容是检查点里的**步骤快照**（哪一步写了哪些节点、那一步
  之后的状态）。它就是"步骤级事件"，不需要给图加埋点。

**边界登记（诚实说清，别当成没做）**：

1. 取消信号是**进程内**的：只有与运行中的图**同进程**时才精确生效（受理制下
   那个进程就是受理这条请求的进程，后台任务跑在同一个事件循环里）。跨副本取消
   执行中的 run 需要共享信号通道，属后续候选；停在闸门的 run 跨副本取消仍然
   有效（终态写在检查点）。
2. 事件流是**回放 + 尾随**：连上先补历史，之后新步骤即推送，直到 run 终态才
   关流。尾随靠**轮询**检查点（没有引入消息总线），代价见 :meth:`RunControl.events`。
3. **幂等的跨进程面靠"确定性 run_id + 查检查点"**，进程内靠同一张 ``_live`` 表
   占坑。同进程内的并发重复提交是精确幂等的；跨副本的**同时**提交有极小竞态
   （两边都还没查到对方），与边界 1 同源。
4. **后台任务里的异常落成终态 ``failed``**：不然"终态只能从事件流/查询取"就成了
   空话——任务炸了而 run 永远停在 ``running``，客户端会一直等下去。
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from uuid import uuid4

from ..brain import RUNNING, TERMINAL_STATUSES, BrainService, RunNotFound
from ..state import BrainState

#: 运行级超时的默认值（秒）。0 = 不设超时：不是所有部署都想让长跑的计划自己过期。
DEFAULT_TIMEOUT_ENV = "MATE_AGENT_TEAM_RUN_TIMEOUT_SECONDS"

#: 尾随事件流时两次轮询之间的间隔（秒）。
DEFAULT_POLL_INTERVAL = 0.25

#: 受理时等"第一次落检查点"的上限（秒）。等不到也照样回 202——run_id 仍然是
#: 有效的地址，只是订阅方可能要重试一次才不撞 404。
DEFAULT_READY_TIMEOUT = 5.0


def run_id_for(tenant_id: str, idempotency_key: str) -> str:
    """由幂等键**确定性地**推出 run_id。

    这是"重试不产生重复 run"的支点：同一个键（同租户内）永远算出同一个 run_id，
    于是"这轮是不是已经起过"不用另立一张映射表，直接查检查点就知道。租户进摘要
    是为了**同键不跨租户串轮**——两家的同一把钥匙本来就该是两轮。
    """
    digest = hashlib.sha256(f"{tenant_id}\x00{idempotency_key}".encode()).hexdigest()
    return digest[:32]


def _accepted(tenant_id: str, run_id: str, *, deduplicated: bool) -> dict:
    """受理回执。**不含**运行结果——终态要从 :meth:`RunControl.refresh` 取。"""
    return {
        "run_id": run_id,
        "tenant_id": tenant_id,
        "status": RUNNING,
        "deduplicated": deduplicated,
    }


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
        #: 后台任务的强引用。受理制之后"跑"在请求之外，引用丢了会被 GC 掉，
        #: 表现为这一轮**静默**停在半路——没有任何报错。
        self._tasks: set[asyncio.Task[None]] = set()

    @classmethod
    def from_env(cls, service: BrainService) -> RunControl:
        raw = os.getenv(DEFAULT_TIMEOUT_ENV, "0")
        try:
            default_timeout = float(raw)
        except ValueError:
            default_timeout = 0.0
        return cls(service, default_timeout=max(default_timeout, 0.0))

    # -- 受理 / 续跑 --------------------------------------------------------
    async def submit(
        self,
        *,
        tenant_id: str,
        goal: str,
        user_token: str = "",
        max_parallel: int | None = None,
        timeout_seconds: float | None = None,
        idempotency_key: str = "",
    ) -> dict:
        """**受理**一轮运行并立刻回话（1.7 任务 1）：图在后台跑。

        回执只有 ``run_id`` / ``tenant_id`` / ``status`` —— 拆图与派活实测量级是
        分钟，让 HTTP 请求等它只会换来网关 504，而这一轮其实已经建好了。

        三件在受理期就要定下的事：

        1. **run_id** —— 带幂等键时由 :func:`run_id_for` **确定性**推出，所以
           "这个键已经起过没有"不用另立映射表，查检查点就知道。
        2. **认领**（``_live``）—— 图要在自己开跑前拿到取消标志的读取函数，而
           那个函数按 run_id 索引；执行中的它因此落在取消范围内（1.5 任务 1）。
        3. **截止时间** —— 在这里定下，由服务层连同绝对截止时刻写进状态。

        **幂等的两道**：进程内用 ``_live`` 占坑（无 await，原子）；跨进程/重启用
        确定性 run_id 查检查点。命中的那次**不新起一轮**，原样回同一个 run_id 并
        置 ``deduplicated``。
        """
        run_id = run_id_for(tenant_id, idempotency_key) if idempotency_key else uuid4().hex
        if (tenant_id, run_id) in self._live:
            # 同一轮正在跑（受理回执还没摘牌）——不能再起一轮。
            return _accepted(tenant_id, run_id, deduplicated=True)

        live = self._open(tenant_id=tenant_id, run_id=run_id)
        if idempotency_key and await self._exists(tenant_id=tenant_id, run_id=run_id):
            # 已经跑过的一轮（进程重启、或换个副本来的重复提交）。
            self._close(tenant_id=tenant_id, run_id=run_id, live=live)
            return _accepted(tenant_id, run_id, deduplicated=True)

        task = asyncio.create_task(
            self._execute(
                tenant_id=tenant_id,
                run_id=run_id,
                goal=goal,
                user_token=user_token,
                max_parallel=max_parallel,
                timeout_seconds=timeout_seconds,
                live=live,
            )
        )
        # 留住引用：任务被 GC 掉的话这一轮会**静默**停在半路。
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        await self._await_ready(tenant_id=tenant_id, run_id=run_id)
        return _accepted(tenant_id, run_id, deduplicated=False)

    async def _execute(
        self,
        *,
        tenant_id: str,
        run_id: str,
        goal: str,
        user_token: str,
        max_parallel: int | None,
        timeout_seconds: float | None,
        live: _LiveRun,
    ) -> None:
        """后台把这一轮跑完。异常落成终态 ``failed``，绝不是"悄悄没了"。"""
        try:
            await self._service.start(
                tenant_id=tenant_id,
                run_id=run_id,
                goal=goal,
                user_token=user_token,
                max_parallel=max_parallel,
                should_cancel=live.cancelled,
                timeout_seconds=self._effective_timeout(timeout_seconds),
            )
        except asyncio.CancelledError:
            # 进程/事件循环被拆掉时不能再 await 任何东西，原样往上抛。
            raise
        except Exception as exc:
            await self._mark_failed(tenant_id=tenant_id, run_id=run_id, error=exc)
        finally:
            self._close(tenant_id=tenant_id, run_id=run_id, live=live)

    async def _mark_failed(self, *, tenant_id: str, run_id: str, error: Exception) -> None:
        """把后台跑挂的这一轮落成终态 ``failed``，并把错因写进状态。

        受理制把"跑"挪到了请求之外，兜底就得落在这里：不落的话，任务炸了而 run
        永远停在 ``running``，客户端会一直等下去——"终态只能从事件流/查询取"就成
        了空话。终态本身也落不下去时**不吞**：让异常从后台任务冒出来，由事件循环
        记一条，总好过把错误静默掉。
        """
        await self._service.mark_terminal(
            tenant_id=tenant_id, run_id=run_id, status="failed", error=str(error)
        )

    async def _await_ready(
        self, *, tenant_id: str, run_id: str, timeout: float = DEFAULT_READY_TIMEOUT
    ) -> None:
        """等这一轮**第一次落检查点**再回收执。

        受理回执承诺"给的 run_id 立刻可查"：先落检查点再回话，订阅方拿到 run_id
        就能直接连事件流，不会先撞一次 404（那会让人以为 run 没建起来）。等不到
        也照样回——run_id 仍然是有效地址。
        """
        deadline = asyncio.get_running_loop().time() + timeout
        while True:
            try:
                await self._service.get(tenant_id=tenant_id, run_id=run_id)
                return
            except RunNotFound:
                pass
            except Exception:  # 读路径出别的问题不该卡住受理
                return
            if asyncio.get_running_loop().time() >= deadline:
                return
            await asyncio.sleep(0.01)

    async def _exists(self, *, tenant_id: str, run_id: str) -> bool:
        """这一轮是不是已经起过（跨进程/重启的幂等判据）。"""
        try:
            await self._service.get(tenant_id=tenant_id, run_id=run_id)
        except RunNotFound:
            return False
        except Exception:
            # 查不动就别当"已存在"，否则一次读故障会让提交静默变成 no-op。
            return False
        return True

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


__all__ = [
    "DEFAULT_POLL_INTERVAL",
    "DEFAULT_READY_TIMEOUT",
    "DEFAULT_TIMEOUT_ENV",
    "RunControl",
    "run_id_for",
]
