"""权限包络（Authority Envelope，ADR-0066 §3.3）。

包络是**四类集合的并**——``(tools, action_rids, kb_ids, markings)``。子集检查
因此就是集合运算，不需要另起一套判定。

不变量（能力衰减）：

```
用户权限包络  ⊇  子 agent 包络
```

链的**根是发起用户**，不是父 agent：SuperAI 只是代用户行事，不是超级用户。
所以 :class:`~mate_tech_agent_team.team_bus.TeamBus` 一律拿
``initiator_envelope`` 当天花板，父 agent 手里有没有更大的包络**不影响判定**。

「身份」与「包络」是两条正交轴（§3.3）：身份（prompt / skill 引用）低风险、
默认免审；包络（能碰什么）高风险、**扩张才审**。
"""

from __future__ import annotations

import base64
import json
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, replace
from typing import Any, TypedDict

#: 包络四维的固定顺序 —— 越权报告按此顺序出，便于断言与审计阅读。
DIMENSIONS: tuple[str, ...] = ("tools", "action_rids", "kb_ids", "markings")


class AuthorityError(Exception):
    """派活闸门拒绝。"""


class DepthExceeded(AuthorityError):
    """嵌套层数超过 ``max_depth``（1.1 任务 5）。"""

    def __init__(self, depth: int, max_depth: int) -> None:
        self.depth = depth
        self.max_depth = max_depth
        super().__init__(f"派活深度 {depth} 超过上限 {max_depth}")


@dataclass(frozen=True, slots=True)
class Envelope:
    """一个调用方能碰的东西。空包络 = 什么都碰不了（fail-closed）。"""

    tools: frozenset[str] = frozenset()
    action_rids: frozenset[str] = frozenset()
    kb_ids: frozenset[str] = frozenset()
    markings: frozenset[str] = frozenset()

    @classmethod
    def of(cls, profile: Any) -> Envelope:
        """从员工定义取包络（``EmployeeProfile.envelope()`` 的逆向）。"""
        tools, action_rids, kb_ids, markings = profile.envelope()
        return cls(tools=tools, action_rids=action_rids, kb_ids=kb_ids, markings=markings)

    def dimension(self, name: str) -> frozenset[str]:
        return getattr(self, name)

    def escalations_over(self, ceiling: Envelope) -> tuple[str, ...]:
        """哪些维度**超出**了天花板。空元组 = 只收窄或持平。"""
        return tuple(
            name for name in DIMENSIONS if not self.dimension(name) <= ceiling.dimension(name)
        )

    def is_subset_of(self, ceiling: Envelope) -> bool:
        """``self ⊆ ceiling``——等于天花板也算，不是真子集。"""
        return not self.escalations_over(ceiling)

    def narrow_tools(self, requested: Sequence[str] | None) -> Envelope:
        """按调用方给的 ``tool_scope`` 收窄工具面。

        收窄是**交集**：写进一个上级没有的工具不会因此拿到它——这正是
        「只能收窄，不能扩」的实现方式（ADR-0066 §5.2）。
        """
        if not requested:
            return self
        return replace(self, tools=self.tools & frozenset(requested))

    # -- 图状态往返 --------------------------------------------------------
    def as_state(self) -> EnvelopeState:
        """进图状态用的显式形态（四维定序，可被 JSON/msgpack 检查点序列化）。"""
        return EnvelopeState(
            tools=sorted(self.tools),
            action_rids=sorted(self.action_rids),
            kb_ids=sorted(self.kb_ids),
            markings=sorted(self.markings),
        )

    @classmethod
    def of_state(cls, state: Mapping[str, Any] | None) -> Envelope:
        data = state or {}
        return cls(
            tools=frozenset(data.get("tools") or ()),
            action_rids=frozenset(data.get("action_rids") or ()),
            kb_ids=frozenset(data.get("kb_ids") or ()),
            markings=frozenset(data.get("markings") or ()),
        )


class EnvelopeState(TypedDict, total=False):
    """包络的**显式状态形态**（决策 D-5：状态键必须声明，否则写入被静默丢弃）。"""

    tools: list[str]
    action_rids: list[str]
    kb_ids: list[str]
    markings: list[str]


# ── 发起用户包络：从令牌的角色与标记解析（ADR-0066 §3.3）──────────────────
#
# 链的**根是发起用户**：SuperAI 只是代用户行事。所以"用户能碰什么"不能从
# 员工定义里读，只能从**它自己的令牌**里解析——角色给基线，标记给增量。
#
# 解析**不重新验签**：令牌已由认证中间件（``install_auth``）验过签名，本服务
# 的所有入口都在那之后。绕过中间件直接构造服务层不是受支持的用法。

#: 权限（标记）的维度前缀 —— ``tool:ont_object_query`` / ``kb:kb-orders`` …
PERMISSION_DIMENSION_PREFIXES: Mapping[str, str] = {
    "tool": "tools",
    "tools": "tools",
    "action": "action_rids",
    "kb": "kb_ids",
    "marking": "markings",
    "markings": "markings",
}

#: 角色 → 能力基线名。**具名基线**而不是直接写死集合：读起来是"这个角色
#: 拿到哪一档"，而不是一长串工具名。
_ROLE_BASELINES: Mapping[str, str] = {
    "PLATFORM_SUPER_ADMIN": "builtin_ceiling",
    "PLATFORM_ADMIN": "builtin_ceiling",
    "platform_admin": "builtin_ceiling",
    "agent_admin": "builtin_ceiling",
    "platform_user": "read_baseline",
    "agent_viewer": "read_baseline",
}

#: 登录用户的读基线：本体只读工具 + 技能读取。**不含**任何写动作 / 知识库 /
#: 标记 —— 那三样必须由令牌显式授予。
_READ_BASELINE = (
    "ont_list_classes",
    "ont_inspect_class",
    "ont_object_query",
    "search_skill",
    "read_skill",
)


def _builtin_ceiling() -> Envelope:
    """平台**内置员工**能力集的并 —— 发布出去的能力，管理员角色默认持有。

    刻意从 ``builtin_profiles()`` 现算而不是抄一份常量：抄一份就会与内置
    员工的实际工具面漂移，而漂移的方向恰好是"闸门放行了一个其实没人有的
    工具"。
    """
    from .profiles import builtin_profiles

    envelope = Envelope()
    for profile in builtin_profiles():
        tools, action_rids, kb_ids, markings = profile.envelope()
        envelope = Envelope(
            tools=envelope.tools | tools,
            action_rids=envelope.action_rids | action_rids,
            kb_ids=envelope.kb_ids | kb_ids,
            markings=envelope.markings | markings,
        )
    return envelope


def _baseline(name: str) -> Envelope:
    if name == "builtin_ceiling":
        return _builtin_ceiling()
    return Envelope(tools=frozenset(_READ_BASELINE))


def claims_of(token: str) -> dict[str, Any]:
    """解出 JWT 的声明（**不验签**，见上）。解不出来就回空字典。"""
    parts = (token or "").split(".")
    if len(parts) != 3:
        return {}
    payload = parts[1]
    try:
        raw = base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))
        data = json.loads(raw)
    except Exception:  # 令牌不是给我们解析的形态 → 当作没有声明
        return {}
    return data if isinstance(data, dict) else {}


def _roles_of(claims: Mapping[str, Any]) -> frozenset[str]:
    roles: set[str] = set()
    for claim in ("roles", "realm_access", "resource_access"):
        value = claims.get(claim)
        if isinstance(value, list):
            roles.update(str(r) for r in value)
        elif isinstance(value, dict):
            if claim == "realm_access":
                roles.update(str(r) for r in (value.get("roles") or []))
            else:  # resource_access: {client: {"roles": [...]}}
                for entry in value.values():
                    if isinstance(entry, dict):
                        roles.update(str(r) for r in (entry.get("roles") or []))
    return frozenset(roles)


def _permissions_of(claims: Mapping[str, Any]) -> frozenset[str]:
    raw = claims.get("permissions")
    if not isinstance(raw, list):
        return frozenset()
    return frozenset(str(p) for p in raw)


def envelope_from_claims(*, roles: Iterable[str], permissions: Iterable[str]) -> Envelope:
    """角色给基线，标记给增量；两者都认不出来就是**空包络**。"""
    envelope = Envelope()
    for role in roles:
        name = _ROLE_BASELINES.get(role)
        if name is None:
            continue
        envelope = Envelope(
            tools=envelope.tools | _baseline(name).tools,
            action_rids=envelope.action_rids | _baseline(name).action_rids,
            kb_ids=envelope.kb_ids | _baseline(name).kb_ids,
            markings=envelope.markings | _baseline(name).markings,
        )
    for permission in permissions:
        prefix, _, value = str(permission).partition(":")
        dimension = PERMISSION_DIMENSION_PREFIXES.get(prefix)
        if dimension is None or not value:
            continue  # 没带维度前缀的标记（如 platform.read）不是能力授权
        envelope = replace(envelope, **{dimension: envelope.dimension(dimension) | {value}})
    return envelope


def resolve_initiator_envelope(token: str) -> Envelope:
    """发起用户的权限包络 —— 派活链的天花板。

    **没有令牌 = 建立不起链根 = 空包络**（fail-closed）。这不是"默认全给"：
    要是这里回落到一个宽松默认值，闸门就退化成了装饰品。
    """
    claims = claims_of(token)
    if not claims:
        return Envelope()
    return envelope_from_claims(roles=_roles_of(claims), permissions=_permissions_of(claims))


def actor_of(token: str) -> str:
    """发起用户的标识（``sub``，回落 ``preferred_username``）—— 只给审计行用。

    解不出就是空串：审计行宁可记"不知道是谁"，也不要记一个猜出来的名字。
    """
    claims = claims_of(token)
    return str(claims.get("sub") or claims.get("preferred_username") or "")


def roles_of(token: str) -> frozenset[str]:
    """令牌里的角色集合（**不验签**，同 :func:`claims_of` 的前提）。"""
    return _roles_of(claims_of(token))


__all__ = [
    "DIMENSIONS",
    "PERMISSION_DIMENSION_PREFIXES",
    "AuthorityError",
    "DepthExceeded",
    "Envelope",
    "EnvelopeState",
    "actor_of",
    "claims_of",
    "envelope_from_claims",
    "resolve_initiator_envelope",
    "roles_of",
]
