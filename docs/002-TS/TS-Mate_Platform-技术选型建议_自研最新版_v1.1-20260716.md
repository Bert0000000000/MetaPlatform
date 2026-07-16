# Mate Platform 技术选型建议（自研导向 · 最新版）

> 基于 Mate Platform 架构设计，以“核心能力自研 + 基础组件最新稳定版”为原则，给出全栈技术选型方案。
> 版本基准：2025 年 Q2-Q3 主流技术最新稳定版。

---

## 选型策略

1. **核心能力自研**：Ontology 本体引擎、低代码构建器、Action Engine、EA 架构资产、RAG pipeline、Agent 框架、LLM Gateway 等核心竞争力必须自研。
2. **基础组件用最新稳定版**：数据库、消息队列、缓存、容器编排、可观测性等基础能力，选择成熟且活跃的最新版本，不重复造轮子。
3. **Java 21 + Spring Boot 3.4 为主栈**：利用虚拟线程、GraalVM Native Image、Spring AI 1.0 等最新特性，兼顾企业级稳定性与云原生性能。
4. **Python 3.13 为 AI 副栈**：负责 LLM 推理、Embedding、RAG、模型编排等 AI 密集型任务。
5. **React 19 + TypeScript 5.7 为前端栈**：利用 React 19 的 Server Components、Actions、Compiler 等能力支撑低代码设计器与 Copilot UI。
6. **Kubernetes + Istio 为运行时底座**：全面拥抱云原生，服务网格统一流量治理。

---

## 总体推荐技术栈

| 层级 | 自研/选型 | 具体技术 | 版本/说明 |
|---|---|---|---|
| 前端框架 | 选型 | React 19 + TypeScript 5.7 + Vite 6 | 最新稳定版 |
| UI 组件库 | 选型 | **Ant Design 6.0** / Arco Design 2.x | 企业级组件库，v6 针对 React 19 深度优化 |
| 低代码设计器 | **自研** | JSON Schema + React 19 RSC 驱动 | 核心资产 |
| Copilot UI | **自研** | React 19 + WebSocket/SSE | 核心资产 |
| 后端主框架 | 选型 | Spring Boot 3.4 + Spring AI 1.0 | Java 21、虚拟线程 |
| 本体引擎 | **自研** | Mate Ontology Engine（JSON-LD + OWL API + HermiT/ELK） | 核心资产 |
| 知识图谱存储 | 选型 | Neo4j 5.x（Enterprise） | 属性图 + GDS |
| 关系数据库 | 选型 | PostgreSQL 17 | 元数据、业务数据 |
| 向量数据库 | 选型 | Milvus 2.5 / Zilliz Cloud | 大规模 RAG |
| 数据仓库 | 选型 | StarRocks 3.4 / 4.0 | 实时 OLAP |
| 数据湖 | 选型 | **Apache Hudi 1.x** + MinIO（主）/ Apache Iceberg 1.8（备） | 面向 CDC / upsert 的湖仓一体 |
| ETL/ELT | 选型 | Apache Flink 1.20 + Apache Airflow 2.10 + DBT 1.9 | 实时 + 批量 |
| 流程引擎 | **自研为主**，参考 Camunda 8 | Mate Workflow Engine（BPMN 2.0 子集） | 核心资产 |
| 规则引擎 | **自研** + 参考 Drools | Mate Rule Engine（DMN 1.5 子集） | 核心资产 |
| Action Engine | **自研** | Mate Action Engine（事件驱动 + RPA 编排） | 核心资产 |
| 消息队列 | 选型 | Apache Kafka 3.9 + RabbitMQ 4.x | 事件 + 任务 |
| 缓存 | 选型 | Redis 7.4 / Valkey 8 | 缓存、会话、锁 |
| AI 服务 | 选型 + 自研 | Python 3.13 + FastAPI + LangChain 0.3 + LangGraph 0.2 | AI 编排层 |
| RAG 引擎 | **自研** | Mate RAG Engine（基于 LlamaIndex + 自研混合检索） | 核心资产 |
| LLM Gateway | **自研** | Mate LLM Gateway（多模型路由 + 审计 + 成本） | 核心资产 |
| Agent 框架 | **自研** | Mate Agent Framework（基于 LangGraph 思想） | 核心资产 |
| 数字员工 | **自研** | Mate Digital Worker（Ontology + RAG + Agent） | 核心资产 |
| MCP 协议层 | **自研** | Mate MCP Server / Client（Spring AI MCP / fastapi-mcp） | 对接 Cursor/Copilot/Cloud Code |
| A2A 协议层 | **自研** | Mate A2A Server / Client（Agent Card + Task 委托） | 数字员工与外部 Agent 协作 |
| 对象存储 | 选型 | MinIO 2025 | S3 兼容 |
| 容器编排 | 选型 | Kubernetes 1.32 + Istio 1.24 | 服务网格 |
| 可观测性 | 选型 | OpenTelemetry 1.45 + Prometheus 3.x + Grafana 11.x + Loki 3.x + Jaeger 1.62 | 全栈可观测 |
| 身份安全 | 选型 + 自研 | Spring Security 6.4 + OAuth2 + 自研 IAM | 企业级权限 |

---

## 1. 前端技术栈

### 1.1 框架选型

| 技术 | 版本 | 角色 | 选型理由 |
|---|---|---|---|
| **React 19** | 19.x | UI 运行时 | Server Components、Actions、Compiler、Suspense 更成熟，适合构建复杂低代码设计器 |
| **TypeScript 5.7** | 5.7+ | 类型系统 | 更好的性能、类型推导与错误提示 |
| **Vite 6** | 6.x | 构建工具 | 极速 HMR、Rolldown 底层、对 RSC 支持更好 |
| **TanStack Query 5** | 5.x | 服务端状态管理 | 数据获取、缓存、后台更新标准化 |
| **Zustand 5 / Jotai 2** | 最新版 | 客户端状态管理 | 轻量、TypeScript 友好 |

**为什么不选 Vue / Angular**：
- 低代码设计器需要极强的组件动态渲染与扩展能力，React 19 的 RSC + Server Actions 更适合“配置驱动渲染”架构。
- React 生态在可视化、Canvas、图表、AI Chat UI 方面更丰富。

### 1.2 UI 组件库

| 组件库 | 版本 | 适用场景 |
|---|---|---|
| **Ant Design 6.0** | 6.x | 通用企业应用、管理后台、表单，React 19 原生支持 |
| **Ant Design X 2.0** | 2.x | AI 场景组件库（Chat UI、Prompt 输入、思维链展示） |
| **Arco Design 2.x** | 2.x | 字节生态、年轻化的企业应用 |
| **自研 Mate Design System** | - | 低代码设计器专有组件、Ontology 可视化、流程设计器 |

**推荐**：**Ant Design 6.0** 作为基础组件 + **Ant Design X 2.0** 作为 Copilot / AI 场景组件 + 自研 Mate Design System 扩展低代码与 Ontology 专属组件。

**Ant Design 6.0 的关键升级点（对我们项目的价值）**：

- **React 19 原生兼容**：最低支持 React 18，但针对 React 19 优化，与我们前端栈完全对齐。
- **纯 CSS Variables 样式架构**：支持 `zeroRuntime` 模式，主题切换更轻量，打包体积更小。
- **全量组件语义化结构**：每个组件提供 `classNames` / `styles` 语义化插槽，方便自研设计系统深度定制。
- **React Compiler 编译产物**：官方 dist 已启用 React Compiler，性能更优。
- **新增组件**：Masonry 瀑布流、Drawer 拖拽、InputNumber spinner 模式等。
- **移除 IE 支持**：减少兼容负担，与现代浏览器策略一致。
- **Ant Design X 2.0 同步发布**：专为 AI 场景设计，包含 Chat、Prompt、Sender、Welcome 等组件，直接用于 Copilot UI。

**需要注意的点**：
- Ant Design 6.0 刚发布不久，部分周边生态（如 ProComponents）可能还在适配中，需关注兼容性。
- 如果项目对 ProComponents 依赖较重，可先用 Ant Design 5.x 过渡，待 ProComponents 适配完成后再升级；但 Mate Platform 以自研低代码设计器为主，对 ProComponents 依赖可控，可直接上 6.0。

### 1.3 流程设计器组件选型（统一 FlowGram.AI）

Mate Platform 的两类流程可视化能力统一采用 **FlowGram.AI**：
1. **BPMN 业务审批流**：面向企业用户的审批、会签、条件分支、委托等流程建模。
2. **AI Agent / Action 编排流**：面向数字员工、Agent、RPA 的动作链编排，强调节点输入输出、变量联动、强类型端口。

| 场景 | 推荐包 | 布局模式 | 用途 |
|---|---|---|---|
| **BPMN 业务审批流设计器** | **@flowgram.ai/fixed-layout-editor** | 固定布局 | 审批、条件分支、循环、会签等结构化流程 |
| **AI Agent / Action 编排器** | **@flowgram.ai/free-layout-editor** | 自由布局 | Agent 动作链、LLM 调用、RAG、Tool 调用 |
| **通用画布/拓扑/ER 图** | **@antv/x6** | - | Ontology 关系可视化、EA 架构图、知识图谱 |
| **标准 BPMN 2.0 导入导出** | **bpmn-js** | - | 仅在需要与 Flowable/Camunda 互操作时做 XML ↔ JSON 转换 |

**统一用 FlowGram.AI 的理由**：
- **一套画布技术栈**：前端只维护一个流程引擎，降低长期维护成本。
- **React 19 原生**：字节开源，TypeScript + React Hooks，与 Mate Platform 前端栈完全对齐。
- **固定 + 自由双布局**：审批流用 fixed-layout，Agent 编排用 free-layout，底层模型一致。
- **变量引擎**：节点间输入输出类型联动，天然适合 Action 参数传递和 Agent 上下文管理。
- **插件化扩展**：可自定义审批节点物料、AI 节点物料，统一注册到 Mate Design System。
- **字节背书 + 活跃生态**：扣子（Coze）、飞书低代码同款，持续迭代。

**需要注意的成本**：
- FlowGram.AI 输出的是自定义 JSON，**不是标准 BPMN-XML**，需要自研：
  - 审批节点物料库（审批人、会签、或签、条件、抄送、委托、撤回、催办等）。
  - FlowGram JSON → Mate Workflow Engine 执行语义映射层。
  - 可选：FlowGram JSON ↔ BPMN-XML 转换层（用于对接 Flowable/Camunda）。
- 后端 Workflow Engine 仍需自研，FlowGram 只负责前端设计器。

**为什么不选 LogicFlow / ReactFlow / XFlow**：
- LogicFlow：审批流场景成熟，但 Agent 编排能力弱，无法统一。
- ReactFlow：生态好，但高级功能付费，且需要额外封装审批语义。
- XFlow：已停止维护，不推荐新项目使用。

### 1.4 低代码设计器（自研）

| 模块 | 技术方案 |
|---|---|
| 画布引擎 | React 19 + 自研渲染器（参考 formily/json-schema 协议） |
| 组件市场 | 动态加载 React 组件 + Schema 元数据注册 |
| 属性面板 | 自研 Schema Form，基于组件 Props 自动生成 |
| 流程设计器 | **FlowGram.AI**（fixed-layout 审批流 + free-layout Agent 编排） |
| 页面与流程联动 | 通过 Ontology 概念与 Action 定义驱动 |
| 版本与协同 | 基于 OT / Yjs 实现多人实时协同 |
| 预览与发布 | SSR / RSC 渲染，JSON Schema → React 组件 |

**参考但不依赖**：Formily、LowCodeEngine、Designable、LogicFlow、ReactFlow。

---

## 2. 后端主栈：Java 21 + Spring Boot 3.4

### 2.1 基础框架

| 技术 | 版本 | 用途 |
|---|---|---|
| **Spring Boot 3.4** | 3.4.x | 微服务基础框架 |
| **Spring Framework 6.2** | 6.2.x | 底层容器与 Web 支持 |
| **Spring Cloud 2024.0** | 2024.0.x | 微服务治理（配置中心、服务发现、网关） |
| **Spring Data JPA / JDBC** | 最新版 | 数据访问 |
| **Spring Security 6.4** | 6.4.x | 身份认证与授权 |
| **Spring AI 1.0+** | 1.0+ | Java 侧 LLM 集成（Prompt、Embedding、Vector Store、Chat Memory） |

### 2.2 Java 21 关键特性利用

| 特性 | 用途 |
|---|---|
| **Virtual Threads** | 高并发 I/O 密集型服务（API Gateway、Ontology Service、Workflow Service） |
| **Structured Concurrency** | 并行调用多个微服务或数据源 |
| **Pattern Matching for switch** | 复杂的业务规则分支简化 |
| **Record Patterns** | DTO / 事件对象解构 |
| **String Templates（Preview）** | Prompt 模板渲染（可选） |

### 2.3 GraalVM Native Image

- 适用于需要快速启动、低内存占用的服务：Action Engine、Gateway、Serverless 函数。
- 与 Spring Boot 3.4 原生支持 AOT 编译配合，可显著降低云原生成本。

### 2.4 服务划分与语言选择

| 服务 | 语言 | 框架 | 说明 |
|---|---|---|---|
| mate-ontology-service | Java 21 | Spring Boot 3.4 | 本体建模、推理、版本管理 |
| mate-workflow-service | Java 21 | Spring Boot 3.4 + 自研引擎 | BPMN 流程执行 |
| mate-action-service | Java 21 / Go 1.24 | Spring Boot 3.4 为主 | 规则触发、自动化执行 |
| mate-ea-service | Java 21 | Spring Boot 3.4 | EA 架构资产管理 |
| mate-app-service | Java 21 | Spring Boot 3.4 | 应用构建与运行 |
| mate-ai-service | Python 3.13 | FastAPI | LLM、RAG、Agent 编排 |
| mate-data-service | Java 21 / Python 3.13 | Spring Boot 3.4 + Airflow | 数据集成、ETL 调度 |
| mate-iam-service | Java 21 | Spring Boot 3.4 + Spring Security | 身份与权限 |
| mate-gateway | Java 21 | Spring Cloud Gateway | API 网关、限流、认证 |

---

## 3. 本体引擎（核心自研）

### 3.1 自研定位

Mate Ontology Engine 是平台最核心的自研资产，目标是：
- 提供业务友好的本体建模能力（而非强迫业务人员学习 OWL）。
- 内部采用 JSON/JSON-LD 描述，导入导出兼容 OWL 2。
- 支持分层推理：术语层用 OWL 2 EL，查询层用 OWL 2 QL，规则层用 OWL 2 RL。

### 3.2 技术组成

| 模块 | 技术 |
|---|---|
| 元模型定义 | 自研 JSON Schema + JSON-LD Context |
| 本体存储 | PostgreSQL 17（元数据）+ Neo4j 5.x（关系网络） |
| 推理引擎 | OWL API 5.x + HermiT（DL 推理）/ ELK（EL 推理） |
| 规则执行 | 自研 Rule Engine（受 Drools / DMN 启发） |
| 自然语言抽取 | Python 3.13 + LangChain 调用 LLM |
| 版本管理 | 自研 Git-like 版本模型 + 差异对比 |
| 导入导出 | OWL/RDF/XML、Turtle、JSON-LD、Excel |

### 3.3 与 OWL 的关系

- **不直接用 OWL 作为内部表示**：内部用更轻量的 JSON/JSON-LD，降低业务使用门槛。
- **OWL 作为交换格式**：支持与 Protégé、Jena、GraphDB 等工具互操作。
- **描述逻辑作为推理基础**：通过 OWL API 调用 HermiT / ELK reasoner，但对外屏蔽复杂性。

---

## 4. 数据层技术栈

### 4.1 关系数据库：PostgreSQL 17

| 特性 | 用途 |
|---|---|
| JSONB | 存储 Ontology 元数据、Schema 定义 |
| pgvector 0.8+ | 轻量级向量检索（小规模场景） |
| 分区表 | 大规模业务数据分区 |
| 逻辑复制 | 实时数据同步到数仓/图库 |
| Full-Text Search | 文档元数据检索 |

### 4.2 图数据库：Neo4j 5.x Enterprise

| 特性 | 用途 |
|---|---|
| Cypher | 知识图谱查询 |
| APOC | 数据导入导出、复杂过程 |
| GDS（Graph Data Science） | 社区发现、路径分析、相似度计算 |
| Fabric | 跨数据库联邦查询 |
| 因果集群 | 高可用 |

### 4.3 向量数据库：Milvus 2.5

| 特性 | 用途 |
|---|---|
| GPU 索引 | 加速十亿级向量检索 |
| Hybrid Search | 向量 + 标量过滤 |
| Partition / Collection | 多租户知识库隔离 |
| Milvus CDC | 向量数据变更捕获 |
| IVF_RABITQ 等量化索引 | 内存降低 72%、QPS 提升 4 倍（实测） |
| 存算分离 | 云原生水平扩展 |

**为什么 Mate Platform 选 Milvus 而不是 PGVector / Weaviate / Elasticsearch**：

| 维度 | Milvus | PGVector | Weaviate | Elasticsearch |
|---|---|---|---|---|
| **定位** | 专为十亿级向量设计的分布式向量数据库 | PostgreSQL 插件，轻量向量能力 | 云原生语义搜索引擎 | 全文搜索 + 向量扩展 |
| **规模** | 十亿级向量，延迟 < 50 ms | 千万级以内尚可，十亿级扩展困难 | 亿级，生态丰富 | 百万级向量优秀，超大规模性能衰减 |
| **混合检索** | 向量 + 标量过滤 + 多向量 | SQL + 向量联合查询 | GraphQL + 向量 | BM25 + 向量混合打分 |
| **成本压缩** | RaBitQ 等量化技术显著降低内存 | 依赖 PG 自身优化，压缩能力有限 | 支持量化 | 向量内存占用高 |
| **运维复杂度** | 中等（存算分离） | 最低（PG 插件） | 中等 | 高 |
| **Mate Platform 适合度** | **★★★★★** | ★★★（开发/小规格备选） | ★★★★ | ★★★★（日志/文档混合搜索场景备选） |

**结论**：
- **Milvus 2.5 作为主选**，承担企业级 RAG 的向量存储与混合检索，支持知识库的多租户隔离和 CDC。
- **PGVector 作为轻量备选**：在开发环境、小规模 POC 或 PostgreSQL 原生业务表中直接存 Embedding 时使用。
- **Weaviate / Elasticsearch 可作为特殊场景补充**：Weaviate 适合强语义搜索场景；Elasticsearch 适合需要 BM25 + 向量混合打分的日志/文档搜索场景。

### 4.4 数据仓库：StarRocks 3.4 / 4.0

| 特性 | 用途 |
|---|---|
| 实时更新 | 主键模型支持高频更新 |
| 湖仓一体 | 查询 Iceberg/Hudi 数据 |
| 物化视图 | 预计算报表 |
| 查询 Federation | 跨源查询 PostgreSQL/MySQL |

### 4.5 数据湖：Apache Hudi 1.x（主）/ Apache Iceberg 1.8（备）

**Mate Platform 数据湖的核心诉求**：
1. 从 ERP/CRM/OA 等企业系统做 **CDC 实时入湖**，存在大量更新、删除、Upsert。
2. 支撑 Ontology 关系网的 **增量构建** 与 **实时联动**。
3. 流批一体，降低 ETL 端到端延迟。
4. 数据治理需要记录级变更历史、数据血缘、Time Travel。

**为什么 Hudi 更适合 Mate Platform 的 CDC 场景**：

| 维度 | Apache Hudi 1.x | Apache Iceberg 1.8 | Delta Lake |
|---|---|---|---|
| **设计初衷** | Uber：近实时 PB 级数据湖，支持 Upsert/Delete | Netflix：解决云存储元数据规模问题 | Databricks：Spark 生态深度集成 |
| **CDC / 变更流** | **记录级索引 + 完整变更流（含 update/delete）**，原生支持 | 仅支持增量追加，update/delete 需额外处理 | Change Data Feed 2.0 后支持，但生态绑定 Spark |
| **Upsert 性能** | **CoW + MoR 双模式**，MoR 对高吞吐 upsert 更友好 | CoW 为主，写放大明显 | CoW 为主，写放大明显 |
| **摄取工具** | **Hudi DeltaStreamer** 成熟，支持 Kafka/DB CDC/S3 事件/JDBC | 无官方托管摄取工具 | Delta AutoLoader 为 Databricks 专有 |
| **索引能力** | **多模式索引**（Bloom/Hash/Bitmap/R-tree），点查 10-100x 提升 | 基础元数据索引 | 元数据索引 |
| **并发控制** | 文件级 OCC，针对小更新/删除优化 | 表级 OCC | 表级/JVM 级 OCC |
| **多引擎支持** | Spark/Flink/StarRocks/Trino | **Spark/Flink/StarRocks/Trino/DuckDB 更广泛** | 深度绑定 Spark/Databricks |
| **分区策略** | 粗粒度分区 + 异步 Clustering 演进 | **隐藏分区 + 分区演进** 更灵活 | 分区演进有限 |
| **运维复杂度** | 略高（Compaction/Clustering 需调优） | 相对较低 | 中等 |
| **Mate Platform 适合度** | **★★★★★** | ★★★★ | ★★★ |

**Hudi 在 Mate Platform 中的典型用途**：

| 特性 | 用途 |
|---|---|
| CDC 入湖 | 通过 Flink CDC / Debezium + Hudi DeltaStreamer 实时捕获业务系统变更 |
| Upsert / Delete | 企业主数据、订单、库存等存在频繁更新的数据入湖 |
| Merge on Read | 流式写入使用 MoR 降低写入延迟，批量查询使用 CoW 保证性能 |
| Time Travel / 行版本 | 数据血缘、合规审计、数据回滚 |
| 增量查询 | Ontology 关系网增量构建、实时 Action 触发 |
| 多模式索引 | 快速定位变更记录，支撑数据治理 |

**Iceberg 的定位**：
- 作为 **备选/补充格式**：用于日志、埋点、IoT 等 **以追加为主** 的数据，或需要更灵活分区演进的场景。
- StarRocks、Flink、Spark 均支持 Iceberg，生态非常成熟，可在同一平台内与 Hudi 并存。

### 4.6 ETL/ELT：Flink 1.20 + Airflow 2.10 + DBT 1.9

| 工具 | 用途 |
|---|---|
| **Apache Flink 1.20** | 实时 CDC、流处理、ETL，原生写入 Hudi/Iceberg |
| **Apache Airflow 2.10** | 批量任务编排、依赖管理 |
| **DBT 1.9** | 数据仓库建模、转换、测试 |
| **Debezium 3.x** | CDC 捕获源系统变更 |
| **Hudi DeltaStreamer** | Hudi 表增量摄取（Kafka / DB CDC / S3 / JDBC） |
| **自研 Connector Framework** | ERP/CRM/OA 等企业系统连接 |

---

## 5. AI 技术栈

### 5.1 AI 服务：Python 3.13 + FastAPI

| 技术 | 版本 | 用途 |
|---|---|---|
| Python | 3.13 | AI 运行时 |
| FastAPI | 0.115+ | 高性能 API 框架 |
| Pydantic 2 | 2.x | 数据模型与校验 |
| uv | 最新版 | 极速包管理 |
| Ruff | 最新版 | 代码检查与格式化 |

### 5.2 RAG 引擎（自研 + 选型）

| 模块 | 技术 |
|---|---|
| 文档解析 | 自研 Pipeline + unstructured.io / marker |
| 文本分块 | 自研（基于 Ontology 结构 + 语义分段） |
| Embedding | BGE-M3 / text-embedding-3 / 通义千问 Embedding |
| 向量存储 | Milvus 2.5 |
| 图谱检索 | Neo4j + Ontology 关系 |
| 混合检索 | 自研 Reranker + 多路召回 |
| 生成 | LangChain 0.3 + 多模型路由 |

### 5.3 Agent 框架（自研）

| 模块 | 技术 |
|---|---|
| 规划 | 自研 ReAct / Plan-and-Solve + LangGraph 0.2 思想 |
| 记忆 | 自研短期记忆（Redis）+ 长期记忆（向量库 + 图谱） |
| 工具调用 | 自研 Tool Registry + Function Calling + MCP Client |
| 多 Agent 协作 | 自研 A2A 适配层 |
| 人机协作 | 自研 Human-in-the-loop 中断与恢复 |
| 评估 | 自研 Agent 执行轨迹记录与效果评估 |

### 5.4 LLM Gateway（自研）

| 能力 | 说明 |
|---|---|
| 多模型接入 | OpenAI、Anthropic、Azure OpenAI、火山方舟、通义千问、DeepSeek 等 |
| 统一 API | OpenAI-compatible API |
| 流量治理 | 限流、熔断、Fallback |
| 成本核算 | 按模型 / 按应用 / 按用户统计 Token 消耗 |
| 审计与安全 | Prompt / Response 审计、敏感内容检测 |
| Ontology 增强 | 自动注入 Ontology 上下文到 Prompt |

### 5.5 协议层：MCP + A2A

Mate Platform 作为企业级 Agent 平台，需要同时支持两种主流 Agent 互操作协议：

| 协议 | 定位 | 适用场景 |
|---|---|---|
| **MCP（Model Context Protocol）** | **工具/资源接入标准** | 让外部 AI 应用（Claude/Cursor/Copilot 等）调用 Mate Platform 提供的数据、工具、Prompt |
| **A2A（Agent-to-Agent Protocol）** | **Agent 间协作标准** | 让 Mate Platform 的数字员工与其他 Agent 系统互相发现、委托任务、异步协作 |

#### 5.5.1 MCP（Model Context Protocol）

**协议现状**：
- 由 Anthropic 于 2024 年 11 月开源，2025 年 12 月捐赠给 Linux Foundation。
- 基于 JSON-RPC，支持 stdio / HTTP SSE 传输。
- 截至 2026 年初，MCP 下载量已超 9700 万次，成为事实上的工具接入标准。

**Mate Platform 作为 MCP Server**：
- 暴露平台核心能力为 MCP Tools / Resources / Prompts：
  - **Tools**：Ontology 查询、知识库检索、审批操作、数据湖查询、Action 执行。
  - **Resources**：企业制度文档、EA 架构资产、流程定义、数据字典。
  - **Prompts**：数字员工角色模板、业务分析 Prompt、代码生成 Prompt。
- 技术实现：`spring-ai-mcp-server-spring-boot-starter`（Java）或 `fastapi-mcp`（Python）。

**Mate Platform 作为 MCP Client**：
- Agent 框架内部通过 MCP Client 调用第三方 MCP Server（如 GitHub、Slack、数据库查询、搜索引擎等）。
- 统一接入到自研 Tool Registry，实现 Tool ↔ MCP 的自动映射与权限控制。

#### 5.5.2 A2A（Agent-to-Agent Protocol）

**协议现状**：
- 由 Google 于 2025 年 4 月发布，2026 年 4 月发布 v1.0 正式版，已有 150+ 组织加入。
- 核心能力：能力发现（Agent Card）、任务委托、异步通信、状态跟踪。
- 与 MCP 互补：MCP 管“如何调工具”，A2A 管“如何调 Agent”。

**Mate Platform 作为 A2A Client**：
- 数字员工发现外部 Agent 能力（读取 Agent Card）。
- 将复杂任务委托给外部专业 Agent（如法律审查 Agent、数据分析 Agent）。
- 跟踪任务状态、接收异步结果、处理失败与回退。

**Mate Platform 作为 A2A Server**：
- 暴露平台数字员工为 A2A Agent，对外提供能力发现接口。
- 接收外部 Agent 的任务委托，调度 Mate Workflow / Action Engine 执行。
- 返回任务状态、中间产物、最终结果。

#### 5.5.3 协议层架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Mate Platform                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ LLM Gateway │  │ MCP Server  │  │ A2A Server/Client   │  │
│  │  (自研)      │  │  (自研)      │  │    (自研)            │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                    │             │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────────▼──────────┐  │
│  │  Agent 框架 │  │ Tool Registry│  │   Agent Registry    │  │
│  │  (自研)      │  │  (自研)      │  │    (自研)            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   MCP Clients         A2A Peers         External AI Apps
   (第三方工具)         (外部 Agent)        (Cursor/Copilot/Claude)
```

#### 5.5.4 关键集成点

| 集成点 | 协议 | 说明 |
|---|---|---|
| Cloud Code / Codex / Cursor | MCP | 让这些 AI IDE 直接读取 Mate Platform 的 Ontology、知识库、执行 Action |
| 外部 Agent 市场 | A2A | 让 Mate 数字员工与外部 Agent 协作 |
| 企业内部系统 | MCP | 通过 MCP Server 暴露 ERP/CRM/OA 查询与操作能力 |
| 数字员工调度 | A2A | 一个数字员工可以将子任务委托给另一个数字员工或外部 Agent |

---

## 6. 流程与规则引擎

### 6.1 Mate Workflow Engine（自研）

| 能力 | 说明 |
|---|---|
| 建模 | 自研 BPMN 2.0 子集可视化设计器 |
| 执行 | 自研状态机 + 事件驱动运行时 |
| 任务 | 统一待办、会签、委托、催办 |
| 规则网关 | 调用自研 Rule Engine |
| 监控 | 流程热力图、SLA 预警 |
| 与 Ontology 集成 | 节点引用 Ontology 概念、属性、角色 |

**参考但不依赖**：Camunda 8、Flowable。

### 6.2 Mate Rule Engine（自研）

| 能力 | 说明 |
|---|---|
| 规则语言 | 自研 DSL（受 DMN 1.5 / Drools 启发） |
| 决策表 | 可视化决策表 |
| 执行 | Rete 算法 / 前向链推理 |
| 与 Action 集成 | 规则触发 Action |
| 与 Ontology 集成 | 规则引用 Ontology 属性与约束 |

---

## 7. 中间件与基础设施

### 7.1 消息队列

| 技术 | 版本 | 用途 |
|---|---|---|
| **Apache Kafka 3.9** | 3.9.x | 事件总线、CDC、数据集成 |
| **RabbitMQ 4.x** | 4.x | 工作流任务、异步通知、延迟队列 |

### 7.2 缓存

| 技术 | 版本 | 用途 |
|---|---|---|
| **Redis 7.4** | 7.4.x | 缓存、会话、分布式锁、限流 |
| **Valkey 8** | 8.x | Redis 开源替代（若受许可约束） |

### 7.3 对象存储

| 技术 | 版本 | 用途 |
|---|---|---|
| **MinIO 2025** | RELEASE.2025 | 私有化对象存储、数据湖底座 |
| **S3 / OSS / COS** | - | 公有云场景 |

### 7.4 容器编排与服务网格

| 技术 | 版本 | 用途 |
|---|---|---|
| **Kubernetes 1.32** | 1.32.x | 容器编排 |
| **Istio 1.24** | 1.24.x | 服务网格、mTLS、流量治理 |
| **Helm 3.17** | 3.17.x | 应用打包与部署 |
| **ArgoCD 2.13** | 2.13.x | GitOps 持续交付 |

---

## 8. 可观测性与安全

### 8.1 可观测性

| 信号 | 技术 | 版本 |
|---|---|---|
| Trace / Metrics / Logs 采集 | OpenTelemetry Collector | 0.115+ |
| Java Agent | OpenTelemetry Java Agent | 2.x |
| Python SDK | OpenTelemetry Python | 1.29+ |
| 指标存储与告警 | Prometheus + Alertmanager | 3.x |
| 可视化 | Grafana | 11.x |
| 日志 | Loki / Vector | 3.x |
| 链路 | Jaeger / Tempo | 1.62+ |
| 性能剖析 | Pyroscope / Parca | 最新版 |

### 8.2 安全

| 层级 | 技术 |
|---|---|
| 身份认证 | OAuth2 / OIDC + Spring Security 6.4 |
| 权限控制 | 自研 RBAC + ABAC（基于 Ontology 属性） |
| 数据加密 | TLS 1.3、AES-256-GCM、字段级加密（Tink） |
| 密钥管理 | HashiCorp Vault / 云 KMS |
| 审计 | 自研审计服务 + OpenTelemetry |
| API 安全 | WAF、Rate Limit、API 密钥轮换 |

---

## 9. 自研与选型的边界

| 能力 | 自研 or 选型 | 理由 |
|---|---|---|
| Ontology 本体引擎 | **自研** | 核心竞争力，决定平台差异 |
| 低代码设计器 | **自研** | 与 Ontology 深度绑定，无法外购 |
| Action Engine | **自研** | 业务自动化核心 |
| RAG 引擎 | **自研** | 向量 + 图谱 + Ontology 混合检索是差异化点 |
| Agent 框架 | **自研** | 数字员工与 Ontology 联动是核心 |
| LLM Gateway | **自研** | 安全、审计、成本、多模型路由必须可控 |
| EA 架构资产 | **自研** | 企业架构方法论需内化 |
| Workflow Engine | **自研核心**，参考开源 | BPMN 执行层可控，但初期可基于 Flowable 封装 |
| Rule Engine | **自研核心** | 规则与 Ontology 联动是核心 |
| 数据库/缓存/消息队列 | 选型 | 不重复造轮子，用最新稳定版 |
| 容器编排/可观测性 | 选型 | 行业标准，自研成本过高 |
| AI 推理框架 | 选型 | LangChain/LangGraph/FastAPI 成熟，专注上层自研 |

---

## 10. 推荐组合（最终版）

### 10.1 开发环境

- **JDK**：GraalVM 21 / Oracle JDK 21
- **Python**：3.13
- **Node.js**：22 LTS
- **数据库**：PostgreSQL 17、Neo4j 5.x、Milvus 2.5、Redis 7.4
- **数据**：MinIO、StarRocks 3.4、Apache Hudi 1.x、Apache Iceberg 1.8
- **消息**：Kafka 3.9、RabbitMQ 4.x
- **编排**：Docker Compose / Kind（本地 K8s）

### 10.2 生产环境

- **运行时**：Kubernetes 1.32 + Istio 1.24
- **CI/CD**：GitLab CI / GitHub Actions + ArgoCD
- **可观测性**：OpenTelemetry + Prometheus 3.x + Grafana 11.x + Loki 3.x + Jaeger
- **安全**：Vault + Spring Security + 自研 IAM
- **备份**：Velero + 数据库原生备份

### 10.3 全栈版本锁定

| 技术 | 推荐版本 |
|---|---|
| Java | 21 LTS |
| Spring Boot | 3.4.x |
| Spring AI | 1.0+ |
| Python | 3.13 |
| FastAPI | 0.115+ |
| LangChain | 0.3.x |
| LangGraph | 0.2.x |
| React | 19.x |
| TypeScript | 5.7+ |
| Vite | 6.x |
| Ant Design | 6.0.x |
| Ant Design X | 2.0.x |
| PostgreSQL | 17 |
| Neo4j | 5.x |
| Milvus | 2.5 |
| StarRocks | 3.4 / 4.0 |
| Hudi | 1.x（最新稳定版） |
| Iceberg | 1.8（备选格式） |
| Flink | 1.20 |
| Airflow | 2.10 |
| Kafka | 3.9 |
| Kubernetes | 1.32 |
| Istio | 1.24 |
| OpenTelemetry | 1.45+ |
| Prometheus | 3.x |
| Grafana | 11.x |
| MCP | 2025-03-26 spec + Spring AI MCP 1.0+ |
| A2A | v1.0 spec（2026-04）+ 自研实现 |

---

## 11. 实施路径建议

### 第一阶段：核心自研底座（3-4 个月）

- 搭建 Spring Boot 3.4 + Java 21 微服务骨架
- 自研 Ontology 元模型与存储（PostgreSQL + Neo4j）
- 自研低代码设计器 MVP
- 集成 HermiT / ELK reasoner
- 基于 Flowable 封装 Workflow Engine MVP（后续逐步替换核心）

### 第二阶段：数据与知识（3-4 个月）

- 自研 Connector Framework，接入 3-5 个核心系统
- 引入 Kafka + Flink + Airflow + DBT + Hudi DeltaStreamer
- 建设 StarRocks 数仓 + **Hudi 主数据湖** + Iceberg 补充数据湖
- 自研 RAG Engine（Milvus + Neo4j + 混合检索）
- 数字员工 POC

### 第三阶段：智能动作（3-4 个月）

- 自研 Action Engine 与 Rule Engine
- 自研 LLM Gateway 与 Agent Framework
- 实现 Workflow → Action 闭环
- **MCP Server / Client 对接**：暴露 Ontology 查询、知识库检索、Action 执行等能力到 Cursor/Copilot/Cloud Code
- **A2A 协议对接**：实现数字员工的 Agent Card 发布、任务委托、异步状态跟踪

### 第三阶段补充：协议层实现重点

- **MCP 层**：
  - 基于 `spring-ai-mcp-server-spring-boot-starter` 实现 Java 侧 MCP Server。
  - 基于 `fastapi-mcp` 实现 Python 侧 MCP Server（RAG、Embedding、模型调用）。
  - 设计 MCP Tool/Resource/Prompt 到 Mate Platform 内部 API 的映射规范。
  - 接入权限控制：MCP 调用必须携带用户身份与数据权限。

- **A2A 层**：
  - 设计 Agent Registry，维护数字员工的 Agent Card（能力、输入输出 schema、SLA）。
  - 实现 Task 委托协议：Task → Artifact → Status Update 的异步流转。
  - 与 Mate Workflow Engine 集成：外部 Agent 委托的任务可转为内部工作流实例执行。
  - 安全：任务委托需认证、鉴权、审计，敏感操作需人工确认。

### 第四阶段：规模化与生态（6-12 个月）

- Workflow Engine、Rule Engine 全面自研替换
- Kubernetes + Istio 生产化
- 应用市场、Open API、多租户
- 全链路 OpenTelemetry 可观测性
- 国产化与合规加固

---

## 12. 风险与应对

| 风险 | 说明 | 应对 |
|---|---|---|
| 自研周期长 | Ontology、Workflow、RAG 自研投入大 | 分阶段自研，初期可用成熟开源组件封装过渡 |
| 新技术稳定性 | React 19、Spring AI 1.0 等较新 | 跟踪 LTS 版本，核心路径加测试覆盖 |
| 人才招聘 | Java 21、LangGraph、Istio 等需要经验 | 内部培养 + 关键岗位外部招聘 |
| 多语言复杂度 | Java + Python + TypeScript | 明确服务边界、统一 API 契约、完善文档 |
| 推理性能 | OWL DL 推理复杂度高 | 使用 EL/RL Profiles，按需启用 reasoner |
| 数据湖运维 | Hudi + Iceberg + MinIO 需要专业运维，Hudi Compaction/Clustering 需调优 | 优先云托管，逐步自建；引入 Hudi 运维基线 |
| 协议兼容性 | MCP/A2A 规范仍在快速演进，生态工具版本差异大 | 跟踪官方 spec，封装适配层，避免直接依赖实现细节 |
| 安全风险 | MCP/A2A 暴露平台能力给外部 AI 应用，存在越权调用风险 | 强制认证鉴权、审计日志、敏感操作人工确认、最小权限原则 |

---

## 参考资料

1. [Spring Boot 3.4 Release Notes](https://spring.io/blog/2024/11/21/spring-boot-3-4-0-available-now)
2. [Spring AI 1.0 GA](https://spring.io/blog/2025/05/20/spring-ai-1-0-ga-released)
3. [Java 21 Features](https://openjdk.org/projects/jdk/21/)
4. [React 19](https://react.dev/blog/2024/12/05/react-19)
5. [Neo4j 5 Documentation](https://neo4j.com/docs/operations-manual/5/)
6. [PostgreSQL 17 Release Notes](https://www.postgresql.org/docs/17/release-17.html)
7. [Milvus 2.5 Documentation](https://milvus.io/docs/v2.5.x/overview.md)
8. [Apache Hudi 1.x Documentation](https://hudi.apache.org/docs/quick-start-guide)
9. [Apache Iceberg 1.8](https://iceberg.apache.org/releases/)
10. [Apache Flink 1.20](https://nightlies.apache.org/flink/flink-docs-release-1.20/)
11. [LangChain 0.3](https://blog.langchain.dev/langchain-v0-3/)
12. [LangGraph 0.2](https://langchain-ai.github.io/langgraph/)
13. [OpenTelemetry 1.45](https://github.com/open-telemetry/opentelemetry-java/releases)
14. [Model Context Protocol Specification](https://modelcontextprotocol.io/specification/2025-03-26/)
15. [A2A Protocol Specification](https://google.github.io/A2A/)
