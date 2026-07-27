# PRD - APP-ONTSTUDIO-状态与改进规划

> **版本**: v2.2 | **日期**: 2026-07-27
>
> **vv2.1 → vv2.2 主要变更**：
> 1. 与主 PRD 同步更新
> 2. API 接口按 Q2=B 归属 TECH-ONT
> 3. 新增「待补交互清单」
> 4. 关联文档：`API-CONTRACT-前端接口契约清单_v1.0-20260727.md`、`PLAN-前后端并行开发接口边界_v1.0-20260727.md`

---


> 版本：v2.0 | 日期：2026-07-22 | 模块：APP-ONTSTUDIO | 状态：盘点完成（v1.2 重构同步）
>
> 关联文档：
> - 主 PRD：`PRD-APP-ONTSTUDIO-本体论引擎_v2.0-20260722.md`
> - 设计稿差异分析：`docs/prd/_top/REPORT-设计稿与PRD差异分析_v1.0-20260722.md`

## 版本历史

| 版本 | 日期 | 变更说明 | 作者 |
|---|---|---|---|
| v1.0 | 2026-07-21 | 基于模块盘点创建，包含实现状态与改进规划 | Trae |
| v1.0.1 | 2026-07-22 | Task 4.3：新增 v1.2 迁移说明段（Python ontology_discovery.py → Java OntologyDiscoveryController；monorepo 迁入；端口 9220） | Trae |
| **v2.0** | **2026-07-22** | **本次刷新**：同步主 PRD v2.0 与设计稿刷新；R3 阶段差距盘点（Java 25 + SAA 适配）；新增 UI 设计基线附录；改进规划对齐 v1.2 技术栈 | Claude PRD 刷新流程 |

---

## 1. 模块概览

### 1.1 模块定位
统一管理本体定义、数据中心与 Action 编排的前端工作台，提供本体论管理（Concept/Entity/Attribute/Relation/Rule/Action 可视化建模）、数据中心、服务/Action 编排。

### 1.1.1 v1.2 迁移说明（2026-07-22 追加）

- **架构迁移**：APP-ONTSTUDIO 已从根目录独立工程迁入 `metaplatform-frontend/apps/ontstudio/`（pnpm monorepo workspace，与 portal/superai/dashboard/apphub/dw/arch/mcphub 平级）。
- **依赖统一**：前端依赖统一为 `@mate/shared` workspace 包；React 19 + Vite 6 + TypeScript 5.7 + Antd 6.0 + AntV X6 + Axios 1.7。
- **后端重写**：原先由 Python FastAPI `ontology_discovery.py` 提供的本体自动发现能力，已在 v1.2 阶段由 `TECH-ONT` 的 `OntologyDiscoveryController`（Java 21 → **Java 25** + Spring Boot **3.5**）替代，4 个端点（`/api/v1/ont/discovery/*`）行为对齐 Python 端点；前端 `src/api/discovery.ts` 已切换到 Java 后端。
- **后端依赖基线**：TECH-ONT（8201）、TECH-IAM（8001）、TECH-LLMGW（8210，v1.2 启动后）、TECH-DATA、TECH-RULE。
- **端口**：dev 端口 9220（与 portal 9200 / superai 9210 等对齐）；通过 `pnpm dev` 在 monorepo 根目录启动。
- **状态页**：6 个 stub 页面（数据中心 / 数据血缘 / 数据质量 / 决策表 / 测试用例 / 执行监控）依赖 TECH-DATA、TECH-RULE 后端就绪后启用。
- **旧独立 README**：`APP-ONTSTUDIO/README.md` 已陈旧，真实信息以 `metaplatform-frontend/apps/ontstudio/README.md`（v1.2 创建）为准。

### 1.1.2 v2.0 设计稿补全（2026-07-22 追加）

根据设计稿刷新，主 PRD 新增以下子节，本文档后续 E2E 验证项需同步覆盖：

- **3.4.4 图谱关系视图**（ontology-graph-relation.html）：以关系为中心视角
- **3.4.5 建模详情视图**（ontology-modeling-detail.html）：属性面板 + 引用列表
- **3.4.6 服务编排流程视图**（ontology-action-flow.html）：设计态/运行态/对比态

### 1.2 上下游依赖
- **上游**：TECH-ONT（本体引擎）、TECH-ACTION（Action 编排）、TECH-DATA（数据中心）、TECH-RAG、TECH-RULE
- **下游消费**：终端用户（本体建模师/数据架构师）
- **v2.0 新增关联**：APP-KB（解耦，仅通过 TECH-ONT/TECH-RAG 间接协同）、APP-ARCH（提供映射目标）

### 1.3 计划职责与范围（路线图 Task）
共 12 个 Task（阶段一 5 + 阶段三 7），P1-ONTUI-01~05 + P3-ONTUI-01~07，**全部 `[x]`**。迭代补充：v1.1 V11-01~03（数据质量/血缘/决策表 API 后端化）`[x]`、v1.2 V12-05（Cypher 查询控制台）`[x]`、v1.2 V12-06（概念详情页 Tab 扩展）`[x]`、v1.3 **V13-13~15（设计稿新增的 3 个视图子节）`[ ]`**。

## 2. 实现状态盘点

### 2.1 代码规模（截至 2026-07-22）
- 前端文件 60 / 配置 4 / 测试 0 → **测试 0 仍是问题（v2.0 继续跟踪）**
- 18 个业务页面，19 个组件，18 个 API 模块
- 目录：`src/{api, components, pages, types, utils}`
- **v2.0 新增**：3 个视图子节待开发（ontology-graph-relation/modeling-detail/action-flow），预计新增 ~6 个组件 + 3 个页面文件

### 2.2 关键实现
| 文件 | 职责 |
|---|---|
| `ConceptPage.tsx` | 概念管理（列表+层级树+CRUD） |
| `KnowledgeGraphPage.tsx` + `KnowledgeGraphViewer.tsx` | 知识图谱可视化（@antv/x6） |
| `OrchestrationPage.tsx` + `ActionEditor.tsx` | Action 编排 |
| `DecisionTableEditor.tsx` | 决策表编辑器 |
| `CypherConsole.tsx` | Cypher 查询控制台 |
| `LineageGraph.tsx` / `LineageSubgraphX6.tsx` | 数据血缘（@antv/x6） |
| `VersionPage.tsx` + `VersionCompare.tsx` / `VersionTimeline.tsx` | 版本管理 |

18 个 API 模块：concepts/attributes/entities/relations/actions/rules/decision-tables/datasources/mappings/quality/lineage/cypher/search/discovery/test-cases/versions/auth/client。

### 2.3 实现成熟度
**基本完成 + 设计稿对齐中** -- 18 个业务页面 + 19 个组件，覆盖概念/属性/实体、关系类型/实例、Action 定义/编排/触发器、规则管理、决策表、数据源/映射/质量/血缘、知识图谱、Cypher 控制台、本体发现、版本管理/对比、测试用例/运行器、执行监控。使用 @antv/x6 做图可视化。是本体引擎的完整前端。

**v2.0 待补**：3 个视图子节（关系/建模详情/服务编排流程）。

## 3. 规划与实现差距

### 3.1 差距一：数据质量/血缘/决策表原为 Mock（P1）
- **现状**：v1.1 已在后端 API 后端化，但前端可能仍有 localStorage 降级
- **影响**：需确认前端已切换至真实 API
- **v2.0 更新**：v1.2 R3 阶段确认切换已完成；进入持续监控期

### 3.2 差距二：无单元测试（P2 → P1 升级）
- **v2.0 升级理由**：v1.2 进入生产化阶段，无单测成为阻塞项
- **目标**：核心组件（KnowledgeGraphViewer/ActionEditor/VersionCompare）单测覆盖率 ≥ 60%

### 3.3 差距三：README 严重过时（P2）
- **现状**：README 自述"P1 已实现"仅 Concept/Attribute/Entity + 全局搜索，实际已实现全部规划能力
- **v2.0 更新**：v1.2 R3 阶段已迁移到 `metaplatform-frontend/apps/ontstudio/README.md` 并更新

### 3.4 差距四：设计稿补全（v2.0 新增，P1）
- **现状**：3 个视图子节未实现
  - 3.4.4 图谱关系视图
  - 3.4.5 建模详情视图
  - 3.4.6 服务编排流程视图
- **目标**：在 v1.3 R4 阶段实现

## 4. 改进规划

### 4.1 P1 项

| 编号 | 改进项 | 具体内容 | 验收标准 | 依赖 |
|---|---|---|---|---|
| ONTSTUDIO-P1-01 | 知识图谱 E2E | 验证知识图谱可视化与 TECH-ONT Neo4j 联动 | 知识图谱展示真实 Neo4j 数据 | ONT-P1-02 |
| ONTSTUDIO-P1-02 | Cypher 控制台 E2E | 验证 Cypher 查询控制台与 TECH-ONT 联动 | Cypher 查询返回真实结果 | ONT-P1-02 |
| ONTSTUDIO-P1-03 | 版本管理 E2E | 验证版本创建/对比/回滚 端到端 | 版本回滚后数据正确恢复 | ONT-P1-03 |
| ONTSTUDIO-P1-04 | 数据血缘 E2E | 验证数据血缘与 TECH-DATA 联动 | 血缘图谱展示真实数据流 | DATA-P1-04 |
| **ONTSTUDIO-P1-05** | **图谱关系视图**（**v2.0 新增**） | 实现 ontology-graph-relation 视图 | 关系列表/矩阵/桑基三种视图可用 | ONT-P1-02 |
| **ONTSTUDIO-P1-06** | **建模详情视图**（**v2.0 新增**） | 实现 ontology-modeling-detail 视图 | 概念属性面板 + 引用列表可用 | ONT-P1-01 |
| **ONTSTUDIO-P1-07** | **服务编排流程视图**（**v2.0 新增**） | 实现 ontology-action-flow 视图 | 设计/运行/对比三态可用 | ONT-P1-03 |

### 4.2 P2 项

| 编号 | 改进项 | 具体内容 |
|---|---|---|
| ONTSTUDIO-P2-01 | **单元测试**（**v2.0 升级 P1 → P2 待办**） | 核心组件单测覆盖率 ≥ 60% |
| ONTSTUDIO-P2-02 | README 更新 | 持续跟进 monorepo README 准确性 |
| ONTSTUDIO-P2-03 | 移除 Mock 降级 | 持续监控数据质量/血缘/决策表切换 |

### 4.3 v1.3 重构期路线图（v2.0 同步）

| 阶段 | 状态 | 内容 |
|------|------|------|
| R0 仓库精简 | ✅ 完成 | 删除 16+ 历史模块目录 |
| **R1 基础设施重建** | **🟡 进行中** | monorepo 脚手架、Nacos 3.0+、IAM→ONT→RULE 底层链路 |
| R2 6 服务骨架 | [ ] | Nacos（MCP/A2A/LLMGW/AGENT/RAG/DATA） |
| R3 核心服务 Java + SAA | [ ] | TECH-ONT 收敛 |
| R4 MCP / A2A 协议层 | [ ] | 含本模块 ONTSTUDIO-P1-05/06/07 |
| R5 生产化 | [ ] | 含 ONTSTUDIO-P2-01 单元测试补齐 |

## 5. 验收标准

- [ ] 知识图谱可视化展示真实 Neo4j 数据
- [ ] Cypher 查询控制台返回真实结果
- [ ] 版本管理（创建/对比/回滚）端到端可用
- [ ] Action 编排/触发器 端到端可用
- [ ] 决策表编辑器 端到端可用
- [ ] 数据血缘展示真实数据流
- [ ] README 与代码一致
- [ ] **图谱关系视图可用**（v2.0 新增）
- [ ] **建模详情视图可用**（v2.0 新增）
- [ ] **服务编排流程视图可用**（v2.0 新增）
- [ ] **核心组件单测覆盖率 ≥ 60%**（v2.0 升级）
- [ ] **SAA Graph Core / SAA ChatModel 集成验收**（v2.0 新增）

---

## 附录 A：UI 设计基线（v2.0 新增）

> 数据来源：`metaplatform-design-draft/` 设计库（MetaPlatform3.0）

| 维度 | 取值 |
|------|------|
| 设计库 | MetaPlatform3.0（id: `_-ZRH2U5YKIYA4`） |
| 设备类型 | Desktop |
| 主题 | Dark theme |
| 颜色 token | `--background:#0a0a0a`、`--card:#111111`、`--border:#262626`、`--primary:#fafafa`、`--success:#62d178`、`--destructive:#ff6166` |
| 字体 | Geist |
| 形状 | `--radius:8px`，1px 边框，零阴影 |
| 组件前缀 | `.v-card`、`.v-btn`、`.v-table`、`.v-input`、`.v-tab`、`.v-badge-*` |
| 图谱渲染 | AntV X6 + G6 |

### A.1 对应设计稿页面（与主 PRD 一致）

| 设计稿页面 | URL | 状态 |
|----------|-----|------|
| 本体论管理 | `metaplatform-design-draft/pages/ontology-modeling.html` | ✅ 已实现 |
| 建模详情 | `metaplatform-design-draft/pages/ontology-modeling-detail.html` | 🟡 v1.3 待开发（ONTSTUDIO-P1-06） |
| 数据中心 | `metaplatform-design-draft/pages/ontology-datacenter.html` | ✅ 已实现 |
| Action 编排 | `metaplatform-design-draft/pages/ontology-action.html` | ✅ 已实现 |
| 服务编排流程 | `metaplatform-design-draft/pages/ontology-action-flow.html` | 🟡 v1.3 待开发（ONTSTUDIO-P1-07） |
| 知识图谱 | `metaplatform-design-draft/pages/ontology-graph.html` | ✅ 已实现 |
| 图谱详情 | `metaplatform-design-draft/pages/ontology-graph-detail.html` | ✅ 已实现 |
| 图谱关系 | `metaplatform-design-draft/pages/ontology-graph-relation.html` | 🟡 v1.3 待开发（ONTSTUDIO-P1-05） |

---

## 附录 B：v2.0 变更说明

| 类别 | v1.0.x | v2.0 |
|------|--------|------|
| 状态 | 盘点完成 | 盘点完成（v1.2 重构同步） |
| Java 版本 | 21 | **25**（v1.3 升级 LTS） |
| Spring Boot | 3.5 | 3.5（保持） |
| 路线图阶段 | R1 早期 | R1 后期 / R3 启动期 |
| 设计稿补全 | 无 | 新增 3 个视图子节（P1-05/06/07） |
| 单元测试 | P2 跟踪 | **P1 升级**（生产化阻塞项） |
| UI 设计基线 | 无 | 附录 A |

---

**PRD 版本**: v2.0
**PRD 日期**: 2026-07-22
**刷新依据**: `docs/prd/_top/REPORT-设计稿与PRD差异分析_v1.0-20260722.md`
**说明**: 本文档为元 PRD（状态与改进规划），与主 PRD `PRD-APP-ONTSTUDIO-本体论引擎_v2.0-20260722.md` 配套使用。

---

## 附录：vv2.1 → vv2.2 增量更新说明

> **更新日期**: 2026-07-27
> **归属后端服务**: TECH-ONT

### 一、主要变更

1. 范围对齐主 PRD 同步
2. API 接口按 Q2=B 决策归属 **TECH-ONT**
3. 新增「待补交互清单」章节
4. 数据模型与前端类型同步

### 二、待补交互清单

见主 PRD 的「待补交互清单」章节，本子 PRD 的所有交互均继承主 PRD 的标记。

### 三、API 接口概要

本子 PRD 的所有端点归属 **TECH-ONT**，完整端点列表见：
- `docs/prd/_top/API-CONTRACT-前端接口契约清单_v1.0-20260727.md` §3.x

### 四、关联文档

- `docs/prd/_top/API-CONTRACT-前端接口契约清单_v1.0-20260727.md`
- `docs/prd/_top/PLAN-前后端并行开发接口边界_v1.0-20260727.md`
- `docs/prd/_top/REPORT-前端实现与PRD差异盘点_v1.0-20260727.md`
