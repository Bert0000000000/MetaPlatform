"""composition/policy —— 运行时拦截（INTERCEPT/POLICY 最小闭环）。

能力调用前的策略判定：deny-first（任一 DENY 规则命中即拒绝，短路不执行）；
规则谓词异常按 fail-closed 处理（视为拒绝）。供 cordis 面板能力调用与
服务端点包装复用。
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class PolicyEffect(StrEnum):
    ALLOW = "allow"
    DENY = "deny"


@dataclass(frozen=True)
class PolicyRule:
    """一条策略：谓词命中时按 effect 生效（deny-first 求值）。"""

    name: str
    predicate: Callable[[dict[str, Any]], bool]
    effect: PolicyEffect = PolicyEffect.DENY


@dataclass(frozen=True)
class PolicyVerdict:
    allowed: bool
    matched: list[str] = field(default_factory=list)
    reason: str = ""


class PolicyEngine:
    """规则集 + deny-first 判定（拦截最小闭环）。"""

    def __init__(self) -> None:
        self._rules: list[PolicyRule] = []

    def register(self, rule: PolicyRule) -> None:
        self._rules.append(rule)

    def check(self, ctx: dict[str, Any]) -> PolicyVerdict:
        denied: list[str] = []
        allowed_by: list[str] = []
        for rule in self._rules:
            try:
                hit = bool(rule.predicate(ctx))
            except Exception:
                hit = True  # fail-closed：谓词异常视为命中
            if hit and rule.effect is PolicyEffect.DENY:
                denied.append(rule.name)
            elif hit:
                allowed_by.append(rule.name)
        if denied:
            return PolicyVerdict(False, denied, f"denied by: {', '.join(denied)}")
        return PolicyVerdict(True, allowed_by, "allow")


async def intercept(
    fn: Callable[..., Awaitable[Any]],
    engine: PolicyEngine,
    ctx: dict[str, Any],
    *args: Any,
    **kwargs: Any,
) -> Any:
    """能力调用拦截器：策略拒绝则抛 PolicyDenied，不执行 fn。"""
    verdict = engine.check(ctx)
    if not verdict.allowed:
        raise PolicyDenied(verdict)
    return await fn(*args, **kwargs)


class PolicyDenied(PermissionError):
    def __init__(self, verdict: PolicyVerdict) -> None:
        self.verdict = verdict
        super().__init__(verdict.reason)
