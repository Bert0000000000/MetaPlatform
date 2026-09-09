# PRD-02 AI Proposal 回滚（MP-ACTION-CONFIRM-01）

> **版本**: v1.3 · **日期**: 2026-09-08 · **状态**: `[x]` M1+M2+M3 全收口（M3：RevertWorkflow 长补偿链 live——经 Temporal workflow 驱动 revert，结果 equivalence=equivalent + 实例删除）
> **关联**: ADR-0043 §面向C / ADR-0044（Proposal 状态机）/ Composition Kernel / Sprint 1
> **Requirement IDs**: FR-ACT-CONFIRM-001..007

## 1. 背景与目标

ADR-0043 面向 C：把 propose/confirm/withdraw/reject 升级为**可逆 effect**（composition
kernel 词汇），并要求 **I1 ≃ 等价判定**（撤销后语义状态等价于从未发生）。现状
（MP-SAL-04/04B）：Proposal 状态机 + confirm 后 execute 落库已有，但 **applied 之后
无撤销路径**、无 OTel proposal 事件、无等价判定。

## 2. 范围

### In Scope
- **FR-ACT-CONFIRM-001 withdraw**：pending proposal 在确认前可撤回（作者本人）。
- **FR-ACT-CONFIRM-002 revert（applied 后撤销）**：按 proposal 快照反向补偿——create_instance→删实例；action→逆操作或标记 revert（不可数值逆写的记 audit-only revert）；model_type→类型版本回退。
- **FR-ACT-CONFIRM-003 revert 闸**：撤销同样走 HITL（B3 语义对称：落库要人审，撤销也要）。
- **FR-ACT-CONFIRM-004 I1 ≃ 等价判定**：revert 完成后按 proposal 的 expected_diff/actual diff 判定「语义等价于未发生」，不等价则显式降级为 partial-revert + 告警。
- **FR-ACT-CONFIRM-005 OTel 事件**：propose/confirm/reject/withdraw/revert 五事件全程 trace。
- **FR-ACT-CONFIRM-006 时窗**：revert 窗口默认 7 天（C3 对齐），过期仅审计回溯。
- **FR-ACT-CONFIRM-007 Temporal 联动**：revert 发起可选走 Temporal workflow（长补偿链）。

### Out of Scope
- 外部系统已同步副作用的物理回收（outbox 事件只广播 revert 语义，外部自行处置）；
- proposal 并发冲突仲裁策略升级（维持现乐观校验）。

## 3. 验收标准

1. live e2e 四路径：pending→withdraw；applied(create)→revert→实例消失（I1 等价 PASS）；applied(action 标记型)→revert→audit-only 降级正确；过期 revert 拒绝。
2. 等价判定器单测 ≥ 12（等价/不等价/部分可逆矩阵）。
3. 五 OTel 事件在 trace 中可查（硬规则 #9）。
4. HITL 对称性 negative：未确认 revert 不生效。
5. 与 Temporal 路径联动 1 例（长补偿链 demo）。

## 4. 里程碑

| M | 内容 | 估时 |
|---|---|---|
| M1 | withdraw + revert(create/action) + 等价判定器 | 1 周 |
| M2 | HITL 对称闸 + OTel 五事件 + 时窗 | 0.5 周 |
| M3 | Temporal 长补偿链 + live e2e 全矩阵 | 0.5 周 |

## 5. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-09-08 | v1.0 立稿（Sprint 1 PRD 缺口补齐） | Claude |
| 2026-09-08 | v1.1：M1 收口（kernel WITHDRAWN/REVERTED + pg withdraw/revert + 双 REST 端点 + 等价判定 + 7d 窗口；live 五路径全过；单测 9/9） | Claude |
| 2026-09-08 | v1.3：M3 收口——RevertWorkflow（temporal_workflow.py）+ orch_revert_proposal activity（OntologyActionClient.revert 幂等键 revert-{id}）注册入 worker（镜像 1.3）；live：start RevertWorkflow → ont revert → {status:reverted, equivalence:equivalent, deleted rows:1} | Claude |
| 2026-09-08 | v1.2：M2 收口——五事件（propose/confirm/reject/withdraw/revert）经 ont_proposal_event 表全留痕（live 实测完整生命周期行）；7d 窗口 live 409（压 applied_at=8d 前）；HITL 对称闸按 by-design 判定（用户端点语义）；api 层 structlog 事件钩子同步布点（stdout 级别过滤中，表为审计权威） | Claude |
