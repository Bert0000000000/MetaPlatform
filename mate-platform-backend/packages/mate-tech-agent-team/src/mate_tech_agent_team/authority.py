"""权限包络（Authority Envelope，ADR-0066 §3.3）。

包络是**四类集合的并**——``(tools, action_rids, kb_ids, markings)``。子集检查
因此就是集合运算，不需要另起一套判定。

不变量（能力衰减）：

```
用户权限包络  ⊇  子 agent 包络
```

链的**根是发起用户**，不是父 agent：SuperAI 只是代用户行事，不是超级用户。
所以 :class:`~mate_tech_agent_team.team_bus.TeamBus` 一律拿
``initiator_envelope`` 当天花板，父 agent 手里有没有更大的包络**不影响判定**。

「身份」与「包络」是两条正交轴（§3.3）：身份（prompt / skill 引用）低风险、
默认免审；包络（能碰什么）高风险、**扩张才审**。
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, replace
from typing import Any

#: 包络四维的固定顺序 —— 越权报告按此顺序出，便于断言与审计阅读。
DIMENSIONS: tuple[str, ...] = ("tools", "action_rids", "kb_ids", "markings")


class AuthorityError(Exception):
    """派活闸门拒绝。"""


class DepthExceeded(AuthorityError):
    """嵌套层数超过 ``max_depth``（1.1 任务 5）。"""

    def __init__(self, depth: int, max_depth: int) -> None:
        self.depth = depth
        self.max_depth = max_depth
        super().__init__(f"派活深度 {depth} 超过上限 {max_depth}")


@dataclass(frozen=True, slots=True)
class Envelope:
    """一个调用方能碰的东西。空包络 = 什么都碰不了（fail-closed）。"""

    tools: frozenset[str] = frozenset()
    action_rids: frozenset[str] = frozenset()
    kb_ids: frozenset[str] = frozenset()
    markings: frozenset[str] = frozenset()

    @classmethod
    def of(cls, profile: Any) -> Envelope:
        """从员工定义取包络（``EmployeeProfile.envelope()`` 的逆向）。"""
        tools, action_rids, kb_ids, markings = profile.envelope()
        return cls(tools=tools, action_rids=action_rids, kb_ids=kb_ids, markings=markings)

    def dimension(self, name: str) -> frozenset[str]:
        return getattr(self, name)

    def escalations_over(self, ceiling: Envelope) -> tuple[str, ...]:
        """哪些维度**超出**了天花板。空元组 = 只收窄或持平。"""
        return tuple(
            name for name in DIMENSIONS if not self.dimension(name) <= ceiling.dimension(name)
        )

    def is_subset_of(self, ceiling: Envelope) -> bool:
        """``self ⊆ ceiling``——等于天花板也算，不是真子集。"""
        return not self.escalations_over(ceiling)

    def narrow_tools(self, requested: Sequence[str] | None) -> Envelope:
        """按调用方给的 ``tool_scope`` 收窄工具面。

        收窄是**交集**：写进一个上级没有的工具不会因此拿到它——这正是
        「只能收窄，不能扩」的实现方式（ADR-0066 §5.2）。
        """
        if not requested:
            return self
        return replace(self, tools=self.tools & frozenset(requested))


__all__ = ["DIMENSIONS", "AuthorityError", "DepthExceeded", "Envelope"]
