# SPEC - MCP 协议适配服务 API 规范（TECH-MCP）

> 文档版本：v1.0  
> 日期：2026-07-16  
> 模块：TECH-MCP  
> 包名：`com.metaplatform.mcp`  
> API 路径前缀：`/api/v1/mcp`

---

## 目录

- [1. 服务概述](#1-服务概述)
- [2. 通用约定](#2-通用约定)
- [3. API 接口详情](#3-api-接口详情)
  - [3.1 MCP Server 管理 API](#31-mcp-server-管理-api)
  - [3.2 MCP Client 管理 API](#32-mcp-client-管理-api)
  - [3.3 Tool 注册中心 API](#33-tool-注册中心-api)
  - [3.4 Tool 执行 API](#34-tool-执行-api)
  - [3.5 Resource 管理 API](#35-resource-管理-api)
  - [3.6 Prompt 模板管理 API](#36-prompt-模板管理-api)
  - [3.7 调用审计 API](#37-调用审计-api)
- [4. 数据模型](#4-数据模型)
- [5. 事件定义](#5-事件定义)
- [6. 增量交付计划](#6-增量交付计划)

---

## 1. 服务概述

### 1.1 服务定位

TECH-MCP 是 Mate Platform 的 **MCP 协议适配服务**（Model Context Protocol Adaptation Service），作为平台与外部 AI 生态之间的标准化协议桥梁。MCP 是 Anthropic 开源的 JSON-RPC 2.0 协议，定义了 AI 应用与外部工具/资源之间的通信标准，支持 Tools（工具调用）、Resources（资源读取）、Prompts（提示模板）三大能力域。

TECH-MCP 同时承担两个角色：

- **MCP Server 角色**：将平台核心能力（Ontology 查询、知识库检索、Action 执行、架构资产读取等）以 MCP 协议暴露给外部 AI 工具（如 Claude Desktop、Cursor、自研 Agent 等），使外部 AI 工具能够直接调用平台能力。
- **MCP Client 角色**：连接并调用第三方 MCP Server（如企业内部工具、第三方 SaaS 服务暴露的 MCP Server），将外部工具纳入平台的统一 Tool 注册中心，供平台 Agent 和工作流使用。

核心职责：

| 职责 | 说明 |
|---|---|
| MCP Server 管理 | MCP Server 实例的创建、配置、启停；管理每个 Server 暴露的 Tools / Resources / Prompts 清单 |
| MCP Client 管理 | 连接第三方 MCP Server 的配置管理；连接建立、状态监控、自动重连、健康检查 |
| Tool 注册中心 | 统一管理内部 Tool（平台原生能力）与外部 Tool（第三方 MCP Server 暴露的 Tool）；Tool 注册、Schema 定义、分类、搜索、路由 |
| Tool 执行 | Tool 调用执行，支持同步/异步/批量模式；参数校验（JSON Schema）、超时控制、结果返回 |
| Resource 管理 | Resource 的暴露与读取；支持文档、架构资产、本体实体等资源的 MCP 协议读取 |
| Prompt 模板管理 | Prompt 模板的创建、管理、渲染；支持变量替换与角色模板 |
| 调用审计 | MCP 调用全链路记录、Token 消耗统计、错误追踪、调用趋势分析 |

### 1.2 技术栈

| 层级 | 技术 | 版本 | 用途 |
|---|---|---|---|
| 语言 | Java | 21 | 服务主体语言 |
| 框架 | Spring Boot | 3.4 | Web 框架、依赖注入、配置管理 |
| AI 框架 | Spring AI | 1.0 | AI 能力集成 |
| MCP SDK | spring-ai-mcp-server-spring-boot-starter | 1.0 | MCP Server 实现（Java 端） |
| MCP SDK | spring-ai-mcp-client-spring-boot-starter | 1.0 | MCP Client 实现（Java 端） |
| 数据库 | PostgreSQL | 17 | Server/Client/Tool/Resource/Prompt 配置与审计数据持久化 |
| 缓存 | Redis | 7.4 | Tool 注册缓存、Server 能力清单缓存、连接状态缓存 |
| 消息队列 | Kafka | 3.9 | Tool 调用事件发布（Outbox 模式） |
| 可观测性 | OpenTelemetry + Prometheus | 1.45 / 3.x | trace_id 传播、指标采集 |
| JSON 处理 | Jackson | 2.17 | JSON-RPC 消息序列化/反序列化 |
| Schema 校验 | networknt/json-schema-validator | 1.5 | Tool 参数 JSON Schema 校验 |

### 1.3 上游依赖

| 上游服务 | 依赖关系 | 说明 |
|---|---|---|
| TECH-ONT | 强依赖 | 本体引擎，提供概念查询、实体检索、知识图谱查询能力，作为 MCP Tool 暴露给外部 |
| TECH-RAG | 强依赖 | RAG 引擎，提供知识库检索能力，作为 MCP Tool 暴露给外部 |
| TECH-ACTION | 强依赖 | Action Engine，提供 Action 执行能力，作为 MCP Tool 暴露给外部 |
| TECH-IAM | 强依赖 | 用户认证、租户隔离、API Key 管理、权限校验 |
| TECH-LLMGW | 弱依赖 | Prompt 模板渲染时如需 LLM 辅助（如变量推理），通过 TECH-LLMGW 调用 |
| TECH-MSG | 弱依赖 | Kafka 消息基础设施，用于 Tool 调用事件发布 |

### 1.4 下游消费方

| 下游服务/应用 | 消费方式 | 说明 |
|---|---|---|
| APP-MCPHUB | REST API | MCP 服务中心前端，MCP Server/Client 配置管理、Tool/Resource/Prompt 可视化管理 |
| APP-SUPERAI | MCP 协议 | 超级 AI 作为 MCP Client 调用平台暴露的 Tools/Resources/Prompts |
| APP-DW | REST API + MCP 协议 | 数字员工通过 MCP 协议调用外部工具，通过 REST API 管理工具配置 |
| TECH-AGENT | REST API | Agent 框架从 Tool 注册中心获取可用 Tool 清单并执行 |
| 外部 AI 工具 | MCP 协议 | Claude Desktop、Cursor 等外部工具通过 MCP 协议连接平台 Server |
| 第三方 MCP Server | MCP 协议 | 平台作为 MCP Client 连接外部 MCP Server，发现并调用其 Tools |
| APP-DASHBOARD | REST API | 仪表盘展示 MCP 调用统计、Token 消耗、Tool 使用排行 |

### 1.5 核心能力清单

| 能力域 | 说明 |
|---|---|
| MCP Server 管理 | Server 实例 CRUD、暴露能力配置（Tools/Resources/Prompts 绑定）、Server 启停、能力清单查询 |
| MCP Client 管理 | 第三方 Server 连接配置 CRUD、连接测试、状态监控、自动重连、工具/资源/模板发现 |
| Tool 注册中心 | 内部/外部 Tool 统一注册、JSON Schema 定义、分类管理、全文搜索、启用/禁用、路由策略 |
| Tool 执行 | 同步执行、异步执行、批量执行、参数校验、超时控制、结果标准化返回 |
| Resource 管理 | Resource CRUD、内容读取（文本/二进制）、Resource 搜索、自动同步（从 TECH-ONT/TECH-EA） |
| Prompt 模板管理 | 模板 CRUD、变量定义、Mustache 渲染、角色模板、MCP prompts/get 端点 |
| 调用审计 | 调用记录查询、Token 消耗统计、错误追踪、调用趋势分析、Top-N 工具排行 |

### 1.6 架构约束

- Kafka 消息发布必须使用 **Outbox 模式** 防止数据丢失
- 事件消费必须支持 **DLQ（Dead Letter Queue）**，重试 3 次
- `trace_id` 必须在所有系统组件间传播，Kafka 消息头包含 `X-Trace-Id`
- DLQ 记录必须包含 `traceId` 字段用于故障诊断
- 所有 LLM 调用必须通过 `TECH-LLMGW`，不直接调模型 API
- MCP Server 实例间必须实现**租户隔离**，不同租户的 Server 配置与暴露能力互不可见
- 外部 MCP Client 连接平台 Server 时必须通过 **API Key 认证**，由 TECH-IAM 签发
- Tool 执行必须记录**完整调用链路**：调用方 -> MCP 路由 -> Tool 执行器 -> 下游服务
- MCP JSON-RPC 消息体大小限制为 **10MB**，超出时返回错误

---

## 2. 通用约定

### 2.1 路径前缀

所有 REST API 路径前缀为 `/api/v1/mcp`。

完整路径示例：
- `/api/v1/mcp/servers`（Server 管理）
- `/api/v1/mcp/clients`（Client 管理）
- `/api/v1/mcp/tools`（Tool 注册中心）
- `/api/v1/mcp/tools/execute`（Tool 执行）
- `/api/v1/mcp/resources`（Resource 管理）
- `/api/v1/mcp/prompts`（Prompt 模板管理）
- `/api/v1/mcp/audit/calls`（调用审计）

MCP JSON-RPC 端点路径示例：
- `/api/v1/mcp/servers/{serverId}/rpc`（Server JSON-RPC 入口）
- `/api/v1/mcp/servers/{serverId}/sse`（Server SSE 流式端点）

### 2.2 JSON-RPC 2.0 协议说明

MCP 协议基于 JSON-RPC 2.0，TECH-MCP 同时支持以下传输方式：

| 传输方式 | 说明 | 适用场景 |
|---|---|---|
| stdio | 标准输入输出 | 本地进程间通信（如 Claude Desktop 连接本地 Server） |
| HTTP+SSE | HTTP 请求 + Server-Sent Events 流 | 远程连接、Web 端 AI 工具 |
| Streamable HTTP | HTTP 流式传输（MCP 2025-03 规范） | 远程连接，替代 HTTP+SSE |

JSON-RPC 2.0 消息结构：

**请求（Request）**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_knowledge_base",
    "arguments": {
      "query": "本体论引擎架构",
      "topK": 5
    }
  }
}
```

**响应（Response）**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "本体论引擎是..."
      }
    ],
    "isError": false
  }
}
```

**通知（Notification，无 id）**

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

**错误（Error）**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params: missing required field 'query'"
  }
}
```

MCP JSON-RPC 标准方法：

| 方法 | 方向 | 说明 |
|---|---|---|
| `initialize` | Client -> Server | 初始化握手，协商协议版本与能力 |
| `notifications/initialized` | Client -> Server | 初始化完成通知 |
| `ping` | Client -> Server | 心跳检测 |
| `tools/list` | Client -> Server | 列出 Server 暴露的所有 Tools |
| `tools/call` | Client -> Server | 调用指定 Tool |
| `resources/list` | Client -> Server | 列出 Server 暴露的所有 Resources |
| `resources/read` | Client -> Server | 读取指定 Resource 内容 |
| `resources/templates/list` | Client -> Server | 列出 Resource 模板（URI 模板） |
| `prompts/list` | Client -> Server | 列出 Server 暴露的所有 Prompts |
| `prompts/get` | Client -> Server | 获取指定 Prompt 渲染结果 |
| `logging/setLevel` | Client -> Server | 设置日志级别 |
| `notifications/tools/list_changed` | Server -> Client | Tool 列表变更通知 |
| `notifications/resources/list_changed` | Server -> Client | Resource 列表变更通知 |
| `notifications/resources/updated` | Server -> Client | Resource 内容更新通知 |
| `notifications/prompts/list_changed` | Server -> Client | Prompt 列表变更通知 |

### 2.3 统一响应体

所有 REST API 接口返回统一 JSON 结构：

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

> **注意**：MCP JSON-RPC 端点（`/rpc`、`/sse`）不使用统一响应体，直接返回 JSON-RPC 2.0 标准格式。REST API 端点使用统一响应体。

### 2.4 认证

| 方式 | 说明 | 适用场景 |
|---|---|---|
| Bearer Token | 请求头携带 `Authorization: Bearer <JWT>`，由 TECH-IAM 签发 | 平台内部服务调用、前端管理 API |
| API Key | 请求头携带 `X-API-Key: <key>`，由 TECH-IAM 签发 | 外部 MCP Client 连接平台 Server、服务间调用 |
| MCP Auth | MCP 协议 `initialize` 握手时携带 `x-api-key` 元数据 | MCP JSON-RPC 端点认证 |

请求头示例：

```
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
X-Trace-Id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
X-Tenant-Id: tenant-001
Content-Type: application/json
```

MCP JSON-RPC 握手认证示例：

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {}
    },
    "clientInfo": {
      "name": "claude-desktop",
      "version": "1.0.0"
    },
    "_meta": {
      "x-api-key": "mcpk_a1b2c3d4e5f6g7h8"
    }
  }
}
```

### 2.5 错误码

#### 2.5.1 REST API 错误码

| code | HTTP Status | 说明 |
|---|---|---|
| 0 | 200 | 成功 |
| 40001 | 400 | 请求参数校验失败 |
| 40002 | 400 | 请求体 JSON 格式错误 |
| 40003 | 400 | JSON Schema 校验失败（Tool 参数不匹配） |
| 40101 | 401 | 未认证或 Token 过期 |
| 40102 | 401 | API Key 无效或已过期 |
| 40301 | 403 | 无权限访问该资源 |
| 40302 | 403 | 租户隔离校验失败 |
| 40401 | 404 | 资源不存在 |
| 40402 | 404 | MCP Server 不存在或已停止 |
| 40403 | 404 | Tool 不存在或已禁用 |
| 40404 | 404 | 第三方 MCP Server 连接不可用 |
| 40901 | 409 | 资源冲突（如名称重复） |
| 40902 | 409 | 状态非法（如 Server 已停止不可再次停止） |
| 40903 | 409 | Tool 注册冲突（同名 Tool 已存在） |
| 42201 | 422 | 业务校验失败（如 Schema 定义不合法） |
| 42202 | 422 | MCP 协议版本不兼容 |
| 42203 | 422 | Resource URI 格式不合法 |
| 42901 | 429 | 请求过于频繁，限流触发 |
| 50001 | 500 | 服务内部错误 |
| 50002 | 500 | Tool 执行超时 |
| 50003 | 500 | Tool 执行失败（下游服务错误） |
| 50004 | 500 | 第三方 MCP Server 调用失败 |
| 50005 | 500 | MCP Server 实例启动失败 |
| 50301 | 503 | 下游依赖不可用（TECH-ONT/RAG/ACTION） |
| 50302 | 503 | MCP Server 正在启动中，暂不可用 |

#### 2.5.2 MCP JSON-RPC 错误码

JSON-RPC 端点使用标准 JSON-RPC 错误码：

| code | 说明 | 对应场景 |
|---|---|---|
| -32700 | Parse error | JSON 解析失败 |
| -32600 | Invalid Request | JSON-RPC 请求格式不合法 |
| -32601 | Method not found | MCP 方法不支持 |
| -32602 | Invalid params | 参数校验失败 |
| -32603 | Internal error | 服务内部错误 |
| -32000 | Server error | MCP Server 启动/运行错误 |
| -32001 | Tool execution timeout | Tool 执行超时 |
| -32002 | Tool not found | 请求的 Tool 不存在 |
| -32003 | Resource not found | 请求的 Resource 不存在 |
| -32004 | Prompt not found | 请求的 Prompt 不存在 |
| -32005 | Authentication failed | API Key 认证失败 |
| -32006 | Rate limit exceeded | 限流触发 |

### 2.6 分页约定

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

### 2.7 trace_id 传播

- 客户端请求头 `X-Trace-Id` 缺失时，网关自动生成 UUID
- `traceId` 写入 MDC，贯穿日志、Kafka 消息头、数据库执行记录
- Kafka 消息头必须包含 `X-Trace-Id`
- MCP JSON-RPC 请求的 `_meta` 字段可携带 `traceId`，未携带时自动生成
- 异步执行时，`traceId` 通过 `TraceContext` 对象在线程间传播
- Tool 执行调用下游服务时，请求头必须携带 `X-Trace-Id`

### 2.8 命名约定

| 对象 | 命名规则 | 示例 |
|---|---|---|
| MCP Server 实例名 | 小写字母 + 连字符，租户内唯一 | `ont-query-server` |
| Tool 名称 | 小写字母 + 下划线，全局唯一 | `search_knowledge_base` |
| Resource URI | `scheme://path` 格式 | `ont://concepts/CRM.Customer` |
| Prompt 名称 | 小写字母 + 连字符 | `code-review-template` |
| API Key | `mcpk_` 前缀 + 32位随机字符串 | `mcpk_a1b2c3d4e5f6g7h8` |

---

## 3. API 接口详情

### 3.1 MCP Server 管理 API

MCP Server 是平台对外暴露 MCP 能力的服务实例。每个 Server 实例可以配置不同的 Tools / Resources / Prompts 组合，面向不同的消费方。

#### 3.1.1 创建 MCP Server 实例

**POST** `/api/v1/mcp/servers`

创建一个新的 MCP Server 实例，配置传输方式、暴露能力、认证策略。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | Server 实例名称，租户内唯一 |
| displayName | string | 是 | 显示名称 |
| description | string | 否 | 描述信息 |
| transport | object | 是 | 传输配置 |
| transport.type | string | 是 | 传输类型：`STDIO`、`HTTP_SSE`、`STREAMABLE_HTTP` |
| transport.config | object | 是 | 传输配置详情，结构取决于 type |
| protocolVersion | string | 否 | MCP 协议版本，默认 `2025-06-18` |
| authConfig | object | 是 | 认证配置 |
| authConfig.type | string | 是 | 认证类型：`API_KEY`、`BEARER_TOKEN`、`NONE` |
| authConfig.apiKeys | string[] | 否 | API Key 列表（type=API_KEY 时必填） |
| authConfig.tokenValidationEndpoint | string | 否 | Token 校验端点（type=BEARER_TOKEN 时必填） |
| toolBindings | string[] | 否 | 绑定的 Tool ID 列表 |
| resourceBindings | string[] | 否 | 绑定的 Resource ID 列表 |
| promptBindings | string[] | 否 | 绑定的 Prompt 模板 ID 列表 |
| rateLimit | object | 否 | 速率限制配置 |
| rateLimit.maxRequestsPerMinute | int | 否 | 每分钟最大请求数，默认 100 |
| rateLimit.maxRequestsPerHour | int | 否 | 每小时最大请求数，默认 6000 |
| tags | string[] | 否 | 标签列表 |

**transport.config 结构**

| type | config 字段 |
|---|---|
| STDIO | `command`（启动命令）、`args`（命令参数）、`env`（环境变量） |
| HTTP_SSE | `sseEndpoint`（SSE 端点路径）、`messageEndpoint`（消息端点路径）、`host`（监听地址）、`port`（监听端口） |
| STREAMABLE_HTTP | `endpoint`（HTTP 端点路径）、`host`（监听地址）、`port`（监听端口）、`enableSSEFallback`（是否降级为 SSE） |

**请求示例**

```json
{
  "name": "ont-query-server",
  "displayName": "本体查询 MCP Server",
  "description": "暴露 Ontology 概念查询与知识图谱检索能力",
  "transport": {
    "type": "STREAMABLE_HTTP",
    "config": {
      "endpoint": "/api/v1/mcp/servers/{serverId}/rpc",
      "host": "0.0.0.0",
      "port": 8080,
      "enableSSEFallback": true
    }
  },
  "protocolVersion": "2025-06-18",
  "authConfig": {
    "type": "API_KEY",
    "apiKeys": ["mcpk_a1b2c3d4e5f6g7h8"]
  },
  "toolBindings": ["tool-001", "tool-002", "tool-003"],
  "resourceBindings": ["res-001", "res-002"],
  "promptBindings": ["prompt-001"],
  "rateLimit": {
    "maxRequestsPerMinute": 200,
    "maxRequestsPerHour": 10000
  },
  "tags": ["ontology", "query", "production"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "name": "ont-query-server",
    "displayName": "本体查询 MCP Server",
    "description": "暴露 Ontology 概念查询与知识图谱检索能力",
    "transport": {
      "type": "STREAMABLE_HTTP",
      "config": {
        "endpoint": "/api/v1/mcp/servers/srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7/rpc",
        "host": "0.0.0.0",
        "port": 8080,
        "enableSSEFallback": true
      }
    },
    "protocolVersion": "2025-06-18",
    "authConfig": {
      "type": "API_KEY",
      "apiKeys": ["mcpk_a1b2c3d4e5f6g7h8"]
    },
    "toolBindings": ["tool-001", "tool-002", "tool-003"],
    "resourceBindings": ["res-001", "res-002"],
    "promptBindings": ["prompt-001"],
    "rateLimit": {
      "maxRequestsPerMinute": 200,
      "maxRequestsPerHour": 10000
    },
    "tags": ["ontology", "query", "production"],
    "status": "CREATED",
    "rpcEndpoint": "/api/v1/mcp/servers/srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7/rpc",
    "sseEndpoint": "/api/v1/mcp/servers/srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7/sse",
    "createdAt": "2026-07-16T19:00:00Z",
    "updatedAt": "2026-07-16T19:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| code | 场景 |
|---|---|
| 40001 | 必填字段缺失或格式错误 |
| 40901 | Server 名称已存在 |
| 42201 | 传输配置不合法（如端口已被占用） |
| 42202 | 协议版本不支持 |

---

#### 3.1.2 查询 MCP Server 列表

**GET** `/api/v1/mcp/servers`

查询当前租户下的 MCP Server 实例列表，支持按状态、标签、传输类型筛选。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| pageSize | int | 否 | 每页条数，默认 20 |
| status | string | 否 | 状态筛选：`CREATED`、`RUNNING`、`STOPPED`、`ERROR` |
| transportType | string | 否 | 传输类型筛选 |
| tag | string | 否 | 标签筛选 |
| keyword | string | 否 | 名称/显示名称模糊搜索 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
        "name": "ont-query-server",
        "displayName": "本体查询 MCP Server",
        "transport": { "type": "STREAMABLE_HTTP" },
        "status": "RUNNING",
        "toolCount": 5,
        "resourceCount": 2,
        "promptCount": 1,
        "tags": ["ontology", "query"],
        "createdAt": "2026-07-16T19:00:00Z",
        "updatedAt": "2026-07-16T19:05:00Z"
      },
      {
        "serverId": "srv-a1b2c3d4-e5f6-7890-abcd-ef1234567891",
        "name": "rag-search-server",
        "displayName": "知识库检索 MCP Server",
        "transport": { "type": "HTTP_SSE" },
        "status": "RUNNING",
        "toolCount": 3,
        "resourceCount": 0,
        "promptCount": 2,
        "tags": ["rag", "search"],
        "createdAt": "2026-07-16T18:00:00Z",
        "updatedAt": "2026-07-16T18:30:00Z"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20,
    "hasNext": false,
    "nextCursor": null
  },
  "traceId": "xxx"
}
```

---

#### 3.1.3 获取 MCP Server 详情

**GET** `/api/v1/mcp/servers/{serverId}`

获取指定 MCP Server 实例的完整配置信息，包括绑定的 Tools / Resources / Prompts 清单。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| serverId | string | Server 实例 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "name": "ont-query-server",
    "displayName": "本体查询 MCP Server",
    "description": "暴露 Ontology 概念查询与知识图谱检索能力",
    "transport": {
      "type": "STREAMABLE_HTTP",
      "config": {
        "endpoint": "/api/v1/mcp/servers/srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7/rpc",
        "host": "0.0.0.0",
        "port": 8080,
        "enableSSEFallback": true
      }
    },
    "protocolVersion": "2025-06-18",
    "authConfig": {
      "type": "API_KEY",
      "apiKeys": ["mcpk_a1b2c3d4e5f6g7h8"]
    },
    "tools": [
      {
        "toolId": "tool-001",
        "name": "search_concepts",
        "displayName": "搜索本体概念",
        "description": "根据关键词搜索本体中的概念定义"
      },
      {
        "toolId": "tool-002",
        "name": "get_entity_relations",
        "displayName": "获取实体关系",
        "description": "查询指定实体的关联关系"
      }
    ],
    "resources": [
      {
        "resourceId": "res-001",
        "uri": "ont://concepts/CRM.Customer",
        "name": "客户概念定义",
        "mimeType": "application/json"
      }
    ],
    "prompts": [
      {
        "promptId": "prompt-001",
        "name": "ontology-analysis-template",
        "description": "本体分析提示模板"
      }
    ],
    "rateLimit": {
      "maxRequestsPerMinute": 200,
      "maxRequestsPerHour": 10000
    },
    "status": "RUNNING",
    "rpcEndpoint": "/api/v1/mcp/servers/srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7/rpc",
    "sseEndpoint": "/api/v1/mcp/servers/srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7/sse",
    "stats": {
      "totalCalls": 1542,
      "totalErrors": 3,
      "avgLatencyMs": 120,
      "lastCallAt": "2026-07-16T18:58:00Z"
    },
    "createdAt": "2026-07-16T19:00:00Z",
    "updatedAt": "2026-07-16T19:05:00Z"
  },
  "traceId": "xxx"
}
```

**错误场景**

| code | 场景 |
|---|---|
| 40401 | Server 不存在 |
| 40302 | 无权访问该租户的 Server |

---

#### 3.1.4 更新 MCP Server 配置

**PUT** `/api/v1/mcp/servers/{serverId}`

更新 MCP Server 实例的配置。Server 处于 `RUNNING` 状态时更新将触发热重载。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| serverId | string | Server 实例 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| displayName | string | 否 | 显示名称 |
| description | string | 否 | 描述信息 |
| transport | object | 否 | 传输配置（修改传输类型需先停止 Server） |
| authConfig | object | 否 | 认证配置 |
| rateLimit | object | 否 | 速率限制配置 |
| tags | string[] | 否 | 标签列表 |

**请求示例**

```json
{
  "displayName": "本体查询 MCP Server (v2)",
  "description": "更新后的描述",
  "rateLimit": {
    "maxRequestsPerMinute": 500,
    "maxRequestsPerHour": 30000
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "displayName": "本体查询 MCP Server (v2)",
    "description": "更新后的描述",
    "rateLimit": {
      "maxRequestsPerMinute": 500,
      "maxRequestsPerHour": 30000
    },
    "status": "RUNNING",
    "hotReloaded": true,
    "updatedAt": "2026-07-16T19:10:00Z"
  },
  "traceId": "xxx"
}
```

**错误场景**

| code | 场景 |
|---|---|
| 40401 | Server 不存在 |
| 40902 | 试图修改传输类型但 Server 仍在运行 |

---

#### 3.1.5 删除 MCP Server

**DELETE** `/api/v1/mcp/servers/{serverId}`

删除 MCP Server 实例。Server 处于 `RUNNING` 状态时将先自动停止再删除。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| serverId | string | Server 实例 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| force | boolean | 否 | 是否强制删除（忽略运行中状态），默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "deleted": true,
    "stoppedBeforeDelete": true
  },
  "traceId": "xxx"
}
```

**错误场景**

| code | 场景 |
|---|---|
| 40401 | Server 不存在 |
| 40902 | Server 正在运行且 force=false |

---

#### 3.1.6 启动 MCP Server

**POST** `/api/v1/mcp/servers/{serverId}/start`

启动指定的 MCP Server 实例，使其开始接受外部 MCP Client 连接。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| serverId | string | Server 实例 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "status": "RUNNING",
    "startedAt": "2026-07-16T19:15:00Z",
    "rpcEndpoint": "/api/v1/mcp/servers/srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7/rpc",
    "sseEndpoint": "/api/v1/mcp/servers/srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7/sse"
  },
  "traceId": "xxx"
}
```

**错误场景**

| code | 场景 |
|---|---|
| 40401 | Server 不存在 |
| 40902 | Server 已在运行中 |
| 50005 | Server 启动失败（端口冲突、配置错误等） |
| 50302 | Server 正在启动中 |

---

#### 3.1.7 停止 MCP Server

**POST** `/api/v1/mcp/servers/{serverId}/stop`

停止指定的 MCP Server 实例，断开所有活跃连接。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| serverId | string | Server 实例 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| graceful | boolean | 否 | 是否优雅停止（等待活跃请求完成），默认 true |
| timeoutMs | int | 否 | 优雅停止超时时间（毫秒），默认 30000 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "status": "STOPPED",
    "stoppedAt": "2026-07-16T19:20:00Z",
    "activeConnectionsClosed": 3
  },
  "traceId": "xxx"
}
```

**错误场景**

| code | 场景 |
|---|---|
| 40401 | Server 不存在 |
| 40902 | Server 已停止 |

---

#### 3.1.8 配置 Server 暴露的 Tools

**PUT** `/api/v1/mcp/servers/{serverId}/tools`

更新 Server 实例绑定的 Tool 列表，支持增量更新。变更后向已连接的 Client 发送 `notifications/tools/list_changed` 通知。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| serverId | string | Server 实例 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| toolIds | string[] | 是 | Tool ID 列表（全量替换） |
| mode | string | 否 | 更新模式：`REPLACE`（全量替换，默认）、`ADD`（增量添加）、`REMOVE`（移除） |

**请求示例**

```json
{
  "toolIds": ["tool-001", "tool-002", "tool-003", "tool-004"],
  "mode": "REPLACE"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "toolIds": ["tool-001", "tool-002", "tool-003", "tool-004"],
    "toolCount": 4,
    "notificationSent": true,
    "updatedAt": "2026-07-16T19:25:00Z"
  },
  "traceId": "xxx"
}
```

**错误场景**

| code | 场景 |
|---|---|
| 40401 | Server 不存在 |
| 40403 | 绑定的 Tool ID 不存在或已禁用 |

---

#### 3.1.9 配置 Server 暴露的 Resources

**PUT** `/api/v1/mcp/servers/{serverId}/resources`

更新 Server 实例绑定的 Resource 列表。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| serverId | string | Server 实例 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| resourceIds | string[] | 是 | Resource ID 列表 |
| mode | string | 否 | 更新模式：`REPLACE`（默认）、`ADD`、`REMOVE` |

**请求示例**

```json
{
  "resourceIds": ["res-001", "res-002", "res-003"],
  "mode": "ADD"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "resourceIds": ["res-001", "res-002", "res-003"],
    "resourceCount": 3,
    "notificationSent": true,
    "updatedAt": "2026-07-16T19:30:00Z"
  },
  "traceId": "xxx"
}
```

---

#### 3.1.10 配置 Server 暴露的 Prompts

**PUT** `/api/v1/mcp/servers/{serverId}/prompts`

更新 Server 实例绑定的 Prompt 模板列表。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| serverId | string | Server 实例 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| promptIds | string[] | 是 | Prompt 模板 ID 列表 |
| mode | string | 否 | 更新模式：`REPLACE`（默认）、`ADD`、`REMOVE` |

**请求示例**

```json
{
  "promptIds": ["prompt-001", "prompt-002"],
  "mode": "REPLACE"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "promptIds": ["prompt-001", "prompt-002"],
    "promptCount": 2,
    "notificationSent": true,
    "updatedAt": "2026-07-16T19:35:00Z"
  },
  "traceId": "xxx"
}
```

---

#### 3.1.11 获取 Server 能力清单（MCP JSON-RPC）

**POST** `/api/v1/mcp/servers/{serverId}/rpc`

通过 MCP JSON-RPC 协议获取 Server 暴露的能力清单。支持 `tools/list`、`resources/list`、`prompts/list` 方法。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| serverId | string | Server 实例 ID |

**请求参数（JSON-RPC Body）**

tools/list 请求示例：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {
    "cursor": null
  }
}
```

**tools/list 响应示例**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "search_concepts",
        "description": "根据关键词搜索本体中的概念定义",
        "inputSchema": {
          "type": "object",
          "properties": {
            "keyword": {
              "type": "string",
              "description": "搜索关键词"
            },
            "domain": {
              "type": "string",
              "description": "概念域筛选",
              "enum": ["CRM", "SCM", "FIN", "HR"]
            },
            "limit": {
              "type": "integer",
              "description": "返回数量上限",
              "default": 10,
              "maximum": 50
            }
          },
          "required": ["keyword"]
        },
        "annotations": {
          "title": "搜索本体概念",
          "category": "ontology",
          "destructiveHint": false,
          "idempotentHint": true,
          "openWorldHint": false,
          "readOnlyHint": true
        }
      },
      {
        "name": "get_entity_relations",
        "description": "查询指定实体的关联关系",
        "inputSchema": {
          "type": "object",
          "properties": {
            "entityId": {
              "type": "string",
              "description": "实体 ID"
            },
            "relationType": {
              "type": "string",
              "description": "关系类型筛选"
            },
            "depth": {
              "type": "integer",
              "description": "查询深度",
              "default": 1,
              "maximum": 3
            }
          },
          "required": ["entityId"]
        }
      }
    ],
    "nextCursor": null
  }
}
```

**resources/list 响应示例**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "resources/list",
  "result": {
    "resources": [
      {
        "uri": "ont://concepts/CRM.Customer",
        "name": "客户概念定义",
        "description": "CRM 域客户概念的本体定义",
        "mimeType": "application/json"
      },
      {
        "uri": "ont://schemas/OrderItem",
        "name": "订单项 Schema",
        "description": "订单项实体的数据 Schema",
        "mimeType": "application/json"
      }
    ],
    "nextCursor": null
  }
}
```

**prompts/list 响应示例**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "prompts": [
      {
        "name": "ontology-analysis-template",
        "description": "本体分析提示模板",
        "arguments": [
          {
            "name": "conceptName",
            "description": "要分析的概念名称",
            "required": true
          },
          {
            "name": "analysisDepth",
            "description": "分析深度",
            "required": false,
            "default": "shallow"
          }
        ]
      }
    ]
  }
}
```

**错误场景**

| JSON-RPC code | 场景 |
|---|---|
| -32000 | Server 未运行 |
| -32005 | 认证失败 |
| -32601 | 方法不支持 |

---

#### 3.1.12 获取 Server 运行状态

**GET** `/api/v1/mcp/servers/{serverId}/status`

获取 Server 实例的实时运行状态，包括连接数、QPS、错误率等指标。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| serverId | string | Server 实例 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "status": "RUNNING",
    "uptime": "2h35m",
    "activeConnections": 5,
    "stats": {
      "requestsPerMinute": 12,
      "totalRequests": 1542,
      "totalErrors": 3,
      "errorRate": 0.19,
      "avgLatencyMs": 120,
      "p50LatencyMs": 95,
      "p90LatencyMs": 210,
      "p99LatencyMs": 450
    },
    "toolCallStats": [
      {
        "toolName": "search_concepts",
        "callCount": 820,
        "errorCount": 1,
        "avgLatencyMs": 85
      },
      {
        "toolName": "get_entity_relations",
        "callCount": 722,
        "errorCount": 2,
        "avgLatencyMs": 155
      }
    ],
    "lastError": {
      "timestamp": "2026-07-16T18:45:00Z",
      "toolName": "get_entity_relations",
      "errorCode": "50003",
      "errorMessage": "TECH-ONT 服务超时"
    }
  },
  "traceId": "xxx"
}
```

---

### 3.2 MCP Client 管理 API

MCP Client 用于连接第三方 MCP Server，发现并调用其暴露的 Tools / Resources / Prompts，将外部工具纳入平台统一管理。

#### 3.2.1 创建 MCP Client 连接

**POST** `/api/v1/mcp/clients`

创建一个新的 MCP Client 连接，配置第三方 MCP Server 的连接信息。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | Client 连接名称，租户内唯一 |
| displayName | string | 是 | 显示名称 |
| description | string | 否 | 描述信息 |
| serverConfig | object | 是 | 第三方 Server 连接配置 |
| serverConfig.transportType | string | 是 | 传输类型：`STDIO`、`HTTP_SSE`、`STREAMABLE_HTTP` |
| serverConfig.command | string | 否 | STDIO 模式下的启动命令 |
| serverConfig.args | string[] | 否 | STDIO 模式下的命令参数 |
| serverConfig.env | object | 否 | STDIO 模式下的环境变量 |
| serverConfig.url | string | 否 | HTTP 模式下的 Server URL |
| serverConfig.headers | object | 否 | HTTP 模式下的自定义请求头 |
| serverConfig.sseEndpoint | string | 否 | SSE 端点路径 |
| serverConfig.messageEndpoint | string | 否 | 消息端点路径 |
| authConfig | object | 否 | 认证配置 |
| authConfig.type | string | 否 | 认证类型：`API_KEY`、`BEARER_TOKEN`、`OAUTH2`、`NONE` |
| authConfig.credentials | object | 否 | 凭证信息（加密存储） |
| protocolVersion | string | 否 | 期望的 MCP 协议版本，默认 `2025-06-18` |
| autoConnect | boolean | 否 | 创建后是否自动连接，默认 true |
| autoReconnect | boolean | 否 | 连接断开后是否自动重连，默认 true |
| reconnectConfig | object | 否 | 重连配置 |
| reconnectConfig.maxAttempts | int | 否 | 最大重连次数，默认 5 |
| reconnectConfig.interval | int | 否 | 重连间隔（毫秒），默认 5000 |
| reconnectConfig.backoff | string | 否 | 退避策略：`FIXED`、`EXPONENTIAL` |
| healthCheck | object | 否 | 健康检查配置 |
| healthCheck.enabled | boolean | 否 | 是否启用健康检查，默认 true |
| healthCheck.interval | int | 否 | 检查间隔（毫秒），默认 30000 |
| tags | string[] | 否 | 标签列表 |

**请求示例**

```json
{
  "name": "external-github-mcp",
  "displayName": "GitHub MCP Server 连接",
  "description": "连接企业内部 GitHub MCP Server，调用仓库管理工具",
  "serverConfig": {
    "transportType": "STREAMABLE_HTTP",
    "url": "https://mcp.github.internal.company.com/api/v1/mcp",
    "headers": {
      "X-Custom-Header": "value"
    }
  },
  "authConfig": {
    "type": "BEARER_TOKEN",
    "credentials": {
      "token": "ghp_xxxxxxxxxxxx"
    }
  },
  "protocolVersion": "2025-06-18",
  "autoConnect": true,
  "autoReconnect": true,
  "reconnectConfig": {
    "maxAttempts": 5,
    "interval": 5000,
    "backoff": "EXPONENTIAL"
  },
  "healthCheck": {
    "enabled": true,
    "interval": 30000
  },
  "tags": ["github", "external", "devops"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "clientId": "cli-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "external-github-mcp",
    "displayName": "GitHub MCP Server 连接",
    "serverConfig": {
      "transportType": "STREAMABLE_HTTP",
      "url": "https://mcp.github.internal.company.com/api/v1/mcp"
    },
    "authConfig": {
      "type": "BEARER_TOKEN"
    },
    "protocolVersion": "2025-06-18",
    "autoReconnect": true,
    "status": "CONNECTED",
    "connectedAt": "2026-07-16T19:40:00Z",
    "serverInfo": {
      "name": "github-mcp-server",
      "version": "1.2.0",
      "protocolVersion": "2025-06-18",
      "capabilities": {
        "tools": { "listChanged": true },
        "resources": { "subscribe": true, "listChanged": true },
        "prompts": { "listChanged": true }
      }
    },
    "createdAt": "2026-07-16T19:40:00Z",
    "updatedAt": "2026-07-16T19:40:00Z"
  },
  "traceId": "xxx"
}
```

**错误场景**

| code | 场景 |
|---|---|
| 40001 | 必填字段缺失 |
| 40901 | 连接名称已存在 |
| 40404 | 第三方 Server 不可达 |
| 50004 | 连接握手失败（协议版本不兼容、认证失败等） |

---

#### 3.2.2 查询 Client 连接列表

**GET** `/api/v1/mcp/clients`

查询当前租户下的 MCP Client 连接列表。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| pageSize | int | 否 | 每页条数，默认 20 |
| status | string | 否 | 状态筛选：`CONNECTED`、`DISCONNECTED`、`CONNECTING`、`ERROR` |
| keyword | string | 否 | 名称模糊搜索 |
| tag | string | 否 | 标签筛选 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "clientId": "cli-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "external-github-mcp",
        "displayName": "GitHub MCP Server 连接",
        "serverConfig": {
          "transportType": "STREAMABLE_HTTP",
          "url": "https://mcp.github.internal.company.com/api/v1/mcp"
        },
        "status": "CONNECTED",
        "serverInfo": {
          "name": "github-mcp-server",
          "version": "1.2.0"
        },
        "toolCount": 8,
        "resourceCount": 3,
        "promptCount": 0,
        "lastConnectedAt": "2026-07-16T19:40:00Z",
        "createdAt": "2026-07-16T19:40:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "hasNext": false,
    "nextCursor": null
  },
  "traceId": "xxx"
}
```

---

#### 3.2.3 获取 Client 连接详情

**GET** `/api/v1/mcp/clients/{clientId}`

获取指定 MCP Client 连接的完整配置信息与连接状态。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| clientId | string | Client 连接 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "clientId": "cli-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "external-github-mcp",
    "displayName": "GitHub MCP Server 连接",
    "description": "连接企业内部 GitHub MCP Server，调用仓库管理工具",
    "serverConfig": {
      "transportType": "STREAMABLE_HTTP",
      "url": "https://mcp.github.internal.company.com/api/v1/mcp",
      "headers": {
        "X-Custom-Header": "value"
      }
    },
    "authConfig": {
      "type": "BEARER_TOKEN"
    },
    "protocolVersion": "2025-06-18",
    "autoReconnect": true,
    "reconnectConfig": {
      "maxAttempts": 5,
      "interval": 5000,
      "backoff": "EXPONENTIAL"
    },
    "healthCheck": {
      "enabled": true,
      "interval": 30000,
      "lastCheckAt": "2026-07-16T19:45:00Z",
      "lastCheckResult": "HEALTHY"
    },
    "status": "CONNECTED",
    "serverInfo": {
      "name": "github-mcp-server",
      "version": "1.2.0",
      "protocolVersion": "2025-06-18",
      "capabilities": {
        "tools": { "listChanged": true },
        "resources": { "subscribe": true, "listChanged": true },
        "prompts": { "listChanged": true }
      }
    },
    "stats": {
      "totalCalls": 234,
      "totalErrors": 1,
      "avgLatencyMs": 180,
      "lastCallAt": "2026-07-16T19:43:00Z"
    },
    "connectedAt": "2026-07-16T19:40:00Z",
    "createdAt": "2026-07-16T19:40:00Z",
    "updatedAt": "2026-07-16T19:40:00Z"
  },
  "traceId": "xxx"
}
```

---

#### 3.2.4 更新 Client 连接配置

**PUT** `/api/v1/mcp/clients/{clientId}`

更新 MCP Client 连接配置。修改连接配置将触发重新连接。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| clientId | string | Client 连接 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| displayName | string | 否 | 显示名称 |
| description | string | 否 | 描述信息 |
| serverConfig | object | 否 | Server 连接配置 |
| authConfig | object | 否 | 认证配置 |
| autoReconnect | boolean | 否 | 是否自动重连 |
| reconnectConfig | object | 否 | 重连配置 |
| healthCheck | object | 否 | 健康检查配置 |
| tags | string[] | 否 | 标签列表 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "clientId": "cli-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "displayName": "GitHub MCP Server 连接 (v2)",
    "status": "CONNECTED",
    "reconnected": true,
    "updatedAt": "2026-07-16T19:50:00Z"
  },
  "traceId": "xxx"
}
```

---

#### 3.2.5 删除 Client 连接

**DELETE** `/api/v1/mcp/clients/{clientId}`

删除 MCP Client 连接，断开与第三方 Server 的连接。已注册的外部 Tool 将被标记为 `UNAVAILABLE`。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| clientId | string | Client 连接 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "clientId": "cli-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "deleted": true,
    "disconnected": true,
    "affectedTools": [
      { "toolId": "tool-ext-001", "name": "github_create_issue", "status": "UNAVAILABLE" },
      { "toolId": "tool-ext-002", "name": "github_list_repos", "status": "UNAVAILABLE" }
    ]
  },
  "traceId": "xxx"
}
```

---

#### 3.2.6 测试 Client 连接

**POST** `/api/v1/mcp/clients/{clientId}/test`

测试与第三方 MCP Server 的连接，执行 `initialize` 握手并返回结果。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| clientId | string | Client 连接 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "clientId": "cli-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "testResult": "SUCCESS",
    "latencyMs": 45,
    "serverInfo": {
      "name": "github-mcp-server",
      "version": "1.2.0",
      "protocolVersion": "2025-06-18"
    },
    "capabilities": {
      "tools": { "listChanged": true },
      "resources": { "subscribe": true, "listChanged": true },
      "prompts": { "listChanged": true }
    },
    "testedAt": "2026-07-16T19:55:00Z"
  },
  "traceId": "xxx"
}
```

**错误场景**

| code | 场景 |
|---|---|
| 40401 | Client 不存在 |
| 40404 | 第三方 Server 不可达 |
| 50004 | 握手失败 |
| 42202 | 协议版本不兼容 |

---

#### 3.2.7 获取 Client 连接状态

**GET** `/api/v1/mcp/clients/{clientId}/status`

获取 Client 连接的实时状态与统计信息。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| clientId | string | Client 连接 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "clientId": "cli-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "CONNECTED",
    "uptime": "0h15m",
    "reconnectCount": 0,
    "healthCheck": {
      "lastCheckAt": "2026-07-16T19:55:00Z",
      "lastCheckResult": "HEALTHY",
      "consecutiveFailures": 0
    },
    "stats": {
      "requestsPerMinute": 3,
      "totalRequests": 234,
      "totalErrors": 1,
      "errorRate": 0.43,
      "avgLatencyMs": 180,
      "p50LatencyMs": 150,
      "p90LatencyMs": 280,
      "p99LatencyMs": 520
    }
  },
  "traceId": "xxx"
}
```

---

#### 3.2.8 发现第三方 Server 的 Tools

**POST** `/api/v1/mcp/clients/{clientId}/discover/tools`

向第三方 MCP Server 发送 `tools/list` 请求，发现其暴露的所有 Tools，并自动注册到平台 Tool 注册中心（标记为外部 Tool）。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| clientId | string | Client 连接 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| autoRegister | boolean | 否 | 是否自动注册到 Tool 注册中心，默认 true |
| category | string | 否 | 注册时指定的分类 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "clientId": "cli-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "discoveredTools": [
      {
        "name": "github_create_issue",
        "description": "在指定仓库创建 Issue",
        "inputSchema": {
          "type": "object",
          "properties": {
            "repo": { "type": "string", "description": "仓库名称 owner/repo" },
            "title": { "type": "string" },
            "body": { "type": "string" },
            "labels": { "type": "array", "items": { "type": "string" } }
          },
          "required": ["repo", "title"]
        },
        "registeredToolId": "tool-ext-001",
        "registrationStatus": "REGISTERED"
      },
      {
        "name": "github_list_repos",
        "description": "列出用户/组织的仓库",
        "inputSchema": {
          "type": "object",
          "properties": {
            "owner": { "type": "string" },
            "type": { "type": "string", "enum": ["all", "public", "private"] }
          }
        },
        "registeredToolId": "tool-ext-002",
        "registrationStatus": "REGISTERED"
      },
      {
        "name": "github_create_pr",
        "description": "创建 Pull Request",
        "inputSchema": {
          "type": "object",
          "properties": {
            "repo": { "type": "string" },
            "head": { "type": "string" },
            "base": { "type": "string" },
            "title": { "type": "string" },
            "body": { "type": "string" }
          },
          "required": ["repo", "head", "base", "title"]
        },
        "registeredToolId": "tool-ext-003",
        "registrationStatus": "REGISTERED"
      }
    ],
    "totalDiscovered": 3,
    "totalRegistered": 3,
    "discoveredAt": "2026-07-16T20:00:00Z"
  },
  "traceId": "xxx"
}
```

**错误场景**

| code | 场景 |
|---|---|
| 40401 | Client 不存在 |
| 40404 | 连接已断开 |
| 50004 | tools/list 请求失败 |

---

#### 3.2.9 发现第三方 Server 的 Resources

**POST** `/api/v1/mcp/clients/{clientId}/discover/resources`

向第三方 MCP Server 发送 `resources/list` 请求，发现其暴露的 Resources。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| clientId | string | Client 连接 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| autoRegister | boolean | 否 | 是否自动注册到平台 Resource 注册中心，默认 true |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "clientId": "cli-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "discoveredResources": [
      {
        "uri": "github://repos/metaplatform/docs",
        "name": "MetaPlatform 文档仓库",
        "description": "MetaPlatform 项目文档仓库信息",
        "mimeType": "application/json",
        "registeredResourceId": "res-ext-001",
        "registrationStatus": "REGISTERED"
      }
    ],
    "totalDiscovered": 1,
    "totalRegistered": 1,
    "discoveredAt": "2026-07-16T20:05:00Z"
  },
  "traceId": "xxx"
}
```

---

#### 3.2.10 发现第三方 Server 的 Prompts

**POST** `/api/v1/mcp/clients/{clientId}/discover/prompts`

向第三方 MCP Server 发送 `prompts/list` 请求，发现其暴露的 Prompt 模板。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| clientId | string | Client 连接 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| autoRegister | boolean | 否 | 是否自动注册到平台 Prompt 注册中心，默认 true |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "clientId": "cli-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "discoveredPrompts": [
      {
        "name": "code-review-prompt",
        "description": "GitHub 代码审查提示模板",
        "arguments": [
          {
            "name": "repo",
            "description": "仓库名称",
            "required": true
          },
          {
            "name": "prNumber",
            "description": "PR 编号",
            "required": true
          }
        ],
        "registeredPromptId": "prompt-ext-001",
        "registrationStatus": "REGISTERED"
      }
    ],
    "totalDiscovered": 1,
    "totalRegistered": 1,
    "discoveredAt": "2026-07-16T20:10:00Z"
  },
  "traceId": "xxx"
}
```

---

### 3.3 Tool 注册中心 API

Tool 注册中心是平台统一的 Tool 管理入口，管理内部 Tool（平台原生能力封装）和外部 Tool（第三方 MCP Server 暴露的 Tool）。所有 Tool 统一注册、统一搜索、统一路由。

#### 3.3.1 注册 Tool

**POST** `/api/v1/mcp/tools`

注册一个新的 Tool。内部 Tool 需配置执行逻辑，外部 Tool 由 Client 发现时自动注册。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | Tool 名称，全局唯一，小写字母+下划线 |
| displayName | string | 是 | 显示名称 |
| description | string | 是 | Tool 描述，供 AI 理解 Tool 用途 |
| source | string | 是 | Tool 来源：`INTERNAL`（平台原生）、`EXTERNAL`（第三方 MCP） |
| clientId | string | 否 | 来源 Client ID（source=EXTERNAL 时必填） |
| externalName | string | 否 | 第三方 Server 上的原始 Tool 名称（source=EXTERNAL 时必填） |
| category | string | 否 | 分类：`ontology`、`rag`、`action`、`data`、`integration`、`ai`、`external` |
| inputSchema | object | 是 | 输入参数 JSON Schema |
| outputSchema | object | 否 | 输出参数 JSON Schema |
| execution | object | 否 | 执行配置（source=INTERNAL 时必填） |
| execution.type | string | 否 | 执行类型：`HTTP`、`BEAN`、`ACTION` |
| execution.config | object | 否 | 执行配置详情 |
| annotations | object | 否 | MCP Tool 注解 |
| annotations.title | string | 否 | 人类可读标题 |
| annotations.destructiveHint | boolean | 否 | 是否有破坏性副作用，默认 false |
| annotations.idempotentHint | boolean | 否 | 是否幂等，默认 false |
| annotations.openWorldHint | boolean | 否 | 是否与外部世界交互，默认 false |
| annotations.readOnlyHint | boolean | 否 | 是否只读，默认 false |
| timeout | int | 否 | 执行超时时间（毫秒），默认 30000 |
| tags | string[] | 否 | 标签列表 |
| enabled | boolean | 否 | 是否启用，默认 true |

**execution.config 结构**

| type | config 字段 |
|---|---|
| HTTP | `method`、`url`、`headers`、`bodyTemplate`（支持变量替换 `${arg.fieldName}`）、`authType`、`authConfig` |
| BEAN | `beanName`（Spring Bean 名称）、`methodName`（调用方法） |
| ACTION | `actionId`（TECH-ACTION 中的 Action ID） |

**请求示例**

```json
{
  "name": "search_knowledge_base",
  "displayName": "搜索知识库",
  "description": "在指定知识库中进行语义检索，返回最相关的文档片段。支持向量检索、关键词检索和混合检索模式。",
  "source": "INTERNAL",
  "category": "rag",
  "inputSchema": {
    "type": "object",
    "properties": {
      "kbId": {
        "type": "string",
        "description": "知识库 ID"
      },
      "query": {
        "type": "string",
        "description": "检索查询文本"
      },
      "mode": {
        "type": "string",
        "description": "检索模式",
        "enum": ["vector", "keyword", "hybrid"],
        "default": "hybrid"
      },
      "topK": {
        "type": "integer",
        "description": "返回结果数量",
        "default": 5,
        "minimum": 1,
        "maximum": 20
      },
      "scoreThreshold": {
        "type": "number",
        "description": "相似度阈值",
        "minimum": 0,
        "maximum": 1
      }
    },
    "required": ["kbId", "query"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "results": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "content": { "type": "string" },
            "score": { "type": "number" },
            "source": { "type": "string" }
          }
        }
      },
      "total": { "type": "integer" }
    }
  },
  "execution": {
    "type": "HTTP",
    "config": {
      "method": "POST",
      "url": "http://tech-rag:8080/api/v1/rag/retrieve/hybrid",
      "headers": {
        "Content-Type": "application/json"
      },
      "bodyTemplate": {
        "kbId": "${kbId}",
        "query": "${query}",
        "mode": "${mode}",
        "topK": "${topK}",
        "scoreThreshold": "${scoreThreshold}"
      }
    }
  },
  "annotations": {
    "title": "搜索知识库",
    "destructiveHint": false,
    "idempotentHint": true,
    "openWorldHint": false,
    "readOnlyHint": true
  },
  "timeout": 15000,
  "tags": ["rag", "search", "knowledge"],
  "enabled": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "toolId": "tool-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "name": "search_knowledge_base",
    "displayName": "搜索知识库",
    "description": "在指定知识库中进行语义检索...",
    "source": "INTERNAL",
    "category": "rag",
    "inputSchema": { },
    "outputSchema": { },
    "execution": {
      "type": "HTTP",
      "config": { }
    },
    "annotations": {
      "title": "搜索知识库",
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": false,
      "readOnlyHint": true
    },
    "timeout": 15000,
    "tags": ["rag", "search", "knowledge"],
    "enabled": true,
    "status": "ACTIVE",
    "version": 1,
    "createdAt": "2026-07-16T20:15:00Z",
    "updatedAt": "2026-07-16T20:15:00Z"
  },
  "traceId": "xxx"
}
```

**错误场景**

| code | 场景 |
|---|---|
| 40001 | 必填字段缺失或 JSON Schema 格式错误 |
| 40903 | Tool 名称已存在 |
| 42201 | 执行配置不合法（如 URL 格式错误） |

---

#### 3.3.2 查询 Tool 列表

**GET** `/api/v1/mcp/tools`

查询 Tool 注册中心中的 Tool 列表，支持按来源、分类、状态、标签筛选。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| pageSize | int | 否 | 每页条数，默认 20 |
| source | string | 否 | 来源筛选：`INTERNAL`、`EXTERNAL` |
| category | string | 否 | 分类筛选 |
| enabled | boolean | 否 | 启用状态筛选 |
| tag | string | 否 | 标签筛选 |
| keyword | string | 否 | 名称/描述模糊搜索 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "toolId": "tool-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
        "name": "search_knowledge_base",
        "displayName": "搜索知识库",
        "description": "在指定知识库中进行语义检索...",
        "source": "INTERNAL",
        "category": "rag",
        "enabled": true,
        "status": "ACTIVE",
        "tags": ["rag", "search"],
        "callCount": 342,
        "version": 1,
        "createdAt": "2026-07-16T20:15:00Z",
        "updatedAt": "2026-07-16T20:15:00Z"
      },
      {
        "toolId": "tool-ext-001",
        "name": "github_create_issue",
        "displayName": "创建 GitHub Issue",
        "description": "在指定仓库创建 Issue",
        "source": "EXTERNAL",
        "category": "external",
        "clientId": "cli-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "enabled": true,
        "status": "ACTIVE",
        "tags": ["github", "issue"],
        "callCount": 15,
        "version": 1,
        "createdAt": "2026-07-16T20:00:00Z",
        "updatedAt": "2026-07-16T20:00:00Z"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20,
    "hasNext": false,
    "nextCursor": null
  },
  "traceId": "xxx"
}
```

---

#### 3.3.3 获取 Tool 详情

**GET** `/api/v1/mcp/tools/{toolId}`

获取指定 Tool 的完整配置信息，包括 JSON Schema、执行配置、注解等。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| toolId | string | Tool ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "toolId": "tool-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "name": "search_knowledge_base",
    "displayName": "搜索知识库",
    "description": "在指定知识库中进行语义检索，返回最相关的文档片段。支持向量检索、关键词检索和混合检索模式。",
    "source": "INTERNAL",
    "category": "rag",
    "inputSchema": {
      "type": "object",
      "properties": {
        "kbId": { "type": "string", "description": "知识库 ID" },
        "query": { "type": "string", "description": "检索查询文本" },
        "mode": { "type": "string", "enum": ["vector", "keyword", "hybrid"], "default": "hybrid" },
        "topK": { "type": "integer", "default": 5, "minimum": 1, "maximum": 20 },
        "scoreThreshold": { "type": "number", "minimum": 0, "maximum": 1 }
      },
      "required": ["kbId", "query"]
    },
    "outputSchema": { },
    "execution": {
      "type": "HTTP",
      "config": {
        "method": "POST",
        "url": "http://tech-rag:8080/api/v1/rag/retrieve/hybrid",
        "headers": { "Content-Type": "application/json" },
        "bodyTemplate": { }
      }
    },
    "annotations": {
      "title": "搜索知识库",
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": false,
      "readOnlyHint": true
    },
    "timeout": 15000,
    "tags": ["rag", "search", "knowledge"],
    "enabled": true,
    "status": "ACTIVE",
    "version": 2,
    "stats": {
      "callCount": 342,
      "errorCount": 2,
      "avgLatencyMs": 95,
      "lastCallAt": "2026-07-16T20:30:00Z"
    },
    "serverBindings": [
      { "serverId": "srv-a1b2c3d4-e5f6-7890-abcd-ef1234567891", "serverName": "rag-search-server" }
    ],
    "createdAt": "2026-07-16T20:15:00Z",
    "updatedAt": "2026-07-16T20:20:00Z"
  },
  "traceId": "xxx"
}
```

---

#### 3.3.4 更新 Tool

**PUT** `/api/v1/mcp/tools/{toolId}`

更新 Tool 配置。更新后版本号自增，已绑定的 Server 将收到 `notifications/tools/list_changed` 通知。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| toolId | string | Tool ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| displayName | string | 否 | 显示名称 |
| description | string | 否 | Tool 描述 |
| inputSchema | object | 否 | 输入参数 JSON Schema |
| outputSchema | object | 否 | 输出参数 JSON Schema |
| execution | object | 否 | 执行配置（仅 INTERNAL Tool 可修改） |
| annotations | object | 否 | MCP Tool 注解 |
| timeout | int | 否 | 执行超时时间 |
| tags | string[] | 否 | 标签列表 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "toolId": "tool-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "version": 3,
    "updatedAt": "2026-07-16T20:35:00Z",
    "notificationsSent": 1
  },
  "traceId": "xxx"
}
```

**错误场景**

| code | 场景 |
|---|---|
| 40403 | Tool 不存在 |
| 42201 | JSON Schema 定义不合法 |

---

#### 3.3.5 删除 Tool

**DELETE** `/api/v1/mcp/tools/{toolId}`

删除 Tool。已绑定该 Tool 的 Server 将自动解绑并发送通知。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| toolId | string | Tool ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "toolId": "tool-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "deleted": true,
    "unboundServers": [
      { "serverId": "srv-a1b2c3d4-e5f6-7890-abcd-ef1234567891", "serverName": "rag-search-server" }
    ],
    "notificationsSent": 1
  },
  "traceId": "xxx"
}
```

---

#### 3.3.6 定义 Tool Schema

**POST** `/api/v1/mcp/tools/{toolId}/schema/validate`

验证给定的参数是否符合 Tool 的 inputSchema 定义。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| toolId | string | Tool ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| arguments | object | 是 | 待校验的参数对象 |

**请求示例**

```json
{
  "arguments": {
    "kbId": "kb-001",
    "query": "本体论引擎架构",
    "mode": "hybrid",
    "topK": 5
  }
}
```

**响应示例（校验通过）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "valid": true,
    "errors": []
  },
  "traceId": "xxx"
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
        "path": "$.query",
        "message": "Field 'query' is required but not provided"
      },
      {
        "path": "$.topK",
        "message": "Value 50 exceeds maximum of 20"
      }
    ]
  },
  "traceId": "xxx"
}
```

---

#### 3.3.7 Tool 分类管理

**GET** `/api/v1/mcp/tools/categories`

获取所有 Tool 分类及其统计信息。

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "categories": [
      {
        "name": "ontology",
        "displayName": "本体引擎",
        "toolCount": 5,
        "internalCount": 5,
        "externalCount": 0
      },
      {
        "name": "rag",
        "displayName": "知识检索",
        "toolCount": 3,
        "internalCount": 3,
        "externalCount": 0
      },
      {
        "name": "action",
        "displayName": "动作执行",
        "toolCount": 8,
        "internalCount": 8,
        "externalCount": 0
      },
      {
        "name": "external",
        "displayName": "外部工具",
        "toolCount": 3,
        "internalCount": 0,
        "externalCount": 3
      }
    ],
    "totalTools": 19
  },
  "traceId": "xxx"
}
```

---

#### 3.3.8 搜索 Tool

**POST** `/api/v1/mcp/tools/search`

全文搜索 Tool，支持按名称、描述、标签、分类多维度检索。支持语义搜索（通过 TECH-LLMGW 进行 Embedding 相似度匹配）。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| query | string | 是 | 搜索关键词或自然语言描述 |
| mode | string | 否 | 搜索模式：`KEYWORD`（关键词）、`SEMANTIC`（语义）、`HYBRID`（混合，默认） |
| filters | object | 否 | 过滤条件 |
| filters.source | string | 否 | 来源筛选 |
| filters.category | string | 否 | 分类筛选 |
| filters.enabled | boolean | 否 | 启用状态筛选 |
| filters.tags | string[] | 否 | 标签筛选（OR 关系） |
| limit | int | 否 | 返回数量上限，默认 10，最大 50 |

**请求示例**

```json
{
  "query": "搜索企业知识库",
  "mode": "HYBRID",
  "filters": {
    "source": "INTERNAL",
    "category": "rag"
  },
  "limit": 5
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "toolId": "tool-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
        "name": "search_knowledge_base",
        "displayName": "搜索知识库",
        "description": "在指定知识库中进行语义检索...",
        "category": "rag",
        "source": "INTERNAL",
        "score": 0.95,
        "matchReason": "名称匹配 + 语义匹配"
      },
      {
        "toolId": "tool-002",
        "name": "search_concepts",
        "displayName": "搜索本体概念",
        "description": "根据关键词搜索本体中的概念定义",
        "category": "ontology",
        "source": "INTERNAL",
        "score": 0.72,
        "matchReason": "语义匹配"
      }
    ],
    "total": 2,
    "searchMode": "HYBRID"
  },
  "traceId": "xxx"
}
```

---

#### 3.3.9 启用/禁用 Tool

**POST** `/api/v1/mcp/tools/{toolId}/toggle`

切换 Tool 的启用/禁用状态。禁用后，已绑定的 Server 将不再向 Client 暴露该 Tool。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| toolId | string | Tool ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| enabled | boolean | 是 | 目标状态：true 启用、false 禁用 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "toolId": "tool-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "enabled": false,
    "status": "DISABLED",
    "notificationsSent": 1,
    "updatedAt": "2026-07-16T20:40:00Z"
  },
  "traceId": "xxx"
}
```

---

### 3.4 Tool 执行 API

Tool 执行 API 提供 Tool 调用的统一入口，支持同步、异步、批量三种执行模式。内部 Tool 直接路由到执行器，外部 Tool 通过 MCP Client 转发到第三方 Server。

#### 3.4.1 执行 Tool（同步）

**POST** `/api/v1/mcp/tools/execute`

同步执行指定的 Tool，阻塞等待结果返回。适用于执行时间短（< 30s）的 Tool。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| toolName | string | 是 | Tool 名称（或 toolId） |
| arguments | object | 是 | Tool 输入参数，需符合 Tool 的 inputSchema |
| serverId | string | 否 | 指定通过哪个 Server 执行（外部 Tool 时可指定路由） |
| timeout | int | 否 | 执行超时覆盖（毫秒），不超过 Tool 配置的 timeout |
| metadata | object | 否 | 调用元数据（调用方信息、会话 ID 等） |

**请求示例**

```json
{
  "toolName": "search_knowledge_base",
  "arguments": {
    "kbId": "kb-001",
    "query": "本体论引擎架构设计",
    "mode": "hybrid",
    "topK": 5
  },
  "metadata": {
    "caller": "app-superai",
    "sessionId": "sess-001",
    "userId": "user-001"
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-c1d2e3f4-a5b6-7890-abcd-ef1234567890",
    "toolName": "search_knowledge_base",
    "toolId": "tool-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "status": "SUCCESS",
    "result": {
      "content": [
        {
          "type": "text",
          "text": "{\"results\":[{\"content\":\"本体论引擎是Mate Platform的核心组件...\",\"score\":0.92,\"source\":\"doc-001\"},{\"content\":\"架构设计遵循P3双向同步原则...\",\"score\":0.87,\"source\":\"doc-002\"}],\"total\":2}"
        }
      ],
      "isError": false
    },
    "durationMs": 1200,
    "tokenUsage": {
      "promptTokens": 0,
      "completionTokens": 0,
      "totalTokens": 0
    },
    "executedAt": "2026-07-16T20:45:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| code | 场景 |
|---|---|
| 40003 | 参数不符合 inputSchema |
| 40403 | Tool 不存在或已禁用 |
| 50002 | 执行超时 |
| 50003 | 内部 Tool 执行失败（下游服务错误） |
| 50004 | 外部 Tool 执行失败（第三方 Server 错误） |
| 50301 | 下游依赖不可用 |

---

#### 3.4.2 批量执行 Tool

**POST** `/api/v1/mcp/tools/execute/batch`

批量执行多个 Tool 调用，支持并行执行与串行执行模式。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| executions | array | 是 | 执行列表 |
| executions[].toolName | string | 是 | Tool 名称 |
| executions[].arguments | object | 是 | Tool 输入参数 |
| executions[].executionId | string | 否 | 自定义执行 ID，用于结果关联 |
| mode | string | 否 | 执行模式：`PARALLEL`（并行，默认）、`SEQUENTIAL`（串行） |
| stopOnError | boolean | 否 | 串行模式下出错是否停止后续执行，默认 false |
| metadata | object | 否 | 调用元数据 |

**请求示例**

```json
{
  "executions": [
    {
      "executionId": "exec-001",
      "toolName": "search_knowledge_base",
      "arguments": {
        "kbId": "kb-001",
        "query": "本体论引擎",
        "topK": 3
      }
    },
    {
      "executionId": "exec-002",
      "toolName": "search_concepts",
      "arguments": {
        "keyword": "Customer",
        "domain": "CRM"
      }
    },
    {
      "executionId": "exec-003",
      "toolName": "get_entity_relations",
      "arguments": {
        "entityId": "ent-001",
        "depth": 1
      }
    }
  ],
  "mode": "PARALLEL",
  "stopOnError": false
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "batchId": "batch-d4e5f6a7-b8c9-0123-def4-567890abcdef",
    "totalExecutions": 3,
    "successCount": 2,
    "failedCount": 1,
    "results": [
      {
        "executionId": "exec-001",
        "toolName": "search_knowledge_base",
        "status": "SUCCESS",
        "result": {
          "content": [
            { "type": "text", "text": "{\"results\":[...]}" }
          ],
          "isError": false
        },
        "durationMs": 1200
      },
      {
        "executionId": "exec-002",
        "toolName": "search_concepts",
        "status": "SUCCESS",
        "result": {
          "content": [
            { "type": "text", "text": "{\"concepts\":[...]}" }
          ],
          "isError": false
        },
        "durationMs": 800
      },
      {
        "executionId": "exec-003",
        "toolName": "get_entity_relations",
        "status": "FAILED",
        "error": {
          "code": "50003",
          "message": "TECH-ONT 服务超时"
        },
        "durationMs": 30000
      }
    ],
    "totalDurationMs": 30000,
    "executedAt": "2026-07-16T20:50:00Z"
  },
  "traceId": "xxx"
}
```

---

#### 3.4.3 异步执行 Tool

**POST** `/api/v1/mcp/tools/execute/async`

异步执行指定的 Tool，立即返回执行 ID，通过轮询或回调获取结果。适用于执行时间长（> 30s）的 Tool。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| toolName | string | 是 | Tool 名称 |
| arguments | object | 是 | Tool 输入参数 |
| callbackUrl | string | 否 | 执行完成后的回调通知 URL |
| metadata | object | 否 | 调用元数据 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-e7f8a9b0-c1d2-3456-efab-cdef01234567",
    "toolName": "search_knowledge_base",
    "status": "PENDING",
    "submittedAt": "2026-07-16T20:55:00Z"
  },
  "traceId": "xxx"
}
```

回调通知（POST 到 callbackUrl）：

```json
{
  "executionId": "exec-e7f8a9b0-c1d2-3456-efab-cdef01234567",
  "toolName": "search_knowledge_base",
  "status": "SUCCESS",
  "result": {
    "content": [
      { "type": "text", "text": "..." }
    ],
    "isError": false
  },
  "durationMs": 2500,
  "traceId": "xxx"
}
```

---

#### 3.4.4 查询执行结果

**GET** `/api/v1/mcp/tools/executions/{executionId}`

查询异步执行的 Tool 执行结果。

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
    "executionId": "exec-e7f8a9b0-c1d2-3456-efab-cdef01234567",
    "toolName": "search_knowledge_base",
    "toolId": "tool-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "status": "SUCCESS",
    "result": {
      "content": [
        {
          "type": "text",
          "text": "{\"results\":[{\"content\":\"本体论引擎...\",\"score\":0.92,\"source\":\"doc-001\"}]}"
        }
      ],
      "isError": false
    },
    "arguments": {
      "kbId": "kb-001",
      "query": "本体论引擎",
      "topK": 3
    },
    "durationMs": 2500,
    "tokenUsage": {
      "promptTokens": 0,
      "completionTokens": 0,
      "totalTokens": 0
    },
    "startedAt": "2026-07-16T20:55:00Z",
    "completedAt": "2026-07-16T20:55:02Z"
  },
  "traceId": "xxx"
}
```

---

#### 3.4.5 MCP JSON-RPC tools/call 端点

**POST** `/api/v1/mcp/servers/{serverId}/rpc`

通过 MCP JSON-RPC 协议调用 Tool。这是外部 AI 工具调用平台 Tool 的标准入口。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| serverId | string | Server 实例 ID |

**请求参数（JSON-RPC Body）**

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": {
    "name": "search_knowledge_base",
    "arguments": {
      "kbId": "kb-001",
      "query": "本体论引擎架构",
      "mode": "hybrid",
      "topK": 5
    }
  }
}
```

**成功响应**

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"results\":[{\"content\":\"本体论引擎是Mate Platform的核心组件...\",\"score\":0.92,\"source\":\"doc-001\"},{\"content\":\"架构设计遵循P3双向同步原则...\",\"score\":0.87,\"source\":\"doc-002\"}],\"total\":2}"
      }
    ],
    "isError": false
  }
}
```

**Tool 执行错误响应**

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Error: TECh-RAG service timeout (50003)"
      }
    ],
    "isError": true
  }
}
```

**JSON-RPC 错误响应**

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "error": {
    "code": -32002,
    "message": "Tool not found: unknown_tool_name"
  }
}
```

---

### 3.5 Resource 管理 API

Resource 是 MCP 协议中的"资源"概念，表示可被 AI 工具读取的内容（文档、架构资产、本体实体等）。每个 Resource 通过 URI 唯一标识。

#### 3.5.1 创建 Resource

**POST** `/api/v1/mcp/resources`

创建一个新的 Resource 配置。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| uri | string | 是 | Resource URI，格式 `scheme://path`，租户内唯一 |
| name | string | 是 | Resource 名称 |
| description | string | 否 | 描述信息 |
| mimeType | string | 否 | MIME 类型，如 `text/plain`、`application/json`、`text/markdown` |
| source | string | 是 | 来源：`INTERNAL`（平台原生）、`EXTERNAL`（第三方 MCP） |
| clientId | string | 否 | 来源 Client ID（source=EXTERNAL 时必填） |
| externalUri | string | 否 | 第三方 Server 上的原始 URI（source=EXTERNAL 时必填） |
| provider | object | 否 | 内容提供者配置（source=INTERNAL 时必填） |
| provider.type | string | 否 | 提供者类型：`STATIC`（静态内容）、`HTTP`（HTTP 拉取）、`BEAN`（Bean 调用）、`ONT_ENTITY`（本体实体）、`DOC_ASSET`（文档资产） |
| provider.config | object | 否 | 提供者配置详情 |
| cacheConfig | object | 否 | 缓存配置 |
| cacheConfig.enabled | boolean | 否 | 是否启用缓存，默认 true |
| cacheConfig.ttl | int | 否 | 缓存有效期（秒），默认 300 |
| subscription | object | 否 | 订阅配置（支持 MCP resources/subscribe） |
| subscription.enabled | boolean | 否 | 是否允许订阅，默认 false |
| subscription.pollInterval | int | 否 | 轮询检测间隔（秒），默认 60 |
| tags | string[] | 否 | 标签列表 |

**provider.config 结构**

| type | config 字段 |
|---|---|
| STATIC | `content`（静态内容文本）、`contentEncoding`（`utf-8`/`base64`） |
| HTTP | `method`、`url`、`headers`、`bodyTemplate`、`responseType`（`TEXT`/`JSON`/`BINARY`） |
| BEAN | `beanName`、`methodName`、`args` |
| ONT_ENTITY | `conceptId`（本体概念 ID）、`entityId`（实体 ID，支持变量 `${uri.path.0}`） |
| DOC_ASSET | `assetId`（架构资产 ID）、`format`（输出格式） |

**请求示例**

```json
{
  "uri": "ont://concepts/CRM.Customer",
  "name": "客户概念定义",
  "description": "CRM 域客户概念的本体定义，包含属性、关系与约束",
  "mimeType": "application/json",
  "source": "INTERNAL",
  "provider": {
    "type": "ONT_ENTITY",
    "config": {
      "conceptId": "CRM.Customer",
      "entityId": "${uri.path.1}"
    }
  },
  "cacheConfig": {
    "enabled": true,
    "ttl": 600
  },
  "subscription": {
    "enabled": true,
    "pollInterval": 60
  },
  "tags": ["ontology", "crm", "concept"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "resourceId": "res-a1b2c3d4-e5f6-7890-abcd-ef1234567892",
    "uri": "ont://concepts/CRM.Customer",
    "name": "客户概念定义",
    "description": "CRM 域客户概念的本体定义...",
    "mimeType": "application/json",
    "source": "INTERNAL",
    "provider": {
      "type": "ONT_ENTITY",
      "config": {
        "conceptId": "CRM.Customer"
      }
    },
    "cacheConfig": {
      "enabled": true,
      "ttl": 600
    },
    "subscription": {
      "enabled": true,
      "pollInterval": 60
    },
    "tags": ["ontology", "crm", "concept"],
    "createdAt": "2026-07-16T21:00:00Z",
    "updatedAt": "2026-07-16T21:00:00Z"
  },
  "traceId": "xxx"
}
```

**错误场景**

| code | 场景 |
|---|---|
| 40001 | 必填字段缺失 |
| 40901 | URI 已存在 |
| 42203 | URI 格式不合法 |

---

#### 3.5.2 查询 Resource 列表

**GET** `/api/v1/mcp/resources`

查询 Resource 列表，支持按来源、MIME 类型、标签筛选。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| pageSize | int | 否 | 每页条数，默认 20 |
| source | string | 否 | 来源筛选 |
| mimeType | string | 否 | MIME 类型筛选 |
| tag | string | 否 | 标签筛选 |
| keyword | string | 否 | 名称/描述模糊搜索 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "resourceId": "res-a1b2c3d4-e5f6-7890-abcd-ef1234567892",
        "uri": "ont://concepts/CRM.Customer",
        "name": "客户概念定义",
        "mimeType": "application/json",
        "source": "INTERNAL",
        "tags": ["ontology", "crm"],
        "serverBindings": 1,
        "readCount": 85,
        "createdAt": "2026-07-16T21:00:00Z"
      },
      {
        "resourceId": "res-ext-001",
        "uri": "github://repos/metaplatform/docs",
        "name": "MetaPlatform 文档仓库",
        "mimeType": "application/json",
        "source": "EXTERNAL",
        "clientId": "cli-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "tags": ["github"],
        "serverBindings": 0,
        "readCount": 5,
        "createdAt": "2026-07-16T20:05:00Z"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20,
    "hasNext": false,
    "nextCursor": null
  },
  "traceId": "xxx"
}
```

---

#### 3.5.3 获取 Resource 详情

**GET** `/api/v1/mcp/resources/{resourceId}`

获取指定 Resource 的完整配置信息。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| resourceId | string | Resource ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "resourceId": "res-a1b2c3d4-e5f6-7890-abcd-ef1234567892",
    "uri": "ont://concepts/CRM.Customer",
    "name": "客户概念定义",
    "description": "CRM 域客户概念的本体定义，包含属性、关系与约束",
    "mimeType": "application/json",
    "source": "INTERNAL",
    "provider": {
      "type": "ONT_ENTITY",
      "config": {
        "conceptId": "CRM.Customer",
        "entityId": "${uri.path.1}"
      }
    },
    "cacheConfig": {
      "enabled": true,
      "ttl": 600,
      "lastCachedAt": "2026-07-16T21:05:00Z",
      "cacheHitRate": 0.85
    },
    "subscription": {
      "enabled": true,
      "pollInterval": 60,
      "activeSubscribers": 2
    },
    "tags": ["ontology", "crm", "concept"],
    "stats": {
      "readCount": 85,
      "avgReadLatencyMs": 45,
      "lastReadAt": "2026-07-16T21:10:00Z"
    },
    "serverBindings": [
      { "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7", "serverName": "ont-query-server" }
    ],
    "createdAt": "2026-07-16T21:00:00Z",
    "updatedAt": "2026-07-16T21:00:00Z"
  },
  "traceId": "xxx"
}
```

---

#### 3.5.4 更新 Resource

**PUT** `/api/v1/mcp/resources/{resourceId}`

更新 Resource 配置。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| resourceId | string | Resource ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | Resource 名称 |
| description | string | 否 | 描述信息 |
| mimeType | string | 否 | MIME 类型 |
| provider | object | 否 | 内容提供者配置 |
| cacheConfig | object | 否 | 缓存配置 |
| subscription | object | 否 | 订阅配置 |
| tags | string[] | 否 | 标签列表 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "resourceId": "res-a1b2c3d4-e5f6-7890-abcd-ef1234567892",
    "updatedAt": "2026-07-16T21:15:00Z",
    "notificationsSent": 1
  },
  "traceId": "xxx"
}
```

---

#### 3.5.5 删除 Resource

**DELETE** `/api/v1/mcp/resources/{resourceId}`

删除 Resource，已绑定的 Server 将自动解绑。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| resourceId | string | Resource ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "resourceId": "res-a1b2c3d4-e5f6-7890-abcd-ef1234567892",
    "deleted": true,
    "unboundServers": 1,
    "notificationsSent": 1
  },
  "traceId": "xxx"
}
```

---

#### 3.5.6 读取 Resource 内容

**POST** `/api/v1/mcp/resources/{resourceId}/read`

读取 Resource 的内容。支持通过 REST API 调用，也对应 MCP JSON-RPC 的 `resources/read` 方法。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| resourceId | string | Resource ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| uri | string | 否 | 指定读取的 URI（用于 URI 模板场景，覆盖 resourceId 对应的 URI） |
| useCache | boolean | 否 | 是否使用缓存，默认 true |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "resourceId": "res-a1b2c3d4-e5f6-7890-abcd-ef1234567892",
    "uri": "ont://concepts/CRM.Customer",
    "mimeType": "application/json",
    "contents": [
      {
        "uri": "ont://concepts/CRM.Customer",
        "mimeType": "application/json",
        "text": "{\"conceptId\":\"CRM.Customer\",\"displayName\":\"客户\",\"properties\":[{\"name\":\"customerId\",\"type\":\"string\",\"required\":true},{\"name\":\"customerName\",\"type\":\"string\",\"required\":true},{\"name\":\"email\",\"type\":\"string\",\"format\":\"email\"}],\"relations\":[{\"name\":\"placesOrders\",\"target\":\"SCM.Order\",\"cardinality\":\"1:N\"}]}"
      }
    ],
    "fromCache": true,
    "cachedAt": "2026-07-16T21:05:00Z",
    "readAt": "2026-07-16T21:20:00Z"
  },
  "traceId": "xxx"
}
```

**MCP JSON-RPC resources/read 对应请求**

```json
{
  "jsonrpc": "2.0",
  "id": 20,
  "method": "resources/read",
  "params": {
    "uri": "ont://concepts/CRM.Customer"
  }
}
```

**MCP JSON-RPC 响应**

```json
{
  "jsonrpc": "2.0",
  "id": 20,
  "result": {
    "contents": [
      {
        "uri": "ont://concepts/CRM.Customer",
        "mimeType": "application/json",
        "text": "{\"conceptId\":\"CRM.Customer\",...}"
      }
    ]
  }
}
```

**错误场景**

| code | 场景 |
|---|---|
| 40401 | Resource 不存在 |
| 50003 | 内容提供者调用失败（下游服务错误） |
| 50301 | 下游依赖不可用 |

---

#### 3.5.7 搜索 Resource

**POST** `/api/v1/mcp/resources/search`

全文搜索 Resource，支持按 URI、名称、描述检索。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| query | string | 是 | 搜索关键词 |
| filters | object | 否 | 过滤条件 |
| filters.source | string | 否 | 来源筛选 |
| filters.mimeType | string | 否 | MIME 类型筛选 |
| filters.tags | string[] | 否 | 标签筛选 |
| limit | int | 否 | 返回数量上限，默认 10 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "resourceId": "res-a1b2c3d4-e5f6-7890-abcd-ef1234567892",
        "uri": "ont://concepts/CRM.Customer",
        "name": "客户概念定义",
        "mimeType": "application/json",
        "score": 0.95
      },
      {
        "resourceId": "res-002",
        "uri": "ont://schemas/OrderItem",
        "name": "订单项 Schema",
        "mimeType": "application/json",
        "score": 0.68
      }
    ],
    "total": 2
  },
  "traceId": "xxx"
}
```

---

### 3.6 Prompt 模板管理 API

Prompt 模板是 MCP 协议中的"提示模板"概念，表示可被 AI 工具获取的预定义提示词模板，支持变量替换。

#### 3.6.1 创建 Prompt 模板

**POST** `/api/v1/mcp/prompts`

创建一个新的 Prompt 模板。

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | 模板名称，租户内唯一，小写字母+连字符 |
| displayName | string | 是 | 显示名称 |
| description | string | 否 | 模板描述 |
| source | string | 是 | 来源：`INTERNAL`、`EXTERNAL` |
| clientId | string | 否 | 来源 Client ID（source=EXTERNAL 时必填） |
| externalName | string | 否 | 第三方 Server 上的原始名称 |
| messages | array | 是 | 消息列表（MCP Prompt 消息结构） |
| messages[].role | string | 是 | 角色：`user`、`assistant`、`system` |
| messages[].content | object | 是 | 消息内容 |
| messages[].content.type | string | 是 | 内容类型：`text`、`image`、`resource` |
| messages[].content.text | string | 否 | 文本内容（type=text 时），支持 Mustache 变量 `{{varName}}` |
| messages[].content.resourceUri | string | 否 | 引用的 Resource URI（type=resource 时） |
| arguments | array | 否 | 模板变量定义 |
| arguments[].name | string | 是 | 变量名称 |
| arguments[].description | string | 否 | 变量描述 |
| arguments[].required | boolean | 否 | 是否必填，默认 false |
| arguments[].default | string | 否 | 默认值 |
| arguments[].enum | string[] | 否 | 可选值枚举 |
| tags | string[] | 否 | 标签列表 |

**请求示例**

```json
{
  "name": "ontology-analysis-template",
  "displayName": "本体分析提示模板",
  "description": "用于分析本体概念结构与关系的提示模板",
  "source": "INTERNAL",
  "messages": [
    {
      "role": "system",
      "content": {
        "type": "text",
        "text": "你是一个本体论分析专家。请根据提供的概念信息，分析其结构、属性和关系。"
      }
    },
    {
      "role": "user",
      "content": {
        "type": "text",
        "text": "请分析以下本体概念：\n\n概念名称：{{conceptName}}\n分析深度：{{analysisDepth}}\n\n请从以下维度进行分析：\n1. 属性结构\n2. 关系网络\n3. 业务约束\n4. 数据流向"
      }
    }
  ],
  "arguments": [
    {
      "name": "conceptName",
      "description": "要分析的概念名称",
      "required": true
    },
    {
      "name": "analysisDepth",
      "description": "分析深度",
      "required": false,
      "default": "shallow",
      "enum": ["shallow", "medium", "deep"]
    }
  ],
  "tags": ["ontology", "analysis", "template"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "promptId": "prompt-a1b2c3d4-e5f6-7890-abcd-ef1234567893",
    "name": "ontology-analysis-template",
    "displayName": "本体分析提示模板",
    "description": "用于分析本体概念结构与关系的提示模板",
    "source": "INTERNAL",
    "messages": [ ],
    "arguments": [ ],
    "tags": ["ontology", "analysis", "template"],
    "version": 1,
    "createdAt": "2026-07-16T21:25:00Z",
    "updatedAt": "2026-07-16T21:25:00Z"
  },
  "traceId": "xxx"
}
```

**错误场景**

| code | 场景 |
|---|---|
| 40001 | 必填字段缺失 |
| 40901 | 模板名称已存在 |
| 42201 | 消息内容格式不合法 |

---

#### 3.6.2 查询 Prompt 模板列表

**GET** `/api/v1/mcp/prompts`

查询 Prompt 模板列表。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| pageSize | int | 否 | 每页条数，默认 20 |
| source | string | 否 | 来源筛选 |
| tag | string | 否 | 标签筛选 |
| keyword | string | 否 | 名称/描述模糊搜索 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "promptId": "prompt-a1b2c3d4-e5f6-7890-abcd-ef1234567893",
        "name": "ontology-analysis-template",
        "displayName": "本体分析提示模板",
        "description": "用于分析本体概念结构与关系的提示模板",
        "source": "INTERNAL",
        "argumentCount": 2,
        "tags": ["ontology", "analysis"],
        "serverBindings": 1,
        "renderCount": 42,
        "createdAt": "2026-07-16T21:25:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "hasNext": false,
    "nextCursor": null
  },
  "traceId": "xxx"
}
```

---

#### 3.6.3 获取 Prompt 模板详情

**GET** `/api/v1/mcp/prompts/{promptId}`

获取指定 Prompt 模板的完整配置信息。

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
    "promptId": "prompt-a1b2c3d4-e5f6-7890-abcd-ef1234567893",
    "name": "ontology-analysis-template",
    "displayName": "本体分析提示模板",
    "description": "用于分析本体概念结构与关系的提示模板",
    "source": "INTERNAL",
    "messages": [
      {
        "role": "system",
        "content": {
          "type": "text",
          "text": "你是一个本体论分析专家..."
        }
      },
      {
        "role": "user",
        "content": {
          "type": "text",
          "text": "请分析以下本体概念：\n\n概念名称：{{conceptName}}\n分析深度：{{analysisDepth}}\n..."
        }
      }
    ],
    "arguments": [
      {
        "name": "conceptName",
        "description": "要分析的概念名称",
        "required": true
      },
      {
        "name": "analysisDepth",
        "description": "分析深度",
        "required": false,
        "default": "shallow",
        "enum": ["shallow", "medium", "deep"]
      }
    ],
    "tags": ["ontology", "analysis", "template"],
    "version": 1,
    "stats": {
      "renderCount": 42,
      "avgRenderLatencyMs": 5,
      "lastRenderAt": "2026-07-16T21:30:00Z"
    },
    "serverBindings": [
      { "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7", "serverName": "ont-query-server" }
    ],
    "createdAt": "2026-07-16T21:25:00Z",
    "updatedAt": "2026-07-16T21:25:00Z"
  },
  "traceId": "xxx"
}
```

---

#### 3.6.4 更新 Prompt 模板

**PUT** `/api/v1/mcp/prompts/{promptId}`

更新 Prompt 模板配置。更新后版本号自增。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| promptId | string | Prompt 模板 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| displayName | string | 否 | 显示名称 |
| description | string | 否 | 描述信息 |
| messages | array | 否 | 消息列表 |
| arguments | array | 否 | 模板变量定义 |
| tags | string[] | 否 | 标签列表 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "promptId": "prompt-a1b2c3d4-e5f6-7890-abcd-ef1234567893",
    "version": 2,
    "updatedAt": "2026-07-16T21:35:00Z",
    "notificationsSent": 1
  },
  "traceId": "xxx"
}
```

---

#### 3.6.5 删除 Prompt 模板

**DELETE** `/api/v1/mcp/prompts/{promptId}`

删除 Prompt 模板，已绑定的 Server 将自动解绑。

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
    "promptId": "prompt-a1b2c3d4-e5f6-7890-abcd-ef1234567893",
    "deleted": true,
    "unboundServers": 1,
    "notificationsSent": 1
  },
  "traceId": "xxx"
}
```

---

#### 3.6.6 渲染 Prompt

**POST** `/api/v1/mcp/prompts/{promptId}/render`

渲染 Prompt 模板，执行变量替换并返回渲染后的消息列表。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| promptId | string | Prompt 模板 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| arguments | object | 是 | 变量值映射，key 为变量名，value 为变量值 |

**请求示例**

```json
{
  "arguments": {
    "conceptName": "Customer",
    "analysisDepth": "deep"
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "promptId": "prompt-a1b2c3d4-e5f6-7890-abcd-ef1234567893",
    "name": "ontology-analysis-template",
    "description": "用于分析本体概念结构与关系的提示模板",
    "messages": [
      {
        "role": "system",
        "content": {
          "type": "text",
          "text": "你是一个本体论分析专家。请根据提供的概念信息，分析其结构、属性和关系。"
        }
      },
      {
        "role": "user",
        "content": {
          "type": "text",
          "text": "请分析以下本体概念：\n\n概念名称：Customer\n分析深度：deep\n\n请从以下维度进行分析：\n1. 属性结构\n2. 关系网络\n3. 业务约束\n4. 数据流向"
        }
      }
    ],
    "renderedAt": "2026-07-16T21:40:00Z"
  },
  "traceId": "xxx"
}
```

**错误场景**

| code | 场景 |
|---|---|
| 40401 | Prompt 模板不存在 |
| 40001 | 必填变量未提供 |

---

#### 3.6.7 MCP JSON-RPC prompts/get 端点

**POST** `/api/v1/mcp/servers/{serverId}/rpc`

通过 MCP JSON-RPC 协议获取渲染后的 Prompt。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| serverId | string | Server 实例 ID |

**请求参数（JSON-RPC Body）**

```json
{
  "jsonrpc": "2.0",
  "id": 30,
  "method": "prompts/get",
  "params": {
    "name": "ontology-analysis-template",
    "arguments": {
      "conceptName": "Customer",
      "analysisDepth": "deep"
    }
  }
}
```

**响应示例**

```json
{
  "jsonrpc": "2.0",
  "id": 30,
  "result": {
    "description": "用于分析本体概念结构与关系的提示模板",
    "messages": [
      {
        "role": "system",
        "content": {
          "type": "text",
          "text": "你是一个本体论分析专家。请根据提供的概念信息，分析其结构、属性和关系。"
        }
      },
      {
        "role": "user",
        "content": {
          "type": "text",
          "text": "请分析以下本体概念：\n\n概念名称：Customer\n分析深度：deep\n\n请从以下维度进行分析：\n1. 属性结构\n2. 关系网络\n3. 业务约束\n4. 数据流向"
        }
      }
    ]
  }
}
```

**错误场景**

| JSON-RPC code | 场景 |
|---|---|
| -32004 | Prompt 不存在 |
| -32602 | 必填变量未提供 |

---

### 3.7 调用审计 API

调用审计 API 提供 MCP 调用全链路的记录查询、Token 统计、错误追踪与趋势分析能力。

#### 3.7.1 查询调用记录列表

**GET** `/api/v1/mcp/audit/calls`

查询 MCP 调用记录列表，支持按时间范围、Server、Tool、状态等维度筛选。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| pageSize | int | 否 | 每页条数，默认 20 |
| startTime | string | 否 | 开始时间（ISO 8601） |
| endTime | string | 否 | 结束时间（ISO 8601） |
| serverId | string | 否 | Server ID 筛选 |
| toolName | string | 否 | Tool 名称筛选 |
| status | string | 否 | 状态筛选：`SUCCESS`、`FAILED`、`TIMEOUT` |
| callerType | string | 否 | 调用方类型：`MCP_CLIENT`（外部 MCP Client）、`INTERNAL`（内部服务） |
| traceId | string | 否 | 按 traceId 精确查找 |
| sortBy | string | 否 | 排序字段，默认 `timestamp` |
| sortOrder | string | 否 | 排序方向：`asc`、`desc`（默认） |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "callId": "call-001",
        "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
        "serverName": "ont-query-server",
        "toolName": "search_knowledge_base",
        "toolId": "tool-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
        "callerType": "MCP_CLIENT",
        "callerInfo": {
          "clientName": "claude-desktop",
          "clientVersion": "1.0.0"
        },
        "status": "SUCCESS",
        "durationMs": 1200,
        "tokenUsage": {
          "promptTokens": 0,
          "completionTokens": 0,
          "totalTokens": 0
        },
        "timestamp": "2026-07-16T20:45:00Z"
      },
      {
        "callId": "call-002",
        "traceId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
        "serverName": "ont-query-server",
        "toolName": "get_entity_relations",
        "toolId": "tool-002",
        "callerType": "INTERNAL",
        "callerInfo": {
          "service": "app-superai",
          "userId": "user-001"
        },
        "status": "FAILED",
        "errorCode": "50003",
        "errorMessage": "TECH-ONT 服务超时",
        "durationMs": 30000,
        "tokenUsage": {
          "promptTokens": 0,
          "completionTokens": 0,
          "totalTokens": 0
        },
        "timestamp": "2026-07-16T20:50:00Z"
      }
    ],
    "total": 1542,
    "page": 1,
    "pageSize": 20,
    "hasNext": true,
    "nextCursor": "eyJ0cyI6IjIwMjYtMDctMTZUMjA6NTA6MDBaIn0="
  },
  "traceId": "xxx"
}
```

---

#### 3.7.2 获取调用详情

**GET** `/api/v1/mcp/audit/calls/{callId}`

获取指定调用记录的完整详情，包括请求参数、响应结果、错误堆栈等。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| callId | string | 调用记录 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "callId": "call-001",
    "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "serverName": "ont-query-server",
    "toolName": "search_knowledge_base",
    "toolId": "tool-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "toolVersion": 2,
    "callerType": "MCP_CLIENT",
    "callerInfo": {
      "clientName": "claude-desktop",
      "clientVersion": "1.0.0",
      "remoteAddr": "192.168.1.100"
    },
    "status": "SUCCESS",
    "request": {
      "method": "tools/call",
      "params": {
        "name": "search_knowledge_base",
        "arguments": {
          "kbId": "kb-001",
          "query": "本体论引擎架构",
          "mode": "hybrid",
          "topK": 5
        }
      }
    },
    "response": {
      "content": [
        {
          "type": "text",
          "text": "{\"results\":[{\"content\":\"本体论引擎是...\",\"score\":0.92,\"source\":\"doc-001\"}]}"
        }
      ],
      "isError": false
    },
    "durationMs": 1200,
    "tokenUsage": {
      "promptTokens": 0,
      "completionTokens": 0,
      "totalTokens": 0
    },
    "executionPath": [
      { "step": "MCP_RPC_RECEIVE", "timestamp": "2026-07-16T20:45:00.000Z", "durationMs": 5 },
      { "step": "AUTH_VALIDATE", "timestamp": "2026-07-16T20:45:00.005Z", "durationMs": 10 },
      { "step": "SCHEMA_VALIDATE", "timestamp": "2026-07-16T20:45:00.015Z", "durationMs": 5 },
      { "step": "TOOL_ROUTE", "timestamp": "2026-07-16T20:45:00.020Z", "durationMs": 2 },
      { "step": "HTTP_EXECUTE", "timestamp": "2026-07-16T20:45:00.022Z", "durationMs": 1150 },
      { "step": "RESPONSE_BUILD", "timestamp": "2026-07-16T20:45:01.172Z", "durationMs": 8 }
    ],
    "startedAt": "2026-07-16T20:45:00Z",
    "completedAt": "2026-07-16T20:45:01Z"
  },
  "traceId": "xxx"
}
```

---

#### 3.7.3 Token 统计

**GET** `/api/v1/mcp/audit/stats/tokens`

查询 Token 消耗统计，支持按时间范围、Server、Tool 维度聚合。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startTime | string | 是 | 开始时间（ISO 8601） |
| endTime | string | 是 | 结束时间（ISO 8601） |
| serverId | string | 否 | Server ID 筛选 |
| toolName | string | 否 | Tool 名称筛选 |
| groupBy | string | 否 | 聚合维度：`tool`（默认）、`server`、`caller`、`day`、`hour` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "summary": {
      "totalCalls": 1542,
      "totalPromptTokens": 125000,
      "totalCompletionTokens": 82000,
      "totalTokens": 207000,
      "estimatedCost": 2.07
    },
    "breakdown": [
      {
        "key": "search_knowledge_base",
        "callCount": 820,
        "promptTokens": 65000,
        "completionTokens": 42000,
        "totalTokens": 107000,
        "estimatedCost": 1.07
      },
      {
        "key": "get_entity_relations",
        "callCount": 722,
        "promptTokens": 60000,
        "completionTokens": 40000,
        "totalTokens": 100000,
        "estimatedCost": 1.0
      }
    ]
  },
  "traceId": "xxx"
}
```

---

#### 3.7.4 错误追踪

**GET** `/api/v1/mcp/audit/errors`

查询错误调用记录，支持按错误码、Tool、时间范围筛选。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| pageSize | int | 否 | 每页条数，默认 20 |
| startTime | string | 否 | 开始时间 |
| endTime | string | 否 | 结束时间 |
| errorCode | string | 否 | 错误码筛选 |
| toolName | string | 否 | Tool 名称筛选 |
| serverId | string | 否 | Server ID 筛选 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "summary": {
      "totalErrors": 3,
      "errorRate": 0.19,
      "topErrorCodes": [
        { "errorCode": "50003", "count": 2, "message": "Tool 执行失败" },
        { "errorCode": "50002", "count": 1, "message": "Tool 执行超时" }
      ]
    },
    "items": [
      {
        "callId": "call-002",
        "traceId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "toolName": "get_entity_relations",
        "serverName": "ont-query-server",
        "errorCode": "50003",
        "errorMessage": "TECH-ONT 服务超时",
        "errorStack": "com.metaplatform.mcp.exception.ToolExecutionException: TECH-ONT service timeout\n\tat com.metaplatform.mcp.executor.HttpToolExecutor.execute(HttpToolExecutor.java:85)\n\tat com.metaplatform.mcp.service.ToolExecutionService.executeSync(ToolExecutionService.java:120)\n\t...",
        "durationMs": 30000,
        "timestamp": "2026-07-16T20:50:00Z"
      }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 20,
    "hasNext": false
  },
  "traceId": "xxx"
}
```

---

#### 3.7.5 调用趋势分析

**GET** `/api/v1/mcp/audit/stats/trends`

查询调用趋势分析，支持按时间粒度（小时/天）聚合调用量、错误率、延迟等指标。

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startTime | string | 是 | 开始时间 |
| endTime | string | 是 | 结束时间 |
| granularity | string | 否 | 时间粒度：`hour`、`day`（默认） |
| serverId | string | 否 | Server ID 筛选 |
| toolName | string | 否 | Tool 名称筛选 |
| metric | string | 否 | 指标：`call_count`（默认）、`error_rate`、`latency`、`token_usage` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "granularity": "day",
    "metric": "call_count",
    "series": [
      { "timestamp": "2026-07-14T00:00:00Z", "value": 320, "errorCount": 1 },
      { "timestamp": "2026-07-15T00:00:00Z", "value": 580, "errorCount": 0 },
      { "timestamp": "2026-07-16T00:00:00Z", "value": 642, "errorCount": 2 }
    ],
    "summary": {
      "totalCalls": 1542,
      "avgDailyCalls": 514,
      "trend": "INCREASING",
      "changePercent": 10.7
    }
  },
  "traceId": "xxx"
}
```

---

## 4. 数据模型

### 4.1 PostgreSQL 表设计总览

| 表名 | 说明 |
|---|---|
| `mcp_servers` | MCP Server 实例配置 |
| `mcp_server_tool_bindings` | Server 与 Tool 的绑定关系 |
| `mcp_server_resource_bindings` | Server 与 Resource 的绑定关系 |
| `mcp_server_prompt_bindings` | Server 与 Prompt 的绑定关系 |
| `mcp_clients` | MCP Client 连接配置 |
| `mcp_tools` | Tool 注册中心（内部 + 外部） |
| `mcp_tool_versions` | Tool 版本历史 |
| `mcp_resources` | Resource 配置 |
| `mcp_prompts` | Prompt 模板配置 |
| `mcp_prompt_versions` | Prompt 模板版本历史 |
| `mcp_tool_executions` | Tool 执行记录 |
| `mcp_call_audit_logs` | MCP 调用审计日志 |
| `mcp_api_keys` | API Key 管理 |
| `mcp_outbox` | Outbox 模式事件表 |

### 4.2 mcp_servers

```sql
CREATE TABLE mcp_servers (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    name            VARCHAR(128)  NOT NULL,
    display_name    VARCHAR(256)  NOT NULL,
    description     TEXT,
    transport_type  VARCHAR(32)   NOT NULL,  -- STDIO / HTTP_SSE / STREAMABLE_HTTP
    transport_config JSONB        NOT NULL,
    protocol_version VARCHAR(32)  NOT NULL DEFAULT '2025-06-18',
    auth_type       VARCHAR(32)   NOT NULL,  -- API_KEY / BEARER_TOKEN / NONE
    auth_config     JSONB,
    rate_limit_config JSONB,
    status          VARCHAR(32)   NOT NULL DEFAULT 'CREATED',  -- CREATED / RUNNING / STOPPED / ERROR
    rpc_endpoint    VARCHAR(512),
    sse_endpoint    VARCHAR(512),
    tags            JSONB         DEFAULT '[]',
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(64),
    UNIQUE(tenant_id, name)
);
CREATE INDEX idx_servers_tenant_status ON mcp_servers(tenant_id, status);
CREATE INDEX idx_servers_tags ON mcp_servers USING GIN(tags);
```

### 4.3 mcp_clients

```sql
CREATE TABLE mcp_clients (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    name            VARCHAR(128)  NOT NULL,
    display_name    VARCHAR(256)  NOT NULL,
    description     TEXT,
    transport_type  VARCHAR(32)   NOT NULL,
    server_config   JSONB         NOT NULL,  -- url / command+args / sseEndpoint
    auth_type       VARCHAR(32),
    auth_config_enc BYTEA,                   -- 加密存储的凭证
    protocol_version VARCHAR(32)  NOT NULL DEFAULT '2025-06-18',
    auto_reconnect  BOOLEAN       NOT NULL DEFAULT TRUE,
    reconnect_config JSONB,
    health_check_config JSONB,
    status          VARCHAR(32)   NOT NULL DEFAULT 'DISCONNECTED',  -- CONNECTED / DISCONNECTED / CONNECTING / ERROR
    server_info     JSONB,                   -- initialize 握手返回的 Server 信息
    last_connected_at TIMESTAMPTZ,
    last_disconnected_at TIMESTAMPTZ,
    tags            JSONB         DEFAULT '[]',
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(64),
    UNIQUE(tenant_id, name)
);
CREATE INDEX idx_clients_tenant_status ON mcp_clients(tenant_id, status);
```

### 4.4 mcp_tools

```sql
CREATE TABLE mcp_tools (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    name            VARCHAR(128)  NOT NULL,
    display_name    VARCHAR(256)  NOT NULL,
    description     TEXT,
    source          VARCHAR(16)   NOT NULL,  -- INTERNAL / EXTERNAL
    client_id       VARCHAR(64),             -- source=EXTERNAL 时关联 mcp_clients.id
    external_name   VARCHAR(128),            -- 第三方原始 Tool 名称
    category        VARCHAR(64),
    input_schema    JSONB         NOT NULL,
    output_schema   JSONB,
    execution_type  VARCHAR(32),             -- HTTP / BEAN / ACTION (INTERNAL only)
    execution_config JSONB,
    annotations     JSONB,
    timeout_ms      INT           NOT NULL DEFAULT 30000,
    tags            JSONB         DEFAULT '[]',
    enabled         BOOLEAN       NOT NULL DEFAULT TRUE,
    status          VARCHAR(32)   NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE / DISABLED / UNAVAILABLE
    version         INT           NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(64),
    UNIQUE(tenant_id, name)
);
CREATE INDEX idx_tools_tenant_source ON mcp_tools(tenant_id, source);
CREATE INDEX idx_tools_tenant_category ON mcp_tools(tenant_id, category);
CREATE INDEX idx_tools_tenant_enabled ON mcp_tools(tenant_id, enabled);
CREATE INDEX idx_tools_tags ON mcp_tools USING GIN(tags);
```

### 4.5 mcp_tool_versions

```sql
CREATE TABLE mcp_tool_versions (
    id              BIGSERIAL     PRIMARY KEY,
    tool_id         VARCHAR(64)   NOT NULL REFERENCES mcp_tools(id) ON DELETE CASCADE,
    tenant_id       VARCHAR(64)   NOT NULL,
    version         INT           NOT NULL,
    input_schema    JSONB         NOT NULL,
    output_schema   JSONB,
    execution_type  VARCHAR(32),
    execution_config JSONB,
    annotations     JSONB,
    timeout_ms      INT,
    description     TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(64),
    UNIQUE(tool_id, version)
);
CREATE INDEX idx_tool_versions_tool ON mcp_tool_versions(tool_id, version DESC);
```

### 4.6 mcp_server_tool_bindings

```sql
CREATE TABLE mcp_server_tool_bindings (
    id              BIGSERIAL     PRIMARY KEY,
    server_id       VARCHAR(64)   NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
    tool_id         VARCHAR(64)   NOT NULL REFERENCES mcp_tools(id) ON DELETE CASCADE,
    tenant_id       VARCHAR(64)   NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE(server_id, tool_id)
);
CREATE INDEX idx_stb_server ON mcp_server_tool_bindings(server_id);
CREATE INDEX idx_stb_tool ON mcp_server_tool_bindings(tool_id);
```

### 4.7 mcp_resources

```sql
CREATE TABLE mcp_resources (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    uri             VARCHAR(512)  NOT NULL,
    name            VARCHAR(256)  NOT NULL,
    description     TEXT,
    mime_type       VARCHAR(128),
    source          VARCHAR(16)   NOT NULL,  -- INTERNAL / EXTERNAL
    client_id       VARCHAR(64),
    external_uri    VARCHAR(512),
    provider_type   VARCHAR(32),             -- STATIC / HTTP / BEAN / ONT_ENTITY / DOC_ASSET
    provider_config JSONB,
    cache_config    JSONB,
    subscription_config JSONB,
    tags            JSONB         DEFAULT '[]',
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(64),
    UNIQUE(tenant_id, uri)
);
CREATE INDEX idx_resources_tenant_source ON mcp_resources(tenant_id, source);
CREATE INDEX idx_resources_tags ON mcp_resources USING GIN(tags);
```

### 4.8 mcp_prompts

```sql
CREATE TABLE mcp_prompts (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    name            VARCHAR(128)  NOT NULL,
    display_name    VARCHAR(256)  NOT NULL,
    description     TEXT,
    source          VARCHAR(16)   NOT NULL,  -- INTERNAL / EXTERNAL
    client_id       VARCHAR(64),
    external_name   VARCHAR(128),
    messages        JSONB         NOT NULL,  -- MCP Prompt 消息列表
    arguments       JSONB,                   -- 变量定义列表
    tags            JSONB         DEFAULT '[]',
    version         INT           NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(64),
    UNIQUE(tenant_id, name)
);
CREATE INDEX idx_prompts_tenant_source ON mcp_prompts(tenant_id, source);
```

### 4.9 mcp_tool_executions

```sql
CREATE TABLE mcp_tool_executions (
    id              VARCHAR(64)   PRIMARY KEY,  -- executionId
    tenant_id       VARCHAR(64)   NOT NULL,
    trace_id        VARCHAR(128)  NOT NULL,
    tool_id         VARCHAR(64)   NOT NULL,
    tool_name       VARCHAR(128)  NOT NULL,
    tool_version    INT,
    server_id       VARCHAR(64),
    server_name     VARCHAR(128),
    client_id       VARCHAR(64),             -- 外部 Tool 时的 Client 连接 ID
    caller_type     VARCHAR(32)   NOT NULL,  -- MCP_CLIENT / INTERNAL
    caller_info     JSONB,
    status          VARCHAR(32)   NOT NULL,  -- PENDING / RUNNING / SUCCESS / FAILED / TIMEOUT / CANCELLED
    request_method  VARCHAR(64),             -- tools/call 等
    request_params  JSONB,
    response_data   JSONB,
    error_code      VARCHAR(16),
    error_message   TEXT,
    error_stack     TEXT,
    duration_ms     INT,
    prompt_tokens   INT           DEFAULT 0,
    completion_tokens INT         DEFAULT 0,
    total_tokens    INT           DEFAULT 0,
    batch_id        VARCHAR(64),             -- 批量执行时的批次 ID
    callback_url    VARCHAR(512),
    callback_sent   BOOLEAN       DEFAULT FALSE,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_executions_tenant_time ON mcp_tool_executions(tenant_id, created_at DESC);
CREATE INDEX idx_executions_trace ON mcp_tool_executions(trace_id);
CREATE INDEX idx_executions_tool ON mcp_tool_executions(tool_id, created_at DESC);
CREATE INDEX idx_executions_status ON mcp_tool_executions(status);
CREATE INDEX idx_executions_batch ON mcp_tool_executions(batch_id);
```

### 4.10 mcp_call_audit_logs

```sql
CREATE TABLE mcp_call_audit_logs (
    id              BIGSERIAL     PRIMARY KEY,
    call_id         VARCHAR(64)   NOT NULL,
    tenant_id       VARCHAR(64)   NOT NULL,
    trace_id        VARCHAR(128)  NOT NULL,
    server_id       VARCHAR(64),
    server_name     VARCHAR(128),
    tool_id         VARCHAR(64),
    tool_name       VARCHAR(128),
    tool_version    INT,
    caller_type     VARCHAR(32)   NOT NULL,
    caller_info     JSONB,
    method          VARCHAR(64),             -- JSON-RPC method
    status          VARCHAR(32)   NOT NULL,  -- SUCCESS / FAILED / TIMEOUT
    error_code      VARCHAR(16),
    error_message   TEXT,
    duration_ms     INT,
    prompt_tokens   INT           DEFAULT 0,
    completion_tokens INT         DEFAULT 0,
    total_tokens    INT           DEFAULT 0,
    remote_addr     VARCHAR(64),
    timestamp       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_tenant_time ON mcp_call_audit_logs(tenant_id, timestamp DESC);
CREATE INDEX idx_audit_trace ON mcp_call_audit_logs(trace_id);
CREATE INDEX idx_audit_tool ON mcp_call_audit_logs(tool_name, timestamp DESC);
CREATE INDEX idx_audit_server ON mcp_call_audit_logs(server_id, timestamp DESC);
CREATE INDEX idx_audit_status ON mcp_call_audit_logs(status);
```

### 4.11 mcp_api_keys

```sql
CREATE TABLE mcp_api_keys (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    server_id       VARCHAR(64)   REFERENCES mcp_servers(id) ON DELETE CASCADE,
    key_prefix      VARCHAR(16)   NOT NULL,  -- mcpk_ 前缀
    key_hash        VARCHAR(128)  NOT NULL,  -- SHA-256 哈希
    name            VARCHAR(128)  NOT NULL,
    scopes          JSONB         DEFAULT '["tools","resources","prompts"]',
    expires_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    status          VARCHAR(32)   NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE / REVOKED / EXPIRED
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(64)
);
CREATE INDEX idx_apikeys_server ON mcp_api_keys(server_id);
CREATE INDEX idx_apikeys_hash ON mcp_api_keys(key_hash);
```

### 4.12 mcp_outbox

```sql
CREATE TABLE mcp_outbox (
    id              BIGSERIAL     PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    aggregate_id    VARCHAR(64)   NOT NULL,
    aggregate_type  VARCHAR(32)   NOT NULL,  -- TOOL_EXECUTION / SERVER / CLIENT / TOOL
    event_type      VARCHAR(64)   NOT NULL,
    event_data      JSONB         NOT NULL,
    trace_id        VARCHAR(128),
    topic           VARCHAR(128)  NOT NULL,
    status          VARCHAR(16)   NOT NULL DEFAULT 'PENDING',  -- PENDING / SENT / FAILED
    retry_count     INT           DEFAULT 0,
    max_retries     INT           DEFAULT 3,
    next_retry_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    sent_at         TIMESTAMPTZ
);
CREATE INDEX idx_outbox_status_retry ON mcp_outbox(status, next_retry_at) WHERE status = 'PENDING';
CREATE INDEX idx_outbox_aggregate ON mcp_outbox(aggregate_type, aggregate_id);
```

---

## 5. 事件定义

### 5.1 Kafka Topic 规划

| Topic | 说明 | 生产者 | 消费者 |
|---|---|---|---|
| `metaplatform.mcp.tool.execution.events` | Tool 调用生命周期事件 | TECH-MCP | TECH-OBS, APP-SUPERAI, APP-DASHBOARD |
| `metaplatform.mcp.server.lifecycle.events` | MCP Server 启停事件 | TECH-MCP | TECH-OBS, APP-MCPHUB |
| `metaplatform.mcp.client.lifecycle.events` | MCP Client 连接状态事件 | TECH-MCP | TECH-OBS, APP-MCPHUB |
| `metaplatform.mcp.tool.registry.events` | Tool 注册变更事件 | TECH-MCP | TECH-OBS, TECH-AGENT |
| `metaplatform.mcp.audit.events` | 调用审计事件 | TECH-MCP | TECH-OBS |
| `metaplatform.mcp.dlq` | 死信队列 | TECH-MCP (消费失败时) | TECH-OBS / 运维 |

### 5.2 事件类型定义

#### 5.2.1 Tool 调用事件

所有 Tool 调用事件发布到 Topic `metaplatform.mcp.tool.execution.events`。

**ToolExecutionStarted**

```json
{
  "eventType": "ToolExecutionStarted",
  "eventId": "evt-001",
  "timestamp": "2026-07-16T20:45:00Z",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "payload": {
    "executionId": "exec-c1d2e3f4-a5b6-7890-abcd-ef1234567890",
    "toolId": "tool-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "toolName": "search_knowledge_base",
    "toolVersion": 2,
    "toolSource": "INTERNAL",
    "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "serverName": "ont-query-server",
    "callerType": "MCP_CLIENT",
    "callerInfo": {
      "clientName": "claude-desktop",
      "clientVersion": "1.0.0"
    },
    "arguments": {
      "kbId": "kb-001",
      "query": "本体论引擎架构",
      "mode": "hybrid",
      "topK": 5
    },
    "executionMode": "SYNC",
    "timeoutMs": 15000
  }
}
```

**ToolExecutionCompleted**

```json
{
  "eventType": "ToolExecutionCompleted",
  "eventId": "evt-002",
  "timestamp": "2026-07-16T20:45:01Z",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "payload": {
    "executionId": "exec-c1d2e3f4-a5b6-7890-abcd-ef1234567890",
    "toolId": "tool-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "toolName": "search_knowledge_base",
    "toolVersion": 2,
    "status": "SUCCESS",
    "durationMs": 1200,
    "tokenUsage": {
      "promptTokens": 0,
      "completionTokens": 0,
      "totalTokens": 0
    },
    "startedAt": "2026-07-16T20:45:00Z",
    "completedAt": "2026-07-16T20:45:01Z"
  }
}
```

**ToolExecutionFailed**

```json
{
  "eventType": "ToolExecutionFailed",
  "eventId": "evt-003",
  "timestamp": "2026-07-16T20:50:00Z",
  "tenantId": "tenant-001",
  "traceId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "payload": {
    "executionId": "exec-d5e6f7a8-b9c0-1234-defa-567890abcdef",
    "toolId": "tool-002",
    "toolName": "get_entity_relations",
    "toolVersion": 1,
    "status": "FAILED",
    "errorCode": "50003",
    "errorType": "DOWNSTREAM_SERVICE_ERROR",
    "errorMessage": "TECH-ONT 服务超时",
    "durationMs": 30000,
    "startedAt": "2026-07-16T20:49:30Z",
    "failedAt": "2026-07-16T20:50:00Z"
  }
}
```

**ToolExecutionTimedOut**

```json
{
  "eventType": "ToolExecutionTimedOut",
  "eventId": "evt-004",
  "timestamp": "2026-07-16T20:55:00Z",
  "tenantId": "tenant-001",
  "traceId": "c3d4e5f6-a7b8-9012-cdef-678901234567",
  "payload": {
    "executionId": "exec-e7f8a9b0-c1d2-3456-efab-cdef01234567",
    "toolId": "tool-003",
    "toolName": "github_create_pr",
    "toolVersion": 1,
    "status": "TIMEOUT",
    "timeoutMs": 30000,
    "startedAt": "2026-07-16T20:54:30Z",
    "timedOutAt": "2026-07-16T20:55:00Z"
  }
}
```

#### 5.2.2 MCP Server 生命周期事件

发布到 Topic `metaplatform.mcp.server.lifecycle.events`。

**McpServerStarted**

```json
{
  "eventType": "McpServerStarted",
  "eventId": "evt-005",
  "timestamp": "2026-07-16T19:15:00Z",
  "tenantId": "tenant-001",
  "traceId": "d4e5f6a7-b8c9-0123-defa-789012345678",
  "payload": {
    "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "serverName": "ont-query-server",
    "transportType": "STREAMABLE_HTTP",
    "protocolVersion": "2025-06-18",
    "rpcEndpoint": "/api/v1/mcp/servers/srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7/rpc",
    "toolCount": 5,
    "resourceCount": 2,
    "promptCount": 1
  }
}
```

**McpServerStopped**

```json
{
  "eventType": "McpServerStopped",
  "eventId": "evt-006",
  "timestamp": "2026-07-16T19:20:00Z",
  "tenantId": "tenant-001",
  "traceId": "e5f6a7b8-c9d0-1234-efab-890123456789",
  "payload": {
    "serverId": "srv-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "serverName": "ont-query-server",
    "stopReason": "MANUAL",
    "activeConnectionsClosed": 3
  }
}
```

#### 5.2.3 MCP Client 生命周期事件

发布到 Topic `metaplatform.mcp.client.lifecycle.events`。

**McpClientConnected**

```json
{
  "eventType": "McpClientConnected",
  "eventId": "evt-007",
  "timestamp": "2026-07-16T19:40:00Z",
  "tenantId": "tenant-001",
  "traceId": "f6a7b8c9-d0e1-2345-fabc-901234567890",
  "payload": {
    "clientId": "cli-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "clientName": "external-github-mcp",
    "serverInfo": {
      "name": "github-mcp-server",
      "version": "1.2.0",
      "protocolVersion": "2025-06-18"
    },
    "transportType": "STREAMABLE_HTTP"
  }
}
```

**McpClientDisconnected**

```json
{
  "eventType": "McpClientDisconnected",
  "eventId": "evt-008",
  "timestamp": "2026-07-16T22:00:00Z",
  "tenantId": "tenant-001",
  "traceId": "a7b8c9d0-e1f2-3456-abcd-012345678901",
  "payload": {
    "clientId": "cli-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "clientName": "external-github-mcp",
    "disconnectReason": "SERVER_CLOSED",
    "willReconnect": true,
    "reconnectAttempt": 1
  }
}
```

#### 5.2.4 Tool 注册变更事件

发布到 Topic `metaplatform.mcp.tool.registry.events`。

**ToolRegistered**

```json
{
  "eventType": "ToolRegistered",
  "eventId": "evt-009",
  "timestamp": "2026-07-16T20:15:00Z",
  "tenantId": "tenant-001",
  "traceId": "b8c9d0e1-f2a3-4567-bcde-123456789012",
  "payload": {
    "toolId": "tool-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "toolName": "search_knowledge_base",
    "source": "INTERNAL",
    "category": "rag",
    "version": 1
  }
}
```

**ToolUpdated**

```json
{
  "eventType": "ToolUpdated",
  "eventId": "evt-010",
  "timestamp": "2026-07-16T20:35:00Z",
  "tenantId": "tenant-001",
  "traceId": "c9d0e1f2-a3b4-5678-cdef-234567890123",
  "payload": {
    "toolId": "tool-9f3a2b1c-7d8e-4f5a-9b01-c2d3e4f5a6b7",
    "toolName": "search_knowledge_base",
    "previousVersion": 2,
    "currentVersion": 3,
    "changedFields": ["description", "timeout_ms"],
    "notifiedServers": ["srv-a1b2c3d4-e5f6-7890-abcd-ef1234567891"]
  }
}
```

### 5.3 Outbox 模式实现

TECH-MCP 使用 Outbox 模式保证事件发布的可靠性：

```
1. 业务事务中，同时写入业务数据 + mcp_outbox 记录（同一数据库事务）
2. Outbox Publisher 定时扫描 mcp_outbox 表中 status=PENDING 的记录
3. 发布到 Kafka Topic，消息头包含 X-Trace-Id
4. 发布成功后更新 mcp_outbox.status = SENT
5. 发布失败则重试，超过 max_retries 后标记为 FAILED 并进入 DLQ
```

**Outbox Publisher 配置**

| 参数 | 默认值 | 说明 |
|---|---|---|
| scanInterval | 5000ms | 扫描间隔 |
| batchSize | 100 | 每批最大发送数量 |
| maxRetries | 3 | 最大重试次数 |
| retryBackoff | EXPONENTIAL | 退避策略 |
| retryInterval | 1000ms | 初始重试间隔 |

### 5.4 DLQ 处理

消费失败的 Kafka 消息进入 DLQ Topic `metaplatform.mcp.dlq`：

```json
{
  "originalTopic": "metaplatform.mcp.tool.execution.events",
  "originalEvent": { },
  "failureReason": "Deserialization error",
  "failureTimestamp": "2026-07-16T21:00:00Z",
  "retryCount": 3,
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenantId": "tenant-001"
}
```

DLQ 记录必须包含 `traceId` 字段用于故障诊断。

---

## 6. 增量交付计划

### 6.1 里程碑总览

| 里程碑 | 范围 | 预计周期 |
|---|---|---|
| M1 | MCP Server 管理 + Tool 注册中心 + 基础执行 | 第 1-3 周 |
| M2 | MCP Client 管理 + 外部 Tool 发现与路由 | 第 4-6 周 |
| M3 | Resource 管理 + Prompt 模板管理 | 第 7-9 周 |
| M4 | 调用审计 + Outbox 模式 + 事件发布 | 第 10-12 周 |
| M5 | 性能优化 + 多租户 + 安全增强 + MCP 协议升级 | 第 13-15 周 |

### 6.2 M1：MCP Server 管理 + Tool 注册中心 + 基础执行（第 1-3 周）

**交付内容**

- MCP Server CRUD API（3.1.1 - 3.1.5）
- Server 启停 API（3.1.6 - 3.1.7）
- Server 能力清单查询 - tools/list JSON-RPC 端点（3.1.11）
- Server 运行状态 API（3.1.12）
- Tool 注册中心 CRUD API（3.3.1 - 3.3.5）
- Tool Schema 校验 API（3.3.6）
- Tool 分类管理 API（3.3.7）
- Tool 启用/禁用 API（3.3.9）
- Tool 同步执行 API（3.4.1）
- MCP JSON-RPC tools/call 端点（3.4.5）
- spring-ai-mcp-server-spring-boot-starter 集成
- HTTP 执行器 + BEAN 执行器
- API Key 认证
- 数据模型：`mcp_servers`、`mcp_tools`、`mcp_tool_versions`、`mcp_server_tool_bindings`、`mcp_api_keys`

**验收标准**

- 可创建 MCP Server 实例并启动，外部 MCP Client 可通过 JSON-RPC 连接
- Server 暴露的 tools/list 和 tools/call 正常工作
- 可注册内部 Tool（HTTP/BEAN 执行类型），配置 JSON Schema
- Tool 同步执行可返回 MCP 标准格式结果
- 参数校验通过 JSON Schema 生效
- API Key 认证机制可用

### 6.3 M2：MCP Client 管理 + 外部 Tool 发现与路由（第 4-6 周）

**交付内容**

- MCP Client CRUD API（3.2.1 - 3.2.5）
- Client 连接测试 API（3.2.6）
- Client 连接状态 API（3.2.7）
- 第三方 Server Tools 发现 API（3.2.8）
- 第三方 Server Resources 发现 API（3.2.9）
- 第三方 Server Prompts 发现 API（3.2.10）
- Tool 搜索 API - 关键词模式（3.3.8）
- Tool 批量执行 API（3.4.2）
- spring-ai-mcp-client-spring-boot-starter 集成
- 外部 Tool 路由：内部 Tool 直接执行，外部 Tool 通过 MCP Client 转发
- 自动重连机制 + 健康检查
- 数据模型：`mcp_clients`

**验收标准**

- 可连接第三方 MCP Server（HTTP_SSE / STREAMABLE_HTTP 传输）
- 自动发现第三方 Server 的 Tools 并注册到 Tool 注册中心
- 外部 Tool 调用通过 MCP Client 转发到第三方 Server 执行
- 连接断开后自动重连，重连成功后恢复 Tool 可用性
- 批量执行支持并行模式，结果正确关联
- Tool 搜索支持关键词匹配

### 6.4 M3：Resource 管理 + Prompt 模板管理（第 7-9 周）

**交付内容**

- Server Resource/Prompt 绑定配置 API（3.1.9 - 3.1.10）
- Server 能力清单查询 - resources/list + prompts/list JSON-RPC 端点（3.1.11）
- Resource CRUD API（3.5.1 - 3.5.5）
- Resource 读取 API + MCP resources/read 端点（3.5.6）
- Resource 搜索 API（3.5.7）
- Prompt 模板 CRUD API（3.6.1 - 3.6.5）
- Prompt 渲染 API + MCP prompts/get 端点（3.6.6 - 3.6.7）
- Resource Provider 实现：STATIC / HTTP / ONT_ENTITY / DOC_ASSET
- Resource 缓存机制（Redis）
- Resource 订阅与变更通知（notifications/resources/updated）
- Prompt Mustache 变量替换引擎
- 数据模型：`mcp_resources`、`mcp_prompts`、`mcp_server_resource_bindings`、`mcp_server_prompt_bindings`

**验收标准**

- 可创建 Resource 并绑定到 Server，外部 Client 可通过 resources/list 和 resources/read 读取
- Resource 支持多种 Provider 类型，内容正确返回
- Resource 缓存生效，缓存命中率可查
- 可创建 Prompt 模板并渲染，变量替换正确
- MCP prompts/get 端点返回渲染后的标准 MCP 消息格式
- Resource 订阅变更时可向已连接 Client 发送通知

### 6.5 M4：调用审计 + Outbox 模式 + 事件发布（第 10-12 周）

**交付内容**

- 调用记录列表 API（3.7.1）
- 调用详情 API（3.7.2）
- Token 统计 API（3.7.3）
- 错误追踪 API（3.7.4）
- 调用趋势分析 API（3.7.5）
- Tool 异步执行 API + 执行结果查询 API（3.4.3 - 3.4.4）
- Outbox 模式实现（第 5.3 节）
- Tool 调用事件发布（ToolExecutionStarted/Completed/Failed/TimedOut）
- Server/Client 生命周期事件发布
- Tool 注册变更事件发布
- DLQ 处理机制
- 数据模型：`mcp_tool_executions`、`mcp_call_audit_logs`、`mcp_outbox`

**验收标准**

- 所有 Tool 调用均记录审计日志，包含完整执行路径与 traceId
- Token 统计支持按 Tool/Server/调用方维度聚合
- 错误追踪可展示错误堆栈与 Top 错误码
- 调用趋势分析支持小时/天粒度，展示调用量与错误率趋势
- 事件发布遵循 Outbox 模式，保证数据库与消息一致性
- 消费失败重试 3 次后进入 DLQ，DLQ 记录包含 traceId
- 异步执行支持回调通知

### 6.6 M5：性能优化 + 多租户 + 安全增强 + MCP 协议升级（第 13-15 周）

**交付内容**

- Tool 搜索语义模式与混合模式（3.3.8 - 通过 TECH-LLMGW Embedding）
- Tool 注册缓存优化：Redis 缓存热点 Tool 定义与 Server 能力清单
- 多租户隔离：PostgreSQL 行级安全策略（RLS）、资源配额管理
- 安全增强：API Key 作用域控制、调用频率限制（per-server / per-key）、IP 白名单
- MCP 协议升级：支持最新协议版本、Streamable HTTP 传输优化
- Server 热重载：配置变更不停机生效
- Resource 订阅优化：增量变更检测、批量通知合并
- Tool 执行性能优化：连接池复用、并行执行调优
- 监控指标接入 Prometheus（QPS、延迟、错误率、连接数、缓存命中率）
- 分布式追踪 OpenTelemetry 集成完善
- 数据模型：`mcp_prompt_versions`（Prompt 版本历史）

**验收标准**

- Tool 语义搜索通过 Embedding 相似度匹配，准确率 > 85%
- 多租户隔离生效，不同租户的 Server/Tool/Resource 互不可见
- API Key 作用域控制可用，限制 Key 只能访问指定能力域
- 调用频率限制生效，超限返回 42901 错误码
- Server 配置热重载不中断已建立的连接
- Prometheus 指标可查询，Grafana 仪表盘可展示
- 分布式追踪可在 Jaeger 中查看完整调用链路
- 性能基准：同步 Tool 执行 P99 延迟 < 500ms（不含下游服务耗时）

---

> **文档维护说明**
>
> - 本文档由 Mate Platform 平台架构组维护
> - API 变更需遵循语义化版本：向后兼容的变更递增 minor 版本，不兼容变更递增 major 版本
> - 每次变更需在文档头部更新版本号与日期
> - 新增 API 需同步更新数据模型与事件定义章节
