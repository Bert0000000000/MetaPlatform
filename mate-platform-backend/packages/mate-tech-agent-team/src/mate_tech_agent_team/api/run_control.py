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

1. 取消信号走**共享通道**（1.9 任务 2，:mod:`mate_tech_agent_team.coordination`）：
   单副本是进程内实现，多副本由 ``wiring`` 按 DSN 装配 PG 实现，于是"副本 A 起的
   run，副本 B 取消得到"——B 把信号放进通道，A 上正在跑的图在**下一个波边界**
   自己看到。剩下的两条小边界：跨副本取消时 B **不保证**"回话那一刻图已经停了"
   （它没有 A 的 live 记录，无法等），它保证的是终态与信号都已落下；取消信号是
   **粘性**的（只置不清），留一张只增不减的小表。
2. 事件流是**回放 + 尾随**：连上先补历史，之后新步骤即推送，直到 run 终态才
   关流。尾随靠**轮询**检查点（没有引入消息总线），代价见 :meth:`RunControl.events`。
3. **幂等靠"确定性 run_id + 查检查点 + 共享认领"**（1.9 任务 3）：进程内用同一张
   ``_live`` 表占坑，跨副本用共享的 ``RunClaims``。同键并发提交**只产生一个 run**，
   且这一条现在**跨副本也成立**——1.7 自标的"极小竞态"已消除。
4. **后台任务里的异常落成终态 ``failed``**：不然"终态只能从事件流/查询取"就成了
   空话——任务炸了而 run 永远停在 ``running``，客户端会一直等下去。
5. **进程重启后的续跑靠"扫检查点"**（1.8 轨 1，:meth:`RunControl.recover`）：
   受理制把执行放在本进程里，进程一没，在途的 run 就卡住了。恢复**不另建 run
   真相**——扫的就是检查点表本身，续跑用的是 ``ainvoke(None, cfg)``（从检查点
   的 ``next`` 接着跑，已完成的节点不重跑）。两个诚实的边界：检查点写在**超步
   边界**上，所以进程死在某一波员工在途时，**那一波**会被重跑；发起用户的令牌
   仍然不进状态，续跑用的是随这一轮落库的**派活授权**（1.9 任务 1，见
   :mod:`mate_tech_agent_team.delegation`）——它只有包络四维，没有凭据，且只对
   发出去的那一轮作数。
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field
from typing import Protocol
from uuid import uuid4

from ..brain import (
    RUNNING,
    TERMINAL_STATUSES,
    BrainService,
    RunNotFound,
)
from ..checkpoint import SCHEMA as CHECKPOINT_SCHEMA
from ..checkpoint import UnfinishedRun, list_unfinished
from ..coordination import (
    CancelSignals,
    InMemoryCancelSignals,
    InMemoryRunClaims,
    PgCancelSignals,
    PgRunClaims,
    RunClaims,
    configured_claim_ttl,
)
from ..run_lease import (
    DEFAULT_HEARTBEAT_GRACE_SECONDS,
    InMemoryRunLeases,
    PgRunLeases,
    RunLease,
    RunLeases,
    TakeoverDecision,
    configured_heartbeat_interval,
    configured_lease_ttl,
    decide_takeover,
    new_instance_id,
)
from ..state import BrainState
from ..tool_ledger import ToolLedger

logger = logging.getLogger("metaplatform.agent_team.run_control")

#: 运行级超时的默认值（秒）。0 = 不设超时：不是所有部署都想让长跑的计划自己过期。
DEFAULT_TIMEOUT_ENV = "MATE_AGENT_TEAM_RUN_TIMEOUT_SECONDS"

#: 建表用的 admin DSN。启动扫描要跨租户读检查点表（见 :class:`PgRunIndex`），
#: 而检查点表的 RLS 是 fail-closed —— 拿 app 角色读只会"一行都扫不到"。
ADMIN_DSN_ENV = "MATE_AGENT_TEAM_ADMIN_DSN"

#: 协作面（取消信号 / 幂等认领）用的 app DSN。它按租户读写，所以**必须**是受
#: RLS 约束的那个角色；没配就不建跨副本实现，退回进程内实现（单副本的默认形态）。
DSN_ENV = "MATE_AGENT_TEAM_DSN"

#: 尾随事件流时两次轮询之间的间隔（秒）。
DEFAULT_POLL_INTERVAL = 0.25

#: 受理时等"第一次落检查点"的上限（秒）。等不到也照样回 202——run_id 仍然是
#: 有效的地址，只是订阅方可能要重试一次才不撞 404。
DEFAULT_READY_TIMEOUT = 5.0

#: 启动扫描认领的状态。"running" = 图正在推进（受理那一刻起就是它），进程没了
#: 才会剩下；"awaiting_approval" **不在里面**——那是**等人**，不是没跑完，把它
#: 推一遍只会把已经跑完的节点再派一次。
RESUMABLE_STATUSES: frozenset[str] = frozenset({RUNNING})


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

    这不是第二份 run 状态——run 状态仍然只在检查点里。取消标志也**不在这里**了
    （1.9 任务 2）：它挪进了共享通道，跨副本才看得见。留在这里的只有两件**即时
    信号**：

    * ``finished`` —— 图跑完时置位。取消要**等它停**再回话：``POST /cancel``
      返回时，这轮已经不再推进了，而不是"请求已受理、请稍后再查"。
    * ``lease_epoch`` / ``heartbeat`` —— 本实例持有的租约手数，以及续租任务
      （B-1）。epoch 让"上一任的延迟续租"被数据库直接拒掉；心跳任务在同一实例
      内保证租约不会因为图跑得久而过期。

    只有**本进程起的那一轮**才在这里有记录，所以"等它停"这件事只对本进程成立的
    那部分负责——跨副本取消另有交代，见 :meth:`RunControl.cancel`。
    """

    finished: asyncio.Event = field(default_factory=asyncio.Event)
    lease_epoch: int = 0
    heartbeat: asyncio.Task[None] | None = None


class RunIndex(Protocol):
    """ "哪些 run 需要续跑"的索引（1.8 轨 1）。

    刻意是个协议而不是直接调 PG：控制面的**决策逻辑**（认领谁、跳过谁、怎么续）
    与"去哪儿查"是两件事。前者的用例不该被一个活着的 Postgres 卡住。

    ``statuses`` 是"算需要续跑"的状态集（见 :data:`RESUMABLE_STATUSES`）。
    不传"终态集"是因为筛的是**要什么**而不是**不要什么**：停在闸门上的 run 不是
    终态，但它不该被捞回来（那是等人，不是没跑完）。
    """

    async def unfinished(self, *, statuses: frozenset[str]) -> list[UnfinishedRun]: ...


class PgRunIndex:
    """从检查点表扫出指定状态的 run（跨租户）。

    用 admin DSN 的理由见 :func:`mate_tech_agent_team.checkpoint.list_unfinished`：
    这是控制面自己的扫描，不是某租户的读；它只吐地址与状态，续跑仍走各租户自己
    的 RLS 连接。没配 ``MATE_AGENT_TEAM_ADMIN_DSN`` 时**不建索引**（= 不做恢复），
    而不是退回用 app DSN 扫一张永远扫不出东西的表——那会让人觉得"恢复了、只是
    没有要恢复的"。
    """

    def __init__(self, dsn: str, *, schema: str = CHECKPOINT_SCHEMA) -> None:
        self._dsn = dsn
        self._schema = schema

    async def unfinished(self, *, statuses: frozenset[str]) -> list[UnfinishedRun]:
        # psycopg 是同步的；丢到线程里跑，别把事件循环占住（启动扫描也是 I/O）。
        return await asyncio.to_thread(
            list_unfinished,
            self._dsn,
            statuses=statuses,
            schema=self._schema,
        )


class RunControl:
    """按租户管理 run 的取消 / 超时 / 事件。状态一律落在检查点上。"""

    def __init__(
        self,
        service: BrainService,
        *,
        default_timeout: float = 0.0,
        poll_interval: float = DEFAULT_POLL_INTERVAL,
        run_index: RunIndex | None = None,
        signals: CancelSignals | None = None,
        claims: RunClaims | None = None,
        leases: RunLeases | None = None,
        tool_ledger: ToolLedger | None = None,
        step_reader: Callable[[str, str], Awaitable[str]] | None = None,
        instance_id: str = "",
        lease_ttl: float | None = None,
        heartbeat_interval: float | None = None,
        heartbeat_grace: float = DEFAULT_HEARTBEAT_GRACE_SECONDS,
    ) -> None:
        self._service = service
        self._default_timeout = default_timeout
        self._poll_interval = poll_interval
        #: "哪些 run 没跑完"的索引（1.8 轨 1）。**没有默认值就不恢复**——
        #: 本地/测试形态不该被迫接一个 PG 才能构造控制面。
        self._run_index = run_index
        #: 取消信号的**共享通道**（1.9 任务 2）。不给就是进程内实现：单副本部署
        #: 与加这个模块之前逐字一致，多副本由 ``from_env`` 按 DSN 装配 PG 实现。
        self._signals: CancelSignals = signals if signals is not None else InMemoryCancelSignals()
        #: 幂等认领的**共享通道**（1.9 任务 3）。同上：不给就是进程内实现。
        self._claims: RunClaims = (
            claims if claims is not None else InMemoryRunClaims(configured_claim_ttl())
        )
        #: 活跃 run 租约（B-1）。不给就是进程内实现——单副本行为与之前逐字一致，
        #: 多副本由 ``from_env`` 按 DSN 装配 PG 实现。
        self._leases: RunLeases = (
            leases if leases is not None else InMemoryRunLeases(configured_lease_ttl())
        )
        #: 工具调用账本（A-3）。**只**用于接管判定里"有没有在途调用"那一问；
        #: 不给就当作"没有在途调用"（单进程默认，与加这个查询之前一致）。
        self._tool_ledger = tool_ledger
        #: 读"检查点走到哪了"的函数。心跳用它续租，接管判定用它比"有没有进展"。
        #: 不给就留空串——那时"检查点未进展"这条判据退化成"不比"，如实记在
        #: :func:`~mate_tech_agent_team.run_lease.decide_takeover` 的注释里。
        self._step_reader = step_reader
        #: 本实例标识（进租约的 ``owner_instance``：多副本下"谁在跑"就靠它）。
        self._instance_id = instance_id or new_instance_id()
        self._lease_ttl = lease_ttl if lease_ttl is not None else configured_lease_ttl()
        self._heartbeat_interval = (
            heartbeat_interval
            if heartbeat_interval is not None
            else configured_heartbeat_interval()
        )
        self._heartbeat_grace = heartbeat_grace
        self._live: dict[tuple[str, str], _LiveRun] = {}
        #: 后台任务的强引用。受理制之后"跑"在请求之外，引用丢了会被 GC 掉，
        #: 表现为这一轮**静默**停在半路——没有任何报错。
        self._tasks: set[asyncio.Task[None]] = set()

    @property
    def instance_id(self) -> str:
        """本实例标识。多副本压测用它断言"三份租约分属三个实例"。"""
        return self._instance_id

    @classmethod
    def from_env(
        cls,
        service: BrainService,
        *,
        step_reader: Callable[[str, str], Awaitable[str]] | None = None,
        tool_ledger: ToolLedger | None = None,
    ) -> RunControl:
        raw = os.getenv(DEFAULT_TIMEOUT_ENV, "0")
        try:
            default_timeout = float(raw)
        except ValueError:
            default_timeout = 0.0
        admin_dsn = os.getenv(ADMIN_DSN_ENV, "")
        dsn = os.getenv(DSN_ENV, "")
        ttl = configured_claim_ttl()
        return cls(
            service,
            default_timeout=max(default_timeout, 0.0),
            run_index=PgRunIndex(admin_dsn) if admin_dsn else None,
            # 协作面与租约都是**按租户**读写的，走 app 角色（RLS 强制）；建表另走 admin。
            signals=PgCancelSignals(dsn, schema=CHECKPOINT_SCHEMA) if dsn else None,
            claims=PgRunClaims(dsn, schema=CHECKPOINT_SCHEMA, ttl=ttl) if dsn else None,
            leases=PgRunLeases(dsn, schema=CHECKPOINT_SCHEMA) if dsn else None,
            tool_ledger=tool_ledger,
            step_reader=step_reader,
        )

    def _cancel_check(self, *, tenant_id: str, run_id: str) -> Callable[[], Awaitable[bool]]:
        """给图看的取消标志读取函数（1.9 任务 2 起是 **async** 的）。

        读的是**共享通道**，不是本进程的那张表：跨副本取消时标志是**另一个进程**
        写进去的，只有真去读一次才看得见。置位那条路（:meth:`cancel`）走的也是
        同一个通道，所以没有第二条要维护的路径。
        """

        async def _check() -> bool:
            return await self._signals.is_requested(tenant_id=tenant_id, run_id=run_id)

        return _check

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

        **幂等的三道**（1.9 任务 3 补齐第三道）：

        1. **进程内** ``_live`` 占坑 —— 无 await，原子；
        2. **跨副本** 共享认领（:class:`RunClaims`）—— "谁先来"由数据库那一条
           ``INSERT ... ON CONFLICT ... WHERE`` 定，不再有"两边都还没查到对方"
           的读后写窗口；
        3. **跨进程/重启** 确定性 run_id + 查检查点 —— 已经在库里跑过的那一轮
           不重起。

        第 2 道是 1.9 新加的：只靠第 3 道时，两个副本**同时**提交同一个键会各自
        查到"还没有"，于是**都开跑**（键收敛到同一个地址这件事一直是对的，错的
        是跑了两轮）。命中的那一次**不新起一轮**，原样回同一个 run_id 并置
        ``deduplicated``。
        """
        run_id = run_id_for(tenant_id, idempotency_key) if idempotency_key else uuid4().hex
        if (tenant_id, run_id) in self._live:
            # 同一轮正在跑（受理回执还没摘牌）——不能再起一轮。
            return _accepted(tenant_id, run_id, deduplicated=True)

        live = self._open(tenant_id=tenant_id, run_id=run_id)
        if idempotency_key and not await self._claims.claim(
            tenant_id=tenant_id, key=idempotency_key, run_id=run_id
        ):
            # 另一个副本正占着这把钥匙（或者刚刚占过、还没跑完）。
            await self._close(tenant_id=tenant_id, run_id=run_id, live=live)
            return _accepted(tenant_id, run_id, deduplicated=True)
        if idempotency_key and await self._exists(tenant_id=tenant_id, run_id=run_id):
            # 已经跑过的一轮（进程重启、或换个副本来的重复提交）。认领**还回去**
            # ——留着它会白占一把已经被用掉的钥匙，直到寿命到期。
            await self._claims.release(tenant_id=tenant_id, key=idempotency_key)
            await self._close(tenant_id=tenant_id, run_id=run_id, live=live)
            return _accepted(tenant_id, run_id, deduplicated=True)
        if await self._claim_lease(tenant_id=tenant_id, run_id=run_id, live=live) is None:
            # **第四道幂等**（B-1）：另一个副本正持着这一轮的活跃租约。它可能还
            # 没落第一个检查点（所以上面那道查不到），但"有人在跑"这件事只有
            # 租约答得出来。起第二轮 = 同一轮双跑，正是本批要治的。
            if idempotency_key:
                await self._claims.release(tenant_id=tenant_id, key=idempotency_key)
            await self._close(tenant_id=tenant_id, run_id=run_id, live=live)
            return _accepted(tenant_id, run_id, deduplicated=True)

        task = asyncio.create_task(
            self._execute(
                tenant_id=tenant_id,
                run_id=run_id,
                goal=goal,
                user_token=user_token,
                max_parallel=max_parallel,
                timeout_seconds=timeout_seconds,
                idempotency_key=idempotency_key,
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
        idempotency_key: str = "",
    ) -> None:
        """后台把这一轮跑完。异常落成终态 ``failed``，绝不是"悄悄没了"。"""
        try:
            await self._service.start(
                tenant_id=tenant_id,
                run_id=run_id,
                goal=goal,
                user_token=user_token,
                max_parallel=max_parallel,
                should_cancel=self._cancel_check(tenant_id=tenant_id, run_id=run_id),
                timeout_seconds=self._effective_timeout(timeout_seconds),
            )
        except asyncio.CancelledError:
            # 进程/事件循环被拆掉时不能再 await 任何东西，原样往上抛。
            raise
        except Exception as exc:
            await self._mark_failed(tenant_id=tenant_id, run_id=run_id, error=exc)
        finally:
            await self._close(tenant_id=tenant_id, run_id=run_id, live=live)
            if idempotency_key:
                # 认领随执行结束归还，桌面上只留**在途**的那几把钥匙（不然这张表
                # 会随"用过的键的个数"一直涨）。被拆掉/崩掉时这一步可能没跑成，
                # 那也没关系——认领有寿命，到期可以被接管。
                await self._claims.release(tenant_id=tenant_id, key=idempotency_key)

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

    # -- 启动扫描 / 续跑（1.8 轨 1）-----------------------------------------
    async def recover(self) -> list[str]:
        """扫出**没跑完**的 run，逐个从检查点接着跑。返回认领到的 run_id。

        这是"进程重启后在途 run 不再永远卡在 ``running``"的入口。三件事按这个
        顺序做，每一件都在兜一类坑：

        1. **问索引要清单**。没配索引就直接返回空——恢复是可选能力，不是启动
           的硬前提。
        2. **逐个现查一次状态**。索引给的是"扫描那一刻"的结论，可能已经过时
           （比如这一轮在别处跑完了）。续跑前按**当下状态**判，且只认
           :data:`RESUMABLE_STATUSES`——停在闸门上的 run 是等人，不是没跑完。
        3. **后台跑，不阻塞启动**。续跑同样是分钟级的事，`await` 它等于把服务
           启动拖住；但**先占坑**（``_live``）再 ``create_task``，否则同一轮在
           本次扫描内会被认领两次。

        4. **接管要过四道判据**（B-1，见 :meth:`_takeover_decision`），而不是
           "扫到就抢"。多副本下别的副本可能正跑得好好的，抢过来就是同一轮双跑。

        扫描本身**不吞异常**：索引查不动就让它冒出去，由调用方（启动流程）决定
        记日志还是失败——"扫不动"与"没有要恢复的"必须能分开。
        """
        if self._run_index is None:
            return []
        found = await self._run_index.unfinished(statuses=RESUMABLE_STATUSES)
        claimed: list[str] = []
        for run in found:
            if (run.tenant_id, run.run_id) in self._live:
                continue  # 本进程已经在跑它了
            if not await self._is_resumable(run):
                continue
            decision = await self._takeover_decision(run)
            if not decision.take:
                logger.info(
                    "agent_team.run_lease.not_taken_over",
                    extra={
                        "tenant_id": run.tenant_id,
                        "run_id": run.run_id,
                        "reason": decision.reason,
                    },
                )
                continue
            live = self._open(tenant_id=run.tenant_id, run_id=run.run_id)
            if (
                await self._claim_lease(tenant_id=run.tenant_id, run_id=run.run_id, live=live)
                is None
            ):
                # 判定与抢租约之间被别的副本抢先了。这正是"先判后抢"必须原子化的
                # 原因——判定只是**筛选**，真正定胜负的是那一句 SQL。
                await self._close(tenant_id=run.tenant_id, run_id=run.run_id, live=live)
                continue
            task = asyncio.create_task(
                self._continue(tenant_id=run.tenant_id, run_id=run.run_id, live=live)
            )
            self._tasks.add(task)
            task.add_done_callback(self._tasks.discard)
            claimed.append(run.run_id)
        return claimed

    async def _is_resumable(self, run: UnfinishedRun) -> bool:
        """这一轮现在**还**值得续吗（按当下的检查点，而不是扫描时的快照）。

        查不到（跨进程竞态：被别处清掉 / 从没见过）与读不动一律返回 ``False``：
        一次读故障不该让启动扫描把整个进程带崩，更不该去续一个根本不存在的 run。
        """
        try:
            state = await self._service.get(tenant_id=run.tenant_id, run_id=run.run_id)
        except RunNotFound:
            return False
        except Exception:
            return False
        return str(state.get("status", "")) in RESUMABLE_STATUSES

    async def _continue(self, *, tenant_id: str, run_id: str, live: _LiveRun) -> None:
        """后台把续跑跑完。与 :meth:`_execute` 同形：异常落终态 ``failed``。"""
        try:
            await self._service.continue_run(
                tenant_id=tenant_id,
                run_id=run_id,
                should_cancel=self._cancel_check(tenant_id=tenant_id, run_id=run_id),
            )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            await self._mark_failed(tenant_id=tenant_id, run_id=run_id, error=exc)
        finally:
            await self._close(tenant_id=tenant_id, run_id=run_id, live=live)

    async def shutdown(self) -> None:
        """进程收尾：拆掉在途的后台任务（1.8 轨 1）。

        "重启"在这个服务里的准确含义就是**这个动作 + 换一个新实例**：检查点在
        PG 里活着，进程里的调度没了。没有这个入口，进程退出时后台任务会以
        "被事件循环顺手取消"的形式消失——那是运气，不是收尾。

        取消**不落终态**：这一轮会在新进程启动时被扫描认领、接着跑。所以这里
        刻意不去写 ``cancelled``——把"进程要走了"记成"运行被取消了"是两个概念，
        后者会让重启前的每一轮都凭空消失。
        """
        tasks = list(self._tasks)
        if not tasks:
            return
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

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
            await self._claim_lease(tenant_id=tenant_id, run_id=run_id, live=live)
            return await self._service.resume(
                tenant_id=tenant_id,
                run_id=run_id,
                approved=approved,
                user_token=user_token,
                should_cancel=self._cancel_check(tenant_id=tenant_id, run_id=run_id),
            )
        finally:
            await self._close(tenant_id=tenant_id, run_id=run_id, live=live)

    def _open(self, *, tenant_id: str, run_id: str) -> _LiveRun:
        live = _LiveRun()
        self._live[(tenant_id, run_id)] = live
        return live

    async def _claim_lease(self, *, tenant_id: str, run_id: str, live: _LiveRun) -> RunLease | None:
        """拿这一轮的活跃租约（B-1）。拿不到 = **别的副本正持有**。

        拿到之后立刻起心跳任务：图可能跑几分钟，而 TTL 只有几十秒；没有续租的话
        每一个长跑 run 都会被自己的寿命误判成孤儿。
        """
        lease = await self._leases.acquire(
            tenant_id=tenant_id,
            run_id=run_id,
            owner=self._instance_id,
            ttl=self._lease_ttl,
            current_step=await self._latest_step(tenant_id, run_id),
        )
        if lease is None:
            return None
        live.lease_epoch = lease.lease_epoch
        live.heartbeat = asyncio.create_task(
            self._heartbeat_loop(
                tenant_id=tenant_id, run_id=run_id, epoch=lease.lease_epoch, live=live
            )
        )
        return lease

    async def _heartbeat_loop(
        self, *, tenant_id: str, run_id: str, epoch: int, live: _LiveRun
    ) -> None:
        """定期续租，并把"检查点走到哪了"记进租约。

        续租**失败**是有意义的信号而非噪音：它说明这轮已经被别人接管了（epoch
        对不上）。这时我们不自杀——图已经在跑，硬停会留下半截；我们只是**不再
        续租**，让新主人按它自己的节奏收敛。如实记一条日志，不静默。

        读步骤失败不阻断续租：读不到就沿用租约上已有的 ``current_step``，
        "续命"比"记准进度"重要——记不准只影响接管判定的严格程度，续不上命
        会让这一轮被误接管。
        """
        step = ""
        while True:
            await asyncio.sleep(self._heartbeat_interval)
            try:
                step = await self._latest_step(tenant_id, run_id)
            except Exception:  # 读不动不该把心跳打断
                step = ""
            try:
                ok = await self._leases.renew(
                    tenant_id=tenant_id,
                    run_id=run_id,
                    owner=self._instance_id,
                    epoch=epoch,
                    ttl=self._lease_ttl,
                    current_step=step,
                )
            except Exception:
                continue  # 数据库抖一下不该让租约永久失效
            if not ok:
                logger.warning(
                    "agent_team.run_lease.lost",
                    extra={
                        "tenant_id": tenant_id,
                        "run_id": run_id,
                        "lease_epoch": epoch,
                        "owner_instance": self._instance_id,
                    },
                )
                return

    async def _latest_step(self, tenant_id: str, run_id: str) -> str:
        """检查点走到哪了。``step_reader`` 没配时返回空串（判据如实退化）。"""
        if self._step_reader is None:
            return ""
        try:
            return await self._step_reader(tenant_id, run_id)
        except Exception:
            return ""

    async def _running_invocations(self, tenant_id: str, run_id: str) -> int:
        """这一轮还有几条在途工具调用（接管判定的第四条）。没配账本就当 0。"""
        if self._tool_ledger is None:
            return 0
        try:
            return await self._tool_ledger.running_invocations(tenant_id=tenant_id, run_id=run_id)
        except Exception:
            # 查不动时**当作有在途调用**（保守）：宁可晚一点接管，也不要因为
            # 一次读故障把一轮还有副作用的 run 抢过来重放。
            return 1

    async def _takeover_decision(self, run: UnfinishedRun) -> TakeoverDecision:
        """这一轮现在该不该被接管（B-1 的四条件，见 ``decide_takeover``）。"""
        return decide_takeover(
            await self._leases.get(tenant_id=run.tenant_id, run_id=run.run_id),
            now=time.time(),
            checkpoint_step=await self._latest_step(run.tenant_id, run.run_id),
            running_invocations=await self._running_invocations(run.tenant_id, run.run_id),
            heartbeat_grace=self._heartbeat_grace,
        )

    async def _close(self, *, tenant_id: str, run_id: str, live: _LiveRun) -> None:
        # 先置位再摘牌：正在 await 的取消请求要能被唤醒。
        live.finished.set()
        if live.heartbeat is not None:
            live.heartbeat.cancel()
            live.heartbeat = None
        self._live.pop((tenant_id, run_id), None)
        if live.lease_epoch:
            # 带着 epoch 释放：**换过手就什么都不做**（见 ``RunLeases.release``）。
            await self._leases.release(
                tenant_id=tenant_id,
                run_id=run_id,
                owner=self._instance_id,
                epoch=live.lease_epoch,
            )

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

        **执行中的 run**（有请求在等它）走的是另一条路：置信号 → 等图在节点
        边界自己停下 → 回话。不硬断在途调用（那一波允许跑完），也不重跑
        已完成的节点。等在闸门的 run 没有 live 记录，直接落终态即可（1.3 语义）。

        **信号总是先置、且置进共享通道**（1.9 任务 2）：跨副本取消之所以原来
        不生效，就是因为 B 那侧只往检查点写了个终态，而在途的图攥着自己那份状态
        继续跑、下一步把终态盖回去。现在标志放进通道，**另一个副本**上正在跑的
        图会在下一个波边界看到它。

        顺序是有讲究的：**先确认这一轮存在**（不存在/跨租户直接
        :class:`RunNotFound`，一个字节都不写），再置信号，最后等本进程那一轮停下
        再落终态。置信号在终态判定**之后**，所以取消一个已经结束的 run 不会留下
        一条无人认领的信号行。

        跨副本时 B 没有 A 的 live 记录，"等它停"这一步它做不到——它能保证的是
        **终态与信号都已经落下**，A 上的图会在下一个波边界收敛到同一个终态。
        """
        state = await self.refresh(tenant_id=tenant_id, run_id=run_id)
        if str(state.get("status", "")) in TERMINAL_STATUSES:
            return state  # 幂等：不覆盖更早的终态（1.3 语义）
        await self._signals.request(tenant_id=tenant_id, run_id=run_id)
        live = self._live.get((tenant_id, run_id))
        if live is not None:
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
    "ADMIN_DSN_ENV",
    "DEFAULT_POLL_INTERVAL",
    "DEFAULT_READY_TIMEOUT",
    "DEFAULT_TIMEOUT_ENV",
    "RESUMABLE_STATUSES",
    "PgRunIndex",
    "RunControl",
    "RunIndex",
    "run_id_for",
]
