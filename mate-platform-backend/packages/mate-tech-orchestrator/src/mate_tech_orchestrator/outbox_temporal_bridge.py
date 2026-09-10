"""outbox → Temporal 桥（ADR-0061 Sprint 1A M2 · SAL-05 P2 通道②）。

职责：把 outbox 中 pending 的事件按 ``TRIGGER_RULES`` 映射为 PlanWorkflow
启动（body 里带 steps），成功后 ``mark_published``，失败计一次 attempt 留给
下一轮。与 :class:`OutboxRelay` 同构 —— relay 把事件送 Kafka，本桥把事件送
Temporal workflow；两者可并存（Kafka 广播 + Temporal 编排）。

设计边界（M2 范围）：
- 触发规则显式白名单（event_type → steps 模板），未命中事件不动；
- workflow 启动经 ``WorkflowStarter`` Protocol 注入，桥本体不 import
  temporalio —— 单测用 fake starter，worker/服务端注入真 starter；
- 至少一次语义：start 成功即 mark_published（Temporal client.start 的
  幂等由 workflow id 模板保证：``outbox-{event_id}`` 重复启动同 id 会被
  Temporal 拒绝，等效去重）。
"""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol

import structlog

from mate_platform.messaging.events import Event
from mate_platform.messaging.outbox import OutboxWriter

logger = structlog.get_logger(__name__)


class WorkflowStarter(Protocol):
    """Temporal 侧启动器（由 temporalio Client 适配）。"""

    async def start_plan(
        self, *, workflow_id: str, steps: list[dict[str, Any]],
        tenant_id: str, author_user_id: str, token: str = "",
    ) -> str:
        """启动 PlanWorkflow，返回 workflow id。"""
        ...


# event_type → steps 模板（占位符 {aggregate_id} / {payload.<key>} 由桥解析）
TRIGGER_RULES: dict[str, tuple[dict[str, Any], ...]] = {
    # 示例默认规则：订单超过阈值 → 标记待复核（北极星场景的事件入口）
    "order.review.requested": (
        {
            "step_id": "s1",
            "kind": "propose",
            "target": "ont.tenant-default.obj.employee.v1",
            "payload": {
                "action_kind": "create_instance",
                "props": {"emp-id": "{payload.order_id}",
                          "name": "auto-review", "dept": "auto"},
            },
        },
    ),
}


def _render(template: Any, event: Event) -> Any:
    if isinstance(template, str):
        out = template.replace("{aggregate_id}", event.aggregate_id)
        for k, v in event.payload.items():
            out = out.replace("{payload.%s}" % k, str(v))
        return out
    if isinstance(template, dict):
        return {k: _render(v, event) for k, v in template.items()}
    if isinstance(template, (list, tuple)):
        return [_render(v, event) for v in template]
    return template


class OutboxTemporalBridge:
    """Drain pending outbox events into Temporal PlanWorkflow starts."""

    def __init__(
        self,
        outbox: OutboxWriter,
        starter: WorkflowStarter,
        *,
        rules: Mapping[str, tuple[dict[str, Any], ...]] | None = None,
        author_user_id: str = "outbox-bridge",
    ) -> None:
        self._outbox = outbox
        self._starter = starter
        self._rules: Mapping[str, tuple[dict[str, Any], ...]] = rules or TRIGGER_RULES
        self._author = author_user_id

    async def relay_once(self, *, limit: int = 100) -> dict[str, int]:
        """处理一批 pending 事件。返回 {started, skipped, failed}。"""
        started = skipped = failed = 0
        for record in self._outbox.fetch_pending(limit=limit):
            event = record.event
            steps_tpl = self._rules.get(event.type)
            if steps_tpl is None:
                # 非触发事件：不消费（留给 Kafka relay），但也不再重复扫描
                skipped += 1
                continue
            steps = [_render(dict(t), event) for t in steps_tpl]
            try:
                await self._starter.start_plan(
                    workflow_id=f"outbox-{event.id}",
                    steps=steps,
                    tenant_id=event.tenant_id,
                    author_user_id=self._author,
                )
            except Exception as exc:
                failed += 1
                self._outbox.mark_attempt_failed(event.id, str(exc))
                logger.warning(
                    "outbox.temporal.start_failed",
                    event_id=event.id, event_type=event.type, error=str(exc),
                )
                continue
            self._outbox.mark_published(event.id)
            started += 1
            logger.info(
                "outbox.temporal.started",
                event_id=event.id, event_type=event.type,
            )
        return {"started": started, "skipped": skipped, "failed": failed}
