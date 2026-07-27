# CLAUDE.md

> 本文件供 Claude Code 读取，提供项目上下文、架构约束与开发规范。
> **最近更新**：2026-07-27（v3.0 Plan D Polyglot Microservice Architecture 正式版）
>
> **当前架构版本**：**v3.0**（替代 v2.0 / v2.1，详见 `docs/active/specs/2026-07-27-mate-platform-technical-architecture.md`）
>
> **v1.2 / v2.0 / v2.1 状态**：已废止（v1.2）/ 已演进为 v3.0（v2.0 / v2.1 已归档）

## 项目概述

**Mate Platform** 是基于 Ontology 本体引擎 + 多语言微服务架构的企业级 AI 平台。

### 核心能力
- **Ontology 本体引擎**：统一语义建模与推理，业务对象为主要构建块
- **低代码应用构建**：融合 BPMN 审批流（fixed-layout）与 AI Agent 编排流（free-layout）
- **数字员工**：AI 驱动的自动化员工，制度提炼、流程访谈、任务执行
- **企业级 RAG 知识库**：深度文档解析 + GraphRAG 检索 + 智能问答
- **MCP / A2A 协议**：对接外部 AI 工具（Cursor/Claude/Codex）与外部 Agent 系统
- **数据治理**：CDC + 数据湖（Hudi/Iceberg）+ 数据仓库（StarRocks）

### 14 个核心业务场景

| ID | 场景 | 实现状态 |
|---|---|---|
| S1 | 知识库建立（文档上传 PPT/Word/PDF） | 🆕 P1 |
| S2 | Ontology 抽象（内容抽取/对话抽取） | 🆕 P2 |
| S3 | 知识问答（多 Agent 协同） | 🆕 P1-P3 |
| S4 | 智能体编排生成 | 🆕 P4 |
| S5 | 智能巡检（定期） | 🆕 P4 |
| **S5b** | **实时阈值触发** | 🆕 P4 |
| S6 | Ontology 演进与版本 | 🆕 P5 |
| S7 | 知识反馈闭环 | 🆕 P3 |
| S8 | 多模态文档解析 | 🆕 P1 |
| S9 | 知识推荐与主动推送 | 🆕 P4 |
| S10 | 企业级知识治理 | 🆕 P5 |
| S11 | 跨组织知识共享 | 🆕 P5 |
| S12 | 知识冲突解决 | 🆕 P3 |
| S13 | 应急异常处理 | 🆕 持续 |

**完整场景设计见**：`docs/active/specs/2026-07-27-mate-platform-technical-architecture.md` §10

## 当前架构：v3.0 Plan D Polyglot Microservice

### 核心思想
> **"语言退到实现层，服务显式化"**——Java 引擎服务化 + Python AI 生态，按需选最佳技术。

### 技术栈基线（v3.0）

| 维度 | 选型 | 备注 |
|---|---|---|
| **主后端语言** | **Python 3.12+** | FastAPI + Pydantic + LangChain |
| **AI 子域** | **Python** | RAGFlow / LightRAG / DeerFlow |
| **企业引擎** | **Java 21** | Flowable / Drools / Keycloak 微服务 |
| **关系数据库** | PostgreSQL 17 | 多 schema 隔离 |
| **图数据库** | Neo4j 5.x | 3 database 隔离（tech-ont / lrag-graph / rag-graphrag） |
| **向量数据库** | Milvus 2.5 | RAG 向量检索 |
| **对象存储** | MinIO | 原始文件 |
| **消息队列** | **Apache Kafka 3.9** | 跨服务事件流 + Outbox + Saga |
| **缓存** | Redis 7.4 | 通用缓存 |
| **服务发现** | Nacos 3.0+ | 注册/配置/MCP/A2A |
| **可观测** | OpenTelemetry 1.45+ | TraceID 全链路 |
| **前端** | React 19 + TypeScript 5.7+ | pnpm monorepo |
| **容器** | Kubernetes 1.32 + Istio 1.24 | mTLS / 流量管理 |

### 仓库结构（2026-07-27）

```
D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\
├── metaplatform-frontend/        # 前端 monorepo（已落地）
├── docs/                          # 文档
│   ├── prd/                       # APP-* PRD（已完成）
│   ├── superpowers/specs/         # 架构规范（v3.0 在此）
│   │   ├── 2026-07-27-mate-platform-technical-architecture.md  ⭐ THE ONE DOC
│   │   ├── 2026-07-27-openviking-future-architecture-candidate.md
│   │   └── archive/               # 历史文档（v1/v2 已归档）
│   ├── legal/                     # 法务自评估
│   └── reviews/                   # 评审报告
├── TECH-A2A/                      # A2A 协议模块
├── TECH-AGENT/                    # Agent 模块（已部分实现 DeerFlow 集成）
├── TECH-IAM/                      # IAM 模块
├── TECH-LLMGW/                    # LLM 路由模块
├── TECH-MCP/                      # MCP 协议模块
├── TECH-ONT/                      # Ontology 模块
├── TECH-RAG/                      # RAG 模块（既有）
├── metaplatform-design-draft/     # 设计稿
└── agent.md / CLAUDE.md           # 本文件
```

## 架构约束（v3.0 铁律）

### 5 条 P0 原则
1. **主力栈优先**：新项目默认 Python 3.12+ + FastAPI
2. **AI 子域允许 Python**：RAG / Agent / OCR 等子域
3. **核心业务后端必须 Java**（**P3**）：交易/订单/权限
4. **法务合规是硬约束**：所有开源组件需过自评估
5. **可观测性高于语言统一**：跨语言栈统一接 TECH-OBS

### 6 大模块（v3.0 RAG 子系统）
| 模块 | 职责 | 状态 |
|---|---|---|
| DeepParser | RAGFlow 文档解析 | 🆕 P1 |
| Retrieval | Hybrid + Graph-Enhanced | ✅ 已有 |
| LightRAG | GraphRAG 检索 | 🆕 P3 |
| Knowledge Engineering | 抽取 + 审核 + Commit | 🆕 P2 |
| Citation & Evidence | 多层引用 | ✅ 已有 |
| RetrievalRouter | 统一入口 AUTO 路由 | 🆕 P1 |

### 5 个 Java 微服务（v3.0 新增）
| 服务 | 职责 | 阶段 |
|---|---|---|
| **Flowable Service** | BPMN 2.0 工作流 | P4 |
| **Drools Service** | 企业规则引擎 | P4 |
| **Keycloak Service** | IAM / SSO | P5 |
| RAGFlow | DeepDoc 解析 | P1 |
| LightRAG | GraphRAG 检索 | P3 |

## 开发阶段规划（已就绪启动）

| 阶段 | 周数 | 核心交付 | 涉及场景 |
|---|---|---|---|
| **P0 基础** | 1-2 周 | 基线评估 + 环境就绪 | — |
| **P1 RAG MVP** | 4-6 周 | 文档上传 + 检索问答 | S1, S3 |
| **P2 知识工程** | 3-4 周 | 抽取 + 审核 + Commit | S2 |
| **P3 高级检索** | 3-4 周 | GraphRAG + Router | S3 增强 |
| **P4 工作流** | 3-4 周 | Flowable + Drools | S4, S5, S5b |
| **P5 企业级** | 3-4 周 | 版本/治理/多租户 | S6, S10, S11 |
| **P6 打磨** | 2-3 周 | 性能优化 + 文档 | 全部 |

**总计：19-27 周（5-7 个月）**

## 关键技术决策（v3.0）

### 决策 1：v2 决策已废止
> v1.2 "去 Python"、v2 "主力 + 子域" 都已被 v3.0 "Polyglot" 替代
> **新公理**："AI 作为技术专家" + 团队 + AI + 法务三重判断

### 决策 2：RAGFlow + LightRAG 双引擎
- **RAGFlow**（AGPL-3.0，自评估通过）：仅做 DeepDoc 文档解析
- **LightRAG**（MIT）：GraphRAG 检索 + 实体抽取
- **不**直接用其 RAG 引擎 / UI / 配置

### 决策 3：服务间通过 Kafka 事件解耦
- 9 个 Kafka 主题
- Outbox 模式保证不丢
- Saga 模式处理分布式事务

### 决策 4：Neo4j 三库隔离
- `tech-ont`：受治理 Ontology
- `lrag-graph`：LightRAG 自动图
- `rag-graphrag`：备用
- 严格 label 前缀隔离

## 开发规范

### 代码规范
- **Python**: Ruff + pyright + Pydantic v2
- **Java**: Checkstyle + SpotBugs + Spring Boot 3.5

### 测试规范
- 单元测试覆盖率 ≥ 70%
- 关键路径 100%
- 集成测试用 Testcontainers

### 提交规范
- Conventional Commits（feat / fix / docs / refactor）
- 中文 commit message 可接受
- 重大变更需 Owner 签字

### 文档规范
- 所有规范在 `docs/superpowers/specs/`
- 历史文档归档到 `archive/`
- 主架构是 THE ONE DOC

## 开发阶段 P0 立即启动

按昨天讨论的 6 阶段路线图，**P0 基础是今天就启动的**：

1. ✅ 评估现有 RAG 能力（Recall@10 baseline）
2. ✅ 部署 RAGFlow / LightRAG 服务
3. ✅ 准备 50 份评估语料
4. ✅ 锁定各组件版本
5. ✅ CI/CD 流水线

**详细任务清单见**：下次出 `P0-tasks.md` 规范

---

## 相关文档

- **主架构**：`docs/active/specs/2026-07-27-mate-platform-technical-architecture.md` ⭐
- **RAG 子系统**：主架构 §9
- **14 业务场景**：主架构 §10
- **软件设计模式**：主架构 §2
- **GoF 23 个设计模式**：主架构 §2.10
- **Flowable 集成**：`docs/superpowers/specs/2026-07-26-ontology-deerflow-final-delivery-plan.md`
- **DeerFlow 部署**：`docs/superpowers/specs/2026-07-26-deerflow-production-integration-design.md`
- **PRD 集合**：`docs/active/prd/`

## 给 AI Agent 的关键提示

> **当被问及架构决策时**：
> 1. 先看 `docs/active/specs/2026-07-27-mate-platform-technical-architecture.md`（THE ONE DOC）
> 2. v3.0 是当前；v2 / v1 已废止
> 3. 关键路径：Python 主后端 + Java 引擎服务 + Python AI 服务
> 4. 14 业务场景是评估完整性的标准