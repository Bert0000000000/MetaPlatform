"""任务拆解（"一句话 → 任务图"）。

1.0 只做**一层并行**：把一个目标拆成 N ≥ 2 个互不依赖的子任务。
不做回环、不做嵌套子图、不做动态图（见 1.0 边界）。

真实拆解由 :mod:`mate_tech_agent_team.llm_planner` 走模型完成；
本模块只放协议与确定性实现（测试与无模型环境用）。
"""

from __future__ import annotations

from typing import Protocol

from .state import SubTask


class Planner(Protocol):
    """把一句话拆成可并行的子任务清单。"""

    def plan(self, *, goal: str, max_parallel: int) -> list[SubTask]:
        """返回 ≥2 个子任务；不足 2 个视为无法并行拆解。"""
        ...


class StaticPlanner:
    """确定性拆解：把目标拆成"分析/核对/汇总"三类角度，供测试与离线演示。"""

    #: 三个角色各出一份产出，天然并行、互不依赖
    _ANGLES: tuple[tuple[str, str], ...] = (
        ("EMP-ANALYST", "从数据角度分析：{goal}"),
        ("EMP-AUDITOR", "从核对角度复核：{goal}"),
        ("EMP-RESEARCHER", "从背景角度补充：{goal}"),
    )

    def plan(self, *, goal: str, max_parallel: int) -> list[SubTask]:
        count = max(2, min(max_parallel, len(self._ANGLES)))
        return [
            SubTask(
                task_id=f"t{idx + 1}",
                profile_id=profile_id,
                instruction=template.format(goal=goal),
                depends_on=[],
            )
            for idx, (profile_id, template) in enumerate(self._ANGLES[:count])
        ]


__all__ = ["Planner", "StaticPlanner"]
