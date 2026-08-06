"""ActionType —— 12 基元之 6。

可执行行为（"审批订单"、"创建工单"），含参数+规则+副作用+Function 引用。
**所有写操作的唯一合法入口**。不可变。
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..identity.class_ref import ClassRef
from .property_ import Property


@dataclass(frozen=True, slots=True)
class ActionType:
    rid: ClassRef
    parameters: tuple[Property, ...]
    submission_criteria: tuple[str, ...]  # 提交前必须满足的规则表达式
    side_effects: tuple[str, ...]  # 副作用（通知 / webhook / outbox topic）
    function_ref: ClassRef  # 引用的 Function rid
    on: tuple[ClassRef, ...]  # 作用对象（ObjectType / Interface / LinkType）
