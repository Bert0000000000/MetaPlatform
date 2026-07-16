# MetaPlatform 平台整体技术架构

> **创建日期**：2026-07-02
> **对应 spec**：[`../brainstorm/design-spec/MetaPlatform-顶层架构设计-2026-07-02.md`](../brainstorm/design-spec/MetaPlatform-顶层架构设计-2026-07-02.md)（v1.2）
> **状态**：🆕 v1.0 草稿，待用户审阅
> **目的**：作为 plan 是否需要重写的"事实依据"——看完本目录后能判断 v0.1 plan 中的选型是否需要调整

---

## 文档清单

| 章节 | 文件 | 内容 |
|---|---|---|
| §1 | [01-nine-layer-architecture.md](./01-nine-layer-architecture.md) | 9 层架构详解 — 每层职责/技术选型/数据流/接口/性能基线 |
| §2 | [02-deployment-topology.md](./02-deployment-topology.md) | 部署拓扑 — K8s + 多云 + 信创 + 商用化部署 |
| §3 | [03-data-flow.md](./03-data-flow.md) | 跨层数据流 — 事件总线、CDC、最终一致性、Outbox |
| §4 | [04-cross-cutting-concerns.md](./04-cross-cutting-concerns.md) | 横切关注点 — 安全、可观测、性能、容灾 |
| §5 | [05-tech-selection-matrix.md](./05-tech-selection-matrix.md) | 技术选型矩阵 — 决策/替代方案/风险/退出成本 |
| §6 | [06-non-functional-requirements.md](./06-non-functional-requirements.md) | NFR 指标 — 性能/可用性/扩展性/合规 |

---

## 阅读路径

### 快速（30 分钟）
- [01-nine-layer-architecture.md](./01-nine-layer-architecture.md) 的 §1.1-1.2（9 层总图 + 选型表）
- [05-tech-selection-matrix.md](./05-tech-selection-matrix.md) 的 §5.1（核心选型决策表）

### 中速（2 小时）
- §1 全部（9 层）
- §3 全部（数据流）
- §6 全部（NFR）

### 完整（半天）
- 全部 6 份

---

## 与 spec v1.2 的关系

**spec v1.2** 回答的是"做什么"（顶层架构、决策、范围）。
**本目录** 回答的是"怎么做"（具体技术选型、数据流、部署、NFR）。

**决策链路**：
```
spec v1.2 (D1-D14 决策) 
    ↓
本目录 9 层技术架构（怎么实现 D1-D14）
    ↓
docs/superpowers/plans/ 实施计划（按本目录落地）
```

**修订规则**：
- 如果本目录的"技术选型"与 v1.2 spec §11 冲突 → **以本目录为准**（更细粒度），并把 spec §11 升级到 v1.3
- 如果本目录引入新组件（如新数据库 / 新中间件）→ 触发新决策 Dxx
- 如果本目录发现 v0.1 plan 的选型不可行 → 重写对应 plan（v0.1 → v0.2）

---

## 关键提醒

1. **本目录不是"用最新最火的技术"** — 每个选型都有理由和退出成本
2. **本目录不是"完整版说明书"** — 是"决策级别"的技术架构，不是 API 文档
3. **本目录不是"独立存在"** — 必须和 spec v1.2 协同阅读
4. **本目录会演进** — v1.0 覆盖 MVP 第 1 期；v1.1 覆盖第 2 期；v1.2 覆盖信创/商用化

---

**生成时间**：2026-07-02 14:30
**对应 spec 版本**：v1.2
**与 plan 的关系**：本目录是 plan 是否需要重写的"事实依据"
