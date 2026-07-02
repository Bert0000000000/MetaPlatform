# §5 技术选型矩阵

> **目标**：对每个核心组件，给出选型决策、替代方案、风险评估、退出成本。
> **对应 spec**：v1.2 §11 技术选型
> **状态**：v1.0 草稿

---

## §5.1 核心选型决策表

| # | 组件 | 当前选型 | 备选 1 | 备选 2 | 决策 | 退出成本 |
|---|---|---|---|---|---|---|
| **1** | 后端主语言 | Java 21 | Go 1.22 | Python 3.12 | Java 主（业务）/ Go（数据/网关）/ Python（AI）| 中 |
| **2** | Web 框架 | Spring Boot 3 | Quarkus | Micronaut | Spring Boot（生态最成熟）| 低 |
| **3** | 图数据库 | Neo4j 5 | TypeDB | TigerGraph | Neo4j 5（Cypher + 社区版友好）| 中 |
| **4** | 关系数据库 | PostgreSQL 16 | MySQL 8 | Oracle | PostgreSQL（Citus 扩展 + JSONB）| 中 |
| **5** | 向量数据库 | Milvus 2.4 | Weaviate | Qdrant | Milvus（中文支持好 + 性能）| 中 |
| **6** | 数据湖 | Apache Hudi | Iceberg | Delta Lake | Hudi（更新/删除能力强）| 中 |
| **7** | 数据仓库 | Apache Doris | ClickHouse | StarRocks | Doris（实时数仓 + 国产化 + 生态）| 中 |
| **8** | 对象存储 | MinIO | S3 / OSS | Ceph | MinIO（私有化部署友好）| 低 |
| **9** | 消息队列 | Apache Kafka 3.6 | NATS JetStream | Pulsar | Kafka（生态最成熟）| 中 |
| **10** | 缓存 | Redis 7 Cluster | KeyDB | Dragonfly | Redis（最广泛使用）| 低 |
| **11** | 搜索引擎 | Elasticsearch 8 | OpenSearch | Meilisearch | ES（生态成熟）| 中 |
| **12** | BPMN 引擎 | Flowable 7 | Camunda 8 | Activiti 7 | Flowable（开源 + 社区版够用）| 中 |
| **13** | 低代码前端 | Formily 2 | Amis | 自研 | Formily（性能 + 生态）| 中 |
| **14** | 大模型框架 | LangChain 0.3 | LlamaIndex | Haystack | LangChain（最广泛）| 低 |
| **15** | Agent 框架 | LangGraph 0.2 | CrewAI | AutoGen | LangGraph（可控性最强）| 中 |
| **16** | LLM Gateway | 自研 + LiteLLM | Portkey | OpenRouter | 自研（可控 + 国产化）| 高 |
| **17** | Embedding | BGE-M3 | m3e-large | OpenAI | BGE-M3（中文好 + 开源）| 低 |
| **18** | API 网关 | Apache APISIX | Kong | Envoy | APISIX（性能 + 中文社区）| 中 |
| **19** | 认证 | Keycloak | Ory Hydra | Auth0 | Keycloak（开源 + 全功能）| 中 |
| **20** | 鉴权 | Casbin | OPA | 自研 ABAC | Casbin（易用）| 低 |
| **21** | 集成 | Apache NiFi 2 | Airbyte | Temporal | NiFi（可视化 + 数据流）| 中 |
| **22** | 容器化 | Docker + K8s 1.29 | Docker Swarm | Nomad | K8s（标准）| 高 |
| **23** | GitOps | ArgoCD | Flux | Jenkins X | ArgoCD（UI + 多集群）| 低 |
| **24** | IaC | Terraform | Pulumi | Crossplane | Terraform（生态）| 低 |
| **25** | 监控 | Prometheus + Grafana | Datadog | New Relic | Prometheus（开源 + K8s 原生）| 中 |
| **26** | 日志 | Loki + Vector | ELK | Splunk | Loki（轻量 + K8s 友好）| 中 |
| **27** | 追踪 | Tempo + OpenTelemetry | Jaeger | Zipkin | Tempo（与 Loki 集成）| 低 |
| **28** | 镜像仓库 | Harbor | Docker Hub | ACR | Harbor（开源 + 多租户）| 低 |
| **29** | 规则引擎 | Drools 8 | Aviator 5 | Easy Rules | Drools（功能强）/ Aviator（轻量）| 中 |
| **30** | 能力沙箱 | Wasmtime | gVisor | Firecracker | Wasmtime（启动快 + 安全）| 中 |

---

## §5.2 关键选型深度分析

### #3 图数据库：Neo4j 5 vs TypeDB vs TigerGraph

**决策：Neo4j 5**

| 维度 | Neo4j 5 | TypeDB | TigerGraph |
|---|---|---|---|
| **Cypher / GQL** | ✅ Cypher | ✅ TypeQL | ✅ GSQL |
| **OLTP 性能** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **OLAP 性能** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **社区版限制** | 仅单机 | 无 | 无 |
| **企业版价格** | 高 | 中 | 极高 |
| **中文文档** | 多 | 少 | 少 |
| **生态** | 广 | 中 | 窄 |
| **国产化替代** | 华为 GES | 无 | 无 |

**理由**：
- Cypher 成熟 + 学习曲线平缓
- 社区版起步，5 千万节点够用
- 中文社区活跃
- 国产化有替代方案（华为 GES）

**风险**：
- 企业版价格高（但 5 千万节点内免费）
- 集群扩展需企业版

**退出成本**：中（需要重写 Cypher → TypeQL / GSQL）

---

### #6 数据湖：Hudi vs Iceberg vs Delta Lake

**决策：Apache Hudi**

| 维度 | Hudi | Iceberg | Delta Lake |
|---|---|---|---|
| **更新/删除** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **批流一体** | ✅ | ✅ | ✅ |
| **生态** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **引擎集成** | Spark / Flink | Spark / Flink / Trino / Dremio | Spark / Databricks |
| **Doris 集成** | ✅ 良好 | ✅ 良好 | ⚠️ 一般 |
| **国产化** | ✅ | ✅ | ⚠️ |

**理由**：
- 与 Doris 集成最好
- Update/Delete 能力最强
- 国产化友好

**风险**：
- 主要绑定 Spark / Flink
- 写入性能略低于 Iceberg

**退出成本**：中（迁移到 Iceberg 需要重新写 schema）

---

### #7 数据仓库：Doris vs ClickHouse vs StarRocks

**决策：D13：Apache Doris 主 + ClickHouse 适配器**

| 维度 | Doris | ClickHouse | StarRocks |
|---|---|---|---|
| **实时数仓** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **离线数仓** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **国产化** | ✅ Apache | ⚠️ 俄罗斯 | ✅ |
| **Doris 兼容** | - | ❌ | ❌ |
| **生态** | 中 | 广 | 中 |
| **运维成本** | 中 | 中 | 中 |
| **ClickHouse 兼容** | ❌ | - | ❌ |

**理由（D13 双轨）**：
- **Doris 主**：实时数仓 + 国产化 + 与 Hudi 集成
- **ClickHouse 适配器**：满足 D13 "不取代 Snowflake" 承诺，外部数仓接入

**风险**：
- 双轨增加复杂度
- 语义统一（指标/维度）需要抽象层

**退出成本**：高（D13 是核心决策，需要重新写语义层）

---

### #9 消息队列：Kafka vs NATS vs Pulsar

**决策：Apache Kafka 3.6**

| 维度 | Kafka 3.6 | NATS JetStream | Pulsar |
|---|---|---|---|
| **吞吐量** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **延迟** | 中 | 低 | 中 |
| **生态** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **运维成本** | 高 | 低 | 高 |
| **流处理** | Kafka Streams / Flink | NATS Streaming | Pulsar Functions |
| **Schema Registry** | ✅ | ⚠️ | ✅ |

**理由**：
- 生态最广
- Schema Registry 成熟
- 大数据生态完善

**风险**：
- 运维成本高（ZooKeeper / KRaft）
- 资源消耗大

**退出成本**：中（事件 schema 抽象层后，可迁移到 NATS / Pulsar）

---

### #12 BPMN 引擎：Flowable vs Camunda vs Activiti

**决策：Flowable 7**

| 维度 | Flowable 7 | Camunda 8 | Activiti 7 |
|---|---|---|---|
| **BPMN 2.0** | ✅ | ✅ | ✅ |
| **CMMN** | ✅ | ⚠️ | ✅ |
| **DMN** | ✅ | ✅ | ✅ |
| **云原生** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **社区版** | 完整 | 限制 | 完整 |
| **企业版** | 中 | 极高 | 中 |
| **学习曲线** | 中 | 高 | 中 |

**理由**：
- 社区版功能完整
- 与 Spring Boot 集成好
- 中文社区活跃

**风险**：
- 性能略低于 Camunda 8（云原生）
- 集群方案需付费支持

**退出成本**：高（流程定义 + 实例迁移复杂）

---

### #16 LLM Gateway：自研 vs Portkey vs OpenRouter

**决策：自研（Go）+ LiteLLM 适配**

| 维度 | 自研 | Portkey | OpenRouter |
|---|---|---|---|
| **可控性** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ |
| **国产化** | ✅ | ❌ | ❌ |
| **成本控制** | 强 | 中 | 弱 |
| **多模型** | ✅ | ✅ | ✅ |
| **生态** | 0 | 中 | 中 |
| **维护成本** | 高 | 低 | 低 |

**理由**：
- 国产化必须自研
- 成本控制是核心需求
- 数据合规要求

**风险**：
- 维护成本高
- 需要持续适配新模型

**退出成本**：低（HTTP API 抽象层后，可迁移到 Portkey）

---

### #18 API 网关：APISIX vs Kong vs Envoy

**决策：Apache APISIX**

| 维度 | APISIX | Kong | Envoy |
|---|---|---|---|
| **性能** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **插件** | 丰富 | 丰富 | 少 |
| **多语言** | Lua + 多 | Lua | C++ |
| **中文社区** | ✅ | ⚠️ | ⚠️ |
| **K8s 集成** | ✅ | ✅ | ✅ |
| **国产化** | ✅ | ⚠️ | ⚠️ |

**理由**：
- 性能最强（基于 etcd + Lua）
- 中文社区活跃
- K8s 集成好

**风险**：
- 插件用 Lua，团队需要 Lua 基础

**退出成本**：中（路由 + 插件重写）

---

### #22 容器化：Docker + K8s vs Docker Swarm vs Nomad

**决策：Docker + Kubernetes 1.29**

| 维度 | K8s | Swarm | Nomad |
|---|---|---|---|
| **生态** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **功能** | 完整 | 简单 | 中 |
| **运维** | 复杂 | 简单 | 简单 |
| **国产化** | ✅ | ⚠️ | ⚠️ |
| **人才** | 多 | 少 | 少 |

**理由**：
- 行业标准
- 生态最广
- 信创有对应版本

**风险**：
- 运维复杂
- 团队技能要求高

**退出成本**：极高（生态绑定深）

---

## §5.3 选型风险评估

### 高风险选型（需要持续关注）

| 选型 | 风险 | 缓解 |
|---|---|---|
| **Neo4j** | 企业版价格 + 集群规模 | 监控节点数量，超过 5 千万评估 GES |
| **Doris** | 生态成熟度 + ClickHouse 兼容 | D13 双轨 + 语义抽象层 |
| **Hudi** | 主要绑定 Spark / Flink | Doris 集成验证 |
| **Kafka** | 运维成本高 | 用托管 Kafka（MSK / 阿里云）|
| **自研 LLM Gateway** | 维护成本 + 新模型适配 | LiteLLM 兜底 + 抽象层 |

### 中风险选型（持续观察）

| 选型 | 风险 | 缓解 |
|---|---|---|
| **Flowable** | 性能 / 集群 | 监控流程实例数 |
| **LangGraph** | 调试能力 | 自研 trace 工具 |
| **MinIO** | 大规模集群 | 单集群 PB 评估 |
| **Formily** | 复杂场景 | 备用方案：Amis |

### 低风险选型（标准选型）

| 选型 | 备注 |
|---|---|
| **Java 21 + Spring Boot 3** | 行业标准 |
| **PostgreSQL 16** | 行业标准 |
| **Redis 7** | 行业标准 |
| **Prometheus + Grafana** | 行业标准 |
| **Docker + K8s** | 行业标准 |

---

## §5.4 选型演进路径

### v0.1 → v0.2 → v0.3 → 商用

| 阶段 | 选型变化 |
|---|---|
| **v0.1 (Spike)** | 上述选型（dokcer-compose） |
| **v0.2 (MVP)** | 加监控 / 日志 / 追踪 / 鉴权 / 多租户 |
| **v0.3 (加固)** | 加 Service Mesh / ArgoCD / 信创适配 |
| **商用化** | 加多 Region / 灾备 / 合规认证 |

### 关键技术变更（如果发生）

| 触发条件 | 变更 |
|---|---|
| Neo4j 节点 > 5 千万 | 评估 GES（华为图引擎）|
| Doris 复杂查询慢 | 评估 StarRocks（语法接近）|
| Kafka 运维成本高 | 评估托管 Kafka |
| LLM 厂商绑定 | 评估 Portkey |
| K8s 复杂度过高 | 评估 K3s（边缘）|

---

## §5.5 v0.1 plan 与本节的关系

**v0.1 选型 vs 矩阵**：

| v0.1 组件 | v0.1 选型 | 矩阵决策 | 是否一致 |
|---|---|---|---|
| 本体引擎语言 | Java 21 | Java 21 | ✅ |
| 本体引擎框架 | Spring Boot 3 | Spring Boot 3 | ✅ |
| 图数据库 | Neo4j 5 | Neo4j 5 | ✅ |
| 元数据 DB | PostgreSQL 16 | PostgreSQL 16 | ✅ |
| 事件总线 | Kafka 3.6 | Kafka 3.6 | ✅ |
| 数据栈语言 | Go 1.22 | Go（数据/网关）| ✅ |
| OLAP 引擎 | Apache Doris | Doris 主 | ✅ |
| ClickHouse 适配 | ClickHouse 24 | ClickHouse 适配器 | ✅ |
| 数据湖 | Apache Hudi | Hudi | ✅ |
| 对象存储 | MinIO | MinIO | ✅ |
| 集成（Ingest） | Kafka consumer | Kafka 3.6 | ✅ |

**结论**：v0.1 plan 选型与本矩阵 100% 对齐，**无需重写**。

---

**生成时间**：2026-07-02 14:55
**对应 spec 版本**：v1.2
**下一步**：阅读 [06-non-functional-requirements.md](./06-non-functional-requirements.md)
