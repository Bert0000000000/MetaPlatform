"""任务拆解（"一句话 → 任务图"）。

1.0 只做**一层并行**：把一个目标拆成 N ≥ 2 个互不依赖的子任务。
1.8 轨 3 加了**同一轮内的有界重规划**：一波跑完之后，具备该能力的拆解器可以
按**已经产出的回执**再补一批子任务（见 :class:`Replanner`）。

真实拆解由 :mod:`mate_tech_agent_team.llm_planner` 走模型完成；
本模块只放协议与确定性实现（测试与无模型环境用）。
"""

from __future__ import annotations

from typing import Protocol

from .state import SubTask, SubTaskResult


class PlanError(ValueError):
    """拆解失败（模型没给出可用的任务图）。"""


class Planner(Protocol):
    """把一句话拆成可并行的子任务清单。"""

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        """返回 ≥2 个子任务；不足 2 个视为无法并行拆解。

        ``tenant_id`` 是必需的：真实拆解要调模型，而模型走哪家 provider
        是**租户配置**（llmgw 按 X-Tenant-Id 取），不是进程级常量。
        """
        ...


class Replanner(Protocol):
    """**再规划**：看着已经产出的回执，决定还差不差活（1.8 轨 3）。

    ``results`` 是这一轮到目前为止的回执（键是计划内标签 ``t1``/``t2``…）。
    返回要补的子任务；**空气组就是"够了"**——不是失败，是收工。

    与 :class:`Planner` 分成两个协议，是因为它们是**两种能力**：能拆一句话不等于
    会看结果再拆。图按 ``getattr(planner, "replan", None)`` 探测，没有这个能力的
    拆解器（以及所有既有实现）行为一个字都不变。

    ``round_index`` 是**刚跑完**的那一轮（首轮 = 1）。它的用处是给提示词一个
    "这是第几次"的锚，而不是让实现自己数——数在实现里就又多了一份状态。
    """

    async def replan(
        self,
        *,
        goal: str,
        results: dict[str, SubTaskResult],
        round_index: int,
        max_parallel: int,
        tenant_id: str,
    ) -> list[SubTask]: ...


class StaticPlanner:
    """确定性拆解：把目标拆成"分析/核对/补充"三类角度，供测试与离线演示。"""

    #: 三个角色各出一份产出，天然并行、互不依赖
    _ANGLES: tuple[tuple[str, str], ...] = (
        ("EMP-ANALYST", "从数据角度分析：{goal}"),
        ("EMP-AUDITOR", "从核对角度复核：{goal}"),
        ("EMP-RESEARCHER", "从背景角度补充：{goal}"),
    )

    async def plan(self, *, goal: str, max_parallel: int, tenant_id: str) -> list[SubTask]:
        del tenant_id
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

    async def replan(
        self,
        *,
        goal: str,
        results: dict[str, SubTaskResult],
        round_index: int,
        max_parallel: int,
        tenant_id: str,
    ) -> list[SubTask]:
        """确定性拆解器**没有**再规划的能力，如实回空。

        刻意不编出活来：一个"总能再补一件"的确定性实现会让每一轮都多跑一波，
        把测试变成"能不能停机"的证明，而不是"该不该再规划"的证明。
        """
        del goal, results, round_index, max_parallel, tenant_id
        return []


__all__ = ["PlanError", "Planner", "Replanner", "StaticPlanner"]
