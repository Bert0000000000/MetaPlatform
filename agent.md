# agent.md

> 本文件供 AI Agent（Cursor、Claude Code、Copilot、Codex、Windsurf 等）读取，提供项目上下文、架构约束与开发规范。
> **最近更新**：2026-07-27（v3.0 Plan D Polyglot Microservice Architecture 正式版）
>
> **当前架构版本**：**v3.0**（详见 `docs/active/specs/2026-07-27-mate-platform-technical-architecture.md`）
>
> **v1.2 / v2.0 / v2.1 状态**：已废止 / 已演进为 v3.0（已归档）

## 项目概述

**Mate Platform** 是基于 Ontology 本体引擎 + 多语言微服务架构的企业级 AI 平台。

### 核心能力
- **Ontology 本体引擎**：统一语义建模与推理，业务对象为主要构建块
- **低代码应用构建**：融合 BPMN 审批流（fixed-layout）与 AI Agent 编排流（free-layout）
- **数字员工**：AI 驱动的自动化员工，制度提炼、流程访谈、任务执行
- **企业级 RAG 知识库**：深度文档解析 + GraphRAG 检索 + 智能问答
- **MCP / A2A 协议**：对接外部 AI 工具与外部 Agent 系统
- **数据治理**：CDC + 数据湖 + 数据仓库

### 14 个核心业务场景（v3.0）

| ID | 场景 | 阶段 |
|---|---|---|
| S1 | 知识库建立（PPT/Word/PDF 文档上传 + 解析 + 切片） | P1 |
| S2 | Ontology 抽象（内容/对话抽取） | P2 |
| S3 | 知识问答（多 Agent 协同） | P1-P3 |
| S4 | 智能体编排生成（BPMN） | P4 |
| S5 | 智能巡检（定期） | P4 |
| **S5b** | **实时阈值触发**（数据变化 + 规则命中 + AI 响应） | P4 |
| S6 | Ontology 演进与版本管理 | P5 |
| S7 | 知识检索反馈闭环 | P3 |
| S8 | 多模态文档解析（图/表/公式） | P1 |
| S9 | 知识推荐与主动推送 | P4 |
| S10 | 企业级知识治理（权限/审计/脱敏/合规） | P5 |
| S11 | 跨组织知识共享 | P5 |
| S12 | 知识冲突解决 | P3 |
| S13 | 应急异常处理 | 持续 |

**完整场景设计**：`docs/active/specs/2026-07-27-mate-platform-technical-architecture.md` §10

## 当前架构：v3.0 Plan D Polyglot Microservice

### 核心思想
> **"语言退到实现层，服务显式化"**——Java 引擎服务化 + Python AI 生态，按需选最佳技术。

### 技术栈（v3.0）

#### 主后端（Python 主力）
- **语言**：Python 3.12+
- **Web**：FastAPI 0.115+ / uvicorn / uvloop / granian
- **数据**：SQLAlchemy 2.0 / SQLModel / Pydantic v2
- **AI 编排**：LangChain 1.3+ / LlamaIndex / LangGraph 1.2.9+
- **类型**：pyright (Microsoft) - 比 mypy 严格
- **包管理**：uv (Astral)

#### AI 子域（Python 服务）
- **RAGFlow**（AGPL-3.0）：DeepDoc 文档解析
- **LightRAG**（MIT）：GraphRAG 检索 + 实体抽取
- **DeerFlow**（MIT）：多 Agent 编排

#### 企业引擎（Java 微服务）
- **Flowable 7.x**：BPMN 2.0 工作流
- **Drools 8.x/9.x**：企业规则引擎
- **Keycloak 24.x**：IAM / SSO / OIDC

#### 基础设施
- **数据库**：PostgreSQL 17（多 schema 隔离）/ Neo4j 5.x（3 database 隔离）/ Milvus 2.5
- **对象存储**：MinIO
- **消息队列**：**Apache Kafka 3.9**
- **缓存**：Redis 7.4 / Valkey 8
- **服务发现**：Nacos 3.0+（MCP / A2A 注册中心）
- **可观测**：OpenTelemetry 1.45+ / Prometheus 3.x / Grafana 11.x

#### 前端
- **语言**：TypeScript 5.7+
- **框架**：React 19 + Vite 6
- **UI 库**：Ant Design 6.0 + Ant Design X 2.0
- **流程画布**：FlowGram.AI
- **可视化**：AntV X6
- **包管理**：pnpm 10.x

#### 容器与服务网格
- **Kubernetes 1.32** + **Istio 1.24**（mTLS）
- **容器**：Docker 24+ / containerd 1.7+
- **Helm**：3.x
- **CI/CD**：GitHub Actions / Argo CD

## 仓库结构（2026-07-27）

```
D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\
├── metaplatform-frontend/        # 前端 monorepo
├── docs/                          # 文档
│   ├── prd/                       # APP-* PRD（已完成）
│   ├── superpowers/specs/         # 架构规范（v3.0 在此）
│   │   ├── 2026-07-27-mate-platform-technical-architecture.md  ⭐ THE ONE DOC
│   │   ├── 2026-07-27-openviking-future-architecture-candidate.md
│   │   └── archive/               # v1 / v2 历史文档
│   ├── legal/                     # 法务自评估
│   └── reviews/                   # 评审报告
├── TECH-A2A/                      # A2A 协议
├── TECH-AGENT/                    # Agent（含 DeerFlow 集成）
├── TECH-IAM/                      # IAM
├── TECH-LLMGW/                    # LLM 路由
├── TECH-MCP/                      # MCP 协议
├── TECH-ONT/                      # Ontology
├── TECH-RAG/                      # RAG（含 RAGFlow/LightRAG 桥接）
└── agent.md / CLAUDE.md           # 本文件
```

## 架构约束（v3.0 铁律）

### 7 条原则
1. **主力栈优先**：新项目默认 Python 3.12+ + FastAPI
2. **AI 子域允许 Python**：RAG / Agent / OCR / ML 等
3. **核心业务后端必须 Java**（P3 硬约束）：交易/订单/权限
4. **法务合规是硬约束**：所有新组件需过自评估
5. **可观测性高于语言统一**：跨语言栈统一接 TECH-OBS
6. **AI 协作是新能力维度**：团队需主动用 AI
7. **季度复盘 + 决策可逆**：可回退到 v1.3（如需）

### GoF 23 个设计模式（v3.0 §2.10 强制应用）

| 类别 | 必用模式 | v3.0 应用 |
|---|---|---|
| **Creational** | Factory Method / Builder / Abstract Factory | LLM 工厂、查询构建、存储族 |
| **Structural** | Adapter / Decorator / Facade / Proxy | 外部服务包装、HTTP 增强、复杂系统简化 |
| **Behavioral** | Observer / Strategy / Mediator / Chain of Responsibility | 事件订阅、算法切换、Router、中间件 |

**详细应用**：`docs/active/specs/2026-07-27-mate-platform-technical-architecture.md` §2.10

### 数据归属规则
- **PG**：8 schema 隔离（rag / rag_parser / rag_ke / rag_lightrag / rag_citation / rag_router / rag_bridge_*）
- **Neo4j**：3 database 隔离（tech-ont / lrag-graph / rag-graphrag）
- **Milvus**：多 collection 命名空间

## 开发阶段（已规划）

| 阶段 | 周数 | 交付 | 场景 |
|---|---|---|---|
| **P0 基础** | 1-2 | 基线评估 + 环境 | — |
| **P1 RAG MVP** | 4-6 | 上传 + 检索 | S1, S3, S8 |
| **P2 知识工程** | 3-4 | 抽取 + 审核 | S2 |
| **P3 高级检索** | 3-4 | GraphRAG + Router | S3 增强, S7, S12 |
| **P4 工作流** | 3-4 | Flowable + Drools | S4, S5, S5b, S9 |
| **P5 企业级** | 3-4 | 版本/治理/多租户 | S6, S10, S11, S13 |
| **P6 打磨** | 2-3 | 性能 + 文档 | 全部 |

**总计 19-27 周（5-7 个月）**

## 开发规范

### 代码风格
- **Python**：Ruff + Black + isort（自动）
- **Java**：Checkstyle + SpotBugs + 阿里巴巴 P3C
- **TypeScript**：ESLint + Prettier

### 测试规范
- 单元测试 ≥ 70% 覆盖
- 集成测试用 Testcontainers
- 契约测试用 Pact
- 端到端用 Playwright

### 提交规范
- Conventional Commits
- 中文 commit message 可接受
- 重大变更需 Owner 签字

### 文档规范
- 主架构 → `docs/active/specs/2026-07-27-mate-platform-technical-architecture.md`
- 历史 → `docs/superpowers/specs/archive/`
- PRD → `docs/active/prd/`
- 修改本文件前请 review 一次主架构

## 关键技术决策（v3.0）

### 决策 1：v2 已废止
> v1.2 "去 Python" / v2 "主力 + 子域" 都已被 v3.0 "Polyglot Microservice" 替代
> **新公理**："AI 作为技术专家" + 团队 + AI + 法务三重判断

### 决策 2：RAGFlow + LightRAG 双引擎
- **RAGFlow**（AGPL-3.0）：仅用 DeepDoc 文档解析
- **LightRAG**（MIT）：GraphRAG 检索 + 实体抽取
- 自评估：`docs/active/legal/LEGAL_CLEARANCE-ragflow-2026-07-27.md`

### 决策 3：Java 引擎服务化
- **Flowable**：BPMN 2.0
- **Drools**：企业规则
- **Keycloak**：IAM
- 全部通过 REST 暴露，Python 主后端调用

### 决策 4：Kafka 事件驱动
- Apache Kafka 3.9
- 9 个主题（domain.* / integration.* / cmd.*）
- Outbox 模式 + Saga 模式

### 决策 5：Neo4j 三库隔离
- `tech-ont`：受治理 Ontology
- `lrag-graph`：LightRAG 自动图
- `rag-graphrag`：备用
- 严格 label 前缀

## P0 立即启动（开发第一天）

按 6 阶段路线图，**P0 基础今天就启动**：

1. ✅ 评估现有 RAG 能力（Recall@10 baseline）
2. ✅ 部署 RAGFlow / LightRAG 服务（Docker Compose）
3. ✅ 准备 50 份评估语料
4. ✅ 锁定各组件版本
5. ✅ CI/CD 流水线
6. ✅ Neo4j 准备 lrag-graph database
7. ✅ Python venv 准备（uv）

---

## 相关文档

- **主架构**：`docs/active/specs/2026-07-27-mate-platform-technical-architecture.md` ⭐
- **RAG 子系统**：主架构 §9
- **14 业务场景**：主架构 §10
- **软件设计模式**：主架构 §2
- **GoF 23 个设计模式**：主架构 §2.10
- **Flowable + DeerFlow 集成**：主架构 §3.1 / §3.2
- **PRD 集合**：`docs/active/prd/`
- **OpenViking 候选**：`docs/active/specs/2026-07-27-openviking-future-architecture-candidate.md`

## 给 AI Agent 的关键提示

> **当被问及架构决策时**：
> 1. **第一参考**：`docs/active/specs/2026-07-27-mate-platform-technical-architecture.md`（THE ONE DOC）
> 2. **当前版本**：v3.0（v1.2 / v2 / v2.1 已废止）
> 3. **关键路径**：Python 主后端 + Java 引擎服务 + Python AI 服务
> 4. **14 业务场景**：评估完整性的标准
> 5. **GoF 23 模式**：写代码必用 Adapter / Builder / Strategy / Observer 等