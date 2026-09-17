"""HTTP 请求/响应模型（对应 contracts/openapi/services/agent-team.yaml）。"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from ..profiles import DEFAULT_MODEL


class StartRunRequest(BaseModel):
    goal: str = Field(min_length=1)
    max_parallel: int = Field(default=3, ge=2, le=8)
    #: 运行级截止时间（秒）。省略则用部署默认值（``MATE_AGENT_TEAM_RUN_TIMEOUT_SECONDS``，
    #: 0 = 不设超时）。到点后运行落终态 ``timeout``，不会一直停在闸门上。
    timeout_seconds: float | None = Field(default=None, ge=0)


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
    team_task_id: str = ""
    profile_id: str = ""
    status: str = "ok"
    output: str = ""
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    llm_calls: int = 0
    source: str = "stub"
    error: str = ""
    #: 可判定的失败类别：越权待授权（E_AUTHORITY_ESCALATION）与硬拒
    #: （E_DEPTH_EXCEEDED / E_PROFILE_NOT_FOUND）在 ``status`` 里长得一样。
    error_code: str = ""
    #: 越权时的人审提案（ADR-0066 §3.4），授权范围只限本次任务。
    proposal: dict[str, Any] = Field(default_factory=dict)
    #: 真正发起的运行时调用次数（含重试）；没被执行的（越权 / 硬拒）为 0。
    attempts: int = 0


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
    #: 本轮实际生效的运行级超时（秒；0 = 不设超时）与它的绝对截止时刻（epoch 秒；
    #: 0 = 无截止）。两者都**随 run 落库**：重启后仍按本轮的值裁决（1.5 任务 2）。
    timeout_seconds: float = 0.0
    deadline_at: float = 0.0


class EmployeeProfileModel(BaseModel):
    profile_id: str
    name: str
    base_role: str
    system_prompt: str = ""
    skills: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    #: 权限包络的另外三维（ADR-0066 §3.3）。只出 tools 的话，读回来的员工
    #: 定义与实际生效的包络对不上。
    action_rids: list[str] = Field(default_factory=list)
    kb_ids: list[str] = Field(default_factory=list)
    markings: list[str] = Field(default_factory=list)
    model: str = DEFAULT_MODEL
    origin: str = "builtin"


class ProfileWriteRequest(BaseModel):
    """建/改一个数字员工（ADR-0066 §3.1 的"实例化"入口）。

    ``profile_id`` 省略时现生成一个（``EMP-XXXXXXXX``）；给了就是**幂等 upsert**
    ——同一个 id 再提交一次即覆盖，不需要先查再建。
    """

    profile_id: str = ""
    name: str = Field(min_length=1)
    base_role: str = "ontology"
    system_prompt: str = ""
    skills: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    action_rids: list[str] = Field(default_factory=list)
    kb_ids: list[str] = Field(default_factory=list)
    markings: list[str] = Field(default_factory=list)
    model: str = DEFAULT_MODEL


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


class SendMessageRequest(BaseModel):
    """给运行中的子 agent 投递一条消息（ADR-0066 §5.5）。"""

    message: str = Field(min_length=1)
    #: 投递方标识；子 agent 回问父级时填自己的 task_id。
    sender: str = "user"


class ChannelMessageModel(BaseModel):
    sender: str
    text: str
    at: str


class AuditRecordModel(BaseModel):
    """一行审计（硬规则 #9）：派活 / 越权转 proposal / 审批。"""

    audit_id: str
    action: str
    tenant_id: str
    actor: str = ""
    task_id: str = ""
    run_id: str = ""
    profile_id: str = ""
    outcome: str = ""
    detail: dict[str, Any] = Field(default_factory=dict)
    at: str


class AuditListModel(BaseModel):
    items: list[AuditRecordModel] = Field(default_factory=list)


__all__ = [
    "ApproveRequest",
    "AuditListModel",
    "AuditRecordModel",
    "ChannelMessageModel",
    "EmployeeProfileModel",
    "ProfileListModel",
    "ProfileWriteRequest",
    "RunStateModel",
    "SendMessageRequest",
    "SkillContentModel",
    "SkillManifestEntryModel",
    "SkillManifestModel",
    "StartRunRequest",
    "SubTaskModel",
    "SubTaskResultModel",
]
