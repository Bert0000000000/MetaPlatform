# @mate/ontstudio (Mate Platform Ontology Studio)

Mate Platform 本体论引擎前端，基于 React 19 + Vite 6 + Antd 6.0。

## 模块类型

APP 应用模块（monorepo 子应用）。

## 作用

Mate Platform 的本体论引擎工作台，统一管理本体定义、数据中心与 Action 编排。已实现能力：

- **本体论管理**：Concept / Attribute / Entity / Relation（类型与实例）/ Rule / Action 可视化建模、版本管理、Cypher 控制台
- **数据中心**：数据源管理、数据映射、数据质量、数据血缘
- **服务编排**：Action 定义、Action 编排、触发器
- **知识图谱**：基于 @antv/x6 的图谱可视化
- **本体自动发现**：v1.2 由 Java `OntologyDiscoveryController` 提供（替代原 Python `ontology_discovery.py`）

## v1.2 状态

- ✅ Monorepo 已迁入 `metaplatform-frontend/apps/ontstudio/`（pnpm workspace）
- ✅ Port **9220**（与 portal 9200 / superai 9210 / dashboard 9230 / apphub 9240 / dw 9250 / arch 9260 / mcphub 9270 等对齐）
- ✅ Workspace 依赖 `@mate/shared`（`packages/shared`）
- ✅ React 19 + Vite 6 + TypeScript 5.7 + Antd 6.0 + AntV X6 + Axios 1.7
- ✅ TECH-IAM JWT 登录集成
- ✅ 本体发现已切换至 Java 后端（`/api/v1/ont/discovery/*`）
- ⚠️ 6 个 stub 页面待 TECH-DATA / TECH-RULE 后端就绪：DataSourcePage / DataMappingPage / DataQualityPage / DataLineagePage / DecisionTableEditor / TestCaseManager + TestRunner

> **注意**：旧 `APP-ONTSTUDIO/README.md`（独立工程）已陈旧，仅供历史参考；当前工程位于本目录。

## 上游依赖

- `TECH-ONT`（本体引擎，端口 8201）：`/api/v1/ont/*`
- `TECH-IAM`（认证，端口 8001）：`/api/v1/iam/auth/login`
- `TECH-LLMGW`（LLM Gateway，端口 8210，v1.2 启动后）：本体发现 LLM reasoner
- `TECH-DATA`（待集成）：数据源注册中心
- `TECH-RULE`（待集成）：决策表 / 测试用例后端
- `TECH-ACTION`（Action 编排）：`/api/v1/action/*`
- `TECH-RAG`（RAG 知识库）

## 下游消费

- `APP-APPHUB`：应用通过 Ontology 绑定数据
- `APP-ARCH`：EA 架构引用 Ontology 概念
- `APP-SUPERAI`：AI 探索 Ontology 关系网
- `APP-DW`：数字员工基于 Ontology 执行任务
- `TECH-MCP`：MCP 暴露 Ontology 查询能力

## 目录结构

```
metaplatform-frontend/apps/ontstudio/
├── README.md                  # 本文件
├── package.json               # @mate/ontstudio
├── index.html
├── vite.config.ts             # port 9220, proxy /api → :8000
├── tsconfig.json
└── src/
    ├── api/                   # 18 个 API 模块
    │   ├── auth.ts            # IAM 登录
    │   ├── client.ts          # axios 实例 + 拦截器
    │   ├── concepts.ts
    │   ├── attributes.ts
    │   ├── entities.ts
    │   ├── relations.ts
    │   ├── rules.ts
    │   ├── actions.ts
    │   ├── decision-tables.ts
    │   ├── datasources.ts
    │   ├── mappings.ts
    │   ├── quality.ts
    │   ├── lineage.ts
    │   ├── cypher.ts
    │   ├── search.ts
    │   ├── discovery.ts       # 4 个端点（v1.2 切到 Java 后端）
    │   ├── test-cases.ts
    │   ├── versions.ts
    │   └── ...
    ├── components/            # 19 个组件
    │   ├── AppLayout.tsx
    │   ├── ConceptTree.tsx
    │   ├── ConceptForm.tsx
    │   ├── AttributeForm.tsx
    │   ├── EntityForm.tsx
    │   ├── RelationTypeForm.tsx
    │   ├── ActionEditor.tsx
    │   ├── ConditionEditor.tsx
    │   ├── DecisionTableEditor.tsx
    │   ├── CypherConsole.tsx
    │   ├── GlobalSearch.tsx
    │   ├── KnowledgeGraphViewer.tsx
    │   ├── LineageGraph.tsx
    │   ├── LineageSubgraphX6.tsx
    │   ├── RelationGraphView.tsx
    │   ├── TestCaseManager.tsx
    │   ├── TestRunner.tsx
    │   ├── VersionCompare.tsx
    │   └── VersionTimeline.tsx
    ├── pages/                 # 18 个业务页面
    │   ├── LoginPage.tsx
    │   ├── ConceptPage.tsx
    │   ├── ConceptDetailPage.tsx
    │   ├── EntityPage.tsx
    │   ├── RelationTypePage.tsx
    │   ├── RelationInstancePage.tsx
    │   ├── RuleManagementPage.tsx
    │   ├── ActionDefinitionPage.tsx
    │   ├── OrchestrationPage.tsx
    │   ├── TriggerPage.tsx
    │   ├── DataSourcePage.tsx          # stub (待 TECH-DATA)
    │   ├── DataMappingPage.tsx         # stub (待 TECH-DATA)
    │   ├── DataQualityPage.tsx         # stub (待 TECH-DATA)
    │   ├── DataLineagePage.tsx         # stub (待 TECH-DATA)
    │   ├── KnowledgeGraphPage.tsx
    │   ├── OntologyDiscoveryPage.tsx   # v1.2 新增（用 discovery.ts）
    │   ├── VersionPage.tsx
    │   └── ExecutionMonitorPage.tsx    # stub (待 TECH-RULE)
    ├── types/index.ts
    ├── utils/auth.ts
    ├── App.tsx
    ├── main.tsx
    └── App.css
```

## 开发

在 monorepo 根目录 `metaplatform-frontend/` 启动：

```bash
# 安装依赖（首次或更新后）
pnpm install

# 启动本子应用 dev server（port 9220）
pnpm --filter @mate/ontstudio dev

# 或在 monorepo 根统一启动所有子应用
pnpm dev

# 类型检查 + 生产构建
pnpm --filter @mate/ontstudio build

# 预览生产构建
pnpm --filter @mate/ontstudio preview
```

> **不再使用独立运行模式**：v1.2 起必须在 pnpm workspace 内运行；旧的 `cd APP-ONTSTUDIO && npm install && npm run dev` 流程已废弃。

## 后端依赖

| 服务 | 端口 | 说明 |
|---|---|---|
| TECH-ONT | 8201 | 本体引擎（必需） |
| TECH-IAM | 8001 | 认证（必需） |
| TECH-LLMGW | 8210 | LLM Gateway（v1.2 启动后可用作本体发现 LLM reasoner） |
| TECH-DATA | 8xxx | 数据集成（数据中心页面依赖） |
| TECH-RULE | 8xxx | 规则引擎（决策表/测试用例依赖） |
| TECH-ACTION | 8xxx | Action 编排服务 |
| TECH-RAG | 8xxx | RAG 知识库 |

API 代理：`/api/*` → `http://localhost:8000`（API 网关）。

## 相关文档

- [PRD - 本体论引擎状态与改进规划](../../../APP-ONTSTUDIO/docs/PRD-APP-ONTSTUDIO-状态与改进规划_v1.0-20260721.md)
- [PRD - 本体论引擎](../../../APP-ONTSTUDIO/docs/PRD-APP-ONTSTUDIO-本体论引擎_v1.0-20260716.md)（历史，独立工程版本）
- [TECH-ONT API 规范](../../../TECH-ONT/docs/SPEC-TECH-ONT-本体引擎API规范_v1.0-20260716.md)（含 § 11.2 本体发现端点）
- [项目总览](../../../README.md)
- [应用架构（v1.2）](../../../docs/001-ARCH/ARCH-Mate_Platform-应用架构_v1.2-20260721.md)