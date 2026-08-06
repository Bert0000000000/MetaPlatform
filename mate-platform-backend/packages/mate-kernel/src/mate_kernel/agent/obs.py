"""AGENT-OBS-01: Observability 数字员工。

7+1 中的「OBS 员工」—— 订阅 OTel metric / log，定义告警规则，触发 ActionType.apply
（自动告警 / 自愈）。
- AlertRule：metric/log 表达式 + 阈值 + ActionType 触发器
- AlertEvent：触发记录（带 severity / state）
- Dashboard：聚合面板定义（rid 占位）

rid 前缀 `obs.<tenant>.alert.<slug>.v<n>` / `obs.<tenant>.dashboard.<slug>.v<n>`。
M3 范围：内存版规则引擎；OTel SDK 接入在平台层（PLATFORM-EVENT-01 已铺好）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

from mate_kernel.action.engine import ActionService, SubmissionContext
from mate_kernel.manager.protocol import Manager, ManagerContext


class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertState(str, Enum):
    PENDING = "pending"
    FIRING = "firing"
    RESOLVED = "resolved"
    SILENCED = "silenced"


class Comparator(str, Enum):
    GT = ">"
    GTE = ">="
    LT = "<"
    LTE = "<="
    EQ = "=="
    NEQ = "!="


@dataclass(frozen=True, slots=True)
class AlertRule:
    rule_rid: str  # obs.<tenant>.alert.<slug>.v<n>
    name: str
    metric_name: str  # e.g. "http.server.duration", "k8s.pod.restarts"
    comparator: Comparator
    threshold: float
    severity: AlertSeverity
    action_rid: str | None = None  # 触发后调用哪个 ActionType.apply
    for_duration_seconds: int = 0  # 持续时间窗口
    enabled: bool = True


@dataclass(frozen=True, slots=True)
class AlertEvent:
    event_id: str
    rule_rid: str
    state: AlertState
    severity: AlertSeverity
    observed_value: float
    fired_at: datetime
    resolved_at: datetime | None = None
    message: str = ""


@dataclass(frozen=True, slots=True)
class DashboardSpec:
    dashboard_rid: str  # obs.<tenant>.dashboard.<slug>.v<n>
    name: str
    panels: tuple[str, ...]  # metric 名列表
    layout: str = "grid"


class ObservabilityAgent:
    """OBS 数字员工 = 规则注册 + metric feed 注入 + 触发 ActionType。"""

    def __init__(self, action_service: ActionService | None = None) -> None:
        self.actions = action_service or ActionService()
        self._rules: dict[str, AlertRule] = {}
        self._dashboards: dict[str, DashboardSpec] = {}
        self._events: list[AlertEvent] = []
        self._counter = 0

    def register_rule(self, rule: AlertRule, manager: Manager) -> None:
        if rule.rule_rid in self._rules:
            raise ValueError(f"rule already registered: {rule.rule_rid}")
        self._rules[rule.rule_rid] = rule
        manager.track(
            kind=__import__("mate_kernel.manager.protocol", fromlist=["ChangeKind"]).ChangeKind.REGISTER_CLASS,
            target_rid=rule.rule_rid,
            payload={"severity": rule.severity.value, "metric": rule.metric_name},
        )

    def register_dashboard(self, dash: DashboardSpec) -> None:
        self._dashboards[dash.dashboard_rid] = dash

    def evaluate(self, metric_name: str, value: float) -> tuple[AlertEvent, ...]:
        """评估所有匹配 metric 的规则，返回新事件。"""
        out: list[AlertEvent] = []
        for rule in self._rules.values():
            if not rule.enabled or rule.metric_name != metric_name:
                continue
            fired = self._compare(value, rule.comparator, rule.threshold)
            if not fired:
                continue
            self._counter += 1
            event = AlertEvent(
                event_id=f"alert-{self._counter}",
                rule_rid=rule.rule_rid,
                state=AlertState.FIRING,
                severity=rule.severity,
                observed_value=value,
                fired_at=datetime.now(timezone.utc),
                message=f"{rule.name}: {metric_name}={value} {rule.comparator.value} {rule.threshold}",
            )
            self._events.append(event)
            out.append(event)
        return tuple(out)

    def resolve_all(self, metric_name: str) -> int:
        """模拟自愈：把所有 metric 对应的 firing 事件标 resolved。"""
        n = 0
        for i, ev in enumerate(self._events):
            if ev.state == AlertState.FIRING:
                rule = self._rules.get(ev.rule_rid)
                if rule and rule.metric_name == metric_name:
                    self._events[i] = AlertEvent(
                        event_id=ev.event_id,
                        rule_rid=ev.rule_rid,
                        state=AlertState.RESOLVED,
                        severity=ev.severity,
                        observed_value=ev.observed_value,
                        fired_at=ev.fired_at,
                        resolved_at=datetime.now(timezone.utc),
                        message=ev.message,
                    )
                    n += 1
        return n

    def trigger_action(self, event: AlertEvent, ctx: ManagerContext) -> str | None:
        rule = self._rules.get(event.rule_rid)
        if rule is None or rule.action_rid is None:
            return None
        outcome = self.actions.apply(
            action_rid=rule.action_rid,
            submission_criteria=(),
            function_ref=rule.action_rid,
            on_rid=rule.action_rid,
            target_iid=None,
            parameters={"event_id": event.event_id, "metric_value": event.observed_value},
            side_effects=(),
            ctx=SubmissionContext(
                actor="obs-agent",
                sandbox_id="obs-" + rule.rule_rid,
                tenant_id=ctx.tenant_id,
                correlation_id=event.event_id,
            ),
        )
        return outcome.audit_id

    @staticmethod
    def _compare(value: float, op: Comparator, threshold: float) -> bool:
        if op == Comparator.GT:
            return value > threshold
        if op == Comparator.GTE:
            return value >= threshold
        if op == Comparator.LT:
            return value < threshold
        if op == Comparator.LTE:
            return value <= threshold
        if op == Comparator.EQ:
            return value == threshold
        if op == Comparator.NEQ:
            return value != threshold
        return False


__all__ = [
    "AlertEvent",
    "AlertRule",
    "AlertSeverity",
    "AlertState",
    "Comparator",
    "DashboardSpec",
    "ObservabilityAgent",
]
