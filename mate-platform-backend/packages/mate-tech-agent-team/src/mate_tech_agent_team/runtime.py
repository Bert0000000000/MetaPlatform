"""数字员工运行时协议（决策 D-8 / D-10）。

员工身份 = **提示词 + 技能清单 + 工具白名单**（D-8）。
运行时负责把一份子任务真正跑完——**调模型、调工具**，而不是把原话抄回去
（D-10：现状里"派活返回假回执"是必须被治掉的病）。

本模块只放协议；真实实现见 :mod:`mate_tech_agent_team.employee`。
"""

from __future__ import annotations

from typing import Protocol

from .state import SubTask, SubTaskResult


class EmployeeRuntime(Protocol):
    """跑一个数字员工的一轮工作。"""

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        """执行子任务并返回回执。

        实现必须保证回执里的 ``source`` 如实标注产出是模型给的（``llm``）
        还是未接线的占位（``stub``）——调用方据此断言"真实执行"。
        """
        ...


__all__ = ["EmployeeRuntime"]
