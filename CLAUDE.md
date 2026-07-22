# CLAUDE.md

> 本文件供 Claude Code 读取，提供项目上下文、架构约束与开发规范。

## 项目概述

Mate Platform 是基于 Ontology 本体论引擎的企业级决策与运营提效平台。

核心能力：Ontology 本体引擎（统一语义建模与推理）、低代码应用构建（融合 BPMN 审批流与 AI Agent 编排）、数字员工（AI 驱动的自动化）、企业级 RAG 知识库、MCP/A2A 协议支持、数据治理（CDC + 数据湖 + 数据仓库）。

**当前技术栈基线（2026-07-21 v1.2 重构）**：

- **后端语言**：**Java 21（唯一后端栈）**
- **后端框架**：**Spring Boot 3.5.x + Spring AI 1.1.2**
- **AI 编排统一基座**：**Spring AI Alibaba 1.1.2.0**（BOM 统一管理）
- **AI 协议注册中心**：**Nacos 3.0.1+**（MCP / A2A 注册、模型路由动态配置）
- **6 个 Python 服务（TECH-LLMGW / AGENT / RAG / A2A / DATA / MCP）一次性重写为 Java**
- **Python 仅保留为运维脚本**（约 30+ 脚本归档）

## 技术栈

### 后端（v1.2 全量 Java + SAA）

| 类别 | 技术 | 版本 | 说明 |
|---|---|---|---|
| 语言 | **Java** | **21 LTS** | **单一后端语言** |
| 框架 | **Spring Boot** | **3.5.x** | 微服务基础 |
| 框架 | Spring Framework | 6.2.x | 底层容器 |
| 框架 | Spring Cloud | 2024.0.x | 微服务治理 |
| 框架 | Spring Cloud Alibaba | 2023.0.x | Nacos Config / Discovery |
| AI | **Spring AI** | **1.1.2** | Java LLM 集成抽象 |
| AI | **Spring AI Alibaba** | **1.1.2.0** | **AI 编排统一底座（BOM）** |
| AI | Spring AI Alibaba Extensions | 1.1.2.1 | 扩展 |
| 数据 | **Spring Data JPA** | 最新版 | **替换 SQLAlchemy** |
| Web | **Spring WebFlux** | 最新版 | **响应式 Web（替换 FastAPI async）** |
| 安全 | Spring Security | 6.4.x | OAuth2/JWT |
| 协议 | **Nacos** | **3.0.1+** | **MCP / A2A Registry + Config** |
| 数据库 | PostgreSQL | 17 | 主库 |
| 图库 | Neo4j | 5.x | 知识图谱 |
| 向量库 | Milvus（SAA VectorStore） | 2.5 | RAG 向量检索 |
| 仓库 | StarRocks | 3.4 / 4.0 | OLAP |
| 湖 | Hudi（主）/ Iceberg（备） | 1.x / 1.8 | 数据湖 |
| ETL | Flink + Airflow + DBT | 1.20 / 2.10 / 1.9 | 实时 + 批量 |
| 消息 | Kafka + RabbitMQ | 3.9 / 4.x | 事件 + 任务 |
| 缓存 | Redis / Valkey | 7.4 / 8 | 缓存 + 锁 |
| 测试 | JUnit 5 + Mockito + Testcontainers | 最新 | **替换 pytest** |

### 前端

- **React 19** + TypeScript 5.7 + Vite 6
- **Ant Design 6.0** + Ant Design X 2.0
- **FlowGram.AI**（fixed-layout 审批流 + free-layout Agent 编排）
- **AntV X6**（知识图谱 / 架构图可视化）

### 基础设施

- **Kubernetes 1.32** + Istio 1.24
- **OpenTelemetry 1.45** + Prometheus 3.x + Grafana 11.x + **SAA Graph Observation**
- **MinIO**（对象存储）
- **Nacos 3.0.1+**（MCP / A2A / Config 注册中心）

## 项目结构（v1.2 全量 Java）

```
MetaPlatform/
├── docs/
│   ├── 000-GUIDE/             # 规范与指南
│   ├── 001-ARCH/              # 架构设计
│   ├── 002-TS/                # 技术选型
│   ├── 003-SPEC/              # 规范与接口
│   ├── 004-PLAN/              # 计划与路线图
│   ├── 005-RD/                # 调研报告
│   └── 006-TMP/               # 临时脚本
├── APP-DASHBOARD/             # 仪表盘
├── APP-SUPERAI/               # 超级 AI
├── APP-DW/                    # 数字员工
├── APP-APPHUB/                # 应用中心（低代码+流程设计器）
├── APP-ONTSTUDIO/             # 本体论引擎（本体+数据中心+Action编排）
├── APP-ARCH/                  # 架构中心
├── APP-MCPHUB/                # MCP 服务中心
│
│ # 全量 Java 后端服务（v1.2 重构）
├── TECH-ONT/                  # 本体引擎服务（Java）
├── TECH-WFE/                  # 工作流引擎服务 / BPMN（Java 自研）
├── TECH-RULE/                 # 规则引擎服务（Java 自研）
├── TECH-ACTION/               # Action Engine 服务（Java 自研）
├── TECH-LLMGW/                # LLM Gateway 服务（Java + SAA ChatModel）
├── TECH-AGENT/                # Agent 服务（Java + SAA Agent Framework + Graph Core）
├── TECH-RAG/                  # RAG 引擎服务（Java + SAA Document/VectorStore）
├── TECH-MCP/                  # MCP 协议适配服务（Java + SAA Nacos MCP）
├── TECH-A2A/                  # A2A 协议适配服务（Java + SAA A2A Nacos）
├── TECH-EA/                   # EA 架构资产服务（Java）
├── TECH-DATA/                 # 数据集成与 ETL 服务（Java + Spring Batch）
├── TECH-IAM/                  # 身份认证与权限服务（Java）
├── TECH-GW/                   # API 网关服务（Java）
├── TECH-MSG/                  # 消息队列服务（Java）
├── TECH-OBS/                  # 可观测性服务（Java + SAA Graph Observation）
│
│ # Python 仅保留运维脚本（v1.2 归档）
├── docs/006-TMP/              # 30+ Python 运维脚本（迁移过程中归档保留）
│
└── infra/                     # 基础设施配置
```

## 命名规范

### 模块命名
- 应用模块：`APP-` + 大写缩写（例：`APP-DASHBOARD`、`APP-APPHUB`）
- 技术服务模块：`TECH-` + 大写缩写（例：`TECH-ONT`、`TECH-AGENT`）

### 文档命名
- 格式：`[类型]-[模块]-[主题]_v[版本]-[日期].md`
- 类型前缀：`ARCH`（架构）、`TS`（技术选型）、`SPEC`（规范）、`PLAN`（计划）、`RD`（调研）

### 代码命名
- **Java 包名**：`com.metaplatform.[模块小写].*`（例：`com.metaplatform.agent.saa`）
- **Java 类名**：PascalCase（例：`SaAgentReactService`、`MateLlmGwService`）
- TypeScript 目录：kebab-case（例：`ontology-editor/`）
- TypeScript 组件：PascalCase
- **API 路径**：`/api/v1/[模块]/[资源]`（例：`/api/v1/agent/react`）
- **Nacos 服务名**：`mate-{domain}-{service}`（例：`mate-mcp-server`、`mate-a2a-server`）
- **Python（仅运维脚本）**：snake_case 模块，PascalCase 类

## 架构约束

### 核心原则
1. **AI 是贯穿全栈的能力底座**，不是独立的一层
2. **Ontology 引擎是唯一数据真相源**
3. **前端和业务模块使用平台自身的低代码能力自举构建**
4. **业务对象（G2）为主要构建块**，G1/G3/G4 为辅助
5. **架构遵循 P3 双向同步**，以 Ontology 为单一真相源

### 后端语言统一（v1.2 重大约束）

**核心约束**：Mate Platform 后端统一为 Java 21，**禁止新增 Python 后端服务**。

| 范围 | 状态 |
|---|---|
| Java 后端服务 | 唯一允许的新增后端实现 |
| Python 运维脚本 | 允许保留，但禁止承载业务逻辑 |
| Python 测试代码 | 已重写为 JUnit 5，原 pytest 归档 |
| Python FastAPI 服务 | **全部重写为 Java + SAA** |

### AI 编排分层原则（v1.2 强化）

1. **Java 侧 AI 编排基于 Spring AI Alibaba 1.1.2.0**：Agent Framework / Graph Core / Nacos MCP / A2A Nacos 提供工程基座，业务封装层自研。
2. **AI 编排与 BPMN 工作流分工明确**：
   - BPMN 业务审批流 → TECH-WFE（自研状态机 + FlowGram.AI fixed-layout）
   - AI Agent 编排流 → TECH-AGENT（SAA Graph Core + FlowGram.AI free-layout）
   - 两者通过自研「Action 节点」互通
3. **LLM Gateway 自研层保留**：多模型路由 / 计费 / 审计 / Ontology 增强是核心差异化，底层用 SAA ChatModel 适配。
4. **MCP / A2A 必须通过 Nacos 3.0+ Registry 注册与发现**，禁止单点实现。
5. **Python LangChain / LangGraph 已退役**：禁止在新代码中使用，相关依赖从 pyproject.toml 中移除。

### 工程约束

- Kafka 消息发布必须使用 **Outbox 模式**
- 事件消费必须支持 **DLQ**，重试 3 次
- `trace_id` 必须在所有系统组件间传播
- DLQ 记录必须包含 `traceId`
- **Spring AI Alibaba 升级需通过 BOM 统一管理**
- **MCP / A2A 调用必须经过 IAM 鉴权与审计**
- **Spring Data JPA 替代 SQLAlchemy**，禁止在 Java 服务中使用 SQLAlchemy

### 协议支持

- **MCP（Model Context Protocol）**：
  - 实现：`spring-ai-alibaba` Nacos MCP + Nacos 3.0+ Registry（v1.2）
  - 平台作为 MCP Server 暴露 Tools / Resources / Prompts
  - 平台作为 MCP Client 调用第三方 MCP Server

- **A2A（Agent-to-Agent Protocol）**：
  - 实现：`spring-ai-alibaba-starter-a2a-nacos`（v1.2）
  - 与 Mate Workflow Engine 通过 Action 节点集成

## 模块上下游关系（v1.2 全 Java）

```
APP-DASHBOARD  ← TECH-IAM, TECH-GW, TECH-MSG, TECH-OBS
APP-SUPERAI   ← TECH-LLMGW, TECH-RAG, TECH-ACTION, TECH-AGENT, TECH-ONT, TECH-MCP
APP-DW        ← TECH-AGENT, TECH-RAG, TECH-ONT, TECH-LLMGW, TECH-A2A
APP-APPHUB    ← TECH-ONT, TECH-WFE, TECH-ACTION, TECH-EA, TECH-RULE, TECH-AGENT, APP-SUPERAI
APP-ONTSTUDIO ← TECH-ONT, TECH-ACTION, TECH-DATA, TECH-RAG, TECH-RULE
APP-ARCH      ← TECH-EA, TECH-ONT, TECH-DATA
APP-MCPHUB    ← TECH-MCP, TECH-ONT, TECH-RAG, TECH-ACTION, TECH-IAM

# 自研核心层（Java 不变）
TECH-ONT     ← TECH-DATA, TECH-RAG
TECH-WFE     ← TECH-ONT, TECH-RULE
TECH-RULE    ← TECH-ONT
TECH-ACTION  ← TECH-ONT, TECH-WFE, TECH-RULE

# AI 中间层（Java + SAA，v1.2 全部重写）
TECH-LLMGW   ← SAA ChatModel + SAA Nacos Config
TECH-RAG     ← SAA Document/Embedding/VectorStore
TECH-AGENT   ← SAA Agent Framework + Graph Core

# 协议层（Java + SAA Nacos，v1.2 升级）
TECH-MCP     ← SAA Nacos MCP + Nacos 3.0+
TECH-A2A     ← SAA A2A Nacos + Nacos 3.0+

# 数据集成（Java 重写）
TECH-DATA    ← 外部数据源, TECH-MSG

# 基础设施
TECH-IAM     ← 所有服务（MCP / A2A 调用鉴权）
```

## 开发指引

### 新建模块

1. 在项目根目录创建 `APP-XXX` 或 `TECH-XXX` 目录
2. **语言约束**：后端服务必须用 Java 21 + Spring Boot 3.5
3. 编写 `README.md`：作用说明、上游依赖、下游消费、目录结构
4. **Java 包名**：`com.metaplatform.[模块小写]`，TS 目录 `kebab-case`
5. **API 路径**：`/api/v1/[模块]/[资源]`

### AI 能力使用（v1.2 强制）

1. **所有 LLM 调用必须通过 `TECH-LLMGW`**，内部使用 SAA ChatModel 作为适配器
2. **RAG 检索通过 `TECH-RAG`**，底层使用 SAA Document / Embedding / VectorStore
3. **Java 侧 Agent 任务通过 `TECH-AGENT`**，基于 SAA Agent Framework + Graph Core
4. **对外暴露 MCP 能力必须注册到 Nacos 3.0+**
5. **跨 Agent 协作通过 A2A Nacos Starter**
6. **禁止使用 LangChain / LangGraph**（已退役）

### 数据操作

1. 数据语义通过 `TECH-ONT` 本体引擎定义
2. 数据入湖使用 Hudi（CDC/upsert）或 Iceberg（追加）
3. OLAP 查询通过 StarRocks
4. **数据集成通过 `TECH-DATA`（Java + Spring Batch + Airflow Java Client）**

### 前端开发

1. UI 组件统一使用 Ant Design 6.0 + Ant Design X 2.0
2. 流程设计器统一使用 FlowGram.AI
3. 知识图谱/架构图使用 AntV X6
4. **AI 编排工作流 JSON 需新增与 SAA Graph Core 的语义映射转换层**

## 关键技术决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| **后端语言** | **Java 21（唯一）** | **v1.2 统一栈，消除双栈运维** |
| 向量数据库 | Milvus 2.5（SAA 适配） | 十亿级向量、RaBitQ 量化 |
| 数据湖格式 | Hudi 1.x（主）/ Iceberg 1.8（备） | Hudi 原生支持 CDC/upsert |
| 流程设计器 | FlowGram.AI | 固定+自由双布局、字节背书 |
| UI 组件库 | Ant Design 6.0 + X 2.0 | 企业级 + AI 组件 |
| OLAP | StarRocks 3.4 | 实时 OLAP、多模型 |
| 图数据库 | Neo4j 5.x | 知识图谱、Cypher |
| **Java AI 编排底座** | **Spring AI Alibaba 1.1.2.0** | **BOM 统一、Graph/Nacos MCP/A2A 一站式** |
| **AI 协议注册中心** | **Nacos 3.0+** | **MCP / A2A 原生支持、SAA 深度集成** |
| **数据访问** | **Spring Data JPA** | **替换 SQLAlchemy** |
| **Web 框架** | **Spring WebFlux / MVC + 虚拟线程** | **替换 FastAPI async** |

## 教训与避坑

- koa-connect wrapper 会导致 ctx 泄漏，需使用原生 Koa 中间件
- `apache/kafka:3.6.1` 镜像已被移除，使用 `latest + asCompatibleSubstituteFor`
- DaoCloud 公共镜像阻止了 Airbyte 拉取，改用阿里云加速器
- 浏览器配套工具存在刷新限制，需要手动 F5/Ctrl+R
- Pandoc 生成的 Markdown 图片路径需要修正为相对路径
- **Spring Boot 3.4 → 3.5 升级需关注虚拟线程默认行为变更**
- **Spring AI 1.0 → 1.1 API 兼容性需做完整回归测试**
- **SAA 升级需锁定 BOM 主版本**
- **Nacos 3.0 引入需先做 POC**
- **Python → Java 迁移：FastAPI async 与 Spring WebFlux 异步模型不同，需注意请求生命周期**
- **SQLAlchemy → JPA：注意 lazy loading 与事务边界差异**
- **pytest → JUnit 5：异步测试改用 @SpringBootTest + WebTestClient**
- **LangGraph → SAA Graph：注意 StateGraph 与 Graph DAG 的语义差异**

## 版本计划与任务跟踪

> 当前版本计划详见：`docs/004-PLAN/PLAN-Mate_Platform-版本路线图_v2.0-20260716.md`
>
> **v1.2 SAA 全栈重构期**（2026-07-21 至 2026-12）：
> - 阶段 0（2-3 周）：团队扩编、POC
> - 阶段 1（3-4 周）：6 服务骨架 + Nacos
> - 阶段 2（4-6 周）：核心服务 Java + SAA 重写
> - 阶段 3（3-4 周）：MCP / A2A 协议层
> - 阶段 4（2-3 周）：生产化与 Python 下线
>
> 任务状态标记规则：`[ ]` 未开始 / `[~]` 进行中 / `[x]` 已完成 / `[!]` 阻塞

## 关键文档索引

| 文档 | 路径 |
|---|---|
| 项目总览 | `README.md` |
| 命名规范 | `docs/000-GUIDE/GUIDE-NAMING-CONVENTION_v1.0-20260716.md` |
| 文档结构规范 | `docs/000-GUIDE/GUIDE-DOC-STRUCTURE_v1.0-20260716.md` |
| **UI 设计规范** | `docs/000-GUIDE/GUIDE-Mate_Platform-UI_Design_Specification_v1.0-20260719.md` |
| **应用架构（最新版）** | **docs/001-ARCH/ARCH-Mate_Platform-应用架构_v1.2-20260721.md** |
| **技术选型（最新版）** | **docs/002-TS/TS-Mate_Platform-技术选型建议_自研最新版_v1.3-20260721.md** |
| 应用架构（v1.1 历史版） | docs/001-ARCH/ARCH-Mate_Platform-应用架构_v1.1-20260721.md |
| 技术选型（v1.2 历史版） | docs/002-TS/TS-Mate_Platform-技术选型建议_自研最新版_v1.2-20260721.md |
| 技术选型（v1.1 历史版） | docs/002-TS/TS-Mate_Platform-技术选型建议_自研最新版_v1.1-20260716.md |
| 技术选型（v1.0 历史版） | docs/002-TS/TS-Mate_Platform-技术选型建议_v1.0-20260716.md |
| **版本路线图与任务拆解（全量版）** | docs/004-PLAN/PLAN-Mate_Platform-版本路线图_v2.0-20260716.md |
| **PRD 需求覆盖度检查报告** | docs/004-PLAN/PLAN-Mate_Platform-PRD需求覆盖度检查报告_v1.0-20260716.md |
| **Spring AI Alibaba 迁移评估报告** | **docs/005-RD/RD-Mate_Platform-Spring_AI_Alibaba技术栈迁移评估_v1.0-20260721.md** |
| OWL 调研 | docs/005-RD/RD-Mate_Platform-Ontology_OWL调研报告_v1.0-20260716.md |