"""ActionType —— 12 基元之 6。

可执行行为（"审批订单"、"创建工单"），含参数+规则+副作用+Function 引用。
**所有写操作的唯一合法入口**。不可变。
"""

from __future__ import annotations

from dataclasses import dataclass

from ..identity.class_ref import ClassRef
from .property_ import Property


@dataclass(frozen=True, slots=True)
class ActionType:
    rid: ClassRef
    parameters: tuple[Property, ...]
    submission_criteria: tuple[str, ...]  # 提交前必须满足的规则表达式
    side_effects: tuple[str, ...]  # 副作用（通知 / webhook / outbox topic）
    # ADR-0064（S1）：function_ref 可选 —— 声明式 edits 与 function 是 edits 的
    # 两个可并存来源（Palantir：edits 是本体，function 是 backing 的一种）。
    # 约束 =「至少声明一个」，不互斥（互斥方案已在 ADR-0064 §2.1 明确否决）。
    function_ref: ClassRef | None
    on: tuple[ClassRef, ...]  # 作用对象（ObjectType / Interface / LinkType）
    # 面向用户的展示元数据（对称于 ObjectType.display_name）；空串 = 未设置
    title: str = ""
    description: str = ""
    # ACT-05（D3/D7 拍板 2026-09-10）：声明式编辑模板（Palantir action rules）。
    # 统一执行器：与 function 产生的 edits 合并后单事务应用
    # （占位符 $target/$param.<name>/$now）。模板字段见 action/edit_set.py EditOp。
    declarative_edits: tuple[dict, ...] = ()

    def __post_init__(self) -> None:
        if self.function_ref is None and not self.declarative_edits:
            raise ValueError(
                f"ActionType {self.rid.rid}: declare at least one of "
                "declarative_edits / function_ref (ADR-0064)"
            )
