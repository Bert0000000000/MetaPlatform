"""运行控制面：受理 / 取消 / 超时 / Run 事件流（1.3 轨 2 建面；1.5 补全；1.7 受理制）。

三件事都围着**检查点**做，而不是另建一套 run 存储：``GET /runs/{id}`` 读的就是
检查点里的状态，控制面再记一份等于两个真相。控制面自己只持有**即时信号**
（取消标志、正在跑的 run 集合），不持有任何 run 历史。

* **受理**（1.7 任务 1）—— 起一轮运行改成**受理制**：提交立刻拿 ``run_id``，
  图在后台跑。同步版实测量级是分钟，而网关读超时 60s，客户端拿到 504 时这一轮
  其实已经建好了，重试一次就多跑一轮。受理制把"提交"与"等结果"拆开：终态只能
  从 :meth:`refresh`（``GET /runs/{id}``）或 :meth:`events` 取。带
  ``Idempotency-Key`` 时同一个键（同租户内）永远映射到同一轮运行。
* **取消**（B-3 起是**受理制**）—— 置取消信号后回 **202**，不承诺"回话那刻图已经
  停了"（那个保证只在单副本下成立）。客户端拿到 ``cancelling`` 就继续观察
  ``GET /runs/{id}``，直到 ``cancelled``。之后 ``approve`` 一律 409（闸门已经不在）。
  **执行中的 run 也能取消**（1.5 任务 1）：不靠外部杀——图在节点边界自查取消
  标志，看到就自己落终态。粒度是**波与波之间**：在途那一波允许跑完（不硬断），
  已完成节点不重跑，下一波一个员工都不派。**"有没有人在跑"由活跃 run 注册表
  （B-1 的租约）回答**——没人跑时才由取消方代落终态。
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
   自己看到。**B-3 起不再假装"回话那刻图已停"**（回 202 + 观察到的状态）。
   信号仍然**只置不清**，但轮子落终态之后会被**归档**（:meth:`RunControl.refresh`
   里顺手清）——清的时机是"这一轮已经不可能再有人问它了"，不是"多久之后"。
2. 事件流是**按游标补发 + 尾随**（B-2 起）：连上先补（``Last-Event-ID`` 之后一条
   不少），之后新步骤即推送，直到 run 终态才关流。生产形态读**追加式事件日志**
   （被 PG ``NOTIFY`` 唤醒，代价与订阅方数量无关）；没配 PG 时退回"轮询检查点"的
   老路径，但同样按游标补发。**执行恢复的真相源仍是检查点**——事件日志只是产品
   观察模型，丢了它不影响续跑。
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
from collections.abc import AsyncIterator, Awaitable, Callable, Sequence
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
from ..conversation_link import (
    RELATION_INITIATED,
    ConversationRuns,
    InMemoryConversationRuns,
    PgConversationRuns,
)
from ..coordination import (
    CancelSignals,
    InMemoryCancelSignals,
    InMemoryRunClaims,
    PgCancelSignals,
    PgRunClaims,
    RunClaims,
    configured_claim_ttl,
)
from ..run_events import (
    DEFAULT_BATCH,
    PgRunEvents,
    RunEventStore,
    configured_fallback_poll,
    configured_retention,
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

#: ``GET /runs?conversation=`` 一次最多回多少轮。列表里每一轮都要读一次检查点
#: （见 :meth:`RunControl.runs_in_conversation`），所以这个数同时是那次请求的
#: 检查点读次数上限。取 200：会话页要显示的历史轮次远小于它，而真正的"我要
#: 全量"应该走别的面。
MAX_CONVERSATION_RUNS = 200

#: 建表用的 admin DSN。启动扫描要跨租户读检查点表（见 :class:`PgRunIndex`），
#: 而检查点表的 RLS 是 fail-closed —— 拿 app 角色读只会"一行都扫不到"。
ADMIN_DSN_ENV = "MATE_AGENT_TEAM_ADMIN_DSN"

#: 跨租户恢复扫描用的 **控制面 DSN**（B-4）。它比 admin 小得多：只能读
#: ``checkpoints``，靠一条 permissive 策略越过租户边界。**运行 Pod 只该有这个**，
#: 不该有 admin——那是"能建表能授权"的整库钥匙。
CONTROL_DSN_ENV = "MATE_AGENT_TEAM_CONTROL_DSN"

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

#: 取消的**中间态**（B-3）。它不是写进检查点的一个新状态，而是**推导**出来的：
#: 收到取消信号、且这一轮还没落终态 = "正在取消"。这样就不需要第二个状态源，
#: 也不会出现"检查点说 running、信号表说已取消"这种自相矛盾。
CANCELLING = "cancelling"

#: 取消受理后**有界**等本进程那一轮停下的上限（秒）。等不到就如实回
#: ``cancelling``——"回话那刻图已经停了"这个强保证跨副本做不到，B-3 起不再暗示。
CANCEL_WAIT_ENV = "MATE_AGENT_TEAM_CANCEL_WAIT_SECONDS"
DEFAULT_CANCEL_WAIT_SECONDS = 2.0


def configured_cancel_wait() -> float:
    try:
        return max(0.0, float(os.getenv(CANCEL_WAIT_ENV, str(DEFAULT_CANCEL_WAIT_SECONDS))))
    except ValueError:
        return DEFAULT_CANCEL_WAIT_SECONDS


def _cancel_receipt(tenant_id: str, run_id: str, *, status: str) -> dict:
    """取消的**受理**回执（B-3）：202 + 当前观察到的状态。

    ``status`` 是 ``cancelled``（已经落终态了）或 ``cancelling``（已受理、图还没停）。
    客户端据此知道"要不要接着等"，而不是被暗示"回话那刻就停好了"。
    """
    return {
        "run_id": run_id,
        "tenant_id": tenant_id,
        "status": status,
        "cancel_requested": True,
    }


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
    #: 事件记录器（B-2）。**每轮一个**，与订阅方数量无关——这正是"连接数 ×
    #: 每秒 4 次读检查点"被消掉的地方：以前每个 SSE 连接各自轮询检查点，
    #: 现在是记录器一个人写事件日志，订阅方只读日志（且被 NOTIFY 唤醒）。
    recorder: asyncio.Task[None] | None = None
    #: 记录游标：已经写进事件日志的步骤数，以及上次见到的检查点 id。
    recorded: int = 0
    last_step: str = ""


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
        run_events: RunEventStore | None = None,
        conversations: ConversationRuns | None = None,
        step_reader: Callable[[str, str], Awaitable[str]] | None = None,
        instance_id: str = "",
        lease_ttl: float | None = None,
        heartbeat_interval: float | None = None,
        heartbeat_grace: float = DEFAULT_HEARTBEAT_GRACE_SECONDS,
        event_retention: float | None = None,
        event_fallback_poll: float | None = None,
        cancel_wait: float | None = None,
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
        #: Run 事件日志（B-2）。**不给就是 None** —— 那时事件流退回"回放 + 尾随
        #: 检查点"的老路径，单副本 / 不接 PG 的形态与加它之前逐字一致（唯一差别
        #: 是断线重连现在也按 ``Last-Event-ID`` 补发，那是纯改进）。
        self._run_events: RunEventStore | None = run_events
        #: 会话 ↔ run 关系（C-1）。**后端是唯一关系源**：不给就是进程内实现，
        #: 单副本与测试行为一致；多副本与重启下的一致性由 ``from_env`` 按 DSN
        #: 装配 PG 实现给出。它只记"哪一轮属于哪次对话"，不记 run 状态。
        self._conversations: ConversationRuns = (
            conversations if conversations is not None else InMemoryConversationRuns()
        )
        self._event_retention = (
            event_retention if event_retention is not None else configured_retention()
        )
        self._event_fallback_poll = (
            event_fallback_poll if event_fallback_poll is not None else configured_fallback_poll()
        )
        #: 取消受理后等本进程那一轮停下的上限（B-3）。0 = 立刻回 ``cancelling``。
        self._cancel_wait = cancel_wait if cancel_wait is not None else configured_cancel_wait()
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
        control_dsn = os.getenv(CONTROL_DSN_ENV, "")
        dsn = os.getenv(DSN_ENV, "")
        ttl = configured_claim_ttl()
        # 恢复扫描优先走**控制面**身份（B-4）：它只需要读检查点，不该拿 admin。
        # 没配控制面 DSN 时才回落到 admin DSN——那是本地/单进程的旧形态。
        index_dsn = control_dsn or admin_dsn
        return cls(
            service,
            default_timeout=max(default_timeout, 0.0),
            run_index=PgRunIndex(index_dsn) if index_dsn else None,
            # 协作面与租约都是**按租户**读写的，走 app 角色（RLS 强制）；建表另走 admin。
            signals=PgCancelSignals(dsn, schema=CHECKPOINT_SCHEMA) if dsn else None,
            claims=PgRunClaims(dsn, schema=CHECKPOINT_SCHEMA, ttl=ttl) if dsn else None,
            leases=PgRunLeases(dsn, schema=CHECKPOINT_SCHEMA) if dsn else None,
            run_events=PgRunEvents(dsn, schema=CHECKPOINT_SCHEMA) if dsn else None,
            conversations=PgConversationRuns(dsn, schema=CHECKPOINT_SCHEMA) if dsn else None,
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
        conversation_id: str = "",
        turn_id: str = "",
        created_by: str = "",
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

        带 ``conversation_id`` 时**先落关系再往下走**（C-1）：下面几条去重路径
        都会提前 return，把关联放在它们之前，才能保证"回执里那个 run_id 一定能
        从这个会话查到"。关联本身幂等，重复提交不会攒出第二条。

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
        if conversation_id:
            # C-1：会话 ↔ run 落后端。这一步**没有**放在图跑起来之后——图上跑着
            # 的 run 才是最难补记的那种，而这里的失败会让整个 submit 抛出去，
            # 是刻意的：记不下关系就不该假装受理成功。
            await self._conversations.link(
                tenant_id=tenant_id,
                conversation_id=conversation_id,
                run_id=run_id,
                turn_id=turn_id,
                created_by=created_by,
                relation_type=RELATION_INITIATED,
            )
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
        # 保留期：对本次扫到的租户顺带清一次过期事件（B-2）。低频、按租户、
        # 失败不影响恢复——见 :meth:`prune_events` 里为什么不挂后台定时器。
        for tenant_id in {run.tenant_id for run in found}:
            await self.prune_events(tenant_id=tenant_id)
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

    async def prune_events(self, *, tenant_id: str) -> int:
        """清掉本租户过期的 Run 事件（B-2 的保留期）。返回删掉的行数。

        **按租户清**，因为事件表是 RLS 强制的表——跨租户清理是控制面的活
        （``MATE_AGENT_TEAM_ADMIN_DSN`` 那条路），B-4 再谈。

        调用点是启动扫描里**顺带对每个有未完成 run 的租户清一次**，不是后台
        定时器：与运行级超时同一条教训——定时器在进程重启后消失，反而制造
        "有时管用"的错觉。清不动**不吞也不炸**：保留期是运维关切，
        不是这一轮能不能跑的前提。
        """
        if self._run_events is None or self._event_retention <= 0 or not tenant_id:
            return 0
        try:
            return await self._run_events.prune(
                tenant_id=tenant_id, older_than=time.time() - self._event_retention
            )
        except Exception:
            return 0

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
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        # 事件日志的 LISTEN 连接是进程级的，要显式关（它不挂在任何任务上）。
        if self._run_events is not None:
            try:
                await self._run_events.aclose()
            except Exception:
                pass

    async def resume(
        self,
        *,
        tenant_id: str,
        run_id: str,
        approved: bool = True,
        user_token: str = "",
        approver_roles: Sequence[str] = (),
        comment: str = "",
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
                approver_roles=approver_roles,
                comment=comment,
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
        self._start_recorder(tenant_id=tenant_id, run_id=run_id, live=live)
        return lease

    # -- 事件记录（B-2）------------------------------------------------------
    def _start_recorder(self, *, tenant_id: str, run_id: str, live: _LiveRun) -> None:
        """起这一轮的事件记录器。没配事件日志时是 no-op。"""
        if self._run_events is None or live.recorder is not None:
            return
        live.recorder = asyncio.create_task(
            self._record_loop(tenant_id=tenant_id, run_id=run_id, live=live)
        )

    async def _record_once(self, *, tenant_id: str, run_id: str, live: _LiveRun) -> bool:
        """把**新出现的**步骤写进事件日志。返回本轮是否已到终态。

        两步走是为了便宜：先只看**检查点 id**（一条走索引的查询），它没变就
        什么都不做。只有它变了才去读整份历史——``history()`` 要把图建起来，
        是本模块最贵的一步，而绝大多数轮询它是没必要的。

        **记录是观察，不是执行**：这里出任何错都不该影响这一轮本身，所以
        读不到就跳过。丢了事件只影响"回放得全不全"，**不影响续跑**——检查点
        才是执行恢复的真相源。
        """
        assert self._run_events is not None
        try:
            step = await self._latest_step(tenant_id, run_id)
            if not step or step == live.last_step:
                return False
            live.last_step = step
            steps = await self._service.history(tenant_id=tenant_id, run_id=run_id)
            for entry in steps[live.recorded :]:
                await self._run_events.append(
                    tenant_id=tenant_id,
                    run_id=run_id,
                    event_type="step",
                    payload=dict(entry),
                    checkpoint_id=step,
                )
            live.recorded = len(steps)
            status = str(steps[-1].get("status", "")) if steps else ""
            return status in TERMINAL_STATUSES
        except asyncio.CancelledError:
            raise
        except Exception:
            return False

    async def _record_loop(self, *, tenant_id: str, run_id: str, live: _LiveRun) -> None:
        """每轮一个的后台记录器（见 :meth:`_record_once` 的两步走说明）。"""
        while not live.finished.is_set():
            if await self._record_once(tenant_id=tenant_id, run_id=run_id, live=live):
                return
            await asyncio.sleep(self._poll_interval)

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
        if live.recorder is not None:
            live.recorder.cancel()
            live.recorder = None
            # **收尾补一次**：记录器是被取消的，最后那一步（常常正是落终态的
            # 那一步）可能还没被写进事件日志。补这一次，事件流才有"结束"可言。
            # 它失败也不影响这一轮——事件只是观察。
            if self._run_events is not None:
                await self._record_once(tenant_id=tenant_id, run_id=run_id, live=live)
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
        """查状态：**到期就先落终态**，再返回。所有读路径都该走它。

        B-3 起多两件事，都围着取消那一格信号转：

        * 收到取消信号、且这一轮还没落终态 → 状态报 ``cancelling``（**推**出来的
          中间态，不是检查点里的第二个状态）；
        * 已经落终态 → 把那条信号**归档**掉。清的条件不是"多久之后"，而是
          "这一轮已经不可能再有人问它了"——所以清在这里是安全的。
        """
        state = await self._service.get(tenant_id=tenant_id, run_id=run_id)
        requested = await self._signals.is_requested(tenant_id=tenant_id, run_id=run_id)
        status = str(state.get("status", ""))
        if status in TERMINAL_STATUSES:
            if requested:
                await self._archive_signal(tenant_id=tenant_id, run_id=run_id)
            return state
        if self.is_due(state):
            return await self._service.mark_terminal(
                tenant_id=tenant_id, run_id=run_id, status="timeout"
            )
        if requested:
            return {**state, "status": CANCELLING}
        return state

    @property
    def conversations(self) -> ConversationRuns:
        """会话 ↔ run 关系面（``GET /runs?conversation=`` 读的就是它）。"""
        return self._conversations

    async def runs_in_conversation(
        self, *, tenant_id: str, conversation_id: str, limit: int = MAX_CONVERSATION_RUNS
    ) -> list[dict]:
        """一个会话里的各轮 run（**新→旧**），每项 = 关系字段 + 该轮状态。

        **状态仍走 :meth:`refresh`**，不另读一份——列表视图与单轮视图必须看到
        同一个状态，否则"列表说 running、点进去说 timeout"就成了第二个真相。
        代价是 N 轮 = N 次检查点读，所以有 ``limit``：会话页一次要显示的历史轮次
        是十数量级，超过这个数说明调用方在做别的事。

        关联指向的 run 在检查点里读不到时（受理了但还没落第一个检查点，或这一轮
        从来没跑起来）**照样出这一项**，``status`` 留空——关系是真的，把它藏起来
        反而会让"我明明发起过这一轮"变成一个无法解释的现象。
        """
        if not tenant_id or not conversation_id:
            return []
        links = await self._conversations.by_conversation(tenant_id, conversation_id)
        if limit > 0:
            links = links[-limit:]  # 新→旧取最近 limit 条，读检查点的次数随之封顶
        rows: list[dict] = []
        for link in links:
            state: dict = {}
            try:
                state = await self.refresh(tenant_id=tenant_id, run_id=link.run_id)
            except RunNotFound:
                state = {}
            rows.append(
                {
                    **link.to_dict(),
                    "status": str(state.get("status", "")),
                    "goal": str(state.get("goal", "")),
                }
            )
        rows.reverse()  # 会话页要的次序是"最近一轮在最上面"
        return rows

    async def _archive_signal(self, *, tenant_id: str, run_id: str) -> None:
        """归档一格取消信号（**只在终态之后调**，见 :meth:`refresh`）。"""
        try:
            await self._signals.clear(tenant_id=tenant_id, run_id=run_id)
        except Exception:
            # 归档失败不该让一次读请求失败：它只是"这张表能小一点"，不影响语义。
            pass

    async def cancel(self, *, tenant_id: str, run_id: str) -> dict:
        """**受理**取消（B-3：202 ``cancel_requested``），不再假装"回话那刻就停了"。

        语义变了，变的是**承诺的那部分**：

        * 旧：``await live.finished.wait()`` 之后落终态、回 200 + 终态 —— 这条
          只在**单副本**下成立。多副本时 B 没有 A 的 live 记录，它要么永远等下去，
          要么回一个自己都不该保证的话。
        * 新：置信号 → **有界**等本进程那一轮停下（默认 2s）→ 回**观察到的**状态。
          客户端拿到 ``cancelling`` 就接着观察 ``GET /runs/{id}``，直到 ``cancelled``。

        **"有没有人在跑"由活跃 run 注册表回答**（B-1 的租约，正是它要解决的事）：
        没有活跃租约 = 这一轮没人执行（停在闸门等人 / 进程崩过），这时**没有第二个
        观察者**会去落终态，所以由本请求落。有活跃租约时绝不代庖——那正是 1.5 起
        那个"B 写了终态、在途的图下一步又盖回去"的 bug。

        幂等：已经终态的直接回当前终态（不覆盖更早的终态，1.3 语义不变）。
        """
        state = await self.refresh(tenant_id=tenant_id, run_id=run_id)
        status = str(state.get("status", ""))
        if status in TERMINAL_STATUSES:
            return _cancel_receipt(tenant_id, run_id, status=status)

        await self._signals.request(tenant_id=tenant_id, run_id=run_id)
        # **只看"有没有人在跑"**（B-1 的租约），不看 ``refresh`` 报出来的状态。
        #
        # 这里曾经还带一个 ``status == CANCELLING`` 的短路，那是错的：状态是
        # ``cancelling`` 只说明"信号已置且还没终态"，**不说明有人在跑**。
        # 停在闸门等人的 run 正是这个样子——于是第二次取消（或者任何一次在信号
        # 已置之后的取消）会永远回 ``cancelling`` 而**没有人去落终态**，
        # 那一轮就卡死在等人上了。这条是 ``test_cross_replica_cancel`` 的
        # 「sticky until terminal」新用例抓出来的。
        if await self._someone_is_running(tenant_id=tenant_id, run_id=run_id):
            await self._await_local_stop(tenant_id=tenant_id, run_id=run_id)
            settled = await self._service.get(tenant_id=tenant_id, run_id=run_id)
            settled_status = str(settled.get("status", ""))
            if settled_status in TERMINAL_STATUSES:
                return _cancel_receipt(tenant_id, run_id, status=settled_status)
            return _cancel_receipt(tenant_id, run_id, status=CANCELLING)

        # 没有活跃租约：这一轮没人执行（停在闸门等人 / 崩过），终态得由我们落
        # ——没有第二个观察者会去做这件事。
        settled = await self._service.mark_terminal(
            tenant_id=tenant_id, run_id=run_id, status="cancelled"
        )
        return _cancel_receipt(tenant_id, run_id, status=str(settled.get("status", "cancelled")))

    async def _someone_is_running(self, *, tenant_id: str, run_id: str) -> bool:
        """这一轮**此刻**有没有人在执行（活跃 run 注册表 = 租约表）。"""
        try:
            lease = await self._leases.get(tenant_id=tenant_id, run_id=run_id)
        except Exception:
            return True  # 读不动就当有人在跑：代庖落终态比多等一会儿糟得多
        return lease is not None and lease.expires_at > time.time()

    async def _await_local_stop(self, *, tenant_id: str, run_id: str) -> None:
        """有界等**本进程**那一轮停下。等不到就返回——由调用方如实回 ``cancelling``。"""
        live = self._live.get((tenant_id, run_id))
        if live is None or self._cancel_wait <= 0:
            return
        try:
            await asyncio.wait_for(live.finished.wait(), timeout=self._cancel_wait)
        except TimeoutError:
            pass

    # -- 事件流 ------------------------------------------------------------
    async def events(
        self, *, tenant_id: str, run_id: str, last_event_id: int = 0
    ) -> AsyncIterator[str]:
        """SSE：先按游标**补发**，再**尾随**，到终态发 ``end``。

        ``last_event_id`` 就是 SSE 的 ``Last-Event-ID``：浏览器断线重连时自己带
        回来，于是补发从"它看过的最后一条"开始——**断线不丢事件**。B-2 之前
        ``seq`` 是每流内存计数（流一断归零），重连必然从头再来或者干脆丢中间段。

        尾随有两条路径，按是否配了事件日志分流：

        * **有日志**（生产形态）—— 读 ``run_event``，被 PG ``NOTIFY`` 唤醒。
          代价与**订阅方数量无关**：写日志的是每轮一个的记录器，订阅方只读日志。
        * **没日志**（单副本 / 不接 PG）—— 保持原来的"轮询检查点历史"，
          但同样按 ``last_event_id`` 补发。与加 B-2 之前逐字一致。
        """
        await self.refresh(tenant_id=tenant_id, run_id=run_id)
        if self._run_events is None:
            async for frame in self._tail_checkpoints(
                tenant_id=tenant_id, run_id=run_id, start=last_event_id
            ):
                yield frame
            return
        async for frame in self._tail_log(tenant_id=tenant_id, run_id=run_id, start=last_event_id):
            yield frame

    async def _tail_checkpoints(
        self, *, tenant_id: str, run_id: str, start: int
    ) -> AsyncIterator[str]:
        """没有事件日志时的退路：回放 + 尾随**检查点历史**（B-2 之前的老路径）。

        改进只有一处：游标从 ``Last-Event-ID`` 起步而不是从 0 —— 重连因此
        不再把整轮历史重发一遍。
        """
        seq = max(0, start)
        while True:
            steps = await self._service.history(tenant_id=tenant_id, run_id=run_id)
            for step in steps[seq:]:
                seq += 1
                payload = json.dumps({"seq": seq, **step}, ensure_ascii=False)
                yield f"id: {seq}\nevent: step\ndata: {payload}\n\n"
            if steps and str(steps[-1].get("status", "")) in TERMINAL_STATUSES:
                break
            await asyncio.sleep(self._poll_interval)
        yield "event: end\ndata: {}\n\n"

    async def _tail_log(self, *, tenant_id: str, run_id: str, start: int) -> AsyncIterator[str]:
        """有事件日志时的主路径：订阅 NOTIFY，只读事件表。

        补发与尾随用**同一个游标**（``after``），所以"重连补发"与"实时推送"
        之间没有缝：补发到哪，就从哪继续等通知。
        """
        assert self._run_events is not None
        after = max(0, start)
        wakeups = self._run_events.wakeups(
            tenant_id=tenant_id, run_id=run_id, fallback_interval=self._event_fallback_poll
        )
        try:
            while True:
                events = await self._run_events.since(
                    tenant_id=tenant_id, run_id=run_id, after=after, limit=DEFAULT_BATCH
                )
                for event in events:
                    after = event.sequence
                    payload = json.dumps(
                        {"seq": event.sequence, **dict(event.payload)}, ensure_ascii=False
                    )
                    yield f"id: {event.sequence}\nevent: {event.event_type}\ndata: {payload}\n\n"
                    if str(event.payload.get("status", "")) in TERMINAL_STATUSES:
                        yield "event: end\ndata: {}\n\n"
                        return
                if not events:
                    # 空闲时才做一次状态读（**不读历史**）。有事件在流的时候
                    # 完全不碰检查点——这正是"连接数 × 每秒 4 次读检查点"消失
                    # 的地方。记录器会把终态那一步写进日志，届时上面那一支就收流。
                    state = await self.refresh(tenant_id=tenant_id, run_id=run_id)
                    if str(state.get("status", "")) in TERMINAL_STATUSES:
                        # 收尾补发：终态那一步可能刚写进日志，先把它读完再关。
                        tail = await self._run_events.since(
                            tenant_id=tenant_id, run_id=run_id, after=after
                        )
                        for event in tail:
                            after = event.sequence
                            payload = json.dumps(
                                {"seq": event.sequence, **dict(event.payload)}, ensure_ascii=False
                            )
                            yield (
                                f"id: {event.sequence}\nevent: {event.event_type}"
                                f"\ndata: {payload}\n\n"
                            )
                        yield "event: end\ndata: {}\n\n"
                        return
                async for _tick in wakeups:
                    break
        finally:
            await wakeups.aclose()


__all__ = [
    "ADMIN_DSN_ENV",
    "CANCELLING",
    "CONTROL_DSN_ENV",
    "DEFAULT_POLL_INTERVAL",
    "DEFAULT_READY_TIMEOUT",
    "DEFAULT_TIMEOUT_ENV",
    "MAX_CONVERSATION_RUNS",
    "RESUMABLE_STATUSES",
    "PgRunIndex",
    "RunControl",
    "RunIndex",
    "run_id_for",
]
