# CLAUDE.md

> 本文件供 Claude Code 读取，提供项目上下文、架构约束与开发规范。
> **最近更新**：2026-07-27（v3.0 Plan D 实施版定稿）
>
> **当前架构版本**：**v3.0（Plan D - Polyglot Microservice）**
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

### 服务全景（30+ 服务）

| 层 | 服务 | 语言 | 关键镜像/版本 |
|---|---|---|---|
| **网关** | Traefik | Go | `traefik:v3.x` |
|  | AuthService | Python | `python:3.12` |
| **Python 主后端** | mate-tech-{rag,agent,llmgw,ont,msg,obs,mcp}, mate-app-kb | Python | `python:3.12` |
| **外部引擎（Java 产品）** | Keycloak | Java | `quay.io/keycloak/keycloak:25.0` |
|  | Flowable engine/task/rest | Java | `flowable/flowable-*:8.0.0`（分布式 3 服务） |
|  | Drools KIE Server | Java | `jboss/kie-server:7.74` |
| **AI 服务** | RAGFlow / LightRAG | Python | `infiniflow/ragflow:v0.13` / `hkuds/lightrag:latest` |
| **基础设施** | PostgreSQL | C | `postgres:16-alpine` |
|  | Neo4j | Java | `neo4j:5.x` |
|  | Milvus | Go + C++ | `milvusdb/milvus:v2.5.0` |
|  | MinIO | Go | `minio/minio:RELEASE.2024-10-13` |
|  | Redis | C | `redis:7-alpine` |
|  | Kafka | Java + Scala (KRaft) | `confluentinc/cp-kafka:7.8.0` |
|  | RabbitMQ | Erlang | `rabbitmq:3.13-management-alpine` |
|  | Nacos | Java | `nacos/nacos-server:v2.4.3-slim` |
|  | Loki | Go | `grafana/loki:3.3.2` |

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

## 架构铁律（v3.0）

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