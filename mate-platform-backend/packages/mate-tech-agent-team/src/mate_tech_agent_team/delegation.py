"""每轮运行的**派活授权**（1.9 任务 1）。

**要解决的问题**：受理制把执行放在本进程里，进程一没，在途的 run 就卡住；
续跑靠扫检查点（1.8 轨 1）。但发起用户的令牌刻意不落库，所以重启之后**没有
链根包络**——需要授权的那一步 fail-closed 转成待授权提案。安全上没错，代价是
那一轮永远跑不完。

**做法**：开跑那一刻把链根**发成一份授权**，随这一轮落进检查点；续跑时读回来，
当作本轮的链根继续派活。三条性质，每一条都有对应用例：

* **与令牌分离** —— 授权的状态形态只有四样：``run_id`` / ``granted_by`` /
  ``envelope`` / ``expires_at``。``envelope`` 是"能碰什么"的集合（工具名、
  Action rid、知识库 id、标记），**不含任何凭据**：没有 JWT、没有签名、没有
  可换发令牌的东西。原始 Bearer 一个字节都不落库。
* **按 run 发** —— 授权带 ``run_id``，只在"读它的那一轮 == 发它的那一轮"时
  成立（:meth:`RunDelegation.authorizes`）。所以它**不是一把万能钥匙**：拿到
  A 轮的授权去授权 B 轮不成立。
* **只是一条天花板** —— 它不是"批准了这些能力"，而是"这一轮的链根长这样"。
  派活仍然要过闸门的衰减判定（``子包络 ⊆ 授权``），所以续跑**做不了**原轮
  派活做不了的事。空包络的授权与"没有授权"完全等价。

**为什么不是"重启后拿服务身份自己发一份"**：那等于把链根从"发起用户"换成
"平台自己"，等于让每一次重启都把权限抬高到平台内置能力的上限——ADR-0066 §3.3
的"SuperAI 只是代用户行事，不是超级用户"就没了。

**寿命**：默认不过期（``ttl=0``）。重启之后多久还能接着跑是运维的事，不该由
代码悄悄定一个数；想收紧就配 ``MATE_AGENT_TEAM_DELEGATION_TTL_SECONDS``。

**A-2（`MP-RUN-DELEGATED-IDENTITY-01`）在此之上追加了两样**，形状不变、存储不变：

* **归属字段**（``tenant_id`` / ``subject_id`` / ``policy_version`` / ``issued_at`` /
  ``revocation_version``）——让快照自己回答"这是谁的、按哪一版口径判的"。老检查点
  读不到就取默认值，判定结果一个字节都不变。
* :func:`attenuate` —— 把快照包络收窄到**当前权限**（``委托 ⊆ 快照 ⊆ 当前`` 的
  最后一环）。权限被撤销时，新一轮委托里就没有那个维度了。

**快照仍然不是凭据**。它换不来令牌，也不能被别处拿去当身份用：换令牌那一步在
:mod:`mate_tech_agent_team.delegated_identity`，产物只活在内存里（ADR-0067 N1）。
"""

from __future__ import annotations

import os
import time
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, TypedDict

from .authority import DIMENSIONS, Envelope, EnvelopeState

#: 写进图状态的键名（决策 D-5：状态键必须声明，否则写入被静默丢弃）。
DELEGATION_STATE_KEY = "delegation"

#: 授权的寿命（秒）。0 = 不过期。
TTL_ENV = "MATE_AGENT_TEAM_DELEGATION_TTL_SECONDS"


def configured_ttl() -> float:
    """部署默认的授权寿命；读不出数字或为负都按 0（不过期）处理。"""
    try:
        return max(0.0, float(os.getenv(TTL_ENV, "0")))
    except ValueError:
        return 0.0


class DelegationState(TypedDict, total=False):
    """授权的**显式状态形态**（四样，定序，可被检查点序列化）。

    刻意用 ``total=False`` 的 TypedDict 而不是裸 ``dict``（决策 D-5）：裸 dict
    在 langgraph 的状态 schema 里是"未声明的键"，写进去会被静默丢掉。
    """

    run_id: str
    granted_by: str
    envelope: EnvelopeState
    expires_at: float
    # ── A-2 追加（老检查点读不到 → 默认值，判定结果不变）──────────────────
    tenant_id: str
    subject_id: str
    policy_version: str
    issued_at: float
    revocation_version: str


@dataclass(frozen=True, slots=True)
class RunDelegation:
    """某一轮运行的派活授权（= ADR-0067 的 ``AuthorizationSnapshot``）。

    **不是凭据**，只是这一轮的链根长什么样。换令牌是另一个模块的事。
    """

    run_id: str
    envelope: Envelope = field(default_factory=Envelope)
    #: 发起用户标识（令牌 ``sub``）。只用于审计行，不是可以在别处换东西的凭据。
    granted_by: str = ""
    #: 失效的**绝对**时刻（epoch 秒；0 = 不过期）。存绝对时刻的理由与
    #: ``deadline_at`` 一样：存"还剩多少秒"的话，重启一次就又变成相对的了。
    expires_at: float = 0.0
    # ── A-2 追加 ─────────────────────────────────────────────────────────
    tenant_id: str = ""
    #: 主体标识。留空表示"与 ``granted_by`` 同一个"（老快照就是这样）。
    subject_id: str = ""
    #: 判定口径版本（与审计行的 ``policy_version`` 同源）。
    policy_version: str = ""
    #: 签发的绝对时刻（epoch 秒）——"这份快照有多旧"要能算出来。
    issued_at: float = 0.0
    #: 权限撤销的版本号。撤销发生时由 IAM 侧推进；快照只有旧值，
    #: 所以"撤销之后要不要重新评估"由 :func:`attenuate` 按**当前权限**回答，
    #: 而不是靠这个字段自己判。
    revocation_version: str = ""

    @property
    def subject(self) -> str:
        """快照归属的主体（``subject_id`` 为空时退回 ``granted_by``）。"""
        return self.subject_id or self.granted_by

    @classmethod
    def issue(
        cls,
        *,
        run_id: str,
        envelope: Envelope,
        granted_by: str = "",
        ttl: float = 0.0,
        now: float | None = None,
        tenant_id: str = "",
        subject_id: str = "",
        policy_version: str = "",
        revocation_version: str = "",
    ) -> RunDelegation:
        """发一份给 ``run_id`` 的授权。``ttl <= 0`` = 不过期。"""
        at = time.time() if now is None else now
        expires_at = at + ttl if ttl > 0 else 0.0
        return cls(
            run_id=run_id,
            envelope=envelope,
            granted_by=granted_by,
            expires_at=expires_at,
            tenant_id=tenant_id,
            subject_id=subject_id,
            policy_version=policy_version,
            issued_at=at,
            revocation_version=revocation_version,
        )

    def authorizes(self, run_id: str, *, now: float | None = None) -> bool:
        """这份授权**是不是发给这一轮的**、且还没过期。

        两个条件是"不能跨 run 复用"与"能过期"的全部实现。刻意不在这里判
        "包络是不是空的"：空包络是合法状态（无令牌起的那一轮就是这样），它能不能
        派活由闸门的衰减判定说——这里只回答"这份授权归谁、还作不作数"。
        """
        if self.run_id != run_id:
            return False
        if self.expires_at > 0 and (time.time() if now is None else now) >= self.expires_at:
            return False
        return True

    # -- 图状态往返 --------------------------------------------------------
    def as_state(self) -> DelegationState:
        return DelegationState(
            run_id=self.run_id,
            granted_by=self.granted_by,
            envelope=self.envelope.as_state(),
            expires_at=self.expires_at,
            tenant_id=self.tenant_id,
            subject_id=self.subject_id,
            policy_version=self.policy_version,
            issued_at=self.issued_at,
            revocation_version=self.revocation_version,
        )

    @classmethod
    def of_state(cls, value: Any) -> RunDelegation | None:
        """从状态值还原；**认不出来就是"没有授权"**（fail-closed），不是崩。

        老检查点（1.8 及以前）没有这一项、手工造的垃圾值、被改坏的形态，一律
        回 ``None``——调用方据此走空包络。抛异常会让一次历史数据的形状问题变成
        一次续跑崩溃，而正确的行为是"谨慎地不授权"。

        A-2 追加字段在**老检查点里读不到**：一律取默认值，判定结果与加字段之前
        逐字一致（这是"追加字段不改行为"的落点）。
        """
        if not isinstance(value, Mapping):
            return None
        run_id = str(value.get("run_id") or "")
        if not run_id:
            return None
        try:
            expires_at = float(value.get("expires_at") or 0.0)
            issued_at = float(value.get("issued_at") or 0.0)
        except (TypeError, ValueError):
            return None
        return cls(
            run_id=run_id,
            envelope=Envelope.of_state(value.get("envelope")),
            granted_by=str(value.get("granted_by") or ""),
            expires_at=expires_at,
            tenant_id=str(value.get("tenant_id") or ""),
            subject_id=str(value.get("subject_id") or ""),
            policy_version=str(value.get("policy_version") or ""),
            issued_at=issued_at,
            revocation_version=str(value.get("revocation_version") or ""),
        )


@dataclass(frozen=True, slots=True)
class EffectiveAuthority:
    """把快照包络收窄到**当前权限**之后的结论。

    ``revoked`` 是"快照里有、当前没有了"的维度名——它是**权限撤销的可读证据**：
    审计行与用例都靠它说话，而不是靠"结果变小了"这种不可证伪的说法。
    """

    envelope: Envelope = field(default_factory=Envelope)
    revoked: tuple[str, ...] = ()

    @property
    def is_empty(self) -> bool:
        """四维全空 = 这个主体**现在**什么都碰不了。"""
        return all(not self.envelope.dimension(name) for name in DIMENSIONS)

    def as_state(self) -> dict[str, Any]:
        return {"envelope": self.envelope.as_state(), "revoked": list(self.revoked)}


def attenuate(snapshot: RunDelegation, current: Envelope) -> EffectiveAuthority:
    """``委托 ⊆ 快照 ⊆ 当前权限`` 的最后一环：逐维取交集。

    **为什么这一环必须在**：快照是开跑那一刻写下的，它记的是"当时用户能碰什么"。
    之后用户被撤了权限，快照**不会自己变**。所以重新签发之前必须先和**当前**权限
    比一次——少了这一步，"撤销"对旧 run 就是不生效的，旧 run 会一直按当年的授权
    跑下去（ADR-0067 N3）。

    交集而不是覆盖：当前权限**变大**了（比如新授了一个工具）也不给——委托只能
    ⊆ 快照，涨回去就等于绕过了快照这条链。
    """
    effective = Envelope(
        tools=snapshot.envelope.tools & current.tools,
        action_rids=snapshot.envelope.action_rids & current.action_rids,
        kb_ids=snapshot.envelope.kb_ids & current.kb_ids,
        markings=snapshot.envelope.markings & current.markings,
    )
    revoked = tuple(
        name for name in DIMENSIONS if snapshot.envelope.dimension(name) - current.dimension(name)
    )
    return EffectiveAuthority(envelope=effective, revoked=revoked)


__all__ = [
    "DELEGATION_STATE_KEY",
    "TTL_ENV",
    "DelegationState",
    "EffectiveAuthority",
    "RunDelegation",
    "attenuate",
    "configured_ttl",
]
