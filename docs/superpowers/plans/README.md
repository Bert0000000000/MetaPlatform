# MetaPlatform 实施计划索引

> **创建日期**：2026-07-02
> **对应 spec**：[`../brainstorm/design-spec/MetaPlatform-顶层架构设计-2026-07-02.md`](../brainstorm/design-spec/MetaPlatform-顶层架构设计-2026-07-02.md)（v1.2）
> **MVP 时间分期**（D14 决策）：1 + 6 + 3 月

---

## 第 1 期 · Spike（月 T-1 ~ T0）— 3 份并行 plan

| Plan 文件 | 子项目 | 团队 | 关键交付 |
|---|---|---|---|
| [`2026-07-02-ontology-engine-v0.1.md`](./2026-07-02-ontology-engine-v0.1.md) | **子项目 1：本体引擎 v0.1** | 团队 A（Java + Neo4j）| 实体/属性/关系/推理 + 事件总线 + 版本 + Outbox 模式 + trace_id 贯通 |
| [`2026-07-02-data-stack-v0.1.md`](./2026-07-02-data-stack-v0.1.md) | **子项目 1b：数据栈 v0.1** | 团队 B（Go + Hudi + Doris + ClickHouse 适配器）| 湖 + 仓 + 适配器 + 元数据 + 权限 + DLQ 兜底 + trace_id 消费端贯通 |
| [`2026-07-02-integration-spike.md`](./2026-07-02-integration-spike.md) | **子项目 1c：集成 Spike** | 团队 A + B 协作 | 本体引擎 ↔ 数据栈 e2e：建实体 → 写图+湖 → SQL 查（含 traceId 串联） |

> 🆕 **2026-07-02 补增**：技术架构评审后，确认 Outbox / DLQ / trace_id 为 v0.1 必加项，已分别追加到本体引擎 Plan 的 Task 5.1/5.2 和数据栈 Plan 的 Task 8.7/8.8。详见 [v0.1 必加 3 件事](#v01-必加-3-件事) 节。

---

## Spike 期交付物的形态

**Spike 期不是产品，是"实物证据"**：
- 本体引擎 v0.1 — 单租户、Java 实现 Neo4j 适配层、实体/属性/关系/推理基础能力、事件总线
- 数据栈 v0.1 — Go 实现 Hudi 湖适配 + Doris 仓 + ClickHouse 适配器
- 集成 Spike — 1 个端到端示例：建模"客户" → 落图 → 落湖 → 用 SQL 查出来

**Spike 验收**：
- [ ] 团队 A 和团队 B 同时独立工作
- [ ] 两周内产出最小 e2e
- [ ] 决定是否进入 MVP（第 2 期）

---

## 第 2 期 · MVP（月 T0 ~ T+6m）— 待 Spike 完成后产出

| Plan 文件 | 子项目 | 状态 |
|---|---|---|
| `2027-01-02-business-object-v0.1.md`（待产出） | 子项目 2：业务对象层 v0.1 | 🟡 待 Spike 完成后开始 |
| `2027-01-02-ai-substrate-v0.1.md`（待产出） | 子项目 3：AI Substrate v0.1 | 🟡 待 Spike 完成后开始 |
| `2027-01-02-page-form-generator-v0.1.md`（待产出） | 子项目 4：页面/表单生成器 v0.1 | 🟡 待 Spike 完成后开始 |
| `2027-01-02-process-automation-v0.1.md`（待产出） | 子项目 5：流程自动化 v0.1 | 🟡 待 Spike 完成后开始 |
| `2027-01-02-platform-base-v0.1.md`（待产出） | 子项目 6：平台底座 v0.1 | 🟡 待 Spike 完成后开始 |
| `2027-01-02-rag-mdm-v0.1.md`（待产出）| 子项目 7：RAG/非结构/MDM v0.1 | 🟡 待 Spike 完成后开始 |
| `2027-01-02-dialogue-v0.1.md`（待产出）| 子项目 8：对话层 v0.1 | 🟡 待 Spike 完成后开始 |
| `2027-01-02-capability-library-v0.1.md`（待产出）| 子项目 9：能力库 v0.1 | 🟡 待 Spike 完成后开始 |

---

## 第 3 期 · 加固（月 T+6m ~ T+9m）— 待 MVP 完成后产出

| Plan 文件 | 子项目 | 状态 |
|---|---|---|
| `2027-04-02-data-stack-hardening.md`（待产出）| 子项目 7a+：数据栈加固 | 🟡 待 MVP 完成后开始 |

---

## 阅读顺序建议

1. 先看 [本体引擎 v0.1 plan](./2026-07-02-ontology-engine-v0.1.md) 理解 P3 核心
2. 再看 [数据栈 v0.1 plan](./2026-07-02-data-stack-v0.1.md) 理解 D13 双轨 OLAP
3. 最后看 [集成 Spike plan](./2026-07-02-integration-spike.md) 理解两者的粘合点

---

## v0.1 必加 3 件事

**触发背景：** [`../tech-architecture/03-data-flow.md`](../tech-architecture/03-data-flow.md) 和 [`04-cross-cutting-concerns.md`](../tech-architecture/04-cross-cutting-concerns.md) 评审后，发现 v0.1 plan 缺失以下横切能力。已分别追加到对应 plan 中，不重写原有 Task 编号。

| 能力 | 加在哪里 | Plan 章节 | 主要落地点 |
|---|---|---|---|
| **Outbox 模式**（事件不丢） | 本体引擎 Plan Task 5.1（Task 5 之后追加）| [`2026-07-02-ontology-engine-v0.1.md` §Task 5.1](./2026-07-02-ontology-engine-v0.1.md) | `outbox_event` PG 表 + `OutboxPublisher` @Scheduled 工作者 + `EntityTypeService` 改用 outbox.enqueue |
| **死信队列 DLQ**（消费失败兜底）| 数据栈 Plan Task 8.7（Task 8 之后追加）| [`2026-07-02-data-stack-v0.1.md` §Task 8.7](./2026-07-02-data-stack-v0.1.md) | `metaplatform.ontology.entity-instance.dlq` topic + `DLQPublisher` + `EventConsumer` 3 次重试后落 DLQ |
| **trace_id 全链路** | 本体引擎 Plan Task 5.2 + 数据栈 Plan Task 8.8 | 见上 | HTTP filter → MDC/ctx → event header → IngestService → Doris/Hudi → 日志；一次调用可追 |

**集成影响**：
- 本体引擎发到 Kafka 的消息必须带 `X-Trace-Id` header（OutboxPublisher 在 `kafkaTemplate.send` 时设置）
- 数据栈 EventConsumer 读 header 注入 ctx，贯穿到 DorisWriter/HudiWriter 的日志
- DLQ 落消息时把 traceId 一并写入，便于事后追源

**为什么不在 v0.2 补：**
- Outbox：第 1 条事件丢就怀疑整个数据栈，跨团队信任崩
- DLQ：失败重试无兜底会引发"幽灵事件"（重试 N 次后丢但无记录）
- trace_id：Spike 阶段的 e2e smoke 没有 traceId 等于没做可观测性

---

**生成时间**：2026-07-02 14:15
**生成方式**：brainstorming 第 7 步 "Transition to implementation" → writing-plans 技能
**最近更新**：2026-07-02 14:30（追加 v0.1 必加 3 件事）
