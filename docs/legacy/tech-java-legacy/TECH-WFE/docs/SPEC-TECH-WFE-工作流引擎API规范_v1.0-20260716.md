# SPEC - 工作流引擎服务 API 规范（TECH-WFE）

> 文档版本：v1.0
> 文档日期：2026-07-16
> 适用模块：TECH-WFE（Workflow Engine Service）
> 状态：定稿

---

## 1. 服务概述

### 1.1 定位

TECH-WFE 是 Mate Platform 的工作流引擎服务，提供基于 BPMN 2.0 规范的流程定义、执行、监控全生命周期管理能力。作为平台审批流与业务编排的核心运行时，TECH-WFE 与 TECH-ONT 本体引擎深度集成，将本体定义的业务对象（G2）作为流程数据载体，并通过 TECH-RULE 规则引擎实现流程路由的动态决策。

### 1.2 技术栈

| 层次 | 技术选型 | 说明 |
|---|---|---|
| 语言/框架 | Java 21 + Spring Boot 3.4 | 基础运行时 |
| 流程引擎内核 | FlowEngine（自研轻量内核） | 基于 BPMN 2.0 语义，支持 fixed-layout 审批流 |
| 持久化 | PostgreSQL 17 | 流程定义、实例、任务、历史持久化 |
| 缓存 | Redis 7.4 | 流程定义缓存、任务分配缓存、分布式锁 |
| 消息队列 | Kafka 3.9 | 流程事件发布（Outbox 模式） |
| 可观测性 | OpenTelemetry 1.45 | trace_id 全链路传播 |
| 前端对接 | FlowGram.AI | fixed-layout 审批流设计器 |

### 1.3 上游依赖

| 上游服务 | 依赖关系 | 说明 |
|---|---|---|
| TECH-ONT | 强依赖 | 流程变量绑定本体业务对象；流程发起前校验业务对象存在性与权限 |
| TECH-RULE | 强依赖 | 网关排他路由条件通过规则引擎求值；动态审批人通过规则引擎决策 |
| TECH-IAM | 强依赖 | 用户/角色/组织架构信息，用于审批人解析与权限校验 |
| TECH-MSG | 弱依赖 | Kafka 消息基础设施 |

### 1.4 下游消费

| 下游服务/应用 | 消费方式 | 说明 |
|---|---|---|
| APP-APPHUB | REST API | 低代码应用平台调用 WFE 部署流程定义、发起流程、查询任务 |
| APP-DASHBOARD | REST API | 仪表盘展示流程运行统计、SLA 预警 |
| APP-DW | REST API | 数字员工代理人工审批任务 |
| TECH-ACTION | REST API | Action Engine 在自动化流程中触发流程实例 |
| TECH-A2A | REST API | A2A 协议适配将外部委托任务转为内部工作流执行 |

### 1.5 核心能力清单

| 能力域 | 说明 |
|---|---|
| 流程定义管理 | 流程定义的部署、版本管理、查询、挂起/激活、删除 |
| 流程实例管理 | 发起流程、查询实例、终止实例、挂起/恢复 |
| 任务管理 | 用户任务查询、审批（同意/拒绝/转交/退回/加签）、委派、催办 |
| 流程历史 | 历史实例查询、历史任务查询、历史活动查询 |
| 流程监控 | 运行中实例统计、SLA 预警、瓶颈分析 |
| 事件订阅 | 流程事件回调（流程启动/完成/任务创建/任务完成） |

---

## 2. 通用约定

### 2.1 路径前缀

所有 TECH-WFE API 路径统一前缀：`/api/v1/wfe`

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

### 2.4 请求头约定

| 请求头 | 必填 | 说明 |
|---|---|---|
| Authorization | 是 | Bearer Token |
| X-Trace-Id | 否 | 链路追踪 ID，未传则服务端自动生成 |
| X-Tenant-Id | 是 | 租户 ID |
| X-Request-Id | 否 | 请求唯一标识，用于幂等控制 |
| Content-Type | 是 | `application/json;charset=UTF-8` |

### 2.5 错误码

| 错误码 | HTTP Status | 含义 | 典型场景 |
|---|---|---|---|
| 0 | 200 | 成功 | 正常请求 |
| 40001 | 400 | 参数校验失败 | 必填字段缺失、格式错误 |
| 40002 | 400 | 参数值非法 | 枚举值不匹配、数值越界 |
| 40101 | 401 | 未认证 | Token 缺失或过期 |
| 40301 | 403 | 无权限 | 用户无权操作该资源 |
| 40401 | 404 | 资源不存在 | 流程定义/实例/任务不存在 |
| 40901 | 409 | 状态冲突 | 操作与当前资源状态不兼容（如已完成任务再次审批） |
| 40902 | 409 | 版本冲突 | 并发更新导致乐观锁冲突 |
| 42201 | 422 | 业务规则校验失败 | 流程定义 XML 解析失败、审批人无法解析 |
| 42901 | 429 | 请求过于频繁 | 触发限流 |
| 50001 | 500 | 服务内部错误 | 未捕获异常 |
| 50002 | 500 | 依赖服务不可用 | TECH-ONT/TECH-RULE/TECH-IAM 不可达 |
| 50003 | 500 | 流程执行异常 | 引擎内部状态机错误 |

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
- traceId 写入 MDC（SLF4J MDC），贯穿所有日志输出
- traceId 传播至下游服务调用（REST 调用透传 `X-Trace-Id` 头）
- traceId 写入 Kafka 消息头 `X-Trace-Id`

### 2.8 幂等控制

- 写操作支持幂等：客户端传递 `X-Request-Id` 请求头
- 服务端基于 `(tenantId, requestType, requestId)` 做幂等去重
- 幂等窗口：24 小时
- 同一 `X-Request-Id` 重复请求返回首次结果

---

## 3. API 接口详情

### 3.1 流程定义管理 API

#### 3.1.1 部署流程定义

部署新的流程定义或更新已有流程定义。支持 BPMN 2.0 XML 格式。

```
POST /api/v1/wfe/definitions
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| definitionKey | string | 是 | 流程定义唯一标识（业务 key） |
| name | string | 是 | 流程定义名称 |
| category | string | 否 | 流程分类（如：审批流、业务流） |
| bpmnXml | string | 是 | BPMN 2.0 XML 内容 |
| description | string | 否 | 流程定义描述 |
| version | string | 否 | 自定义版本号，不传则自动递增 |
| ontologyBindings | array | 否 | 本体绑定配置 |
| ontologyBindings[].conceptCode | string | 否 | 绑定的本体概念编码 |
| ontologyBindings[].variableMapping | object | 否 | 本体属性与流程变量映射 |

**请求示例**

```json
{
  "definitionKey": "PURCHASE_APPROVAL_V1",
  "name": "采购审批流程",
  "category": "APPROVAL",
  "bpmnXml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<bpmn:definitions ...>...</bpmn:definitions>",
  "description": "标准采购申请审批流程，支持多级审批与金额路由",
  "ontologyBindings": [
    {
      "conceptCode": "PurchaseRequest",
      "variableMapping": {
        "amount": "${requestAmount}",
        "department": "${requestDept}"
      }
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
    "definitionId": "def-9a8b7c6d-2026",
    "definitionKey": "PURCHASE_APPROVAL_V1",
    "name": "采购审批流程",
    "category": "APPROVAL",
    "version": 3,
    "status": "ACTIVE",
    "deployedAt": "2026-07-16T10:30:00.000+08:00",
    "deployedBy": "user-001"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | bpmnXml 为空或格式不合法 |
| 42201 | BPMN XML 解析失败：缺少开始事件、网关条件缺失 |
| 40901 | definitionKey 已存在且不允许覆盖（状态为 LOCKED） |
| 50002 | 本体绑定校验失败：conceptCode 在 TECH-ONT 中不存在 |

---

#### 3.1.2 查询流程定义列表

分页查询当前租户下的流程定义列表，支持多条件筛选。

```
GET /api/v1/wfe/definitions
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| definitionKey | string | 否 | 流程定义 key，支持模糊匹配 |
| name | string | 否 | 流程名称，支持模糊匹配 |
| category | string | 否 | 流程分类 |
| status | string | 否 | 状态：`ACTIVE` / `SUSPENDED` / `DEPRECATED` |
| deployedAfter | string | 否 | 部署时间下界，ISO-8601 |
| deployedBefore | string | 否 | 部署时间上界，ISO-8601 |
| latestOnly | boolean | 否 | 是否只返回每个 key 的最新版本，默认 true |
| page | int | 否 | 页码，默认 1 |
| size | int | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序字段，默认 `-deployedAt` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "definitionId": "def-9a8b7c6d-2026",
        "definitionKey": "PURCHASE_APPROVAL_V1",
        "name": "采购审批流程",
        "category": "APPROVAL",
        "version": 3,
        "status": "ACTIVE",
        "deployedAt": "2026-07-16T10:30:00.000+08:00",
        "deployedBy": "user-001",
        "instanceCount": 42,
        "suspended": false
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
| 40301 | 用户无权查看该租户的流程定义 |

---

#### 3.1.3 获取流程定义详情

根据流程定义 ID 获取详细信息。

```
GET /api/v1/wfe/definitions/{definitionId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| definitionId | string | 流程定义 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "definitionId": "def-9a8b7c6d-2026",
    "definitionKey": "PURCHASE_APPROVAL_V1",
    "name": "采购审批流程",
    "category": "APPROVAL",
    "version": 3,
    "status": "ACTIVE",
    "description": "标准采购申请审批流程",
    "deployedAt": "2026-07-16T10:30:00.000+08:00",
    "deployedBy": "user-001",
    "suspended": false,
    "ontologyBindings": [
      {
        "conceptCode": "PurchaseRequest",
        "variableMapping": {
          "amount": "${requestAmount}",
          "department": "${requestDept}"
        }
      }
    ],
    "startFormKey": "purchase-request-form",
    "userTaskCount": 4,
    "serviceTaskCount": 2,
    "gatewayCount": 3,
    "instanceCount": 42,
    "activeInstanceCount": 5
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 流程定义不存在 |
| 40301 | 用户无权查看该流程定义 |

---

#### 3.1.4 获取流程定义 XML/JSON 内容

获取流程定义的原始 BPMN XML 或解析后的 JSON 结构。

```
GET /api/v1/wfe/definitions/{definitionId}/content
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| definitionId | string | 流程定义 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| format | string | 否 | 返回格式：`xml`（默认）/ `json` |

**响应示例（format=xml）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "definitionId": "def-9a8b7c6d-2026",
    "definitionKey": "PURCHASE_APPROVAL_V1",
    "version": 3,
    "format": "xml",
    "bpmnXml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<bpmn:definitions ...>...</bpmn:definitions>"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**响应示例（format=json）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "definitionId": "def-9a8b7c6d-2026",
    "definitionKey": "PURCHASE_APPROVAL_V1",
    "version": 3,
    "format": "json",
    "process": {
      "id": "PurchaseApprovalProcess",
      "name": "采购审批流程",
      "isExecutable": true,
      "startEvents": [
        { "id": "startEvent_1", "name": "发起采购申请" }
      ],
      "userTasks": [
        {
          "id": "task_manager_approval",
          "name": "部门经理审批",
          "assignee": "${managerId}",
          "formKey": "manager-approval-form",
          "dueDate": "${PT48H}"
        },
        {
          "id": "task_vp_approval",
          "name": "VP审批",
          "assignee": "${vpId}",
          "formKey": "vp-approval-form",
          "dueDate": "${PT72H}"
        }
      ],
      "exclusiveGateways": [
        {
          "id": "gw_amount_route",
          "name": "金额路由",
          "conditions": [
            { "condition": "${amount > 100000}", "targetRef": "task_vp_approval" },
            { "condition": "${amount <= 100000}", "targetRef": "task_auto_approve" }
          ]
        }
      ],
      "endEvents": [
        { "id": "endEvent_approved", "name": "审批通过" },
        { "id": "endEvent_rejected", "name": "审批驳回" }
      ],
      "sequenceFlows": [
        { "id": "flow_1", "sourceRef": "startEvent_1", "targetRef": "task_manager_approval" },
        { "id": "flow_2", "sourceRef": "task_manager_approval", "targetRef": "gw_amount_route" }
      ]
    }
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 流程定义不存在 |
| 40002 | format 参数值不合法 |

---

#### 3.1.5 挂起/激活流程定义

挂起流程定义后，该定义不允许发起新实例（已运行实例不受影响）；激活后恢复。

```
PUT /api/v1/wfe/definitions/{definitionId}/state
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| definitionId | string | 流程定义 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| action | string | 是 | `SUSPEND`（挂起）或 `ACTIVATE`（激活） |
| cascade | boolean | 否 | 是否级联挂起/激活所有运行中实例，默认 false |

**请求示例**

```json
{
  "action": "SUSPENDED",
  "cascade": false
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "definitionId": "def-9a8b7c6d-2026",
    "status": "SUSPENDED",
    "cascadedInstances": 0
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 流程定义不存在 |
| 40901 | 当前状态不允许执行该操作（如已挂起再次挂起） |
| 40301 | 用户无权修改流程定义状态 |

---

#### 3.1.6 删除流程定义

删除指定版本的流程定义。仅当无运行中实例时允许删除。

```
DELETE /api/v1/wfe/definitions/{definitionId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| definitionId | string | 流程定义 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| cascade | boolean | 否 | 是否级联删除历史实例，默认 false |
| reason | string | 否 | 删除原因 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "definitionId": "def-9a8b7c6d-2026",
    "deleted": true,
    "deletedHistoryCount": 0
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 流程定义不存在 |
| 40901 | 存在运行中实例且 cascade=false |
| 40301 | 用户无权删除流程定义 |

---

### 3.2 流程实例管理 API

#### 3.2.1 发起流程

根据流程定义发起一个新的流程实例。发起前会通过 TECH-ONT 校验绑定的业务对象。

```
POST /api/v1/wfe/instances
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| definitionKey | string | 是 | 流程定义 key |
| version | int | 否 | 流程定义版本，不传则使用最新版本 |
| businessKey | string | 否 | 业务标识（如采购单号） |
| title | string | 是 | 流程实例标题 |
| variables | object | 否 | 流程变量初始值 |
| ontologyRef | object | 否 | 关联的本体业务对象引用 |
| ontologyRef.conceptCode | string | 否 | 本体概念编码 |
| ontologyRef.objectId | string | 否 | 本体对象 ID |
| startUserId | string | 否 | 发起人 ID，默认取当前登录用户 |
| priority | int | 否 | 优先级：1（低）/2（中）/3（高），默认 2 |
| dueDate | string | 否 | 期望完成时间，ISO-8601 |

**请求示例**

```json
{
  "definitionKey": "PURCHASE_APPROVAL_V1",
  "businessKey": "PO-2026-0716-001",
  "title": "研发部服务器采购申请 - 50万元",
  "variables": {
    "requestAmount": 500000,
    "requestDept": "RD",
    "requestDeptName": "研发部",
    "itemCategory": "SERVER",
    "itemDescription": "GPU 服务器 10 台"
  },
  "ontologyRef": {
    "conceptCode": "PurchaseRequest",
    "objectId": "po-2026-0716-001"
  },
  "priority": 3,
  "dueDate": "2026-07-23T18:00:00.000+08:00"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "instanceId": "inst-20260716-000123",
    "definitionKey": "PURCHASE_APPROVAL_V1",
    "definitionVersion": 3,
    "businessKey": "PO-2026-0716-001",
    "title": "研发部服务器采购申请 - 50万元",
    "status": "RUNNING",
    "startUserId": "user-001",
    "startUserName": "张三",
    "startedAt": "2026-07-16T10:35:00.000+08:00",
    "currentActivities": [
      {
        "activityId": "task_manager_approval",
        "activityName": "部门经理审批",
        "activityType": "USER_TASK",
        "assignees": ["user-002"],
        "candidateGroups": []
      }
    ],
    "variables": {
      "requestAmount": 500000,
      "requestDept": "RD"
    }
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 流程定义不存在 |
| 40901 | 流程定义已挂起，不允许发起新实例 |
| 42201 | 流程变量缺少必填项 |
| 50002 | 本体业务对象校验失败：conceptCode 不存在或 objectId 无效 |
| 50003 | 流程启动异常：开始事件无匹配的序列流 |

---

#### 3.2.2 查询流程实例列表

分页查询流程实例，支持多维度筛选。

```
GET /api/v1/wfe/instances
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| definitionKey | string | 否 | 流程定义 key |
| businessKey | string | 否 | 业务标识 |
| status | string | 否 | 实例状态：`RUNNING` / `COMPLETED` / `TERMINATED` / `SUSPENDED` |
| startedBy | string | 否 | 发起人 ID |
| startedAfter | string | 否 | 发起时间下界 |
| startedBefore | string | 否 | 发起时间上界 |
| completedAfter | string | 否 | 完成时间下界 |
| completedBefore | string | 否 | 完成时间上界 |
| ontologyConceptCode | string | 否 | 关联本体概念编码 |
| ontologyObjectId | string | 否 | 关联本体对象 ID |
| involvedUser | string | 否 | 参与人 ID（发起人或曾参与审批） |
| priority | int | 否 | 优先级 |
| page | int | 否 | 页码 |
| size | int | 否 | 每页条数 |
| sort | string | 否 | 排序字段 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "instanceId": "inst-20260716-000123",
        "definitionKey": "PURCHASE_APPROVAL_V1",
        "definitionName": "采购审批流程",
        "definitionVersion": 3,
        "businessKey": "PO-2026-0716-001",
        "title": "研发部服务器采购申请 - 50万元",
        "status": "RUNNING",
        "startUserId": "user-001",
        "startUserName": "张三",
        "startedAt": "2026-07-16T10:35:00.000+08:00",
        "completedAt": null,
        "currentActivityName": "部门经理审批",
        "currentAssignees": ["user-002"],
        "priority": 3,
        "dueDate": "2026-07-23T18:00:00.000+08:00",
        "ontologyRef": {
          "conceptCode": "PurchaseRequest",
          "objectId": "po-2026-0716-001"
        }
      }
    ],
    "total": 156,
    "page": 1,
    "size": 20,
    "totalPages": 8
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | 分页参数不合法 |
| 40301 | 用户无权查询该范围数据 |

---

#### 3.2.3 获取流程实例详情

获取流程实例的完整信息，包括当前活动节点、流程变量、执行路径。

```
GET /api/v1/wfe/instances/{instanceId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| instanceId | string | 流程实例 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| includeVariables | boolean | 否 | 是否包含流程变量，默认 true |
| includeActivityPath | boolean | 否 | 是否包含已执行活动路径，默认 true |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "instanceId": "inst-20260716-000123",
    "definitionKey": "PURCHASE_APPROVAL_V1",
    "definitionId": "def-9a8b7c6d-2026",
    "definitionName": "采购审批流程",
    "definitionVersion": 3,
    "businessKey": "PO-2026-0716-001",
    "title": "研发部服务器采购申请 - 50万元",
    "status": "RUNNING",
    "suspended": false,
    "startUserId": "user-001",
    "startUserName": "张三",
    "startedAt": "2026-07-16T10:35:00.000+08:00",
    "completedAt": null,
    "terminatedAt": null,
    "terminatedBy": null,
    "terminateReason": null,
    "priority": 3,
    "dueDate": "2026-07-23T18:00:00.000+08:00",
    "ontologyRef": {
      "conceptCode": "PurchaseRequest",
      "objectId": "po-2026-0716-001"
    },
    "variables": {
      "requestAmount": 500000,
      "requestDept": "RD",
      "requestDeptName": "研发部",
      "managerApproved": true,
      "managerComment": "同意，预算充足"
    },
    "currentActivities": [
      {
        "activityId": "task_vp_approval",
        "activityName": "VP审批",
        "activityType": "USER_TASK",
        "assignees": ["user-003"],
        "candidateGroups": [],
        "taskId": "task-20260716-000456",
        "createdAt": "2026-07-16T11:00:00.000+08:00",
        "dueDate": "2026-07-18T11:00:00.000+08:00"
      }
    ],
    "activityPath": [
      {
        "activityId": "startEvent_1",
        "activityName": "发起采购申请",
        "activityType": "START_EVENT",
        "startedAt": "2026-07-16T10:35:00.000+08:00",
        "endedAt": "2026-07-16T10:35:00.000+08:00",
        "duration": 0
      },
      {
        "activityId": "task_manager_approval",
        "activityName": "部门经理审批",
        "activityType": "USER_TASK",
        "assignee": "user-002",
        "startedAt": "2026-07-16T10:35:00.000+08:00",
        "endedAt": "2026-07-16T11:00:00.000+08:00",
        "duration": 1500000,
        "outcome": "APPROVED",
        "comment": "同意，预算充足"
      },
      {
        "activityId": "gw_amount_route",
        "activityName": "金额路由",
        "activityType": "EXCLUSIVE_GATEWAY",
        "startedAt": "2026-07-16T11:00:00.000+08:00",
        "endedAt": "2026-07-16T11:00:00.000+08:00",
        "duration": 5,
        "selectedFlow": "amount > 100000"
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 流程实例不存在 |
| 40301 | 用户无权查看该实例 |

---

#### 3.2.4 终止流程实例

强制终止运行中的流程实例。终止后不可恢复。

```
DELETE /api/v1/wfe/instances/{instanceId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| instanceId | string | 流程实例 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reason | string | 是 | 终止原因 |
| terminateActiveTasks | boolean | 否 | 是否终止所有活动任务，默认 true |

**请求示例**

```json
{
  "reason": "采购需求变更，取消本次申请",
  "terminateActiveTasks": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "instanceId": "inst-20260716-000123",
    "status": "TERMINATED",
    "terminatedAt": "2026-07-16T14:00:00.000+08:00",
    "terminatedBy": "user-001",
    "terminatedTasks": ["task-20260716-000456"]
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 流程实例不存在 |
| 40901 | 实例已结束（COMPLETED/TERMINATED），不可终止 |
| 40301 | 用户无权终止该实例 |

---

#### 3.2.5 挂起/恢复流程实例

挂起后所有活动任务暂停（不可审批）；恢复后继续。

```
PUT /api/v1/wfe/instances/{instanceId}/state
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| instanceId | string | 流程实例 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| action | string | 是 | `SUSPEND`（挂起）或 `RESUME`（恢复） |
| reason | string | 否 | 操作原因 |

**请求示例**

```json
{
  "action": "SUSPEND",
  "reason": "等待外部审计确认"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "instanceId": "inst-20260716-000123",
    "status": "SUSPENDED",
    "suspendedAt": "2026-07-16T15:00:00.000+08:00",
    "suspendedTasks": ["task-20260716-000456"]
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 流程实例不存在 |
| 40901 | 实例状态不允许该操作（如已终止） |
| 40301 | 用户无权操作该实例 |

---

#### 3.2.6 更新流程变量

更新运行中流程实例的变量值。

```
PUT /api/v1/wfe/instances/{instanceId}/variables
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| instanceId | string | 流程实例 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| variables | object | 是 | 变量键值对 |
| reason | string | 否 | 修改原因 |

**请求示例**

```json
{
  "variables": {
    "requestAmount": 550000,
    "itemDescription": "GPU 服务器 10 台（含运维服务）"
  },
  "reason": "采购数量调整"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "instanceId": "inst-20260716-000123",
    "updatedVariables": ["requestAmount", "itemDescription"],
    "updatedAt": "2026-07-16T15:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 流程实例不存在 |
| 40901 | 实例非运行状态，不可更新变量 |
| 42201 | 变量类型与定义不匹配 |

---

### 3.3 任务管理 API

#### 3.3.1 查询待办任务

查询当前用户的待办任务列表（分配给该用户或该用户所属候选组/角色的任务）。

```
GET /api/v1/wfe/tasks/todo
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| userId | string | 否 | 用户 ID，默认取当前登录用户 |
| definitionKey | string | 否 | 流程定义 key 筛选 |
| category | string | 否 | 流程分类筛选 |
| priority | int | 否 | 优先级筛选 |
| dueBefore | string | 否 | 截止时间上界，用于筛选即将逾期任务 |
| businessKey | string | 否 | 业务标识筛选 |
| keyword | string | 否 | 标题关键词模糊搜索 |
| page | int | 否 | 页码 |
| size | int | 否 | 每页条数 |
| sort | string | 否 | 排序字段，默认 `-createdAt`（也可用 `dueDate` / `priority`） |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "taskId": "task-20260716-000456",
        "instanceId": "inst-20260716-000123",
        "definitionKey": "PURCHASE_APPROVAL_V1",
        "definitionName": "采购审批流程",
        "businessKey": "PO-2026-0716-001",
        "title": "研发部服务器采购申请 - 50万元",
        "activityId": "task_vp_approval",
        "activityName": "VP审批",
        "activityType": "USER_TASK",
        "assignee": "user-003",
        "assigneeName": "王五",
        "candidateUsers": [],
        "candidateGroups": [],
        "formKey": "vp-approval-form",
        "priority": 3,
        "createdAt": "2026-07-16T11:00:00.000+08:00",
        "dueDate": "2026-07-18T11:00:00.000+08:00",
        "followUpDate": null,
        "delegated": false,
        "delegatedFrom": null,
        "addedSigner": false,
        "slaStatus": "NORMAL",
        "remainingTime": 172800000,
        "startUserId": "user-001",
        "startUserName": "张三",
        "startedAt": "2026-07-16T10:35:00.000+08:00"
      }
    ],
    "total": 12,
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
| 40301 | 用户无权查询他人待办 |

---

#### 3.3.2 查询已办任务

查询当前用户已处理的任务列表。

```
GET /api/v1/wfe/tasks/done
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| userId | string | 否 | 用户 ID，默认取当前登录用户 |
| definitionKey | string | 否 | 流程定义 key |
| outcome | string | 否 | 处理结果：`APPROVED` / `REJECTED` / `TRANSFERRED` / `RETURNED` / `DELEGATED` |
| completedAfter | string | 否 | 完成时间下界 |
| completedBefore | string | 否 | 完成时间上界 |
| businessKey | string | 否 | 业务标识 |
| page | int | 否 | 页码 |
| size | int | 否 | 每页条数 |
| sort | string | 否 | 排序字段，默认 `-completedAt` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "taskId": "task-20260716-000455",
        "instanceId": "inst-20260716-000123",
        "definitionKey": "PURCHASE_APPROVAL_V1",
        "definitionName": "采购审批流程",
        "businessKey": "PO-2026-0716-001",
        "title": "研发部服务器采购申请 - 50万元",
        "activityId": "task_manager_approval",
        "activityName": "部门经理审批",
        "assignee": "user-002",
        "assigneeName": "李四",
        "outcome": "APPROVED",
        "comment": "同意，预算充足",
        "completedAt": "2026-07-16T11:00:00.000+08:00",
        "completedBy": "user-002",
        "completedByName": "李四",
        "duration": 1500000,
        "instanceStatus": "RUNNING",
        "attachments": [
          {
            "id": "att-001",
            "name": "预算确认单.pdf",
            "size": 102400,
            "uploadedAt": "2026-07-16T10:58:00.000+08:00"
          }
        ]
      }
    ],
    "total": 85,
    "page": 1,
    "size": 20,
    "totalPages": 5
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | 分页参数不合法 |
| 40002 | outcome 枚举值不合法 |

---

#### 3.3.3 审批任务 - 同意

审批同意当前任务，流程流转至下一节点。

```
POST /api/v1/wfe/tasks/{taskId}/approve
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| taskId | string | 任务 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| comment | string | 否 | 审批意见 |
| variables | object | 否 | 审批时设置的流程变量（可影响后续路由） |
| attachments | array | 否 | 附件列表 |
| attachments[].name | string | 否 | 附件名称 |
| attachments[].url | string | 否 | 附件 URL |
| attachments[].size | int | 否 | 附件大小（字节） |

**请求示例**

```json
{
  "comment": "同意，金额符合预算规划",
  "variables": {
    "vpApproved": true,
    "approvedAmount": 500000
  },
  "attachments": [
    {
      "name": "预算批复.pdf",
      "url": "https://minio.metaplatform.internal/attachments/budget-approval.pdf",
      "size": 204800
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
    "taskId": "task-20260716-000456",
    "outcome": "APPROVED",
    "completedAt": "2026-07-16T14:30:00.000+08:00",
    "completedBy": "user-003",
    "nextActivities": [
      {
        "activityId": "task_finance_confirm",
        "activityName": "财务确认",
        "activityType": "USER_TASK",
        "assignees": ["user-004"],
        "taskId": "task-20260716-000457"
      }
    ],
    "instanceStatus": "RUNNING"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 任务不存在 |
| 40901 | 任务已完成或已挂起 |
| 40301 | 当前用户无权审批该任务 |
| 42201 | 审批意见为必填但未提供 |
| 50003 | 流程流转异常：下一节点无法解析审批人 |

---

#### 3.3.4 审批任务 - 拒绝

审批拒绝当前任务，流程终止或退回（取决于流程定义配置）。

```
POST /api/v1/wfe/tasks/{taskId}/reject
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| taskId | string | 任务 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| comment | string | 是 | 拒绝理由（必填） |
| rejectMode | string | 否 | 拒绝模式：`TERMINATE`（终止流程，默认）/ `RETURN_TO_START`（退回发起人）/ `RETURN_TO_PREVIOUS`（退回上一节点） |
| variables | object | 否 | 附加流程变量 |
| attachments | array | 否 | 附件列表 |

**请求示例**

```json
{
  "comment": "金额超出本季度预算，需重新评估",
  "rejectMode": "TERMINATE",
  "attachments": []
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "task-20260716-000456",
    "outcome": "REJECTED",
    "completedAt": "2026-07-16T14:30:00.000+08:00",
    "completedBy": "user-003",
    "rejectMode": "TERMINATE",
    "instanceStatus": "TERMINATED",
    "nextActivities": []
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 任务不存在 |
| 40901 | 任务已完成或已挂起 |
| 40301 | 当前用户无权审批该任务 |
| 40001 | comment（拒绝理由）为空 |
| 40002 | rejectMode 枚举值不合法 |

---

#### 3.3.5 审批任务 - 转交

将任务转交给其他用户处理。转交后原审批人不再负责该任务。

```
POST /api/v1/wfe/tasks/{taskId}/transfer
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| taskId | string | 任务 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| transferTo | string | 是 | 转交目标用户 ID |
| comment | string | 否 | 转交说明 |
| reason | string | 否 | 转交原因 |

**请求示例**

```json
{
  "transferTo": "user-005",
  "comment": "请财务总监审核预算合理性",
  "reason": "金额超出常规审批权限"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "task-20260716-000456",
    "outcome": "TRANSFERRED",
    "transferredFrom": "user-003",
    "transferredTo": "user-005",
    "transferredToName": "赵六",
    "transferredAt": "2026-07-16T14:00:00.000+08:00",
    "comment": "请财务总监审核预算合理性",
    "instanceStatus": "RUNNING"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 任务不存在 |
| 40901 | 任务已完成或已挂起 |
| 40301 | 当前用户无权转交该任务 |
| 40401 | 转交目标用户不存在（TECH-IAM 校验失败） |
| 42201 | 转交目标用户与当前用户相同 |

---

#### 3.3.6 审批任务 - 退回

将任务退回至指定历史节点。退回后流程从该节点重新执行。

```
POST /api/v1/wfe/tasks/{taskId}/return
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| taskId | string | 任务 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| returnToActivityId | string | 否 | 退回目标节点 ID，不传则退回上一用户任务节点 |
| comment | string | 是 | 退回理由（必填） |
| variables | object | 否 | 附加流程变量 |

**请求示例**

```json
{
  "returnToActivityId": "task_manager_approval",
  "comment": "申请材料不完整，请补充供应商资质证明后重新提交"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "task-20260716-000456",
    "outcome": "RETURNED",
    "completedAt": "2026-07-16T14:00:00.000+08:00",
    "returnedFromActivity": "task_vp_approval",
    "returnedToActivity": "task_manager_approval",
    "returnedToActivityName": "部门经理审批",
    "newTaskId": "task-20260716-000458",
    "newAssignees": ["user-002"],
    "instanceStatus": "RUNNING"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 任务不存在 |
| 40901 | 任务已完成或已挂起 |
| 40301 | 当前用户无权退回该任务 |
| 40001 | comment（退回理由）为空 |
| 42201 | returnToActivityId 不是有效的历史节点 / 不允许退回（如退回到开始事件） |

---

#### 3.3.7 审批任务 - 加签

在当前任务节点追加审批人。支持前加签（先由加签人审批再回到原审批人）和后加签（原审批人审批后再由加签人审批）。

```
POST /api/v1/wfe/tasks/{taskId}/add-signer
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| taskId | string | 任务 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| signers | array | 是 | 加签人列表 |
| signers[].userId | string | 是 | 加签用户 ID |
| signers[].userName | string | 否 | 加签用户名称 |
| addSignMode | string | 否 | 加签模式：`BEFORE`（前加签，默认）/ `AFTER`（后加签）/ `PARALLEL`（并行加签） |
| comment | string | 否 | 加签说明 |
| sequence | string | 否 | 多人加签时审批顺序：`SEQUENTIAL`（顺序，默认）/ `PARALLEL`（并行） |

**请求示例**

```json
{
  "signers": [
    { "userId": "user-006", "userName": "钱七" },
    { "userId": "user-007", "userName": "孙八" }
  ],
  "addSignMode": "BEFORE",
  "sequence": "SEQUENTIAL",
  "comment": "请法务部审核合同条款"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "task-20260716-000456",
    "outcome": "ADD_SIGNER",
    "addSignMode": "BEFORE",
    "sequence": "SEQUENTIAL",
    "addedSigners": [
      { "userId": "user-006", "userName": "钱七", "order": 1 },
      { "userId": "user-007", "userName": "孙八", "order": 2 }
    ],
    "currentSignerTaskId": "task-20260716-000459",
    "currentSigner": "user-006",
    "originalAssignee": "user-003",
    "instanceStatus": "RUNNING"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 任务不存在 |
| 40901 | 任务已完成或已挂起 |
| 40301 | 当前用户无权加签 |
| 40401 | 加签用户不存在（TECH-IAM 校验失败） |
| 42201 | 加签用户列表为空 / 加签用户包含当前审批人自身 |

---

#### 3.3.8 委派任务

将任务临时委派给其他用户处理。委派人完成处理后任务自动回到原审批人。

```
POST /api/v1/wfe/tasks/{taskId}/delegate
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| taskId | string | 任务 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| delegateTo | string | 是 | 委派目标用户 ID |
| comment | string | 否 | 委派说明 |

**请求示例**

```json
{
  "delegateTo": "user-008",
  "comment": "出差期间请代为处理"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "task-20260716-000456",
    "outcome": "DELEGATED",
    "delegatedFrom": "user-003",
    "delegatedTo": "user-008",
    "delegatedToName": "周九",
    "delegatedAt": "2026-07-16T13:00:00.000+08:00",
    "instanceStatus": "RUNNING"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 任务不存在 |
| 40901 | 任务已完成或已挂起 |
| 40301 | 当前用户无权委派该任务 |
| 40401 | 委派目标用户不存在 |
| 42201 | 委派目标用户与当前审批人相同 / 任务已被委派（不允许二次委派） |

---

#### 3.3.9 催办

向当前任务的审批人发送催办通知（站内信 + 消息推送）。

```
POST /api/v1/wfe/tasks/{taskId}/urge
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| taskId | string | 任务 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| message | string | 否 | 催办留言 |
| channels | array | 否 | 通知渠道：`IN_APP` / `SMS` / `EMAIL` / `IM`，默认 `["IN_APP"]` |

**请求示例**

```json
{
  "message": "采购申请紧急，请尽快审批",
  "channels": ["IN_APP", "IM"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "task-20260716-000456",
    "urgedAt": "2026-07-16T16:00:00.000+08:00",
    "urgedBy": "user-001",
    "urgedAssignees": ["user-003"],
    "notifiedChannels": ["IN_APP", "IM"],
    "urgeCount": 1
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 任务不存在 |
| 40901 | 任务已完成或已挂起 |
| 40301 | 当前用户无权催办（仅发起人或管理员可催办） |
| 42901 | 催办频率超限（同一任务 1 小时内最多催办 3 次） |

---

#### 3.3.10 获取任务详情

获取单个任务的详细信息，包括表单定义、流程变量、审批历史。

```
GET /api/v1/wfe/tasks/{taskId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| taskId | string | 任务 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| includeForm | boolean | 否 | 是否包含表单定义，默认 true |
| includeVariables | boolean | 否 | 是否包含流程变量，默认 true |
| includeHistory | boolean | 否 | 是否包含审批历史，默认 true |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "task-20260716-000456",
    "instanceId": "inst-20260716-000123",
    "definitionKey": "PURCHASE_APPROVAL_V1",
    "definitionName": "采购审批流程",
    "businessKey": "PO-2026-0716-001",
    "title": "研发部服务器采购申请 - 50万元",
    "activityId": "task_vp_approval",
    "activityName": "VP审批",
    "activityType": "USER_TASK",
    "assignee": "user-003",
    "assigneeName": "王五",
    "candidateUsers": [],
    "candidateGroups": [],
    "formKey": "vp-approval-form",
    "formDefinition": {
      "fields": [
        {
          "key": "decision",
          "label": "审批决定",
          "type": "RADIO",
          "required": true,
          "options": [
            { "label": "同意", "value": "APPROVED" },
            { "label": "拒绝", "value": "REJECTED" }
          ]
        },
        {
          "key": "comment",
          "label": "审批意见",
          "type": "TEXTAREA",
          "required": true,
          "maxLength": 500
        },
        {
          "key": "approvedAmount",
          "label": "批准金额",
          "type": "NUMBER",
          "required": false
        }
      ]
    },
    "variables": {
      "requestAmount": 500000,
      "requestDept": "RD",
      "managerApproved": true,
      "managerComment": "同意，预算充足"
    },
    "priority": 3,
    "createdAt": "2026-07-16T11:00:00.000+08:00",
    "dueDate": "2026-07-18T11:00:00.000+08:00",
    "delegated": false,
    "slaStatus": "WARNING",
    "remainingTime": 86400000,
    "approvalHistory": [
      {
        "step": 1,
        "activityName": "发起采购申请",
        "assignee": "user-001",
        "assigneeName": "张三",
        "startedAt": "2026-07-16T10:35:00.000+08:00",
        "endedAt": "2026-07-16T10:35:00.000+08:00",
        "outcome": "SUBMITTED",
        "comment": "研发部需要 10 台 GPU 服务器用于模型训练"
      },
      {
        "step": 2,
        "activityName": "部门经理审批",
        "assignee": "user-002",
        "assigneeName": "李四",
        "startedAt": "2026-07-16T10:35:00.000+08:00",
        "endedAt": "2026-07-16T11:00:00.000+08:00",
        "outcome": "APPROVED",
        "comment": "同意，预算充足"
      }
    ],
    "attachments": []
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

### 3.4 流程历史 API

#### 3.4.1 历史实例查询

查询已完成或已终止的流程实例历史记录。

```
GET /api/v1/wfe/history/instances
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| definitionKey | string | 否 | 流程定义 key |
| businessKey | string | 否 | 业务标识 |
| status | string | 否 | 最终状态：`COMPLETED` / `TERMINATED` |
| startedBy | string | 否 | 发起人 ID |
| startedAfter | string | 否 | 发起时间下界 |
| startedBefore | string | 否 | 发起时间上界 |
| completedAfter | string | 否 | 完成时间下界 |
| completedBefore | string | 否 | 完成时间上界 |
| durationMin | int | 否 | 最小耗时（毫秒） |
| durationMax | int | 否 | 最大耗时（毫秒） |
| page | int | 否 | 页码 |
| size | int | 否 | 每页条数 |
| sort | string | 否 | 排序字段，默认 `-completedAt` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "instanceId": "inst-20260715-000098",
        "definitionKey": "PURCHASE_APPROVAL_V1",
        "definitionName": "采购审批流程",
        "definitionVersion": 2,
        "businessKey": "PO-2026-0715-003",
        "title": "市场部活动物料采购 - 8万元",
        "status": "COMPLETED",
        "startUserId": "user-010",
        "startUserName": "吴十",
        "startedAt": "2026-07-15T09:00:00.000+08:00",
        "completedAt": "2026-07-15T15:30:00.000+08:00",
        "duration": 23400000,
        "endEventName": "审批通过",
        "taskCount": 3,
        "participantCount": 3,
        "ontologyRef": {
          "conceptCode": "PurchaseRequest",
          "objectId": "po-2026-0715-003"
        }
      }
    ],
    "total": 320,
    "page": 1,
    "size": 20,
    "totalPages": 16
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | 分页参数不合法 |
| 40301 | 用户无权查询该范围历史数据 |

---

#### 3.4.2 历史任务查询

查询历史任务记录，可按实例或用户维度筛选。

```
GET /api/v1/wfe/history/tasks
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| instanceId | string | 否 | 流程实例 ID |
| definitionKey | string | 否 | 流程定义 key |
| assignee | string | 否 | 处理人 ID |
| outcome | string | 否 | 处理结果 |
| activityName | string | 否 | 活动节点名称 |
| completedAfter | string | 否 | 完成时间下界 |
| completedBefore | string | 否 | 完成时间上界 |
| page | int | 否 | 页码 |
| size | int | 否 | 每页条数 |
| sort | string | 否 | 排序字段，默认 `-completedAt` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "historyTaskId": "htask-20260716-000789",
        "taskId": "task-20260716-000455",
        "instanceId": "inst-20260716-000123",
        "definitionKey": "PURCHASE_APPROVAL_V1",
        "definitionName": "采购审批流程",
        "businessKey": "PO-2026-0716-001",
        "title": "研发部服务器采购申请 - 50万元",
        "activityId": "task_manager_approval",
        "activityName": "部门经理审批",
        "activityType": "USER_TASK",
        "assignee": "user-002",
        "assigneeName": "李四",
        "claimUserId": null,
        "outcome": "APPROVED",
        "comment": "同意，预算充足",
        "startedAt": "2026-07-16T10:35:00.000+08:00",
        "completedAt": "2026-07-16T11:00:00.000+08:00",
        "duration": 1500000,
        "dueDate": "2026-07-18T10:35:00.000+08:00",
        "overdue": false,
        "attachments": [
          {
            "id": "att-001",
            "name": "预算确认单.pdf",
            "size": 102400
          }
        ],
        "delegatedFrom": null,
        "addedSigner": false
      }
    ],
    "total": 1200,
    "page": 1,
    "size": 20,
    "totalPages": 60
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | 分页参数不合法 |
| 40301 | 用户无权查询该范围历史数据 |

---

#### 3.4.3 历史活动查询

查询流程实例的所有历史活动节点执行记录（包括用户任务、服务任务、网关、事件等）。

```
GET /api/v1/wfe/history/activities
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| instanceId | string | 否 | 流程实例 ID |
| definitionKey | string | 否 | 流程定义 key |
| activityType | string | 否 | 活动类型：`USER_TASK` / `SERVICE_TASK` / `EXCLUSIVE_GATEWAY` / `PARALLEL_GATEWAY` / `START_EVENT` / `END_EVENT` / `INTERMEDIATE_EVENT` |
| activityName | string | 否 | 活动节点名称 |
| startedAfter | string | 否 | 开始时间下界 |
| startedBefore | string | 否 | 开始时间上界 |
| page | int | 否 | 页码 |
| size | int | 否 | 每页条数 |
| sort | string | 否 | 排序字段，默认 `startedAt`（正序） |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "historyActivityId": "hact-20260716-001",
        "instanceId": "inst-20260716-000123",
        "activityId": "startEvent_1",
        "activityName": "发起采购申请",
        "activityType": "START_EVENT",
        "startedAt": "2026-07-16T10:35:00.000+08:00",
        "endedAt": "2026-07-16T10:35:00.000+08:00",
        "duration": 0,
        "assignee": null,
        "outcome": null,
        "selectedFlow": null
      },
      {
        "historyActivityId": "hact-20260716-002",
        "instanceId": "inst-20260716-000123",
        "activityId": "task_manager_approval",
        "activityName": "部门经理审批",
        "activityType": "USER_TASK",
        "startedAt": "2026-07-16T10:35:00.000+08:00",
        "endedAt": "2026-07-16T11:00:00.000+08:00",
        "duration": 1500000,
        "assignee": "user-002",
        "assigneeName": "李四",
        "outcome": "APPROVED",
        "comment": "同意，预算充足",
        "taskId": "task-20260716-000455"
      },
      {
        "historyActivityId": "hact-20260716-003",
        "instanceId": "inst-20260716-000123",
        "activityId": "gw_amount_route",
        "activityName": "金额路由",
        "activityType": "EXCLUSIVE_GATEWAY",
        "startedAt": "2026-07-16T11:00:00.000+08:00",
        "endedAt": "2026-07-16T11:00:00.000+08:00",
        "duration": 5,
        "selectedFlow": "flow_vp_approval",
        "selectedCondition": "${amount > 100000}",
        "ruleEvaluationId": "rule-eval-001"
      }
    ],
    "total": 7,
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
| 40002 | activityType 枚举值不合法 |
| 40301 | 用户无权查询该实例历史 |

---

### 3.5 流程监控 API

#### 3.5.1 运行中统计

获取当前租户下流程运行的实时统计数据。

```
GET /api/v1/wfe/monitor/statistics
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| definitionKey | string | 否 | 按流程定义筛选 |
| groupBy | string | 否 | 分组维度：`DEFINITION`（默认）/ `CATEGORY` / `DEPARTMENT` / `ASSIGNEE` |
| timeRange | string | 否 | 时间范围：`TODAY` / `WEEK` / `MONTH`（默认 `TODAY`） |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "timeRange": "TODAY",
    "summary": {
      "totalRunningInstances": 156,
      "totalPendingTasks": 89,
      "totalOverdueTasks": 12,
      "totalStartedToday": 45,
      "totalCompletedToday": 38,
      "totalTerminatedToday": 3,
      "avgCompletionDuration": 7200000,
      "avgTaskProcessingDuration": 3600000
    },
    "grouped": [
      {
        "groupKey": "PURCHASE_APPROVAL_V1",
        "groupName": "采购审批流程",
        "runningInstances": 42,
        "pendingTasks": 28,
        "overdueTasks": 5,
        "startedToday": 12,
        "completedToday": 10,
        "terminatedToday": 1,
        "avgDuration": 86400000
      },
      {
        "groupKey": "LEAVE_APPROVAL_V1",
        "groupName": "请假审批流程",
        "runningInstances": 68,
        "pendingTasks": 35,
        "overdueTasks": 2,
        "startedToday": 20,
        "completedToday": 18,
        "terminatedToday": 0,
        "avgDuration": 3600000
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | groupBy 或 timeRange 枚举值不合法 |
| 40301 | 用户无权查看监控数据 |

---

#### 3.5.2 SLA 预警

查询即将逾期或已逾期的任务列表，按紧急程度排序。

```
GET /api/v1/wfe/monitor/sla-warnings
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| definitionKey | string | 否 | 按流程定义筛选 |
| slaStatus | string | 否 | SLA 状态：`WARNING`（即将逾期）/ `OVERDUE`（已逾期）/ `ALL`（默认） |
| warningThreshold | int | 否 | 预警阈值（小时），距截止时间 N 小时内显示为 WARNING，默认 24 |
| assignee | string | 否 | 按处理人筛选 |
| page | int | 否 | 页码 |
| size | int | 否 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "summary": {
      "totalWarnings": 27,
      "warningCount": 15,
      "overdueCount": 12,
      "maxOverdueHours": 48.5
    },
    "items": [
      {
        "taskId": "task-20260715-000420",
        "instanceId": "inst-20260715-000095",
        "definitionKey": "PURCHASE_APPROVAL_V1",
        "definitionName": "采购审批流程",
        "businessKey": "PO-2026-0715-001",
        "title": "行政部办公设备采购 - 15万元",
        "activityName": "VP审批",
        "assignee": "user-003",
        "assigneeName": "王五",
        "slaStatus": "OVERDUE",
        "dueDate": "2026-07-15T11:00:00.000+08:00",
        "overdueHours": 27.5,
        "remainingHours": -27.5,
        "priority": 3,
        "startUserId": "user-010",
        "startUserName": "吴十",
        "startedAt": "2026-07-15T09:00:00.000+08:00",
        "createdAt": "2026-07-15T09:30:00.000+08:00"
      },
      {
        "taskId": "task-20260716-000456",
        "instanceId": "inst-20260716-000123",
        "definitionKey": "PURCHASE_APPROVAL_V1",
        "definitionName": "采购审批流程",
        "businessKey": "PO-2026-0716-001",
        "title": "研发部服务器采购申请 - 50万元",
        "activityName": "VP审批",
        "assignee": "user-003",
        "assigneeName": "王五",
        "slaStatus": "WARNING",
        "dueDate": "2026-07-18T11:00:00.000+08:00",
        "overdueHours": 0,
        "remainingHours": 19.0,
        "priority": 3,
        "startUserId": "user-001",
        "startUserName": "张三",
        "startedAt": "2026-07-16T10:35:00.000+08:00",
        "createdAt": "2026-07-16T11:00:00.000+08:00"
      }
    ],
    "total": 27,
    "page": 1,
    "size": 20,
    "totalPages": 2
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | slaStatus 枚举值不合法 |
| 40301 | 用户无权查看监控数据 |

---

#### 3.5.3 瓶颈分析

分析指定流程定义的节点耗时分布，识别审批瓶颈。

```
GET /api/v1/wfe/monitor/bottlenecks
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| definitionKey | string | 是 | 流程定义 key |
| startedAfter | string | 否 | 统计起始时间，默认近 30 天 |
| startedBefore | string | 否 | 统计截止时间，默认当前时间 |
| minInstances | int | 否 | 最小样本数，低于此数不返回统计，默认 5 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "definitionKey": "PURCHASE_APPROVAL_V1",
    "definitionName": "采购审批流程",
    "sampleSize": 42,
    "timeRange": {
      "from": "2026-06-16T00:00:00.000+08:00",
      "to": "2026-07-16T23:59:59.000+08:00"
    },
    "overallStats": {
      "avgTotalDuration": 86400000,
      "medianTotalDuration": 72000000,
      "p90TotalDuration": 172800000,
      "completionRate": 0.92,
      "terminationRate": 0.08
    },
    "activityStats": [
      {
        "activityId": "task_manager_approval",
        "activityName": "部门经理审批",
        "activityType": "USER_TASK",
        "avgDuration": 3600000,
        "medianDuration": 1800000,
        "p90Duration": 14400000,
        "minDuration": 60000,
        "maxDuration": 28800000,
        "sampleCount": 42,
        "overdueRate": 0.12,
        "bottleneckScore": 35,
        "bottleneckLevel": "LOW"
      },
      {
        "activityId": "task_vp_approval",
        "activityName": "VP审批",
        "activityType": "USER_TASK",
        "avgDuration": 43200000,
        "medianDuration": 36000000,
        "p90Duration": 86400000,
        "minDuration": 3600000,
        "maxDuration": 172800000,
        "sampleCount": 38,
        "overdueRate": 0.32,
        "bottleneckScore": 78,
        "bottleneckLevel": "HIGH",
        "suggestion": "VP审批节点平均耗时 12 小时，逾期率 32%，建议增加 VP 代理人或启用移动端审批提醒"
      },
      {
        "activityId": "gw_amount_route",
        "activityName": "金额路由",
        "activityType": "EXCLUSIVE_GATEWAY",
        "avgDuration": 5,
        "medianDuration": 3,
        "p90Duration": 10,
        "minDuration": 1,
        "maxDuration": 50,
        "sampleCount": 42,
        "overdueRate": 0,
        "bottleneckScore": 1,
        "bottleneckLevel": "NONE"
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | definitionKey 为空 |
| 40401 | 流程定义不存在 |
| 42201 | 样本数不足（低于 minInstances） |
| 40301 | 用户无权查看监控数据 |

---

### 3.6 事件回调 API

#### 3.6.1 事件订阅注册

注册流程事件回调订阅。当匹配的事件发生时，WFE 将向指定 URL 发送 POST 回调通知。

```
POST /api/v1/wfe/events/subscriptions
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | 订阅名称 |
| eventTypes | array | 是 | 订阅事件类型列表，见 5.1 事件类型定义 |
| definitionKey | string | 否 | 限定流程定义 key，不传则订阅所有流程 |
| callbackUrl | string | 是 | 回调通知 URL |
| callbackMethod | string | 否 | 回调 HTTP 方法，默认 `POST` |
| headers | object | 否 | 回调请求自定义请求头 |
| secret | string | 否 | 签名密钥，用于回调请求签名验证 |
| retryPolicy | object | 否 | 重试策略 |
| retryPolicy.maxRetries | int | 否 | 最大重试次数，默认 3 |
| retryPolicy.retryInterval | int | 否 | 重试间隔（秒），默认 30 |
| retryPolicy.backoffMultiplier | double | 否 | 退避系数，默认 2.0 |
| active | boolean | 否 | 是否启用，默认 true |

**请求示例**

```json
{
  "name": "采购流程事件订阅",
  "eventTypes": [
    "PROCESS_STARTED",
    "PROCESS_COMPLETED",
    "TASK_CREATED",
    "TASK_COMPLETED"
  ],
  "definitionKey": "PURCHASE_APPROVAL_V1",
  "callbackUrl": "https://apphub.metaplatform.internal/api/v1/apphub/wfe-callback",
  "callbackMethod": "POST",
  "headers": {
    "X-Callback-Source": "TECH-WFE"
  },
  "secret": "my-callback-secret-2026",
  "retryPolicy": {
    "maxRetries": 3,
    "retryInterval": 30,
    "backoffMultiplier": 2.0
  },
  "active": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "subscriptionId": "sub-20260716-000001",
    "name": "采购流程事件订阅",
    "eventTypes": [
      "PROCESS_STARTED",
      "PROCESS_COMPLETED",
      "TASK_CREATED",
      "TASK_COMPLETED"
    ],
    "definitionKey": "PURCHASE_APPROVAL_V1",
    "callbackUrl": "https://apphub.metaplatform.internal/api/v1/apphub/wfe-callback",
    "active": true,
    "createdAt": "2026-07-16T10:00:00.000+08:00",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | callbackUrl 为空或格式不合法 |
| 40002 | eventTypes 包含不合法的事件类型 |
| 42201 | eventTypes 为空数组 |

---

#### 3.6.2 查询事件订阅列表

查询当前租户下的事件订阅列表。

```
GET /api/v1/wfe/events/subscriptions
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| definitionKey | string | 否 | 按流程定义筛选 |
| active | boolean | 否 | 按启用状态筛选 |
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
        "subscriptionId": "sub-20260716-000001",
        "name": "采购流程事件订阅",
        "eventTypes": [
          "PROCESS_STARTED",
          "PROCESS_COMPLETED",
          "TASK_CREATED",
          "TASK_COMPLETED"
        ],
        "definitionKey": "PURCHASE_APPROVAL_V1",
        "callbackUrl": "https://apphub.metaplatform.internal/api/v1/apphub/wfe-callback",
        "active": true,
        "createdAt": "2026-07-16T10:00:00.000+08:00",
        "createdBy": "user-001",
        "lastTriggeredAt": "2026-07-16T11:00:00.000+08:00",
        "deliverySuccessCount": 5,
        "deliveryFailureCount": 0
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

---

#### 3.6.3 更新事件订阅

更新事件订阅配置。

```
PUT /api/v1/wfe/events/subscriptions/{subscriptionId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| subscriptionId | string | 订阅 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | 订阅名称 |
| eventTypes | array | 否 | 事件类型列表 |
| callbackUrl | string | 否 | 回调 URL |
| headers | object | 否 | 自定义请求头 |
| secret | string | 否 | 签名密钥 |
| retryPolicy | object | 否 | 重试策略 |
| active | boolean | 否 | 是否启用 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "subscriptionId": "sub-20260716-000001",
    "name": "采购流程事件订阅（已更新）",
    "active": true,
    "updatedAt": "2026-07-16T12:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 订阅不存在 |
| 40301 | 用户无权修改该订阅 |

---

#### 3.6.4 删除事件订阅

删除事件订阅。

```
DELETE /api/v1/wfe/events/subscriptions/{subscriptionId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| subscriptionId | string | 订阅 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "subscriptionId": "sub-20260716-000001",
    "deleted": true
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | 订阅不存在 |
| 40301 | 用户无权删除该订阅 |

---

#### 3.6.5 事件回调通知（WFE -> 订阅方）

当流程事件发生时，WFE 向订阅方发送的回调通知。此接口由订阅方实现，WFE 调用。

```
POST {callbackUrl}
```

**回调请求头**

| 请求头 | 说明 |
|---|---|
| X-WFE-Event-Type | 事件类型 |
| X-WFE-Subscription-Id | 订阅 ID |
| X-WFE-Event-Id | 事件唯一 ID（用于幂等） |
| X-WFE-Event-Timestamp | 事件发生时间 |
| X-WFE-Signature | HMAC-SHA256 签名（使用订阅时设置的 secret） |
| X-Trace-Id | 链路追踪 ID |
| Content-Type | application/json;charset=UTF-8 |

**回调请求体**

```json
{
  "eventId": "evt-20260716-000001",
  "eventType": "TASK_CREATED",
  "eventTimestamp": "2026-07-16T11:00:00.000+08:00",
  "subscriptionId": "sub-20260716-000001",
  "definitionKey": "PURCHASE_APPROVAL_V1",
  "definitionVersion": 3,
  "instanceId": "inst-20260716-000123",
  "businessKey": "PO-2026-0716-001",
  "traceId": "a1b2c3d4e5f6",
  "payload": {
    "taskId": "task-20260716-000456",
    "activityId": "task_vp_approval",
    "activityName": "VP审批",
    "activityType": "USER_TASK",
    "assignee": "user-003",
    "assigneeName": "王五",
    "formKey": "vp-approval-form",
    "priority": 3,
    "dueDate": "2026-07-18T11:00:00.000+08:00",
    "createdAt": "2026-07-16T11:00:00.000+08:00",
    "variables": {
      "requestAmount": 500000,
      "managerApproved": true
    }
  }
}
```

**回调响应要求**

| HTTP Status | 含义 | WFE 行为 |
|---|---|---|
| 200 | 处理成功 | 标记事件投递成功 |
| 200 + body `{"accept": false}` | 订阅方拒绝 | 标记事件投递成功（不再重试） |
| 4xx | 客户端错误 | 不重试，记录失败日志 |
| 5xx | 服务端错误 | 按重试策略重试 |

**签名验证**

订阅方收到回调后，可使用注册时设置的 secret 验证签名：

```
signature = HMAC-SHA256(secret, requestBody)
```

将计算结果与 `X-WFE-Signature` 请求头比较，一致则验证通过。

---

## 4. 数据模型

### 4.1 PostgreSQL 表结构总览

| 表名 | 说明 |
|---|---|
| wfe_process_definition | 流程定义表 |
| wfe_process_definition_ontology_binding | 流程定义本体绑定表 |
| wfe_process_instance | 流程实例表 |
| wfe_execution | 执行实例表（流程执行上下文） |
| wfe_variable | 流程变量表 |
| wfe_task | 用户任务表 |
| wfe_task_identity_link | 任务身份关联表（审批人/候选组/委派关系） |
| wfe_task_attachment | 任务附件表 |
| wfe_task_action | 任务操作记录表（审批/转交/退回/加签等） |
| wfe_activity_instance | 活动实例表（历史活动记录） |
| wfe_event_subscription | 事件订阅表 |
| wfe_event_delivery_log | 事件投递日志表 |
| wfe_outbox | Outbox 事件表（Kafka 事务消息） |
| wfe_idempotent_request | 幂等请求记录表 |

### 4.2 wfe_process_definition（流程定义表）

```sql
CREATE TABLE wfe_process_definition (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 流程定义 ID（UUID）
    tenant_id           VARCHAR(64)   NOT NULL,             -- 租户 ID
    definition_key      VARCHAR(128)  NOT NULL,             -- 流程定义 key
    name                VARCHAR(256)  NOT NULL,             -- 流程名称
    category            VARCHAR(64),                        -- 流程分类
    version             INT           NOT NULL,             -- 版本号（自增）
    status              VARCHAR(32)   NOT NULL DEFAULT 'ACTIVE', -- 状态：ACTIVE/SUSPENDED/DEPRECATED
    bpmn_xml            TEXT          NOT NULL,             -- BPMN 2.0 XML 内容
    bpmn_json           TEXT,                               -- 解析后的 JSON 结构（缓存）
    description         TEXT,                               -- 描述
    start_form_key      VARCHAR(128),                       -- 开始表单 key
    deployment_source   VARCHAR(64),                        -- 部署来源（DESIGNER/IMPORT/API）
    deployed_by         VARCHAR(64)   NOT NULL,             -- 部署人 ID
    deployed_at         TIMESTAMP     NOT NULL DEFAULT NOW(), -- 部署时间
    suspended           BOOLEAN       NOT NULL DEFAULT FALSE, -- 是否挂起
    suspended_at        TIMESTAMP,                          -- 挂起时间
    suspended_by        VARCHAR(64),                        -- 挂起操作人
    meta_data           JSONB,                              -- 元数据（用户任务数、网关数等）
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, definition_key, version)
);

CREATE INDEX idx_pd_tenant_key ON wfe_process_definition (tenant_id, definition_key);
CREATE INDEX idx_pd_status ON wfe_process_definition (tenant_id, status);
CREATE INDEX idx_pd_deployed_at ON wfe_process_definition (deployed_at DESC);
```

### 4.3 wfe_process_definition_ontology_binding（流程定义本体绑定表）

```sql
CREATE TABLE wfe_process_definition_ontology_binding (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    definition_id       VARCHAR(64)   NOT NULL,             -- 流程定义 ID
    concept_code        VARCHAR(128)  NOT NULL,             -- 本体概念编码
    variable_mapping    JSONB         NOT NULL,             -- 本体属性与流程变量映射
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (definition_id) REFERENCES wfe_process_definition(id) ON DELETE CASCADE
);

CREATE INDEX idx_pdob_definition ON wfe_process_definition_ontology_binding (definition_id);
CREATE INDEX idx_pdob_concept ON wfe_process_definition_ontology_binding (tenant_id, concept_code);
```

### 4.4 wfe_process_instance（流程实例表）

```sql
CREATE TABLE wfe_process_instance (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 流程实例 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    definition_id       VARCHAR(64)   NOT NULL,             -- 流程定义 ID
    definition_key      VARCHAR(128)  NOT NULL,             -- 流程定义 key（冗余，便于查询）
    definition_version  INT           NOT NULL,             -- 流程定义版本（冗余）
    definition_name     VARCHAR(256)  NOT NULL,             -- 流程定义名称（冗余）
    business_key        VARCHAR(128),                       -- 业务标识
    title               VARCHAR(512)  NOT NULL,             -- 流程实例标题
    status              VARCHAR(32)   NOT NULL DEFAULT 'RUNNING', -- 状态：RUNNING/COMPLETED/TERMINATED/SUSPENDED
    suspended           BOOLEAN       NOT NULL DEFAULT FALSE,
    start_user_id       VARCHAR(64)   NOT NULL,             -- 发起人 ID
    start_user_name     VARCHAR(128),                       -- 发起人名称（冗余）
    started_at          TIMESTAMP     NOT NULL DEFAULT NOW(), -- 发起时间
    completed_at        TIMESTAMP,                          -- 完成时间
    completed_end_event VARCHAR(128),                       -- 完成时的结束事件 ID
    terminated_at       TIMESTAMP,                          -- 终止时间
    terminated_by       VARCHAR(64),                        -- 终止操作人
    terminate_reason    TEXT,                               -- 终止原因
    suspended_at        TIMESTAMP,                          -- 挂起时间
    suspended_by        VARCHAR(64),                        -- 挂起操作人
    suspend_reason      TEXT,                               -- 挂起原因
    priority            INT           NOT NULL DEFAULT 2,   -- 优先级：1(低)/2(中)/3(高)
    due_date            TIMESTAMP,                          -- 期望完成时间
    ontology_concept_code VARCHAR(128),                     -- 关联本体概念编码
    ontology_object_id  VARCHAR(128),                       -- 关联本体对象 ID
    trace_id            VARCHAR(64),                        -- 发起时的 trace_id
    meta_data           JSONB,                              -- 元数据
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (definition_id) REFERENCES wfe_process_definition(id)
);

CREATE INDEX idx_pi_tenant_status ON wfe_process_instance (tenant_id, status);
CREATE INDEX idx_pi_definition_key ON wfe_process_instance (tenant_id, definition_key, status);
CREATE INDEX idx_pi_business_key ON wfe_process_instance (tenant_id, business_key);
CREATE INDEX idx_pi_start_user ON wfe_process_instance (tenant_id, start_user_id);
CREATE INDEX idx_pi_started_at ON wfe_process_instance (started_at DESC);
CREATE INDEX idx_pi_ontology ON wfe_process_instance (ontology_concept_code, ontology_object_id);
```

### 4.5 wfe_execution（执行实例表）

```sql
CREATE TABLE wfe_execution (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 执行实例 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    instance_id         VARCHAR(64)   NOT NULL,             -- 所属流程实例 ID
    parent_execution_id VARCHAR(64),                        -- 父执行实例 ID（用于并行网关）
    current_activity_id VARCHAR(128),                       -- 当前活动节点 ID
    current_activity_name VARCHAR(256),                     -- 当前活动节点名称
    current_activity_type VARCHAR(64),                      -- 当前活动节点类型
    is_active           BOOLEAN       NOT NULL DEFAULT TRUE, -- 是否活跃
    is_concurrent       BOOLEAN       NOT NULL DEFAULT FALSE, -- 是否并行执行
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (instance_id) REFERENCES wfe_process_instance(id) ON DELETE CASCADE
);

CREATE INDEX idx_exec_instance ON wfe_execution (instance_id);
CREATE INDEX idx_exec_active ON wfe_execution (tenant_id, is_active);
```

### 4.6 wfe_variable（流程变量表）

```sql
CREATE TABLE wfe_variable (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    instance_id         VARCHAR(64)   NOT NULL,             -- 所属流程实例 ID
    execution_id        VARCHAR(64),                        -- 所属执行实例 ID
    name                VARCHAR(128)  NOT NULL,             -- 变量名
    type                VARCHAR(32)   NOT NULL,             -- 变量类型：STRING/INTEGER/DOUBLE/BOOLEAN/DATE/JSON/OBJECT
    text_value          TEXT,                               -- 文本值
    long_value          BIGINT,                             -- 长整型值
    double_value        DOUBLE PRECISION,                   -- 浮点值
    boolean_value       BOOLEAN,                            -- 布尔值
    json_value          JSONB,                              -- JSON 值
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (instance_id, name),
    FOREIGN KEY (instance_id) REFERENCES wfe_process_instance(id) ON DELETE CASCADE
);

CREATE INDEX idx_var_instance ON wfe_variable (instance_id);
CREATE INDEX idx_var_name ON wfe_variable (tenant_id, instance_id, name);
```

### 4.7 wfe_task（用户任务表）

```sql
CREATE TABLE wfe_task (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 任务 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    instance_id         VARCHAR(64)   NOT NULL,             -- 所属流程实例 ID
    execution_id        VARCHAR(64)   NOT NULL,             -- 所属执行实例 ID
    definition_key      VARCHAR(128)  NOT NULL,             -- 流程定义 key（冗余）
    business_key        VARCHAR(128),                       -- 业务标识（冗余）
    title               VARCHAR(512)  NOT NULL,             -- 任务标题（通常与实例标题一致）
    activity_id         VARCHAR(128)  NOT NULL,             -- 活动节点 ID
    activity_name       VARCHAR(256)  NOT NULL,             -- 活动节点名称
    activity_type       VARCHAR(64)   NOT NULL DEFAULT 'USER_TASK',
    assignee            VARCHAR(64),                        -- 当前处理人 ID
    assignee_name       VARCHAR(128),                       -- 当前处理人名称
    form_key            VARCHAR(128),                       -- 表单 key
    priority            INT           NOT NULL DEFAULT 2,   -- 优先级
    status              VARCHAR(32)   NOT NULL DEFAULT 'CREATED', -- 状态：CREATED/ASSIGNED/CLAIMED/DELEGATED/COMPLETED/CANCELLED
    outcome             VARCHAR(32),                        -- 处理结果：APPROVED/REJECTED/TRANSFERRED/RETURNED/DELEGATED/ADD_SIGNER
    comment             TEXT,                               -- 处理意见
    delegated_from      VARCHAR(64),                        -- 委派来源人 ID
    delegation_state    VARCHAR(32),                        -- 委派状态：PENDING/RESOLVED
    added_signer        BOOLEAN       NOT NULL DEFAULT FALSE, -- 是否为加签任务
    add_sign_mode       VARCHAR(32),                        -- 加签模式：BEFORE/AFTER/PARALLEL
    add_sign_parent_task_id VARCHAR(64),                    -- 加签父任务 ID
    add_sign_order      INT,                                -- 加签顺序
    due_date            TIMESTAMP,                          -- 截止时间
    follow_up_date      TIMESTAMP,                          -- 跟进时间
    claimed_at          TIMESTAMP,                          -- 签收时间
    claimed_by          VARCHAR(64),                        -- 签收人
    completed_at        TIMESTAMP,                          -- 完成时间
    completed_by        VARCHAR(64),                        -- 完成人
    cancelled_at        TIMESTAMP,                          -- 取消时间
    cancelled_reason    TEXT,                               -- 取消原因
    urge_count          INT           NOT NULL DEFAULT 0,   -- 催办次数
    last_urged_at       TIMESTAMP,                          -- 最近催办时间
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (instance_id) REFERENCES wfe_process_instance(id) ON DELETE CASCADE
);

CREATE INDEX idx_task_tenant_assignee_status ON wfe_task (tenant_id, assignee, status);
CREATE INDEX idx_task_instance ON wfe_task (instance_id);
CREATE INDEX idx_task_definition_key ON wfe_task (tenant_id, definition_key, status);
CREATE INDEX idx_task_status ON wfe_task (tenant_id, status);
CREATE INDEX idx_task_due_date ON wfe_task (tenant_id, due_date) WHERE status IN ('CREATED', 'ASSIGNED', 'CLAIMED', 'DELEGATED');
CREATE INDEX idx_task_completed_by ON wfe_task (tenant_id, completed_by, completed_at);
```

### 4.8 wfe_task_identity_link（任务身份关联表）

```sql
CREATE TABLE wfe_task_identity_link (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    task_id             VARCHAR(64)   NOT NULL,             -- 任务 ID
    user_id             VARCHAR(64),                        -- 用户 ID
    group_id            VARCHAR(64),                        -- 组 ID
    type                VARCHAR(32)   NOT NULL,             -- 关联类型：ASSIGNEE/CANDIDATE_USER/CANDIDATE_GROUP/OWNER/DELEGATE
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (task_id) REFERENCES wfe_task(id) ON DELETE CASCADE
);

CREATE INDEX idx_til_task ON wfe_task_identity_link (task_id);
CREATE INDEX idx_til_user ON wfe_task_identity_link (tenant_id, user_id, type);
CREATE INDEX idx_til_group ON wfe_task_identity_link (tenant_id, group_id, type);
```

### 4.9 wfe_task_attachment（任务附件表）

```sql
CREATE TABLE wfe_task_attachment (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    task_id             VARCHAR(64)   NOT NULL,             -- 任务 ID
    instance_id         VARCHAR(64)   NOT NULL,             -- 流程实例 ID
    name                VARCHAR(256)  NOT NULL,             -- 附件名称
    url                 TEXT          NOT NULL,             -- 附件 URL
    size                BIGINT,                             -- 附件大小（字节）
    mime_type           VARCHAR(128),                       -- MIME 类型
    uploaded_by         VARCHAR(64)   NOT NULL,             -- 上传人 ID
    uploaded_at         TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (task_id) REFERENCES wfe_task(id) ON DELETE CASCADE
);

CREATE INDEX idx_att_task ON wfe_task_attachment (task_id);
CREATE INDEX idx_att_instance ON wfe_task_attachment (instance_id);
```

### 4.10 wfe_task_action（任务操作记录表）

```sql
CREATE TABLE wfe_task_action (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    task_id             VARCHAR(64)   NOT NULL,             -- 任务 ID
    instance_id         VARCHAR(64)   NOT NULL,             -- 流程实例 ID
    action_type         VARCHAR(32)   NOT NULL,             -- 操作类型：APPROVE/REJECT/TRANSFER/RETURN/ADD_SIGNER/DELEGATE/CLAIM/URGE/CANCEL
    action_user_id      VARCHAR(64)   NOT NULL,             -- 操作人 ID
    action_user_name    VARCHAR(128),                       -- 操作人名称
    target_user_id      VARCHAR(64),                        -- 目标用户 ID（转交/委派/加签目标）
    target_user_name    VARCHAR(128),                       -- 目标用户名称
    comment             TEXT,                               -- 操作备注
    variables           JSONB,                              -- 操作时设置的变量
    attachments         JSONB,                              -- 操作时上传的附件列表
    action_metadata     JSONB,                              -- 操作元数据（如退回目标节点、加签模式等）
    trace_id            VARCHAR(64),                        -- 链路追踪 ID
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (task_id) REFERENCES wfe_task(id) ON DELETE CASCADE
);

CREATE INDEX idx_ta_task ON wfe_task_action (task_id);
CREATE INDEX idx_ta_instance ON wfe_task_action (instance_id);
CREATE INDEX idx_ta_action_user ON wfe_task_action (tenant_id, action_user_id, created_at DESC);
CREATE INDEX idx_ta_action_type ON wfe_task_action (tenant_id, action_type, created_at DESC);
```

### 4.11 wfe_activity_instance（活动实例表 / 历史活动记录）

```sql
CREATE TABLE wfe_activity_instance (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 历史活动 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    instance_id         VARCHAR(64)   NOT NULL,             -- 流程实例 ID
    definition_key      VARCHAR(128)  NOT NULL,             -- 流程定义 key（冗余）
    execution_id        VARCHAR(64),                        -- 执行实例 ID
    activity_id         VARCHAR(128)  NOT NULL,             -- 活动节点 ID
    activity_name       VARCHAR(256),                       -- 活动节点名称
    activity_type       VARCHAR(64)   NOT NULL,             -- 活动类型
    task_id             VARCHAR(64),                        -- 关联任务 ID（仅 USER_TASK 类型）
    assignee            VARCHAR(64),                        -- 处理人
    assignee_name       VARCHAR(128),                       -- 处理人名称
    claim_user_id       VARCHAR(64),                        -- 签收人
    outcome             VARCHAR(32),                        -- 处理结果
    comment             TEXT,                               -- 处理意见
    selected_flow       VARCHAR(128),                       -- 网关选择的出口流 ID
    selected_condition  TEXT,                               -- 网关命中的条件表达式
    rule_evaluation_id  VARCHAR(64),                        -- 规则引擎求值 ID（关联 TECH-RULE）
    started_at          TIMESTAMP     NOT NULL,             -- 开始时间
    ended_at            TIMESTAMP,                          -- 结束时间
    duration            BIGINT,                             -- 耗时（毫秒）
    due_date            TIMESTAMP,                          -- 截止时间
    overdue             BOOLEAN       NOT NULL DEFAULT FALSE, -- 是否逾期
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (instance_id) REFERENCES wfe_process_instance(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_instance ON wfe_activity_instance (instance_id, started_at);
CREATE INDEX idx_ai_definition ON wfe_activity_instance (tenant_id, definition_key);
CREATE INDEX idx_ai_activity_type ON wfe_activity_instance (tenant_id, activity_type);
CREATE INDEX idx_ai_assignee ON wfe_activity_instance (tenant_id, assignee, ended_at DESC);
```

### 4.12 wfe_event_subscription（事件订阅表）

```sql
CREATE TABLE wfe_event_subscription (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 订阅 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    name                VARCHAR(256)  NOT NULL,             -- 订阅名称
    event_types         JSONB         NOT NULL,             -- 订阅事件类型列表
    definition_key      VARCHAR(128),                       -- 限定流程定义 key
    callback_url        TEXT          NOT NULL,             -- 回调 URL
    callback_method     VARCHAR(10)   NOT NULL DEFAULT 'POST',
    headers             JSONB,                              -- 自定义请求头
    secret              VARCHAR(256),                       -- 签名密钥（加密存储）
    retry_max           INT           NOT NULL DEFAULT 3,   -- 最大重试次数
    retry_interval      INT           NOT NULL DEFAULT 30,  -- 重试间隔（秒）
    retry_backoff       DOUBLE PRECISION NOT NULL DEFAULT 2.0, -- 退避系数
    active              BOOLEAN       NOT NULL DEFAULT TRUE,
    created_by          VARCHAR(64)   NOT NULL,
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    last_triggered_at   TIMESTAMP,                          -- 最近触发时间
    delivery_success_count INT         NOT NULL DEFAULT 0,  -- 投递成功次数
    delivery_failure_count INT         NOT NULL DEFAULT 0   -- 投递失败次数
);

CREATE INDEX idx_es_tenant_active ON wfe_event_subscription (tenant_id, active);
CREATE INDEX idx_es_definition_key ON wfe_event_subscription (tenant_id, definition_key);
```

### 4.13 wfe_event_delivery_log（事件投递日志表）

```sql
CREATE TABLE wfe_event_delivery_log (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    subscription_id     VARCHAR(64)   NOT NULL,             -- 订阅 ID
    event_id            VARCHAR(64)   NOT NULL,             -- 事件 ID
    event_type          VARCHAR(64)   NOT NULL,             -- 事件类型
    instance_id         VARCHAR(64),                        -- 流程实例 ID
    payload             JSONB         NOT NULL,             -- 事件负载
    attempt_count       INT           NOT NULL DEFAULT 0,   -- 尝试次数
    status              VARCHAR(32)   NOT NULL DEFAULT 'PENDING', -- 状态：PENDING/SUCCESS/FAILED/DEAD_LETTER
    response_code       INT,                                -- 回调响应码
    response_body       TEXT,                               -- 回调响应体
    error_message       TEXT,                               -- 错误信息
    next_retry_at       TIMESTAMP,                          -- 下次重试时间
    delivered_at        TIMESTAMP,                          -- 投递成功时间
    trace_id            VARCHAR(64),                        -- 链路追踪 ID
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (subscription_id) REFERENCES wfe_event_subscription(id) ON DELETE CASCADE
);

CREATE INDEX idx_edl_subscription_status ON wfe_event_delivery_log (subscription_id, status);
CREATE INDEX idx_edl_pending_retry ON wfe_event_delivery_log (status, next_retry_at) WHERE status = 'PENDING';
CREATE INDEX idx_edl_event ON wfe_event_delivery_log (event_id);
```

### 4.14 wfe_outbox（Outbox 事件表）

```sql
CREATE TABLE wfe_outbox (
    id                  VARCHAR(64)   PRIMARY KEY,          -- Outbox 记录 ID
    tenant_id           VARCHAR(64)   NOT NULL,
    aggregate_type      VARCHAR(64)   NOT NULL,             -- 聚合类型：PROCESS_INSTANCE/TASK
    aggregate_id        VARCHAR(64)   NOT NULL,             -- 聚合 ID（实例 ID 或任务 ID）
    event_type          VARCHAR(64)   NOT NULL,             -- 事件类型
    event_id            VARCHAR(64)   NOT NULL,             -- 事件唯一 ID
    payload             JSONB         NOT NULL,             -- 事件负载（完整事件 JSON）
    kafka_topic         VARCHAR(128)  NOT NULL,             -- 目标 Kafka topic
    kafka_key           VARCHAR(128),                       -- Kafka 消息 key
    trace_id            VARCHAR(64)   NOT NULL,             -- 链路追踪 ID
    status              VARCHAR(32)   NOT NULL DEFAULT 'PENDING', -- 状态：PENDING/SENT/FAILED
    retry_count         INT           NOT NULL DEFAULT 0,   -- 重试次数
    max_retries         INT           NOT NULL DEFAULT 3,   -- 最大重试次数
    last_error          TEXT,                               -- 最近错误信息
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(), -- 创建时间
    sent_at             TIMESTAMP,                          -- 发送成功时间
    next_retry_at       TIMESTAMP                           -- 下次重试时间
);

CREATE INDEX idx_outbox_status_created ON wfe_outbox (status, created_at) WHERE status = 'PENDING';
CREATE INDEX idx_outbox_aggregate ON wfe_outbox (tenant_id, aggregate_type, aggregate_id);
CREATE INDEX idx_outbox_event_id ON wfe_outbox (event_id);
```

### 4.15 wfe_idempotent_request（幂等请求记录表）

```sql
CREATE TABLE wfe_idempotent_request (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    request_type        VARCHAR(64)   NOT NULL,             -- 请求类型（如 START_PROCESS/APPROVE_TASK）
    request_id          VARCHAR(128)  NOT NULL,             -- 客户端传递的 X-Request-Id
    request_body_hash   VARCHAR(64),                        -- 请求体哈希（用于校验）
    response_code       INT,                                -- 响应码
    response_body       TEXT,                               -- 响应体
    trace_id            VARCHAR(64),                        -- 链路追踪 ID
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMP     NOT NULL,             -- 过期时间（created_at + 24h）
    UNIQUE (tenant_id, request_type, request_id)
);

CREATE INDEX idx_idempotent_expires ON wfe_idempotent_request (expires_at);
```

---

## 5. 事件定义

### 5.1 事件类型

| 事件类型 | 说明 | 触发时机 |
|---|---|---|
| PROCESS_STARTED | 流程启动事件 | 流程实例发起成功后 |
| PROCESS_COMPLETED | 流程完成事件 | 流程实例正常到达结束事件 |
| PROCESS_TERMINATED | 流程终止事件 | 流程实例被强制终止 |
| PROCESS_SUSPENDED | 流程挂起事件 | 流程实例被挂起 |
| PROCESS_RESUMED | 流程恢复事件 | 流程实例从挂起恢复 |
| TASK_CREATED | 任务创建事件 | 用户任务节点被激活，任务创建 |
| TASK_ASSIGNED | 任务分配事件 | 任务被分配给指定用户 |
| TASK_CLAIMED | 任务签收事件 | 候选人签收任务 |
| TASK_COMPLETED | 任务完成事件 | 用户任务被审批处理完成 |
| TASK_CANCELLED | 任务取消事件 | 任务因流程终止/退回被取消 |
| TASK_DELEGATED | 任务委派事件 | 任务被委派给其他用户 |
| TASK_TRANSFERRED | 任务转交事件 | 任务被转交给其他用户 |
| TASK_RETURNED | 任务退回事件 | 任务被退回至历史节点 |
| TASK_SIGNER_ADDED | 任务加签事件 | 任务被加签追加审批人 |
| TASK_OVERDUE | 任务逾期事件 | 任务超过截止时间未处理 |
| VARIABLE_CHANGED | 变量变更事件 | 流程变量被修改 |

### 5.2 Kafka Topic 定义

| Topic | 说明 | 分区策略 |
|---|---|---|
| `wfe.process.events` | 流程实例生命周期事件 | 按 `instanceId` 哈希分区 |
| `wfe.task.events` | 任务生命周期事件 | 按 `taskId` 哈希分区 |
| `wfe.sla.events` | SLA 预警事件 | 按 `instanceId` 哈希分区 |
| `wfe.dlq` | 死信队列 | 消费失败的事件 |

### 5.3 Kafka 消息结构

所有 Kafka 消息采用统一信封格式：

```json
{
  "eventId": "evt-20260716-000001",
  "eventType": "PROCESS_STARTED",
  "eventTimestamp": "2026-07-16T10:35:00.000+08:00",
  "tenantId": "tenant-001",
  "aggregateType": "PROCESS_INSTANCE",
  "aggregateId": "inst-20260716-000123",
  "traceId": "a1b2c3d4e5f6",
  "source": "TECH-WFE",
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

#### 5.4.1 PROCESS_STARTED

```json
{
  "instanceId": "inst-20260716-000123",
  "definitionKey": "PURCHASE_APPROVAL_V1",
  "definitionVersion": 3,
  "definitionName": "采购审批流程",
  "businessKey": "PO-2026-0716-001",
  "title": "研发部服务器采购申请 - 50万元",
  "startUserId": "user-001",
  "startUserName": "张三",
  "startedAt": "2026-07-16T10:35:00.000+08:00",
  "priority": 3,
  "dueDate": "2026-07-23T18:00:00.000+08:00",
  "ontologyRef": {
    "conceptCode": "PurchaseRequest",
    "objectId": "po-2026-0716-001"
  },
  "variables": {
    "requestAmount": 500000,
    "requestDept": "RD"
  }
}
```

#### 5.4.2 PROCESS_COMPLETED

```json
{
  "instanceId": "inst-20260716-000123",
  "definitionKey": "PURCHASE_APPROVAL_V1",
  "definitionName": "采购审批流程",
  "businessKey": "PO-2026-0716-001",
  "title": "研发部服务器采购申请 - 50万元",
  "startUserId": "user-001",
  "startedAt": "2026-07-16T10:35:00.000+08:00",
  "completedAt": "2026-07-16T16:00:00.000+08:00",
  "duration": 57000000,
  "endEventId": "endEvent_approved",
  "endEventName": "审批通过",
  "finalVariables": {
    "requestAmount": 500000,
    "approvedAmount": 500000,
    "managerApproved": true,
    "vpApproved": true
  }
}
```

#### 5.4.3 PROCESS_TERMINATED

```json
{
  "instanceId": "inst-20260716-000123",
  "definitionKey": "PURCHASE_APPROVAL_V1",
  "businessKey": "PO-2026-0716-001",
  "startUserId": "user-001",
  "startedAt": "2026-07-16T10:35:00.000+08:00",
  "terminatedAt": "2026-07-16T14:00:00.000+08:00",
  "terminatedBy": "user-001",
  "terminateReason": "采购需求变更，取消本次申请",
  "terminatedTaskIds": ["task-20260716-000456"]
}
```

#### 5.4.4 TASK_CREATED

```json
{
  "taskId": "task-20260716-000456",
  "instanceId": "inst-20260716-000123",
  "definitionKey": "PURCHASE_APPROVAL_V1",
  "definitionName": "采购审批流程",
  "businessKey": "PO-2026-0716-001",
  "title": "研发部服务器采购申请 - 50万元",
  "activityId": "task_vp_approval",
  "activityName": "VP审批",
  "activityType": "USER_TASK",
  "assignee": "user-003",
  "assigneeName": "王五",
  "candidateUsers": [],
  "candidateGroups": [],
  "formKey": "vp-approval-form",
  "priority": 3,
  "dueDate": "2026-07-18T11:00:00.000+08:00",
  "createdAt": "2026-07-16T11:00:00.000+08:00",
  "startUserId": "user-001",
  "startUserName": "张三",
  "variables": {
    "requestAmount": 500000,
    "managerApproved": true
  }
}
```

#### 5.4.5 TASK_COMPLETED

```json
{
  "taskId": "task-20260716-000456",
  "instanceId": "inst-20260716-000123",
  "definitionKey": "PURCHASE_APPROVAL_V1",
  "businessKey": "PO-2026-0716-001",
  "activityId": "task_vp_approval",
  "activityName": "VP审批",
  "assignee": "user-003",
  "assigneeName": "王五",
  "outcome": "APPROVED",
  "comment": "同意，金额符合预算规划",
  "completedBy": "user-003",
  "completedAt": "2026-07-16T14:30:00.000+08:00",
  "duration": 14400000,
  "overdue": false,
  "nextActivityId": "task_finance_confirm",
  "nextActivityName": "财务确认",
  "nextAssignees": ["user-004"],
  "variables": {
    "vpApproved": true,
    "approvedAmount": 500000
  }
}
```

#### 5.4.6 TASK_OVERDUE

```json
{
  "taskId": "task-20260715-000420",
  "instanceId": "inst-20260715-000095",
  "definitionKey": "PURCHASE_APPROVAL_V1",
  "definitionName": "采购审批流程",
  "businessKey": "PO-2026-0715-001",
  "title": "行政部办公设备采购 - 15万元",
  "activityName": "VP审批",
  "assignee": "user-003",
  "assigneeName": "王五",
  "priority": 3,
  "dueDate": "2026-07-15T11:00:00.000+08:00",
  "overdueAt": "2026-07-15T11:00:00.000+08:00",
  "overdueHours": 27.5,
  "startUserId": "user-010",
  "startUserName": "吴十",
  "startedAt": "2026-07-15T09:00:00.000+08:00"
}
```

### 5.5 Outbox 模式实现

#### 5.5.1 写入流程

1. 业务事务中，将事件写入 `wfe_outbox` 表（与业务数据在同一数据库事务中提交）
2. 独立的 Outbox Publisher 线程轮询 `wfe_outbox` 表中 `status = 'PENDING'` 的记录
3. Publisher 将事件发送到 Kafka，发送成功后更新 `status = 'SENT'`
4. 发送失败时递增 `retry_count`，若超过 `max_retries` 则 `status = 'FAILED'`

```
[业务事务开始]
  -> 写入 wfe_process_instance（实例数据）
  -> 写入 wfe_task（任务数据）
  -> 写入 wfe_outbox（事件记录，与业务数据同一事务）
[业务事务提交]

[Outbox Publisher 线程]
  -> 查询 wfe_outbox WHERE status = 'PENDING' ORDER BY created_at
  -> 发送到 Kafka（topic = wfe.process.events / wfe.task.events）
  -> 更新 wfe_outbox SET status = 'SENT', sent_at = NOW()
  -> 若失败：retry_count++，next_retry_at = NOW() + 退避间隔
  -> 若 retry_count > max_retries：status = 'FAILED'，写入 wfe.dlq
```

#### 5.5.2 事务保证

- Outbox 表与业务表在同一 PostgreSQL 事务中写入，保证原子性
- Outbox Publisher 使用 `SELECT ... FOR UPDATE SKIP LOCKED` 避免多实例重复消费
- Kafka 发送成功后才更新 Outbox 状态，保证 at-least-once 语义
- 消费方需实现幂等处理（基于 `eventId` 去重）

#### 5.5.3 DLQ 处理

- 超过最大重试次数的事件进入 DLQ（`wfe.dlq` topic）
- DLQ 消息保留 `traceId` 字段用于故障诊断
- DLQ 消息保留原始事件 payload，支持人工重放
- 运维告警：DLQ 有新消息时触发告警通知

### 5.6 事件消费方指南

| 消费方 | 订阅 Topic | 处理逻辑 |
|---|---|---|
| APP-APPHUB | wfe.process.events, wfe.task.events | 更新应用内流程状态展示、触发页面刷新通知 |
| APP-DASHBOARD | wfe.process.events, wfe.sla.events | 更新仪表盘统计数据、SLA 预警展示 |
| TECH-ONT | wfe.process.events | 流程完成后更新本体业务对象状态（如 PurchaseRequest.status = APPROVED） |
| TECH-ACTION | wfe.task.events | 监听 TASK_COMPLETED 触发后续 Action 自动化 |
| TECH-MSG | 所有 | 统一消息推送（站内信/邮件/IM 通知） |

**消费方幂等处理**

```java
// 伪代码示例
@KafkaListener(topics = "wfe.task.events")
public void onTaskEvent(TaskEvent event) {
    // 1. 基于 eventId 幂等检查
    if (idempotentRepository.exists(event.getEventId())) {
        return; // 已处理，跳过
    }
    // 2. 处理事件
    processEvent(event);
    // 3. 标记已处理
    idempotentRepository.save(event.getEventId());
}
```

---

## 6. 增量交付计划

### 6.1 Sprint 1：流程定义与实例核心（M1）

**目标**：完成流程定义部署、查询和流程实例发起的基础能力。

| 交付项 | API | 说明 |
|---|---|---|
| 流程定义部署 | POST /api/v1/wfe/definitions | 支持 BPMN XML 解析、版本管理 |
| 流程定义列表查询 | GET /api/v1/wfe/definitions | 分页查询、条件筛选 |
| 流程定义详情 | GET /api/v1/wfe/definitions/{id} | 含本体绑定信息 |
| 流程定义内容 | GET /api/v1/wfe/definitions/{id}/content | XML/JSON 双格式 |
| 流程定义状态管理 | PUT /api/v1/wfe/definitions/{id}/state | 挂起/激活 |
| 流程定义删除 | DELETE /api/v1/wfe/definitions/{id} | 级联删除支持 |
| 流程实例发起 | POST /api/v1/wfe/instances | 含本体校验、变量初始化 |
| 流程实例列表 | GET /api/v1/wfe/instances | 多维度筛选 |
| 流程实例详情 | GET /api/v1/wfe/instances/{id} | 含活动路径 |
| 流程实例终止 | DELETE /api/v1/wfe/instances/{id} | 含活动任务终止 |
| 流程实例挂起/恢复 | PUT /api/v1/wfe/instances/{id}/state | - |
| 数据表 | 全部 DDL | wfe_process_definition 等核心表 |
| 基础设施 | Kafka Outbox | Outbox 写入 + Publisher 基础版 |

**验收标准**：能部署 BPMN 流程定义，发起流程实例，流程自动流转至第一个用户任务节点。

---

### 6.2 Sprint 2：任务管理与审批（M2）

**目标**：完成用户任务的完整审批能力，覆盖企业审批场景。

| 交付项 | API | 说明 |
|---|---|---|
| 待办任务查询 | GET /api/v1/wfe/tasks/todo | 含 SLA 状态计算 |
| 已办任务查询 | GET /api/v1/wfe/tasks/done | - |
| 任务详情 | GET /api/v1/wfe/tasks/{id} | 含表单定义、审批历史 |
| 审批同意 | POST /api/v1/wfe/tasks/{id}/approve | 含变量设置 |
| 审批拒绝 | POST /api/v1/wfe/tasks/{id}/reject | 三种拒绝模式 |
| 任务转交 | POST /api/v1/wfe/tasks/{id}/transfer | - |
| 任务退回 | POST /api/v1/wfe/tasks/{id}/return | 退回指定历史节点 |
| 任务加签 | POST /api/v1/wfe/tasks/{id}/add-signer | 前加签/后加签/并行加签 |
| 任务委派 | POST /api/v1/wfe/tasks/{id}/delegate | - |
| 任务催办 | POST /api/v1/wfe/tasks/{id}/urge | 多渠道通知 |
| 流程变量更新 | PUT /api/v1/wfe/instances/{id}/variables | - |
| 事件发布 | Kafka TASK_CREATED / TASK_COMPLETED | Outbox 完整版 |
| TECH-IAM 集成 | 用户/角色解析 | 审批人候选组解析 |
| TECH-RULE 集成 | 网关路由求值 | 排他网关条件评估 |

**验收标准**：完整审批流程可走通（发起 -> 经理审批 -> VP审批 -> 完成），支持同意/拒绝/转交/退回/加签/委派全部操作。

---

### 6.3 Sprint 3：流程历史与监控（M3）

**目标**：完成历史数据归档查询和流程运行监控能力。

| 交付项 | API | 说明 |
|---|---|---|
| 历史实例查询 | GET /api/v1/wfe/history/instances | 含耗时统计 |
| 历史任务查询 | GET /api/v1/wfe/history/tasks | 含逾期标记 |
| 历史活动查询 | GET /api/v1/wfe/history/activities | 完整执行路径 |
| 运行中统计 | GET /api/v1/wfe/monitor/statistics | 多维度分组统计 |
| SLA 预警 | GET /api/v1/wfe/monitor/sla-warnings | 实时逾期检测 |
| 瓶颈分析 | GET /api/v1/wfe/monitor/bottlenecks | 节点耗时分布分析 |
| SLA 逾期事件 | Kafka TASK_OVERDUE | 定时巡检 + 事件发布 |
| 数据归档 | 定时任务 | 历史数据分区归档 |

**验收标准**：能查询完整流程历史，仪表盘能展示实时运行统计、SLA 预警列表、瓶颈分析报告。

---

### 6.4 Sprint 4：事件订阅与回调（M4）

**目标**：完成事件回调订阅机制，支持外部系统接收流程事件。

| 交付项 | API | 说明 |
|---|---|---|
| 事件订阅注册 | POST /api/v1/wfe/events/subscriptions | 含重试策略配置 |
| 事件订阅列表 | GET /api/v1/wfe/events/subscriptions | - |
| 事件订阅更新 | PUT /api/v1/wfe/events/subscriptions/{id} | - |
| 事件订阅删除 | DELETE /api/v1/wfe/events/subscriptions/{id} | - |
| 事件回调投递 | POST {callbackUrl} | HMAC-SHA256 签名 |
| 事件投递日志 | wfe_event_delivery_log | 投递状态追踪 |
| DLQ 处理 | wfe.dlq topic | 超时重试 + 死信队列 |
| 事件重放 | 管理接口 | 手动重投失败事件 |

**验收标准**：外部系统可注册事件订阅，流程事件实时回调通知，支持签名验证、失败重试、死信处理。

---

### 6.5 Sprint 5：增强与优化（M5）

**目标**：性能优化、并发处理、高级特性。

| 交付项 | 说明 |
|---|---|
| 流程定义缓存 | Redis 缓存流程定义，减少 DB 查询 |
| 任务分配缓存 | Redis 缓存用户待办计数 |
| 分布式锁 | Redis 分布式锁防止任务并发审批 |
| 批处理优化 | 批量查询待办、批量完成任务 |
| 并行网关 | 支持并行网关多分支同时执行 |
| 定时器事件 | 支持定时器中间事件（延迟执行） |
| 子流程 | 支持嵌入式子流程与调用活动 |
| 多实例任务 | 支持会签（多人并行/顺序审批） |
| 租户隔离 | 完善多租户数据隔离 |
| 性能压测 | 全链路压测，目标 1000 TPS |

**验收标准**：通过全链路性能压测，支持并行网关、定时器、子流程等高级 BPMN 特性，多租户隔离正确。

---

## 附录 A：枚举值速查表

| 枚举 | 值 | 说明 |
|---|---|---|
| ProcessDefinitionStatus | ACTIVE / SUSPENDED / DEPRECATED | 流程定义状态 |
| ProcessInstanceStatus | RUNNING / COMPLETED / TERMINATED / SUSPENDED | 流程实例状态 |
| TaskStatus | CREATED / ASSIGNED / CLAIMED / DELEGATED / COMPLETED / CANCELLED | 任务状态 |
| TaskOutcome | APPROVED / REJECTED / TRANSFERRED / RETURNED / DELEGATED / ADD_SIGNER | 任务处理结果 |
| RejectMode | TERMINATE / RETURN_TO_START / RETURN_TO_PREVIOUS | 拒绝模式 |
| AddSignMode | BEFORE / AFTER / PARALLEL | 加签模式 |
| SlaStatus | NORMAL / WARNING / OVERDUE | SLA 状态 |
| BottleneckLevel | NONE / LOW / MEDIUM / HIGH | 瓶颈等级 |
| ActivityType | START_EVENT / END_EVENT / USER_TASK / SERVICE_TASK / EXCLUSIVE_GATEWAY / PARALLEL_GATEWAY / INCLUSIVE_GATEWAY / INTERMEDIATE_EVENT / CALL_ACTIVITY / SUB_PROCESS | 活动类型 |
| IdentityLinkType | ASSIGNEE / CANDIDATE_USER / CANDIDATE_GROUP / OWNER / DELEGATE | 身份关联类型 |
| EventType | PROCESS_STARTED / PROCESS_COMPLETED / PROCESS_TERMINATED / PROCESS_SUSPENDED / PROCESS_RESUMED / TASK_CREATED / TASK_ASSIGNED / TASK_CLAIMED / TASK_COMPLETED / TASK_CANCELLED / TASK_DELEGATED / TASK_TRANSFERRED / TASK_RETURNED / TASK_SIGNER_ADDED / TASK_OVERDUE / VARIABLE_CHANGED | 事件类型 |
| VariableType | STRING / INTEGER / LONG / DOUBLE / BOOLEAN / DATE / JSON / OBJECT | 变量类型 |
| OutboxStatus | PENDING / SENT / FAILED | Outbox 状态 |
| DeliveryStatus | PENDING / SUCCESS / FAILED / DEAD_LETTER | 投递状态 |
| Priority | 1 (LOW) / 2 (MEDIUM) / 3 (HIGH) | 优先级 |

## 附录 B：API 速查表

| 方法 | 路径 | 说明 | Sprint |
|---|---|---|---|
| POST | /api/v1/wfe/definitions | 部署流程定义 | M1 |
| GET | /api/v1/wfe/definitions | 查询流程定义列表 | M1 |
| GET | /api/v1/wfe/definitions/{definitionId} | 获取流程定义详情 | M1 |
| GET | /api/v1/wfe/definitions/{definitionId}/content | 获取流程定义 XML/JSON | M1 |
| PUT | /api/v1/wfe/definitions/{definitionId}/state | 挂起/激活流程定义 | M1 |
| DELETE | /api/v1/wfe/definitions/{definitionId} | 删除流程定义 | M1 |
| POST | /api/v1/wfe/instances | 发起流程 | M1 |
| GET | /api/v1/wfe/instances | 查询流程实例列表 | M1 |
| GET | /api/v1/wfe/instances/{instanceId} | 获取流程实例详情 | M1 |
| DELETE | /api/v1/wfe/instances/{instanceId} | 终止流程实例 | M1 |
| PUT | /api/v1/wfe/instances/{instanceId}/state | 挂起/恢复流程实例 | M1 |
| PUT | /api/v1/wfe/instances/{instanceId}/variables | 更新流程变量 | M2 |
| GET | /api/v1/wfe/tasks/todo | 查询待办任务 | M2 |
| GET | /api/v1/wfe/tasks/done | 查询已办任务 | M2 |
| GET | /api/v1/wfe/tasks/{taskId} | 获取任务详情 | M2 |
| POST | /api/v1/wfe/tasks/{taskId}/approve | 审批同意 | M2 |
| POST | /api/v1/wfe/tasks/{taskId}/reject | 审批拒绝 | M2 |
| POST | /api/v1/wfe/tasks/{taskId}/transfer | 任务转交 | M2 |
| POST | /api/v1/wfe/tasks/{taskId}/return | 任务退回 | M2 |
| POST | /api/v1/wfe/tasks/{taskId}/add-signer | 任务加签 | M2 |
| POST | /api/v1/wfe/tasks/{taskId}/delegate | 任务委派 | M2 |
| POST | /api/v1/wfe/tasks/{taskId}/urge | 任务催办 | M2 |
| GET | /api/v1/wfe/history/instances | 历史实例查询 | M3 |
| GET | /api/v1/wfe/history/tasks | 历史任务查询 | M3 |
| GET | /api/v1/wfe/history/activities | 历史活动查询 | M3 |
| GET | /api/v1/wfe/monitor/statistics | 运行中统计 | M3 |
| GET | /api/v1/wfe/monitor/sla-warnings | SLA 预警 | M3 |
| GET | /api/v1/wfe/monitor/bottlenecks | 瓶颈分析 | M3 |
| POST | /api/v1/wfe/events/subscriptions | 事件订阅注册 | M4 |
| GET | /api/v1/wfe/events/subscriptions | 查询事件订阅列表 | M4 |
| PUT | /api/v1/wfe/events/subscriptions/{subscriptionId} | 更新事件订阅 | M4 |
| DELETE | /api/v1/wfe/events/subscriptions/{subscriptionId} | 删除事件订阅 | M4 |
| POST | {callbackUrl} | 事件回调通知（WFE 调用订阅方） | M4 |

---

> 文档结束。如有疑问请联系 TECH-WFE 服务负责人。
