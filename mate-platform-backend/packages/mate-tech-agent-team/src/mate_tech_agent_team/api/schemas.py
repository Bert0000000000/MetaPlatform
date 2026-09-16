"""HTTP 请求/响应模型（对应 contracts/openapi/services/agent-team.yaml）。"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class StartRunRequest(BaseModel):
    goal: str = Field(min_length=1)
    max_parallel: int = Field(default=3, ge=2, le=8)


class ApproveRequest(BaseModel):
    approved: bool = True
    comment: str = ""


class SubTaskModel(BaseModel):
    task_id: str
    profile_id: str
    instruction: str
    depends_on: list[str] = Field(default_factory=list)


class SubTaskResultModel(BaseModel):
    task_id: str = ""
    profile_id: str = ""
    status: str = "ok"
    output: str = ""
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    llm_calls: int = 0
    source: str = "stub"
    error: str = ""


class RunStateModel(BaseModel):
    run_id: str
    tenant_id: str
    goal: str
    status: str
    subtasks: list[SubTaskModel] = Field(default_factory=list)
    results: dict[str, SubTaskResultModel] = Field(default_factory=dict)
    summary: str = ""
    hitl_reason: str = ""
    error: str = ""


class EmployeeProfileModel(BaseModel):
    profile_id: str
    name: str
    base_role: str
    system_prompt: str = ""
    skills: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)


class ProfileListModel(BaseModel):
    profiles: list[EmployeeProfileModel] = Field(default_factory=list)


class SkillManifestEntryModel(BaseModel):
    skill_id: str
    name: str
    description: str = ""


class SkillManifestModel(BaseModel):
    profile_id: str
    entries: list[SkillManifestEntryModel] = Field(default_factory=list)
    manifest_chars: int = 0
    budget_chars: int = 0


class SkillContentModel(BaseModel):
    skill_id: str
    content: str


__all__ = [
    "ApproveRequest",
    "EmployeeProfileModel",
    "ProfileListModel",
    "RunStateModel",
    "SkillContentModel",
    "SkillManifestEntryModel",
    "SkillManifestModel",
    "StartRunRequest",
    "SubTaskModel",
    "SubTaskResultModel",
]
