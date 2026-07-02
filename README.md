# MetaPlatform

企业级 AI 中台产品 — 基于 Schema 驱动的低代码平台

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MetaPlatform Architecture                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐           │
│  │   Frontend   │───▶│ Page Generator│───▶│ Ontology     │           │
│  │   (React)    │    │   (Spring)   │    │   Engine     │           │
│  │   :5173      │    │   :8083      │    │   :8090      │           │
│  └──────────────┘    └──────────────┘    └──────────────┘           │
│         │                    │                    │                   │
│         └────────────────────┼────────────────────┘                  │
│                              ▼                                        │
│                    ┌──────────────────┐                              │
│                    │   PostgreSQL     │                              │
│                    │   :5432          │                              │
│                    └──────────────────┘                              │
│                                                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐           │
│  │ Kafka :9092  │    │ Redis :6379  │    │ Neo4j :7474  │           │
│  └──────────────┘    └──────────────┘    └──────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 前置条件

- Docker Desktop (Windows/Mac) 或 Docker Engine (Linux)
- Java 21+ (用于构建 Spring Boot 服务)
- Node.js 18+ (用于前端开发)
- Maven 3.8+ (用于 Java 项目构建)

### 1. 启动基础设施

```bash
# 创建网络
docker network create mp-net

# 启动 PostgreSQL
docker run -d --name mp-pg-spike --network mp-net -p 5432:5432 \
  -e POSTGRES_DB=ontology_meta \
  -e POSTGRES_USER=meta \
  -e POSTGRES_PASSWORD=metaplatform \
  postgres:16

# 启动 Kafka
docker run -d --name mp-kafka-spike --network mp-net -p 9092:9092 \
  -e KAFKA_NODE_ID=1 \
  -e KAFKA_PROCESS_ROLES=broker,controller \
  -e "KAFKA_LISTENERS=PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093" \
  -e "KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092" \
  -e KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER \
  -e "KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT" \
  -e "KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:9093" \
  -e KAFKA_AUTO_CREATE_TOPICS_ENABLE=true \
  -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
  apache/kafka:3.7.0

# 启动 Redis
docker run -d --name mp-redis-local --network mp-net -p 6379:6379 redis:7-alpine
```

### 2. 构建并启动后端服务

```bash
# 设置 JAVA_HOME
export JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"

# 构建 Ontology Engine
cd metaplatform-ontology-engine
mvn clean package -DskipTests
java -jar target/*.jar --server.port=8090

# 构建 Page Generator (新终端)
cd metaplatform-page-generator
mvn clean package -DskipTests
java -jar target/*.jar --server.port=8083
```

### 3. 启动前端

```bash
cd metaplatform-frontend
npm install
npm run dev
```

访问 http://localhost:5173

## 📁 项目结构

```
MetaPlatform/
├── metaplatform-ontology-engine/     # 本体引擎 (EntityType, ObjectType, Instance)
├── metaplatform-page-generator/      # 页面生成器 (Schema → UI)
├── metaplatform-frontend/            # 前端 React 应用
├── metaplatform-platform-base/       # 平台底座 (租户, RBAC, 审计)
├── metaplatform-ai-substrate/        # AI 基座 (LLM Gateway, Embedding)
├── metaplatform-process-engine/      # 流程引擎 (DSL, 状态机, 审批)
├── metaplatform-knowledge/           # 知识库 (RAG, MDM, 向量搜索)
├── metaplatform-dialogue/            # 对话层 (会话, 意图路由)
├── metaplatform-capability-library/  # 能力库 (Pipeline, 能力编排)
├── metaplatform-data-stack/          # 数据栈 (Doris, ClickHouse, Hudi)
└── metaplatform-e2e/                 # 端到端测试
```

## 🎯 核心功能

### 1. Schema 驱动的 UI 生成

```typescript
// 从 ObjectType 自动生成 TABLE/FORM/KANBAN 页面
const page = await generatePage("customer", { pageType: "TABLE" });
// 渲染为前端 JSON
const render = await renderPage(page.id);
```

### 2. 业务对象管理

```typescript
// 创建 ObjectType
const objectType = await createObjectType({
  code: "customer",
  displayName: "客户",
  fieldDefinitions: [
    { name: "name", displayName: "姓名", fieldType: "STRING", required: true },
    { name: "email", displayName: "邮箱", fieldType: "STRING", required: false }
  ],
  lifecycleStates: ["draft", "active", "archived"],
  lifecycleTransitions: [
    { fromState: "draft", toState: "active", name: "activate" }
  ]
});

// 创建实例
const instance = await createInstance(objectType.id, {
  fieldValues: { name: "Alice", email: "alice@example.com" }
});
```

### 3. AI 增强

```typescript
// NL 建模 - 自然语言创建 ObjectType
const objectType = await nlModeling("我需要一个客户管理对象，包含姓名、邮箱、电话");

// AI 字段 - 智能字段值生成
const value = await aiGenerateField("summary", "customer", contextData);
```

## 🔧 API 端点

### Ontology Engine (:8090)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/entity-types` | 创建 EntityType |
| POST | `/api/v1/object-types` | 创建 ObjectType |
| GET | `/api/v1/object-types/code/{code}` | 按 code 查询 ObjectType |
| POST | `/api/v1/object-instances` | 创建 ObjectInstance |
| GET | `/api/v1/object-instances` | 查询实例列表 |
| POST | `/api/v1/object-instances/{id}/transition` | 生命周期流转 |

### Page Generator (:8083)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/pages/generate` | 从 Schema 生成页面配置 |
| POST | `/api/v1/pages/quick-create` | 一步生成 + 渲染 |
| GET | `/api/v1/pages/{id}/render` | 渲染页面为 JSON |
| GET | `/api/v1/page-configs` | 列出所有页面配置 |

## 🧪 测试

### 运行集成测试

```bash
cd metaplatform-e2e
bash e2e/shell/s10_full_stack.sh
```

### 测试覆盖

- S01: 平台底座 (租户/角色/权限)
- S02: AI 基座 (LLM/Embedding/计费)
- S03: 业务对象 (ObjectType/Instance/生命周期)
- S04: 页面生成 (Schema → UI)
- S05: 流程自动化 (定义/激活/任务)
- S06: RAG/MDM (知识库/文档/语义搜索)
- S07: 对话层 (会话/消息/意图)
- S08: 能力库 (能力执行/Pipeline)
- S09: 全链路集成 (跨 6 个模块)
- S10: 全栈集成 (ObjectType → Page → Frontend)

## 📊 当前状态

| 子项目 | 版本 | 状态 | 核心能力 |
|--------|------|------|----------|
| Ontology Engine | v0.3 | ✅ | 25种字段类型 + 校验引擎 + 生命周期守卫 |
| AI Substrate | v0.2 | ✅ | LlmClient + NL建模 + AI字段生成 |
| Knowledge (RAG) | v0.1 | ✅ | 文档摄入 + 分块 + 嵌入 + 语义搜索 |
| Dialogue | v0.1 | ✅ | NL解析器 + 上下文记忆 + 6种意图 |
| Capability Library | v0.2 | ✅ | 12个原子能力 + Pipeline编排 |
| Integration Hub | v0.1 | ✅ | REST/DB/CSV连接器 + 数据同步 |
| Page Generator | v0.2 | ✅ | Schema生成 + TABLE/FORM/KANBAN渲染 |
| Frontend | v0.2 | ✅ | 建模特工场 + 页面设计器 + 流程设计器 |
| Data Stack | v0.2 | ✅ | Doris + ClickHouse + Hudi骨架 |
| Platform Base | v0.1 | ✅ | 多租户 + RBAC 接口 |

### 前端页面清单

| 路径 | 页面 | 功能 |
|------|------|------|
| `/` | 页面配置管理 | 列表/预览/删除 |
| `/workshop` | 建模特工场 | ObjectType CRUD + 字段编辑 + 生命周期 + NL建模 |
| `/designer` | 页面设计器 | 三栏拖拽式 PageConfig 编辑 |
| `/process-designer` | 流程设计器 | SVG画布 + 5种节点 + 连线 |
| `/dialogue` | AI 对话 | 会话管理 + 消息 + 意图识别 |
| `/capabilities` | 能力中心 | 12个能力卡片 + 执行 + 结果 |
| `/integration` | 集成中心 | 连接器管理 + 测试 + 同步 |
| `/objects` | ObjectType | 列表 + 一键生成页面 |
| `/pages/:id` | 页面预览 | Schema渲染 + 实例数据 |

### 后端 API 清单

| 端点前缀 | 服务 | 端点数 |
|----------|------|--------|
| `/api/v1/entity-types` | 本体引擎 | 5 |
| `/api/v1/object-types` | 业务对象 | 6 |
| `/api/v1/object-instances` | 实例管理 | 5 |
| `/api/v1/nl-modeling` | NL建模 | 1 |
| `/api/v1/knowledge` | RAG知识库 | 5 |
| `/api/v1/dialogue` | 对话层 | 6 |
| `/api/v1/capabilities` | 能力库 | 4 |
| `/api/v1/integration` | 集成中心 | 8 |
| `/api/v1/page-configs` | 页面配置 | 4 |
| `/api/v1/pages` | 页面生成 | 3 |

## 📝 开发指南

### 添加新字段类型

1. 在 `FieldDefinition.FieldType` 枚举中添加新类型
2. 更新 `ViewConfigService` 中的映射函数
3. 在前端 `widgetMap.ts` 中添加对应的 widget

### 添加新页面类型

1. 在 `PageType` 枚举中添加新类型
2. 在 `PageGeneratorService` 中添加生成逻辑
3. 在 `PageRenderService` 中添加渲染逻辑
4. 在前端 `SectionRenderer` 中添加渲染组件

## 📄 许可证

MIT License

## 🔗 链接

- [GitHub 仓库](https://github.com/Bert0000000000/MetaPlatform)
- [API 文档](docs/api.md)
- [架构设计](docs/architecture.md)
