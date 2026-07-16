# SPEC - RAG 引擎服务 API 规范（TECH-RAG）

> 文档版本：v1.0
> 文档日期：2026-07-16
> 适用模块：TECH-RAG（RAG Engine Service）
> 维护方：Mate Platform 平台架构组
> 状态：定稿

---

## 1. 服务概述

### 1.1 服务定位

TECH-RAG 是 Mate Platform 的**企业级知识检索增强（Retrieval-Augmented Generation）引擎**，为平台所有 AI 应用提供统一的知识库管理与检索能力。作为 AI 能力底座的核心组件，TECH-RAG 将知识从"静态存储"转化为"可检索、可推理、可引用"的动态资产。

核心职责：

- **知识库管理**：知识库 CRUD、知识库配置（分块策略、Embedding 模型选择、检索参数调优）
- **文档管理**：文档上传、文档解析（PDF / Word / PPT / 网页 / 音视频转写）、文档分块、文档状态管理
- **Embedding 服务**：文本向量化、批量向量化、Embedding 模型管理与切换
- **检索服务**：向量检索、关键词检索（BM25）、混合检索（多路召回 + 重排序）、图谱检索增强
- **检索增强**：基于 Ontology 的实体链接与知识补全、上下文组装、引用来源生成
- **知识库统计**：文档数量、向量数量、检索命中率、检索延迟分析

TECH-RAG 与 TECH-ONT 本体引擎深度集成：通过 TECH-ONT 提供的实体、关系、属性语义对检索结果进行实体链接与知识补全，实现基于本体语义的精准检索增强。所有 LLM 调用（Embedding 生成、Rerank 排序）通过 TECH-LLMGW 统一路由，不直接访问模型 API。

### 1.2 技术栈

| 层级 | 技术 | 版本 | 用途 |
|---|---|---|---|
| 语言/框架 | Python + FastAPI | 3.13 / 0.115 | 服务主体，异步高性能 API |
| AI 编排 | LangChain | 0.3 | 文档加载、分块、Embedding 编排 |
| 向量数据库 | Milvus | 2.5 | 向量存储与 ANN 检索（RaBitQ 量化、GPU 索引） |
| 关系数据库 | PostgreSQL | 17 | 知识库/文档/分块元数据、统计数据 |
| 对象存储 | MinIO | - | 原始文档文件存储 |
| 缓存 | Redis | 7.4 | 检索结果缓存、Embedding 缓存、热点知识缓存 |
| 消息队列 | Kafka | 3.9 | 文档处理事件、检索事件（Outbox 模式） |
| 可观测性 | OpenTelemetry + Prometheus | 1.45 / 3.x | trace_id 传播、指标采集 |
| LLM 网关 | TECH-LLMGW | - | Embedding 生成、Rerank 模型调用 |
| 任务编排 | Celery + Redis | 5.4 / 7.4 | 异步文档解析、批量向量化任务 |

### 1.3 上游依赖

| 上游服务 | 依赖关系 | 说明 |
|---|---|---|
| TECH-DATA | 强依赖 | 提供外部数据源接入，TECH-RAG 可从 TECH-DATA 同步的结构化/非结构化数据自动导入知识库 |
| TECH-LLMGW | 强依赖 | 所有 Embedding 生成、Rerank 排序通过 TECH-LLMGW 统一调用，不直接访问模型 API |
| TECH-ONT | 强依赖 | 基于本体语义进行实体链接、知识补全、图谱检索增强；知识库可绑定本体概念域 |
| TECH-IAM | 强依赖 | 用户认证、租户隔离、权限校验 |
| TECH-MSG | 弱依赖 | Kafka 消息基础设施 |

### 1.4 下游消费方

| 下游服务/应用 | 消费方式 | 说明 |
|---|---|---|
| APP-SUPERAI | REST API | 超级 AI 对话中调用检索服务获取知识上下文，增强回答准确性 |
| APP-DW | REST API | 数字员工执行知识检索任务，支持基于知识库的智能问答 |
| TECH-MCP | REST API | MCP Server 暴露知识库检索作为 Tool，供外部 MCP Client 调用 |
| TECH-AGENT | REST API | Agent 框架在推理过程中调用检索服务获取知识上下文 |
| APP-ONTSTUDIO | REST API | 本体论引擎前端集成知识库管理，展示本体与知识库的关联 |
| APP-APPHUB | REST API | 低代码应用中嵌入知识检索能力组件 |
| APP-DASHBOARD | REST API | 仪表盘展示知识库统计、检索命中率、延迟分析 |

### 1.5 核心能力清单

| 能力域 | 说明 |
|---|---|
| 知识库管理 | 知识库的创建、查询、更新、删除，分块策略与 Embedding 模型配置 |
| 文档管理 | 文档上传、解析、分块、状态管理、重新解析、批量导入 |
| Embedding 服务 | 单条/批量文本向量化，Embedding 模型列表与切换 |
| 向量检索 | 基于 Milvus 的 ANN 向量相似度检索，支持余弦/内积/L2 距离 |
| 关键词检索 | 基于 BM25 算法的全文关键词检索 |
| 混合检索 | 多路召回（向量 + 关键词）+ Rerank 重排序，支持权重配置 |
| 图谱增强检索 | 基于 Ontology 知识图谱的实体链接与关系扩展检索 |
| 检索增强 | 实体链接、上下文组装、引用来源生成、知识补全 |
| 知识库统计 | 文档/向量数量统计、检索命中率、检索延迟分布分析 |

---

## 2. 通用约定

### 2.1 API 路径前缀

所有 TECH-RAG API 路径统一前缀：

```
/api/v1/rag
```

完整路径示例：`/api/v1/rag/knowledge-bases`、`/api/v1/rag/knowledge-bases/{kbId}/documents`、`/api/v1/rag/retrieve/hybrid`

### 2.2 请求/响应格式

#### 2.2.1 Content-Type

- JSON 请求体：`application/json; charset=UTF-8`
- 文件上传：`multipart/form-data`
- 响应体：`application/json; charset=UTF-8`

#### 2.2.2 统一响应体结构

所有接口返回统一的响应体结构：

```json
{
  "code": 0,
  "message": "success",
  "data": { },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| code | integer | 业务状态码，`0` 表示成功，非 `0` 表示业务错误 |
| message | string | 状态描述信息 |
| data | object \| array \| null | 业务数据载荷 |
| traceId | string | 链路追踪 ID，全链路唯一，用于排障 |

#### 2.2.3 分页响应结构

列表类接口的分页数据封装：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [ ],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### 2.3 认证方式

#### 2.3.1 Bearer Token

通过 `Authorization` 请求头携带 JWT：

```
Authorization: Bearer <jwt_token>
```

JWT Payload 包含：`sub`（用户ID）、`tenantId`（租户ID）、`roles`（角色列表）、`exp`（过期时间）。

#### 2.3.2 API Key（服务间调用）

通过 `X-API-Key` 请求头携带服务间调用凭证：

```
X-API-Key: <api_key>
X-Tenant-Id: <tenant_id>
```

服务间 API Key 由 TECH-IAM 统一签发，绑定调用方服务标识与权限范围。

### 2.4 请求头约定

| 请求头 | 必填 | 说明 |
|---|---|---|
| Authorization | 是 | Bearer Token（与 X-API-Key 二选一） |
| X-API-Key | 否 | 服务间调用 API Key（与 Authorization 二选一） |
| X-Trace-Id | 否 | 链路追踪 ID，未传则服务端自动生成 |
| X-Tenant-Id | 是 | 租户 ID |
| X-Request-Id | 否 | 请求唯一标识，用于幂等控制 |
| Content-Type | 是 | `application/json;charset=UTF-8` 或 `multipart/form-data` |

### 2.5 错误码定义

#### 2.5.1 HTTP 状态码

| HTTP 状态码 | 含义 | 使用场景 |
|---|---|---|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 400 | Bad Request | 请求参数校验失败 |
| 401 | Unauthorized | 未认证或认证失效 |
| 403 | Forbidden | 权限不足 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突（唯一性约束） |
| 422 | Unprocessable Entity | 业务逻辑校验失败 |
| 429 | Too Many Requests | 限流 |
| 500 | Internal Server Error | 服务内部错误 |
| 503 | Service Unavailable | 依赖服务不可用 |

#### 2.5.2 业务错误码

| 错误码 | HTTP 状态码 | 错误标识 | 说明 |
|---|---|---|---|
| 0 | 200 | SUCCESS | 成功 |
| 40001 | 400 | INVALID_PARAM | 请求参数校验失败 |
| 40002 | 400 | INVALID_JSON | 请求体 JSON 格式错误 |
| 40003 | 400 | MISSING_REQUIRED_FIELD | 缺少必填字段 |
| 40004 | 400 | INVALID_FIELD_VALUE | 字段值不合法 |
| 40005 | 400 | UNSUPPORTED_FILE_TYPE | 不支持的文件类型 |
| 40006 | 400 | FILE_TOO_LARGE | 文件大小超过限制 |
| 40101 | 401 | TOKEN_EXPIRED | Token 已过期 |
| 40102 | 401 | TOKEN_INVALID | Token 无效 |
| 40103 | 401 | API_KEY_INVALID | API Key 无效 |
| 40301 | 403 | PERMISSION_DENIED | 权限不足 |
| 40302 | 403 | TENANT_MISMATCH | 租户不匹配 |
| 40401 | 404 | KB_NOT_FOUND | 知识库不存在 |
| 40402 | 404 | DOCUMENT_NOT_FOUND | 文档不存在 |
| 40403 | 404 | CHUNK_NOT_FOUND | 文档分块不存在 |
| 40404 | 404 | EMBEDDING_MODEL_NOT_FOUND | Embedding 模型不存在 |
| 40405 | 404 | TASK_NOT_FOUND | 异步任务不存在 |
| 40901 | 409 | KB_ALREADY_EXISTS | 知识库名称已存在 |
| 40902 | 409 | DOCUMENT_ALREADY_EXISTS | 文档已存在（文件哈希重复） |
| 40903 | 409 | KB_NOT_EMPTY | 知识库非空，无法删除 |
| 40904 | 409 | EMBEDDING_MODEL_IN_USE | Embedding 模型正在使用中，无法切换 |
| 42201 | 422 | KB_NOT_READY | 知识库未就绪（无可用向量） |
| 42202 | 422 | DOCUMENT_PARSE_FAILED | 文档解析失败 |
| 42203 | 422 | EMBEDDING_FAILED | 向量化失败 |
| 42204 | 422 | RETRIEVE_FAILED | 检索失败 |
| 42205 | 422 | DOCUMENT_NOT_READY | 文档未就绪（未完成解析/向量化） |
| 42206 | 422 | CHUNK_STRATEGY_INVALID | 分块策略参数不合法 |
| 42207 | 422 | EMBEDDING_DIM_MISMATCH | 向量维度与知识库配置不匹配 |
| 42208 | 422 | ONTOLOGY_LINK_FAILED | 本体实体链接失败 |
| 42901 | 429 | RATE_LIMIT_EXCEEDED | 限流触发 |
| 50001 | 500 | INTERNAL_ERROR | 服务内部错误 |
| 50002 | 500 | DATABASE_ERROR | 数据库操作失败 |
| 50003 | 500 | MILVUS_ERROR | 向量数据库操作失败 |
| 50004 | 500 | MINIO_ERROR | 对象存储操作失败 |
| 50005 | 500 | KAFKA_PUBLISH_FAILED | Kafka 消息发布失败 |
| 50006 | 500 | LLMGW_ERROR | LLM 网关调用失败（Embedding/Rerank） |
| 50007 | 500 | ONT_SERVICE_ERROR | 本体引擎服务调用失败 |
| 50008 | 500 | CELERY_ERROR | 异步任务执行失败 |
| 50301 | 503 | SERVICE_UNAVAILABLE | 服务暂不可用 |
| 50302 | 503 | LLMGW_UNAVAILABLE | LLM 网关不可用 |

**错误响应示例**：

```json
{
  "code": 40401,
  "message": "知识库不存在: kbId=kb-001",
  "data": null,
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### 2.6 分页参数约定

所有列表接口支持以下通用查询参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| page | integer | 否 | 1 | 页码，从 1 开始 |
| pageSize | integer | 否 | 20 | 每页条数，最大 100 |
| sort | string | 否 | createdAt:desc | 排序字段，格式 `field:asc\|desc`，支持多字段逗号分隔 |
| keyword | string | 否 | - | 关键词搜索（模糊匹配名称/描述） |

### 2.7 trace_id 传播

#### 2.7.1 入站传播

- 请求方通过 HTTP Header `X-Trace-Id` 传入 trace_id
- 若未传入，TECH-RAG 自动生成 UUID v4 作为 trace_id
- trace_id 写入 Python `contextvars` 上下文变量，贯穿整个请求处理链路（含 async 任务）

#### 2.7.2 出站传播

- 所有响应体的 `traceId` 字段携带当前请求的 trace_id
- 所有 Kafka 消息（Outbox 模式）的 Header 包含 `X-Trace-Id`
- 调用下游服务（TECH-LLMGW、TECH-ONT）时透传 `X-Trace-Id` Header
- Celery 异步任务通过 `task_headers` 传递 trace_id

#### 2.7.3 DLQ 记录

- 消费失败的 Kafka 消息写入 DLQ 时，记录体必须包含 `traceId` 字段
- DLQ 消息重试上限：3 次，超过后进入死信存储

### 2.8 幂等控制

- 写操作支持幂等：客户端传递 `X-Request-Id` 请求头
- 服务端基于 `(tenantId, requestType, requestId)` 做幂等去重
- 幂等窗口：24 小时
- 同一 `X-Request-Id` 重复请求返回首次结果

---

## 3. API 接口详情

### 3.1 知识库管理 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/rag/knowledge-bases` | 创建知识库 |
| GET | `/api/v1/rag/knowledge-bases` | 知识库列表（分页） |
| GET | `/api/v1/rag/knowledge-bases/{kbId}` | 获取知识库详情 |
| PUT | `/api/v1/rag/knowledge-bases/{kbId}` | 更新知识库 |
| DELETE | `/api/v1/rag/knowledge-bases/{kbId}` | 删除知识库 |
| PUT | `/api/v1/rag/knowledge-bases/{kbId}/chunk-strategy` | 配置分块策略 |
| GET | `/api/v1/rag/knowledge-bases/{kbId}/chunk-strategy` | 获取分块策略 |
| PUT | `/api/v1/rag/knowledge-bases/{kbId}/embedding-model` | 配置 Embedding 模型 |
| GET | `/api/v1/rag/knowledge-bases/{kbId}/embedding-model` | 获取 Embedding 模型配置 |
| PUT | `/api/v1/rag/knowledge-bases/{kbId}/retrieval-config` | 配置检索参数 |
| GET | `/api/v1/rag/knowledge-bases/{kbId}/retrieval-config` | 获取检索参数配置 |

---

#### 3.1.1 创建知识库

**POST** `/api/v1/rag/knowledge-bases`

创建一个新的知识库，创建时需指定分块策略与 Embedding 模型。知识库创建后自动在 Milvus 中创建对应的 Collection。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | 知识库名称，租户内唯一，1-128 字符 |
| description | string | 否 | 知识库描述，最长 1024 字符 |
| embeddingModelId | string | 是 | Embedding 模型 ID（从 Embedding 模型列表中选择） |
| chunkStrategy | object | 是 | 分块策略配置 |
| chunkStrategy.type | string | 是 | 分块类型：`FIXED_SIZE`（固定大小）/ `RECURSIVE`（递归分块）/ `SENTENCE`（按句分块）/ `MARKDOWN`（Markdown 结构分块）/ `SEMANTIC`（语义分块） |
| chunkStrategy.chunkSize | integer | 否 | 分块大小（字符数），默认 512，范围 100-4096 |
| chunkStrategy.chunkOverlap | integer | 否 | 分块重叠（字符数），默认 50，范围 0-512 |
| chunkStrategy.separator | string | 否 | 自定义分隔符（`RECURSIVE` 类型时有效），默认 `\n\n` |
| chunkStrategy.metadata | object | 否 | 分块策略扩展参数 |
| ontologyConceptCode | string | 否 | 绑定的本体概念编码，用于图谱增强检索 |
| retrievalConfig | object | 否 | 检索参数配置（可选，后续可修改） |
| retrievalConfig.metricType | string | 否 | 向量距离度量：`COSINE`（默认）/ `IP`（内积）/ `L2` |
| retrievalConfig.topK | integer | 否 | 默认召回数量，默认 10，范围 1-100 |
| retrievalConfig.scoreThreshold | number | 否 | 相似度分数阈值，默认 0.0，范围 0.0-1.0 |
| metadata | object | 否 | 扩展元数据，key-value 结构 |

**请求示例**

```json
{
  "name": "产品技术文档库",
  "description": "包含 Mate Platform 所有产品技术文档、API 手册、架构设计文档",
  "embeddingModelId": "emb-doubao-large-1536",
  "chunkStrategy": {
    "type": "RECURSIVE",
    "chunkSize": 512,
    "chunkOverlap": 50,
    "separator": "\n\n"
  },
  "ontologyConceptCode": "TechnicalDocument",
  "retrievalConfig": {
    "metricType": "COSINE",
    "topK": 10,
    "scoreThreshold": 0.75
  },
  "metadata": {
    "owner": "platform-team",
    "domain": "TECH"
  }
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "kbId": "kb-product-tech-001",
    "name": "产品技术文档库",
    "description": "包含 Mate Platform 所有产品技术文档、API 手册、架构设计文档",
    "status": "ACTIVE",
    "embeddingModelId": "emb-doubao-large-1536",
    "embeddingModelName": "Doubao Large 1536",
    "embeddingDimension": 1536,
    "chunkStrategy": {
      "type": "RECURSIVE",
      "chunkSize": 512,
      "chunkOverlap": 50,
      "separator": "\n\n"
    },
    "ontologyConceptCode": "TechnicalDocument",
    "retrievalConfig": {
      "metricType": "COSINE",
      "topK": 10,
      "scoreThreshold": 0.75
    },
    "milvusCollection": "rag_kb_product_tech_001",
    "documentCount": 0,
    "chunkCount": 0,
    "vectorCount": 0,
    "metadata": {
      "owner": "platform-team",
      "domain": "TECH"
    },
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "updatedAt": "2026-07-16T10:30:00.000+08:00",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | name 为空或格式不合法 |
| 40003 | embeddingModelId / chunkStrategy 缺失 |
| 40404 | embeddingModelId 指向的模型不存在 |
| 40901 | 知识库名称已存在 |
| 42206 | 分块策略参数不合法（如 chunkSize 超出范围） |
| 50003 | Milvus Collection 创建失败 |
| 50006 | Embedding 模型校验调用 LLMGW 失败 |
| 40301 | 无创建知识库权限 |

---

#### 3.1.2 知识库列表（分页）

**GET** `/api/v1/rag/knowledge-bases`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序，默认 `createdAt:desc` |
| keyword | string | 否 | 关键词搜索（匹配名称/描述） |
| status | string | 否 | 按状态过滤：`ACTIVE` / `INACTIVE` |
| embeddingModelId | string | 否 | 按 Embedding 模型过滤 |
| ontologyConceptCode | string | 否 | 按绑定本体概念过滤 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "kbId": "kb-product-tech-001",
        "name": "产品技术文档库",
        "description": "包含 Mate Platform 所有产品技术文档",
        "status": "ACTIVE",
        "embeddingModelId": "emb-doubao-large-1536",
        "embeddingModelName": "Doubao Large 1536",
        "embeddingDimension": 1536,
        "chunkStrategyType": "RECURSIVE",
        "ontologyConceptCode": "TechnicalDocument",
        "documentCount": 128,
        "chunkCount": 4520,
        "vectorCount": 4520,
        "totalSizeBytes": 536870912,
        "createdAt": "2026-07-16T10:30:00.000+08:00",
        "updatedAt": "2026-07-16T14:00:00.000+08:00"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | 分页参数不合法 |
| 40301 | 无权查看该租户的知识库 |

---

#### 3.1.3 获取知识库详情

**GET** `/api/v1/rag/knowledge-bases/{kbId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "kbId": "kb-product-tech-001",
    "name": "产品技术文档库",
    "description": "包含 Mate Platform 所有产品技术文档、API 手册、架构设计文档",
    "status": "ACTIVE",
    "embeddingModelId": "emb-doubao-large-1536",
    "embeddingModelName": "Doubao Large 1536",
    "embeddingDimension": 1536,
    "chunkStrategy": {
      "type": "RECURSIVE",
      "chunkSize": 512,
      "chunkOverlap": 50,
      "separator": "\n\n"
    },
    "ontologyConceptCode": "TechnicalDocument",
    "retrievalConfig": {
      "metricType": "COSINE",
      "topK": 10,
      "scoreThreshold": 0.75
    },
    "milvusCollection": "rag_kb_product_tech_001",
    "documentCount": 128,
    "chunkCount": 4520,
    "vectorCount": 4520,
    "totalSizeBytes": 536870912,
    "metadata": {
      "owner": "platform-team",
      "domain": "TECH"
    },
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "updatedAt": "2026-07-16T14:00:00.000+08:00",
    "createdBy": "user-001",
    "updatedBy": "user-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 40301 | 无权查看该知识库 |

---

#### 3.1.4 更新知识库

**PUT** `/api/v1/rag/knowledge-bases/{kbId}`

更新知识库基本信息（名称、描述、状态、元数据）。不影响已配置的分块策略与 Embedding 模型。

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | 知识库名称，租户内唯一 |
| description | string | 否 | 知识库描述 |
| status | string | 否 | 状态：`ACTIVE` / `INACTIVE` |
| ontologyConceptCode | string | 否 | 绑定的本体概念编码 |
| metadata | object | 否 | 扩展元数据 |

**请求示例**

```json
{
  "name": "产品技术文档库（v2）",
  "description": "更新后的描述：包含 Mate Platform 全部技术文档",
  "status": "ACTIVE",
  "ontologyConceptCode": "TechnicalDocument"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "kbId": "kb-product-tech-001",
    "name": "产品技术文档库（v2）",
    "description": "更新后的描述：包含 Mate Platform 全部技术文档",
    "status": "ACTIVE",
    "ontologyConceptCode": "TechnicalDocument",
    "updatedAt": "2026-07-16T15:00:00.000+08:00",
    "updatedBy": "user-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 40901 | 名称与其他知识库冲突 |
| 42208 | ontologyConceptCode 在 TECH-ONT 中不存在 |
| 40301 | 无权修改该知识库 |

---

#### 3.1.5 删除知识库

**DELETE** `/api/v1/rag/knowledge-bases/{kbId}`

删除知识库及其所有文档、分块、向量数据。同时删除 Milvus 中的 Collection 与 MinIO 中的原始文件。该操作不可恢复。

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| force | boolean | 否 | 是否强制删除非空知识库，默认 false。false 时若知识库非空返回 40903 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "kbId": "kb-product-tech-001",
    "deleted": true,
    "deletedDocuments": 128,
    "deletedChunks": 4520,
    "deletedVectors": 4520,
    "milvusCollectionDropped": true,
    "minioFilesDeleted": 128
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 40903 | 知识库非空且 force=false |
| 50003 | Milvus Collection 删除失败 |
| 50004 | MinIO 文件删除失败 |
| 40301 | 无权删除该知识库 |

---

#### 3.1.6 配置分块策略

**PUT** `/api/v1/rag/knowledge-bases/{kbId}/chunk-strategy`

更新知识库的分块策略。更新后仅影响新上传的文档，已存在的文档不会自动重新分块（需调用重新解析接口）。

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| type | string | 是 | 分块类型：`FIXED_SIZE` / `RECURSIVE` / `SENTENCE` / `MARKDOWN` / `SEMANTIC` |
| chunkSize | integer | 否 | 分块大小（字符数），默认 512，范围 100-4096 |
| chunkOverlap | integer | 否 | 分块重叠（字符数），默认 50，范围 0-512 |
| separator | string | 否 | 自定义分隔符（`RECURSIVE` 类型有效） |
| metadata | object | 否 | 分块策略扩展参数（如 `SEMANTIC` 类型的阈值等） |

**请求示例**

```json
{
  "type": "MARKDOWN",
  "chunkSize": 768,
  "chunkOverlap": 100
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "kbId": "kb-product-tech-001",
    "chunkStrategy": {
      "type": "MARKDOWN",
      "chunkSize": 768,
      "chunkOverlap": 100,
      "separator": null
    },
    "updatedAt": "2026-07-16T15:30:00.000+08:00",
    "affectedExistingDocuments": 0,
    "note": "分块策略更新仅影响新文档，已有文档需重新解析生效"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 42206 | 分块策略参数不合法 |
| 40301 | 无权修改该知识库配置 |

---

#### 3.1.7 获取分块策略

**GET** `/api/v1/rag/knowledge-bases/{kbId}/chunk-strategy`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "kbId": "kb-product-tech-001",
    "chunkStrategy": {
      "type": "MARKDOWN",
      "chunkSize": 768,
      "chunkOverlap": 100,
      "separator": null,
      "metadata": {}
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |

---

#### 3.1.8 配置 Embedding 模型

**PUT** `/api/v1/rag/knowledge-bases/{kbId}/embedding-model`

切换知识库的 Embedding 模型。切换后已存在的向量维度可能与新模型不匹配，需对所有文档重新生成向量。

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| embeddingModelId | string | 是 | 目标 Embedding 模型 ID |
| autoReembed | boolean | 否 | 是否自动重新向量化所有文档，默认 false |
| reembedBatchSize | integer | 否 | 重新向量化批次大小，默认 100，范围 10-500 |

**请求示例**

```json
{
  "embeddingModelId": "emb-doubao-large-2048",
  "autoReembed": true,
  "reembedBatchSize": 100
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "kbId": "kb-product-tech-001",
    "embeddingModelId": "emb-doubao-large-2048",
    "embeddingModelName": "Doubao Large 2048",
    "embeddingDimension": 2048,
    "previousModelId": "emb-doubao-large-1536",
    "previousDimension": 1536,
    "dimensionChanged": true,
    "reembedTaskId": "task-reembed-20260716-001",
    "reembedStatus": "QUEUED",
    "reembedTotalChunks": 4520,
    "note": "向量维度已变更，自动触发重新向量化任务"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 40404 | embeddingModelId 指向的模型不存在 |
| 42207 | 向量维度不匹配且未启用 autoReembed |
| 50006 | LLMGW 校验 Embedding 模型失败 |
| 40301 | 无权修改该知识库配置 |

---

#### 3.1.9 获取 Embedding 模型配置

**GET** `/api/v1/rag/knowledge-bases/{kbId}/embedding-model`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "kbId": "kb-product-tech-001",
    "embeddingModelId": "emb-doubao-large-2048",
    "embeddingModelName": "Doubao Large 2048",
    "embeddingDimension": 2048,
    "provider": "volcengine",
    "maxInputTokens": 8192,
    "updatedAt": "2026-07-16T16:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |

---

#### 3.1.10 配置检索参数

**PUT** `/api/v1/rag/knowledge-bases/{kbId}/retrieval-config`

更新知识库的默认检索参数，影响所有检索接口的默认行为。

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| metricType | string | 否 | 向量距离度量：`COSINE` / `IP` / `L2` |
| topK | integer | 否 | 默认召回数量，范围 1-100 |
| scoreThreshold | number | 否 | 相似度分数阈值，范围 0.0-1.0 |
| hybridWeights | object | 否 | 混合检索权重配置 |
| hybridWeights.vectorWeight | number | 否 | 向量检索权重，范围 0.0-1.0，默认 0.7 |
| hybridWeights.keywordWeight | number | 否 | 关键词检索权重，范围 0.0-1.0，默认 0.3 |
| rerankEnabled | boolean | 否 | 是否启用 Rerank 重排序，默认 false |
| rerankModelId | string | 否 | Rerank 模型 ID（rerankEnabled=true 时必填） |
| rerankTopN | integer | 否 | Rerank 后返回的最终数量，默认等于 topK |

**请求示例**

```json
{
  "metricType": "COSINE",
  "topK": 20,
  "scoreThreshold": 0.70,
  "hybridWeights": {
    "vectorWeight": 0.7,
    "keywordWeight": 0.3
  },
  "rerankEnabled": true,
  "rerankModelId": "rerank-doubao-pro",
  "rerankTopN": 10
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "kbId": "kb-product-tech-001",
    "retrievalConfig": {
      "metricType": "COSINE",
      "topK": 20,
      "scoreThreshold": 0.70,
      "hybridWeights": {
        "vectorWeight": 0.7,
        "keywordWeight": 0.3
      },
      "rerankEnabled": true,
      "rerankModelId": "rerank-doubao-pro",
      "rerankTopN": 10
    },
    "updatedAt": "2026-07-16T16:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 40001 | hybridWeights 权重之和不为 1.0 |
| 42206 | rerankEnabled=true 但 rerankModelId 为空 |
| 50006 | LLMGW 校验 Rerank 模型失败 |
| 40301 | 无权修改该知识库配置 |

---

#### 3.1.11 获取检索参数配置

**GET** `/api/v1/rag/knowledge-bases/{kbId}/retrieval-config`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "kbId": "kb-product-tech-001",
    "retrievalConfig": {
      "metricType": "COSINE",
      "topK": 20,
      "scoreThreshold": 0.70,
      "hybridWeights": {
        "vectorWeight": 0.7,
        "keywordWeight": 0.3
      },
      "rerankEnabled": true,
      "rerankModelId": "rerank-doubao-pro",
      "rerankTopN": 10
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |

---

### 3.2 文档管理 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/rag/knowledge-bases/{kbId}/documents/upload` | 上传文档 |
| POST | `/api/v1/rag/knowledge-bases/{kbId}/documents/urls` | 通过 URL 导入文档 |
| GET | `/api/v1/rag/knowledge-bases/{kbId}/documents` | 文档列表（分页） |
| GET | `/api/v1/rag/knowledge-bases/{kbId}/documents/{docId}` | 获取文档详情 |
| DELETE | `/api/v1/rag/knowledge-bases/{kbId}/documents/{docId}` | 删除文档 |
| POST | `/api/v1/rag/knowledge-bases/{kbId}/documents/{docId}/reparse` | 重新解析文档 |
| GET | `/api/v1/rag/knowledge-bases/{kbId}/documents/{docId}/chunks` | 获取文档分块列表 |
| GET | `/api/v1/rag/knowledge-bases/{kbId}/documents/{docId}/status` | 获取文档处理状态 |
| POST | `/api/v1/rag/knowledge-bases/{kbId}/documents/batch-upload` | 批量上传文档 |

---

#### 3.2.1 上传文档

**POST** `/api/v1/rag/knowledge-bases/{kbId}/documents/upload`

上传文档文件至指定知识库。上传后自动触发异步解析、分块、向量化流程。支持 PDF、Word、PPT、TXT、Markdown、HTML、CSV、音视频文件。

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |

**请求参数（multipart/form-data）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| file | file | 是 | 文件二进制数据，单个文件最大 100MB |
| title | string | 否 | 文档标题，默认使用文件名 |
| description | string | 否 | 文档描述 |
| metadata | string | 否 | JSON 字符串，文档扩展元数据 |
| autoParse | boolean | 否 | 是否自动解析，默认 true |
| autoEmbed | boolean | 否 | 解析后是否自动向量化，默认 true |

**支持的文件类型**

| 类型 | 扩展名 | 说明 |
|---|---|---|
| PDF | .pdf | 含 OCR 支持（扫描件） |
| Word | .doc, .docx | - |
| PPT | .ppt, .pptx | - |
| Excel | .xls, .xlsx, .csv | 按行解析为文本 |
| 文本 | .txt, .md, .rst | - |
| 网页 | .html, .htm | 提取正文内容 |
| 音频 | .mp3, .wav, .m4a, .flac | 通过 ASR 转写 |
| 视频 | .mp4, .avi, .mov, .mkv | 提取音轨后 ASR 转写 |

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "docId": "doc-20260716-000001",
    "kbId": "kb-product-tech-001",
    "title": "Mate Platform 架构设计文档",
    "description": "平台整体架构设计 v1.0",
    "fileName": "mate-platform-arch.pdf",
    "fileType": "PDF",
    "fileSize": 4194304,
    "fileHash": "sha256:a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
    "minioObjectKey": "rag/kb-product-tech-001/doc-20260716-000001/mate-platform-arch.pdf",
    "status": "UPLOADED",
    "autoParse": true,
    "parseTaskId": "task-parse-20260716-000001",
    "metadata": {
      "source": "manual-upload",
      "category": "architecture"
    },
    "createdAt": "2026-07-16T11:00:00.000+08:00",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 40005 | 不支持的文件类型 |
| 40006 | 文件大小超过 100MB 限制 |
| 40902 | 文件哈希重复（文档已存在） |
| 42201 | 知识库状态非 ACTIVE |
| 50004 | MinIO 文件上传失败 |
| 40301 | 无权上传文档至该知识库 |

---

#### 3.2.2 通过 URL 导入文档

**POST** `/api/v1/rag/knowledge-bases/{kbId}/documents/urls`

通过 URL 导入网页或在线文档。服务端自动下载内容并解析。

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| url | string | 是 | 文档 URL（http/https） |
| title | string | 否 | 文档标题，默认从页面提取 |
| description | string | 否 | 文档描述 |
| documentType | string | 否 | 文档类型：`WEB_PAGE` / `URL_PDF` / `URL_DOC`，默认自动检测 |
| metadata | object | 否 | 扩展元数据 |
| autoParse | boolean | 否 | 是否自动解析，默认 true |
| autoEmbed | boolean | 否 | 解析后是否自动向量化，默认 true |

**请求示例**

```json
{
  "url": "https://docs.metaplatform.com/architecture/overview",
  "title": "平台架构总览",
  "documentType": "WEB_PAGE",
  "autoParse": true,
  "autoEmbed": true
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "docId": "doc-20260716-000002",
    "kbId": "kb-product-tech-001",
    "title": "平台架构总览",
    "sourceUrl": "https://docs.metaplatform.com/architecture/overview",
    "documentType": "WEB_PAGE",
    "status": "DOWNLOADING",
    "downloadTaskId": "task-download-20260716-000002",
    "autoParse": true,
    "autoEmbed": true,
    "createdAt": "2026-07-16T11:10:00.000+08:00",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 40001 | URL 格式不合法 |
| 42202 | URL 下载失败（404/超时/权限拒绝） |
| 40902 | URL 对应内容已导入（哈希重复） |
| 42201 | 知识库状态非 ACTIVE |
| 40301 | 无权导入文档 |

---

#### 3.2.3 文档列表（分页）

**GET** `/api/v1/rag/knowledge-bases/{kbId}/documents`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序，默认 `createdAt:desc` |
| keyword | string | 否 | 关键词搜索（匹配标题/文件名） |
| status | string | 否 | 按状态过滤：`UPLOADED` / `PARSING` / `PARSED` / `EMBEDDING` / `READY` / `FAILED` |
| fileType | string | 否 | 按文件类型过滤：`PDF` / `WORD` / `PPT` / `EXCEL` / `TEXT` / `MARKDOWN` / `HTML` / `AUDIO` / `VIDEO` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "docId": "doc-20260716-000001",
        "title": "Mate Platform 架构设计文档",
        "fileName": "mate-platform-arch.pdf",
        "fileType": "PDF",
        "fileSize": 4194304,
        "status": "READY",
        "chunkCount": 86,
        "vectorCount": 86,
        "sourceUrl": null,
        "createdAt": "2026-07-16T11:00:00.000+08:00",
        "updatedAt": "2026-07-16T11:05:30.000+08:00",
        "createdBy": "user-001"
      },
      {
        "docId": "doc-20260716-000002",
        "title": "平台架构总览",
        "fileName": null,
        "fileType": "HTML",
        "fileSize": 524288,
        "status": "READY",
        "chunkCount": 12,
        "vectorCount": 12,
        "sourceUrl": "https://docs.metaplatform.com/architecture/overview",
        "createdAt": "2026-07-16T11:10:00.000+08:00",
        "updatedAt": "2026-07-16T11:11:00.000+08:00",
        "createdBy": "user-001"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 40301 | 无权查看该知识库文档 |

---

#### 3.2.4 获取文档详情

**GET** `/api/v1/rag/knowledge-bases/{kbId}/documents/{docId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |
| docId | string | 是 | 文档 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "docId": "doc-20260716-000001",
    "kbId": "kb-product-tech-001",
    "title": "Mate Platform 架构设计文档",
    "description": "平台整体架构设计 v1.0",
    "fileName": "mate-platform-arch.pdf",
    "fileType": "PDF",
    "fileSize": 4194304,
    "fileHash": "sha256:a1b2c3d4e5f6...",
    "sourceUrl": null,
    "minioObjectKey": "rag/kb-product-tech-001/doc-20260716-000001/mate-platform-arch.pdf",
    "status": "READY",
    "statusDetail": "文档已解析、分块、向量化完成",
    "chunkCount": 86,
    "vectorCount": 86,
    "parseDuration": 12.5,
    "embedDuration": 8.3,
    "totalDuration": 20.8,
    "metadata": {
      "source": "manual-upload",
      "category": "architecture"
    },
    "parseError": null,
    "createdAt": "2026-07-16T11:00:00.000+08:00",
    "updatedAt": "2026-07-16T11:05:30.000+08:00",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 40402 | 文档不存在 |
| 40301 | 无权查看该文档 |

---

#### 3.2.5 删除文档

**DELETE** `/api/v1/rag/knowledge-bases/{kbId}/documents/{docId}`

删除文档及其所有分块、向量数据，同时删除 MinIO 中的原始文件。

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |
| docId | string | 是 | 文档 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "docId": "doc-20260716-000001",
    "kbId": "kb-product-tech-001",
    "deleted": true,
    "deletedChunks": 86,
    "deletedVectors": 86,
    "minioFileDeleted": true
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 40402 | 文档不存在 |
| 50003 | Milvus 向量删除失败 |
| 50004 | MinIO 文件删除失败 |
| 40301 | 无权删除该文档 |

---

#### 3.2.6 重新解析文档

**POST** `/api/v1/rag/knowledge-bases/{kbId}/documents/{docId}/reparse`

对已有文档重新执行解析、分块、向量化流程。先删除旧的分块与向量数据，再基于当前知识库的分块策略与 Embedding 模型重新处理。适用于知识库配置变更后更新已有文档。

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |
| docId | string | 是 | 文档 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| rechunk | boolean | 否 | 是否重新分块，默认 true |
| reembed | boolean | 否 | 是否重新向量化，默认 true |
| chunkStrategyOverride | object | 否 | 本次解析使用的分块策略覆盖（不修改知识库默认配置） |

**请求示例**

```json
{
  "rechunk": true,
  "reembed": true,
  "chunkStrategyOverride": {
    "type": "SENTENCE",
    "chunkSize": 256,
    "chunkOverlap": 30
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "docId": "doc-20260716-000001",
    "kbId": "kb-product-tech-001",
    "status": "PARSING",
    "reparseTaskId": "task-reparse-20260716-000001",
    "previousChunksDeleted": 86,
    "previousVectorsDeleted": 86,
    "strategyOverrideApplied": true
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 40402 | 文档不存在 |
| 42205 | 文档正在处理中，无法重新解析 |
| 42206 | chunkStrategyOverride 参数不合法 |
| 50008 | 异步任务提交失败 |
| 40301 | 无权操作该文档 |

---

#### 3.2.7 获取文档分块列表

**GET** `/api/v1/rag/knowledge-bases/{kbId}/documents/{docId}/chunks`

获取文档解析后的分块列表，支持分页浏览。

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |
| docId | string | 是 | 文档 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |
| includeContent | boolean | 否 | 是否包含分块文本内容，默认 true |
| includeEmbedding | boolean | 否 | 是否包含向量数据，默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "chunkId": "chunk-20260716-000001-0001",
        "docId": "doc-20260716-000001",
        "kbId": "kb-product-tech-001",
        "chunkIndex": 0,
        "content": "Mate Platform 是基于 Ontology 本体论引擎的企业级决策与运营提效平台...",
        "contentLength": 486,
        "tokenCount": 128,
        "metadata": {
          "page": 1,
          "section": "概述",
          "bbox": [100, 200, 500, 300]
        },
        "hasEmbedding": true,
        "embeddingDimension": 1536,
        "createdAt": "2026-07-16T11:02:00.000+08:00"
      },
      {
        "chunkId": "chunk-20260716-000001-0002",
        "docId": "doc-20260716-000001",
        "kbId": "kb-product-tech-001",
        "chunkIndex": 1,
        "content": "核心能力包括：Ontology 本体引擎、低代码应用构建、数字员工...",
        "contentLength": 512,
        "tokenCount": 135,
        "metadata": {
          "page": 1,
          "section": "核心能力"
        },
        "hasEmbedding": true,
        "embeddingDimension": 1536,
        "createdAt": "2026-07-16T11:02:00.000+08:00"
      }
    ],
    "total": 86,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 40402 | 文档不存在 |
| 42205 | 文档尚未完成解析 |
| 40301 | 无权查看该文档 |

---

#### 3.2.8 获取文档处理状态

**GET** `/api/v1/rag/knowledge-bases/{kbId}/documents/{docId}/status`

轻量级接口，仅返回文档当前处理状态与进度，适用于前端轮询。

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |
| docId | string | 是 | 文档 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "docId": "doc-20260716-000001",
    "status": "EMBEDDING",
    "progress": 65,
    "stage": "EMBEDDING",
    "stageDetail": "正在向量化分块 56/86",
    "parsedChunks": 86,
    "embeddedChunks": 56,
    "totalChunks": 86,
    "estimatedRemainingSeconds": 4,
    "error": null,
    "updatedAt": "2026-07-16T11:04:15.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**文档状态流转**

```
UPLOADED → PARSING → PARSED → EMBEDDING → READY
                ↓          ↓         ↓
              FAILED     FAILED    FAILED
```

| 状态 | 说明 |
|---|---|
| UPLOADED | 文件已上传，等待解析 |
| DOWNLOADING | URL 导入文档下载中 |
| PARSING | 文档解析与分块中 |
| PARSED | 解析完成，等待向量化 |
| EMBEDDING | 向量化中 |
| READY | 文档就绪，可检索 |
| FAILED | 处理失败（error 字段包含原因） |

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 40402 | 文档不存在 |

---

#### 3.2.9 批量上传文档

**POST** `/api/v1/rag/knowledge-bases/{kbId}/documents/batch-upload`

批量上传多个文档文件，返回批量任务 ID 用于追踪整体进度。

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |

**请求参数（multipart/form-data）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| files | file[] | 是 | 多个文件二进制数据，最多 20 个文件，单文件最大 100MB |
| autoParse | boolean | 否 | 是否自动解析，默认 true |
| autoEmbed | boolean | 否 | 解析后是否自动向量化，默认 true |

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "batchTaskId": "batch-20260716-000001",
    "kbId": "kb-product-tech-001",
    "totalFiles": 5,
    "acceptedFiles": 5,
    "rejectedFiles": 0,
    "documents": [
      {
        "docId": "doc-20260716-000010",
        "fileName": "api-spec.pdf",
        "status": "UPLOADED"
      },
      {
        "docId": "doc-20260716-000011",
        "fileName": "user-guide.docx",
        "status": "UPLOADED"
      },
      {
        "docId": "doc-20260716-000012",
        "fileName": "arch-design.pdf",
        "status": "UPLOADED"
      },
      {
        "docId": "doc-20260716-000013",
        "fileName": "deployment.md",
        "status": "UPLOADED"
      },
      {
        "docId": "doc-20260716-000014",
        "fileName": "faq.html",
        "status": "UPLOADED"
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 40005 | 包含不支持的文件类型 |
| 40006 | 单个文件超过 100MB |
| 40001 | 文件数量超过 20 个限制 |
| 42201 | 知识库状态非 ACTIVE |
| 40301 | 无权上传文档 |

---

### 3.3 Embedding 服务 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/rag/embeddings` | 单条文本向量化 |
| POST | `/api/v1/rag/embeddings/batch` | 批量文本向量化 |
| GET | `/api/v1/rag/embeddings/models` | Embedding 模型列表 |
| GET | `/api/v1/rag/embeddings/models/{modelId}` | Embedding 模型详情 |

---

#### 3.3.1 单条文本向量化

**POST** `/api/v1/rag/embeddings`

将单条文本通过指定 Embedding 模型转换为向量。所有 Embedding 调用通过 TECH-LLMGW 路由，不直接访问模型 API。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| text | string | 是 | 待向量化的文本，最长 8192 tokens |
| modelId | string | 否 | Embedding 模型 ID，不传则使用默认模型 |
| normalize | boolean | 否 | 是否对向量进行 L2 归一化，默认 true |

**请求示例**

```json
{
  "text": "Mate Platform 是基于 Ontology 本体论引擎的企业级决策与运营提效平台",
  "modelId": "emb-doubao-large-1536",
  "normalize": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "modelId": "emb-doubao-large-1536",
    "modelName": "Doubao Large 1536",
    "dimension": 1536,
    "embedding": [0.0123, -0.0456, 0.0789, -0.0321, ...],
    "tokenCount": 32,
    "duration": 0.045
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | text 为空或超过 token 限制 |
| 40404 | modelId 指向的模型不存在 |
| 42203 | 向量化失败（模型内部错误） |
| 50006 | LLMGW 调用失败 |
| 50302 | LLMGW 服务不可用 |
| 42901 | 限流触发 |

---

#### 3.3.2 批量文本向量化

**POST** `/api/v1/rag/embeddings/batch`

将多条文本批量向量化，提高吞吐效率。单次最多 100 条文本。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| texts | array[string] | 是 | 待向量化的文本列表，最多 100 条，单条最长 8192 tokens |
| modelId | string | 否 | Embedding 模型 ID，不传则使用默认模型 |
| normalize | boolean | 否 | 是否对向量进行 L2 归一化，默认 true |

**请求示例**

```json
{
  "texts": [
    "Mate Platform 是基于 Ontology 本体论引擎的企业级平台",
    "核心能力包括 Ontology 本体引擎、低代码应用构建",
    "支持向量+非向量混合检索"
  ],
  "modelId": "emb-doubao-large-1536",
  "normalize": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "modelId": "emb-doubao-large-1536",
    "modelName": "Doubao Large 1536",
    "dimension": 1536,
    "embeddings": [
      [0.0123, -0.0456, 0.0789, -0.0321, ...],
      [0.0234, -0.0567, 0.0890, -0.0432, ...],
      [0.0345, -0.0678, 0.0901, -0.0543, ...]
    ],
    "tokenCounts": [32, 28, 15],
    "totalTokens": 75,
    "duration": 0.125,
    "successCount": 3,
    "failedCount": 0
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | texts 为空或超过 100 条限制 |
| 40404 | modelId 指向的模型不存在 |
| 42203 | 部分文本向量化失败（failedCount > 0） |
| 50006 | LLMGW 调用失败 |
| 50302 | LLMGW 服务不可用 |
| 42901 | 限流触发 |

---

#### 3.3.3 Embedding 模型列表

**GET** `/api/v1/rag/embeddings/models`

获取可用的 Embedding 模型列表。模型信息从 TECH-LLMGW 同步。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| provider | string | 否 | 按提供商过滤：`volcengine` / `openai` / `baidu` / `custom` |
| status | string | 否 | 按状态过滤：`AVAILABLE` / `UNAVAILABLE` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "modelId": "emb-doubao-large-1536",
        "modelName": "Doubao Large 1536",
        "provider": "volcengine",
        "dimension": 1536,
        "maxInputTokens": 8192,
        "status": "AVAILABLE",
        "description": "字节豆包 Embedding 大模型，1536 维",
        "isDefault": true
      },
      {
        "modelId": "emb-doubao-large-2048",
        "modelName": "Doubao Large 2048",
        "provider": "volcengine",
        "dimension": 2048,
        "maxInputTokens": 8192,
        "status": "AVAILABLE",
        "description": "字节豆包 Embedding 大模型，2048 维",
        "isDefault": false
      },
      {
        "modelId": "emb-bge-m3",
        "modelName": "BGE-M3",
        "provider": "custom",
        "dimension": 1024,
        "maxInputTokens": 8192,
        "status": "AVAILABLE",
        "description": "BAAI 开源多语言 Embedding 模型",
        "isDefault": false
      }
    ],
    "total": 3
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 50006 | LLMGW 获取模型列表失败 |
| 50302 | LLMGW 服务不可用 |

---

#### 3.3.4 Embedding 模型详情

**GET** `/api/v1/rag/embeddings/models/{modelId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| modelId | string | 是 | Embedding 模型 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "modelId": "emb-doubao-large-1536",
    "modelName": "Doubao Large 1536",
    "provider": "volcengine",
    "dimension": 1536,
    "maxInputTokens": 8192,
    "status": "AVAILABLE",
    "description": "字节豆包 Embedding 大模型，1536 维，支持中英多语言",
    "isDefault": true,
    "supportedMetrics": ["COSINE", "IP", "L2"],
    "pricing": {
      "unit": "per_1k_tokens",
      "price": 0.0005,
      "currency": "CNY"
    },
    "usageStats": {
      "totalRequests": 152340,
      "totalTokens": 45820000,
      "avgLatencyMs": 45,
      "p99LatencyMs": 120
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40404 | Embedding 模型不存在 |
| 50006 | LLMGW 获取模型详情失败 |

---

### 3.4 检索服务 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/rag/retrieve/vector` | 向量检索 |
| POST | `/api/v1/rag/retrieve/keyword` | 关键词检索 |
| POST | `/api/v1/rag/retrieve/hybrid` | 混合检索（多路召回+重排序） |
| POST | `/api/v1/rag/retrieve/graph` | 图谱增强检索 |
| POST | `/api/v1/rag/retrieve/multi-kb` | 跨知识库检索 |

---

#### 3.4.1 向量检索

**POST** `/api/v1/rag/retrieve/vector`

基于向量相似度的语义检索。将查询文本通过 Embedding 模型转换为向量，在 Milvus 中执行 ANN 检索。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |
| query | string | 是 | 查询文本 |
| topK | integer | 否 | 返回结果数量，默认使用知识库配置 |
| scoreThreshold | number | 否 | 相似度分数阈值，低于此值的结果过滤，默认使用知识库配置 |
| metricType | string | 否 | 距离度量：`COSINE` / `IP` / `L2`，默认使用知识库配置 |
| filter | object | 否 | 元数据过滤条件 |
| filter.documentIds | array[string] | 否 | 限定文档范围 |
| filter.fileTypes | array[string] | 否 | 限定文件类型 |
| filter.metadata | object | 否 | 自定义元数据过滤（key-value 等值匹配） |
| includeContent | boolean | 否 | 是否返回分块文本内容，默认 true |
| includeMetadata | boolean | 否 | 是否返回分块元数据，默认 true |

**请求示例**

```json
{
  "kbId": "kb-product-tech-001",
  "query": "Mate Platform 的本体引擎是怎么工作的",
  "topK": 10,
  "scoreThreshold": 0.75,
  "metricType": "COSINE",
  "filter": {
    "fileTypes": ["PDF", "MARKDOWN"],
    "metadata": {
      "category": "architecture"
    }
  },
  "includeContent": true,
  "includeMetadata": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "kbId": "kb-product-tech-001",
    "query": "Mate Platform 的本体引擎是怎么工作的",
    "total": 8,
    "results": [
      {
        "chunkId": "chunk-20260716-000001-0003",
        "docId": "doc-20260716-000001",
        "docTitle": "Mate Platform 架构设计文档",
        "chunkIndex": 3,
        "content": "Ontology 引擎是平台唯一数据真相源，通过 Concept（概念）、Entity（实体）、Relation（关系）、Attribute（属性）四要素构建企业级业务语义模型...",
        "score": 0.8923,
        "metadata": {
          "page": 2,
          "section": "Ontology 引擎"
        }
      },
      {
        "chunkId": "chunk-20260716-000001-0007",
        "docId": "doc-20260716-000001",
        "docTitle": "Mate Platform 架构设计文档",
        "chunkIndex": 7,
        "content": "本体引擎与知识图谱合并为单层架构，PostgreSQL 存储元数据，Neo4j 存储图结构...",
        "score": 0.8567,
        "metadata": {
          "page": 3,
          "section": "知识图谱"
        }
      }
    ],
    "retrievalInfo": {
      "embeddingDuration": 0.045,
      "searchDuration": 0.012,
      "totalDuration": 0.057,
      "embeddingModel": "emb-doubao-large-1536",
      "metricType": "COSINE",
      "candidates": 100
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 42201 | 知识库未就绪（无可用向量） |
| 42204 | 检索失败（Milvus 查询异常） |
| 50003 | Milvus 操作失败 |
| 50006 | Embedding 生成失败（LLMGW 调用异常） |
| 42901 | 限流触发 |

---

#### 3.4.2 关键词检索

**POST** `/api/v1/rag/retrieve/keyword`

基于 BM25 算法的全文关键词检索。适用于精确术语匹配场景。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |
| query | string | 是 | 关键词查询文本 |
| topK | integer | 否 | 返回结果数量，默认 10 |
| scoreThreshold | number | 否 | BM25 分数阈值，默认 0.0 |
| filter | object | 否 | 元数据过滤条件（同向量检索） |
| includeContent | boolean | 否 | 是否返回分块文本内容，默认 true |
| highlight | boolean | 否 | 是否高亮匹配关键词，默认 false |
| highlightPreTag | string | 否 | 高亮前置标签，默认 `<em>` |
| highlightPostTag | string | 否 | 高亮后置标签，默认 `</em>` |

**请求示例**

```json
{
  "kbId": "kb-product-tech-001",
  "query": "Ontology 概念 实体 关系",
  "topK": 10,
  "highlight": true,
  "highlightPreTag": "<mark>",
  "highlightPostTag": "</mark>"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "kbId": "kb-product-tech-001",
    "query": "Ontology 概念 实体 关系",
    "total": 5,
    "results": [
      {
        "chunkId": "chunk-20260716-000001-0003",
        "docId": "doc-20260716-000001",
        "docTitle": "Mate Platform 架构设计文档",
        "chunkIndex": 3,
        "content": "通过 <mark>概念</mark>、<mark>实体</mark>、<mark>关系</mark>、属性四要素构建企业级业务语义模型",
        "score": 12.56,
        "matchedTerms": ["概念", "实体", "关系"],
        "metadata": {
          "page": 2,
          "section": "Ontology 引擎"
        }
      }
    ],
    "retrievalInfo": {
      "searchDuration": 0.008,
      "algorithm": "BM25",
      "candidates": 4520
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 42201 | 知识库未就绪 |
| 42204 | 检索失败 |
| 50003 | 检索引擎操作失败 |
| 42901 | 限流触发 |

---

#### 3.4.3 混合检索

**POST** `/api/v1/rag/retrieve/hybrid`

多路召回混合检索：同时执行向量检索与关键词检索，按权重融合后可选 Rerank 重排序。是推荐的默认检索方式。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |
| query | string | 是 | 查询文本 |
| topK | integer | 否 | 最终返回结果数量，默认使用知识库配置 |
| vectorWeight | number | 否 | 向量检索权重，范围 0.0-1.0，默认使用知识库配置 |
| keywordWeight | number | 否 | 关键词检索权重，范围 0.0-1.0，默认使用知识库配置 |
| scoreThreshold | number | 否 | 融合后分数阈值 |
| rerank | boolean | 否 | 是否启用 Rerank 重排序，默认使用知识库配置 |
| rerankModelId | string | 否 | Rerank 模型 ID，默认使用知识库配置 |
| rerankTopN | integer | 否 | Rerank 后返回数量，默认等于 topK |
| candidateK | integer | 否 | 每路召回候选数量，默认 topK*3 |
| filter | object | 否 | 元数据过滤条件（同向量检索） |
| includeContent | boolean | 否 | 是否返回分块文本内容，默认 true |
| includeMetadata | boolean | 否 | 是否返回分块元数据，默认 true |
| highlight | boolean | 否 | 是否高亮关键词匹配，默认 false |

**请求示例**

```json
{
  "kbId": "kb-product-tech-001",
  "query": "Ontology 引擎如何实现推理与一致性校验",
  "topK": 10,
  "vectorWeight": 0.7,
  "keywordWeight": 0.3,
  "rerank": true,
  "rerankModelId": "rerank-doubao-pro",
  "rerankTopN": 10,
  "candidateK": 30,
  "includeContent": true,
  "highlight": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "kbId": "kb-product-tech-001",
    "query": "Ontology 引擎如何实现推理与一致性校验",
    "total": 10,
    "results": [
      {
        "chunkId": "chunk-20260716-000001-0005",
        "docId": "doc-20260716-000001",
        "docTitle": "Mate Platform 架构设计文档",
        "chunkIndex": 5,
        "content": "基于规则与 OWL 推理机（HermiT / ELK）执行本体推理、知识补全与一致性检测...",
        "score": 0.9345,
        "vectorScore": 0.8923,
        "keywordScore": 8.45,
        "fusedScore": 0.8765,
        "rerankScore": 0.9345,
        "matchedTerms": ["推理", "一致性", "校验"],
        "metadata": {
          "page": 2,
          "section": "推理引擎"
        }
      }
    ],
    "retrievalInfo": {
      "vectorDuration": 0.057,
      "keywordDuration": 0.008,
      "fusionDuration": 0.002,
      "rerankDuration": 0.045,
      "totalDuration": 0.112,
      "vectorCandidates": 30,
      "keywordCandidates": 30,
      "fusedCandidates": 45,
      "rerankCandidates": 30,
      "embeddingModel": "emb-doubao-large-1536",
      "rerankModel": "rerank-doubao-pro",
      "vectorWeight": 0.7,
      "keywordWeight": 0.3
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 42201 | 知识库未就绪 |
| 40001 | vectorWeight + keywordWeight 不等于 1.0 |
| 42204 | 检索失败 |
| 50003 | Milvus 操作失败 |
| 50006 | Embedding/Rerank 调用 LLMGW 失败 |
| 50302 | LLMGW 服务不可用 |
| 42901 | 限流触发 |

---

#### 3.4.4 图谱增强检索

**POST** `/api/v1/rag/retrieve/graph`

基于 Ontology 知识图谱的增强检索。先对查询进行实体链接（识别查询中的本体实体），然后通过实体关系扩展检索范围，结合向量检索返回结果。需要知识库已绑定本体概念编码。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID（需已绑定本体概念编码） |
| query | string | 是 | 查询文本 |
| topK | integer | 否 | 返回结果数量，默认 10 |
| expandDepth | integer | 否 | 图谱关系扩展深度，默认 1，范围 0-3 |
| expandRelations | array[string] | 否 | 限定扩展的关系类型编码列表，不传则扩展所有关系 |
| includeGraphContext | boolean | 否 | 是否返回图谱上下文（实体、关系），默认 true |
| vectorWeight | number | 否 | 向量检索权重，默认 0.6 |
| graphWeight | number | 否 | 图谱扩展权重，默认 0.4 |
| filter | object | 否 | 元数据过滤条件（同向量检索） |
| includeContent | boolean | 否 | 是否返回分块文本内容，默认 true |

**请求示例**

```json
{
  "kbId": "kb-product-tech-001",
  "query": "采购审批流程的审批人是谁",
  "topK": 10,
  "expandDepth": 2,
  "expandRelations": ["HAS_APPROVER", "REPORTS_TO"],
  "includeGraphContext": true,
  "vectorWeight": 0.6,
  "graphWeight": 0.4
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "kbId": "kb-product-tech-001",
    "query": "采购审批流程的审批人是谁",
    "total": 8,
    "results": [
      {
        "chunkId": "chunk-20260716-000020-0005",
        "docId": "doc-20260716-000020",
        "docTitle": "采购审批流程设计文档",
        "chunkIndex": 5,
        "content": "采购审批流程的审批人根据金额路由：50万以下由部门经理审批，50万以上需VP审批...",
        "score": 0.9156,
        "vectorScore": 0.8823,
        "graphScore": 0.9567,
        "fusedScore": 0.9156,
        "linkedEntities": ["PurchaseApproval", "DepartmentManager", "VP"],
        "metadata": {
          "section": "审批人路由"
        }
      }
    ],
    "graphContext": {
      "linkedEntities": [
        {
          "entityId": "ent-purchase-approval-001",
          "entityName": "采购审批流程",
          "conceptCode": "PurchaseApproval",
          "conceptName": "采购审批",
          "confidence": 0.92
        },
        {
          "entityId": "ent-dept-manager-001",
          "entityName": "部门经理",
          "conceptCode": "DepartmentManager",
          "conceptName": "部门经理",
          "confidence": 0.85
        }
      ],
      "expandedRelations": [
        {
          "sourceEntity": "采购审批流程",
          "targetEntity": "部门经理",
          "relationType": "HAS_APPROVER",
          "relationName": "审批人",
          "depth": 1
        },
        {
          "sourceEntity": "部门经理",
          "targetEntity": "VP",
          "relationType": "REPORTS_TO",
          "relationName": "汇报给",
          "depth": 2
        }
      ]
    },
    "retrievalInfo": {
      "entityLinkingDuration": 0.023,
      "graphExpansionDuration": 0.015,
      "vectorDuration": 0.057,
      "fusionDuration": 0.003,
      "totalDuration": 0.098,
      "linkedEntityCount": 3,
      "expandedRelationCount": 5
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 42201 | 知识库未就绪 |
| 42208 | 知识库未绑定本体概念，无法执行图谱检索 |
| 50007 | TECH-ONT 服务调用失败（实体链接/图谱查询） |
| 50302 | TECH-ONT 服务不可用 |
| 42204 | 检索失败 |
| 42901 | 限流触发 |

---

#### 3.4.5 跨知识库检索

**POST** `/api/v1/rag/retrieve/multi-kb`

同时在多个知识库中执行检索，合并结果后统一排序。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbIds | array[string] | 是 | 知识库 ID 列表，最多 10 个 |
| query | string | 是 | 查询文本 |
| topK | integer | 否 | 每个知识库返回结果数量，默认 5 |
| strategy | string | 否 | 合并策略：`MERGE`（合并后重排，默认）/ `ROUND_ROBIN`（轮询取Top） |
| rerank | boolean | 否 | 合并后是否 Rerank 重排序，默认 false |
| rerankModelId | string | 否 | Rerank 模型 ID |
| includeContent | boolean | 否 | 是否返回分块文本内容，默认 true |

**请求示例**

```json
{
  "kbIds": ["kb-product-tech-001", "kb-faq-001", "kb-api-docs-001"],
  "query": "如何创建一个知识库",
  "topK": 5,
  "strategy": "MERGE",
  "rerank": true,
  "rerankModelId": "rerank-doubao-pro"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "query": "如何创建一个知识库",
    "total": 12,
    "results": [
      {
        "chunkId": "chunk-20260716-000030-0002",
        "kbId": "kb-api-docs-001",
        "kbName": "API 文档库",
        "docId": "doc-20260716-000030",
        "docTitle": "RAG 引擎 API 手册",
        "content": "POST /api/v1/rag/knowledge-bases 创建知识库，需指定分块策略与 Embedding 模型...",
        "score": 0.9234,
        "rerankScore": 0.9512
      },
      {
        "chunkId": "chunk-20260716-000015-0008",
        "kbId": "kb-faq-001",
        "kbName": "FAQ 知识库",
        "docId": "doc-20260716-000015",
        "docTitle": "常见问题",
        "content": "Q: 如何创建知识库？ A: 在 APP-ONTSTUDIO 中选择知识库管理...",
        "score": 0.8765,
        "rerankScore": 0.8890
      }
    ],
    "retrievalInfo": {
      "kbCount": 3,
      "totalCandidates": 15,
      "rerankDuration": 0.045,
      "totalDuration": 0.156,
      "strategy": "MERGE"
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 其中一个或多个知识库不存在 |
| 42201 | 其中一个或多个知识库未就绪 |
| 40001 | kbIds 超过 10 个限制 |
| 42204 | 检索失败 |
| 42901 | 限流触发 |

---

### 3.5 检索增强 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/rag/enhance/entity-linking` | 实体链接 |
| POST | `/api/v1/rag/enhance/context-assembly` | 上下文组装 |
| POST | `/api/v1/rag/enhance/citations` | 引用来源生成 |

---

#### 3.5.1 实体链接

**POST** `/api/v1/rag/enhance/entity-linking`

对输入文本进行实体链接，识别文本中提到的本体实体，返回实体 ID、概念类型与置信度。依赖 TECH-ONT 本体引擎。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| text | string | 是 | 待实体链接的文本 |
| kbId | string | 否 | 知识库 ID（提供时使用知识库绑定的本体概念域限定范围） |
| conceptCodes | array[string] | 否 | 限定的本体概念编码列表 |
| confidenceThreshold | number | 否 | 置信度阈值，低于此值的实体不返回，默认 0.5 |
| maxEntities | integer | 否 | 最大返回实体数量，默认 20 |

**请求示例**

```json
{
  "text": "张三在采购审批流程中提交了一份50万元的采购申请，需要VP王五审批",
  "kbId": "kb-product-tech-001",
  "conceptCodes": ["PurchaseApproval", "Employee", "Department"],
  "confidenceThreshold": 0.6,
  "maxEntities": 10
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "text": "张三在采购审批流程中提交了一份50万元的采购申请，需要VP王五审批",
    "entities": [
      {
        "entityId": "ent-emp-001",
        "entityName": "张三",
        "conceptCode": "Employee",
        "conceptName": "员工",
        "mention": "张三",
        "start": 0,
        "end": 2,
        "confidence": 0.95,
        "attributes": {
          "department": "研发部",
          "title": "高级工程师"
        }
      },
      {
        "entityId": "ent-process-001",
        "entityName": "采购审批流程",
        "conceptCode": "PurchaseApproval",
        "conceptName": "采购审批",
        "mention": "采购审批流程",
        "start": 3,
        "end": 9,
        "confidence": 0.92,
        "attributes": {
          "status": "ACTIVE",
          "version": "v2.1"
        }
      },
      {
        "entityId": "ent-emp-005",
        "entityName": "王五",
        "conceptCode": "Employee",
        "conceptName": "员工",
        "mention": "王五",
        "start": 33,
        "end": 35,
        "confidence": 0.88,
        "attributes": {
          "department": "管理层",
          "title": "VP"
        }
      }
    ],
    "entityCount": 3,
    "duration": 0.034
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | text 为空 |
| 40401 | kbId 不存在 |
| 42208 | 实体链接失败（本体引擎返回错误） |
| 50007 | TECH-ONT 服务调用失败 |
| 50302 | TECH-ONT 服务不可用 |

---

#### 3.5.2 上下文组装

**POST** `/api/v1/rag/enhance/context-assembly`

将检索结果组装为 LLM 可用的上下文文本。支持多种组装策略，控制上下文长度、引用格式、去重等。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| query | string | 是 | 用户查询文本 |
| retrievalResults | array | 是 | 检索结果列表（来自检索 API 的 results） |
| strategy | string | 否 | 组装策略：`CONCAT`（拼接，默认）/ `SUMMARIZE`（摘要）/ `STRUCTURED`（结构化） |
| maxTokens | integer | 否 | 上下文最大 token 数，默认 4096 |
| includeCitations | boolean | 否 | 是否包含引用编号，默认 true |
| includeMetadata | boolean | 否 | 是否包含来源元数据，默认 true |
| dedupEnabled | boolean | 否 | 是否去重（基于内容相似度），默认 true |
| dedupThreshold | number | 否 | 去重相似度阈值，默认 0.85 |
| template | string | 否 | 自定义上下文模板（支持变量：`{query}`、`{context}`、`{citations}`） |

**请求示例**

```json
{
  "query": "Ontology 引擎如何实现推理",
  "retrievalResults": [
    {
      "chunkId": "chunk-001",
      "docId": "doc-001",
      "docTitle": "架构设计文档",
      "content": "基于规则与 OWL 推理机执行本体推理...",
      "score": 0.92
    },
    {
      "chunkId": "chunk-002",
      "docId": "doc-001",
      "docTitle": "架构设计文档",
      "content": "推理引擎支持 HermiT 和 ELK 两种推理机...",
      "score": 0.88
    }
  ],
  "strategy": "CONCAT",
  "maxTokens": 4096,
  "includeCitations": true,
  "includeMetadata": true,
  "dedupEnabled": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "context": "基于以下知识来源回答用户问题。\n\n## 知识来源\n\n[1] 架构设计文档 (PDF, 第2页)\n基于规则与 OWL 推理机（HermiT / ELK）执行本体推理、知识补全与一致性检测。推理引擎支持 HermiT 和 ELK 两种推理机...\n\n[2] 架构设计文档 (PDF, 第3页)\n推理引擎与知识图谱合并为单层架构，通过 CDC 保持双向一致...\n\n## 用户问题\nOntology 引擎如何实现推理",
    "tokenCount": 256,
    "characterCount": 512,
    "citationCount": 2,
    "dedupRemovedCount": 0,
    "truncated": false,
    "citations": [
      {
        "index": 1,
        "docId": "doc-001",
        "docTitle": "架构设计文档",
        "chunkId": "chunk-001",
        "page": 2,
        "score": 0.92
      },
      {
        "index": 2,
        "docId": "doc-001",
        "docTitle": "架构设计文档",
        "chunkId": "chunk-002",
        "page": 3,
        "score": 0.88
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | query 或 retrievalResults 为空 |
| 40001 | retrievalResults 超过 50 条限制 |
| 42204 | 上下文组装失败 |
| 50006 | SUMMARIZE 策略调用 LLMGW 失败 |

---

#### 3.5.3 引用来源生成

**POST** `/api/v1/rag/enhance/citations`

从 LLM 生成的回答文本中提取引用标记，生成结构化的引用来源信息，支持前端展示来源溯源。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| answer | string | 是 | LLM 生成的回答文本（包含引用标记如 [1]、[2]） |
| retrievalResults | array | 是 | 对应的检索结果列表 |
| format | string | 否 | 引用格式：`INLINE`（内联）/ `FOOTNOTE`（脚注，默认）/ `ENDNOTE`（尾注） |

**请求示例**

```json
{
  "answer": "Ontology 引擎通过 OWL 推理机实现推理与一致性校验[1]，支持 HermiT 和 ELK 两种推理机[2]。",
  "retrievalResults": [
    {
      "chunkId": "chunk-001",
      "docId": "doc-001",
      "docTitle": "架构设计文档",
      "content": "基于规则与 OWL 推理机执行本体推理...",
      "metadata": {"page": 2}
    },
    {
      "chunkId": "chunk-002",
      "docId": "doc-001",
      "docTitle": "架构设计文档",
      "content": "支持 HermiT 和 ELK 推理机...",
      "metadata": {"page": 3}
    }
  ],
  "format": "FOOTNOTE"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "formattedAnswer": "Ontology 引擎通过 OWL 推理机实现推理与一致性校验[1]，支持 HermiT 和 ELK 两种推理机[2]。\n\n---\n引用来源：\n[1] 架构设计文档, 第2页\n[2] 架构设计文档, 第3页",
    "citations": [
      {
        "index": 1,
        "docId": "doc-001",
        "docTitle": "架构设计文档",
        "chunkId": "chunk-001",
        "page": 2,
        "section": "推理引擎",
        "url": null,
        "snippet": "基于规则与 OWL 推理机执行本体推理..."
      },
      {
        "index": 2,
        "docId": "doc-001",
        "docTitle": "架构设计文档",
        "chunkId": "chunk-002",
        "page": 3,
        "section": "推理机选型",
        "url": null,
        "snippet": "支持 HermiT 和 ELK 推理机..."
      }
    ],
    "citationCount": 2,
    "unresolvedCitations": []
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | answer 或 retrievalResults 为空 |
| 42204 | 引用解析失败 |
| 42208 | 引用标记无法匹配到检索结果 |

---

### 3.6 知识库统计 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/rag/stats/overview` | 统计概览 |
| GET | `/api/v1/rag/stats/kb/{kbId}` | 知识库统计详情 |
| GET | `/api/v1/rag/stats/retrieval/hit-rate` | 检索命中率分析 |
| GET | `/api/v1/rag/stats/retrieval/latency` | 检索延迟分析 |
| GET | `/api/v1/rag/stats/retrieval/timeline` | 检索趋势时间线 |

---

#### 3.6.1 统计概览

**GET** `/api/v1/rag/stats/overview`

获取当前租户下所有知识库的统计概览。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startDate | string | 否 | 统计开始日期，ISO 8601，默认 7 天前 |
| endDate | string | 否 | 统计结束日期，ISO 8601，默认今天 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "totalKnowledgeBases": 12,
    "activeKnowledgeBases": 10,
    "totalDocuments": 1560,
    "totalChunks": 45200,
    "totalVectors": 45200,
    "totalSizeBytes": 5368709120,
    "retrievalStats": {
      "totalRetrievals": 25600,
      "totalRetrievalsToday": 320,
      "avgHitRate": 0.875,
      "avgLatencyMs": 85,
      "p95LatencyMs": 156,
      "p99LatencyMs": 230
    },
    "embeddingStats": {
      "totalEmbeddings": 45200,
      "totalTokens": 15600000,
      "avgLatencyMs": 45
    },
    "topKnowledgeBases": [
      {
        "kbId": "kb-product-tech-001",
        "name": "产品技术文档库",
        "documentCount": 128,
        "chunkCount": 4520,
        "retrievalCount": 8200,
        "hitRate": 0.92
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | 日期格式不合法 |
| 40301 | 无权查看统计数据 |

---

#### 3.6.2 知识库统计详情

**GET** `/api/v1/rag/stats/kb/{kbId}`

获取指定知识库的详细统计数据。

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 是 | 知识库 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startDate | string | 否 | 统计开始日期，默认 7 天前 |
| endDate | string | 否 | 统计结束日期，默认今天 |
| granularity | string | 否 | 时间粒度：`HOUR` / `DAY`（默认）/ `WEEK` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "kbId": "kb-product-tech-001",
    "kbName": "产品技术文档库",
    "documentCount": 128,
    "chunkCount": 4520,
    "vectorCount": 4520,
    "totalSizeBytes": 536870912,
    "documentsByType": {
      "PDF": 65,
      "WORD": 30,
      "MARKDOWN": 20,
      "HTML": 10,
      "AUDIO": 3
    },
    "documentsByStatus": {
      "READY": 125,
      "PARSING": 2,
      "FAILED": 1
    },
    "retrievalStats": {
      "totalRetrievals": 8200,
      "vectorRetrievals": 3200,
      "keywordRetrievals": 1500,
      "hybridRetrievals": 3500,
      "avgHitRate": 0.92,
      "avgLatencyMs": 78,
      "p95LatencyMs": 145,
      "p99LatencyMs": 210
    },
    "embeddingStats": {
      "totalEmbeddings": 4520,
      "totalTokens": 1560000,
      "modelUsed": "emb-doubao-large-1536"
    },
    "timeline": [
      {
        "date": "2026-07-10",
        "retrievals": 1100,
        "hitRate": 0.89,
        "avgLatencyMs": 82
      },
      {
        "date": "2026-07-11",
        "retrievals": 1250,
        "hitRate": 0.91,
        "avgLatencyMs": 76
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 知识库不存在 |
| 40301 | 无权查看该知识库统计 |

---

#### 3.6.3 检索命中率分析

**GET** `/api/v1/rag/stats/retrieval/hit-rate`

分析检索命中率趋势，支持按知识库、检索类型、时间维度筛选。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 否 | 知识库 ID，不传则统计所有知识库 |
| retrievalType | string | 否 | 检索类型：`VECTOR` / `KEYWORD` / `HYBRID` / `GRAPH` |
| startDate | string | 否 | 开始日期，默认 7 天前 |
| endDate | string | 否 | 结束日期，默认今天 |
| granularity | string | 否 | 时间粒度：`HOUR` / `DAY`（默认） |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "overall": {
      "totalRetrievals": 25600,
      "hitRetrievals": 22400,
      "missRetrievals": 3200,
      "hitRate": 0.875,
      "zeroResultRate": 0.05
    },
    "byType": [
      {
        "retrievalType": "VECTOR",
        "total": 8000,
        "hitRate": 0.85,
        "zeroResultRate": 0.06
      },
      {
        "retrievalType": "HYBRID",
        "total": 12000,
        "hitRate": 0.92,
        "zeroResultRate": 0.03
      }
    ],
    "timeline": [
      {
        "date": "2026-07-10",
        "totalRetrievals": 3500,
        "hitRate": 0.86,
        "zeroResultRate": 0.06
      },
      {
        "date": "2026-07-11",
        "totalRetrievals": 3800,
        "hitRate": 0.88,
        "zeroResultRate": 0.05
      }
    ],
    "topMissQueries": [
      {
        "query": "如何配置 SSO 单点登录",
        "missCount": 15,
        "lastMissAt": "2026-07-16T09:30:00.000+08:00"
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | 日期格式不合法 |
| 40401 | kbId 不存在 |
| 40301 | 无权查看统计数据 |

---

#### 3.6.4 检索延迟分析

**GET** `/api/v1/rag/stats/retrieval/latency`

分析检索延迟分布，支持分位数统计与瓶颈定位。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 否 | 知识库 ID |
| retrievalType | string | 否 | 检索类型 |
| startDate | string | 否 | 开始日期，默认 7 天前 |
| endDate | string | 否 | 结束日期，默认今天 |
| granularity | string | 否 | 时间粒度：`HOUR` / `DAY`（默认） |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "overall": {
      "avgLatencyMs": 85,
      "p50LatencyMs": 62,
      "p90LatencyMs": 125,
      "p95LatencyMs": 156,
      "p99LatencyMs": 230,
      "maxLatencyMs": 850
    },
    "byStage": {
      "embedding": {
        "avgMs": 45,
        "p95Ms": 80
      },
      "vectorSearch": {
        "avgMs": 12,
        "p95Ms": 25
      },
      "keywordSearch": {
        "avgMs": 8,
        "p95Ms": 15
      },
      "fusion": {
        "avgMs": 2,
        "p95Ms": 5
      },
      "rerank": {
        "avgMs": 18,
        "p95Ms": 35
      }
    },
    "byType": [
      {
        "retrievalType": "VECTOR",
        "avgMs": 57,
        "p95Ms": 105
      },
      {
        "retrievalType": "HYBRID",
        "avgMs": 112,
        "p95Ms": 180
      }
    ],
    "timeline": [
      {
        "date": "2026-07-10",
        "avgMs": 90,
        "p95Ms": 165
      },
      {
        "date": "2026-07-11",
        "avgMs": 82,
        "p95Ms": 148
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | 日期格式不合法 |
| 40401 | kbId 不存在 |
| 40301 | 无权查看统计数据 |

---

#### 3.6.5 检索趋势时间线

**GET** `/api/v1/rag/stats/retrieval/timeline`

获取检索量、命中率、延迟的时间线趋势数据，适用于仪表盘图表渲染。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| kbId | string | 否 | 知识库 ID |
| startDate | string | 否 | 开始日期，默认 30 天前 |
| endDate | string | 否 | 结束日期，默认今天 |
| granularity | string | 否 | 时间粒度：`HOUR` / `DAY`（默认）/ `WEEK` |
| metrics | array[string] | 否 | 返回的指标列表：`retrievals` / `hitRate` / `latency` / `tokens`，默认全部 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "granularity": "DAY",
    "startDate": "2026-06-16",
    "endDate": "2026-07-16",
    "series": [
      {
        "date": "2026-07-10",
        "retrievals": 3500,
        "hitRate": 0.86,
        "avgLatencyMs": 90,
        "tokens": 125000
      },
      {
        "date": "2026-07-11",
        "retrievals": 3800,
        "hitRate": 0.88,
        "avgLatencyMs": 82,
        "tokens": 138000
      },
      {
        "date": "2026-07-12",
        "retrievals": 2800,
        "hitRate": 0.84,
        "avgLatencyMs": 95,
        "tokens": 98000
      }
    ],
    "summary": {
      "totalRetrievals": 25600,
      "avgHitRate": 0.875,
      "avgLatencyMs": 85,
      "totalTokens": 920000,
      "trend": "INCREASING"
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | 日期格式不合法或范围过大 |
| 40401 | kbId 不存在 |
| 40301 | 无权查看统计数据 |

---

## 4. 数据模型

### 4.1 PostgreSQL 表定义

TECH-RAG 使用 PostgreSQL 17 存储知识库、文档、分块的元数据与统计数据。所有表均包含 `tenant_id` 字段实现多租户隔离。

#### 4.1.1 知识库表（rag_knowledge_bases）

```sql
CREATE TABLE rag_knowledge_bases (
    kb_id               VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    name                VARCHAR(128)  NOT NULL,
    description         TEXT,
    status              VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE / INACTIVE
    embedding_model_id  VARCHAR(128)  NOT NULL,
    embedding_dimension INTEGER       NOT NULL,
    chunk_strategy      JSONB         NOT NULL,
    retrieval_config    JSONB         NOT NULL DEFAULT '{}',
    ontology_concept_code VARCHAR(128),
    milvus_collection   VARCHAR(128)  NOT NULL,
    milvus_partition    VARCHAR(128),
    document_count      INTEGER       NOT NULL DEFAULT 0,
    chunk_count         INTEGER       NOT NULL DEFAULT 0,
    vector_count        INTEGER       NOT NULL DEFAULT 0,
    total_size_bytes    BIGINT        NOT NULL DEFAULT 0,
    metadata            JSONB         DEFAULT '{}',
    created_by          VARCHAR(64)   NOT NULL,
    updated_by          VARCHAR(64),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

-- 索引
CREATE UNIQUE INDEX idx_rag_kb_tenant_name ON rag_knowledge_bases(tenant_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_rag_kb_tenant_status ON rag_knowledge_bases(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_rag_kb_embedding_model ON rag_knowledge_bases(embedding_model_id);
CREATE INDEX idx_rag_kb_ontology ON rag_knowledge_bases(ontology_concept_code);
```

#### 4.1.2 文档表（rag_documents）

```sql
CREATE TABLE rag_documents (
    doc_id              VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    kb_id               VARCHAR(64)   NOT NULL REFERENCES rag_knowledge_bases(kb_id),
    title               VARCHAR(512)  NOT NULL,
    description         TEXT,
    file_name           VARCHAR(512),
    file_type           VARCHAR(20)   NOT NULL,   -- PDF / WORD / PPT / EXCEL / TEXT / MARKDOWN / HTML / AUDIO / VIDEO
    file_size           BIGINT        NOT NULL DEFAULT 0,
    file_hash           VARCHAR(128),              -- SHA-256
    source_url          TEXT,
    minio_object_key    VARCHAR(512),
    status              VARCHAR(20)   NOT NULL DEFAULT 'UPLOADED',  -- UPLOADED / DOWNLOADING / PARSING / PARSED / EMBEDDING / READY / FAILED
    status_detail       TEXT,
    chunk_count         INTEGER       NOT NULL DEFAULT 0,
    vector_count        INTEGER       NOT NULL DEFAULT 0,
    parse_duration      FLOAT,
    embed_duration      FLOAT,
    total_duration      FLOAT,
    parse_error         TEXT,
    parse_task_id       VARCHAR(64),
    metadata            JSONB         DEFAULT '{}',
    created_by          VARCHAR(64)   NOT NULL,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_rag_doc_kb ON rag_documents(kb_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_rag_doc_tenant ON rag_documents(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_rag_doc_status ON rag_documents(kb_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_rag_doc_file_hash ON rag_documents(tenant_id, file_hash) WHERE deleted_at IS NULL AND file_hash IS NOT NULL;
CREATE INDEX idx_rag_doc_created ON rag_documents(kb_id, created_at DESC) WHERE deleted_at IS NULL;
```

#### 4.1.3 文档分块表（rag_chunks）

```sql
CREATE TABLE rag_chunks (
    chunk_id            VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    doc_id              VARCHAR(64)   NOT NULL REFERENCES rag_documents(doc_id),
    kb_id               VARCHAR(64)   NOT NULL REFERENCES rag_knowledge_bases(kb_id),
    chunk_index         INTEGER       NOT NULL,
    content             TEXT          NOT NULL,
    content_length      INTEGER       NOT NULL,
    token_count         INTEGER,
    has_embedding       BOOLEAN       NOT NULL DEFAULT FALSE,
    embedding_dimension INTEGER,
    milvus_pk           BIGINT,                    -- Milvus 中的主键 ID
    metadata            JSONB         DEFAULT '{}',  -- page, section, bbox 等
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    
    UNIQUE(doc_id, chunk_index)
);

-- 索引
CREATE INDEX idx_rag_chunk_doc ON rag_chunks(doc_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_rag_chunk_kb ON rag_chunks(kb_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_rag_chunk_milvus ON rag_chunks(milvus_pk) WHERE milvus_pk IS NOT NULL;
```

#### 4.1.4 检索日志表（rag_retrieval_logs）

```sql
CREATE TABLE rag_retrieval_logs (
    id                  BIGSERIAL     PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    kb_id               VARCHAR(64)   NOT NULL,
    trace_id            VARCHAR(64)   NOT NULL,
    user_id             VARCHAR(64),
    retrieval_type      VARCHAR(20)   NOT NULL,   -- VECTOR / KEYWORD / HYBRID / GRAPH / MULTI_KB
    query               TEXT          NOT NULL,
    top_k               INTEGER,
    total_results       INTEGER       NOT NULL DEFAULT 0,
    has_results         BOOLEAN       NOT NULL DEFAULT FALSE,
    hit                 BOOLEAN       NOT NULL DEFAULT FALSE,
    embedding_duration  FLOAT,
    search_duration     FLOAT,
    rerank_duration     FLOAT,
    total_duration      FLOAT,
    embedding_model     VARCHAR(128),
    rerank_model        VARCHAR(128),
    vector_weight       FLOAT,
    keyword_weight      FLOAT,
    graph_weight        FLOAT,
    token_count         INTEGER,
    error               TEXT,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_rag_log_kb_time ON rag_retrieval_logs(kb_id, created_at DESC);
CREATE INDEX idx_rag_log_tenant_time ON rag_retrieval_logs(tenant_id, created_at DESC);
CREATE INDEX idx_rag_log_trace ON rag_retrieval_logs(trace_id);
CREATE INDEX idx_rag_log_type ON rag_retrieval_logs(kb_id, retrieval_type, created_at DESC);
```

#### 4.1.5 异步任务表（rag_tasks）

```sql
CREATE TABLE rag_tasks (
    task_id             VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    kb_id               VARCHAR(64),
    doc_id              VARCHAR(64),
    task_type           VARCHAR(40)   NOT NULL,   -- PARSE / EMBED / REPARSE / REEMBED / BATCH_UPLOAD / BATCH_EMBED / DOWNLOAD
    status              VARCHAR(20)   NOT NULL DEFAULT 'QUEUED',  -- QUEUED / RUNNING / SUCCESS / FAILED / CANCELLED
    progress            INTEGER       NOT NULL DEFAULT 0,          -- 0-100
    total_items         INTEGER,
    processed_items     INTEGER       NOT NULL DEFAULT 0,
    result              JSONB,
    error               TEXT,
    trace_id            VARCHAR(64),
    celery_task_id      VARCHAR(256),
    created_by          VARCHAR(64),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_rag_task_kb ON rag_tasks(kb_id, created_at DESC);
CREATE INDEX idx_rag_task_doc ON rag_tasks(doc_id, created_at DESC);
CREATE INDEX idx_rag_task_status ON rag_tasks(status, created_at DESC);
CREATE INDEX idx_rag_task_trace ON rag_tasks(trace_id);
```

#### 4.1.6 Embedding 缓存表（rag_embedding_cache）

```sql
CREATE TABLE rag_embedding_cache (
    id                  BIGSERIAL     PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    model_id            VARCHAR(128)  NOT NULL,
    text_hash           VARCHAR(128)  NOT NULL,    -- SHA-256 of text
    embedding           BYTEA,                     -- 序列化的向量数据
    dimension           INTEGER       NOT NULL,
    token_count         INTEGER,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ,
    
    UNIQUE(model_id, text_hash)
);

-- 索引
CREATE INDEX idx_rag_emb_cache_lookup ON rag_embedding_cache(model_id, text_hash);
CREATE INDEX idx_rag_emb_cache_expire ON rag_embedding_cache(expires_at) WHERE expires_at IS NOT NULL;
```

#### 4.1.7 Outbox 事件表（rag_outbox_events）

```sql
CREATE TABLE rag_outbox_events (
    id                  BIGSERIAL     PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    aggregate_type      VARCHAR(40)   NOT NULL,    -- KNOWLEDGE_BASE / DOCUMENT / CHUNK / RETRIEVAL
    aggregate_id        VARCHAR(64)   NOT NULL,
    event_type          VARCHAR(60)   NOT NULL,    -- 见第 5 章事件定义
    event_data          JSONB         NOT NULL,
    trace_id            VARCHAR(64)   NOT NULL,
    status              VARCHAR(20)   NOT NULL DEFAULT 'PENDING',  -- PENDING / SENT / FAILED
    retry_count         INTEGER       NOT NULL DEFAULT 0,
    max_retries         INTEGER       NOT NULL DEFAULT 3,
    kafka_topic         VARCHAR(128)  NOT NULL,
    kafka_partition     INTEGER,
    kafka_offset        BIGINT,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    sent_at             TIMESTAMPTZ,
    next_retry_at       TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_rag_outbox_pending ON rag_outbox_events(status, created_at) WHERE status = 'PENDING';
CREATE INDEX idx_rag_outbox_aggregate ON rag_outbox_events(aggregate_type, aggregate_id);
CREATE INDEX idx_rag_outbox_trace ON rag_outbox_events(trace_id);
```

### 4.2 Milvus Collection 定义

每个知识库在 Milvus 中对应一个独立的 Collection，Collection 名称为 `rag_kb_{kb_id_sanitized}`。

#### 4.2.1 Collection Schema

```python
from pymilvus import CollectionSchema, FieldSchema, DataType

# 向量字段维度由知识库的 embedding_dimension 决定
def create_kb_collection_schema(dimension: int) -> CollectionSchema:
    fields = [
        # Milvus 主键
        FieldSchema(name="pk", dtype=DataType.INT64, is_primary=True, auto_id=True),
        
        # PostgreSQL 中的 chunk_id，用于跨数据库关联
        FieldSchema(name="chunk_id", dtype=DataType.VARCHAR, max_length=64),
        
        # 文档 ID
        FieldSchema(name="doc_id", dtype=DataType.VARCHAR, max_length=64),
        
        # 知识库 ID
        FieldSchema(name="kb_id", dtype=DataType.VARCHAR, max_length=64),
        
        # 租户 ID
        FieldSchema(name="tenant_id", dtype=DataType.VARCHAR, max_length=64),
        
        # 向量字段
        FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=dimension),
        
        # 分块文本内容（用于检索时直接返回，可选）
        FieldSchema(name="content", dtype=DataType.VARCHAR, max_length=8192),
        
        # 分块索引
        FieldSchema(name="chunk_index", dtype=DataType.INT32),
        
        # 元数据 JSON 字符串
        FieldSchema(name="metadata", dtype=DataType.VARCHAR, max_length=4096),
        
        # 文件类型（用于过滤）
        FieldSchema(name="file_type", dtype=DataType.VARCHAR, max_length=20),
        
        # 文档 ID 列表（用于过滤，标量字段）
        FieldSchema(name="doc_ids", dtype=DataType.VARCHAR, max_length=4096),
        
        # 创建时间戳
        FieldSchema(name="created_at", dtype=DataType.INT64),
    ]
    
    return CollectionSchema(fields=fields, description="RAG Knowledge Base Collection")
```

#### 4.2.2 索引配置

```python
# 向量索引：HNSW（推荐，低延迟）
index_params = {
    "index_type": "HNSW",
    "metric_type": "COSINE",  # COSINE / IP / L2，由知识库 retrieval_config.metricType 决定
    "params": {
        "M": 16,               # 每层最大连接数
        "efConstruction": 256   # 构建时搜索宽度
    }
}

# 备选：IVF_FLAT（适合大规模数据）
# index_params = {
#     "index_type": "IVF_FLAT",
#     "metric_type": "COSINE",
#     "params": {"nlist": 1024}
# }

# 标量字段索引
scalar_indexes = {
    "chunk_id": {"index_type": "STL_SORT"},
    "doc_id": {"index_type": "STL_SORT"},
    "file_type": {"index_type": "STL_SORT"},
}
```

#### 4.2.3 检索参数

```python
# HNSW 检索参数
search_params = {
    "metric_type": "COSINE",
    "params": {
        "ef": 64   # 检索时搜索宽度，越大越精确但越慢
    }
}

# IVF_FLAT 检索参数
# search_params = {
#     "metric_type": "COSINE",
#     "params": {"nprobe": 16}
# }
```

#### 4.2.4 分区策略

```python
# 按租户分区，实现物理隔离
partition_name = f"tenant_{tenant_id}"
collection.create_partition(partition_name=partition_name)

# 按文档分区（适用于文档级独立检索场景）
# partition_name = f"doc_{doc_id}"
```

### 4.3 Redis 缓存结构

| Key 模式 | 类型 | TTL | 说明 |
|---|---|---|---|
| `rag:kb:{kbId}:info` | Hash | 1h | 知识库基本信息缓存 |
| `rag:kb:{kbId}:config` | Hash | 1h | 知识库检索配置缓存 |
| `rag:emb:{modelId}:{textHash}` | String | 24h | Embedding 向量缓存 |
| `rag:retrieve:{queryHash}:{kbId}` | String | 5m | 检索结果缓存 |
| `rag:doc:{docId}:status` | String | 30s | 文档处理状态缓存（高频轮询） |
| `rag:stats:{kbId}:daily` | Hash | 1h | 知识库每日统计缓存 |
| `rag:task:{taskId}` | String | 1h | 异步任务状态缓存 |
| `rag:rate:{tenantId}:retrieve` | String | 1m | 检索限流计数器 |

---

## 5. 事件定义

### 5.1 Kafka Topic 定义

TECH-RAG 所有 Kafka 消息发布遵循 **Outbox 模式**：业务数据与事件写入同一 PostgreSQL 事务，由 Outbox Poller 异步投递至 Kafka。

| Topic | 说明 | 分区数 | 保留时间 |
|---|---|---|---|
| `rag.document.events` | 文档处理生命周期事件 | 12 | 7 天 |
| `rag.retrieval.events` | 检索事件 | 12 | 3 天 |
| `rag.kb.events` | 知识库变更事件 | 6 | 7 天 |
| `rag.embedding.events` | Embedding 服务事件 | 6 | 3 天 |
| `rag.dlq` | 死信队列 | 3 | 30 天 |

### 5.2 消息通用格式

所有 Kafka 消息遵循统一的信封格式：

```json
{
  "eventId": "evt-20260716-000001",
  "eventType": "DOCUMENT_UPLOADED",
  "aggregateType": "DOCUMENT",
  "aggregateId": "doc-20260716-000001",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-07-16T11:00:00.000+08:00",
  "version": "1.0",
  "source": "tech-rag",
  "data": { }
}
```

Kafka 消息头：

| Header | 说明 |
|---|---|
| `X-Trace-Id` | 链路追踪 ID |
| `X-Tenant-Id` | 租户 ID |
| `X-Event-Type` | 事件类型 |
| `X-Event-Id` | 事件唯一 ID（幂等去重） |
| `Content-Type` | `application/json` |

### 5.3 文档处理事件（rag.document.events）

#### 5.3.1 DOCUMENT_UPLOADED

文档上传成功后发布。

```json
{
  "eventId": "evt-20260716-000001",
  "eventType": "DOCUMENT_UPLOADED",
  "aggregateType": "DOCUMENT",
  "aggregateId": "doc-20260716-000001",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-07-16T11:00:00.000+08:00",
  "version": "1.0",
  "source": "tech-rag",
  "data": {
    "docId": "doc-20260716-000001",
    "kbId": "kb-product-tech-001",
    "title": "Mate Platform 架构设计文档",
    "fileName": "mate-platform-arch.pdf",
    "fileType": "PDF",
    "fileSize": 4194304,
    "fileHash": "sha256:a1b2c3d4e5f6...",
    "minioObjectKey": "rag/kb-product-tech-001/doc-20260716-000001/mate-platform-arch.pdf",
    "autoParse": true,
    "autoEmbed": true,
    "uploadedBy": "user-001"
  }
}
```

#### 5.3.2 DOCUMENT_PARSING_STARTED

文档解析开始时发布。

```json
{
  "eventId": "evt-20260716-000002",
  "eventType": "DOCUMENT_PARSING_STARTED",
  "aggregateType": "DOCUMENT",
  "aggregateId": "doc-20260716-000001",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-07-16T11:00:05.000+08:00",
  "version": "1.0",
  "source": "tech-rag",
  "data": {
    "docId": "doc-20260716-000001",
    "kbId": "kb-product-tech-001",
    "parseTaskId": "task-parse-20260716-000001",
    "chunkStrategy": {
      "type": "RECURSIVE",
      "chunkSize": 512,
      "chunkOverlap": 50
    }
  }
}
```

#### 5.3.3 DOCUMENT_PARSED

文档解析与分块完成时发布。

```json
{
  "eventId": "evt-20260716-000003",
  "eventType": "DOCUMENT_PARSED",
  "aggregateType": "DOCUMENT",
  "aggregateId": "doc-20260716-000001",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-07-16T11:02:00.000+08:00",
  "version": "1.0",
  "source": "tech-rag",
  "data": {
    "docId": "doc-20260716-000001",
    "kbId": "kb-product-tech-001",
    "chunkCount": 86,
    "totalTokens": 42000,
    "parseDuration": 12.5,
    "status": "PARSED"
  }
}
```

#### 5.3.4 DOCUMENT_EMBEDDING_STARTED

文档向量化开始时发布。

```json
{
  "eventId": "evt-20260716-000004",
  "eventType": "DOCUMENT_EMBEDDING_STARTED",
  "aggregateType": "DOCUMENT",
  "aggregateId": "doc-20260716-000001",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-07-16T11:02:05.000+08:00",
  "version": "1.0",
  "source": "tech-rag",
  "data": {
    "docId": "doc-20260716-000001",
    "kbId": "kb-product-tech-001",
    "totalChunks": 86,
    "embeddingModelId": "emb-doubao-large-1536",
    "embeddingDimension": 1536
  }
}
```

#### 5.3.5 DOCUMENT_READY

文档全部处理完成（解析 + 向量化）时发布。

```json
{
  "eventId": "evt-20260716-000005",
  "eventType": "DOCUMENT_READY",
  "aggregateType": "DOCUMENT",
  "aggregateId": "doc-20260716-000001",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-07-16T11:05:30.000+08:00",
  "version": "1.0",
  "source": "tech-rag",
  "data": {
    "docId": "doc-20260716-000001",
    "kbId": "kb-product-tech-001",
    "chunkCount": 86,
    "vectorCount": 86,
    "totalDuration": 20.8,
    "parseDuration": 12.5,
    "embedDuration": 8.3,
    "status": "READY"
  }
}
```

#### 5.3.6 DOCUMENT_PARSE_FAILED

文档解析或向量化失败时发布。

```json
{
  "eventId": "evt-20260716-000006",
  "eventType": "DOCUMENT_PARSE_FAILED",
  "aggregateType": "DOCUMENT",
  "aggregateId": "doc-20260716-000002",
  "tenantId": "tenant-001",
  "traceId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "timestamp": "2026-07-16T11:10:30.000+08:00",
  "version": "1.0",
  "source": "tech-rag",
  "data": {
    "docId": "doc-20260716-000002",
    "kbId": "kb-product-tech-001",
    "stage": "EMBEDDING",
    "errorCode": "42203",
    "errorMessage": "向量化失败：LLMGW 返回 500",
    "failedChunkIndex": 45,
    "totalChunks": 86,
    "processedChunks": 45
  }
}
```

#### 5.3.7 DOCUMENT_DELETED

文档删除完成时发布。

```json
{
  "eventId": "evt-20260716-000007",
  "eventType": "DOCUMENT_DELETED",
  "aggregateType": "DOCUMENT",
  "aggregateId": "doc-20260716-000001",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-07-16T12:00:00.000+08:00",
  "version": "1.0",
  "source": "tech-rag",
  "data": {
    "docId": "doc-20260716-000001",
    "kbId": "kb-product-tech-001",
    "deletedChunks": 86,
    "deletedVectors": 86,
    "minioFileDeleted": true,
    "deletedBy": "user-001"
  }
}
```

### 5.4 检索事件（rag.retrieval.events）

#### 5.4.1 RETRIEVAL_EXECUTED

每次检索执行后发布，用于统计分析与监控。

```json
{
  "eventId": "evt-20260716-000010",
  "eventType": "RETRIEVAL_EXECUTED",
  "aggregateType": "RETRIEVAL",
  "aggregateId": "ret-20260716-000001",
  "tenantId": "tenant-001",
  "traceId": "c3d4e5f6-a7b8-9012-cdef-345678901234",
  "timestamp": "2026-07-16T14:30:00.000+08:00",
  "version": "1.0",
  "source": "tech-rag",
  "data": {
    "kbId": "kb-product-tech-001",
    "retrievalType": "HYBRID",
    "query": "Ontology 引擎如何实现推理",
    "topK": 10,
    "totalResults": 8,
    "hasResults": true,
    "hit": true,
    "embeddingDuration": 0.045,
    "searchDuration": 0.012,
    "rerankDuration": 0.045,
    "totalDuration": 0.112,
    "embeddingModel": "emb-doubao-large-1536",
    "rerankModel": "rerank-doubao-pro",
    "vectorWeight": 0.7,
    "keywordWeight": 0.3,
    "tokenCount": 32,
    "userId": "user-001"
  }
}
```

#### 5.4.2 RETRIEVAL_ZERO_RESULT

检索结果为空时发布（用于监控知识覆盖盲区）。

```json
{
  "eventId": "evt-20260716-000011",
  "eventType": "RETRIEVAL_ZERO_RESULT",
  "aggregateType": "RETRIEVAL",
  "aggregateId": "ret-20260716-000002",
  "tenantId": "tenant-001",
  "traceId": "d4e5f6a7-b8c9-0123-defa-456789012345",
  "timestamp": "2026-07-16T14:35:00.000+08:00",
  "version": "1.0",
  "source": "tech-rag",
  "data": {
    "kbId": "kb-product-tech-001",
    "retrievalType": "HYBRID",
    "query": "如何配置 SSO 单点登录",
    "topK": 10,
    "totalResults": 0,
    "totalDuration": 0.098,
    "userId": "user-001"
  }
}
```

### 5.5 知识库事件（rag.kb.events）

#### 5.5.1 KB_CREATED

```json
{
  "eventId": "evt-20260716-000020",
  "eventType": "KB_CREATED",
  "aggregateType": "KNOWLEDGE_BASE",
  "aggregateId": "kb-product-tech-001",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-07-16T10:30:00.000+08:00",
  "version": "1.0",
  "source": "tech-rag",
  "data": {
    "kbId": "kb-product-tech-001",
    "name": "产品技术文档库",
    "embeddingModelId": "emb-doubao-large-1536",
    "embeddingDimension": 1536,
    "milvusCollection": "rag_kb_product_tech_001",
    "ontologyConceptCode": "TechnicalDocument",
    "createdBy": "user-001"
  }
}
```

#### 5.5.2 KB_EMBEDDING_MODEL_CHANGED

```json
{
  "eventId": "evt-20260716-000021",
  "eventType": "KB_EMBEDDING_MODEL_CHANGED",
  "aggregateType": "KNOWLEDGE_BASE",
  "aggregateId": "kb-product-tech-001",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-07-16T16:00:00.000+08:00",
  "version": "1.0",
  "source": "tech-rag",
  "data": {
    "kbId": "kb-product-tech-001",
    "previousModelId": "emb-doubao-large-1536",
    "previousDimension": 1536,
    "newModelId": "emb-doubao-large-2048",
    "newDimension": 2048,
    "dimensionChanged": true,
    "reembedTaskId": "task-reembed-20260716-001",
    "totalChunksToReembed": 4520
  }
}
```

#### 5.5.3 KB_DELETED

```json
{
  "eventId": "evt-20260716-000022",
  "eventType": "KB_DELETED",
  "aggregateType": "KNOWLEDGE_BASE",
  "aggregateId": "kb-product-tech-001",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-07-16T17:00:00.000+08:00",
  "version": "1.0",
  "source": "tech-rag",
  "data": {
    "kbId": "kb-product-tech-001",
    "deletedDocuments": 128,
    "deletedChunks": 4520,
    "deletedVectors": 4520,
    "milvusCollectionDropped": true,
    "minioFilesDeleted": 128,
    "deletedBy": "user-001"
  }
}
```

### 5.6 DLQ 处理

#### 5.6.1 DLQ 消息格式

消费失败的消息写入 `rag.dlq` Topic，包含原始消息与失败原因：

```json
{
  "eventId": "dlq-20260716-000001",
  "eventType": "DLQ_MESSAGE",
  "aggregateType": "DOCUMENT",
  "aggregateId": "doc-20260716-000001",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-07-16T11:00:10.000+08:00",
  "version": "1.0",
  "source": "tech-rag",
  "data": {
    "originalTopic": "rag.document.events",
    "originalEventType": "DOCUMENT_UPLOADED",
    "originalEventId": "evt-20260716-000001",
    "consumerGroup": "tech-rag-parse-consumer",
    "retryCount": 3,
    "maxRetries": 3,
    "failureReason": "Celery task timeout after 300s",
    "failureStage": "PARSE",
    "errorCode": "50008",
    "originalMessage": { },
    "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

#### 5.6.2 重试策略

| 参数 | 值 | 说明 |
|---|---|---|
| 最大重试次数 | 3 | 超过后进入 DLQ |
| 重试间隔 | 指数退避：5s, 25s, 125s | 避免雪崩 |
| DLQ 保留时间 | 30 天 | 超过后自动清理 |
| DLQ 告警 | 超过 10 条/小时触发告警 | Prometheus alertmanager |

---

## 6. 增量交付计划

### 6.1 交付阶段总览

| 阶段 | 名称 | 时间 | 范围 | 核心交付物 |
|---|---|---|---|---|
| P0 | MVP 基础检索 | W1-W2 | 知识库 CRUD + 文档上传/解析 + 向量检索 | 基础 RAG 检索能力闭环 |
| P1 | 混合检索 | W3-W4 | 关键词检索 + 混合检索 + Rerank | 检索质量提升 |
| P2 | 图谱增强 | W5-W6 | 图谱增强检索 + 实体链接 + 上下文组装 | 本体语义检索 |
| P3 | 运营统计 | W7-W8 | 知识库统计 + 命中率分析 + 延迟分析 | 运营可观测性 |
| P4 | 性能优化 | W9-W10 | Embedding 缓存 + 检索缓存 + 批量向量化 | 性能提升 |

### 6.2 P0 - MVP 基础检索（W1-W2）

**目标**：实现最小可用的 RAG 检索能力闭环。

**交付 API**：

| API | 说明 |
|---|---|
| POST `/api/v1/rag/knowledge-bases` | 创建知识库 |
| GET `/api/v1/rag/knowledge-bases` | 知识库列表 |
| GET `/api/v1/rag/knowledge-bases/{kbId}` | 知识库详情 |
| PUT `/api/v1/rag/knowledge-bases/{kbId}` | 更新知识库 |
| DELETE `/api/v1/rag/knowledge-bases/{kbId}` | 删除知识库 |
| PUT `/api/v1/rag/knowledge-bases/{kbId}/chunk-strategy` | 配置分块策略 |
| PUT `/api/v1/rag/knowledge-bases/{kbId}/embedding-model` | 配置 Embedding 模型 |
| POST `/api/v1/rag/knowledge-bases/{kbId}/documents/upload` | 上传文档 |
| GET `/api/v1/rag/knowledge-bases/{kbId}/documents` | 文档列表 |
| GET `/api/v1/rag/knowledge-bases/{kbId}/documents/{docId}` | 文档详情 |
| DELETE `/api/v1/rag/knowledge-bases/{kbId}/documents/{docId}` | 删除文档 |
| GET `/api/v1/rag/knowledge-bases/{kbId}/documents/{docId}/status` | 文档状态 |
| POST `/api/v1/rag/embeddings` | 单条向量化 |
| GET `/api/v1/rag/embeddings/models` | 模型列表 |
| POST `/api/v1/rag/retrieve/vector` | 向量检索 |

**支撑能力**：
- PostgreSQL 表：rag_knowledge_bases, rag_documents, rag_chunks, rag_tasks, rag_outbox_events
- Milvus Collection 创建与向量写入
- MinIO 文件上传与下载
- Celery 异步文档解析（PDF/Word/TXT/Markdown）
- LangChain 文档加载器与分块器
- TECH-LLMGW 对接（Embedding 调用）
- Kafka Outbox 模式实现（文档处理事件）
- trace_id 全链路传播

### 6.3 P1 - 混合检索（W3-W4）

**目标**：提升检索质量，支持多路召回与重排序。

**新增 API**：

| API | 说明 |
|---|---|
| POST `/api/v1/rag/retrieve/keyword` | 关键词检索 |
| POST `/api/v1/rag/retrieve/hybrid` | 混合检索 |
| GET `/api/v1/rag/knowledge-bases/{kbId}/retrieval-config` | 获取检索参数 |
| PUT `/api/v1/rag/knowledge-bases/{kbId}/retrieval-config` | 配置检索参数 |
| POST `/api/v1/rag/embeddings/batch` | 批量向量化 |
| POST `/api/v1/rag/knowledge-bases/{kbId}/documents/{docId}/reparse` | 重新解析 |
| POST `/api/v1/rag/knowledge-bases/{kbId}/documents/batch-upload` | 批量上传 |
| POST `/api/v1/rag/knowledge-bases/{kbId}/documents/urls` | URL 导入 |

**支撑能力**：
- BM25 关键词检索引擎（PostgreSQL全文索引或 Elasticsearch）
- 混合检索融合算法（RRF / 加权融合）
- Rerank 模型对接（TECH-LLMGW）
- 检索结果高亮
- 音视频文档 ASR 转写（通过 TECH-LLMGW ASR 能力）
- Kafka 检索事件发布

### 6.4 P2 - 图谱增强（W5-W6）

**目标**：基于本体语义实现精准检索增强。

**新增 API**：

| API | 说明 |
|---|---|
| POST `/api/v1/rag/retrieve/graph` | 图谱增强检索 |
| POST `/api/v1/rag/enhance/entity-linking` | 实体链接 |
| POST `/api/v1/rag/enhance/context-assembly` | 上下文组装 |
| POST `/api/v1/rag/enhance/citations` | 引用来源生成 |
| POST `/api/v1/rag/retrieve/multi-kb` | 跨知识库检索 |

**支撑能力**：
- TECH-ONT 实体链接对接
- 知识图谱关系扩展查询（Neo4j / TECH-ONT API）
- 上下文组装策略（CONCAT / SUMMARIZE / STRUCTURED）
- 引用解析与格式化
- 跨知识库检索合并与重排

### 6.5 P3 - 运营统计（W7-W8）

**目标**：提供知识库运营可观测性。

**新增 API**：

| API | 说明 |
|---|---|
| GET `/api/v1/rag/stats/overview` | 统计概览 |
| GET `/api/v1/rag/stats/kb/{kbId}` | 知识库统计详情 |
| GET `/api/v1/rag/stats/retrieval/hit-rate` | 命中率分析 |
| GET `/api/v1/rag/stats/retrieval/latency` | 延迟分析 |
| GET `/api/v1/rag/stats/retrieval/timeline` | 趋势时间线 |
| GET `/api/v1/rag/embeddings/models/{modelId}` | 模型详情 |
| GET `/api/v1/rag/knowledge-bases/{kbId}/chunk-strategy` | 获取分块策略 |
| GET `/api/v1/rag/knowledge-bases/{kbId}/embedding-model` | 获取 Embedding 模型配置 |
| GET `/api/v1/rag/knowledge-bases/{kbId}/documents/{docId}/chunks` | 分块列表 |

**支撑能力**：
- rag_retrieval_logs 检索日志采集与聚合
- 统计数据 Redis 缓存
- Prometheus 指标导出
- 仪表盘数据接口

### 6.6 P4 - 性能优化（W9-W10）

**目标**：系统性能优化与生产就绪。

**优化项**：

| 优化项 | 说明 |
|---|---|
| Embedding 缓存 | rag_embedding_cache 表 + Redis 双层缓存，避免重复向量化 |
| 检索结果缓存 | Redis 缓存高频查询结果，TTL 5 分钟 |
| Milvus 索引优化 | HNSW 参数调优、RaBitQ 量化 |
| 批量向量化优化 | 批量大小动态调整、并行调用 LLMGW |
| 文档解析并行化 | 大文档分页并行解析 |
| 连接池优化 | PostgreSQL / Milvus / Redis 连接池配置 |
| 限流策略 | 基于 Redis 的滑动窗口限流 |
| DLQ 告警 | Prometheus alertmanager 集成 |
| 水平扩容 | Celery worker 水平扩容、API 无状态部署 |

---

## 附录 A. 枚举值定义

### A.1 知识库状态（KnowledgeBaseStatus）

| 值 | 说明 |
|---|---|
| ACTIVE | 活跃，可正常使用 |
| INACTIVE | 停用，不可检索 |

### A.2 文档状态（DocumentStatus）

| 值 | 说明 |
|---|---|
| UPLOADED | 已上传，等待解析 |
| DOWNLOADING | URL 下载中 |
| PARSING | 解析分块中 |
| PARSED | 解析完成，等待向量化 |
| EMBEDDING | 向量化中 |
| READY | 就绪，可检索 |
| FAILED | 处理失败 |

### A.3 文件类型（FileType）

| 值 | 说明 | 扩展名 |
|---|---|---|
| PDF | PDF 文档 | .pdf |
| WORD | Word 文档 | .doc, .docx |
| PPT | PowerPoint | .ppt, .pptx |
| EXCEL | Excel/CSV | .xls, .xlsx, .csv |
| TEXT | 纯文本 | .txt, .rst |
| MARKDOWN | Markdown | .md |
| HTML | 网页 | .html, .htm |
| AUDIO | 音频 | .mp3, .wav, .m4a, .flac |
| VIDEO | 视频 | .mp4, .avi, .mov, .mkv |

### A.4 分块策略类型（ChunkStrategyType）

| 值 | 说明 | 适用场景 |
|---|---|---|
| FIXED_SIZE | 固定大小分块 | 通用场景 |
| RECURSIVE | 递归分块 | 结构化文本 |
| SENTENCE | 按句分块 | 对话/文章 |
| MARKDOWN | Markdown 结构分块 | 技术文档 |
| SEMANTIC | 语义分块 | 高质量检索 |

### A.5 距离度量类型（MetricType）

| 值 | 说明 | 公式 |
|---|---|---|
| COSINE | 余弦相似度 | 1 - cos(a, b) |
| IP | 内积 | dot(a, b) |
| L2 | 欧氏距离 | ||a - b|| |

### A.6 检索类型（RetrievalType）

| 值 | 说明 |
|---|---|
| VECTOR | 向量检索 |
| KEYWORD | 关键词检索 |
| HYBRID | 混合检索 |
| GRAPH | 图谱增强检索 |
| MULTI_KB | 跨知识库检索 |

### A.7 异步任务类型（TaskType）

| 值 | 说明 |
|---|---|
| PARSE | 文档解析 |
| EMBED | 文档向量化 |
| REPARSE | 重新解析 |
| REEMBED | 重新向量化 |
| BATCH_UPLOAD | 批量上传 |
| BATCH_EMBED | 批量向量化 |
| DOWNLOAD | URL 下载 |

### A.8 异步任务状态（TaskStatus）

| 值 | 说明 |
|---|---|
| QUEUED | 排队中 |
| RUNNING | 执行中 |
| SUCCESS | 成功 |
| FAILED | 失败 |
| CANCELLED | 已取消 |

### A.9 事件类型（EventType）

| 值 | Topic | 说明 |
|---|---|---|
| DOCUMENT_UPLOADED | rag.document.events | 文档上传 |
| DOCUMENT_PARSING_STARTED | rag.document.events | 开始解析 |
| DOCUMENT_PARSED | rag.document.events | 解析完成 |
| DOCUMENT_EMBEDDING_STARTED | rag.document.events | 开始向量化 |
| DOCUMENT_READY | rag.document.events | 文档就绪 |
| DOCUMENT_PARSE_FAILED | rag.document.events | 解析/向量化失败 |
| DOCUMENT_DELETED | rag.document.events | 文档删除 |
| RETRIEVAL_EXECUTED | rag.retrieval.events | 检索执行 |
| RETRIEVAL_ZERO_RESULT | rag.retrieval.events | 检索零结果 |
| KB_CREATED | rag.kb.events | 知识库创建 |
| KB_EMBEDDING_MODEL_CHANGED | rag.kb.events | Embedding 模型变更 |
| KB_DELETED | rag.kb.events | 知识库删除 |

---

## 附录 B. 依赖服务接口约定

### B.1 TECH-LLMGW 调用

| 调用场景 | 接口 | 说明 |
|---|---|---|
| Embedding 生成 | `POST /api/v1/llmgw/embeddings` | 文本向量化 |
| 批量 Embedding | `POST /api/v1/llmgw/embeddings/batch` | 批量向量化 |
| Rerank | `POST /api/v1/llmgw/rerank` | 重排序 |
| ASR 转写 | `POST /api/v1/llmgw/asr` | 音视频转文字 |
| 模型列表 | `GET /api/v1/llmgw/models?type=embedding` | 获取可用模型 |

所有调用透传 `X-Trace-Id` 头。

### B.2 TECH-ONT 调用

| 调用场景 | 接口 | 说明 |
|---|---|---|
| 实体链接 | `POST /api/v1/ont/entities/linking` | 文本实体识别与链接 |
| 图谱查询 | `POST /api/v1/ont/graph/query` | 实体关系扩展查询 |
| 概念查询 | `GET /api/v1/ont/concepts/{conceptCode}` | 概念详情 |

所有调用透传 `X-Trace-Id` 头。

### B.3 TECH-DATA 调用

| 调用场景 | 接口 | 说明 |
|---|---|---|
| 数据源同步 | `GET /api/v1/data/sources/{sourceId}/sync` | 触发数据源同步 |
| 结构化数据查询 | `POST /api/v1/data/query` | 查询结构化数据 |

---

> 文档结束。本规范为 TECH-RAG 服务 API 的权威定义，所有接口实现与变更须以此文档为准。变更需通过架构评审并更新版本号。
