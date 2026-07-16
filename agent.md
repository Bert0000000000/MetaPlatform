# Agent 上下文文件

> 本文件供 AI Agent（Cursor、Copilot、Codex、Windsurf 等）读取，帮助 Agent 快速理解项目上下文、架构约束与开发规范。

## 项目概述

Mate Platform 是基于 Ontology 本体论引擎的企业级决策与运营提效平台。核心能力包括：

- **Ontology 本体引擎**：统一建模企业概念、实体、关系、属性、规则、动作，形成可推理的语义网络
- **低代码应用构建**：拖拽式页面/表单/流程设计器，融合 BPMN 审批流与 AI Agent 编排流
- **数字员工**：AI 驱动的自动化员工，提炼制度/流程/访谈信息，执行业务任务
- **企业级 RAG 知识库**：向量 + 非向量混合检索，支持文档版本管理与协同
- **MCP / A2A 协议**：对接外部 AI 工具（Cursor/Copilot/Claude）与外部 Agent 系统
- **数据治理**：CDC 实时入湖、ETL/ELT、数据湖（Hudi）、数据仓库（StarRocks）

## 技术栈

### 后端
- Java 21 + Spring Boot 3.4 + Spring AI 1.0
- Python 3.13 + FastAPI + LangChain 0.3 + LangGraph 0.2
- PostgreSQL 17（主库）、Neo4j 5.x（图库）、Milvus 2.5（向量库）、Redis 7.4（缓存）
- StarRocks 3.4（OLAP）、Apache Hudi 1.x（数据湖主）、Apache Iceberg 1.8（数据湖备）
- Apache Flink 1.20（流处理）、Apache Airflow 2.10（批处理编排）、DBT 1.9（数仓建模）
- Kafka 3.9 + RabbitMQ 4.x（消息队列）

### 前端
- React 19 + TypeScript 5.7 + Vite 6
- Ant Design 6.0 + Ant Design X 2.0
- FlowGram.AI（流程设计器：fixed-layout 审批流 + free-layout Agent 编排）
- AntV X6（Ontology 知识图谱 / EA 架构图可视化）

### 基础设施
- Kubernetes 1.32 + Istio 1.24
- OpenTelemetry 1.45 + Prometheus 3.x + Grafana 11.x
- MinIO（对象存储）

## 项目结构

```
MetaPlatform/
├── README.md                  # 项目总览
├── CLAUDE.md                  # Claude Code 上下文
├── agent.md                   # 本文件
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
├── TECH-ONT/                  # 本体引擎服务
├── TECH-WFE/                  # 工作流引擎服务
├── TECH-RULE/                 # 规则引擎服务
├── TECH-ACTION/               # Action Engine 服务
├── TECH-RAG/                  # RAG 引擎服务
├── TECH-AGENT/                # Agent 框架服务
├── TECH-LLMGW/                # LLM Gateway 服务
├── TECH-MCP/                  # MCP 协议适配服务
├── TECH-A2A/                  # A2A 协议适配服务
├── TECH-EA/                   # EA 架构资产服务
├── TECH-DATA/                 # 数据集成与 ETL 服务
├── TECH-IAM/                  # 身份认证与权限服务
├── TECH-GW/                   # API 网关服务
├── TECH-MSG/                  # 消息队列服务
├── TECH-OBS/                  # 可观测性服务
└── infra/                     # 基础设施配置
```

## 命名规范

### 模块命名
- 应用模块：`APP-` + 大写缩写（例：`APP-DASHBOARD`、`APP-APPHUB`）
- 技术服务模块：`TECH-` + 大写缩写（例：`TECH-ONT`、`TECH-WFE`）

### 文档命名
- 格式：`[类型]-[模块]-[主题]_v[版本]-[日期].md`
- 类型：`ARCH`/`TS`/`SPEC`/`PLAN`/`RD`

### 代码命名
- Java 包名：`com.metaplatform.[模块小写].*`（例：`com.metaplatform.ont.engine`）
- Java 类名：PascalCase（例：`OntologyEngineService`）
- TypeScript 目录：kebab-case（例：`ontology-editor/`）
- TypeScript 组件：PascalCase（例：`OntologyEditor.tsx`）
- API 路径：`/api/v1/[模块]/[资源]`（例：`/api/v1/ont/concepts`）

## 架构约束

### 核心原则
1. **AI 是贯穿全栈的能力底座**，不是独立的一层
2. **Ontology 引擎是唯一数据真相源**，所有模块通过 Ontology 访问数据语义
3. **前端和业务模块使用平台自身的低代码能力自举构建**
4. **OLAP 引擎以 Apache Doris/StarRocks 为主**，ClickHouse 为适配器

### 工程约束
- Kafka 消息发布必须使用 Outbox 模式防止数据丢失
- 事件消费必须支持 DLQ（Dead Letter Queue），重试 3 次
- `trace_id` 必须在所有系统组件间传播，Kafka 消息头包含 `X-Trace-Id`
- DLQ 记录必须包含 `traceId` 字段用于故障诊断

### 协议支持
- **MCP（Model Context Protocol）**：平台作为 MCP Server 暴露 Tools/Resources/Prompts，同时作为 MCP Client 调用第三方工具
- **A2A（Agent-to-Agent Protocol）**：平台数字员工与外部 Agent 互相发现、委托任务、异步协作

## 模块上下游关系

```
APP-DASHBOARD ← TECH-IAM, TECH-GW, TECH-MSG, TECH-OBS
APP-SUPERAI  ← TECH-LLMGW, TECH-RAG, TECH-ACTION, TECH-AGENT, TECH-ONT, TECH-MCP
APP-DW       ← TECH-AGENT, TECH-RAG, TECH-ONT, TECH-LLMGW, TECH-A2A
APP-APPHUB   ← TECH-ONT, TECH-WFE, TECH-ACTION, TECH-EA, TECH-RULE, APP-SUPERAI
APP-ONTSTUDIO← TECH-ONT, TECH-ACTION, TECH-DATA, TECH-RAG, TECH-RULE
APP-ARCH     ← TECH-EA, TECH-ONT, TECH-DATA
APP-MCPHUB   ← TECH-MCP, TECH-ONT, TECH-RAG, TECH-ACTION, TECH-IAM

TECH-ONT    ← TECH-DATA, TECH-RAG
TECH-WFE    ← TECH-ONT, TECH-RULE
TECH-RULE   ← TECH-ONT
TECH-ACTION ← TECH-ONT, TECH-WFE, TECH-RULE
TECH-RAG    ← TECH-DATA, TECH-LLMGW
TECH-AGENT  ← TECH-LLMGW, TECH-RAG, TECH-ACTION
TECH-LLMGW  ← (外部模型 API)
TECH-MCP    ← TECH-ONT, TECH-RAG, TECH-ACTION
TECH-A2A    ← TECH-AGENT, TECH-WFE
TECH-EA     ← TECH-ONT
TECH-DATA   ← 外部数据源, TECH-MSG
```

## 开发指引

### 新建模块时
1. 在项目根目录创建 `APP-XXX` 或 `TECH-XXX` 目录
2. 编写 `README.md`，包含：作用说明、上游依赖、下游消费、目录结构
3. 遵循命名规范：Java `com.metaplatform.[模块小写]`，TS `kebab-case` 目录
4. API 路径遵循 `/api/v1/[模块]/[资源]`

### 修改文档时
1. 文档放在 `docs/` 对应子目录下
2. 文件名遵循 `[类型]-[模块]-[主题]_v[版本]-[日期].md`
3. 临时脚本放 `docs/006-TMP/`，命名 `tmp-[日期]-[用途].[ext]`

### 涉及 AI 能力时
1. 所有 LLM 调用必须通过 `TECH-LLMGW`，不直接调模型 API
2. RAG 检索通过 `TECH-RAG`，支持向量 + 非向量混合检索
3. Agent 任务通过 `TECH-AGENT` 框架执行，支持 ReAct / Plan-and-Solve
4. 对外暴露能力优先通过 MCP 协议（`TECH-MCP`）
5. 跨 Agent 协作通过 A2A 协议（`TECH-A2A`）

### 涉及数据时
1. 数据语义通过 `TECH-ONT` 本体引擎定义
2. 数据入湖使用 Hudi（CDC 场景）或 Iceberg（追加场景）
3. OLAP 查询通过 StarRocks
4. 数据集成通过 `TECH-DATA`（Flink CDC + Airflow + DBT）

## 关键文档索引

| 文档 | 路径 |
|---|---|
| 项目总览 | `README.md` |
| 命名规范 | `docs/000-GUIDE/GUIDE-NAMING-CONVENTION_v1.0-20260716.md` |
| 文档结构规范 | `docs/000-GUIDE/GUIDE-DOC-STRUCTURE_v1.0-20260716.md` |
| 应用架构 | `docs/001-ARCH/ARCH-Mate_Platform-应用架构_v1.0-20260716.md` |
| 技术选型 | `docs/002-TS/TS-Mate_Platform-技术选型建议_自研最新版_v1.1-20260716.md` |
| OWL 调研 | `docs/005-RD/RD-Mate_Platform-Ontology_OWL调研报告_v1.0-20260716.md` |
