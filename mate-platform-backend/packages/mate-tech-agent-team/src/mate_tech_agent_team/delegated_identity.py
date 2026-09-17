"""运行期委托身份：**现签一份 per-run 短期令牌**（ADR-0067 / `MP-RUN-DELEGATED-IDENTITY-01`）。

**要解决的问题**：1.9 让续跑拿回了"派活授权的链根"，但那只是**授权**——员工真去
调 llmgw / MCP 时用的仍是**服务身份**（或者干脆空的）。上游按令牌解析租户与权限，
于是续跑那一轮跑出来的东西**不是以发起用户的名义**做的。

**做法**（ADR-0067 §2）：落库的 `AuthorizationSnapshot` 不含任何凭据；要用的时候
**由 IAM 现签**一份 per-run 短期委托令牌，只活在内存里。签发走 **Keycloak token
exchange**（RFC 8693）——平台已经跑着 Keycloak，不自造签名服务。

**四条不变量怎么落地的**：

* **N1 不落原始 Bearer** —— 快照在 :mod:`.delegation`（无凭据）；本模块的产物
  :class:`DelegatedCredential` 只进 ``RunContext`` 的**内存字段**，没有任何一条
  把它写进检查点/库/审计的路径。
* **N2 委托 ⊆ 快照 ⊆ 当前权限** —— 换回来的令牌**解出来的包络**若不 ⊆ 快照包络，
  **拒签**（不是"照用"）。它比快照小是正常的（权限被撤了就该小）。
* **N3 每次重新评估** —— 令牌寿命短（默认 300s）且**每次要用时现签**，不缓存到
  run 结束。撤销因此当场生效。
* **N4 签不出就不假装** —— 任何一步不成立都返回带 ``reason`` 的**拒绝**，调用方
  据此保持 ``user_token=""``，**绝不退回服务身份冒充用户**。这一条是本模块与
  "顺手把服务身份接上去"的分界线（ADR-0066 §3.3）。

**未配置时**：:class:`UnconfiguredIssuer` 一律拒绝，行为与 2.0 **逐字一致**
（续跑没有用户身份），只是多一条可读的拒绝原因——不是静默退化。
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from typing import Any, Protocol

from mate_clients.iam.token_exchange import (
    TOKEN_EXCHANGE_GRANT,
    HttpPoster,
    KeycloakTokenExchangeClient,
)

from .authority import Envelope, claims_of, resolve_initiator_envelope
from .delegation import RunDelegation, attenuate

#: 委托令牌的默认寿命（秒）。**短**是 N3 的实现方式：每次要用时现签，
#: 撤销因此在下一次签发时就生效，不需要撤销列表。
DEFAULT_DELEGATION_TOKEN_TTL_SECONDS = 300.0
TTL_ENV = "MATE_AGENT_TEAM_DELEGATION_TOKEN_TTL_SECONDS"

#: **开关**：没配这个变量 = 不签发（与 2.0 逐字一致）。配了它的部署必须同时
#: 配好 Keycloak 侧的 token exchange 权限，否则每次签发都会如实失败。
ENABLE_ENV = "MATE_AGENT_TEAM_TOKEN_EXCHANGE"

#: 换回来的令牌要发给谁（``audience``）。空 = 不带该参数（Keycloak 自己判）。
AUDIENCE_ENV = "MATE_AGENT_TEAM_TOKEN_EXCHANGE_AUDIENCE"


def configured_ttl() -> float:
    try:
        return max(0.0, float(os.getenv(TTL_ENV, str(DEFAULT_DELEGATION_TOKEN_TTL_SECONDS))))
    except ValueError:
        return DEFAULT_DELEGATION_TOKEN_TTL_SECONDS


@dataclass(frozen=True, slots=True)
class DelegatedCredential:
    """一份**只在内存里活**的短期委托令牌。

    刻意**没有** ``to_dict`` / ``as_state``：给不出"把它序列化下来"的做法，
    就不会有人不小心把它写进检查点（N1）。
    """

    token: str
    subject_id: str
    tenant_id: str
    envelope: Envelope = field(default_factory=Envelope)
    expires_at: float = 0.0
    source: str = ""

    def is_valid(self, *, now: float | None = None) -> bool:
        if not self.token:
            return False
        return self.expires_at <= 0 or (time.time() if now is None else now) < self.expires_at


@dataclass(frozen=True, slots=True)
class DelegationOutcome:
    """签发结果：拿到了凭据，或者**一个可读的拒绝原因**（N4）。"""

    credential: DelegatedCredential | None = None
    reason: str = ""

    @property
    def issued(self) -> bool:
        return self.credential is not None

    def to_audit_detail(self) -> dict[str, Any]:
        """落审计行用的形态——**不含令牌**（N1 在审计这一侧的落点）。"""
        return {
            "issued": self.issued,
            "reason": self.reason,
            "subject_id": self.credential.subject_id if self.credential else "",
            "expires_at": self.credential.expires_at if self.credential else 0.0,
            "source": self.credential.source if self.credential else "",
        }


class DelegationIssuer(Protocol):
    """签发面（ADR-0067 §4）。**返回拒绝而不是抛异常**——"签不出"是正常状态。"""

    async def issue(
        self, snapshot: RunDelegation, *, now: float | None = None
    ) -> DelegationOutcome: ...


class UnconfiguredIssuer:
    """没配 token exchange 的部署：一律拒绝，且**说得出为什么**。"""

    async def issue(
        self, snapshot: RunDelegation, *, now: float | None = None
    ) -> DelegationOutcome:
        del snapshot, now
        return DelegationOutcome(
            reason=f"未配置 token exchange（{ENABLE_ENV}）：续跑不带用户身份（与 2.0 一致）"
        )


def _tenant_of(token: str) -> str:
    claims = claims_of(token)
    tenant = claims.get("tenant_id")
    if isinstance(tenant, list):
        tenant = tenant[0] if tenant else ""
    return str(tenant or "")


def _is_empty(envelope: Envelope) -> bool:
    """四维全空。"""
    return not (envelope.tools or envelope.action_rids or envelope.kb_ids or envelope.markings)


class KeycloakTokenExchangeIssuer:
    """RFC 8693 的 token exchange，**出站走 :mod:`mate_clients.iam.token_exchange`**。

    **怎么在没有用户令牌的前提下换到用户身份**：用**服务身份**（既有
    ``BearerAuth`` 的 client_credentials）做 ``subject_token`` +
    ``requested_subject=<发起用户>`` 请求交换。这是 Keycloak 侧的授权链：服务
    client 必须被授予 token-exchange 权限，否则交换被拒——**那是配置问题，
    不是代码问题**，所以这里如实反映成一次拒绝（带 IdP 的错误码）。

    **HTTP 不在这里**（硬规则 #4）：协议细节收在 ACL 客户端里，本类只做判定
    ——换回来的令牌够不够、对不对租户、是不是超出快照。``client`` / ``http``
    可注入，测试因此既不必起 Keycloak，也不必发真 HTTP。
    """

    def __init__(
        self,
        *,
        token_uri: str,
        client_id: str,
        client_secret: str,
        audience: str = "",
        ttl: float | None = None,
        timeout: float = 10.0,
        client: KeycloakTokenExchangeClient | None = None,
        http: HttpPoster | None = None,
    ) -> None:
        self._audience = audience
        self._ttl = configured_ttl() if ttl is None else max(0.0, ttl)
        self._client = client or KeycloakTokenExchangeClient(
            token_uri=token_uri,
            client_id=client_id,
            client_secret=client_secret,
            timeout=timeout,
            http=http,
        )

    async def issue(
        self, snapshot: RunDelegation, *, now: float | None = None
    ) -> DelegationOutcome:
        at = time.time() if now is None else now
        if not snapshot.subject:
            # 没有主体就没有"以谁的名义"——无令牌起的那一轮正是这样，与"没有授权"等价。
            return DelegationOutcome(reason="快照没有主体标识（无令牌起的那一轮）")

        try:
            exchanged = await self._client.exchange(
                subject=snapshot.subject, audience=self._audience
            )
        except Exception as exc:
            # 如实带上 IdP 的错误（invalid_grant / access_denied …）：那是排障的唯一线索。
            return DelegationOutcome(reason=f"token exchange 失败：{exc}")

        token = exchanged.access_token
        granted = resolve_initiator_envelope(token)
        if not granted.is_subset_of(snapshot.envelope):
            # N2：换回来的令牌**比快照还大** = 这次交换给了超出授权的权限。
            # 照用等于把"委托 ⊆ 快照"这条链交给 IdP 的配置去保证，所以直接拒签。
            return DelegationOutcome(reason="换回的令牌权限超出快照（拒绝：委托必须 ⊆ 快照）")

        tenant = _tenant_of(token)
        if tenant and snapshot.tenant_id and tenant != snapshot.tenant_id:
            return DelegationOutcome(reason=f"换回的令牌租户不符（{tenant}）")

        effective = attenuate(snapshot, granted)
        if effective.is_empty and not _is_empty(snapshot.envelope):
            # N3 的可观测形态：快照当时有权限，现在一点交集都没有 = 权限被撤空了。
            return DelegationOutcome(reason="当前权限与快照无交集（权限已被撤销）")

        ttl = self._ttl
        if exchanged.expires_in > 0:
            ttl = min(ttl, exchanged.expires_in) if ttl > 0 else exchanged.expires_in
        return DelegationOutcome(
            credential=DelegatedCredential(
                token=token,
                subject_id=snapshot.subject,
                tenant_id=snapshot.tenant_id,
                envelope=effective.envelope,
                expires_at=(at + ttl) if ttl > 0 else 0.0,
                source="keycloak-token-exchange",
            )
        )


__all__ = [
    "AUDIENCE_ENV",
    "DEFAULT_DELEGATION_TOKEN_TTL_SECONDS",
    "ENABLE_ENV",
    "TOKEN_EXCHANGE_GRANT",
    "TTL_ENV",
    "DelegatedCredential",
    "DelegationIssuer",
    "DelegationOutcome",
    "KeycloakTokenExchangeIssuer",
    "UnconfiguredIssuer",
    "configured_ttl",
]
