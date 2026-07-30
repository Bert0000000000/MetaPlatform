# Mate Platform 技术栈定稿（v3.0 Plan D 配套）

> **版本**：v1.0 | **日期**：2026-07-27 | **状态**：已定稿
>
> **配套文档**：
> - 主架构：`2026-07-27-mate-platform-technical-architecture.md`（v3.0 Plan D，THE ONE DOC）
> - 本文档：v3.0 Plan D 配套的**技术栈确认**，是经过讨论后的最终选型
>
> **适用范围**：Mate Platform 后端 v3.0 重构 + 前端补齐

---

## 0. 与 v3.0 Plan D 的差异（讨论后调整）

| 项 | v3.0 Plan D 原方案 | **最终方案** |
|---|---|---|
| 网关 | Kong / Traefik（Python 友好） | **Traefik**（明确） |
| 网关 + 鉴权 | 单一 FastAPI 网关层 | **Traefik + AuthService**（拆分） |
| 灰度切流 | 按租户 v2.1 ↔ v3.0 | **直接全部 v3.0**（无灰度） |
| Java 服务兜底 | v2.1 Java 作为回滚热备 | **Java 已归档，无兜底**（Python 版本回退） |
| 部署回滚 | 切回 Java | **Traefik 蓝绿/金丝雀切流到 Python 旧版本** |

---

## 1. 后端 monorepo 结构

**单一 Python monorepo**，包管理 `uv`：

```
mate-platform-backend/
├── pyproject.toml                # uv 管理
├── ruff.toml                     # 代码规范
├── pyrightconfig.json            # 类型检查
├── packages/
│   ├── mate-common/              # 公共：DTO、异常、工具、常量
│   ├── mate-tech-rag/            # 技术域：RAG
│   │   ├── clients/              # ← ACL Client 集
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── domain/
│   │   └── api/
│   ├── mate-tech-agent/          # 技术域：Agent（LangGraph）
│   ├── mate-tech-llmgw/          # 技术域：LLM 路由
│   ├── mate-tech-msg/            # 技术域：消息
│   ├── mate-tech-obs/            # 技术域：可观测
│   ├── mate-tech-ont/            # 技术域：Ontology
│   ├── mate-tech-mcp/            # 技术域：MCP 协议
│   └── mate-app-kb/              # 业务域：APP-KB
└── services/
    ├── auth-service/             # 鉴权小服务（JWT + 租户识别）
    └── api-gateway/              # （可选 FastAPI 业务网关）
```

**目录约束**：
- `domain/` 不依赖任何外部包
- `services/` 只依赖 domain + ports
- `repositories/` + `clients/` 实现 ports
- `api/` 调用 services

---

## 2. 后端技术栈（确定项）

| 类别 | 选型 | 版本 | 备注 |
|---|---|---|---|
| 语言 | Python | 3.12+ | |
| 包管理 | uv | latest | Astral |
| Web 框架 | FastAPI | 0.115+ | |
| ASGI 服务器 | uvicorn + uvloop + granian | latest | |
| 数据验证 | Pydantic | v2 | strict + frozen |
| ORM | SQLAlchemy + SQLModel | 2.0 / latest | |
| PG 驱动 | psycopg 或 asyncpg | latest | 异步 |
| Neo4j 驱动 | neo4j Python driver | 5.x | |
| Milvus 驱动 | pymilvus | latest | |
| MinIO 驱动 | minio-py | latest | |
| Redis 驱动 | redis-py | latest | asyncio |
| Kafka 驱动 | aiokafka | latest | |
| HTTP 客户端 | httpx | latest | **唯一** HTTP 客户端 |
| LLM 编排 | LangChain + LlamaIndex | 1.3+ | |
| 多 Agent | LangGraph | 1.2.9+ | |
| MCP | mcp-python-sdk | latest | |
| 类型检查 | pyright | latest | `--strict` 必开 |
| 测试 | pytest + pytest-asyncio + hypothesis | latest | |
| 代码质量 | Ruff | latest | |

**客户端库直接使用，不做 SDK 封装**（单语言栈不需要 SDK 层）：
- 基础设施（pg/milvus/minio/neo4j/redis/kafka/nacos）：现成库直接接入，封装在 Repository 实现里
- **外部业务服务**（Keycloak/RAGFlow/LightRAG/Flowable/Drools 等）：必须写 ACL Client

---

## 3. 架构模式（Hexagonal + DDD + CQRS + Event-Driven）

### 3.1 Hexagonal Architecture（端口与适配器）
- domain（纯 Python，无外部依赖）
- application（用例编排，通过 ports 访问 domain）
- infrastructure（实现 ports：persistence + clients）
- api（FastAPI routes + DTO）

### 3.2 DDD Bounded Context
| Context | 拥有者 |
|---|---|
| Knowledge | mate-tech-rag |
| Ontology | mate-tech-ont |
| Agent | mate-tech-agent |
| Identity | Keycloak（外部） |
| App | mate-app-kb |

### 3.3 CQRS（读写分离）
- Command 路径：强一致、事务性
- Query 路径：可独立优化、读模型

### 3.4 Event-Driven + Outbox
- 跨服务异步事件用 Kafka topic
- 同服务内可用内存 EventBus
- 写操作通过 Outbox 表保证 at-least-once

### 3.5 Saga Pattern（Choreography）
- 智能体编排（S4）、阈值触发（S5b）等长流程
- 无中心协调器，事件驱动

### 3.6 弹性模式（Resilience）
- **Circuit Breaker**：pybreaker 或 polly（用于 Python → Java 外部服务调用）
- **Bulkhead**：httpx 独立连接池（不同外部服务用不同 pool）
- **Retry with Exponential Backoff**：tenacity

---

## 4. ACL Client 集（必须写）

`packages/mate-tech-*/clients/` 下按 Hexagonal 适配器模式实现：

| Client | 封装对象 | 协议 |
|---|---|---|
| `KeycloakClient` | Keycloak IAM | OIDC / REST |
| `RAGFlowClient` | RAGFlow 文档解析 | REST |
| `LightRAGClient` | LightRAG 图检索 | REST |
| `DeerFlowClient` | DeerFlow Multi-Agent | REST（可选） |
| `FlowableClient` | Flowable BPMN | REST（如使用） |
| `DroolsClient` | Drools 规则 | REST（如使用） |

**作用**：把外部服务的"古怪 API"包装为领域方法，**不让外部概念污染领域模型**。

---

## 5. 网关层

### 5.1 边缘网关：Traefik
- **形态**：Go 容器（docker-compose 部署）
- **职责**：TLS 终止 + 路由 + 限流 + 熔断 + traceId 注入
- **服务发现**：Traefik Nacos provider（动态拉取服务列表）

### 5.2 鉴权：AuthService（独立 FastAPI 小服务）
- **职责**：JWT 校验 + 租户识别 + headers 注入
- **接入方式**：Traefik `forwardAuth` 中间件调用
- **不做**：切流决策（已无灰度切流需求）

### 5.3 中间件链
```
Traefik → rate-limit → forward-auth (→ AuthService) → trace-id 透传 → Python 服务
```

### 5.4 不做的事
- ❌ 不做租户级灰度切流
- ❌ 不做 v2.1/v3.0 切流（Java 已归档）
- ✅ 只做蓝绿/金丝雀发布（Traefik 加权路由到 Python 旧版本）

---

## 6. 中间件 / 基础设施（已就位，docker-compose）

| 组件 | 版本 | 端口 | 用途 |
|---|---|---|---|
| PostgreSQL | 16-alpine | 5432 | 主库（多 schema） |
| Redis | 7-alpine | 6379 | 缓存 + 分布式锁 |
| Nacos | v2.4.3-slim | 8848 / 9848 | 服务发现 + 配置中心 |
| MinIO | RELEASE.2024-10-13 | 9000 / 9001 | 对象存储 |
| Milvus | v2.5.0 standalone | 19530 | 向量库 |
| Kafka | 7.8.0 (KRaft) | 9092 | 事件总线 |
| RabbitMQ | 3.13-management | 5672 / 15672 | 任务队列 |
| Loki | 3.3.2 | 3100 | 日志聚合 |

---

## 7. 前端（已就位，metaplatform-frontend）

> **2026-07-29 整改**：原 `apps/{portal,dashboard,kb,mcphub,apphub,arch,dw,superai}` 9 个 SPA 是早期"按业务模块拆分"思路的错位决策，与"前端是 1 套 SPA + 9 个一级菜单"的产品定位不符。已收敛为唯一 `apps/web`(@mate/web),承载全部 9 个菜单模块。其余 8 个 app 的独有页面下沉到 `apps/web/src/pages/{module}/*`,详见 `metaplatform-frontend/scripts/refactor/2026-07-29-monorepo-shrink.sh`。

| 类别 | 选型 | 版本 |
|---|---|---|
| 包管理 | pnpm | 9.0+ |
| 构建 | Vite | 6.4 |
| UI 框架 | React | 19 |
| 语言 | TypeScript | 5.7（strict + noUnusedLocals + noUnusedParameters） |
| HTTP | axios | 1.18(逐步切到 ky/ofetch,BFF 收敛后) |
| UI 库 | Semi UI + Ant Design | 2.101 / 6 |
| 流程编辑器 | Flowgram.ai | 1.0.x |
| 图编辑器 | AntV X6 | 3.0 |
| E2E | Playwright | 1.61 |
| BFF(新增) | Fastify + Vite plugin | 5.x |
| 契约生成 | openapi-typescript + orval | 7.x / 7.x |

**monorepo 结构(v3.0 整改后)**：
```
metaplatform-frontend/
├── apps/
│   ├── web/                    # @mate/web —— 唯一前端入口(SPA,9 个一级菜单)
│   └── bff/                    # @mate/bff —— dev-only 后端聚合层(可选,生产走 Traefik → Python 主后端)
└── packages/
    ├── shared/                 # @mate/shared —— 布局、菜单、AuthGuard、主题、图标
    ├── ui-kit/                 # @mate/ui —— 二次封装的业务组件(待落地)
    ├── api/                    # @mate/api —— OpenAPI 生成 + 客户端(待落地)
    ├── flow/                   # @mate/flow —— 流程编排器封装(待落地)
    ├── graph/                  # @mate/graph —— 图编辑器封装(待落地)
    ├── i18n/                   # @mate/i18n —— 多语言(待落地)
    ├── auth/                   # @mate/auth —— Keycloak OIDC 适配(待落地)
    ├── store/                  # @mate/store —— 状态管理(待落地)
    ├── msw/                    # @mate/msw —— Mock Service Worker 假数据(待落地)
    ├── storybook/              # @mate/storybook —— 组件文档(待落地)
    └── e2e/                    # @mate/e2e —— Playwright 用例(待落地)
```

**SPA 单一入口约束(v3.0 铁律 17)**：
- 浏览器只命中 `apps/web/` 编译产物
- 9 个一级菜单由 `packages/shared/src/PlatformMenu.tsx` 的 `NAV_ITEMS` 定义,严禁在 apps/ 下另建第二套 SPA
- 新增功能模块 = 在 `apps/web/src/pages/{module}/*` 加页面 + 在 `NAV_ITEMS` 加条目

---

## 8. 已确认的外部引擎（W3 启动内容）

> **设计原则**：三个引擎（Keycloak/Flowable/Drools）均为 Java 应用，但作为**第三方成熟产品**独立部署，**不属于 v3.0 主后端的 Java 服务**。Python 主后端通过 ACL Client 接入。

### 8.1 IAM：Keycloak

| 项 | 值 |
|---|---|
| 镜像 | quay.io/keycloak/keycloak:25.0 |
| 端口 | 8080（HTTP），可配 HTTPS |
| 数据库 | PostgreSQL（共用主库，独立 schema keycloak） |
| 启动模式 | start-dev（dev）/ start（prod） |
| Python 接入 | KeycloakClient（OIDC + Admin REST） |
| 库 | python-keycloak 或自研 httpx |

**W3 任务**：
- W3-1.1：Keycloak docker-compose 服务编排
- W3-1.2：Realm/Client/Roles/Users 初始化脚本
- W3-1.3：KeycloakClient（JWT 校验 + 租户提取 + 用户查询）
- W3-1.4：Traefik ↔ Keycloak 路由配置（auth.metaplatform.local）

### 8.2 BPMN：Flowable 8.0

| 项 | 值 |
|---|---|
| 镜像 | flowable/flowable-engine:8.0.x<br>flowable/flowable-task:8.0.x<br>flowable/flowable-rest:8.0.x |
| 端口 | engine:8081 / task:8082 / rest:8083（REST 入口） |
| 数据库 | PostgreSQL（独立 schema flowable） |
| 引擎版本 | **Flowable 8.0**（云原生分布式架构） |
| Python 接入 | FlowableClient（自研 httpx，适配 8.0 REST API） |
| 调用场景 | S4 智能体编排、工作流定义部署、流程启动、任务查询 |

**W3 任务**：
- W3-2.1：Flowable docker-compose 服务编排
- W3-2.2：Flowable 数据库 schema 初始化
- W3-2.3：FlowableClient 实现（deploy_bpmn / start_process / get_my_tasks / complete_task）
- W3-2.4：BPMN XML 模板库（mate-tech-agent/templates/bpmn/）
- W3-2.5：Circuit Breaker 包裹（pybreaker，failure_threshold=5）

### 8.3 规则引擎：Drools（KIE Server）

| 项 | 值 |
|---|---|
| 镜像 | jboss/kie-server:7.74 |
| 端口 | 8180（REST） |
| 数据库 | PostgreSQL（独立 schema drools） |
| 引擎版本 | Drools 8.x |
| Python 接入 | DroolsClient（自研 httpx） |
| 调用场景 | S5b 阈值触发、规则评估、决策表执行 |

**W3 任务**：
- W3-3.1：KIE Server docker-compose 服务编排
- W3-3.2：Drools KieSession / RuleSet 初始化
- W3-3.3：DroolsClient 实现（evaluate_rule / load_rule / execute_decision）
- W3-3.4：规则仓库（mate-tech-msg/rules/*.drl Git 管理）
- W3-3.5：Circuit Breaker 包裹

### 8.4 W3 整体工期

| 子任务 | 工期 | 备注 |
|---|---|---|
| Keycloak 接入 | 5 天 | 含 Realm/Client 配置 |
| Flowable 接入 | 8 天 | 含 BPMN 模板 |
| Drools 接入 | 7 天 | 含规则仓库 |
| **W3 总计** | **2.5 周**（并行） | 三个引擎同时启动 |

### 8.5 docker-compose 集成

三个引擎作为新服务追加到 docker-compose.yml：

`yaml
services:
  keycloak:
    image: quay.io/keycloak/keycloak:25.0
    container_name: mate-keycloak
    command: start-dev --import-realm
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
      DB_VENDOR: POSTGRES
      DB_ADDR: postgres
      DB_DATABASE: metaplatform
      DB_USER: meta
      DB_PASSWORD: meta
      DB_SCHEMA: keycloak
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy

  # Flowable 8.0 - 云原生分布式架构（engine + task + rest）
  flowable-engine:
    image: flowable/flowable-engine:8.0.0
    container_name: mate-flowable-engine
    environment:
      FLOWABLE_DATABASE_URL: jdbc:postgresql://postgres:5432/metaplatform?currentSchema=flowable
      FLOWABLE_DATABASE_USERNAME: meta
      FLOWABLE_DATABASE_PASSWORD: meta
      FLOWABLE_DATABASE_SCHEMA_UPDATE: "true"
    ports:
      - "8081:8080"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:8080/actuator/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 10

  flowable-task:
    image: flowable/flowable-task:8.0.0
    container_name: mate-flowable-task
    environment:
      FLOWABLE_DATABASE_URL: jdbc:postgresql://postgres:5432/metaplatform?currentSchema=flowable
      FLOWABLE_DATABASE_USERNAME: meta
      FLOWABLE_DATABASE_PASSWORD: meta
      FLOWABLE_TASK_URL: http://flowable-engine:8080
    ports:
      - "8082:8080"
    depends_on:
      - flowable-engine

  flowable-rest:
    image: flowable/flowable-rest:8.0.0
    container_name: mate-flowable-rest
    environment:
      FLOWABLE_REST_DATABASE_URL: jdbc:postgresql://postgres:5432/metaplatform?currentSchema=flowable
      FLOWABLE_REST_DATABASE_USERNAME: meta
      FLOWABLE_REST_DATABASE_PASSWORD: meta
      FLOWABLE_REST_TASK_URL: http://flowable-task:8080
      FLOWABLE_REST_ENGINE_URL: http://flowable-engine:8080
    ports:
      - "8083:8080"
    depends_on:
      - flowable-engine
      - flowable-task

  kie-server:
    image: jboss/kie-server:7.74
    container_name: mate-kie
    environment:
      KIE_SERVER_PROFILE: prod
      DB_HOST: postgres
      DB_NAME: metaplatform
      DB_SCHEMA: drools
      DB_USER: meta
      DB_PASSWORD: meta
    ports:
      - "8180:8180"
    depends_on:
      postgres:
        condition: service_healthy
`

### 8.6 Python ACL Client 库选择

| 引擎 | 推荐库 | 备选 |
|---|---|---|
| Keycloak | python-keycloak | 自研 httpx |
| Flowable | 自研 httpx（API 灵活） | — |
| Drools | 自研 httpx（KIE Server REST） | — |

**统一原则**：所有外部服务调用走 **httpx + tenacity（重试）+ pybreaker（熔断）**。

---

## 9. 开发与发布工作流

### 9.1 蓝绿发布（无 Java 兜底）
```
v_n (当前版本)  ← 100% 流量
v_{n-1} (上一版本) ← 0% 流量，保留 7 天可回退
v_{n+1} (候选版本) ← 0% 流量，预发布验证
```

### 9.2 金丝雀（可选）
- 新版本先 5% 流量观察 24h
- 无异常 → 100%
- 有异常 → 切回 v_{n-1}

### 9.3 模块迁移顺序（按风险从低到高）
1. tech-msg（消息）🟢
2. tech-obs（可观测）🟢
3. tech-mcp（MCP）🟢
4. tech-ont（Ontology）🟡
5. tech-llmgw（LLM 路由）🟡
6. tech-rag（RAG 核心）🔴
7. tech-agent（Agent）🔴
8. app-kb（业务聚合）🔴

---


## 9. API 接口管理（Swagger / OpenAPI 3.1）

> **原则**：OpenAPI 3.1 是 API 契约的**单一真相源**，Swagger 工具链负责编辑、展示、校验、Mock、SDK 生成。

### 9.1 工具链

| 环节 | 工具 | 备注 |
|---|---|---|
| 规范 | **OpenAPI 3.1** | 不是 Swagger 2.0，兼容 JSON Schema 2020-12 |
| 编辑 | **Swagger Editor**（Web 端） | 本地可用 `swaggerapi/swagger-editor` 容器 |
| 文档展示 | **Swagger UI** | 自托管，容器化 |
| CI 校验 | **swagger-cli**（Redocly） | PR 必跑 |
| Mock 服务 | **Prism**（Stoplight） | 协议级 Mock，自动按 OpenAPI 响应 |
| SDK 生成 | **openapi-generator** | Python/Java/TS 多端（按需） |
| 变更对比 | **oasdiff** | 检测 breaking change |

### 9.2 目录结构

```
mate-platform-backend/
└── contracts/
    └── openapi/
        ├── shared/
        │   └── common.yaml          # 共享 schemas（错误响应、分页、租户信息）
        ├── iam.yaml                 # IAM 接口（外部 Keycloak 内部 API）
        ├── knowledge.yaml           # KB / RAG 业务接口
        ├── ontology.yaml            # Ontology 业务接口
        ├── agent.yaml               # Agent / LangGraph 接口
        ├── llmgw.yaml               # LLM 路由接口
        ├── msg.yaml                 # 消息接口
        ├── obs.yaml                 # 可观测接口
        ├── mcp.yaml                 # MCP 协议接口
        └── bpmn.yaml                # Flowable 封装接口
        └── rules.yaml               # Drools 封装接口
```

### 9.3 Swagger UI 自托管（docker-compose 新增）

```yaml
swagger-editor:
  image: swaggerapi/swagger-editor:latest
  container_name: mate-swagger-editor
  ports:
    - "8083:8080"
  volumes:
    - ./contracts/openapi:/tmp/openapi:ro

swagger-ui:
  image: swaggerapi/swagger-ui:latest
  container_name: mate-swagger-ui
  environment:
    URLS: >-
      [
        {url:"/openapi/iam.yaml",name:"IAM"},
        {url:"/openapi/knowledge.yaml",name:"Knowledge"},
        {url:"/openapi/ontology.yaml",name:"Ontology"},
        {url:"/openapi/agent.yaml",name:"Agent"},
        {url:"/openapi/llmgw.yaml",name:"LLM Gateway"},
        {url:"/openapi/msg.yaml",name:"Messaging"},
        {url:"/openapi/obs.yaml",name:"Observability"},
        {url:"/openapi/mcp.yaml",name:"MCP"},
        {url:"/openapi/bpmn.yaml",name:"BPMN/Flowable"},
        {url:"/openapi/rules.yaml",name:"Rules/Drools"}
      ]
    PORT: 8080
  ports:
    - "8084:8080"
  volumes:
    - ./contracts/openapi:/usr/share/nginx/html/openapi:ro

prism-mock:
  image: stoplight/prism:latest
  container_name: mate-prism-mock
  command: >
    mock
    -p 4010
    -h 0.0.0.0
    --dynamic
    /tmp/openapi/knowledge.yaml
  ports:
    - "4010:4010"
  volumes:
    - ./contracts/openapi:/tmp/openapi:ro
```

**访问入口**：
- Swagger Editor：`http://localhost:8083`
- Swagger UI：`http://localhost:8084`
- Prism Mock：`http://localhost:4010`

### 9.4 CI 校验流水线

每次 OpenAPI 文件 PR 必须过以下校验：

```yaml
# .github/workflows/openapi-validate.yml
name: OpenAPI Validate
on:
  pull_request:
    paths:
      - 'contracts/openapi/**'
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: 校验 OpenAPI 规范
        run: |
          npx -y @redocly/cli lint contracts/openapi/**/*.yaml
      - name: 检测 Breaking Change
        run: |
          npx -y oasdiff breaking \
            contracts/openapi/knowledge.yaml \
            origin/main/contracts/openapi/knowledge.yaml
      - name: 校验多文件一致性
        run: |
          npx -y @redocly/cli bundle contracts/openapi/knowledge.yaml \
            --output contracts/openapi/knowledge.bundled.yaml
```

### 9.5 SDK 生成（按需启用）

| 场景 | 工具 | 输出 |
|---|---|---|
| 前端 TS 类型 | `openapi-typescript` | `packages/shared/types/knowledge.d.ts` |
| 后端 Python Server Stub | `openapi-generator-cli` | `packages/mate-tech-rag/api/server/` |
| ACL Client 接口 | `openapi-generator-cli` | `packages/mate-tech-rag/clients/_types.py` |
| Java（如需对外暴露 SDK）| `openapi-generator-cli` | 外部依赖 |

**原则**：v3.0 是单 Python 主后端，**不强制 codegen**；只在 TS 类型和 Python Server Stub 用，Java SDK 不需要（Java 引擎是外部进程）。

### 9.6 版本管理

- OpenAPI 文件走 **Git**（与代码同仓库 `contracts/openapi/`）
- 重大变更走 PR + Review
- 历史版本保留（`contracts/openapi/v2/` 归档）
- 当前版本走 `contracts/openapi/*.yaml`

### 9.7 W1 任务清单（最终版）

| # | 任务 | 工期 |
|---|---|---|
| W1-1 | 建 `mate-platform-backend/contracts/openapi/` 目录 + shared schemas | 2 天 |
| W1-2 | Swagger Editor + Swagger UI + Prism docker-compose 集成 | 2 天 |
| W1-3 | 写 IAM / Knowledge / Ontology 三个核心域 OpenAPI 初稿 | 5 天 |
| W1-4 | CI 校验流水线（GitHub Actions） | 1 天 |
| W1-5 | OpenAPI ↔ Python Pydantic 模型对齐（手写或 codegen） | 3 天 |
| **W1 总计** | | **2 周** |

## 10. 不在本定稿范围（独立决策）

- **前端 9 apps 补齐对接**：依赖 OpenAPI + Mock，独立 W6
- **OpenAPI 契约治理**：独立 W1
- **CI/CD 流水线**：独立设计（建议 GitHub Actions）
- **监控告警体系**：依赖 Loki + Prometheus + OTel，独立设计
- **密钥管理**：建议 HashiCorp Vault 或 K8s Secrets

---

## 11. 修订记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-07-27 | v1.0 | 初稿（基于 2026-07-27 多轮讨论定稿） |
| 2026-07-27 | v1.1 | 拍板 IAM=Keycloak / BPMN=Flowable / Rule=Drools；补充三个引擎的部署细节 |
| 2026-07-27 | v1.2 | 新增 § 9 API 接口管理（Swagger/OpenAPI 3.1）整节 |
| 2026-07-28 | v1.3 | 追加附录 A：v3.1 Data-Ready Baseline（Flink / Airflow / Paimon / Iceberg / Trino / StarRocks / 治理栈），不破坏 v3.0 技术栈 |

---

## 附录 A：v3.1 Data-Ready Baseline（2026-07-28 同步）

> 本附录为 v3.0 技术栈的增量补丁，详细设计见 `docs/superpowers/specs/2026-07-28-mate-platform-big-data-etl-design.md`。
> 增量内容为 v3.0 主后端的扩展，不改写既有章节，不动 Python 主后端结构，不引入 Java 业务服务。

### A.1 新增大数据与湖仓技术栈

| 类别 | 选型 | 版本 | 备注 |
|---|---|---|---|
| 批流计算 | Apache Flink | 1.19 | Application Mode + Flink Kubernetes Operator |
| CDC | Flink CDC | 3.x | PostgreSQL / MySQL / Oracle / SQL Server |
| 调度 | Apache Airflow | 3.0 | KubernetesExecutor + CeleryExecutor 备选 |
| 消息总线 | Apache Kafka（KRaft） | 3.7 | 与 v3.0 共用，扩副本与清理策略 |
| Schema Registry | Apicurio Registry | 2.6 | Avro / Protobuf / JSON Schema |
| 实时湖表 | Apache Paimon | 0.9 | ODS/DWD 主键 + 实时变更 |
| 开放湖表 | Apache Iceberg | 1.5 | DWS/ADS 共享数据产品 |
| 即席查询 | Trino | 455 | 跨 Paimon/Iceberg/外部源 SQL |
| OLAP Serving | StarRocks | 3.3 | 指标、报表、物化视图、Data API |
| 运行时目录 | Apache Gravitino | 0.7 | 物理 Catalog 联邦 |
| 治理目录 | OpenMetadata | 1.4 | Owner、Glossary、血缘、质量 |
| 运行血缘 | OpenLineage + Marquez | 0.50 | 统一跨引擎血缘事件 |
| 批量质量 | Great Expectations | 0.18 | 质量规则 + 对账 |
| 访问策略 | Apache Ranger | 2.4 | 行列权限、动态脱敏、审计 |
| 密钥 | OpenBao | 1.15 | 连接器密钥 + 动态凭证 |
| Python SDK | apache-airflow-providers-apache-flink | 1.5 | Airflow 提交 Flink 作业 |
| Python 客户端 | pyflink | 1.19 | PyFlink 作业构建 |
| Python ACL | trino-python-client / paimon-python / starrocks-connector | latest | 控制面 Adapter |

### A.2 兼容性约束

- 与 Python 3.12 + httpx + Pydantic v2 兼容；所有新组件通过 ACL Adapter 接入。
- 旧 Java `docs/legacy/tech-java-legacy/TECH-DATA` 不恢复上线，仅作为 `/v1/data/*` 契约与领域模型的迁移参考。
- 浏览器不直连上述引擎，统一走 Traefik + BFF 暴露的 `/v1/data/*` 与 `/api/v1/data/*`。

### A.3 与既有组件的边界

| 既有组件 | 职责不变 | 增量能力 |
|---|---|---|
| Traefik | 边缘网关、路由、TLS、限流 | 追加 `/v1/data/*` 路由表 |
| Keycloak | IAM/SSO | 追加服务账号与 Ranger 同步 |
| Flowable 8 | BPMN、人工审批 | 承接 Pipeline 发布审批与数据访问审批 |
| Nacos | 服务发现 + 配置 | 注册 mate-tech-data 与 Engine Adapter |
| Kafka | 事件总线 | 扩展为数据接入总线与领域事件 |
| MinIO | 对象存储 | 兼顾 Landing 与湖表文件存储 |
| PostgreSQL | 主库 | 增加 mate-tech-data 与数据治理 schema |
| Redis | 缓存 + 分布式锁 | 增加 Query Gateway 限流与幂等键 |

### A.4 同步位置

| v3.0 章节 | 增量 |
|---|---|
| §2 后端技术栈 | 增加 A.1 大数据栈条目 |
| §8 已确认的外部引擎 | 追加 Flink、Airflow、Paimon、Iceberg、Trino、StarRocks |
| §9 开发与发布工作流 | 增加数据 Pipeline 编译/发布流程 |

详细正文重写交由实施计划阶段以保持改动可回滚。

## 12. 引用

- 主架构：`2026-07-27-mate-platform-technical-architecture.md`（v3.0 Plan D）
- Docker Compose：`docker-compose.yml`
- 前端 monorepo：`metaplatform-frontend/`
- 启动脚本：`scripts/start-services/`