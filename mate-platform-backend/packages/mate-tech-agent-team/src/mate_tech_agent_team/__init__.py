"""mate_tech_agent_team — Agent 产品层 1.0：超级大脑 + 数字员工。

一句话 → 大脑拆任务图 → 并行派给 ≥2 个数字员工（各有提示词与工具白名单）
→ 真实执行 → 中途一处人工确认 → 汇总。租户隔离由 PG RLS 强制。
"""

from __future__ import annotations

from .brain import BrainService, RunNotAwaitingApproval, RunNotFound
from .checkpoint import (
    InMemoryCheckpointerProvider,
    PgCheckpointerProvider,
    bootstrap,
    thread_id_for,
)
from .planner import Planner, StaticPlanner
from .runtime import EmployeeRuntime
from .state import BrainState, SubTask, SubTaskResult

__all__ = [
    "BrainService",
    "BrainState",
    "EmployeeRuntime",
    "InMemoryCheckpointerProvider",
    "PgCheckpointerProvider",
    "Planner",
    "RunNotFound",
    "RunNotAwaitingApproval",
    "StaticPlanner",
    "SubTask",
    "SubTaskResult",
    "bootstrap",
    "thread_id_for",
]
