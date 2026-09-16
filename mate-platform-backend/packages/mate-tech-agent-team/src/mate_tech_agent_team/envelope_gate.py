"""执行侧包络闸门（ADR-0066 §3.3；1.4 任务 1）。

1.3 把四维判定做在了「员工定义」与「派活」两侧，但**执行侧只有 ``tools``
真的拦人**：闸门放行之后，员工仍旧能点名包络外的 ActionType、检索包络外的
知识库、吃进包络外的标记数据。判定过了没人再看一眼，等于没拦。

本模块把那三个维度挪到**工具派发处**——与 ``tools`` 同一条路径、同一个
拒绝语义（:class:`~mate_tech_agent_team.toolbox.ToolNotAllowed`），于是
"闸门判了什么"与"员工能干什么"是同一份数据，而不是两处各说各话。

四维各自的拦法：

============================ ==================================================
``tools``                    ``name`` 必须在那份**闸门实际发放**的名单里（沿用）
``action_rids``              参数里点名的 ActionType 必须在包络内，否则拒
``kb_ids``                   ``kb_search`` 的知识库限定在包络内（只收窄）
``markings``                 带标记数据／参数不得超过包络 marking 集合（合取门）
============================ ==================================================

**为什么 markings 要在结果侧判**：一个对象类型带什么标记，只有查询回来才知道；
派发前能判的只有调用方自己写进参数的那些。两处都判——参数侧拦"提议造一个
高标记对象"，结果侧拦"读到了一个高标记对象"。

**判定用既有的合取门**（``mate_kernel.tooling.schema_gen.markings_satisfied``，
即 ``visible_object_types`` 的那一条），不另造一套标记逻辑：两份实现漂移的方向
恰好是"一边放行、一边以为另一边拦住了"。
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from mate_kernel.tooling.schema_gen import markings_satisfied

from .authority import Envelope
from .toolbox import ToolNotAllowed

#: 参数里"点名一个 ActionType"的键名。工具无关：任何工具只要带这些键，
#: 值就是 ActionType rid，必须过 ``action_rids`` 维。
ACTION_ARGUMENT_KEYS: tuple[str, ...] = ("action_rid", "action_type_rid", "action_rids")

#: 知识检索工具及其"限定知识库"参数。
KB_TOOL = "kb_search"
KB_ARGUMENT_KEY = "kb_ids"

#: 判定标记的键名（参数侧与结果侧共用）。
MARKING_KEYS: tuple[str, ...] = ("marking", "markings")

#: 拒绝原因（``reason`` 字段），与 ``toolbox`` 的两条理由同一种读法。
REASON_TOOLS = "authority_envelope:tools"
REASON_ACTION = "authority_envelope:action_rids"
REASON_KB = "authority_envelope:kb_ids"
REASON_MARKING = "authority_envelope:markings"


def _as_str_tuple(value: Any) -> tuple[str, ...]:
    """把参数/结果里的标记或 rid 归一成字符串元组（单值也算）。"""
    if value is None:
        return ()
    if isinstance(value, str):
        return (value,) if value else ()
    if isinstance(value, (list, tuple, set, frozenset)):
        return tuple(str(v) for v in value if v)
    return (str(value),)


def _walk(node: Any, keys: tuple[str, ...]) -> list[Any]:
    """在嵌套结构里收集 ``keys`` 命中的值（dict / list 递归）。"""
    found: list[Any] = []
    if isinstance(node, dict):
        for key, value in node.items():
            if isinstance(key, str) and key in keys:
                found.append(value)
            found.extend(_walk(value, keys))
    elif isinstance(node, (list, tuple)):
        for item in node:
            found.extend(_walk(item, keys))
    return found


class EnvelopeGate:
    """把一个工具面包成"过包络"的工具面。

    实现 :class:`~mate_tech_agent_team.toolbox.Toolbox` 协议，可直接替换运行时
    里那个未受包络约束的工具面——运行时不必知道自己拿的是哪一种。
    """

    def __init__(self, *, toolbox: Any, envelope: Envelope) -> None:
        self._toolbox = toolbox
        self._envelope = envelope

    @property
    def envelope(self) -> Envelope:
        return self._envelope

    # -- 透传 --------------------------------------------------------------
    async def descriptors(self, *, allowed: Sequence[str]) -> list[dict[str, Any]]:
        return await self._toolbox.descriptors(allowed=allowed)

    async def schemas(self, *, allowed: Sequence[str]) -> list[dict[str, Any]]:
        return await self._toolbox.schemas(allowed=allowed)

    async def aclose(self) -> None:
        close = getattr(self._toolbox, "aclose", None)
        if close is not None:
            await close()

    # -- 闸门 --------------------------------------------------------------
    def check_tool(self, name: str) -> None:
        if name not in self._envelope.tools:
            raise ToolNotAllowed(name, REASON_TOOLS)

    def narrow_arguments(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """按包络收窄参数。要么原样、要么收窄，**绝不放大**；越维直接拒。"""
        self._check_action_rids(name, arguments)
        self._check_markings(name, arguments, side="arguments")
        if name == KB_TOOL:
            return self._narrow_kb(name, arguments)
        return arguments

    def check_result(self, name: str, result: Any) -> None:
        """结果侧合取门：带标记数据不得超过包络的 marking 集合。"""
        self._check_markings(name, result, side="result")

    async def invoke(self, *, name: str, arguments: dict[str, Any], allowed: Sequence[str]) -> Any:
        self.check_tool(name)
        narrowed = self.narrow_arguments(name, arguments)
        result = await self._toolbox.invoke(name=name, arguments=narrowed, allowed=allowed)
        self.check_result(name, result)
        return result

    # -- 各维判定 ----------------------------------------------------------
    def _check_action_rids(self, name: str, arguments: dict[str, Any]) -> None:
        for value in _walk(arguments, ACTION_ARGUMENT_KEYS):
            for rid in _as_str_tuple(value):
                if rid not in self._envelope.action_rids:
                    raise ToolNotAllowed(name, REASON_ACTION)

    def _narrow_kb(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        requested = arguments.get(KB_ARGUMENT_KEY)
        if requested is None:
            # 不点名知识库 = "我能看见的全部"，那正是包络本身。包络没有知识库
            # 维度时不注入空列表——空列表在 MCP 面等于"限定到零个库"，会把一次
            # 正常检索变成永远无命中，看起来像跑通了的假回执。
            if not self._envelope.kb_ids:
                return arguments
            return {**arguments, KB_ARGUMENT_KEY: sorted(self._envelope.kb_ids)}
        wanted = _as_str_tuple(requested)
        outside = [kb for kb in wanted if kb not in self._envelope.kb_ids]
        if outside:
            # 不静默裁剪：静默裁剪会让"我要 kb-salaries"变成"我拿到了 kb-orders
            # 的结果"，调用方无从发现有东西被吃掉了。
            raise ToolNotAllowed(name, REASON_KB)
        return {**arguments, KB_ARGUMENT_KEY: list(wanted)}

    def _check_markings(self, name: str, payload: Any, *, side: str) -> None:
        for value in _walk(payload, MARKING_KEYS):
            if not markings_satisfied(_as_str_tuple(value), tuple(self._envelope.markings)):
                raise ToolNotAllowed(name, REASON_MARKING)


__all__ = [
    "ACTION_ARGUMENT_KEYS",
    "KB_ARGUMENT_KEY",
    "KB_TOOL",
    "MARKING_KEYS",
    "REASON_ACTION",
    "REASON_KB",
    "REASON_MARKING",
    "REASON_TOOLS",
    "EnvelopeGate",
]
