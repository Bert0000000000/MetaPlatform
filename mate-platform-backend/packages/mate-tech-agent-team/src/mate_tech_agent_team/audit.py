"""Agent Team 审计面（硬规则 #9）。

派活、越权转 proposal、审批三件事各落一行。**为什么单独成面**：1.3 这三件事
一件都没记——派人干活不留痕，事后问"谁派的、谁批的、批的是什么"答不上来。
硬规则 #9 要的正是这个。

**复刻既有平台做法**（不另造）：

* :class:`~mate_kernel.action.engine.ActionService` 的 ``_audit``：类型化记录
  ＋ append-only ＋ 可列举，``audit_id`` 带进程唯一前缀（免得重启后与库里既有
  行撞主键）；
* :mod:`mate_platform.tenancy.audit` 的 ``metaplatform.audit`` logger：同一份
  记录同时走结构化日志，SRE 在日志侧也能看见。

**刻意不落 PG**：审计行与任务实例（``team_task``，RLS 强制）不同，它是**观测
证据**而不是业务状态；这一版随进程生灭，与 1.3 的运行控制面（超时记在进程内）
同一条边界。要跨进程留存时，接的是既有的 outbox / OTel 通道，而不是新开一张表。
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger("metaplatform.audit.agent_team")

#: 被审计的动作。
AUDIT_SPAWN = "agent_team.spawn"
AUDIT_ESCALATION = "agent_team.authority_escalation"
AUDIT_APPROVAL = "agent_team.approval"


#: 记录时间的可序列化形态（与 ``CrossTenantAccess.timestamp`` 同口径）。
def _now() -> str:
    return datetime.now(UTC).isoformat()


@dataclass(frozen=True, slots=True)
class AuditRecord:
    """一行审计。字段刻意与 ``SubmissionContext`` 的审计口径对齐（actor / tenant）。"""

    audit_id: str
    action: str
    tenant_id: str
    actor: str
    task_id: str
    run_id: str
    profile_id: str
    outcome: str
    at: str
    detail: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "audit_id": self.audit_id,
            "action": self.action,
            "tenant_id": self.tenant_id,
            "actor": self.actor,
            "task_id": self.task_id,
            "run_id": self.run_id,
            "profile_id": self.profile_id,
            "outcome": self.outcome,
            "detail": dict(self.detail),
            "at": self.at,
        }


class AuditLog:
    """append-only 的进程内审计账本。

    ``audit_id`` 带进程唯一前缀（沿用 ``ActionService`` 的 ``_AUDIT_TAG`` 做法）：
    纯计数器在重启后会与库里既有行撞主键；带前缀至少保证"这次进程的行"可分辨。
    """

    def __init__(self, *, max_records: int = 10_000) -> None:
        self._tag = uuid.uuid4().hex[:6]
        self._records: list[AuditRecord] = []
        self._max_records = max_records

    def append(
        self,
        *,
        action: str,
        tenant_id: str,
        actor: str = "",
        task_id: str = "",
        run_id: str = "",
        profile_id: str = "",
        outcome: str = "",
        detail: dict[str, Any] | None = None,
    ) -> AuditRecord:
        record = AuditRecord(
            audit_id=f"audit-{self._tag}-{len(self._records) + 1}",
            action=action,
            tenant_id=tenant_id,
            actor=actor,
            task_id=task_id,
            run_id=run_id,
            profile_id=profile_id,
            outcome=outcome,
            at=_now(),
            detail=dict(detail or {}),
        )
        self._records.append(record)
        if len(self._records) > self._max_records:
            del self._records[: len(self._records) - self._max_records]
        # 结构化日志侧同出一份（``metaplatform.audit.*`` 是既有的审计通道）。
        logger.info(record.action, extra=record.to_dict())
        return record

    def records(
        self,
        *,
        tenant_id: str | None = None,
        task_id: str | None = None,
        run_id: str | None = None,
        action: str | None = None,
    ) -> list[AuditRecord]:
        """按条件列行（时间序）。租户过滤是**必守**的调用方责任，默认全给。"""
        return [
            r
            for r in self._records
            if (tenant_id is None or r.tenant_id == tenant_id)
            and (task_id is None or r.task_id == task_id)
            and (run_id is None or r.run_id == run_id)
            and (action is None or r.action == action)
        ]

    def __len__(self) -> int:
        return len(self._records)


def actions_of(records: Sequence[AuditRecord]) -> list[str]:
    return [r.action for r in records]


__all__ = [
    "AUDIT_APPROVAL",
    "AUDIT_ESCALATION",
    "AUDIT_SPAWN",
    "AuditLog",
    "AuditRecord",
    "actions_of",
]
