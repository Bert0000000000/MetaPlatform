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
    #: B-7 / `MP-EXTERNAL-RUNTIME-E2E-01`：计量拆开（本地模型轮次 / 外部 agent
    #: 往返 / 运行时派发）。工具调用数看 ``len(tool_calls)``，不另存标量。
    external_agent_calls: int = 0
    runtime_calls: int = 0
    source: str = "stub"
    error: str = ""
    #: 可判定的失败类别：越权待授权（E_AUTHORITY_ESCALATION）与硬拒
    #: （E_DEPTH_EXCEEDED / E_PROFILE_NOT_FOUND）在 ``status`` 里长得一样。
    error_code: str = ""
    #: 越权时的人审提案（ADR-0066 §3.4），授权范围只限本次任务。
    proposal: dict[str, Any] = Field(default_factory=dict)
    #: 真正发起的运行时调用次数（含重试）；没被执行的（越权 / 硬拒）为 0。
    attempts: int = 0
    #: 工具结果映射出的**结构化证据**（1.6 任务 1）。形状与 copilot 的
    #: ``_evidence_items`` 一致：``type`` / ``ref`` / ``objectId?`` / ``concept?``
    #: / ``fragment?``，外加运行内唯一的 ``evidenceId`` 与抓取时刻 ``capturedAt``。
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    #: 该员工产出的**可寻址交付物**的元数据（1.6 任务 2）；正文按 ``artifact_id``
    #: 走 ``GET /artifacts/{artifact_id}`` 另取。
    artifacts: list[dict[str, Any]] = Field(default_factory=list)


class ArtifactModel(BaseModel):
    """一件产出物的**元数据**（不含正文）。"""

    artifact_id: str
    run_id: str = ""
    task_id: str = ""
    profile_id: str = ""
    #: 产出物种类（当前只有 ``report``：员工的自由文本产出）。
    kind: str = "report"
    title: str = ""
    content_type: str = "text/markdown"
    #: 正文的**字节数**。
    size: int = 0
    created_at: str = ""


class ArtifactContentModel(ArtifactModel):
    """元数据 + **正文**（按 id 取回时用）。"""

    content: str = ""


class ArtifactListModel(BaseModel):
    items: list[ArtifactModel] = Field(default_factory=list)


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
    #: **HITL 闸门的统一协议**（B-6 / `MP-APPROVAL-GATE-ABI-01`）：闸门地址、
    #: 层级、会签人数、待批内容、过期时刻与已收到的决定。**统一审批中心消费的就是
    #: 它**（列 ``pending`` 的闸门 + 按 ``gate_id`` 做决定）。
    #: 老 run（B-6 之前落的检查点）没有这个键，因此这里是空 dict。
    approval_gate: dict[str, Any] = Field(default_factory=dict)


class RunCancelAcceptedModel(BaseModel):
    """`POST /runs/{run_id}/cancel` 的**受理回执**（B-3）。

    与 `RunAcceptedModel` 同一个道理：取消**不承诺**"回话那刻图已经停了"。
    跨副本时回话的那个副本根本没有跑这一轮，它保证的是**信号已落 + 状态如实**。

    ``status`` 是**观察到的**：

    * ``cancelled`` —— 已经落终态（本来就已经结束，或本请求落的）；
    * ``cancelling`` —— 已受理，图还没停。客户端接着看
      `GET /runs/{run_id}`，它会一直报 ``cancelling`` 直到真的 `cancelled`。
    """

    run_id: str
    tenant_id: str
    #: ``cancelled``（已终止）或 ``cancelling``（已受理、仍在收敛）。
    status: str
    #: 恒为 ``true``：这是受理回执，能回话就说明请求已经记下了。
    cancel_requested: bool = False


class RunAcceptedModel(BaseModel):
    """`POST /runs` 的**受理回执**（1.7 任务 1）：只回受理事实，不回运行结果。

    拆图 + 并行派活实测量级是分钟，让 HTTP 请求等它只会换来网关 504——而那一轮
    其实已经建好了，重试一次就多跑一轮。改成受理制之后，提交立刻拿到 ``run_id``，
    终态从 ``GET /runs/{run_id}`` 或事件流取。
    """

    run_id: str
    tenant_id: str
    #: 受理那一刻的状态（通常是 ``running``），**不是终态**。
    status: str
    #: 这次提交是否**没有新起一轮**：带了同一个 ``Idempotency-Key`` 且该键已经
    #: 对应到某一轮时，原样回那一轮并置真。
    deduplicated: bool = False


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
    """一行审计（硬规则 #9）：派活 / 越权转 proposal / 审批。

    A-1（`MP-AUDIT-LEDGER-01`）起这批字段是**可取证**的那一份：``sequence`` /
    ``previous_hash`` / ``event_hash`` 构成按租户的哈希链——审计员拿到整批行
    可以自己重算摘要，任何一行被改过都对不上。
    """

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
    sequence: int = 0
    event_id: str = ""
    agent_profile_revision: str = ""
    decision: str = ""
    approver_id: str = ""
    authority_before: dict[str, Any] = Field(default_factory=dict)
    authority_after: dict[str, Any] = Field(default_factory=dict)
    policy_version: str = ""
    trace_id: str = ""
    previous_hash: str = ""
    event_hash: str = ""


class AuditListModel(BaseModel):
    items: list[AuditRecordModel] = Field(default_factory=list)


__all__ = [
    "ApproveRequest",
    "ArtifactContentModel",
    "ArtifactListModel",
    "ArtifactModel",
    "AuditListModel",
    "AuditRecordModel",
    "ChannelMessageModel",
    "EmployeeProfileModel",
    "ProfileListModel",
    "ProfileWriteRequest",
    "RunAcceptedModel",
    "RunStateModel",
    "SendMessageRequest",
    "SkillContentModel",
    "SkillManifestEntryModel",
    "SkillManifestModel",
    "StartRunRequest",
    "SubTaskModel",
    "SubTaskResultModel",
]
