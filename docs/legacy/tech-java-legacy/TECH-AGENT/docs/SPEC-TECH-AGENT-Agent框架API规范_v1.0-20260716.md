# SPEC - Agent 框架服务 API 规范（TECH-AGENT）

> 文档版本：v1.0
> 文档日期：2026-07-16
> 适用模块：TECH-AGENT（Agent Framework Service）
> 状态：定稿

---

## 版本历史

| 版本 | 日期 | 变更说明 | 作者 |
|---|---|---|---|
| v1.0 | 2026-07-16 | 初始版本 | - |

---

## 1. 服务概述

### 1.1 定位

TECH-AGENT 是 Mate Platform 的 Agent 框架服务，提供数字员工与 Agent 运行时能力。基于 LangGraph 0.2 构建，支持 ReAct、Plan-and-Solve 等推理范式，具备任务规划、工具调用、记忆管理（短期 + 长期）、多轮对话、执行轨迹记录与评估等核心能力。TECH-AGENT 作为平台 AI 能力的执行层，向上承接 APP-DW 数字员工与 APP-SUPERAI 超级 AI 应用的 Agent 调度需求，向下通过 TECH-LLMGW 统一调用大模型、通过 TECH-RAG 实现知识检索、通过 TECH-ACTION 执行业务动作，并通过 TECH-A2A 协议适配层支持跨系统 Agent 协作。

### 1.2 技术栈

| 层次 | 技术选型 | 说明 |
|---|---|---|
| 语言/框架 | Python 3.13 + FastAPI | 异步高性能 Web 框架 |
| Agent 框架 | LangChain 0.3 + LangGraph 0.2 | Agent 编排与状态机执行引擎 |
| 持久化 | PostgreSQL 17 | Agent 定义、任务、对话、执行轨迹持久化 |
| 缓存 | Redis 7.4 | 执行状态缓存、短期记忆、会话上下文、分布式锁 |
| 消息队列 | Kafka 3.9 | Agent 执行事件、任务状态变更事件（Outbox 模式） |
| 流式输出 | SSE（Server-Sent Events） | Agent 思考链、工具调用、生成内容的实时流式推送 |
| 可观测性 | OpenTelemetry 1.45 | trace_id 全链路传播 |
| 模型调用 | TECH-LLMGW | 统一 LLM Gateway，不直接调用模型 API |

### 1.3 上游依赖

| 上游服务 | 依赖关系 | 说明 |
|---|---|---|
| TECH-LLMGW | 强依赖 | 所有 LLM 调用（Chat/Embedding）通过 LLM Gateway，支持模型路由、负载均衡、Token 计量 |
| TECH-RAG | 强依赖 | Agent 知识检索通过 RAG 引擎，支持向量 + 非向量混合检索 |
| TECH-ACTION | 强依赖 | Agent 工具调用中的业务动作执行通过 Action Engine |
| TECH-ONT | 中依赖 | Agent 配置中引用本体概念，工具调用参数绑定本体对象 |
| TECH-IAM | 强依赖 | 用户/角色/权限校验，数字员工身份绑定 |
| TECH-MSG | 弱依赖 | Kafka 消息基础设施 |

### 1.4 下游消费

| 下游服务/应用 | 消费方式 | 说明 |
|---|---|---|
| APP-DW | REST API + SSE | 数字员工管理、Agent 执行调度、对话交互 |
| APP-SUPERAI | REST API + SSE | 超级 AI 应用的 Agent 执行、流式对话 |
| TECH-A2A | REST API | A2A 协议适配层将外部 Agent 委托任务转为内部 Agent 执行 |
| APP-DASHBOARD | REST API | Agent 运行统计、执行轨迹展示、评估报表 |
| APP-APPHUB | REST API | 低代码应用中嵌入 Agent 能力调用 |

### 1.5 核心能力清单

| 能力域 | 说明 |
|---|---|
| Agent 定义管理 | Agent 配置 CRUD、角色定义、能力分配（Tools/RAG/Action 权限）、模型选择、知识范围配置 |
| Agent 运行时 | 基于 LangGraph 的执行引擎、任务规划（子任务拆解）、工具调用、记忆管理（短期+长期） |
| 任务管理 | 任务创建、分配给 Agent、任务状态追踪、任务结果收集 |
| 对话管理 | 对话会话管理、消息历史、多轮对话上下文、SSE 流式响应 |
| 工具调用 | Tool 注册、Tool 调用执行、调用结果处理、Tool 权限控制 |
| 执行轨迹 | Agent 执行步骤记录、思考链（CoT）、工具调用记录、执行评估 |
| A2A 适配 | 与 TECH-A2A 集成，Agent Card 暴露、外部任务接收与委托 |

### 1.6 核心概念

| 概念 | 说明 |
|---|---|
| Agent | 数字员工的智能体定义，包含角色、模型、能力、知识范围等配置 |
| Execution | Agent 的一次执行实例，对应 LangGraph 的一次图执行 |
| Task | 交给 Agent 完成的任务单元，可拆解为子任务 |
| Conversation | 用户与 Agent 之间的多轮对话会话 |
| Tool | Agent 可调用的工具，包括 MCP Tool、Action Tool、内置 Tool |
| Memory | Agent 记忆，分为短期记忆（执行上下文）和长期记忆（跨会话） |
| Trace | Agent 执行轨迹，包含思考链、工具调用、中间结果 |
| Agent Card | A2A 协议中的 Agent 能力声明，用于跨系统 Agent 发现 |

### 1.7 LangGraph 执行模型

TECH-AGENT 基于 LangGraph 0.2 构建 Agent 执行图，核心节点与流转如下：

```
[START]
  |
  v
[planner] ────── 任务规划，拆解子任务
  |
  v
[agent] <───────────────────────┐
  |                             |
  | (需要工具调用)               |
  v                             |
[tool_executor] ────────────────┘
  |
  | (任务完成)
  v
[evaluator] ────── 执行结果评估
  |
  v
[END]
```

- **planner**：任务规划节点，将复杂任务拆解为子任务序列
- **agent**：核心推理节点，基于 ReAct 范式进行思考与决策
- **tool_executor**：工具执行节点，调用注册的 Tool 并返回结果
- **evaluator**：结果评估节点，校验执行结果是否满足任务要求

---

## 2. 通用约定

### 2.1 路径前缀

所有 TECH-AGENT API 路径统一前缀：`/api/v1/agent`

### 2.2 统一响应体

所有接口返回统一 JSON 结构：

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

### 2.3 认证

- 认证方式：Bearer Token（JWT）
- 请求头：`Authorization: Bearer <token>`
- Token 由 TECH-IAM 签发，包含 `userId`、`tenantId`、`roles` 等声明
- 所有写操作需校验用户权限，读操作需校验数据可见范围
- 数字员工（APP-DW）调用时使用 Service Token，包含 `agentId` 声明

### 2.4 请求头约定

| 请求头 | 必填 | 说明 |
|---|---|---|
| Authorization | 是 | Bearer Token |
| X-Trace-Id | 否 | 链路追踪 ID，未传则服务端自动生成 |
| X-Tenant-Id | 是 | 租户 ID |
| X-Request-Id | 否 | 请求唯一标识，用于幂等控制 |
| Content-Type | 是 | `application/json;charset=UTF-8` |
| Accept | 否 | SSE 接口需设为 `text/event-stream` |

### 2.5 错误码

| 错误码 | HTTP Status | 含义 | 典型场景 |
|---|---|---|---|
| 0 | 200 | 成功 | 正常请求 |
| 40001 | 400 | 参数校验失败 | 必填字段缺失、格式错误 |
| 40002 | 400 | 参数值非法 | 枚举值不匹配、数值越界 |
| 40101 | 401 | 未认证 | Token 缺失或过期 |
| 40301 | 403 | 无权限 | 用户无权操作该资源 |
| 40401 | 404 | 资源不存在 | Agent/任务/会话/执行实例不存在 |
| 40901 | 409 | 状态冲突 | 操作与当前资源状态不兼容（如已禁用的 Agent 执行任务） |
| 40902 | 409 | 版本冲突 | 并发更新导致乐观锁冲突 |
| 42201 | 422 | 业务规则校验失败 | Agent 配置不完整、模型不可用、Tool 未注册 |
| 42202 | 422 | Agent 执行失败 | LLM 调用失败、Tool 执行异常、规划失败 |
| 42901 | 429 | 请求过于频繁 | 触发限流 |
| 50001 | 500 | 服务内部错误 | 未捕获异常 |
| 50002 | 500 | 依赖服务不可用 | TECH-LLMGW/TECH-RAG/TECH-ACTION 不可达 |
| 50003 | 500 | Agent 运行时异常 | LangGraph 状态机错误、超时 |

### 2.6 分页约定

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

### 2.7 trace_id 传播

- 请求进入时，优先使用请求头 `X-Trace-Id` 的值作为 traceId
- 若未传，则服务端自动生成 UUID 作为 traceId
- traceId 写入响应体的 `traceId` 字段
- traceId 写入 Python `contextvars` 与 `structlog` 的日志上下文，贯穿所有日志输出
- traceId 传播至下游服务调用（REST 调用透传 `X-Trace-Id` 头至 TECH-LLMGW/TECH-RAG/TECH-ACTION）
- traceId 写入 Kafka 消息头 `X-Trace-Id`
- traceId 写入 LangGraph 的 state metadata，贯穿执行图所有节点

### 2.8 幂等控制

- 写操作支持幂等：客户端传递 `X-Request-Id` 请求头
- 服务端基于 `(tenantId, requestType, requestId)` 做幂等去重
- 幂等窗口：24 小时
- 同一 `X-Request-Id` 重复请求返回首次结果

### 2.9 SSE 流式输出约定

Agent 执行与对话接口支持 SSE（Server-Sent Events）流式输出，响应头：

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
| `execution.started` | 执行开始 | 执行实例基本信息 |
| `agent.thinking` | Agent 思考 | 当前思考内容（CoT） |
| `agent.action` | Agent 决策动作 | 动作类型与参数 |
| `tool.calling` | 工具调用中 | 工具名与入参 |
| `tool.result` | 工具返回结果 | 工具调用 ID 与返回值 |
| `content.delta` | 生成内容增量 | 文本片段（delta） |
| `content.done` | 生成内容完成 | 完整文本 |
| `execution.step` | 执行步骤完成 | 步骤信息 |
| `execution.completed` | 执行完成 | 最终结果 |
| `execution.failed` | 执行失败 | 错误信息 |
| `error` | 流式错误 | 错误详情 |

### 2.10 LangGraph Checkpoint 机制

- Agent 执行基于 LangGraph 的 Checkpoint 机制实现状态持久化
- Checkpoint 存储于 PostgreSQL（`agent_checkpoint` 表）+ Redis（热缓存）
- 每个图节点执行完成后自动保存 Checkpoint
- 支持基于 Checkpoint 恢复中断的执行
- Checkpoint 包含完整的图状态（State）、执行位置（Node）、消息历史

---

## 3. API 接口详情

### 3.1 Agent 定义管理 API

#### 3.1.1 创建 Agent

创建新的 Agent 定义，配置角色、模型、推理范式等基础信息。

```
POST /api/v1/agent/agents
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| agentKey | string | 是 | Agent 唯一标识（业务 key），同一租户内唯一 |
| name | string | 是 | Agent 名称 |
| description | string | 否 | Agent 描述 |
| role | object | 是 | 角色定义 |
| role.systemPrompt | string | 是 | 系统提示词（System Prompt） |
| role.persona | string | 否 | 人设描述（用于数字员工形象） |
| role.greeting | string | 否 | 欢迎语 |
| modelConfig | object | 是 | 模型配置 |
| modelConfig.provider | string | 是 | 模型提供方（通过 TECH-LLMGW 路由） |
| modelConfig.modelId | string | 是 | 模型 ID（如 doubao-pro-32k） |
| modelConfig.temperature | float | 否 | 温度参数，默认 0.7 |
| modelConfig.maxTokens | int | 否 | 最大生成 Token 数，默认 4096 |
| modelConfig.topP | float | 否 | Top-P 采样，默认 1.0 |
| reasoningMode | string | 否 | 推理范式：`REACT`（默认）/ `PLAN_AND_SOLVE` / `FUNCTION_CALLING` |
| maxIterations | int | 否 | 最大迭代轮次（工具调用循环上限），默认 10 |
| memoryConfig | object | 否 | 记忆配置 |
| memoryConfig.shortTermEnabled | boolean | 否 | 启用短期记忆，默认 true |
| memoryConfig.shortTermWindowSize | int | 否 | 短期记忆窗口大小（消息条数），默认 20 |
| memoryConfig.longTermEnabled | boolean | 否 | 启用长期记忆，默认 false |
| memoryConfig.longTermStrategy | string | 否 | 长期记忆策略：`SUMMARY` / `ENTITY` / `VECTOR` |
| tags | array[string] | 否 | 标签列表 |
| metadata | object | 否 | 自定义元数据 |

**请求示例**

```json
{
  "agentKey": "purchase-assistant",
  "name": "采购助手",
  "description": "协助处理采购审批流程的数字员工",
  "role": {
    "systemPrompt": "你是一个专业的采购助手，负责协助用户完成采购申请的创建、查询和审批流程跟进。你可以查询采购订单状态、创建采购申请、跟踪审批进度。",
    "persona": "专业、高效、礼貌的采购顾问",
    "greeting": "您好！我是采购助手，可以帮您处理采购相关事务。"
  },
  "modelConfig": {
    "provider": "doubao",
    "modelId": "doubao-pro-32k",
    "temperature": 0.3,
    "maxTokens": 4096,
    "topP": 0.9
  },
  "reasoningMode": "REACT",
  "maxIterations": 15,
  "memoryConfig": {
    "shortTermEnabled": true,
    "shortTermWindowSize": 20,
    "longTermEnabled": true,
    "longTermStrategy": "SUMMARY"
  },
  "tags": ["采购", "审批", "数字员工"],
  "metadata": {
    "department": "PROCUREMENT",
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
    "agentId": "agt-9a8b7c6d2026",
    "agentKey": "purchase-assistant",
    "name": "采购助手",
    "description": "协助处理采购审批流程的数字员工",
    "status": "DRAFT",
    "role": {
      "systemPrompt": "你是一个专业的采购助手...",
      "persona": "专业、高效、礼貌的采购顾问",
      "greeting": "您好！我是采购助手，可以帮您处理采购相关事务。"
    },
    "modelConfig": {
      "provider": "doubao",
      "modelId": "doubao-pro-32k",
      "temperature": 0.3,
      "maxTokens": 4096,
      "topP": 0.9
    },
    "reasoningMode": "REACT",
    "maxIterations": 15,
    "memoryConfig": {
      "shortTermEnabled": true,
      "shortTermWindowSize": 20,
      "longTermEnabled": true,
      "longTermStrategy": "SUMMARY"
    },
    "tags": ["采购", "审批", "数字员工"],
    "metadata": {
      "department": "PROCUREMENT",
      "owner": "user-001"
    },
    "version": 1,
    "createdBy": "user-001",
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "updatedAt": "2026-07-16T10:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | agentKey/name/systemPrompt/modelId 为空 |
| 40901 | agentKey 在同一租户内已存在 |
| 42201 | modelId 在 TECH-LLMGW 中不可用或无调用权限 |
| 40002 | reasoningMode 枚举值不合法 |

---

#### 3.1.2 查询 Agent 列表

分页查询当前租户下的 Agent 列表，支持多条件筛选。

```
GET /api/v1/agent/agents
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| agentKey | string | 否 | Agent key，支持模糊匹配 |
| name | string | 否 | Agent 名称，支持模糊匹配 |
| status | string | 否 | 状态：`DRAFT` / `ACTIVE` / `DISABLED` / `ARCHIVED` |
| reasoningMode | string | 否 | 推理范式 |
| tag | string | 否 | 标签精确匹配 |
| createdAfter | string | 否 | 创建时间下界，ISO-8601 |
| createdBefore | string | 否 | 创建时间上界，ISO-8601 |
| page | int | 否 | 页码，默认 1 |
| size | int | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序字段，默认 `-createdAt` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "agentId": "agt-9a8b7c6d2026",
        "agentKey": "purchase-assistant",
        "name": "采购助手",
        "description": "协助处理采购审批流程的数字员工",
        "status": "ACTIVE",
        "reasoningMode": "REACT",
        "modelId": "doubao-pro-32k",
        "tags": ["采购", "审批", "数字员工"],
        "toolCount": 5,
        "knowledgeScopeCount": 2,
        "executionCount": 156,
        "version": 2,
        "createdBy": "user-001",
        "createdAt": "2026-07-16T10:30:00.000+08:00",
        "updatedAt": "2026-07-16T14:00:00.000+08:00"
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
| 40001 | 分页参数不合法（page < 1 或 size > 100） |
| 40301 | 用户无权查看该租户的 Agent 列表 |

---

#### 3.1.3 获取 Agent 详情

根据 Agent ID 获取详细信息，包含能力配置、模型配置、知识范围等。

```
GET /api/v1/agent/agents/{agentId}
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
    "agentId": "agt-9a8b7c6d2026",
    "agentKey": "purchase-assistant",
    "name": "采购助手",
    "description": "协助处理采购审批流程的数字员工",
    "status": "ACTIVE",
    "role": {
      "systemPrompt": "你是一个专业的采购助手...",
      "persona": "专业、高效、礼貌的采购顾问",
      "greeting": "您好！我是采购助手，可以帮您处理采购相关事务。"
    },
    "modelConfig": {
      "provider": "doubao",
      "modelId": "doubao-pro-32k",
      "temperature": 0.3,
      "maxTokens": 4096,
      "topP": 0.9
    },
    "reasoningMode": "REACT",
    "maxIterations": 15,
    "memoryConfig": {
      "shortTermEnabled": true,
      "shortTermWindowSize": 20,
      "longTermEnabled": true,
      "longTermStrategy": "SUMMARY"
    },
    "capabilities": {
      "tools": [
        {
          "toolId": "tool-purchase-query",
          "toolName": "采购订单查询",
          "toolType": "ACTION",
          "enabled": true
        },
        {
          "toolId": "tool-purchase-create",
          "toolName": "创建采购申请",
          "toolType": "ACTION",
          "enabled": true
        },
        {
          "toolId": "tool-kb-search",
          "toolName": "知识库检索",
          "toolType": "RAG",
          "enabled": true
        }
      ],
      "actions": [
        {
          "actionCode": "act_purchase_query",
          "actionName": "采购订单查询",
          "enabled": true
        },
        {
          "actionCode": "act_purchase_create",
          "actionName": "创建采购申请",
          "enabled": true
        }
      ],
      "ragScopes": [
        {
          "scopeId": "scope-001",
          "scopeName": "采购制度知识库",
          "kbIds": ["kb-001", "kb-002"],
          "enabled": true
        }
      ]
    },
    "knowledgeScopes": [
      {
        "scopeId": "scope-001",
        "scopeName": "采购制度知识库",
        "kbIds": ["kb-001", "kb-002"],
        "retrievalConfig": {
          "topK": 5,
          "scoreThreshold": 0.7,
          "rerankEnabled": true
        }
      }
    ],
    "tags": ["采购", "审批", "数字员工"],
    "metadata": {
      "department": "PROCUREMENT",
      "owner": "user-001"
    },
    "version": 2,
    "createdBy": "user-001",
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "updatedAt": "2026-07-16T14:00:00.000+08:00",
    "statistics": {
      "totalExecutions": 156,
      "successfulExecutions": 148,
      "failedExecutions": 8,
      "averageDuration": 12500,
      "averageTokenUsage": 3200,
      "lastExecutedAt": "2026-07-16T16:30:00.000+08:00"
    }
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 40301 | 用户无权查看该 Agent |

---

#### 3.1.4 更新 Agent

更新 Agent 的基础配置。更新后版本号自增，支持版本回溯。

```
PUT /api/v1/agent/agents/{agentId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | Agent 名称 |
| description | string | 否 | Agent 描述 |
| role | object | 否 | 角色定义（同创建接口） |
| modelConfig | object | 否 | 模型配置（同创建接口） |
| reasoningMode | string | 否 | 推理范式 |
| maxIterations | int | 否 | 最大迭代轮次 |
| memoryConfig | object | 否 | 记忆配置 |
| tags | array[string] | 否 | 标签列表 |
| metadata | object | 否 | 自定义元数据 |
| expectedVersion | int | 是 | 乐观锁版本号，需与当前版本一致 |

**请求示例**

```json
{
  "name": "采购助手 V2",
  "description": "升级版采购助手，支持更多采购场景",
  "role": {
    "systemPrompt": "你是一个专业的采购助手，支持采购申请、合同审查、供应商管理。",
    "persona": "专业、高效、全面的采购顾问",
    "greeting": "您好！我是采购助手V2，可以帮您处理采购全流程事务。"
  },
  "modelConfig": {
    "provider": "doubao",
    "modelId": "doubao-pro-128k",
    "temperature": 0.2,
    "maxTokens": 8192
  },
  "maxIterations": 20,
  "expectedVersion": 2
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agt-9a8b7c6d2026",
    "agentKey": "purchase-assistant",
    "name": "采购助手 V2",
    "version": 3,
    "updatedAt": "2026-07-16T16:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 40902 | 版本冲突（expectedVersion 与当前版本不一致） |
| 40901 | Agent 状态为 ACTIVE 且有运行中执行，不允许更新 |
| 42201 | modelId 在 TECH-LLMGW 中不可用 |

---

#### 3.1.5 删除 Agent

删除 Agent 定义。仅允许删除 DRAFT 或 DISABLED 状态的 Agent，且无运行中执行。

```
DELETE /api/v1/agent/agents/{agentId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| cascade | boolean | 否 | 是否级联删除关联的对话、执行记录，默认 false |
| archive | boolean | 否 | 是否归档而非物理删除，默认 true |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agt-9a8b7c6d2026",
    "archived": true,
    "deletedConversations": 12,
    "deletedExecutions": 156,
    "deletedAt": "2026-07-16T16:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 40901 | Agent 状态为 ACTIVE，需先禁用 |
| 40901 | Agent 有运行中执行（EXECUTING 状态） |

---

#### 3.1.6 启用/禁用 Agent

控制 Agent 的可用状态。禁用后不可执行新任务，运行中执行不受影响。

```
PUT /api/v1/agent/agents/{agentId}/state
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| action | string | 是 | `ENABLE`（启用）或 `DISABLE`（禁用） |
| reason | string | 否 | 操作原因 |

**请求示例**

```json
{
  "action": "DISABLE",
  "reason": "模型配置变更，暂停服务"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agt-9a8b7c6d2026",
    "status": "DISABLED",
    "updatedAt": "2026-07-16T16:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 40901 | Agent 当前状态不允许该操作（如已禁用再次禁用） |
| 42201 | 启用前校验失败：模型不可用、未配置工具 |

---

#### 3.1.7 配置 Agent 能力

配置 Agent 可使用的工具（Tools）、业务动作（Actions）、知识检索范围（RAG Scopes）。

```
PUT /api/v1/agent/agents/{agentId}/capabilities
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| tools | array[object] | 否 | 工具配置列表 |
| tools[].toolId | string | 是 | 工具 ID |
| tools[].enabled | boolean | 是 | 是否启用 |
| tools[].config | object | 否 | 工具级配置（覆盖默认参数） |
| actions | array[object] | 否 | Action 配置列表 |
| actions[].actionCode | string | 是 | Action 编码（对应 TECH-ACTION） |
| actions[].enabled | boolean | 是 | 是否启用 |
| actions[].paramMapping | object | 否 | 参数映射（Agent 上下文变量 -> Action 参数） |
| ragScopes | array[object] | 否 | 知识检索范围配置 |
| ragScopes[].scopeName | string | 是 | 范围名称 |
| ragScopes[].kbIds | array[string] | 是 | 知识库 ID 列表（对应 TECH-RAG） |
| ragScopes[].retrievalConfig | object | 否 | 检索配置 |
| ragScopes[].retrievalConfig.topK | int | 否 | 返回条数，默认 5 |
| ragScopes[].retrievalConfig.scoreThreshold | float | 否 | 相似度阈值，默认 0.7 |
| ragScopes[].retrievalConfig.rerankEnabled | boolean | 否 | 是否重排序，默认 false |
| expectedVersion | int | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "tools": [
    {
      "toolId": "tool-purchase-query",
      "enabled": true,
      "config": {
        "maxResults": 50
      }
    },
    {
      "toolId": "tool-purchase-create",
      "enabled": true
    },
    {
      "toolId": "tool-kb-search",
      "enabled": true
    }
  ],
  "actions": [
    {
      "actionCode": "act_purchase_query",
      "enabled": true,
      "paramMapping": {
        "department": "${context.userDepartment}",
        "dateRange": "${context.queryDateRange}"
      }
    },
    {
      "actionCode": "act_purchase_create",
      "enabled": true,
      "paramMapping": {
        "applicantId": "${context.userId}"
      }
    }
  ],
  "ragScopes": [
    {
      "scopeName": "采购制度知识库",
      "kbIds": ["kb-001", "kb-002"],
      "retrievalConfig": {
        "topK": 5,
        "scoreThreshold": 0.7,
        "rerankEnabled": true
      }
    }
  ],
  "expectedVersion": 2
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agt-9a8b7c6d2026",
    "capabilities": {
      "toolCount": 3,
      "actionCount": 2,
      "ragScopeCount": 1
    },
    "version": 3,
    "updatedAt": "2026-07-16T16:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 40902 | 版本冲突 |
| 42201 | toolId 未注册（在 Tool 仓库中不存在） |
| 42201 | actionCode 在 TECH-ACTION 中不存在 |
| 42201 | kbIds 在 TECH-RAG 中不存在或无访问权限 |

---

#### 3.1.8 配置 Agent 模型

单独更新 Agent 的模型配置，支持动态切换模型。

```
PUT /api/v1/agent/agents/{agentId}/model
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| provider | string | 是 | 模型提供方 |
| modelId | string | 是 | 模型 ID |
| temperature | float | 否 | 温度参数 |
| maxTokens | int | 否 | 最大生成 Token 数 |
| topP | float | 否 | Top-P 采样 |
| fallbackModelId | string | 否 | 备选模型 ID（主模型不可用时降级） |
| expectedVersion | int | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "provider": "doubao",
  "modelId": "doubao-pro-128k",
  "temperature": 0.2,
  "maxTokens": 8192,
  "topP": 0.9,
  "fallbackModelId": "doubao-pro-32k",
  "expectedVersion": 2
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agt-9a8b7c6d2026",
    "modelConfig": {
      "provider": "doubao",
      "modelId": "doubao-pro-128k",
      "temperature": 0.2,
      "maxTokens": 8192,
      "topP": 0.9,
      "fallbackModelId": "doubao-pro-32k"
    },
    "version": 3,
    "updatedAt": "2026-07-16T16:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 40902 | 版本冲突 |
| 42201 | modelId 在 TECH-LLMGW 中不可用或无调用权限 |
| 42201 | fallbackModelId 在 TECH-LLMGW 中不可用 |

---

#### 3.1.9 配置 Agent 知识范围

单独更新 Agent 的知识检索范围（RAG Scopes）。

```
PUT /api/v1/agent/agents/{agentId}/knowledge-scope
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| scopes | array[object] | 是 | 知识范围列表（全量覆盖） |
| scopes[].scopeName | string | 是 | 范围名称 |
| scopes[].kbIds | array[string] | 是 | 知识库 ID 列表 |
| scopes[].retrievalConfig | object | 否 | 检索配置（同 3.1.7） |
| scopes[].filterExpression | string | 否 | 元数据过滤表达式 |
| expectedVersion | int | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "scopes": [
    {
      "scopeName": "采购制度知识库",
      "kbIds": ["kb-001", "kb-002"],
      "retrievalConfig": {
        "topK": 5,
        "scoreThreshold": 0.7,
        "rerankEnabled": true
      },
      "filterExpression": "metadata.department = 'PROCUREMENT'"
    },
    {
      "scopeName": "供应商知识库",
      "kbIds": ["kb-003"],
      "retrievalConfig": {
        "topK": 3,
        "scoreThreshold": 0.65
      }
    }
  ],
  "expectedVersion": 3
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agt-9a8b7c6d2026",
    "knowledgeScopes": [
      {
        "scopeId": "scope-001",
        "scopeName": "采购制度知识库",
        "kbIds": ["kb-001", "kb-002"],
        "retrievalConfig": {
          "topK": 5,
          "scoreThreshold": 0.7,
          "rerankEnabled": true
        }
      },
      {
        "scopeId": "scope-002",
        "scopeName": "供应商知识库",
        "kbIds": ["kb-003"],
        "retrievalConfig": {
          "topK": 3,
          "scoreThreshold": 0.65,
          "rerankEnabled": false
        }
      }
    ],
    "version": 4,
    "updatedAt": "2026-07-16T16:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 40902 | 版本冲突 |
| 42201 | kbIds 在 TECH-RAG 中不存在或无访问权限 |

---

#### 3.1.10 获取 Agent 版本历史

查询 Agent 的版本变更历史。

```
GET /api/v1/agent/agents/{agentId}/versions
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
    "items": [
      {
        "version": 3,
        "name": "采购助手 V2",
        "changeSummary": "更新模型为 doubao-pro-128k，增加供应商知识库",
        "changedBy": "user-001",
        "changedAt": "2026-07-16T16:30:00.000+08:00",
        "changes": {
          "modelConfig.modelId": "doubao-pro-32k -> doubao-pro-128k",
          "knowledgeScopes": "新增 scope-002 供应商知识库"
        }
      },
      {
        "version": 2,
        "name": "采购助手",
        "changeSummary": "增加知识库检索能力",
        "changedBy": "user-001",
        "changedAt": "2026-07-16T14:00:00.000+08:00",
        "changes": {
          "capabilities.ragScopes": "新增采购制度知识库"
        }
      },
      {
        "version": 1,
        "name": "采购助手",
        "changeSummary": "初始创建",
        "changedBy": "user-001",
        "changedAt": "2026-07-16T10:30:00.000+08:00",
        "changes": {}
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

---

#### 3.1.11 回滚 Agent 版本

将 Agent 配置回滚到指定历史版本。

```
POST /api/v1/agent/agents/{agentId}/rollback
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| targetVersion | int | 是 | 回滚目标版本号 |
| expectedVersion | int | 是 | 当前乐观锁版本号 |

**请求示例**

```json
{
  "targetVersion": 2,
  "expectedVersion": 3
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agt-9a8b7c6d2026",
    "version": 4,
    "rolledBackFrom": 3,
    "rolledBackTo": 2,
    "updatedAt": "2026-07-16T17:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 40902 | 版本冲突 |
| 40401 | 目标版本号不存在 |
| 40901 | Agent 有运行中执行 |

---

#### 3.1.12 获取 Agent Card（A2A 协议）

获取 Agent 的 A2A 协议 Agent Card，用于跨系统 Agent 发现与协作。

```
GET /api/v1/agent/agents/{agentId}/card
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
    "agentCard": {
      "id": "agt-9a8b7c6d2026",
      "name": "采购助手",
      "description": "协助处理采购审批流程的数字员工",
      "version": "2.0",
      "capabilities": {
        "streaming": true,
        "pushNotifications": false,
        "stateTransition": true
      },
      "skills": [
        {
          "skillId": "purchase-query",
          "name": "采购订单查询",
          "description": "查询采购订单状态、详情、历史记录",
          "inputSchema": {
            "type": "object",
            "properties": {
              "orderId": { "type": "string" },
              "dateRange": { "type": "object" }
            }
          },
          "outputSchema": {
            "type": "object",
            "properties": {
              "orders": { "type": "array" }
            }
          }
        },
        {
          "skillId": "purchase-create",
          "name": "创建采购申请",
          "description": "创建新的采购申请单",
          "inputSchema": {
            "type": "object",
            "properties": {
              "title": { "type": "string" },
              "items": { "type": "array" },
              "amount": { "type": "number" }
            }
          }
        }
      ],
      "defaultInputModes": ["TEXT", "JSON"],
      "defaultOutputModes": ["TEXT", "JSON", "SSE"],
      "endpoint": "https://metaplatform.internal/api/v1/agent/agents/agt-9a8b7c6d2026/execute"
    }
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 42201 | Agent 未配置能力，无法生成有效 Agent Card |

---

### 3.2 Agent 运行时 API

#### 3.2.1 执行任务（同步）

触发 Agent 执行一个任务，同步等待执行完成并返回结果。适用于短时任务。

```
POST /api/v1/agent/agents/{agentId}/execute
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| input | string | 是 | 用户输入（任务描述/问题） |
| inputType | string | 否 | 输入类型：`TEXT`（默认）/ `JSON` / `FILE_REF` |
| context | object | 否 | 执行上下文 |
| context.conversationId | string | 否 | 关联对话 ID（复用会话上下文） |
| context.taskId | string | 否 | 关联任务 ID |
| context.variables | object | 否 | 上下文变量（注入到 Agent 执行环境） |
| context.userId | string | 否 | 触发用户 ID |
| options | object | 否 | 执行选项 |
| options.timeout | int | 否 | 超时时间（秒），默认 120 |
| options.maxIterations | int | 否 | 覆盖 Agent 默认最大迭代轮次 |
| options.enableTrace | boolean | 否 | 是否记录详细执行轨迹，默认 true |
| options.enableMemory | boolean | 否 | 是否启用记忆，默认 true |
| options.streamCallback | boolean | 否 | 是否启用回调通知（Webhook），默认 false |

**请求示例**

```json
{
  "input": "帮我查询本月所有采购订单的状态，并汇总待审批的订单",
  "inputType": "TEXT",
  "context": {
    "conversationId": "conv-20260716-000123",
    "taskId": "task-20260716-000456",
    "variables": {
      "userDepartment": "PROCUREMENT",
      "queryDateRange": {
        "start": "2026-07-01",
        "end": "2026-07-16"
      }
    },
    "userId": "user-001"
  },
  "options": {
    "timeout": 180,
    "maxIterations": 15,
    "enableTrace": true,
    "enableMemory": true
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-20260716-000789",
    "agentId": "agt-9a8b7c6d2026",
    "agentKey": "purchase-assistant",
    "status": "COMPLETED",
    "input": "帮我查询本月所有采购订单的状态，并汇总待审批的订单",
    "output": {
      "content": "本月共有 23 笔采购订单，其中待审批 5 笔。待审批订单汇总如下：\n1. PO-2026-0716-001 服务器采购 - 50万元 - 提交于 2026-07-16\n2. PO-2026-0715-003 办公设备 - 15万元 - 提交于 2026-07-15\n3. PO-2026-0714-002 软件许可 - 8万元 - 提交于 2026-07-14\n4. PO-2026-0712-005 云服务 - 30万元 - 提交于 2026-07-12\n5. PO-2026-0710-001 培训服务 - 5万元 - 提交于 2026-07-10\n\n建议优先处理金额较大的订单。",
      "structuredData": {
        "totalOrders": 23,
        "pendingApproval": 5,
        "pendingOrders": [
          {
            "orderId": "PO-2026-0716-001",
            "title": "服务器采购",
            "amount": 500000,
            "submittedAt": "2026-07-16T10:00:00.000+08:00"
          }
        ]
      }
    },
    "metrics": {
      "duration": 15600,
      "iterations": 4,
      "toolCalls": 2,
      "tokenUsage": {
        "promptTokens": 3200,
        "completionTokens": 450,
        "totalTokens": 3650
      },
      "modelUsed": "doubao-pro-128k"
    },
    "conversationId": "conv-20260716-000123",
    "taskId": "task-20260716-000456",
    "startedAt": "2026-07-16T16:30:00.000+08:00",
    "completedAt": "2026-07-16T16:30:15.600+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 40901 | Agent 状态非 ACTIVE |
| 42202 | LLM 调用失败（TECH-LLMGW 返回错误） |
| 42202 | Tool 执行失败 |
| 50003 | Agent 执行超时 |
| 50002 | TECH-RAG / TECH-ACTION 不可达 |

---

#### 3.2.2 执行任务（SSE 流式）

触发 Agent 执行任务，通过 SSE 流式推送执行过程与结果。适用于需要实时展示思考过程与中间结果的场景。

```
POST /api/v1/agent/agents/{agentId}/execute/stream
```

**请求头**

```
Accept: text/event-stream
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Body）**

同 3.2.1 执行任务（同步）的请求参数。

**响应（SSE 事件流）**

响应为 SSE 事件流，每个事件包含 `event` 和 `data` 字段：

```
event: execution.started
data: {"executionId":"exec-20260716-000790","agentId":"agt-9a8b7c6d2026","startedAt":"2026-07-16T16:35:00.000+08:00","traceId":"a1b2c3d4e5f6"}

event: agent.thinking
data: {"executionId":"exec-20260716-000790","step":1,"thought":"用户想要查询本月采购订单状态并汇总待审批订单。我需要调用采购订单查询工具。","timestamp":"2026-07-16T16:35:01.000+08:00"}

event: agent.action
data: {"executionId":"exec-20260716-000790","step":1,"action":"CALL_TOOL","toolName":"采购订单查询","toolInput":{"dateRange":{"start":"2026-07-01","end":"2026-07-16"}},"timestamp":"2026-07-16T16:35:01.500+08:00"}

event: tool.calling
data: {"executionId":"exec-20260716-000790","toolCallId":"tc-001","toolId":"tool-purchase-query","toolName":"采购订单查询","input":{"dateRange":{"start":"2026-07-01","end":"2026-07-16"}},"timestamp":"2026-07-16T16:35:01.500+08:00"}

event: tool.result
data: {"executionId":"exec-20260716-000790","toolCallId":"tc-001","toolId":"tool-purchase-query","status":"SUCCESS","output":{"totalOrders":23,"pendingApproval":5,"orders":[...]},"duration":2000,"timestamp":"2026-07-16T16:35:03.500+08:00"}

event: agent.thinking
data: {"executionId":"exec-20260716-000790","step":2,"thought":"已获取到23笔订单，其中5笔待审批。现在整理汇总信息回复用户。","timestamp":"2026-07-16T16:35:03.800+08:00"}

event: content.delta
data: {"executionId":"exec-20260716-000790","delta":"本月共有 23 笔采购订单","timestamp":"2026-07-16T16:35:04.000+08:00"}

event: content.delta
data: {"executionId":"exec-20260716-000790","delta":"，其中待审批 5 笔。","timestamp":"2026-07-16T16:35:04.200+08:00"}

event: content.delta
data: {"executionId":"exec-20260716-000790","delta":"待审批订单汇总如下：\n1. PO-2026-0716-001 服务器采购 - 50万元...","timestamp":"2026-07-16T16:35:04.500+08:00"}

event: content.done
data: {"executionId":"exec-20260716-000790","content":"本月共有 23 笔采购订单，其中待审批 5 笔。待审批订单汇总如下：...","timestamp":"2026-07-16T16:35:05.000+08:00"}

event: execution.step
data: {"executionId":"exec-20260716-000790","step":2,"node":"agent","status":"COMPLETED","timestamp":"2026-07-16T16:35:05.000+08:00"}

event: execution.completed
data: {"executionId":"exec-20260716-000790","status":"COMPLETED","metrics":{"duration":5000,"iterations":2,"toolCalls":1,"tokenUsage":{"promptTokens":1800,"completionTokens":350,"totalTokens":2150}},"completedAt":"2026-07-16T16:35:05.000+08:00","traceId":"a1b2c3d4e5f6"}
```

**错误场景（SSE error 事件）**

```
event: execution.failed
data: {"executionId":"exec-20260716-000790","status":"FAILED","error":{"code":42202,"message":"LLM 调用失败：模型超载"},"failedAt":"2026-07-16T16:35:02.000+08:00","traceId":"a1b2c3d4e5f6"}

event: error
data: {"code":50003,"message":"Agent 执行超时","traceId":"a1b2c3d4e5f6"}
```

---

#### 3.2.3 查询执行状态

查询 Agent 执行实例的当前状态。

```
GET /api/v1/agent/executions/{executionId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| executionId | string | 执行实例 ID |

**响应示例（执行中）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-20260716-000789",
    "agentId": "agt-9a8b7c6d2026",
    "agentKey": "purchase-assistant",
    "status": "EXECUTING",
    "currentStep": 3,
    "currentNode": "tool_executor",
    "currentTool": "tool-purchase-query",
    "input": "帮我查询本月所有采购订单的状态...",
    "context": {
      "conversationId": "conv-20260716-000123",
      "taskId": "task-20260716-000456",
      "userId": "user-001"
    },
    "metrics": {
      "duration": 8500,
      "iterations": 2,
      "toolCalls": 1,
      "tokenUsage": {
        "promptTokens": 1600,
        "completionTokens": 120,
        "totalTokens": 1720
      }
    },
    "startedAt": "2026-07-16T16:30:00.000+08:00",
    "traceId": "a1b2c3d4e5f6"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**响应示例（已完成）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-20260716-000789",
    "agentId": "agt-9a8b7c6d2026",
    "agentKey": "purchase-assistant",
    "status": "COMPLETED",
    "input": "帮我查询本月所有采购订单的状态...",
    "output": {
      "content": "本月共有 23 笔采购订单，其中待审批 5 笔...",
      "structuredData": {
        "totalOrders": 23,
        "pendingApproval": 5
      }
    },
    "metrics": {
      "duration": 15600,
      "iterations": 4,
      "toolCalls": 2,
      "tokenUsage": {
        "promptTokens": 3200,
        "completionTokens": 450,
        "totalTokens": 3650
      },
      "modelUsed": "doubao-pro-128k"
    },
    "startedAt": "2026-07-16T16:30:00.000+08:00",
    "completedAt": "2026-07-16T16:30:15.600+08:00",
    "traceId": "a1b2c3d4e5f6"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 执行实例不存在 |
| 40301 | 用户无权查看该执行实例 |

---

#### 3.2.4 取消执行

取消正在执行的 Agent 任务。

```
POST /api/v1/agent/executions/{executionId}/cancel
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| executionId | string | 执行实例 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reason | string | 否 | 取消原因 |

**请求示例**

```json
{
  "reason": "用户手动取消"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-20260716-000789",
    "status": "CANCELLED",
    "cancelledAt": "2026-07-16T16:30:10.000+08:00",
    "cancelledBy": "user-001",
    "reason": "用户手动取消",
    "partialResult": {
      "iterations": 2,
      "toolCalls": 1,
      "tokenUsage": {
        "promptTokens": 1600,
        "completionTokens": 120,
        "totalTokens": 1720
      }
    }
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 执行实例不存在 |
| 40901 | 执行已完成或已取消，无法再次取消 |

---

#### 3.2.5 获取执行结果

获取 Agent 执行实例的最终结果。

```
GET /api/v1/agent/executions/{executionId}/result
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| executionId | string | 执行实例 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-20260716-000789",
    "agentId": "agt-9a8b7c6d2026",
    "status": "COMPLETED",
    "output": {
      "content": "本月共有 23 笔采购订单，其中待审批 5 笔。待审批订单汇总如下：...",
      "structuredData": {
        "totalOrders": 23,
        "pendingApproval": 5,
        "pendingOrders": [
          {
            "orderId": "PO-2026-0716-001",
            "title": "服务器采购",
            "amount": 500000,
            "submittedAt": "2026-07-16T10:00:00.000+08:00"
          }
        ]
      }
    },
    "metrics": {
      "duration": 15600,
      "iterations": 4,
      "toolCalls": 2,
      "tokenUsage": {
        "promptTokens": 3200,
        "completionTokens": 450,
        "totalTokens": 3650
      }
    },
    "completedAt": "2026-07-16T16:30:15.600+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 执行实例不存在 |
| 40901 | 执行尚未完成，结果不可用 |

---

#### 3.2.6 恢复中断的执行

基于 LangGraph Checkpoint 恢复因异常中断的执行。

```
POST /api/v1/agent/executions/{executionId}/resume
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| executionId | string | 执行实例 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| fromCheckpoint | boolean | 否 | 是否从最近的 Checkpoint 恢复，默认 true |
| modifiedInput | string | 否 | 修改后的输入（覆盖原始输入） |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-20260716-000789",
    "status": "EXECUTING",
    "resumedFromCheckpoint": {
      "checkpointId": "ckpt-20260716-000789-v3",
      "checkpointNode": "tool_executor",
      "checkpointStep": 3
    },
    "resumedAt": "2026-07-16T17:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 执行实例不存在 |
| 40901 | 执行状态非 INTERRUPTED / FAILED |
| 42201 | 无可用 Checkpoint |

---

### 3.3 任务管理 API

#### 3.3.1 创建任务

创建一个任务，可后续分配给 Agent 执行。任务可包含子任务（任务拆解）。

```
POST /api/v1/agent/tasks
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| title | string | 是 | 任务标题 |
| description | string | 是 | 任务详细描述 |
| taskType | string | 否 | 任务类型：`ONESHOT`（默认）/ `MULTI_STEP` / `COLLABORATIVE` |
| priority | string | 否 | 优先级：`LOW` / `MEDIUM`（默认）/ `HIGH` / `URGENT` |
| input | object | 否 | 任务输入数据 |
| input.variables | object | 否 | 输入变量 |
| input.attachments | array[string] | 否 | 附件引用 ID 列表 |
| expectedOutput | object | 否 | 期望输出格式 |
| expectedOutput.format | string | 否 | 输出格式：`TEXT` / `JSON` / `STRUCTURED` |
| expectedOutput.schema | object | 否 | 输出 JSON Schema |
| deadline | string | 否 | 截止时间，ISO-8601 |
| parentTaskId | string | 否 | 父任务 ID（用于子任务） |
| tags | array[string] | 否 | 标签 |
| metadata | object | 否 | 自定义元数据 |

**请求示例**

```json
{
  "title": "季度采购分析报告",
  "description": "分析2026年Q3采购数据，生成包含趋势分析、供应商评估、成本优化的分析报告",
  "taskType": "MULTI_STEP",
  "priority": "HIGH",
  "input": {
    "variables": {
      "quarter": "2026-Q3",
      "department": "PROCUREMENT"
    },
    "attachments": ["file-001", "file-002"]
  },
  "expectedOutput": {
    "format": "STRUCTURED",
    "schema": {
      "type": "object",
      "properties": {
        "summary": { "type": "string" },
        "trends": { "type": "array" },
        "supplierScores": { "type": "array" }
      }
    }
  },
  "deadline": "2026-07-20T18:00:00.000+08:00",
  "tags": ["采购", "分析", "季度报告"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "task-20260716-000456",
    "title": "季度采购分析报告",
    "description": "分析2026年Q3采购数据，生成包含趋势分析、供应商评估、成本优化的分析报告",
    "taskType": "MULTI_STEP",
    "priority": "HIGH",
    "status": "PENDING",
    "input": {
      "variables": {
        "quarter": "2026-Q3",
        "department": "PROCUREMENT"
      },
      "attachments": ["file-001", "file-002"]
    },
    "expectedOutput": {
      "format": "STRUCTURED",
      "schema": {
        "type": "object",
        "properties": {
          "summary": { "type": "string" },
          "trends": { "type": "array" },
          "supplierScores": { "type": "array" }
        }
      }
    },
    "deadline": "2026-07-20T18:00:00.000+08:00",
    "tags": ["采购", "分析", "季度报告"],
    "createdBy": "user-001",
    "createdAt": "2026-07-16T10:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | title/description 为空 |
| 40002 | taskType/priority 枚举值不合法 |
| 40401 | parentTaskId 不存在 |
| 42201 | expectedOutput.schema 不是合法 JSON Schema |

---

#### 3.3.2 分配任务给 Agent

将任务分配给指定 Agent 执行，创建执行实例。

```
POST /api/v1/agent/tasks/{taskId}/assign
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| taskId | string | 任务 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| agentId | string | 是 | 目标 Agent ID |
| executionMode | string | 否 | 执行模式：`SYNC`（同步）/ `ASYNC`（默认，异步） |
| input | string | 否 | 执行输入（覆盖任务 description 作为 Agent 输入） |
| context | object | 否 | 额外上下文变量 |
| options | object | 否 | 执行选项（同 3.2.1 options） |

**请求示例**

```json
{
  "agentId": "agt-9a8b7c6d2026",
  "executionMode": "ASYNC",
  "input": "请分析2026年Q3采购数据，生成季度采购分析报告，包含趋势分析、供应商评估和成本优化建议。",
  "context": {
    "variables": {
      "quarter": "2026-Q3",
      "department": "PROCUREMENT"
    }
  },
  "options": {
    "timeout": 300,
    "maxIterations": 20,
    "enableTrace": true
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "task-20260716-000456",
    "agentId": "agt-9a8b7c6d2026",
    "executionId": "exec-20260716-000789",
    "status": "ASSIGNED",
    "executionStatus": "QUEUED",
    "assignedAt": "2026-07-16T10:05:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 任务或 Agent 不存在 |
| 40901 | 任务状态非 PENDING，不允许分配 |
| 40901 | Agent 状态非 ACTIVE |
| 42201 | Agent 未配置执行所需能力 |

---

#### 3.3.3 查询任务列表

分页查询任务列表，支持多条件筛选。

```
GET /api/v1/agent/tasks
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | string | 否 | 任务状态：`PENDING` / `ASSIGNED` / `EXECUTING` / `COMPLETED` / `FAILED` / `CANCELLED` |
| priority | string | 否 | 优先级 |
| taskType | string | 否 | 任务类型 |
| agentId | string | 否 | 分配的 Agent ID |
| createdBy | string | 否 | 创建人 ID |
| parentTaskId | string | 否 | 父任务 ID（查询子任务） |
| tag | string | 否 | 标签精确匹配 |
| createdAfter | string | 否 | 创建时间下界 |
| createdBefore | string | 否 | 创建时间上界 |
| page | int | 否 | 页码，默认 1 |
| size | int | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序字段，默认 `-createdAt` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "taskId": "task-20260716-000456",
        "title": "季度采购分析报告",
        "taskType": "MULTI_STEP",
        "priority": "HIGH",
        "status": "EXECUTING",
        "agentId": "agt-9a8b7c6d2026",
        "agentName": "采购助手",
        "executionId": "exec-20260716-000789",
        "deadline": "2026-07-20T18:00:00.000+08:00",
        "subTaskCount": 3,
        "completedSubTasks": 1,
        "tags": ["采购", "分析", "季度报告"],
        "createdBy": "user-001",
        "createdAt": "2026-07-16T10:00:00.000+08:00",
        "assignedAt": "2026-07-16T10:05:00.000+08:00"
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
| 40001 | 分页参数不合法 |
| 40301 | 用户无权查看该租户的任务列表 |

---

#### 3.3.4 获取任务详情

根据任务 ID 获取详细信息，包含子任务与执行信息。

```
GET /api/v1/agent/tasks/{taskId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| taskId | string | 任务 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "task-20260716-000456",
    "title": "季度采购分析报告",
    "description": "分析2026年Q3采购数据，生成包含趋势分析、供应商评估、成本优化的分析报告",
    "taskType": "MULTI_STEP",
    "priority": "HIGH",
    "status": "EXECUTING",
    "input": {
      "variables": {
        "quarter": "2026-Q3",
        "department": "PROCUREMENT"
      },
      "attachments": ["file-001", "file-002"]
    },
    "expectedOutput": {
      "format": "STRUCTURED",
      "schema": {
        "type": "object",
        "properties": {
          "summary": { "type": "string" },
          "trends": { "type": "array" },
          "supplierScores": { "type": "array" }
        }
      }
    },
    "deadline": "2026-07-20T18:00:00.000+08:00",
    "agentId": "agt-9a8b7c6d2026",
    "agentName": "采购助手",
    "executionId": "exec-20260716-000789",
    "executionStatus": "EXECUTING",
    "subTasks": [
      {
        "taskId": "task-20260716-000457",
        "title": "采购趋势数据分析",
        "status": "COMPLETED",
        "executionId": "exec-20260716-000790",
        "completedAt": "2026-07-16T11:00:00.000+08:00"
      },
      {
        "taskId": "task-20260716-000458",
        "title": "供应商评估分析",
        "status": "EXECUTING",
        "executionId": "exec-20260716-000791"
      },
      {
        "taskId": "task-20260716-000459",
        "title": "成本优化建议生成",
        "status": "PENDING"
      }
    ],
    "tags": ["采购", "分析", "季度报告"],
    "metadata": {},
    "createdBy": "user-001",
    "createdAt": "2026-07-16T10:00:00.000+08:00",
    "assignedAt": "2026-07-16T10:05:00.000+08:00",
    "completedAt": null,
    "traceId": "a1b2c3d4e5f6"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 任务不存在 |
| 40301 | 用户无权查看该任务 |

---

#### 3.3.5 获取任务结果

获取任务的最终执行结果。

```
GET /api/v1/agent/tasks/{taskId}/result
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| taskId | string | 任务 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "task-20260716-000456",
    "title": "季度采购分析报告",
    "status": "COMPLETED",
    "result": {
      "content": "# 2026年Q3采购分析报告\n\n## 概要\n本季度采购总额 1,250万元，环比增长 15%...",
      "structuredData": {
        "summary": "Q3采购总额1250万元，环比增长15%，供应商满意度整体提升",
        "trends": [
          {
            "month": "2026-07",
            "totalAmount": 4200000,
            "orderCount": 56
          },
          {
            "month": "2026-08",
            "totalAmount": 3800000,
            "orderCount": 48
          }
        ],
        "supplierScores": [
          {
            "supplierId": "sup-001",
            "supplierName": "供应商A",
            "score": 92,
            "onTimeRate": 0.95,
            "qualityRate": 0.98
          }
        ]
      },
      "reportUrl": "files/report-2026-Q3-purchase-analysis.pdf"
    },
    "metrics": {
      "totalDuration": 185000,
      "totalIterations": 12,
      "totalToolCalls": 8,
      "totalTokenUsage": {
        "promptTokens": 15600,
        "completionTokens": 3200,
        "totalTokens": 18800
      },
      "subTaskCount": 3,
      "allSubTasksCompleted": true
    },
    "completedAt": "2026-07-16T13:05:00.000+08:00",
    "traceId": "a1b2c3d4e5f6"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 任务不存在 |
| 40901 | 任务尚未完成，结果不可用 |

---

#### 3.3.6 更新任务状态

手动更新任务状态（适用于人工介入或外部系统回调场景）。

```
PUT /api/v1/agent/tasks/{taskId}/status
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| taskId | string | 任务 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | string | 是 | 新状态：`PENDING` / `CANCELLED` / `ON_HOLD` |
| reason | string | 否 | 操作原因 |

**请求示例**

```json
{
  "status": "CANCELLED",
  "reason": "业务需求变更，取消该任务"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "task-20260716-000456",
    "status": "CANCELLED",
    "previousStatus": "EXECUTING",
    "updatedBy": "user-001",
    "updatedAt": "2026-07-16T12:00:00.000+08:00",
    "reason": "业务需求变更，取消该任务"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 任务不存在 |
| 40901 | 状态转换不合法（如 COMPLETED 状态不可变更） |
| 40301 | 用户无权修改任务状态 |

---

#### 3.3.7 获取任务执行统计

查询任务的执行统计信息。

```
GET /api/v1/agent/tasks/{taskId}/statistics
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| taskId | string | 任务 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "task-20260716-000456",
    "title": "季度采购分析报告",
    "status": "COMPLETED",
    "statistics": {
      "totalSubTasks": 3,
      "completedSubTasks": 3,
      "failedSubTasks": 0,
      "totalExecutions": 3,
      "successfulExecutions": 3,
      "totalDuration": 185000,
      "totalToolCalls": 8,
      "totalTokenUsage": {
        "promptTokens": 15600,
        "completionTokens": 3200,
        "totalTokens": 18800
      },
      "estimatedCost": 0.38,
      "startedAt": "2026-07-16T10:05:00.000+08:00",
      "completedAt": "2026-07-16T13:05:00.000+08:00"
    }
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 任务不存在 |

---

### 3.4 对话管理 API

#### 3.4.1 创建对话会话

创建一个新的对话会话，关联指定 Agent。

```
POST /api/v1/agent/conversations
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| agentId | string | 是 | Agent ID |
| title | string | 否 | 对话标题，默认自动生成 |
| userId | string | 否 | 用户 ID（从 Token 解析，可覆盖） |
| context | object | 否 | 会话上下文变量 |
| memoryEnabled | boolean | 否 | 是否启用记忆，默认 true |
| metadata | object | 否 | 自定义元数据 |

**请求示例**

```json
{
  "agentId": "agt-9a8b7c6d2026",
  "title": "采购咨询对话",
  "context": {
    "userDepartment": "PROCUREMENT",
    "userId": "user-001"
  },
  "memoryEnabled": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "conversationId": "conv-20260716-000123",
    "agentId": "agt-9a8b7c6d2026",
    "agentName": "采购助手",
    "title": "采购咨询对话",
    "status": "ACTIVE",
    "userId": "user-001",
    "context": {
      "userDepartment": "PROCUREMENT",
      "userId": "user-001"
    },
    "memoryEnabled": true,
    "messageCount": 0,
    "createdAt": "2026-07-16T15:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | Agent 不存在 |
| 40901 | Agent 状态非 ACTIVE |

---

#### 3.4.2 发送消息（同步）

在对话会话中发送消息，同步等待 Agent 响应。

```
POST /api/v1/agent/conversations/{conversationId}/messages
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| conversationId | string | 对话会话 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| content | string | 是 | 消息内容 |
| contentType | string | 否 | 内容类型：`TEXT`（默认）/ `JSON` / `FILE_REF` |
| role | string | 否 | 消息角色：`USER`（默认）/ `SYSTEM` |
| attachments | array[object] | 否 | 附件列表 |
| attachments[].fileId | string | 是 | 文件 ID |
| attachments[].fileName | string | 是 | 文件名 |
| attachments[].fileType | string | 是 | 文件类型 |
| options | object | 否 | 执行选项（同 3.2.1 options） |

**请求示例**

```json
{
  "content": "帮我查询最近一周的采购订单",
  "contentType": "TEXT",
  "attachments": [
    {
      "fileId": "file-001",
      "fileName": "采购需求清单.xlsx",
      "fileType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
    "messageId": "msg-20260716-000456",
    "conversationId": "conv-20260716-000123",
    "userMessage": {
      "messageId": "msg-20260716-000455",
      "role": "USER",
      "content": "帮我查询最近一周的采购订单",
      "contentType": "TEXT",
      "attachments": [
        {
          "fileId": "file-001",
          "fileName": "采购需求清单.xlsx",
          "fileType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
      ],
      "createdAt": "2026-07-16T15:05:00.000+08:00"
    },
    "agentMessage": {
      "messageId": "msg-20260716-000456",
      "role": "ASSISTANT",
      "content": "最近一周（2026-07-09 至 2026-07-16）共有 12 笔采购订单...",
      "contentType": "TEXT",
      "toolCalls": [
        {
          "toolCallId": "tc-001",
          "toolName": "采购订单查询",
          "toolInput": { "dateRange": { "start": "2026-07-09", "end": "2026-07-16" } },
          "toolOutput": { "totalOrders": 12 },
          "duration": 2000
        }
      ],
      "createdAt": "2026-07-16T15:05:08.000+08:00"
    },
    "executionId": "exec-20260716-000792",
    "metrics": {
      "duration": 8000,
      "tokenUsage": {
        "promptTokens": 1500,
        "completionTokens": 300,
        "totalTokens": 1800
      }
    }
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 对话会话不存在 |
| 40901 | 对话会话已结束 |
| 42202 | Agent 执行失败 |
| 50003 | 执行超时 |

---

#### 3.4.3 发送消息（SSE 流式）

在对话会话中发送消息，通过 SSE 流式推送 Agent 响应。

```
POST /api/v1/agent/conversations/{conversationId}/messages/stream
```

**请求头**

```
Accept: text/event-stream
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| conversationId | string | 对话会话 ID |

**请求参数（Body）**

同 3.4.2 发送消息（同步）的请求参数。

**响应（SSE 事件流）**

```
event: execution.started
data: {"executionId":"exec-20260716-000793","conversationId":"conv-20260716-000123","startedAt":"2026-07-16T15:10:00.000+08:00","traceId":"a1b2c3d4e5f6"}

event: agent.thinking
data: {"executionId":"exec-20260716-000793","step":1,"thought":"用户要查询最近一周的采购订单。我需要调用采购订单查询工具。","timestamp":"2026-07-16T15:10:01.000+08:00"}

event: tool.calling
data: {"executionId":"exec-20260716-000793","toolCallId":"tc-001","toolName":"采购订单查询","toolInput":{"dateRange":{"start":"2026-07-09","end":"2026-07-16"}},"timestamp":"2026-07-16T15:10:01.500+08:00"}

event: tool.result
data: {"executionId":"exec-20260716-000793","toolCallId":"tc-001","toolName":"采购订单查询","status":"SUCCESS","output":{"totalOrders":12,"orders":[...]},"duration":2000,"timestamp":"2026-07-16T15:10:03.500+08:00"}

event: content.delta
data: {"executionId":"exec-20260716-000793","delta":"最近一周（2026-07-09 至 2026-07-16）","timestamp":"2026-07-16T15:10:04.000+08:00"}

event: content.delta
data: {"executionId":"exec-20260716-000793","delta":"共有 12 笔采购订单。","timestamp":"2026-07-16T15:10:04.200+08:00"}

event: content.done
data: {"executionId":"exec-20260716-000793","content":"最近一周（2026-07-09 至 2026-07-16）共有 12 笔采购订单。","messageId":"msg-20260716-000458","timestamp":"2026-07-16T15:10:05.000+08:00"}

event: execution.completed
data: {"executionId":"exec-20260716-000793","status":"COMPLETED","messageId":"msg-20260716-000458","metrics":{"duration":5000,"tokenUsage":{"promptTokens":1500,"completionTokens":300,"totalTokens":1800}},"completedAt":"2026-07-16T15:10:05.000+08:00","traceId":"a1b2c3d4e5f6"}
```

**错误场景（SSE error 事件）**

| 错误码 | 场景 |
|---|---|
| 40401 | 对话会话不存在 |
| 40901 | 对话会话已结束 |
| 42202 | Agent 执行失败 |
| 50003 | 执行超时 |

---

#### 3.4.4 获取对话历史

获取对话会话的消息历史记录。

```
GET /api/v1/agent/conversations/{conversationId}/messages
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| conversationId | string | 对话会话 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| role | string | 否 | 消息角色筛选：`USER` / `ASSISTANT` / `SYSTEM` / `TOOL` |
| afterMessageId | string | 否 | 返回该消息 ID 之后的消息（用于增量加载） |
| limit | int | 否 | 返回条数，默认 50，最大 200 |
| includeToolCalls | boolean | 否 | 是否包含工具调用记录，默认 true |
| ascending | boolean | 否 | 是否按时间正序排列，默认 true |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "conversationId": "conv-20260716-000123",
    "messages": [
      {
        "messageId": "msg-20260716-000455",
        "role": "USER",
        "content": "帮我查询最近一周的采购订单",
        "contentType": "TEXT",
        "attachments": [
          {
            "fileId": "file-001",
            "fileName": "采购需求清单.xlsx",
            "fileType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          }
        ],
        "createdAt": "2026-07-16T15:05:00.000+08:00"
      },
      {
        "messageId": "msg-20260716-000456",
        "role": "ASSISTANT",
        "content": "最近一周（2026-07-09 至 2026-07-16）共有 12 笔采购订单...",
        "contentType": "TEXT",
        "toolCalls": [
          {
            "toolCallId": "tc-001",
            "toolName": "采购订单查询",
            "toolInput": { "dateRange": { "start": "2026-07-09", "end": "2026-07-16" } },
            "toolOutput": { "totalOrders": 12 },
            "duration": 2000
          }
        ],
        "executionId": "exec-20260716-000792",
        "createdAt": "2026-07-16T15:05:08.000+08:00"
      }
    ],
    "total": 2,
    "hasMore": false
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 对话会话不存在 |
| 40001 | limit 超过最大值 200 |

---

#### 3.4.5 获取对话列表

分页查询当前用户的对话会话列表。

```
GET /api/v1/agent/conversations
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| agentId | string | 否 | Agent ID 筛选 |
| status | string | 否 | 状态：`ACTIVE` / `ENDED` / `ARCHIVED` |
| title | string | 否 | 标题模糊匹配 |
| createdAfter | string | 否 | 创建时间下界 |
| createdBefore | string | 否 | 创建时间上界 |
| page | int | 否 | 页码，默认 1 |
| size | int | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序字段，默认 `-lastMessageAt` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "conversationId": "conv-20260716-000123",
        "agentId": "agt-9a8b7c6d2026",
        "agentName": "采购助手",
        "title": "采购咨询对话",
        "status": "ACTIVE",
        "userId": "user-001",
        "messageCount": 8,
        "lastMessage": {
          "role": "ASSISTANT",
          "content": "最近一周共有 12 笔采购订单...",
          "createdAt": "2026-07-16T15:05:08.000+08:00"
        },
        "lastMessageAt": "2026-07-16T15:05:08.000+08:00",
        "createdAt": "2026-07-16T15:00:00.000+08:00"
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
| 40001 | 分页参数不合法 |
| 40301 | 用户无权查看对话列表 |

---

#### 3.4.6 获取对话详情

获取对话会话的详细信息。

```
GET /api/v1/agent/conversations/{conversationId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| conversationId | string | 对话会话 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "conversationId": "conv-20260716-000123",
    "agentId": "agt-9a8b7c6d2026",
    "agentName": "采购助手",
    "title": "采购咨询对话",
    "status": "ACTIVE",
    "userId": "user-001",
    "context": {
      "userDepartment": "PROCUREMENT",
      "userId": "user-001"
    },
    "memoryEnabled": true,
    "memorySummary": "用户之前询问了本月采购订单状态和待审批订单汇总。",
    "messageCount": 8,
    "executionCount": 4,
    "totalTokenUsage": {
      "promptTokens": 6400,
      "completionTokens": 1200,
      "totalTokens": 7600
    },
    "createdAt": "2026-07-16T15:00:00.000+08:00",
    "lastMessageAt": "2026-07-16T15:30:00.000+08:00",
    "endedAt": null
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 对话会话不存在 |
| 40301 | 用户无权查看该对话 |

---

#### 3.4.7 结束对话会话

结束对话会话，释放上下文资源。结束后不可再发送消息。

```
POST /api/v1/agent/conversations/{conversationId}/end
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| conversationId | string | 对话会话 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| saveMemory | boolean | 否 | 是否保存长期记忆，默认 true |
| generateSummary | boolean | 否 | 是否生成对话摘要，默认 true |
| reason | string | 否 | 结束原因 |

**请求示例**

```json
{
  "saveMemory": true,
  "generateSummary": true,
  "reason": "用户主动结束对话"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "conversationId": "conv-20260716-000123",
    "status": "ENDED",
    "endedAt": "2026-07-16T16:00:00.000+08:00",
    "memorySaved": true,
    "memorySummary": "用户在本次对话中查询了本月采购订单状态、待审批订单汇总，并创建了一个新的采购申请。",
    "messageCount": 8,
    "totalTokenUsage": {
      "promptTokens": 6400,
      "completionTokens": 1200,
      "totalTokens": 7600
    }
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 对话会话不存在 |
| 40901 | 对话会话已结束 |

---

### 3.5 工具调用 API

#### 3.5.1 注册 Tool

注册一个新的工具，供 Agent 调用。Tool 类型包括 MCP Tool、Action Tool、内置 Tool、自定义 Python 函数 Tool。

```
POST /api/v1/agent/tools
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| toolKey | string | 是 | 工具唯一标识 |
| name | string | 是 | 工具名称 |
| description | string | 是 | 工具描述（供 Agent 理解工具用途） |
| toolType | string | 是 | 工具类型：`MCP` / `ACTION` / `BUILTIN` / `CUSTOM` |
| implementation | object | 是 | 工具实现配置 |
| implementation.endpoint | string | 条件必填 | MCP Server 端点（toolType=MCP 时） |
| implementation.actionCode | string | 条件必填 | Action 编码（toolType=ACTION 时，对应 TECH-ACTION） |
| implementation.module | string | 条件必填 | 内置模块路径（toolType=BUILTIN 时） |
| implementation.handler | string | 条件必填 | 自定义处理器（toolType=CUSTOM 时，Python 函数路径） |
| inputSchema | object | 是 | 输入参数 JSON Schema |
| outputSchema | object | 否 | 输出参数 JSON Schema |
| config | object | 否 | 工具配置参数 |
| timeout | int | 否 | 执行超时（秒），默认 30 |
| retryCount | int | 否 | 失败重试次数，默认 0 |
| authRequired | boolean | 否 | 是否需要鉴权，默认 true |
| tags | array[string] | 否 | 标签 |

**请求示例**

```json
{
  "toolKey": "purchase-order-query",
  "name": "采购订单查询",
  "description": "根据条件查询采购订单列表，支持按日期范围、部门、状态筛选",
  "toolType": "ACTION",
  "implementation": {
    "actionCode": "act_purchase_query"
  },
  "inputSchema": {
    "type": "object",
    "properties": {
      "dateRange": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "format": "date" },
          "end": { "type": "string", "format": "date" }
        }
      },
      "department": { "type": "string" },
      "status": { "type": "string", "enum": ["PENDING", "APPROVED", "REJECTED", "COMPLETED"] }
    },
    "required": ["dateRange"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "totalOrders": { "type": "integer" },
      "orders": { "type": "array" }
    }
  },
  "config": {
    "maxResults": 100
  },
  "timeout": 30,
  "retryCount": 1,
  "authRequired": true,
  "tags": ["采购", "查询"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "toolId": "tool-purchase-query",
    "toolKey": "purchase-order-query",
    "name": "采购订单查询",
    "description": "根据条件查询采购订单列表，支持按日期范围、部门、状态筛选",
    "toolType": "ACTION",
    "implementation": {
      "actionCode": "act_purchase_query"
    },
    "inputSchema": {
      "type": "object",
      "properties": {
        "dateRange": { "type": "object" },
        "department": { "type": "string" },
        "status": { "type": "string" }
      }
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "totalOrders": { "type": "integer" },
        "orders": { "type": "array" }
      }
    },
    "config": {
      "maxResults": 100
    },
    "timeout": 30,
    "retryCount": 1,
    "authRequired": true,
    "status": "ACTIVE",
    "registeredBy": "user-001",
    "registeredAt": "2026-07-16T09:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | toolKey/name/description/toolType/inputSchema 为空 |
| 40901 | toolKey 在同一租户内已存在 |
| 42201 | toolType=ACTION 但 actionCode 在 TECH-ACTION 中不存在 |
| 42201 | toolType=MCP 但 endpoint 不可达 |
| 42201 | inputSchema 不是合法 JSON Schema |

---

#### 3.5.2 查询可用 Tools

分页查询当前租户下注册的工具列表。

```
GET /api/v1/agent/tools
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| toolKey | string | 否 | 工具 key，支持模糊匹配 |
| name | string | 否 | 工具名称，支持模糊匹配 |
| toolType | string | 否 | 工具类型 |
| status | string | 否 | 状态：`ACTIVE` / `DISABLED` |
| tag | string | 否 | 标签精确匹配 |
| agentId | string | 否 | 查询指定 Agent 可用的工具（含已分配检查） |
| page | int | 否 | 页码，默认 1 |
| size | int | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序字段，默认 `-registeredAt` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "toolId": "tool-purchase-query",
        "toolKey": "purchase-order-query",
        "name": "采购订单查询",
        "description": "根据条件查询采购订单列表",
        "toolType": "ACTION",
        "status": "ACTIVE",
        "timeout": 30,
        "tags": ["采购", "查询"],
        "assignedAgentCount": 3,
        "callCount": 456,
        "registeredBy": "user-001",
        "registeredAt": "2026-07-16T09:00:00.000+08:00"
      },
      {
        "toolId": "tool-kb-search",
        "toolKey": "knowledge-base-search",
        "name": "知识库检索",
        "description": "从知识库中检索相关文档",
        "toolType": "BUILTIN",
        "status": "ACTIVE",
        "timeout": 15,
        "tags": ["RAG", "检索"],
        "assignedAgentCount": 8,
        "callCount": 2340,
        "registeredBy": "system",
        "registeredAt": "2026-07-01T00:00:00.000+08:00"
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
| 40001 | 分页参数不合法 |
| 40301 | 用户无权查看工具列表 |

---

#### 3.5.3 获取 Tool 详情

根据 Tool ID 获取工具详细信息。

```
GET /api/v1/agent/tools/{toolId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| toolId | string | 工具 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "toolId": "tool-purchase-query",
    "toolKey": "purchase-order-query",
    "name": "采购订单查询",
    "description": "根据条件查询采购订单列表，支持按日期范围、部门、状态筛选",
    "toolType": "ACTION",
    "implementation": {
      "actionCode": "act_purchase_query",
      "actionName": "采购订单查询",
      "actionEndpoint": "TECH-ACTION"
    },
    "inputSchema": {
      "type": "object",
      "properties": {
        "dateRange": {
          "type": "object",
          "properties": {
            "start": { "type": "string", "format": "date" },
            "end": { "type": "string", "format": "date" }
          }
        },
        "department": { "type": "string" },
        "status": { "type": "string", "enum": ["PENDING", "APPROVED", "REJECTED", "COMPLETED"] }
      },
      "required": ["dateRange"]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "totalOrders": { "type": "integer" },
        "orders": { "type": "array" }
      }
    },
    "config": {
      "maxResults": 100
    },
    "timeout": 30,
    "retryCount": 1,
    "authRequired": true,
    "status": "ACTIVE",
    "tags": ["采购", "查询"],
    "assignedAgents": [
      {
        "agentId": "agt-9a8b7c6d2026",
        "agentName": "采购助手",
        "enabled": true
      }
    ],
    "statistics": {
      "totalCalls": 456,
      "successfulCalls": 448,
      "failedCalls": 8,
      "averageDuration": 1800,
      "lastCalledAt": "2026-07-16T16:30:00.000+08:00"
    },
    "registeredBy": "user-001",
    "registeredAt": "2026-07-16T09:00:00.000+08:00",
    "updatedAt": "2026-07-16T09:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 工具不存在 |

---

#### 3.5.4 调用 Tool

直接调用指定工具（不经过 Agent 执行），用于测试或直接工具调用场景。

```
POST /api/v1/agent/tools/{toolId}/invoke
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| toolId | string | 工具 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| input | object | 是 | 工具输入参数（需符合 inputSchema） |
| context | object | 否 | 调用上下文 |
| context.userId | string | 否 | 调用用户 ID |
| context.executionId | string | 否 | 关联执行 ID |
| options | object | 否 | 调用选项 |
| options.timeout | int | 否 | 超时覆盖 |

**请求示例**

```json
{
  "input": {
    "dateRange": {
      "start": "2026-07-01",
      "end": "2026-07-16"
    },
    "status": "PENDING"
  },
  "context": {
    "userId": "user-001",
    "executionId": "exec-20260716-000789"
  },
  "options": {
    "timeout": 30
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "toolCallId": "tc-20260716-000123",
    "toolId": "tool-purchase-query",
    "toolName": "采购订单查询",
    "status": "SUCCESS",
    "input": {
      "dateRange": {
        "start": "2026-07-01",
        "end": "2026-07-16"
      },
      "status": "PENDING"
    },
    "output": {
      "totalOrders": 5,
      "orders": [
        {
          "orderId": "PO-2026-0716-001",
          "title": "服务器采购",
          "amount": 500000,
          "status": "PENDING",
          "submittedAt": "2026-07-16T10:00:00.000+08:00"
        }
      ]
    },
    "duration": 1800,
    "calledAt": "2026-07-16T16:30:01.000+08:00",
    "completedAt": "2026-07-16T16:30:02.800+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 工具不存在 |
| 40901 | 工具状态非 ACTIVE |
| 42201 | 输入参数不符合 inputSchema |
| 42202 | 工具执行失败（Action 执行异常、MCP Server 不可达） |
| 50003 | 执行超时 |

---

#### 3.5.5 更新 Tool

更新工具配置。

```
PUT /api/v1/agent/tools/{toolId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| toolId | string | 工具 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | 工具名称 |
| description | string | 否 | 工具描述 |
| inputSchema | object | 否 | 输入参数 JSON Schema |
| outputSchema | object | 否 | 输出参数 JSON Schema |
| config | object | 否 | 工具配置参数 |
| timeout | int | 否 | 执行超时 |
| retryCount | int | 否 | 失败重试次数 |
| tags | array[string] | 否 | 标签 |
| expectedVersion | int | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "description": "根据条件查询采购订单列表，支持按日期范围、部门、状态、金额筛选",
  "inputSchema": {
    "type": "object",
    "properties": {
      "dateRange": { "type": "object" },
      "department": { "type": "string" },
      "status": { "type": "string" },
      "minAmount": { "type": "number" }
    }
  },
  "timeout": 60,
  "expectedVersion": 1
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "toolId": "tool-purchase-query",
    "name": "采购订单查询",
    "version": 2,
    "updatedAt": "2026-07-16T17:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 工具不存在 |
| 40902 | 版本冲突 |
| 42201 | inputSchema 不是合法 JSON Schema |

---

#### 3.5.6 启用/禁用 Tool

控制工具的可用状态。

```
PUT /api/v1/agent/tools/{toolId}/state
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| toolId | string | 工具 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| action | string | 是 | `ENABLE` 或 `DISABLE` |
| reason | string | 否 | 操作原因 |

**请求示例**

```json
{
  "action": "DISABLE",
  "reason": "底层 Action 服务维护中"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "toolId": "tool-purchase-query",
    "status": "DISABLED",
    "updatedAt": "2026-07-16T17:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 工具不存在 |
| 40901 | 工具当前状态不允许该操作 |

---

#### 3.5.7 删除 Tool

删除工具。仅允许删除未被任何 Agent 引用的工具。

```
DELETE /api/v1/agent/tools/{toolId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| toolId | string | 工具 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "toolId": "tool-purchase-query",
    "deletedAt": "2026-07-16T17:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 工具不存在 |
| 40901 | 工具仍被 Agent 引用，需先解除引用 |
| 40901 | 工具状态为 ACTIVE，需先禁用 |

---

### 3.6 执行轨迹 API

#### 3.6.1 获取执行步骤

获取 Agent 执行实例的完整步骤记录。

```
GET /api/v1/agent/executions/{executionId}/steps
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| executionId | string | 执行实例 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| node | string | 否 | 按节点类型筛选：`planner` / `agent` / `tool_executor` / `evaluator` |
| status | string | 否 | 按步骤状态筛选：`RUNNING` / `COMPLETED` / `FAILED` / `SKIPPED` |
| includeInput | boolean | 否 | 是否包含步骤输入，默认 true |
| includeOutput | boolean | 否 | 是否包含步骤输出，默认 true |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-20260716-000789",
    "steps": [
      {
        "stepId": "step-001",
        "stepNumber": 1,
        "node": "planner",
        "nodeName": "任务规划",
        "status": "COMPLETED",
        "input": {
          "task": "帮我查询本月所有采购订单的状态，并汇总待审批的订单"
        },
        "output": {
          "plan": [
            {
              "subTaskId": "sub-001",
              "description": "调用采购订单查询工具获取本月订单",
              "tool": "tool-purchase-query",
              "status": "COMPLETED"
            },
            {
              "subTaskId": "sub-002",
              "description": "分析订单状态，筛选待审批订单",
              "status": "COMPLETED"
            },
            {
              "subTaskId": "sub-003",
              "description": "生成汇总报告回复用户",
              "status": "COMPLETED"
            }
          ]
        },
        "startedAt": "2026-07-16T16:30:00.500+08:00",
        "completedAt": "2026-07-16T16:30:01.000+08:00",
        "duration": 500,
        "tokenUsage": {
          "promptTokens": 800,
          "completionTokens": 100,
          "totalTokens": 900
        }
      },
      {
        "stepId": "step-002",
        "stepNumber": 2,
        "node": "agent",
        "nodeName": "Agent 推理",
        "status": "COMPLETED",
        "input": {
          "plan": "调用采购订单查询工具获取本月订单"
        },
        "output": {
          "thought": "需要调用采购订单查询工具，参数为本月日期范围",
          "action": "CALL_TOOL",
          "toolCall": {
            "toolId": "tool-purchase-query",
            "toolInput": {
              "dateRange": { "start": "2026-07-01", "end": "2026-07-16" }
            }
          }
        },
        "startedAt": "2026-07-16T16:30:01.000+08:00",
        "completedAt": "2026-07-16T16:30:01.500+08:00",
        "duration": 500,
        "tokenUsage": {
          "promptTokens": 1200,
          "completionTokens": 50,
          "totalTokens": 1250
        }
      },
      {
        "stepId": "step-003",
        "stepNumber": 3,
        "node": "tool_executor",
        "nodeName": "工具执行",
        "status": "COMPLETED",
        "input": {
          "toolId": "tool-purchase-query",
          "toolInput": {
            "dateRange": { "start": "2026-07-01", "end": "2026-07-16" }
          }
        },
        "output": {
          "toolCallId": "tc-001",
          "result": {
            "totalOrders": 23,
            "pendingApproval": 5,
            "orders": ["..."]
          }
        },
        "startedAt": "2026-07-16T16:30:01.500+08:00",
        "completedAt": "2026-07-16T16:30:03.500+08:00",
        "duration": 2000
      },
      {
        "stepId": "step-004",
        "stepNumber": 4,
        "node": "agent",
        "nodeName": "Agent 推理",
        "status": "COMPLETED",
        "input": {
          "toolResult": { "totalOrders": 23, "pendingApproval": 5 }
        },
        "output": {
          "thought": "已获取到23笔订单，其中5笔待审批。现在整理汇总信息回复用户。",
          "action": "GENERATE_RESPONSE",
          "response": "本月共有 23 笔采购订单，其中待审批 5 笔..."
        },
        "startedAt": "2026-07-16T16:30:03.500+08:00",
        "completedAt": "2026-07-16T16:30:05.000+08:00",
        "duration": 1500,
        "tokenUsage": {
          "promptTokens": 2000,
          "completionTokens": 300,
          "totalTokens": 2300
        }
      }
    ],
    "totalSteps": 4
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 执行实例不存在 |
| 40301 | 用户无权查看该执行轨迹 |

---

#### 3.6.2 获取思考链（Chain of Thought）

获取 Agent 执行过程中的思考链（CoT）记录。

```
GET /api/v1/agent/executions/{executionId}/thought-chain
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| executionId | string | 执行实例 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-20260716-000789",
    "thoughtChain": [
      {
        "thoughtId": "cot-001",
        "step": 1,
        "thought": "用户想要查询本月采购订单状态并汇总待审批订单。我需要先调用采购订单查询工具获取数据。",
        "action": "CALL_TOOL",
        "actionDetail": {
          "tool": "tool-purchase-query",
          "params": { "dateRange": { "start": "2026-07-01", "end": "2026-07-16" } }
        },
        "confidence": 0.95,
        "timestamp": "2026-07-16T16:30:01.000+08:00"
      },
      {
        "thoughtId": "cot-002",
        "step": 2,
        "thought": "已获取到23笔订单，其中5笔待审批。现在需要整理汇总信息，按金额降序列出待审批订单。",
        "action": "GENERATE_RESPONSE",
        "actionDetail": {
          "responseType": "TEXT",
          "structuredData": {
            "totalOrders": 23,
            "pendingApproval": 5
          }
        },
        "confidence": 0.92,
        "timestamp": "2026-07-16T16:30:03.800+08:00"
      }
    ],
    "totalThoughts": 2
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 执行实例不存在 |
| 42201 | 执行未启用 Trace 记录，无思考链数据 |

---

#### 3.6.3 获取工具调用记录

获取 Agent 执行过程中的所有工具调用记录。

```
GET /api/v1/agent/executions/{executionId}/tool-calls
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| executionId | string | 执行实例 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| toolId | string | 否 | 按工具 ID 筛选 |
| status | string | 否 | 按状态筛选：`SUCCESS` / `FAILED` / `TIMEOUT` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-20260716-000789",
    "toolCalls": [
      {
        "toolCallId": "tc-001",
        "toolId": "tool-purchase-query",
        "toolName": "采购订单查询",
        "toolType": "ACTION",
        "step": 3,
        "status": "SUCCESS",
        "input": {
          "dateRange": { "start": "2026-07-01", "end": "2026-07-16" }
        },
        "output": {
          "totalOrders": 23,
          "pendingApproval": 5,
          "orders": ["..."]
        },
        "duration": 2000,
        "retryCount": 0,
        "startedAt": "2026-07-16T16:30:01.500+08:00",
        "completedAt": "2026-07-16T16:30:03.500+08:00"
      },
      {
        "toolCallId": "tc-002",
        "toolId": "tool-kb-search",
        "toolName": "知识库检索",
        "toolType": "RAG",
        "step": 5,
        "status": "SUCCESS",
        "input": {
          "query": "采购审批流程"
        },
        "output": {
          "documents": [
            {
              "docId": "doc-001",
              "title": "采购管理制度",
              "score": 0.92,
              "snippet": "采购申请审批流程..."
            }
          ]
        },
        "duration": 800,
        "retryCount": 0,
        "startedAt": "2026-07-16T16:30:05.000+08:00",
        "completedAt": "2026-07-16T16:30:05.800+08:00"
      }
    ],
    "totalToolCalls": 2,
    "totalDuration": 2800,
    "successCount": 2,
    "failedCount": 0
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 执行实例不存在 |

---

#### 3.6.4 提交执行评估

对 Agent 执行结果提交人工评估。

```
POST /api/v1/agent/executions/{executionId}/evaluations
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| executionId | string | 执行实例 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| score | int | 是 | 评分：1-5 |
| dimensions | object | 否 | 分维度评分 |
| dimensions.accuracy | int | 否 | 准确性评分 1-5 |
| dimensions.completeness | int | 否 | 完整性评分 1-5 |
| dimensions.relevance | int | 否 | 相关性评分 1-5 |
| dimensions.efficiency | int | 否 | 效率评分 1-5 |
| feedback | string | 否 | 文字反馈 |
| tags | array[string] | 否 | 评估标签 |
| evaluatedBy | string | 否 | 评估人 ID（默认从 Token 解析） |

**请求示例**

```json
{
  "score": 4,
  "dimensions": {
    "accuracy": 5,
    "completeness": 4,
    "relevance": 5,
    "efficiency": 3
  },
  "feedback": "查询结果准确完整，但执行时间稍长，建议优化工具调用并发性。",
  "tags": ["准确", "较慢"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "evaluationId": "eval-20260716-000123",
    "executionId": "exec-20260716-000789",
    "score": 4,
    "dimensions": {
      "accuracy": 5,
      "completeness": 4,
      "relevance": 5,
      "efficiency": 3
    },
    "feedback": "查询结果准确完整，但执行时间稍长，建议优化工具调用并发性。",
    "tags": ["准确", "较慢"],
    "evaluatedBy": "user-001",
    "evaluatedAt": "2026-07-16T17:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 执行实例不存在 |
| 40002 | score 不在 1-5 范围内 |
| 40901 | 该执行已被当前用户评估过 |

---

#### 3.6.5 获取评估记录

获取 Agent 执行实例的评估记录。

```
GET /api/v1/agent/executions/{executionId}/evaluations
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| executionId | string | 执行实例 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "exec-20260716-000789",
    "evaluations": [
      {
        "evaluationId": "eval-20260716-000123",
        "score": 4,
        "dimensions": {
          "accuracy": 5,
          "completeness": 4,
          "relevance": 5,
          "efficiency": 3
        },
        "feedback": "查询结果准确完整，但执行时间稍长，建议优化工具调用并发性。",
        "tags": ["准确", "较慢"],
        "evaluatedBy": "user-001",
        "evaluatedBy_name": "张三",
        "evaluatedAt": "2026-07-16T17:00:00.000+08:00"
      }
    ],
    "averageScore": 4.0,
    "totalEvaluations": 1
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 执行实例不存在 |

---

#### 3.6.6 获取 Agent 执行统计

查询指定 Agent 的执行统计信息，用于仪表盘展示。

```
GET /api/v1/agent/agents/{agentId}/statistics
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| agentId | string | Agent ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startDate | string | 否 | 统计起始日期，ISO-8601 |
| endDate | string | 否 | 统计截止日期，ISO-8601 |
| granularity | string | 否 | 聚合粒度：`HOUR` / `DAY`（默认）/ `WEEK` / `MONTH` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agentId": "agt-9a8b7c6d2026",
    "period": {
      "startDate": "2026-07-01",
      "endDate": "2026-07-16",
      "granularity": "DAY"
    },
    "summary": {
      "totalExecutions": 156,
      "successfulExecutions": 148,
      "failedExecutions": 8,
      "cancelledExecutions": 3,
      "successRate": 0.949,
      "averageDuration": 12500,
      "averageIterations": 4.2,
      "averageToolCalls": 2.8,
      "totalTokenUsage": {
        "promptTokens": 499200,
        "completionTokens": 70200,
        "totalTokens": 569400
      },
      "estimatedCost": 11.39,
      "averageScore": 4.2,
      "totalEvaluations": 45
    },
    "timeSeries": [
      {
        "date": "2026-07-16",
        "executions": 12,
        "successful": 11,
        "failed": 1,
        "averageDuration": 11000,
        "tokenUsage": 42000
      },
      {
        "date": "2026-07-15",
        "executions": 15,
        "successful": 15,
        "failed": 0,
        "averageDuration": 13000,
        "tokenUsage": 51000
      }
    ],
    "toolUsage": [
      {
        "toolId": "tool-purchase-query",
        "toolName": "采购订单查询",
        "callCount": 120,
        "successRate": 0.983,
        "averageDuration": 1800
      },
      {
        "toolId": "tool-kb-search",
        "toolName": "知识库检索",
        "callCount": 45,
        "successRate": 1.0,
        "averageDuration": 800
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
| 40001 | 日期范围不合法 |

---

## 4. 数据模型

### 4.1 PostgreSQL 表结构总览

| 表名 | 说明 |
|---|---|
| agent_definition | Agent 定义表 |
| agent_definition_version | Agent 版本历史表 |
| agent_capability | Agent 能力配置表（Tools/Actions/RAG Scopes） |
| agent_knowledge_scope | Agent 知识范围表 |
| agent_tool | 工具注册表 |
| agent_execution | Agent 执行实例表 |
| agent_execution_step | 执行步骤记录表 |
| agent_checkpoint | LangGraph Checkpoint 表 |
| agent_task | 任务表 |
| agent_conversation | 对话会话表 |
| agent_message | 对话消息表 |
| agent_tool_call | 工具调用记录表 |
| agent_memory | 长期记忆表 |
| agent_evaluation | 执行评估表 |
| agent_outbox | Outbox 事件表（Kafka 事务消息） |
| agent_idempotent_request | 幂等请求记录表 |

### 4.2 agent_definition（Agent 定义表）

```sql
CREATE TABLE agent_definition (
    id                  VARCHAR(64)   PRIMARY KEY,          -- Agent ID（UUID）
    tenant_id           VARCHAR(64)   NOT NULL,             -- 租户 ID
    agent_key           VARCHAR(128)  NOT NULL,             -- Agent 唯一标识（业务 key）
    name                VARCHAR(256)  NOT NULL,             -- Agent 名称
    description         TEXT,                               -- Agent 描述
    status              VARCHAR(32)   NOT NULL DEFAULT 'DRAFT', -- 状态：DRAFT/ACTIVE/DISABLED/ARCHIVED
    role                JSONB         NOT NULL,             -- 角色定义（systemPrompt/persona/greeting）
    model_config        JSONB         NOT NULL,             -- 模型配置（provider/modelId/temperature/maxTokens/topP/fallbackModelId）
    reasoning_mode      VARCHAR(32)   NOT NULL DEFAULT 'REACT', -- 推理范式：REACT/PLAN_AND_SOLVE/FUNCTION_CALLING
    max_iterations      INT           NOT NULL DEFAULT 10,  -- 最大迭代轮次
    memory_config       JSONB,                              -- 记忆配置（shortTerm/longTerm）
    tags                JSONB,                              -- 标签列表
    metadata            JSONB,                              -- 自定义元数据
    version             INT           NOT NULL DEFAULT 1,   -- 当前版本号
    created_by          VARCHAR(64)   NOT NULL,             -- 创建人 ID
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, agent_key)
);

CREATE INDEX idx_ad_tenant_status ON agent_definition (tenant_id, status);
CREATE INDEX idx_ad_tenant_key ON agent_definition (tenant_id, agent_key);
CREATE INDEX idx_ad_created_at ON agent_definition (created_at DESC);
```

### 4.3 agent_definition_version（Agent 版本历史表）

```sql
CREATE TABLE agent_definition_version (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    agent_id            VARCHAR(64)   NOT NULL,             -- Agent ID
    version             INT           NOT NULL,             -- 版本号
    snapshot            JSONB         NOT NULL,             -- 版本快照（完整 Agent 配置）
    change_summary      TEXT,                               -- 变更摘要
    changes             JSONB,                              -- 字段级变更记录
    changed_by          VARCHAR(64)   NOT NULL,             -- 变更人
    changed_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (agent_id) REFERENCES agent_definition(id) ON DELETE CASCADE
);

CREATE INDEX idx_adv_agent_version ON agent_definition_version (agent_id, version DESC);
```

### 4.4 agent_capability（Agent 能力配置表）

```sql
CREATE TABLE agent_capability (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    agent_id            VARCHAR(64)   NOT NULL,             -- Agent ID
    capability_type     VARCHAR(32)   NOT NULL,             -- 能力类型：TOOL/ACTION/RAG_SCOPE
    ref_id              VARCHAR(128)  NOT NULL,             -- 引用 ID（toolId/actionCode/scopeId）
    ref_name            VARCHAR(256),                       -- 引用名称（冗余）
    enabled             BOOLEAN       NOT NULL DEFAULT TRUE, -- 是否启用
    config              JSONB,                              -- 能力级配置
    param_mapping       JSONB,                              -- 参数映射（仅 ACTION）
    sort_order          INT           NOT NULL DEFAULT 0,
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (agent_id) REFERENCES agent_definition(id) ON DELETE CASCADE,
    UNIQUE (agent_id, capability_type, ref_id)
);

CREATE INDEX idx_ac_agent ON agent_capability (agent_id, capability_type, enabled);
```

### 4.5 agent_knowledge_scope（Agent 知识范围表）

```sql
CREATE TABLE agent_knowledge_scope (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    agent_id            VARCHAR(64)   NOT NULL,             -- Agent ID
    scope_name          VARCHAR(256)  NOT NULL,             -- 范围名称
    kb_ids              JSONB         NOT NULL,             -- 知识库 ID 列表
    retrieval_config    JSONB,                              -- 检索配置（topK/scoreThreshold/rerankEnabled）
    filter_expression   TEXT,                               -- 元数据过滤表达式
    enabled             BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (agent_id) REFERENCES agent_definition(id) ON DELETE CASCADE
);

CREATE INDEX idx_aks_agent ON agent_knowledge_scope (agent_id, enabled);
```

### 4.6 agent_tool（工具注册表）

```sql
CREATE TABLE agent_tool (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 工具 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    tool_key            VARCHAR(128)  NOT NULL,             -- 工具唯一标识
    name                VARCHAR(256)  NOT NULL,             -- 工具名称
    description         TEXT          NOT NULL,             -- 工具描述
    tool_type           VARCHAR(32)   NOT NULL,             -- 类型：MCP/ACTION/BUILTIN/CUSTOM
    implementation      JSONB         NOT NULL,             -- 实现配置（endpoint/actionCode/module/handler）
    input_schema        JSONB         NOT NULL,             -- 输入参数 JSON Schema
    output_schema       JSONB,                              -- 输出参数 JSON Schema
    config             JSONB,                              -- 工具配置参数
    timeout            INT           NOT NULL DEFAULT 30,   -- 执行超时（秒）
    retry_count        INT           NOT NULL DEFAULT 0,    -- 失败重试次数
    auth_required      BOOLEAN       NOT NULL DEFAULT TRUE, -- 是否需要鉴权
    status             VARCHAR(32)   NOT NULL DEFAULT 'ACTIVE', -- ACTIVE/DISABLED
    version            INT           NOT NULL DEFAULT 1,
    tags               JSONB,                              -- 标签
    registered_by      VARCHAR(64)   NOT NULL,
    registered_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, tool_key)
);

CREATE INDEX idx_at_tenant_type ON agent_tool (tenant_id, tool_type, status);
CREATE INDEX idx_at_tenant_status ON agent_tool (tenant_id, status);
```

### 4.7 agent_execution（Agent 执行实例表）

```sql
CREATE TABLE agent_execution (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 执行实例 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    agent_id            VARCHAR(64)   NOT NULL,             -- Agent ID
    agent_key           VARCHAR(128)  NOT NULL,             -- Agent key（冗余）
    agent_version       INT           NOT NULL,             -- 执行时的 Agent 版本
    status              VARCHAR(32)   NOT NULL DEFAULT 'QUEUED', -- QUEUED/EXECUTING/COMPLETED/FAILED/CANCELLED/INTERRUPTED
    input               TEXT          NOT NULL,             -- 用户输入
    input_type          VARCHAR(32)   NOT NULL DEFAULT 'TEXT', -- TEXT/JSON/FILE_REF
    output              JSONB,                              -- 执行输出
    context             JSONB,                              -- 执行上下文（conversationId/taskId/variables/userId）
    options             JSONB,                              -- 执行选项
    current_step        INT           NOT NULL DEFAULT 0,   -- 当前步骤序号
    current_node        VARCHAR(64),                        -- 当前 LangGraph 节点
    current_tool_id     VARCHAR(64),                        -- 当前调用的工具 ID
    iterations          INT           NOT NULL DEFAULT 0,   -- 迭代轮次
    tool_call_count     INT           NOT NULL DEFAULT 0,   -- 工具调用次数
    model_used          VARCHAR(128),                       -- 实际使用的模型 ID
    duration            BIGINT,                             -- 执行时长（毫秒）
    prompt_tokens       INT           NOT NULL DEFAULT 0,   -- Prompt Token 数
    completion_tokens   INT           NOT NULL DEFAULT 0,   -- Completion Token 数
    total_tokens        INT           NOT NULL DEFAULT 0,   -- 总 Token 数
    error_code          INT,                                -- 错误码（失败时）
    error_message       TEXT,                               -- 错误信息（失败时）
    conversation_id     VARCHAR(64),                        -- 关联对话 ID
    task_id             VARCHAR(64),                        -- 关联任务 ID
    trace_id            VARCHAR(64),                        -- 链路追踪 ID
    triggered_by        VARCHAR(64)   NOT NULL,             -- 触发人 ID
    started_at          TIMESTAMP,                          -- 开始执行时间
    completed_at        TIMESTAMP,                          -- 完成时间
    cancelled_at        TIMESTAMP,                          -- 取消时间
    cancelled_by        VARCHAR(64),                        -- 取消人
    cancel_reason       TEXT,                               -- 取消原因
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ae_tenant_status ON agent_execution (tenant_id, status);
CREATE INDEX idx_ae_agent ON agent_execution (agent_id, status);
CREATE INDEX idx_ae_conversation ON agent_execution (conversation_id);
CREATE INDEX idx_ae_task ON agent_execution (task_id);
CREATE INDEX idx_ae_started_at ON agent_execution (started_at DESC);
CREATE INDEX idx_ae_trace_id ON agent_execution (trace_id);
```

### 4.8 agent_execution_step（执行步骤记录表）

```sql
CREATE TABLE agent_execution_step (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    execution_id        VARCHAR(64)   NOT NULL,             -- 执行实例 ID
    step_number         INT           NOT NULL,             -- 步骤序号
    node                VARCHAR(64)   NOT NULL,             -- LangGraph 节点：planner/agent/tool_executor/evaluator
    node_name           VARCHAR(256),                       -- 节点显示名称
    status              VARCHAR(32)   NOT NULL DEFAULT 'RUNNING', -- RUNNING/COMPLETED/FAILED/SKIPPED
    input               JSONB,                              -- 步骤输入
    output              JSONB,                              -- 步骤输出
    thought             TEXT,                               -- 思考内容（agent 节点）
    action              VARCHAR(64),                        -- 决策动作（agent 节点）
    tool_call_id        VARCHAR(64),                        -- 工具调用 ID（tool_executor 节点）
    prompt_tokens       INT           NOT NULL DEFAULT 0,
    completion_tokens    INT           NOT NULL DEFAULT 0,
    duration            BIGINT,                             -- 步骤时长（毫秒）
    error_message       TEXT,                               -- 错误信息（失败时）
    started_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMP,
    UNIQUE (execution_id, step_number),
    FOREIGN KEY (execution_id) REFERENCES agent_execution(id) ON DELETE CASCADE
);

CREATE INDEX idx_aes_execution ON agent_execution_step (execution_id, step_number);
CREATE INDEX idx_aes_node ON agent_execution_step (execution_id, node);
```

### 4.9 agent_checkpoint（LangGraph Checkpoint 表）

```sql
CREATE TABLE agent_checkpoint (
    id                  VARCHAR(64)   PRIMARY KEY,          -- Checkpoint ID
    tenant_id           VARCHAR(64)   NOT NULL,
    execution_id        VARCHAR(64)   NOT NULL,             -- 执行实例 ID
    checkpoint_version  INT           NOT NULL,             -- Checkpoint 版本号（递增）
    current_node        VARCHAR(64)   NOT NULL,             -- 当前节点
    current_step        INT           NOT NULL,             -- 当前步骤
    state               JSONB         NOT NULL,             -- LangGraph 完整状态
    messages            JSONB,                              -- 消息历史
    metadata            JSONB,                              -- 元数据（含 traceId）
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (execution_id) REFERENCES agent_execution(id) ON DELETE CASCADE
);

CREATE INDEX idx_acp_execution ON agent_checkpoint (execution_id, checkpoint_version DESC);
```

### 4.10 agent_task（任务表）

```sql
CREATE TABLE agent_task (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 任务 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    title               VARCHAR(512)  NOT NULL,             -- 任务标题
    description         TEXT          NOT NULL,             -- 任务描述
    task_type           VARCHAR(32)   NOT NULL DEFAULT 'ONESHOT', -- ONESHOT/MULTI_STEP/COLLABORATIVE
    priority            VARCHAR(32)   NOT NULL DEFAULT 'MEDIUM', -- LOW/MEDIUM/HIGH/URGENT
    status              VARCHAR(32)   NOT NULL DEFAULT 'PENDING', -- PENDING/ASSIGNED/EXECUTING/COMPLETED/FAILED/CANCELLED/ON_HOLD
    input               JSONB,                              -- 任务输入数据
    expected_output     JSONB,                              -- 期望输出格式
    result              JSONB,                              -- 任务结果
    deadline            TIMESTAMP,                          -- 截止时间
    parent_task_id      VARCHAR(64),                        -- 父任务 ID（子任务）
    agent_id            VARCHAR(64),                        -- 分配的 Agent ID
    execution_id        VARCHAR(64),                        -- 关联执行实例 ID
    sub_task_count      INT           NOT NULL DEFAULT 0,   -- 子任务数
    completed_sub_tasks INT          NOT NULL DEFAULT 0,    -- 完成子任务数
    tags                JSONB,                              -- 标签
    metadata            JSONB,                              -- 元数据
    created_by          VARCHAR(64)   NOT NULL,
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    assigned_at         TIMESTAMP,                          -- 分配时间
    started_at          TIMESTAMP,                          -- 开始执行时间
    completed_at        TIMESTAMP,                          -- 完成时间
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    trace_id            VARCHAR(64)                         -- 链路追踪 ID
);

CREATE INDEX idx_at_tenant_status ON agent_task (tenant_id, status);
CREATE INDEX idx_at_agent ON agent_task (agent_id, status);
CREATE INDEX idx_at_parent ON agent_task (parent_task_id);
CREATE INDEX idx_at_created_at ON agent_task (created_at DESC);
```

### 4.11 agent_conversation（对话会话表）

```sql
CREATE TABLE agent_conversation (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 对话会话 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    agent_id            VARCHAR(64)   NOT NULL,             -- Agent ID
    title               VARCHAR(512),                       -- 对话标题
    status              VARCHAR(32)   NOT NULL DEFAULT 'ACTIVE', -- ACTIVE/ENDED/ARCHIVED
    user_id             VARCHAR(64)   NOT NULL,             -- 用户 ID
    context             JSONB,                              -- 会话上下文变量
    memory_enabled      BOOLEAN       NOT NULL DEFAULT TRUE, -- 是否启用记忆
    memory_summary      TEXT,                               -- 记忆摘要
    message_count       INT           NOT NULL DEFAULT 0,   -- 消息数
    execution_count     INT           NOT NULL DEFAULT 0,   -- 执行次数
    prompt_tokens       INT           NOT NULL DEFAULT 0,   -- 累计 Prompt Token
    completion_tokens   INT           NOT NULL DEFAULT 0,   -- 累计 Completion Token
    total_tokens        INT           NOT NULL DEFAULT 0,   -- 累计总 Token
    metadata            JSONB,                              -- 元数据
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    last_message_at     TIMESTAMP,                          -- 最近消息时间
    ended_at            TIMESTAMP,                          -- 结束时间
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ac_tenant_user ON agent_conversation (tenant_id, user_id, status);
CREATE INDEX idx_ac_agent ON agent_conversation (agent_id, status);
CREATE INDEX idx_ac_last_msg ON agent_conversation (last_message_at DESC);
```

### 4.12 agent_message（对话消息表）

```sql
CREATE TABLE agent_message (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 消息 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    conversation_id     VARCHAR(64)   NOT NULL,             -- 对话会话 ID
    role                VARCHAR(32)   NOT NULL,             -- USER/ASSISTANT/SYSTEM/TOOL
    content             TEXT          NOT NULL,             -- 消息内容
    content_type        VARCHAR(32)   NOT NULL DEFAULT 'TEXT', -- TEXT/JSON/FILE_REF
    attachments         JSONB,                              -- 附件列表
    tool_calls          JSONB,                              -- 工具调用记录（ASSISTANT 消息）
    execution_id        VARCHAR(64),                        -- 关联执行实例 ID
    token_count         INT           NOT NULL DEFAULT 0,   -- Token 数
    sequence            INT           NOT NULL,             -- 消息序号
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (conversation_id) REFERENCES agent_conversation(id) ON DELETE CASCADE
);

CREATE INDEX idx_am_conversation ON agent_message (conversation_id, sequence);
CREATE INDEX idx_am_role ON agent_message (conversation_id, role);
```

### 4.13 agent_tool_call（工具调用记录表）

```sql
CREATE TABLE agent_tool_call (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 工具调用 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    execution_id        VARCHAR(64)   NOT NULL,             -- 关联执行实例 ID
    tool_id             VARCHAR(64)   NOT NULL,             -- 工具 ID
    tool_name           VARCHAR(256)  NOT NULL,             -- 工具名称（冗余）
    tool_type           VARCHAR(32)   NOT NULL,             -- 工具类型（冗余）
    step_number         INT,                                -- 关联步骤序号
    status              VARCHAR(32)   NOT NULL DEFAULT 'RUNNING', -- RUNNING/SUCCESS/FAILED/TIMEOUT
    input               JSONB         NOT NULL,             -- 调用输入
    output              JSONB,                              -- 调用输出
    duration            BIGINT,                             -- 调用时长（毫秒）
    retry_count         INT           NOT NULL DEFAULT 0,   -- 重试次数
    error_message       TEXT,                               -- 错误信息（失败时）
    started_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMP,
    FOREIGN KEY (execution_id) REFERENCES agent_execution(id) ON DELETE CASCADE
);

CREATE INDEX idx_atc_execution ON agent_tool_call (execution_id);
CREATE INDEX idx_atc_tool ON agent_tool_call (tool_id, started_at DESC);
```

### 4.14 agent_memory（长期记忆表）

```sql
CREATE TABLE agent_memory (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    agent_id            VARCHAR(64)   NOT NULL,             -- Agent ID
    conversation_id     VARCHAR(64),                        -- 来源对话 ID
    memory_type         VARCHAR(32)   NOT NULL,             -- SUMMARY/ENTITY/EPISODE
    content             TEXT          NOT NULL,             -- 记忆内容
    metadata            JSONB,                              -- 元数据（实体名、时间范围等）
    embedding_id        VARCHAR(128),                      -- 向量索引 ID（Milvus）
    importance          FLOAT        NOT NULL DEFAULT 0.5,  -- 重要性权重 0-1
    access_count        INT           NOT NULL DEFAULT 0,   -- 访问次数
    last_accessed_at    TIMESTAMP,                          -- 最近访问时间
    expires_at          TIMESTAMP,                          -- 过期时间
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (agent_id) REFERENCES agent_definition(id) ON DELETE CASCADE
);

CREATE INDEX idx_am_agent_type ON agent_memory (agent_id, memory_type);
CREATE INDEX idx_am_expires ON agent_memory (expires_at);
```

### 4.15 agent_evaluation（执行评估表）

```sql
CREATE TABLE agent_evaluation (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    execution_id        VARCHAR(64)   NOT NULL,             -- 执行实例 ID
    score               INT           NOT NULL,             -- 总评分 1-5
    dimensions          JSONB,                              -- 分维度评分
    feedback            TEXT,                               -- 文字反馈
    tags                JSONB,                              -- 评估标签
    evaluated_by        VARCHAR(64)   NOT NULL,             -- 评估人 ID
    evaluated_at        TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (execution_id, evaluated_by),
    FOREIGN KEY (execution_id) REFERENCES agent_execution(id) ON DELETE CASCADE
);

CREATE INDEX idx_ae_execution ON agent_evaluation (execution_id);
```

### 4.16 agent_outbox（Outbox 事件表）

```sql
CREATE TABLE agent_outbox (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    event_id           VARCHAR(128)  NOT NULL UNIQUE,       -- 事件唯一 ID
    event_type         VARCHAR(64)   NOT NULL,              -- 事件类型
    aggregate_type     VARCHAR(64)   NOT NULL,              -- 聚合类型
    aggregate_id       VARCHAR(128)  NOT NULL,              -- 聚合 ID
    topic              VARCHAR(128)  NOT NULL,              -- Kafka Topic
    payload            JSONB         NOT NULL,              -- 事件 payload
    headers            JSONB,                              -- 消息头（含 traceId）
    status             VARCHAR(32)   NOT NULL DEFAULT 'PENDING', -- PENDING/SENT/FAILED
    retry_count        INT           NOT NULL DEFAULT 0,
    max_retries        INT           NOT NULL DEFAULT 5,
    next_retry_at      TIMESTAMP,                          -- 下次重试时间
    sent_at            TIMESTAMP,                          -- 发送成功时间
    created_at         TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ao_status_retry ON agent_outbox (status, next_retry_at);
CREATE INDEX idx_ao_aggregate ON agent_outbox (aggregate_type, aggregate_id);
```

### 4.17 agent_idempotent_request（幂等请求记录表）

```sql
CREATE TABLE agent_idempotent_request (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    request_id         VARCHAR(128)  NOT NULL,             -- 请求唯一标识
    request_type       VARCHAR(64)   NOT NULL,             -- 请求类型
    response_payload    JSONB,                              -- 首次响应内容
    response_code      INT,                                -- 首次响应码
    expires_at         TIMESTAMP     NOT NULL,             -- 过期时间
    created_at         TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, request_type, request_id)
);

CREATE INDEX idx_air_expires ON agent_idempotent_request (expires_at);
```

### 4.18 Redis 数据结构

| Key 模式 | 类型 | 说明 | TTL |
|---|---|---|---|
| `agent:exec:{executionId}` | Hash | 执行实例状态缓存（status/currentStep/currentNode/metrics） | 执行中无 TTL，完成后 1 小时 |
| `agent:exec:{executionId}:lock` | String | 执行分布式锁（防止并发取消/恢复） | 30 秒 |
| `agent:conv:{conversationId}:context` | Hash | 对话短期记忆上下文（最近 N 条消息摘要） | 24 小时 |
| `agent:conv:{conversationId}:lock` | String | 对话写入锁 | 10 秒 |
| `agent:agent:{agentId}:config` | Hash | Agent 配置缓存（role/modelConfig/capabilities） | 5 分钟 |
| `agent:agent:{agentId}:tools` | Set | Agent 可用工具 ID 集合缓存 | 5 分钟 |
| `agent:tool:registry` | Hash | 全局工具注册表缓存（toolId -> JSON） | 10 分钟 |
| `agent:memory:{agentId}:short` | List | 短期记忆消息列表（最近 N 条） | 会话生命周期 |
| `agent:memory:{agentId}:summary` | String | 长期记忆摘要缓存 | 1 小时 |
| `agent:rate:{tenantId}:{agentId}` | String | 速率限制计数器 | 1 分钟 |
| `agent:task:{taskId}:status` | String | 任务状态缓存 | 5 分钟 |
| `agent:checkpoint:{executionId}:latest` | String | 最新 Checkpoint ID 缓存 | 1 小时 |

**Redis 使用约定：**

- 执行状态缓存采用 Write-Through 模式：DB 写入成功后同步更新 Redis
- 短期记忆使用 Redis List（LPUSH/RPUSH），窗口大小由 Agent 配置决定
- 对话上下文在消息发送时读取，Agent 响应后更新
- 分布式锁使用 `SET key value NX PX <ttl>` 实现
- 速率限制采用滑动窗口计数器（`INCR` + `EXPIRE`）

---

## 5. 事件定义

### 5.1 事件类型

| 事件类型 | 说明 | 触发时机 |
|---|---|---|
| AGENT_CREATED | Agent 创建事件 | Agent 定义创建成功后 |
| AGENT_UPDATED | Agent 更新事件 | Agent 配置更新后 |
| AGENT_DELETED | Agent 删除事件 | Agent 被删除/归档后 |
| AGENT_STATE_CHANGED | Agent 状态变更事件 | Agent 启用/禁用后 |
| EXECUTION_STARTED | 执行开始事件 | Agent 执行实例开始执行 |
| EXECUTION_STEP_COMPLETED | 执行步骤完成事件 | 一个执行步骤（LangGraph 节点）完成 |
| EXECUTION_COMPLETED | 执行完成事件 | Agent 执行成功完成 |
| EXECUTION_FAILED | 执行失败事件 | Agent 执行失败 |
| EXECUTION_CANCELLED | 执行取消事件 | Agent 执行被取消 |
| TASK_CREATED | 任务创建事件 | 新任务创建后 |
| TASK_ASSIGNED | 任务分配事件 | 任务被分配给 Agent |
| TASK_STATUS_CHANGED | 任务状态变更事件 | 任务状态流转 |
| TASK_COMPLETED | 任务完成事件 | 任务执行完成 |
| TASK_FAILED | 任务失败事件 | 任务执行失败 |
| CONVERSATION_CREATED | 对话创建事件 | 新对话会话创建后 |
| CONVERSATION_ENDED | 对话结束事件 | 对话会话结束 |
| TOOL_REGISTERED | 工具注册事件 | 新工具注册后 |
| TOOL_INVOKED | 工具调用事件 | 工具被调用执行 |
| TOOL_UNREGISTERED | 工具注销事件 | 工具被删除后 |

### 5.2 Kafka Topic 定义

| Topic | 说明 | 分区策略 |
|---|---|---|
| `agent.agent.events` | Agent 生命周期事件 | 按 `agentId` 哈希分区 |
| `agent.execution.events` | Agent 执行生命周期事件 | 按 `executionId` 哈希分区 |
| `agent.task.events` | 任务生命周期事件 | 按 `taskId` 哈希分区 |
| `agent.conversation.events` | 对话生命周期事件 | 按 `conversationId` 哈希分区 |
| `agent.tool.events` | 工具生命周期事件 | 按 `toolId` 哈希分区 |
| `agent.dlq` | 死信队列 | 消费失败的事件 |

### 5.3 Kafka 消息结构

所有 Kafka 消息采用统一信封格式：

```json
{
  "eventId": "evt-20260716-000001",
  "eventType": "EXECUTION_COMPLETED",
  "eventTimestamp": "2026-07-16T16:30:15.600+08:00",
  "tenantId": "tenant-001",
  "aggregateType": "AGENT_EXECUTION",
  "aggregateId": "exec-20260716-000789",
  "traceId": "a1b2c3d4e5f6",
  "source": "TECH-AGENT",
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

#### 5.4.1 AGENT_CREATED

```json
{
  "agentId": "agt-9a8b7c6d2026",
  "agentKey": "purchase-assistant",
  "name": "采购助手",
  "status": "DRAFT",
  "reasoningMode": "REACT",
  "modelId": "doubao-pro-32k",
  "version": 1,
  "createdBy": "user-001",
  "createdAt": "2026-07-16T10:30:00.000+08:00"
}
```

#### 5.4.2 AGENT_STATE_CHANGED

```json
{
  "agentId": "agt-9a8b7c6d2026",
  "agentKey": "purchase-assistant",
  "previousStatus": "DISABLED",
  "newStatus": "ACTIVE",
  "reason": "模型配置恢复",
  "changedBy": "user-001",
  "changedAt": "2026-07-16T16:00:00.000+08:00"
}
```

#### 5.4.3 EXECUTION_STARTED

```json
{
  "executionId": "exec-20260716-000789",
  "agentId": "agt-9a8b7c6d2026",
  "agentKey": "purchase-assistant",
  "agentVersion": 2,
  "input": "帮我查询本月所有采购订单的状态...",
  "inputType": "TEXT",
  "context": {
    "conversationId": "conv-20260716-000123",
    "taskId": "task-20260716-000456",
    "userId": "user-001"
  },
  "modelUsed": "doubao-pro-128k",
  "reasoningMode": "REACT",
  "maxIterations": 15,
  "startedAt": "2026-07-16T16:30:00.000+08:00",
  "triggeredBy": "user-001"
}
```

#### 5.4.4 EXECUTION_COMPLETED

```json
{
  "executionId": "exec-20260716-000789",
  "agentId": "agt-9a8b7c6d2026",
  "agentKey": "purchase-assistant",
  "status": "COMPLETED",
  "output": {
    "content": "本月共有 23 笔采购订单，其中待审批 5 笔...",
    "structuredData": {
      "totalOrders": 23,
      "pendingApproval": 5
    }
  },
  "metrics": {
    "duration": 15600,
    "iterations": 4,
    "toolCalls": 2,
    "tokenUsage": {
      "promptTokens": 3200,
      "completionTokens": 450,
      "totalTokens": 3650
    },
    "modelUsed": "doubao-pro-128k"
  },
  "conversationId": "conv-20260716-000123",
  "taskId": "task-20260716-000456",
  "startedAt": "2026-07-16T16:30:00.000+08:00",
  "completedAt": "2026-07-16T16:30:15.600+08:00"
}
```

#### 5.4.5 EXECUTION_FAILED

```json
{
  "executionId": "exec-20260716-000790",
  "agentId": "agt-9a8b7c6d2026",
  "agentKey": "purchase-assistant",
  "status": "FAILED",
  "errorCode": 42202,
  "errorMessage": "LLM 调用失败：模型超载",
  "failedNode": "agent",
  "failedStep": 2,
  "partialResult": {
    "iterations": 1,
    "toolCalls": 0,
    "tokenUsage": {
      "promptTokens": 800,
      "completionTokens": 50,
      "totalTokens": 850
    }
  },
  "startedAt": "2026-07-16T16:35:00.000+08:00",
  "failedAt": "2026-07-16T16:35:02.000+08:00"
}
```

#### 5.4.6 EXECUTION_CANCELLED

```json
{
  "executionId": "exec-20260716-000789",
  "agentId": "agt-9a8b7c6d2026",
  "status": "CANCELLED",
  "cancelledBy": "user-001",
  "reason": "用户手动取消",
  "partialResult": {
    "iterations": 2,
    "toolCalls": 1,
    "tokenUsage": {
      "promptTokens": 1600,
      "completionTokens": 120,
      "totalTokens": 1720
    }
  },
  "cancelledAt": "2026-07-16T16:30:10.000+08:00"
}
```

#### 5.4.7 EXECUTION_STEP_COMPLETED

```json
{
  "executionId": "exec-20260716-000789",
  "stepId": "step-003",
  "stepNumber": 3,
  "node": "tool_executor",
  "nodeName": "工具执行",
  "status": "COMPLETED",
  "toolCallId": "tc-001",
  "toolId": "tool-purchase-query",
  "toolName": "采购订单查询",
  "duration": 2000,
  "completedAt": "2026-07-16T16:30:03.500+08:00"
}
```

#### 5.4.8 TASK_ASSIGNED

```json
{
  "taskId": "task-20260716-000456",
  "title": "季度采购分析报告",
  "agentId": "agt-9a8b7c6d2026",
  "agentKey": "purchase-assistant",
  "executionId": "exec-20260716-000789",
  "executionMode": "ASYNC",
  "assignedBy": "user-001",
  "assignedAt": "2026-07-16T10:05:00.000+08:00"
}
```

#### 5.4.9 TASK_COMPLETED

```json
{
  "taskId": "task-20260716-000456",
  "title": "季度采购分析报告",
  "agentId": "agt-9a8b7c6d2026",
  "status": "COMPLETED",
  "result": {
    "content": "# 2026年Q3采购分析报告...",
    "structuredData": {
      "summary": "Q3采购总额1250万元，环比增长15%",
      "trends": [],
      "supplierScores": []
    }
  },
  "metrics": {
    "totalDuration": 185000,
    "totalIterations": 12,
    "totalToolCalls": 8,
    "totalTokenUsage": {
      "promptTokens": 15600,
      "completionTokens": 3200,
      "totalTokens": 18800
    }
  },
  "completedAt": "2026-07-16T13:05:00.000+08:00"
}
```

#### 5.4.10 TOOL_INVOKED

```json
{
  "toolCallId": "tc-20260716-000123",
  "toolId": "tool-purchase-query",
  "toolKey": "purchase-order-query",
  "toolName": "采购订单查询",
  "toolType": "ACTION",
  "executionId": "exec-20260716-000789",
  "status": "SUCCESS",
  "duration": 1800,
  "retryCount": 0,
  "startedAt": "2026-07-16T16:30:01.500+08:00",
  "completedAt": "2026-07-16T16:30:03.300+08:00"
}
```

### 5.5 Outbox 模式实现

#### 5.5.1 写入流程

1. 业务事务中，将事件写入 `agent_outbox` 表（与业务数据在同一数据库事务中提交）
2. 独立的 Outbox Publisher 协程轮询 `agent_outbox` 表中 `status = 'PENDING'` 的记录
3. Publisher 将事件发送到 Kafka，发送成功后更新 `status = 'SENT'`
4. 发送失败时递增 `retry_count`，若超过 `max_retries` 则 `status = 'FAILED'`

```
[业务事务开始]
  -> 写入 agent_execution（执行数据）
  -> 写入 agent_execution_step（步骤数据）
  -> 写入 agent_outbox（事件记录，与业务数据同一事务）
[业务事务提交]

[Outbox Publisher 协程]
  -> 查询 agent_outbox WHERE status = 'PENDING' ORDER BY created_at
  -> 发送到 Kafka（topic = agent.execution.events）
  -> 更新 agent_outbox SET status = 'SENT', sent_at = NOW()
  -> 若失败：retry_count++，next_retry_at = NOW() + 退避间隔
  -> 若 retry_count > max_retries：status = 'FAILED'，写入 agent.dlq
```

#### 5.5.2 事务保证

- Outbox 表与业务表在同一 PostgreSQL 事务中写入，保证原子性
- Outbox Publisher 使用 `SELECT ... FOR UPDATE SKIP LOCKED` 避免多实例重复消费
- Kafka 发送成功后才更新 Outbox 状态，保证 at-least-once 语义
- 消费方需实现幂等处理（基于 `eventId` 去重）

#### 5.5.3 DLQ 处理

- 超过最大重试次数的事件进入 DLQ（`agent.dlq` topic）
- DLQ 消息保留 `traceId` 字段用于故障诊断
- DLQ 消息保留原始事件 payload，支持人工重放
- 运维告警：DLQ 有新消息时触发告警通知

### 5.6 事件消费方指南

| 消费方 | 订阅 Topic | 处理逻辑 |
|---|---|---|
| APP-DW | agent.execution.events, agent.task.events | 更新数字员工执行状态、任务进度展示 |
| APP-SUPERAI | agent.execution.events | 更新对话界面执行状态、流式结果展示 |
| APP-DASHBOARD | agent.execution.events, agent.task.events, agent.tool.events | 更新仪表盘统计、执行轨迹展示 |
| TECH-A2A | agent.execution.events, agent.task.events | 外部委托任务状态同步至 A2A 协议 |
| TECH-MSG | 所有 | 统一消息推送（站内信/邮件/IM 通知任务完成） |
| TECH-ONT | agent.task.events | 任务完成后更新本体业务对象状态 |

**消费方幂等处理（Python 示例）**

```python
# 伪代码示例
from tech_agent.messaging import KafkaConsumer

async def on_execution_event(event: dict):
    # 1. 基于 eventId 幂等检查
    if await idempotent_repo.exists(event["eventId"]):
        return  # 已处理，跳过
    # 2. 处理事件
    await process_event(event)
    # 3. 标记已处理
    await idempotent_repo.save(event["eventId"])
```

---

## 6. 增量交付计划

### 6.1 Sprint 1：Agent 定义与配置管理（M1）

**目标**：完成 Agent 定义的 CRUD、版本管理、能力配置基础能力。

| 交付项 | API | 说明 |
|---|---|---|
| 创建 Agent | POST /api/v1/agent/agents | 含角色定义、模型配置、推理范式 |
| 查询 Agent 列表 | GET /api/v1/agent/agents | 分页查询、条件筛选 |
| 获取 Agent 详情 | GET /api/v1/agent/agents/{id} | 含能力配置、知识范围 |
| 更新 Agent | PUT /api/v1/agent/agents/{id} | 乐观锁版本控制 |
| 删除 Agent | DELETE /api/v1/agent/agents/{id} | 归档/级联删除 |
| 启用/禁用 Agent | PUT /api/v1/agent/agents/{id}/state | - |
| 配置 Agent 能力 | PUT /api/v1/agent/agents/{id}/capabilities | Tools/Actions/RAG Scopes |
| 配置 Agent 模型 | PUT /api/v1/agent/agents/{id}/model | 动态切换模型 |
| 配置知识范围 | PUT /api/v1/agent/agents/{id}/knowledge-scope | RAG 检索范围 |
| 版本历史 | GET /api/v1/agent/agents/{id}/versions | 版本变更追溯 |
| 版本回滚 | POST /api/v1/agent/agents/{id}/rollback | - |
| 数据表 | 全部 DDL | agent_definition 等核心表 |
| TECH-LLMGW 集成 | 模型可用性校验 | 创建/更新时校验 modelId |

**验收标准**：能创建 Agent、配置角色与模型、分配工具和知识范围、管理版本，通过 TECH-LLMGW 校验模型可用性。

---

### 6.2 Sprint 2：Agent 运行时与执行（M2）

**目标**：完成基于 LangGraph 的 Agent 执行引擎，支持同步与 SSE 流式执行。

| 交付项 | API | 说明 |
|---|---|---|
| 同步执行任务 | POST /api/v1/agent/agents/{id}/execute | 等待执行完成返回结果 |
| 流式执行任务 | POST /api/v1/agent/agents/{id}/execute/stream | SSE 流式推送思考链与结果 |
| 查询执行状态 | GET /api/v1/agent/executions/{id} | 实时状态查询 |
| 取消执行 | POST /api/v1/agent/executions/{id}/cancel | 优雅取消 + 部分结果 |
| 获取执行结果 | GET /api/v1/agent/executions/{id}/result | - |
| 恢复执行 | POST /api/v1/agent/executions/{id}/resume | 基于 Checkpoint 恢复 |
| LangGraph 集成 | 执行图构建 | planner -> agent -> tool_executor -> evaluator |
| Checkpoint 机制 | 状态持久化 | PostgreSQL + Redis 双写 |
| 短期记忆 | 对话上下文管理 | Redis 短期记忆窗口 |
| TECH-RAG 集成 | 知识检索 | Agent 执行中调用 RAG 检索 |
| TECH-ACTION 集成 | Action 调用 | Agent 执行中调用 Action Engine |
| 事件发布 | Kafka EXECUTION_* | Outbox 模式 |

**验收标准**：Agent 能基于 ReAct 范式执行任务，支持同步和流式两种模式，能调用 Tools/Actions/RAG，执行过程可追踪、可取消、可恢复。

---

### 6.3 Sprint 3：任务与对话管理（M3）

**目标**：完成任务管理和多轮对话管理的完整能力。

| 交付项 | API | 说明 |
|---|---|---|
| 创建任务 | POST /api/v1/agent/tasks | 含子任务支持 |
| 分配任务 | POST /api/v1/agent/tasks/{id}/assign | 分配给 Agent 执行 |
| 任务列表 | GET /api/v1/agent/tasks | 多维度筛选 |
| 任务详情 | GET /api/v1/agent/tasks/{id} | 含子任务与执行信息 |
| 任务结果 | GET /api/v1/agent/tasks/{id}/result | - |
| 更新任务状态 | PUT /api/v1/agent/tasks/{id}/status | 人工介入 |
| 任务执行统计 | GET /api/v1/agent/tasks/{id}/statistics | - |
| 创建对话 | POST /api/v1/agent/conversations | 关联 Agent |
| 发送消息（同步） | POST /api/v1/agent/conversations/{id}/messages | - |
| 发送消息（流式） | POST /api/v1/agent/conversations/{id}/messages/stream | SSE 流式响应 |
| 获取对话历史 | GET /api/v1/agent/conversations/{id}/messages | 增量加载 |
| 获取对话列表 | GET /api/v1/agent/conversations | - |
| 获取对话详情 | GET /api/v1/agent/conversations/{id} | 含记忆摘要 |
| 结束对话 | POST /api/v1/agent/conversations/{id}/end | 保存长期记忆 |
| 长期记忆 | 记忆管理 | SUMMARY 策略、跨会话记忆 |
| 事件发布 | Kafka TASK_* / CONVERSATION_* | Outbox 模式 |

**验收标准**：完整的任务创建-分配-执行-结果链路，多轮对话支持流式响应，长期记忆能跨会话保留，任务可拆解为子任务执行。

---

### 6.4 Sprint 4：工具管理与执行轨迹（M4）

**目标**：完成工具注册管理和执行轨迹查询评估能力。

| 交付项 | API | 说明 |
|---|---|---|
| 注册 Tool | POST /api/v1/agent/tools | MCP/ACTION/BUILTIN/CUSTOM |
| 查询 Tools | GET /api/v1/agent/tools | 分页查询、按 Agent 筛选 |
| 获取 Tool 详情 | GET /api/v1/agent/tools/{id} | 含调用统计 |
| 调用 Tool | POST /api/v1/agent/tools/{id}/invoke | 直接调用（测试用） |
| 更新 Tool | PUT /api/v1/agent/tools/{id} | - |
| 启用/禁用 Tool | PUT /api/v1/agent/tools/{id}/state | - |
| 删除 Tool | DELETE /api/v1/agent/tools/{id} | - |
| 获取执行步骤 | GET /api/v1/agent/executions/{id}/steps | 完整执行路径 |
| 获取思考链 | GET /api/v1/agent/executions/{id}/thought-chain | CoT 记录 |
| 获取工具调用记录 | GET /api/v1/agent/executions/{id}/tool-calls | - |
| 提交评估 | POST /api/v1/agent/executions/{id}/evaluations | 人工评估 |
| 获取评估记录 | GET /api/v1/agent/executions/{id}/evaluations | - |
| Agent 执行统计 | GET /api/v1/agent/agents/{id}/statistics | 仪表盘数据 |
| 事件发布 | Kafka TOOL_* | Outbox 模式 |

**验收标准**：完整工具注册管理，支持四种 Tool 类型注册与调用，执行轨迹可查询（步骤/思考链/工具调用），支持人工评估打分。

---

### 6.5 Sprint 5：A2A 适配与增强优化（M5）

**目标**：完成 A2A 协议适配，支持跨系统 Agent 协作，进行性能优化。

| 交付项 | API / 说明 | 说明 |
|---|---|---|
| Agent Card | GET /api/v1/agent/agents/{id}/card | A2A 协议 Agent 能力声明 |
| A2A 任务接收 | 内部接口 | 接收 TECH-A2A 委托的外部 Agent 任务 |
| A2A 任务委托 | 内部接口 | 向外部 Agent 委托任务 |
| MCP Tool 集成 | POST /api/v1/agent/tools | 支持 MCP 协议工具注册与调用 |
| Plan-and-Solve | 推理范式增强 | 支持 PLAN_AND_SOLVE 模式 |
| Function Calling | 推理范式增强 | 支持 FUNCTION_CALLING 模式 |
| 长期记忆增强 | ENTITY/VECTOR 策略 | 实体记忆、向量记忆 |
| 配置缓存 | Redis | Agent 配置缓存，减少 DB 查询 |
| 执行并发优化 | asyncio | 并行工具调用、流式 LLM 响应 |
| 速率限制 | Redis 滑动窗口 | 租户/Agent 级别限流 |
| 租户隔离 | 完善多租户 | 数据隔离验证 |
| 性能压测 | 全链路压测 | 目标 500 并发执行 |

**验收标准**：通过 A2A 协议实现跨系统 Agent 发现与协作，支持 MCP 工具集成，Plan-and-Solve 推理范式可用，通过全链路性能压测，多租户隔离正确。

---

## 附录 A：枚举值速查表

| 枚举 | 值 | 说明 |
|---|---|---|
| AgentStatus | DRAFT / ACTIVE / DISABLED / ARCHIVED | Agent 状态 |
| ExecutionStatus | QUEUED / EXECUTING / COMPLETED / FAILED / CANCELLED / INTERRUPTED | 执行实例状态 |
| TaskStatus | PENDING / ASSIGNED / EXECUTING / COMPLETED / FAILED / CANCELLED / ON_HOLD | 任务状态 |
| TaskType | ONESHOT / MULTI_STEP / COLLABORATIVE | 任务类型 |
| TaskPriority | LOW / MEDIUM / HIGH / URGENT | 任务优先级 |
| ConversationStatus | ACTIVE / ENDED / ARCHIVED | 对话会话状态 |
| MessageRole | USER / ASSISTANT / SYSTEM / TOOL | 消息角色 |
| ToolType | MCP / ACTION / BUILTIN / CUSTOM | 工具类型 |
| ToolStatus | ACTIVE / DISABLED | 工具状态 |
| ReasoningMode | REACT / PLAN_AND_SOLVE / FUNCTION_CALLING | 推理范式 |
| MemoryType | SUMMARY / ENTITY / EPISODE | 长期记忆类型 |
| MemoryStrategy | SUMMARY / ENTITY / VECTOR | 长期记忆策略 |
| StepNode | planner / agent / tool_executor / evaluator | LangGraph 节点 |
| StepStatus | RUNNING / COMPLETED / FAILED / SKIPPED | 步骤状态 |
| ToolCallStatus | RUNNING / SUCCESS / FAILED / TIMEOUT | 工具调用状态 |
| ContentType | TEXT / JSON / FILE_REF | 内容类型 |
| InputType | TEXT / JSON / FILE_REF | 输入类型 |
| CapabilityType | TOOL / ACTION / RAG_SCOPE | 能力类型 |
| ExecutionMode | SYNC / ASYNC | 执行模式 |

---

## 附录 B：SSE 事件速查表

| 事件类型 | 触发时机 | 关键 data 字段 |
|---|---|---|
| execution.started | Agent 执行开始 | executionId, agentId, startedAt |
| agent.thinking | Agent 完成一次思考 | executionId, step, thought |
| agent.action | Agent 做出决策 | executionId, step, action, toolName |
| tool.calling | 工具开始调用 | executionId, toolCallId, toolName, input |
| tool.result | 工具返回结果 | executionId, toolCallId, status, output, duration |
| content.delta | 生成内容增量 | executionId, delta |
| content.done | 生成内容完成 | executionId, content, messageId |
| execution.step | 执行步骤完成 | executionId, step, node, status |
| execution.completed | 执行完成 | executionId, status, metrics |
| execution.failed | 执行失败 | executionId, status, error |
| error | 流式错误 | code, message |

---

## 附录 C：API 路径速查表

| 序号 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 3.1.1 | POST | /api/v1/agent/agents | 创建 Agent |
| 3.1.2 | GET | /api/v1/agent/agents | 查询 Agent 列表 |
| 3.1.3 | GET | /api/v1/agent/agents/{agentId} | 获取 Agent 详情 |
| 3.1.4 | PUT | /api/v1/agent/agents/{agentId} | 更新 Agent |
| 3.1.5 | DELETE | /api/v1/agent/agents/{agentId} | 删除 Agent |
| 3.1.6 | PUT | /api/v1/agent/agents/{agentId}/state | 启用/禁用 Agent |
| 3.1.7 | PUT | /api/v1/agent/agents/{agentId}/capabilities | 配置 Agent 能力 |
| 3.1.8 | PUT | /api/v1/agent/agents/{agentId}/model | 配置 Agent 模型 |
| 3.1.9 | PUT | /api/v1/agent/agents/{agentId}/knowledge-scope | 配置知识范围 |
| 3.1.10 | GET | /api/v1/agent/agents/{agentId}/versions | 获取版本历史 |
| 3.1.11 | POST | /api/v1/agent/agents/{agentId}/rollback | 回滚 Agent 版本 |
| 3.1.12 | GET | /api/v1/agent/agents/{agentId}/card | 获取 Agent Card |
| 3.2.1 | POST | /api/v1/agent/agents/{agentId}/execute | 执行任务（同步） |
| 3.2.2 | POST | /api/v1/agent/agents/{agentId}/execute/stream | 执行任务（SSE） |
| 3.2.3 | GET | /api/v1/agent/executions/{executionId} | 查询执行状态 |
| 3.2.4 | POST | /api/v1/agent/executions/{executionId}/cancel | 取消执行 |
| 3.2.5 | GET | /api/v1/agent/executions/{executionId}/result | 获取执行结果 |
| 3.2.6 | POST | /api/v1/agent/executions/{executionId}/resume | 恢复执行 |
| 3.3.1 | POST | /api/v1/agent/tasks | 创建任务 |
| 3.3.2 | POST | /api/v1/agent/tasks/{taskId}/assign | 分配任务 |
| 3.3.3 | GET | /api/v1/agent/tasks | 查询任务列表 |
| 3.3.4 | GET | /api/v1/agent/tasks/{taskId} | 获取任务详情 |
| 3.3.5 | GET | /api/v1/agent/tasks/{taskId}/result | 获取任务结果 |
| 3.3.6 | PUT | /api/v1/agent/tasks/{taskId}/status | 更新任务状态 |
| 3.3.7 | GET | /api/v1/agent/tasks/{taskId}/statistics | 获取任务统计 |
| 3.4.1 | POST | /api/v1/agent/conversations | 创建对话 |
| 3.4.2 | POST | /api/v1/agent/conversations/{conversationId}/messages | 发送消息（同步） |
| 3.4.3 | POST | /api/v1/agent/conversations/{conversationId}/messages/stream | 发送消息（SSE） |
| 3.4.4 | GET | /api/v1/agent/conversations/{conversationId}/messages | 获取对话历史 |
| 3.4.5 | GET | /api/v1/agent/conversations | 获取对话列表 |
| 3.4.6 | GET | /api/v1/agent/conversations/{conversationId} | 获取对话详情 |
| 3.4.7 | POST | /api/v1/agent/conversations/{conversationId}/end | 结束对话 |
| 3.5.1 | POST | /api/v1/agent/tools | 注册 Tool |
| 3.5.2 | GET | /api/v1/agent/tools | 查询可用 Tools |
| 3.5.3 | GET | /api/v1/agent/tools/{toolId} | 获取 Tool 详情 |
| 3.5.4 | POST | /api/v1/agent/tools/{toolId}/invoke | 调用 Tool |
| 3.5.5 | PUT | /api/v1/agent/tools/{toolId} | 更新 Tool |
| 3.5.6 | PUT | /api/v1/agent/tools/{toolId}/state | 启用/禁用 Tool |
| 3.5.7 | DELETE | /api/v1/agent/tools/{toolId} | 删除 Tool |
| 3.6.1 | GET | /api/v1/agent/executions/{executionId}/steps | 获取执行步骤 |
| 3.6.2 | GET | /api/v1/agent/executions/{executionId}/thought-chain | 获取思考链 |
| 3.6.3 | GET | /api/v1/agent/executions/{executionId}/tool-calls | 获取工具调用记录 |
| 3.6.4 | POST | /api/v1/agent/executions/{executionId}/evaluations | 提交评估 |
| 3.6.5 | GET | /api/v1/agent/executions/{executionId}/evaluations | 获取评估记录 |
| 3.6.6 | GET | /api/v1/agent/agents/{agentId}/statistics | 获取 Agent 统计 |