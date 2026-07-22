# Agent 上下文文件

> 本文件供 AI Agent（Cursor、Claude Code、Copilot、Codex、Windsurf 等）读取。
> 帮助 Agent 快速理解项目上下文、架构约束与开发规范，并明确工作流约定。
> 最近更新：2026-07-22（v1.3 重构期·阶段 R0 完成）

## 项目概述

**Mate Platform** 是基于 Ontology 本体论引擎的企业级决策与运营提效平台。

核心能力：
- **Ontology 本体引擎**：统一建模企业概念、实体、关系、属性、规则、动作，形成可推理的语义网络
- **低代码应用构建**：拖拽式页面/表单/流程设计器，融合 BPMN 审批流（fixed-layout）与 AI Agent 编排流（free-layout）
- **数字员工**：AI 驱动的自动化员工，提炼制度/流程/访谈信息，执行业务任务
- **企业级 RAG 知识库**：向量 + 非向量混合检索，支持文档版本管理与协同
- **MCP / A2A 协议**：对接外部 AI 工具（Cursor/Claude/Codex）与外部 Agent 系统
- **数据治理**：CDC 实时入湖、ETL/ELT、数据湖（Hudi）、数据仓库（StarRocks）

## 技术栈基线（v1.2）

### 后端
- **Java 25** + Spring Boot 3.5.x + Spring AI 1.1.2
- **Spring AI Alibaba 1.1.2.0**（AI 编排统一底座，BOM 管理）
- **Spring Data JPA**（替换 SQLAlchemy）
- **Spring WebFlux / MVC + 虚拟线程**（替换 FastAPI async）
- **Nacos 3.0.1+**（MCP / A2A / Config 注册中心）
- PostgreSQL 17（主库）、Neo4j 5.x（图库）、Milvus 2.5（向量库）、Redis 7.4（缓存）
- StarRocks 3.4（OLAP）、Apache Hudi 1.x（数据湖主）、Apache Iceberg 1.8（数据湖备）
- Apache Flink 1.20（流处理）、Apache Airflow 2.10（批处理编排）、DBT 1.9（数仓建模）
- Kafka 3.9 + RabbitMQ 4.x（消息队列）
- JUnit 5 + Mockito + Testcontainers（替换 pytest）

### 前端
- React 19 + TypeScript 5.7 + Vite 6
- Ant Design 6.0 + Ant Design X 2.0
- FlowGram.AI（流程设计器：fixed-layout 审批流 + free-layout Agent 编排）
- AntV X6（Ontology 知识图谱 / EA 架构图可视化）
- **pnpm monorepo**：`metaplatform-frontend/{apps,packages}/`

### 基础设施
- Kubernetes 1.32 + Istio 1.24
- OpenTelemetry 1.45 + Prometheus 3.x + Grafana 11.x + SAA Graph Observation
- MinIO（对象存储）

## 仓库当前结构（2026-07-22 重构后）

仓库处于**精简待重建**阶段，仅保留：

```
MetaPlatform/
├── README.md                       # 项目总览
├── CLAUDE.md                       # Claude Code 上下文（架构/规范/约束）
├── agent.md                        # 本文件（Agent 工作流）
├── .gitignore  .env.example  .env  # 环境配置
├── package.json  package-lock.json # 前端构建配置
│
├── docs/
│   └── prd/                        # PRD 文档集合（v1.3 集中管理）
│       ├── APP-APPHUB/             # 应用中心 PRD
│       ├── APP-ARCH/               # 架构中心 PRD
│       ├── APP-COPILOT/            # 超级 AI（已更名）PRD
│       ├── APP-DASHBOARD/          # 仪表盘 PRD
│       ├── APP-DW/                 # 数字员工 PRD
│       ├── APP-MCPHUB/             # MCP 服务中心 PRD
│       ├── APP-ONTSTUDIO/          # 本体论引擎 PRD
│       └── _top/                   # 顶层 PRD 计划与覆盖度报告
│
├── metaplatform-design-draft/      # 设计稿归档（保留）
│
├── .github/  .vscode/              # CI / IDE 配置
├── .venv/  .uploads/               # 环境数据
├── .trae-html-share-packages/      # TRAE 工具包
├── node_modules/                   # 前端依赖
└── .git/                           # Git 仓库
```

**注意**：APP-* 与 TECH-* 模块目录当前不存在，将在 v1.3 重建阶段按规划创建。

## 命名规范

### 模块命名
- 应用模块：`APP-` + 大写缩写（例：`APP-DASHBOARD`、`APP-COPILOT`）
- 技术服务模块：`TECH-` + 大写缩写（例：`TECH-ONT`、`TECH-WFE`）

### 文档命名
- 格式：`[类型]-[模块]-[主题]_v[版本]-[日期].md`
- 类型：`ARCH` / `TS` / `SPEC` / `PLAN` / `RD` / `GUIDE` / `PRD`

### 代码命名
- Java 包名：`com.metaplatform.[模块小写].*`（例：`com.metaplatform.agent.saa`）
- Java 类名：PascalCase（例：`SaAgentReactService`、`MateLlmGwService`）
- TypeScript 目录：kebab-case（例：`ontology-editor/`）
- TypeScript 组件：PascalCase
- API 路径：`/api/v1/[模块]/[资源]`（例：`/api/v1/agent/react`）
- Nacos 服务名：`mate-{domain}-{service}`（例：`mate-mcp-server`）

## 架构约束

### 核心原则
1. **AI 是贯穿全栈的能力底座**，不是独立的一层
2. **Ontology 引擎是唯一数据真相源**，所有模块通过 Ontology 访问数据语义
3. **前端和业务模块使用平台自身的低代码能力自举构建**
4. **业务对象（G2）为主要构建块**，G1/G3/G4 为辅助
5. **OLAP 引擎以 StarRocks 为主**，ClickHouse 为适配器

### 后端语言统一（v1.2 重大约束）

**Mate Platform 后端统一为 Java 25，禁止新增 Python 后端服务**。

| 范围 | 状态 |
|---|---|
| Java 后端服务 | 唯一允许的新增后端实现 |
| Python 运维脚本 | 允许保留，但禁止承载业务逻辑 |
| Python 测试代码 | 已重写为 JUnit 5，原 pytest 归档 |
| Python FastAPI 服务 | **全部重写为 Java + SAA** |
| LangChain / LangGraph | **已退役，禁止使用** |

### 工程约束

- Kafka 消息发布必须使用 **Outbox 模式** 防止数据丢失
- 事件消费必须支持 **DLQ**（Dead Letter Queue），重试 3 次
- `trace_id` 必须在所有系统组件间传播，Kafka 消息头包含 `X-Trace-Id`
- DLQ 记录必须包含 `traceId` 字段用于故障诊断
- **Spring AI Alibaba 升级需通过 BOM 统一管理**
- **MCP / A2A 调用必须经过 IAM 鉴权与审计**

### 协议支持

- **MCP（Model Context Protocol）**：
  - 实现：`spring-ai-alibaba` Nacos MCP + Nacos 3.0+ Registry
  - 平台作为 MCP Server 暴露 Tools / Resources / Prompts
  - 平台作为 MCP Client 调用第三方 MCP Server

- **A2A（Agent-to-Agent Protocol）**：
  - 实现：`spring-ai-alibaba-starter-a2a-nacos`
  - 与 Mate Workflow Engine 通过 Action 节点集成

## 模块上下游关系（v1.2 规划）

```
# 应用层
APP-DASHBOARD  ← TECH-IAM, TECH-GW, TECH-MSG, TECH-OBS
APP-COPILOT    ← TECH-LLMGW, TECH-RAG, TECH-ACTION, TECH-AGENT, TECH-ONT, TECH-MCP
APP-DW         ← TECH-AGENT, TECH-RAG, TECH-ONT, TECH-LLMGW, TECH-A2A
APP-APPHUB     ← TECH-ONT, TECH-WFE, TECH-ACTION, TECH-EA, TECH-RULE, TECH-AGENT, APP-COPILOT
APP-ONTSTUDIO  ← TECH-ONT, TECH-ACTION, TECH-DATA, TECH-RAG, TECH-RULE
APP-ARCH       ← TECH-EA, TECH-ONT, TECH-DATA
APP-MCPHUB     ← TECH-MCP, TECH-ONT, TECH-RAG, TECH-ACTION, TECH-IAM

# 自研核心层
TECH-ONT     ← TECH-DATA, TECH-RAG
TECH-WFE     ← TECH-ONT, TECH-RULE
TECH-RULE    ← TECH-ONT
TECH-ACTION  ← TECH-ONT, TECH-WFE, TECH-RULE

# AI 中间层（Java + SAA）
TECH-LLMGW   ← SAA ChatModel + SAA Nacos Config
TECH-RAG     ← SAA Document/Embedding/VectorStore
TECH-AGENT   ← SAA Agent Framework + Graph Core

# 协议层（Java + SAA Nacos）
TECH-MCP     ← SAA Nacos MCP + Nacos 3.0+
TECH-A2A     ← SAA A2A Nacos + Nacos 3.0+

# 数据集成
TECH-DATA    ← 外部数据源, TECH-MSG

# 基础设施
TECH-IAM     ← 所有服务（MCP / A2A 调用鉴权）
```

## Agent 工作流约定

### 新建模块时

1. 在项目根目录创建 `APP-XXX` 或 `TECH-XXX` 目录
2. 后端服务必须用 **Java 25 + Spring Boot 3.5**，前端走 pnpm monorepo
3. 编写 `README.md`：作用说明、上游依赖、下游消费、目录结构
4. Java 包名 `com.metaplatform.[模块小写]`，TS 目录 `kebab-case`
5. API 路径遵循 `/api/v1/[模块]/[资源]`

### 修改 PRD 时

1. PRD 必须放在 `docs/prd/APP-XXX/` 或 `docs/prd/_top/` 下
2. 文件名遵循 `PRD-[模块]-[主题]_v[版本]-[日期].md`
3. 模块重命名时，PRD 目录与文件名同步更新（前缀与目录保持一致）
4. **参考现有 PRD 命名与组织方式**（参考 `docs/prd/APP-COPILOT/`）

### 涉及 AI 能力时

1. 所有 LLM 调用必须通过 `TECH-LLMGW`，不直接调模型 API
2. RAG 检索通过 `TECH-RAG`，支持向量 + 非向量混合检索
3. Agent 任务通过 `TECH-AGENT` 框架执行，支持 ReAct / Plan-and-Solve
4. 对外暴露能力优先通过 MCP 协议（`TECH-MCP`）
5. 跨 Agent 协作通过 A2A 协议（`TECH-A2A`）
6. 禁止使用 LangChain / LangGraph（已退役）

### 涉及数据时

1. 数据语义通过 `TECH-ONT` 本体引擎定义
2. 数据入湖使用 Hudi（CDC/upsert）或 Iceberg（追加）
3. OLAP 查询通过 StarRocks
4. 数据集成通过 `TECH-DATA`（Flink CDC + Airflow + DBT）

### 重构/清理操作时

1. **删除模块目录前**：先 `git commit` 当前状态作为备份
2. **保留清单**：CLAUDE.md / agent.md / README.md / .gitignore / .env.example / package.json / package-lock.json
3. **PRD 必须保留**：使用 `git checkout HEAD -- <file>` 或临时 checkout 到隔离目录再拷贝
4. **Windows 文件锁**：若 PowerShell/资源管理器无法删除，先 `git rm --cached` 标记删除，物理清理交给用户手动操作
5. **提交信息**：`refactor: <范围> <动作>`, `docs: <范围> <动作>`, `feat(<模块>): <描述>`, `fix(<模块>): <描述>`

### 代码生成偏好

- Java 优先使用 Spring AI Alibaba (SAA) 注解与 API，不要自己造轮子
- Agent 编排优先使用 SAA Graph Core（DAG），BPMN 审批流用 TECH-WFE + FlowGram.AI fixed-layout
- 前端组件优先复用 `@mate/shared` 中的通用组件（待 monorepo 重建）
- 数据库访问统一 Spring Data JPA，避免在 Java 服务中使用 SQLAlchemy

## 关键文档索引

> ⚠️ v1.3 阶段 R0 已清理 `docs/000-GUIDE/`、`docs/001-ARCH/`、`docs/002-TS/`、`docs/003-SPEC/`、`docs/004-PLAN/`、`docs/005-RD/`、`docs/006-TMP/`、`docs/superpowers/`。下方为重建时需恢复的文档清单。

| 文档 | 路径 | 状态 |
|---|---|---|
| 项目总览 | [`README.md`](README.md) | ✅ 保留 |
| Claude Code 上下文 | [`CLAUDE.md`](CLAUDE.md) | ✅ 已更新 |
| Agent 上下文 | [`agent.md`](agent.md) | ✅ 本文件 |
| **PRD 集合** | **[`docs/prd/`](docs/prd/)** | **✅ 已重建（14 个文件）** |
| 应用架构 | `docs/001-ARCH/ARCH-Mate_Platform-应用架构_v1.2-20260721.md` | 待重建 |
| 技术选型 | `docs/002-TS/TS-Mate_Platform-技术选型建议_自研最新版_v1.3-20260721.md` | 待重建 |
| 命名规范 | `docs/000-GUIDE/GUIDE-NAMING-CONVENTION_v1.0-20260716.md` | 待重建 |
| 文档结构规范 | `docs/000-GUIDE/GUIDE-DOC-STRUCTURE_v1.0-20260716.md` | 待重建 |
| UI 设计规范 | `docs/000-GUIDE/GUIDE-Mate_Platform-UI_Design_Specification_v1.0-20260719.md` | 待重建 |
| 版本路线图 | `docs/004-PLAN/PLAN-Mate_Platform-版本路线图_v2.0-20260716.md` | 待重建 |
| Spring AI Alibaba 迁移评估 | `docs/005-RD/RD-Mate_Platform-Spring_AI_Alibaba技术栈迁移评估_v1.0-20260721.md` | 待重建 |
| OWL 调研 | `docs/005-RD/RD-Mate_Platform-Ontology_OWL调研报告_v1.0-20260716.md` | 待重建 |
