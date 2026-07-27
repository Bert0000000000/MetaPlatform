# Mate Platform 技术架构 v3.0（实施版）

> **版本**：v3.0-implementation | **日期**：2026-07-27 | **状态**：实施基线
>
> **配套文档**：
> - 技术栈定稿：`2026-07-27-mate-platform-tech-stack-confirmed.md`
> - 交付版本计划：`2026-07-27-mate-platform-delivery-roadmap.md`
> - 历史决策归档：`archive/2026-07-27-mate-platform-technical-architecture-v2.1.md`

---

## 1. 系统总览

### 1.1 架构总图

```mermaid
flowchart TB
    subgraph FE [前端 metaplatform-frontend]
        F1[React 19 + Vite 6 + TS 5.7<br/>9 apps + packages/shared]
    end

    subgraph GW [网关层]
        T[Traefik<br/>TLS + 路由 + 限流]
        A[AuthService<br/>JWT 校验 + 租户识别]
    end

    subgraph PY [Python 主后端 mate-platform-backend]
        SVC1[services/auth-service]
        SVC2[services/api-gateway]
        P1[mate-tech-rag]
        P2[mate-tech-agent]
        P3[mate-tech-ont]
        P4[mate-tech-llmgw]
        P5[mate-tech-msg]
        P6[mate-tech-obs]
        P7[mate-tech-mcp]
        P8[mate-app-kb]
    end

    subgraph EXT [外部引擎 - Java 产品]
        K[Keycloak 25.0]
        FL[Flowable 8.0<br/>engine + task + rest]
        DR[Drools KIE Server 7.74]
    end

    subgraph AI [AI 服务 - Python]
        RF[RAGFlow]
        LR[LightRAG]
    end

    subgraph INF [基础设施 - docker-compose]
        PG[PostgreSQL 16]
        NE[Neo4j 5.x]
        MI[Milvus 2.5]
        MO[MinIO]
        RD[Redis 7]
        KF[Kafka 7.8]
        RMQ[RabbitMQ 3.13]
        NA[Nacos 2.4.3]
    end

    FE -->|HTTPS| T
    T -->|forward-auth| A
    T -->|路由| P1
    T -->|路由| P2
    T -->|路由| P8

    P1 -->|ACL Client| RF
    P1 -->|ACL Client| LR
    P1 -->|ACL Client| FL
    P2 -->|ACL Client| FL
    P8 -->|ACL Client| DR
    A -->|OIDC| K

    PY --> PG
    PY --> NE
    PY --> MI
    PY --> MO
    PY --> RD
    PY --> KF
    PY --> RMQ
    PY --> NA

    K --> PG
    FL --> PG
    DR --> PG
```

### 1.2 服务全景

| 层 | 服务 | 语言 | 镜像 / 版本 | 端口 |
|---|---|---|---|---|
| **网关** | Traefik | Go | `traefik:v3.x` | 80 / 443 |
|  | AuthService | Python | `python:3.12` | 8000 |
| **Python 主后端** | mate-tech-rag | Python | `python:3.12` | 8080 |
|  | mate-tech-agent | Python | `python:3.12` | 8080 |
|  | mate-tech-llmgw | Python | `python:3.12` | 8080 |
|  | mate-tech-ont | Python | `python:3.12` | 8080 |
|  | mate-tech-msg | Python | `python:3.12` | 8080 |
|  | mate-tech-obs | Python | `python:3.12` | 8080 |
|  | mate-tech-mcp | Python | `python:3.12` | 8080 |
|  | mate-app-kb | Python | `python:3.12` | 8080 |
| **外部引擎** | Keycloak | Java | `quay.io/keycloak/keycloak:25.0` | 8080 |
|  | Flowable engine | Java | `flowable/flowable-engine:8.0.0` | 8081 |
|  | Flowable task | Java | `flowable/flowable-task:8.0.0` | 8082 |
|  | Flowable rest | Java | `flowable/flowable-rest:8.0.0` | 8083 |
|  | Drools KIE Server | Java | `jboss/kie-server:7.74` | 8180 |
| **AI 服务** | RAGFlow | Python | `infiniflow/ragflow:v0.13` | 9621 |
|  | LightRAG | Python | `hkuds/lightrag:latest` | 9622 |
| **基础设施** | PostgreSQL | C | `postgres:16-alpine` | 5432 |
|  | Neo4j | Java | `neo4j:5.x` | 7687 |
|  | Milvus | Go + C++ | `milvusdb/milvus:v2.5.0` | 19530 |
|  | MinIO | Go | `minio/minio:RELEASE.2024-10-13` | 9000 |
|  | Redis | C | `redis:7-alpine` | 6379 |
|  | Kafka | Java + Scala (KRaft) | `confluentinc/cp-kafka:7.8.0` | 9092 |
|  | RabbitMQ | Erlang | `rabbitmq:3.13-management-alpine` | 5672 |
|  | Nacos | Java | `nacos/nacos-server:v2.4.3-slim` | 8848 |
|  | Loki | Go | `grafana/loki:3.3.2` | 3100 |

---

## 2. 架构模式

### 2.1 Hexagonal Architecture（端口与适配器）

**四层结构**：
```
domain            -> 纯 Python，无外部依赖
application       -> 用例编排，通过 ports 调用 domain
infrastructure    -> 实现 ports：persistence + clients
api               -> FastAPI routes + DTO
```

**约束**：
- `domain` 不依赖任何外部包
- `application` 只依赖 `domain` 和 `ports`
- `infrastructure` 实现 `ports`
- `api` 调用 `application`

### 2.2 DDD Bounded Context

| Context | 拥有者 | 核心模型 |
|---|---|---|
| Knowledge | mate-tech-rag | Document, Chunk, KnowledgeBase |
| Ontology | mate-tech-ont | Concept, Entity, Relation |
| Agent | mate-tech-agent | AgentRun, Task, Plan |
| Workflow | Flowable Service | ProcessDefinition, ProcessInstance |
| Rule | Drools Service | RuleSet, Fact, Trigger |
| Identity | Keycloak | User, Realm, Role |
| App | mate-app-kb | Application, Module |

**上下文映射**：
- Knowledge <-> Ontology：Customer/Supplier
- Agent <-> Workflow：Open-Host Service
- Knowledge <-> Workflow：Shared Kernel

### 2.3 CQRS（读写分离）

| 路径 | 模型 | 优化方向 |
|---|---|---|
| Command（写） | Document, Chunk, Event | 强一致、事务性 |
| Query（读） | DocumentView, ChunkView | 高性能、可缓存 |

### 2.4 Event-Driven + Outbox Pattern

**核心流程**：
```
Command Handler 写入业务表（同一事务）
        |
        v
Outbox Publisher 读取 outbox 表，发送到 Kafka
        |
        v
消费者 At-least-once 消费，幂等处理
```

### 2.5 Saga Pattern（Choreography）

**应用场景**：S4 智能体编排、S5b 阈值触发
**实现**：事件驱动，无中心协调器

### 2.6 Anti-Corruption Layer (ACL)

每个外部服务一个 Client：
```python
# packages/mate-tech-rag/clients/flowable_client.py
class FlowableClient:
    def __init__(self, base_url, auth_token):
        self.client = httpx.AsyncClient(
            base_url=base_url,
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30.0,
            limits=httpx.Limits(max_keepalive_connections=20),
        )

    async def deploy_bpmn(self, bpmn_xml: str, name: str) -> dict:
        response = await self.client.post(
            "/api/v1/bpm/process-definitions",
            json={"name": name, "xml": bpmn_xml},
        )
        response.raise_for_status()
        return response.json()

    async def start_process(self, process_key: str, variables: dict) -> dict:
        response = await self.client.post(
            "/api/v1/bpm/process-instances",
            json={"processDefinitionKey": process_key, "variables": variables},
        )
        response.raise_for_status()
        return response.json()
```

### 2.7 Resilience Patterns

**Circuit Breaker**（pybreaker）：
```python
@circuit_breaker(failure_threshold=5, recovery_timeout=30)
async def call_flowable(self, request: dict) -> dict:
    return await self.http_client.post("/api/v1/bpm/...", json=request)
```

**Bulkhead**（httpx 独立连接池）：
```python
flowable_pool = httpx.AsyncClient(limits=httpx.Limits(max_connections=20))
drools_pool = httpx.AsyncClient(limits=httpx.Limits(max_connections=20))
lightrag_pool = httpx.AsyncClient(limits=httpx.Limits(max_connections=30))
```

**Retry with Exponential Backoff**（tenacity）：
```python
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(httpx.HTTPError),
)
async def call_with_retry(self, url: str) -> dict:
    ...
```

---

## 3. 外部引擎（Java 产品）

### 3.1 Keycloak（IAM/SSO）

| 项 | 值 |
|---|---|
| 镜像 | `quay.io/keycloak/keycloak:25.0` |
| 端口 | 8080 |
| 数据库 | PostgreSQL schema `keycloak` |
| 启动模式 | `start-dev --import-realm` |
| Python 接入 | `KeycloakClient`（OIDC + Admin REST） |
| 库 | `python-keycloak` + 自研 httpx |

**提供能力**：
- OIDC 鉴权（所有语言统一）
- JWT 颁发 + 校验
- Realm / Client / Role / User 管理
- SSO 单点登录

### 3.2 Flowable 8.0（BPMN）

| 项 | 值 |
|---|---|
| 镜像 | engine / task / rest 三服务：`flowable/flowable-*:8.0.0` |
| 端口 | engine:8081 / task:8082 / rest:8083 |
| 数据库 | PostgreSQL schema `flowable` |
| Python 接入 | `FlowableClient`（自研 httpx，调用 rest:8083） |
| 调用场景 | S4 智能体编排、BPMN 部署、流程启动、任务查询 |

**架构变化**（vs 7.x）：云原生分布式，engine / task / rest 拆分独立部署。

**REST API 路径**：`/api/v1/bpm/process-definitions`、`/api/v1/bpm/process-instances`、`/api/v1/bpm/tasks` 等。

### 3.3 Drools / KIE Server（规则引擎）

| 项 | 值 |
|---|---|
| 镜像 | `jboss/kie-server:7.74` |
| 端口 | 8180 |
| 数据库 | PostgreSQL schema `drools` |
| Python 接入 | `DroolsClient`（自研 httpx） |
| 调用场景 | S5b 阈值触发、规则评估、决策表执行 |

**规则存储**：`packages/mate-tech-msg/rules/*.drl` Git 管理。

---

## 4. Python 主后端

### 4.1 技术栈

| 组件 | 选型 | 版本 |
|---|---|---|
| 包管理 | **uv**（Astral） | latest |
| Web 框架 | **FastAPI** | 0.115+ |
| ASGI 服务器 | uvicorn + uvloop + granian | latest |
| 数据验证 | **Pydantic v2** | latest |
| ORM | SQLAlchemy 2.0 + **SQLModel** | latest |
| PG 驱动 | psycopg[binary,pool] 或 asyncpg | latest |
| Neo4j 驱动 | neo4j Python driver | 5.x |
| Milvus 驱动 | pymilvus | latest |
| MinIO 驱动 | minio-py | latest |
| Redis 驱动 | redis-py | latest |
| Kafka 驱动 | aiokafka | latest |
| HTTP 客户端 | **httpx** | latest |
| LLM 编排 | **LangChain + LlamaIndex** | 1.3+ |
| 多 Agent | **LangGraph** | 1.2.9+ |
| MCP | mcp-python-sdk | latest |
| 类型检查 | **pyright**（strict 必开） | latest |
| 测试 | pytest + pytest-asyncio + hypothesis | latest |
| 代码质量 | **Ruff** | latest |
| 重试 | tenacity | latest |
| 熔断 | pybreaker | latest |

### 4.2 项目结构

```
mate-platform-backend/                    # Python 主后端 monorepo（uv）
|-- pyproject.toml                        # uv 管理 + 所有依赖
|-- ruff.toml                             # 代码规范
|-- pyrightconfig.json                    # 类型检查（strict）
|-- contracts/
|   `-- openapi/                          # Swagger/OpenAPI 3.1
|       |-- shared/common.yaml
|       |-- iam.yaml
|       |-- knowledge.yaml
|       |-- ontology.yaml
|       |-- agent.yaml
|       |-- llmgw.yaml
|       |-- msg.yaml
|       |-- obs.yaml
|       |-- mcp.yaml
|       |-- bpmn.yaml                     # Flowable 封装
|       `-- rules.yaml                    # Drools 封装
|-- packages/
|   |-- mate-common/                      # 公共 DTO / 异常 / 工具
|   |-- mate-tech-rag/                    # RAG 业务
|   |   |-- domain/
|   |   |-- services/
|   |   |-- repositories/
|   |   |-- clients/                      # ACL Client 集
|   |   |   |-- ragflow_client.py
|   |   |   |-- lightrag_client.py
|   |   |   |-- flowable_client.py
|   |   |   `-- drools_client.py
|   |   `-- api/
|   |-- mate-tech-agent/                  # Agent（LangGraph）
|   |-- mate-tech-llmgw/                  # LLM 路由
|   |-- mate-tech-msg/                    # 消息
|   |-- mate-tech-obs/                    # 可观测
|   |-- mate-tech-ont/                    # Ontology
|   |-- mate-tech-mcp/                    # MCP 协议
|   `-- mate-app-kb/                      # 业务 APP-KB
|-- services/
|   |-- auth-service/                     # JWT + 租户识别
|   `-- api-gateway/                      # 业务网关（如需要）
`-- rules/                                # Drools DRL 规则
    `-- *.drl
```

### 4.3 关键代码模式

**Pydantic v2（严格模式）**：
```python
from pydantic import BaseModel, Field, ConfigDict
from typing import Annotated, Literal

class DocumentMeta(BaseModel):
    model_config = ConfigDict(strict=True, frozen=True)

    id: Annotated[str, Field(min_length=1, max_length=64)]
    tenant_id: Annotated[str, Field(min_length=1, max_length=64)]
    title: Annotated[str, Field(min_length=1, max_length=255)]
    file_type: Literal["pdf", "docx", "pptx", "xlsx", "md", "txt"]
    size_bytes: Annotated[int, Field(ge=0)]
```

**SQLModel（类型安全 ORM）**：
```python
from sqlmodel import SQLModel, Field as SQLField

class Document(SQLModel, table=True):
    __tablename__ = "documents"

    id: str = SQLField(primary_key=True)
    tenant_id: str = SQLField(index=True)
    title: str
    status: Literal["pending", "processing", "ready", "failed"] = "pending"
```

**FastAPI 路由**：
```python
from fastapi import FastAPI, Depends

app = FastAPI(title="Mate Platform API", version="3.0")

def get_flowable() -> FlowableClient:
    return FlowableClient(base_url="http://flowable-rest:8083", auth_token=...)

@app.post("/api/v1/workflow/generate")
async def generate_workflow(
    req: WorkflowRequest,
    flowable: FlowableClient = Depends(get_flowable),
):
    bpmn_xml = await llm_generate_bpmn(req.description)
    deployment = await flowable.deploy_bpmn(bpmn_xml, name=req.description)
    instance = await flowable.start_process(
        process_key=deployment["key"],
        variables=req.variables,
    )
    return {"deploymentId": deployment["id"], "instanceId": instance["id"]}
```

---

## 5. 前端（metaplatform-frontend）

### 5.1 技术栈

| 组件 | 选型 | 版本 |
|---|---|---|
| 包管理 | pnpm | 9.0+ |
| 构建 | Vite | 6.4 |
| UI 框架 | React | 19 |
| 语言 | TypeScript | 5.7（strict） |
| HTTP | axios | 1.18 |
| UI 库 | Semi UI | 2.101 |
| UI 库（次） | Ant Design | 6.0 |
| 流程编辑器 | Flowgram.ai | 1.0.x |
| 图编辑器 | AntV X6 | 3.0 |
| E2E | Playwright | 1.61 |

### 5.2 应用清单

```
metaplatform-frontend/
|-- apps/
|   |-- portal/         # 主入口
|   |-- dashboard/      # 仪表盘
|   |-- ontstudio/      # Ontology 工作台
|   |-- kb/             # 知识库
|   |-- mcphub/         # MCP Hub
|   |-- apphub/         # App 市场
|   |-- arch/           # 架构
|   |-- dw/             # 数据工作台
|   `-- superai/        # Super AI
`-- packages/
    `-- shared/         # 共享组件 / 菜单 / 布局
```

---

## 6. 数据架构

### 6.1 数据归属

| 数据 | 存储 | 拥有服务 | 语言 |
|---|---|---|---|
| 原始文件 | MinIO | DeepParser | Python |
| ParsedDocument | PostgreSQL `rag.*` | Retrieval | Python |
| Chunk + Embedding | PostgreSQL + Milvus | Retrieval | Python |
| GraphRAG 图 | Neo4j `lrag-graph` | LightRAG | Python |
| **BPMN 流程定义** | PostgreSQL `flowable.*` | Flowable Service | Java |
| **BPMN 流程实例** | PostgreSQL `flowable.*` | Flowable Service | Java |
| **规则定义** | PostgreSQL `drools.*` | Drools Service | Java |
| **用户/租户/凭证** | PostgreSQL `keycloak.*` | Keycloak | Java |
| Ontology | Neo4j `tech-ont` | TECH-ONT | Python |
| Citation | PostgreSQL `rag_citation.*` | Retrieval | Python |
| 事件 | Kafka | 各服务 | 多语言 |
| 缓存 | Redis | 各服务 | 多语言 |
| 可观测 | OpenTelemetry -> Loki | 全服务 | 多语言 |

### 6.2 跨服务数据流

```mermaid
flowchart LR
    A[用户上传文件] --> B[DeepParser]
    B --> C[RAGFlow]
    C --> D[Chunk + Embedding]
    D --> E[LightRAG]
    E --> F[KE 流水线]
    F --> G[人工审核]
    G --> H[Ontology Commit]

    I[数据变更] --> J[CDC]
    J --> K[Kafka]
    K --> L[Drools Service]
    L -->|触发| M[AI Agent]

    N[用户请求] --> O[FastAPI]
    O --> P[Flowable Service]
    P --> Q[执行 BPMN]
    Q --> O
```

### 6.3 隔离策略

- **PostgreSQL**：多 schema 隔离（`rag` / `flowable` / `drools` / `keycloak` / `ke`）
- **Neo4j**：3 database 隔离（`tech-ont` / `lrag-graph` / `rag-graphrag`）
- **Milvus**：collection 命名空间
- **跨服务**：通过业务 ID（`docId` / `kbId` / `processKey`）桥接

---

## 7. 网关与服务发现

### 7.1 Traefik（边缘网关）

| 项 | 值 |
|---|---|
| 镜像 | `traefik:v3.x` |
| 部署 | docker-compose 容器 |
| 职责 | TLS 终止 + 路由 + 限流 + 熔断 + traceId 注入 |
| 配置 | 静态（`traefik.yml`）+ 动态（Nacos provider） |
| 服务发现 | Traefik Nacos provider |

**中间件链**：
```
Traefik -> rate-limit -> forward-auth (-> AuthService) -> trace-id 透传 -> Python 服务
```

### 7.2 AuthService（鉴权）

| 项 | 值 |
|---|---|
| 镜像 | `python:3.12` |
| 端口 | 8000 |
| 职责 | JWT 校验 + 租户识别 + headers 注入（X-Tenant-Id / X-User-Id / X-Trace-Id） |
| 调用方式 | Traefik `forwardAuth` 中间件 |
| 不做 | 切流决策（无灰度切流） |

### 7.3 Nacos（服务发现 + 配置中心）

| 项 | 值 |
|---|---|
| 镜像 | `nacos/nacos-server:v2.4.3-slim` |
| 端口 | 8848（HTTP）+ 9848（gRPC） |
| 用途 | 服务注册 + 配置中心 + Traefik provider 数据源 |

---

## 8. 部署架构

### 8.1 docker-compose 服务清单

完整服务清单见 `docker-compose.yml`：

```yaml
# 基础设施
postgres, redis, nacos, minio, milvus, kafka, rabbitmq, loki

# 外部引擎（Java 产品）
keycloak          # :8080
flowable-engine   # :8081
flowable-task     # :8082
flowable-rest     # :8083
kie-server        # :8180

# 网关层
traefik           # :80 / :443
auth-service      # :8000

# Python 主后端（按需启动）
mate-tech-rag, mate-tech-agent, mate-tech-llmgw,
mate-tech-ont, mate-tech-msg, mate-tech-obs, mate-tech-mcp,
mate-app-kb

# AI 服务
ragflow, lightrag

# 开发工具
swagger-editor    # :8083
swagger-ui        # :8084
prism-mock        # :4010
```

### 8.2 端口分配总表

| 端口 | 服务 |
|---|---|
| 80 / 443 | Traefik |
| 5432 | PostgreSQL |
| 6379 | Redis |
| 8848 / 9848 | Nacos |
| 9000 / 9001 | MinIO |
| 19530 / 9091 | Milvus |
| 9092 | Kafka |
| 5672 / 15672 | RabbitMQ |
| 3100 | Loki |
| 4010 | Prism Mock |
| 8000 | AuthService |
| 8080 | Keycloak / 各 Python 服务 |
| 8081 / 8082 / 8083 | Flowable engine / task / rest |
| 8083 | Swagger Editor |
| 8084 | Swagger UI |
| 8180 | KIE Server |
| 9621 / 9622 | RAGFlow / LightRAG |

---

## 9. 监控与可观测性

### 9.1 OpenTelemetry

| 组件 | 用途 |
|---|---|
| Python SDK | `opentelemetry-python` |
| 自动埋点 | FastAPI / SQLAlchemy / httpx / aiokafka |
| traceId 透传 | Traefik headers -> Python OTel context |

### 9.2 Loki（日志聚合）

| 组件 | 用途 |
|---|---|
| 镜像 | `grafana/loki:3.3.2` |
| 收集 | 各服务 stdout -> Promtail / 直接推送 |
| 端口 | 3100 |

### 9.3 关键指标

| 指标 | 目标 |
|---|---|
| API P95 延迟 | < 1.2s |
| RAG 查询 P95 | < 1s |
| BPMN 启动 P95 | < 2s |
| 规则评估 P95 | < 100ms |
| 整体 QPS | 30-50k |

---

## 10. 接口契约（Swagger/OpenAPI 3.1）

### 10.1 工具链

| 环节 | 工具 |
|---|---|
| 规范 | OpenAPI 3.1 |
| 编辑 | Swagger Editor（容器） |
| 文档展示 | Swagger UI（容器） |
| Mock | Prism（Stoplight） |
| CI 校验 | Redocly CLI + oasdiff（breaking change） |
| SDK | openapi-typescript（前端） |

### 10.2 docker-compose 集成

```yaml
swagger-editor    # :8083
swagger-ui        # :8084
prism-mock        # :4010
```

### 10.3 CI 校验（PR 必跑）

```yaml
- Redocly CLI lint（语法 + 规范校验）
- oasdiff breaking change（升级前阻断）
- Redocly bundle（多文件一致性）
```

---

## 11. 性能目标（KPI）

| 指标 | 目标 |
|---|---|
| API 主后端 P95 | < 1.2s |
| RAG 查询 P95 | < 1s |
| 主题查询 P95（LightRAG） | < 3s |
| BPMN 启动 P95 | < 2s |
| 规则评估 P95 | < 100ms |
| 整体 QPS | 30-50k |
| 启动时间 | 3-5s（vs Java 30-60s） |

---

## 12. 风险与缓解

| ID | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | Python 性能瓶颈（高并发） | 黄 | FastAPI + uvloop + granian 组合达 30-50k QPS |
| R2 | Python 类型安全弱 | 黄 | pyright strict + Pydantic v2 + 100% 测试覆盖 |
| R3 | Flowable 服务单点 | 绿 | 2 副本 + HPA + 健康检查 |
| R4 | Drools 规则管理复杂 | 黄 | Git 仓库管理 DRL + 版本控制 |
| R5 | Keycloak 集成复杂度 | 黄 | 业界标准，文档丰富 |
| R6 | 跨语言服务调试困难 | 黄 | 统一 OTel traceId + 标准化日志 + Loki |
| R7 | 单模块迁移失败（无 Java 兜底） | 红 | 充分预发布验证 + 蓝绿部署 + v_{n-1} 保留 7 天 |
| R8 | AI 生态继续演化 | 绿 | Python 路线与生态同步 |

---

## 13. 修订记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-07-27 | v3.0-implementation | 重写：删除决策历史（§ 0/1/9/13/14），精简设计模式，明确每个组件和技术栈；Flowable 7.x -> 8.0 |
| 2026-07-27 | v3.0-implementation.1 | Python 镜像：python:3.12-slim -> python:3.12 (完整版) |
| 2026-07-27 | v3.0-implementation.2 | 服务全景表明确每个组件实际语言（Go/C/Java/Erlang/Python），不再用 - 占位 |

---

## 14. 引用

- 技术栈定稿：`2026-07-27-mate-platform-tech-stack-confirmed.md`
- 交付版本计划：`2026-07-27-mate-platform-delivery-roadmap.md`
- Docker Compose：`docker-compose.yml`
- 前端 monorepo：`metaplatform-frontend/`
- 历史决策文档（已归档）：`archive/2026-07-27-mate-platform-technical-architecture-v2.1.md`