"""超级大脑服务层：起一次运行 / 查一次运行 / 人工确认续跑。

这一层负责把**租户**落到两处：``thread_id`` 前缀（命名隔离）与连接的
``app.tenant_id`` GUC（数据库强制隔离）。两者缺一：只有命名隔离时，任何能猜到
thread_id 的调用方都能读到别人的状态；只有 GUC 而 thread_id 不带前缀时，
策略匹配不到任何行（fail-closed），业务直接跑不通。

**发起用户的 token 也在这里传递**，走 :class:`RunContext` —— 且**刻意不进图状态**：
状态会被 checkpointer 落进 PG，令牌不该落库（硬规则 #12 的同一精神）。
它只在本次调用构建图时被闭包捕获，用完即散。

**令牌不落库，但授权落库**（1.9 任务 1）：开跑那一刻把链根发成一份**与令牌
分离**的派活授权（:mod:`mate_tech_agent_team.delegation`）写进状态，续跑时读回来。
没有它，进程重启后那一轮就永远停"等人授权"——因为它根本没有链根可用。
"""

from __future__ import annotations

import time
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass, field
from typing import Any, Protocol
from uuid import uuid4

from langgraph.checkpoint.base import BaseCheckpointSaver

from .approval_gate import (
    PENDING,
    ApprovalGate,
    GateOutcome,
    evaluate_gate,
    record_decision,
)
from .artifact_store import ArtifactStore
from .audit import AUDIT_APPROVAL, AUDIT_DELEGATION, AuditSink
from .authority import (
    AUTHORITY_POLICY_VERSION,
    Envelope,
    actor_of,
    resolve_initiator_envelope,
)
from .checkpoint import thread_id_for
from .delegated_identity import DelegationIssuer, UnconfiguredIssuer
from .delegation import DELEGATION_STATE_KEY, RunDelegation, configured_ttl
from .graph import build_brain_graph
from .observability import SPAN_APPROVAL, Correlation, SpanRecorder, emit
from .planner import Planner
from .retry import RetryPolicy
from .runtime import EmployeeRuntime
from .state import BrainState
from .team_bus import TeamBus
from .versioning import (
    AGENT_RUNTIME_VERSION,
    CHECKPOINT_CODEC_VERSION,
    GRAPH_DEFINITION_VERSION,
    STATE_SCHEMA_VERSION,
)


@dataclass(frozen=True, slots=True)
class RunContext:
    """一次运行的调用方上下文（**不含**会话状态，只是当次授权）。

    ``initiator_envelope`` 是 ADR-0066 §3.3 的**链根**：派活的每一层都对着它
    比，而不是对着"父 agent 当时拿到了什么"比。它由发起用户的令牌解析而来
    （续跑时由那一轮的派活授权还原，见 :meth:`BrainService._context_from_delegation`），
    本身**不进图状态**——进状态的是那份不带凭据的授权。

    ``actor`` 是发起用户的标识（令牌 ``sub``），**只用于审计行**（硬规则 #9）。
    """

    tenant_id: str
    user_token: str = ""
    initiator_envelope: Envelope = field(default_factory=Envelope)
    actor: str = ""
    #: 续跑时 `user_token` 的来源（A-2 / ADR-0067）。空 = 不是委托来的。
    delegation_source: str = ""
    #: 没签出委托令牌时的**原因**（N4：签不出就不假装，但要说得出为什么）。
    delegation_reason: str = ""


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

#: 已经受理、还没有任何节点落过结论时的状态（1.7 任务 1）。受理回执给的就是
#: 它——"这一轮开始了"，而不是"这一轮有结果了"。
RUNNING = "running"

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
        audit: AuditSink | None = None,
        retry_policy: RetryPolicy | None = None,
        delegation_issuer: DelegationIssuer | None = None,
        recorder: SpanRecorder | None = None,
    ) -> None:
        self._planner_for = planner_for
        self._runtime_for = runtime_for
        self._checkpointer = checkpointer
        #: C-7 观测记录器。**默认 ``None`` = 不记**：既有 500+ 用例不注入它，
        #: 行为因此与加这一批之前逐字一致（观测只加记录，不改任何判定）。
        self._recorder = recorder
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
        self.audit: AuditSink = audit if audit is not None else team_bus.audit
        #: 运行期委托身份的签发面（A-2 / ADR-0067）。**默认是"不签发"**——
        #: 没配 token exchange 的部署，续跑行为与 2.0 逐字一致（没有用户身份），
        #: 而不是偷偷退回服务身份。
        self._delegation_issuer: DelegationIssuer = delegation_issuer or UnconfiguredIssuer()

    def _config(self, tenant_id: str, run_id: str) -> dict:
        return {"configurable": {"thread_id": thread_id_for(tenant_id, run_id)}}

    async def _graph_for(
        self,
        saver: BaseCheckpointSaver,
        ctx: RunContext,
        max_parallel: int,
        should_cancel: Callable[[], Awaitable[bool]] | None = None,
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
            recorder=self._recorder,
        )

    async def start(
        self,
        *,
        tenant_id: str,
        goal: str,
        user_token: str = "",
        max_parallel: int | None = None,
        run_id: str | None = None,
        should_cancel: Callable[[], Awaitable[bool]] | None = None,
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

        **链根在这一刻发成一份授权写进状态**（1.9 任务 1）：续跑要能真跑就得有
        链根，而令牌不落库，所以落地的必须是**与令牌分离**的那一份（只有包络
        四维与它的归属，没有凭据）。无令牌起的那一轮发的是一份空包络授权——
        与"没有授权"完全等价。
        """
        run_id = run_id or uuid4().hex
        cfg = self._config(tenant_id, run_id)
        ctx = self._context(tenant_id=tenant_id, user_token=user_token)
        parallel = max_parallel or self._max_parallel
        timeout = max(timeout_seconds, 0.0)
        deadline_at = time.time() + timeout if timeout > 0 else 0.0
        delegation = RunDelegation.issue(
            run_id=run_id,
            envelope=ctx.initiator_envelope,
            granted_by=ctx.actor,
            ttl=configured_ttl(),
            # A-2：快照自己要说得出"这是谁的、按哪一版口径判的、什么时候签的"。
            tenant_id=tenant_id,
            policy_version=AUTHORITY_POLICY_VERSION,
        )
        async with self._checkpointer.for_tenant(tenant_id) as saver:  # type: ignore[attr-defined]
            graph = await self._graph_for(saver, ctx, parallel, should_cancel)
            out = await graph.ainvoke(
                {
                    "run_id": run_id,
                    "tenant_id": tenant_id,
                    "goal": goal,
                    # 受理的那一刻起这一轮就已经在跑了（1.7 任务 1）：先落一个
                    # ``running``，别让"已受理"和"查不到"之间有个空窗期。
                    "status": RUNNING,
                    # C-7：这一轮的观测关联键。**随状态落检查点**，所以续跑/多副本
                    # 写下的 span 与最初那几波用的是同一个 trace。
                    "trace_id": uuid4().hex,
                    "timeout_seconds": timeout,
                    "deadline_at": deadline_at,
                    DELEGATION_STATE_KEY: delegation.as_state(),
                    # A-6：这一轮是按哪一版写下的。四个版本随 run 落进检查点，
                    # 于是"这份状态该用什么读法"从状态自身读得出来。
                    "state_schema_version": STATE_SCHEMA_VERSION,
                    "graph_definition_version": GRAPH_DEFINITION_VERSION,
                    "agent_runtime_version": AGENT_RUNTIME_VERSION,
                    "checkpoint_codec_version": CHECKPOINT_CODEC_VERSION,
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

    async def _context_from_delegation(
        self,
        *,
        tenant_id: str,
        state: dict,
        run_id: str,
        now: float | None = None,
    ) -> RunContext:
        """**续跑**用的调用方上下文：链根取自这一轮自己的派活授权（1.9 任务 1）。

        与 :meth:`_context` 的区别只在链根从哪儿来：那条要令牌，这条要**本轮
        状态里那份授权**——重启之后没有令牌可用，只有它。

        三条判定，任一不成立就走空包络（fail-closed，与 :meth:`_context` 收到
        没有令牌时同一条路）：

        * 状态里没有这一项 / 形态认不出来（老检查点、被改坏的值）；
        * 授权不是发给**这一轮**的（``authorizes`` 里比 ``run_id``）——这是
          "不能跨 run 复用"落到实处的地方；
        * 授权过期了。

        **A-2 追加**：链根成立之后，再向 :class:`DelegationIssuer` 要一份**per-run
        短期委托令牌**，把它放进 ``user_token``——于是续跑时 llmgw / MCP 拿到的是
        **发起用户的身份**，而不是服务身份。签发不走（未配置 / 换不到 / 换回的权限
        超出快照 / 权限已被撤空）时，``user_token`` 保持空并带上 ``delegation_reason``
        ——**绝不退回服务身份**（ADR-0067 N4）。这一步同时是 N3 的落点：每次续跑都
        现签一次，所以权限撤销当场生效。
        """
        state = state or {}
        delegation = RunDelegation.of_state(state.get(DELEGATION_STATE_KEY))
        if delegation is None or not delegation.authorizes(run_id, now=now):
            return self._context(tenant_id=tenant_id)

        outcome = await self._delegation_issuer.issue(delegation, now=now)
        credential = outcome.credential
        return RunContext(
            tenant_id=tenant_id,
            user_token=credential.token if credential is not None else "",
            initiator_envelope=delegation.envelope,
            actor=delegation.granted_by,
            delegation_source=credential.source if credential is not None else "",
            delegation_reason="" if credential is not None else outcome.reason,
        )

    async def resume(
        self,
        *,
        tenant_id: str,
        run_id: str,
        approved: bool = True,
        user_token: str = "",
        should_cancel: Callable[[], Awaitable[bool]] | None = None,
        approver_roles: Sequence[str] = (),
        comment: str = "",
    ) -> BrainState:
        """对闸门做一次**审批决定**，够了就续跑。已完成的节点不会被重跑（D-6）。

        B-6 起这里不再只是"翻一个布尔"：它把决定记进闸门（``decisions``）、
        重新评估协议，然后按结论分三路走——

        * ``approved``（所有层级凑齐）→ 写 ``approved=True``，图从检查点续跑；
        * ``rejected``（任何人驳回，终局）→ 写 ``approved=False``，图落 ``failed``；
        * **仍 ``pending```（会签还差人 / 多级还差一层）→ **只把闸门写回去，
          图不动**。这一轮继续停在等人，而不是被一次不完整的同意推下去。

        超时不在这里裁决（``expired``）：它由读路径按 ``deadline_at`` 落 ``timeout``
        ——与运行级超时是同一个事实，不该有两处各自计时。

        续跑也是"执行中的 run"（有请求在等它），所以同样把取消标志交给图。
        """
        cfg = self._config(tenant_id, run_id)
        ctx = self._context(tenant_id=tenant_id, user_token=user_token)
        gate_now: ApprovalGate | None = None
        outcome: GateOutcome | None = None
        async with self._checkpointer.for_tenant(tenant_id) as saver:  # type: ignore[attr-defined]
            graph = await self._graph_for(saver, ctx, self._max_parallel, should_cancel)
            snapshot = await graph.aget_state(cfg)
            if not snapshot.values:
                raise RunNotFound(run_id)
            if snapshot.values.get("status") != AWAITING:
                raise RunNotAwaitingApproval(run_id)

            gate = ApprovalGate.from_dict(snapshot.values.get("approval_gate"))
            if gate is None:
                # 老检查点（B-6 之前落的）没有闸门协议——退回单布尔语义，
                # 与加这一条之前**逐字一致**。
                await graph.aupdate_state(cfg, {"approved": approved}, as_node="gate")
                out = await graph.ainvoke(None, cfg)
            else:
                gate_now = record_decision(
                    gate,
                    actor=ctx.actor,
                    roles=tuple(approver_roles),
                    approved=approved,
                    comment=comment,
                )
                outcome = evaluate_gate(gate_now, now=time.time())
                if outcome.state == PENDING:
                    # 不够。**只写闸门，不推图**——继续停在闸门上等人。
                    await graph.aupdate_state(cfg, {"approval_gate": gate_now.to_dict()})
                    # 回读一次而不是回 ``snapshot.values``：后者是**写之前**的快照，
                    # 回给调用方的决定列表会是空的（"我明明批了，回执说没人批"）。
                    refreshed = await graph.aget_state(cfg)
                    out = refreshed.values or snapshot.values
                else:
                    await graph.aupdate_state(
                        cfg,
                        {"approval_gate": gate_now.to_dict(), "approved": outcome.satisfied},
                        as_node="gate",
                    )
                    out = await graph.ainvoke(None, cfg)

        if outcome is not None and outcome.state == PENDING:
            # 一次"还没批完"的同意**不是**一次审批——不落审计行（与 409 同理）。
            return dict(out)

        # 审批落审计行（硬规则 #9）：谁批的、批的是哪一轮、批还是驳。
        # 记在**闸门真的动了之后**——被 409 挡下的确认不是一次审批。
        await self.audit.append(
            action=AUDIT_APPROVAL,
            tenant_id=tenant_id,
            actor=ctx.actor,
            run_id=run_id,
            outcome="approved" if approved else "rejected",
            decision="approved" if approved else "rejected",
            approver_id=ctx.actor,
            policy_version=AUTHORITY_POLICY_VERSION,
            detail={
                "scope": "run",
                "level": gate_now.gate_type if gate_now is not None else "plan_gate",
                # B-6：把闸门的结论一并记下——审批中心只看审计也能答"还差几级"。
                "gate": outcome.to_dict() if outcome is not None else {},
                "comment": comment,
            },
        )
        # C-7：闸门的**决定**也留一条 span（``gate`` 节点那条记的是"闸门建起来了"）。
        # 一条记录只有 tenant/run/trace 三个键——审批是 run 级的动作，没有子任务。
        emit(
            self._recorder,
            SPAN_APPROVAL,
            correlation=Correlation(
                tenant_id=tenant_id, run_id=run_id, trace_id=str(out.get("trace_id") or "")
            ),
            name=gate_now.gate_type if gate_now is not None else "plan_gate",
            status="approved" if approved else "rejected",
            attributes={
                "gateType": gate_now.gate_type if gate_now is not None else "plan_gate",
                "roles": list(approver_roles),
                "gateState": outcome.state if outcome is not None else "",
            },
        )
        return dict(out)

    async def _audit_delegation(self, *, tenant_id: str, run_id: str, ctx: RunContext) -> None:
        """续跑时那次委托的签发结果落一行（硬规则 #9 / ADR-0067 §8）。

        **只在这一轮真的续跑时记**（终态的 run 在上面就返回了）——否则每次扫描
        恢复都给已经跑完的 run 记一行，账本会被噪声淹掉。

        没走委托的那条路（没有授权 / 授权不成立）不记：那不是一次"签发被拒"，
        而是**根本没有签发这一步**。
        """
        if not ctx.delegation_source and not ctx.delegation_reason:
            return
        issued = bool(ctx.user_token)
        await self.audit.append(
            action=AUDIT_DELEGATION,
            tenant_id=tenant_id,
            actor=ctx.actor,
            run_id=run_id,
            outcome="issued" if issued else "denied",
            decision="issued" if issued else "denied",
            policy_version=AUTHORITY_POLICY_VERSION,
            # 细节里**没有令牌**（N1 在审计这一侧的落点）。
            detail={"source": ctx.delegation_source, "reason": ctx.delegation_reason},
        )

    async def continue_run(
        self,
        *,
        tenant_id: str,
        run_id: str,
        should_cancel: Callable[[], Awaitable[bool]] | None = None,
    ) -> BrainState:
        """从**检查点**接着跑一轮没跑完的 run（1.8 轨 1）。

        与 :meth:`resume` 的区别只有一处：``resume`` 是**人确认之后**的续跑，
        要 ``awaiting_approval`` 这道前置；这里是**进程重启之后**的续跑，
        没有人在场，也不该改状态——它只是把图从它自己停下的地方推下去。

        **必须是 ``ainvoke(None, cfg)``**：实跑确认过，``None`` 才是"从检查点
        续跑"（已完成的节点一个都不重跑）；换成重投一份输入，langgraph 会把它
        当成新一轮从 START 重来——``plan`` 重跑、``results`` 被清空，那就不是
        "接着跑"而是"从头再跑一遍"了。

        已经是终态的 run **原样返回**，不动它：续跑只治"卡住"，不治"跑完了"。

        **链根来自这一轮自己的派活授权**（1.9 任务 1）：没有它，重启后续跑那一波
        会因为包络为空而 fail-closed 转成待授权提案——那一轮就永远跑不完。授权
        读不出来（老检查点 / 形态认不出 / 不是发给这一轮的 / 已过期）时退回空包络，
        与"没有令牌"完全一样，不会退化成"默认全给"。
        """
        cfg = self._config(tenant_id, run_id)
        async with self._checkpointer.for_tenant(tenant_id) as saver:  # type: ignore[attr-defined]
            # 先读一份状态值：**图是拿 ctx 建的，而 ctx 要从状态里读**——顺序上
            # 只能先读后建（``aget_tuple`` 是检查点器的公开读法，不建图）。
            stored = await self._stored_state(saver, tenant_id=tenant_id, run_id=run_id)
            ctx = await self._context_from_delegation(
                tenant_id=tenant_id, state=stored, run_id=run_id
            )
            graph = await self._graph_for(saver, ctx, self._max_parallel, should_cancel)
            snapshot = await graph.aget_state(cfg)
            if not snapshot.values:
                raise RunNotFound(run_id)
            if str(snapshot.values.get("status", "")) in TERMINAL_STATUSES:
                return dict(snapshot.values)
            await self._audit_delegation(tenant_id=tenant_id, run_id=run_id, ctx=ctx)
            out = await graph.ainvoke(None, cfg)
        return dict(out)

    async def _stored_state(
        self, saver: BaseCheckpointSaver, *, tenant_id: str, run_id: str
    ) -> dict:
        """检查点里**最新那一份**状态值（不建图、不推进）。

        ``channel_values`` 就是状态值的所在——``checkpoint.py`` 的启动扫描读的是
        同一处（那边走 SQL，这边走 langgraph 的公开读法 ``aget_tuple``）。
        """
        tup = await saver.aget_tuple(self._config(tenant_id, run_id))
        if tup is None:
            return {}
        return dict((tup.checkpoint or {}).get("channel_values") or {})

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
    async def mark_terminal(
        self, *, tenant_id: str, run_id: str, status: str, error: str = ""
    ) -> BrainState:
        """把 run 置为终态（取消 / 超时 / 后台跑挂）。

        **写进检查点**而不是只在控制面记一份：``GET /runs/{id}`` 读的就是检查点，
        另记一份等于两个真相，重启/多副本立刻互相打脸。已经是终态时原样返回
        （幂等），不覆盖更早的终态。

        ``error`` 给"后台跑挂了"这类终态带上错因（1.7 任务 1）：受理制把执行挪出
        了请求，失败必须能在 ``GET /runs/{id}`` 里看出来，否则读的人只知道它结束了，
        不知道它为什么结束。
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
            patch: dict = {"status": status}
            # 只在给了错因时才写 error：取消/超时不该把状态里已有的错因抹掉。
            if error:
                patch["error"] = error
            await graph.aupdate_state(cfg, patch)
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
    "RUNNING",
    "TERMINAL_STATUSES",
    "BrainService",
    "CheckpointerProvider",
    "PlannerFactory",
    "RunContext",
    "RunNotFound",
    "RunNotAwaitingApproval",
    "RuntimeFactory",
]
