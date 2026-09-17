"""大脑状态 schema —— 显式声明字段（决策 D-5）。

**为什么必须显式声明**：langgraph 的 StateGraph 以 schema 为准做写入合并。
声明成裸 ``dict`` 时，节点返回的未声明键会被**静默丢弃**——表现为"节点跑了、
结果没了"，且不报错。本仓 ``mate-tech-agent`` 的 ``state.py`` 就吃过这个亏
（``guard_blocked`` / ``pending_review`` 等键未声明 → 写入丢失）。

故：所有会被节点写入的键，必须在此显式列出。
"""

from __future__ import annotations

from typing import Annotated, Any, TypedDict

from .authority import EnvelopeState
from .delegation import DelegationState
from .versioning import AgentProfileSnapshotState

# ── 状态里的结构化值（用 TypedDict 而非 dataclass：checkpointer 序列化最稳）──


class SubTask(TypedDict, total=False):
    """一个被派出去的子任务（= 派给某个数字员工的一句话）。

    ``task_id`` 是**计划内标签**（``t1``/``t2``…），只在本轮计划里有意义；
    ``team_task_id`` 是**实例身份**（``team_task`` 表的主键），由派活侧在
    运行时给，跨运行唯一。追问子员工投递的是后者。

    ``depends_on`` 是**同一计划内**的标签列表：列在这里的节点必须先把回执
    写进 ``results``，本节点才够格被派出去（1.3 轨 1 起图真的读它）。

    ``tool_scope`` 是调用方给的收窄面（只能收窄，不能扩，ADR-0066 §5.2）；
    ``granted_tools`` 是派活闸门判完之后**实际发放**的工具面——运行时按它绑
    工具，所以"闸门放行"与"员工能调什么"是同一份数据，不是两处各说各话。

    ``granted_envelope`` 是同一份发放的**四维**形态（1.4 任务 1）：只带
    ``granted_tools`` 时，``action_rids`` / ``kb_ids`` / ``markings`` 三维在
    执行侧无人认领——判定过了就没人再看一眼，等于没拦。

    ``run_id`` 是这一轮 run 的身份（A-3 起由派活节点写入）：工具调用级幂等键
    ``run_id + task_id + tool_call_id`` 的第一段，重启后从检查点原样读得回来。

    ``profile_snapshot`` 是**派活那一刻的员工定义快照**（A-6）。它一写进来，
    这一波用的就是**这一份**——名册里那份后来改成什么样都不影响本轮（续跑亦然）。
    见 :mod:`mate_tech_agent_team.versioning`。
    """

    task_id: str
    team_task_id: str
    run_id: str
    profile_snapshot: AgentProfileSnapshotState
    profile_id: str
    instruction: str
    depends_on: list[str]
    tool_scope: list[str]
    granted_tools: list[str]
    granted_envelope: EnvelopeState


class SubTaskResult(TypedDict, total=False):
    """子任务回执。``source`` 区分真实执行与假回执，供 D-10 断言使用。

    ``error_code`` 是**可判定的失败类别**（闸门硬拒 / 越权待授权 / 员工报错
    都是 ``status`` 里的同几个词，只有它分得开）：

    * ``E_AUTHORITY_ESCALATION`` —— 越权，已转 proposal，**未执行**；
    * ``E_DEPTH_EXCEEDED`` / ``E_PROFILE_NOT_FOUND`` —— 硬拒，整轮判失败；
    * ``E_RUNTIME_UNAVAILABLE`` —— 可重试失败重试用尽（1.5 任务 4），**只是
      这一件没干成**，不是整轮失败。

    ``attempts`` 是这一件**真正发起了几次**运行时调用（含重试；1 = 一次没过手；
    没被执行的（越权 / 硬拒）为 0）。它是"重试真的发生过"的可读证据。

    ``evidence`` 是该员工工具调用结果映射出的**结构化证据**（1.6 任务 1），
    形状与 copilot 的 ``_evidence_items`` 一致（见 :mod:`.evidence`）。放进状态
    是有意的：它随检查点落库，于是**回执可查**（``GET /runs/{id}``）与**事件流
    可回放**（SSE）读的是同一份事实，不是两处各攒一份。

    ``artifacts`` 是该员工产出的**可寻址交付物**（1.6 任务 2）的元数据——正文
    落在 :mod:`.artifact_store`（PG + RLS），这里只记地址与摘要。状态里**不存
    正文**：正文可能很长，而检查点每一波都会整份写一次。
    """

    task_id: str
    team_task_id: str
    profile_id: str
    status: str  # ok | error | rejected
    output: str
    tool_calls: list[dict[str, Any]]
    llm_calls: int
    #: B-7 / `MP-EXTERNAL-RUNTIME-E2E-01`：**计量拆开**。
    #:
    #: 2.1-B 之前，一次外部 agent 往返被记成 ``llm_calls=1`` + ``source="llm"``
    #: ——远端 agent 的 token 不是我们花的，本地一次模型调用都没发生，成本指标
    #: 因此失真。四类现在分开：
    #:
    #: * ``llm_calls`` —— **本地**模型轮次（``ChatModel`` 数出来的）；
    #: * ``external_agent_calls`` —— 出站到外部 agent 的往返次数；
    #: * ``runtime_calls`` —— 运行时派发次数（含重试）；
    #: * 工具调用数 —— 就是 ``len(tool_calls)``。**不另存一个标量**：那会让同一
    #:   个事实有两个来源，正是本项目反复立的规矩（``tool_calls`` 那张清单本身
    #:   就是记录，数出来的长度才是计数）。
    external_agent_calls: int
    runtime_calls: int
    source: str  # "llm" = 本地模型产出；"external" = 外部 agent 产出；"stub" = 未接线
    error: str
    error_code: str
    #: 越权时的人审提案（ADR-0066 §3.4）；授权范围只限本次任务。
    proposal: dict[str, Any]
    #: 真正发起的运行时调用次数（含重试）。
    attempts: int
    #: 工具结果映射出的结构化证据条目（形状同 copilot，见 ``evidence`` 模块）。
    evidence: list[dict[str, Any]]
    #: 产出物的**元数据**（不含正文）；正文按 ``artifact_id`` 另取。
    artifacts: list[dict[str, Any]]


def merge_results(
    left: dict[str, SubTaskResult] | None,
    right: dict[str, SubTaskResult] | None,
) -> dict[str, SubTaskResult]:
    """并行节点写同一个 ``results`` 键时的归并规则（后者覆盖同 task_id）。"""
    return {**(left or {}), **(right or {})}


class BrainState(TypedDict, total=False):
    """超级大脑的图状态。

    ``results`` 带 reducer：并行 worker 节点各自写入自己的子任务回执，
    由 :func:`merge_results` 合并，而不是互相覆盖。

    ``timeout_seconds`` / ``deadline_at`` 是**本轮的运行级截止时间**（1.5 任务 2）：
    它们随 run 落进检查点，所以重启/多副本仍按**本轮**定下的值裁决，而不是
    回落成"当前进程的默认值"。``deadline_at`` 存**绝对时刻**——存"还剩多少秒"
    的话重启一次就又变成相对的了。

    ``plan_round`` / ``max_rounds`` 是**重规划的轮次**（1.8 轨 3）。``max_rounds``
    跟着状态走（而不是只看进程里的配置）：续跑/多副本裁决时读的是**这一轮**定下的
    上界，与 ``timeout_seconds`` 同一个理由。

    ``delegation`` 是**这一轮的派活授权**（1.9 任务 1）。它随 run 落库，续跑时
    读回来当链根——**令牌仍然不进状态**，落地的只是"这一轮能碰什么"那份集合。
    见 :mod:`mate_tech_agent_team.delegation`。

    最后四个 ``*_version`` 是 **A-6 的版本化**（``MP-AGENT-VERSIONING-01``）：
    写下这一轮时，状态 schema / 图定义 / 员工运行时 / 检查点编码各是哪一版。
    老检查点里读不到就是空串——**只加字段，既有判定一个字都不变**。
    """

    run_id: str
    tenant_id: str
    goal: str
    subtasks: list[SubTask]
    results: Annotated[dict[str, SubTaskResult], merge_results]
    approved: bool
    status: str  # planning | running | awaiting_approval | completed | failed
    summary: str
    hitl_reason: str
    #: **HITL 闸门的统一协议**（B-6 / `MP-APPROVAL-GATE-ABI-01`）。
    #: 形状见 :class:`mate_tech_agent_team.approval_gate.ApprovalGate`——
    #: ``gate_id / gate_type / required_roles / required_approvals / payload /
    #: editable_fields / expires_at / decisions``。
    #:
    #: 它随 run 落检查点（所以重启后闸门还在，不需要第二个真相源）。
    #: **老检查点里没有这个键**是正常的：那时按"只有单布尔审批"的旧语义处理。
    approval_gate: dict[str, Any]
    error: str
    #: 本轮的派活授权（链根）。**不是凭据**，只有包络四维与它的归属。
    delegation: DelegationState
    #: 本轮实际生效的超时值（秒；0 = 不设超时）。
    timeout_seconds: float
    #: 本轮截止的绝对时刻（epoch 秒；0 = 无截止）。
    deadline_at: float
    #: 已经走到第几轮规划（首轮 = 1）；只有具备重规划能力的拆解器才会写它。
    plan_round: int
    #: 这一轮允许的规划轮数上界（1 = 一次定型，即 1.0 的行为）。
    max_rounds: int
    # ── A-6 版本化（只加字段；老检查点读不到就是空串）────────────────────
    state_schema_version: str
    graph_definition_version: str
    agent_runtime_version: str
    checkpoint_codec_version: str


__all__ = ["BrainState", "SubTask", "SubTaskResult", "merge_results"]
