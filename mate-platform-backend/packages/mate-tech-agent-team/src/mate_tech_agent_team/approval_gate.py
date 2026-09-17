"""HITL gate 的**统一协议**（B-6 / `MP-APPROVAL-GATE-ABI-01`）。

**为什么保留自定义 gate 而不是换原生 ``interrupt()``**（roadmap 的"二选一"）：

``interrupt()`` 会**重跑它所在的节点**。本项目要在"跑到闸门停住 → 人确认 → 继续"
之间保证**已完成节点的调用次数不变**（1.0 起反复立的判据，`graph.py` 的模块注释
写明了），所以暂停 = 让闸门条件边走到 END（图自然结束）、恢复 = 从检查点续跑。
换成 ``interrupt()`` 会把这个性质换掉——那不是本批该做的事。

**那"统一协议"要统一的是什么**：不是暂停恢复的机制，而是**闸门长什么样**。
在这之前，闸门只有"一个布尔 ``approved``"，谁也说不清"谁批的、还差几级、
什么时候过期"。别的图想加一种暂停就得自己发明一套字段——那正是 roadmap 里
"不能让每个图自己发明一种暂停恢复方式"要防的。

于是这里定义**一种**闸门：

```text
ApprovalGate
├─ gate_id / tenant_id / run_id / gate_type
├─ required_roles        有序 = 多级审批；空 = 单级、任意审批角色
├─ required_approvals    每一级需要的**不同审批人**数（>1 = 会签）
├─ payload / editable_fields
├─ expires_at
├─ decisions[]           actor / role / decision / comment / decided_at
└─ created_at
```

**可被统一审批中心消费**（平台计划的 `MP-APPROVAL-INBOX-01`）：它只需要
"列出所有 ``pending`` 的 gate"与"对某个 ``gate_id`` 做一次决定"这两件事，
两者都在这里——``gate_id`` 是**稳定地址**（同 run 同类型的闸门不会换 id），
所以审批中心不必理解本服务的图。

**三种能力各自怎么表达**（判据里点名要求至少两项，这里三项都有）：

| 能力 | 表达 |
| --- | --- |
| 多级审批 | ``required_roles`` 有序，逐级判；第 N 级凑不齐 → 仍是 ``pending`` |
| 会签 | ``required_approvals = N`` 且按 **actor 去重**（同一个人批两次算一次） |
| 超时 | ``expires_at``；到点仍是 ``pending`` → ``expired``，由调用方落终态 |

**纯函数**：:func:`evaluate_gate` 不认识数据库、不认识图，输入闸门与时刻、
输出结论。所有语义都在它里面，测试直接打它——不需要起图、不需要 PG。
"""

from __future__ import annotations

import time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field, replace
from typing import Any

#: 闸门类型。**不是**可扩展的自由字符串：新增一种要走这里 + 契约 + 用例，
#: 否则又回到"每个图自己发明一种"。
GATE_PLAN = "plan_gate"

#: 任意审批角色。用于"这一级不限定角色"。
ANY_ROLE = "*"

APPROVED = "approved"
REJECTED = "rejected"

#: 闸门自己的状态（``evaluate_gate`` 的输出）。
PENDING = "pending"
EXPIRED = "expired"


@dataclass(frozen=True, slots=True)
class GateDecision:
    """一次审批决定。

    ``actor`` 是**审批人标识**（去重按它）；``role`` 是这次决定**以哪个角色**
    作出的——多级审批就靠它归级。同一个人换了角色再批一次，在会签里**仍算一次**
    （去重按 actor），但会归到新角色那一级。
    """

    actor: str
    role: str = ""
    decision: str = APPROVED
    comment: str = ""
    decided_at: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "actor": self.actor,
            "role": self.role,
            "decision": self.decision,
            "comment": self.comment,
            "decided_at": self.decided_at,
        }


@dataclass(frozen=True, slots=True)
class ApprovalGate:
    """一个待批的闸门。**不可变**——加一条决定用 :func:`record_decision` 换一个新的。"""

    gate_id: str
    run_id: str
    tenant_id: str
    gate_type: str = GATE_PLAN
    #: **有序**的审批层级；空元组 = 单级、任意审批角色。
    required_roles: tuple[str, ...] = ()
    #: 每一级需要的**不同审批人**数。1 = 单人；>1 = 会签。
    required_approvals: int = 1
    payload: Mapping[str, Any] = field(default_factory=dict)
    editable_fields: tuple[str, ...] = ()
    expires_at: float = 0.0
    created_at: float = 0.0
    decisions: tuple[GateDecision, ...] = ()

    @property
    def levels(self) -> tuple[str, ...]:
        """实际的审批层级序列（空配置归一成"一级、任意角色"）。"""
        return self.required_roles or (ANY_ROLE,)

    def to_dict(self) -> dict[str, Any]:
        """**审批中心消费的形状**（契约里的 ``ApprovalGate`` 就是它）。"""
        return {
            "gate_id": self.gate_id,
            "run_id": self.run_id,
            "tenant_id": self.tenant_id,
            "gate_type": self.gate_type,
            "required_roles": list(self.required_roles),
            "required_approvals": self.required_approvals,
            "payload": dict(self.payload),
            "editable_fields": list(self.editable_fields),
            "expires_at": self.expires_at,
            "created_at": self.created_at,
            "decisions": [d.to_dict() for d in self.decisions],
        }

    @classmethod
    def from_dict(cls, raw: Mapping[str, Any] | None) -> ApprovalGate | None:
        """从（检查点里的）字典还原。**读不出来返回 None**，不猜。

        老检查点里没有这个键是正常情形（B-6 之前落的检查点），调用方按
        "没有闸门协议"处理——即退回单布尔审批的旧语义。
        """
        if not raw or not raw.get("gate_id"):
            return None
        return cls(
            gate_id=str(raw["gate_id"]),
            run_id=str(raw.get("run_id", "")),
            tenant_id=str(raw.get("tenant_id", "")),
            gate_type=str(raw.get("gate_type", GATE_PLAN)),
            required_roles=tuple(str(r) for r in (raw.get("required_roles") or ())),
            required_approvals=max(1, int(raw.get("required_approvals") or 1)),
            payload=dict(raw.get("payload") or {}),
            editable_fields=tuple(str(f) for f in (raw.get("editable_fields") or ())),
            expires_at=float(raw.get("expires_at") or 0.0),
            created_at=float(raw.get("created_at") or 0.0),
            decisions=tuple(_decision_from_dict(d) for d in (raw.get("decisions") or ())),
        )


def _decision_from_dict(raw: Mapping[str, Any]) -> GateDecision:
    return GateDecision(
        actor=str(raw.get("actor", "")),
        role=str(raw.get("role", "")),
        decision=str(raw.get("decision", APPROVED)),
        comment=str(raw.get("comment", "")),
        decided_at=float(raw.get("decided_at") or 0.0),
    )


@dataclass(frozen=True, slots=True)
class GateOutcome:
    """评估结论。``reason`` 是给人看的一句话，也是审计里那一格。"""

    state: str
    level_index: int = 0
    level_role: str = ""
    approvals_at_level: int = 0
    required_approvals: int = 1
    approvers: tuple[str, ...] = ()
    reason: str = ""

    @property
    def satisfied(self) -> bool:
        return self.state == APPROVED

    def to_dict(self) -> dict[str, Any]:
        return {
            "state": self.state,
            "level_index": self.level_index,
            "level_role": self.level_role,
            "approvals_at_level": self.approvals_at_level,
            "required_approvals": self.required_approvals,
            "approvers": list(self.approvers),
            "reason": self.reason,
        }


def _matches(decision: GateDecision, role: str) -> bool:
    """这条决定算不算进 ``role`` 那一级（``ANY_ROLE`` 那一级收所有人）。"""
    return role in (ANY_ROLE, decision.role)


def evaluate_gate(gate: ApprovalGate, *, now: float) -> GateOutcome:
    """闸门现在是什么状态（**纯函数**，语义全在这里）。

    判定顺序是有讲究的：

    1. **驳回是终局**——任何人驳回，闸门立即 ``rejected``，不再看还差几个同意。
       "会签"不该让一个明确的否被后面的同意冲淡。
    2. 逐级看同意数：凑不齐就停在这一级，报还差几个。**到点没凑齐 = ``expired``**
       ——超时不是"再等等"，它有明确后果（调用方据此落终态），所以在这里就判出来。
    3. 全部层级都凑齐 = ``approved``。
    """
    for decision in gate.decisions:
        if decision.decision == REJECTED:
            return GateOutcome(
                state=REJECTED,
                approvers=(decision.actor,),
                reason=f"{decision.actor} 驳回：{decision.comment or '（无说明）'}",
            )

    approvers: list[str] = []
    for index, role in enumerate(gate.levels):
        granted: list[str] = []
        for decision in gate.decisions:
            if decision.decision != APPROVED or not _matches(decision, role):
                continue
            if decision.actor not in granted:
                granted.append(decision.actor)
        if len(granted) < gate.required_approvals:
            if gate.expires_at and now >= gate.expires_at:
                return GateOutcome(
                    state=EXPIRED,
                    level_index=index,
                    level_role=role,
                    approvals_at_level=len(granted),
                    required_approvals=gate.required_approvals,
                    approvers=tuple(approvers),
                    reason=(
                        f"第 {index + 1} 级（{role}）凑到 {len(granted)}/"
                        f"{gate.required_approvals} 时已过期"
                    ),
                )
            return GateOutcome(
                state=PENDING,
                level_index=index,
                level_role=role,
                approvals_at_level=len(granted),
                required_approvals=gate.required_approvals,
                approvers=tuple(approvers),
                reason=(
                    f"第 {index + 1} 级（{role}）还差 "
                    f"{gate.required_approvals - len(granted)} 个同意"
                ),
            )
        approvers.extend(granted)

    return GateOutcome(
        state=APPROVED,
        level_index=len(gate.levels) - 1,
        level_role=gate.levels[-1],
        approvals_at_level=gate.required_approvals,
        required_approvals=gate.required_approvals,
        approvers=tuple(approvers),
        reason="全部审批层级已满足",
    )


def record_decision(
    gate: ApprovalGate,
    *,
    actor: str,
    roles: Sequence[str] = (),
    approved: bool = True,
    comment: str = "",
    now: float | None = None,
) -> ApprovalGate:
    """记一条决定，返回**新的**闸门。

    ``roles`` 是审批人**实际持有的**角色（来自令牌），不是他自称的：这里挑
    **第一个能归到某一级的**角色填进去。一个都归不上时填空串——那样它只能算进
    ``ANY_ROLE`` 那一级，不会冒充成一个它并不持有的角色。

    同一个人重复决定：**后一次覆盖前一次**（他改主意了）。会签的去重按 actor，
    所以重复决定不会把票数刷上去。
    """
    stamp = time.time() if now is None else now
    decision = GateDecision(
        actor=actor,
        role=_resolve_role(gate, roles),
        decision=APPROVED if approved else REJECTED,
        comment=comment,
        decided_at=stamp,
    )
    kept = tuple(d for d in gate.decisions if d.actor != actor)
    return replace(gate, decisions=(*kept, decision))


def _resolve_role(gate: ApprovalGate, roles: Sequence[str]) -> str:
    """这次决定该归到哪一级：取**第一个命中具体层级的**持有角色。

    具体层级优先于 ``ANY_ROLE``（兜底的那一级不该抢在它前面）。一个具体层级都
    对不上时：闸门只有"任意角色"一级 → 记下第一个持有角色（它仍是**令牌里签出来
    的**，只是闸门不按它归级）；否则记空串——**绝不冒充**一个他并不持有的角色。
    """
    concrete = tuple(level for level in gate.levels if level != ANY_ROLE)
    for candidate in roles:
        if candidate in concrete:
            return candidate
    if not concrete and roles:
        return roles[0]
    return ""


def new_gate_id(*, run_id: str, gate_type: str = GATE_PLAN) -> str:
    """闸门的**稳定地址**。

    同 run 同类型永远是同一个 id —— "再批一次"要落到同一个闸门上，而不是建出
    第二个。这也是审批中心能把它当主键用的原因。
    """
    return f"{run_id}:{gate_type}"


__all__ = [
    "APPROVED",
    "ANY_ROLE",
    "EXPIRED",
    "GATE_PLAN",
    "PENDING",
    "REJECTED",
    "ApprovalGate",
    "GateDecision",
    "GateOutcome",
    "evaluate_gate",
    "new_gate_id",
    "record_decision",
]
