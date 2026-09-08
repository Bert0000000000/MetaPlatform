# agent.md

> **最近更新**：2026-09-08（同步 08-31 GA 状态 + 09-01 敏捷交付计划 + 指向 MetaPlatform-Ontology 新权威仓库；修复 08-25 版的表格损坏与乱码）
> 本文件是 AI Agent（Claude Code / Codex / Cursor / Windsurf / Hermes 等）的**入口指针**，不承载完整架构内容。完整内容只在权威文档单源维护，避免多副本手工漂移——08-25 版正是因此损坏（表格嵌入行号碎片、结尾段落乱码）。

## 读文件顺序（强制）

1. [`CLAUDE.md`](CLAUDE.md) —— 本仓库基线（唯一权威摘要）：v3.0 GA 收口状态、13 硬规则、v3.1 Ontology 20/20 Batch、批次接力指引
2. [`docs/README.md`](docs/README.md) —— 文档索引（定位规格 / ADR / 计划）

## 当前方向（2026-09-01 定稿，取代此前摘要）

| 文档 | 内容 |
|---|---|
| `docs/superpowers/specs/2026-08-31-federated-digital-employee-platform-design.md` | 目标技术架构（联邦数字员工平台） |
| `docs/superpowers/specs/2026-09-01-metaplatform-product-modules-design.md` | 产品范围 / 15 个产品模块 / 功能树 |
| `docs/superpowers/specs/2026-09-01-metaplatform-agile-delivery-operating-model.md` | 敏捷治理模型（PI / Sprint） |
| `docs/superpowers/plans/2026-09-01-metaplatform-agile-program-delivery.md` | PI/Sprint 顺序与退出条件 |
| `docs/superpowers/plans/2026-09-01-mvp-01-order-insight-action.md` ~ `mvp-04-ontology-operations.md` | 四个业务 MVP 计划 |
| `docs/active/decisions/ADR-0060-discard-v3-data-migration.md` | 弃用 v3 数据迁移 |
| `docs/active/decisions/ADR-0061-temporal-as-workflow-engine.md` | Temporal = 业务 Workflow 可靠编排控制面 |

发生规格冲突时：09-01/08-31 联邦数字员工架构 > CLAUDE.md 摘要 > 本文件。停止实现受影响部分，通过 ADR / 规格修订明确解决后同步。

## 权威仓库迁移（2026-09-08 基线）

后续研发的**唯一权威仓库 = `D:\Hermes\Workspace\10_Projects\MetaPlatform-Ontology\`**（其 `AGENTS.md` 为最高项目约束，`agent.md` 同样是三行指针模式）。本仓库自该仓库 `bf8b183` 初始化基线后，只作为迁移快照提供历史参考，不再是构建、测试、运行或设计依赖。

## 铁律不变量（在本仓库工作的任何 Agent 必须遵守）

- 提交顺序：docs/ADR → contract → failing tests → feature → infrastructure → deploy → acceptance evidence
- 状态以验收证据为准；`NOT_EXERCISED` 不等于通过（13 硬规则全文见 CLAUDE.md）
- Conventional Commits；PR 必须带 ADR 引用 + operationId 引用 + 验收证据链接
- 保留用户在途修改与运行服务；未经授权不覆盖、不删除、不重置
