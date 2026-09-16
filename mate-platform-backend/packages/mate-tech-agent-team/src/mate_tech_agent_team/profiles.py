"""数字员工身份（决策 D-8）。

**身份 = 提示词 + 技能清单 + 工具白名单**——三样凑齐才是一个员工。
本模块只描述"它是谁、它能干什么"，不含"怎么跑"（那是 :mod:`.employee`）。

提示词单一数据源沿用 ADR-0028：没有显式 ``system_prompt`` 时回落 kernel 的
``SYSTEM_PROMPTS[base_role]``。
"""

from __future__ import annotations

import os
from dataclasses import dataclass

DEFAULT_MODEL = os.getenv("MATE_AGENT_TEAM_MODEL", "glm-5.3-flash")


class ProfileNotFound(LookupError):
    """该租户下没有这个员工。"""


@dataclass(frozen=True, slots=True)
class EmployeeProfile:
    """一个数字员工的**定义**（不是一次运行）。"""

    profile_id: str
    name: str
    base_role: str
    system_prompt: str
    skills: tuple[str, ...] = ()
    tools: tuple[str, ...] = ()
    model: str = DEFAULT_MODEL

    def allows(self, tool_name: str) -> bool:
        """工具白名单判定（D-8）。白名单是**闭集**：未列出即拒绝。"""
        return tool_name in self.tools


#: 只读的本体工具面。**只列本服务真的能供的**——把工具写进白名单却没接上，
#: 模型一旦选中就变成一次 500，比不给它更糟。
_ONT_READ_TOOLS: tuple[str, ...] = (
    "ont_list_classes",
    "ont_inspect_class",
    "ont_object_query",
)

_SKILL_TOOLS: tuple[str, ...] = ("search_skill", "read_skill")


class ProfileRegistry:
    """员工名册。1.0 为进程内的声明式名册（DB 化在 ADR-0066 S0，不在本轮）。"""

    def __init__(self, profiles: list[EmployeeProfile]) -> None:
        self._by_id = {p.profile_id: p for p in profiles}
        if len(self._by_id) != len(profiles):
            raise ValueError("员工名册里存在重复的 profile_id")

    def get(self, profile_id: str) -> EmployeeProfile:
        try:
            return self._by_id[profile_id]
        except KeyError as exc:
            raise ProfileNotFound(profile_id) from exc

    def list(self) -> list[EmployeeProfile]:
        return list(self._by_id.values())


def builtin_profiles() -> list[EmployeeProfile]:
    """1.0 内置员工：三个角度不同、工具面不同的员工。

    刻意让它们**能力重叠但视角不同**——同一句话派给两个员工，产出必须不一样
    （任务 2 的判据），否则"派活"就退化成复制粘贴。
    """
    return [
        EmployeeProfile(
            profile_id="EMP-ANALYST",
            name="数据分析师",
            base_role="ontology",
            system_prompt=(
                "你是数据分析师。你的产出必须给出**可核对的量化结论**：先列出你查询到的"
                "对象与字段，再给出数字，最后给一句判断。查不到数据就直说查不到，"
                "禁止编造对象名或数字。"
            ),
            skills=("sk-order-anomaly",),
            tools=(*_ONT_READ_TOOLS, *_SKILL_TOOLS),
        ),
        EmployeeProfile(
            profile_id="EMP-AUDITOR",
            name="合规核对员",
            base_role="security",
            system_prompt=(
                "你是合规核对员。你的职责是**挑毛病**：指出上游结论里没有证据支撑的部分、"
                "口径不一致之处、以及可能被误读的表述。产出用「存疑项 / 依据 / 建议核实方式」"
                "三段式，不要复述数据本身。"
            ),
            skills=("sk-compliance-check",),
            tools=(*_ONT_READ_TOOLS, *_SKILL_TOOLS),
        ),
        EmployeeProfile(
            profile_id="EMP-RESEARCHER",
            name="背景研究员",
            base_role="knowledge",
            system_prompt=(
                "你是背景研究员。你的产出补充**业务背景与可能成因**：从知识库里找出与该"
                "目标相关的制度、流程或历史案例，说明它们如何解释观察到的现象。"
                "只引用知识库里真实存在的内容，并给出出处。"
            ),
            skills=("sk-kb-research",),
            tools=("kb_search", *_SKILL_TOOLS),
        ),
    ]


__all__ = [
    "DEFAULT_MODEL",
    "EmployeeProfile",
    "ProfileNotFound",
    "ProfileRegistry",
    "builtin_profiles",
]
