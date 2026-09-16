"""mate_tech_agent_team — Agent 产品层 1.0：超级大脑 + 数字员工。

一句话 → 大脑拆任务图 → 并行派给 ≥2 个数字员工（各有提示词与工具白名单）
→ 真实执行 → 中途一处人工确认 → 汇总。租户隔离由 PG RLS 强制。
"""

from __future__ import annotations

from .authority import AuthorityError, DepthExceeded, Envelope
from .brain import BrainService, RunContext, RunNotAwaitingApproval, RunNotFound
from .checkpoint import (
    InMemoryCheckpointerProvider,
    PgCheckpointerProvider,
    bootstrap,
    thread_id_for,
)
from .employee import LlmEmployeeRuntime
from .llm_planner import LlmPlanner
from .planner import PlanError, Planner, StaticPlanner
from .profile_store import ProfileStore
from .profiles import EmployeeProfile, ProfileNotFound, ProfileRegistry, builtin_profiles
from .runtime import EmployeeRuntime
from .skill_toolbox import SkillToolbox
from .skills import SkillCatalog, SkillManifestEntry, SkillNotFound
from .state import BrainState, SubTask, SubTaskResult
from .team_bus import DEFAULT_MAX_DEPTH, SpawnOutcome, SpawnRequest, TeamBus
from .toolbox import CompositeToolbox, McpToolbox, ToolNotAllowed, to_openai_schema

__all__ = [
    "AuthorityError",
    "BrainService",
    "CompositeToolbox",
    "DEFAULT_MAX_DEPTH",
    "DepthExceeded",
    "Envelope",
    "BrainState",
    "EmployeeProfile",
    "EmployeeRuntime",
    "InMemoryCheckpointerProvider",
    "LlmEmployeeRuntime",
    "LlmPlanner",
    "McpToolbox",
    "PgCheckpointerProvider",
    "PlanError",
    "Planner",
    "ProfileNotFound",
    "ProfileRegistry",
    "ProfileStore",
    "RunContext",
    "RunNotFound",
    "RunNotAwaitingApproval",
    "SkillCatalog",
    "SkillToolbox",
    "SkillManifestEntry",
    "SkillNotFound",
    "SpawnOutcome",
    "SpawnRequest",
    "StaticPlanner",
    "TeamBus",
    "SubTask",
    "SubTaskResult",
    "ToolNotAllowed",
    "bootstrap",
    "builtin_profiles",
    "thread_id_for",
    "to_openai_schema",
]
