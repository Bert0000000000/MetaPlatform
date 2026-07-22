# PRD - 本体论引擎前端（APP-ONTSTUDIO）- 状态与改进规划

> 版本：v1.0 | 日期：2026-07-21 | 模块：APP-ONTSTUDIO | 状态：盘点完成
>
> 关联文档：`PRD-APP-ONTSTUDIO-本体论引擎_v1.0-20260716.md`

## 版本历史

| 版本 | 日期 | 变更说明 | 作者 |
|---|---|---|---|
| v1.0 | 2026-07-21 | 基于模块盘点创建，包含实现状态与改进规划 | Trae |
| v1.0.1 | 2026-07-22 | Task 4.3：新增 v1.2 迁移说明段（Python ontology_discovery.py → Java OntologyDiscoveryController；monorepo 迁入；端口 9220） | Trae |

## 1. 模块概览

### 1.1 模块定位
统一管理本体定义、数据中心与 Action 编排的前端工作台，提供本体论管理（Concept/Entity/Attribute/Relation/Rule/Action 可视化建模）、数据中心、服务/Action 编排。

### 1.1.1 v1.2 迁移说明（2026-07-22 追加）

- **架构迁移**：APP-ONTSTUDIO 已从根目录独立工程迁入 `metaplatform-frontend/apps/ontstudio/`（pnpm monorepo workspace，与 portal/superai/dashboard/apphub/dw/arch/mcphub 平级）。
- **依赖统一**：前端依赖统一为 `@mate/shared` workspace 包；React 19 + Vite 6 + TypeScript 5.7 + Antd 6.0 + AntV X6 + Axios 1.7。
- **后端重写**：原先由 Python FastAPI `ontology_discovery.py` 提供的本体自动发现能力，已在 v1.2 阶段由 `TECH-ONT` 的 `OntologyDiscoveryController`（Java 21 + Spring Boot 3.5）替代，4 个端点（`/api/v1/ont/discovery/*`）行为对齐 Python 端点；前端 `src/api/discovery.ts` 已切换到 Java 后端。
- **后端依赖基线**：TECH-ONT（8201）、TECH-IAM（8001）、TECH-LLMGW（8210，v1.2 启动后）、TECH-DATA、TECH-RULE。
- **端口**：dev 端口 9220（与 portal 9200 / superai 9210 等对齐）；通过 `pnpm dev` 在 monorepo 根目录启动。
- **状态页**：6 个 stub 页面（数据中心 / 数据血缘 / 数据质量 / 决策表 / 测试用例 / 执行监控）依赖 TECH-DATA、TECH-RULE 后端就绪后启用。
- **旧独立 README**：`APP-ONTSTUDIO/README.md` 已陈旧，真实信息以 `metaplatform-frontend/apps/ontstudio/README.md`（v1.2 创建）为准。

### 1.2 上下游依赖
- **上游**：TECH-ONT（本体引擎）、TECH-ACTION（Action 编排）、TECH-DATA（数据中心）、TECH-RAG、TECH-RULE
- **下游消费**：终端用户（本体建模师/数据架构师）

### 1.3 计划职责与范围（路线图 Task）
共 12 个 Task（阶段一 5 + 阶段三 7），P1-ONTUI-01~05 + P3-ONTUI-01~07，**全部 `[x]`**。迭代补充：v1.1 V11-01~03（数据质量/血缘/决策表 API 后端化）`[x]`、v1.2 V12-05（Cypher 查询控制台）`[x]`、v1.2 V12-06（概念详情页 Tab 扩展）`[x]`。

## 2. 实现状态盘点

### 2.1 代码规模
- 前端文件 60 / 配置 4 / 测试 0
- 18 个业务页面，19 个组件，18 个 API 模块
- 目录：`src/{api, components, pages, types, utils}`

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
**基本完成** -- 18 个业务页面 + 19 个组件，覆盖概念/属性/实体、关系类型/实例、Action 定义/编排/触发器、规则管理、决策表、数据源/映射/质量/血缘、知识图谱、Cypher 控制台、本体发现、版本管理/对比、测试用例/运行器、执行监控。使用 @antv/x6 做图可视化。是本体引擎的完整前端。

## 3. 规划与实现差距

### 3.1 差距一：数据质量/血缘/决策表原为 Mock（P1）
- **现状**：v1.1 已在后端 API 后端化，但前端可能仍有 localStorage 降级
- **影响**：需确认前端已切换至真实 API

### 3.2 差距二：无单元测试（P2）

### 3.3 差距三：README 严重过时（P2）
- **现状**：README 自述"P1 已实现"仅 Concept/Attribute/Entity + 全局搜索，实际已实现全部规划能力

## 4. 改进规划

### 4.1 P1 项

| 编号 | 改进项 | 具体内容 | 验收标准 | 依赖 |
|---|---|---|---|---|
| ONTSTUDIO-P1-01 | 知识图谱 E2E | 验证知识图谱可视化与 TECH-ONT Neo4j 联动 | 知识图谱展示真实 Neo4j 数据 | ONT-P1-02 |
| ONTSTUDIO-P1-02 | Cypher 控制台 E2E | 验证 Cypher 查询控制台与 TECH-ONT 联动 | Cypher 查询返回真实结果 | ONT-P1-02 |
| ONTSTUDIO-P1-03 | 版本管理 E2E | 验证版本创建/对比/回滚 端到端 | 版本回滚后数据正确恢复 | ONT-P1-03 |
| ONTSTUDIO-P1-04 | 数据血缘 E2E | 验证数据血缘与 TECH-DATA 联动 | 血缘图谱展示真实数据流 | DATA-P1-04 |

### 4.2 P2 项

| 编号 | 改进项 | 具体内容 |
|---|---|---|
| ONTSTUDIO-P2-01 | 单元测试 | 补充核心组件/页面单元测试 |
| ONTSTUDIO-P2-02 | README 更新 | 更新 README 反映实际 18 页面能力 |
| ONTSTUDIO-P2-03 | 移除 Mock 降级 | 确认数据质量/血缘/决策表已切换至真实 API |

## 5. 验收标准

- [ ] 知识图谱可视化展示真实 Neo4j 数据
- [ ] Cypher 查询控制台返回真实结果
- [ ] 版本管理（创建/对比/回滚）端到端可用
- [ ] Action 编排/触发器 端到端可用
- [ ] 决策表编辑器 端到端可用
- [ ] 数据血缘展示真实数据流
- [ ] README 与代码一致
