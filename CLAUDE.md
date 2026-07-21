# CLAUDE.md

> 本文件供 Claude Code 读取，提供项目上下文、架构约束与开发规范。

## 项目概述

Mate Platform 是基于 Ontology 本体论引擎的企业级决策与运营提效平台。

核心能力：Ontology 本体引擎（统一语义建模与推理）、低代码应用构建（融合 BPMN 审批流与 AI Agent 编排）、数字员工（AI 驱动的自动化）、企业级 RAG 知识库、MCP/A2A 协议支持、数据治理（CDC + 数据湖 + 数据仓库）。

## 技术栈

### 后端
- **Java 21** + Spring Boot 3.4 + Spring AI 1.0
- **Python 3.13** + FastAPI + LangChain 0.3 + LangGraph 0.2
- **PostgreSQL 17**（主库）、**Neo4j 5.x**（图库）、**Milvus 2.5**（向量库）、**Redis 7.4**（缓存）
- **StarRocks 3.4**（OLAP）、**Apache Hudi 1.x**（数据湖主）、**Apache Iceberg 1.8**（数据湖备）
- **Apache Flink 1.20**（流处理）、**Airflow 2.10**（批处理）、**DBT 1.9**（数仓建模）
- **Kafka 3.9** + **RabbitMQ 4.x**（消息队列）

### 前端
- **React 19** + TypeScript 5.7 + Vite 6
- **Ant Design 6.0** + Ant Design X 2.0
- **FlowGram.AI**（流程设计器：fixed-layout 审批流 + free-layout Agent 编排）
- **AntV X6**（知识图谱 / 架构图可视化）

### 基础设施
- **Kubernetes 1.32** + Istio 1.24
- **OpenTelemetry 1.45** + Prometheus 3.x + Grafana 11.x
- **MinIO**（对象存储）

## 项目结构

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
- 应用模块：`APP-` + 大写缩写（例：`APP-DASHBOARD`、`APP-APPHUB`、`APP-ONTSTUDIO`）
- 技术服务模块：`TECH-` + 大写缩写（例：`TECH-ONT`、`TECH-WFE`、`TECH-LLMGW`）

### 文档命名
- 格式：`[类型]-[模块]-[主题]_v[版本]-[日期].md`
- 类型前缀：`ARCH`（架构）、`TS`（技术选型）、`SPEC`（规范）、`PLAN`（计划）、`RD`（调研）
- 临时脚本放 `docs/006-TMP/`，命名 `tmp-[日期]-[用途].[ext]`

### 代码命名
- Java 包名：`com.metaplatform.[模块小写].*`（例：`com.metaplatform.ont.engine`）
- Java 类名：PascalCase（例：`OntologyEngineService`）
- TypeScript 目录：kebab-case（例：`ontology-editor/`）
- TypeScript 组件：PascalCase（例：`OntologyEditor.tsx`）
- API 路径：`/api/v1/[模块]/[资源]`（例：`/api/v1/ont/concepts`）

## 架构约束

### 核心原则
1. **AI 是贯穿全栈的能力底座**，不是独立的一层。AI 能力（LLM Gateway、Embedding、Vector Store、Agent Runtime）作为 Substrate 贯穿所有模块。
2. **Ontology 引擎是唯一数据真相源**。所有模块通过 Ontology 访问数据语义，本体引擎与知识图谱合并为单层。
3. **前端和业务模块使用平台自身的低代码能力自举构建**。
4. **业务对象（G2）为主要构建块**，G1/G3/G4 为辅助。
5. **架构遵循 P3 双向同步**，以 Ontology 为单一真相源。

### 工程约束
- Kafka 消息发布必须使用 **Outbox 模式** 防止数据丢失
- 事件消费必须支持 **DLQ（Dead Letter Queue）**，重试 3 次
- `trace_id` 必须在所有系统组件间传播，Kafka 消息头包含 `X-Trace-Id`
- DLQ 记录必须包含 `traceId` 字段用于故障诊断

### 协议支持
- **MCP（Model Context Protocol）**：
  - 平台作为 MCP Server 暴露 Tools（Ontology 查询、知识库检索、Action 执行）/ Resources（文档、架构资产）/ Prompts（角色模板）
  - 平台作为 MCP Client 调用第三方 MCP Server
  - 技术实现：`spring-ai-mcp-server-spring-boot-starter`（Java）、`fastapi-mcp`（Python）
- **A2A（Agent-to-Agent Protocol）**：
  - 平台数字员工与外部 Agent 互相发现（Agent Card）、委托任务、异步协作
  - 与 Mate Workflow Engine 集成：外部委托的任务可转为内部工作流执行

## 模块上下游关系

```
APP-DASHBOARD  ← TECH-IAM, TECH-GW, TECH-MSG, TECH-OBS
APP-SUPERAI   ← TECH-LLMGW, TECH-RAG, TECH-ACTION, TECH-AGENT, TECH-ONT, TECH-MCP
APP-DW        ← TECH-AGENT, TECH-RAG, TECH-ONT, TECH-LLMGW, TECH-A2A
APP-APPHUB    ← TECH-ONT, TECH-WFE, TECH-ACTION, TECH-EA, TECH-RULE, APP-SUPERAI
APP-ONTSTUDIO ← TECH-ONT, TECH-ACTION, TECH-DATA, TECH-RAG, TECH-RULE
APP-ARCH      ← TECH-EA, TECH-ONT, TECH-DATA
APP-MCPHUB    ← TECH-MCP, TECH-ONT, TECH-RAG, TECH-ACTION, TECH-IAM

TECH-ONT     ← TECH-DATA, TECH-RAG
TECH-WFE     ← TECH-ONT, TECH-RULE
TECH-RULE    ← TECH-ONT
TECH-ACTION  ← TECH-ONT, TECH-WFE, TECH-RULE
TECH-RAG     ← TECH-DATA, TECH-LLMGW
TECH-AGENT   ← TECH-LLMGW, TECH-RAG, TECH-ACTION
TECH-LLMGW   ← (外部模型 API)
TECH-MCP     ← TECH-ONT, TECH-RAG, TECH-ACTION
TECH-A2A     ← TECH-AGENT, TECH-WFE
TECH-EA      ← TECH-ONT
TECH-DATA    ← 外部数据源, TECH-MSG
```

## 开发指引

### 新建模块
1. 在项目根目录创建 `APP-XXX` 或 `TECH-XXX` 目录
2. 编写 `README.md`：作用说明、上游依赖、下游消费、目录结构
3. Java 包名 `com.metaplatform.[模块小写]`，TS 目录 `kebab-case`
4. API 路径 `/api/v1/[模块]/[资源]`

### AI 能力使用
1. 所有 LLM 调用必须通过 `TECH-LLMGW`，不直接调模型 API
2. RAG 检索通过 `TECH-RAG`，支持向量 + 非向量混合检索
3. Agent 任务通过 `TECH-AGENT` 框架执行
4. 对外暴露能力优先通过 MCP 协议（`TECH-MCP`）
5. 跨 Agent 协作通过 A2A 协议（`TECH-A2A`）

### 数据操作
1. 数据语义通过 `TECH-ONT` 本体引擎定义
2. 数据入湖使用 Hudi（CDC/upsert 场景）或 Iceberg（追加场景）
3. OLAP 查询通过 StarRocks
4. 数据集成通过 `TECH-DATA`（Flink CDC + Airflow + DBT + Hudi DeltaStreamer）

### 前端开发
1. UI 组件统一使用 Ant Design 6.0
2. 流程设计器统一使用 FlowGram.AI（fixed-layout 审批流 + free-layout Agent 编排）
3. 知识图谱/架构图使用 AntV X6
4. 低代码设计器和流程设计器融合在 `APP-APPHUB` 中
5. AI 对话界面使用 Ant Design X 2.0

## 关键技术决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| 向量数据库 | Milvus 2.5 | 十亿级向量、RaBitQ 量化、GPU 索引、多租户 |
| 数据湖格式 | Hudi 1.x（主）/ Iceberg 1.8（备） | Hudi 原生支持 CDC/upsert、DeltaStreamer、MoR 模式 |
| 流程设计器 | FlowGram.AI（统一） | React 原生、固定+自由双布局、变量引擎、字节背书 |
| UI 组件库 | Ant Design 6.0 | 最新版、企业级、Ant Design X 2.0 AI 组件 |
| OLAP | StarRocks 3.4 | 实时 OLAP、多模型、国产成熟 |
| 图数据库 | Neo4j 5.x | 知识图谱、Cypher 查询、成熟生态 |

## 教训与避坑

- koa-connect wrapper 会导致 ctx 泄漏，需使用原生 Koa 中间件
- `apache/kafka:3.6.1` 镜像已被移除，使用 `latest + asCompatibleSubstituteFor` 并配合 `@Disabled` 测试
- `testcontainers/modules/doris` 与 Go 1.22 不兼容，使用 `//go:build integration` 隔离
- DaoCloud 公共镜像镜像阻止了 Airbyte 镜像拉取，改用阿里云加速器
- 浏览器配套工具存在刷新限制，需要手动 F5/Ctrl+R
- Pandoc 生成的 Markdown 图片路径需要修正为相对路径

## 版本计划与任务跟踪

> 当前版本计划详见：`docs/004-PLAN/PLAN-Mate_Platform-版本路线图_v2.0-20260716.md`（全量版，316 个 Task）
>
> 版本里程碑：
> - **v0.1-spike**（M1）：验证 IAM→ONT→RULE 底层链路
> - **v0.5-mvp**（M2-M4）：核心引擎层就绪，规则引擎+工作流可用
> - **v0.8-beta**（M5-M7）：Agent 运行时+数字员工 MVP
> - **v1.0-ga**（M8-M10）：全功能交付，调度模式上线
>
> 任务状态标记规则：`[ ]` 未开始 / `[~]` 进行中 / `[x]` 已完成 / `[!]` 阻塞
>
> 每次开发前请查阅版本路线图确认当前阶段和 Task 依赖关系，确保执行不偏差。

## 关键文档索引

| 文档 | 路径 |
|---|---|
| 项目总览 | `README.md` |
| 命名规范 | `docs/000-GUIDE/GUIDE-NAMING-CONVENTION_v1.0-20260716.md` |
| 文档结构规范 | `docs/000-GUIDE/GUIDE-DOC-STRUCTURE_v1.0-20260716.md` |
| **UI 设计规范** | `docs/000-GUIDE/GUIDE-Mate_Platform-UI_Design_Specification_v1.0-20260719.md` |
| 应用架构 | `docs/001-ARCH/ARCH-Mate_Platform-应用架构_v1.0-20260716.md` |
| 技术选型 | `docs/002-TS/TS-Mate_Platform-技术选型建议_自研最新版_v1.1-20260716.md` |
| **版本路线图与任务拆解（全量版）** | `docs/004-PLAN/PLAN-Mate_Platform-版本路线图_v2.0-20260716.md` |
| **PRD 需求覆盖度检查报告** | `docs/004-PLAN/PLAN-Mate_Platform-PRD需求覆盖度检查报告_v1.0-20260716.md` |
| OWL 调研 | `docs/005-RD/RD-Mate_Platform-Ontology_OWL调研报告_v1.0-20260716.md` |
