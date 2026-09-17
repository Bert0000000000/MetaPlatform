"""执行面（运行时）与身份下投影（ADR-0066 §5.8 / §6 S6）。

**一句话**：同一个 ``EmployeeProfile``，换个执行面跑——身份不变，投影变。

| 模块 | 作用 |
| --- | --- |
| :mod:`.projection` | ``RuntimeBundle`` + ``ProjectionAdapter``：把 profile 压成执行面能吃的东西 |
| :mod:`.claude_code` | ``RuntimeKind.CLAUDE_CODE`` 的实现：投影落盘 → 起 CLI → 解析回执 |

**为什么单独成包**：ADR-0066 把「角色」与「运行时」定成正交两轴，接入 dsh / Codex
就是**再加一个 adapter**，不动 TeamBus 协议与前端（R10）。这个包就是那条"只加
adapter"的落地形态——所以它的公开契约（``RuntimeBundle`` / ``ProjectionAdapter``）
里**不许出现任何框架类型**（有测试断言这一点）。

**边界登记**：本切片只实现 ``superai``（原有）与 ``claude_code``（新增）两个投影；
``codex`` / ``dsh`` 留空。外部运行时的 inbox 消费、skill 正文挂载、MCP 工具面接线
都没做——逐条写在 :mod:`.claude_code` 的模块注释里。
"""

from __future__ import annotations

from .claude_code import (
    ClaudeCodeRuntime,
    default_cli_command,
)
from .projection import (
    ClaudeCodeProjection,
    ProjectionAdapter,
    RuntimeBundle,
    SkillRef,
    SuperAiProjection,
    narrow_tools,
    scan_for_secrets,
)

__all__ = [
    "ClaudeCodeProjection",
    "ClaudeCodeRuntime",
    "ProjectionAdapter",
    "RuntimeBundle",
    "SkillRef",
    "SuperAiProjection",
    "default_cli_command",
    "narrow_tools",
    "scan_for_secrets",
]
