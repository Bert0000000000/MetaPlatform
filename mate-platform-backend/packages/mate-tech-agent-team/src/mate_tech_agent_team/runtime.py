"""数字员工运行时协议（决策 D-8 / D-10）。

员工身份 = **提示词 + 技能清单 + 工具白名单**（D-8）。
运行时负责把一份子任务真正跑完——**调模型、调工具**，而不是把原话抄回去
（D-10：现状里"派活返回假回执"是必须被治掉的病）。

本模块只放协议；真实实现见 :mod:`mate_tech_agent_team.employee`。
"""

from __future__ import annotations

from typing import Any, Protocol

from .state import SubTask, SubTaskResult


class EmployeeRuntime(Protocol):
    """跑一个数字员工的一轮工作。"""

    async def run(self, *, subtask: SubTask, tenant_id: str) -> SubTaskResult:
        """执行子任务并返回回执。

        实现必须保证回执里的 ``source`` 如实标注产出是模型给的（``llm``）
        还是未接线的占位（``stub``）——调用方据此断言"真实执行"。
        """
        ...


class TaskChannel(Protocol):
    """一次员工运行的**实例层**通道：建行、取信箱、收尾。

    "追问正在干活的员工"要能投递，前提是这次运行在 ``team_task`` 里**有行**；
    没有行，``send`` 只会 404。所以运行开始时登记、每轮边界取走消息、
    结束时置终态，三件事由同一个对象承担。

    :class:`~mate_tech_agent_team.team_bus.TeamBus` 结构上就满足它——
    协议里刻意只有这三个动作，不含任何框架类型（ADR-0066 R10）。
    """

    async def start(self, *, task_id: str, tenant_id: str, profile_id: str = "") -> Any: ...

    async def consume_inbox(self, *, task_id: str, tenant_id: str) -> list[Any]: ...

    async def finish(self, *, task_id: str, tenant_id: str, status: str) -> None: ...


__all__ = ["EmployeeRuntime", "TaskChannel"]
