# CLAUDE.md

> 本文件供 Claude Code 读取，提供项目上下文、架构约束与开发规范。
> **最近更新**：2026-07-28（v3.1 Data-Ready Baseline 同步）；上一版 2026-07-27（v3.0 Plan D 实施版定稿）
>
> **当前架构版本**：**v3.0（Plan D - Polyglot Microservice）**，v3.1 Data-Ready Baseline 同步中（详见附录 A）
>
> **配套文档（实施版）**：
> - 主架构（实施版）：`docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md` ⭐ THE ONE DOC
> - 技术栈定稿：`docs/active/specs/2026-07-27-mate-platform-tech-stack-confirmed.md`
> - 交付版本计划：`docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md`
> - 历史决策（已归档）：`docs/active/specs/2026-07-27-mate-platform-technical-architecture.md`

## 项目概述

**Mate Platform** 是基于 Ontology 本体引擎 + Polyglot Microservice 的企业级 AI 平台。

### 核心能力
- **Ontology 本体引擎**：统一语义建模与推理
- **低代码应用构建**：BPMN 审批流（Flowable 8.0）+ AI Agent 编排流（LangGraph）
- **数字员工**：AI 驱动的自动化
- **企业级 RAG**：RAGFlow + LightRAG + LLM Gateway
- **MCP / A2A 协议**：对接外部 AI 工具与 Agent 系统

## v3.0 架构基线（一句话）

**Python 主后端（业务）+ Java 外部引擎（Keycloak/Flowable/Drools 作为成熟产品）+ Python AI 服务 + 完整 docker-compose 基础设施栈。**

| 层                 | 服务                                                            | 语言                   | 关键镜像/版本                                      |
| ----------------- | ------------------------------------------------------------- | -------------------- | -------------------------------------------- |
| **网关**            | Traefik                                                       | Go                   | `traefik:v3.x`                               |
|                   | AuthService                                                   | Python               | `python:3.12`                                |
| **Python 主后端**    | mate-tech-{rag,agent,llmgw,ont,msg,obs,mcp,data}, mate-app-kb | Python               | `python:3.12`                                |
| **外部引擎（Java 产品）** | Keycloak                                                      | Java                 | `quay.io/keycloak/keycloak:25.0`             |
|                   | Flowable engine/task/rest                                     | Java                 | `flowable/flowable-*:8.0.0`（分布式 3 服务）        |
|                   | Drools KIE Server                                             | Java                 | `jboss/kie-server:7.74`                      |
| **AI 服务**         | RAGFlow                                                       | Python               | `infiniflow/ragflow:v0.13`                   |
|                   | LightRAG                                                      | Python               | `hkuds/lightrag:latest`                      |
| **基础设施**          | PostgreSQL                                                    | C                    | `postgres:16-alpine`                         |
|                   | Neo4j                                                         | Java                 | `neo4j:5.x`                                  |
|                   | Milvus                                                        | Go + C++             | `milvusdb/milvus:v2.5.0`                     |
|                   | MinIO                                                         | Go                   | `minio/minio:RELEASE.2024-10-13`             |
|                   | Redis                                                         | C                    | `redis:7-alpine`                             |
|                   | Kafka                                                         | Java + Scala (KRaft) | `confluentinc/cp-kafka:7.8.0`                |
|                   | RabbitMQ                                                      | Erlang               | `rabbitmq:3.13-management-alpine`            |
|                   | Nacos                                                         | Java                 | `nacos/nacos-server:v2.4.3-slim`             |
|                   | Loki                                                          | Go                   | `grafana/loki:3.3.2`                         |
| **数据平台（v3.1 增量）** | Flink + Flink K8s Operator                                    | Java + Scala         | `flink:1.19`                                 |
|                   | Airflow 3.x                                                   | Python               | `apache/airflow:3.0-python3.12`              |
|                   | Apache Paimon                                                 | Java                 | `apache/paimon:0.9`                          |
|                   | Apache Iceberg                                                | Java                 | `apache/iceberg-rest:1.5`                    |
|                   | Trino                                                         | Java                 | `trinodb/trino:455`                          |
|                   | StarRocks                                                     | C++                  | `starrocks/fe-ubuntu:3.3`                    |
|                   | Apache Gravitino                                              | Java                 | `apache/gravitino:0.7`                       |
|                   | OpenMetadata                                                  | Java                 | `openmetadata/server:1.4`                    |
|                   | OpenLineage + Marquez                                         | Java                 | `openlineage/marquez:0.50`                   |
|                   | Great Expectations                                            | Python               | `great-expectations/great_expectations:0.18` |
|                   | Apache Ranger                                                 | Java                 | `apache/ranger:2.4`                          |
|                   | OpenBao                                                       | Go                   | `openbao/openbao:1.15`                       |
## 关键架构决策（v3.0）

### 1. Polyglot Microservice（多语言并存）
- **Python 主后端**：FastAPI + SQLModel + Pydantic v2 + httpx + LangGraph
- **Java 引擎作为外部依赖**：Keycloak / Flowable 8.0 / Drools（成熟 Java 产品，不算"Java 服务"）
- **多语言基础设施**：每个用各自最优语言（C/Go/Erlang/Java）

### 2. 网关层：Traefik + AuthService
- Traefik 处理 TLS + 路由 + 限流 + 熔断 + traceId 注入
- AuthService 独立 FastAPI 小服务，做 JWT 校验 + 租户识别（不做切流决策）
- 无 v2.1/v3.0 灰度切流（Java 已归档，全部 v3.0）

### 3. 接口契约：Swagger/OpenAPI 3.1
- `contracts/openapi/` 目录作为单一真相源
- Swagger Editor + Swagger UI + Prism Mock（容器化）
- Redocly CLI + oasdiff 做 CI 校验

### 4. 跨服务通信
- 同步：REST API（httpx in Python）
- 异步：Kafka 主题（aiokafka）
- 服务发现：Nacos
- 鉴权：Keycloak JWT（所有语言共用）

## 仓库结构（2026-07-27）

```
D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\
|-- metaplatform-frontend/                  # 前端 monorepo（已落地）
|   |-- apps/{portal, dashboard, ontstudio, kb, mcphub, apphub, arch, dw, superai}
|   `-- packages/shared
|-- docs/active/specs/                      # 架构 + 交付文档
|   |-- 2026-07-27-mate-platform-architecture-implementation.md  ⭐ 主架构
|   |-- 2026-07-27-mate-platform-tech-stack-confirmed.md         ⭐ 技术栈定稿
|   |-- 2026-07-27-mate-platform-delivery-roadmap.md             ⭐ 交付计划
|   `-- 2026-07-27-mate-platform-technical-architecture.md       (归档版)
|-- metaplatform-design-draft/              # 设计稿
|-- acceptance/                             # 验收测试
|-- tests/                                  # e2e + perf
|-- infra/                                  # 基础设施配置
|-- scripts/                                # 启动脚本
|-- docker-compose.yml                      # 基础设施栈（postgres/nacos/minio/milvus/kafka/rabbitmq/loki）
|-- agent.md / CLAUDE.md                    # 本文件
`-- ...
```

## 架构铁律（v3.0 + v3.1 增量）

1. **Python 主后端**：所有业务代码全 Python（FastAPI + SQLModel + Pydantic v2）
2. **Java 引擎外部化**：Keycloak/Flowable/Drools 用官方镜像，团队不写 Java
3. **HTTP 客户端统一用 httpx**：不引入 aiohttp/requests
4. **类型检查 pyright strict**：CI 必跑
5. **测试 ≥ 80% 覆盖率**：pytest + pytest-asyncio + hypothesis
6. **接口契约 OpenAPI 3.1**：Redocly + oasdiff CI 校验
7. **Nacos 服务发现**：Python 服务注册即被 Traefik 发现
8. **OTel 全链路 traceId 透传**：从 Traefik 到 Python OTel context
9. **不切流**：无 v2.1/v3.0 灰度切流（Java 已归档）
10. **模块迁移按风险从低到高**：tech-msg -> tech-obs -> tech-mcp -> tech-ont -> tech-llmgw -> tech-rag -> tech-agent -> app-kb

### v3.1 增量铁律（不破坏 v3.0）

11. **Flink 是唯一主计算引擎**：首版不部署 Spark；批流统一由 Flink + CDC + PyFlink 覆盖。
12. **湖表分层**：Paimon 承担 ODS/DWD 高频变更；Iceberg 承担 DWS/ADS 共享数据产品；不无脑双写。
13. **调度与审批分工**：Airflow 负责数据 DAG/补数；Flowable 继续负责发布/访问审批。
14. **网关约束**：浏览器只能调用 Traefik/BFF 的 `/v1/data/*` 与 `/api/v1/data/*`，不直连 Flink/Airflow/Trino/StarRocks/OpenMetadata。
15. **旧 TECH-DATA 不恢复上线**：旧 Java `docs/legacy/tech-java-legacy/TECH-DATA` 仅作为 `/v1/data/*` 契约与领域模型的迁移参考。
16. **文档同步**：修改主架构前必须同步本文件、`agent.md`、主架构、技术栈与交付路线；不出现"代码先行、文档滞后"。


1. **Python 主后端**：所有业务代码全 Python（FastAPI + SQLModel + Pydantic v2）
2. **Java 引擎外部化**：Keycloak/Flowable/Drools 用官方镜像，团队不写 Java
3. **HTTP 客户端统一用 httpx**：不引入 aiohttp/requests
4. **类型检查 pyright strict**：CI 必跑
5. **测试 ≥ 80% 覆盖率**：pytest + pytest-asyncio + hypothesis
6. **接口契约 OpenAPI 3.1**：Redocly + oasdiff CI 校验
7. **Nacos 服务发现**：Python 服务注册即被 Traefik 发现
8. **OTel 全链路 traceId 透传**：从 Traefik 到 Python OTel context

## 并行开发节奏（W1-W7，共 22 周）

| W | 内容 | 工期 | 关键路径 |
|---|---|---|---|
| W1 | 项目骨架 + Swagger | 2 周 | ✓ |
| W2 | 基础设施 facade（pg/milvus/minio/redis/kafka/nacos 现成库接入） | 3 周 | ✓ |
| W3 | ACL Client 集（Keycloak/Flowable 8.0/Drools） | 2.5 周并行 | ✓ |
| W4 | Traefik 网关 + AuthService | 2.5 周 | ✓ |
| W5 | 业务域实现（8 个模块） | 10 周 | ✓ |
| W6 | 前端 9 apps 补齐对接 | 13 周 | 配合 |
| W7 | 蓝绿迁移（无 Java 兜底） | 13 周 | ✓ |

**关键路径**：W1-1 -> W2-3 -> W3-3 -> W4-3 -> W5-6 -> W5-7 -> W5-8 -> W7-6

## 开发规范

### 代码
- **Python**：Ruff + pyright strict + Pydantic v2
- **TypeScript**：ESLint + Prettier + tsc strict

### 测试
- 单元测试 ≥ 80% 覆盖率
- 集成测试用 Testcontainers
- E2E 用 Playwright

### 提交
- Conventional Commits（feat / fix / docs / refactor）
- 中文 commit message 可接受
- 重大变更需 Owner review

### 文档
- 主架构：`docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md`
- 技术栈：`docs/active/specs/2026-07-27-mate-platform-tech-stack-confirmed.md`
- 交付计划：`docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md`
- 修改本文件前先 review 主架构

## 给 Claude 的关键提示

> **当被问及架构决策时**：
> 1. **第一参考**：`docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md`（THE ONE DOC）
> 2. **当前版本**：v3.0（Plan D，Polyglot Microservice）
> 3. **关键技术栈**：Python 3.12+ / FastAPI / SQLModel / LangGraph / httpx / Traefik / Keycloak 25 / Flowable 8.0 / Drools 7.74
> 4. **主后端**：Python（团队不写 Java）
> 5. **外部 Java 引擎**：Keycloak/Flowable/Drools 是成熟产品，二进制部署（不计入"Java 服务"）
> 6. **接口契约**：Swagger/OpenAPI 3.1


## v3.1 增量任务（Data Track）

| 阶段 | 工期 | 主要产出 | 关键门禁 |
|---|---:|---|---|
| D0 | 2 周 | Flink CDC→Paimon→Iceberg→Trino/StarRocks Spike、容量模型 | 关键链路可运行 |
| D1 | 4 周 | K8s 数据平面（Kafka、MinIO、Flink Operator、Airflow、Trino） | 故障恢复验证 |
| D2 | 4 周 | Python mate-tech-data 骨架、领域模型、OpenAPI、Outbox、Engine ACL | 契约 + 类型检查 |
| D3 | 5 周 | CDC/事件/批量 Connector、Paimon ODS/DWD、Schema Evolution | 回放 + Upsert/Delete + 断点恢复 |
| D4 | 5 周 | Pipeline Spec、Canvas、Flink 编译、Airflow DAG Bundle、发布状态机 | SQL/Java/PyFlink 三类作业 |
| D5 | 4 周 | Iceberg 数据产品发布、Trino、StarRocks、SQL Gateway | BI/AI 可消费认证产品 |
| D6 | 4 周 | Gravitino、OpenMetadata、OpenLineage、质量、Ranger、OpenBao | 质量/权限/血缘门禁 |
| D7 | 5 周 | 现有 Ontology Data Center 原位增强、语义映射、E2E | 现有四大页签不回归 |
| D8 | 4 周 | 压测、混沌、RPO/RTO、回滚、文档、GA | 全部 GA 验收门禁通过 |

D0–D8 合计约 35 周；与 W1–W7 同步推进，Data Squad 建议独立编排。

## 给 AI Agent 的关键提示（v3.1 增量）

- 当被问及数据接入、湖仓、SQL、血缘或 Pipeline 时，第一参考为 `docs/superpowers/specs/2026-07-28-mate-platform-big-data-etl-design.md` 与主架构附录 A。
- `mate-tech-data` 是唯一数据控制面；前端 Ontology Data Center 通过 `/v1/data/*` 调用。
- 不允许出现 Paimon/Iceberg 全量双写、Paimon/Iceberg 之外的湖表格式、Java 业务服务或新增独立 APP `APP-DATA`。
- 数据平台是 v1.0 GA 硬前置，不延期到 v1.1。
