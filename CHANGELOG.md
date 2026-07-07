# 变更日志 (CHANGELOG)

本文件记录 MetaPlatform 项目的所有重要变更。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [v1.0.0] - 2026-07-07

### 🎉 正式发布 — 全平台前后端联调完成，零硬编码数据

### 新增 (Added)
- **54 张数据库表 + 64 个 API 端点**，覆盖所有末级功能
  - 本体引擎：安全规则（7 条种子数据）、自动编号规则（8 条）
  - 质量中心：本体测试（8 条）、UI 测试（10 条）、流程测试（7 条）、AI 修复建议（6 条）、测试报告（5 条）
  - 知识库：处理任务（8 条）、订阅管理（6 条）
  - 数据中心：ETL 任务（6 条）、质量规则（9 条）、实时监控事件（8 条）
  - 云市场：开发者排行（8 条）、Skill 市场（7 条）、工作流模板（8 条）、知识包（7 条）、API 库（8 条）
- **前端 17 个组件全部对接 API**，替代所有硬编码数据
- 价值链可编辑画布（设计态拖拽排序、编辑/新增/删除阶段、自动保存）
- 8 个缺失根路径 handler 的路由文件修复
- `.gitignore` 添加 `**/dist/`、`data/`、`backups/`，移除已跟踪的构建产物

### 变更 (Changed)
- 价值链 UI 重设计：SVG 节点风格统一（rx=8, fillOpacity=0.15, strokeWidth=2, #94a3b8 箭头）
- 云市场分类/统计从硬编码改为模板数据动态计算
- 质量中心 Dashboard 统计从硬编码改为 qualityApi.getStats() 动态加载
- 知识库搜索从 mock setTimeout 改为真实 knowledgeApi.search() 调用
- SuperAI 新任务对话框 agent 列表从硬编码改为 agentsApi.list() 动态加载
- 本体引擎 objects/properties/relations 改为 ontologyApi 全量加载
- 架构中心 4 个子组件（BA/AA/DA/TA）全部二级数据从 API 加载

### 测试 (Testing)
- 38 个 API 端点端到端测试全部通过（26 个已有 + 12 个新增根路径 + 17 个新业务 API）
- TypeScript 编译 0 错误
- Vite 生产构建成功（7.87s，JS 2MB gzip 563KB）

---

## [v0.9.0] - 2026-07-06

### 新增 (Added)
- 架构中心全栈联调（后端 routes + DB seed + 前端 API 层）
  - 4 个架构数据区块：BA（业务架构）、AA（应用架构）、DA（数据架构）、TA（技术架构）
  - 6 个价值链阶段、12 项业务能力、8 个业务角色、8 个业务事件、9 个业务对象
  - 6 个应用依赖、8 个业务-应用矩阵、6 个应用-数据矩阵
  - 6 个数据域、4 层数据湖仓、3 类实时分发
  - 6 层技术栈、4 个部署拓扑、4 项可观测性、9 个技术选型对比

---

## [v0.8.0] - 2026-07-05

### 新增 (Added)
- Node.js Express 后端 API 服务器（port 3001）
- SQLite 数据库 + 自动迁移 + 种子数据
- 27 个 REST API 路由模块（apps, ontology, processes, knowledge, agents, data, quality, market, admin, messages, flowable, llm, dispatch, announcements, todos, triggers, orchestrations, knowledge-qa, knowledge-graph, filesystem, export, export-history, versions, ocr, architecture, pages）
- 前端 API 客户端层（src/lib/api.ts）统一封装
- 12 个一级菜单页面全部接入 API（工作台、应用中心、超级 AI、架构中心、流程中心、数据中心、本体引擎、知识库、质量中心、云市场、数字员工、后台管理）

---

## [v0.7.0] - 2026-07-04

### 新增 (Added)
- 前端 React 应用完整重构（React 19 + Vite 7 + Tailwind 4 + shadcn/ui）
- 12 个一级菜单页面：工作台、应用中心、超级 AI、架构中心、流程中心、数据中心、本体引擎、知识库、质量中心、云市场、数字员工、后台管理
- 流程设计器 v2（BPMN 2.0 + SVG 画布 + 5 种节点 + 连线）
- 前端路由（React Router 7）+ 响应式布局（侧边栏 + 顶部导航）

---

## [v0.6.0] - 2026-07-03

### 新增 (Added)
- MVP Phase 5：业务规则引擎 + AI 增强 + OLAP 分析 + 集成深层能力 + OpenAPI 文档
- 业务规则公式引擎（Aviator 表达式求值、自动编号生成、条件评估）
- 数据质量评估服务（完整性评分、唯一性评分）
- OLAP 分析能力（维度建模、聚合查询）
- 集成适配器深层对接（Webhook、消息队列、文件传输）
- OpenAPI / Swagger UI 配置（springdoc-openapi 2.3.0）

---

## [v0.5.0] - 2026-07-03

### 新增 (Added)
- MVP Phase 4：版本管理 + 主数据管理 + 数据血缘 + 适配器 + 管理面板
- 本体版本管理服务（OntologyVersionService）
- 主数据管理模块（MdmService）：黄金记录、匹配、去重
- 数据血缘追踪（LineageService）：血缘事件记录和查询
- 文件存储服务（FileStorageService）
- 多模态处理服务（MultimodalService）

---

## [v0.4.0] - 2026-07-03

### 新增 (Added)
- MVP Phase 3：关系管理 + 流程引擎 + Agent 运行时 + 计费系统
- 对象关系管理（RelationshipService）
- 流程引擎（ProcessEngine）：流程定义、实例、任务、事件
- Agent 运行时（AgentController）
- Token 计费服务（BillingController）

---

## [v0.3.0] - 2026-07-03

### 新增 (Added)
- MVP Phase 2：RAG 知识库 + 对话系统 + 能力库 + 集成中枢 + 安全模块
- 知识库服务（KnowledgeService）
- 对话系统（DialogueController）
- 能力注册与管道编排（CapabilityRegistry、PipelineService）
- 安全服务（SecurityService）：RBAC 权限、行级过滤、字段级控制

---

## [v0.2.0] - 2026-07-03

### 新增 (Added)
- MVP Phase 1：业务对象 + AI 能力 + 页面生成
- 业务对象类型定义（ObjectType）
- AI 字段建议（AiFieldService）
- 自然语言建模（NlModelingService）

---

## [v0.1.0] - 2026-07-02

### 新增 (Added)
- Spike：本体引擎骨架搭建
- 项目基础架构（Spring Boot 3.2.5 + Java 21）
- 本体元数据管理（EntityType、Property、RelationType）
- Neo4j 图数据库适配器
- PostgreSQL 关系数据库适配器
