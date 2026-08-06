"""AGENT-SEC-01: Security 数字员工。

7+1 数字员工中的「Security 员工」—— 负责权限 / 合规 / 标记（Marking）检查。
- 验证 ActionType.apply 的 submission 是否符合 Marking 要求（OTEL: Mandatory Markings）
- 检查跨租户访问（13 硬规则 #3）
- 审计 + deny/allow 决策

不接外部 IdP（Keycloak 由 SEC-IAM-01 处理）；M2 简化实现基于 Marking / tenant 比对。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

from mate_kernel.manager.protocol import Manager, ManagerContext


class Decision(str, Enum):
    ALLOW = "allow"
    DENY = "deny"
    ABSTAIN = "abstain"  # 无信息，留给上层决定


@dataclass(frozen=True, slots=True)
class MarkingRequirement:
    """资源侧要求：用户必须具备这些 marking 之一才能访问。"""
    required_markings: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class UserMarkings:
    """用户当前会话具备的 marking。"""
    user_id: str
    tenant_id: str
    markings: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class SecurityDecision:
    decision: Decision
    reason: str
    decided_at: datetime
    rule_id: str  # 命中的规则标识（审计用）


@dataclass(frozen=True, slots=True)
class SecurityRequest:
    """Security 员工接到的请求。"""
    requester: UserMarkings
    target_tenant: str
    required: MarkingRequirement
    resource_rid: str


class SecurityAgent:
    """Security 数字员工 = 规则集 + 决策记录。"""

    def __init__(self) -> None:
        self._decisions: list[SecurityDecision] = []

    def decide(self, req: SecurityRequest) -> SecurityDecision:
        # 1) 跨租户 → 拒绝（除非 requester.is_cross_tenant_admin）
        if req.requester.tenant_id != req.target_tenant:
            d = SecurityDecision(
                decision=Decision.DENY,
                reason=f"cross-tenant: requester={req.requester.tenant_id} target={req.target_tenant}",
                decided_at=datetime.now(timezone.utc),
                rule_id="R-TENANT-001",
            )
            self._decisions.append(d)
            return d

        # 2) Marking 缺失 → 拒绝
        if req.required.required_markings:
            if not any(m in req.requester.markings for m in req.required.required_markings):
                d = SecurityDecision(
                    decision=Decision.DENY,
                    reason=(
                        f"missing marking; required one of {req.required.required_markings}, "
                        f"user has {req.requester.markings}"
                    ),
                    decided_at=datetime.now(timezone.utc),
                    rule_id="R-MARK-001",
                )
                self._decisions.append(d)
                return d

        # 3) 全过 → 允许
        d = SecurityDecision(
            decision=Decision.ALLOW,
            reason="all checks passed",
            decided_at=datetime.now(timezone.utc),
            rule_id="R-ALLOW-000",
        )
        self._decisions.append(d)
        return d

    def get_audit(self) -> tuple[SecurityDecision, ...]:
        return tuple(self._decisions)


def check_action_apply(
    agent: SecurityAgent,
    ctx: ManagerContext,
    target_tenant: str,
    target_rid: str,
    required: MarkingRequirement | None = None,
    user_markings: tuple[str, ...] = (),
) -> SecurityDecision:
    """便捷封装：把 ActionType.apply 调用前先过 Security 员工。"""
    req = SecurityRequest(
        requester=UserMarkings(
            user_id=ctx.user_id,
            tenant_id=ctx.tenant_id,
            markings=user_markings,
        ),
        target_tenant=target_tenant,
        required=required or MarkingRequirement(()),
        resource_rid=target_rid,
    )
    return agent.decide(req)


__all__ = [
    "Decision",
    "MarkingRequirement",
    "SecurityAgent",
    "SecurityDecision",
    "SecurityRequest",
    "UserMarkings",
    "check_action_apply",
]
