# 变更日志 (CHANGELOG)

本文件记录 MetaPlatform 项目的所有重要变更。
格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [v1.3.0] - 2026-07-07

### 新增 (Added)
- **Phase 3 完成：AI 基质增强**
  - **Embeddings 服务** (`src/ai/embeddings.js`)
    - OpenAI Provider：`text-embedding-3-small` (1536d) / `text-embedding-3-large` (3072d)
    - Deterministic hash fallback (384d) — 无 API Key 也能跑
    - Batch embed (chunks of 100)、topK cosine-similarity
  - **LLM Gateway** (`src/ai/llm-gateway.js`)
    - 多 Provider 抽象：OpenAI / Anthropic Claude / Echo (stub)
    - `chat()` 同步调用、`streamChat()` AsyncIterable 流式输出
    - 自动 provider 探测：`LLM_API_KEY` → OpenAI；`ANTHROPIC_API_KEY` → Anthropic；否则 echo
    - SSE 流式端点 `/api/ai/chat/stream`
  - **Agent Orchestrator** (`src/ai/agent.js`)
    - Think-Act-Observe 循环，最多 N 步工具调用
    - 内置 5 个工具：`search_knowledge` / `get_ontology_object` / `query_graph` / `get_process_status` / `emit_event`
    - 自动解析 LLM 返回的 JSON 工具调用（支持 fenced 和 bare JSON）
  - **OCR 服务** (`src/ai/ocr.js`)
    - tesseract.js 集成，支持 `eng+chi_sim` 多语言
    - Language detection 启发式（CJK/拉丁/数字比例）
    - Worker 缓存复用，首次加载后毫秒级响应
  - **RAG 服务** (`src/ai/rag.js`)
    - 完整检索增强生成流程：embed → retrieve → context → LLM answer
    - 混合打分：Milvus 向量检索 + Elasticsearch 关键词检索
    - 自动 citations（每个引用带 id/title/score/source）
    - Context window 限制（8000 字符默认）
  - **统一 AI 路由** (`src/routes/ai.js`)
    - `GET /api/ai/status` — 全部 AI 子系统健康
    - `POST /api/ai/embed` / `embed/batch` — 文本向量化
    - `POST /api/ai/chat` / `chat/stream` — 同步/流式聊天
    - `POST /api/ai/agent` / `GET /api/ai/agent/tools` — Agent 运行
    - `POST /api/ai/rag/index` / `rag/retrieve` / `rag/answer` — RAG 三段式
    - `POST /api/ai/ocr` (multipart) / `ocr/detect` — OCR 识别 + 语言检测
- `src/ai/index.js` barrel file + `getStatus()` 聚合

### 变更 (Changed)
- `seed-storage.js`：Milvus 向量改用真实 `embed()`（可走 OpenAI 或 deterministic）
- `index.js`：注册 `app.use("/api/ai", authenticate, aiRoutes)`

### 新增依赖
- `openai` ^4.x
- `@anthropic-ai/sdk` ^0.30.x
- `tesseract.js` ^5.x

### 验证 (Verified)
- Phase 3 集成测试 `test-phase3-v2.ps1`：**12/12 通过**
  - AI 状态：embeddings/llm/ocr/agent 全部上线
  - Embeddings：384d 单文本 + 3 文档 batch
  - LLM Chat：echo 模式 stub 输出（按预期）
  - **RAG 索引** 3 文档 → **retrieve 4 chunks** 混合打分（vector 0.50 + keyword 0.98）
  - **RAG end-to-end** 4 citations
  - **Agent**：5 工具列表 + 单步运行成功
  - **OCR detect**：English → `en`、Chinese → `zh` 都正确

---

## [v1.2.0] - 2026-07-07

### 新增 (Added)
- **Phase 2 完成：存储层升级**
  - **Neo4j 5.20 本体图谱引擎**
    - 真实 Docker 容器部署（`bolt://localhost:7687`）
    - 4 个 ontology 对象 + 3 个关系已 seed 到图数据库
    - 提供子图查询、节点合并、关系创建、Cypher 原生查询
  - **Elasticsearch 8.13 全文检索**
    - 真实 Docker 容器部署（`http://localhost:9200`，cluster status: green）
    - 中文友好 standard analyzer + English keyword
    - 提供 bulk 索引、多字段 multi_match 搜索、highlight
    - 已 seed 10+ 个文档（7 知识库 + 3 测试）
  - **MinIO 对象存储**
    - 真实 Docker 容器部署（`localhost:9000`，console: `localhost:9001`）
    - 自动创建 bucket、multipart 文件上传、presigned URL、对象列表
  - **Milvus 向量数据库** + 内存 cosine-similarity fallback
    - Milvus SDK 与内存实现自动切换
    - 提供 collection 创建、向量插入、top-K 相似度搜索
    - 默认 embedding dim = 384（BGE-small 兼容）
  - **Kafka 3.7 事件总线**
    - 复用已有 `mp-kafka-spike` broker（KRaft 单节点）
    - producer + consumer + 领域事件 helper（knowledge/ontology/process/file）
  - **统一存储路由 `/api/storage`**
    - `GET /health` — 所有后端聚合健康检查
    - Neo4j: `/neo4j/query`, `/neo4j/node`, `/neo4j/relation`, `/neo4j/subgraph/:id`, `/neo4j/relations/:id`, `/neo4j/node/:id`
    - ES: `/es/search`, `/es/index`, `/es/bulk`, `/es/:id`
    - Milvus: `/milvus/collection`, `/milvus/insert`, `/milvus/search`, `/milvus/collections`, `/milvus/collection/:name`
    - MinIO: `/minio/upload` (multipart), `/minio/url/*`, `/minio/list`, `/minio/*`
    - Kafka: `/kafka/publish`, `/kafka/topics`, `/kafka/subscribe`
  - **ESM 重构**：`integrations/*` 从 CommonJS 转为 ESM
    - `neo4j.js` / `elasticsearch.js` / `milvus.js` / `minio.js` 全部 `export async function`
    - 新增 `kafka.js`（完整 producer/consumer）
    - `keycloak.js` / `argocd.js` / `ocr.js` / `simulation.js` / `quality.js` 改 ESM stub
    - barrel `index.js` 提供 `initAll()` + `healthCheckAll()`
  - **Seed 脚本 `seed-storage.js`**：从 PG 读取数据同步到 Neo4j/ES/Milvus
  - **Docker Compose** 增加 neo4j / elasticsearch / minio / kafka 4 个服务
  - **`.env.example` + `.env`** 增加所有 Phase 2 配置项

### 变更 (Changed)
- `index.js` 启动时调用 `initAll()` 初始化 5 个存储后端
- 健康检查 `/api/health` 集成所有存储后端状态
- ES 客户端降级到 `@elastic/elasticsearch@^8.13.0` 兼容 ES 8.x 服务端
- `db-pg.js` 默认不 DROP schema（仅 `DB_PG_RESET_SCHEMA=1` 时重置）

### 验证 (Verified)
- 集成测试脚本 `test-phase2.ps1`：10/11 步骤通过
  - Neo4j: 4 nodes / 4 edges subgraph 查询、节点创建、Kafka emit 联动
  - ES: bulk 索引 3 文档、英文/中文 multi_match + highlight
  - Milvus: collection 列表、内存 cosine-similarity 搜索
  - MinIO: 文件上传 + Kafka emit、对象列表查询
  - Kafka: 1 条事件发布到 `metaplatform.test.event`
  - Health: 5 个后端全部 connected/green

---

## [v1.1.0] - 2026-07-07

### 新增 (Added)
- **Phase 0 完成：生产化基础设施搭建**
  - PostgreSQL 适配器（`db-adapter.js` + `db-pg.js` + `pg-worker.mjs`）
    - 双驱动模式：`DATABASE_URL` 存在时用 PostgreSQL，否则用 SQLite（向后兼容）
    - Worker Thread + SharedArrayBuffer + Atomics.wait 实现同步代理，零路由文件改动
    - 50+ 张表完整 schema + 种子数据移植到 PostgreSQL 语法
  - Redis 缓存中间件（`middleware/cache.js`）
    - GET 请求自动缓存（默认 30s TTL）
    - POST/PUT/DELETE 自动失效对应前缀的缓存
    - Redis 不可用时自动降级（无感知）
    - 响应头 `X-Cache: HIT/MISS` 标识缓存状态
  - 健康检查增强：返回 `database`（postgresql/sqlite）+ `cache`（connected/disconnected）
  - Docker Compose 编排（`docker-compose.yml`）
    - PostgreSQL 16 + Redis 7 + API + Frontend（Nginx）
    - 健康检查 + 依赖启动顺序
  - GitHub Actions CI/CD（`.github/workflows/ci.yml`）
    - 后端测试：PG 服务容器 + 51 个端点 curl 健康检查
    - 前端构建：TypeScript 编译 + Vite 生产构建
    - Docker 构建：仅 main 分支触发
  - API Dockerfile + 前端 Dockerfile（多阶段构建）
  - Nginx 配置：SPA fallback + API 反向代理

### 变更 (Changed)
- 所有 27 个路由文件适配 PostgreSQL 异步查询（通过同步代理，零改动）
- `db.js` 重构为 adapter 入口，支持 SQLite/PostgreSQL 双模式切换

### 验证 (Verified)
- PostgreSQL 模式：51/51 API 端点全部通过
- Redis 缓存：首次 MISS → 二次 HIT → POST 后自动失效
- Docker Compose：一键启动全栈

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
