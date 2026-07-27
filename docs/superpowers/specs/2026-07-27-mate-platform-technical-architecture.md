# Mate Platform 完整技术架构

> **版本**：v2.0 | **日期**：2026-07-27 | **状态**：正式版（Active）
>
> **本架构文档是 Mate Platform 的唯一权威技术参考（The One Doc）**。
>
> **本文档整合**：v2 技术栈决策 + RAGFlow 集成 + LightRAG 集成 + Knowledge Engineering 流水线 + 全部模块的完整技术栈。
>
> **归档历史文档**（保留供决策追溯，本文档**不**依赖）：
> - `2026-07-27-mate-platform-rag-architecture.md`（RAG 子系统主架构，已并入本文档 §9）
> - `2026-07-27-v2-tech-stack-decision.md`（v2 决策，已并入 §1）
> - `2026-07-27-ragflow-graphrag-integration-a.md`（A 方案，已并入 §6.5 / §9.1）
> - `2026-07-27-lightrag-integration.md`（LightRAG 实施，已并入 §6.6 / §9.2）
> - `2026-07-27-rag-graphrag-best-solution.md`（v1 方案，已废止）
> - `2026-07-27-platform-rag-technical-architecture.md`（v1 全 Java 架构，已废止）
> - `docs/legal/LEGAL_CLEARANCE-ragflow-2026-07-27.md`（合规自评估，已并入 §10.4）

---

## 0. TL;DR

| 维度 | 决策 |
|---|---|
| **平台定位** | 基于 Ontology 本体引擎的企业级 AI 平台（数字员工 + RAG 知识库 + 智能助手 + 架构中心） |
| **技术栈基线** | Java 21 + Spring AI Alibaba 1.1.2 主力 + AI 子域允许 Python 3.10+ |
| **核心技术** | Spring Boot 3.5 / Spring AI 1.1.2 / PostgreSQL 17 / Neo4j 5.x / Milvus 2.5 / Kafka 3.9 |
| **AI 编排** | Spring AI Alibaba 1.1.2.0（BOM 统一）+ SAA Graph Core + Nacos 3.0+ MCP/A2A |
| **核心 RAG 引擎** | RAGFlow（DeepDoc 解析）+ LightRAG（GraphRAG 检索）+ 自研（Hybrid / Router / KE） |
| **Agent Runtime** | DeerFlow 2.1（外部集成）+ 自研 SAA Graph Core |
| **核心数据家** | 4 个：PostgreSQL / Neo4j / Milvus / MinIO |
| **核心中间件** | Redis 7.4 / Kafka 3.9 / Nacos 3.0+ / Istio 1.24 / OpenTelemetry 1.45 |
| **差异化** | Knowledge Engineering 流水线（AI 抽 Ontology + 人工审核）——护城河 |
| **合规** | RAGFlow AGPL-3.0 自评估 + LightRAG MIT 备案 + 应急方案 |
| **文档版本** | v2.0（取代 v1.x 全部历史文档） |

---

## 1. 架构原则

### 1.1 v2 技术栈决策（2026-07-27 通过）

| 维度 | v1.2（已废止） | **v2（当前）** |
|---|---|---|
| 主力栈 | 全量 Java + SAA | **Java 21 + SAA 1.1.2**（不变） |
| Python 允许 | ❌ 禁止 | ✅ **AI 子域允许** |
| 决策公理 | 个人能力上限 | **AI 作为技术专家**（团队 + AI + 自评估三重判断） |
| 运维约束 | "少一套栈" | "**可观测性到位即可**"（不分语言） |

### 1.2 7 条铁律

| # | 原则 | 说明 |
|---|---|---|
| **P1** | **主力栈优先** | 新项目默认 Java + SAA |
| **P2** | **AI 子域例外** | Agent Runtime、复杂 RAG、OCR/版面允许 Python |
| **P3** | **核心业务后端禁 Python** | 交易、订单、权限、计费必须 Java |
| **P4** | **法务合规是硬约束** | 任何新开源组件必须过自评估 |
| **P5** | **可观测性高于语言统一** | 跨语言栈必须统一接入 TECH-OBS |
| **P6** | **AI 协作是新能力维度** | 团队需**主动**与 AI 协作 |
| **P7** | **季度复盘 + 决策可逆** | 每季度复盘，可回退到 v1.3 |

### 1.3 业务三大场景

| 场景 | 描述 | 引擎 |
|---|---|---|
| **S1 知识库建立** | PPT/Word/PDF/Excel 精准切片 | RAGFlow（DeepDoc） |
| **S2 Ontology 抽象** ⭐ | AI 抽实体-关系-优化本体 | KE 流水线（护城河） |
| **S3 知识问答** | 跨主题、跨文档智能问答 | Hybrid / Graph-Enhanced / LightRAG |

---

## 2. 技术语言

### 2.1 后端语言

| 语言 | 版本 | 用途 | 占比 |
|---|---|---|---|
| **Java** | **21 LTS** | 主力后端语言 | ~85% |
| **Python** | **3.10+** | AI 子域（Agent/RAG/特定工具） | ~10% |
| Go（备用） | 1.22+ | 性能关键服务（未来） | <5% |

**决策依据**：
- Java 21 LTS = 长期支持 + 现代化特性（虚拟线程、模式匹配）
- Python 3.10+ = AI 生态成熟（LangChain、Transformers、PaddleOCR）

### 2.2 前端语言

| 语言 | 版本 | 用途 |
|---|---|---|
| **TypeScript** | 5.7+ | 主力前端语言 |
| JavaScript | ES2022 | 运行时 |
| CSS | Tailwind 4 + CSS Modules | 样式 |
| HTML | HTML5 | 模板 |

### 2.3 数据 / 配置语言

| 语言 | 用途 |
|---|---|
| **SQL** | 数据库查询 |
| **Cypher** | Neo4j 图查询 |
| **JSON / YAML** | 配置 / API |
| **Markdown** | 文档 |
| **Bash / PowerShell** | 脚本 |
| **HCL / K8s YAML** | IaC |

---

## 3. 技术栈（详细版本与依据）

### 3.1 后端核心框架

| 类别 | 技术 | 版本 | 依据 |
|---|---|---|---|
| **语言** | **Java** | **21 LTS** | 虚拟线程、模式匹配 |
| **框架** | Spring Boot | 3.5.x | Spring 生态核心 |
| **框架** | Spring Framework | 6.2.x | 底层容器 |
| **框架** | Spring Cloud | 2025.0.x | 微服务治理 |
| **框架** | Spring Cloud Alibaba | 2025.0.0.0 | Nacos / Sentinel / Seata |
| **AI 编排** | **Spring AI** | **1.1.2** | Java LLM 集成 |
| **AI 编排** | **Spring AI Alibaba** | **1.1.2.0** | **BOM 统一、Graph/Nacos MCP/A2A** |
| **AI 扩展** | Spring AI Alibaba Extensions | 1.1.2.1 | 扩展工具 |
| **数据** | Spring Data JPA | latest | ORM |
| **数据** | Spring Data Neo4j | latest | 图库 |
| **数据** | MyBatis-Plus（可选） | 3.5.x | 复杂 SQL 场景 |
| **Web** | Spring WebFlux + MVC + 虚拟线程 | latest | 响应式 + 同步混合 |
| **安全** | Spring Security | 6.4.x | OAuth2 / JWT |
| **协议** | Nacos Client | 3.0.3 | 服务发现/配置 |
| **可观测** | Micrometer | 1.13+ | 监控指标 |
| **测试** | JUnit 5 + Mockito + Testcontainers | latest | 单元/集成测试 |

### 3.2 前端技术栈

| 类别 | 技术 | 版本 | 依据 |
|---|---|---|---|
| **语言** | TypeScript | 5.7+ | 类型安全 |
| **框架** | **React** | **19** | 主力前端框架 |
| **构建** | Vite | 6+ | 现代化构建 |
| **UI 库** | **Ant Design** | **6.0** | 企业级组件 |
| **UI 库** | Ant Design X | 2.0 | AI 场景组件 |
| **流程** | **FlowGram.AI** | latest | 流程编排（fixed/free layout） |
| **可视化** | **AntV X6** | 2.x | 图谱/架构图 |
| **包管理** | pnpm | 10.x | monorepo |
| **状态** | Zustand / Jotai | latest | 轻量状态管理 |
| **数据获取** | TanStack Query | 5.x | 服务端状态 |
| **测试** | Vitest + Testing Library | latest | 单元测试 |
| **E2E** | Playwright | 1.49+ | 端到端测试 |

### 3.3 AI / 数据科学

| 类别 | 技术 | 版本 | 依据 |
|---|---|---|---|
| **Python** | Python | 3.10+ | AI 生态 |
| **Agent 框架** | **LangGraph** | 1.2.9+ | 多 Agent 编排 |
| **LLM 客户端** | LangChain | 1.3+ | LLM 工具调用 |
| **沙箱** | e2b-code-interpreter | 2.8+ | 云端代码沙箱 |
| **OCR** | PaddleOCR | latest | 中文 OCR |
| **PDF** | pymupdf4llm | latest | PDF 提取 |
| **解析** | markitdown | latest | 多格式 → Markdown |
| **MCP** | agent-client-protocol | 0.4+ | MCP 协议 |
| **可观测** | Langfuse / Monocle | 3.4+ | LLM 追踪 |
| **搜索** | Tavily / Exa / Firecrawl | latest | 联网搜索 |
| **IM** | lark-oapi / slack-sdk | latest | 多 IM 集成 |
| **包管理** | uv | latest | 快速 Python 包管理 |

### 3.4 基础设施

| 类别 | 技术 | 版本 | 依据 |
|---|---|---|---|
| **容器编排** | **Kubernetes** | **1.32** | 行业标准 |
| **服务网格** | **Istio** | **1.24** | mTLS / 流量管理 |
| **API 网关** | Spring Cloud Gateway | latest | Java 生态 |
| **Ingress** | Nginx Ingress / Istio Gateway | latest | K8s 入口 |
| **镜像** | Docker | 24+ | 容器化 |
| **CI/CD** | GitHub Actions / Argo CD | latest | 自动化 |
| **IaC** | Terraform / Helm | latest | 基础设施即代码 |
| **密钥** | HashiCorp Vault / K8s Secret | latest | 密钥管理 |

### 3.5 可观测性

| 类别 | 技术 | 版本 | 用途 |
|---|---|---|---|
| **链路追踪** | **OpenTelemetry** | **1.45+** | 分布式追踪 |
| **指标** | Prometheus | 3.x | 指标采集 |
| **可视化** | **Grafana** | **11.x** | 仪表盘 |
| **日志** | Loki / ELK | latest | 日志聚合 |
| **LLM 追踪** | Langfuse | 3.4+ | LLM 调用追踪 |
| **AI 追踪** | SAA Graph Observation | latest | Spring AI 追踪 |
| **告警** | Alertmanager | latest | 告警管理 |

---

## 4. 标准化组件（自研 TECH-* 模块）

Mate Platform 自研的技术服务模块，构成平台技术底座。

### 4.1 核心 TECH-* 模块清单

| 模块 | 职责 | 状态 | 关键依赖 |
|---|---|---|---|
| **TECH-GW** | API 网关、流量管理、灰度 | ✅ 已实现 | Spring Cloud Gateway, Nacos |
| **TECH-IAM** | 身份认证、租户隔离、OAuth2 | ✅ 已实现 | Spring Security, JWT |
| **TECH-AGENT** | Agent 编排、SAA Graph Core | ✅ 已实现 | Spring AI Alibaba |
| **TECH-LLMGW** | LLM 统一路由、限流、成本 | ✅ 已实现 | Spring AI, SAA |
| **TECH-MSG** | 消息基础设施（Kafka） | ✅ 已实现 | Kafka, RabbitMQ |
| **TECH-OBS** | 可观测性统一接入 | ✅ 已实现 | OpenTelemetry, Micrometer |
| **TECH-DATA** | 数据访问层、CDC | ✅ 已实现 | Spring Data, Flink |
| **TECH-ONT** | Ontology 概念/实体/属性 | ✅ 已实现 | Neo4j, OWL |
| **TECH-RAG** | RAG 引擎（含本架构的 RAG 子系统） | ✅ 部分实现 | Milvus, Neo4j, Spring AI |
| **TECH-WFE** | 工作流引擎（BPMN） | ✅ 已实现 | Flowable |
| **TECH-ACTION** | Action 引擎 | ✅ 已实现 | - |
| **TECH-RULE** | 规则引擎（Drools） | ✅ 已实现 | Drools |
| **TECH-EA** | EA 架构资产 | 🟡 部分 | Neo4j |
| **TECH-MCP** | MCP 协议 | 🟡 部分 | Nacos 3.0+ |

### 4.2 模块依赖关系

```mermaid
flowchart TB
    subgraph 基础设施
        GW[TECH-GW]
        IAM[TECH-IAM]
        OBS[TECH-OBS]
        MSG[TECH-MSG]
        LLMGW[TECH-LLMGW]
    end

    subgraph 核心服务
        ONT[TECH-ONT]
        DATA[TECH-DATA]
        RAG[TECH-RAG]
        AGENT[TECH-AGENT]
        WFE[TECH-WFE]
        ACTION[TECH-ACTION]
        RULE[TECH-RULE]
        EA[TECH-EA]
        MCP[TECH-MCP]
    end

    GW --> IAM
    GW --> OBS
    AGENT --> LLMGW
    AGENT --> RAG
    AGENT --> ONT
    AGENT --> ACTION
    AGENT --> MCP
    RAG --> ONT
    RAG --> LLMGW
    RAG --> DATA
    RAG --> OBS
    RULE --> ONT
    WFE --> ONT
    WFE --> RULE
    ACTION --> LLMGW
    EA --> ONT
    EA --> DATA
```

### 4.3 TECH-RAG 子系统内部模块（v2 架构）

| 子模块 | 职责 | 状态 |
|---|---|---|
| `tech-rag-common` | 公共 DTO / 异常 / 工具 | ✅ |
| `tech-rag-ragflow-bridge` | RAGFlow 桥接层（DeepDoc） | 🆕 新建 |
| `tech-rag-lightrag-bridge` | LightRAG 桥接层（GraphRAG） | 🆕 新建 |
| `tech-rag-knowledge-eng` | Knowledge Engineering 流水线 ⭐ | 🆕 新建 |
| `tech-rag-retrieval` | Hybrid + Graph-Enhanced | ✅ 增强 |
| `tech-rag-citation` | 多层引用 | ✅ 增强 |
| `tech-rag-router` | 统一路由 | 🆕 新建 |
| `tech-rag-app` | Spring Boot 启动器 | ✅ |
| `tech-rag-bom` | BOM | ✅ |

---

## 5. 中间件（详细配置）

### 5.1 数据库（4 个家）

| 类型 | 选型 | 版本 | 用途 | 隔离策略 |
|---|---|---|---|---|
| **关系数据库** | **PostgreSQL** | **17** | 主库 | 8 schema 隔离 |
| **图数据库** | **Neo4j** | **5.x** | Ontology + GraphRAG | 3 database 隔离 |
| **向量数据库** | **Milvus** | **2.5** | 向量检索 | 多 collection |
| **对象存储** | **MinIO** | latest | 文件存储 | bucket 隔离 |

#### 5.1.1 PostgreSQL Schema 隔离清单

| Schema | 拥有模块 | 主要表 |
|---|---|---|
| `public` | 系统 | 用户、租户等基础表 |
| `rag` | Retrieval（既有） | knowledge_base, document, chunk, search_feedback |
| `rag_parser` | RAGFlow Bridge | parsed_document, parse_task |
| `rag_bridge_ragflow` | RAGFlow Bridge | ragflow_call_log, fallback_event |
| `rag_bridge_lightrag` | LightRAG Bridge | call_log, extraction_event |
| `rag_ke` | Knowledge Engineering | extraction_task, candidate_fact, review_task, prompt_template |
| `rag_lightrag` | LightRAG Bridge | community_summary, extraction_task |
| `rag_citation` | Citation | citation |
| `rag_router` | Router | query_log |

#### 5.1.2 Neo4j Database 隔离清单

| Database | 拥有方 | 标签前缀 | 写入方 |
|---|---|---|---|
| `tech-ont` | TECH-ONT | `tech-ont.*` | TECH-ONT（受治理） |
| `lrag-graph` | LightRAG | 默认 | LightRAG 服务 |
| `rag-graphrag` | GraphRAG（备用） | `rag_*` | 自研（未来） |

### 5.2 消息与缓存

| 类型 | 选型 | 版本 | 用途 | 规模预估 |
|---|---|---|---|---|
| **消息队列** | **Apache Kafka** | **3.9** | 事件流、跨模块通信 | 3 节点起 |
| **消息队列**（备） | RabbitMQ | 4.x | 任务队列 | 单节点 |
| **缓存** | **Redis** / Valkey | **7.4 / 8** | 缓存、分布式锁、Stream | 3 节点集群 |
| **缓存** | Caffeine（本地） | latest | JVM 内缓存 | - |

### 5.3 服务发现与配置

| 类别 | 选型 | 版本 | 用途 |
|---|---|---|---|
| **注册中心** | **Nacos** | **3.0.1+** | 服务发现 + 配置 + MCP/A2A 注册 |
| **配置** | Nacos Config | 3.0.1+ | 动态配置 |
| **服务发现** | Nacos Discovery | 3.0.1+ | 服务注册/发现 |
| **协议注册** | Nacos MCP | 3.0.1+ | MCP Server 注册 |
| **Agent 协议** | Nacos A2A | 3.0.1+ | A2A Agent 注册 |

### 5.4 容器与服务网格

| 类别 | 选型 | 版本 | 用途 |
|---|---|---|---|
| **容器运行时** | containerd | 1.7+ | K8s 容器引擎 |
| **容器引擎** | Docker | 24+ | 本地开发 |
| **服务网格** | **Istio** | **1.24** | mTLS、流量管理、可观测 |
| **Ingress** | Istio Gateway | 1.24 | K8s 入口 |
| **Sidecar** | Istio Proxy | 1.24 | Envoy |

### 5.5 数据 ETL 与湖仓

| 类别 | 选型 | 版本 | 用途 |
|---|---|---|---|
| **实时计算** | Apache Flink | 1.20 | 流处理 |
| **批量调度** | Apache Airflow | 2.10 | 任务调度 |
| **数据转换** | DBT | 1.9 | SQL 转换 |
| **数据湖** | Apache Hudi（主） | 1.x | 增量湖 |
| **数据湖**（备） | Apache Iceberg | 1.8 | 湖格式 |
| **OLAP** | StarRocks | 3.4 / 4.0 | 实时 OLAP |

---

## 6. 成熟的开源平台

### 6.1 RAGFlow（v2 决策下集成）

| 维度 | 详情 |
|---|---|
| **项目** | RAGFlow |
| **GitHub** | `infiniflow/ragflow` |
| **协议** | AGPL-3.0（自评估通过） |
| **版本** | v0.13.0+ |
| **用途** | **DeepDoc 文档解析**（仅此一项） |
| **不**用 | 它的 RAG 检索、UI、配置系统 |
| **引入方式** | 服务级调用（不修改源码） |
| **部署** | Docker / K8s（ClusterIP） |
| **集成路径** | `tech-rag-ragflow-bridge` |

### 6.2 LightRAG（v2 决策下集成）

| 维度 | 详情 |
|---|---|
| **项目** | LightRAG |
| **GitHub** | `HKUDS/LightRAG` |
| **协议** | **MIT**（极简） |
| **版本** | latest |
| **用途** | GraphRAG 检索（4 模式）+ 实体抽取 |
| **优势** | HKU 团队、生产级、内存优化、多厂商 LLM |
| **集成路径** | `tech-rag-lightrag-bridge` |

### 6.3 DeerFlow（既有集成）

| 维度 | 详情 |
|---|---|
| **项目** | DeerFlow |
| **GitHub** | `bytedance/deer-flow` |
| **协议** | MIT |
| **版本** | 2.1.0 |
| **用途** | Agent Runtime（Sub-Agents / Sandbox / Skills） |
| **集成路径** | `TECH-AGENT` 内的 DeerFlowAdapter |
| **技术栈** | Python 3.12 / LangGraph 1.2.9 / FastAPI / Next.js 16 |

### 6.4 Spring AI Alibaba（SAA 1.1.2.0）

| 维度 | 详情 |
|---|---|
| **项目** | Spring AI Alibaba |
| **GitHub** | `alibaba/spring-ai-alibaba` |
| **协议** | Apache 2.0 |
| **版本** | 1.1.2.0 |
| **用途** | **Java AI 编排统一底座**（BOM） |
| **关键能力** | Graph / Nacos MCP / A2A / Prompt / Tool / RAG |

### 6.5 其他关键开源组件

| 组件 | 协议 | 用途 |
|---|---|---|
| **Apache Tika** | Apache 2.0 | 多格式文档解析（基础层） |
| **Apache PDFBox** | Apache 2.0 | PDF 处理 |
| **Apache POI** | Apache 2.0 | Office 文档（PPTX/DOCX/XLSX） |
| **JGraphT** | LGPL 2.1 + EPL | 图算法（Leiden/Louvain 备选） |
| **PaddleOCR** | Apache 2.0 | 中文 OCR（模型权重） |
| **onnxruntime-java** | MIT | ONNX 模型推理 |
| **FlowGram.AI** | Apache 2.0 | 流程编排（fixed/free layout） |
| **AntV X6** | MIT | 图谱/架构图可视化 |
| **LangGraph** | MIT | Python 多 Agent 编排（DeerFlow 用） |
| **Drools** | Apache 2.0 | 规则引擎（TECH-RULE） |
| **Flowable** | Apache 2.0 | 工作流引擎（TECH-WFE） |

### 6.6 选型决策原则

| 原则 | 说明 |
|---|---|
| **优先成熟** | 选有大规模生产案例的 |
| **优先 Apache 2.0 / MIT** | 协议友好，零法律风险 |
| **避开 AGPL 强传染** | 服务级集成时**必须**自评估 |
| **避开 SSPL / 商业** | 不锁定 |
| **活跃度** | 近 6 个月有 commit |
| **社区支持** | 有官方文档、Discord/Slack |

---

## 7. 模块架构

### 7.1 应用模块（APP-*）

| 模块 | 职责 |
|---|---|
| **APP-DASHBOARD** | 个人工作台 |
| **APP-COPILOT** | 智能助手 |
| **APP-DW** | 数字员工 |
| **APP-ARCH** | 架构中心 |
| **APP-KB** | 知识库 |
| **APP-APPHUB** | 应用中心 |
| **APP-ONTSTUDIO** | 本体建模 |
| **APP-MCPHUB** | MCP Server 中心 |
| **APP-METAFLOW** | 流程编排 |
| **APP-SUPERAI** | 超级 AI |

### 7.2 APP → TECH 依赖矩阵

| APP → | IAM | GW | AGENT | RAG | ONT | LLMGW | MSG | OBS | DATA | WFE | ACTION | RULE | EA | MCP |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| APP-DASHBOARD | ✅ | ✅ | - | - | - | - | ✅ | ✅ | - | - | - | - | - | - |
| APP-COPILOT | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | - | - | - | - | - |
| APP-DW | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | - | ✅ | - | - | - |
| APP-ARCH | ✅ | ✅ | - | - | ✅ | - | ✅ | ✅ | ✅ | - | - | - | ✅ | - |
| APP-KB | ✅ | ✅ | - | ✅ | - | - | ✅ | ✅ | - | - | - | - | - | - |
| APP-APPHUB | ✅ | ✅ | ✅ | - | ✅ | - | ✅ | ✅ | - | ✅ | ✅ | ✅ | - | - |
| APP-ONTSTUDIO | ✅ | ✅ | - | - | ✅ | - | ✅ | ✅ | ✅ | - | ✅ | ✅ | - | - |
| APP-MCPHUB | ✅ | ✅ | - | - | ✅ | - | - | ✅ | - | - | - | - | - | ✅ |
| APP-METAFLOW | ✅ | ✅ | - | - | - | - | ✅ | ✅ | - | ✅ | - | - | - | - |
| APP-SUPERAI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | - | - | - | - | - |

### 7.3 系统整体视图

```mermaid
flowchart TB
    subgraph 用户层
        U1[终端用户]
        U2[企业架构师]
        U3[数字员工开发者]
    end

    subgraph 接入层
        FE[React 19 前端<br/>Ant Design 6.0]
    end

    subgraph 网关层
        GW[TECH-GW<br/>API Gateway]
    end

    subgraph 应用层[应用层 - APP-*]
        APP1[APP-DASHBOARD]
        APP2[APP-COPILOT]
        APP3[APP-DW]
        APP4[APP-ARCH]
        APP5[APP-KB]
        APP6[APP-APPHUB]
        APP7[APP-ONTSTUDIO]
        APP8[APP-MCPHUB]
        APP9[APP-METAFLOW]
        APP10[APP-SUPERAI]
    end

    subgraph 技术服务层[技术服务层 - TECH-*]
        AGENT[TECH-AGENT<br/>+ DeerFlow]
        RAG[TECH-RAG<br/>+ RAGFlow + LightRAG]
        ONT[TECH-ONT]
        LLMGW[TECH-LLMGW]
        ACTION[TECH-ACTION]
        WFE[TECH-WFE]
        RULE[TECH-RULE]
        EA[TECH-EA]
        MCP[TECH-MCP]
        DATA[TECH-DATA]
    end

    subgraph AI子域[AI 子域]
        DEERFLOW[DeerFlow 2.1]
        RAGFLOW[RAGFlow]
        LIGHTRAG[LightRAG]
    end

    subgraph 基础设施层
        IAM[TECH-IAM]
        OBS[TECH-OBS]
        MSG[TECH-MSG]
        NACOS[Nacos 3.0+]
    end

    subgraph 数据层
        PG[(PostgreSQL 17)]
        NEO4J[(Neo4j 5.x)]
        MILVUS[(Milvus 2.5)]
        MINIO[(MinIO)]
        REDIS[(Redis 7.4)]
        KAFKA[(Kafka 3.9)]
    end

    U1 --> FE
    U2 --> FE
    U3 --> FE
    FE --> GW
    GW --> APP1
    GW --> APP2
    GW --> APP3
    GW --> APP4
    GW --> APP5
    GW --> APP6
    GW --> APP7
    GW --> APP8
    GW --> APP9
    GW --> APP10

    APP2 --> AGENT
    APP3 --> AGENT
    APP2 --> RAG
    APP3 --> RAG
    APP5 --> RAG
    APP4 --> EA
    APP4 --> ONT
    APP7 --> ONT
    APP7 --> ACTION
    APP6 --> WFE
    APP6 --> ACTION
    APP10 --> AGENT
    APP10 --> RAG
    APP8 --> MCP

    AGENT --> LLMGW
    RAG --> LLMGW
    RAG --> ONT
    AGENT --> ONT
    AGENT --> ACTION
    AGENT --> DEERFLOW
    RAG --> RAGFLOW
    RAG --> LIGHTRAG
    EA --> ONT
    EA --> DATA

    GW --> IAM
    AGENT --> OBS
    RAG --> OBS
    ONT --> NACOS
    LLMGW --> NACOS

    RAGFLOW --> MINIO
    RAGFLOW --> LLMGW
    LIGHTRAG --> LLMGW
    LIGHTRAG --> NEO4J
    LIGHTRAG --> MILVUS
    ONT --> NEO4J
    RAG --> MILVUS
    RAG --> PG
    AGENT --> PG
    OBS --> PG
    MSG --> KAFKA
    AGENT --> KAFKA
    RAG --> KAFKA

    style DEERFLOW fill:#e1f5ff
    style RAGFLOW fill:#e1f5ff
    style LIGHTRAG fill:#e1f5ff
    style RAG fill:#fff4e1
    style ONT fill:#e1ffe1
```

---

## 8. 数据架构（4 个家 + 3 个工具）

### 8.1 数据归属总表

| 数据 | 存储 | Schema/Collection/Database | 拥有模块 |
|---|---|---|---|
| 原始文件 | MinIO | `kb-{tenantId}/{kbId}/raw/{docId}.{ext}` | RAGFlow Bridge |
| ParsedDocument | PostgreSQL | `rag_parser.*` | RAGFlow Bridge |
| Chunk | PostgreSQL | `rag.*` | Retrieval |
| Chunk Embedding | Milvus | `rag_chunk_vec` | Retrieval |
| LightRAG 实体/关系/社区 | Neo4j | `lrag-graph` | LightRAG |
| LightRAG 摘要 | PostgreSQL | `rag_lightrag.*` | LightRAG Bridge |
| Candidate Fact | PostgreSQL | `rag_ke.*` | KE |
| Review Task | PostgreSQL | `rag_ke.*` | KE |
| Prompt Template | PostgreSQL | `rag_ke.*` | KE |
| **Ontology Concept/Relation** | Neo4j | `tech-ont` | **TECH-ONT**（受治理） |
| Citation | PostgreSQL | `rag_citation.*` | Citation |
| Query Log | PostgreSQL | `rag_router.*` | Router |
| 调用日志 | PostgreSQL | `rag_bridge_*` | Bridges |
| 缓存 | Redis | `rag:*` | 各模块 |
| 事件 | Kafka | `rag.*.v1` | 各模块 |
| 可观测性 | TECH-OBS | - | 全模块 |

### 8.2 数据生命周期

| 数据 | 保留期 | 删除策略 |
|---|---|---|
| 原始文件 | 永久 | 软删 + 30 天回收 |
| ParsedDocument | 永久 | 跟随文档 |
| Chunk + Embedding | 永久 | 跟随文档重建 |
| Candidate Fact (PENDING) | 30 天 | 超期自动清理 |
| Candidate Fact (REJECTED) | 90 天 | 用于 Prompt 优化 |
| Prompt 模板 | 永久 | 只追加 |
| Ontology | 永久 | 版本化 |
| Query Log | 90 天 | 热-温-冷分层 |
| 监控数据 | 13 个月 | Prometheus 规则 |

### 8.3 备份策略

| 数据 | 备份方式 | RPO | RTO |
|---|---|---|---|
| PostgreSQL | 每日全量 + WAL 归档 | 5 分钟 | 1 小时 |
| Neo4j | 每日全量 + 在线备份 | 1 小时 | 4 小时 |
| Milvus | 每日全量 | 24 小时 | 4 小时 |
| MinIO | 跨区域复制 | 0 | 1 小时 |
| Redis | AOF | 1 秒 | 1 分钟 |
| Kafka | 3 副本 | 0 | 实时 |

---

## 9. RAG 子系统架构（重点章节）

### 9.1 整体架构

```mermaid
flowchart TB
    subgraph S1[场景 1: 知识库建立]
        A1[PPT/Word/PDF/Excel] --> A2[RAGFlow<br/>DeepDoc 解析]
        A2 --> A3[ParsedDocument<br/>PG rag_parser]
        A3 --> A4[Chunking]
        A4 --> A5[Chunk + Embedding<br/>PG + Milvus]
    end

    subgraph S2[场景 2: Ontology 抽象 ⭐]
        B1[Chunk] --> B2[LightRAG<br/>自动抽实体-关系]
        B2 --> B3[Candidate Fact<br/>PG rag_ke]
        B3 --> B4[人工审核]
        B4 -->|通过| B5[Ontology Commit<br/>via TECH-ONT]
        B5 --> B6[Neo4j tech-ont<br/>受治理本体]
    end

    subgraph S3[场景 3: 知识问答]
        C1[用户问题] --> C2[Router AUTO]
        C2 -->|事实| C3[Hybrid]
        C2 -->|实体| C4[Graph-Enhanced]
        C2 -->|主题| C5[LightRAG]
        C3 --> C6[答案 + 引用]
        C4 --> C6
        C5 --> C6
    end

    A5 --> B1
    B6 --> C4
    A5 --> C3

    style S2 fill:#fff4e1,stroke:#ff9900,stroke-width:2px
```

### 9.2 RAG 子系统 6 大模块

| 模块 | 职责 | Maven 坐标 | 状态 |
|---|---|---|---|
| **A. RAGFlow Bridge** | DeepDoc 解析 | `tech-rag-ragflow-bridge` | 🆕 |
| **B. LightRAG Bridge** | GraphRAG 检索 | `tech-rag-lightrag-bridge` | 🆕 |
| **C. Knowledge Engineering** | 抽取 + 审核 + 提交 | `tech-rag-knowledge-eng` | 🆕 ⭐ |
| **D. Retrieval** | Hybrid + Graph-Enhanced | `tech-rag-retrieval` | ✅ |
| **E. Citation** | 多层引用 | `tech-rag-citation` | ✅ |
| **F. Router** | 统一入口 | `tech-rag-router` | 🆕 |

### 9.3 RAG 子系统数据流（闭环）

```
[文档上传]
    ↓
[RAGFlow 解析] → ParsedDocument
    ↓
[Chunking] → Chunk + Embedding
    ↓
[LightRAG 自动抽实体-关系] → 事件
    ↓
[KE 转 Candidate Fact] → 待审核
    ↓
[人工审核] → 通过 / 拒绝
    ↓
[TECH-ONT API 提交] → Ontology 更新
    ↓
[Graph-Enhanced 检索] ← 用最新 Ontology
    ↓
[用户查询] → Router AUTO
    ↓
[Hybrid / GE / LightRAG] → 答案 + 引用
```

### 9.4 RAG 子系统 API 顶层

| 路径 | 方法 | 模块 | 说明 |
|---|---|---|---|
| `/api/v1/rag/parser/*` | POST/GET | A | 文档解析 |
| `/api/v1/rag/lightrag/*` | POST/GET | B | GraphRAG 检索 |
| `/api/v1/rag/ke/*` | POST/GET | C | 抽取/审核/提交 |
| `/api/v1/rag/retrieve/*` | POST | D | Hybrid/GE |
| `/api/v1/rag/citation/*` | POST/GET | E | 引用 |
| `/api/v1/rag/retrieve` | POST | F | 统一入口 |

### 9.5 RAG 子系统事件协议

| 主题 | 发布方 | 订阅方 |
|---|---|---|
| `rag.parser.document.parsed.v1` | A | C, D |
| `rag.parser.document.parse-failed.v1` | A | C |
| `rag.lightrag.entity.extracted.v1` | B | **C** ⭐ |
| `rag.lightrag.community.built.v1` | B | F |
| `rag.ke.candidate.created.v1` | C | UI |
| `rag.ke.ontology.committed.v1` | C | D, B, F ⭐ |
| `rag.ke.prompt.activated.v1` | C | D |
| `rag.retrieval.index.rebuilt.v1` | D | F |
| `rag.router.query.completed.v1` | F | OBS |

---

## 10. 安全与合规

### 10.1 安全原则

| 维度 | 措施 |
|---|---|
| **认证** | OAuth2 / JWT，SSO（OIDC / SAML） |
| **授权** | RBAC + ABAC，最小权限 |
| **传输** | TLS 1.3，mTLS（服务间） |
| **存储** | 静态加密（AES-256） |
| **密钥** | HashiCorp Vault / K8s Secret |
| **审计** | 全部 API 调用审计日志 |
| **数据脱敏** | PII 自动脱敏，日志脱敏 |

### 10.2 租户隔离

| 维度 | 隔离方式 |
|---|---|
| **数据库** | Row-Level Security（RLS） |
| **向量** | Collection 命名空间 + Filter |
| **图** | Multi-Database / Label 前缀 |
| **对象存储** | Bucket 路径隔离 |
| **缓存** | Key 前缀 |

### 10.3 数据保护

| 维度 | 措施 |
|---|---|
| **静态加密** | AES-256（DB / MinIO） |
| **传输加密** | TLS 1.3 |
| **密钥管理** | Vault 集中管理 |
| **数据脱敏** | PII 自动识别 + 脱敏 |
| **备份加密** | 备份文件加密 |
| **删除** | 软删除 + 30 天回收 + 物理擦除 |

### 10.4 合规自评估

| 组件 | 协议 | 风险 | 措施 |
|---|---|---|---|
| RAGFlow | AGPL-3.0 | 🟡 中 | 服务级使用 + 保留 LICENSE + 不修改源码 + 应急方案 |
| LightRAG | MIT | 🟢 极低 | 保留 LICENSE + 致谢 |
| Spring AI Alibaba | Apache 2.0 | 🟢 | 无 |
| Apache 系列 | Apache 2.0 | 🟢 | 无 |
| JGraphT | LGPL 2.1 + EPL | 🟢 | 动态链接 |
| PaddleOCR | Apache 2.0 | 🟢 | 无 |
| Neo4j 社区版 | GPL v3 | 🟢 | 独立进程，不传染 |
| 商业化前 | 必重评估 | - | 找真律师 |

**应急方案**：若被要求开源，6-8 周可切换 RAGFlow 到 Java 重写 DeepDoc，LightRAG 保留（MIT 不受影响）。

---

## 11. 可观测性

### 11.1 三大支柱

| 维度 | 工具 | 用途 |
|---|---|---|
| **Metrics** | Prometheus + Grafana | 数值指标 |
| **Logs** | Loki / ELK | 日志聚合 |
| **Traces** | OpenTelemetry + Jaeger | 链路追踪 |

### 11.2 关键指标

| 类别 | 指标 | 目标 |
|---|---|---|
| **可用性** | SLO（月度） | ≥ 99.5% |
| **响应** | P95 延迟 | 按模块 |
| **吞吐** | QPS | 按模块 |
| **错误率** | 5xx 占比 | < 0.1% |
| **资源** | CPU / 内存 / 磁盘 | < 80% |
| **LLM** | Token / 调用 / 成本 | 按日统计 |

### 11.3 告警分级

| 等级 | 触发条件 | 响应 |
|---|---|---|
| **P0** | 服务不可用 | 立即 |
| **P1** | SLO 违反 | 1 小时内 |
| **P2** | 资源接近上限 | 4 小时内 |
| **P3** | 趋势异常 | 工作时间 |
| **P4** | 提示 | 下个工作日 |

### 11.4 业务监控（LLM 专项）

| 指标 | 说明 |
|---|---|
| LLM 调用次数 | 按模型/租户/场景 |
| LLM Token 消耗 | 按日/周/月 |
| LLM 成本 | 按租户/场景 |
| LLM P95 延迟 | 按模型 |
| LLM 错误率 | 按错误码 |
| 抽取 F1 / Recall | 离线评估 |
| 用户反馈（赞/踩） | UI 反馈 |

---

## 12. 性能与扩展

### 12.1 性能基线

| 服务 | P95 延迟目标 | 备注 |
|---|---|---|
| TECH-GW | ≤ 50ms | 网关开销 |
| TECH-IAM | ≤ 100ms | 鉴权开销 |
| TECH-RAG Hybrid | ≤ 1s | 检索 |
| TECH-RAG LightRAG | ≤ 3s | GraphRAG |
| RAGFlow 解析（1MB PDF） | ≤ 3s | DeepDoc |
| LightRAG 索引（1MB） | ≤ 60s | 全量 |
| Router AUTO 分类 | ≤ 200ms | cheap LLM |
| KE 抽取（单文档） | ≤ 30s | LLM |
| TECH-LLMGW | ≤ 2s | LLM 路由 |

### 12.2 扩展策略

| 维度 | 策略 |
|---|---|
| **水平扩展** | K8s HPA（CPU > 70% 自动扩容） |
| **垂直扩展** | 资源 limits 调整 |
| **读写分离** | PG 主从 / Neo4j 集群 / Milvus 集群 |
| **缓存** | Redis 多级 + 本地 Caffeine |
| **限流** | Sentinel / Spring Cloud Gateway |
| **降级** | 熔断 + fallback |
| **异步** | Kafka 异步处理 |

### 12.3 限流策略

| 维度 | 限制 |
|---|---|
| **租户级** | 100 QPS（可配置） |
| **用户级** | 10 QPS |
| **LLM** | 按模型/租户配额 |
| **存储** | 单租户 100GB 文档 |

---

## 13. 部署架构

### 13.1 环境规划

| 环境 | 用途 | 部署位置 |
|---|---|---|
| **dev** | 开发联调 | 本地 Docker Compose |
| **test** | 测试 | K8s 测试集群 |
| **staging** | 预发 | K8s 预发集群 |
| **prod** | 生产 | K8s 生产集群（多 region） |

### 13.2 K8s 命名空间

| Namespace | 包含服务 |
|---|---|
| `mate-tech` | TECH-* 全套 Java 服务 |
| `mate-ai` | RAGFlow, LightRAG |
| `mate-deerflow` | DeerFlow |
| `mate-frontend` | 前端应用 |
| `mate-monitor` | 监控、告警 |
| `mate-infra` | 基础设施（中间件） |

### 13.3 CI/CD 流水线

```mermaid
flowchart LR
    A[代码提交] --> B[单元测试]
    B --> C[代码扫描]
    C --> D[构建镜像]
    D --> E[推镜像仓库]
    E --> F[Dev 部署]
    F --> G[集成测试]
    G --> H[Test 部署]
    H --> I[Staging 部署]
    I --> J[人工审批]
    J --> K[Prod 灰度]
    K --> L[全量发布]
```

### 13.4 灰度策略

| 阶段 | 灰度维度 | 方式 |
|---|---|---|
| Canary | 5% 流量 | Istio 流量切分 |
| Tenant | 按租户 | Feature Flag |
| KB | 按知识库 | Feature Flag |
| 全量 | 100% | - |

---

## 14. 风险与缓解

| ID | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | RAGFlow AGPL-3.0 商业化风险 | 🟡 | 自评估 + 应急方案 + 商业化前重评 |
| R2 | RAGFlow/LightRAG 不可用 | 🟡 | 降级到自研（Tika / Graph-Enhanced） |
| R3 | LightRAG 抽取噪声 | 🟡 | 置信度过滤 + 人工审核 |
| R4 | 跨语言调试困难 | 🟡 | v2 决策：AI 协作 |
| R5 | LLM Token 成本爆炸 | 🟡 | 摘要用 qwen-turbo + 限社区数 + 缓存 |
| R6 | 模块独立发版数据不一致 | 🟡 | 事件 schema 严格版本化 |
| R7 | Neo4j 多库管理复杂 | 🟢 | 文档 + 监控 |
| R8 | KE 事件丢失 | 🟡 | 至少一次 + 监控 + 定期全量重抽 |
| R9 | 商业化时协议问题 | 🟡 | 商业化前重新评估 |
| R10 | v2 决策需回退 | 🟢 | v1.3 退路已设计 |

---

## 15. 实施路线图

### 15.1 阶段路线

| 阶段 | 内容 | 工期 | 关键里程碑 |
|---|---|---|---|
| **P0** | 自评估法务 + 基础准备 | 1 周 | 法务签字 + Neo4j lrag-graph 准备 |
| **P1-A** | RAGFlow Bridge | 2 周 | 第一个文档解析走 RAGFlow |
| **P1-B** | LightRAG Bridge | 2 周 | 第一次主题查询走 LightRAG |
| **P2-A** | KE 流水线 | 2 周 | 第一个 Candidate → Ontology |
| **P2-B** | Retrieval Router | 1.5 周 | 统一入口上线 |
| **P3** | 评估 + 调优 | 持续 | 全场景验证 |
| **P4** | 灰度 + 生产化 | 2 周 | 正式生产 |

**总工期**：约 10-12 周

### 15.2 独立发版原则

- 每个 Maven 模块可独立 jar
- 每个模块可独立 K8s 部署
- 跨模块不绑版本
- DB 变更用 Flyway 向前兼容

---

## 16. 决策记录

| 字段 | 值 |
|---|---|
| 架构名称 | Mate Platform 完整技术架构 |
| 版本 | v2.0 |
| 决策日期 | 2026-07-27 |
| 决策人 | 项目 Owner |
| 上层决策 | v2 技术栈决策 |
| 合规方式 | 自评估 + 商业化前重评估 |
| 受众 | 项目 Owner、研发团队、未来成员 |

---

## 17. 关联文档

### 17.1 归档历史文档

以下 6 份历史文档已**归档到 `docs/superpowers/specs/archive/`**（**不再更新**），保留供决策追溯：

| 归档文档 | 原用途 | 当前内容已并入主架构的章节 |
|---|---|---|
| `archive/2026-07-27-mate-platform-rag-architecture.md` | RAG 子系统主架构（v1 整合） | §9 RAG 子系统架构 |
| `archive/2026-07-27-v2-tech-stack-decision.md` | v2 技术栈决策 | §1 架构原则 |
| `archive/2026-07-27-ragflow-graphrag-integration-a.md` | A 方案整体方向 | §6.1 RAGFlow, §9.1 数据流 |
| `archive/2026-07-27-lightrag-integration.md` | LightRAG 详细集成 | §6.2 LightRAG, §9.2 数据流 |
| `archive/2026-07-27-rag-graphrag-best-solution.md` | v1 GraphRAG 方案 | 🗑️ 已废止（仅作决策历史） |
| `archive/2026-07-27-platform-rag-technical-architecture.md` | v1 全 Java 架构 | 🗑️ 已废止（v2 决策推翻） |

### 17.2 保留在其他位置的相关文档

| 文档 | 位置 | 状态 |
|---|---|---|
| `LEGAL_CLEARANCE-ragflow-2026-07-27.md` | `docs/legal/` | ⚠️ 内容已并入 §10.4，原文保留作合规追溯 |
| `SPEC-TECH-RAG-RAG引擎API规范_v1.0-20260716.md` | `TECH-RAG/docs/` | ⚠️ 已被本文档 §9.4 / §5 API 取代 |
| `2026-07-27-openviking-future-architecture-candidate.md` | 同目录 | ✅ 不同主题（OpenViking 集成候选），保留 |

### 17.3 未来更新原则

- 修改本文档时，**直接编辑本文件**（`2026-07-27-mate-platform-technical-architecture.md`）
- 重大变更（如技术栈变动）需要在 §16 决策记录追加条目 + 项目 Owner 签字
- 本目录的 `archive/` 不再更新，仅供历史追溯

---

## 附录 A：版本历史

| 版本 | 日期 | 主要变更 |
|---|---|---|
| v1.0 | 2026-07-22 | 既有 RAG 引擎 API 规范（`SPEC-TECH-RAG-RAG引擎API规范_v1.0`） |
| v1.5 | 2026-07-26 | DeerFlow 集成（既有） |
| **v2.0** | **2026-07-27** | **整合 v2 决策 + RAGFlow + LightRAG + KE 流水线 + 完整技术栈** |

---

## 附录 B：使用指南

### 日常 reference

> **当你想了解平台整体架构**：直接看 §0, §1, §3, §7
> **当你想了解 RAG 子系统**：看 §9
> **当你想了解部署**：看 §13
> **当你想了解 KPI / 风险**：看 §11, §14
> **当你想了解合规**：看 §10.4

### 新人 onboarding

1. 先读 §0（TL;DR）建立全局感
2. 读 §1（架构原则）
3. 读 §3（技术栈）
4. 按需读 §4-§7（模块）
5. 读 §9（RAG 子系统，核心差异化）
6. 读 §13（部署）

### 决策 review

- 修改本文档时，**必须**先在 §16 决策记录追加条目
- 重大变更（如技术栈变动）需要 Owner 签字