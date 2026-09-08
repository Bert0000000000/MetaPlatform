# PRD-01 数字员工自进化（MP-EMP-EVOLVE-01）

> **版本**: v1.1 · **日期**: 2026-09-08 · **状态**: `[~]` M1 已收口（会话 mount/unmount/反应式/快照还原 REST live 全环；见 MP-EMP-EVOLVE-01-M1-ACCEPTANCE）；M2/M3 未启动
> **关联**: ADR-0043 §面向A（数字员工自进化）/ Composition Kernel（MP-COMP-01）/ Sprint 1
> **Requirement IDs**: FR-EMP-EVOLVE-001..008

## 1. 背景与目标

ADR-0043 把 composition kernel 升格为平台集成层 OS，面向 A 要求：7+N 类员工在
**session 内热挂载技能/子 agent**，kernel `AgentRole` 不动，复用 `CapabilityRuntime`。

**目标**：数字员工在会话进行中，按任务需要动态获得/释放能力（技能、子 agent、
外部工具），且能力变化**反应式**作用于依赖它的 fiber（工具下线→依赖角色失活；
回归→自动复激活），全程可审计、可回滚。

## 2. 范围

### In Scope
- **FR-EMP-EVOLVE-001 能力热挂载**：会话内 `use()` 新技能/子 agent，不重启会话。
- **FR-EMP-EVOLVE-002 能力卸载**：`release()` 后 fiber 反应式失活（复用 MP-COMP-01 coeffect `capability:{tenant}:{name}`）。
- **FR-EMP-EVOLVE-003 进化提案**：员工可提议自进化（新技能需求 → 市场检索/生成），提议走 proposal 闸（人审）。
- **FR-EMP-EVOLVE-004 演化边界**：`AgentRole` 枚举不变；只动 capability 绑定（kernel API 只增不改）。
- **FR-EMP-EVOLVE-005 审计**：每次挂载/卸载发 OTel 事件 + composition 事件（谁、何时、什么能力、依据）。
- **FR-EMP-EVOLVE-006 回滚**：会话级能力变更在会话结束时自动还原（快照语义，I1 可恢复不变量）。
- **FR-EMP-EVOLVE-007 持久化**：员工能力档案跨会话持久（PG），会话内覆写不落盘。
- **FR-EMP-EVOLVE-008 Marketplace 联动**：技能来源含 Marketplace 订阅件（与 MP-MKT-INSTALL-01 接口对齐，本 PRD 只定义消费面）。

### Out of Scope
- kernel AgentRole/基元变更；第三方 L3 沙箱内技能执行（Sandbox L3 另列）；
- 技能内容生成质量（属 skillhub/RAG 域）。

## 3. 验收标准（全部满足才可 Accepted）

1. live e2e：数字员工会话中挂载新技能 → 立即可调用 → 卸载 → 调用被拒（反应式失活 negative）→ 重挂载 → 恢复（fiber 复激活）。
2. I1-I4 不变量测试全绿（复用 MP-COMP-01 测试基座扩展）。
3. 每次能力变化有 OTel 事件 + 审计行（硬规则 #9）。
4. 会话结束能力快照还原（同会话重开，能力回到会话前）。
5. 跨租户 negative：A 租户员工不能挂载 B 租户能力。
6. 单测 ≥ 20 + live 实机验证记录入 ACCEPTANCE。

## 4. 里程碑

| M | 内容 | 估时 |
|---|---|---|
| M1 | 会话内 use/release + fiber 反应式 | 1 周 |
| M2 | 快照还原 + 审计 + OTel | 0.5 周 |
| M3 | 进化提案闸 + Marketplace 消费面 | 0.5 周 |

## 5. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-09-08 | v1.0 立稿（Sprint 1 PRD 缺口补齐） | Claude |
| 2026-09-08 | v1.1：M1 收口——SessionEvolution（每会话 CapabilityRuntime + 快照 + TTL）+ REST 五端点 + dispatch 会话门；live open/mount/status/unmount/close 全环；单测 13/13 | Claude |
| 2026-09-08 | v1.3：M3 收口——进化提案闸（propose_evolution/approve_evolution/reject_evolution + REST 三端点）；live：提议未生效→approve→mounted 生效、reject 终态；既有 9/9 无回归 | Claude |
| 2026-09-08 | v1.2：M2 收口——POST /sessions/sweep（TTL 清扫，幂等）+ evolve.* 三审计事件在册；单测 9/9（含 sweep） | Claude |
