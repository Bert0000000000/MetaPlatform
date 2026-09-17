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
"""

from __future__ import annotations

import os
import time
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, TypedDict

from .authority import Envelope, EnvelopeState

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


@dataclass(frozen=True, slots=True)
class RunDelegation:
    """某一轮运行的派活授权。**不是凭据**，只是这一轮的链根长什么样。"""

    run_id: str
    envelope: Envelope = field(default_factory=Envelope)
    #: 发起用户标识（令牌 ``sub``）。只用于审计行，不是可以在别处换东西的凭据。
    granted_by: str = ""
    #: 失效的**绝对**时刻（epoch 秒；0 = 不过期）。存绝对时刻的理由与
    #: ``deadline_at`` 一样：存"还剩多少秒"的话，重启一次就又变成相对的了。
    expires_at: float = 0.0

    @classmethod
    def issue(
        cls,
        *,
        run_id: str,
        envelope: Envelope,
        granted_by: str = "",
        ttl: float = 0.0,
        now: float | None = None,
    ) -> RunDelegation:
        """发一份给 ``run_id`` 的授权。``ttl <= 0`` = 不过期。"""
        at = time.time() if now is None else now
        expires_at = at + ttl if ttl > 0 else 0.0
        return cls(run_id=run_id, envelope=envelope, granted_by=granted_by, expires_at=expires_at)

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
        )

    @classmethod
    def of_state(cls, value: Any) -> RunDelegation | None:
        """从状态值还原；**认不出来就是"没有授权"**（fail-closed），不是崩。

        老检查点（1.8 及以前）没有这一项、手工造的垃圾值、被改坏的形态，一律
        回 ``None``——调用方据此走空包络。抛异常会让一次历史数据的形状问题变成
        一次续跑崩溃，而正确的行为是"谨慎地不授权"。
        """
        if not isinstance(value, Mapping):
            return None
        run_id = str(value.get("run_id") or "")
        if not run_id:
            return None
        try:
            expires_at = float(value.get("expires_at") or 0.0)
        except (TypeError, ValueError):
            return None
        return cls(
            run_id=run_id,
            envelope=Envelope.of_state(value.get("envelope")),
            granted_by=str(value.get("granted_by") or ""),
            expires_at=expires_at,
        )


__all__ = [
    "DELEGATION_STATE_KEY",
    "TTL_ENV",
    "DelegationState",
    "RunDelegation",
    "configured_ttl",
]
