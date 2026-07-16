# SPEC - Action Engine 服务 API 规范（TECH-ACTION）

> 文档版本：v1.0  
> 日期：2026-07-16  
> 模块：TECH-ACTION  
> 包名：`com.metaplatform.action`  
> API 路径前缀：`/api/v1/action`

---

## 目录

- [1. 服务概述](#1-服务概述)
- [2. 通用约定](#2-通用约定)
- [3. API 接口详情](#3-api-接口详情)
  - [3.1 Action 定义管理 API](#31-action-定义管理-api)
  - [3.2 服务编排 API](#32-服务编排-api)
  - [3.3 触发规则 API](#33-触发规则-api)
  - [3.4 执行引擎 API](#34-执行引擎-api)
  - [3.5 执行监控 API](#35-执行监控-api)
- [4. 数据模型](#4-数据模型)
- [5. 事件定义](#5-事件定义)
- [6. 增量交付计划](#6-增量交付计划)

---

## 1. 服务概述

### 1.1 服务定位

TECH-ACTION 是 Mate Platform 的 **Action Engine（动作引擎）服务**，为平台提供统一的动作（Action）编排与执行能力。它是连接本体语义（TECH-ONT）、工作流引擎（TECH-WFE）和规则引擎（TECH-RULE）的执行枢纽，将业务定义的 Action 转化为可执行的计算单元，并通过服务编排实现复杂业务场景的自动化。

### 1.2 核心职责

| 职责 | 说明 |
|---|---|
| Action 定义管理 | Action 的 CRUD，配置输入/输出 Schema、执行逻辑（HTTP/Script/Lambda）、补偿逻辑 |
| 服务编排 | 将多个 Action 组合为复合服务，支持串行/并行/条件/循环编排模式 |
| 触发规则配置 | 事件驱动（Kafka 事件触发）、定时（Cron）、手动触发 |
| 执行引擎 | Action 执行、状态追踪、超时处理、重试机制 |
| 执行监控与审计 | 执行记录、耗时统计、错误追踪、补偿执行 |

### 1.3 技术栈

| 层级 | 技术 |
|---|---|
| 语言 | Java 21 |
| 框架 | Spring Boot 3.4 + Spring AI 1.0 |
| 数据库 | PostgreSQL 17 |
| 消息队列 | Kafka 3.9 |
| 缓存 | Redis 7.4 |
| 脚本引擎 | GraalVM Polyglot（JS/Python） |
| 可观测性 | OpenTelemetry 1.45 + Prometheus 3.x |

### 1.4 上下游依赖

```
上游依赖：
  TECH-ONT    ← 本体引擎，提供 Action 绑定的业务对象语义、数据 Schema
  TECH-WFE    ← 工作流引擎，编排中可调用工作流节点
  TECH-RULE   ← 规则引擎，条件分支由规则引擎求值

下游消费：
  APP-ONTSTUDIO ← 本体论引擎前端，Action 定义与编排的可视化管理
  APP-SUPERAI   ← 超级 AI，Agent 调用 Action 执行工具
```

### 1.5 架构约束

- Kafka 消息发布必须使用 **Outbox 模式** 防止数据丢失
- 事件消费必须支持 **DLQ（Dead Letter Queue）**，重试 3 次
- `trace_id` 必须在所有系统组件间传播，Kafka 消息头包含 `X-Trace-Id`
- DLQ 记录必须包含 `traceId` 字段用于故障诊断
- 所有 LLM 调用必须通过 `TECH-LLMGW`，不直接调模型 API

---

## 2. 通用约定

### 2.1 路径前缀

所有 API 路径前缀为 `/api/v1/action`。

### 2.2 统一响应体

所有接口返回统一 JSON 结构：

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
| code | int | 业务码。`0` 表示成功，非 `0` 表示业务错误 |
| message | string | 提示信息 |
| data | object / array / null | 业务数据，失败时为 `null` |
| traceId | string | 全链路追踪 ID，与请求头 `X-Trace-Id` 一致 |

### 2.3 认证

| 方式 | 说明 |
|---|---|
| Bearer Token | 请求头携带 `Authorization: Bearer <JWT>`，由 TECH-IAM 签发 |
| API Key | 内部服务间调用可使用 `X-API-Key: <key>`，适用于 MCP/A2A 场景 |

请求头示例：

```
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
X-Trace-Id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
X-Tenant-Id: tenant-001
Content-Type: application/json
```

### 2.4 错误码

| code | HTTP Status | 说明 |
|---|---|---|
| 0 | 200 | 成功 |
| 40001 | 400 | 请求参数校验失败 |
| 40002 | 400 | 请求体 JSON 格式错误 |
| 40101 | 401 | 未认证或 Token 过期 |
| 40301 | 403 | 无权限访问该资源 |
| 40401 | 404 | 资源不存在 |
| 40901 | 409 | 资源冲突（如名称重复） |
| 40902 | 409 | 状态非法（如 Action 已禁用不可执行） |
| 42201 | 422 | 业务校验失败（如 Schema 不匹配） |
| 42901 | 429 | 请求过于频繁，限流触发 |
| 50001 | 500 | 服务内部错误 |
| 50002 | 500 | Action 执行超时 |
| 50003 | 500 | Action 执行失败（Script/HTTP/Lambda 错误） |
| 50004 | 500 | 补偿执行失败 |
| 50301 | 503 | 下游依赖不可用（TECH-ONT/WFE/RULE） |

### 2.5 分页约定

列表类接口统一使用游标分页 + 偏移分页双模式：

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| page | int | 1 | 页码，从 1 开始 |
| pageSize | int | 20 | 每页条数，最大 100 |
| cursor | string | null | 游标，提供时优先使用游标分页 |

分页响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [ ],
    "total": 150,
    "page": 1,
    "pageSize": 20,
    "hasNext": true,
    "nextCursor": "eyJpZCI6MTIxfQ=="
  },
  "traceId": "xxx"
}
```

### 2.6 trace_id 传播

- 客户端请求头 `X-Trace-Id` 缺失时，网关自动生成 UUID
- `traceId` 写入 MDC，贯穿日志、Kafka 消息头、数据库执行记录
- Kafka 消息头必须包含 `X-Trace-Id`
- 异步执行时，`traceId` 通过 `TraceContext` 对象在线程间传播

---

## 3. API 接口详情

### 3.1 Action 定义管理 API

#### 3.1.1 创建 Action 定义

**POST** `/api/v1/action/definitions`

创建一个新的 Action 定义，配置输入/输出 Schema、执行逻辑与补偿逻辑。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | Action 名称，租户内唯一 |
| displayName | string | 是 | 显示名称 |
| description | string | 否 | 描述 |
| category | string | 否 | 分类标签，如 `data`、`integration`、`ai` |
| ontologyRef | object | 否 | 关联的本体引用（conceptId / actionTypeId） |
| ontologyRef.conceptId | string | 否 | 关联的本体概念 ID |
| ontologyRef.actionTypeId | string | 否 | 关联的本体 ActionType ID |
| inputSchema | object | 是 | 输入参数 JSON Schema |
| outputSchema | object | 是 | 输出参数 JSON Schema |
| execution | object | 是 | 执行逻辑配置 |
| execution.type | string | 是 | 执行类型：`HTTP`、`SCRIPT`、`LAMBDA` |
| execution.config | object | 是 | 执行配置，结构取决于 type |
| compensation | object | 否 | 补偿逻辑配置 |
| compensation.enabled | boolean | 否 | 是否启用补偿，默认 false |
| compensation.config | object | 否 | 补偿执行配置，结构同 execution.config |
| timeout | int | 否 | 超时时间（毫秒），默认 30000 |
| retryPolicy | object | 否 | 重试策略 |
| retryPolicy.maxAttempts | int | 否 | 最大重试次数，默认 3 |
| retryPolicy.backoff | string | 否 | 退避策略：`FIXED`、`LINEAR`、`EXPONENTIAL` |
| retryPolicy.interval | int | 否 | 重试间隔（毫秒），默认 1000 |
| tags | string[] | 否 | 标签列表 |

**execution.config 结构**

| type | config 字段 |
|---|---|
| HTTP | `method`、`url`、`headers`、`bodyTemplate`、`authType`、`authConfig` |
| SCRIPT | `engine`（`JS`/`PYTHON`）、`source`、`entryFunction` |
| LAMBDA | `functionName`、`runtime`、`handler`、`packageUrl` |

**请求示例**

```json
{
  "name": "sendNotification",
  "displayName": "发送通知",
  "description": "通过指定渠道发送通知消息",
  "category": "integration",
  "ontologyRef": {
    "conceptId": "concept-notification",
    "actionTypeId": "actiontype-send"
  },
  "inputSchema": {
    "type": "object",
    "properties": {
      "channel": { "type": "string", "enum": ["email", "sms", "webhook"] },
      "recipient": { "type": "string" },
      "message": { "type": "string", "maxLength": 2000 }
    },
    "required": ["channel", "recipient", "message"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "messageId": { "type": "string" },
      "status": { "type": "string", "enum": ["sent", "failed"] }
    }
  },
  "execution": {
    "type": "HTTP",
    "config": {
      "method": "POST",
      "url": "https://notify.internal/api/v1/send",
      "headers": { "Content-Type": "application/json" },
      "bodyTemplate": "{\"channel\":\"${input.channel}\",\"to\":\"${input.recipient}\",\"text\":\"${input.message}\"}",
      "authType": "API_KEY",
      "authConfig": { "headerName": "X-API-Key", "secretRef": "secret-notify-key" }
    }
  },
  "compensation": {
    "enabled": true,
    "config": {
      "method": "POST",
      "url": "https://notify.internal/api/v1/cancel",
      "headers": { "Content-Type": "application/json" },
      "bodyTemplate": "{\"messageId\":\"${output.messageId}\"}"
    }
  },
  "timeout": 10000,
  "retryPolicy": {
    "maxAttempts": 3,
    "backoff": "EXPONENTIAL",
    "interval": 1000
  },
  "tags": ["notification", "messaging"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "actionId": "act-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "name": "sendNotification",
    "displayName": "发送通知",
    "description": "通过指定渠道发送通知消息",
    "category": "integration",
    "version": 1,
    "status": "DRAFT",
    "ontologyRef": {
      "conceptId": "concept-notification",
      "actionTypeId": "actiontype-send"
    },
    "inputSchema": { },
    "outputSchema": { },
    "execution": {
      "type": "HTTP",
      "config": { }
    },
    "compensation": {
      "enabled": true,
      "config": { }
    },
    "timeout": 10000,
    "retryPolicy": {
      "maxAttempts": 3,
      "backoff": "EXPONENTIAL",
      "interval": 1000
    },
    "tags": ["notification", "messaging"],
    "createdBy": "user-001",
    "createdAt": "2026-07-16T08:30:00Z",
    "updatedAt": "2026-07-16T08:30:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| name 为空 | 40001 | 参数校验失败 |
| name 重复 | 40901 | Action 名称已存在 |
| inputSchema 非法 JSON Schema | 42201 | 输入 Schema 格式错误 |
| execution.config 缺失必填字段 | 40001 | 执行配置不完整 |
| 本体引用不存在 | 40401 | ontologyRef 引用的 conceptId 不存在 |

---

#### 3.1.2 查询 Action 定义列表

**GET** `/api/v1/action/definitions`

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | 名称模糊匹配 |
| category | string | 否 | 分类过滤 |
| status | string | 否 | 状态过滤：`DRAFT`、`PUBLISHED`、`DISABLED` |
| tag | string | 否 | 标签过滤，可多次传 |
| ontologyConceptId | string | 否 | 按本体概念过滤 |
| page | int | 否 | 页码，默认 1 |
| pageSize | int | 否 | 每页条数，默认 20 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "actionId": "act-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
        "name": "sendNotification",
        "displayName": "发送通知",
        "category": "integration",
        "version": 1,
        "status": "PUBLISHED",
        "executionType": "HTTP",
        "compensationEnabled": true,
        "tags": ["notification", "messaging"],
        "createdAt": "2026-07-16T08:30:00Z",
        "updatedAt": "2026-07-16T09:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "hasNext": false,
    "nextCursor": null
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| pageSize 超过 100 | 40001 | 参数校验失败 |

---

#### 3.1.3 获取 Action 定义详情

**GET** `/api/v1/action/definitions/{actionId}`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| actionId | string | Action ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "actionId": "act-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "name": "sendNotification",
    "displayName": "发送通知",
    "description": "通过指定渠道发送通知消息",
    "category": "integration",
    "version": 2,
    "status": "PUBLISHED",
    "ontologyRef": {
      "conceptId": "concept-notification",
      "actionTypeId": "actiontype-send"
    },
    "inputSchema": {
      "type": "object",
      "properties": {
        "channel": { "type": "string", "enum": ["email", "sms", "webhook"] },
        "recipient": { "type": "string" },
        "message": { "type": "string", "maxLength": 2000 }
      },
      "required": ["channel", "recipient", "message"]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "messageId": { "type": "string" },
        "status": { "type": "string", "enum": ["sent", "failed"] }
      }
    },
    "execution": {
      "type": "HTTP",
      "config": {
        "method": "POST",
        "url": "https://notify.internal/api/v1/send",
        "headers": { "Content-Type": "application/json" },
        "bodyTemplate": "{\"channel\":\"${input.channel}\",\"to\":\"${input.recipient}\",\"text\":\"${input.message}\"}",
        "authType": "API_KEY",
        "authConfig": { "headerName": "X-API-Key", "secretRef": "secret-notify-key" }
      }
    },
    "compensation": {
      "enabled": true,
      "config": {
        "method": "POST",
        "url": "https://notify.internal/api/v1/cancel",
        "headers": { "Content-Type": "application/json" },
        "bodyTemplate": "{\"messageId\":\"${output.messageId}\"}"
      }
    },
    "timeout": 10000,
    "retryPolicy": {
      "maxAttempts": 3,
      "backoff": "EXPONENTIAL",
      "interval": 1000
    },
    "tags": ["notification", "messaging"],
    "createdBy": "user-001",
    "createdAt": "2026-07-16T08:30:00Z",
    "updatedBy": "user-001",
    "updatedAt": "2026-07-16T09:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| actionId 不存在 | 40401 | Action 定义不存在 |

---

#### 3.1.4 更新 Action 定义

**PUT** `/api/v1/action/definitions/{actionId}`

更新 Action 定义。更新已发布的 Action 会自动创建新版本（version +1），旧版本保留。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| actionId | string | Action ID |

**请求参数（Body）**

字段同 3.1.1 创建请求，所有字段均为可选（部分更新）。以下字段不可更新：`actionId`、`name`、`version`、`createdBy`、`createdAt`。

**请求示例**

```json
{
  "displayName": "发送通知（更新版）",
  "description": "支持多渠道通知发送",
  "timeout": 15000,
  "retryPolicy": {
    "maxAttempts": 5,
    "backoff": "EXPONENTIAL",
    "interval": 2000
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "actionId": "act-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "name": "sendNotification",
    "version": 3,
    "status": "DRAFT",
    "updatedAt": "2026-07-16T10:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| actionId 不存在 | 40401 | Action 定义不存在 |
| Action 状态为 EXECUTING | 40902 | Action 正在执行中，不可更新 |
| inputSchema 非法 | 42201 | 输入 Schema 格式错误 |

---

#### 3.1.5 删除 Action 定义

**DELETE** `/api/v1/action/definitions/{actionId}`

软删除 Action 定义。若 Action 被编排引用，则禁止删除。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| actionId | string | Action ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "actionId": "act-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "deleted": true,
    "deletedAt": "2026-07-16T10:30:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| actionId 不存在 | 40401 | Action 定义不存在 |
| 被编排引用 | 40901 | Action 被服务编排引用，不可删除 |
| 存在执行中实例 | 40902 | 存在执行中的 Action 实例 |

---

#### 3.1.6 发布 / 禁用 Action 定义

**PATCH** `/api/v1/action/definitions/{actionId}/status`

变更 Action 定义状态。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| actionId | string | Action ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | string | 是 | 目标状态：`PUBLISHED`、`DISABLED` |
| reason | string | 否 | 变更原因（禁用时建议填写） |

**请求示例**

```json
{
  "status": "PUBLISHED",
  "reason": "v3 版本经过测试，正式发布"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "actionId": "act-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "status": "PUBLISHED",
    "version": 3,
    "publishedAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| DRAFT 直接禁用 | 40902 | DRAFT 状态不可禁用，需先发布 |
| execution.config 不完整 | 42201 | 发布前校验执行配置完整性失败 |

---

#### 3.1.7 验证 Action 输入 Schema

**POST** `/api/v1/action/definitions/{actionId}/validate-input`

验证输入数据是否符合 Action 的 inputSchema 定义。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| actionId | string | Action ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| input | object | 是 | 待验证的输入数据 |
| version | int | 否 | 指定版本，默认最新 |

**请求示例**

```json
{
  "input": {
    "channel": "email",
    "recipient": "user@example.com",
    "message": "Hello World"
  },
  "version": 3
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "valid": true,
    "errors": []
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**校验失败响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "valid": false,
    "errors": [
      {
        "field": "recipient",
        "rule": "required",
        "message": "字段 recipient 为必填项"
      },
      {
        "field": "message",
        "rule": "maxLength",
        "message": "字段 message 长度超过 2000"
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| actionId 不存在 | 40401 | Action 定义不存在 |

---

#### 3.1.8 获取 Action 版本列表

**GET** `/api/v1/action/definitions/{actionId}/versions`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| actionId | string | Action ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "version": 3,
        "status": "PUBLISHED",
        "changeLog": "更新超时与重试策略",
        "createdBy": "user-001",
        "createdAt": "2026-07-16T10:00:00Z"
      },
      {
        "version": 2,
        "status": "PUBLISHED",
        "changeLog": "新增 webhook 渠道",
        "createdBy": "user-001",
        "createdAt": "2026-07-16T09:00:00Z"
      },
      {
        "version": 1,
        "status": "ARCHIVED",
        "changeLog": "初始版本",
        "createdBy": "user-001",
        "createdAt": "2026-07-16T08:30:00Z"
      }
    ],
    "total": 3
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| actionId 不存在 | 40401 | Action 定义不存在 |

---

### 3.2 服务编排 API

#### 3.2.1 创建服务编排

**POST** `/api/v1/action/orchestrations`

创建一个服务编排定义，将多个 Action 组合为复合服务。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | 编排名称，租户内唯一 |
| displayName | string | 是 | 显示名称 |
| description | string | 否 | 描述 |
| inputSchema | object | 否 | 编排级别的输入 Schema |
| outputSchema | object | 否 | 编排级别的输出 Schema |
| nodes | array | 否 | 节点列表（可后续添加） |
| edges | array | 否 | 边列表（可后续添加） |
| variables | object | 否 | 编排级变量定义 |
| timeout | int | 否 | 编排总超时（毫秒），默认 300000 |
| retryPolicy | object | 否 | 重试策略，同 Action 定义 |

**请求示例**

```json
{
  "name": "orderFulfillment",
  "displayName": "订单履约流程",
  "description": "从下单到发货的完整编排",
  "inputSchema": {
    "type": "object",
    "properties": {
      "orderId": { "type": "string" },
      "customerId": { "type": "string" }
    },
    "required": ["orderId", "customerId"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "shipmentId": { "type": "string" },
      "trackingNo": { "type": "string" }
    }
  },
  "nodes": [
    {
      "nodeId": "node-validate",
      "type": "ACTION",
      "actionRef": "act-validate-order",
      "actionVersion": 2,
      "inputMapping": {
        "orderId": "${orchestration.input.orderId}"
      }
    },
    {
      "nodeId": "node-inventory",
      "type": "ACTION",
      "actionRef": "act-check-inventory",
      "actionVersion": 1,
      "inputMapping": {
        "orderId": "${orchestration.input.orderId}"
      }
    },
    {
      "nodeId": "node-payment",
      "type": "ACTION",
      "actionRef": "act-process-payment",
      "actionVersion": 3,
      "inputMapping": {
        "orderId": "${orchestration.input.orderId}",
        "customerId": "${orchestration.input.customerId}"
      }
    },
    {
      "nodeId": "node-ship",
      "type": "ACTION",
      "actionRef": "act-create-shipment",
      "actionVersion": 1,
      "inputMapping": {
        "orderId": "${orchestration.input.orderId}"
      }
    }
  ],
  "edges": [
    { "from": "node-validate", "to": "node-inventory" },
    { "from": "node-inventory", "to": "node-payment", "condition": "${node-inventory.output.inStock == true}" },
    { "from": "node-payment", "to": "node-ship", "condition": "${node-payment.output.status == 'success'}" }
  ],
  "variables": {
    "discountRate": { "type": "number", "default": 0.1 }
  },
  "timeout": 600000
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "orchestrationId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "name": "orderFulfillment",
    "displayName": "订单履约流程",
    "version": 1,
    "status": "DRAFT",
    "nodeCount": 4,
    "edgeCount": 3,
    "createdAt": "2026-07-16T12:00:00Z",
    "updatedAt": "2026-07-16T12:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| name 重复 | 40901 | 编排名称已存在 |
| 引用的 actionRef 不存在 | 40401 | 引用的 Action 不存在 |
| 边引用的 nodeId 不存在 | 42201 | 边的 from/to 节点不存在 |
| 存在环路 | 42201 | 编排图中检测到环路 |

---

#### 3.2.2 获取编排详情

**GET** `/api/v1/action/orchestrations/{orchestrationId}`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| orchestrationId | string | 编排 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "orchestrationId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "name": "orderFulfillment",
    "displayName": "订单履约流程",
    "description": "从下单到发货的完整编排",
    "version": 1,
    "status": "PUBLISHED",
    "inputSchema": { },
    "outputSchema": { },
    "nodes": [
      {
        "nodeId": "node-validate",
        "type": "ACTION",
        "actionRef": "act-validate-order",
        "actionVersion": 2,
        "inputMapping": { },
        "retryPolicy": null,
        "timeout": null
      }
    ],
    "edges": [
      {
        "edgeId": "edge-001",
        "from": "node-validate",
        "to": "node-inventory",
        "condition": null,
        "priority": 0
      }
    ],
    "variables": { },
    "timeout": 600000,
    "retryPolicy": null,
    "createdBy": "user-001",
    "createdAt": "2026-07-16T12:00:00Z",
    "updatedAt": "2026-07-16T12:30:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| orchestrationId 不存在 | 40401 | 编排不存在 |

---

#### 3.2.3 更新编排

**PUT** `/api/v1/action/orchestrations/{orchestrationId}`

更新编排定义。已发布的编排更新后自动创建新版本。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| orchestrationId | string | 编排 ID |

**请求参数（Body）**

字段同创建接口（3.2.1），所有字段可选（部分更新）。

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "orchestrationId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "name": "orderFulfillment",
    "version": 2,
    "status": "DRAFT",
    "updatedAt": "2026-07-16T13:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| orchestrationId 不存在 | 40401 | 编排不存在 |
| 编排正在执行 | 40902 | 存在执行中的编排实例 |

---

#### 3.2.4 添加编排节点

**POST** `/api/v1/action/orchestrations/{orchestrationId}/nodes`

向编排中添加单个节点。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| orchestrationId | string | 编排 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| nodeId | string | 是 | 节点 ID，编排内唯一 |
| type | string | 是 | 节点类型：`ACTION`、`WORKFLOW`、`RULE`、`PARALLEL`、`CONDITION`、`LOOP`、`DELAY` |
| actionRef | string | 条件必填 | 当 type=ACTION 时，引用的 actionId |
| actionVersion | int | 否 | 指定 Action 版本 |
| workflowRef | string | 条件必填 | 当 type=WORKFLOW 时，引用的 TECH-WFE 工作流 ID |
| ruleRef | string | 条件必填 | 当 type=RULE 时，引用的 TECH-RULE 规则集 ID |
| inputMapping | object | 否 | 输入映射，支持变量表达式 |
| parallelBranches | array | 条件必填 | 当 type=PARALLEL 时，并行分支配置 |
| condition | object | 条件必填 | 当 type=CONDITION 时，条件配置 |
| loop | object | 条件必填 | 当 type=LOOP 时，循环配置 |
| delay | int | 条件必填 | 当 type=DELAY 时，延迟毫秒数 |
| retryPolicy | object | 否 | 节点级重试策略 |
| timeout | int | 否 | 节点级超时（毫秒） |

**PARALLEL 节点 parallelBranches 结构**

| 字段 | 类型 | 说明 |
|---|---|---|
| branchId | string | 分支 ID |
| nodes | array | 分支内节点列表 |
| joinStrategy | string | 汇合策略：`ALL`（全部完成）、`ANY`（任一完成）、`RACE`（首个完成） |

**CONDITION 节点 condition 结构**

| 字段 | 类型 | 说明 |
|---|---|---|
| expression | string | 条件表达式 |
| trueBranch | array | 条件为真时的节点列表 |
| falseBranch | array | 条件为假时的节点列表 |

**LOOP 节点 loop 结构**

| 字段 | 类型 | 说明 |
|---|---|---|
| type | string | 循环类型：`FOR`、`WHILE`、`FOREACH` |
| iterate | string | FOREACH 迭代源表达式 |
| condition | string | WHILE 条件表达式 |
| count | int | FOR 循环次数 |
| body | array | 循环体内节点列表 |
| maxIterations | int | 最大迭代次数，默认 1000 |

**请求示例（添加并行节点）**

```json
{
  "nodeId": "node-parallel-check",
  "type": "PARALLEL",
  "parallelBranches": [
    {
      "branchId": "branch-inventory",
      "nodes": [
        {
          "nodeId": "node-check-inventory",
          "type": "ACTION",
          "actionRef": "act-check-inventory",
          "inputMapping": {
            "orderId": "${orchestration.input.orderId}"
          }
        }
      ],
      "joinStrategy": "ALL"
    },
    {
      "branchId": "branch-credit",
      "nodes": [
        {
          "nodeId": "node-check-credit",
          "type": "ACTION",
          "actionRef": "act-check-credit",
          "inputMapping": {
            "customerId": "${orchestration.input.customerId}"
          }
        }
      ],
      "joinStrategy": "ALL"
    }
  ],
  "timeout": 30000
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "orchestrationId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "nodeId": "node-parallel-check",
    "type": "PARALLEL",
    "addedAt": "2026-07-16T13:30:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| nodeId 重复 | 40901 | 节点 ID 已存在 |
| actionRef 不存在 | 40401 | 引用的 Action 不存在 |
| type 与配置不匹配 | 42201 | 节点类型与配置字段不匹配 |
| 编排已发布 | 40902 | 已发布的编排不可直接修改，需创建新版本 |

---

#### 3.2.5 配置节点间流转

**POST** `/api/v1/action/orchestrations/{orchestrationId}/edges`

配置节点之间的流转关系，包括条件分支。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| orchestrationId | string | 编排 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| edges | array | 是 | 边列表 |

**edges 数组元素**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| from | string | 是 | 源节点 ID |
| to | string | 是 | 目标节点 ID |
| condition | string | 否 | 条件表达式，为空表示无条件流转 |
| priority | int | 否 | 优先级，同源多边时按优先级评估，默认 0 |

**请求示例**

```json
{
  "edges": [
    {
      "from": "node-validate",
      "to": "node-parallel-check",
      "condition": null,
      "priority": 0
    },
    {
      "from": "node-parallel-check",
      "to": "node-payment",
      "condition": "${node-parallel-check.branch-inventory.output.inStock == true && node-parallel-check.branch-credit.output.score > 600}",
      "priority": 0
    },
    {
      "from": "node-parallel-check",
      "to": "node-reject",
      "condition": "${node-parallel-check.branch-inventory.output.inStock == false}",
      "priority": 1
    }
  ]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "orchestrationId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "addedEdges": 3,
    "totalEdges": 6,
    "updatedAt": "2026-07-16T14:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| from/to 节点不存在 | 42201 | 边引用的节点不存在 |
| 添加后产生环路 | 42201 | 检测到环路 |
| 编排已发布 | 40902 | 已发布编排不可修改 |

---

#### 3.2.6 校验编排

**POST** `/api/v1/action/orchestrations/{orchestrationId}/validate`

校验编排定义的完整性，包括节点引用、环路检测、Schema 映射。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| orchestrationId | string | 编排 ID |

**响应示例（校验通过）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "valid": true,
    "errors": [],
    "warnings": [
      {
        "nodeId": "node-ship",
        "message": "节点未配置补偿逻辑，编排失败时可能无法回滚"
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**响应示例（校验失败）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "valid": false,
    "errors": [
      {
        "type": "CYCLE_DETECTED",
        "message": "检测到环路：node-validate -> node-inventory -> node-validate",
        "path": ["node-validate", "node-inventory", "node-validate"]
      },
      {
        "type": "UNREACHABLE_NODE",
        "nodeId": "node-reject",
        "message": "节点 node-reject 不可达，没有入边"
      },
      {
        "type": "SCHEMA_MISMATCH",
        "nodeId": "node-payment",
        "field": "inputMapping.customerId",
        "message": "映射字段 customerId 在上游输出 Schema 中不存在"
      }
    ],
    "warnings": []
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| orchestrationId 不存在 | 40401 | 编排不存在 |

---

#### 3.2.7 发布编排

**PATCH** `/api/v1/action/orchestrations/{orchestrationId}/status`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| orchestrationId | string | 编排 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | string | 是 | 目标状态：`PUBLISHED`、`DISABLED` |
| reason | string | 否 | 变更原因 |

**请求示例**

```json
{
  "status": "PUBLISHED",
  "reason": "v2 经过 UAT 验证，正式发布"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "orchestrationId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "status": "PUBLISHED",
    "version": 2,
    "publishedAt": "2026-07-16T15:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| 编排校验未通过 | 42201 | 存在未解决的校验错误 |
| 编排无节点 | 42201 | 编排没有定义任何节点 |

---

### 3.3 触发规则 API

#### 3.3.1 创建触发规则

**POST** `/api/v1/action/triggers`

为 Action 或编排创建触发规则。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | 触发规则名称 |
| displayName | string | 是 | 显示名称 |
| description | string | 否 | 描述 |
| targetType | string | 是 | 触发目标类型：`ACTION`、`ORCHESTRATION` |
| targetId | string | 是 | 目标 ID（actionId 或 orchestrationId） |
| targetVersion | int | 否 | 目标版本，默认最新 |
| triggerType | string | 是 | 触发类型：`EVENT`、`CRON`、`MANUAL` |
| eventConfig | object | 条件必填 | 当 triggerType=EVENT 时 |
| cronConfig | object | 条件必填 | 当 triggerType=CRON 时 |
| inputMapping | object | 否 | 触发时的输入映射，将事件/上下文映射为目标输入 |
| enabled | boolean | 否 | 是否启用，默认 true |

**eventConfig 结构**

| 字段 | 类型 | 说明 |
|---|---|---|
| topic | string | Kafka Topic 名称 |
| eventType | string | 事件类型过滤 |
| filter | string | 事件过滤条件表达式 |
| consumerGroup | string | 消费者组，默认自动生成 |

**cronConfig 结构**

| 字段 | 类型 | 说明 |
|---|---|---|
| expression | string | Cron 表达式（5 字段 Unix 格式） |
| timezone | string | 时区，如 `Asia/Shanghai` |
| startDate | string | 生效起始时间（ISO 8601） |
| endDate | string | 生效结束时间（ISO 8601） |

**请求示例（事件触发）**

```json
{
  "name": "orderCreatedTrigger",
  "displayName": "订单创建触发履约",
  "description": "监听订单创建事件，触发订单履约编排",
  "targetType": "ORCHESTRATION",
  "targetId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
  "triggerType": "EVENT",
  "eventConfig": {
    "topic": "metaplatform.order.events",
    "eventType": "ORDER_CREATED",
    "filter": "${event.payload.amount > 100}",
    "consumerGroup": "action-engine-order-fulfillment"
  },
  "inputMapping": {
    "orderId": "${event.payload.orderId}",
    "customerId": "${event.payload.customerId}"
  },
  "enabled": true
}
```

**请求示例（定时触发）**

```json
{
  "name": "dailyReportTrigger",
  "displayName": "每日报告生成",
  "targetType": "ACTION",
  "targetId": "act-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
  "triggerType": "CRON",
  "cronConfig": {
    "expression": "0 8 * * *",
    "timezone": "Asia/Shanghai",
    "startDate": "2026-07-16T00:00:00Z"
  },
  "inputMapping": {
    "reportDate": "${context.executionDate}"
  },
  "enabled": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "triggerId": "trg-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "orderCreatedTrigger",
    "displayName": "订单创建触发履约",
    "triggerType": "EVENT",
    "targetType": "ORCHESTRATION",
    "targetId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "status": "ACTIVE",
    "enabled": true,
    "createdAt": "2026-07-16T16:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| targetId 不存在 | 40401 | 目标 Action/编排不存在 |
| targetId 状态非 PUBLISHED | 40902 | 目标未发布 |
| Cron 表达式非法 | 40001 | Cron 表达式格式错误 |
| topic 无权限 | 40301 | 无权限消费该 Kafka Topic |

---

#### 3.3.2 查询触发规则列表

**GET** `/api/v1/action/triggers`

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| targetType | string | 否 | 目标类型过滤 |
| targetId | string | 否 | 目标 ID 过滤 |
| triggerType | string | 否 | 触发类型过滤 |
| enabled | boolean | 否 | 启用状态过滤 |
| page | int | 否 | 页码 |
| pageSize | int | 否 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "triggerId": "trg-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "orderCreatedTrigger",
        "displayName": "订单创建触发履约",
        "triggerType": "EVENT",
        "targetType": "ORCHESTRATION",
        "targetId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
        "targetName": "orderFulfillment",
        "enabled": true,
        "status": "ACTIVE",
        "lastTriggeredAt": "2026-07-16T16:30:00Z",
        "createdAt": "2026-07-16T16:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "hasNext": false,
    "nextCursor": null
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

无特殊错误场景。

---

#### 3.3.3 更新触发规则

**PUT** `/api/v1/action/triggers/{triggerId}`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| triggerId | string | 触发规则 ID |

**请求参数（Body）**

字段同创建接口（3.3.1），所有字段可选（部分更新）。

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "triggerId": "trg-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "orderCreatedTrigger",
    "enabled": true,
    "updatedAt": "2026-07-16T16:30:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| triggerId 不存在 | 40401 | 触发规则不存在 |
| 更新时 targetId 不存在 | 40401 | 目标 Action/编排不存在 |

---

#### 3.3.4 启用 / 禁用触发规则

**PATCH** `/api/v1/action/triggers/{triggerId}/toggle`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| triggerId | string | 触发规则 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| enabled | boolean | 是 | 启用或禁用 |

**请求示例**

```json
{
  "enabled": false
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "triggerId": "trg-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "enabled": false,
    "status": "INACTIVE",
    "updatedAt": "2026-07-16T17:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| triggerId 不存在 | 40401 | 触发规则不存在 |

---

#### 3.3.5 删除触发规则

**DELETE** `/api/v1/action/triggers/{triggerId}`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| triggerId | string | 触发规则 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "triggerId": "trg-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "deleted": true,
    "deletedAt": "2026-07-16T17:30:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| triggerId 不存在 | 40401 | 触发规则不存在 |

---

#### 3.3.6 手动触发

**POST** `/api/v1/action/triggers/{triggerId}/fire`

手动触发一个已配置的触发规则（不论 triggerType），常用于测试或补偿。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| triggerId | string | 触发规则 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| input | object | 否 | 手动传入的输入数据，覆盖 inputMapping |
| async | boolean | 否 | 是否异步执行，默认 true |
| priority | string | 否 | 执行优先级：`LOW`、`NORMAL`、`HIGH`，默认 NORMAL |

**请求示例**

```json
{
  "input": {
    "orderId": "ORD-2026-0001",
    "customerId": "CUS-001"
  },
  "async": true,
  "priority": "HIGH"
}
```

**响应示例（异步）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-b1c2d3e4-f5a6-7890-abcd-ef1234567890",
    "status": "PENDING",
    "triggerId": "trg-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "targetType": "ORCHESTRATION",
    "targetId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "submittedAt": "2026-07-16T18:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**响应示例（同步）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-b1c2d3e4-f5a6-7890-abcd-ef1234567890",
    "status": "COMPLETED",
    "output": {
      "shipmentId": "SHP-2026-0001",
      "trackingNo": "TRK-12345678"
    },
    "duration": 3200,
    "triggerId": "trg-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "targetType": "ORCHESTRATION",
    "targetId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "startedAt": "2026-07-16T18:00:00Z",
    "completedAt": "2026-07-16T18:00:03Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| triggerId 不存在 | 40401 | 触发规则不存在 |
| 触发规则已禁用 | 40902 | 触发规则未启用 |
| 目标 Action/编排未发布 | 40902 | 目标处于 DRAFT/DISABLED 状态 |
| 输入校验失败 | 42201 | input 不符合目标 inputSchema |

---

### 3.4 执行引擎 API

#### 3.4.1 执行 Action

**POST** `/api/v1/action/definitions/{actionId}/execute`

直接执行一个 Action 定义。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| actionId | string | Action ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| input | object | 是 | Action 输入参数，需符合 inputSchema |
| version | int | 否 | 指定执行版本，默认最新 PUBLISHED 版本 |
| async | boolean | 否 | 是否异步执行，默认 false |
| timeout | int | 否 | 覆盖 Action 定义的超时时间（毫秒） |
| executionContext | object | 否 | 执行上下文，透传给下游 |

**请求示例**

```json
{
  "input": {
    "channel": "email",
    "recipient": "user@example.com",
    "message": "您的订单已确认"
  },
  "async": false,
  "timeout": 15000
}
```

**响应示例（同步成功）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-c1d2e3f4-a5b6-7890-abcd-ef1234567890",
    "actionId": "act-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "version": 3,
    "status": "COMPLETED",
    "input": {
      "channel": "email",
      "recipient": "user@example.com",
      "message": "您的订单已确认"
    },
    "output": {
      "messageId": "msg-2026-0001",
      "status": "sent"
    },
    "startedAt": "2026-07-16T19:00:00Z",
    "completedAt": "2026-07-16T19:00:02Z",
    "duration": 2100,
    "retryCount": 0
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**响应示例（异步）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-c1d2e3f4-a5b6-7890-abcd-ef1234567890",
    "actionId": "act-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "version": 3,
    "status": "PENDING",
    "submittedAt": "2026-07-16T19:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| actionId 不存在 | 40401 | Action 定义不存在 |
| Action 未发布 | 40902 | Action 状态为 DRAFT/DISABLED |
| input 校验失败 | 42201 | 输入不符合 inputSchema |
| 执行超时 | 50002 | Action 执行超过 timeout |
| 执行失败 | 50003 | HTTP/Script/Lambda 执行错误 |
| 超过重试上限 | 50003 | 重试 maxAttempts 后仍失败 |

---

#### 3.4.2 执行编排

**POST** `/api/v1/action/orchestrations/{orchestrationId}/execute`

执行一个编排定义。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| orchestrationId | string | 编排 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| input | object | 否 | 编排输入参数，需符合编排 inputSchema |
| version | int | 否 | 指定执行版本 |
| async | boolean | 否 | 是否异步执行，默认 true（编排通常耗时较长） |
| executionContext | object | 否 | 执行上下文 |
| dryRun | boolean | 否 | 试运行模式，只校验不实际执行，默认 false |

**请求示例**

```json
{
  "input": {
    "orderId": "ORD-2026-0001",
    "customerId": "CUS-001"
  },
  "async": true,
  "dryRun": false
}
```

**响应示例（异步）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-d1e2f3a4-b5c6-7890-abcd-ef1234567890",
    "orchestrationId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "version": 2,
    "status": "RUNNING",
    "input": {
      "orderId": "ORD-2026-0001",
      "customerId": "CUS-001"
    },
    "nodeExecutions": [
      {
        "nodeId": "node-validate",
        "status": "COMPLETED",
        "startedAt": "2026-07-16T20:00:00Z",
        "completedAt": "2026-07-16T20:00:01Z",
        "duration": 800
      },
      {
        "nodeId": "node-parallel-check",
        "status": "RUNNING",
        "startedAt": "2026-07-16T20:00:01Z",
        "completedAt": null,
        "duration": null
      }
    ],
    "startedAt": "2026-07-16T20:00:00Z",
    "estimatedCompletion": "2026-07-16T20:00:30Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**响应示例（dryRun）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": null,
    "orchestrationId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "dryRun": true,
    "valid": true,
    "executionPlan": [
      { "step": 1, "nodeId": "node-validate", "type": "ACTION" },
      { "step": 2, "nodeId": "node-parallel-check", "type": "PARALLEL", "branches": 2 },
      { "step": 3, "nodeId": "node-payment", "type": "ACTION", "condition": "${...}" },
      { "step": 4, "nodeId": "node-ship", "type": "ACTION", "condition": "${...}" }
    ],
    "warnings": []
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| orchestrationId 不存在 | 40401 | 编排不存在 |
| 编排未发布 | 40902 | 编排状态非 PUBLISHED |
| dryRun 校验失败 | 42201 | 试运行校验未通过 |
| 编排总超时 | 50002 | 编排执行超过总超时时间 |

---

#### 3.4.3 查询执行状态

**GET** `/api/v1/action/executions/{executionId}`

查询 Action 或编排的执行状态。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| executionId | string | 执行 ID |

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| includeNodeDetails | boolean | 否 | 是否包含编排节点执行详情，默认 false |
| includeLogs | boolean | 否 | 是否包含执行日志，默认 false |

**响应示例（Action 执行）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-c1d2e3f4-a5b6-7890-abcd-ef1234567890",
    "executionType": "ACTION",
    "targetId": "act-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "targetName": "sendNotification",
    "version": 3,
    "status": "COMPLETED",
    "input": {
      "channel": "email",
      "recipient": "user@example.com",
      "message": "您的订单已确认"
    },
    "output": {
      "messageId": "msg-2026-0001",
      "status": "sent"
    },
    "error": null,
    "retryCount": 0,
    "startedAt": "2026-07-16T19:00:00Z",
    "completedAt": "2026-07-16T19:00:02Z",
    "duration": 2100,
    "triggerSource": "MANUAL",
    "triggerId": null,
    "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**响应示例（编排执行，includeNodeDetails=true）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-d1e2f3a4-b5c6-7890-abcd-ef1234567890",
    "executionType": "ORCHESTRATION",
    "targetId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "targetName": "orderFulfillment",
    "version": 2,
    "status": "RUNNING",
    "input": {
      "orderId": "ORD-2026-0001",
      "customerId": "CUS-001"
    },
    "output": null,
    "error": null,
    "progress": {
      "totalNodes": 4,
      "completedNodes": 2,
      "runningNodes": 1,
      "pendingNodes": 1,
      "failedNodes": 0,
      "percentage": 50
    },
    "nodeExecutions": [
      {
        "nodeId": "node-validate",
        "nodeType": "ACTION",
        "actionRef": "act-validate-order",
        "status": "COMPLETED",
        "input": { "orderId": "ORD-2026-0001" },
        "output": { "valid": true },
        "startedAt": "2026-07-16T20:00:00Z",
        "completedAt": "2026-07-16T20:00:01Z",
        "duration": 800,
        "retryCount": 0
      },
      {
        "nodeId": "node-parallel-check",
        "nodeType": "PARALLEL",
        "status": "RUNNING",
        "branches": [
          {
            "branchId": "branch-inventory",
            "nodeId": "node-check-inventory",
            "status": "COMPLETED",
            "output": { "inStock": true },
            "duration": 1200
          },
          {
            "branchId": "branch-credit",
            "nodeId": "node-check-credit",
            "status": "RUNNING",
            "startedAt": "2026-07-16T20:00:01Z",
            "duration": null
          }
        ],
        "startedAt": "2026-07-16T20:00:01Z",
        "completedAt": null,
        "duration": null
      }
    ],
    "startedAt": "2026-07-16T20:00:00Z",
    "completedAt": null,
    "duration": null,
    "triggerSource": "EVENT",
    "triggerId": "trg-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**执行状态枚举**

| 状态 | 说明 |
|---|---|
| PENDING | 已提交，等待调度 |
| RUNNING | 执行中 |
| COMPLETED | 执行成功 |
| FAILED | 执行失败 |
| TIMEOUT | 执行超时 |
| CANCELLED | 已取消 |
| COMPENSATING | 补偿执行中 |
| COMPENSATED | 补偿完成 |

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| executionId 不存在 | 40401 | 执行记录不存在 |

---

#### 3.4.4 取消执行

**POST** `/api/v1/action/executions/{executionId}/cancel`

取消正在执行的 Action 或编排。对于编排，将取消所有运行中的节点，并触发已配置的补偿逻辑。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| executionId | string | 执行 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reason | string | 否 | 取消原因 |
| compensate | boolean | 否 | 是否触发补偿，默认 true |

**请求示例**

```json
{
  "reason": "业务方手动取消",
  "compensate": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-d1e2f3a4-b5c6-7890-abcd-ef1234567890",
    "previousStatus": "RUNNING",
    "currentStatus": "COMPENSATING",
    "cancelReason": "业务方手动取消",
    "compensationTriggered": true,
    "cancelledAt": "2026-07-16T20:05:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| executionId 不存在 | 40401 | 执行记录不存在 |
| 执行已结束 | 40902 | 执行已 COMPLETED/FAILED，不可取消 |

---

#### 3.4.5 重试执行

**POST** `/api/v1/action/executions/{executionId}/retry`

对失败的执行进行重试。可选择从头开始或从失败节点恢复。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| executionId | string | 原执行 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| strategy | string | 否 | 重试策略：`FROM_START`（从头）、`FROM_FAILED`（从失败节点恢复），默认 FROM_FAILED |
| input | object | 否 | 覆盖输入参数（仅 FROM_START 有效） |
| reason | string | 否 | 重试原因 |

**请求示例**

```json
{
  "strategy": "FROM_FAILED",
  "reason": "下游服务恢复后重试"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "newExecutionId": "exec-e1f2a3b4-c5d6-7890-abcd-ef1234567890",
    "originalExecutionId": "exec-d1e2f3a4-b5c6-7890-abcd-ef1234567890",
    "strategy": "FROM_FAILED",
    "recoveryPoint": "node-payment",
    "status": "RUNNING",
    "startedAt": "2026-07-16T20:10:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| executionId 不存在 | 40401 | 执行记录不存在 |
| 原执行未失败 | 40902 | 原执行状态非 FAILED/TIMEOUT，不可重试 |
| FROM_FAILED 无可恢复点 | 42201 | 无法确定恢复节点 |

---

### 3.5 执行监控 API

#### 3.5.1 执行记录列表

**GET** `/api/v1/action/executions`

查询执行记录列表，支持多维度过滤。

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| executionType | string | 否 | ACTION / ORCHESTRATION |
| targetId | string | 否 | 目标 ID 过滤 |
| status | string | 否 | 状态过滤 |
| triggerSource | string | 否 | 触发来源：`MANUAL`、`EVENT`、`CRON` |
| triggerId | string | 否 | 触发规则 ID |
| startedAfter | string | 否 | 开始时间下限（ISO 8601） |
| startedBefore | string | 否 | 开始时间上限（ISO 8601） |
| traceId | string | 否 | 按 traceId 过滤 |
| page | int | 否 | 页码 |
| pageSize | int | 否 | 每页条数 |
| sortBy | string | 否 | 排序字段：`startedAt`、`duration`，默认 startedAt |
| sortOrder | string | 否 | 排序方向：`ASC`、`DESC`，默认 DESC |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "executionId": "exec-d1e2f3a4-b5c6-7890-abcd-ef1234567890",
        "executionType": "ORCHESTRATION",
        "targetId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
        "targetName": "orderFulfillment",
        "status": "COMPLETED",
        "triggerSource": "EVENT",
        "triggerId": "trg-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "startedAt": "2026-07-16T20:00:00Z",
        "completedAt": "2026-07-16T20:00:25Z",
        "duration": 25000,
        "retryCount": 0
      },
      {
        "executionId": "exec-c1d2e3f4-a5b6-7890-abcd-ef1234567890",
        "executionType": "ACTION",
        "targetId": "act-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
        "targetName": "sendNotification",
        "status": "FAILED",
        "triggerSource": "MANUAL",
        "triggerId": null,
        "startedAt": "2026-07-16T19:00:00Z",
        "completedAt": "2026-07-16T19:00:10Z",
        "duration": 10000,
        "retryCount": 3,
        "errorMessage": "HTTP 503: 下游服务不可用"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20,
    "hasNext": false,
    "nextCursor": null
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| 时间范围非法 | 40001 | startedAfter > startedBefore |

---

#### 3.5.2 执行详情

**GET** `/api/v1/action/executions/{executionId}/details`

获取执行的完整详情，包括输入输出、节点执行详情、日志。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| executionId | string | 执行 ID |

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| includeLogs | boolean | 否 | 是否包含执行日志，默认 true |
| includeCompensation | boolean | 否 | 是否包含补偿执行详情，默认 true |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-d1e2f3a4-b5c6-7890-abcd-ef1234567890",
    "executionType": "ORCHESTRATION",
    "targetId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "targetName": "orderFulfillment",
    "version": 2,
    "status": "COMPLETED",
    "input": {
      "orderId": "ORD-2026-0001",
      "customerId": "CUS-001"
    },
    "output": {
      "shipmentId": "SHP-2026-0001",
      "trackingNo": "TRK-12345678"
    },
    "error": null,
    "progress": {
      "totalNodes": 4,
      "completedNodes": 4,
      "runningNodes": 0,
      "pendingNodes": 0,
      "failedNodes": 0,
      "percentage": 100
    },
    "nodeExecutions": [
      {
        "nodeId": "node-validate",
        "nodeType": "ACTION",
        "actionRef": "act-validate-order",
        "actionVersion": 2,
        "status": "COMPLETED",
        "input": { "orderId": "ORD-2026-0001" },
        "output": { "valid": true, "customerName": "张三" },
        "retryCount": 0,
        "startedAt": "2026-07-16T20:00:00Z",
        "completedAt": "2026-07-16T20:00:01Z",
        "duration": 800
      },
      {
        "nodeId": "node-parallel-check",
        "nodeType": "PARALLEL",
        "status": "COMPLETED",
        "branches": [
          {
            "branchId": "branch-inventory",
            "nodeId": "node-check-inventory",
            "status": "COMPLETED",
            "output": { "inStock": true, "warehouse": "WH-BJ-01" },
            "duration": 1200
          },
          {
            "branchId": "branch-credit",
            "nodeId": "node-check-credit",
            "status": "COMPLETED",
            "output": { "score": 750, "approved": true },
            "duration": 1500
          }
        ],
        "joinStrategy": "ALL",
        "startedAt": "2026-07-16T20:00:01Z",
        "completedAt": "2026-07-16T20:00:02Z",
        "duration": 1500
      },
      {
        "nodeId": "node-payment",
        "nodeType": "ACTION",
        "actionRef": "act-process-payment",
        "status": "COMPLETED",
        "input": { "orderId": "ORD-2026-0001", "customerId": "CUS-001" },
        "output": { "status": "success", "transactionId": "TXN-2026-0001" },
        "retryCount": 1,
        "startedAt": "2026-07-16T20:00:02Z",
        "completedAt": "2026-07-16T20:00:10Z",
        "duration": 8000
      },
      {
        "nodeId": "node-ship",
        "nodeType": "ACTION",
        "actionRef": "act-create-shipment",
        "status": "COMPLETED",
        "input": { "orderId": "ORD-2026-0001" },
        "output": { "shipmentId": "SHP-2026-0001", "trackingNo": "TRK-12345678" },
        "retryCount": 0,
        "startedAt": "2026-07-16T20:00:10Z",
        "completedAt": "2026-07-16T20:00:25Z",
        "duration": 15000
      }
    ],
    "logs": [
      {
        "timestamp": "2026-07-16T20:00:00Z",
        "level": "INFO",
        "nodeId": "node-validate",
        "message": "Action act-validate-order v2 执行开始"
      },
      {
        "timestamp": "2026-07-16T20:00:01Z",
        "level": "INFO",
        "nodeId": "node-validate",
        "message": "Action 执行完成，输出: {valid: true}"
      },
      {
        "timestamp": "2026-07-16T20:00:02Z",
        "level": "WARN",
        "nodeId": "node-payment",
        "message": "第 1 次执行失败: Connection timeout，准备重试"
      },
      {
        "timestamp": "2026-07-16T20:00:03Z",
        "level": "INFO",
        "nodeId": "node-payment",
        "message": "第 2 次执行开始（重试）"
      },
      {
        "timestamp": "2026-07-16T20:00:10Z",
        "level": "INFO",
        "nodeId": "node-payment",
        "message": "Action 执行完成，输出: {status: success}"
      }
    ],
    "compensation": null,
    "triggerSource": "EVENT",
    "triggerId": "trg-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "startedAt": "2026-07-16T20:00:00Z",
    "completedAt": "2026-07-16T20:00:25Z",
    "duration": 25000,
    "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| executionId 不存在 | 40401 | 执行记录不存在 |

---

#### 3.5.3 耗时统计

**GET** `/api/v1/action/executions/statistics`

获取执行的统计信息，包括平均耗时、成功率、执行次数等。

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| targetType | string | 否 | ACTION / ORCHESTRATION |
| targetId | string | 否 | 目标 ID |
| groupBy | string | 否 | 分组维度：`target`、`day`、`hour`，默认 target |
| startedAfter | string | 是 | 统计开始时间 |
| startedBefore | string | 是 | 统计结束时间 |

**请求示例**

```
GET /api/v1/action/executions/statistics?targetType=ORCHESTRATION&groupBy=target&startedAfter=2026-07-01T00:00:00Z&startedBefore=2026-07-16T23:59:59Z
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "period": {
      "from": "2026-07-01T00:00:00Z",
      "to": "2026-07-16T23:59:59Z"
    },
    "summary": {
      "totalExecutions": 1250,
      "completed": 1180,
      "failed": 50,
      "timeout": 15,
      "cancelled": 5,
      "successRate": 94.4,
      "avgDuration": 18200,
      "p50Duration": 15000,
      "p90Duration": 32000,
      "p99Duration": 55000
    },
    "groups": [
      {
        "targetId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
        "targetName": "orderFulfillment",
        "totalExecutions": 800,
        "completed": 760,
        "failed": 30,
        "timeout": 10,
        "cancelled": 0,
        "successRate": 95.0,
        "avgDuration": 22000,
        "p50Duration": 20000,
        "p90Duration": 35000,
        "p99Duration": 60000
      },
      {
        "targetId": "orch-xyz123",
        "targetName": "invoiceProcess",
        "totalExecutions": 450,
        "completed": 420,
        "failed": 20,
        "timeout": 5,
        "cancelled": 5,
        "successRate": 93.3,
        "avgDuration": 12500,
        "p50Duration": 10000,
        "p90Duration": 25000,
        "p99Duration": 45000
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| 时间范围缺失 | 40001 | startedAfter / startedBefore 为必填 |
| 时间范围超过 90 天 | 40001 | 统计时间范围不可超过 90 天 |

---

#### 3.5.4 错误追踪

**GET** `/api/v1/action/executions/{executionId}/errors`

获取执行过程中的错误详情，包括错误堆栈、重试历史。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| executionId | string | 执行 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-c1d2e3f4-a5b6-7890-abcd-ef1234567890",
    "status": "FAILED",
    "targetId": "act-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "targetName": "sendNotification",
    "primaryError": {
      "errorCode": "50003",
      "errorType": "HTTP_EXECUTION_ERROR",
      "message": "HTTP 503: Service Unavailable",
      "nodeId": null,
      "timestamp": "2026-07-16T19:00:10Z",
      "stackTrace": "com.metaplatform.action.exception.HttpExecutionException: HTTP 503\n\tat com.metaplatform.action.executor.HttpExecutor.execute(HttpExecutor.java:85)\n\tat com.metaplatform.action.engine.ActionEngine.doExecute(ActionEngine.java:120)\n\t..."
    },
    "retryHistory": [
      {
        "attempt": 1,
        "startedAt": "2026-07-16T19:00:00Z",
        "failedAt": "2026-07-16T19:00:03Z",
        "duration": 3000,
        "error": {
          "errorType": "HTTP_EXECUTION_ERROR",
          "message": "HTTP 503: Service Unavailable"
        }
      },
      {
        "attempt": 2,
        "startedAt": "2026-07-16T19:00:04Z",
        "failedAt": "2026-07-16T19:00:07Z",
        "duration": 3000,
        "error": {
          "errorType": "HTTP_EXECUTION_ERROR",
          "message": "HTTP 503: Service Unavailable"
        }
      },
      {
        "attempt": 3,
        "startedAt": "2026-07-16T19:00:08Z",
        "failedAt": "2026-07-16T19:00:10Z",
        "duration": 2000,
        "error": {
          "errorType": "HTTP_EXECUTION_ERROR",
          "message": "HTTP 503: Service Unavailable"
        }
      }
    ],
    "nodeErrors": []
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**编排错误响应示例（含节点错误）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-f1a2b3c4-d5e6-7890-abcd-ef1234567890",
    "status": "FAILED",
    "targetId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "targetName": "orderFulfillment",
    "primaryError": {
      "errorCode": "50003",
      "errorType": "NODE_EXECUTION_ERROR",
      "message": "节点 node-payment 执行失败",
      "nodeId": "node-payment",
      "timestamp": "2026-07-16T20:00:10Z",
      "stackTrace": "..."
    },
    "retryHistory": [],
    "nodeErrors": [
      {
        "nodeId": "node-payment",
        "nodeType": "ACTION",
        "actionRef": "act-process-payment",
        "error": {
          "errorCode": "50003",
          "errorType": "HTTP_EXECUTION_ERROR",
          "message": "HTTP 502: Bad Gateway",
          "timestamp": "2026-07-16T20:00:10Z"
        },
        "retryHistory": [
          {
            "attempt": 1,
            "startedAt": "2026-07-16T20:00:02Z",
            "failedAt": "2026-07-16T20:00:05Z",
            "error": { "message": "HTTP 502: Bad Gateway" }
          },
          {
            "attempt": 2,
            "startedAt": "2026-07-16T20:00:06Z",
            "failedAt": "2026-07-16T20:00:08Z",
            "error": { "message": "HTTP 502: Bad Gateway" }
          },
          {
            "attempt": 3,
            "startedAt": "2026-07-16T20:00:09Z",
            "failedAt": "2026-07-16T20:00:10Z",
            "error": { "message": "HTTP 502: Bad Gateway" }
          }
        ]
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| executionId 不存在 | 40401 | 执行记录不存在 |
| 执行未产生错误 | 40401 | 该执行无错误记录 |

---

#### 3.5.5 补偿执行

**POST** `/api/v1/action/executions/{executionId}/compensate`

手动触发补偿执行。补偿将按照编排节点的逆序，对已成功执行的节点执行其补偿逻辑。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| executionId | string | 执行 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reason | string | 否 | 补偿原因 |
| nodeIds | string[] | 否 | 指定补偿的节点 ID 列表，为空则补偿所有已执行节点 |
| async | boolean | 否 | 是否异步执行，默认 true |

**请求示例**

```json
{
  "reason": "业务回滚",
  "nodeIds": ["node-payment", "node-ship"],
  "async": true
}
```

**响应示例（异步）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "compensationId": "comp-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "executionId": "exec-d1e2f3a4-b5c6-7890-abcd-ef1234567890",
    "status": "COMPENSATING",
    "nodesToCompensate": [
      { "nodeId": "node-ship", "order": 1, "status": "PENDING" },
      { "nodeId": "node-payment", "order": 2, "status": "PENDING" }
    ],
    "reason": "业务回滚",
    "startedAt": "2026-07-16T21:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**响应示例（同步完成）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "compensationId": "comp-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "executionId": "exec-d1e2f3a4-b5c6-7890-abcd-ef1234567890",
    "status": "COMPENSATED",
    "nodesToCompensate": [
      {
        "nodeId": "node-ship",
        "order": 1,
        "status": "COMPLETED",
        "compensationOutput": { "cancelled": true, "shipmentId": "SHP-2026-0001" },
        "duration": 2000
      },
      {
        "nodeId": "node-payment",
        "order": 2,
        "status": "COMPLETED",
        "compensationOutput": { "refunded": true, "transactionId": "TXN-2026-0001" },
        "duration": 3000
      }
    ],
    "reason": "业务回滚",
    "startedAt": "2026-07-16T21:00:00Z",
    "completedAt": "2026-07-16T21:00:05Z",
    "totalDuration": 5000
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | 说明 |
|---|---|---|
| executionId 不存在 | 40401 | 执行记录不存在 |
| 节点无补偿配置 | 42201 | 指定节点未配置补偿逻辑 |
| 补偿执行失败 | 50004 | 补偿执行过程中出错 |
| 执行状态不允许补偿 | 40902 | 执行状态非 COMPLETED/FAILED |

---

## 4. 数据模型

### 4.1 PostgreSQL 表结构

以下为 TECH-ACTION 服务在 PostgreSQL 17 中的核心表结构。

#### 4.1.1 action_definitions - Action 定义表

```sql
CREATE TABLE action_definitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(128) NOT NULL,
    display_name    VARCHAR(256) NOT NULL,
    description     TEXT,
    category        VARCHAR(64),
    version         INT NOT NULL DEFAULT 1,
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',  -- DRAFT / PUBLISHED / DISABLED / ARCHIVED
    ontology_concept_id  VARCHAR(128),
    ontology_action_type_id VARCHAR(128),
    input_schema    JSONB NOT NULL,
    output_schema   JSONB NOT NULL,
    execution_type  VARCHAR(20) NOT NULL,                   -- HTTP / SCRIPT / LAMBDA
    execution_config JSONB NOT NULL,
    compensation_enabled BOOLEAN NOT NULL DEFAULT false,
    compensation_config JSONB,
    timeout_ms      INT NOT NULL DEFAULT 30000,
    retry_max_attempts INT NOT NULL DEFAULT 3,
    retry_backoff   VARCHAR(20) NOT NULL DEFAULT 'FIXED',   -- FIXED / LINEAR / EXPONENTIAL
    retry_interval  INT NOT NULL DEFAULT 1000,
    tags            JSONB DEFAULT '[]'::jsonb,
    created_by      VARCHAR(64) NOT NULL,
    updated_by      VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (tenant_id, name, version)
);

CREATE INDEX idx_action_def_tenant_status ON action_definitions (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_action_def_category ON action_definitions (tenant_id, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_action_def_ontology ON action_definitions (ontology_concept_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_action_def_tags ON action_definitions USING GIN (tags);
```

#### 4.1.2 action_versions - Action 版本历史表

```sql
CREATE TABLE action_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id       UUID NOT NULL REFERENCES action_definitions(id),
    tenant_id       VARCHAR(64) NOT NULL,
    version         INT NOT NULL,
    snapshot        JSONB NOT NULL,                           -- 完整定义快照
    change_log      TEXT,
    status          VARCHAR(20) NOT NULL,
    created_by      VARCHAR(64) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (action_id, version)
);

CREATE INDEX idx_action_ver_action ON action_versions (action_id, version);
```

#### 4.1.3 orchestrations - 服务编排表

```sql
CREATE TABLE orchestrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(128) NOT NULL,
    display_name    VARCHAR(256) NOT NULL,
    description     TEXT,
    version         INT NOT NULL DEFAULT 1,
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',   -- DRAFT / PUBLISHED / DISABLED
    input_schema    JSONB,
    output_schema   JSONB,
    variables       JSONB DEFAULT '{}'::jsonb,
    timeout_ms      INT NOT NULL DEFAULT 300000,
    retry_max_attempts INT NOT NULL DEFAULT 3,
    retry_backoff   VARCHAR(20) NOT NULL DEFAULT 'FIXED',
    retry_interval  INT NOT NULL DEFAULT 1000,
    created_by      VARCHAR(64) NOT NULL,
    updated_by      VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (tenant_id, name, version)
);

CREATE INDEX idx_orch_tenant_status ON orchestrations (tenant_id, status) WHERE deleted_at IS NULL;
```

#### 4.1.4 orchestration_nodes - 编排节点表

```sql
CREATE TABLE orchestration_nodes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orchestration_id    UUID NOT NULL REFERENCES orchestrations(id),
    tenant_id           VARCHAR(64) NOT NULL,
    node_id             VARCHAR(128) NOT NULL,
    node_type           VARCHAR(20) NOT NULL,               -- ACTION / WORKFLOW / RULE / PARALLEL / CONDITION / LOOP / DELAY
    action_ref         UUID REFERENCES action_definitions(id),
    action_version     INT,
    workflow_ref        VARCHAR(128),                        -- TECH-WFE 工作流 ID
    rule_ref            VARCHAR(128),                       -- TECH-RULE 规则集 ID
    config              JSONB NOT NULL DEFAULT '{}'::jsonb, -- 节点配置（inputMapping, parallelBranches, condition, loop 等）
    input_mapping       JSONB DEFAULT '{}'::jsonb,
    retry_max_attempts  INT,
    retry_backoff       VARCHAR(20),
    retry_interval      INT,
    timeout_ms          INT,
    sort_order          INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (orchestration_id, node_id)
);

CREATE INDEX idx_orch_node_orch ON orchestration_nodes (orchestration_id);
```

#### 4.1.5 orchestration_edges - 编排边表

```sql
CREATE TABLE orchestration_edges (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orchestration_id    UUID NOT NULL REFERENCES orchestrations(id),
    tenant_id           VARCHAR(64) NOT NULL,
    from_node_id        VARCHAR(128) NOT NULL,
    to_node_id         VARCHAR(128) NOT NULL,
    condition_expr      TEXT,                                -- 条件表达式
    priority            INT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_no_self_edge CHECK (from_node_id <> to_node_id)
);

CREATE INDEX idx_orch_edge_orch ON orchestration_edges (orchestration_id);
CREATE INDEX idx_orch_edge_from ON orchestration_edges (orchestration_id, from_node_id);
CREATE INDEX idx_orch_edge_to ON orchestration_edges (orchestration_id, to_node_id);
```

#### 4.1.6 trigger_rules - 触发规则表

```sql
CREATE TABLE trigger_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    name            VARCHAR(128) NOT NULL,
    display_name    VARCHAR(256) NOT NULL,
    description     TEXT,
    target_type     VARCHAR(20) NOT NULL,                    -- ACTION / ORCHESTRATION
    target_id       UUID NOT NULL,
    target_version  INT,
    trigger_type    VARCHAR(20) NOT NULL,                     -- EVENT / CRON / MANUAL
    event_config    JSONB,                                    -- {topic, eventType, filter, consumerGroup}
    cron_config     JSONB,                                    -- {expression, timezone, startDate, endDate}
    input_mapping   JSONB DEFAULT '{}'::jsonb,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',   -- ACTIVE / INACTIVE
    last_triggered_at TIMESTAMPTZ,
    created_by      VARCHAR(64) NOT NULL,
    updated_by      VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (tenant_id, name)
);

CREATE INDEX idx_trigger_tenant_enabled ON trigger_rules (tenant_id, enabled) WHERE deleted_at IS NULL;
CREATE INDEX idx_trigger_target ON trigger_rules (target_type, target_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_trigger_event_topic ON trigger_rules USING gin (event_config->>'topic') WHERE trigger_type = 'EVENT' AND deleted_at IS NULL;
```

#### 4.1.7 executions - 执行记录表

```sql
CREATE TABLE executions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    execution_type  VARCHAR(20) NOT NULL,                    -- ACTION / ORCHESTRATION
    target_id       UUID NOT NULL,
    target_name     VARCHAR(256),
    target_version  INT,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING / RUNNING / COMPLETED / FAILED / TIMEOUT / CANCELLED / COMPENSATING / COMPENSATED
    input           JSONB NOT NULL,
    output          JSONB,
    error_code      VARCHAR(10),
    error_message   TEXT,
    error_type      VARCHAR(64),
    stack_trace     TEXT,
    retry_count     INT NOT NULL DEFAULT 0,
    max_retries     INT NOT NULL DEFAULT 3,
    trigger_source  VARCHAR(20) NOT NULL DEFAULT 'MANUAL',   -- MANUAL / EVENT / CRON
    trigger_id      UUID REFERENCES trigger_rules(id),
    parent_execution_id UUID,                                -- 重试时指向原执行 ID
    trace_id        VARCHAR(64) NOT NULL,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    timeout_ms      INT,
    duration_ms     INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exec_tenant_status ON executions (tenant_id, status);
CREATE INDEX idx_exec_target ON executions (target_id, started_at DESC);
CREATE INDEX idx_exec_trace ON executions (trace_id);
CREATE INDEX idx_exec_trigger ON executions (trigger_id);
CREATE INDEX idx_exec_started ON executions (started_at DESC);
```

#### 4.1.8 node_executions - 编排节点执行表

```sql
CREATE TABLE node_executions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id    UUID NOT NULL REFERENCES executions(id),
    tenant_id       VARCHAR(64) NOT NULL,
    node_id         VARCHAR(128) NOT NULL,
    node_type       VARCHAR(20) NOT NULL,
    action_ref      UUID,
    action_version  INT,
    branch_id       VARCHAR(128),                            -- PARALLEL 节点的分支 ID
    parent_node_execution_id UUID,                           -- 父节点执行 ID（用于嵌套节点）
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    input           JSONB,
    output          JSONB,
    error_code      VARCHAR(10),
    error_message   TEXT,
    error_type      VARCHAR(64),
    retry_count     INT NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    duration_ms     INT,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_node_exec_execution ON node_executions (execution_id);
CREATE INDEX idx_node_exec_status ON node_executions (execution_id, status);
```

#### 4.1.9 execution_logs - 执行日志表

```sql
CREATE TABLE execution_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id    UUID NOT NULL REFERENCES executions(id),
    tenant_id       VARCHAR(64) NOT NULL,
    node_id         VARCHAR(128),                            -- 关联的节点 ID
    level           VARCHAR(10) NOT NULL DEFAULT 'INFO',     -- DEBUG / INFO / WARN / ERROR
    message         TEXT NOT NULL,
    metadata        JSONB,
    trace_id        VARCHAR(64) NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_log_execution ON execution_logs (execution_id, timestamp);
CREATE INDEX idx_log_node ON execution_logs (execution_id, node_id, timestamp);
```

#### 4.1.10 compensation_records - 补偿记录表

```sql
CREATE TABLE compensation_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id        UUID NOT NULL REFERENCES executions(id),
    tenant_id           VARCHAR(64) NOT NULL,
    node_execution_id   UUID NOT NULL REFERENCES node_executions(id),
    node_id             VARCHAR(128) NOT NULL,
    compensation_order  INT NOT NULL,                        -- 补偿执行顺序（逆序）
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING / COMPLETED / FAILED
    input               JSONB,                               -- 补偿输入
    output              JSONB,                               -- 补偿输出
    error_code          VARCHAR(10),
    error_message       TEXT,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    duration_ms         INT,
    trace_id            VARCHAR(64) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comp_exec ON compensation_records (execution_id);
CREATE INDEX idx_comp_node ON compensation_records (node_execution_id);
```

#### 4.1.11 execution_outbox - Outbox 事件表

```sql
CREATE TABLE execution_outbox (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64) NOT NULL,
    aggregate_type  VARCHAR(64) NOT NULL,                    -- EXECUTION / NODE_EXECUTION / COMPENSATION
    aggregate_id    UUID NOT NULL,
    event_type      VARCHAR(64) NOT NULL,                    -- 见第 5 节事件定义
    payload         JSONB NOT NULL,
    trace_id        VARCHAR(64) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING / SENT / FAILED
    retry_count     INT NOT NULL DEFAULT 0,
    max_retries     INT NOT NULL DEFAULT 3,
    next_retry_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at         TIMESTAMPTZ
);

CREATE INDEX idx_outbox_status ON execution_outbox (status, next_retry_at) WHERE status = 'PENDING';
CREATE INDEX idx_outbox_aggregate ON execution_outbox (aggregate_type, aggregate_id);
```

### 4.2 表关系概览

```
action_definitions 1───* action_versions
action_definitions 1───* orchestration_nodes (action_ref)
orchestrations     1───* orchestration_nodes
orchestrations     1───* orchestration_edges
trigger_rules     *───1 action_definitions / orchestrations (target)
executions         1───* node_executions
executions         1───* execution_logs
executions         1───* compensation_records
node_executions    1───* compensation_records
executions         1───* execution_outbox
```

---

## 5. 事件定义

### 5.1 Kafka Topic 规划

| Topic | 说明 | 生产者 | 消费者 |
|---|---|---|---|
| `metaplatform.action.execution.events` | Action 执行生命周期事件 | TECH-ACTION | TECH-OBS, APP-SUPERAI, APP-ONTSTUDIO |
| `metaplatform.action.trigger.events` | 触发规则事件 | TECH-ACTION | TECH-OBS |
| `metaplatform.action.compensation.events` | 补偿执行事件 | TECH-ACTION | TECH-OBS |
| `metaplatform.action.dlq` | 死信队列 | TECH-ACTION (消费失败时) | TECH-OBS / 运维 |

### 5.2 事件类型定义

#### 5.2.1 Action 执行事件

所有执行事件发布到 Topic `metaplatform.action.execution.events`。

**ActionExecutionStarted**

```json
{
  "eventType": "ActionExecutionStarted",
  "eventId": "evt-001",
  "timestamp": "2026-07-16T19:00:00Z",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "payload": {
    "executionId": "exec-c1d2e3f4-a5b6-7890-abcd-ef1234567890",
    "executionType": "ACTION",
    "actionId": "act-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "actionName": "sendNotification",
    "version": 3,
    "input": {
      "channel": "email",
      "recipient": "user@example.com",
      "message": "您的订单已确认"
    },
    "triggerSource": "MANUAL",
    "triggerId": null,
    "timeoutMs": 15000
  }
}
```

**ActionExecutionCompleted**

```json
{
  "eventType": "ActionExecutionCompleted",
  "eventId": "evt-002",
  "timestamp": "2026-07-16T19:00:02Z",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "payload": {
    "executionId": "exec-c1d2e3f4-a5b6-7890-abcd-ef1234567890",
    "executionType": "ACTION",
    "actionId": "act-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "version": 3,
    "status": "COMPLETED",
    "output": {
      "messageId": "msg-2026-0001",
      "status": "sent"
    },
    "durationMs": 2100,
    "retryCount": 0,
    "startedAt": "2026-07-16T19:00:00Z",
    "completedAt": "2026-07-16T19:00:02Z"
  }
}
```

**ActionExecutionFailed**

```json
{
  "eventType": "ActionExecutionFailed",
  "eventId": "evt-003",
  "timestamp": "2026-07-16T19:00:10Z",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "payload": {
    "executionId": "exec-c1d2e3f4-a5b6-7890-abcd-ef1234567890",
    "executionType": "ACTION",
    "actionId": "act-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "version": 3,
    "status": "FAILED",
    "errorCode": "50003",
    "errorType": "HTTP_EXECUTION_ERROR",
    "errorMessage": "HTTP 503: Service Unavailable",
    "retryCount": 3,
    "maxRetries": 3,
    "startedAt": "2026-07-16T19:00:00Z",
    "failedAt": "2026-07-16T19:00:10Z"
  }
}
```

**ActionExecutionRetrying**

```json
{
  "eventType": "ActionExecutionRetrying",
  "eventId": "evt-004",
  "timestamp": "2026-07-16T19:00:04Z",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "payload": {
    "executionId": "exec-c1d2e3f4-a5b6-7890-abcd-ef1234567890",
    "actionId": "act-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "attempt": 2,
    "maxAttempts": 3,
    "previousError": "HTTP 503: Service Unavailable",
    "backoffStrategy": "EXPONENTIAL",
    "nextRetryAt": "2026-07-16T19:00:06Z"
  }
}
```

**ActionExecutionCancelled**

```json
{
  "eventType": "ActionExecutionCancelled",
  "eventId": "evt-005",
  "timestamp": "2026-07-16T20:05:00Z",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "payload": {
    "executionId": "exec-d1e2f3a4-b5c6-7890-abcd-ef1234567890",
    "executionType": "ORCHESTRATION",
    "targetId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "previousStatus": "RUNNING",
    "currentStatus": "CANCELLED",
    "reason": "业务方手动取消",
    "compensationTriggered": true,
    "cancelledAt": "2026-07-16T20:05:00Z"
  }
}
```

#### 5.2.2 编排节点执行事件

**NodeExecutionStarted**

```json
{
  "eventType": "NodeExecutionStarted",
  "eventId": "evt-010",
  "timestamp": "2026-07-16T20:00:02Z",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "payload": {
    "executionId": "exec-d1e2f3a4-b5c6-7890-abcd-ef1234567890",
    "orchestrationId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "nodeId": "node-payment",
    "nodeType": "ACTION",
    "actionRef": "act-process-payment",
    "actionVersion": 3,
    "input": {
      "orderId": "ORD-2026-0001",
      "customerId": "CUS-001"
    },
    "branchId": null
  }
}
```

**NodeExecutionCompleted**

```json
{
  "eventType": "NodeExecutionCompleted",
  "eventId": "evt-011",
  "timestamp": "2026-07-16T20:00:10Z",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "payload": {
    "executionId": "exec-d1e2f3a4-b5c6-7890-abcd-ef1234567890",
    "nodeId": "node-payment",
    "status": "COMPLETED",
    "output": {
      "status": "success",
      "transactionId": "TXN-2026-0001"
    },
    "durationMs": 8000,
    "retryCount": 1
  }
}
```

#### 5.2.3 触发事件

发布到 Topic `metaplatform.action.trigger.events`。

**TriggerFired**

```json
{
  "eventType": "TriggerFired",
  "eventId": "evt-020",
  "timestamp": "2026-07-16T18:00:00Z",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "payload": {
    "triggerId": "trg-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "triggerType": "EVENT",
    "targetType": "ORCHESTRATION",
    "targetId": "orch-1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "executionId": "exec-d1e2f3a4-b5c6-7890-abcd-ef1234567890",
    "sourceEvent": {
      "topic": "metaplatform.order.events",
      "eventType": "ORDER_CREATED",
      "offset": 12345,
      "partition": 0
    },
    "mappedInput": {
      "orderId": "ORD-2026-0001",
      "customerId": "CUS-001"
    }
  }
}
```

**TriggerEnabled / TriggerDisabled**

```json
{
  "eventType": "TriggerDisabled",
  "eventId": "evt-021",
  "timestamp": "2026-07-16T17:00:00Z",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "payload": {
    "triggerId": "trg-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "triggerType": "EVENT",
    "previousStatus": "ACTIVE",
    "currentStatus": "INACTIVE",
    "updatedBy": "user-001"
  }
}
```

#### 5.2.4 补偿事件

发布到 Topic `metaplatform.action.compensation.events`。

**CompensationStarted**

```json
{
  "eventType": "CompensationStarted",
  "eventId": "evt-030",
  "timestamp": "2026-07-16T21:00:00Z",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "payload": {
    "compensationId": "comp-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "executionId": "exec-d1e2f3a4-b5c6-7890-abcd-ef1234567890",
    "reason": "业务回滚",
    "nodesToCompensate": [
      { "nodeId": "node-ship", "order": 1 },
      { "nodeId": "node-payment", "order": 2 }
    ]
  }
}
```

**CompensationNodeCompleted**

```json
{
  "eventType": "CompensationNodeCompleted",
  "eventId": "evt-031",
  "timestamp": "2026-07-16T21:00:02Z",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "payload": {
    "compensationId": "comp-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "executionId": "exec-d1e2f3a4-b5c6-7890-abcd-ef1234567890",
    "nodeId": "node-ship",
    "compensationOrder": 1,
    "output": {
      "cancelled": true,
      "shipmentId": "SHP-2026-0001"
    },
    "durationMs": 2000
  }
}
```

**CompensationCompleted**

```json
{
  "eventType": "CompensationCompleted",
  "eventId": "evt-032",
  "timestamp": "2026-07-16T21:00:05Z",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "payload": {
    "compensationId": "comp-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "executionId": "exec-d1e2f3a4-b5c6-7890-abcd-ef1234567890",
    "status": "COMPENSATED",
    "totalNodes": 2,
    "completedNodes": 2,
    "failedNodes": 0,
    "totalDurationMs": 5000,
    "startedAt": "2026-07-16T21:00:00Z",
    "completedAt": "2026-07-16T21:00:05Z"
  }
}
```

**CompensationFailed**

```json
{
  "eventType": "CompensationFailed",
  "eventId": "evt-033",
  "timestamp": "2026-07-16T21:00:08Z",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "payload": {
    "compensationId": "comp-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "executionId": "exec-d1e2f3a4-b5c6-7890-abcd-ef1234567890",
    "failedNodeId": "node-payment",
    "errorCode": "50004",
    "errorMessage": "补偿执行失败：退款接口返回 500",
    "status": "PARTIALLY_COMPENSATED",
    "completedNodes": 1,
    "failedNodes": 1
  }
}
```

### 5.3 Outbox 模式实现

事件发布遵循 Outbox 模式，保证数据库事务与消息发送的一致性。

**流程**

1. 业务数据写入 PostgreSQL 时，同事务中将事件记录写入 `execution_outbox` 表
2. 独立的 Outbox Publisher 线程轮询 `execution_outbox` 中 `status=PENDING` 的记录
3. 发布到 Kafka，消息头包含 `X-Trace-Id`、`X-Tenant-Id`、`X-Event-Type`
4. 发布成功后更新 `status=SENT`、`sent_at=NOW()`
5. 发布失败时 `retry_count+1`，若超过 `max_retries` 则 `status=FAILED` 并写入 DLQ

**Kafka 消息头规范**

```
X-Trace-Id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
X-Tenant-Id: tenant-001
X-Event-Type: ActionExecutionCompleted
X-Event-Id: evt-002
X-Aggregate-Type: EXECUTION
X-Aggregate-Id: exec-c1d2e3f4-a5b6-7890-abcd-ef1234567890
```

### 5.4 DLQ 处理

消费方处理失败的事件进入死信队列 `metaplatform.action.dlq`。

**DLQ 消息结构**

```json
{
  "originalTopic": "metaplatform.action.execution.events",
  "originalEventType": "ActionExecutionCompleted",
  "originalEventId": "evt-002",
  "originalPayload": { },
  "headers": {
    "X-Trace-Id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "X-Tenant-Id": "tenant-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "errorReason": "Consumer processing timeout",
  "retryCount": 3,
  "failedAt": "2026-07-16T19:01:00Z",
  "originalTimestamp": "2026-07-16T19:00:02Z"
}
```

**DLQ 消费策略**

- 最大重试 3 次，间隔指数退避（1s, 2s, 4s）
- 超过重试上限后写入 DLQ Topic
- DLQ 记录必须包含 `traceId` 字段用于故障诊断
- 运维可通过监控告警发现 DLQ 积压

---

## 6. 增量交付计划

### 6.1 里程碑总览

| 里程碑 | 范围 | 预计周期 |
|---|---|---|
| M1 | Action 定义管理 + 执行引擎（基础） | 第 1-3 周 |
| M2 | 服务编排（串行/并行/条件） | 第 4-6 周 |
| M3 | 触发规则（事件 + Cron） + Outbox | 第 7-8 周 |
| M4 | 执行监控 + 补偿机制 + 循环节点 | 第 9-11 周 |
| M5 | 性能优化 + 多租户 + MCP 暴露 | 第 12-14 周 |

### 6.2 M1：Action 定义管理 + 基础执行引擎（第 1-3 周）

**交付内容**

- Action 定义 CRUD API（3.1.1 - 3.1.5）
- Action 发布/禁用（3.1.6）
- Schema 验证（3.1.7）
- 版本管理（3.1.8）
- HTTP 执行器 + 同步执行（3.4.1）
- 执行状态查询（3.4.3）
- 基础重试机制
- 数据模型：`action_definitions`、`action_versions`、`executions`、`execution_logs`

**验收标准**

- 可创建包含 HTTP 执行逻辑的 Action 定义
- 可同步执行 Action 并返回结果
- 支持 inputSchema 校验
- 支持版本管理与发布流程

### 6.3 M2：服务编排 - 串行/并行/条件（第 4-6 周）

**交付内容**

- 编排 CRUD API（3.2.1 - 3.2.3）
- 节点添加 API（3.2.4）：支持 ACTION、PARALLEL、CONDITION 节点
- 流转配置 API（3.2.5）
- 编排校验 API（3.2.6）：环路检测、可达性、Schema 映射
- 编排发布（3.2.7）
- 编排执行 API（3.4.2）：异步执行 + 节点级状态追踪
- 数据模型：`orchestrations`、`orchestration_nodes`、`orchestration_edges`、`node_executions`

**验收标准**

- 可创建包含串行/并行/条件节点的编排
- 编排可异步执行并追踪各节点状态
- 编排校验能检测环路、不可达节点、Schema 不匹配

### 6.4 M3：触发规则 + Outbox 模式（第 7-8 周）

**交付内容**

- 触发规则 CRUD API（3.3.1 - 3.3.5）
- 事件触发（Kafka 消费驱动）
- Cron 定时触发（Spring Scheduling）
- 手动触发 API（3.3.6）
- Outbox 模式实现（第 5.3 节）
- 执行事件发布（ActionExecutionStarted/Completed/Failed）
- DLQ 处理机制
- 数据模型：`trigger_rules`、`execution_outbox`

**验收标准**

- Kafka 事件可触发 Action/编排执行
- Cron 表达式可定时触发
- 事件发布遵循 Outbox 模式，保证一致性
- 消费失败重试 3 次后进入 DLQ，DLQ 记录包含 traceId

### 6.5 M4：执行监控 + 补偿 + 循环节点（第 9-11 周）

**交付内容**

- 执行记录列表 API（3.5.1）
- 执行详情 API（3.5.2）：含节点详情 + 日志
- 耗时统计 API（3.5.3）：P50/P90/P99、成功率
- 错误追踪 API（3.5.4）：错误堆栈 + 重试历史
- 补偿执行 API（3.5.5）：手动补偿
- 取消执行 API（3.4.4）：含自动补偿触发
- 重试执行 API（3.4.5）：FROM_START / FROM_FAILED
- LOOP 节点支持（FOR / WHILE / FOREACH）
- 补偿事件发布
- 数据模型：`compensation_records`

**验收标准**

- 可查询执行的完整详情（节点级 + 日志）
- 耗时统计支持 P50/P90/P99
- 取消执行可触发逆序补偿
- 手动补偿可选择指定节点
- LOOP 节点支持三种循环类型且有最大迭代保护

### 6.6 M5：性能优化 + 多租户 + MCP 暴露（第 12-14 周）

**交付内容**

- 执行引擎性能优化：线程池调优、Redis 缓存热点 Action 定义
- 多租户隔离：行级安全策略（RLS）、资源配额
- SCRIPT 执行器（GraalVM Polyglot：JS/Python）
- LAMBDA 执行器
- MCP 协议暴露：将 Action 执行能力作为 MCP Tool 暴露
- 批量执行 API
- 执行历史归档策略（冷热分离）

**验收标准**

- SCRIPT 类型 Action 可执行 JS/Python 脚本
- 多租户数据完全隔离
- Action 执行能力可通过 MCP 协议被外部 Agent 调用
- 热点 Action 定义缓存命中率 > 90%
- 执行历史超过 90 天自动归档

---

## 附录

### A. 执行状态机

```
                    ┌──────────────┐
                    │   PENDING    │
                    └──────┬───────┘
                           │ 调度
                           ▼
                    ┌──────────────┐
        ┌────────────│   RUNNING    │────────────┐
        │            └──────┬───────┘            │
        │ 超时               │ 成功               │ 失败
        ▼                    ▼                    ▼
 ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
 │   TIMEOUT    │    │  COMPLETED   │    │   FAILED     │
 └──────┬───────┘    └──────────────┘    └──────┬───────┘
        │                                       │
        │ 重试                                   │ 重试
        └───────────┬───────────────────────────┘
                    │
                    ▼
              ┌──────────────┐
              │   RUNNING    │ (新 executionId)
              └──────────────┘

 取消（任意执行中状态）:
                    ┌──────────────┐
                    │ COMPENSATING │───→ COMPENSATED
                    └──────────────┘     或 PARTIALLY_COMPENSATED
```

### B. 变量表达式语法

编排中支持变量表达式，使用 `${}` 语法：

| 表达式 | 说明 |
|---|---|
| `${orchestration.input.fieldName}` | 编排输入字段 |
| `${node-nodeId.output.fieldName}` | 指定节点的输出字段 |
| `${orchestration.variables.varName}` | 编排变量 |
| `${event.payload.fieldName}` | 触发事件的 payload 字段 |
| `${context.executionDate}` | 执行日期（Cron 触发时可用） |
| `${context.traceId}` | 当前执行的 traceId |

表达式支持运算符：`==`、`!=`、`>`、`<`、`>=`、`<=`、`&&`、`||`、`!`。

### C. 重试退避策略

| 策略 | 说明 | 示例（interval=1000ms, maxAttempts=3） |
|---|---|---|
| FIXED | 固定间隔 | 第1次重试等 1s，第2次等 1s，第3次等 1s |
| LINEAR | 线性递增 | 第1次等 1s，第2次等 2s，第3次等 3s |
| EXPONENTIAL | 指数退避 | 第1次等 1s，第2次等 2s，第3次等 4s |

### D. MCP Tool 暴露（规划）

TECH-ACTION 计划通过 TECH-MCP 将以下能力暴露为 MCP Tool：

| Tool 名称 | 说明 |
|---|---|
| `action.execute` | 执行指定 Action |
| `action.list` | 列出可用 Action |
| `action.getStatus` | 查询执行状态 |
| `orchestration.execute` | 执行指定编排 |
| `orchestration.list` | 列出可用编排 |

### E. 版本历史

| 版本 | 日期 | 变更说明 |
|---|---|---|
| v1.0 | 2026-07-16 | 初始版本，包含 Action 定义管理、服务编排、触发规则、执行引擎、执行监控全部 API 规范 |