# §1 九层架构详解

> **目标**：在 spec v1.2 顶层架构的基础上，对每一层给出具体技术选型、数据流、接口契约和性能基线。
> **对应 spec**：v1.2 §5 顶层架构总览
> **状态**：v1.0 草稿

---

## §1.1 九层架构总图

```
┌─────────────────────────────────────────────────────────────────┐
│ L1-1  User / AI 对话层            │ 自然语言 / 多模态 / 拖拽 / 协同 │
├─────────────────────────────────────────────────────────────────┤
│ L1-2  应用 / 场景市场 (G4)         │ 行业模板 / 应用市场（v0.2 起步）│
├─────────────────────────────────────────────────────────────────┤
│ L1-3  页面 / 表单生成器 (G1)       │ Schema 驱动 UI / 拖拽 / NL 页面 │
├─────────────────────────────────────────────────────────────────┤
│ L1-4  流程自动化 (G4)              │ BPMN / 触发器 / AI 节点 / SLA  │
├─────────────────────────────────────────────────────────────────┤
│ L2-1  业务对象层 (G2)              │ 业务对象 / 字段 / 规则 / 视图   │
├─────────────────────────────────────────────────────────────────┤
│ L2-2  本体引擎 + 知识图谱          │ 实体/属性/关系 + Neo4j + 推理    │
├─────────────────────────────────────────────────────────────────┤
│ L2-3  数据/知识统一层              │ RAG + 非结构 + MDM + 湖 + 仓     │
├─────────────────────────────────────────────────────────────────┤
│ L3-1  AI Substrate (基质)          │ LLM/Embedding/Vector/Agent     │
├─────────────────────────────────────────────────────────────────┤
│ L3-2  能力库 (G3)                  │ 邮件/短信/OCR/翻译/...          │
├─────────────────────────────────────────────────────────────────┤
│ L3-3  平台底座                      │ 多租户/权限/审计/Integration  │
├─────────────────────────────────────────────────────────────────┤
│ L3-4  存储 / 基础设施               │ PG/Neo4j/Milvus/MinIO/Kafka   │
├─────────────────────────────────────────────────────────────────┤
│ L3-5  部署 / 交付                   │ K8s + Helm + 多云 + 信创       │
└─────────────────────────────────────────────────────────────────┘
```

> **AI Substrate 是"基质"**（v2 修正），不是单独一层 —— 它渗透在 L1-1 / L1-3 / L1-4 / L2-1 / L2-2 / L2-3 每一层中。
> **本图与 spec v1.2 §5 略有差异**：把 L3-2 移到 L3 区域以强调"能力库是平台底座一部分"，与 AI Substrate 并列。spec v1.2 中 L3-2 在 L2-1 之下，是 v1.0 时期的排法。**这条修正需要 spec v1.2 → v1.3 升级时采纳。**

---

## §1.2 9 层选型速览表

| 层 | 组件 | 选型 | 替代方案 | 主要风险 |
|---|---|---|---|---|
| **L1-1** | 对话前端 | React 18 + TypeScript 5 + Ant Design 5 | Vue 3 + Element Plus | 性能 / 体验平衡 |
| L1-1 | 拖拽 / 多模态 | React DnD + Tldraw + Tauri | Excalidraw / Figma SDK | 复杂交互性能 |
| L1-1 | NL 解析器 | LangChain 0.3 (Python) | LlamaIndex / Haystack | 大模型路由 |
| **L1-2** | 应用市场 | 自研 + 包管理器（Helm 模板） | Backstage | 模板分发链 |
| **L1-3** | 页面生成器 | Formily 2 / Amis / React 18 | 低代码平台自研 | 性能 / 灵活性 |
| L1-3 | 权限投影 | Casbin / OPA | ABAC 自研 | 规则表达力 |
| **L1-4** | BPMN 引擎 | Flowable 7 / Camunda 8 | Activiti / 自研 | 分布式事务 |
| L1-4 | 流程 AI 节点 | LangGraph | 自研 FSM | 状态爆炸 |
| **L2-1** | 业务对象建模器 | 自研（前端） + GraphQL 后端 | Hasura / Prisma | 复杂规则引擎 |
| L2-1 | 业务规则引擎 | Drools 8 / Aviator 5 (Java) | OpenL Tablets / Easy Rules | 规则版本化 |
| **L2-2** | 本体引擎 | **Java 21 + Spring Boot 3 + Neo4j 5** | TypeDB / TigerGraph | Cypher 复杂度 |
| L2-2 | 推理引擎 | Neo4j Reasoning + OWL 适配 | Apache Jena / Stardog | 推理性能 |
| L2-2 | 事件总线 | **Apache Kafka 3.6** | NATS JetStream / Pulsar | Kafka 运维 |
| L2-2 | 版本快照 | **PostgreSQL 16** + Flyway | 自研时序 | 快照粒度 |
| **L2-3** | RAG 知识库 | **Milvus 2.4 + 全文 + BGE-M3** | Weaviate / Qdrant | 召回质量 |
| L2-3 | 非结构化 | **MinIO + 自研版本** | HDFS / S3 | 协作性能 |
| L2-3 | MDM 黄金记录 | **PostgreSQL + 自研匹配** | Informatica / Ataccama | 匹配规则 |
| L2-3 | 数据湖 | **Apache Hudi 0.13 + MinIO** | Iceberg / Delta | 写入性能 |
| L2-3 | 数据仓库 | **Apache Doris 2.0** | ClickHouse / StarRocks | 生态成熟度 |
| L2-3 | ClickHouse 适配 | ClickHouse 24 + JDBC | Trino / Dremio | 方言转换 |
| L2-3 | 元数据 | **PostgreSQL 16 + pgcat** | Apache Atlas / DataHub | 元数据模型 |
| L2-3 | 数据质量 | Great Expectations | Deequ / 自研 | 规则覆盖率 |
| **L3-1** | LLM Gateway | **自研（Go）+ LiteLLM** | Portkey / OpenRouter | 多模型路由 |
| L3-1 | Embedding | BGE-M3 / m3e-large / OpenAI | Jina / Cohere | 多语言支持 |
| L3-1 | Vector Adapter | **Milvus 2.4** | pgvector / Pinecone | 召回延迟 |
| L3-1 | Agent Runtime | **LangGraph 0.2 (Python)** | CrewAI / AutoGen | 调试能力 |
| L3-1 | Context Store | Redis 7 + PostgreSQL | ScyllaDB / 自研 | 大上下文压缩 |
| L3-1 | 模型训练（v2） | PyTorch + LLaMA Factory | HuggingFace TRL | 训练成本 |
| **L3-2** | 能力库 | 自研（Go + Wasm 沙箱）| Temporal / Step Functions | 沙箱隔离 |
| L3-2 | 邮件 / 短信 | 自研 + 第三方 API | SendGrid / 阿里云 | 送达率 |
| L3-2 | OCR | PaddleOCR + 自研 | Tesseract / 云 API | 准确率 |
| L3-2 | 翻译 | 阿里云 / DeepL | 自研 LLM | 成本 |
| **L3-3** | 多租户 | 自研 + PostgreSQL Row-Level Security | Citus / 自研 | 性能损耗 |
| L3-3 | 权限中心 | Casbin + Keycloak | Ory / Auth0 | 集成复杂度 |
| L3-3 | 审计 | 自研 + ClickHouse | ELK / Loki | 写入吞吐 |
| L3-3 | Integration Hub | Apache NiFi 2 / Airbyte | Temporal | 连接器数量 |
| L3-3 | API 网关 | Kong / APISIX | Envoy / Nginx | 路由策略 |
| L3-3 | 认证 | Keycloak / Ory Hydra | Auth0 / 阿里云 IDaaS | SSO 集成 |
| **L3-4** | 关系数据库 | **PostgreSQL 16 + Citus** | MySQL 8 / Oracle | 分布式事务 |
| L3-4 | 图数据库 | **Neo4j 5** | TypeDB / NebulaGraph | 集群规模 |
| L3-4 | 向量数据库 | **Milvus 2.4** | Weaviate / Qdrant | 运维成熟度 |
| L3-4 | 对象存储 | **MinIO** | S3 / OSS | 性能 |
| L3-4 | 缓存 | **Redis 7 Cluster** | KeyDB / Dragonfly | 内存成本 |
| L3-4 | 搜索引擎 | Elasticsearch 8 | OpenSearch | 资源消耗 |
| L3-4 | 消息队列 | **Apache Kafka 3.6** | NATS / Pulsar | 运维 |
| L3-4 | 时序（v2） | TDengine / InfluxDB | Prometheus | 量级 |
| **L3-5** | 容器化 | **Docker + Kubernetes 1.29** | Docker Swarm | 复杂运维 |
| L3-5 | Helm | Helm 3 + ArgoCD | Kustomize | 模板复用 |
| L3-5 | 多云 | Terraform + Crossplane | Pulumi | 状态管理 |
| L3-5 | 信创 | 鲲鹏 + 麒麟 / 海光 + UOS + 达梦 | - | 适配工作量 |
| L3-5 | CDN | 阿里云 / 腾讯云 | Cloudflare | 国内合规 |
| L3-5 | WAF | 阿里云 WAF | Cloudflare WAF | 规则更新 |

---

## §1.3 逐层详解

### L1-1 · 用户 / AI 对话层

**职责**：用户与平台所有交互的总入口（Web / 移动 / 桌面 / 集成开发环境）。
**核心组件**：
- **对话前端**：React 18 + TypeScript 5 + Ant Design 5
- **拖拽画布**：React DnD + Tldraw（v0.1 用 Ant Design Pro 自带；v0.2 引入 Tldraw）
- **多模态输入**：语音（Web Speech API） + 截图（html2canvas）+ 拖文件
- **NL 解析器**：LangChain 0.3 (Python) 走 LLM Gateway

**数据流**：
```
用户输入（文字/语音/截图/拖拽）
    ↓
React 前端解析（结构化事件）
    ↓
NL 解析器 (LangChain + LLM) → 意图 + 槽位
    ↓
路由到对应的 L1-3 / L1-4 / L2-1 服务
    ↓
结果回传 → 前端展示
```

**接口契约**：
- 前端 ↔ 后端：GraphQL（主）+ REST（辅）
- 前端 ↔ LLM Gateway：SSE 流式（Server-Sent Events）

**性能基线**：
- 首屏加载：<2s（P75）
- NL 解析：<2s（P75）
- 流式响应：首个 token <500ms
- 拖拽响应：<16ms（60fps）

**关键风险**：
- 大模型路由成本失控 → LLM Gateway 智能分级
- 流式响应断连 → SSE 重连 + 客户端缓存
- 多模态性能 → 客户端预处理 + 服务端异步

---

### L1-2 · 应用 / 场景市场 (G4)

**职责**：把"业务模板"打包成可分发、可安装的应用（v0.2 起步）。
**核心组件**：
- **应用市场门户**：自研（前端）
- **应用打包**：Helm Chart 模板 + OCI 镜像
- **应用签名**：Sigstore cosign
- **应用分发**：OCI Registry（Harbor）+ Helm

**数据流**：
```
开发者
    ↓ 选模板 + 配置参数
应用打包器 (Helm template + Kustomize)
    ↓
签名 + 版本 (cosign)
    ↓
推送 OCI Registry
    ↓
用户安装 → Helm install
    ↓
应用元数据写入 PostgreSQL
    ↓
触发业务对象建模器初始化
```

**接口契约**：
- 市场 ↔ Registry：OCI 协议
- 用户 ↔ 市场：GraphQL（搜索、安装、升级）
- 应用 ↔ 平台：标准 CRD（CustomResourceDefinition）

**性能基线**：
- 应用搜索：<1s
- 应用安装：<5min（含业务对象初始化）
- 应用升级：<10min
- 市场门户可用性：99.9%

**关键风险**：
- 应用模板分发链信任 → 强制签名 + SBOM
- 跨租户隔离 → 安装时强制 namespace 隔离
- 升级数据迁移 → 应用自己负责迁移脚本

**当前阶段**：v0.1 不做；v0.2 起步。

---

### L1-3 · 页面 / 表单生成器 (G1)

**职责**：根据业务对象 Schema 自动生成 UI，支持拖拽微调。
**核心组件**：
- **Schema 引擎**：Formily 2 / Amis
- **拖拽设计器**：自研（基于 Formily Designer）
- **权限投影**：Casbin + OPA
- **NL 页面生成**：LLM Gateway → DSL → 渲染

**数据流**：
```
业务对象 Schema (L2-1)
    ↓
Formily JSON Schema 转换
    ↓
默认 UI 渲染
    ↓
用户拖拽微调 → 覆盖默认 UI 配置
    ↓
权限过滤（Casbin）→ 隐藏字段
    ↓
渲染最终页面
```

**接口契约**：
- 页面配置：JSON Schema 1.0（Formily 风格）
- 权限过滤：Casbin RBAC + ABAC
- NL 页面生成：REST + SSE

**性能基线**：
- 默认页面渲染：<200ms
- 拖拽响应：<16ms
- 100 字段表单渲染：<500ms
- 权限过滤：<50ms

**关键风险**：
- 拖拽性能 → 虚拟滚动 + 局部渲染
- 复杂权限规则 → 缓存编译后的 Casbin model
- NL 生成质量 → LLM 输出校验 + 失败回退到默认

---

### L1-4 · 流程自动化 (G4)

**职责**：业务流程建模、自动化、人工任务、AI 节点。
**核心组件**：
- **BPMN 引擎**：Flowable 7（Java 21）
- **流程设计器**：bpmn.js + 自研
- **触发器**：事件驱动 + 定时 + Webhook
- **AI 节点**：LangGraph 0.2 (Python)
- **SLA 监控**：自研 + Prometheus

**数据流**：
```
业务对象变更 (L2-1)
    ↓ Kafka 事件
Flowable Process Engine
    ↓ 匹配 trigger
启动流程实例
    ↓ 用户任务 / 服务任务 / AI 节点
Flowable Task Service
    ↓
任务分配（基于 Casbin）
    ↓
用户处理 → 写回业务对象
```

**接口契约**：
- 流程定义：BPMN 2.0 XML
- 流程实例：REST + GraphQL
- 任务处理：REST + WebSocket
- 事件触发：Kafka + Webhook

**性能基线**：
- 流程启动：<1s
- 用户任务响应：<500ms
- AI 节点调用：<5s
- 流程实例数：单引擎支持 10 万+

**关键风险**：
- 分布式事务 → Saga 模式 + 补偿
- AI 节点幂等 → 任务 ID 去重
- 流程版本化 → Flowable 原生支持

---

### L2-1 · 业务对象层 (G2)

**职责**：业务建模核心 —— 业务对象、字段、关系、规则、视图、权限。
**核心组件**：
- **业务对象建模器**：自研（前端拖拽）+ GraphQL 后端
- **业务规则引擎**：Drools 8 / Aviator 5 (Java)
- **视图生成器**：Formily 2 Schema 转换
- **业务权限**：Casbin + 自研 ABAC
- **业务事件**：Kafka producer（变更事件）

**数据流**：
```
建模者
    ↓ 拖拽 / NL
业务对象定义 (EntityType + 关系 + 规则)
    ↓
写入本体引擎 (L2-2) ←→ 元数据 (PostgreSQL)
    ↓ 发布 EntityTypeCreated
Kafka
    ↓ 订阅
L1-3 页面生成器 + L1-4 流程引擎 + L2-3 数据栈
```

**接口契约**：
- 业务对象 CRUD：GraphQL
- 业务对象查询：GraphQL + DSL
- 业务规则：自研 DSL + Drools DRL
- 业务事件：Kafka

**性能基线**：
- 业务对象创建：<500ms
- 业务对象查询（10 万实例）：<1s
- 业务规则执行：<100ms
- 业务事件发布：<50ms

**关键风险**：
- 业务对象数量爆炸 → 分租户分库 + 冷热分离
- 业务规则复杂度 → Drools 编译缓存
- 视图权限组合爆炸 → 编译时优化

---

### L2-2 · 本体引擎 + 知识图谱

**职责**：P3 架构核心 —— 本体（EntityType / RelationType） + 实例（EntityInstance）+ 推理 + 版本。
**核心组件**：
- **本体引擎服务**：Java 21 + Spring Boot 3
- **图数据库**：Neo4j 5（社区版起步，企业版备用）
- **事件总线**：Apache Kafka 3.6
- **版本快照**：PostgreSQL 16 + JSONB
- **推理引擎**：Neo4j Reasoning + OWL 适配（v0.2）

**数据流**：
```
建模者
    ↓ POST /api/v1/entity-types
EntityTypeService
    ├─ 写 Neo4j (Cypher MERGE)
    ├─ 写元数据 (PG：版本 + 审计)
    └─ 发 EntityTypeCreated 事件 → Kafka
                              ↓
              业务对象层 / 流程 / 数据栈 订阅
```

**接口契约**：
- 实体类型 CRUD：REST
- 实体实例 CRUD：GraphQL（v0.1 用 REST，v0.2 升 GraphQL）
- 关系查询：Cypher（受限子集）
- 事件：Kafka JSON

**性能基线**：
- 实体类型创建：<500ms
- 实体实例创建：<100ms
- 图查询（10 万节点）：<1s
- 事件发布：<50ms
- 快照/恢复：<2s

**关键风险**：
- Neo4j 集群规模 → 单租户 5 千万节点瓶颈
- 推理性能 → 限制推理深度 + 预计算
- 版本膨胀 → v0.2 加压缩归档

**与 v0.1 plan 的关系**：本节与 [ontology-engine-v0.1.md](../../superpowers/plans/2026-07-02-ontology-engine-v0.1.md) 完全对齐，无需重写 plan。

---

### L2-3 · 数据/知识统一层

**职责**：5 类数据/知识统一访问 —— RAG / 非结构 / MDM / 数据湖 / 数据仓库。
**核心组件**（D6 反转后全内置）：

| 子层 | 选型 | 关键能力 |
|---|---|---|
| **RAG** | Milvus 2.4 + BGE-M3 + 自研 | 文档库 / 检索 / 重排 / 引用 |
| **非结构化** | MinIO + 自研版本管理 | 文件版本 / 权限 / OCR / 媒体 |
| **MDM** | PostgreSQL + 自研匹配合并 | 黄金记录 / 匹配 / 合并 / 质量 |
| **数据湖** | Apache Hudi 0.13 + MinIO | 原始 / 标准化 / Schema 演进 |
| **数据仓库** | **Apache Doris 2.0**（内置）+ **ClickHouse 24**（适配器）| OLAP / 指标 / 维度 / 仪表盘 |
| **元数据** | PostgreSQL 16 + pgcat | 数据集 / Schema / 权限 |
| **数据质量** | Great Expectations | 规则 / 异常 / 修复建议 |

**D13 双轨 OLAP 架构**：
```
用户/应用
    ↓
统一查询入口 (L2-3 Query Service)
    ↓
路由决策器（基于表名约定）
    ├─ 默认表 → Doris (内置引擎)
    └─ ext_ck_* 前缀 → ClickHouse 适配器 → 外部数仓
```

**接口契约**：
- 数据集 CRUD：REST
- 数据查询：REST + SQL（方言转换）
- 数据写入：REST + Kafka 事件驱动
- 指标查询：自研 DSL + OLAP SQL

**性能基线**：
- 数据集创建：<1s
- 数据写入（10 万行/批）：<30s
- Doris 查询（1 亿行）：<3s
- ClickHouse 适配（路由）：<1ms
- Hudi 写入（1000 行）：<3s
- RAG 检索（100 万文档）：<500ms

**关键风险**：
- 数据栈工程量 → 集成 Doris/Hudi 等成熟开源，避免自研
- 元数据碎片 → PostgreSQL 单一真源
- 数据质量 → Great Expectations 自动化
- 语义统一 → 自建数仓和外部数仓走统一"指标/维度"语义层

**与 v0.1 plan 的关系**：本节与 [data-stack-v0.1.md](../../superpowers/plans/2026-07-02-data-stack-v0.1.md) 完全对齐；ClickHouse 适配器在 v0.1 是接口骨架，v0.2 落地真实 query 路径 —— **plan 中已说明，无需重写**。

---

### L3-1 · AI Substrate (基质)

> **v2 关键修正**：AI Substrate 是"基质"，不是单独一层 —— 它渗透在 L1-1 / L1-3 / L1-4 / L2-1 / L2-2 / L2-3 每一层中。
> 但作为**能力组件**，仍然需要明确列出其实现技术。

**核心组件**：
- **LLM Gateway**：自研（Go）+ LiteLLM 适配
  - 多模型路由：OpenAI / Claude / DeepSeek / Qwen / 自托管
  - 智能分级：简单任务小模型、复杂任务大模型
  - 成本控制：Token 计费、预算熔断
- **Embedding 服务**：BGE-M3 / m3e-large / OpenAI text-embedding-3
- **Vector Adapter**：Milvus 2.4 + pgvector
- **Context Store**：Redis 7（短期）+ PostgreSQL（长期）
- **Agent Runtime**：LangGraph 0.2 (Python)
- **推理服务（v2+）**：TGI / vLLM / Triton
- **模型训练（v2+）**：PyTorch + LLaMA Factory

**数据流**（以 L1-1 对话为例）：
```
用户输入
    ↓
LLM Gateway (路由)
    ├─ 简单 → 小模型（如 GPT-3.5 / Qwen-7B）
    └─ 复杂 → 大模型（如 Claude / GPT-4）
    ↓
Context Store 注入上下文
    ↓
LLM 推理
    ↓
Vector Adapter 检索（RAG）
    ↓
结果回流
    ↓
User Feedback → RLHF 数据
```

**接口契约**：
- LLM：OpenAI 兼容 REST
- Embedding：REST
- Agent：自研协议 + LangGraph 兼容
- Vector：Milvus gRPC

**性能基线**：
- LLM 路由：<10ms
- 简单任务响应：<2s
- 复杂任务响应：<10s
- Embedding 1000 文本：<3s
- Vector 检索：<100ms

**关键风险**：
- 成本失控 → LLM Gateway 强制分级 + 预算
- 多模型切换 → OpenAI 兼容协议兜底
- 私有化部署 → v2 自研推理
- 大上下文 → Context Store 分层 + 压缩

---

### L3-2 · 能力库 (G3)

**职责**：可插拔的能力集合（邮件、短信、OCR、翻译、……），AI 能力 + 传统能力。
**核心组件**：
- **能力注册中心**：自研（Go）
- **能力沙箱**：Wasm 沙箱（Wasmtime）+ 进程隔离
- **传统能力**：自研 Go SDK
- **AI 能力**：调用 L3-1
- **能力市场**：v0.2 起步

**数据流**：
```
L1-4 流程节点 / L2-1 业务规则
    ↓ 调用
能力注册中心
    ↓ 路由
Wasm 沙箱 或 进程隔离
    ↓
传统能力（HTTP/SDK） 或 AI 能力（LLM）
    ↓
结果回传
```

**接口契约**：
- 能力定义：自研 YAML / JSON
- 能力调用：gRPC + HTTP
- 能力市场：OCI Registry

**性能基线**：
- 能力注册：<100ms
- 能力调用：<1s
- 沙箱启动：<500ms
- 能力数量：100+ MVP / 1000+ 商用

**关键风险**：
- 沙箱性能 → Wasmtime 比 gVisor 快
- 能力版本化 → 强制 manifest
- AI 能力成本 → L3-1 成本控制

---

### L3-3 · 平台底座

**职责**：多租户、权限、审计、Integration Hub、API 网关、认证 —— 所有上层共享的基础。
**核心组件**：
- **多租户**：自研 + PostgreSQL Row-Level Security
- **权限中心**：Casbin（RBAC）+ Keycloak（认证）+ 自研 ABAC
- **审计**：自研 + ClickHouse（写入）
- **Integration Hub**：Apache NiFi 2 / Airbyte（连接器 50+）
- **API 网关**：Apache APISIX（Kong 备选）
- **认证**：Keycloak / Ory Hydra
- **通知中心**：邮件 / 短信 / Webhook

**数据流**：
```
外部客户端
    ↓ HTTPS
APISIX API Gateway
    ↓ JWT 解析
Keycloak 认证
    ↓ 用户/角色
Casbin 鉴权
    ↓
业务服务（L1-L2）
    ↓ 审计
ClickHouse + Kafka
```

**接口契约**：
- 多租户：HTTP Header `X-Tenant-Id`
- 权限：Casbin policy + 自研 ABAC
- 审计：Kafka JSON
- 集成：NiFi REST

**性能基线**：
- API 网关：<5ms 路由 + <20ms 鉴权
- 认证：<100ms
- 集成连接器：100+ MVP
- 审计写入：<10ms

**关键风险**：
- 多租户性能 → RLS 写性能损耗
- 权限规则复杂度 → 编译时优化
- 审计写入吞吐 → ClickHouse 异步批量

---

### L3-4 · 存储 / 基础设施

**职责**：所有数据存储和基础设施组件。
**核心组件**：

| 类型 | 选型 | 用途 | 规模 |
|---|---|---|---|
| 关系数据库 | **PostgreSQL 16 + Citus** | 业务元数据 / 关系数据 | 单租户 100 GB；Citus 分布式 |
| 图数据库 | **Neo4j 5** | 本体引擎 | 单租户 5 千万节点 |
| 向量数据库 | **Milvus 2.4** | RAG / Embedding | 1 亿向量 |
| 对象存储 | **MinIO** | 非结构化 / 数据湖 | PB 级 |
| 缓存 | **Redis 7 Cluster** | 热点缓存 | 100 GB |
| 搜索引擎 | Elasticsearch 8 | 全文 / 日志 | 10 亿文档 |
| 消息队列 | **Apache Kafka 3.6** | 事件总线 | 日 1 万亿消息 |
| 时序（v2） | TDengine | 监控 / 指标 | 1 亿时间线 |

**数据流**（以一次业务对象创建为例）：
```
业务对象层
    ↓
PG 写元数据（事务）
    ↓ 同事务
发 Kafka 事件
    ↓ 异步
Neo4j 写图（独立事务）
    ↓ 异步
MinIO 写文件（如有）
    ↓ 异步
ES 索引（异步）
    ↓
Redis 失效缓存
```

**接口契约**：
- PG：JDBC + pgcat（连接池）
- Neo4j：bolt 协议
- Milvus：gRPC
- MinIO：S3 兼容
- Redis：RESP
- Kafka：生产者/消费者

**性能基线**：
- PG 事务：<10ms
- Neo4j 写：<50ms
- Milvus 检索：<100ms
- MinIO 上传：100 MB/s
- Redis 读：<1ms
- Kafka 写：<5ms
- ES 索引：<100ms

**关键风险**：
- Neo4j 集群规模 → 单租户 5 千万节点瓶颈
- Milvus 运维 → 经验不足
- PG 写瓶颈 → 分库分表
- Kafka 运维 → 资源消耗大
- 国产化替代 → 鲲鹏/麒麟适配（信创）

---

### L3-5 · 部署 / 交付

**职责**：容器化、编排、CI/CD、多云、信创、CDN、WAF。
**核心组件**：
- **容器化**：Docker + Kubernetes 1.29
- **Helm**：Helm 3 + ArgoCD（GitOps）
- **多云**：Terraform + Crossplane
- **监控**：Prometheus + Grafana + Loki + Tempo
- **日志**：Loki + Vector
- **追踪**：Tempo + OpenTelemetry
- **CI/CD**：GitLab CI / GitHub Actions
- **镜像仓库**：Harbor（含 OCI Registry）
- **信创**：鲲鹏 + 麒麟 / 海光 + UOS / 达梦 / 人大金仓
- **CDN**：阿里云 / 腾讯云
- **WAF**：阿里云 WAF

**部署拓扑**（多租户 SaaS）：
```
                    ┌──────────────┐
                    │  Cloudflare/ │
                    │  阿里云 WAF  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  API Gateway │
                    │   (APISIX)   │
                    └──────┬───────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
    │ 租户 A  │       │ 租户 B  │       │ 租户 N  │
    │namespace│       │namespace│       │namespace│
    └────┬────┘       └────┬────┘       └────┬────┘
         │                 │                 │
    L1-L3 服务（K8s Deployment + HPA）
         │
    ┌────▼────────────┐
    │   中间件集群     │
    │ PG/Neo4j/Milvus │
    │ MinIO/Redis/Kafka│
    └─────────────────┘
```

**接口契约**：
- K8s：kubectl / Helm / ArgoCD
- Terraform：HCL
- ArgoCD：CRD

**性能基线**：
- 部署时间：<10min
- 扩缩容：<2min
- 故障转移：<30s
- 监控延迟：<10s
- 日志查询：<3s

**关键风险**：
- K8s 复杂度 → 团队技能
- 信创适配工作量 → 鲲鹏+麒麟（ARM64）+ 达梦+人大金仓（数据库）
- 监控数据爆炸 → 采样 + 压缩
- 多云成本 → 评估 ROI

---

## §1.4 AI Substrate 渗透规则（v2 修正）

> **核心原则**：AI Substrate 是"基质"，不是"一层"。下面是它渗透到各层的方式：

| 层 | AI 能力 | 技术实现 |
|---|---|---|
| L1-1 对话层 | NL 解析 / 多模态 / 拖拽引导 | LLM Gateway + Embedding |
| L1-2 市场层 | 模板推荐 / 自动生成 | LLM + Agent |
| L1-3 页面层 | NL 页面生成 / 自动布局 | LLM + Formily DSL |
| L1-4 流程层 | AI 节点 / NL 流程生成 | LangGraph + LLM |
| L2-1 业务对象层 | NL 业务建模 / 规则推荐 | LLM + Context Store |
| L2-2 本体引擎 | NL 关系推断 / 推理 / 文档 | Neo4j Reasoning + LLM |
| L2-3 数据/知识层 | NL→SQL / 跨文件关联 / 数据质量 | LLM + Vector Adapter |

**渗透的实现细节**：
- **不强制每层调用 LLM** —— 简单场景走规则引擎，复杂场景才走 LLM
- **统一通过 LLM Gateway** —— 便于成本控制 / 模型升级
- **Context Store 共享** —— 用户操作 / 业务对象 / 知识库 共享同一 Context

---

## §1.5 关键链路（End-to-End Tracing）

下面是一条"用户创建一个客户"的完整请求链：

```
1. 用户在 L1-1 拖拽 "Customer" 实体
2. L1-1 NL 解析器 (LLM Gateway) → 意图：创建 Customer
3. L2-1 业务对象层 → 创建 EntityType
4. L2-2 本体引擎 → 写 Neo4j + PG 版本快照
5. Kafka → EntityTypeCreated
6. L1-3 页面生成器 → 生成默认 Customer 列表页
7. L2-3 数据栈 → 准备 instance_customer 表
8. L3-1 AI Substrate → 给 Customer 推荐 3 个属性（基于 Context）
9. 用户接受属性推荐
10. L1-1 反馈 → 完成

后续：业务对象层发 EntityInstanceCreated → L2-3 写入 Doris
```

**这条链路揭示的依赖关系**：
- L1-1 强依赖 L3-1
- L1-3 强依赖 L2-1 + L2-2
- L1-4 强依赖 L2-1
- L2-1 强依赖 L2-2
- L2-2 强依赖 L3-3 (审计) + L3-4 (Kafka/Neo4j/PG)
- L2-3 强依赖 L3-4 (Doris/Hudi/Milvus) + L3-3 (元数据)
- 所有层强依赖 L3-1 (AI Substrate)
- 所有层强依赖 L3-3 (平台底座)
- 所有层部署在 L3-5

**这意味着 v0.1 的依赖图**：
- 本体引擎 v0.1 需要：L2-2 + L3-3(审计) + L3-4(Neo4j/PG/Kafka) + L3-5(K8s)
- 数据栈 v0.1 需要：L2-3 + L3-3(元数据) + L3-4(Doris/Hudi/PG/Kafka) + L3-5(K8s)
- 集成 Spike 需要：本体引擎 + 数据栈 + 共享 Kafka

**v0.1 plan 完整覆盖上述依赖** ✅。

---

## §1.6 总结：v0.1 plan 是否需要重写

| 检查项 | 结果 |
|---|---|
| 9 层技术选型 vs v0.1 plan | ✅ 完全对齐（Java + Neo4j + Go + Doris + Hudi + Kafka + MinIO）|
| 数据流方向 | ✅ 集成 Spike 已覆盖 |
| 关键依赖 | ✅ v0.1 plan 选型满足 |
| AI Substrate 渗透 | ⚠️ v0.1 不强制每层用 AI（v0.2 起步）|
| 信创 / 商用化 | ⚠️ v0.1 不做（v0.3 起步）|

**结论**：v0.1 plan 选型与本技术架构完全一致，**无需重写**。

但下面这些**对 v0.1 计划的提醒**值得注意：
- 部署到 K8s 而非 docker-compose（生产化）
- 加监控/日志/追踪（Observability）
- 备份/恢复策略（灾备）

这些放进 v0.2 plan 的 backlog。

---

**生成时间**：2026-07-02 14:35
**对应 spec 版本**：v1.2
**下一步**：阅读 [02-deployment-topology.md](./02-deployment-topology.md)
