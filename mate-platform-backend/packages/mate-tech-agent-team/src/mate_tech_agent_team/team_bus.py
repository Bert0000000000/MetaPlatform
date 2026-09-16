"""派活闸门：权限包络衰减（任务 4）+ 深度闸门（任务 5）。

这是本仓**唯一的安全关键路径**：子员工的权限包络必须 ⊆ 发起用户的包络，
且嵌套层数有上限。两条都在**派活入口**判定——子员工自己拿不到的授权，
不能靠"它没申请"来保证。

审批档位（ADR-0066 §3.4 / R5）：

* **不扩权即免审** —— 收窄或持平的派活直接放行，**不产生 proposal**；
* **扩权才审** —— 逐维报出越权维度，落成 proposal 交人审，**授权只作用于
  本次任务**，不是 blanket grant，也不写回员工定义（库里的 profile 一个字节
  都不动）。

为什么越权选「转 proposal」而不是「403」：D-4 把本仓「AI 输出 = proposal」的
哲学精确化为「**扩权才 proposal**」。403 会把"需要授权"与"根本不允许"混成
同一种失败——前者用户点一下同意就能继续，后者点多少次都没用。真正"根本不允许"
的是另外两类，它们仍走硬拒：

* 深度超限 → :class:`~mate_tech_agent_team.authority.DepthExceeded`
* 跨租户（profile 在该租户下不存在）→ ``ProfileNotFound``
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from .authority import DepthExceeded, Envelope

DEFAULT_MAX_DEPTH = 3

#: 空包络：未获批准前，子任务什么都碰不了（fail-closed）。
_NO_AUTHORITY = Envelope()


@dataclass(frozen=True, slots=True)
class SpawnRequest:
    """一次派活请求。

    ``depth`` 是**子任务自己的层号**：根任务 0、它的子员工 1，依此类推。
    ``initiator_envelope`` 是链根（发起用户）的包络——不是父 agent 的。
    """

    tenant_id: str
    profile_id: str
    initiator_envelope: Envelope
    instruction: str
    tool_scope: tuple[str, ...] = ()
    depth: int = 1
    parent_task_id: str | None = None


@dataclass(frozen=True, slots=True)
class SpawnOutcome:
    """派活结果。

    ``requires_approval=True`` 时 ``envelope`` 是空包络：**未批准就没有权限**，
    调用方不该拿它去执行任何东西。
    """

    task_id: str
    depth: int
    envelope: Envelope
    requires_approval: bool
    escalations: tuple[str, ...] = ()
    proposal: dict[str, Any] | None = None


@dataclass
class _TaskState:
    depth: int
    base_envelope: Envelope
    escalations: tuple[str, ...] = ()
    approved: bool = False
    proposal: dict[str, Any] | None = None


class TeamBus:
    """派活闸门 + 任务作用域的授权登记。

    授权登记在**内存**里、按 task_id 索引：授权随任务生灭，不落库、不写回员工
    定义。任务终态后由 sweep 回收（ADR-0066 F6）。
    """

    def __init__(
        self,
        *,
        registry: Any,
        max_depth: int = DEFAULT_MAX_DEPTH,
    ) -> None:
        if max_depth < 0:
            raise ValueError("max_depth 不得为负")
        self._registry = registry
        self.max_depth = max_depth
        self._tasks: dict[str, _TaskState] = {}

    # -- 判据 -------------------------------------------------------------
    async def spawn(self, request: SpawnRequest) -> SpawnOutcome:
        if not request.tenant_id:
            raise ValueError("派活必须带租户上下文（硬规则 3）")

        # 1. 深度闸门：先判，避免"深度超限"被包络报告掩盖成一次待审提案。
        if request.depth > self.max_depth:
            raise DepthExceeded(request.depth, self.max_depth)

        # 2. 员工必须在**该租户**的名册里（跨租户 = 不存在）。
        profile = await self._registry.get(request.profile_id, request.tenant_id)

        # 3. 包络：先按 tool_scope 收窄，再对**发起用户**的天花板比。
        child = Envelope.of(profile).narrow_tools(request.tool_scope)
        escalations = child.escalations_over(request.initiator_envelope)

        task_id = f"task-{uuid.uuid4().hex[:12]}"
        if not escalations:
            self._tasks[task_id] = _TaskState(
                depth=request.depth, base_envelope=child, approved=True
            )
            return SpawnOutcome(
                task_id=task_id,
                depth=request.depth,
                envelope=child,
                requires_approval=False,
            )

        proposal = {
            "kind": "authority_escalation",
            "task_id": task_id,
            "tenant_id": request.tenant_id,
            "profile_id": request.profile_id,
            "parent_task_id": request.parent_task_id,
            "escalations": list(escalations),
            # 授权只对本次任务生效，因此把范围写在提案里给人看清。
            "scope": "this_task_only",
            "requested": {
                name: sorted(child.dimension(name) - request.initiator_envelope.dimension(name))
                for name in escalations
            },
        }
        self._tasks[task_id] = _TaskState(
            depth=request.depth,
            base_envelope=child,
            escalations=escalations,
            proposal=proposal,
        )
        return SpawnOutcome(
            task_id=task_id,
            depth=request.depth,
            envelope=_NO_AUTHORITY,
            requires_approval=True,
            escalations=escalations,
            proposal=proposal,
        )

    # -- 授权登记（任务作用域）--------------------------------------------
    async def grant(self, task_id: str) -> None:
        """人审通过：把这次派活的包络放行。**只对这一个 task 生效。**"""
        state = self._tasks.get(task_id)
        if state is None:
            raise KeyError(f"未知任务：{task_id}")
        state.approved = True

    def revoke(self, task_id: str) -> None:
        state = self._tasks.get(task_id)
        if state is not None:
            state.approved = False

    def envelope_for(self, task_id: str) -> Envelope:
        """该任务当前**实际可用**的包络；未批准 = 空包络。"""
        state = self._tasks.get(task_id)
        if state is None or not state.approved:
            return _NO_AUTHORITY
        return state.base_envelope

    def task_ids(self) -> list[str]:
        return list(self._tasks)


__all__ = ["DEFAULT_MAX_DEPTH", "SpawnOutcome", "SpawnRequest", "TeamBus"]
