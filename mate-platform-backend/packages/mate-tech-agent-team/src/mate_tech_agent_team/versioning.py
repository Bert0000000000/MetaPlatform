"""状态 / 图 / 员工定义的**版本化**（A-6 / `MP-AGENT-VERSIONING-01`）。

两个"同一 Run 前后不一致"的来源，本模块一起堵：

1. **状态无版本** —— ``BrainState`` 里一个 ``*version*`` 字段都没有：换了代码、换了
   图定义之后，老检查点读回来没人说得清它是按哪一版写下的。
2. **员工定义无快照** —— ``SubTask`` 只有 ``profile_id``，运行时按 id 去名册取
   **最新**定义。于是「Run 用员工 v1 起步 → 有人改了 Prompt / Model → 下一波实际
   跑的是 v2」：同一轮里前后两波是两个不同的员工，而且**没有任何地方看得出来**。

给出两样东西：

* 四个版本常量（:data:`STATE_SCHEMA_VERSION` / :data:`GRAPH_DEFINITION_VERSION` /
  :data:`AGENT_RUNTIME_VERSION` / :data:`CHECKPOINT_CODEC_VERSION`）——随 run 落进
  状态。**只加字段**：既有判定一个字节都不变。
* :class:`AgentProfileSnapshot` —— 派活那一刻把员工定义**拍成不可变快照**，
  Run / SubTask **永远引用快照**，不读可变 Profile 的最新值。

**``revision`` 是定义内容的摘要，不是数据库里的自增号**：那样做要动
``profile_store`` 的表（那是 ``MP-AGENT-VERSIONING-01`` 的另一半，排在 2.1-C 的
C-5）。摘要的好处是它与存储无关——内置员工、库里的行、测试里现造的 profile
一视同仁，且"定义变了 revision 就变"当场成立。

**为什么快照里存提示词正文而不只存摘要**（roadmap 写的是 ``prompt_digest``）：
只存摘要就只能**发现**定义变了，不能**按原来那一份跑完**。判据要的是后半句，
所以正文与摘要都存——摘要是校验与可读标识，正文是复现的依据。这**不是新增
暴露面**：提示词本来就随每一轮的消息进检查点。
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from typing import Any, TypedDict

from .authority import Envelope, EnvelopeState
from .profiles import EmployeeProfile, ProfileRegistry

# ── 四个版本号 ───────────────────────────────────────────────────────────
#
# 口径（与 roadmap §A-7 的版本分离一致）：**改了它指代的东西就加版号**，
# 于是"这一轮是按哪一版写的"从检查点自身读得出来。

#: 图状态 schema 的版本。加了 status/results 之外的**结构**变更就往上走。
STATE_SCHEMA_VERSION = "brain-state/v2"
#: 图定义（节点 / 边 / 扇出与闸门语义）的版本。图结构变了就往上走。
GRAPH_DEFINITION_VERSION = "agent-team-graph/v3"
#: 员工运行时（执行循环、工具闸门、投影）的版本。
AGENT_RUNTIME_VERSION = "agent-runtime/v1"
#: 检查点编码（状态值怎么序列化）的版本。换序列化格式就往上走。
CHECKPOINT_CODEC_VERSION = "checkpoint-codec/v1"


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


class AgentProfileSnapshotState(TypedDict, total=False):
    """快照的**显式状态形态**（决策 D-5：状态键必须声明，否则写入被静默丢弃）。"""

    profile_id: str
    revision: str
    system_prompt: str
    prompt_digest: str
    model_id: str
    skills: list[str]
    tools: list[str]
    authority_envelope: EnvelopeState
    runtimes: list[str]
    captured_at: str


def _digest(payload: Any) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def revision_of(profile: EmployeeProfile) -> str:
    """员工定义的修订号 = 定义内容的 sha256 前缀。

    **参与摘要的字段就是"定义"的全部**：提示词、模型、技能、工具面、包络三维、
    声明的执行面。改了其中任何一项，revision 必变——这正是"快照可检"的基础。
    """
    return _digest(
        {
            "profile_id": profile.profile_id,
            "name": profile.name,
            "base_role": profile.base_role,
            "system_prompt": profile.system_prompt,
            "model": profile.model,
            "skills": list(profile.skills),
            "tools": list(profile.tools),
            "action_rids": list(profile.action_rids),
            "kb_ids": list(profile.kb_ids),
            "markings": list(profile.markings),
            "runtimes": [str(kind) for kind in profile.runtimes],
        }
    )[:16]


def prompt_digest_of(profile: EmployeeProfile) -> str:
    return _digest({"system_prompt": profile.system_prompt})[:16]


@dataclass(frozen=True, slots=True)
class AgentProfileSnapshot:
    """派活那一刻的员工定义（**不可变**）。

    ``to_profile()`` 是它的全部用途：运行时拿到的永远是**这一份**，名册里那份
    后来改成什么样都不影响本轮。
    """

    profile_id: str
    revision: str = ""
    system_prompt: str = ""
    prompt_digest: str = ""
    model_id: str = ""
    skills: tuple[str, ...] = ()
    tools: tuple[str, ...] = ()
    authority_envelope: Envelope = field(default_factory=Envelope)
    runtimes: tuple[str, ...] = ()
    captured_at: str = ""

    @classmethod
    def capture(cls, profile: EmployeeProfile) -> AgentProfileSnapshot:
        """给一份定义拍照。派活那一刻调用一次。"""
        return cls(
            profile_id=profile.profile_id,
            revision=revision_of(profile),
            system_prompt=profile.system_prompt,
            prompt_digest=prompt_digest_of(profile),
            model_id=profile.model,
            skills=tuple(profile.skills),
            tools=tuple(profile.tools),
            authority_envelope=Envelope.of(profile),
            runtimes=tuple(str(kind) for kind in profile.runtimes),
            captured_at=utc_now(),
        )

    def to_profile(self, live: EmployeeProfile) -> EmployeeProfile:
        """用快照覆盖**可变字段**，不可变字段（name / base_role / origin）沿用现值。

        覆盖的是"定义"的全部：提示词、模型、技能、工具面、包络三维、执行面。
        于是"Run 中途改员工定义，本轮行为不变"不是一句承诺，而是**这里没有读
        那些字段的路径**。
        """
        from .profiles import RuntimeKind

        kinds: list[RuntimeKind] = []
        for raw in self.runtimes:
            try:
                kinds.append(RuntimeKind(raw))
            except ValueError:
                continue
        return replace(
            live,
            system_prompt=self.system_prompt or live.system_prompt,
            model=self.model_id or live.model,
            skills=self.skills,
            tools=self.tools,
            action_rids=tuple(sorted(self.authority_envelope.action_rids)),
            kb_ids=tuple(sorted(self.authority_envelope.kb_ids)),
            markings=tuple(sorted(self.authority_envelope.markings)),
            runtimes=tuple(kinds) if kinds else live.runtimes,
        )

    def matches(self, profile: EmployeeProfile) -> bool:
        """名册里的现值与快照是不是同一份定义（变了就是变了，能说出来）。"""
        return revision_of(profile) == self.revision

    # -- 图状态往返 --------------------------------------------------------
    def as_state(self) -> AgentProfileSnapshotState:
        return AgentProfileSnapshotState(
            profile_id=self.profile_id,
            revision=self.revision,
            system_prompt=self.system_prompt,
            prompt_digest=self.prompt_digest,
            model_id=self.model_id,
            skills=list(self.skills),
            tools=list(self.tools),
            authority_envelope=self.authority_envelope.as_state(),
            runtimes=list(self.runtimes),
            captured_at=self.captured_at,
        )

    @classmethod
    def of_state(cls, value: Any) -> AgentProfileSnapshot | None:
        """从状态值还原；认不出来 = **没有快照**（fail-safe：退回名册现值）。"""
        if not isinstance(value, dict):
            return None
        profile_id = str(value.get("profile_id") or "")
        if not profile_id:
            return None
        return cls(
            profile_id=profile_id,
            revision=str(value.get("revision") or ""),
            system_prompt=str(value.get("system_prompt") or ""),
            prompt_digest=str(value.get("prompt_digest") or ""),
            model_id=str(value.get("model_id") or ""),
            skills=tuple(str(s) for s in (value.get("skills") or ())),
            tools=tuple(str(t) for t in (value.get("tools") or ())),
            authority_envelope=Envelope.of_state(value.get("authority_envelope")),
            runtimes=tuple(str(r) for r in (value.get("runtimes") or ())),
            captured_at=str(value.get("captured_at") or ""),
        )


async def profile_for_subtask(
    subtask: dict[str, Any], registry: ProfileRegistry, tenant_id: str
) -> EmployeeProfile:
    """本轮该用哪一份员工定义：**有快照就用快照**，没有才读名册现值。

    两处调用（``LlmEmployeeRuntime`` 与 ``RuntimeRouter``）共用这一个入口——
    两处各自判断迟早会漂移成两种语义。
    """
    live = await registry.get(str(subtask["profile_id"]), tenant_id)
    snapshot = AgentProfileSnapshot.of_state(subtask.get("profile_snapshot"))
    return snapshot.to_profile(live) if snapshot is not None else live


__all__ = [
    "AGENT_RUNTIME_VERSION",
    "CHECKPOINT_CODEC_VERSION",
    "GRAPH_DEFINITION_VERSION",
    "STATE_SCHEMA_VERSION",
    "AgentProfileSnapshot",
    "AgentProfileSnapshotState",
    "profile_for_subtask",
    "prompt_digest_of",
    "revision_of",
]
