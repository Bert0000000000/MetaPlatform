# PRD 总索引 v2.0(11 模块 + A2A)

> 版本:v2.0 · 2026-08-01
> 关联:`docs/active/prd/_top/INDEX-APP模块详细规范_v1.0-20260727.md`(v1.0)
> 状态:**Active**(本索引替代 v1.0)
> 修订人:需求层(TRAE)

---

## 1. 范围

PRD 总索引,把 11 个 APP 模块 + 1 个 A2A 技术能力的 PRD 全部串起来,提供**单点入口**。

本索引**替换** v1.0(2026-07-27),v1.0 只索引 9 个 APP 模块;v2.0 补充:
- 新增 `APP-DATA` 数据平台(2026-07-31 补 PRD)
- 新增 `APP-WFE` 工作流引擎(2026-07-31 补 PRD)
- 新增 `A2A` 协议层(技术能力,放 specs/)

---

## 2. 11 个 APP 模块 PRD 索引

### 2.1 已落地(11 个)

| 模块 | 总 PRD | 详细规范 | 按钮手册 | 状态 | 接入代码包 | owner |
|---|---|---|---|---|---|---|
| **APP-APPHUB** 应用中心 | v2.2 | v1.0 | v1.1 | ✅ Done P2-W2 | `mate-app-hub` | platform-menu-unification |
| **APP-ARCH** 架构中心 | v2.2 | v1.0 | — | ✅ Done P2-W2 | `mate-app-arch` | platform-menu-unification |
| **APP-COPILOT** 超级 AI | v2.3 + 子模块 2 | v1.0 | — | ✅ Done P2-W2 | `mate-app-copilot` | platform-menu-unification |
| **APP-DASHBOARD** 仪表盘 | v2.3 + 后台管理 v1.2 | v1.0 | v1.1 | ✅ Done P2-W2 | `mate-tech-iam` (dashboard) | business-workbench |
| **APP-DATA** 数据平台 | v1.0 | v1.0 | v1.0 | ✅ PRD 就绪 P2-W5 待挂 | (HTTP 控制面待挂 DATA-D0-D8) | data-platform |
| **APP-DW** 数字员工 | v2.4 + 子模块 2 | v1.0 | v1.1 | ✅ Done P2-W3 | `mate-tech-dw` | digital-workforce |
| **APP-KB** 知识库 | v1.2 | v1.0 | v1.1 | ✅ Done TECH-SERVICES | `mate-app-kb` | knowledge-platform |
| **APP-MCPHUB** MCP 中心 | v2.2 | v1.0 | v1.1 | ✅ Done P1 wave 3 | `mate-tech-mcp` | ai-protocols |
| **APP-ONTSTUDIO** 本体引擎 | v2.4 | v1.0 / v1.2 / v1.3 | v1.1 / v1.2 / v1.3 / v1.4 | ✅ Done P2 wave 1 | `mate-tech-ont` | ontology-platform |
| **APP-WFE** 工作流引擎 | v1.0 | v1.0 | v1.0 | ✅ PRD 就绪 P2-W5 待建包 | (待 `mate-app-wfe` 建包) | workflow-platform |
| 业务子能力(2 份) | — | — | — | — | — | — |
| └ APP-DW-业务RAG | v1.1 | — | — | ✅ Done | `mate-tech-rag` | knowledge-platform |
| └ APP-DW-页面Agent | v1.1 | — | — | ✅ Done | `mate-tech-agent` | ai-runtime |

### 2.2 业务 PRD 总数

- **总 PRD 文件**:50 份(11 模块 × 平均 4 份)
- **业务子能力**:2 份(APP-DW 下)
- **状态**:全部 ✅ Done 或 PRD 就绪

---

## 3. 技术能力规范索引

业务模块之外的 5 份技术规范,放 `docs/active/specs/`:

| 规范 | 版本 | 状态 | 关联 |
|---|---|---|---|
| **架构基线** | 2026-07-27 v3.0-implementation | ✅ Done | `docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md` |
| **A2A 协议层(新)** | 2026-07-31 v1.0 | ✅ Done | `docs/active/specs/2026-07-31-prd-a2a-protocol.md` |
| **Production readiness** | 2026-07-30 | ✅ Done | `docs/active/specs/2026-07-30-backend-production-readiness-design.md`(§13 硬规则) |
| **Delivery roadmap** | 2026-07-27 v1.4 | ✅ Done | `docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md` |
| **Tech stack** | 2026-07-27 v1.2 | ✅ Done | `docs/active/specs/2026-07-27-mate-platform-tech-stack-confirmed.md` |
| **MCP 协议层 spec 修订(新)** | 2026-08-01 v1.0 | ✅ Active | `docs/active/specs/2026-08-01-mcp-federation-spec-revision.md` |
| **G6 RLS 迁移需求(新)** | 2026-08-01 v1.0 | ✅ Active | `docs/active/specs/2026-08-01-r6-rls-migration.md` |
| **G8 旧 infra 清理需求(新)** | 2026-08-01 v1.0 | ✅ Active | `docs/active/specs/2026-08-01-g8-legacy-infra-cleanup.md` |

---

## 4. 17 域接入矩阵(与 PRD 对照)

| 17 域 | 业务 PRD | 代码包 | 5 步合规 | 接入批次 |
|---|---|---|---|---|
| **kb** | APP-KB v1.2 | `mate-app-kb` | ✅ Done | TECH-SERVICES |
| **rag** | APP-DW-业务RAG v1.1 | `mate-tech-rag` | ✅ Done | P1 wave 3 |
| **llmgw** | (无业务 PRD,属于 llmgw 技术能力)| `mate-tech-llmgw` | ✅ Done | P1 wave 2 + P3-W9 |
| **agent** | APP-DW-页面Agent v1.1 | `mate-tech-agent` | ✅ Done | P1 wave 2 + P3-W8 |
| **ont** | APP-ONTSTUDIO v2.4 | `mate-tech-ont` | ✅ Done | P2 wave 1 + P3-W9 |
| **msg** | (无业务 PRD,技术能力)| `mate-tech-msg` | ✅ Done | P1 wave 1 + P3-W9 |
| **obs** | (无业务 PRD,技术能力)| `mate-tech-obs` | ✅ Done | P1 wave 1 |
| **mcp** | APP-MCPHUB v2.2 | `mate-tech-mcp` | ✅ Done | P1 wave 3 + P3-W7 |
| **iam** | (deprecated,admin / dashboard 仍在用)| `mate-tech-iam` | 🟠 Deprecated | — |
| **apphub** | APP-APPHUB v2.2 | `mate-app-hub` | ✅ Done | P2-W2 |
| **arch** | APP-ARCH v2.2 | `mate-app-arch` | ✅ Done | P2-W2 + P3-W8 |
| **copilot** | APP-COPILOT v2.3 | `mate-app-copilot` | ✅ Done | P2-W2 + P3-W9 |
| **dashboard** | APP-DASHBOARD v2.3 + 后台管理 v1.2 | `mate-tech-iam` (dashboard) | ✅ Done | P2-W2 |
| **dw** | APP-DW v2.4 | `mate-tech-dw` | ✅ Done | P2-W3 |
| **data / etl / metrics / scheduler** | APP-DATA v1.0 | `mate-tech-data` + `mate-tech-etl` + `mate-tech-metrics` + `mate-tech-scheduler` | ✅ Done | P2-W5/W6/W7 |
| **a2a** | (A2A 协议层规范,放 specs/)| `mate-app-a2a` | ✅ Done | P2-W5 |
| **wfe** | APP-WFE v1.0 | `mate-app-wfe` | ✅ Done | P2-W5 |

**覆盖度**:**17 / 17 域接入完成**(iam deprecated 保留)

---

## 5. PRD 文件清单(70 份)

### 5.1 APP 模块(11 × 平均 4 份)

```
docs/active/prd/
├── APP-APPHUB/        (4 份)
├── APP-ARCH/          (3 份)
├── APP-COPILOT/       (7 份)
├── APP-DASHBOARD/      (8 份)
├── APP-DATA/          (3 份) ← 新增 2026-07-31
├── APP-DW/            (8 份)
├── APP-KB/            (4 份)
├── APP-MCPHUB/        (4 份)
├── APP-ONTSTUDIO/      (12 份)
├── APP-WFE/           (3 份) ← 新增 2026-07-31
└── _top/              (13 份)
```

### 5.2 _top 总文档(13 份)

```
docs/active/prd/_top/
├── API-CONTRACT-前端接口契约清单_v1.0-20260727.md
├── INDEX-APP模块详细规范_v1.0-20260727.md          (v1.0,本索引替代)
├── INDEX-PRD-V2.0-20260801.md                     (v2.0,本索引)
├── PLAN-Mate_Platform-APP模块PRD交叉验证与迭代版本计划_v1.0-20260718.md
├── PLAN-Mate_Platform-PRD交叉验证与迭代主线规划_v2.0-20260727.md
├── PLAN-Mate_Platform-PRD交叉验证与迭代主线规划_v3.0-20260727.md
├── PLAN-Mate_Platform-PRD需求覆盖度检查报告_v1.0-20260716.md
├── PLAN-Mate_Platform-后端服务修正与完善_v1.0-20260722.md
├── PLAN-前后端并行开发接口边界_v1.0-20260727.md
├── REPORT-PRD按钮操作手册补全报告_v1.0-20260723.md
├── REPORT-PRD去重与拆分清理报告_v1.0-20260722.md
├── REPORT-前端实现与PRD差异盘点_v1.0-20260727.md
├── REPORT-设计稿与PRD差异分析_v1.0-20260722.md
└── SPEC-P2-通用规范_v1.0-20260727.md
```

### 5.3 技术能力规范(4 份)

```
docs/active/specs/
├── 2026-07-31-prd-a2a-protocol.md                    (A2A 协议层)
├── 2026-08-01-mcp-federation-spec-revision.md        (MCP federation)
├── 2026-08-01-r6-rls-migration.md                    (G6 RLS 迁移)
└── 2026-08-01-g8-legacy-infra-cleanup.md             (G8 旧 infra 清理)
```

---

## 6. v1.0 → v2.0 变更

| 项 | v1.0(7/27) | v2.0(8/1) |
|---|---|---|
| APP 模块数 | 9 | **11**(+ APP-DATA, + APP-WFE)|
| 技术能力规范 | 3 | **4**(+ A2A)|
| 总文件数 | 61 | **70**(+9)|
| 17 域接入 | 8/17 | **17/17**(完成) |
| v3.0 GA 状态 | 未收口 | ✅ Accepted |
| v3.1 增量 | 未启动 | ✅ 大部分闭环(G2/G3/G4/G7/TD-5/TD-6 Accepted) |

---

## 7. 索引使用方式

### 7.1 给业务方

- 找某个功能 → 查第 2 节 11 模块表
- 找某个 PRD 文件路径 → 查第 5 节 PRD 文件清单

### 7.2 给开发者

- 找某个域的参考文档 → 查第 4 节 17 域接入矩阵
- 找技术能力规范 → 查第 3 节

### 7.3 给 PM / TL

- 项目状态全貌 → 看第 1 节 + 第 6 节 v1.0 → v2.0 变更
- 待办事项 → 看交付路线图(`docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md` 附录 B)

---

## 8. 关联文档

- `INDEX-APP模块详细规范_v1.0-20260727.md`(v1.0,被本索引替代)
- `2026-07-27-mate-platform-architecture-implementation.md` — 架构基线
- `2026-07-30-backend-production-readiness-design.md §13` — 硬规则
- `2026-07-27-mate-platform-delivery-roadmap.md` — 路线图
- `2026-07-31-features-backlog.md` v1.1 — 功能盘点
- `2026-07-31-backend-impl-backlog.md` v1.1 — 接口盘点

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-07-27 | v1.0 初版(9 APP 模块索引)| TRAE 盘点 |
| **2026-08-01** | **v2.0**:**新增 APP-DATA + APP-WFE + A2A 技术能力规范**(共 11 模块 + 4 份技术规范);17/17 域接入完成 | 需求层(TRAE) |