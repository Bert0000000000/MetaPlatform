# SPEC - A2A 协议适配服务 API 规范（TECH-A2A）

> 文档版本：v1.0
> 文档日期：2026-07-16
> 适用模块：TECH-A2A（A2A Protocol Adapter Service）
> 状态：定稿

---

## 版本历史

| 版本 | 日期 | 变更说明 | 作者 |
|---|---|---|---|
| v1.0 | 2026-07-16 | 初始版本 | - |

---

## 1. 服务概述

### 1.1 定位

TECH-A2A 是 Mate Platform 的 A2A（Agent-to-Agent）协议适配服务，实现平台数字员工与外部 Agent 之间的互相发现、任务委托与异步协作。基于 Google A2A Protocol 规范，TECH-A2A 作为协议网关，对外暴露标准 Agent Card 供外部 Agent 发现平台能力，对内将外部 Agent 委托的任务转换为 TECH-AGENT 执行实例或 TECH-WFE 工作流实例，同时支持平台 Agent 主动向外部 Agent 发起任务委托并异步获取结果。

TECH-A2A 屏蔽了外部 Agent 的协议差异与通信细节，为平台提供统一的 Agent 间协作入口：平台内部只需通过 TECH-A2A 的 REST API 即可完成 Agent 发现、任务委托、结果回调等操作，无需关心目标 Agent 是基于 A2A、MCP 还是其他协议接入。

### 1.2 技术栈

| 层次 | 技术选型 | 说明 |
|---|---|---|
| 语言/框架 | Java 21 + Spring Boot 3.4 | 异步非阻塞 Web 框架（WebFlux + WebClient） |
| 协议规范 | A2A Protocol（Google） | Agent Card、Task lifecycle、JSON-RPC 2.0 |
| 持久化 | PostgreSQL 17 | Agent Card、委托任务、协作记录、审计日志持久化 |
| 缓存 | Redis 7.4 | Agent Card 缓存、Agent 健康状态缓存、分布式锁 |
| 消息队列 | Kafka 3.9 | 任务委托事件、Agent 状态变更事件（Outbox 模式） |
| 异步任务调度 | Spring Scheduling + Redis 分布式锁 | 任务超时检测、Agent 健康检查定时任务 |
| 可观测性 | OpenTelemetry 1.45 | trace_id 全链路传播 |
| 安全认证 | JWT + API Key | Agent 间双向认证 |

### 1.3 上游依赖

| 上游服务 | 依赖关系 | 说明 |
|---|---|---|
| TECH-AGENT | 强依赖 | 外部委托任务转交 TECH-AGENT 执行；平台 Agent 执行能力来源于 TECH-AGENT |
| TECH-WFE | 强依赖 | 外部委托任务可转交 TECH-WFE 转为内部工作流执行；任务回调与工作流事件联动 |
| TECH-IAM | 强依赖 | Agent 身份认证、API Key/JWT 签发与校验、权限控制 |
| TECH-GW | 中依赖 | API 网关层路由、限流、TLS 终止 |
| TECH-MSG | 弱依赖 | Kafka 消息基础设施 |
| TECH-OBS | 弱依赖 | 可观测性数据采集 |

### 1.4 下游消费

| 下游服务/应用 | 消费方式 | 说明 |
|---|---|---|
| APP-DW | REST API | 数字员工通过 A2A 向外部 Agent 委托任务、查询委托结果 |
| APP-SUPERAI | REST API | 超级 AI 发现并调用外部 Agent 能力 |
| APP-DASHBOARD | REST API | 仪表盘展示协作统计、委托任务状态、Agent 健康度 |
| 外部 Agent | A2A Protocol（JSON-RPC over HTTP/SSE） | 外部 Agent 通过标准 A2A 协议发现平台 Agent Card、向平台委托任务、获取任务结果 |

### 1.5 核心能力清单

| 能力域 | 说明 |
|---|---|
| Agent Card 管理 | 发布平台 Agent Card（能力声明）、发现外部 Agent Card、Agent Card 搜索与缓存 |
| 任务委托 | 向外部 Agent 委托任务、接收外部 Agent 的任务委托、任务状态同步与回调 |
| 异步协作 | 任务进度查询、任务结果获取、任务取消、任务超时处理、回调注册 |
| Agent 注册发现 | Agent 注册、Agent 发现、Agent 健康检查、Agent 注销 |
| 消息通道 | Agent 间消息传递、消息队列管理、消息确认机制 |
| 安全认证 | Agent 间双向认证（API Key/JWT）、Token 管理、权限验证 |
| 协作审计 | 协作记录查询、委托统计、错误追踪、SLA 监控 |

### 1.6 核心概念

| 概念 | 说明 |
|---|---|
| Agent Card | A2A 协议中的 Agent 能力声明文档，包含 Agent 标识、名称、描述、能力（skills）、端点 URL、认证方式等 |
| Skill | Agent Card 中声明的单项能力，包含名称、描述、输入/输出模式、标签 |
| Delegation Task | 跨 Agent 委托的任务单元，包含任务 ID、发起方、接收方、任务输入、状态、结果 |
| Agent Endpoint | Agent 的 A2A 服务端点 URL，支持 JSON-RPC 2.0 调用 |
| Collaboration Session | 一次 Agent 间协作会话，可能包含多轮任务委托与消息交互 |
| Callback URL | 异步任务结果回调地址，任务完成后接收方回调通知发起方 |
| Agent Registry | Agent 注册中心，管理已注册 Agent 的元信息与健康状态 |
| Trace Context | 跨 Agent 协作的链路追踪上下文，trace_id 在委托链路中透传 |

### 1.7 A2A 协议说明

A2A（Agent-to-Agent Protocol）是 Google 发布的开放协议，定义了 Agent 间标准化协作的通信规范：

```
┌──────────────┐    1. Discover Agent Card    ┌──────────────┐
│  Agent A     │ ──────────────────────────>   │  Agent B     │
│ (发起方)     │ <──────────────────────────   │ (接收方)     │
│              │    1. Return Agent Card       │              │
│              │                               │              │
│              │    2. Send Task (JSON-RPC)    │              │
│              │ ──────────────────────────>   │              │
│              │ <──────────────────────────   │              │
│              │    2. Return Task ID          │              │
│              │                               │              │
│              │    3. Poll Task Status        │              │
│              │ ──────────────────────────>   │              │
│              │ <──────────────────────────   │              │
│              │    3. Return Task Result      │              │
│              │              OR               │              │
│              │    3. Callback (SSE/Webhook)  │              │
│              │ <──────────────────────────   │              │
└──────────────┘                               └──────────────┘
```

- **Agent Card 发现**：通过 `GET /.well-known/agent.json` 获取 Agent Card
- **任务委托**：基于 JSON-RPC 2.0，`tasks/send` 发送任务，`tasks/get` 查询任务
- **任务状态**：`submitted` -> `working` -> `input-required` / `completed` / `canceled` / `failed`
- **流式推送**：支持 SSE（Server-Sent Events）实时推送任务进度
- **认证**：支持 API Key、OAuth 2.0、JWT 等多种认证方式

TECH-A2A 同时作为 A2A Server（对外暴露 Agent Card 和接收任务）和 A2A Client（向外部 Agent 发送任务）。

---

## 2. 通用约定

### 2.1 路径前缀

所有 TECH-A2A API 路径统一前缀：`/api/v1/a2a`

此外，TECH-A2A 还暴露 A2A 协议标准端点：
- Agent Card 端点：`/.well-known/agent.json`（公开，无需认证）
- JSON-RPC 端点：`/rpc/v1/a2a`（外部 Agent 调用入口）

### 2.2 A2A 协议说明

TECH-A2A 遵循 A2A Protocol 规范，核心交互基于 JSON-RPC 2.0：

**JSON-RPC 请求格式**

```json
{
  "jsonrpc": "2.0",
  "method": "tasks/send",
  "params": {
    "id": "task-external-001",
    "message": {
      "role": "user",
      "parts": [
        { "type": "text", "text": "请分析这份季度报告并生成摘要" }
      ]
    }
  },
  "id": "rpc-001"
}
```

**JSON-RPC 响应格式**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "id": "task-external-001",
    "status": { "state": "working" },
    "taskId": "delegation-task-20260716-000001"
  },
  "id": "rpc-001"
}
```

### 2.3 统一响应体

平台内部 REST API 返回统一 JSON 结构：

```json
{
  "code": 0,
  "message": "success",
  "data": { },
  "traceId": "a1b2c3d4e5f6"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| code | int | 业务状态码，0 表示成功，非 0 表示失败 |
| message | string | 状态描述信息 |
| data | object/array/null | 业务数据载体 |
| traceId | string | 全链路追踪 ID，与请求头 `X-Trace-Id` 一致 |

### 2.4 认证

TECH-A2A 支持两种认证模式：

**平台内部认证（内部服务调用）**
- 认证方式：Bearer Token（JWT）
- 请求头：`Authorization: Bearer <token>`
- Token 由 TECH-IAM 签发，包含 `userId`、`tenantId`、`roles` 等声明
- 数字员工（APP-DW）调用时使用 Service Token，包含 `agentId` 声明

**Agent 间认证（A2A 协议通信）**
- API Key 认证：请求头 `X-Agent-Api-Key: <apiKey>`，适用于外部 Agent 调用平台
- JWT 认证：双向 JWT 交换，适用于高安全场景
- OAuth 2.0：支持 Authorization Code Grant 流程
- 认证凭证在 Agent 注册时配置，存储于加密的 Agent Credential 表

### 2.5 请求头约定

| 请求头 | 必填 | 说明 |
|---|---|---|
| Authorization | 是 | Bearer Token（平台内部调用） |
| X-Agent-Api-Key | 条件 | Agent 间调用时使用（替代 Authorization） |
| X-Trace-Id | 否 | 链路追踪 ID，未传则服务端自动生成 |
| X-Tenant-Id | 是 | 租户 ID |
| X-Request-Id | 否 | 请求唯一标识，用于幂等控制 |
| X-Callback-Url | 否 | 异步任务结果回调地址 |
| Content-Type | 是 | `application/json;charset=UTF-8` |
| Accept | 否 | SSE 接口需设为 `text/event-stream` |

### 2.6 错误码

| 错误码 | HTTP Status | 含义 | 典型场景 |
|---|---|---|---|
| 0 | 200 | 成功 | 正常请求 |
| 40001 | 400 | 参数校验失败 | 必填字段缺失、格式错误 |
| 40002 | 400 | 参数值非法 | 枚举值不匹配、URL 格式不合法 |
| 40101 | 401 | 未认证 | Token/API Key 缺失或过期 |
| 40102 | 401 | Agent 认证失败 | Agent 未注册、API Key 无效、JWT 签名错误 |
| 40301 | 403 | 无权限 | Agent 无权委托任务给目标 Agent |
| 40302 | 403 | 能力不匹配 | 目标 Agent 不具备请求的 Skill |
| 40401 | 404 | 资源不存在 | Agent Card / 委托任务 / Agent 不存在 |
| 40402 | 404 | 外部 Agent 不可达 | 外部 Agent 端点连接超时或拒绝 |
| 40901 | 409 | 状态冲突 | 操作与当前任务状态不兼容（如已完成任务再次取消） |
| 40902 | 409 | Agent 已注册 | Agent 重复注册且不允许覆盖 |
| 42201 | 422 | 业务规则校验失败 | Agent Card 格式不符合 A2A 规范、Skill 定义不完整 |
| 42202 | 422 | 任务委托失败 | 目标 Agent 拒绝任务、任务输入不满足 Skill 输入模式 |
| 42203 | 422 | Agent 不健康 | Agent 健康检查失败，不允许委托任务 |
| 42901 | 429 | 请求过于频繁 | 触发限流 |
| 50001 | 500 | 服务内部错误 | 未捕获异常 |
| 50002 | 500 | 依赖服务不可用 | TECH-AGENT/TECH-WFE/TECH-IAM 不可达 |
| 50003 | 500 | A2A 协议通信异常 | JSON-RPC 调用失败、外部 Agent 响应解析错误 |
| 50401 | 504 | 外部 Agent 响应超时 | 委托任务发送超时、回调等待超时 |

### 2.7 分页约定

分页查询接口统一参数：

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| page | int | 1 | 页码，从 1 开始 |
| size | int | 20 | 每页条数，最大 100 |
| sort | string | -createdAt | 排序字段，`-` 前缀表示降序 |

分页响应结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [ ],
    "total": 156,
    "page": 1,
    "size": 20,
    "totalPages": 8
  },
  "traceId": "a1b2c3d4e5f6"
}
```

### 2.8 trace_id 传播

- 请求进入时，优先使用请求头 `X-Trace-Id` 的值作为 traceId
- 若未传，则服务端自动生成 UUID 作为 traceId
- traceId 写入响应体的 `traceId` 字段
- traceId 写入 MDC（SLF4J MDC），贯穿所有日志输出
- traceId 传播至下游服务调用（REST 调用透传 `X-Trace-Id` 头至 TECH-AGENT/TECH-WFE）
- traceId 传播至外部 Agent 调用（JSON-RPC 请求头透传 `X-Trace-Id`）
- traceId 写入 Kafka 消息头 `X-Trace-Id`
- traceId 写入委托任务的 `trace_id` 字段，贯穿任务全生命周期
- 外部 Agent 回调时透传 `X-Trace-Id`，保持跨 Agent 链路完整

### 2.9 幂等控制

- 写操作支持幂等：客户端传递 `X-Request-Id` 请求头
- 服务端基于 `(tenantId, requestType, requestId)` 做幂等去重
- 幂等窗口：24 小时
- 同一 `X-Request-Id` 重复请求返回首次结果
- A2A JSON-RPC 请求的 `id` 字段同时作为幂等键

### 2.10 任务状态机

委托任务遵循 A2A 协议状态机：

```
                         ┌─────────────────┐
                         │    SUBMITTED    │ ← 任务已提交，等待接收方确认
                         └────────┬────────┘
                                  │
                                  v
                         ┌─────────────────┐
              ┌─────────>│     WORKING     │ ← 接收方正在处理
              │          └────┬───┬───┬────┘
              │               │   │   │
     (重新提交)               │   │   │ (取消)
              │               │   │   │
              │          (完成)│   │(需输入)
              │               │   │   v
              │               │   v  ┌─────────────────┐
              │               │  ┌──>│ INPUT_REQUIRED  │
              │               │  │   └─────────────────┘
              │               v  │
              │   ┌─────────────────┐    ┌─────────────────┐
              └───│    COMPLETED    │    │    CANCELED     │
                  └─────────────────┘    └─────────────────┘

                                       ┌─────────────────┐
                                  ┌───>│     FAILED      │ ← 执行异常
                                  │    └─────────────────┘
                                  │
                         ┌────────┴────────┐
                         │     WORKING     │
                         └─────────────────┘
                              (超时/异常)
```

| 状态 | 说明 |
|---|---|
| SUBMITTED | 任务已提交，等待接收 Agent 确认 |
| WORKING | 接收 Agent 正在处理任务 |
| INPUT_REQUIRED | 接收 Agent 需要额外输入，等待发起方补充信息 |
| COMPLETED | 任务已完成，结果可用 |
| CANCELED | 任务已被取消 |
| FAILED | 任务执行失败 |
| TIMEOUT | 任务超时未完成（平台内部状态，A2A 映射为 FAILED） |

---

## 3. API 接口详情

### 3.1 Agent Card 管理 API

#### 3.1.1 发布 Agent Card

发布平台内部 Agent 的 Agent Card，将其注册为可被外部 Agent 发现的 A2A Agent。Agent Card 包含 Agent 的能力声明（skills）、端点 URL、认证方式等信息。

发布时需关联 TECH-AGENT 中的 Agent 定义，系统自动从 Agent 定义中提取能力信息生成 Agent Card。

```
POST /api/v1/a2a/agent-cards
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| agentId | string | 是 | 平台 Agent ID（关联 TECH-AGENT） |
| name | string | 是 | Agent 显示名称 |
| description | string | 是 | Agent 描述 |
| version | string | 是 | Agent Card 版本号（语义化版本，如 `1.0.0`） |
| protocolVersion | string | 否 | A2A 协议版本，默认 `1.0` |
| endpointUrl | string | 否 | A2A 服务端点 URL，不传则使用默认 `https://{platform-host}/rpc/v1/a2a` |
| skills | array | 是 | 能力声明列表 |
| skills[].name | string | 是 | Skill 名称（唯一标识） |
| skills[].description | string | 是 | Skill 描述 |
| skills[].tags | array | 否 | Skill 标签列表 |
| skills[].inputSchema | object | 否 | 输入参数 JSON Schema |
| skills[].outputSchema | object | 否 | 输出结果 JSON Schema |
| skills[].examples | array | 否 | 使用示例列表 |
| capabilities | object | 否 | Agent 能力声明 |
| capabilities.streaming | boolean | 否 | 是否支持 SSE 流式推送，默认 false |
| capabilities.pushNotifications | boolean | 否 | 是否支持推送通知，默认 false |
| capabilities.stateTransitionHistory | boolean | 否 | 是否支持状态转换历史查询，默认 false |
| authentication | object | 否 | 认证方式配置 |
| authentication.schemes | array | 是 | 认证方案列表：`API_KEY` / `JWT` / `OAUTH2` / `NONE` |
| authentication.credentials | object | 否 | 认证凭证（API Key 值等，加密存储） |
| defaultInputModes | array | 否 | 默认输入模式：`text` / `file` / `data`，默认 `["text"]` |
| defaultOutputModes | array | 否 | 默认输出模式：`text` / `file` / `data`，默认 `["text"]` |
| visibility | string | 否 | 可见性：`PUBLIC`（公网可发现）/ `PRIVATE`（需认证发现），默认 `PRIVATE` |
| metadata | object | 否 | 自定义元数据 |

**请求示例**

```json
{
  "agentId": "agent-dw-001",
  "name": "财务分析数字员工",
  "description": "提供财务报表分析、预算审核、费用预测等能力的 AI 数字员工",
  "version": "1.0.0",
  "protocolVersion": "1.0",
  "skills": [
    {
      "name": "financial-report-analysis",
      "description": "分析财务报表并生成结构化摘要与洞察",
      "tags": ["finance", "report", "analysis"],
      "inputSchema": {
        "type": "object",
        "properties": {
          "reportUrl": { "type": "string", "description": "财务报表文件 URL" },
          "analysisType": { "type": "string", "enum": ["summary", "deep-dive", "comparison"] }
        },
        "required": ["reportUrl"]
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "summary": { "type": "string" },
          "keyMetrics": { "type": "array", "items": { "type": "object" } },
          "insights": { "type": "array", "items": { "type": "string" } }
        }
      },
      "examples": ["请分析 2026 年 Q2 季度财报"]
    },
    {
      "name": "budget-review",
      "description": "审核预算申请，返回审批建议",
      "tags": ["finance", "budget", "approval"]
    }
  ],
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "stateTransitionHistory": true
  },
  "authentication": {
    "schemes": ["API_KEY", "JWT"]
  },
  "defaultInputModes": ["text", "file", "data"],
  "defaultOutputModes": ["text", "data"],
  "visibility": "PUBLIC"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "cardId": "card-a2a-20260716-000001",
    "agentId": "agent-dw-001",
    "name": "财务分析数字员工",
    "description": "提供财务报表分析、预算审核、费用预测等能力的 AI 数字员工",
    "version": "1.0.0",
    "protocolVersion": "1.0",
    "endpointUrl": "https://metaplatform.example.com/rpc/v1/a2a",
    "agentCardUrl": "https://metaplatform.example.com/.well-known/agent.json",
    "skills": [
      {
        "name": "financial-report-analysis",
        "description": "分析财务报表并生成结构化摘要与洞察",
        "tags": ["finance", "report", "analysis"]
      },
      {
        "name": "budget-review",
        "description": "审核预算申请，返回审批建议",
        "tags": ["finance", "budget", "approval"]
      }
    ],
    "capabilities": {
      "streaming": true,
      "pushNotifications": true,
      "stateTransitionHistory": true
    },
    "authentication": {
      "schemes": ["API_KEY", "JWT"]
    },
    "visibility": "PUBLIC",
    "status": "PUBLISHED",
    "publishedAt": "2026-07-16T10:30:00.000+08:00",
    "publishedBy": "user-001"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | name/description/version/skills 为空 |
| 40401 | agentId 在 TECH-AGENT 中不存在 |
| 40902 | 该 agentId 已发布 Agent Card 且版本号未变更 |
| 42201 | Agent Card 格式不符合 A2A 规范（缺少必填字段、Skill 定义不完整） |
| 42201 | inputSchema/outputSchema 不是合法的 JSON Schema |
| 50002 | TECH-AGENT 服务不可达，无法校验 agentId |

---

#### 3.1.2 查询 Agent Card

查询单个 Agent Card 的详细信息。支持通过 cardId 或 agentId 查询。

```
GET /api/v1/a2a/agent-cards/{cardId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| cardId | string | Agent Card ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| includeSkills | boolean | 否 | 是否包含完整 Skill 定义，默认 true |
| includeAuth | boolean | 否 | 是否包含认证配置（需管理员权限），默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "cardId": "card-a2a-20260716-000001",
    "agentId": "agent-dw-001",
    "name": "财务分析数字员工",
    "description": "提供财务报表分析、预算审核、费用预测等能力的 AI 数字员工",
    "version": "1.0.0",
    "protocolVersion": "1.0",
    "endpointUrl": "https://metaplatform.example.com/rpc/v1/a2a",
    "agentCardUrl": "https://metaplatform.example.com/.well-known/agent.json",
    "skills": [
      {
        "name": "financial-report-analysis",
        "description": "分析财务报表并生成结构化摘要与洞察",
        "tags": ["finance", "report", "analysis"],
        "inputSchema": { "type": "object", "properties": { } },
        "outputSchema": { "type": "object", "properties": { } },
        "examples": ["请分析 2026 年 Q2 季度财报"]
      },
      {
        "name": "budget-review",
        "description": "审核预算申请，返回审批建议",
        "tags": ["finance", "budget", "approval"]
      }
    ],
    "capabilities": {
      "streaming": true,
      "pushNotifications": true,
      "stateTransitionHistory": true
    },
    "authentication": {
      "schemes": ["API_KEY", "JWT"]
    },
    "visibility": "PUBLIC",
    "status": "PUBLISHED",
    "publishedAt": "2026-07-16T10:30:00.000+08:00",
    "publishedBy": "user-001",
    "updatedAt": "2026-07-16T10:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent Card 不存在 |
| 40301 | 无权查看（PRIVATE Agent Card 且无认证） |

---

#### 3.1.3 搜索 Agent

分页搜索已注册的 Agent Card，支持按名称、能力标签、技能名称等多维度筛选。同时支持搜索外部发现的 Agent。

```
GET /api/v1/a2a/agent-cards
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| keyword | string | 否 | 关键词搜索（匹配 name、description） |
| skill | string | 否 | 按技能名称筛选 |
| tags | string | 否 | 按标签筛选，逗号分隔（如 `finance,report`） |
| source | string | 否 | 来源：`INTERNAL`（平台发布）/ `EXTERNAL`（外部发现）/ `ALL`，默认 `ALL` |
| visibility | string | 否 | 可见性筛选：`PUBLIC` / `PRIVATE` / `ALL` |
| status | string | 否 | 状态筛选：`PUBLISHED` / `UNPUBLISHED` / `DEPRECATED` |
| protocolVersion | string | 否 | A2A 协议版本筛选 |
| page | int | 否 | 页码 |
| size | int | 否 | 每页条数 |
| sort | string | 否 | 排序字段，默认 `-publishedAt` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "cardId": "card-a2a-20260716-000001",
        "agentId": "agent-dw-001",
        "name": "财务分析数字员工",
        "description": "提供财务报表分析、预算审核、费用预测等能力的 AI 数字员工",
        "version": "1.0.0",
        "source": "INTERNAL",
        "visibility": "PUBLIC",
        "status": "PUBLISHED",
        "endpointUrl": "https://metaplatform.example.com/rpc/v1/a2a",
        "skills": [
          { "name": "financial-report-analysis", "tags": ["finance", "report"] },
          { "name": "budget-review", "tags": ["finance", "budget"] }
        ],
        "publishedAt": "2026-07-16T10:30:00.000+08:00"
      },
      {
        "cardId": "card-ext-20260716-000002",
        "agentId": "ext-agent-gpt-finance",
        "name": "GPT Finance Agent",
        "description": "External finance analysis agent powered by GPT",
        "version": "2.1.0",
        "source": "EXTERNAL",
        "visibility": "PUBLIC",
        "status": "PUBLISHED",
        "endpointUrl": "https://external-agent.example.com/rpc/a2a",
        "skills": [
          { "name": "market-analysis", "tags": ["finance", "market"] }
        ],
        "discoveredAt": "2026-07-16T11:00:00.000+08:00"
      }
    ],
    "total": 2,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | source/visibility/status 枚举值不合法 |

---

#### 3.1.4 更新 Agent Card

更新已发布的 Agent Card。支持部分更新，版本号变更时需递增。

```
PUT /api/v1/a2a/agent-cards/{cardId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| cardId | string | Agent Card ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | 更新 Agent 显示名称 |
| description | string | 否 | 更新描述 |
| version | string | 否 | 新版本号（必须大于当前版本） |
| skills | array | 否 | 更新能力声明列表（全量替换） |
| capabilities | object | 否 | 更新能力声明 |
| authentication | object | 否 | 更新认证配置 |
| visibility | string | 否 | 更新可见性 |
| status | string | 否 | 更新状态：`PUBLISHED` / `UNPUBLISHED` / `DEPRECATED` |
| expectedVersion | int | 是 | 乐观锁版本号（当前数据的 version 字段值） |

**请求示例**

```json
{
  "description": "提供财务报表分析、预算审核、费用预测、税务规划等能力的 AI 数字员工",
  "version": "1.1.0",
  "skills": [
    {
      "name": "financial-report-analysis",
      "description": "分析财务报表并生成结构化摘要与洞察",
      "tags": ["finance", "report", "analysis"]
    },
    {
      "name": "budget-review",
      "description": "审核预算申请，返回审批建议",
      "tags": ["finance", "budget", "approval"]
    },
    {
      "name": "tax-planning",
      "description": "基于财务数据提供税务规划建议",
      "tags": ["finance", "tax"]
    }
  ],
  "expectedVersion": 1
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "cardId": "card-a2a-20260716-000001",
    "name": "财务分析数字员工",
    "description": "提供财务报表分析、预算审核、费用预测、税务规划等能力的 AI 数字员工",
    "version": "1.1.0",
    "status": "PUBLISHED",
    "updatedAt": "2026-07-16T14:00:00.000+08:00",
    "updatedBy": "user-001",
    "versionNumber": 2
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent Card 不存在 |
| 40902 | 乐观锁版本冲突（expectedVersion 不匹配） |
| 42201 | 新版本号不大于当前版本号 |
| 42201 | skills 格式不符合 A2A 规范 |
| 40301 | 无权更新该 Agent Card |

---

#### 3.1.5 发现外部 Agent Card

通过 URL 发现外部 Agent 的 Agent Card，将其缓存到本地注册表。支持手动输入外部 Agent 的 Agent Card URL 进行发现。

```
POST /api/v1/a2a/agent-cards/discover
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| agentUrl | string | 是 | 外部 Agent 的 URL（如 `https://external-agent.example.com`） |
| agentCardPath | string | 否 | Agent Card 路径，默认 `/.well-known/agent.json` |
| authentication | object | 否 | 发现请求的认证配置 |
| authentication.type | string | 否 | 认证类型：`API_KEY` / `BEARER` / `NONE` |
| authentication.token | string | 否 | 认证令牌 |
| cacheStrategy | string | 否 | 缓存策略：`CACHE`（缓存到本地）/ `NO_CACHE`（仅查询不缓存），默认 `CACHE` |
| refresh | boolean | 否 | 是否强制刷新（忽略本地缓存），默认 false |

**请求示例**

```json
{
  "agentUrl": "https://external-agent.example.com",
  "authentication": {
    "type": "API_KEY",
    "token": "ext-api-key-xxx"
  },
  "cacheStrategy": "CACHE",
  "refresh": false
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "cardId": "card-ext-20260716-000003",
    "name": "External Research Agent",
    "description": "External agent for market research and competitive analysis",
    "version": "3.0.0",
    "protocolVersion": "1.0",
    "endpointUrl": "https://external-agent.example.com/rpc/a2a",
    "source": "EXTERNAL",
    "skills": [
      {
        "name": "market-research",
        "description": "Conduct market research on given topics",
        "tags": ["research", "market"]
      },
      {
        "name": "competitive-analysis",
        "description": "Analyze competitors and generate report",
        "tags": ["research", "competition"]
      }
    ],
    "capabilities": {
      "streaming": true,
      "pushNotifications": false,
      "stateTransitionHistory": true
    },
    "authentication": {
      "schemes": ["API_KEY"]
    },
    "discoveredAt": "2026-07-16T15:00:00.000+08:00",
    "cached": true,
    "healthStatus": "UNKNOWN"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | agentUrl 格式不合法 |
| 40402 | 外部 Agent 不可达（连接超时/拒绝） |
| 42201 | 返回的 Agent Card 格式不符合 A2A 规范 |
| 50401 | 外部 Agent 响应超时 |
| 50003 | Agent Card 解析失败 |

---

#### 3.1.6 删除 Agent Card

删除已发布的 Agent Card。删除后外部 Agent 将无法发现该 Agent。已有关联委托任务的 Agent Card 不允许直接删除，需先取消关联任务。

```
DELETE /api/v1/a2a/agent-cards/{cardId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| cardId | string | Agent Card ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| force | boolean | 否 | 是否强制删除（取消关联的进行中任务），默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "cardId": "card-a2a-20260716-000001",
    "deletedAt": "2026-07-16T16:00:00.000+08:00",
    "deletedBy": "user-001",
    "cancelledTasks": 0
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent Card 不存在 |
| 40901 | 存在关联的进行中委托任务（force=false 时） |
| 40301 | 无权删除该 Agent Card |

---

### 3.2 任务委托 API

#### 3.2.1 委托任务给外部 Agent

平台 Agent 向外部 Agent 发起任务委托。TECH-A2A 作为 A2A Client，通过 JSON-RPC 2.0 向外部 Agent 的 endpointUrl 发送 `tasks/send` 请求，并在本地创建委托任务记录。

```
POST /api/v1/a2a/delegations
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| targetCardId | string | 是 | 目标 Agent Card ID（已注册/发现的外部 Agent） |
| skillName | string | 是 | 调用的 Skill 名称（需在目标 Agent Card 中声明） |
| message | object | 是 | 任务消息体（A2A Message 格式） |
| message.role | string | 否 | 角色，默认 `user` |
| message.parts | array | 是 | 消息内容分片列表 |
| message.parts[].type | string | 是 | 分片类型：`text` / `file` / `data` |
| message.parts[].text | string | 条件 | 文本内容（type=text 时必填） |
| message.parts[].file | object | 条件 | 文件内容（type=file 时必填） |
| message.parts[].file.url | string | 是 | 文件 URL |
| message.parts[].file.mimeType | string | 否 | 文件 MIME 类型 |
| message.parts[].data | object | 条件 | 结构化数据（type=data 时必填） |
| sessionId | string | 否 | 协作会话 ID，不传则自动创建新会话 |
| callbackUrl | string | 否 | 任务结果回调地址（任务完成后回调通知） |
| timeout | int | 否 | 任务超时时间（秒），默认 300（5 分钟） |
| priority | int | 否 | 优先级：1(低)/2(中)/3(高)，默认 2 |
| metadata | object | 否 | 自定义元数据（透传至外部 Agent） |
| pushNotification | object | 否 | 推送通知配置（当外部 Agent 支持时） |
| pushNotification.url | string | 是 | 接收推送通知的 URL |
| pushNotification.token | string | 否 | 推送认证 Token |

**请求示例**

```json
{
  "targetCardId": "card-ext-20260716-000003",
  "skillName": "market-research",
  "message": {
    "role": "user",
    "parts": [
      {
        "type": "text",
        "text": "请对国内 SaaS CRM 市场进行竞品分析，覆盖前五大厂商"
      },
      {
        "type": "data",
        "data": {
          "marketScope": "China",
          "productCategory": "SaaS CRM",
          "topN": 5,
          "dimensions": ["market-share", "pricing", "features", "customer-base"]
        }
      }
    ]
  },
  "callbackUrl": "https://metaplatform.example.com/api/v1/a2a/callbacks/delegation-result",
  "timeout": 600,
  "priority": 3,
  "metadata": {
    "requestSource": "APP-DW",
    "businessContext": "季度市场分析"
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "delegationId": "deleg-20260716-000001",
    "externalTaskId": "task-ext-agent-789012",
    "targetCardId": "card-ext-20260716-000003",
    "targetAgentName": "External Research Agent",
    "skillName": "market-research",
    "sessionId": "session-20260716-000001",
    "status": "SUBMITTED",
    "direction": "OUTBOUND",
    "callbackUrl": "https://metaplatform.example.com/api/v1/a2a/callbacks/delegation-result",
    "timeout": 600,
    "expiresAt": "2026-07-16T20:00:00.000+08:00",
    "createdAt": "2026-07-16T10:00:00.000+08:00",
    "createdBy": "agent-dw-001"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | targetCardId/skillName/message 为空 |
| 40401 | targetCardId 对应的 Agent Card 不存在 |
| 40302 | 目标 Agent Card 中不存在指定的 skillName |
| 40402 | 外部 Agent 端点不可达 |
| 42203 | 目标 Agent 健康检查失败，不允许委托 |
| 42202 | 外部 Agent 拒绝任务（输入不满足 Skill 输入模式） |
| 50401 | 外部 Agent 响应超时 |
| 50003 | JSON-RPC 调用失败、响应解析错误 |

---

#### 3.2.2 接收外部 Agent 任务委托

外部 Agent 通过 A2A JSON-RPC 端点向平台发起任务委托。TECH-A2A 作为 A2A Server 接收任务，转为内部 Agent 执行或工作流执行。

此接口为 A2A 协议标准端点，外部 Agent 通过 JSON-RPC 调用：

```
POST /rpc/v1/a2a
```

**JSON-RPC 请求参数（method: tasks/send）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | string | 是 | 外部任务 ID（由外部 Agent 生成） |
| message | object | 是 | 任务消息体（A2A Message 格式） |
| message.role | string | 否 | 角色，默认 `user` |
| message.parts | array | 是 | 消息内容分片列表 |
| message.parts[].type | string | 是 | 分片类型：`text` / `file` / `data` |
| message.parts[].text | string | 条件 | 文本内容 |
| message.parts[].data | object | 条件 | 结构化数据 |
| sessionId | string | 否 | 会话 ID |
| pushNotification | object | 否 | 推送通知配置 |

**JSON-RPC 请求示例**

```json
{
  "jsonrpc": "2.0",
  "method": "tasks/send",
  "params": {
    "id": "task-ext-789012",
    "message": {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "请分析这份采购合同并标注风险条款"
        },
        {
          "type": "file",
          "file": {
            "url": "https://external-agent.example.com/files/contract-2026.pdf",
            "mimeType": "application/pdf"
          }
        }
      ]
    },
    "pushNotification": {
      "url": "https://external-agent.example.com/callbacks/task-complete",
      "token": "push-token-xxx"
    }
  },
  "id": "rpc-001"
}
```

**JSON-RPC 响应示例**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "id": "task-ext-789012",
    "status": {
      "state": "submitted",
      "timestamp": "2026-07-16T10:05:00.000+08:00"
    },
    "taskId": "deleg-20260716-000002",
    "sessionId": "session-20260716-000002",
    "agentName": "合同分析数字员工"
  },
  "id": "rpc-001"
}
```

**内部处理流程**

1. 解析 JSON-RPC 请求，验证调用方 Agent 身份（API Key/JWT）
2. 根据 Skill 匹配平台 Agent（从 Agent Card 的 skills 映射）
3. 创建委托任务记录（direction=INBOUND）
4. 将任务转交 TECH-AGENT 执行或 TECH-WFE 工作流执行
5. 返回任务 ID 与初始状态（submitted）
6. 任务完成后通过回调通知外部 Agent

**错误场景（JSON-RPC error 格式）**

| JSON-RPC error code | 说明 |
|---|---|
| -32600 | 无效请求（不符合 JSON-RPC 2.0 规范） |
| -32601 | 方法不存在（method 不支持） |
| -32602 | 参数无效（缺少必填字段） |
| -32001 | Agent 认证失败 |
| -32002 | Skill 不匹配（无 Agent 能处理请求的 Skill） |
| -32003 | Agent 不健康 |
| -32004 | 依赖服务不可用（TECH-AGENT/TECH-WFE 不可达） |

---

#### 3.2.3 查询委托任务状态

查询委托任务的当前状态。支持查询出站（OUTBOUND）和入站（INBOUND）任务。

```
GET /api/v1/a2a/delegations/{delegationId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| delegationId | string | 委托任务 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| syncExternal | boolean | 否 | 是否同步查询外部 Agent 最新状态（OUTBOUND 任务），默认 false（返回本地缓存状态） |
| includeHistory | boolean | 否 | 是否包含状态转换历史，默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "delegationId": "deleg-20260716-000001",
    "externalTaskId": "task-ext-agent-789012",
    "direction": "OUTBOUND",
    "targetCardId": "card-ext-20260716-000003",
    "targetAgentName": "External Research Agent",
    "skillName": "market-research",
    "sourceAgentId": "agent-dw-001",
    "sourceAgentName": "市场分析数字员工",
    "sessionId": "session-20260716-000001",
    "status": "WORKING",
    "priority": 3,
    "callbackUrl": "https://metaplatform.example.com/api/v1/a2a/callbacks/delegation-result",
    "inputMessage": {
      "role": "user",
      "parts": [
        { "type": "text", "text": "请对国内 SaaS CRM 市场进行竞品分析..." }
      ]
    },
    "inputMetadata": {
      "requestSource": "APP-DW",
      "businessContext": "季度市场分析"
    },
    "createdAt": "2026-07-16T10:00:00.000+08:00",
    "updatedAt": "2026-07-16T10:05:00.000+08:00",
    "expiresAt": "2026-07-16T20:00:00.000+08:00",
    "statusHistory": [
      {
        "state": "SUBMITTED",
        "timestamp": "2026-07-16T10:00:00.000+08:00",
        "detail": "Task submitted to external agent"
      },
      {
        "state": "WORKING",
        "timestamp": "2026-07-16T10:05:00.000+08:00",
        "detail": "External agent started processing"
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 委托任务不存在 |
| 40301 | 无权查看该委托任务 |
| 40402 | syncExternal=true 但外部 Agent 不可达 |
| 50401 | 外部 Agent 状态查询超时 |

---

#### 3.2.4 获取委托任务结果

获取已完成委托任务的结果。任务必须处于 COMPLETED 状态。

```
GET /api/v1/a2a/delegations/{delegationId}/result
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| delegationId | string | 委托任务 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "delegationId": "deleg-20260716-000001",
    "status": "COMPLETED",
    "completedAt": "2026-07-16T10:30:00.000+08:00",
    "duration": 1800000,
    "result": {
      "message": {
        "role": "agent",
        "parts": [
          {
            "type": "text",
            "text": "国内 SaaS CRM 市场竞品分析报告已完成。前五大厂商分别为：销售易、纷享销客、神州云动、红圈营销、玄武科技..."
          },
          {
            "type": "data",
            "data": {
              "reportTitle": "2026 Q2 中国 SaaS CRM 市场竞品分析",
              "competitors": [
                {
                  "name": "销售易",
                  "marketShare": "23.5%",
                  "pricing": "880元/用户/年起",
                  "keyFeatures": ["移动CRM", "PaaS平台", "AI助手"],
                  "customerBase": "中大企业为主"
                },
                {
                  "name": "纷享销客",
                  "marketShare": "18.2%",
                  "pricing": "680元/用户/年起",
                  "keyFeatures": ["连接型CRM", "渠道管理", "BI分析"],
                  "customerBase": "中小企业为主"
                }
              ],
              "summary": "市场整体增速放缓至 12.3%，头部厂商集中度提升，AI 能力成为差异化竞争点",
              "reportUrl": "https://external-agent.example.com/reports/2026q2-crm-analysis.pdf"
            }
          }
        ]
      },
      "artifacts": [
        {
          "name": "竞品分析报告.pdf",
          "url": "https://external-agent.example.com/reports/2026q2-crm-analysis.pdf",
          "mimeType": "application/pdf",
          "size": 2048576
        }
      ]
    }
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 委托任务不存在 |
| 40901 | 任务尚未完成（状态为 WORKING/SUBMITTED/INPUT_REQUIRED） |
| 40301 | 无权查看该委托任务结果 |

---

#### 3.2.5 取消委托任务

取消进行中的委托任务。TECH-A2A 通过 JSON-RPC `tasks/cancel` 通知外部 Agent 取消任务。

```
POST /api/v1/a2a/delegations/{delegationId}/cancel
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| delegationId | string | 委托任务 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reason | string | 否 | 取消原因 |
| notifyExternal | boolean | 否 | 是否通知外部 Agent（OUTBOUND 任务），默认 true |

**请求示例**

```json
{
  "reason": "业务需求变更，不再需要此分析报告",
  "notifyExternal": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "delegationId": "deleg-20260716-000001",
    "previousStatus": "WORKING",
    "currentStatus": "CANCELED",
    "canceledAt": "2026-07-16T10:15:00.000+08:00",
    "canceledBy": "agent-dw-001",
    "reason": "业务需求变更，不再需要此分析报告",
    "externalNotified": true
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 委托任务不存在 |
| 40901 | 任务已处于终态（COMPLETED/CANCELED/FAILED），不可取消 |
| 40402 | 外部 Agent 不可达（notifyExternal=true 时） |
| 50401 | 外部 Agent 取消请求超时 |
| 40301 | 无权取消该委托任务 |

---

#### 3.2.6 查询委托任务列表

分页查询委托任务列表，支持多维度筛选。

```
GET /api/v1/a2a/delegations
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| direction | string | 否 | 方向：`OUTBOUND` / `INBOUND` / `ALL`，默认 `ALL` |
| status | string | 否 | 状态筛选，逗号分隔（如 `WORKING,COMPLETED`） |
| targetCardId | string | 否 | 目标 Agent Card ID |
| sourceAgentId | string | 否 | 发起 Agent ID |
| skillName | string | 否 | Skill 名称 |
| sessionId | string | 否 | 协作会话 ID |
| createdAfter | string | 否 | 创建时间下界 |
| createdBefore | string | 否 | 创建时间上界 |
| completedAfter | string | 否 | 完成时间下界 |
| completedBefore | string | 否 | 完成时间上界 |
| page | int | 否 | 页码 |
| size | int | 否 | 每页条数 |
| sort | string | 否 | 排序字段，默认 `-createdAt` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "delegationId": "deleg-20260716-000001",
        "externalTaskId": "task-ext-agent-789012",
        "direction": "OUTBOUND",
        "targetCardId": "card-ext-20260716-000003",
        "targetAgentName": "External Research Agent",
        "skillName": "market-research",
        "sourceAgentId": "agent-dw-001",
        "sourceAgentName": "市场分析数字员工",
        "status": "COMPLETED",
        "priority": 3,
        "createdAt": "2026-07-16T10:00:00.000+08:00",
        "completedAt": "2026-07-16T10:30:00.000+08:00",
        "duration": 1800000
      },
      {
        "delegationId": "deleg-20260716-000002",
        "externalTaskId": "task-ext-789012",
        "direction": "INBOUND",
        "targetCardId": "card-a2a-20260716-000001",
        "targetAgentName": "合同分析数字员工",
        "skillName": "contract-analysis",
        "sourceAgentId": "ext-agent-legal-001",
        "sourceAgentName": "External Legal Agent",
        "status": "WORKING",
        "priority": 2,
        "createdAt": "2026-07-16T10:05:00.000+08:00",
        "completedAt": null,
        "duration": null
      }
    ],
    "total": 2,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | direction/status 枚举值不合法 |

---

#### 3.2.7 补充任务输入

当委托任务处于 INPUT_REQUIRED 状态时，发起方向任务补充额外输入信息。对应 A2A 协议的 `tasks/send`（更新已存在的任务）。

```
POST /api/v1/a2a/delegations/{delegationId}/input
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| delegationId | string | 委托任务 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| message | object | 是 | 补充输入消息体（A2A Message 格式） |
| message.role | string | 否 | 角色，默认 `user` |
| message.parts | array | 是 | 消息内容分片列表 |
| message.parts[].type | string | 是 | 分片类型 |
| message.parts[].text | string | 条件 | 文本内容 |

**请求示例**

```json
{
  "message": {
    "role": "user",
    "parts": [
      {
        "type": "text",
        "text": "补充信息：请重点关注定价策略和客户留存率两个维度"
      }
    ]
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "delegationId": "deleg-20260716-000001",
    "previousStatus": "INPUT_REQUIRED",
    "currentStatus": "WORKING",
    "updatedAt": "2026-07-16T10:20:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 委托任务不存在 |
| 40901 | 任务状态不是 INPUT_REQUIRED，无法补充输入 |
| 50401 | 外部 Agent 响应超时 |
| 50003 | JSON-RPC 调用失败 |

---

### 3.3 异步协作 API

#### 3.3.1 任务进度流式订阅（SSE）

通过 SSE（Server-Sent Events）实时订阅委托任务的进度更新。当外部 Agent 支持 streaming 能力时，TECH-A2A 会将外部 Agent 的流式输出透传给调用方。

```
GET /api/v1/a2a/delegations/{delegationId}/stream
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| delegationId | string | 委托任务 ID |

**请求头**

| 请求头 | 说明 |
|---|---|
| Accept | `text/event-stream` |

**SSE 事件类型**

| 事件类型 | 说明 | data 内容 |
|---|---|---|
| `task.status` | 任务状态变更 | 新状态与时间戳 |
| `task.progress` | 任务进度更新 | 进度消息（A2A Message 分片） |
| `task.artifact` | 任务产出物 | 产出物信息（文件名、URL、类型） |
| `task.completed` | 任务完成 | 最终结果摘要 |
| `task.failed` | 任务失败 | 错误信息 |
| `task.canceled` | 任务取消 | 取消信息 |
| `error` | 流式连接错误 | 错误描述 |

**SSE 响应示例**

```
event: task.status
data: {"delegationId":"deleg-20260716-000001","status":"WORKING","timestamp":"2026-07-16T10:05:00.000+08:00"}

event: task.progress
data: {"delegationId":"deleg-20260716-000001","message":{"role":"agent","parts":[{"type":"text","text":"正在收集市场数据..."}]},"timestamp":"2026-07-16T10:10:00.000+08:00"}

event: task.progress
data: {"delegationId":"deleg-20260716-000001","message":{"role":"agent","parts":[{"type":"text","text":"已完成销售易和纷享销客的数据采集，正在分析..."}]},"timestamp":"2026-07-16T10:20:00.000+08:00"}

event: task.artifact
data: {"delegationId":"deleg-20260716-000001","artifact":{"name":"竞品分析报告.pdf","url":"https://external-agent.example.com/reports/2026q2-crm-analysis.pdf","mimeType":"application/pdf","size":2048576}}

event: task.completed
data: {"delegationId":"deleg-20260716-000001","status":"COMPLETED","completedAt":"2026-07-16T10:30:00.000+08:00","duration":1800000}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 委托任务不存在 |
| 40901 | 任务不支持流式订阅（外部 Agent 无 streaming 能力） |
| 40301 | 无权订阅该任务进度 |

---

#### 3.3.2 任务超时处理

手动触发任务超时处理。通常由定时任务自动执行，也支持手动触发。超时后任务状态转为 TIMEOUT（映射为 A2A FAILED），并记录超时原因。

```
POST /api/v1/a2a/delegations/{delegationId}/timeout
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| delegationId | string | 委托任务 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reason | string | 否 | 超时原因说明 |
| notifyExternal | boolean | 否 | 是否通知外部 Agent（OUTBOUND 任务），默认 true |

**请求示例**

```json
{
  "reason": "任务超过 600 秒未完成，自动超时",
  "notifyExternal": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "delegationId": "deleg-20260716-000001",
    "previousStatus": "WORKING",
    "currentStatus": "TIMEOUT",
    "timedOutAt": "2026-07-16T20:00:00.000+08:00",
    "reason": "任务超过 600 秒未完成，自动超时",
    "externalNotified": true
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 委托任务不存在 |
| 40901 | 任务已处于终态，不可超时处理 |
| 40301 | 无权操作该委托任务 |

---

#### 3.3.3 注册任务回调

为委托任务注册或更新结果回调地址。任务完成后 TECH-A2A 会向回调地址发送 POST 请求通知结果。一个任务支持注册多个回调地址。

```
POST /api/v1/a2a/delegations/{delegationId}/callbacks
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| delegationId | string | 委托任务 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| callbackUrl | string | 是 | 回调地址 URL |
| callbackType | string | 否 | 回调类型：`ON_COMPLETED` / `ON_STATUS_CHANGE` / `ON_FAILED` / `ON_ALL`，默认 `ON_COMPLETED` |
| headers | object | 否 | 回调请求自定义头 |
| retryPolicy | object | 否 | 回调重试策略 |
| retryPolicy.maxRetries | int | 否 | 最大重试次数，默认 3 |
| retryPolicy.retryInterval | int | 否 | 重试间隔（秒），默认 30 |

**请求示例**

```json
{
  "callbackUrl": "https://metaplatform.example.com/api/v1/dw/agents/agent-dw-001/callbacks/delegation",
  "callbackType": "ON_ALL",
  "headers": {
    "X-Custom-Header": "delegation-callback"
  },
  "retryPolicy": {
    "maxRetries": 5,
    "retryInterval": 60
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "callbackId": "cb-20260716-000001",
    "delegationId": "deleg-20260716-000001",
    "callbackUrl": "https://metaplatform.example.com/api/v1/dw/agents/agent-dw-001/callbacks/delegation",
    "callbackType": "ON_ALL",
    "registeredAt": "2026-07-16T10:02:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**回调请求格式（TECH-A2A 向 callbackUrl 发送的 POST 请求）**

```json
{
  "event": "DELEGATION_COMPLETED",
  "delegationId": "deleg-20260716-000001",
  "externalTaskId": "task-ext-agent-789012",
  "direction": "OUTBOUND",
  "status": "COMPLETED",
  "completedAt": "2026-07-16T10:30:00.000+08:00",
  "resultSummary": "国内 SaaS CRM 市场竞品分析报告已完成",
  "resultUrl": "https://metaplatform.example.com/api/v1/a2a/delegations/deleg-20260716-000001/result",
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | callbackUrl 为空 |
| 40002 | callbackUrl 格式不合法 |
| 40401 | 委托任务不存在 |
| 40901 | 任务已处于终态，注册回调无意义 |

---

#### 3.3.4 查询任务状态转换历史

查询委托任务的完整状态转换历史记录，用于追踪任务全生命周期。

```
GET /api/v1/a2a/delegations/{delegationId}/history
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| delegationId | string | 委托任务 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "delegationId": "deleg-20260716-000001",
    "totalTransitions": 4,
    "history": [
      {
        "sequence": 1,
        "fromState": null,
        "toState": "SUBMITTED",
        "timestamp": "2026-07-16T10:00:00.000+08:00",
        "source": "PLATFORM",
        "detail": "Task submitted to external agent",
        "traceId": "a1b2c3d4e5f6"
      },
      {
        "sequence": 2,
        "fromState": "SUBMITTED",
        "toState": "WORKING",
        "timestamp": "2026-07-16T10:05:00.000+08:00",
        "source": "EXTERNAL_AGENT",
        "detail": "External agent started processing",
        "traceId": "a1b2c3d4e5f6"
      },
      {
        "sequence": 3,
        "fromState": "WORKING",
        "toState": "INPUT_REQUIRED",
        "timestamp": "2026-07-16T10:15:00.000+08:00",
        "source": "EXTERNAL_AGENT",
        "detail": "Additional input required: specify analysis depth",
        "traceId": "a1b2c3d4e5f6"
      },
      {
        "sequence": 4,
        "fromState": "INPUT_REQUIRED",
        "toState": "WORKING",
        "timestamp": "2026-07-16T10:20:00.000+08:00",
        "source": "PLATFORM",
        "detail": "Additional input provided by user",
        "traceId": "a1b2c3d4e5f6"
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 委托任务不存在 |
| 40301 | 无权查看该委托任务 |

---

#### 3.3.5 获取任务产出物

获取委托任务产生的产出物（artifacts）列表，支持下载。

```
GET /api/v1/a2a/delegations/{delegationId}/artifacts
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| delegationId | string | 委托任务 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "delegationId": "deleg-20260716-000001",
    "artifacts": [
      {
        "artifactId": "art-20260716-000001",
        "name": "竞品分析报告.pdf",
        "url": "https://external-agent.example.com/reports/2026q2-crm-analysis.pdf",
        "mimeType": "application/pdf",
        "size": 2048576,
        "createdAt": "2026-07-16T10:28:00.000+08:00",
        "downloadable": true
      },
      {
        "artifactId": "art-20260716-000002",
        "name": "市场数据.xlsx",
        "url": "https://external-agent.example.com/reports/2026q2-crm-data.xlsx",
        "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "size": 512000,
        "createdAt": "2026-07-16T10:29:00.000+08:00",
        "downloadable": true
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 委托任务不存在 |
| 40301 | 无权查看该委托任务产出物 |

---

#### 3.3.6 接收外部 Agent 回调

外部 Agent 任务完成后回调通知平台。此接口接收外部 Agent 的推送通知，更新委托任务状态。

```
POST /api/v1/a2a/callbacks/external
```

**请求头**

| 请求头 | 必填 | 说明 |
|---|---|---|
| X-Agent-Api-Key | 是 | 外部 Agent 的 API Key |
| X-Trace-Id | 否 | 链路追踪 ID（透传） |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| taskId | string | 是 | 外部任务 ID |
| status | string | 是 | 任务状态：`completed` / `failed` / `canceled` / `input-required` / `working` |
| result | object | 否 | 任务结果（status=completed 时） |
| result.message | object | 否 | 结果消息体（A2A Message 格式） |
| result.artifacts | array | 否 | 产出物列表 |
| error | object | 否 | 错误信息（status=failed 时） |
| error.code | string | 否 | 错误码 |
| error.message | string | 否 | 错误描述 |
| metadata | object | 否 | 附加元数据 |

**请求示例**

```json
{
  "taskId": "task-ext-agent-789012",
  "status": "completed",
  "result": {
    "message": {
      "role": "agent",
      "parts": [
        {
          "type": "text",
          "text": "竞品分析报告已完成"
        }
      ]
    },
    "artifacts": [
      {
        "name": "竞品分析报告.pdf",
        "url": "https://external-agent.example.com/reports/2026q2-crm-analysis.pdf",
        "mimeType": "application/pdf"
      }
    ]
  },
  "metadata": {
    "processingTime": 1800000,
    "modelUsed": "gpt-4-turbo"
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "received": true,
    "delegationId": "deleg-20260716-000001",
    "updatedStatus": "COMPLETED",
    "callbacksTriggered": 1
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40102 | 外部 Agent API Key 无效 |
| 40401 | taskId 对应的委托任务不存在 |
| 40901 | 任务已处于终态，忽略回调 |

---

### 3.4 Agent 注册发现 API

#### 3.4.1 Agent 注册

注册一个新的 Agent 到 A2A 注册中心。注册后 Agent 可被发现并接收任务委托。

```
POST /api/v1/a2a/agents
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| agentId | string | 否 | Agent ID（不传则自动生成） |
| name | string | 是 | Agent 名称 |
| description | string | 否 | Agent 描述 |
| type | string | 是 | Agent 类型：`INTERNAL`（平台内部）/ `EXTERNAL`（外部 Agent） |
| endpointUrl | string | 条件 | A2A 服务端点 URL（EXTERNAL 类型必填） |
| agentCardId | string | 否 | 关联的 Agent Card ID |
| authentication | object | 否 | 认证配置 |
| authentication.scheme | string | 是 | 认证方案：`API_KEY` / `JWT` / `OAUTH2` / `NONE` |
| authentication.apiKey | string | 条件 | API Key（scheme=API_KEY 时必填） |
| authentication.jwtConfig | object | 条件 | JWT 配置（scheme=JWT 时必填） |
| authentication.oauthConfig | object | 条件 | OAuth 配置（scheme=OAUTH2 时必填） |
| healthCheckEnabled | boolean | 否 | 是否启用健康检查，默认 true |
| healthCheckInterval | int | 否 | 健康检查间隔（秒），默认 60 |
| healthCheckTimeout | int | 否 | 健康检查超时（秒），默认 10 |
| metadata | object | 否 | 自定义元数据 |

**请求示例**

```json
{
  "name": "External Research Agent",
  "description": "外部市场研究 Agent，提供竞品分析与市场调研能力",
  "type": "EXTERNAL",
  "endpointUrl": "https://external-agent.example.com/rpc/a2a",
  "agentCardId": "card-ext-20260716-000003",
  "authentication": {
    "scheme": "API_KEY",
    "apiKey": "ext-api-key-xxx"
  },
  "healthCheckEnabled": true,
  "healthCheckInterval": 60,
  "healthCheckTimeout": 10,
  "metadata": {
    "provider": "External Research Inc.",
    "owner": "user-001"
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agent-ext-20260716-000001",
    "name": "External Research Agent",
    "description": "外部市场研究 Agent，提供竞品分析与市场调研能力",
    "type": "EXTERNAL",
    "endpointUrl": "https://external-agent.example.com/rpc/a2a",
    "agentCardId": "card-ext-20260716-000003",
    "status": "REGISTERED",
    "healthStatus": "UNKNOWN",
    "healthCheckEnabled": true,
    "healthCheckInterval": 60,
    "registeredAt": "2026-07-16T09:00:00.000+08:00",
    "registeredBy": "user-001"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | name/type 为空 |
| 40002 | type 枚举值不合法 |
| 40902 | Agent 已注册（endpointUrl 或 name 重复） |
| 42201 | EXTERNAL 类型但 endpointUrl 为空 |
| 42201 | 认证配置与 scheme 不匹配 |

---

#### 3.4.2 Agent 发现

分页查询已注册的 Agent 列表，支持多维度筛选。

```
GET /api/v1/a2a/agents
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| keyword | string | 否 | 关键词搜索（匹配 name、description） |
| type | string | 否 | Agent 类型：`INTERNAL` / `EXTERNAL` |
| status | string | 否 | 注册状态：`REGISTERED` / `ACTIVE` / `INACTIVE` / `DEREGISTERED` |
| healthStatus | string | 否 | 健康状态：`HEALTHY` / `UNHEALTHY` / `UNKNOWN` |
| skill | string | 否 | 按技能名称筛选（匹配关联 Agent Card 的 skills） |
| page | int | 否 | 页码 |
| size | int | 否 | 每页条数 |
| sort | string | 否 | 排序字段，默认 `-registeredAt` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "agentId": "agent-ext-20260716-000001",
        "name": "External Research Agent",
        "description": "外部市场研究 Agent",
        "type": "EXTERNAL",
        "endpointUrl": "https://external-agent.example.com/rpc/a2a",
        "agentCardId": "card-ext-20260716-000003",
        "status": "ACTIVE",
        "healthStatus": "HEALTHY",
        "lastHealthCheckAt": "2026-07-16T09:50:00.000+08:00",
        "healthCheckSuccessRate": 98.5,
        "skills": ["market-research", "competitive-analysis"],
        "registeredAt": "2026-07-16T09:00:00.000+08:00"
      },
      {
        "agentId": "agent-dw-001",
        "name": "财务分析数字员工",
        "description": "平台内部财务分析 Agent",
        "type": "INTERNAL",
        "endpointUrl": "https://metaplatform.example.com/rpc/v1/a2a",
        "agentCardId": "card-a2a-20260716-000001",
        "status": "ACTIVE",
        "healthStatus": "HEALTHY",
        "lastHealthCheckAt": "2026-07-16T09:50:00.000+08:00",
        "healthCheckSuccessRate": 100.0,
        "skills": ["financial-report-analysis", "budget-review"],
        "registeredAt": "2026-07-16T08:00:00.000+08:00"
      }
    ],
    "total": 2,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | type/status/healthStatus 枚举值不合法 |

---

#### 3.4.3 Agent 健康检查

手动触发 Agent 健康检查，或查询 Agent 的健康状态详情。

```
POST /api/v1/a2a/agents/{agentId}/health-check
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| timeout | int | 否 | 健康检查超时（秒），默认使用 Agent 配置值 |
| deepCheck | boolean | 否 | 是否深度检查（验证 Agent Card 可达 + Skill 可用），默认 false |

**请求示例**

```json
{
  "timeout": 15,
  "deepCheck": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agent-ext-20260716-000001",
    "agentName": "External Research Agent",
    "healthStatus": "HEALTHY",
    "checkType": "DEEP",
    "checks": [
      {
        "checkName": "endpoint_reachable",
        "status": "PASS",
        "latency": 120,
        "detail": "Endpoint responded successfully"
      },
      {
        "checkName": "agent_card_valid",
        "status": "PASS",
        "latency": 85,
        "detail": "Agent Card is valid and parseable"
      },
      {
        "checkName": "skills_available",
        "status": "PASS",
        "latency": 200,
        "detail": "2 skills declared, 2 verified"
      },
      {
        "checkName": "authentication_valid",
        "status": "PASS",
        "latency": 95,
        "detail": "API Key authentication successful"
      }
    ],
    "overallLatency": 500,
    "checkedAt": "2026-07-16T10:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 40402 | 外部 Agent 端点不可达 |
| 50401 | 健康检查超时 |

---

#### 3.4.4 获取 Agent 详情

查询单个 Agent 的详细信息，包括注册信息、健康状态、关联 Agent Card 等。

```
GET /api/v1/a2a/agents/{agentId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| includeHealthHistory | boolean | 否 | 是否包含健康检查历史，默认 false |
| includeStats | boolean | 否 | 是否包含委托任务统计，默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agent-ext-20260716-000001",
    "name": "External Research Agent",
    "description": "外部市场研究 Agent",
    "type": "EXTERNAL",
    "endpointUrl": "https://external-agent.example.com/rpc/a2a",
    "agentCardId": "card-ext-20260716-000003",
    "status": "ACTIVE",
    "healthStatus": "HEALTHY",
    "healthCheckEnabled": true,
    "healthCheckInterval": 60,
    "healthCheckTimeout": 10,
    "lastHealthCheckAt": "2026-07-16T09:50:00.000+08:00",
    "lastHealthCheckResult": "HEALTHY",
    "healthCheckSuccessRate": 98.5,
    "authentication": {
      "scheme": "API_KEY"
    },
    "skills": ["market-research", "competitive-analysis"],
    "registeredAt": "2026-07-16T09:00:00.000+08:00",
    "registeredBy": "user-001",
    "stats": {
      "totalDelegations": 42,
      "completedDelegations": 38,
      "failedDelegations": 3,
      "canceledDelegations": 1,
      "avgCompletionTime": 1450000,
      "successRate": 90.48
    }
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |

---

#### 3.4.5 更新 Agent

更新已注册 Agent 的配置信息。

```
PUT /api/v1/a2a/agents/{agentId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | 更新名称 |
| description | string | 否 | 更新描述 |
| endpointUrl | string | 否 | 更新端点 URL |
| authentication | object | 否 | 更新认证配置 |
| healthCheckEnabled | boolean | 否 | 更新健康检查开关 |
| healthCheckInterval | int | 否 | 更新健康检查间隔 |
| status | string | 否 | 更新状态：`ACTIVE` / `INACTIVE` |
| expectedVersion | int | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "description": "外部市场研究 Agent（已升级至 v2），增强行业覆盖范围",
  "healthCheckInterval": 30,
  "status": "ACTIVE",
  "expectedVersion": 1
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agent-ext-20260716-000001",
    "name": "External Research Agent",
    "description": "外部市场研究 Agent（已升级至 v2），增强行业覆盖范围",
    "status": "ACTIVE",
    "healthCheckInterval": 30,
    "updatedAt": "2026-07-16T11:00:00.000+08:00",
    "updatedBy": "user-001",
    "versionNumber": 2
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 40902 | 乐观锁版本冲突 |
| 42201 | endpointUrl 格式不合法 |
| 40301 | 无权更新该 Agent |

---

#### 3.4.6 注销 Agent

注销已注册的 Agent。注销后 Agent 将不可被发现，无法接收新的任务委托。进行中的委托任务不受影响。

```
DELETE /api/v1/a2a/agents/{agentId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reason | string | 否 | 注销原因 |
| cancelRunningTasks | boolean | 否 | 是否取消进行中的委托任务，默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agent-ext-20260716-000001",
    "agentName": "External Research Agent",
    "previousStatus": "ACTIVE",
    "currentStatus": "DEREGISTERED",
    "deregisteredAt": "2026-07-16T12:00:00.000+08:00",
    "deregisteredBy": "user-001",
    "reason": "Agent 服务已下线",
    "cancelledTasks": 2
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 40901 | 存在进行中的委托任务（cancelRunningTasks=false 时） |
| 40301 | 无权注销该 Agent |

---

### 3.5 消息通道 API

#### 3.5.1 发送消息

Agent 之间发送即时消息。不同于任务委托（异步、有状态机），消息通道是轻量级的点对点通信，适用于状态通知、上下文同步等场景。

```
POST /api/v1/a2a/messages
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| targetAgentId | string | 是 | 目标 Agent ID |
| sourceAgentId | string | 是 | 发送 Agent ID |
| messageType | string | 否 | 消息类型：`NOTIFICATION` / `QUERY` / `CONTEXT_SYNC` / `CUSTOM`，默认 `NOTIFICATION` |
| content | object | 是 | 消息内容（A2A Message 格式） |
| content.role | string | 否 | 角色，默认 `user` |
| content.parts | array | 是 | 消息内容分片列表 |
| content.parts[].type | string | 是 | 分片类型：`text` / `file` / `data` |
| content.parts[].text | string | 条件 | 文本内容 |
| content.parts[].data | object | 条件 | 结构化数据 |
| sessionId | string | 否 | 关联的协作会话 ID |
| priority | int | 否 | 优先级：1(低)/2(中)/3(高)，默认 2 |
| ttl | int | 否 | 消息存活时间（秒），过期后自动清理，默认 3600 |
| requireAck | boolean | 否 | 是否需要接收确认，默认 false |
| metadata | object | 否 | 自定义元数据 |

**请求示例**

```json
{
  "targetAgentId": "agent-ext-20260716-000001",
  "sourceAgentId": "agent-dw-001",
  "messageType": "CONTEXT_SYNC",
  "content": {
    "role": "user",
    "parts": [
      {
        "type": "data",
        "data": {
          "contextType": "session_context",
          "sessionId": "session-20260716-000001",
          "context": {
            "previousTaskId": "deleg-20260716-000001",
            "analysisScope": "SaaS CRM",
            "marketRegion": "China"
          }
        }
      }
    ]
  },
  "sessionId": "session-20260716-000001",
  "priority": 2,
  "requireAck": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "messageId": "msg-20260716-000001",
    "targetAgentId": "agent-ext-20260716-000001",
    "sourceAgentId": "agent-dw-001",
    "messageType": "CONTEXT_SYNC",
    "status": "SENT",
    "sessionId": "session-20260716-000001",
    "sentAt": "2026-07-16T10:35:00.000+08:00",
    "expiresAt": "2026-07-16T11:35:00.000+08:00",
    "requireAck": true
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | targetAgentId/sourceAgentId/content 为空 |
| 40401 | targetAgentId 或 sourceAgentId 不存在 |
| 42203 | 目标 Agent 不健康，消息无法送达 |
| 40402 | 外部 Agent 端点不可达 |
| 50401 | 消息发送超时 |

---

#### 3.5.2 接收消息

拉取指定 Agent 的待处理消息。支持长轮询模式。

```
GET /api/v1/a2a/agents/{agentId}/messages
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| sessionId | string | 否 | 按会话 ID 筛选 |
| messageType | string | 否 | 按消息类型筛选 |
| status | string | 否 | 消息状态：`PENDING` / `DELIVERED` / `ACKED`，默认 `PENDING` |
| longPoll | boolean | 否 | 是否长轮询（阻塞等待新消息），默认 false |
| longPollTimeout | int | 否 | 长轮询超时（秒），默认 30 |
| page | int | 否 | 页码 |
| size | int | 否 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "messageId": "msg-20260716-000001",
        "sourceAgentId": "agent-dw-001",
        "sourceAgentName": "市场分析数字员工",
        "messageType": "CONTEXT_SYNC",
        "content": {
          "role": "user",
          "parts": [
            {
              "type": "data",
              "data": {
                "contextType": "session_context",
                "context": { "analysisScope": "SaaS CRM" }
              }
            }
          ]
        },
        "sessionId": "session-20260716-000001",
        "priority": 2,
        "status": "PENDING",
        "sentAt": "2026-07-16T10:35:00.000+08:00",
        "expiresAt": "2026-07-16T11:35:00.000+08:00",
        "requireAck": true
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 40301 | 无权查看该 Agent 的消息 |
| 40002 | longPollTimeout 超过最大值 60 |

---

#### 3.5.3 确认消息

确认已接收消息。对于 requireAck=true 的消息，接收方需在 ttl 内确认。

```
POST /api/v1/a2a/messages/{messageId}/ack
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| messageId | string | 消息 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ackBy | string | 是 | 确认方 Agent ID |
| ackResult | string | 否 | 确认结果：`RECEIVED` / `PROCESSED` / `REJECTED`，默认 `RECEIVED` |
| comment | string | 否 | 确认备注 |

**请求示例**

```json
{
  "ackBy": "agent-ext-20260716-000001",
  "ackResult": "PROCESSED",
  "comment": "上下文已同步，准备处理后续任务"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "messageId": "msg-20260716-000001",
    "ackStatus": "ACKED",
    "ackResult": "PROCESSED",
    "ackedBy": "agent-ext-20260716-000001",
    "ackedAt": "2026-07-16T10:36:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 消息不存在 |
| 40901 | 消息已确认或已过期 |
| 40301 | ackBy 与消息目标 Agent 不匹配 |

---

#### 3.5.4 消息队列管理

查询和管理 Agent 的消息队列状态。

```
GET /api/v1/a2a/agents/{agentId}/message-queue
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agent-ext-20260716-000001",
    "queueStats": {
      "pendingCount": 3,
      "deliveredCount": 156,
      "ackedCount": 150,
      "expiredCount": 6,
      "rejectedCount": 2,
      "oldestPendingAge": 120,
      "avgProcessTime": 45000
    },
    "pendingMessages": [
      {
        "messageId": "msg-20260716-000001",
        "sourceAgentId": "agent-dw-001",
        "messageType": "CONTEXT_SYNC",
        "priority": 2,
        "sentAt": "2026-07-16T10:35:00.000+08:00",
        "age": 120,
        "requireAck": true
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 40301 | 无权查看该 Agent 的消息队列 |

---

#### 3.5.5 清理过期消息

手动触发清理指定 Agent 的过期消息。

```
POST /api/v1/a2a/agents/{agentId}/message-queue/cleanup
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agent-ext-20260716-000001",
    "cleanedCount": 6,
    "cleanedAt": "2026-07-16T12:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 40301 | 无权操作该 Agent 的消息队列 |

---

### 3.6 安全认证 API

#### 3.6.1 Agent 认证

验证 Agent 身份并返回认证 Token。支持 API Key 和 JWT 两种认证方式。

```
POST /api/v1/a2a/auth/verify
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| agentId | string | 是 | Agent ID |
| scheme | string | 是 | 认证方案：`API_KEY` / `JWT` |
| credentials | object | 是 | 认证凭证 |
| credentials.apiKey | string | 条件 | API Key（scheme=API_KEY 时） |
| credentials.jwt | string | 条件 | JWT Token（scheme=JWT 时） |

**请求示例**

```json
{
  "agentId": "agent-ext-20260716-000001",
  "scheme": "API_KEY",
  "credentials": {
    "apiKey": "ext-api-key-xxx"
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agent-ext-20260716-000001",
    "agentName": "External Research Agent",
    "verified": true,
    "scheme": "API_KEY",
    "sessionToken": "a2a-session-token-eyJhbGciOiJIUzI1NiJ9...",
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "expiresAt": "2026-07-16T11:36:00.000+08:00",
    "permissions": ["delegation:send", "delegation:receive", "message:send", "message:receive"]
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | agentId/scheme/credentials 为空 |
| 40401 | agentId 不存在 |
| 40102 | 认证失败（API Key 无效/JWT 签名错误/JWT 过期） |
| 42203 | Agent 已注销或健康检查失败，拒绝认证 |

---

#### 3.6.2 生成 API Key

为已注册的 Agent 生成新的 API Key。一个 Agent 可拥有多个 API Key，支持独立吊销。

```
POST /api/v1/a2a/agents/{agentId}/api-keys
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | API Key 名称（便于识别） |
| scopes | array | 否 | 权限范围，默认全部权限 |
| expiresIn | int | 否 | 有效期（秒），不传则永久有效 |
| description | string | 否 | 描述 |

**请求示例**

```json
{
  "name": "production-key",
  "scopes": ["delegation:send", "delegation:receive", "message:send"],
  "expiresIn": 2592000,
  "description": "生产环境使用的 API Key，有效期 30 天"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "keyId": "apikey-20260716-000001",
    "name": "production-key",
    "apiKey": "a2a-sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "scopes": ["delegation:send", "delegation:receive", "message:send"],
    "expiresAt": "2026-08-15T10:36:00.000+08:00",
    "createdAt": "2026-07-16T10:36:00.000+08:00",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | name 为空 |
| 40401 | Agent 不存在 |
| 40301 | 无权为该 Agent 生成 API Key |
| 42201 | scopes 中包含不支持的权限范围 |

---

#### 3.6.3 管理 API Key

查询、吊销 Agent 的 API Key 列表。

```
GET /api/v1/a2a/agents/{agentId}/api-keys
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | string | 否 | 状态：`ACTIVE` / `REVOKED` / `EXPIRED` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "keyId": "apikey-20260716-000001",
        "name": "production-key",
        "apiKeyPrefix": "a2a-sk-xxxx...",
        "scopes": ["delegation:send", "delegation:receive", "message:send"],
        "status": "ACTIVE",
        "expiresAt": "2026-08-15T10:36:00.000+08:00",
        "lastUsedAt": "2026-07-16T10:40:00.000+08:00",
        "createdAt": "2026-07-16T10:36:00.000+08:00"
      }
    ],
    "total": 1
  },
  "traceId": "a1b2c3d4e5f6"
}
```

---

#### 3.6.4 吊销 API Key

吊销指定的 API Key，吊销后立即失效。

```
DELETE /api/v1/a2a/agents/{agentId}/api-keys/{keyId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |
| keyId | string | API Key ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "keyId": "apikey-20260716-000001",
    "status": "REVOKED",
    "revokedAt": "2026-07-16T11:00:00.000+08:00",
    "revokedBy": "user-001"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 或 API Key 不存在 |
| 40901 | API Key 已吊销 |
| 40301 | 无权吊销该 API Key |

---

#### 3.6.5 权限验证

验证指定 Agent 是否拥有某项操作权限。

```
POST /api/v1/a2a/auth/authorize
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| agentId | string | 是 | Agent ID |
| action | string | 是 | 操作类型：`delegation:send` / `delegation:receive` / `message:send` / `message:receive` / `agent:discover` / `agent:manage` |
| resource | string | 否 | 资源标识（如目标 Agent ID） |

**请求示例**

```json
{
  "agentId": "agent-ext-20260716-000001",
  "action": "delegation:send",
  "resource": "agent-dw-001"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agent-ext-20260716-000001",
    "action": "delegation:send",
    "resource": "agent-dw-001",
    "allowed": true,
    "reason": "Permission granted via API Key scopes"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | agentId/action 为空 |
| 40401 | Agent 不存在 |
| 40301 | 权限不足（allowed=false 时返回 403） |

---

### 3.7 协作审计 API

#### 3.7.1 协作记录查询

分页查询 Agent 间协作记录，包含任务委托、消息交互等所有协作活动的审计日志。

```
GET /api/v1/a2a/audit/collaborations
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| agentId | string | 否 | Agent ID（作为发起方或接收方） |
| collaborationType | string | 否 | 协作类型：`DELEGATION` / `MESSAGE` / `DISCOVERY` / `HEALTH_CHECK` / `AUTH` |
| direction | string | 否 | 方向：`OUTBOUND` / `INBOUND` |
| status | string | 否 | 协作状态 |
| startedAfter | string | 否 | 开始时间下界 |
| startedBefore | string | 否 | 开始时间上界 |
| traceId | string | 否 | 按链路追踪 ID 筛选 |
| sessionId | string | 否 | 按协作会话 ID 筛选 |
| page | int | 否 | 页码 |
| size | int | 否 | 每页条数 |
| sort | string | 否 | 排序字段，默认 `-createdAt` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "auditId": "audit-20260716-000001",
        "collaborationType": "DELEGATION",
        "direction": "OUTBOUND",
        "sourceAgentId": "agent-dw-001",
        "sourceAgentName": "市场分析数字员工",
        "targetAgentId": "agent-ext-20260716-000001",
        "targetAgentName": "External Research Agent",
        "skillName": "market-research",
        "status": "COMPLETED",
        "sessionId": "session-20260716-000001",
        "delegationId": "deleg-20260716-000001",
        "traceId": "a1b2c3d4e5f6",
        "startedAt": "2026-07-16T10:00:00.000+08:00",
        "completedAt": "2026-07-16T10:30:00.000+08:00",
        "duration": 1800000,
        "summary": "市场竞品分析任务委托已完成"
      },
      {
        "auditId": "audit-20260716-000002",
        "collaborationType": "MESSAGE",
        "direction": "OUTBOUND",
        "sourceAgentId": "agent-dw-001",
        "targetAgentId": "agent-ext-20260716-000001",
        "messageType": "CONTEXT_SYNC",
        "status": "ACKED",
        "sessionId": "session-20260716-000001",
        "messageId": "msg-20260716-000001",
        "traceId": "a1b2c3d4e5f6",
        "startedAt": "2026-07-16T10:35:00.000+08:00",
        "completedAt": "2026-07-16T10:36:00.000+08:00",
        "duration": 60000,
        "summary": "上下文同步消息已确认"
      }
    ],
    "total": 2,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | collaborationType/direction/status 枚举值不合法 |
| 40301 | 无权查看审计记录 |

---

#### 3.7.2 委托统计

查询委托任务的统计数据，支持按时间范围、Agent、Skill 等维度聚合。

```
GET /api/v1/a2a/audit/delegation-stats
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| agentId | string | 否 | Agent ID |
| direction | string | 否 | 方向：`OUTBOUND` / `INBOUND` / `ALL` |
| startedAfter | string | 否 | 开始时间下界 |
| startedBefore | string | 否 | 开始时间上界 |
| groupBy | string | 否 | 聚合维度：`agent` / `skill` / `status` / `day` / `hour`，默认 `status` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "summary": {
      "totalDelegations": 156,
      "completedCount": 138,
      "failedCount": 10,
      "canceledCount": 5,
      "timeoutCount": 3,
      "successRate": 88.46,
      "avgCompletionTime": 1450000,
      "avgTimeoutRate": 1.92
    },
    "grouped": [
      {
        "groupKey": "COMPLETED",
        "count": 138,
        "percentage": 88.46
      },
      {
        "groupKey": "FAILED",
        "count": 10,
        "percentage": 6.41
      },
      {
        "groupKey": "CANCELED",
        "count": 5,
        "percentage": 3.21
      },
      {
        "groupKey": "TIMEOUT",
        "count": 3,
        "percentage": 1.92
      }
    ],
    "timeRange": {
      "from": "2026-07-01T00:00:00.000+08:00",
      "to": "2026-07-16T23:59:59.000+08:00"
    }
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | direction/groupBy 枚举值不合法 |
| 40301 | 无权查看统计数据 |

---

#### 3.7.3 错误追踪

查询委托任务中的错误记录，支持按错误类型、Agent、时间范围筛选。

```
GET /api/v1/a2a/audit/errors
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| agentId | string | 否 | Agent ID |
| errorCode | string | 否 | 错误码 |
| errorType | string | 否 | 错误类型：`COMMUNICATION` / `AUTHENTICATION` / `PROTOCOL` / `TIMEOUT` / `BUSINESS` / `INTERNAL` |
| direction | string | 否 | 方向：`OUTBOUND` / `INBOUND` |
| occurredAfter | string | 否 | 发生时间下界 |
| occurredBefore | string | 否 | 发生时间上界 |
| traceId | string | 否 | 按链路追踪 ID 筛选 |
| page | int | 否 | 页码 |
| size | int | 否 | 每页条数 |
| sort | string | 否 | 排序字段，默认 `-occurredAt` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "errorId": "err-20260716-000001",
        "delegationId": "deleg-20260716-000005",
        "errorCode": "50401",
        "errorType": "TIMEOUT",
        "direction": "OUTBOUND",
        "sourceAgentId": "agent-dw-001",
        "targetAgentId": "agent-ext-20260716-000001",
        "errorMessage": "External agent response timeout after 600 seconds",
        "errorDetail": "Connection to https://external-agent.example.com/rpc/a2a timed out while waiting for task status response",
        "stackTrace": "com.metaplatform.a2a.exception.ExternalAgentTimeoutException: ...\n\tat com.metaplatform.a2a.client.A2AClient.sendTask(A2AClient.java:128)\n\t...",
        "traceId": "b2c3d4e5f6g7",
        "occurredAt": "2026-07-16T14:30:00.000+08:00",
        "recovered": false,
        "recoveryAction": null
      },
      {
        "errorId": "err-20260716-000002",
        "delegationId": "deleg-20260716-000003",
        "errorCode": "40102",
        "errorType": "AUTHENTICATION",
        "direction": "INBOUND",
        "sourceAgentId": "ext-agent-unknown-001",
        "targetAgentId": "agent-dw-001",
        "errorMessage": "Agent authentication failed: invalid API Key",
        "errorDetail": "API Key 'a2a-sk-invalid-xxx' does not match any registered Agent",
        "stackTrace": null,
        "traceId": "c3d4e5f6g7h8",
        "occurredAt": "2026-07-16T15:00:00.000+08:00",
        "recovered": false,
        "recoveryAction": "Blocked request, notified admin"
      }
    ],
    "total": 2,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | errorType/direction 枚举值不合法 |
| 40301 | 无权查看错误记录 |

---

#### 3.7.4 Agent 协作统计

查询单个 Agent 的协作统计数据，包括委托任务统计、消息统计、错误统计等。

```
GET /api/v1/a2a/audit/agents/{agentId}/stats
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startedAfter | string | 否 | 统计开始时间 |
| startedBefore | string | 否 | 统计结束时间 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agent-ext-20260716-000001",
    "agentName": "External Research Agent",
    "timeRange": {
      "from": "2026-07-01T00:00:00.000+08:00",
      "to": "2026-07-16T23:59:59.000+08:00"
    },
    "delegationStats": {
      "outbound": {
        "total": 0,
        "completed": 0,
        "failed": 0
      },
      "inbound": {
        "total": 42,
        "completed": 38,
        "failed": 3,
        "canceled": 1,
        "timeout": 0,
        "successRate": 90.48,
        "avgCompletionTime": 1450000,
        "avgCompletionTimeHuman": "24分10秒"
      }
    },
    "messageStats": {
      "sent": 156,
      "received": 89,
      "acked": 82,
      "expired": 7,
      "ackRate": 92.13
    },
    "errorStats": {
      "totalErrors": 5,
      "byType": {
        "COMMUNICATION": 2,
        "TIMEOUT": 1,
        "AUTHENTICATION": 1,
        "BUSINESS": 1
      },
      "errorRate": 3.25
    },
    "healthStats": {
      "checkCount": 384,
      "healthyCount": 380,
      "unhealthyCount": 4,
      "successRate": 98.96
    },
    "topSkills": [
      { "skillName": "market-research", "invocationCount": 28, "successRate": 92.86 },
      { "skillName": "competitive-analysis", "invocationCount": 14, "successRate": 85.71 }
    ]
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 40301 | 无权查看该 Agent 的统计数据 |

---

#### 3.7.5 导出审计报告

导出指定时间范围内的协作审计报告，支持 JSON 和 CSV 格式。

```
GET /api/v1/a2a/audit/export
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| format | string | 否 | 导出格式：`JSON` / `CSV`，默认 `JSON` |
| startedAfter | string | 是 | 开始时间 |
| startedBefore | string | 是 | 结束时间 |
| agentId | string | 否 | Agent ID 筛选 |
| collaborationType | string | 否 | 协作类型筛选 |

**响应示例**

```
HTTP/1.1 200 OK
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="a2a-audit-report-20260701-20260716.json"
```

```json
{
  "reportMetadata": {
    "generatedAt": "2026-07-16T18:00:00.000+08:00",
    "generatedBy": "user-001",
    "timeRange": { "from": "2026-07-01T00:00:00.000+08:00", "to": "2026-07-16T23:59:59.000+08:00" },
    "totalRecords": 156,
    "filters": { "agentId": null, "collaborationType": null }
  },
  "summary": {
    "totalCollaborations": 156,
    "totalDelegations": 98,
    "totalMessages": 58,
    "totalErrors": 5,
    "overallSuccessRate": 94.87
  },
  "records": [ ]
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | startedAfter/startedBefore 为空 |
| 40002 | format 枚举值不合法 |
| 40301 | 无权导出审计报告 |
| 42901 | 导出数据量过大（超过 100000 条），请缩小时间范围 |

---

## 4. 数据模型

### 4.1 PostgreSQL 表结构总览

| 表名 | 说明 |
|---|---|
| a2a_agent_card | Agent Card 表（能力声明） |
| a2a_agent_card_skill | Agent Card 技能表 |
| a2a_agent | Agent 注册表 |
| a2a_agent_credential | Agent 认证凭证表（加密存储） |
| a2a_agent_api_key | Agent API Key 表 |
| a2a_agent_health_log | Agent 健康检查日志表 |
| a2a_delegation_task | 委托任务表 |
| a2a_delegation_status_history | 委托任务状态转换历史表 |
| a2a_delegation_callback | 委托任务回调注册表 |
| a2a_delegation_artifact | 委托任务产出物表 |
| a2a_collaboration_session | 协作会话表 |
| a2a_message | Agent 间消息表 |
| a2a_audit_log | 协作审计日志表 |
| a2a_error_log | 错误日志表 |
| a2a_outbox | Outbox 事件表（Kafka 事务消息） |
| a2a_idempotent_request | 幂等请求记录表 |

### 4.2 a2a_agent_card（Agent Card 表）

```sql
CREATE TABLE a2a_agent_card (
    id                  VARCHAR(64)   PRIMARY KEY,          -- Agent Card ID
    tenant_id           VARCHAR(64)   NOT NULL,             -- 租户 ID
    agent_id            VARCHAR(64)   NOT NULL,             -- 关联的平台 Agent ID（TECH-AGENT）
    name                VARCHAR(256)  NOT NULL,             -- Agent 显示名称
    description         TEXT,                               -- Agent 描述
    version             VARCHAR(32)   NOT NULL,             -- 语义化版本号
    protocol_version    VARCHAR(16)   NOT NULL DEFAULT '1.0', -- A2A 协议版本
    endpoint_url        TEXT          NOT NULL,             -- A2A 服务端点 URL
    agent_card_url      TEXT,                               -- Agent Card 公开 URL（/.well-known/agent.json）
    source              VARCHAR(16)   NOT NULL DEFAULT 'INTERNAL', -- 来源：INTERNAL/EXTERNAL
    visibility          VARCHAR(16)   NOT NULL DEFAULT 'PRIVATE', -- 可见性：PUBLIC/PRIVATE
    status              VARCHAR(32)   NOT NULL DEFAULT 'PUBLISHED', -- 状态：PUBLISHED/UNPUBLISHED/DEPRECATED
    capabilities        JSONB,                              -- 能力声明（streaming/pushNotifications/stateTransitionHistory）
    authentication      JSONB,                              -- 认证方式配置
    default_input_modes JSONB         DEFAULT '["text"]',   -- 默认输入模式
    default_output_modes JSONB        DEFAULT '["text"]',   -- 默认输出模式
    metadata            JSONB,                              -- 自定义元数据
    version_number      INT           NOT NULL DEFAULT 1,   -- 乐观锁版本号
    published_by        VARCHAR(64),                        -- 发布人 ID
    published_at        TIMESTAMP,                          -- 发布时间
    discovered_at       TIMESTAMP,                          -- 发现时间（EXTERNAL 来源）
    discovered_from     TEXT,                               -- 发现来源 URL
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, agent_id, version)
);

CREATE INDEX idx_ac_tenant_source ON a2a_agent_card (tenant_id, source);
CREATE INDEX idx_ac_tenant_status ON a2a_agent_card (tenant_id, status);
CREATE INDEX idx_ac_tenant_visibility ON a2a_agent_card (tenant_id, visibility);
CREATE INDEX idx_ac_agent_id ON a2a_agent_card (agent_id);
CREATE INDEX idx_ac_endpoint ON a2a_agent_card (endpoint_url);
```

### 4.3 a2a_agent_card_skill（Agent Card 技能表）

```sql
CREATE TABLE a2a_agent_card_skill (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    card_id             VARCHAR(64)   NOT NULL,             -- Agent Card ID
    name                VARCHAR(256)  NOT NULL,             -- Skill 名称
    description         TEXT,                               -- Skill 描述
    tags                JSONB         DEFAULT '[]',         -- 标签列表
    input_schema        JSONB,                              -- 输入参数 JSON Schema
    output_schema       JSONB,                              -- 输出结果 JSON Schema
    examples            JSONB         DEFAULT '[]',         -- 使用示例列表
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (card_id) REFERENCES a2a_agent_card(id) ON DELETE CASCADE
);

CREATE INDEX idx_acs_card ON a2a_agent_card_skill (card_id);
CREATE INDEX idx_acs_name ON a2a_agent_card_skill (tenant_id, name);
CREATE INDEX idx_acs_tags ON a2a_agent_card_skill USING GIN (tags);
```

### 4.4 a2a_agent（Agent 注册表）

```sql
CREATE TABLE a2a_agent (
    id                      VARCHAR(64)   PRIMARY KEY,      -- Agent ID
    tenant_id               VARCHAR(64)   NOT NULL,         -- 租户 ID
    name                    VARCHAR(256)  NOT NULL,         -- Agent 名称
    description             TEXT,                           -- Agent 描述
    type                    VARCHAR(16)   NOT NULL,         -- 类型：INTERNAL/EXTERNAL
    endpoint_url            TEXT,                           -- A2A 服务端点 URL
    agent_card_id           VARCHAR(64),                    -- 关联 Agent Card ID
    status                  VARCHAR(32)   NOT NULL DEFAULT 'REGISTERED', -- 状态：REGISTERED/ACTIVE/INACTIVE/DEREGISTERED
    health_status           VARCHAR(16)   NOT NULL DEFAULT 'UNKNOWN', -- 健康状态：HEALTHY/UNHEALTHY/UNKNOWN
    health_check_enabled    BOOLEAN       NOT NULL DEFAULT TRUE, -- 是否启用健康检查
    health_check_interval   INT           NOT NULL DEFAULT 60, -- 健康检查间隔（秒）
    health_check_timeout    INT           NOT NULL DEFAULT 10, -- 健康检查超时（秒）
    last_health_check_at    TIMESTAMP,                      -- 最近健康检查时间
    last_health_check_result VARCHAR(16),                   -- 最近健康检查结果
    health_check_success_count INT         NOT NULL DEFAULT 0, -- 健康检查成功次数
    health_check_total_count INT          NOT NULL DEFAULT 0, -- 健康检查总次数
    metadata                JSONB,                          -- 自定义元数据
    version_number          INT           NOT NULL DEFAULT 1, -- 乐观锁版本号
    registered_by           VARCHAR(64),                    -- 注册人 ID
    registered_at           TIMESTAMP     NOT NULL DEFAULT NOW(), -- 注册时间
    deregistered_at         TIMESTAMP,                      -- 注销时间
    deregistered_by         VARCHAR(64),                    -- 注销操作人
    deregister_reason       TEXT,                           -- 注销原因
    created_at              TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, endpoint_url)
);

CREATE INDEX idx_agent_tenant_type ON a2a_agent (tenant_id, type);
CREATE INDEX idx_agent_tenant_status ON a2a_agent (tenant_id, status);
CREATE INDEX idx_agent_health ON a2a_agent (health_status, health_check_enabled);
CREATE INDEX idx_agent_card ON a2a_agent (agent_card_id);
```

### 4.5 a2a_agent_credential（Agent 认证凭证表）

```sql
CREATE TABLE a2a_agent_credential (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    agent_id            VARCHAR(64)   NOT NULL,             -- Agent ID
    scheme              VARCHAR(16)   NOT NULL,             -- 认证方案：API_KEY/JWT/OAUTH2/NONE
    encrypted_credentials BYTEA,                            -- 加密的认证凭证（AES-256 加密）
    jwt_config          JSONB,                              -- JWT 配置（issuer/audience/publicKey 等）
    oauth_config        JSONB,                              -- OAuth 配置（clientId/clientSecret/authUrl/tokenUrl 等）
    status              VARCHAR(16)   NOT NULL DEFAULT 'ACTIVE', -- 状态：ACTIVE/REVOKED
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (agent_id) REFERENCES a2a_agent(id) ON DELETE CASCADE
);

CREATE INDEX idx_cred_agent ON a2a_agent_credential (agent_id);
```

### 4.6 a2a_agent_api_key（Agent API Key 表）

```sql
CREATE TABLE a2a_agent_api_key (
    id                  VARCHAR(64)   PRIMARY KEY,          -- API Key ID
    tenant_id           VARCHAR(64)   NOT NULL,
    agent_id            VARCHAR(64)   NOT NULL,             -- Agent ID
    name                VARCHAR(128)  NOT NULL,             -- API Key 名称
    api_key_hash        VARCHAR(256)  NOT NULL,             -- API Key 哈希值（SHA-256）
    api_key_prefix      VARCHAR(32)   NOT NULL,             -- API Key 前缀（用于展示，如 a2a-sk-xxxx...）
    scopes              JSONB         DEFAULT '[]',         -- 权限范围列表
    status              VARCHAR(16)   NOT NULL DEFAULT 'ACTIVE', -- 状态：ACTIVE/REVOKED/EXPIRED
    expires_at          TIMESTAMP,                          -- 过期时间（NULL 表示永久有效）
    last_used_at        TIMESTAMP,                          -- 最近使用时间
    last_used_ip        VARCHAR(64),                        -- 最近使用 IP
    description         TEXT,                               -- 描述
    created_by          VARCHAR(64)   NOT NULL,             -- 创建人 ID
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    revoked_at          TIMESTAMP,                          -- 吊销时间
    revoked_by          VARCHAR(64),                        -- 吊销操作人
    FOREIGN KEY (agent_id) REFERENCES a2a_agent(id) ON DELETE CASCADE
);

CREATE INDEX idx_apikey_agent ON a2a_agent_api_key (agent_id);
CREATE INDEX idx_apikey_hash ON a2a_agent_api_key (api_key_hash);
CREATE INDEX idx_apikey_status ON a2a_agent_api_key (tenant_id, status);
```

### 4.7 a2a_agent_health_log（Agent 健康检查日志表）

```sql
CREATE TABLE a2a_agent_health_log (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    agent_id            VARCHAR(64)   NOT NULL,             -- Agent ID
    check_type          VARCHAR(16)   NOT NULL DEFAULT 'BASIC', -- 检查类型：BASIC/DEEP
    health_status       VARCHAR(16)   NOT NULL,             -- 检查结果：HEALTHY/UNHEALTHY
    latency             INT,                                -- 检查延迟（毫秒）
    checks_detail       JSONB,                              -- 各检查项详情
    error_message       TEXT,                               -- 错误信息（不健康时）
    trace_id            VARCHAR(64),                        -- 链路追踪 ID
    checked_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (agent_id) REFERENCES a2a_agent(id) ON DELETE CASCADE
);

CREATE INDEX idx_hl_agent_time ON a2a_agent_health_log (agent_id, checked_at DESC);
CREATE INDEX idx_hl_status ON a2a_agent_health_log (tenant_id, health_status, checked_at DESC);
```

### 4.8 a2a_delegation_task（委托任务表）

```sql
CREATE TABLE a2a_delegation_task (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 委托任务 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    external_task_id    VARCHAR(128),                       -- 外部任务 ID（由外部 Agent 生成）
    direction           VARCHAR(16)   NOT NULL,             -- 方向：OUTBOUND/INBOUND
    source_agent_id     VARCHAR(64)   NOT NULL,             -- 发起 Agent ID
    source_agent_name   VARCHAR(256),                       -- 发起 Agent 名称（冗余）
    target_agent_id     VARCHAR(64)   NOT NULL,             -- 目标 Agent ID
    target_agent_name   VARCHAR(256),                       -- 目标 Agent 名称（冗余）
    target_card_id      VARCHAR(64),                        -- 目标 Agent Card ID
    skill_name          VARCHAR(256),                       -- 调用的 Skill 名称
    session_id          VARCHAR(64),                        -- 协作会话 ID
    status              VARCHAR(32)   NOT NULL DEFAULT 'SUBMITTED', -- 状态：SUBMITTED/WORKING/INPUT_REQUIRED/COMPLETED/CANCELED/FAILED/TIMEOUT
    priority            INT           NOT NULL DEFAULT 2,   -- 优先级：1(低)/2(中)/3(高)
    input_message       JSONB         NOT NULL,             -- 输入消息（A2A Message 格式）
    input_metadata      JSONB,                              -- 输入元数据
    output_message      JSONB,                              -- 输出消息（A2A Message 格式）
    output_artifacts    JSONB,                              -- 产出物列表
    error_code          VARCHAR(16),                        -- 错误码（FAILED 时）
    error_message       TEXT,                               -- 错误信息（FAILED 时）
    callback_url        TEXT,                               -- 回调地址
    push_notification_config JSONB,                         -- 推送通知配置
    timeout_seconds     INT           NOT NULL DEFAULT 300, -- 超时时间（秒）
    expires_at          TIMESTAMP,                          -- 过期时间
    submitted_at        TIMESTAMP,                          -- 提交时间
    working_at          TIMESTAMP,                          -- 开始处理时间
    input_required_at   TIMESTAMP,                          -- 进入 INPUT_REQUIRED 时间
    completed_at        TIMESTAMP,                          -- 完成时间
    canceled_at         TIMESTAMP,                          -- 取消时间
    canceled_by         VARCHAR(64),                        -- 取消人
    cancel_reason       TEXT,                               -- 取消原因
    failed_at           TIMESTAMP,                          -- 失败时间
    timed_out_at        TIMESTAMP,                          -- 超时时间
    duration_ms         BIGINT,                             -- 总耗时（毫秒）
    trace_id            VARCHAR(64)   NOT NULL,             -- 链路追踪 ID
    internal_execution_id VARCHAR(64),                      -- 内部执行实例 ID（TECH-AGENT execution ID 或 TECH-WFE instance ID）
    internal_execution_type VARCHAR(16),                    -- 内部执行类型：AGENT/WORKFLOW
    created_by          VARCHAR(64),                        -- 创建人
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dt_tenant_direction ON a2a_delegation_task (tenant_id, direction);
CREATE INDEX idx_dt_tenant_status ON a2a_delegation_task (tenant_id, status);
CREATE INDEX idx_dt_source_agent ON a2a_delegation_task (source_agent_id, created_at DESC);
CREATE INDEX idx_dt_target_agent ON a2a_delegation_task (target_agent_id, created_at DESC);
CREATE INDEX idx_dt_target_card ON a2a_delegation_task (target_card_id);
CREATE INDEX idx_dt_session ON a2a_delegation_task (session_id);
CREATE INDEX idx_dt_external_task ON a2a_delegation_task (external_task_id);
CREATE INDEX idx_dt_expires ON a2a_delegation_task (expires_at) WHERE status IN ('SUBMITTED', 'WORKING', 'INPUT_REQUIRED');
CREATE INDEX idx_dt_trace ON a2a_delegation_task (trace_id);
```

### 4.9 a2a_delegation_status_history（委托任务状态转换历史表）

```sql
CREATE TABLE a2a_delegation_status_history (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    delegation_id       VARCHAR(64)   NOT NULL,             -- 委托任务 ID
    sequence            INT           NOT NULL,             -- 转换序号
    from_state          VARCHAR(32),                        -- 前状态
    to_state            VARCHAR(32)   NOT NULL,             -- 后状态
    transition_source   VARCHAR(16)   NOT NULL,             -- 来源：PLATFORM/EXTERNAL_AGENT/SYSTEM
    detail              TEXT,                               -- 转换详情
    trace_id            VARCHAR(64),                        -- 链路追踪 ID
    occurred_at         TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (delegation_id) REFERENCES a2a_delegation_task(id) ON DELETE CASCADE
);

CREATE INDEX idx_dsh_delegation ON a2a_delegation_status_history (delegation_id, sequence);
```

### 4.10 a2a_delegation_callback（委托任务回调注册表）

```sql
CREATE TABLE a2a_delegation_callback (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 回调 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    delegation_id       VARCHAR(64)   NOT NULL,             -- 委托任务 ID
    callback_url        TEXT          NOT NULL,             -- 回调地址
    callback_type       VARCHAR(32)   NOT NULL DEFAULT 'ON_COMPLETED', -- 类型：ON_COMPLETED/ON_STATUS_CHANGE/ON_FAILED/ON_ALL
    headers             JSONB,                              -- 自定义请求头
    max_retries         INT           NOT NULL DEFAULT 3,   -- 最大重试次数
    retry_interval      INT           NOT NULL DEFAULT 30,  -- 重试间隔（秒）
    current_retry_count INT           NOT NULL DEFAULT 0,   -- 当前重试次数
    last_attempt_at     TIMESTAMP,                          -- 最近尝试时间
    last_attempt_status VARCHAR(16),                        -- 最近尝试结果：SUCCESS/FAILED/PENDING
    last_response_code  INT,                                -- 最近响应 HTTP 码
    last_response_body  TEXT,                               -- 最近响应体
    registered_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (delegation_id) REFERENCES a2a_delegation_task(id) ON DELETE CASCADE
);

CREATE INDEX idx_dcb_delegation ON a2a_delegation_callback (delegation_id);
CREATE INDEX idx_dcb_pending ON a2a_delegation_callback (callback_type, last_attempt_status) WHERE current_retry_count < max_retries;
```

### 4.11 a2a_delegation_artifact（委托任务产出物表）

```sql
CREATE TABLE a2a_delegation_artifact (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 产出物 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    delegation_id       VARCHAR(64)   NOT NULL,             -- 委托任务 ID
    name                VARCHAR(256)  NOT NULL,             -- 产出物名称
    url                 TEXT          NOT NULL,             -- 产出物 URL
    mime_type           VARCHAR(128),                       -- MIME 类型
    size                BIGINT,                             -- 大小（字节）
    downloadable        BOOLEAN       NOT NULL DEFAULT TRUE, -- 是否可下载
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (delegation_id) REFERENCES a2a_delegation_task(id) ON DELETE CASCADE
);

CREATE INDEX idx_dart_delegation ON a2a_delegation_artifact (delegation_id);
```

### 4.12 a2a_collaboration_session（协作会话表）

```sql
CREATE TABLE a2a_collaboration_session (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 会话 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    agent_a_id          VARCHAR(64)   NOT NULL,             -- Agent A ID（发起方）
    agent_b_id          VARCHAR(64)   NOT NULL,             -- Agent B ID（接收方）
    status              VARCHAR(16)   NOT NULL DEFAULT 'ACTIVE', -- 状态：ACTIVE/CLOSED
    delegation_count    INT           NOT NULL DEFAULT 0,   -- 委托任务数
    message_count       INT           NOT NULL DEFAULT 0,   -- 消息数
    last_activity_at    TIMESTAMP,                          -- 最近活动时间
    metadata            JSONB,                              -- 会话元数据
    trace_id            VARCHAR(64),                        -- 创建时的 trace_id
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    closed_at           TIMESTAMP                           -- 关闭时间
);

CREATE INDEX idx_cs_agents ON a2a_collaboration_session (agent_a_id, agent_b_id, status);
CREATE INDEX idx_cs_tenant_status ON a2a_collaboration_session (tenant_id, status);
```

### 4.13 a2a_message（Agent 间消息表）

```sql
CREATE TABLE a2a_message (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 消息 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    source_agent_id     VARCHAR(64)   NOT NULL,             -- 发送 Agent ID
    target_agent_id     VARCHAR(64)   NOT NULL,             -- 目标 Agent ID
    message_type        VARCHAR(32)   NOT NULL DEFAULT 'NOTIFICATION', -- 类型：NOTIFICATION/QUERY/CONTEXT_SYNC/CUSTOM
    content             JSONB         NOT NULL,             -- 消息内容（A2A Message 格式）
    session_id          VARCHAR(64),                        -- 关联会话 ID
    priority            INT           NOT NULL DEFAULT 2,   -- 优先级
    status              VARCHAR(16)   NOT NULL DEFAULT 'PENDING', -- 状态：PENDING/DELIVERED/ACKED/EXPIRED/REJECTED
    require_ack         BOOLEAN       NOT NULL DEFAULT FALSE, -- 是否需要确认
    ack_by              VARCHAR(64),                        -- 确认方 Agent ID
    ack_result          VARCHAR(16),                        -- 确认结果：RECEIVED/PROCESSED/REJECTED
    ack_comment         TEXT,                               -- 确认备注
    acked_at            TIMESTAMP,                          -- 确认时间
    ttl_seconds         INT           NOT NULL DEFAULT 3600, -- 存活时间（秒）
    expires_at          TIMESTAMP,                          -- 过期时间
    metadata            JSONB,                              -- 自定义元数据
    trace_id            VARCHAR(64)   NOT NULL,             -- 链路追踪 ID
    sent_at             TIMESTAMP     NOT NULL DEFAULT NOW(), -- 发送时间
    delivered_at        TIMESTAMP,                          -- 送达时间
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_msg_target_status ON a2a_message (target_agent_id, status, priority DESC);
CREATE INDEX idx_msg_source ON a2a_message (source_agent_id, sent_at DESC);
CREATE INDEX idx_msg_session ON a2a_message (session_id);
CREATE INDEX idx_msg_expires ON a2a_message (expires_at) WHERE status = 'PENDING';
CREATE INDEX idx_msg_trace ON a2a_message (trace_id);
```

### 4.14 a2a_audit_log（协作审计日志表）

```sql
CREATE TABLE a2a_audit_log (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 审计 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    collaboration_type  VARCHAR(32)   NOT NULL,             -- 协作类型：DELEGATION/MESSAGE/DISCOVERY/HEALTH_CHECK/AUTH
    direction           VARCHAR(16),                        -- 方向：OUTBOUND/INBOUND
    source_agent_id     VARCHAR(64),                        -- 发起 Agent ID
    source_agent_name   VARCHAR(256),                       -- 发起 Agent 名称
    target_agent_id     VARCHAR(64),                        -- 目标 Agent ID
    target_agent_name   VARCHAR(256),                       -- 目标 Agent 名称
    skill_name          VARCHAR(256),                       -- Skill 名称
    status              VARCHAR(32),                        -- 协作状态
    session_id          VARCHAR(64),                        -- 会话 ID
    delegation_id       VARCHAR(64),                        -- 委托任务 ID
    message_id          VARCHAR(64),                        -- 消息 ID
    summary             TEXT,                               -- 摘要
    duration_ms         BIGINT,                             -- 耗时（毫秒）
    trace_id            VARCHAR(64),                        -- 链路追踪 ID
    request_ip          VARCHAR(64),                        -- 请求 IP
    started_at          TIMESTAMP     NOT NULL,             -- 开始时间
    completed_at        TIMESTAMP,                          -- 完成时间
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_type ON a2a_audit_log (tenant_id, collaboration_type, created_at DESC);
CREATE INDEX idx_audit_agent ON a2a_audit_log (source_agent_id, target_agent_id, created_at DESC);
CREATE INDEX idx_audit_trace ON a2a_audit_log (trace_id);
CREATE INDEX idx_audit_session ON a2a_audit_log (session_id);
CREATE INDEX idx_audit_started ON a2a_audit_log (started_at DESC);
```

### 4.15 a2a_error_log（错误日志表）

```sql
CREATE TABLE a2a_error_log (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 错误 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    delegation_id       VARCHAR(64),                        -- 关联委托任务 ID
    message_id          VARCHAR(64),                        -- 关联消息 ID
    error_code          VARCHAR(16)   NOT NULL,             -- 错误码
    error_type          VARCHAR(32)   NOT NULL,             -- 错误类型：COMMUNICATION/AUTHENTICATION/PROTOCOL/TIMEOUT/BUSINESS/INTERNAL
    direction           VARCHAR(16),                        -- 方向：OUTBOUND/INBOUND
    source_agent_id     VARCHAR(64),                        -- 发起 Agent ID
    target_agent_id     VARCHAR(64),                        -- 目标 Agent ID
    error_message       TEXT          NOT NULL,             -- 错误信息
    error_detail        TEXT,                               -- 错误详情
    stack_trace         TEXT,                               -- 堆栈跟踪
    trace_id            VARCHAR(64),                        -- 链路追踪 ID
    recovered           BOOLEAN       NOT NULL DEFAULT FALSE, -- 是否已恢复
    recovery_action     TEXT,                               -- 恢复动作
    occurred_at         TIMESTAMP     NOT NULL DEFAULT NOW(), -- 发生时间
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_err_tenant_type ON a2a_error_log (tenant_id, error_type, occurred_at DESC);
CREATE INDEX idx_err_agent ON a2a_error_log (source_agent_id, target_agent_id, occurred_at DESC);
CREATE INDEX idx_err_delegation ON a2a_error_log (delegation_id);
CREATE INDEX idx_err_trace ON a2a_error_log (trace_id);
CREATE INDEX idx_err_occurred ON a2a_error_log (occurred_at DESC);
```

### 4.16 a2a_outbox（Outbox 事件表）

```sql
CREATE TABLE a2a_outbox (
    id                  BIGSERIAL     PRIMARY KEY,          -- 自增 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    event_id            VARCHAR(64)   NOT NULL UNIQUE,      -- 事件唯一 ID
    event_type          VARCHAR(64)   NOT NULL,             -- 事件类型
    aggregate_type      VARCHAR(32)   NOT NULL,             -- 聚合类型：DELEGATION_TASK/AGENT/MESSAGE
    aggregate_id        VARCHAR(64)   NOT NULL,             -- 聚合 ID
    payload             JSONB         NOT NULL,             -- 事件 payload
    trace_id            VARCHAR(64),                        -- 链路追踪 ID
    topic               VARCHAR(128)  NOT NULL,             -- 目标 Kafka Topic
    partition_key       VARCHAR(128),                       -- 分区键
    status              VARCHAR(16)   NOT NULL DEFAULT 'PENDING', -- 状态：PENDING/SENT/FAILED
    retry_count         INT           NOT NULL DEFAULT 0,   -- 重试次数
    max_retries         INT           NOT NULL DEFAULT 3,   -- 最大重试次数
    next_retry_at       TIMESTAMP,                          -- 下次重试时间
    sent_at             TIMESTAMP,                          -- 发送时间
    error_message       TEXT,                               -- 错误信息
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbox_status ON a2a_outbox (status, next_retry_at) WHERE status = 'PENDING';
CREATE INDEX idx_outbox_aggregate ON a2a_outbox (aggregate_type, aggregate_id);
CREATE INDEX idx_outbox_trace ON a2a_outbox (trace_id);
```

### 4.17 a2a_idempotent_request（幂等请求记录表）

```sql
CREATE TABLE a2a_idempotent_request (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    request_type        VARCHAR(64)   NOT NULL,             -- 请求类型
    request_id          VARCHAR(128)  NOT NULL,             -- 请求唯一标识
    request_hash        VARCHAR(256),                       -- 请求体哈希
    response_code       INT,                                -- 响应码
    response_body       TEXT,                               -- 响应体
    trace_id            VARCHAR(64),                        -- 链路追踪 ID
    expires_at          TIMESTAMP     NOT NULL,             -- 过期时间
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, request_type, request_id)
);

CREATE INDEX idx_idem_expires ON a2a_idempotent_request (expires_at);
```

---

## 5. 事件定义

### 5.1 事件类型

| 事件类型 | 说明 | 触发时机 |
|---|---|---|
| DELEGATION_SUBMITTED | 任务委托提交事件 | 委托任务创建成功后 |
| DELEGATION_STATUS_CHANGED | 任务状态变更事件 | 委托任务状态发生转换 |
| DELEGATION_COMPLETED | 任务完成事件 | 委托任务正常完成 |
| DELEGATION_FAILED | 任务失败事件 | 委托任务执行失败 |
| DELEGATION_CANCELED | 任务取消事件 | 委托任务被取消 |
| DELEGATION_TIMEOUT | 任务超时事件 | 委托任务超时未完成 |
| DELEGATION_INPUT_REQUIRED | 任务需要输入事件 | 委托任务进入 INPUT_REQUIRED 状态 |
| AGENT_REGISTERED | Agent 注册事件 | Agent 成功注册到注册中心 |
| AGENT_DEREGISTERED | Agent 注销事件 | Agent 被注销 |
| AGENT_HEALTH_CHANGED | Agent 健康状态变更事件 | Agent 健康状态发生变化 |
| AGENT_CARD_PUBLISHED | Agent Card 发布事件 | Agent Card 成功发布 |
| AGENT_CARD_UPDATED | Agent Card 更新事件 | Agent Card 信息更新 |
| MESSAGE_SENT | 消息发送事件 | Agent 间消息发送成功 |
| MESSAGE_ACKED | 消息确认事件 | 消息被接收方确认 |
| MESSAGE_EXPIRED | 消息过期事件 | 消息超过 TTL 未被确认 |
| AUTH_AGENT_VERIFIED | Agent 认证成功事件 | Agent 身份验证通过 |
| AUTH_AGENT_FAILED | Agent 认证失败事件 | Agent 身份验证失败 |

### 5.2 Kafka Topic 定义

| Topic | 说明 | 分区策略 |
|---|---|---|
| `a2a.delegation.events` | 委托任务生命周期事件 | 按 `delegationId` 哈希分区 |
| `a2a.agent.events` | Agent 状态变更事件 | 按 `agentId` 哈希分区 |
| `a2a.message.events` | Agent 间消息事件 | 按 `targetAgentId` 哈希分区 |
| `a2a.audit.events` | 协作审计事件 | 按 `tenantId` 哈希分区 |
| `a2a.dlq` | 死信队列 | 消费失败的事件 |

### 5.3 Kafka 消息结构

所有 Kafka 消息采用统一信封格式：

```json
{
  "eventId": "evt-20260716-000001",
  "eventType": "DELEGATION_SUBMITTED",
  "eventTimestamp": "2026-07-16T10:00:00.000+08:00",
  "tenantId": "tenant-001",
  "aggregateType": "DELEGATION_TASK",
  "aggregateId": "deleg-20260716-000001",
  "traceId": "a1b2c3d4e5f6",
  "source": "TECH-A2A",
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

#### 5.4.1 DELEGATION_SUBMITTED

```json
{
  "delegationId": "deleg-20260716-000001",
  "externalTaskId": "task-ext-agent-789012",
  "direction": "OUTBOUND",
  "sourceAgentId": "agent-dw-001",
  "sourceAgentName": "市场分析数字员工",
  "targetAgentId": "agent-ext-20260716-000001",
  "targetAgentName": "External Research Agent",
  "targetCardId": "card-ext-20260716-000003",
  "skillName": "market-research",
  "sessionId": "session-20260716-000001",
  "status": "SUBMITTED",
  "priority": 3,
  "timeoutSeconds": 600,
  "expiresAt": "2026-07-16T20:00:00.000+08:00",
  "submittedAt": "2026-07-16T10:00:00.000+08:00"
}
```

#### 5.4.2 DELEGATION_STATUS_CHANGED

```json
{
  "delegationId": "deleg-20260716-000001",
  "externalTaskId": "task-ext-agent-789012",
  "direction": "OUTBOUND",
  "previousStatus": "SUBMITTED",
  "currentStatus": "WORKING",
  "transitionSource": "EXTERNAL_AGENT",
  "detail": "External agent started processing",
  "sessionId": "session-20260716-000001",
  "changedAt": "2026-07-16T10:05:00.000+08:00"
}
```

#### 5.4.3 DELEGATION_COMPLETED

```json
{
  "delegationId": "deleg-20260716-000001",
  "externalTaskId": "task-ext-agent-789012",
  "direction": "OUTBOUND",
  "sourceAgentId": "agent-dw-001",
  "targetAgentId": "agent-ext-20260716-000001",
  "skillName": "market-research",
  "sessionId": "session-20260716-000001",
  "completedAt": "2026-07-16T10:30:00.000+08:00",
  "duration": 1800000,
  "resultSummary": "国内 SaaS CRM 市场竞品分析报告已完成",
  "artifactCount": 2,
  "callbacksTriggered": 1
}
```

#### 5.4.4 DELEGATION_FAILED

```json
{
  "delegationId": "deleg-20260716-000005",
  "externalTaskId": "task-ext-agent-789015",
  "direction": "OUTBOUND",
  "sourceAgentId": "agent-dw-001",
  "targetAgentId": "agent-ext-20260716-000001",
  "skillName": "market-research",
  "sessionId": "session-20260716-000005",
  "errorCode": "42202",
  "errorMessage": "External agent rejected task: input does not match skill input schema",
  "errorType": "BUSINESS",
  "failedAt": "2026-07-16T14:30:00.000+08:00",
  "duration": 5000,
  "callbacksTriggered": 1
}
```

#### 5.4.5 DELEGATION_TIMEOUT

```json
{
  "delegationId": "deleg-20260716-000005",
  "externalTaskId": "task-ext-agent-789015",
  "direction": "OUTBOUND",
  "sourceAgentId": "agent-dw-001",
  "targetAgentId": "agent-ext-20260716-000001",
  "skillName": "market-research",
  "sessionId": "session-20260716-000005",
  "timeoutSeconds": 600,
  "timedOutAt": "2026-07-16T20:00:00.000+08:00",
  "reason": "Task exceeded 600 seconds timeout",
  "externalNotified": true,
  "callbacksTriggered": 1
}
```

#### 5.4.6 AGENT_HEALTH_CHANGED

```json
{
  "agentId": "agent-ext-20260716-000001",
  "agentName": "External Research Agent",
  "agentType": "EXTERNAL",
  "previousHealthStatus": "HEALTHY",
  "currentHealthStatus": "UNHEALTHY",
  "checkType": "BASIC",
  "errorMessage": "Endpoint connection timeout after 10 seconds",
  "errorType": "TIMEOUT",
  "successRate": 96.5,
  "totalChecks": 200,
  "failedChecks": 7,
  "changedAt": "2026-07-16T09:50:00.000+08:00"
}
```

#### 5.4.7 AGENT_REGISTERED

```json
{
  "agentId": "agent-ext-20260716-000001",
  "agentName": "External Research Agent",
  "agentType": "EXTERNAL",
  "endpointUrl": "https://external-agent.example.com/rpc/a2a",
  "agentCardId": "card-ext-20260716-000003",
  "skills": ["market-research", "competitive-analysis"],
  "healthCheckEnabled": true,
  "registeredBy": "user-001",
  "registeredAt": "2026-07-16T09:00:00.000+08:00"
}
```

#### 5.4.8 MESSAGE_SENT

```json
{
  "messageId": "msg-20260716-000001",
  "sourceAgentId": "agent-dw-001",
  "targetAgentId": "agent-ext-20260716-000001",
  "messageType": "CONTEXT_SYNC",
  "sessionId": "session-20260716-000001",
  "priority": 2,
  "requireAck": true,
  "ttlSeconds": 3600,
  "expiresAt": "2026-07-16T11:35:00.000+08:00",
  "sentAt": "2026-07-16T10:35:00.000+08:00"
}
```

#### 5.4.9 AUTH_AGENT_FAILED

```json
{
  "agentId": "ext-agent-unknown-001",
  "scheme": "API_KEY",
  "errorType": "AUTHENTICATION",
  "errorMessage": "Agent authentication failed: invalid API Key",
  "errorDetail": "API Key 'a2a-sk-invalid-xxx' does not match any registered Agent",
  "requestIp": "203.0.113.50",
  "failedAt": "2026-07-16T15:00:00.000+08:00"
}
```

### 5.5 DLQ 处理

- 消费失败的事件进入 `a2a.dlq` Topic
- DLQ 记录包含原始消息、失败原因、重试次数、`traceId`
- DLQ 消费者支持手动重放（replay）指定事件
- 事件最多重试 3 次，超过后进入 DLQ
- DLQ 消息保留 7 天后自动清理

---

## 6. 增量交付计划

### 6.1 Sprint 1：Agent Card 管理与 Agent 注册发现（M1）

**目标**：完成 Agent Card 发布/查询/搜索、外部 Agent 发现、Agent 注册/发现/健康检查基础能力。

| 交付项 | API | 说明 |
|---|---|---|
| 发布 Agent Card | POST /api/v1/a2a/agent-cards | 含 skills、capabilities、authentication 声明 |
| 查询 Agent Card | GET /api/v1/a2a/agent-cards/{cardId} | 单个 Agent Card 详情 |
| 搜索 Agent | GET /api/v1/a2a/agent-cards | 分页搜索、多维度筛选 |
| 更新 Agent Card | PUT /api/v1/a2a/agent-cards/{cardId} | 乐观锁版本控制 |
| 发现外部 Agent Card | POST /api/v1/a2a/agent-cards/discover | 通过 URL 发现并缓存 |
| 删除 Agent Card | DELETE /api/v1/a2a/agent-cards/{cardId} | 含关联任务检查 |
| Agent 注册 | POST /api/v1/a2a/agents | INTERNAL/EXTERNAL 类型 |
| Agent 发现 | GET /api/v1/a2a/agents | 分页查询、多维度筛选 |
| Agent 健康检查 | POST /api/v1/a2a/agents/{agentId}/health-check | 基本+深度检查 |
| 获取 Agent 详情 | GET /api/v1/a2a/agents/{agentId} | 含健康状态与统计 |
| 更新 Agent | PUT /api/v1/a2a/agents/{agentId} | 乐观锁版本控制 |
| 注销 Agent | DELETE /api/v1/a2a/agents/{agentId} | 含进行中任务检查 |
| Agent Card 公开端点 | GET /.well-known/agent.json | A2A 协议标准端点 |
| 数据表 | 全部 DDL | agent_card、agent、agent_credential 等核心表 |
| 健康检查定时任务 | Spring Scheduling | 定时健康检查、状态更新 |
| 事件发布 | Kafka AGENT_* | Outbox 模式 |

**验收标准**：能发布 Agent Card 供外部发现，支持通过 URL 发现外部 Agent Card，Agent 注册后自动健康检查，Agent Card 符合 A2A 协议规范。

---

### 6.2 Sprint 2：任务委托与异步协作（M2）

**目标**：完成核心的任务委托链路，支持出站委托（向外部 Agent 发送任务）和入站委托（接收外部 Agent 任务），含状态同步、结果获取、取消、超时处理。

| 交付项 | API | 说明 |
|---|---|---|
| 委托任务给外部 Agent | POST /api/v1/a2a/delegations | A2A Client，JSON-RPC tasks/send |
| 接收外部任务委托 | POST /rpc/v1/a2a | A2A Server，JSON-RPC 端点 |
| 查询委托任务状态 | GET /api/v1/a2a/delegations/{delegationId} | 含同步外部状态 |
| 获取委托任务结果 | GET /api/v1/a2a/delegations/{delegationId}/result | A2A Message 格式结果 |
| 取消委托任务 | POST /api/v1/a2a/delegations/{delegationId}/cancel | JSON-RPC tasks/cancel |
| 查询委托任务列表 | GET /api/v1/a2a/delegations | 多维度筛选 |
| 补充任务输入 | POST /api/v1/a2a/delegations/{delegationId}/input | INPUT_REQUIRED 状态补充输入 |
| 任务进度流式订阅 | GET /api/v1/a2a/delegations/{delegationId}/stream | SSE 实时进度推送 |
| 任务超时处理 | POST /api/v1/a2a/delegations/{delegationId}/timeout | 手动/自动超时 |
| 注册任务回调 | POST /api/v1/a2a/delegations/{delegationId}/callbacks | 多回调地址 |
| 查询状态转换历史 | GET /api/v1/a2a/delegations/{delegationId}/history | 完整状态机轨迹 |
| 获取任务产出物 | GET /api/v1/a2a/delegations/{delegationId}/artifacts | 产出物列表 |
| 接收外部回调 | POST /api/v1/a2a/callbacks/external | 外部 Agent 推送通知 |
| TECH-AGENT 集成 | 入站任务转交执行 | INBOUND 委托转 Agent 执行 |
| TECH-WFE 集成 | 入站任务转工作流 | INBOUND 委托转 WFE 流程 |
| 超时检测定时任务 | Spring Scheduling | 定时扫描超时任务 |
| 事件发布 | Kafka DELEGATION_* | Outbox 模式 |

**验收标准**：完整的委托任务生命周期（提交 -> 处理 -> 完成/失败/取消/超时），支持 SSE 流式进度推送，入站任务能转交 TECH-AGENT 或 TECH-WFE 执行，回调机制可靠触发。

---

### 6.3 Sprint 3：消息通道与安全认证（M3）

**目标**：完成 Agent 间消息传递能力和安全认证体系，包括 API Key 管理、权限验证。

| 交付项 | API | 说明 |
|---|---|---|
| 发送消息 | POST /api/v1/a2a/messages | 轻量级点对点通信 |
| 接收消息 | GET /api/v1/a2a/agents/{agentId}/messages | 支持长轮询 |
| 确认消息 | POST /api/v1/a2a/messages/{messageId}/ack | ACK 机制 |
| 消息队列管理 | GET /api/v1/a2a/agents/{agentId}/message-queue | 队列状态查询 |
| 清理过期消息 | POST /api/v1/a2a/agents/{agentId}/message-queue/cleanup | TTL 过期清理 |
| Agent 认证 | POST /api/v1/a2a/auth/verify | API Key/JWT 双方案 |
| 生成 API Key | POST /api/v1/a2a/agents/{agentId}/api-keys | 多 Key、独立吊销 |
| 管理 API Key | GET /api/v1/a2a/agents/{agentId}/api-keys | 查询 Key 列表 |
| 吊销 API Key | DELETE /api/v1/a2a/agents/{agentId}/api-keys/{keyId} | 即时失效 |
| 权限验证 | POST /api/v1/a2a/auth/authorize | 操作级权限校验 |
| 凭证加密存储 | AES-256 加密 | Agent Credential 加密 |
| 消息过期清理定时任务 | Spring Scheduling | 定时清理过期消息 |
| 事件发布 | Kafka MESSAGE_* / AUTH_* | Outbox 模式 |

**验收标准**：Agent 间可发送/接收/确认消息，支持长轮询模式；API Key 可生成/吊销/权限控制；认证凭证加密存储；消息 TTL 过期自动清理。

---

### 6.4 Sprint 4：协作审计与运维监控（M4）

**目标**：完成协作审计、统计分析和运维监控能力，提供完整的可观测性。

| 交付项 | API | 说明 |
|---|---|---|
| 协作记录查询 | GET /api/v1/a2a/audit/collaborations | 全量协作审计日志 |
| 委托统计 | GET /api/v1/a2a/audit/delegation-stats | 多维度聚合统计 |
| 错误追踪 | GET /api/v1/a2a/audit/errors | 错误记录查询 |
| Agent 协作统计 | GET /api/v1/a2a/audit/agents/{agentId}/stats | 单 Agent 统计 |
| 导出审计报告 | GET /api/v1/a2a/audit/export | JSON/CSV 格式导出 |
| DLQ 管理 | Kafka a2a.dlq | 死信队列消费与重放 |
| Outbox 投递监控 | Outbox 状态监控 | 未投递事件告警 |
| OpenTelemetry 集成 | trace_id 全链路 | 跨 Agent 链路追踪 |
| APP-DASHBOARD 集成 | 统计数据接口 | 仪表盘数据源 |
| 事件发布 | Kafka AUDIT_* | Outbox 模式 |

**验收标准**：完整的审计日志可查询可导出，委托统计支持多维度聚合，错误追踪含堆栈信息，DLQ 支持重放，trace_id 贯穿全链路（平台内部 + 外部 Agent）。
