# SPEC - LLM Gateway 服务 API 规范（TECH-LLMGW）

> 文档版本：v1.0
> 文档日期：2026-07-16
> 适用模块：TECH-LLMGW（LLM Gateway Service）
> 维护方：Mate Platform 平台架构组
> 状态：定稿

---

## 版本历史

| 版本 | 日期 | 变更说明 | 作者 |
|---|---|---|---|
| v1.0 | 2026-07-16 | 初始版本 | - |

---

## 1. 服务概述

### 1.1 服务定位

TECH-LLMGW 是 Mate Platform 的**大模型统一接入网关**，为平台所有 AI 应用与技术服务提供统一的 LLM 调用入口。作为 AI 能力底座的核心枢纽，TECH-LLMGW 屏蔽底层模型供应商差异，提供模型路由、流量控制、成本核算、Prompt 管理与调用审计等企业级能力，确保所有 LLM 调用的可观测、可控制、可计量。

平台架构约束规定：**所有 LLM 调用必须通过 TECH-LLMGW，不直接访问模型 API**。TECH-AGENT、TECH-RAG、APP-SUPERAI、APP-DW 等所有需要 LLM 能力的服务与应用均通过 TECH-LLMGW 统一路由。

核心职责：

- **模型供应商管理**：配置模型供应商（OpenAI / Anthropic / 火山方舟 / 通义千问 / 智谱 / 百川等）、API Key 加密管理、模型列表同步与维护
- **模型路由**：按模型名称路由到对应供应商、Fallback 机制（主模型不可用时自动切换备用模型）、负载均衡
- **流量控制**：QPS 限流、Token 配额管理、用户级 / 应用级 / 租户级多维度配额控制
- **对话接口**：同步对话、流式对话（SSE）、多模态输入（文本 + 图片 + 文件）、Function Calling 支持
- **Embedding 接口**：单条文本向量化、批量向量化、Embedding 模型管理与切换
- **Prompt 管理**：Prompt 模板 CRUD、版本管理、变量替换、实时预览
- **成本核算**：Token 消耗统计、按用户 / 应用 / 模型 / 供应商维度的成本报表
- **调用审计**：调用日志、错误追踪、延迟统计、全链路 trace_id 关联

### 1.2 技术栈

| 层级 | 技术 | 版本 | 用途 |
|---|---|---|---|
| 语言/框架 | Python + FastAPI | 3.13 / 0.115 | 服务主体，异步高性能 API |
| AI SDK | OpenAI SDK / Anthropic SDK | latest | 多供应商模型调用 SDK |
| 关系数据库 | PostgreSQL | 17 | 供应商配置、模型配置、Prompt 模板、调用日志、成本数据 |
| 缓存 | Redis | 7.4 | 限流计数器、配额缓存、Prompt 缓存、模型列表缓存、会话上下文 |
| 消息队列 | Kafka | 3.9 | Token 消耗事件、调用审计事件（Outbox 模式） |
| 可观测性 | OpenTelemetry + Prometheus | 1.45 / 3.x | trace_id 传播、指标采集、延迟监控 |
| 加密 | AES-256-GCM | - | API Key 加密存储 |
| 流式输出 | SSE（Server-Sent Events） | - | 流式对话实时推送 |

### 1.3 上游依赖

| 上游服务 | 依赖关系 | 说明 |
|---|---|---|
| 外部模型 API | 强依赖 | OpenAI / Anthropic / 火山方舟 / 通义千问等模型供应商 API，TECH-LLMGW 作为统一代理层 |
| TECH-IAM | 强依赖 | 用户认证、租户隔离、API Key 权限校验 |
| TECH-MSG | 弱依赖 | Kafka 消息基础设施（Token 消耗事件、审计事件发布） |
| TECH-OBS | 弱依赖 | 可观测性指标上报 |

### 1.4 下游消费方

| 下游服务/应用 | 消费方式 | 说明 |
|---|---|---|
| TECH-RAG | REST API | Embedding 生成、Rerank 模型调用，所有向量化请求通过 LLM Gateway |
| TECH-AGENT | REST API + SSE | Agent 执行中的所有 LLM 调用（Chat / Function Calling），支持流式输出 |
| APP-SUPERAI | REST API + SSE | 超级 AI 对话应用的所有模型调用，支持同步与流式 |
| APP-DW | REST API + SSE | 数字员工对话与推理的模型调用 |
| TECH-MCP | REST API | MCP Server 暴露的 LLM 能力 Tool 通过 LLM Gateway 调用 |
| APP-APPHUB | REST API | 低代码应用中嵌入的 AI 对话能力 |
| APP-DASHBOARD | REST API | 仪表盘展示模型调用统计、成本报表、延迟分析 |

### 1.5 核心能力清单

| 能力域 | 说明 |
|---|---|
| 模型供应商管理 | 供应商 CRUD、API Key 加密存储与轮换、模型列表同步 |
| 模型路由 | 按模型名称路由、Fallback 策略、负载均衡、健康检查 |
| 流量控制 | QPS 限流（令牌桶）、Token 配额（用户/应用/租户级）、熔断降级 |
| 同步对话 | 单轮/多轮对话、Function Calling、多模态输入 |
| 流式对话 | SSE 流式输出、Token 级实时推送、中断控制 |
| 多模态对话 | 文本 + 图片（URL/Base64）、文件输入、视觉理解 |
| Embedding 服务 | 单条/批量文本向量化、模型切换、维度管理 |
| Prompt 管理 | 模板 CRUD、版本管理、变量替换、实时预览 |
| 成本核算 | Token 消耗统计、多维度成本报表、预算预警 |
| 调用审计 | 调用日志、错误追踪、延迟统计、trace_id 关联 |

### 1.6 核心概念

| 概念 | 说明 |
|---|---|
| Provider | 模型供应商，如 OpenAI、Anthropic、火山方舟、通义千问 |
| Model | 具体模型实例，如 `doubao-pro-32k`、`gpt-4o`、`claude-3.5-sonnet` |
| Model Route | 模型路由规则，定义模型名称到供应商的映射及 Fallback 链 |
| Quota | 配额，按用户/应用/租户维度的 Token 或请求数限额 |
| Rate Limit | 限流策略，基于令牌桶算法的 QPS 控制 |
| Prompt Template | Prompt 模板，含变量占位符、版本管理 |
| Token Usage | Token 消耗记录，含 prompt_tokens / completion_tokens / total_tokens |
| Call Log | 调用日志，记录每次 LLM 调用的完整信息 |

### 1.7 模型路由架构

TECH-LLMGW 的模型路由核心流程：

```
[Client Request]
       |
       v
[认证 & 鉴权] ──── TECH-IAM 校验
       |
       v
[限流检查] ──── Redis 令牌桶 QPS 控制
       |
       v
[配额检查] ──── Redis Token 配额校验
       |
       v
[模型路由] ──── 查找 Model Route 规则
       |
       +------+------+
       |             |
       v             v
[Primary Provider]  [Fallback Provider]
       |             |
       v             v
[供应商 API 调用] ── OpenAI / Anthropic / 火山方舟 / 通义千问
       |
       v
[Token 计量] ──── 解析 usage，写入 Redis + PostgreSQL
       |
       v
[审计日志] ──── Kafka 发布 Token 消耗事件（Outbox 模式）
       |
       v
[Response] ──── 同步 JSON 或 SSE 流式
```

---

## 2. 通用约定

### 2.1 API 路径前缀

所有 TECH-LLMGW API 路径统一前缀：

```
/api/v1/llmgw
```

完整路径示例：`/api/v1/llmgw/providers`、`/api/v1/llmgw/chat/completions`、`/api/v1/llmgw/embeddings`、`/api/v1/llmgw/prompts`

### 2.2 请求/响应格式

#### 2.2.1 Content-Type

- JSON 请求体：`application/json; charset=UTF-8`
- 文件上传：`multipart/form-data`
- 响应体：`application/json; charset=UTF-8`
- SSE 流式响应：`text/event-stream`

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

#### 2.3.1 Bearer Token（用户调用）

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

服务间 API Key 由 TECH-IAM 统一签发，绑定调用方服务标识与权限范围。TECH-RAG、TECH-AGENT、APP-SUPERAI、APP-DW 等服务通过此方式调用。

### 2.4 请求头约定

| 请求头 | 必填 | 说明 |
|---|---|---|
| Authorization | 是 | Bearer Token（与 X-API-Key 二选一） |
| X-API-Key | 否 | 服务间调用 API Key（与 Authorization 二选一） |
| X-Trace-Id | 否 | 链路追踪 ID，未传则服务端自动生成 |
| X-Tenant-Id | 是 | 租户 ID |
| X-Request-Id | 否 | 请求唯一标识，用于幂等控制 |
| Content-Type | 是 | `application/json;charset=UTF-8` 或 `multipart/form-data` |
| Accept | 否 | SSE 接口需设为 `text/event-stream` |

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
| 429 | Too Many Requests | 限流 / 配额耗尽 |
| 500 | Internal Server Error | 服务内部错误 |
| 502 | Bad Gateway | 上游模型供应商返回错误 |
| 503 | Service Unavailable | 依赖服务不可用 |
| 504 | Gateway Timeout | 模型调用超时 |

#### 2.5.2 业务错误码

| 错误码 | HTTP 状态码 | 错误标识 | 说明 |
|---|---|---|---|
| 0 | 200 | SUCCESS | 成功 |
| 40001 | 400 | INVALID_PARAM | 请求参数校验失败 |
| 40002 | 400 | INVALID_JSON | 请求体 JSON 格式错误 |
| 40003 | 400 | MISSING_REQUIRED_FIELD | 缺少必填字段 |
| 40004 | 400 | INVALID_FIELD_VALUE | 字段值不合法 |
| 40005 | 400 | UNSUPPORTED_MODEL_TYPE | 不支持的模型类型 |
| 40006 | 400 | UNSUPPORTED_MODALITY | 不支持的输入模态 |
| 40101 | 401 | TOKEN_EXPIRED | Token 已过期 |
| 40102 | 401 | TOKEN_INVALID | Token 无效 |
| 40103 | 401 | API_KEY_INVALID | API Key 无效 |
| 40301 | 403 | PERMISSION_DENIED | 权限不足 |
| 40302 | 403 | TENANT_MISMATCH | 租户不匹配 |
| 40401 | 404 | PROVIDER_NOT_FOUND | 供应商不存在 |
| 40402 | 404 | MODEL_NOT_FOUND | 模型不存在 |
| 40403 | 404 | MODEL_ROUTE_NOT_FOUND | 模型路由规则不存在 |
| 40404 | 404 | PROMPT_NOT_FOUND | Prompt 模板不存在 |
| 40405 | 404 | QUOTA_NOT_FOUND | 配额配置不存在 |
| 40406 | 404 | CALL_LOG_NOT_FOUND | 调用日志不存在 |
| 40901 | 409 | PROVIDER_ALREADY_EXISTS | 供应商标识已存在 |
| 40902 | 409 | MODEL_ALREADY_EXISTS | 模型标识已存在 |
| 40903 | 409 | PROMPT_KEY_EXISTS | Prompt 模板 key 已存在 |
| 40904 | 409 | DUPLICATE_RATE_LIMIT | 限流规则已存在 |
| 42201 | 422 | PROVIDER_NOT_ACTIVE | 供应商未启用 |
| 42202 | 422 | MODEL_NOT_AVAILABLE | 模型不可用（供应商未启用或模型未激活） |
| 42203 | 422 | ALL_PROVIDERS_FAILED | 所有供应商（含 Fallback）均调用失败 |
| 42204 | 422 | QUOTA_EXCEEDED | Token 配额已耗尽 |
| 42205 | 422 | PROMPT_VARIABLE_MISSING | Prompt 模板变量未提供 |
| 42206 | 422 | PROMPT_RENDER_FAILED | Prompt 模板渲染失败 |
| 42207 | 422 | EMBEDDING_DIM_MISMATCH | Embedding 维度不匹配 |
| 42208 | 422 | API_KEY_NOT_CONFIGURED | 供应商 API Key 未配置 |
| 42901 | 429 | RATE_LIMIT_EXCEEDED | QPS 限流触发 |
| 42902 | 429 | TOKEN_QUOTA_EXCEEDED | Token 配额耗尽 |
| 42903 | 429 | CONCURRENT_LIMIT_EXCEEDED | 并发数超限 |
| 50001 | 500 | INTERNAL_ERROR | 服务内部错误 |
| 50002 | 500 | DATABASE_ERROR | 数据库操作失败 |
| 50003 | 500 | REDIS_ERROR | Redis 操作失败 |
| 50004 | 500 | KAFKA_PUBLISH_FAILED | Kafka 消息发布失败 |
| 50005 | 500 | PROVIDER_API_ERROR | 模型供应商 API 返回错误 |
| 50006 | 500 | PROVIDER_TIMEOUT | 模型供应商调用超时 |
| 50007 | 500 | ENCRYPTION_ERROR | API Key 加解密失败 |
| 50301 | 503 | SERVICE_UNAVAILABLE | 服务暂不可用 |
| 50302 | 503 | ALL_PROVIDERS_UNAVAILABLE | 所有模型供应商不可用 |

**错误响应示例**：

```json
{
  "code": 42204,
  "message": "Token 配额已耗尽: userId=user-001, quotaType=TOKEN_DAILY, used=100000, limit=100000",
  "data": {
    "quotaType": "TOKEN_DAILY",
    "used": 100000,
    "limit": 100000,
    "resetAt": "2026-07-17T00:00:00.000+08:00"
  },
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
- 若未传入，TECH-LLMGW 自动生成 UUID v4 作为 trace_id
- trace_id 写入 Python `contextvars` 上下文变量，贯穿整个请求处理链路

#### 2.7.2 出站传播

- 所有响应体的 `traceId` 字段携带当前请求的 trace_id
- 调用外部模型供应商 API 时，在请求头中携带 `X-Trace-Id`（供应商支持时）
- 所有 Kafka 消息（Outbox 模式）的 Header 包含 `X-Trace-Id`
- 调用日志记录中包含 `trace_id` 字段

#### 2.7.3 DLQ 记录

- 消费失败的 Kafka 消息写入 DLQ 时，记录体必须包含 `traceId` 字段
- DLQ 消息重试上限：3 次，超过后进入死信存储

### 2.8 幂等控制

- 写操作支持幂等：客户端传递 `X-Request-Id` 请求头
- 服务端基于 `(tenantId, requestType, requestId)` 做幂等去重
- 幂等窗口：24 小时
- 同一 `X-Request-Id` 重复请求返回首次结果

### 2.9 SSE 流式输出约定

对话接口支持 SSE（Server-Sent Events）流式输出，响应头：

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

SSE 事件格式：

```
event: <eventType>
data: <jsonPayload>

```

SSE 事件类型：

| 事件类型 | 说明 | data 内容 |
|---|---|---|
| `chat.started` | 对话开始 | 请求基本信息（model、conversationId） |
| `content.delta` | 内容增量 | 文本片段（delta） |
| `tool.calling` | 工具调用中 | 工具名与入参 |
| `tool.result` | 工具返回结果 | 工具调用 ID 与返回值 |
| `usage.updated` | Token 用量更新 | 当前 Token 消耗 |
| `content.done` | 内容完成 | 完整文本与 finish_reason |
| `chat.completed` | 对话完成 | 完整响应含 usage |
| `chat.failed` | 对话失败 | 错误信息 |
| `error` | 流式错误 | 错误详情 |

### 2.10 API Key 加密策略

- 供应商 API Key 使用 AES-256-GCM 算法加密后存储于 PostgreSQL
- 加密密钥通过环境变量 `LLMGW_ENCRYPTION_KEY` 注入，不落盘
- API Key 写入时加密、读取时解密，传输与存储全程不暴露明文
- 支持 API Key 轮换：新 Key 生效后旧 Key 保留 24 小时灰度期
- API Key 列表接口返回掩码（如 `sk-****ab3f`），不返回明文

---

## 3. API 接口详情

### 3.1 模型供应商管理 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/llmgw/providers` | 创建模型供应商 |
| GET | `/api/v1/llmgw/providers` | 供应商列表（分页） |
| GET | `/api/v1/llmgw/providers/{providerId}` | 获取供应商详情 |
| PUT | `/api/v1/llmgw/providers/{providerId}` | 更新供应商 |
| DELETE | `/api/v1/llmgw/providers/{providerId}` | 删除供应商 |
| PUT | `/api/v1/llmgw/providers/{providerId}/state` | 启用/禁用供应商 |
| POST | `/api/v1/llmgw/providers/{providerId}/api-keys` | 添加 API Key |
| GET | `/api/v1/llmgw/providers/{providerId}/api-keys` | API Key 列表（掩码） |
| DELETE | `/api/v1/llmgw/providers/{providerId}/api-keys/{keyId}` | 删除 API Key |
| PUT | `/api/v1/llmgw/providers/{providerId}/api-keys/{keyId}/rotate` | 轮换 API Key |
| POST | `/api/v1/llmgw/providers/{providerId}/models/sync` | 同步供应商模型列表 |
| GET | `/api/v1/llmgw/providers/{providerId}/models` | 供应商下的模型列表 |
| GET | `/api/v1/llmgw/models` | 全局模型列表（跨供应商） |
| GET | `/api/v1/llmgw/models/{modelId}` | 获取模型详情 |

---

#### 3.1.1 创建模型供应商

**POST** `/api/v1/llmgw/providers`

创建一个新的模型供应商配置，包含供应商类型、API 端点、认证信息等。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| providerKey | string | 是 | 供应商唯一标识（业务 key），同一租户内唯一，如 `openai`、`anthropic`、`volcengine` |
| name | string | 是 | 供应商显示名称，1-128 字符 |
| type | string | 是 | 供应商类型：`OPENAI` / `ANTHROPIC` / `VOLCENGINE` / `QWEN` / `ZHIPU` / `BAICHUAN` / `CUSTOM` |
| baseUrl | string | 是 | 供应商 API 基础地址，如 `https://api.openai.com/v1` |
| description | string | 否 | 供应商描述，最长 1024 字符 |
| apiKeys | array | 否 | 初始 API Key 列表（可后续添加） |
| apiKeys[].key | string | 否 | API Key 明文（服务端加密存储） |
| apiKeys[].label | string | 否 | API Key 标签，如 `prod-key-1` |
| defaultHeaders | object | 否 | 自定义请求头（如 `Helicone-Auth`），key-value 结构 |
| timeout | integer | 否 | 调用超时时间（秒），默认 60，范围 5-300 |
| maxRetries | integer | 否 | 最大重试次数，默认 2，范围 0-5 |
| metadata | object | 否 | 扩展元数据 |

**请求示例**

```json
{
  "providerKey": "volcengine",
  "name": "火山方舟",
  "type": "VOLCENGINE",
  "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
  "description": "字节跳动火山方舟大模型平台，提供 Doubao 系列模型",
  "apiKeys": [
    {
      "key": "ark-xxxxxxxxxxxxxxxxxxxxxxxx",
      "label": "prod-key-1"
    }
  ],
  "defaultHeaders": {},
  "timeout": 120,
  "maxRetries": 2,
  "metadata": {
    "region": "cn-beijing",
    "console": "https://console.volcengine.com/ark"
  }
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "providerId": "prv-9a8b7c6d2026",
    "providerKey": "volcengine",
    "name": "火山方舟",
    "type": "VOLCENGINE",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
    "description": "字节跳动火山方舟大模型平台，提供 Doubao 系列模型",
    "status": "ACTIVE",
    "apiKeys": [
      {
        "keyId": "key-001",
        "label": "prod-key-1",
        "maskedKey": "ark-****xxxx",
        "status": "ACTIVE",
        "createdAt": "2026-07-16T10:30:00.000+08:00"
      }
    ],
    "defaultHeaders": {},
    "timeout": 120,
    "maxRetries": 2,
    "metadata": {
      "region": "cn-beijing",
      "console": "https://console.volcengine.com/ark"
    },
    "modelCount": 0,
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
| 40001 | providerKey / name / type / baseUrl 为空 |
| 40901 | providerKey 在同一租户内已存在 |
| 40004 | type 枚举值不合法或 baseUrl 格式不正确 |

---

#### 3.1.2 查询供应商列表

**GET** `/api/v1/llmgw/providers`

分页查询模型供应商列表，支持按类型、状态筛选。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20，最大 100 |
| type | string | 否 | 供应商类型筛选 |
| status | string | 否 | 状态筛选：`ACTIVE` / `INACTIVE` |
| keyword | string | 否 | 关键词搜索（名称/标识） |
| sort | string | 否 | 排序字段，默认 `createdAt:desc` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "providerId": "prv-9a8b7c6d2026",
        "providerKey": "volcengine",
        "name": "火山方舟",
        "type": "VOLCENGINE",
        "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
        "status": "ACTIVE",
        "modelCount": 12,
        "apiKeyCount": 1,
        "createdAt": "2026-07-16T10:30:00.000+08:00",
        "updatedAt": "2026-07-16T10:30:00.000+08:00"
      },
      {
        "providerId": "prv-a1b2c3d4e5f6",
        "providerKey": "openai",
        "name": "OpenAI",
        "type": "OPENAI",
        "baseUrl": "https://api.openai.com/v1",
        "status": "ACTIVE",
        "modelCount": 8,
        "apiKeyCount": 2,
        "createdAt": "2026-07-16T10:00:00.000+08:00",
        "updatedAt": "2026-07-16T10:00:00.000+08:00"
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

---

#### 3.1.3 获取供应商详情

**GET** `/api/v1/llmgw/providers/{providerId}`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| providerId | string | 供应商 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "providerId": "prv-9a8b7c6d2026",
    "providerKey": "volcengine",
    "name": "火山方舟",
    "type": "VOLCENGINE",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
    "description": "字节跳动火山方舟大模型平台，提供 Doubao 系列模型",
    "status": "ACTIVE",
    "apiKeys": [
      {
        "keyId": "key-001",
        "label": "prod-key-1",
        "maskedKey": "ark-****xxxx",
        "status": "ACTIVE",
        "lastUsedAt": "2026-07-16T15:23:00.000+08:00",
        "createdAt": "2026-07-16T10:30:00.000+08:00"
      }
    ],
    "defaultHeaders": {},
    "timeout": 120,
    "maxRetries": 2,
    "metadata": {
      "region": "cn-beijing",
      "console": "https://console.volcengine.com/ark"
    },
    "modelCount": 12,
    "totalCallCount": 15420,
    "totalTokenUsage": 8520000,
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
| 40401 | providerId 不存在 |

---

#### 3.1.4 更新供应商

**PUT** `/api/v1/llmgw/providers/{providerId}`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | 供应商显示名称 |
| baseUrl | string | 否 | API 基础地址 |
| description | string | 否 | 供应商描述 |
| defaultHeaders | object | 否 | 自定义请求头 |
| timeout | integer | 否 | 调用超时时间（秒） |
| maxRetries | integer | 否 | 最大重试次数 |
| metadata | object | 否 | 扩展元数据 |
| version | integer | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "name": "火山方舟（生产环境）",
  "timeout": 180,
  "maxRetries": 3,
  "version": 1
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "providerId": "prv-9a8b7c6d2026",
    "providerKey": "volcengine",
    "name": "火山方舟（生产环境）",
    "type": "VOLCENGINE",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
    "status": "ACTIVE",
    "timeout": 180,
    "maxRetries": 3,
    "version": 2,
    "updatedAt": "2026-07-16T11:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | providerId 不存在 |
| 40902 | 版本号不匹配（乐观锁冲突） |

---

#### 3.1.5 删除供应商

**DELETE** `/api/v1/llmgw/providers/{providerId}`

删除供应商。若供应商下存在模型或 API Key，需先清理或级联删除。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| force | boolean | 否 | 是否强制删除（级联删除关联模型与路由），默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "providerId": "prv-9a8b7c6d2026",
    "deleted": true,
    "cascadeDeletedModels": 12,
    "cascadeDeletedRoutes": 5
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | providerId 不存在 |
| 42201 | 供应商下存在模型且 force=false |

---

#### 3.1.6 启用/禁用供应商

**PUT** `/api/v1/llmgw/providers/{providerId}/state`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | string | 是 | 目标状态：`ACTIVE` / `INACTIVE` |
| reason | string | 否 | 状态变更原因 |

**请求示例**

```json
{
  "status": "INACTIVE",
  "reason": "供应商维护中，临时禁用"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "providerId": "prv-9a8b7c6d2026",
    "status": "INACTIVE",
    "previousStatus": "ACTIVE",
    "reason": "供应商维护中，临时禁用",
    "updatedAt": "2026-07-16T12:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.7 添加 API Key

**POST** `/api/v1/llmgw/providers/{providerId}/api-keys`

为供应商添加新的 API Key。Key 明文仅在请求中传输，服务端加密后存储。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| key | string | 是 | API Key 明文 |
| label | string | 否 | Key 标签，用于标识用途，如 `prod-key-2` |
| isPrimary | boolean | 否 | 是否设为主 Key，默认 false |

**请求示例**

```json
{
  "key": "ark-yyyyyyyyyyyyyyyyyyyy",
  "label": "prod-key-2",
  "isPrimary": true
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "keyId": "key-002",
    "label": "prod-key-2",
    "maskedKey": "ark-****yyyy",
    "isPrimary": true,
    "status": "ACTIVE",
    "createdAt": "2026-07-16T13:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | providerId 不存在 |
| 42201 | 供应商未启用 |

---

#### 3.1.8 API Key 列表

**GET** `/api/v1/llmgw/providers/{providerId}/api-keys`

返回供应商下所有 API Key（掩码显示，不返回明文）。

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "keyId": "key-001",
        "label": "prod-key-1",
        "maskedKey": "ark-****xxxx",
        "isPrimary": false,
        "status": "ACTIVE",
        "lastUsedAt": "2026-07-16T15:23:00.000+08:00",
        "totalCalls": 15200,
        "createdAt": "2026-07-16T10:30:00.000+08:00"
      },
      {
        "keyId": "key-002",
        "label": "prod-key-2",
        "maskedKey": "ark-****yyyy",
        "isPrimary": true,
        "status": "ACTIVE",
        "lastUsedAt": null,
        "totalCalls": 0,
        "createdAt": "2026-07-16T13:00:00.000+08:00"
      }
    ],
    "total": 2
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.9 删除 API Key

**DELETE** `/api/v1/llmgw/providers/{providerId}/api-keys/{keyId}`

删除指定的 API Key。若为主 Key，需先指定新的主 Key 或供应商存在其他可用 Key。

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "keyId": "key-001",
    "deleted": true
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | providerId 或 keyId 不存在 |
| 42201 | 删除主 Key 但无其他可用 Key |

---

#### 3.1.10 轮换 API Key

**PUT** `/api/v1/llmgw/providers/{providerId}/api-keys/{keyId}/rotate`

轮换 API Key，旧 Key 保留 24 小时灰度期后自动失效。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| newKey | string | 是 | 新 API Key 明文 |
| gracePeriodHours | integer | 否 | 旧 Key 灰度期（小时），默认 24，范围 0-72 |

**请求示例**

```json
{
  "newKey": "ark-zzzzzzzzzzzzzzzzzzzz",
  "gracePeriodHours": 24
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "keyId": "key-001",
    "oldKeyMasked": "ark-****xxxx",
    "newKeyMasked": "ark-****zzzz",
    "oldKeyStatus": "ROTATING",
    "oldKeyExpiresAt": "2026-07-17T13:00:00.000+08:00",
    "rotatedAt": "2026-07-16T13:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.11 同步供应商模型列表

**POST** `/api/v1/llmgw/providers/{providerId}/models/sync`

从供应商 API 拉取最新可用模型列表，更新本地模型注册表。

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "providerId": "prv-9a8b7c6d2026",
    "syncedAt": "2026-07-16T14:00:00.000+08:00",
    "totalModels": 15,
    "newModels": 3,
    "updatedModels": 1,
    "unchangedModels": 11,
    "newModelIds": [
      "doubao-pro-256k",
      "doubao-vision-pro",
      "doubao-embedding-large"
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | providerId 不存在 |
| 42201 | 供应商未启用 |
| 42208 | 供应商 API Key 未配置 |
| 50005 | 供应商 API 返回错误 |
| 50006 | 供应商 API 调用超时 |

---

#### 3.1.12 供应商下的模型列表

**GET** `/api/v1/llmgw/providers/{providerId}/models`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20，最大 100 |
| capability | string | 否 | 能力筛选：`CHAT` / `EMBEDDING` / `RERANK` / `VISION` / `FUNCTION_CALLING` |
| status | string | 否 | 状态筛选：`ACTIVE` / `INACTIVE` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "modelId": "doubao-pro-32k",
        "modelName": "Doubao Pro 32K",
        "providerId": "prv-9a8b7c6d2026",
        "providerKey": "volcengine",
        "providerName": "火山方舟",
        "capabilities": ["CHAT", "FUNCTION_CALLING"],
        "contextWindow": 32768,
        "maxOutputTokens": 8192,
        "inputPricePer1K": 0.008,
        "outputPricePer1K": 0.024,
        "status": "ACTIVE",
        "createdAt": "2026-07-16T10:30:00.000+08:00"
      },
      {
        "modelId": "doubao-embedding-large",
        "modelName": "Doubao Embedding Large",
        "providerId": "prv-9a8b7c6d2026",
        "providerKey": "volcengine",
        "providerName": "火山方舟",
        "capabilities": ["EMBEDDING"],
        "embeddingDimension": 2048,
        "inputPricePer1K": 0.0005,
        "status": "ACTIVE",
        "createdAt": "2026-07-16T14:00:00.000+08:00"
      }
    ],
    "total": 15,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.13 全局模型列表

**GET** `/api/v1/llmgw/models`

查询跨供应商的全局模型列表，支持按能力、供应商等筛选。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20，最大 100 |
| capability | string | 否 | 能力筛选：`CHAT` / `EMBEDDING` / `RERANK` / `VISION` / `FUNCTION_CALLING` |
| providerType | string | 否 | 供应商类型筛选 |
| status | string | 否 | 状态筛选 |
| keyword | string | 否 | 关键词搜索（模型ID/名称） |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "modelId": "doubao-pro-32k",
        "modelName": "Doubao Pro 32K",
        "providerId": "prv-9a8b7c6d2026",
        "providerKey": "volcengine",
        "providerName": "火山方舟",
        "capabilities": ["CHAT", "FUNCTION_CALLING"],
        "contextWindow": 32768,
        "maxOutputTokens": 8192,
        "inputPricePer1K": 0.008,
        "outputPricePer1K": 0.024,
        "status": "ACTIVE"
      },
      {
        "modelId": "gpt-4o",
        "modelName": "GPT-4o",
        "providerId": "prv-a1b2c3d4e5f6",
        "providerKey": "openai",
        "providerName": "OpenAI",
        "capabilities": ["CHAT", "VISION", "FUNCTION_CALLING"],
        "contextWindow": 128000,
        "maxOutputTokens": 16384,
        "inputPricePer1K": 0.005,
        "outputPricePer1K": 0.015,
        "status": "ACTIVE"
      },
      {
        "modelId": "claude-3-5-sonnet",
        "modelName": "Claude 3.5 Sonnet",
        "providerId": "prv-b1c2d3e4f5g6",
        "providerKey": "anthropic",
        "providerName": "Anthropic",
        "capabilities": ["CHAT", "VISION", "FUNCTION_CALLING"],
        "contextWindow": 200000,
        "maxOutputTokens": 8192,
        "inputPricePer1K": 0.003,
        "outputPricePer1K": 0.015,
        "status": "ACTIVE"
      }
    ],
    "total": 35,
    "page": 1,
    "pageSize": 20,
    "totalPages": 2
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.14 获取模型详情

**GET** `/api/v1/llmgw/models/{modelId}`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| modelId | string | 模型 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "modelId": "doubao-pro-32k",
    "modelName": "Doubao Pro 32K",
    "providerId": "prv-9a8b7c6d2026",
    "providerKey": "volcengine",
    "providerName": "火山方舟",
    "providerType": "VOLCENGINE",
    "capabilities": ["CHAT", "FUNCTION_CALLING"],
    "contextWindow": 32768,
    "maxOutputTokens": 8192,
    "inputPricePer1K": 0.008,
    "outputPricePer1K": 0.024,
    "currency": "CNY",
    "status": "ACTIVE",
    "fallbackModels": ["doubao-pro-128k", "gpt-4o"],
    "totalCalls": 15420,
    "totalTokenUsage": 8520000,
    "avgLatencyMs": 1200,
    "errorRate": 0.002,
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "updatedAt": "2026-07-16T14:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40402 | modelId 不存在 |

---

### 3.2 对话接口 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/llmgw/chat/completions` | 同步对话（阻塞等待完整响应） |
| POST | `/api/v1/llmgw/chat/completions/stream` | 流式对话（SSE 实时推送） |
| POST | `/api/v1/llmgw/chat/multimodal` | 多模态对话（文本+图片+文件） |
| GET | `/api/v1/llmgw/chat/models` | 可用对话模型列表 |

---

#### 3.2.1 同步对话

**POST** `/api/v1/llmgw/chat/completions`

发送对话请求，阻塞等待模型返回完整响应。支持多轮对话（通过 messages 传入历史消息）和 Function Calling。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| model | string | 是 | 模型 ID（如 `doubao-pro-32k`），网关根据此字段路由到对应供应商 |
| messages | array | 是 | 消息列表，至少包含一条消息 |
| messages[].role | string | 是 | 角色：`system` / `user` / `assistant` / `tool` |
| messages[].content | string \| array | 是 | 消息内容。纯文本为 string；多模态为 array（含 type+text/image_url） |
| temperature | float | 否 | 温度参数，默认 0.7，范围 0.0-2.0 |
| maxTokens | integer | 否 | 最大生成 Token 数，默认 4096 |
| topP | float | 否 | Top-P 采样，默认 1.0，范围 0.0-1.0 |
| frequencyPenalty | float | 否 | 频率惩罚，默认 0.0，范围 -2.0-2.0 |
| presencePenalty | float | 否 | 存在惩罚，默认 0.0，范围 -2.0-2.0 |
| stop | array[string] | 否 | 停止序列，最多 4 个 |
| tools | array | 否 | Function Calling 工具定义列表 |
| tools[].type | string | 否 | 工具类型，目前仅支持 `function` |
| tools[].function | object | 否 | 函数定义 |
| tools[].function.name | string | 否 | 函数名称 |
| tools[].function.description | string | 否 | 函数描述 |
| tools[].function.parameters | object | 否 | 函数参数 JSON Schema |
| toolChoice | string \| object | 否 | 工具选择策略：`auto`（默认）/ `none` / `required` / 指定函数 |
| user | string | 否 | 用户标识，用于审计与配额统计 |
| appId | string | 否 | 应用标识，用于应用级配额统计 |
| conversationId | string | 否 | 对话 ID，用于多轮对话关联（不传则不关联） |
| fallbackModels | array[string] | 否 | Fallback 模型列表，主模型不可用时按顺序尝试 |
| responseFormat | object | 否 | 响应格式约束（如 `{"type": "json_object"}`） |
| seed | integer | 否 | 随机种子，用于可复现输出 |

**请求示例**

```json
{
  "model": "doubao-pro-32k",
  "messages": [
    {
      "role": "system",
      "content": "你是 Mate Platform 的智能助手，请用专业、简洁的中文回答用户问题。"
    },
    {
      "role": "user",
      "content": "请解释什么是 Ontology 本体引擎，它在企业架构中的作用是什么？"
    }
  ],
  "temperature": 0.3,
  "maxTokens": 2048,
  "topP": 0.9,
  "user": "user-001",
  "appId": "app-superai",
  "conversationId": "conv-20260716-000123",
  "fallbackModels": ["doubao-pro-128k", "gpt-4o"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "chatcmpl-9a8b7c6d2026",
    "object": "chat.completion",
    "model": "doubao-pro-32k",
    "provider": "volcengine",
    "choices": [
      {
        "index": 0,
        "message": {
          "role": "assistant",
          "content": "Ontology 本体引擎是 Mate Platform 的核心组件，它提供统一的语义建模与推理能力...\n\n在企业架构中，本体引擎的作用包括：\n1. **统一数据语义**：通过本体定义业务概念、属性和关系，消除数据孤岛...\n2. **智能推理**：基于本体规则进行自动化推理...\n3. **知识图谱**：将本体实例化为知识图谱，支持图查询...",
          "toolCalls": null
        },
        "finishReason": "stop",
        "logprobs": null
      }
    ],
    "usage": {
      "promptTokens": 85,
      "completionTokens": 320,
      "totalTokens": 405
    },
    "systemFingerprint": "fp_abc123",
    "conversationId": "conv-20260716-000123",
    "created": 1721107200,
    "latency": {
      "totalMs": 1850,
      "firstTokenMs": 320,
      "providerMs": 1800
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | model / messages 为空或格式不正确 |
| 40402 | modelId 不存在 |
| 42201 | 供应商未启用 |
| 42202 | 模型不可用 |
| 42203 | 所有供应商（含 Fallback）均调用失败 |
| 42204 | Token 配额已耗尽 |
| 42901 | QPS 限流触发 |
| 42903 | 并发数超限 |
| 50005 | 模型供应商 API 返回错误 |
| 50006 | 模型供应商调用超时 |

---

#### 3.2.2 流式对话（SSE）

**POST** `/api/v1/llmgw/chat/completions/stream`

发送对话请求，通过 SSE 实时推送生成内容。请求参数与同步对话完全一致，响应格式为 SSE 事件流。

**请求参数（Body）**

与 [3.2.1 同步对话](#321-同步对话) 请求参数完全一致。

**请求示例**

```json
{
  "model": "doubao-pro-32k",
  "messages": [
    {
      "role": "system",
      "content": "你是 Mate Platform 的智能助手。"
    },
    {
      "role": "user",
      "content": "用三句话介绍 Mate Platform。"
    }
  ],
  "temperature": 0.7,
  "maxTokens": 1024,
  "user": "user-001",
  "appId": "app-superai"
}
```

**响应示例（SSE 事件流）**

```
event: chat.started
data: {"id":"chatcmpl-9a8b7c6d2026","model":"doubao-pro-32k","provider":"volcengine","conversationId":null,"created":1721107200}

event: content.delta
data: {"id":"chatcmpl-9a8b7c6d2026","choices":[{"index":0,"delta":{"role":"assistant","content":"Mate"},"finishReason":null}]}

event: content.delta
data: {"id":"chatcmpl-9a8b7c6d2026","choices":[{"index":0,"delta":{"content":" Platform"},"finishReason":null}]}

event: content.delta
data: {"id":"chatcmpl-9a8b7c6d2026","choices":[{"index":0,"delta":{"content":" 是基于"},"finishReason":null}]}

event: content.delta
data: {"id":"chatcmpl-9a8b7c6d2026","choices":[{"index":0,"delta":{"content":" Ontology 本体论引擎的企业级决策与运营提效平台。"},"finishReason":null}]}

event: content.delta
data: {"id":"chatcmpl-9a8b7c6d2026","choices":[{"index":0,"delta":{"content":"它融合了低代码应用构建、数字员工、AI Agent 编排等核心能力。"},"finishReason":null}]}

event: content.delta
data: {"id":"chatcmpl-9a8b7c6d2026","choices":[{"index":0,"delta":{"content":"平台支持 MCP/A2A 协议，实现跨系统智能协作。"},"finishReason":null}]}

event: content.done
data: {"id":"chatcmpl-9a8b7c6d2026","choices":[{"index":0,"delta":{},"finishReason":"stop"}]}

event: usage.updated
data: {"id":"chatcmpl-9a8b7c6d2026","usage":{"promptTokens":35,"completionTokens":68,"totalTokens":103}}

event: chat.completed
data: {"id":"chatcmpl-9a8b7c6d2026","model":"doubao-pro-32k","provider":"volcengine","usage":{"promptTokens":35,"completionTokens":68,"totalTokens":103},"latency":{"totalMs":1200,"firstTokenMs":280,"providerMs":1150},"finishReason":"stop"}
```

**流式错误响应示例**

```
event: chat.failed
data: {"id":"chatcmpl-9a8b7c6d2026","errorCode":50006,"errorMessage":"模型供应商调用超时","provider":"volcengine","partialContent":"Mate Platform 是基于..."}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | model / messages 为空或格式不正确 |
| 40402 | modelId 不存在 |
| 42202 | 模型不可用 |
| 42203 | 所有供应商（含 Fallback）均调用失败 |
| 42204 | Token 配额已耗尽 |
| 42901 | QPS 限流触发 |
| 50005 | 模型供应商 API 返回错误（流式中断） |
| 50006 | 模型供应商调用超时（流式中断） |

---

#### 3.2.3 多模态对话

**POST** `/api/v1/llmgw/chat/multimodal`

发送多模态对话请求，支持文本 + 图片（URL/Base64）+ 文件输入。适用于视觉理解、文档分析、图表解读等场景。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| model | string | 是 | 支持多模态的模型 ID（如 `doubao-vision-pro`、`gpt-4o`、`claude-3-5-sonnet`） |
| messages | array | 是 | 消息列表 |
| messages[].role | string | 是 | 角色：`system` / `user` / `assistant` |
| messages[].content | array | 是 | 多模态内容数组 |
| messages[].content[].type | string | 是 | 内容类型：`text` / `image_url` / `file` |
| messages[].content[].text | string | 否 | 文本内容（type=text 时） |
| messages[].content[].imageUrl | object | 否 | 图片信息（type=image_url 时） |
| messages[].content[].imageUrl.url | string | 是 | 图片 URL 或 Base64（`data:image/png;base64,...`） |
| messages[].content[].imageUrl.detail | string | 否 | 图片精度：`low` / `high` / `auto`（默认） |
| messages[].content[].file | object | 否 | 文件信息（type=file 时） |
| messages[].content[].file.url | string | 是 | 文件 URL |
| messages[].content[].file.name | string | 否 | 文件名 |
| messages[].content[].file.mimeType | string | 否 | MIME 类型 |
| temperature | float | 否 | 温度参数，默认 0.7 |
| maxTokens | integer | 否 | 最大生成 Token 数，默认 4096 |
| stream | boolean | 否 | 是否流式返回，默认 false（true 时走 SSE） |
| user | string | 否 | 用户标识 |
| appId | string | 否 | 应用标识 |

**请求示例**

```json
{
  "model": "doubao-vision-pro",
  "messages": [
    {
      "role": "system",
      "content": [
        {
          "type": "text",
          "text": "你是 Mate Platform 的架构分析助手，可以分析架构图、流程图和技术文档。"
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "请分析这张系统架构图，说明各模块之间的关系和数据流向。"
        },
        {
          "type": "image_url",
          "imageUrl": {
            "url": "https://metaplatform.com/assets/arch-diagram.png",
            "detail": "high"
          }
        }
      ]
    }
  ],
  "temperature": 0.3,
  "maxTokens": 4096,
  "user": "user-001",
  "appId": "app-arch"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "chatcmpl-multimodal-001",
    "object": "chat.completion",
    "model": "doubao-vision-pro",
    "provider": "volcengine",
    "choices": [
      {
        "index": 0,
        "message": {
          "role": "assistant",
          "content": "根据架构图分析，系统分为以下几个层次：\n\n**1. 应用层（APP Layer）**\n- APP-DASHBOARD、APP-SUPERAI、APP-DW 等应用模块...\n\n**2. 技术服务层（TECH Layer）**\n- TECH-ONT（本体引擎）作为核心，与其他服务存在双向依赖...\n\n**数据流向：**\n- 用户请求从 APP 层进入，通过 TECH-GW 路由到对应 TECH 服务...\n- TECH-ONT 作为唯一数据真相源，所有数据语义通过本体引擎定义..."
        },
        "finishReason": "stop"
      }
    ],
    "usage": {
      "promptTokens": 1250,
      "completionTokens": 580,
      "totalTokens": 1830
    },
    "conversationId": null,
    "created": 1721107200,
    "latency": {
      "totalMs": 3200,
      "firstTokenMs": 500,
      "providerMs": 3100
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | model / messages 为空 |
| 40006 | 模型不支持多模态输入 |
| 40402 | modelId 不存在 |
| 42202 | 模型不可用 |
| 42203 | 所有供应商（含 Fallback）均调用失败 |
| 42204 | Token 配额已耗尽 |
| 42901 | QPS 限流触发 |
| 50005 | 模型供应商 API 返回错误 |
| 50006 | 模型供应商调用超时 |

---

#### 3.2.4 可用对话模型列表

**GET** `/api/v1/llmgw/chat/models`

查询当前可用的对话模型列表（含 Fallback 可用模型），供前端选择。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| capability | string | 否 | 能力筛选，默认 `CHAT` |
| includeVision | boolean | 否 | 是否包含视觉模型，默认 false |
| includeFunctionCalling | boolean | 否 | 是否包含 Function Calling 模型，默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "modelId": "doubao-pro-32k",
        "modelName": "Doubao Pro 32K",
        "providerName": "火山方舟",
        "capabilities": ["CHAT", "FUNCTION_CALLING"],
        "contextWindow": 32768,
        "maxOutputTokens": 8192,
        "inputPricePer1K": 0.008,
        "outputPricePer1K": 0.024,
        "status": "ACTIVE"
      },
      {
        "modelId": "doubao-vision-pro",
        "modelName": "Doubao Vision Pro",
        "providerName": "火山方舟",
        "capabilities": ["CHAT", "VISION", "FUNCTION_CALLING"],
        "contextWindow": 32768,
        "maxOutputTokens": 8192,
        "inputPricePer1K": 0.012,
        "outputPricePer1K": 0.036,
        "status": "ACTIVE"
      },
      {
        "modelId": "gpt-4o",
        "modelName": "GPT-4o",
        "providerName": "OpenAI",
        "capabilities": ["CHAT", "VISION", "FUNCTION_CALLING"],
        "contextWindow": 128000,
        "maxOutputTokens": 16384,
        "inputPricePer1K": 0.005,
        "outputPricePer1K": 0.015,
        "status": "ACTIVE"
      }
    ],
    "total": 3
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

### 3.3 Embedding 接口 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/llmgw/embeddings` | 单条文本向量化 |
| POST | `/api/v1/llmgw/embeddings/batch` | 批量文本向量化 |
| GET | `/api/v1/llmgw/embeddings/models` | 可用 Embedding 模型列表 |

---

#### 3.3.1 单条文本向量化

**POST** `/api/v1/llmgw/embeddings`

将输入文本转换为向量表示。TECH-RAG 的所有向量化请求通过此接口调用。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| model | string | 是 | Embedding 模型 ID（如 `doubao-embedding-large`） |
| input | string | 是 | 待向量化的文本，最长 8192 字符 |
| encodingFormat | string | 否 | 返回格式：`float`（默认）/ `base64` |
| dimensions | integer | 否 | 输出维度（部分模型支持降维），不传则使用模型默认维度 |
| user | string | 否 | 用户标识 |
| appId | string | 否 | 应用标识 |

**请求示例**

```json
{
  "model": "doubao-embedding-large",
  "input": "Ontology 本体引擎是 Mate Platform 的核心组件，提供统一语义建模与推理能力。",
  "encodingFormat": "float",
  "user": "user-001",
  "appId": "tech-rag"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "object": "list",
    "model": "doubao-embedding-large",
    "provider": "volcengine",
    "data": [
      {
        "object": "embedding",
        "index": 0,
        "embedding": [0.0123, -0.0456, 0.0789, -0.0321, 0.0654, -0.0987, "...": "...（共 2048 维）"]
      }
    ],
    "usage": {
      "promptTokens": 32,
      "totalTokens": 32
    },
    "dimensions": 2048,
    "latency": {
      "totalMs": 85,
      "providerMs": 80
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | model / input 为空 |
| 40004 | input 超过最大长度限制 |
| 40402 | modelId 不存在 |
| 42202 | 模型不可用 |
| 42204 | Token 配额已耗尽 |
| 42901 | QPS 限流触发 |
| 50005 | 模型供应商 API 返回错误 |

---

#### 3.3.2 批量文本向量化

**POST** `/api/v1/llmgw/embeddings/batch`

批量将多条文本转换为向量，适用于文档分块批量入库场景。单次最多 100 条文本。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| model | string | 是 | Embedding 模型 ID |
| input | array[string] | 是 | 待向量化的文本列表，1-100 条，每条最长 8192 字符 |
| encodingFormat | string | 否 | 返回格式：`float`（默认）/ `base64` |
| dimensions | integer | 否 | 输出维度 |
| user | string | 否 | 用户标识 |
| appId | string | 否 | 应用标识 |

**请求示例**

```json
{
  "model": "doubao-embedding-large",
  "input": [
    "Ontology 本体引擎提供统一语义建模与推理能力。",
    "TECH-RAG 是企业级知识检索增强引擎。",
    "TECH-AGENT 基于 LangGraph 构建 Agent 执行框架。"
  ],
  "encodingFormat": "float",
  "user": "user-001",
  "appId": "tech-rag"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "object": "list",
    "model": "doubao-embedding-large",
    "provider": "volcengine",
    "data": [
      {
        "object": "embedding",
        "index": 0,
        "embedding": [0.0123, -0.0456, 0.0789, "...": "...（共 2048 维）"]
      },
      {
        "object": "embedding",
        "index": 1,
        "embedding": [0.0234, -0.0567, 0.0890, "...": "...（共 2048 维）"]
      },
      {
        "object": "embedding",
        "index": 2,
        "embedding": [0.0345, -0.0678, 0.0901, "...": "...（共 2048 维）"]
      }
    ],
    "usage": {
      "promptTokens": 96,
      "totalTokens": 96
    },
    "dimensions": 2048,
    "count": 3,
    "latency": {
      "totalMs": 150,
      "providerMs": 140
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | model / input 为空 |
| 40004 | input 超过 100 条或单条超过长度限制 |
| 40402 | modelId 不存在 |
| 42202 | 模型不可用 |
| 42204 | Token 配额已耗尽 |
| 42901 | QPS 限流触发 |
| 50005 | 模型供应商 API 返回错误 |

---

#### 3.3.3 可用 Embedding 模型列表

**GET** `/api/v1/llmgw/embeddings/models`

查询当前可用的 Embedding 模型列表。

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "modelId": "doubao-embedding-large",
        "modelName": "Doubao Embedding Large",
        "providerName": "火山方舟",
        "embeddingDimension": 2048,
        "maxInputTokens": 8192,
        "inputPricePer1K": 0.0005,
        "status": "ACTIVE"
      },
      {
        "modelId": "text-embedding-3-large",
        "modelName": "Text Embedding 3 Large",
        "providerName": "OpenAI",
        "embeddingDimension": 3072,
        "maxInputTokens": 8191,
        "inputPricePer1K": 0.00013,
        "status": "ACTIVE"
      },
      {
        "modelId": "text-embedding-3-small",
        "modelName": "Text Embedding 3 Small",
        "providerName": "OpenAI",
        "embeddingDimension": 1536,
        "maxInputTokens": 8191,
        "inputPricePer1K": 0.00002,
        "status": "ACTIVE"
      }
    ],
    "total": 3
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

### 3.4 Prompt 管理 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/llmgw/prompts` | 创建 Prompt 模板 |
| GET | `/api/v1/llmgw/prompts` | Prompt 模板列表（分页） |
| GET | `/api/v1/llmgw/prompts/{promptId}` | 获取 Prompt 模板详情 |
| PUT | `/api/v1/llmgw/prompts/{promptId}` | 更新 Prompt 模板（创建新版本） |
| DELETE | `/api/v1/llmgw/prompts/{promptId}` | 删除 Prompt 模板 |
| GET | `/api/v1/llmgw/prompts/{promptId}/versions` | 获取版本历史 |
| GET | `/api/v1/llmgw/prompts/{promptId}/versions/{version}` | 获取指定版本 |
| POST | `/api/v1/llmgw/prompts/{promptId}/rollback` | 回滚到指定版本 |
| POST | `/api/v1/llmgw/prompts/{promptId}/render` | 渲染 Prompt（变量替换） |
| POST | `/api/v1/llmgw/prompts/{promptId}/preview` | 预览 Prompt（渲染 + 模型调用） |

---

#### 3.4.1 创建 Prompt 模板

**POST** `/api/v1/llmgw/prompts`

创建 Prompt 模板，支持变量占位符（`{{variable}}` 格式）。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| promptKey | string | 是 | 模板唯一标识（业务 key），同一租户内唯一 |
| name | string | 是 | 模板名称，1-128 字符 |
| description | string | 否 | 模板描述 |
| category | string | 否 | 分类标签，如 `system` / `assistant` / `rag` / `agent` |
| template | string | 是 | 模板内容，支持 `{{variable}}` 变量占位 |
| variables | array | 否 | 变量定义列表 |
| variables[].name | string | 否 | 变量名 |
| variables[].type | string | 否 | 变量类型：`string` / `number` / `boolean` / `object` / `array` |
| variables[].required | boolean | 否 | 是否必填，默认 true |
| variables[].defaultValue | any | 否 | 默认值 |
| variables[].description | string | 否 | 变量描述 |
| defaultModel | string | 否 | 默认关联模型 ID |
| defaultParams | object | 否 | 默认调用参数 |
| defaultParams.temperature | float | 否 | 默认温度 |
| defaultParams.maxTokens | integer | 否 | 默认最大 Token 数 |
| tags | array[string] | 否 | 标签列表 |

**请求示例**

```json
{
  "promptKey": "rag-qa-system",
  "name": "RAG 问答系统提示词",
  "description": "用于 RAG 检索增强问答场景的系统提示词模板",
  "category": "rag",
  "template": "你是 Mate Platform 的智能助手。请根据以下检索到的知识上下文回答用户问题。\n\n## 知识上下文\n{{context}}\n\n## 用户问题\n{{question}}\n\n## 回答要求\n1. 仅基于知识上下文回答，不编造信息\n2. 如果知识上下文中没有相关信息，请明确告知用户\n3. 回答时标注信息来源",
  "variables": [
    {
      "name": "context",
      "type": "string",
      "required": true,
      "description": "RAG 检索到的知识上下文"
    },
    {
      "name": "question",
      "type": "string",
      "required": true,
      "description": "用户提问内容"
    }
  ],
  "defaultModel": "doubao-pro-32k",
  "defaultParams": {
    "temperature": 0.3,
    "maxTokens": 2048
  },
  "tags": ["rag", "qa", "system-prompt"]
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "promptId": "prm-9a8b7c6d2026",
    "promptKey": "rag-qa-system",
    "name": "RAG 问答系统提示词",
    "description": "用于 RAG 检索增强问答场景的系统提示词模板",
    "category": "rag",
    "template": "你是 Mate Platform 的智能助手...",
    "variables": [
      {
        "name": "context",
        "type": "string",
        "required": true,
        "description": "RAG 检索到的知识上下文"
      },
      {
        "name": "question",
        "type": "string",
        "required": true,
        "description": "用户提问内容"
      }
    ],
    "defaultModel": "doubao-pro-32k",
    "defaultParams": {
      "temperature": 0.3,
      "maxTokens": 2048
    },
    "tags": ["rag", "qa", "system-prompt"],
    "version": 1,
    "status": "ACTIVE",
    "createdBy": "user-001",
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "updatedAt": "2026-07-16T10:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | promptKey / name / template 为空 |
| 40903 | promptKey 在同一租户内已存在 |
| 42205 | 模板中的变量未在 variables 中定义 |

---

#### 3.4.2 查询 Prompt 模板列表

**GET** `/api/v1/llmgw/prompts`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |
| category | string | 否 | 分类筛选 |
| tags | string | 否 | 标签筛选（逗号分隔） |
| keyword | string | 否 | 关键词搜索 |
| status | string | 否 | 状态筛选 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "promptId": "prm-9a8b7c6d2026",
        "promptKey": "rag-qa-system",
        "name": "RAG 问答系统提示词",
        "category": "rag",
        "version": 3,
        "tags": ["rag", "qa", "system-prompt"],
        "status": "ACTIVE",
        "defaultModel": "doubao-pro-32k",
        "createdAt": "2026-07-16T10:30:00.000+08:00",
        "updatedAt": "2026-07-16T14:00:00.000+08:00"
      },
      {
        "promptId": "prm-a1b2c3d4e5f6",
        "promptKey": "agent-react-system",
        "name": "Agent ReAct 系统提示词",
        "category": "agent",
        "version": 2,
        "tags": ["agent", "react"],
        "status": "ACTIVE",
        "defaultModel": "doubao-pro-32k",
        "createdAt": "2026-07-16T11:00:00.000+08:00",
        "updatedAt": "2026-07-16T13:00:00.000+08:00"
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

---

#### 3.4.3 获取 Prompt 模板详情

**GET** `/api/v1/llmgw/prompts/{promptId}`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| promptId | string | Prompt 模板 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "promptId": "prm-9a8b7c6d2026",
    "promptKey": "rag-qa-system",
    "name": "RAG 问答系统提示词",
    "description": "用于 RAG 检索增强问答场景的系统提示词模板",
    "category": "rag",
    "template": "你是 Mate Platform 的智能助手。请根据以下检索到的知识上下文回答用户问题。\n\n## 知识上下文\n{{context}}\n\n## 用户问题\n{{question}}\n\n## 回答要求\n1. 仅基于知识上下文回答，不编造信息\n2. 如果知识上下文中没有相关信息，请明确告知用户\n3. 回答时标注信息来源",
    "variables": [
      {
        "name": "context",
        "type": "string",
        "required": true,
        "description": "RAG 检索到的知识上下文"
      },
      {
        "name": "question",
        "type": "string",
        "required": true,
        "description": "用户提问内容"
      }
    ],
    "defaultModel": "doubao-pro-32k",
    "defaultParams": {
      "temperature": 0.3,
      "maxTokens": 2048
    },
    "tags": ["rag", "qa", "system-prompt"],
    "version": 3,
    "status": "ACTIVE",
    "createdBy": "user-001",
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "updatedAt": "2026-07-16T14:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40404 | promptId 不存在 |

---

#### 3.4.4 更新 Prompt 模板

**PUT** `/api/v1/llmgw/prompts/{promptId}`

更新 Prompt 模板，每次更新创建新版本，保留历史版本。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | 模板名称 |
| description | string | 否 | 模板描述 |
| category | string | 否 | 分类标签 |
| template | string | 否 | 模板内容 |
| variables | array | 否 | 变量定义列表 |
| defaultModel | string | 否 | 默认关联模型 ID |
| defaultParams | object | 否 | 默认调用参数 |
| tags | array[string] | 否 | 标签列表 |
| changeLog | string | 否 | 变更说明 |

**请求示例**

```json
{
  "template": "你是 Mate Platform 的智能助手。请根据以下检索到的知识上下文回答用户问题。\n\n## 知识上下文\n{{context}}\n\n## 用户问题\n{{question}}\n\n## 回答要求\n1. 仅基于知识上下文回答，不编造信息\n2. 如果知识上下文中没有相关信息，请明确告知用户\n3. 回答时标注信息来源\n4. 使用 Markdown 格式输出\n5. 对于技术术语，提供简要解释",
  "changeLog": "增加 Markdown 输出和技术术语解释要求"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "promptId": "prm-9a8b7c6d2026",
    "promptKey": "rag-qa-system",
    "name": "RAG 问答系统提示词",
    "version": 4,
    "changeLog": "增加 Markdown 输出和技术术语解释要求",
    "previousVersion": 3,
    "updatedAt": "2026-07-16T15:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40404 | promptId 不存在 |
| 42205 | 模板中的变量未在 variables 中定义 |

---

#### 3.4.5 删除 Prompt 模板

**DELETE** `/api/v1/llmgw/prompts/{promptId}`

删除 Prompt 模板及其所有版本。

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "promptId": "prm-9a8b7c6d2026",
    "deleted": true,
    "deletedVersions": 4
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.4.6 获取版本历史

**GET** `/api/v1/llmgw/prompts/{promptId}/versions`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "version": 4,
        "changeLog": "增加 Markdown 输出和技术术语解释要求",
        "templatePreview": "你是 Mate Platform 的智能助手。请根据以下检索到的知识上下文回答用户问题...",
        "createdBy": "user-001",
        "createdAt": "2026-07-16T15:00:00.000+08:00"
      },
      {
        "version": 3,
        "changeLog": "增加回答要求第3条：标注信息来源",
        "templatePreview": "你是 Mate Platform 的智能助手...",
        "createdBy": "user-001",
        "createdAt": "2026-07-16T14:00:00.000+08:00"
      },
      {
        "version": 2,
        "changeLog": "调整知识上下文格式",
        "templatePreview": "你是 Mate Platform 的智能助手...",
        "createdBy": "user-001",
        "createdAt": "2026-07-16T12:00:00.000+08:00"
      },
      {
        "version": 1,
        "changeLog": "初始版本",
        "templatePreview": "你是 Mate Platform 的智能助手...",
        "createdBy": "user-001",
        "createdAt": "2026-07-16T10:30:00.000+08:00"
      }
    ],
    "total": 4
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.4.7 获取指定版本

**GET** `/api/v1/llmgw/prompts/{promptId}/versions/{version}`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| promptId | string | Prompt 模板 ID |
| version | integer | 版本号 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "promptId": "prm-9a8b7c6d2026",
    "promptKey": "rag-qa-system",
    "name": "RAG 问答系统提示词",
    "template": "你是 Mate Platform 的智能助手。请根据以下检索到的知识上下文回答用户问题...",
    "variables": [
      {
        "name": "context",
        "type": "string",
        "required": true,
        "description": "RAG 检索到的知识上下文"
      },
      {
        "name": "question",
        "type": "string",
        "required": true,
        "description": "用户提问内容"
      }
    ],
    "defaultModel": "doubao-pro-32k",
    "defaultParams": {
      "temperature": 0.3,
      "maxTokens": 2048
    },
    "version": 3,
    "changeLog": "增加回答要求第3条：标注信息来源",
    "createdBy": "user-001",
    "createdAt": "2026-07-16T14:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.4.8 回滚到指定版本

**POST** `/api/v1/llmgw/prompts/{promptId}/rollback`

将 Prompt 模板回滚到指定历史版本，回滚操作创建新版本（内容为目标版本的副本）。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| targetVersion | integer | 是 | 目标版本号 |
| changeLog | string | 否 | 回滚说明 |

**请求示例**

```json
{
  "targetVersion": 2,
  "changeLog": "回滚到 v2，v3/v4 的回答要求调整效果不佳"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "promptId": "prm-9a8b7c6d2026",
    "promptKey": "rag-qa-system",
    "version": 5,
    "rolledBackFrom": 4,
    "rolledBackTo": 2,
    "changeLog": "回滚到 v2，v3/v4 的回答要求调整效果不佳",
    "updatedAt": "2026-07-16T16:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40404 | promptId 不存在 |
| 40004 | targetVersion 不存在 |

---

#### 3.4.9 渲染 Prompt（变量替换）

**POST** `/api/v1/llmgw/prompts/{promptId}/render`

将 Prompt 模板中的变量占位符替换为实际值，返回渲染后的完整 Prompt 文本。不调用模型。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| variables | object | 是 | 变量键值对，key 为变量名，value 为变量值 |
| version | integer | 否 | 指定版本号，不传则使用最新版本 |

**请求示例**

```json
{
  "variables": {
    "context": "Ontology 本体引擎是 Mate Platform 的核心组件，提供统一语义建模与推理能力。它支持 OWL/RDF 标准，可与知识图谱深度融合...",
    "question": "本体引擎的核心能力是什么？"
  },
  "version": 4
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "promptId": "prm-9a8b7c6d2026",
    "version": 4,
    "renderedPrompt": "你是 Mate Platform 的智能助手。请根据以下检索到的知识上下文回答用户问题。\n\n## 知识上下文\nOntology 本体引擎是 Mate Platform 的核心组件，提供统一语义建模与推理能力。它支持 OWL/RDF 标准，可与知识图谱深度融合...\n\n## 用户问题\n本体引擎的核心能力是什么？\n\n## 回答要求\n1. 仅基于知识上下文回答，不编造信息\n2. 如果知识上下文中没有相关信息，请明确告知用户\n3. 回答时标注信息来源\n4. 使用 Markdown 格式输出\n5. 对于技术术语，提供简要解释",
    "replacedVariables": ["context", "question"],
    "missingVariables": []
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40404 | promptId 不存在 |
| 42205 | 必填变量未提供 |
| 42206 | 模板渲染失败（变量格式错误等） |

---

#### 3.4.10 预览 Prompt（渲染 + 模型调用）

**POST** `/api/v1/llmgw/prompts/{promptId}/preview`

渲染 Prompt 并调用模型返回结果，用于 Prompt 效果测试。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| variables | object | 是 | 变量键值对 |
| model | string | 否 | 模型 ID（不传则使用模板默认模型） |
| params | object | 否 | 调用参数（覆盖默认参数） |
| params.temperature | float | 否 | 温度 |
| params.maxTokens | integer | 否 | 最大 Token 数 |
| version | integer | 否 | 指定版本号 |

**请求示例**

```json
{
  "variables": {
    "context": "Ontology 本体引擎是 Mate Platform 的核心组件，提供统一语义建模与推理能力。",
    "question": "本体引擎的核心能力是什么？"
  },
  "model": "doubao-pro-32k",
  "params": {
    "temperature": 0.3,
    "maxTokens": 1024
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "promptId": "prm-9a8b7c6d2026",
    "version": 4,
    "renderedPrompt": "你是 Mate Platform 的智能助手。请根据以下检索到的知识上下文...",
    "model": "doubao-pro-32k",
    "provider": "volcengine",
    "response": {
      "content": "根据知识上下文，Ontology 本体引擎的核心能力包括：\n\n1. **统一语义建模**：通过本体定义业务概念、属性和关系...\n2. **智能推理**：基于本体规则进行自动化推理...\n3. **知识图谱融合**：支持 OWL/RDF 标准，与知识图谱深度融合...",
      "finishReason": "stop"
    },
    "usage": {
      "promptTokens": 120,
      "completionTokens": 180,
      "totalTokens": 300
    },
    "latency": {
      "totalMs": 1500,
      "providerMs": 1450
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40404 | promptId 不存在 |
| 42205 | 必填变量未提供 |
| 42206 | 模板渲染失败 |
| 42202 | 模型不可用 |
| 42204 | Token 配额已耗尽 |
| 50005 | 模型供应商 API 返回错误 |

---

### 3.5 流量控制 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/llmgw/quotas` | 配额列表查询 |
| GET | `/api/v1/llmgw/quotas/{quotaId}` | 配额详情 |
| POST | `/api/v1/llmgw/quotas` | 创建配额规则 |
| PUT | `/api/v1/llmgw/quotas/{quotaId}` | 更新配额规则 |
| DELETE | `/api/v1/llmgw/quotas/{quotaId}` | 删除配额规则 |
| GET | `/api/v1/llmgw/quotas/usage` | 配额使用情况查询（实时） |
| PUT | `/api/v1/llmgw/quotas/{quotaId}/reset` | 重置配额使用量 |
| GET | `/api/v1/llmgw/rate-limits` | 限流规则列表 |
| POST | `/api/v1/llmgw/rate-limits` | 创建限流规则 |
| PUT | `/api/v1/llmgw/rate-limits/{ruleId}` | 更新限流规则 |
| DELETE | `/api/v1/llmgw/rate-limits/{ruleId}` | 删除限流规则 |

---

#### 3.5.1 配额列表查询

**GET** `/api/v1/llmgw/quotas`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |
| scope | string | 否 | 配额维度：`USER` / `APP` / `TENANT` / `MODEL` |
| scopeId | string | 否 | 维度目标 ID |
| quotaType | string | 否 | 配额类型：`TOKEN_DAILY` / `TOKEN_MONTHLY` / `REQUEST_DAILY` / `REQUEST_MONTHLY` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "quotaId": "qta-001",
        "scope": "USER",
        "scopeId": "user-001",
        "quotaType": "TOKEN_DAILY",
        "limit": 100000,
        "used": 45200,
        "remaining": 54800,
        "modelId": null,
        "resetAt": "2026-07-17T00:00:00.000+08:00",
        "status": "ACTIVE",
        "createdAt": "2026-07-16T10:00:00.000+08:00"
      },
      {
        "quotaId": "qta-002",
        "scope": "APP",
        "scopeId": "app-superai",
        "quotaType": "TOKEN_MONTHLY",
        "limit": 5000000,
        "used": 1200000,
        "remaining": 3800000,
        "modelId": null,
        "resetAt": "2026-08-01T00:00:00.000+08:00",
        "status": "ACTIVE",
        "createdAt": "2026-07-01T00:00:00.000+08:00"
      },
      {
        "quotaId": "qta-003",
        "scope": "MODEL",
        "scopeId": "gpt-4o",
        "quotaType": "TOKEN_DAILY",
        "limit": 500000,
        "used": 320000,
        "remaining": 180000,
        "modelId": "gpt-4o",
        "resetAt": "2026-07-17T00:00:00.000+08:00",
        "status": "ACTIVE",
        "createdAt": "2026-07-16T10:00:00.000+08:00"
      }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.2 配额详情

**GET** `/api/v1/llmgw/quotas/{quotaId}`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "quotaId": "qta-001",
    "scope": "USER",
    "scopeId": "user-001",
    "quotaType": "TOKEN_DAILY",
    "limit": 100000,
    "used": 45200,
    "remaining": 54800,
    "usagePercent": 45.2,
    "modelId": null,
    "resetAt": "2026-07-17T00:00:00.000+08:00",
    "status": "ACTIVE",
    "alertThreshold": 80,
    "alertEnabled": true,
    "lastAlertAt": null,
    "createdAt": "2026-07-16T10:00:00.000+08:00",
    "updatedAt": "2026-07-16T10:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.3 创建配额规则

**POST** `/api/v1/llmgw/quotas`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| scope | string | 是 | 配额维度：`USER` / `APP` / `TENANT` / `MODEL` |
| scopeId | string | 是 | 维度目标 ID（用户ID/应用ID/租户ID/模型ID） |
| quotaType | string | 是 | 配额类型：`TOKEN_DAILY` / `TOKEN_MONTHLY` / `REQUEST_DAILY` / `REQUEST_MONTHLY` |
| limit | integer | 是 | 配额上限（Token 数或请求数） |
| modelId | string | 否 | 限定模型 ID（不传则对所有模型生效） |
| alertThreshold | integer | 否 | 预警阈值百分比，默认 80，范围 50-99 |
| alertEnabled | boolean | 否 | 是否启用预警，默认 true |

**请求示例**

```json
{
  "scope": "USER",
  "scopeId": "user-001",
  "quotaType": "TOKEN_DAILY",
  "limit": 100000,
  "alertThreshold": 80,
  "alertEnabled": true
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "quotaId": "qta-004",
    "scope": "USER",
    "scopeId": "user-001",
    "quotaType": "TOKEN_DAILY",
    "limit": 100000,
    "used": 0,
    "remaining": 100000,
    "modelId": null,
    "resetAt": "2026-07-17T00:00:00.000+08:00",
    "status": "ACTIVE",
    "alertThreshold": 80,
    "alertEnabled": true,
    "createdAt": "2026-07-16T16:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | scope / scopeId / quotaType / limit 为空 |
| 40004 | limit 值不合法（小于等于 0） |
| 40901 | 同一 scope+scopeId+quotaType+modelId 的配额已存在 |

---

#### 3.5.4 更新配额规则

**PUT** `/api/v1/llmgw/quotas/{quotaId}`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| limit | integer | 否 | 新的配额上限 |
| alertThreshold | integer | 否 | 预警阈值百分比 |
| alertEnabled | boolean | 否 | 是否启用预警 |
| status | string | 否 | 状态：`ACTIVE` / `INACTIVE` |
| version | integer | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "limit": 200000,
  "alertThreshold": 90,
  "version": 1
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "quotaId": "qta-001",
    "limit": 200000,
    "used": 45200,
    "remaining": 154800,
    "alertThreshold": 90,
    "version": 2,
    "updatedAt": "2026-07-16T16:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.5 删除配额规则

**DELETE** `/api/v1/llmgw/quotas/{quotaId}`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "quotaId": "qta-004",
    "deleted": true
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.6 配额使用情况查询（实时）

**GET** `/api/v1/llmgw/quotas/usage`

实时查询配额使用情况，数据从 Redis 读取，延迟在秒级以内。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| scope | string | 否 | 配额维度 |
| scopeId | string | 否 | 维度目标 ID |
| quotaType | string | 否 | 配额类型 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "quotaId": "qta-001",
        "scope": "USER",
        "scopeId": "user-001",
        "quotaType": "TOKEN_DAILY",
        "limit": 200000,
        "used": 45200,
        "remaining": 154800,
        "usagePercent": 22.6,
        "resetAt": "2026-07-17T00:00:00.000+08:00"
      },
      {
        "quotaId": "qta-002",
        "scope": "APP",
        "scopeId": "app-superai",
        "quotaType": "TOKEN_MONTHLY",
        "limit": 5000000,
        "used": 1200000,
        "remaining": 3800000,
        "usagePercent": 24.0,
        "resetAt": "2026-08-01T00:00:00.000+08:00"
      }
    ],
    "total": 2
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.7 重置配额使用量

**PUT** `/api/v1/llmgw/quotas/{quotaId}/reset`

手动重置配额使用量归零。通常用于配额调整后或异常恢复。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reason | string | 否 | 重置原因 |

**请求示例**

```json
{
  "reason": "用户购买额外配额包，手动重置"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "quotaId": "qta-001",
    "previousUsed": 45200,
    "currentUsed": 0,
    "remaining": 200000,
    "resetAt": "2026-07-16T17:00:00.000+08:00",
    "resetBy": "user-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.8 限流规则列表

**GET** `/api/v1/llmgw/rate-limits`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |
| scope | string | 否 | 限流维度：`USER` / `APP` / `TENANT` / `GLOBAL` / `MODEL` |
| status | string | 否 | 状态筛选 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "ruleId": "rl-001",
        "scope": "USER",
        "scopeId": "user-001",
        "qpsLimit": 10,
        "concurrentLimit": 5,
        "modelId": null,
        "status": "ACTIVE",
        "createdAt": "2026-07-16T10:00:00.000+08:00"
      },
      {
        "ruleId": "rl-002",
        "scope": "APP",
        "scopeId": "app-superai",
        "qpsLimit": 50,
        "concurrentLimit": 20,
        "modelId": null,
        "status": "ACTIVE",
        "createdAt": "2026-07-16T10:00:00.000+08:00"
      },
      {
        "ruleId": "rl-003",
        "scope": "GLOBAL",
        "scopeId": "*",
        "qpsLimit": 500,
        "concurrentLimit": 200,
        "modelId": null,
        "status": "ACTIVE",
        "createdAt": "2026-07-16T10:00:00.000+08:00"
      }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.9 创建限流规则

**POST** `/api/v1/llmgw/rate-limits`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| scope | string | 是 | 限流维度：`USER` / `APP` / `TENANT` / `GLOBAL` / `MODEL` |
| scopeId | string | 是 | 维度目标 ID（GLOBAL 时传 `*`） |
| qpsLimit | integer | 是 | 每秒请求数上限，范围 1-10000 |
| concurrentLimit | integer | 否 | 并发请求数上限，范围 1-1000，默认 10 |
| modelId | string | 否 | 限定模型 ID（不传则对所有模型生效） |

**请求示例**

```json
{
  "scope": "USER",
  "scopeId": "user-001",
  "qpsLimit": 10,
  "concurrentLimit": 5
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-004",
    "scope": "USER",
    "scopeId": "user-001",
    "qpsLimit": 10,
    "concurrentLimit": 5,
    "modelId": null,
    "status": "ACTIVE",
    "createdAt": "2026-07-16T17:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | scope / scopeId / qpsLimit 为空 |
| 40004 | qpsLimit 或 concurrentLimit 值不合法 |
| 40904 | 同一 scope+scopeId+modelId 的限流规则已存在 |

---

#### 3.5.10 更新限流规则

**PUT** `/api/v1/llmgw/rate-limits/{ruleId}`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| qpsLimit | integer | 否 | 新的 QPS 上限 |
| concurrentLimit | integer | 否 | 新的并发上限 |
| status | string | 否 | 状态：`ACTIVE` / `INACTIVE` |
| version | integer | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "qpsLimit": 20,
  "concurrentLimit": 10,
  "version": 1
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-004",
    "qpsLimit": 20,
    "concurrentLimit": 10,
    "version": 2,
    "updatedAt": "2026-07-16T17:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.11 删除限流规则

**DELETE** `/api/v1/llmgw/rate-limits/{ruleId}`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-004",
    "deleted": true
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

### 3.6 成本核算 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/llmgw/costs/summary` | 成本汇总（总览） |
| GET | `/api/v1/llmgw/costs/by-user` | 按用户维度成本报表 |
| GET | `/api/v1/llmgw/costs/by-app` | 按应用维度成本报表 |
| GET | `/api/v1/llmgw/costs/by-model` | 按模型维度成本报表 |
| GET | `/api/v1/llmgw/costs/by-provider` | 按供应商维度成本报表 |
| GET | `/api/v1/llmgw/costs/timeline` | 成本时间序列 |
| GET | `/api/v1/llmgw/costs/export` | 导出成本报表（CSV） |

---

#### 3.6.1 成本汇总

**GET** `/api/v1/llmgw/costs/summary`

查询指定时间范围内的成本汇总数据。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startTime | string | 是 | 开始时间（ISO 8601），如 `2026-07-01T00:00:00.000+08:00` |
| endTime | string | 是 | 结束时间（ISO 8601），如 `2026-07-16T23:59:59.999+08:00` |
| userId | string | 否 | 用户 ID 筛选 |
| appId | string | 否 | 应用 ID 筛选 |
| modelId | string | 否 | 模型 ID 筛选 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "startTime": "2026-07-01T00:00:00.000+08:00",
    "endTime": "2026-07-16T23:59:59.999+08:00",
    "totalCost": 1256.78,
    "currency": "CNY",
    "totalCalls": 45620,
    "totalTokens": 85200000,
    "promptTokens": 62000000,
    "completionTokens": 23200000,
    "avgLatencyMs": 1350,
    "errorRate": 0.003,
    "breakdown": {
      "byModality": {
        "chat": {
          "cost": 1180.50,
          "calls": 42000,
          "tokens": 78000000
        },
        "embedding": {
          "cost": 76.28,
          "calls": 3620,
          "tokens": 7200000
        }
      }
    },
    "topModels": [
      {
        "modelId": "doubao-pro-32k",
        "cost": 680.00,
        "calls": 28000,
        "tokens": 52000000
      },
      {
        "modelId": "gpt-4o",
        "cost": 420.50,
        "calls": 12000,
        "tokens": 21000000
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.6.2 按用户维度成本报表

**GET** `/api/v1/llmgw/costs/by-user`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startTime | string | 是 | 开始时间 |
| endTime | string | 是 | 结束时间 |
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |
| sort | string | 否 | 排序字段，默认 `totalCost:desc` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "userId": "user-001",
        "userName": "张三",
        "totalCost": 320.50,
        "totalCalls": 8500,
        "totalTokens": 15000000,
        "promptTokens": 11000000,
        "completionTokens": 4000000,
        "avgLatencyMs": 1200,
        "errorRate": 0.002,
        "topModel": "doubao-pro-32k",
        "topModelCost": 280.00
      },
      {
        "userId": "user-002",
        "userName": "李四",
        "totalCost": 256.30,
        "totalCalls": 6200,
        "totalTokens": 12000000,
        "promptTokens": 9000000,
        "completionTokens": 3000000,
        "avgLatencyMs": 1350,
        "errorRate": 0.005,
        "topModel": "gpt-4o",
        "topModelCost": 200.00
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

---

#### 3.6.3 按应用维度成本报表

**GET** `/api/v1/llmgw/costs/by-app`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startTime | string | 是 | 开始时间 |
| endTime | string | 是 | 结束时间 |
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "appId": "app-superai",
        "appName": "超级 AI",
        "totalCost": 580.00,
        "totalCalls": 18000,
        "totalTokens": 32000000,
        "promptTokens": 24000000,
        "completionTokens": 8000000,
        "avgLatencyMs": 1300,
        "errorRate": 0.003,
        "uniqueUsers": 25,
        "topModel": "doubao-pro-32k"
      },
      {
        "appId": "tech-rag",
        "appName": "RAG 引擎",
        "totalCost": 76.28,
        "totalCalls": 3620,
        "totalTokens": 7200000,
        "promptTokens": 7200000,
        "completionTokens": 0,
        "avgLatencyMs": 85,
        "errorRate": 0.001,
        "uniqueUsers": 0,
        "topModel": "doubao-embedding-large"
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

---

#### 3.6.4 按模型维度成本报表

**GET** `/api/v1/llmgw/costs/by-model`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startTime | string | 是 | 开始时间 |
| endTime | string | 是 | 结束时间 |
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "modelId": "doubao-pro-32k",
        "modelName": "Doubao Pro 32K",
        "providerName": "火山方舟",
        "totalCost": 680.00,
        "totalCalls": 28000,
        "totalTokens": 52000000,
        "promptTokens": 38000000,
        "completionTokens": 14000000,
        "inputCost": 304.00,
        "outputCost": 376.00,
        "avgLatencyMs": 1200,
        "errorRate": 0.002,
        "avgPromptTokens": 1357,
        "avgCompletionTokens": 500
      },
      {
        "modelId": "gpt-4o",
        "modelName": "GPT-4o",
        "providerName": "OpenAI",
        "totalCost": 420.50,
        "totalCalls": 12000,
        "totalTokens": 21000000,
        "promptTokens": 16000000,
        "completionTokens": 5000000,
        "inputCost": 80.00,
        "outputCost": 75.00,
        "avgLatencyMs": 1500,
        "errorRate": 0.005,
        "avgPromptTokens": 1333,
        "avgCompletionTokens": 417
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

---

#### 3.6.5 按供应商维度成本报表

**GET** `/api/v1/llmgw/costs/by-provider`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startTime | string | 是 | 开始时间 |
| endTime | string | 是 | 结束时间 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "providerId": "prv-9a8b7c6d2026",
        "providerName": "火山方舟",
        "providerType": "VOLCENGINE",
        "totalCost": 856.28,
        "totalCalls": 31620,
        "totalTokens": 59200000,
        "promptTokens": 45200000,
        "completionTokens": 14000000,
        "modelCount": 3,
        "avgLatencyMs": 1100,
        "errorRate": 0.002,
        "costPercent": 68.1
      },
      {
        "providerId": "prv-a1b2c3d4e5f6",
        "providerName": "OpenAI",
        "providerType": "OPENAI",
        "totalCost": 400.50,
        "totalCalls": 14000,
        "totalTokens": 26000000,
        "promptTokens": 16800000,
        "completionTokens": 9200000,
        "modelCount": 2,
        "avgLatencyMs": 1500,
        "errorRate": 0.005,
        "costPercent": 31.9
      }
    ],
    "total": 2
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.6.6 成本时间序列

**GET** `/api/v1/llmgw/costs/timeline`

按时间粒度返回成本变化趋势，用于图表展示。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startTime | string | 是 | 开始时间 |
| endTime | string | 是 | 结束时间 |
| granularity | string | 否 | 时间粒度：`HOUR` / `DAY` / `WEEK` / `MONTH`，默认 `DAY` |
| dimension | string | 否 | 分组维度：`MODEL` / `APP` / `USER` / `PROVIDER`，不传则为总计 |
| dimensionId | string | 否 | 分组维度目标 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "granularity": "DAY",
    "dimension": null,
    "points": [
      {
        "timestamp": "2026-07-01T00:00:00.000+08:00",
        "cost": 45.20,
        "calls": 1800,
        "tokens": 3200000
      },
      {
        "timestamp": "2026-07-02T00:00:00.000+08:00",
        "cost": 52.30,
        "calls": 2100,
        "tokens": 3800000
      },
      {
        "timestamp": "2026-07-03T00:00:00.000+08:00",
        "cost": 68.50,
        "calls": 2600,
        "tokens": 4800000
      },
      {
        "timestamp": "2026-07-15T00:00:00.000+08:00",
        "cost": 95.80,
        "calls": 3500,
        "tokens": 6200000
      },
      {
        "timestamp": "2026-07-16T00:00:00.000+08:00",
        "cost": 102.48,
        "calls": 3800,
        "tokens": 6800000
      }
    ],
    "totalPoints": 16
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.6.7 导出成本报表

**GET** `/api/v1/llmgw/costs/export`

导出指定维度的成本报表为 CSV 文件。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startTime | string | 是 | 开始时间 |
| endTime | string | 是 | 结束时间 |
| dimension | string | 是 | 维度：`USER` / `APP` / `MODEL` / `PROVIDER` |
| format | string | 否 | 导出格式：`CSV`（默认）/ `JSON` |

**响应**

- `Content-Type: text/csv` 或 `application/json`
- 文件下载（`Content-Disposition: attachment; filename="cost_report_20260701_20260716.csv"`）

**CSV 格式示例**

```csv
userId,userName,totalCost,totalCalls,totalTokens,promptTokens,completionTokens,avgLatencyMs,errorRate,topModel
user-001,张三,320.50,8500,15000000,11000000,4000000,1200,0.002,doubao-pro-32k
user-002,李四,256.30,6200,12000000,9000000,3000000,1350,0.005,gpt-4o
```

---

### 3.7 调用审计 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/llmgw/audit/logs` | 调用日志查询（分页） |
| GET | `/api/v1/llmgw/audit/logs/{logId}` | 调用日志详情 |
| GET | `/api/v1/llmgw/audit/errors` | 错误日志查询 |
| GET | `/api/v1/llmgw/audit/errors/{logId}` | 错误日志详情 |
| GET | `/api/v1/llmgw/audit/latency` | 延迟统计 |
| GET | `/api/v1/llmgw/audit/latency/by-model` | 按模型的延迟统计 |

---

#### 3.7.1 调用日志查询

**GET** `/api/v1/llmgw/audit/logs`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20，最大 100 |
| startTime | string | 否 | 开始时间 |
| endTime | string | 否 | 结束时间 |
| userId | string | 否 | 用户 ID 筛选 |
| appId | string | 否 | 应用 ID 筛选 |
| modelId | string | 否 | 模型 ID 筛选 |
| providerId | string | 否 | 供应商 ID 筛选 |
| status | string | 否 | 调用状态：`SUCCESS` / `FAILED` / `TIMEOUT` |
| traceId | string | 否 | 按 trace_id 查询 |
| requestType | string | 否 | 请求类型：`CHAT` / `EMBEDDING` / `MULTIMODAL` |
| sort | string | 否 | 排序字段，默认 `createdAt:desc` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "logId": "log-20260716-000001",
        "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "requestType": "CHAT",
        "model": "doubao-pro-32k",
        "provider": "volcengine",
        "userId": "user-001",
        "appId": "app-superai",
        "status": "SUCCESS",
        "promptTokens": 85,
        "completionTokens": 320,
        "totalTokens": 405,
        "inputCost": 0.00068,
        "outputCost": 0.00768,
        "totalCost": 0.00836,
        "latencyMs": 1850,
        "firstTokenMs": 320,
        "providerLatencyMs": 1800,
        "errorMessage": null,
        "isFallback": false,
        "conversationId": "conv-20260716-000123",
        "createdAt": "2026-07-16T15:23:00.000+08:00"
      },
      {
        "logId": "log-20260716-000002",
        "traceId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "requestType": "CHAT",
        "model": "gpt-4o",
        "provider": "openai",
        "userId": "user-002",
        "appId": "app-superai",
        "status": "FAILED",
        "promptTokens": 120,
        "completionTokens": 0,
        "totalTokens": 120,
        "inputCost": 0.0006,
        "outputCost": 0,
        "totalCost": 0.0006,
        "latencyMs": 30000,
        "firstTokenMs": null,
        "providerLatencyMs": 29500,
        "errorMessage": "模型供应商调用超时（30s）",
        "errorCode": 50006,
        "isFallback": true,
        "fallbackFromModel": "doubao-pro-32k",
        "conversationId": "conv-20260716-000124",
        "createdAt": "2026-07-16T15:25:00.000+08:00"
      }
    ],
    "total": 45620,
    "page": 1,
    "pageSize": 20,
    "totalPages": 2281
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.7.2 调用日志详情

**GET** `/api/v1/llmgw/audit/logs/{logId}`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| logId | string | 日志 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "logId": "log-20260716-000001",
    "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "requestType": "CHAT",
    "model": "doubao-pro-32k",
    "provider": "volcengine",
    "providerId": "prv-9a8b7c6d2026",
    "userId": "user-001",
    "appId": "app-superai",
    "status": "SUCCESS",
    "request": {
      "model": "doubao-pro-32k",
      "messages": [
        {
          "role": "system",
          "content": "你是 Mate Platform 的智能助手..."
        },
        {
          "role": "user",
          "content": "请解释什么是 Ontology 本体引擎..."
        }
      ],
      "temperature": 0.3,
      "maxTokens": 2048,
      "stream": false,
      "fallbackModels": ["doubao-pro-128k", "gpt-4o"]
    },
    "response": {
      "id": "chatcmpl-9a8b7c6d2026",
      "content": "Ontology 本体引擎是 Mate Platform 的核心组件...",
      "finishReason": "stop"
    },
    "usage": {
      "promptTokens": 85,
      "completionTokens": 320,
      "totalTokens": 405
    },
    "cost": {
      "inputCost": 0.00068,
      "outputCost": 0.00768,
      "totalCost": 0.00836,
      "currency": "CNY"
    },
    "latency": {
      "totalMs": 1850,
      "firstTokenMs": 320,
      "providerMs": 1800,
      "queueMs": 50
    },
    "isFallback": false,
    "fallbackChain": [],
    "errorMessage": null,
    "errorCode": null,
    "conversationId": "conv-20260716-000123",
    "ipAddress": "10.0.1.100",
    "userAgent": "MetaPlatform/1.0",
    "createdAt": "2026-07-16T15:23:00.000+08:00",
    "completedAt": "2026-07-16T15:23:01.850+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40406 | logId 不存在 |

---

#### 3.7.3 错误日志查询

**GET** `/api/v1/llmgw/audit/errors`

查询调用失败的错误日志，支持按错误码、模型、供应商等维度筛选。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |
| startTime | string | 否 | 开始时间 |
| endTime | string | 否 | 结束时间 |
| errorCode | integer | 否 | 业务错误码筛选 |
| modelId | string | 否 | 模型 ID 筛选 |
| providerId | string | 否 | 供应商 ID 筛选 |
| userId | string | 否 | 用户 ID 筛选 |
| appId | string | 否 | 应用 ID 筛选 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "logId": "log-20260716-000002",
        "traceId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "requestType": "CHAT",
        "model": "doubao-pro-32k",
        "provider": "volcengine",
        "userId": "user-002",
        "appId": "app-superai",
        "status": "FAILED",
        "errorCode": 50006,
        "errorMessage": "模型供应商调用超时（30s）",
        "errorType": "PROVIDER_TIMEOUT",
        "latencyMs": 30000,
        "isFallback": true,
        "fallbackAttempted": ["gpt-4o"],
        "fallbackResult": "SUCCESS",
        "finalModel": "gpt-4o",
        "createdAt": "2026-07-16T15:25:00.000+08:00"
      },
      {
        "logId": "log-20260716-000003",
        "traceId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
        "requestType": "CHAT",
        "model": "gpt-4o",
        "provider": "openai",
        "userId": "user-003",
        "appId": "app-dw",
        "status": "FAILED",
        "errorCode": 50005,
        "errorMessage": "供应商 API 返回 429: Rate limit exceeded",
        "errorType": "PROVIDER_API_ERROR",
        "latencyMs": 1200,
        "isFallback": false,
        "fallbackAttempted": [],
        "fallbackResult": null,
        "finalModel": null,
        "createdAt": "2026-07-16T15:30:00.000+08:00"
      }
    ],
    "total": 137,
    "page": 1,
    "pageSize": 20,
    "totalPages": 7
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.7.4 错误日志详情

**GET** `/api/v1/llmgw/audit/errors/{logId}`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "logId": "log-20260716-000002",
    "traceId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "requestType": "CHAT",
    "model": "doubao-pro-32k",
    "provider": "volcengine",
    "providerId": "prv-9a8b7c6d2026",
    "userId": "user-002",
    "appId": "app-superai",
    "status": "FAILED",
    "errorCode": 50006,
    "errorMessage": "模型供应商调用超时（30s）",
    "errorType": "PROVIDER_TIMEOUT",
    "request": {
      "model": "doubao-pro-32k",
      "messages": [
        {"role": "user", "content": "帮我总结今天的会议纪要"}
      ],
      "temperature": 0.7,
      "maxTokens": 2048
    },
    "providerResponse": null,
    "latency": {
      "totalMs": 30000,
      "providerMs": 29500,
      "timeoutConfig": 30
    },
    "isFallback": true,
    "fallbackChain": [
      {
        "model": "doubao-pro-32k",
        "provider": "volcengine",
        "status": "TIMEOUT",
        "latencyMs": 29500,
        "errorMessage": "调用超时"
      },
      {
        "model": "gpt-4o",
        "provider": "openai",
        "status": "SUCCESS",
        "latencyMs": 1500,
        "errorMessage": null
      }
    ],
    "finalModel": "gpt-4o",
    "finalProvider": "openai",
    "conversationId": "conv-20260716-000124",
    "createdAt": "2026-07-16T15:25:00.000+08:00",
    "resolvedAt": "2026-07-16T15:25:31.500+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40406 | logId 不存在 |

---

#### 3.7.5 延迟统计

**GET** `/api/v1/llmgw/audit/latency`

查询指定时间范围内的调用延迟统计。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startTime | string | 是 | 开始时间 |
| endTime | string | 是 | 结束时间 |
| modelId | string | 否 | 模型 ID 筛选 |
| providerId | string | 否 | 供应商 ID 筛选 |
| requestType | string | 否 | 请求类型筛选 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "startTime": "2026-07-16T00:00:00.000+08:00",
    "endTime": "2026-07-16T23:59:59.999+08:00",
    "summary": {
      "totalCalls": 45620,
      "avgLatencyMs": 1350,
      "p50LatencyMs": 1100,
      "p90LatencyMs": 2200,
      "p95LatencyMs": 2800,
      "p99LatencyMs": 4500,
      "maxLatencyMs": 30000,
      "minLatencyMs": 45,
      "avgFirstTokenMs": 350,
      "p95FirstTokenMs": 800
    },
    "byRequestType": {
      "chat": {
        "totalCalls": 42000,
        "avgLatencyMs": 1450,
        "p50LatencyMs": 1200,
        "p95LatencyMs": 2900
      },
      "embedding": {
        "totalCalls": 3620,
        "avgLatencyMs": 85,
        "p50LatencyMs": 70,
        "p95LatencyMs": 150
      }
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.7.6 按模型的延迟统计

**GET** `/api/v1/llmgw/audit/latency/by-model`

按模型维度返回延迟统计，用于模型性能对比。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startTime | string | 是 | 开始时间 |
| endTime | string | 是 | 结束时间 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "modelId": "doubao-pro-32k",
        "modelName": "Doubao Pro 32K",
        "providerName": "火山方舟",
        "totalCalls": 28000,
        "avgLatencyMs": 1200,
        "p50LatencyMs": 1000,
        "p90LatencyMs": 1800,
        "p95LatencyMs": 2200,
        "p99LatencyMs": 3500,
        "avgFirstTokenMs": 300,
        "p95FirstTokenMs": 600
      },
      {
        "modelId": "gpt-4o",
        "modelName": "GPT-4o",
        "providerName": "OpenAI",
        "totalCalls": 12000,
        "avgLatencyMs": 1500,
        "p50LatencyMs": 1300,
        "p90LatencyMs": 2500,
        "p95LatencyMs": 3200,
        "p99LatencyMs": 5000,
        "avgFirstTokenMs": 450,
        "p95FirstTokenMs": 900
      }
    ],
    "total": 2
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

## 4. 数据模型

### 4.1 PostgreSQL 表定义

TECH-LLMGW 使用 PostgreSQL 17 存储供应商配置、模型配置、Prompt 模板、配额规则、调用日志与成本数据。所有表均包含 `tenant_id` 字段实现多租户隔离。

#### 4.1.1 模型供应商表（llmgw_providers）

```sql
CREATE TABLE llmgw_providers (
    provider_id          VARCHAR(64)   PRIMARY KEY,
    tenant_id            VARCHAR(64)   NOT NULL,
    provider_key         VARCHAR(64)   NOT NULL,
    name                 VARCHAR(128)  NOT NULL,
    type                 VARCHAR(20)   NOT NULL,   -- OPENAI / ANTHROPIC / VOLCENGINE / QWEN / ZHIPU / BAICHUAN / CUSTOM
    base_url             TEXT          NOT NULL,
    description          TEXT,
    status               VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE / INACTIVE
    default_headers      JSONB         DEFAULT '{}',
    timeout              INTEGER       NOT NULL DEFAULT 60,
    max_retries          INTEGER       NOT NULL DEFAULT 2,
    metadata             JSONB         DEFAULT '{}',
    version              INTEGER       NOT NULL DEFAULT 1,
    created_by           VARCHAR(64)   NOT NULL,
    updated_by           VARCHAR(64),
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at           TIMESTAMPTZ
);

-- 索引
CREATE UNIQUE INDEX idx_llmgw_prov_tenant_key ON llmgw_providers(tenant_id, provider_key) WHERE deleted_at IS NULL;
CREATE INDEX idx_llmgw_prov_tenant_status ON llmgw_providers(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_llmgw_prov_type ON llmgw_providers(tenant_id, type) WHERE deleted_at IS NULL;
```

#### 4.1.2 供应商 API Key 表（llmgw_provider_api_keys）

```sql
CREATE TABLE llmgw_provider_api_keys (
    key_id               VARCHAR(64)   PRIMARY KEY,
    tenant_id            VARCHAR(64)   NOT NULL,
    provider_id          VARCHAR(64)   NOT NULL REFERENCES llmgw_providers(provider_id),
    label                VARCHAR(128),
    encrypted_key        BYTEA         NOT NULL,   -- AES-256-GCM 加密后的 API Key
    key_hash             VARCHAR(128)  NOT NULL,   -- SHA-256 哈希（用于去重校验）
    is_primary           BOOLEAN       NOT NULL DEFAULT FALSE,
    status               VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE / ROTATING / EXPIRED / DELETED
    expires_at           TIMESTAMPTZ,               -- ROTATING 状态时的灰度期过期时间
    last_used_at         TIMESTAMPTZ,
    total_calls          BIGINT        NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_llmgw_apikey_provider ON llmgw_provider_api_keys(provider_id) WHERE status != 'DELETED';
CREATE INDEX idx_llmgw_apikey_status ON llmgw_provider_api_keys(status);
CREATE INDEX idx_llmgw_apikey_expires ON llmgw_provider_api_keys(expires_at) WHERE status = 'ROTATING';
```

#### 4.1.3 模型表（llmgw_models）

```sql
CREATE TABLE llmgw_models (
    model_id             VARCHAR(128)  PRIMARY KEY,
    tenant_id            VARCHAR(64)   NOT NULL,
    provider_id          VARCHAR(64)   NOT NULL REFERENCES llmgw_providers(provider_id),
    model_name           VARCHAR(256)  NOT NULL,
    capabilities         TEXT[]        NOT NULL DEFAULT '{}',  -- CHAT / EMBEDDING / RERANK / VISION / FUNCTION_CALLING
    context_window       INTEGER,
    max_output_tokens    INTEGER,
    embedding_dimension  INTEGER,
    input_price_per_1k   NUMERIC(10,6),
    output_price_per_1k  NUMERIC(10,6),
    currency             VARCHAR(10)   DEFAULT 'CNY',
    status               VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    metadata             JSONB         DEFAULT '{}',
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at           TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_llmgw_model_provider ON llmgw_models(provider_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_llmgw_model_tenant ON llmgw_models(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_llmgw_model_capabilities ON llmgw_models USING GIN(capabilities) WHERE deleted_at IS NULL;
CREATE INDEX idx_llmgw_model_status ON llmgw_models(tenant_id, status) WHERE deleted_at IS NULL;
```

#### 4.1.4 Prompt 模板表（llmgw_prompts）

```sql
CREATE TABLE llmgw_prompts (
    prompt_id            VARCHAR(64)   PRIMARY KEY,
    tenant_id            VARCHAR(64)   NOT NULL,
    prompt_key           VARCHAR(128)  NOT NULL,
    name                 VARCHAR(128)  NOT NULL,
    description          TEXT,
    category             VARCHAR(64),
    current_version      INTEGER       NOT NULL DEFAULT 1,
    default_model_id     VARCHAR(128),
    default_params       JSONB         DEFAULT '{}',
    tags                 TEXT[]        DEFAULT '{}',
    status               VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    created_by           VARCHAR(64)   NOT NULL,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at           TIMESTAMPTZ
);

-- 索引
CREATE UNIQUE INDEX idx_llmgw_prompt_tenant_key ON llmgw_prompts(tenant_id, prompt_key) WHERE deleted_at IS NULL;
CREATE INDEX idx_llmgw_prompt_category ON llmgw_prompts(tenant_id, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_llmgw_prompt_tags ON llmgw_prompts USING GIN(tags) WHERE deleted_at IS NULL;
```

#### 4.1.5 Prompt 版本表（llmgw_prompt_versions）

```sql
CREATE TABLE llmgw_prompt_versions (
    id                   BIGSERIAL      PRIMARY KEY,
    tenant_id            VARCHAR(64)   NOT NULL,
    prompt_id            VARCHAR(64)   NOT NULL REFERENCES llmgw_prompts(prompt_id),
    version              INTEGER       NOT NULL,
    template             TEXT          NOT NULL,
    variables            JSONB         DEFAULT '[]',
    change_log           TEXT,
    created_by           VARCHAR(64)   NOT NULL,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    
    UNIQUE(prompt_id, version)
);

-- 索引
CREATE INDEX idx_llmgw_promptver_prompt ON llmgw_prompt_versions(prompt_id, version DESC);
```

#### 4.1.6 配额规则表（llmgw_quotas）

```sql
CREATE TABLE llmgw_quotas (
    quota_id             VARCHAR(64)   PRIMARY KEY,
    tenant_id            VARCHAR(64)   NOT NULL,
    scope                VARCHAR(20)   NOT NULL,   -- USER / APP / TENANT / MODEL
    scope_id             VARCHAR(128)  NOT NULL,
    quota_type           VARCHAR(30)   NOT NULL,   -- TOKEN_DAILY / TOKEN_MONTHLY / REQUEST_DAILY / REQUEST_MONTHLY
    limit_value          BIGINT        NOT NULL,
    model_id             VARCHAR(128),
    alert_threshold      INTEGER       DEFAULT 80,
    alert_enabled        BOOLEAN       DEFAULT TRUE,
    status               VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    version              INTEGER       NOT NULL DEFAULT 1,
    created_by           VARCHAR(64)   NOT NULL,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 索引
CREATE UNIQUE INDEX idx_llmgw_quota_unique ON llmgw_quotas(tenant_id, scope, scope_id, quota_type, COALESCE(model_id, ''));
CREATE INDEX idx_llmgw_quota_scope ON llmgw_quotas(tenant_id, scope, scope_id);
CREATE INDEX idx_llmgw_quota_status ON llmgw_quotas(status);
```

#### 4.1.7 限流规则表（llmgw_rate_limits）

```sql
CREATE TABLE llmgw_rate_limits (
    rule_id              VARCHAR(64)   PRIMARY KEY,
    tenant_id            VARCHAR(64)   NOT NULL,
    scope                VARCHAR(20)   NOT NULL,   -- USER / APP / TENANT / GLOBAL / MODEL
    scope_id             VARCHAR(128)  NOT NULL,
    qps_limit            INTEGER       NOT NULL,
    concurrent_limit     INTEGER       DEFAULT 10,
    model_id             VARCHAR(128),
    status               VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    version              INTEGER       NOT NULL DEFAULT 1,
    created_by           VARCHAR(64)   NOT NULL,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 索引
CREATE UNIQUE INDEX idx_llmgw_rl_unique ON llmgw_rate_limits(tenant_id, scope, scope_id, COALESCE(model_id, ''));
CREATE INDEX idx_llmgw_rl_scope ON llmgw_rate_limits(tenant_id, scope, scope_id);
```

#### 4.1.8 调用日志表（llmgw_call_logs）

```sql
CREATE TABLE llmgw_call_logs (
    id                   BIGSERIAL      PRIMARY KEY,
    log_id               VARCHAR(64)   NOT NULL UNIQUE,
    tenant_id            VARCHAR(64)   NOT NULL,
    trace_id             VARCHAR(64)   NOT NULL,
    request_type         VARCHAR(20)   NOT NULL,   -- CHAT / EMBEDDING / MULTIMODAL
    model_id             VARCHAR(128)  NOT NULL,
    provider_id          VARCHAR(64)   NOT NULL,
    user_id              VARCHAR(64),
    app_id               VARCHAR(64),
    status               VARCHAR(20)   NOT NULL,   -- SUCCESS / FAILED / TIMEOUT
    error_code           INTEGER,
    error_message        TEXT,
    is_fallback          BOOLEAN       NOT NULL DEFAULT FALSE,
    fallback_from_model  VARCHAR(128),
    prompt_tokens        INTEGER,
    completion_tokens    INTEGER,
    total_tokens         INTEGER,
    input_cost           NUMERIC(12,6),
    output_cost          NUMERIC(12,6),
    total_cost           NUMERIC(12,6),
    currency             VARCHAR(10)   DEFAULT 'CNY',
    latency_ms           INTEGER,
    first_token_ms       INTEGER,
    provider_latency_ms  INTEGER,
    conversation_id      VARCHAR(64),
    request_body         JSONB,                     -- 请求体（脱敏后）
    response_body        JSONB,                     -- 响应体（脱敏后）
    ip_address           VARCHAR(64),
    user_agent           VARCHAR(256),
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    completed_at         TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_llmgw_log_tenant_time ON llmgw_call_logs(tenant_id, created_at DESC);
CREATE INDEX idx_llmgw_log_trace ON llmgw_call_logs(trace_id);
CREATE INDEX idx_llmgw_log_model ON llmgw_call_logs(model_id, created_at DESC);
CREATE INDEX idx_llmgw_log_user ON llmgw_call_logs(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_llmgw_log_app ON llmgw_call_logs(app_id, created_at DESC) WHERE app_id IS NOT NULL;
CREATE INDEX idx_llmgw_log_status ON llmgw_call_logs(status, created_at DESC);
CREATE INDEX idx_llmgw_log_provider ON llmgw_call_logs(provider_id, created_at DESC);
```

#### 4.1.9 Outbox 事件表（llmgw_outbox_events）

```sql
CREATE TABLE llmgw_outbox_events (
    id                   BIGSERIAL      PRIMARY KEY,
    event_id             VARCHAR(64)   NOT NULL UNIQUE,
    tenant_id            VARCHAR(64)   NOT NULL,
    event_type           VARCHAR(50)   NOT NULL,
    aggregate_type       VARCHAR(50)   NOT NULL,
    aggregate_id         VARCHAR(64)   NOT NULL,
    trace_id             VARCHAR(64)   NOT NULL,
    payload              JSONB         NOT NULL,
    status               VARCHAR(20)   NOT NULL DEFAULT 'PENDING',  -- PENDING / SENT / FAILED
    retry_count          INTEGER       NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    sent_at              TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_llmgw_outbox_status ON llmgw_outbox_events(status, created_at) WHERE status = 'PENDING';
CREATE INDEX idx_llmgw_outbox_trace ON llmgw_outbox_events(trace_id);
```

### 4.2 Redis 数据结构

TECH-LLMGW 使用 Redis 7.4 实现限流计数、配额缓存、模型列表缓存与 Prompt 缓存。

#### 4.2.1 限流计数器

```
# QPS 限流（令牌桶）
Key:   llmgw:rate_limit:{tenantId}:{scope}:{scopeId}:{modelId|*}:qps
Type:  Sorted Set / String + TTL
TTL:   1s（滑动窗口）
Value: 当前秒内的请求计数

# 并发限流
Key:   llmgw:concurrent:{tenantId}:{scope}:{scopeId}:{modelId|*}
Type:  String (counter)
TTL:   300s（最长请求超时时间）
Value: 当前并发请求数
```

#### 4.2.2 Token 配额缓存

```
# 日配额使用量
Key:   llmgw:quota:{tenantId}:TOKEN_DAILY:{scope}:{scopeId}:{modelId|*}
Type:  String (integer)
TTL:   到当日 24:00 的剩余秒数
Value: 已使用的 Token 数量

# 月配额使用量
Key:   llmgw:quota:{tenantId}:TOKEN_MONTHLY:{scope}:{scopeId}:{modelId|*}
Type:  String (integer)
TTL:   到当月最后一天 24:00 的剩余秒数
Value: 已使用的 Token 数量
```

#### 4.2.3 模型列表缓存

```
# 全局模型列表
Key:   llmgw:models:{tenantId}:all
Type:  String (JSON)
TTL:   300s
Value: 所有可用模型的 JSON 列表

# 按供应商的模型列表
Key:   llmgw:models:{tenantId}:provider:{providerId}
Type:  String (JSON)
TTL:   300s
Value: 该供应商下的模型 JSON 列表
```

#### 4.2.4 Prompt 缓存

```
# Prompt 模板缓存
Key:   llmgw:prompt:{tenantId}:{promptId}:v{version}
Type:  String (JSON)
TTL:   600s
Value: Prompt 模板完整内容

# 渲染后的 Prompt 缓存（相同变量值的渲染结果）
Key:   llmgw:prompt_rendered:{tenantId}:{promptId}:v{version}:{hash(variables)}
Type:  String
TTL:   3600s
Value: 渲染后的 Prompt 文本
```

#### 4.2.5 供应商健康状态

```
# 供应商健康状态
Key:   llmgw:provider_health:{tenantId}:{providerId}
Type:  Hash
Fields:
  status:     HEALTHY / DEGRADED / UNHEALTHY
  last_check: 最近健康检查时间戳
  fail_count: 连续失败次数
  last_error: 最近错误信息
TTL:   60s
```

---

## 5. 事件定义

### 5.1 事件类型

| 事件类型 | 说明 | 触发时机 |
|---|---|---|
| TOKEN_CONSUMED | Token 消耗事件 | 每次 LLM 调用完成（成功/失败均发布） |
| PROVIDER_CREATED | 供应商创建事件 | 供应商配置创建后 |
| PROVIDER_UPDATED | 供应商更新事件 | 供应商配置更新后 |
| PROVIDER_STATE_CHANGED | 供应商状态变更事件 | 供应商启用/禁用后 |
| PROVIDER_DELETED | 供应商删除事件 | 供应商被删除后 |
| API_KEY_ROTATED | API Key 轮换事件 | API Key 轮换操作后 |
| QUOTA_EXCEEDED | 配额耗尽事件 | 用户/应用配额达到上限时 |
| QUOTA_WARNING | 配额预警事件 | 配额使用达到预警阈值时 |
| RATE_LIMIT_TRIGGERED | 限流触发事件 | QPS 或并发限流被触发时 |
| PROMPT_CREATED | Prompt 模板创建事件 | Prompt 模板创建后 |
| PROMPT_UPDATED | Prompt 模板更新事件 | Prompt 模板更新（新版本）后 |
| PROMPT_DELETED | Prompt 模板删除事件 | Prompt 模板被删除后 |
| MODEL_SYNC_COMPLETED | 模型同步完成事件 | 供应商模型列表同步完成后 |
| PROVIDER_HEALTH_CHANGED | 供应商健康状态变更事件 | 供应商健康状态变化时 |

### 5.2 Kafka Topic 定义

| Topic | 说明 | 分区策略 |
|---|---|---|
| `llmgw.token.events` | Token 消耗事件 | 按 `tenantId` 哈希分区 |
| `llmgw.provider.events` | 供应商生命周期事件 | 按 `providerId` 哈希分区 |
| `llmgw.quota.events` | 配额事件 | 按 `tenantId` 哈希分区 |
| `llmgw.prompt.events` | Prompt 生命周期事件 | 按 `promptId` 哈希分区 |
| `llmgw.audit.events` | 审计事件（限流触发等） | 按 `tenantId` 哈希分区 |
| `llmgw.dlq` | 死信队列 | 消费失败的事件 |

### 5.3 Kafka 消息结构

所有 Kafka 消息采用统一信封格式：

```json
{
  "eventId": "evt-20260716-000001",
  "eventType": "TOKEN_CONSUMED",
  "eventTimestamp": "2026-07-16T15:23:01.850+08:00",
  "tenantId": "tenant-001",
  "aggregateType": "LLM_CALL",
  "aggregateId": "log-20260716-000001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "source": "TECH-LLMGW",
  "version": "1.0",
  "payload": { }
}
```

**Kafka 消息头**

| 消息头 | 说明 |
|---|---|
| X-Trace-Id | 链路追踪 ID（与消息体 traceId 一致） |
| X-Event-Type | 事件类型 |
| X-Event-Id | 事件唯一 ID |
| X-Tenant-Id | 租户 ID |
| Content-Type | application/json |

### 5.4 各事件 Payload 定义

#### 5.4.1 TOKEN_CONSUMED

```json
{
  "logId": "log-20260716-000001",
  "requestType": "CHAT",
  "modelId": "doubao-pro-32k",
  "providerId": "prv-9a8b7c6d2026",
  "providerKey": "volcengine",
  "userId": "user-001",
  "appId": "app-superai",
  "status": "SUCCESS",
  "usage": {
    "promptTokens": 85,
    "completionTokens": 320,
    "totalTokens": 405
  },
  "cost": {
    "inputCost": 0.00068,
    "outputCost": 0.00768,
    "totalCost": 0.00836,
    "currency": "CNY"
  },
  "latency": {
    "totalMs": 1850,
    "firstTokenMs": 320,
    "providerMs": 1800
  },
  "isFallback": false,
  "conversationId": "conv-20260716-000123",
  "completedAt": "2026-07-16T15:23:01.850+08:00"
}
```

#### 5.4.2 QUOTA_EXCEEDED

```json
{
  "quotaId": "qta-001",
  "scope": "USER",
  "scopeId": "user-001",
  "quotaType": "TOKEN_DAILY",
  "limit": 100000,
  "used": 100000,
  "remaining": 0,
  "modelId": null,
  "resetAt": "2026-07-17T00:00:00.000+08:00",
  "triggeredBy": "user-001",
  "triggeredAt": "2026-07-16T18:30:00.000+08:00"
}
```

#### 5.4.3 QUOTA_WARNING

```json
{
  "quotaId": "qta-001",
  "scope": "USER",
  "scopeId": "user-001",
  "quotaType": "TOKEN_DAILY",
  "limit": 100000,
  "used": 80500,
  "remaining": 19500,
  "usagePercent": 80.5,
  "alertThreshold": 80,
  "modelId": null,
  "resetAt": "2026-07-17T00:00:00.000+08:00",
  "triggeredAt": "2026-07-16T16:00:00.000+08:00"
}
```

#### 5.4.4 RATE_LIMIT_TRIGGERED

```json
{
  "ruleId": "rl-001",
  "scope": "USER",
  "scopeId": "user-001",
  "limitType": "QPS",
  "qpsLimit": 10,
  "currentQps": 11,
  "modelId": null,
  "userId": "user-001",
  "appId": "app-superai",
  "requestType": "CHAT",
  "model": "doubao-pro-32k",
  "triggeredAt": "2026-07-16T15:23:00.100+08:00"
}
```

#### 5.4.5 PROVIDER_STATE_CHANGED

```json
{
  "providerId": "prv-9a8b7c6d2026",
  "providerKey": "volcengine",
  "name": "火山方舟",
  "previousStatus": "ACTIVE",
  "newStatus": "INACTIVE",
  "reason": "供应商维护中，临时禁用",
  "changedBy": "user-001",
  "changedAt": "2026-07-16T12:00:00.000+08:00"
}
```

#### 5.4.6 API_KEY_ROTATED

```json
{
  "providerId": "prv-9a8b7c6d2026",
  "providerKey": "volcengine",
  "keyId": "key-001",
  "oldKeyMasked": "ark-****xxxx",
  "newKeyMasked": "ark-****zzzz",
  "gracePeriodHours": 24,
  "oldKeyExpiresAt": "2026-07-17T13:00:00.000+08:00",
  "rotatedBy": "user-001",
  "rotatedAt": "2026-07-16T13:00:00.000+08:00"
}
```

#### 5.4.7 PROVIDER_HEALTH_CHANGED

```json
{
  "providerId": "prv-9a8b7c6d2026",
  "providerKey": "volcengine",
  "previousStatus": "HEALTHY",
  "newStatus": "DEGRADED",
  "failCount": 3,
  "lastError": "Provider API returned 503: Service Unavailable",
  "lastCheckAt": "2026-07-16T15:00:00.000+08:00"
}
```

#### 5.4.8 MODEL_SYNC_COMPLETED

```json
{
  "providerId": "prv-9a8b7c6d2026",
  "providerKey": "volcengine",
  "syncedAt": "2026-07-16T14:00:00.000+08:00",
  "totalModels": 15,
  "newModels": 3,
  "updatedModels": 1,
  "unchangedModels": 11,
  "newModelIds": ["doubao-pro-256k", "doubao-vision-pro", "doubao-embedding-large"]
}
```

### 5.5 事件消费方

| 事件类型 | 消费方 | 消费说明 |
|---|---|---|
| TOKEN_CONSUMED | APP-DASHBOARD | 仪表盘实时展示 Token 消耗与成本 |
| TOKEN_CONSUMED | TECH-OBS | 可观测性指标采集 |
| QUOTA_EXCEEDED | APP-SUPERAI / APP-DW | 通知应用配额耗尽，降级处理 |
| QUOTA_WARNING | APP-DASHBOARD | 仪表盘展示配额预警 |
| RATE_LIMIT_TRIGGERED | TECH-OBS | 限流指标采集与告警 |
| PROVIDER_STATE_CHANGED | APP-DASHBOARD | 仪表盘展示供应商状态 |
| PROVIDER_HEALTH_CHANGED | APP-DASHBOARD / TECH-OBS | 健康状态展示与告警 |
| MODEL_SYNC_COMPLETED | APP-DASHBOARD | 通知模型列表已更新 |

---

## 6. 增量交付计划

### 6.1 Sprint 1：供应商管理与模型路由（M1）

**目标**：完成模型供应商 CRUD、API Key 加密管理、模型列表同步与模型路由基础能力。

| 交付项 | API | 说明 |
|---|---|---|
| 创建供应商 | POST /api/v1/llmgw/providers | 含类型、baseUrl、API Key |
| 供应商列表 | GET /api/v1/llmgw/providers | 分页查询、条件筛选 |
| 供应商详情 | GET /api/v1/llmgw/providers/{id} | 含 API Key 列表（掩码） |
| 更新供应商 | PUT /api/v1/llmgw/providers/{id} | 乐观锁版本控制 |
| 删除供应商 | DELETE /api/v1/llmgw/providers/{id} | 级联删除 |
| 启用/禁用供应商 | PUT /api/v1/llmgw/providers/{id}/state | - |
| 添加 API Key | POST /api/v1/llmgw/providers/{id}/api-keys | AES-256-GCM 加密 |
| API Key 列表 | GET /api/v1/llmgw/providers/{id}/api-keys | 掩码显示 |
| 删除 API Key | DELETE /api/v1/llmgw/providers/{id}/api-keys/{keyId} | - |
| 轮换 API Key | PUT /api/v1/llmgw/providers/{id}/api-keys/{keyId}/rotate | 灰度期机制 |
| 同步模型列表 | POST /api/v1/llmgw/providers/{id}/models/sync | 从供应商 API 拉取 |
| 全局模型列表 | GET /api/v1/llmgw/models | 跨供应商查询 |
| 模型详情 | GET /api/v1/llmgw/models/{modelId} | 含统计信息 |
| 数据表 | 全部 DDL | llmgw_providers、llmgw_provider_api_keys、llmgw_models |
| 加密机制 | AES-256-GCM | API Key 加密存储 |
| 模型路由 | 路由引擎 | 按 modelId 路由到对应供应商 |

**验收标准**：能配置多个模型供应商，API Key 加密存储，能从供应商同步模型列表，按模型名称正确路由到对应供应商。

---

### 6.2 Sprint 2：对话接口与 Embedding（M2）

**目标**：完成同步对话、流式对话（SSE）、多模态对话与 Embedding 接口，支持 Fallback 机制。

| 交付项 | API | 说明 |
|---|---|---|
| 同步对话 | POST /api/v1/llmgw/chat/completions | 含 Function Calling |
| 流式对话 | POST /api/v1/llmgw/chat/completions/stream | SSE 实时推送 |
| 多模态对话 | POST /api/v1/llmgw/chat/multimodal | 文本+图片+文件 |
| 可用对话模型 | GET /api/v1/llmgw/chat/models | 含能力筛选 |
| 单条向量化 | POST /api/v1/llmgw/embeddings | - |
| 批量向量化 | POST /api/v1/llmgw/embeddings/batch | 最多 100 条 |
| Embedding 模型列表 | GET /api/v1/llmgw/embeddings/models | - |
| Fallback 机制 | 路由引擎 | 主模型不可用时自动切换 |
| Token 计量 | usage 解析 | 从供应商响应解析 token 用量 |
| 调用日志 | 日志记录 | 每次调用写入 llmgw_call_logs |
| 事件发布 | Kafka TOKEN_CONSUMED | Outbox 模式 |

**验收标准**：能通过网关调用多种模型完成对话（同步/流式），支持多模态输入，Fallback 机制在主模型不可用时自动切换，Token 用量正确计量并发布 Kafka 事件。

---

### 6.3 Sprint 3：流量控制与配额管理（M3）

**目标**：完成 QPS 限流、Token 配额管理、并发控制等流量控制能力。

| 交付项 | API | 说明 |
|---|---|---|
| 配额列表 | GET /api/v1/llmgw/quotas | 分页查询 |
| 配额详情 | GET /api/v1/llmgw/quotas/{id} | - |
| 创建配额 | POST /api/v1/llmgw/quotas | 用户/应用/租户/模型维度 |
| 更新配额 | PUT /api/v1/llmgw/quotas/{id} | 乐观锁 |
| 删除配额 | DELETE /api/v1/llmgw/quotas/{id} | - |
| 配额使用查询 | GET /api/v1/llmgw/quotas/usage | Redis 实时数据 |
| 重置配额 | PUT /api/v1/llmgw/quotas/{id}/reset | 手动归零 |
| 限流规则列表 | GET /api/v1/llmgw/rate-limits | - |
| 创建限流规则 | POST /api/v1/llmgw/rate-limits | QPS + 并发 |
| 更新限流规则 | PUT /api/v1/llmgw/rate-limits/{id} | - |
| 删除限流规则 | DELETE /api/v1/llmgw/rate-limits/{id} | - |
| 令牌桶限流 | Redis 实现 | 滑动窗口 QPS 控制 |
| 配额预警 | QUOTA_WARNING 事件 | 达到阈值时发布事件 |
| 数据表 | DDL | llmgw_quotas、llmgw_rate_limits |
| Redis 结构 | 限流计数器 + 配额缓存 | - |

**验收标准**：能配置多维度配额与限流规则，QPS 限流在超限时返回 429，Token 配额在耗尽时拒绝请求，配额预警在达到阈值时发布事件。

---

### 6.4 Sprint 4：Prompt 管理与成本核算（M4）

**目标**：完成 Prompt 模板 CRUD、版本管理、变量替换、预览，以及成本核算报表。

| 交付项 | API | 说明 |
|---|---|---|
| 创建 Prompt | POST /api/v1/llmgw/prompts | 含变量定义 |
| Prompt 列表 | GET /api/v1/llmgw/prompts | 分页、分类筛选 |
| Prompt 详情 | GET /api/v1/llmgw/prompts/{id} | - |
| 更新 Prompt | PUT /api/v1/llmgw/prompts/{id} | 创建新版本 |
| 删除 Prompt | DELETE /api/v1/llmgw/prompts/{id} | - |
| 版本历史 | GET /api/v1/llmgw/prompts/{id}/versions | - |
| 指定版本 | GET /api/v1/llmgw/prompts/{id}/versions/{v} | - |
| 回滚版本 | POST /api/v1/llmgw/prompts/{id}/rollback | - |
| 渲染 Prompt | POST /api/v1/llmgw/prompts/{id}/render | 变量替换 |
| 预览 Prompt | POST /api/v1/llmgw/prompts/{id}/preview | 渲染 + 模型调用 |
| 成本汇总 | GET /api/v1/llmgw/costs/summary | 总览 |
| 按用户成本 | GET /api/v1/llmgw/costs/by-user | - |
| 按应用成本 | GET /api/v1/llmgw/costs/by-app | - |
| 按模型成本 | GET /api/v1/llmgw/costs/by-model | - |
| 按供应商成本 | GET /api/v1/llmgw/costs/by-provider | - |
| 成本时间序列 | GET /api/v1/llmgw/costs/timeline | 图表数据 |
| 导出报表 | GET /api/v1/llmgw/costs/export | CSV/JSON |
| 数据表 | DDL | llmgw_prompts、llmgw_prompt_versions |
| Prompt 缓存 | Redis | 模板与渲染结果缓存 |

**验收标准**：Prompt 模板支持版本管理与变量替换，预览功能能渲染并调用模型返回结果，成本报表支持多维度查询与导出。

---

### 6.5 Sprint 5：调用审计与可观测性（M5）

**目标**：完成调用日志查询、错误追踪、延迟统计等审计能力，完善可观测性。

| 交付项 | API | 说明 |
|---|---|---|
| 调用日志查询 | GET /api/v1/llmgw/audit/logs | 多维度筛选 |
| 调用日志详情 | GET /api/v1/llmgw/audit/logs/{id} | 含请求/响应体 |
| 错误日志查询 | GET /api/v1/llmgw/audit/errors | 按错误码筛选 |
| 错误日志详情 | GET /api/v1/llmgw/audit/errors/{id} | 含 Fallback 链 |
| 延迟统计 | GET /api/v1/llmgw/audit/latency | P50/P90/P95/P99 |
| 按模型延迟 | GET /api/v1/llmgw/audit/latency/by-model | 模型性能对比 |
| 供应商健康检查 | 健康检查机制 | 定时探测 + Redis 状态 |
| trace_id 关联 | 全链路追踪 | 请求->日志->Kafka 事件 |
| DLQ 机制 | 死信队列 | 消费失败重试 3 次 |
| Prometheus 指标 | 指标采集 | QPS / 延迟 / 错误率 / Token 用量 |
| 事件发布 | Kafka 全部事件 | Outbox 模式 |

**验收标准**：调用日志可多维度查询与详情查看，错误日志包含完整 Fallback 链信息，延迟统计提供分位数指标，trace_id 全链路关联，Kafka 事件通过 Outbox 模式可靠发布，DLQ 机制保障消费失败可追溯。