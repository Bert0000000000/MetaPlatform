# SPEC - EA 架构资产服务 API 规范（TECH-EA）

| 属性 | 值 |
|---|---|
| 文档版本 | v1.0 |
| 文档日期 | 2026-07-16 |
| 服务模块 | TECH-EA |
| 包名 | `com.metaplatform.ea` |
| API 路径前缀 | `/api/v1/ea` |
| 技术栈 | Java 21 + Spring Boot 3.4 + PostgreSQL 17 |
| 上游依赖 | TECH-ONT（本体引擎） |
| 下游消费 | APP-ARCH（架构中心前端） |

---

## 1. 服务概述

### 1.1 定位

TECH-EA 是 Mate Platform 的企业级架构资产服务，负责对企业架构（EA）的全生命周期管理。服务覆盖业务架构、应用架构、数据架构、技术架构四大领域，并提供架构治理（评审、标准规范、变更影响分析）能力。

TECH-EA 与 TECH-ONT 本体引擎深度联动：业务架构中的业务能力、价值流、业务流程等概念映射到 Ontology 实体，实现架构资产与语义模型的统一。

### 1.2 技术栈

| 层 | 技术选型 |
|---|---|
| 语言/框架 | Java 21 + Spring Boot 3.4 |
| 数据库 | PostgreSQL 17 |
| 缓存 | Redis 7.4 |
| 消息队列 | Kafka 3.9（Outbox 模式） |
| 可观测性 | OpenTelemetry 1.45 + Prometheus |
| 认证 | TECH-IAM JWT（Spring Security） |

### 1.3 上下游关系

```
TECH-EA ← TECH-ONT（本体引擎，概念映射/一致性检查）
TECH-EA → APP-ARCH（架构中心前端，所有 EA 管理界面）
TECH-EA ← TECH-IAM（身份认证与权限）
TECH-EA ← TECH-GW（API 网关）
TECH-EA ← TECH-MSG（消息队列）
TECH-EA ← TECH-OBS（可观测性）
```

### 1.4 核心职责

| 序号 | 职责域 | 说明 |
|---|---|---|
| 1 | 业务架构管理 | 业务能力地图、价值流、业务流程、组织角色 |
| 2 | 应用架构管理 | 应用系统注册、应用间依赖关系、技术债务 |
| 3 | 数据架构管理 | 数据主题域、数据实体、数据流转、数据资产目录 |
| 4 | 技术架构管理 | 技术栈清单、基础设施拓扑、技术标准 |
| 5 | 架构治理 | 架构评审、标准规范、变更影响分析 |
| 6 | Ontology 联动 | 业务架构概念映射到 Ontology 实体、一致性检查 |

---

## 2. 通用约定

### 2.1 路径前缀

所有 API 路径统一以 `/api/v1/ea` 为前缀。

### 2.2 统一响应体

所有接口返回统一的 JSON 响应结构：

```json
{
  "code": 0,
  "message": "success",
  "data": { ... },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | `integer` | 业务状态码，`0` 表示成功，非 `0` 表示业务错误 |
| `message` | `string` | 状态描述信息 |
| `data` | `object / array / null` | 业务数据载荷，失败时为 `null` |
| `traceId` | `string` | 全链路追踪 ID，UUID 格式，贯穿所有服务调用与 Kafka 消息 |

### 2.3 认证

所有 API 需携带 JWT Bearer Token：

```
Authorization: Bearer <jwt_token>
```

JWT 由 TECH-IAM 签发，包含 `userId`、`tenantId`、`roles` 等声明。未携带或无效 Token 返回 `401`。

### 2.4 请求头

| 请求头 | 必填 | 说明 |
|---|---|---|
| `Authorization` | 是 | `Bearer <jwt_token>` |
| `Content-Type` | 是 | `application/json`（POST/PUT 请求） |
| `X-Trace-Id` | 否 | 调用方传入的追踪 ID，未传则自动生成 |
| `X-Tenant-Id` | 是 | 租户 ID（多租户隔离） |

### 2.5 错误码

#### 2.5.1 HTTP 状态码

| HTTP Status | 含义 |
|---|---|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突 |
| 422 | 业务校验失败 |
| 500 | 服务端内部错误 |

#### 2.5.2 业务错误码

| code | message | HTTP Status | 说明 |
|---|---|---|---|
| 0 | success | 200 | 成功 |
| 40001 | invalid parameter: {detail} | 400 | 参数校验失败 |
| 40002 | invalid json body | 400 | 请求体 JSON 格式错误 |
| 40101 | unauthorized | 401 | 未携带或无效 Token |
| 40301 | forbidden: {detail} | 403 | 无操作权限 |
| 40401 | resource not found: {resource}/{id} | 404 | 资源不存在 |
| 40901 | resource conflict: {detail} | 409 | 唯一约束冲突/状态冲突 |
| 42201 | business validation failed: {detail} | 422 | 业务校验不通过 |
| 42202 | ontology mapping conflict: {detail} | 422 | Ontology 映射冲突 |
| 42203 | capability cycle detected | 422 | 能力层级存在环 |
| 42204 | dependency cycle detected | 422 | 应用依赖存在环 |
| 42205 | review status transition not allowed: {from}→{to} | 422 | 评审状态流转非法 |
| 50001 | internal server error | 500 | 服务端内部错误 |
| 50002 | ontology service unavailable | 500 | TECH-ONT 服务不可用 |
| 50003 | database operation failed | 500 | 数据库操作失败 |

### 2.6 分页

列表类接口统一使用分页参数：

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `page` | `integer` | 1 | 页码，从 1 开始 |
| `size` | `integer` | 20 | 每页条数，最大 100 |
| `sort` | `string` | `createdAt,desc` | 排序，格式 `field,direction` |

分页响应结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [ ... ],
    "total": 156,
    "page": 1,
    "size": 20,
    "totalPages": 8
  },
  "traceId": "xxx"
}
```

### 2.7 trace_id 传播

- 所有 HTTP 请求头中的 `X-Trace-Id` 被解析并存入 MDC
- 响应体中 `traceId` 字段返回当前请求的追踪 ID
- Kafka 消息头包含 `X-Trace-Id`，确保跨服务链路追踪
- 未传入 `X-Trace-Id` 时，服务自动生成 UUID

### 2.8 枚举定义

#### 2.8.1 架构层级

| 值 | 说明 |
|---|---|
| `BUSINESS` | 业务架构 |
| `APPLICATION` | 应用架构 |
| `DATA` | 数据架构 |
| `TECHNOLOGY` | 技术架构 |

#### 2.8.2 生命周期状态

| 值 | 说明 |
|---|---|
| `PROPOSED` | 提议中 |
| `APPROVED` | 已批准 |
| `ACTIVE` | 活跃 |
| `DEPRECATED` | 已废弃 |
| `RETIRED` | 已退役 |

#### 2.8.3 评审状态

| 值 | 说明 |
|---|---|
| `DRAFT` | 草稿 |
| `SUBMITTED` | 已提交待评审 |
| `UNDER_REVIEW` | 评审中 |
| `APPROVED` | 评审通过 |
| `REJECTED` | 评审驳回 |
| `WITHDRAWN` | 已撤回 |

#### 2.8.4 优先级

| 值 | 说明 |
|---|---|
| `CRITICAL` | 紧急 |
| `HIGH` | 高 |
| `MEDIUM` | 中 |
| `LOW` | 低 |

#### 2.8.5 技术债务状态

| 值 | 说明 |
|---|---|
| `OPEN` | 待处理 |
| `IN_PROGRESS` | 处理中 |
| `RESOLVED` | 已解决 |
| `WONT_FIX` | 不修复 |

---

## 3. API 接口详情

---

### 3.1 业务架构 API

业务架构管理涵盖业务能力地图、价值流、业务流程、组织角色四个子域。

---

#### 3.1.1 业务能力 - 列表查询

查询业务能力列表，支持分页、关键词搜索、层级过滤。

```
GET /api/v1/ea/business-capabilities
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `page` | query | integer | 否 | 页码，默认 1 |
| `size` | query | integer | 否 | 每页条数，默认 20 |
| `sort` | query | string | 否 | 排序字段 |
| `keyword` | query | string | 否 | 名称/编码关键词 |
| `parentId` | query | string | 否 | 父能力 ID，传 `root` 查询顶层能力 |
| `level` | query | integer | 否 | 能力层级（1=L1, 2=L2, ...） |
| `lifecycle` | query | string | 否 | 生命周期状态枚举 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "cap-001",
        "code": "BC-001",
        "name": "客户管理",
        "description": "管理客户全生命周期",
        "level": 1,
        "parentId": null,
        "childrenCount": 3,
        "lifecycle": "ACTIVE",
        "ownerRole": "org-role-001",
        "ontologyEntityId": "ont-entity-100",
        "createdAt": "2026-07-16T08:00:00Z",
        "updatedAt": "2026-07-16T10:30:00Z"
      },
      {
        "id": "cap-002",
        "code": "BC-002",
        "name": "订单管理",
        "description": "订单创建与履约",
        "level": 1,
        "parentId": null,
        "childrenCount": 2,
        "lifecycle": "ACTIVE",
        "ownerRole": null,
        "ontologyEntityId": null,
        "createdAt": "2026-07-16T08:05:00Z",
        "updatedAt": "2026-07-16T08:05:00Z"
      }
    ],
    "total": 2,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| `size` 超过 100 | 40001 | 400 |
| `level` 非正整数 | 40001 | 400 |

---

#### 3.1.2 业务能力 - 获取详情

```
GET /api/v1/ea/business-capabilities/{id}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 业务能力 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "cap-001",
    "code": "BC-001",
    "name": "客户管理",
    "description": "管理客户全生命周期，包含客户档案、客户分层、客户洞察等子能力",
    "level": 1,
    "parentId": null,
    "parent": null,
    "children": [
      {
        "id": "cap-001-01",
        "code": "BC-001-01",
        "name": "客户档案管理",
        "level": 2
      },
      {
        "id": "cap-001-02",
        "code": "BC-001-02",
        "name": "客户分层",
        "level": 2
      }
    ],
    "lifecycle": "ACTIVE",
    "ownerRole": {
      "id": "org-role-001",
      "name": "客户管理部"
    },
    "ontologyEntityId": "ont-entity-100",
    "ontologyEntityName": "CustomerManagement",
    "linkedValueStreams": [
      { "id": "vs-001", "name": "客户获取价值流" }
    ],
    "linkedProcesses": [
      { "id": "bp-001", "name": "客户注册流程" }
    ],
    "metadata": {
      "criticality": "HIGH",
      "businessValue": "核心业务能力"
    },
    "createdAt": "2026-07-16T08:00:00Z",
    "updatedAt": "2026-07-16T10:30:00Z",
    "createdBy": "user-001",
    "updatedBy": "user-002"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 能力 ID 不存在 | 40401 | 404 |

---

#### 3.1.3 业务能力 - 创建

```
POST /api/v1/ea/business-capabilities
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | string | 是 | 能力编码，租户内唯一 |
| `name` | string | 是 | 能力名称 |
| `description` | string | 否 | 描述 |
| `parentId` | string | 否 | 父能力 ID，为空表示顶层能力 |
| `lifecycle` | string | 否 | 生命周期状态，默认 `PROPOSED` |
| `ownerRoleId` | string | 否 | 负责角色 ID |
| `criticality` | string | 否 | 关键程度，枚举 `CRITICAL/HIGH/MEDIUM/LOW` |
| `metadata` | object | 否 | 扩展元数据 |

**请求示例**

```json
{
  "code": "BC-003",
  "name": "供应链管理",
  "description": "管理供应商、采购、库存与物流",
  "parentId": null,
  "lifecycle": "PROPOSED",
  "ownerRoleId": "org-role-005",
  "criticality": "HIGH",
  "metadata": {
    "businessValue": "核心供应链能力"
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "cap-003",
    "code": "BC-003",
    "name": "供应链管理",
    "description": "管理供应商、采购、库存与物流",
    "level": 1,
    "parentId": null,
    "lifecycle": "PROPOSED",
    "ownerRole": "org-role-005",
    "ontologyEntityId": null,
    "createdAt": "2026-07-16T11:00:00Z",
    "updatedAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| `code` 为空 | 40001 | 400 |
| `code` 重复 | 40901 | 409 |
| `parentId` 不存在 | 40401 | 404 |
| `ownerRoleId` 不存在 | 40401 | 404 |

---

#### 3.1.4 业务能力 - 更新

```
PUT /api/v1/ea/business-capabilities/{id}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 业务能力 ID |

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 否 | 能力名称 |
| `description` | string | 否 | 描述 |
| `lifecycle` | string | 否 | 生命周期状态 |
| `ownerRoleId` | string | 否 | 负责角色 ID |
| `criticality` | string | 否 | 关键程度 |
| `metadata` | object | 否 | 扩展元数据 |

**请求示例**

```json
{
  "name": "供应链管理（更新）",
  "description": "管理供应商、采购、库存、物流与退货",
  "lifecycle": "ACTIVE",
  "criticality": "CRITICAL"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "cap-003",
    "code": "BC-003",
    "name": "供应链管理（更新）",
    "description": "管理供应商、采购、库存、物流与退货",
    "level": 1,
    "parentId": null,
    "lifecycle": "ACTIVE",
    "ownerRole": "org-role-005",
    "ontologyEntityId": null,
    "createdAt": "2026-07-16T11:00:00Z",
    "updatedAt": "2026-07-16T11:15:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 能力 ID 不存在 | 40401 | 404 |
| `lifecycle` 枚举值非法 | 40001 | 400 |

---

#### 3.1.5 业务能力 - 删除

```
DELETE /api/v1/ea/business-capabilities/{id}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 业务能力 ID |

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `cascade` | boolean | 否 | 是否级联删除子能力，默认 `false` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": null,
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 能力 ID 不存在 | 40401 | 404 |
| 存在子能力且 `cascade=false` | 42201 | 422 |
| 能力已关联价值流/业务流程 | 42201 | 422 |

---

#### 3.1.6 业务能力 - 获取能力层级树

获取完整业务能力层级树结构。

```
GET /api/v1/ea/business-capabilities/tree
```

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `rootId` | string | 否 | 指定根节点 ID，为空则返回完整树 |
| `maxDepth` | integer | 否 | 最大深度，默认无限制 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tree": [
      {
        "id": "cap-001",
        "code": "BC-001",
        "name": "客户管理",
        "level": 1,
        "lifecycle": "ACTIVE",
        "children": [
          {
            "id": "cap-001-01",
            "code": "BC-001-01",
            "name": "客户档案管理",
            "level": 2,
            "lifecycle": "ACTIVE",
            "children": []
          }
        ]
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| `rootId` 不存在 | 40401 | 404 |

---

#### 3.1.7 业务能力 - 移动层级

修改业务能力的父节点，实现层级调整。

```
PUT /api/v1/ea/business-capabilities/{id}/parent
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 业务能力 ID |

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `parentId` | string | 是 | 新父能力 ID，传 `null` 移到顶层 |

**请求示例**

```json
{
  "parentId": "cap-001"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "cap-002",
    "code": "BC-002",
    "name": "订单管理",
    "level": 2,
    "parentId": "cap-001",
    "updatedAt": "2026-07-16T12:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 能力 ID 不存在 | 40401 | 404 |
| 父能力 ID 不存在 | 40401 | 404 |
| 将能力移到自身子树下（环检测） | 42203 | 422 |

---

#### 3.1.8 价值流 - 列表查询

```
GET /api/v1/ea/value-streams
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `page` | query | integer | 否 | 页码 |
| `size` | query | integer | 否 | 每页条数 |
| `keyword` | query | string | 否 | 名称关键词 |
| `capabilityId` | query | string | 否 | 关联业务能力 ID |
| `lifecycle` | query | string | 否 | 生命周期状态 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "vs-001",
        "code": "VS-001",
        "name": "客户获取价值流",
        "description": "从潜在客户识别到首次购买完成的价值创造过程",
        "stagesCount": 5,
        "lifecycle": "ACTIVE",
        "linkedCapabilityId": "cap-001",
        "createdAt": "2026-07-16T08:00:00Z",
        "updatedAt": "2026-07-16T09:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.9 价值流 - 获取详情

```
GET /api/v1/ea/value-streams/{id}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "vs-001",
    "code": "VS-001",
    "name": "客户获取价值流",
    "description": "从潜在客户识别到首次购买完成的价值创造过程",
    "lifecycle": "ACTIVE",
    "linkedCapabilityId": "cap-001",
    "stages": [
      {
        "id": "vs-stage-001",
        "name": "潜在客户识别",
        "order": 1,
        "entryCriteria": "市场活动触发",
        "exitCriteria": "确认潜在客户身份",
        "participantRoleIds": ["org-role-002"]
      },
      {
        "id": "vs-stage-002",
        "name": "需求确认",
        "order": 2,
        "entryCriteria": "潜在客户身份确认",
        "exitCriteria": "需求清单确认",
        "participantRoleIds": ["org-role-002", "org-role-003"]
      }
    ],
    "createdAt": "2026-07-16T08:00:00Z",
    "updatedAt": "2026-07-16T09:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 价值流 ID 不存在 | 40401 | 404 |

---

#### 3.1.10 价值流 - 创建

```
POST /api/v1/ea/value-streams
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | string | 是 | 价值流编码，租户内唯一 |
| `name` | string | 是 | 价值流名称 |
| `description` | string | 否 | 描述 |
| `linkedCapabilityId` | string | 否 | 关联业务能力 ID |
| `lifecycle` | string | 否 | 生命周期状态，默认 `PROPOSED` |

**请求示例**

```json
{
  "code": "VS-002",
  "name": "订单履约价值流",
  "description": "从订单创建到交付完成",
  "linkedCapabilityId": "cap-002"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "vs-002",
    "code": "VS-002",
    "name": "订单履约价值流",
    "description": "从订单创建到交付完成",
    "stagesCount": 0,
    "lifecycle": "PROPOSED",
    "linkedCapabilityId": "cap-002",
    "createdAt": "2026-07-16T11:00:00Z",
    "updatedAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| `code` 重复 | 40901 | 409 |
| `linkedCapabilityId` 不存在 | 40401 | 404 |

---

#### 3.1.11 价值流 - 更新

```
PUT /api/v1/ea/value-streams/{id}
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 否 | 名称 |
| `description` | string | 否 | 描述 |
| `lifecycle` | string | 否 | 生命周期状态 |
| `linkedCapabilityId` | string | 否 | 关联业务能力 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "vs-002",
    "code": "VS-002",
    "name": "订单履约价值流（更新）",
    "description": "从订单创建到交付完成及售后",
    "lifecycle": "ACTIVE",
    "linkedCapabilityId": "cap-002",
    "updatedAt": "2026-07-16T11:30:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.12 价值流 - 删除

```
DELETE /api/v1/ea/value-streams/{id}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 价值流 ID 不存在 | 40401 | 404 |
| 存在关联的业务流程 | 42201 | 422 |

---

#### 3.1.13 价值流 - 获取阶段列表

```
GET /api/v1/ea/value-streams/{id}/stages
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "vs-stage-001",
      "name": "潜在客户识别",
      "order": 1,
      "entryCriteria": "市场活动触发",
      "exitCriteria": "确认潜在客户身份",
      "participantRoleIds": ["org-role-002"]
    }
  ],
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.14 价值流 - 添加阶段

```
POST /api/v1/ea/value-streams/{id}/stages
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 是 | 阶段名称 |
| `order` | integer | 是 | 顺序号 |
| `entryCriteria` | string | 否 | 进入条件 |
| `exitCriteria` | string | 否 | 退出条件 |
| `participantRoleIds` | array | 否 | 参与角色 ID 列表 |

**请求示例**

```json
{
  "name": "方案报价",
  "order": 3,
  "entryCriteria": "需求清单确认",
  "exitCriteria": "客户接受报价",
  "participantRoleIds": ["org-role-003"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "vs-stage-003",
    "name": "方案报价",
    "order": 3,
    "entryCriteria": "需求清单确认",
    "exitCriteria": "客户接受报价",
    "participantRoleIds": ["org-role-003"]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| `order` 与已有阶段重复 | 40901 | 409 |
| 价值流 ID 不存在 | 40401 | 404 |

---

#### 3.1.15 价值流 - 删除阶段

```
DELETE /api/v1/ea/value-streams/{id}/stages/{stageId}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": null,
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.16 业务流程 - 列表查询

```
GET /api/v1/ea/business-processes
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `page` | query | integer | 否 | 页码 |
| `size` | query | integer | 否 | 每页条数 |
| `keyword` | query | string | 否 | 名称关键词 |
| `capabilityId` | query | string | 否 | 关联业务能力 ID |
| `valueStreamId` | query | string | 否 | 关联价值流 ID |
| `lifecycle` | query | string | 否 | 生命周期状态 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "bp-001",
        "code": "BP-001",
        "name": "客户注册流程",
        "description": "新客户在线注册并完成身份认证",
        "processType": "PRIMARY",
        "lifecycle": "ACTIVE",
        "linkedCapabilityIds": ["cap-001"],
        "linkedValueStreamId": "vs-001",
        "ownerRoleId": "org-role-001",
        "createdAt": "2026-07-16T08:00:00Z",
        "updatedAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.17 业务流程 - 获取详情

```
GET /api/v1/ea/business-processes/{id}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "bp-001",
    "code": "BP-001",
    "name": "客户注册流程",
    "description": "新客户在线注册并完成身份认证",
    "processType": "PRIMARY",
    "lifecycle": "ACTIVE",
    "linkedCapabilities": [
      { "id": "cap-001", "name": "客户管理" }
    ],
    "linkedValueStream": {
      "id": "vs-001",
      "name": "客户获取价值流"
    },
    "ownerRole": {
      "id": "org-role-001",
      "name": "客户管理部"
    },
    "supportingApplications": [
      { "id": "app-001", "name": "CRM 系统" }
    ],
    "metadata": {
      "frequency": "高",
      "automationLevel": "半自动"
    },
    "createdAt": "2026-07-16T08:00:00Z",
    "updatedAt": "2026-07-16T08:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.18 业务流程 - 创建

```
POST /api/v1/ea/business-processes
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | string | 是 | 流程编码，租户内唯一 |
| `name` | string | 是 | 流程名称 |
| `description` | string | 否 | 描述 |
| `processType` | string | 否 | 流程类型：`PRIMARY/MANAGEMENT/SUPPORT` |
| `lifecycle` | string | 否 | 生命周期状态，默认 `PROPOSED` |
| `linkedCapabilityIds` | array | 否 | 关联业务能力 ID 列表 |
| `linkedValueStreamId` | string | 否 | 关联价值流 ID |
| `ownerRoleId` | string | 否 | 负责角色 ID |
| `metadata` | object | 否 | 扩展元数据 |

**请求示例**

```json
{
  "code": "BP-002",
  "name": "订单审批流程",
  "description": "大额订单多级审批",
  "processType": "MANAGEMENT",
  "linkedCapabilityIds": ["cap-002"],
  "ownerRoleId": "org-role-004"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "bp-002",
    "code": "BP-002",
    "name": "订单审批流程",
    "description": "大额订单多级审批",
    "processType": "MANAGEMENT",
    "lifecycle": "PROPOSED",
    "linkedCapabilityIds": ["cap-002"],
    "linkedValueStreamId": null,
    "ownerRoleId": "org-role-004",
    "createdAt": "2026-07-16T11:00:00Z",
    "updatedAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.19 业务流程 - 更新

```
PUT /api/v1/ea/business-processes/{id}
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 否 | 名称 |
| `description` | string | 否 | 描述 |
| `processType` | string | 否 | 流程类型 |
| `lifecycle` | string | 否 | 生命周期状态 |
| `linkedValueStreamId` | string | 否 | 关联价值流 ID |
| `ownerRoleId` | string | 否 | 负责角色 ID |
| `metadata` | object | 否 | 扩展元数据 |

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 流程 ID 不存在 | 40401 | 404 |
| `linkedValueStreamId` 不存在 | 40401 | 404 |

---

#### 3.1.20 业务流程 - 删除

```
DELETE /api/v1/ea/business-processes/{id}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 流程 ID 不存在 | 40401 | 404 |
| 流程关联了活跃的审批工作流 | 42201 | 422 |

---

#### 3.1.21 业务流程 - 关联业务能力

```
POST /api/v1/ea/business-processes/{id}/capabilities/{capabilityId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 业务流程 ID |
| `capabilityId` | string | 业务能力 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "processId": "bp-002",
    "capabilityId": "cap-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 流程或能力 ID 不存在 | 40401 | 404 |
| 关联已存在 | 40901 | 409 |

---

#### 3.1.22 业务流程 - 取消关联业务能力

```
DELETE /api/v1/ea/business-processes/{id}/capabilities/{capabilityId}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": null,
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.23 组织角色 - 列表查询

```
GET /api/v1/ea/org-roles
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `page` | query | integer | 否 | 页码 |
| `size` | query | integer | 否 | 每页条数 |
| `keyword` | query | string | 否 | 名称关键词 |
| `parentId` | query | string | 否 | 父角色 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "org-role-001",
        "code": "ORG-001",
        "name": "客户管理部",
        "description": "负责客户全生命周期管理",
        "parentId": null,
        "roleType": "DEPARTMENT",
        "createdAt": "2026-07-16T08:00:00Z",
        "updatedAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.24 组织角色 - 获取详情

```
GET /api/v1/ea/org-roles/{id}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "org-role-001",
    "code": "ORG-001",
    "name": "客户管理部",
    "description": "负责客户全生命周期管理",
    "parentId": null,
    "roleType": "DEPARTMENT",
    "ownedCapabilities": [
      { "id": "cap-001", "name": "客户管理" }
    ],
    "ownedProcesses": [
      { "id": "bp-001", "name": "客户注册流程" }
    ],
    "createdAt": "2026-07-16T08:00:00Z",
    "updatedAt": "2026-07-16T08:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.25 组织角色 - 创建

```
POST /api/v1/ea/org-roles
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | string | 是 | 角色编码，租户内唯一 |
| `name` | string | 是 | 角色名称 |
| `description` | string | 否 | 描述 |
| `parentId` | string | 否 | 父角色 ID |
| `roleType` | string | 否 | 角色类型：`DEPARTMENT/TEAM/POSITION/EXTERNAL` |

**请求示例**

```json
{
  "code": "ORG-006",
  "name": "数据治理团队",
  "description": "负责数据标准与质量治理",
  "parentId": "org-role-001",
  "roleType": "TEAM"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "org-role-006",
    "code": "ORG-006",
    "name": "数据治理团队",
    "description": "负责数据标准与质量治理",
    "parentId": "org-role-001",
    "roleType": "TEAM",
    "createdAt": "2026-07-16T11:00:00Z",
    "updatedAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.26 组织角色 - 更新

```
PUT /api/v1/ea/org-roles/{id}
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 否 | 名称 |
| `description` | string | 否 | 描述 |
| `parentId` | string | 否 | 父角色 ID |
| `roleType` | string | 否 | 角色类型 |

---

#### 3.1.27 组织角色 - 删除

```
DELETE /api/v1/ea/org-roles/{id}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 角色 ID 不存在 | 40401 | 404 |
| 角色被业务能力/业务流程引用 | 42201 | 422 |
| 存在子角色 | 42201 | 422 |

---

### 3.2 应用架构 API

应用架构管理涵盖应用系统注册、应用间依赖关系、技术债务三个子域。

---

#### 3.2.1 应用系统 - 列表查询

```
GET /api/v1/ea/applications
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `page` | query | integer | 否 | 页码 |
| `size` | query | integer | 否 | 每页条数 |
| `keyword` | query | string | 否 | 名称关键词 |
| `lifecycle` | query | string | 否 | 生命周期状态 |
| `techStackId` | query | string | 否 | 使用的技术栈 ID |
| `capabilityId` | query | string | 否 | 支撑的业务能力 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "app-001",
        "code": "APP-CRM",
        "name": "CRM 系统",
        "description": "客户关系管理系统",
        "applicationType": "CORE",
        "lifecycle": "ACTIVE",
        "techStacks": [
          { "id": "ts-001", "name": "Spring Boot 3.4" }
        ],
        "supportingCapabilities": [
          { "id": "cap-001", "name": "客户管理" }
        ],
        "ownerRoleId": "org-role-001",
        "criticality": "HIGH",
        "createdAt": "2026-07-16T08:00:00Z",
        "updatedAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.2.2 应用系统 - 获取详情

```
GET /api/v1/ea/applications/{id}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "app-001",
    "code": "APP-CRM",
    "name": "CRM 系统",
    "description": "客户关系管理系统",
    "applicationType": "CORE",
    "lifecycle": "ACTIVE",
    "techStacks": [
      { "id": "ts-001", "name": "Spring Boot 3.4", "category": "BACKEND" },
      { "id": "ts-002", "name": "React 19", "category": "FRONTEND" }
    ],
    "supportingCapabilities": [
      { "id": "cap-001", "name": "客户管理" }
    ],
    "supportingProcesses": [
      { "id": "bp-001", "name": "客户注册流程" }
    ],
    "dependencies": {
      "outbound": [
        { "id": "dep-001", "targetAppId": "app-002", "targetAppName": "订单系统", "dependencyType": "API_CALL" }
      ],
      "inbound": [
        { "id": "dep-002", "sourceAppId": "app-003", "sourceAppName": "营销系统", "dependencyType": "API_CALL" }
      ]
    },
    "ownerRole": {
      "id": "org-role-001",
      "name": "客户管理部"
    },
    "technicalDebts": [
      { "id": "td-001", "title": "CRM 历史数据未归档", "severity": "MEDIUM", "status": "OPEN" }
    ],
    "criticality": "HIGH",
    "deploymentInfo": {
      "environment": "production",
      "cluster": "k8s-prod-cluster-01"
    },
    "createdAt": "2026-07-16T08:00:00Z",
    "updatedAt": "2026-07-16T08:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.2.3 应用系统 - 创建

```
POST /api/v1/ea/applications
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | string | 是 | 应用编码，租户内唯一 |
| `name` | string | 是 | 应用名称 |
| `description` | string | 否 | 描述 |
| `applicationType` | string | 否 | 应用类型：`CORE/SUPPORTING/UTILITY/EXTERNAL` |
| `lifecycle` | string | 否 | 生命周期状态，默认 `PROPOSED` |
| `techStackIds` | array | 否 | 技术栈 ID 列表 |
| `capabilityIds` | array | 否 | 支撑的业务能力 ID 列表 |
| `ownerRoleId` | string | 否 | 负责角色 ID |
| `criticality` | string | 否 | 关键程度 |
| `deploymentInfo` | object | 否 | 部署信息 |

**请求示例**

```json
{
  "code": "APP-ERP",
  "name": "ERP 系统",
  "description": "企业资源计划系统",
  "applicationType": "CORE",
  "lifecycle": "PROPOSED",
  "techStackIds": ["ts-001"],
  "capabilityIds": ["cap-003"],
  "ownerRoleId": "org-role-005",
  "criticality": "CRITICAL"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "app-004",
    "code": "APP-ERP",
    "name": "ERP 系统",
    "description": "企业资源计划系统",
    "applicationType": "CORE",
    "lifecycle": "PROPOSED",
    "techStacks": [
      { "id": "ts-001", "name": "Spring Boot 3.4" }
    ],
    "supportingCapabilities": [
      { "id": "cap-003", "name": "供应链管理" }
    ],
    "ownerRoleId": "org-role-005",
    "criticality": "CRITICAL",
    "createdAt": "2026-07-16T11:00:00Z",
    "updatedAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| `code` 重复 | 40901 | 409 |
| `techStackIds` 中有不存在 ID | 40401 | 404 |
| `capabilityIds` 中有不存在 ID | 40401 | 404 |

---

#### 3.2.4 应用系统 - 更新

```
PUT /api/v1/ea/applications/{id}
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 否 | 名称 |
| `description` | string | 否 | 描述 |
| `applicationType` | string | 否 | 应用类型 |
| `lifecycle` | string | 否 | 生命周期状态 |
| `techStackIds` | array | 否 | 技术栈 ID 列表（全量替换） |
| `capabilityIds` | array | 否 | 支撑业务能力 ID 列表（全量替换） |
| `ownerRoleId` | string | 否 | 负责角色 ID |
| `criticality` | string | 否 | 关键程度 |
| `deploymentInfo` | object | 否 | 部署信息 |

---

#### 3.2.5 应用系统 - 删除

```
DELETE /api/v1/ea/applications/{id}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 应用 ID 不存在 | 40401 | 404 |
| 存在依赖关系（作为源或目标） | 42201 | 422 |
| 应用关联技术债务 | 42201 | 422 |

---

#### 3.2.6 依赖关系 - 查询应用依赖列表

```
GET /api/v1/ea/applications/{id}/dependencies
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `direction` | query | string | 否 | 方向：`outbound/inbound/all`，默认 `all` |
| `dependencyType` | query | string | 否 | 依赖类型 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "applicationId": "app-001",
    "outbound": [
      {
        "id": "dep-001",
        "sourceAppId": "app-001",
        "sourceAppName": "CRM 系统",
        "targetAppId": "app-002",
        "targetAppName": "订单系统",
        "dependencyType": "API_CALL",
        "description": "CRM 调用订单系统的订单查询 API",
        "criticality": "HIGH",
        "createdAt": "2026-07-16T08:00:00Z"
      }
    ],
    "inbound": [
      {
        "id": "dep-002",
        "sourceAppId": "app-003",
        "sourceAppName": "营销系统",
        "targetAppId": "app-001",
        "targetAppName": "CRM 系统",
        "dependencyType": "DATA_FLOW",
        "description": "营销系统推送潜客数据到 CRM",
        "criticality": "MEDIUM",
        "createdAt": "2026-07-16T08:00:00Z"
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.2.7 依赖关系 - 添加依赖

```
POST /api/v1/ea/applications/{id}/dependencies
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `targetAppId` | string | 是 | 目标应用 ID |
| `dependencyType` | string | 是 | 依赖类型：`API_CALL/DATA_FLOW/MESSAGE_QUEUE/SHARED_DB/FILE_TRANSFER` |
| `description` | string | 否 | 依赖描述 |
| `criticality` | string | 否 | 依赖关键程度 |

**请求示例**

```json
{
  "targetAppId": "app-002",
  "dependencyType": "API_CALL",
  "description": "CRM 调用订单系统的订单查询 API",
  "criticality": "HIGH"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "dep-001",
    "sourceAppId": "app-001",
    "targetAppId": "app-002",
    "dependencyType": "API_CALL",
    "description": "CRM 调用订单系统的订单查询 API",
    "criticality": "HIGH",
    "createdAt": "2026-07-16T12:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 源应用或目标应用不存在 | 40401 | 404 |
| 源应用与目标应用相同 | 40001 | 400 |
| 依赖已存在 | 40901 | 409 |
| 依赖关系形成环 | 42204 | 422 |

---

#### 3.2.8 依赖关系 - 删除依赖

```
DELETE /api/v1/ea/applications/{id}/dependencies/{depId}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": null,
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.2.9 依赖关系 - 获取依赖图

获取全量应用依赖拓扑图，用于可视化展示。

```
GET /api/v1/ea/applications/dependency-graph
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `lifecycle` | query | string | 否 | 过滤应用生命周期状态 |
| `dependencyType` | query | string | 否 | 过滤依赖类型 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "nodes": [
      { "id": "app-001", "name": "CRM 系统", "type": "CORE", "lifecycle": "ACTIVE" },
      { "id": "app-002", "name": "订单系统", "type": "CORE", "lifecycle": "ACTIVE" },
      { "id": "app-003", "name": "营销系统", "type": "SUPPORTING", "lifecycle": "ACTIVE" }
    ],
    "edges": [
      { "source": "app-001", "target": "app-002", "type": "API_CALL", "criticality": "HIGH" },
      { "source": "app-003", "target": "app-001", "type": "DATA_FLOW", "criticality": "MEDIUM" }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.2.10 技术债务 - 列表查询

```
GET /api/v1/ea/technical-debts
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `page` | query | integer | 否 | 页码 |
| `size` | query | integer | 否 | 每页条数 |
| `applicationId` | query | string | 否 | 关联应用 ID |
| `status` | query | string | 否 | 债务状态 |
| `severity` | query | string | 否 | 严重程度 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "td-001",
        "title": "CRM 历史数据未归档",
        "description": "超过 3 年的客户交互数据未归档，查询性能下降",
        "applicationId": "app-001",
        "applicationName": "CRM 系统",
        "severity": "MEDIUM",
        "status": "OPEN",
        "estimatedEffort": "5人天",
        "dueDate": "2026-09-01",
        "assignedTo": "user-003",
        "createdAt": "2026-07-16T08:00:00Z",
        "updatedAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.2.11 技术债务 - 获取详情

```
GET /api/v1/ea/technical-debts/{id}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "td-001",
    "title": "CRM 历史数据未归档",
    "description": "超过 3 年的客户交互数据未归档，查询性能下降",
    "application": {
      "id": "app-001",
      "name": "CRM 系统"
    },
    "severity": "MEDIUM",
    "status": "OPEN",
    "category": "DATA_QUALITY",
    "estimatedEffort": "5人天",
    "dueDate": "2026-09-01",
    "assignedTo": "user-003",
    "resolution": null,
    "metadata": {
      "impact": "查询响应时间 > 5s",
      "rootCause": "缺少数据生命周期管理策略"
    },
    "createdAt": "2026-07-16T08:00:00Z",
    "updatedAt": "2026-07-16T08:00:00Z",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.2.12 技术债务 - 创建

```
POST /api/v1/ea/technical-debts
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | 是 | 债务标题 |
| `description` | string | 否 | 描述 |
| `applicationId` | string | 是 | 关联应用 ID |
| `severity` | string | 否 | 严重程度，默认 `MEDIUM` |
| `category` | string | 否 | 分类：`CODE_QUALITY/ARCHITECTURE/DATA_QUALITY/SECURITY/PERFORMANCE/MAINTAINABILITY` |
| `estimatedEffort` | string | 否 | 预估工作量 |
| `dueDate` | string | 否 | 截止日期（ISO 8601） |
| `assignedTo` | string | 否 | 指派人 ID |
| `metadata` | object | 否 | 扩展元数据 |

**请求示例**

```json
{
  "title": "订单系统 API 缺少版本管理",
  "description": "订单系统 API 未实现版本控制，升级存在兼容性风险",
  "applicationId": "app-002",
  "severity": "HIGH",
  "category": "ARCHITECTURE",
  "estimatedEffort": "10人天",
  "dueDate": "2026-10-01",
  "assignedTo": "user-004"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "td-002",
    "title": "订单系统 API 缺少版本管理",
    "description": "订单系统 API 未实现版本控制，升级存在兼容性风险",
    "applicationId": "app-002",
    "applicationName": "订单系统",
    "severity": "HIGH",
    "status": "OPEN",
    "category": "ARCHITECTURE",
    "estimatedEffort": "10人天",
    "dueDate": "2026-10-01",
    "assignedTo": "user-004",
    "createdAt": "2026-07-16T11:00:00Z",
    "updatedAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.2.13 技术债务 - 更新

```
PUT /api/v1/ea/technical-debts/{id}
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | 否 | 标题 |
| `description` | string | 否 | 描述 |
| `severity` | string | 否 | 严重程度 |
| `status` | string | 否 | 债务状态 |
| `category` | string | 否 | 分类 |
| `estimatedEffort` | string | 否 | 预估工作量 |
| `dueDate` | string | 否 | 截止日期 |
| `assignedTo` | string | 否 | 指派人 ID |
| `resolution` | string | 否 | 解决方案（状态为 `RESOLVED` 时填写） |
| `metadata` | object | 否 | 扩展元数据 |

---

#### 3.2.14 技术债务 - 删除

```
DELETE /api/v1/ea/technical-debts/{id}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 债务 ID 不存在 | 40401 | 404 |
| 债务状态为 `IN_PROGRESS` | 42201 | 422 |

---

### 3.3 数据架构 API

数据架构管理涵盖数据主题域、数据实体、数据流转、数据资产目录四个子域。

---

#### 3.3.1 数据主题域 - 列表查询

```
GET /api/v1/ea/data-domains
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `page` | query | integer | 否 | 页码 |
| `size` | query | integer | 否 | 每页条数 |
| `keyword` | query | string | 否 | 名称关键词 |
| `parentId` | query | string | 否 | 父主题域 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "dd-001",
        "code": "DD-CUSTOMER",
        "name": "客户域",
        "description": "客户相关数据主题域",
        "parentId": null,
        "entityCount": 12,
        "createdAt": "2026-07-16T08:00:00Z",
        "updatedAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.3.2 数据主题域 - 获取详情

```
GET /api/v1/ea/data-domains/{id}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "dd-001",
    "code": "DD-CUSTOMER",
    "name": "客户域",
    "description": "客户相关数据主题域",
    "parentId": null,
    "children": [
      { "id": "dd-001-01", "code": "DD-CUSTOMER-PROFILE", "name": "客户档案子域" }
    ],
    "entities": [
      { "id": "de-001", "code": "DE-CUSTOMER", "name": "客户实体" },
      { "id": "de-002", "code": "DE-CONTACT", "name": "联系人实体" }
    ],
    "linkedCapabilityId": "cap-001",
    "ontologyEntityId": "ont-entity-200",
    "createdAt": "2026-07-16T08:00:00Z",
    "updatedAt": "2026-07-16T08:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.3.3 数据主题域 - 创建

```
POST /api/v1/ea/data-domains
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | string | 是 | 主题域编码，租户内唯一 |
| `name` | string | 是 | 主题域名称 |
| `description` | string | 否 | 描述 |
| `parentId` | string | 否 | 父主题域 ID |
| `linkedCapabilityId` | string | 否 | 关联业务能力 ID |

**请求示例**

```json
{
  "code": "DD-ORDER",
  "name": "订单域",
  "description": "订单相关数据主题域",
  "linkedCapabilityId": "cap-002"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "dd-002",
    "code": "DD-ORDER",
    "name": "订单域",
    "description": "订单相关数据主题域",
    "parentId": null,
    "entityCount": 0,
    "linkedCapabilityId": "cap-002",
    "createdAt": "2026-07-16T11:00:00Z",
    "updatedAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.3.4 数据主题域 - 更新

```
PUT /api/v1/ea/data-domains/{id}
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 否 | 名称 |
| `description` | string | 否 | 描述 |
| `parentId` | string | 否 | 父主题域 ID |
| `linkedCapabilityId` | string | 否 | 关联业务能力 ID |

---

#### 3.3.5 数据主题域 - 删除

```
DELETE /api/v1/ea/data-domains/{id}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 主题域 ID 不存在 | 40401 | 404 |
| 存在子主题域 | 42201 | 422 |
| 存在关联数据实体 | 42201 | 422 |

---

#### 3.3.6 数据实体 - 列表查询

```
GET /api/v1/ea/data-entities
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `page` | query | integer | 否 | 页码 |
| `size` | query | integer | 否 | 每页条数 |
| `keyword` | query | string | 否 | 名称关键词 |
| `domainId` | query | string | 否 | 所属主题域 ID |
| `applicationId` | query | string | 否 | 关联应用 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "de-001",
        "code": "DE-CUSTOMER",
        "name": "客户实体",
        "description": "客户主数据实体",
        "domainId": "dd-001",
        "domainName": "客户域",
        "entityType": "MASTER_DATA",
        "fieldCount": 25,
        "ontologyEntityId": "ont-entity-300",
        "createdAt": "2026-07-16T08:00:00Z",
        "updatedAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.3.7 数据实体 - 获取详情

```
GET /api/v1/ea/data-entities/{id}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "de-001",
    "code": "DE-CUSTOMER",
    "name": "客户实体",
    "description": "客户主数据实体",
    "domain": {
      "id": "dd-001",
      "name": "客户域"
    },
    "entityType": "MASTER_DATA",
    "fields": [
      { "name": "customer_id", "type": "VARCHAR", "length": 64, "nullable": false, "isPrimaryKey": true, "description": "客户唯一标识" },
      { "name": "customer_name", "type": "VARCHAR", "length": 255, "nullable": false, "isPrimaryKey": false, "description": "客户名称" },
      { "name": "created_at", "type": "TIMESTAMP", "nullable": false, "isPrimaryKey": false, "description": "创建时间" }
    ],
    "owningApplication": {
      "id": "app-001",
      "name": "CRM 系统"
    },
    "ontologyEntityId": "ont-entity-300",
    "ontologyEntityName": "Customer",
    "flowsAsSource": [
      { "id": "df-001", "targetEntityId": "de-003", "targetEntityName": "客户画像实体", "flowType": "ETL" }
    ],
    "flowsAsTarget": [],
    "createdAt": "2026-07-16T08:00:00Z",
    "updatedAt": "2026-07-16T08:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.3.8 数据实体 - 创建

```
POST /api/v1/ea/data-entities
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | string | 是 | 实体编码，租户内唯一 |
| `name` | string | 是 | 实体名称 |
| `description` | string | 否 | 描述 |
| `domainId` | string | 是 | 所属主题域 ID |
| `entityType` | string | 否 | 实体类型：`MASTER_DATA/TRANSACTIONAL/REFERENCE/ANALYTICAL/UNSTRUCTURED` |
| `owningApplicationId` | string | 否 | 拥有应用 ID |
| `fields` | array | 否 | 字段列表 |

**请求示例**

```json
{
  "code": "DE-ORDER",
  "name": "订单实体",
  "description": "订单主数据实体",
  "domainId": "dd-002",
  "entityType": "TRANSACTIONAL",
  "owningApplicationId": "app-002",
  "fields": [
    { "name": "order_id", "type": "VARCHAR", "length": 64, "nullable": false, "isPrimaryKey": true, "description": "订单唯一标识" },
    { "name": "customer_id", "type": "VARCHAR", "length": 64, "nullable": false, "isPrimaryKey": false, "description": "客户ID" },
    { "name": "order_date", "type": "TIMESTAMP", "nullable": false, "isPrimaryKey": false, "description": "下单时间" },
    { "name": "total_amount", "type": "DECIMAL", "length": 12, "scale": 2, "nullable": false, "isPrimaryKey": false, "description": "订单总金额" }
  ]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "de-003",
    "code": "DE-ORDER",
    "name": "订单实体",
    "description": "订单主数据实体",
    "domainId": "dd-002",
    "domainName": "订单域",
    "entityType": "TRANSACTIONAL",
    "fieldCount": 4,
    "owningApplicationId": "app-002",
    "ontologyEntityId": null,
    "createdAt": "2026-07-16T11:00:00Z",
    "updatedAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.3.9 数据实体 - 更新

```
PUT /api/v1/ea/data-entities/{id}
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 否 | 名称 |
| `description` | string | 否 | 描述 |
| `domainId` | string | 否 | 所属主题域 ID |
| `entityType` | string | 否 | 实体类型 |
| `owningApplicationId` | string | 否 | 拥有应用 ID |
| `fields` | array | 否 | 字段列表（全量替换） |

---

#### 3.3.10 数据实体 - 删除

```
DELETE /api/v1/ea/data-entities/{id}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 实体 ID 不存在 | 40401 | 404 |
| 存在数据流转关联 | 42201 | 422 |
| 已映射 Ontology 实体 | 42202 | 422 |

---

#### 3.3.11 数据流转 - 列表查询

```
GET /api/v1/ea/data-flows
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `page` | query | integer | 否 | 页码 |
| `size` | query | integer | 否 | 每页条数 |
| `sourceEntityId` | query | string | 否 | 源实体 ID |
| `targetEntityId` | query | string | 否 | 目标实体 ID |
| `flowType` | query | string | 否 | 流转类型 |
| `sourceApplicationId` | query | string | 否 | 源应用 ID |
| `targetApplicationId` | query | string | 否 | 目标应用 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "df-001",
        "name": "客户数据 ETL 流转",
        "description": "CRM 客户数据每日 ETL 到数据仓库",
        "sourceEntity": { "id": "de-001", "name": "客户实体" },
        "targetEntity": { "id": "de-004", "name": "客户画像实体" },
        "sourceApplication": { "id": "app-001", "name": "CRM 系统" },
        "targetApplication": { "id": "app-005", "name": "数据仓库" },
        "flowType": "ETL",
        "frequency": "DAILY",
        "technology": "Flink CDC",
        "lifecycle": "ACTIVE",
        "createdAt": "2026-07-16T08:00:00Z",
        "updatedAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.3.12 数据流转 - 获取详情

```
GET /api/v1/ea/data-flows/{id}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "df-001",
    "name": "客户数据 ETL 流转",
    "description": "CRM 客户数据每日 ETL 到数据仓库",
    "sourceEntity": { "id": "de-001", "name": "客户实体", "domain": "客户域" },
    "targetEntity": { "id": "de-004", "name": "客户画像实体", "domain": "分析域" },
    "sourceApplication": { "id": "app-001", "name": "CRM 系统" },
    "targetApplication": { "id": "app-005", "name": "数据仓库" },
    "flowType": "ETL",
    "frequency": "DAILY",
    "technology": "Flink CDC",
    "lifecycle": "ACTIVE",
    "fieldMappings": [
      { "sourceField": "customer_id", "targetField": "cust_id", "transform": "DIRECT" },
      { "sourceField": "customer_name", "targetField": "cust_name", "transform": "DIRECT" },
      { "sourceField": "created_at", "targetField": "first_contact_date", "transform": "FORMAT:yyyy-MM-dd" }
    ],
    "metadata": {
      "sla": "每日 02:00 前完成",
      "dataVolume": "约 100 万条/日"
    },
    "createdAt": "2026-07-16T08:00:00Z",
    "updatedAt": "2026-07-16T08:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.3.13 数据流转 - 创建

```
POST /api/v1/ea/data-flows
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 是 | 流转名称 |
| `description` | string | 否 | 描述 |
| `sourceEntityId` | string | 是 | 源数据实体 ID |
| `targetEntityId` | string | 是 | 目标数据实体 ID |
| `sourceApplicationId` | string | 否 | 源应用 ID |
| `targetApplicationId` | string | 否 | 目标应用 ID |
| `flowType` | string | 是 | 流转类型：`ETL/STREAMING/API/SYNC/FILE/MANUAL` |
| `frequency` | string | 否 | 频率：`REALTIME/HOURLY/DAILY/WEEKLY/MONTHLY/ON_DEMAND` |
| `technology` | string | 否 | 技术实现 |
| `fieldMappings` | array | 否 | 字段映射列表 |
| `lifecycle` | string | 否 | 生命周期状态，默认 `PROPOSED` |

**请求示例**

```json
{
  "name": "订单数据实时同步",
  "description": "订单系统数据实时同步到数据仓库",
  "sourceEntityId": "de-003",
  "targetEntityId": "de-005",
  "sourceApplicationId": "app-002",
  "targetApplicationId": "app-005",
  "flowType": "STREAMING",
  "frequency": "REALTIME",
  "technology": "Kafka + Flink"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "df-002",
    "name": "订单数据实时同步",
    "description": "订单系统数据实时同步到数据仓库",
    "sourceEntity": { "id": "de-003", "name": "订单实体" },
    "targetEntity": { "id": "de-005", "name": "订单分析实体" },
    "flowType": "STREAMING",
    "frequency": "REALTIME",
    "technology": "Kafka + Flink",
    "lifecycle": "PROPOSED",
    "createdAt": "2026-07-16T11:00:00Z",
    "updatedAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.3.14 数据流转 - 更新

```
PUT /api/v1/ea/data-flows/{id}
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 否 | 名称 |
| `description` | string | 否 | 描述 |
| `flowType` | string | 否 | 流转类型 |
| `frequency` | string | 否 | 频率 |
| `technology` | string | 否 | 技术实现 |
| `fieldMappings` | array | 否 | 字段映射列表（全量替换） |
| `lifecycle` | string | 否 | 生命周期状态 |

---

#### 3.3.15 数据流转 - 删除

```
DELETE /api/v1/ea/data-flows/{id}
```

---

#### 3.3.16 数据资产目录 - 列表查询

```
GET /api/v1/ea/data-assets
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `page` | query | integer | 否 | 页码 |
| `size` | query | integer | 否 | 每页条数 |
| `keyword` | query | string | 否 | 名称关键词 |
| `domainId` | query | string | 否 | 主题域 ID |
| `assetType` | query | string | 否 | 资产类型 |
| `classification` | query | string | 否 | 数据分类 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "da-001",
        "code": "DA-CUST-001",
        "name": "客户主数据资产",
        "description": "包含客户基本信息、联系方式、分层信息",
        "assetType": "DATASET",
        "domainId": "dd-001",
        "domainName": "客户域",
        "classification": "CONFIDENTIAL",
        "ownerRoleId": "org-role-001",
        "stewardUserId": "user-005",
        "qualityScore": 92,
        "lastUpdated": "2026-07-16T06:00:00Z",
        "createdAt": "2026-07-16T08:00:00Z",
        "updatedAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.3.17 数据资产目录 - 获取详情

```
GET /api/v1/ea/data-assets/{id}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "da-001",
    "code": "DA-CUST-001",
    "name": "客户主数据资产",
    "description": "包含客户基本信息、联系方式、分层信息",
    "assetType": "DATASET",
    "domain": {
      "id": "dd-001",
      "name": "客户域"
    },
    "classification": "CONFIDENTIAL",
    "linkedEntities": [
      { "id": "de-001", "name": "客户实体" },
      { "id": "de-002", "name": "联系人实体" }
    ],
    "ownerRole": {
      "id": "org-role-001",
      "name": "客户管理部"
    },
    "stewardUser": {
      "id": "user-005",
      "name": "张三"
    },
    "qualityScore": 92,
    "qualityMetrics": {
      "completeness": 95,
      "accuracy": 90,
      "consistency": 88,
      "timeliness": 94
    },
    "retentionPolicy": {
      "retentionPeriod": "7年",
      "archivePolicy": "3年后归档至冷存储"
    },
    "accessPolicy": "仅客户管理部及授权角色可访问",
    "lastUpdated": "2026-07-16T06:00:00Z",
    "createdAt": "2026-07-16T08:00:00Z",
    "updatedAt": "2026-07-16T08:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.3.18 数据资产目录 - 创建

```
POST /api/v1/ea/data-assets
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | string | 是 | 资产编码，租户内唯一 |
| `name` | string | 是 | 资产名称 |
| `description` | string | 否 | 描述 |
| `assetType` | string | 是 | 资产类型：`DATASET/API/REPORT/MODEL/DASHBOARD` |
| `domainId` | string | 是 | 主题域 ID |
| `classification` | string | 否 | 数据分类：`PUBLIC/INTERNAL/CONFIDENTIAL/RESTRICTED` |
| `ownerRoleId` | string | 否 | 负责角色 ID |
| `stewardUserId` | string | 否 | 数据管家用户 ID |
| `linkedEntityIds` | array | 否 | 关联数据实体 ID 列表 |
| `retentionPolicy` | object | 否 | 保留策略 |
| `accessPolicy` | string | 否 | 访问策略描述 |

**请求示例**

```json
{
  "code": "DA-ORDER-001",
  "name": "订单交易数据资产",
  "description": "包含订单全量交易数据",
  "assetType": "DATASET",
  "domainId": "dd-002",
  "classification": "CONFIDENTIAL",
  "ownerRoleId": "org-role-004",
  "stewardUserId": "user-006",
  "linkedEntityIds": ["de-003"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "da-002",
    "code": "DA-ORDER-001",
    "name": "订单交易数据资产",
    "description": "包含订单全量交易数据",
    "assetType": "DATASET",
    "domainId": "dd-002",
    "domainName": "订单域",
    "classification": "CONFIDENTIAL",
    "ownerRoleId": "org-role-004",
    "stewardUserId": "user-006",
    "qualityScore": null,
    "createdAt": "2026-07-16T11:00:00Z",
    "updatedAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.3.19 数据资产目录 - 更新

```
PUT /api/v1/ea/data-assets/{id}
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 否 | 名称 |
| `description` | string | 否 | 描述 |
| `assetType` | string | 否 | 资产类型 |
| `domainId` | string | 否 | 主题域 ID |
| `classification` | string | 否 | 数据分类 |
| `ownerRoleId` | string | 否 | 负责角色 ID |
| `stewardUserId` | string | 否 | 数据管家用户 ID |
| `linkedEntityIds` | array | 否 | 关联数据实体 ID 列表（全量替换） |
| `retentionPolicy` | object | 否 | 保留策略 |
| `accessPolicy` | string | 否 | 访问策略描述 |

---

#### 3.3.20 数据资产目录 - 删除

```
DELETE /api/v1/ea/data-assets/{id}
```

---

### 3.4 技术架构 API

技术架构管理涵盖技术栈清单、基础设施拓扑、技术标准三个子域。

---

#### 3.4.1 技术栈 - 列表查询

```
GET /api/v1/ea/tech-stacks
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `page` | query | integer | 否 | 页码 |
| `size` | query | integer | 否 | 每页条数 |
| `keyword` | query | string | 否 | 名称关键词 |
| `category` | query | string | 否 | 分类：`BACKEND/FRONTEND/DATABASE/MIDDLEWARE/INFRASTRUCTURE/AI/DEVOPS` |
| `status` | query | string | 否 | 技术状态：`ADOPTED/TRIAL/ASSESS/HOLD` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "ts-001",
        "code": "TS-SPRING-BOOT",
        "name": "Spring Boot 3.4",
        "description": "Java 应用开发框架",
        "category": "BACKEND",
        "vendor": "VMware",
        "version": "3.4",
        "status": "ADOPTED",
        "isStandard": true,
        "applicationCount": 12,
        "createdAt": "2026-07-16T08:00:00Z",
        "updatedAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.4.2 技术栈 - 获取详情

```
GET /api/v1/ea/tech-stacks/{id}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "ts-001",
    "code": "TS-SPRING-BOOT",
    "name": "Spring Boot 3.4",
    "description": "Java 应用开发框架",
    "category": "BACKEND",
    "vendor": "VMware",
    "version": "3.4",
    "license": "Apache 2.0",
    "status": "ADOPTED",
    "isStandard": true,
    "standardDocumentId": "std-001",
    "applications": [
      { "id": "app-001", "name": "CRM 系统" },
      { "id": "app-002", "name": "订单系统" }
    ],
    "endOfLife": null,
    "upgradePath": null,
    "metadata": {
      "jvmVersion": "Java 21",
      "supportedUntil": "2028-12-31"
    },
    "createdAt": "2026-07-16T08:00:00Z",
    "updatedAt": "2026-07-16T08:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.4.3 技术栈 - 创建

```
POST /api/v1/ea/tech-stacks
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | string | 是 | 技术栈编码，租户内唯一 |
| `name` | string | 是 | 技术栈名称 |
| `description` | string | 否 | 描述 |
| `category` | string | 是 | 分类 |
| `vendor` | string | 否 | 供应商 |
| `version` | string | 否 | 版本 |
| `license` | string | 否 | 许可证 |
| `status` | string | 否 | 技术状态，默认 `ASSESS` |
| `isStandard` | boolean | 否 | 是否为标准技术栈，默认 `false` |
| `standardDocumentId` | string | 否 | 标准文档 ID |
| `endOfLife` | string | 否 | 生命周期终止日期 |
| `upgradePath` | string | 否 | 升级路径 |
| `metadata` | object | 否 | 扩展元数据 |

**请求示例**

```json
{
  "code": "TS-REACT",
  "name": "React 19",
  "description": "前端 UI 框架",
  "category": "FRONTEND",
  "vendor": "Meta",
  "version": "19",
  "license": "MIT",
  "status": "ADOPTED",
  "isStandard": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "ts-002",
    "code": "TS-REACT",
    "name": "React 19",
    "description": "前端 UI 框架",
    "category": "FRONTEND",
    "vendor": "Meta",
    "version": "19",
    "license": "MIT",
    "status": "ADOPTED",
    "isStandard": true,
    "applicationCount": 0,
    "createdAt": "2026-07-16T11:00:00Z",
    "updatedAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.4.4 技术栈 - 更新

```
PUT /api/v1/ea/tech-stacks/{id}
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 否 | 名称 |
| `description` | string | 否 | 描述 |
| `category` | string | 否 | 分类 |
| `vendor` | string | 否 | 供应商 |
| `version` | string | 否 | 版本 |
| `license` | string | 否 | 许可证 |
| `status` | string | 否 | 技术状态 |
| `isStandard` | boolean | 否 | 是否标准 |
| `standardDocumentId` | string | 否 | 标准文档 ID |
| `endOfLife` | string | 否 | 生命周期终止日期 |
| `upgradePath` | string | 否 | 升级路径 |
| `metadata` | object | 否 | 扩展元数据 |

---

#### 3.4.5 技术栈 - 删除

```
DELETE /api/v1/ea/tech-stacks/{id}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 技术栈 ID 不存在 | 40401 | 404 |
| 被应用系统引用 | 42201 | 422 |

---

#### 3.4.6 基础设施拓扑 - 列表查询

```
GET /api/v1/ea/infra-topologies
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `page` | query | integer | 否 | 页码 |
| `size` | query | integer | 否 | 每页条数 |
| `keyword` | query | string | 否 | 名称关键词 |
| `nodeType` | query | string | 否 | 节点类型：`CLUSTER/SERVER/CONTAINER/NETWORK/STORAGE` |
| `environment` | query | string | 否 | 环境：`production/staging/development` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "infra-001",
        "code": "INFRA-K8S-PROD",
        "name": "生产 K8s 集群",
        "nodeType": "CLUSTER",
        "environment": "production",
        "spec": "3 master + 10 worker",
        "applicationCount": 8,
        "parentId": null,
        "lifecycle": "ACTIVE",
        "createdAt": "2026-07-16T08:00:00Z",
        "updatedAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.4.7 基础设施拓扑 - 获取详情

```
GET /api/v1/ea/infra-topologies/{id}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "infra-001",
    "code": "INFRA-K8S-PROD",
    "name": "生产 K8s 集群",
    "nodeType": "CLUSTER",
    "environment": "production",
    "spec": "3 master + 10 worker",
    "parentId": null,
    "children": [
      { "id": "infra-001-01", "name": "master-node-01", "nodeType": "SERVER" },
      { "id": "infra-001-02", "name": "worker-node-01", "nodeType": "SERVER" }
    ],
    "deployedApplications": [
      { "id": "app-001", "name": "CRM 系统" },
      { "id": "app-002", "name": "订单系统" }
    ],
    "techStacks": [
      { "id": "ts-003", "name": "Kubernetes 1.32" },
      { "id": "ts-004", "name": "Istio 1.24" }
    ],
    "lifecycle": "ACTIVE",
    "metadata": {
      "region": "cn-beijing",
      "provider": "self-hosted"
    },
    "createdAt": "2026-07-16T08:00:00Z",
    "updatedAt": "2026-07-16T08:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.4.8 基础设施拓扑 - 创建

```
POST /api/v1/ea/infra-topologies
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | string | 是 | 拓扑编码，租户内唯一 |
| `name` | string | 是 | 拓扑名称 |
| `nodeType` | string | 是 | 节点类型 |
| `environment` | string | 否 | 环境，默认 `production` |
| `spec` | string | 否 | 规格描述 |
| `parentId` | string | 否 | 父节点 ID |
| `techStackIds` | array | 否 | 使用的技术栈 ID 列表 |
| `applicationIds` | array | 否 | 部署的应用 ID 列表 |
| `lifecycle` | string | 否 | 生命周期状态 |
| `metadata` | object | 否 | 扩展元数据 |

**请求示例**

```json
{
  "code": "INFRA-K8S-STAGING",
  "name": "预发布 K8s 集群",
  "nodeType": "CLUSTER",
  "environment": "staging",
  "spec": "1 master + 3 worker",
  "techStackIds": ["ts-003", "ts-004"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "infra-002",
    "code": "INFRA-K8S-STAGING",
    "name": "预发布 K8s 集群",
    "nodeType": "CLUSTER",
    "environment": "staging",
    "spec": "1 master + 3 worker",
    "parentId": null,
    "applicationCount": 0,
    "lifecycle": "ACTIVE",
    "createdAt": "2026-07-16T11:00:00Z",
    "updatedAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.4.9 基础设施拓扑 - 更新

```
PUT /api/v1/ea/infra-topologies/{id}
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 否 | 名称 |
| `nodeType` | string | 否 | 节点类型 |
| `environment` | string | 否 | 环境 |
| `spec` | string | 否 | 规格描述 |
| `parentId` | string | 否 | 父节点 ID |
| `techStackIds` | array | 否 | 技术栈 ID 列表（全量替换） |
| `applicationIds` | array | 否 | 应用 ID 列表（全量替换） |
| `lifecycle` | string | 否 | 生命周期状态 |
| `metadata` | object | 否 | 扩展元数据 |

---

#### 3.4.10 基础设施拓扑 - 删除

```
DELETE /api/v1/ea/infra-topologies/{id}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 拓扑 ID 不存在 | 40401 | 404 |
| 存在子节点 | 42201 | 422 |
| 部署了活跃应用 | 42201 | 422 |

---

#### 3.4.11 技术标准 - 列表查询

```
GET /api/v1/ea/tech-standards
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `page` | query | integer | 否 | 页码 |
| `size` | query | integer | 否 | 每页条数 |
| `keyword` | query | string | 否 | 名称关键词 |
| `category` | query | string | 否 | 标准分类 |
| `status` | query | string | 否 | 标准状态 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "tstd-001",
        "code": "TSTD-001",
        "name": "Java 后端开发规范",
        "description": "统一 Java 后端代码结构、命名、异常处理规范",
        "category": "CODING_STANDARD",
        "status": "PUBLISHED",
        "version": "2.1",
        "effectiveDate": "2026-01-01",
        "ownerRoleId": "org-role-006",
        "createdAt": "2026-07-16T08:00:00Z",
        "updatedAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.4.12 技术标准 - 获取详情

```
GET /api/v1/ea/tech-standards/{id}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "tstd-001",
    "code": "TSTD-001",
    "name": "Java 后端开发规范",
    "description": "统一 Java 后端代码结构、命名、异常处理规范",
    "category": "CODING_STANDARD",
    "status": "PUBLISHED",
    "version": "2.1",
    "effectiveDate": "2026-01-01",
    "expiryDate": null,
    "ownerRole": {
      "id": "org-role-006",
      "name": "数据治理团队"
    },
    "content": "## 1. 代码结构\n...\n## 2. 命名规范\n...",
    "relatedTechStacks": [
      { "id": "ts-001", "name": "Spring Boot 3.4" }
    ],
    "compliantApplications": 10,
    "nonCompliantApplications": 2,
    "createdAt": "2026-07-16T08:00:00Z",
    "updatedAt": "2026-07-16T08:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.4.13 技术标准 - 创建

```
POST /api/v1/ea/tech-standards
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | string | 是 | 标准编码，租户内唯一 |
| `name` | string | 是 | 标准名称 |
| `description` | string | 否 | 描述 |
| `category` | string | 是 | 分类：`CODING_STANDARD/ARCHITECTURE_STANDARD/SECURITY_STANDARD/DATA_STANDARD/API_STANDARD/DEPLOYMENT_STANDARD` |
| `status` | string | 否 | 状态：`DRAFT/PUBLISHED/DEPRECATED`，默认 `DRAFT` |
| `version` | string | 否 | 版本号 |
| `effectiveDate` | string | 否 | 生效日期 |
| `expiryDate` | string | 否 | 失效日期 |
| `ownerRoleId` | string | 否 | 负责角色 ID |
| `content` | string | 否 | 标准内容（Markdown） |
| `relatedTechStackIds` | array | 否 | 关联技术栈 ID 列表 |

**请求示例**

```json
{
  "code": "TSTD-002",
  "name": "API 设计规范",
  "description": "RESTful API 设计标准与命名规范",
  "category": "API_STANDARD",
  "status": "DRAFT",
  "version": "1.0",
  "effectiveDate": "2026-08-01",
  "ownerRoleId": "org-role-006",
  "content": "## 1. URL 命名\n..."
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "tstd-002",
    "code": "TSTD-002",
    "name": "API 设计规范",
    "description": "RESTful API 设计标准与命名规范",
    "category": "API_STANDARD",
    "status": "DRAFT",
    "version": "1.0",
    "effectiveDate": "2026-08-01",
    "ownerRoleId": "org-role-006",
    "createdAt": "2026-07-16T11:00:00Z",
    "updatedAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.4.14 技术标准 - 更新

```
PUT /api/v1/ea/tech-standards/{id}
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 否 | 名称 |
| `description` | string | 否 | 描述 |
| `category` | string | 否 | 分类 |
| `status` | string | 否 | 状态 |
| `version` | string | 否 | 版本号 |
| `effectiveDate` | string | 否 | 生效日期 |
| `expiryDate` | string | 否 | 失效日期 |
| `ownerRoleId` | string | 否 | 负责角色 ID |
| `content` | string | 否 | 标准内容 |
| `relatedTechStackIds` | array | 否 | 关联技术栈 ID 列表（全量替换） |

---

#### 3.4.15 技术标准 - 删除

```
DELETE /api/v1/ea/tech-standards/{id}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 标准 ID 不存在 | 40401 | 404 |
| 标准状态为 `PUBLISHED` | 42201 | 422 |

---

### 3.5 架构治理 API

架构治理涵盖架构评审、评审流程、标准规范管理、变更影响分析。

---

#### 3.5.1 架构评审 - 列表查询

```
GET /api/v1/ea/reviews
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `page` | query | integer | 否 | 页码 |
| `size` | query | integer | 否 | 每页条数 |
| `keyword` | query | string | 否 | 标题关键词 |
| `status` | query | string | 否 | 评审状态 |
| `reviewType` | query | string | 否 | 评审类型 |
| `reviewerId` | query | string | 否 | 评审人 ID |
| `submitterId` | query | string | 否 | 提交人 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "rev-001",
        "title": "CRM 系统微服务拆分架构评审",
        "description": "将 CRM 单体应用拆分为客户服务、联系人服务、交互服务三个微服务",
        "reviewType": "ARCHITECTURE_CHANGE",
        "status": "UNDER_REVIEW",
        "priority": "HIGH",
        "submitterId": "user-001",
        "submitterName": "李四",
        "reviewerIds": ["user-007", "user-008"],
        "reviewerNames": ["王五", "赵六"],
        "submittedAt": "2026-07-15T10:00:00Z",
        "dueDate": "2026-07-20",
        "createdAt": "2026-07-15T09:00:00Z",
        "updatedAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.2 架构评审 - 获取详情

```
GET /api/v1/ea/reviews/{id}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "rev-001",
    "title": "CRM 系统微服务拆分架构评审",
    "description": "将 CRM 单体应用拆分为客户服务、联系人服务、交互服务三个微服务",
    "reviewType": "ARCHITECTURE_CHANGE",
    "status": "UNDER_REVIEW",
    "priority": "HIGH",
    "submitter": {
      "id": "user-001",
      "name": "李四"
    },
    "reviewers": [
      { "id": "user-007", "name": "王五", "decision": null },
      { "id": "user-008", "name": "赵六", "decision": null }
    ],
    "affectedAssets": [
      { "assetType": "APPLICATION", "assetId": "app-001", "assetName": "CRM 系统" },
      { "assetType": "BUSINESS_CAPABILITY", "assetId": "cap-001", "assetName": "客户管理" }
    ],
    "impactAnalysisId": "ia-001",
    "documents": [
      { "id": "doc-001", "name": "微服务拆分方案.pdf", "url": "/files/doc-001" }
    ],
    "comments": [
      {
        "id": "cmt-001",
        "authorId": "user-007",
        "authorName": "王五",
        "content": "建议补充拆分后的服务间通信方案",
        "createdAt": "2026-07-16T09:00:00Z"
      }
    ],
    "submittedAt": "2026-07-15T10:00:00Z",
    "dueDate": "2026-07-20",
    "resolvedAt": null,
    "resolution": null,
    "createdAt": "2026-07-15T09:00:00Z",
    "updatedAt": "2026-07-16T09:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.3 架构评审 - 创建

```
POST /api/v1/ea/reviews
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | 是 | 评审标题 |
| `description` | string | 否 | 评审描述 |
| `reviewType` | string | 是 | 评审类型：`ARCHITECTURE_CHANGE/NEW_APPLICATION/TECH_STACK_INTRODUCTION/DATA_ARCHITECTURE_CHANGE/DECOMMISSION` |
| `priority` | string | 否 | 优先级，默认 `MEDIUM` |
| `reviewerIds` | array | 否 | 评审人 ID 列表 |
| `affectedAssets` | array | 否 | 受影响资产列表 |
| `dueDate` | string | 否 | 截止日期 |
| `documentIds` | array | 否 | 相关文档 ID 列表 |

**请求示例**

```json
{
  "title": "引入 Redis 作为缓存层评审",
  "description": "在 CRM 系统中引入 Redis 7.4 作为缓存层以提升查询性能",
  "reviewType": "TECH_STACK_INTRODUCTION",
  "priority": "MEDIUM",
  "reviewerIds": ["user-007", "user-008"],
  "affectedAssets": [
    { "assetType": "APPLICATION", "assetId": "app-001" },
    { "assetType": "TECH_STACK", "assetId": "ts-005" }
  ],
  "dueDate": "2026-07-25"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "rev-002",
    "title": "引入 Redis 作为缓存层评审",
    "description": "在 CRM 系统中引入 Redis 7.4 作为缓存层以提升查询性能",
    "reviewType": "TECH_STACK_INTRODUCTION",
    "status": "DRAFT",
    "priority": "MEDIUM",
    "submitterId": "user-001",
    "reviewerIds": ["user-007", "user-008"],
    "dueDate": "2026-07-25",
    "createdAt": "2026-07-16T11:00:00Z",
    "updatedAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.4 架构评审 - 更新

```
PUT /api/v1/ea/reviews/{id}
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | 否 | 标题 |
| `description` | string | 否 | 描述 |
| `priority` | string | 否 | 优先级 |
| `reviewerIds` | array | 否 | 评审人 ID 列表（全量替换） |
| `affectedAssets` | array | 否 | 受影响资产列表（全量替换） |
| `dueDate` | string | 否 | 截止日期 |
| `documentIds` | array | 否 | 文档 ID 列表（全量替换） |

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 评审 ID 不存在 | 40401 | 404 |
| 评审状态非 `DRAFT`，尝试修改受影响资产 | 42205 | 422 |

---

#### 3.5.5 架构评审 - 删除

```
DELETE /api/v1/ea/reviews/{id}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 评审 ID 不存在 | 40401 | 404 |
| 评审状态非 `DRAFT`/`WITHDRAWN` | 42205 | 422 |

---

#### 3.5.6 架构评审 - 提交评审

将草稿状态的评审提交，进入待评审状态。

```
POST /api/v1/ea/reviews/{id}/submit
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "rev-002",
    "status": "SUBMITTED",
    "submittedAt": "2026-07-16T12:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 评审 ID 不存在 | 40401 | 404 |
| 状态非 `DRAFT`，无法提交 | 42205 | 422 |
| 未指定评审人 | 42201 | 422 |

---

#### 3.5.7 架构评审 - 通过

评审人通过评审。所有评审人均通过后，评审状态变为 `APPROVED`。

```
POST /api/v1/ea/reviews/{id}/approve
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `comment` | string | 否 | 审批意见 |

**请求示例**

```json
{
  "comment": "方案合理，同意引入 Redis"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "rev-002",
    "status": "APPROVED",
    "reviewerId": "user-007",
    "reviewerName": "王五",
    "decision": "APPROVED",
    "resolvedAt": "2026-07-17T10:00:00Z",
    "allReviewersDecided": true
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 评审 ID 不存在 | 40401 | 404 |
| 状态非 `SUBMITTED`/`UNDER_REVIEW` | 42205 | 422 |
| 当前用户非指定评审人 | 40301 | 403 |

---

#### 3.5.8 架构评审 - 驳回

任一评审人驳回后，评审状态变为 `REJECTED`。

```
POST /api/v1/ea/reviews/{id}/reject
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `comment` | string | 是 | 驳回原因 |

**请求示例**

```json
{
  "comment": "缺少 Redis 高可用方案，需补充哨兵或集群模式的设计"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "rev-002",
    "status": "REJECTED",
    "reviewerId": "user-008",
    "reviewerName": "赵六",
    "decision": "REJECTED",
    "resolvedAt": "2026-07-17T11:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.9 架构评审 - 撤回

提交人撤回评审，状态回到 `DRAFT`。

```
POST /api/v1/ea/reviews/{id}/withdraw
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "rev-002",
    "status": "WITHDRAWN"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 状态为 `APPROVED`/`REJECTED` | 42205 | 422 |
| 当前用户非提交人 | 40301 | 403 |

---

#### 3.5.10 架构评审 - 获取评论列表

```
GET /api/v1/ea/reviews/{id}/comments
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": "cmt-001",
      "authorId": "user-007",
      "authorName": "王五",
      "content": "建议补充拆分后的服务间通信方案",
      "createdAt": "2026-07-16T09:00:00Z"
    },
    {
      "id": "cmt-002",
      "authorId": "user-001",
      "authorName": "李四",
      "content": "已补充通信方案，使用 gRPC + Service Mesh",
      "createdAt": "2026-07-16T10:00:00Z"
    }
  ],
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.11 架构评审 - 添加评论

```
POST /api/v1/ea/reviews/{id}/comments
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `content` | string | 是 | 评论内容 |

**请求示例**

```json
{
  "content": "建议在方案中增加性能基准测试数据"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "cmt-003",
    "authorId": "user-007",
    "authorName": "王五",
    "content": "建议在方案中增加性能基准测试数据",
    "createdAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 评审 ID 不存在 | 40401 | 404 |
| 评审状态为 `DRAFT`（未提交） | 42205 | 422 |

---

#### 3.5.12 标准规范 - 列表查询

```
GET /api/v1/ea/standards
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `page` | query | integer | 否 | 页码 |
| `size` | query | integer | 否 | 每页条数 |
| `keyword` | query | string | 否 | 名称关键词 |
| `category` | query | string | 否 | 规范分类 |
| `status` | query | string | 否 | 规范状态 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "std-001",
        "code": "STD-001",
        "name": "企业架构设计规范",
        "description": "统一企业架构设计方法与交付物标准",
        "category": "ARCHITECTURE_STANDARD",
        "status": "PUBLISHED",
        "version": "3.0",
        "effectiveDate": "2026-01-01",
        "ownerRoleId": "org-role-006",
        "createdAt": "2026-07-16T08:00:00Z",
        "updatedAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.13 标准规范 - 获取详情

```
GET /api/v1/ea/standards/{id}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "std-001",
    "code": "STD-001",
    "name": "企业架构设计规范",
    "description": "统一企业架构设计方法与交付物标准",
    "category": "ARCHITECTURE_STANDARD",
    "status": "PUBLISHED",
    "version": "3.0",
    "effectiveDate": "2026-01-01",
    "expiryDate": null,
    "ownerRole": {
      "id": "org-role-006",
      "name": "数据治理团队"
    },
    "content": "## 1. 总则\n...\n## 2. 业务架构设计\n...",
    "relatedReviews": [
      { "id": "rev-001", "title": "CRM 系统微服务拆分架构评审" }
    ],
    "createdAt": "2026-07-16T08:00:00Z",
    "updatedAt": "2026-07-16T08:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.14 标准规范 - 创建

```
POST /api/v1/ea/standards
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | string | 是 | 规范编码，租户内唯一 |
| `name` | string | 是 | 规范名称 |
| `description` | string | 否 | 描述 |
| `category` | string | 是 | 分类：`ARCHITECTURE_STANDARD/GOVERNANCE_STANDARD/PROCESS_STANDARD/NAMING_STANDARD` |
| `status` | string | 否 | 状态：`DRAFT/PUBLISHED/DEPRECATED`，默认 `DRAFT` |
| `version` | string | 否 | 版本号 |
| `effectiveDate` | string | 否 | 生效日期 |
| `expiryDate` | string | 否 | 失效日期 |
| `ownerRoleId` | string | 否 | 负责角色 ID |
| `content` | string | 否 | 规范内容（Markdown） |

---

#### 3.5.15 标准规范 - 更新

```
PUT /api/v1/ea/standards/{id}
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 否 | 名称 |
| `description` | string | 否 | 描述 |
| `category` | string | 否 | 分类 |
| `status` | string | 否 | 状态 |
| `version` | string | 否 | 版本号 |
| `effectiveDate` | string | 否 | 生效日期 |
| `expiryDate` | string | 否 | 失效日期 |
| `ownerRoleId` | string | 否 | 负责角色 ID |
| `content` | string | 否 | 规范内容 |

---

#### 3.5.16 标准规范 - 删除

```
DELETE /api/v1/ea/standards/{id}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 规范 ID 不存在 | 40401 | 404 |
| 规范状态为 `PUBLISHED` | 42201 | 422 |

---

#### 3.5.17 变更影响分析 - 发起分析

对指定资产的变更进行影响分析，自动识别受影响的上游/下游资产。

```
POST /api/v1/ea/impact-analysis
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `assetType` | string | 是 | 变更资产类型：`BUSINESS_CAPABILITY/APPLICATION/DATA_ENTITY/TECH_STACK/INFRA_TOPOLOGY` |
| `assetId` | string | 是 | 变更资产 ID |
| `changeType` | string | 是 | 变更类型：`MODIFY/DEPRECATE/REPLACE/REMOVE/MERGE/SPLIT` |
| `changeDescription` | string | 否 | 变更描述 |
| `relatedReviewId` | string | 否 | 关联评审 ID |

**请求示例**

```json
{
  "assetType": "APPLICATION",
  "assetId": "app-001",
  "changeType": "SPLIT",
  "changeDescription": "将 CRM 系统拆分为客户服务、联系人服务、交互服务三个微服务",
  "relatedReviewId": "rev-001"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "ia-001",
    "status": "COMPLETED",
    "assetType": "APPLICATION",
    "assetId": "app-001",
    "assetName": "CRM 系统",
    "changeType": "SPLIT",
    "changeDescription": "将 CRM 系统拆分为客户服务、联系人服务、交互服务三个微服务",
    "impacts": {
      "upstream": [
        {
          "assetType": "APPLICATION",
          "assetId": "app-003",
          "assetName": "营销系统",
          "impactLevel": "HIGH",
          "impactDescription": "营销系统通过 API 调用 CRM，拆分后需修改 API 调用地址和方式"
        }
      ],
      "downstream": [
        {
          "assetType": "APPLICATION",
          "assetId": "app-002",
          "assetName": "订单系统",
          "impactLevel": "MEDIUM",
          "impactDescription": "订单系统从 CRM 获取客户信息，拆分后需调整数据获取路径"
        }
      ],
      "businessCapabilities": [
        {
          "assetId": "cap-001",
          "assetName": "客户管理",
          "impactLevel": "HIGH",
          "impactDescription": "客户管理能力依赖 CRM 系统，拆分后能力支撑关系需重新映射"
        }
      ],
      "dataEntities": [
        {
          "assetId": "de-001",
          "assetName": "客户实体",
          "impactLevel": "HIGH",
          "impactDescription": "客户实体数据归属需重新划分"
        }
      ],
      "dataFlows": [
        {
          "assetId": "df-001",
          "assetName": "客户数据 ETL 流转",
          "impactLevel": "MEDIUM",
          "impactDescription": "ETL 数据源需调整"
        }
      ],
      "technicalDebts": [
        {
          "assetId": "td-001",
          "assetName": "CRM 历史数据未归档",
          "impactLevel": "LOW",
          "impactDescription": "技术债务需在拆分时一并处理"
        }
      ]
    },
    "summary": {
      "totalImpacts": 6,
      "highImpactCount": 3,
      "mediumImpactCount": 2,
      "lowImpactCount": 1,
      "riskLevel": "HIGH"
    },
    "createdAt": "2026-07-16T12:00:00Z",
    "completedAt": "2026-07-16T12:00:05Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| `assetId` 不存在 | 40401 | 404 |
| `changeType` 枚举值非法 | 40001 | 400 |
| `relatedReviewId` 不存在 | 40401 | 404 |

---

#### 3.5.18 变更影响分析 - 获取分析结果

```
GET /api/v1/ea/impact-analysis/{id}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 影响分析 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "ia-001",
    "status": "COMPLETED",
    "assetType": "APPLICATION",
    "assetId": "app-001",
    "assetName": "CRM 系统",
    "changeType": "SPLIT",
    "changeDescription": "将 CRM 系统拆分为客户服务、联系人服务、交互服务三个微服务",
    "relatedReviewId": "rev-001",
    "impacts": {
      "upstream": [
        {
          "assetType": "APPLICATION",
          "assetId": "app-003",
          "assetName": "营销系统",
          "impactLevel": "HIGH",
          "impactDescription": "营销系统通过 API 调用 CRM，拆分后需修改 API 调用地址和方式"
        }
      ],
      "downstream": [
        {
          "assetType": "APPLICATION",
          "assetId": "app-002",
          "assetName": "订单系统",
          "impactLevel": "MEDIUM",
          "impactDescription": "订单系统从 CRM 获取客户信息，拆分后需调整数据获取路径"
        }
      ],
      "businessCapabilities": [],
      "dataEntities": [],
      "dataFlows": [],
      "technicalDebts": []
    },
    "summary": {
      "totalImpacts": 2,
      "highImpactCount": 1,
      "mediumImpactCount": 1,
      "lowImpactCount": 0,
      "riskLevel": "MEDIUM"
    },
    "createdAt": "2026-07-16T12:00:00Z",
    "completedAt": "2026-07-16T12:00:05Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 分析 ID 不存在 | 40401 | 404 |

---

### 3.6 Ontology 联动 API

Ontology 联动实现 EA 架构资产与 TECH-ONT 本体引擎的概念映射、实体关联与一致性检查。

---

#### 3.6.1 概念映射 - 查询映射列表

查询 EA 架构资产与 Ontology 实体之间的映射关系。

```
GET /api/v1/ea/ontology/mappings
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `page` | query | integer | 否 | 页码 |
| `size` | query | integer | 否 | 每页条数 |
| `assetType` | query | string | 否 | EA 资产类型：`BUSINESS_CAPABILITY/VALUE_STREAM/BUSINESS_PROCESS/DATA_DOMAIN/DATA_ENTITY` |
| `assetId` | query | string | 否 | EA 资产 ID |
| `ontologyEntityId` | query | string | 否 | Ontology 实体 ID |
| `mappingStatus` | query | string | 否 | 映射状态：`MAPPED/UNMAPPED/CONFLICT` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "map-001",
        "assetType": "BUSINESS_CAPABILITY",
        "assetId": "cap-001",
        "assetName": "客户管理",
        "ontologyEntityId": "ont-entity-100",
        "ontologyEntityName": "CustomerManagement",
        "ontologyEntityType": "CONCEPT",
        "mappingStatus": "MAPPED",
        "lastSyncAt": "2026-07-16T08:00:00Z",
        "createdAt": "2026-07-16T08:00:00Z",
        "updatedAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.6.2 概念映射 - 创建映射

将 EA 架构资产映射到 Ontology 实体。创建后自动触发同步。

```
POST /api/v1/ea/ontology/mappings
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `assetType` | string | 是 | EA 资产类型 |
| `assetId` | string | 是 | EA 资产 ID |
| `ontologyEntityId` | string | 是 | Ontology 实体 ID |
| `autoSync` | boolean | 否 | 是否自动同步，默认 `true` |

**请求示例**

```json
{
  "assetType": "BUSINESS_CAPABILITY",
  "assetId": "cap-003",
  "ontologyEntityId": "ont-entity-500",
  "autoSync": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "map-002",
    "assetType": "BUSINESS_CAPABILITY",
    "assetId": "cap-003",
    "assetName": "供应链管理",
    "ontologyEntityId": "ont-entity-500",
    "ontologyEntityName": "SupplyChainManagement",
    "ontologyEntityType": "CONCEPT",
    "mappingStatus": "MAPPED",
    "lastSyncAt": "2026-07-16T12:00:00Z",
    "createdAt": "2026-07-16T12:00:00Z",
    "updatedAt": "2026-07-16T12:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| EA 资产 ID 不存在 | 40401 | 404 |
| Ontology 实体 ID 不存在 | 40401 | 404 |
| 映射已存在 | 40901 | 409 |
| Ontology 实体已被其他 EA 资产映射 | 42202 | 422 |
| TECH-ONT 服务不可用 | 50002 | 500 |

---

#### 3.6.3 概念映射 - 删除映射

删除 EA 资产与 Ontology 实体之间的映射关系。

```
DELETE /api/v1/ea/ontology/mappings/{id}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 映射 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": null,
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 映射 ID 不存在 | 40401 | 404 |

---

#### 3.6.4 实体关联 - 查询已关联 Ontology 实体列表

查询所有已与 Ontology 实体建立关联的 EA 架构资产。

```
GET /api/v1/ea/ontology/entities
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `page` | query | integer | 否 | 页码 |
| `size` | query | integer | 否 | 每页条数 |
| `assetType` | query | string | 否 | EA 资产类型过滤 |
| `mappingStatus` | query | string | 否 | 映射状态过滤 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "ontologyEntityId": "ont-entity-100",
        "ontologyEntityName": "CustomerManagement",
        "ontologyEntityType": "CONCEPT",
        "ontologyEntityUri": "ont://concepts/CustomerManagement",
        "linkedAssets": [
          {
            "assetType": "BUSINESS_CAPABILITY",
            "assetId": "cap-001",
            "assetName": "客户管理"
          },
          {
            "assetType": "DATA_DOMAIN",
            "assetId": "dd-001",
            "assetName": "客户域"
          }
        ],
        "mappingStatus": "MAPPED",
        "lastSyncAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "size": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.6.5 实体关联 - 获取 Ontology 实体详情

获取指定 Ontology 实体的详细信息及其关联的 EA 架构资产。

```
GET /api/v1/ea/ontology/entities/{entityId}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `entityId` | string | Ontology 实体 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ontologyEntityId": "ont-entity-100",
    "ontologyEntityName": "CustomerManagement",
    "ontologyEntityType": "CONCEPT",
    "ontologyEntityUri": "ont://concepts/CustomerManagement",
    "ontologyEntityDescription": "客户管理概念，涵盖客户全生命周期管理",
    "properties": [
      { "name": "customerName", "type": "string", "required": true },
      { "name": "customerLevel", "type": "enum", "required": false },
      { "name": "contactInfo", "type": "struct", "required": true }
    ],
    "linkedAssets": [
      {
        "assetType": "BUSINESS_CAPABILITY",
        "assetId": "cap-001",
        "assetName": "客户管理",
        "mappingId": "map-001"
      },
      {
        "assetType": "DATA_DOMAIN",
        "assetId": "dd-001",
        "assetName": "客户域",
        "mappingId": "map-003"
      },
      {
        "assetType": "DATA_ENTITY",
        "assetId": "de-001",
        "assetName": "客户实体",
        "mappingId": "map-005"
      }
    ],
    "mappingStatus": "MAPPED",
    "lastSyncAt": "2026-07-16T08:00:00Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| Ontology 实体 ID 不存在 | 40401 | 404 |
| TECH-ONT 服务不可用 | 50002 | 500 |

---

#### 3.6.6 一致性检查 - 发起检查

对 EA 架构资产与 Ontology 实体之间的映射进行一致性检查，识别属性偏差、关联缺失等问题。

```
POST /api/v1/ea/ontology/consistency-check
```

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `scope` | string | 否 | 检查范围：`ALL/SINGLE_MAPPING`，默认 `ALL` |
| `mappingId` | string | 否 | 当 `scope=SINGLE_MAPPING` 时指定映射 ID |
| `assetType` | string | 否 | 按资产类型过滤 |
| `checkTypes` | array | 否 | 检查类型：`PROPERTY_ALIGNMENT/RELATIONSHIP_COMPLETESS/NAMING_CONVENTION`，默认全部 |

**请求示例**

```json
{
  "scope": "ALL",
  "checkTypes": ["PROPERTY_ALIGNMENT", "RELATIONSHIP_COMPLETENESS"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "cc-001",
    "status": "COMPLETED",
    "scope": "ALL",
    "totalMappings": 15,
    "checkedMappings": 15,
    "issues": [
      {
        "severity": "HIGH",
        "mappingId": "map-002",
        "assetType": "BUSINESS_CAPABILITY",
        "assetId": "cap-003",
        "assetName": "供应链管理",
        "ontologyEntityId": "ont-entity-500",
        "ontologyEntityName": "SupplyChainManagement",
        "issueType": "PROPERTY_ALIGNMENT",
        "description": "EA 资产缺少 Ontology 实体定义的 'supplierList' 属性",
        "suggestion": "在业务能力元数据中补充供应商列表属性"
      },
      {
        "severity": "MEDIUM",
        "mappingId": "map-005",
        "assetType": "DATA_ENTITY",
        "assetId": "de-001",
        "assetName": "客户实体",
        "ontologyEntityId": "ont-entity-300",
        "ontologyEntityName": "Customer",
        "issueType": "RELATIONSHIP_COMPLETENESS",
        "description": "Ontology 实体存在 'hasContact' 关系，但 EA 数据实体未关联联系人实体",
        "suggestion": "建立客户实体与联系人实体的关联关系"
      }
    ],
    "summary": {
      "totalIssues": 2,
      "highSeverityCount": 1,
      "mediumSeverityCount": 1,
      "lowSeverityCount": 0,
      "consistencyScore": 87
    },
    "createdAt": "2026-07-16T13:00:00Z",
    "completedAt": "2026-07-16T13:00:03Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| `mappingId` 不存在 | 40401 | 404 |
| TECH-ONT 服务不可用 | 50002 | 500 |

---

#### 3.6.7 一致性检查 - 获取检查结果

```
GET /api/v1/ea/ontology/consistency-check/{id}
```

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 一致性检查 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "cc-001",
    "status": "COMPLETED",
    "scope": "ALL",
    "totalMappings": 15,
    "checkedMappings": 15,
    "issues": [
      {
        "severity": "HIGH",
        "mappingId": "map-002",
        "assetType": "BUSINESS_CAPABILITY",
        "assetId": "cap-003",
        "assetName": "供应链管理",
        "ontologyEntityId": "ont-entity-500",
        "issueType": "PROPERTY_ALIGNMENT",
        "description": "EA 资产缺少 Ontology 实体定义的 'supplierList' 属性",
        "suggestion": "在业务能力元数据中补充供应商列表属性"
      }
    ],
    "summary": {
      "totalIssues": 1,
      "highSeverityCount": 1,
      "mediumSeverityCount": 0,
      "lowSeverityCount": 0,
      "consistencyScore": 93
    },
    "createdAt": "2026-07-16T13:00:00Z",
    "completedAt": "2026-07-16T13:00:03Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 场景 | code | HTTP Status |
|---|---|---|
| 检查 ID 不存在 | 40401 | 404 |

---

## 4. 数据模型（PostgreSQL 表）

所有表使用 PostgreSQL 17，包含统一的审计字段与多租户隔离字段。

### 4.1 通用字段

所有业务表包含以下通用字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键，UUID |
| `tenant_id` | `VARCHAR(64) NOT NULL` | 租户 ID |
| `code` | `VARCHAR(128) NOT NULL` | 业务编码 |
| `name` | `VARCHAR(512) NOT NULL` | 名称 |
| `description` | `TEXT` | 描述 |
| `lifecycle` | `VARCHAR(32) NOT NULL DEFAULT 'PROPOSED'` | 生命周期状态 |
| `metadata` | `JSONB DEFAULT '{}'` | 扩展元数据 |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | 更新时间 |
| `created_by` | `VARCHAR(64)` | 创建人 ID |
| `updated_by` | `VARCHAR(64)` | 更新人 ID |
| `deleted_at` | `TIMESTAMPTZ` | 软删除标记 |

唯一约束：`(tenant_id, code)`

### 4.2 业务架构表

#### 4.2.1 ea_business_capabilities（业务能力）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `code` | `VARCHAR(128)` | 能力编码 |
| `name` | `VARCHAR(512)` | 能力名称 |
| `description` | `TEXT` | 描述 |
| `level` | `INTEGER NOT NULL` | 层级（1=L1, 2=L2...） |
| `parent_id` | `VARCHAR(64) FK` | 父能力 ID |
| `lifecycle` | `VARCHAR(32)` | 生命周期状态 |
| `owner_role_id` | `VARCHAR(64) FK` | 负责角色 ID |
| `criticality` | `VARCHAR(32)` | 关键程度 |
| `ontology_entity_id` | `VARCHAR(64)` | Ontology 实体 ID |
| `metadata` | `JSONB` | 扩展元数据 |
| `created_at` | `TIMESTAMPTZ` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | 更新时间 |
| `created_by` | `VARCHAR(64)` | 创建人 |
| `updated_by` | `VARCHAR(64)` | 更新人 |
| `deleted_at` | `TIMESTAMPTZ` | 软删除 |

索引：`idx_bc_tenant_code (tenant_id, code)` UNIQUE, `idx_bc_parent (parent_id)`, `idx_bc_lifecycle (lifecycle)`

#### 4.2.2 ea_value_streams（价值流）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `code` | `VARCHAR(128)` | 编码 |
| `name` | `VARCHAR(512)` | 名称 |
| `description` | `TEXT` | 描述 |
| `linked_capability_id` | `VARCHAR(64) FK` | 关联业务能力 ID |
| `lifecycle` | `VARCHAR(32)` | 生命周期状态 |
| `metadata` | `JSONB` | 扩展元数据 |
| 审计字段 | - | 同通用字段 |

#### 4.2.3 ea_value_stream_stages（价值流阶段）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `value_stream_id` | `VARCHAR(64) FK NOT NULL` | 价值流 ID |
| `name` | `VARCHAR(512) NOT NULL` | 阶段名称 |
| `order` | `INTEGER NOT NULL` | 顺序号 |
| `entry_criteria` | `TEXT` | 进入条件 |
| `exit_criteria` | `TEXT` | 退出条件 |
| `participant_role_ids` | `JSONB DEFAULT '[]'` | 参与角色 ID 列表 |
| `created_at` | `TIMESTAMPTZ` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | 更新时间 |

索引：`idx_vss_stream (value_stream_id)`, `idx_vss_order (value_stream_id, order)` UNIQUE

#### 4.2.4 ea_business_processes（业务流程）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `code` | `VARCHAR(128)` | 编码 |
| `name` | `VARCHAR(512)` | 名称 |
| `description` | `TEXT` | 描述 |
| `process_type` | `VARCHAR(32)` | 流程类型 |
| `linked_value_stream_id` | `VARCHAR(64) FK` | 关联价值流 ID |
| `owner_role_id` | `VARCHAR(64) FK` | 负责角色 ID |
| `lifecycle` | `VARCHAR(32)` | 生命周期状态 |
| `metadata` | `JSONB` | 扩展元数据 |
| 审计字段 | - | 同通用字段 |

#### 4.2.5 ea_process_capability_links（流程-能力关联）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `process_id` | `VARCHAR(64) FK NOT NULL` | 业务流程 ID |
| `capability_id` | `VARCHAR(64) FK NOT NULL` | 业务能力 ID |
| `created_at` | `TIMESTAMPTZ` | 创建时间 |

索引：`idx_pcl_process_capability (process_id, capability_id)` UNIQUE

#### 4.2.6 ea_org_roles（组织角色）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `code` | `VARCHAR(128)` | 编码 |
| `name` | `VARCHAR(512)` | 名称 |
| `description` | `TEXT` | 描述 |
| `parent_id` | `VARCHAR(64) FK` | 父角色 ID |
| `role_type` | `VARCHAR(32)` | 角色类型 |
| 审计字段 | - | 同通用字段 |

### 4.3 应用架构表

#### 4.3.1 ea_applications（应用系统）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `code` | `VARCHAR(128)` | 应用编码 |
| `name` | `VARCHAR(512)` | 应用名称 |
| `description` | `TEXT` | 描述 |
| `application_type` | `VARCHAR(32)` | 应用类型 |
| `owner_role_id` | `VARCHAR(64) FK` | 负责角色 ID |
| `criticality` | `VARCHAR(32)` | 关键程度 |
| `lifecycle` | `VARCHAR(32)` | 生命周期状态 |
| `deployment_info` | `JSONB` | 部署信息 |
| `metadata` | `JSONB` | 扩展元数据 |
| 审计字段 | - | 同通用字段 |

#### 4.3.2 ea_app_tech_stack_links（应用-技术栈关联）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `application_id` | `VARCHAR(64) FK NOT NULL` | 应用 ID |
| `tech_stack_id` | `VARCHAR(64) FK NOT NULL` | 技术栈 ID |
| `created_at` | `TIMESTAMPTZ` | 创建时间 |

索引：`idx_atsl_app_stack (application_id, tech_stack_id)` UNIQUE

#### 4.3.3 ea_app_capability_links（应用-能力关联）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `application_id` | `VARCHAR(64) FK NOT NULL` | 应用 ID |
| `capability_id` | `VARCHAR(64) FK NOT NULL` | 业务能力 ID |
| `created_at` | `TIMESTAMPTZ` | 创建时间 |

索引：`idx_acl_app_cap (application_id, capability_id)` UNIQUE

#### 4.3.4 ea_application_dependencies（应用依赖关系）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `source_app_id` | `VARCHAR(64) FK NOT NULL` | 源应用 ID |
| `target_app_id` | `VARCHAR(64) FK NOT NULL` | 目标应用 ID |
| `dependency_type` | `VARCHAR(32) NOT NULL` | 依赖类型 |
| `description` | `TEXT` | 描述 |
| `criticality` | `VARCHAR(32)` | 关键程度 |
| `created_at` | `TIMESTAMPTZ` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | 更新时间 |

索引：`idx_ad_source (source_app_id)`, `idx_ad_target (target_app_id)`, `idx_ad_pair (source_app_id, target_app_id)` UNIQUE

#### 4.3.5 ea_technical_debts（技术债务）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `title` | `VARCHAR(512) NOT NULL` | 债务标题 |
| `description` | `TEXT` | 描述 |
| `application_id` | `VARCHAR(64) FK NOT NULL` | 关联应用 ID |
| `severity` | `VARCHAR(32)` | 严重程度 |
| `status` | `VARCHAR(32) DEFAULT 'OPEN'` | 债务状态 |
| `category` | `VARCHAR(32)` | 分类 |
| `estimated_effort` | `VARCHAR(64)` | 预估工作量 |
| `due_date` | `DATE` | 截止日期 |
| `assigned_to` | `VARCHAR(64)` | 指派人 ID |
| `resolution` | `TEXT` | 解决方案 |
| `metadata` | `JSONB` | 扩展元数据 |
| 审计字段 | - | 同通用字段 |

### 4.4 数据架构表

#### 4.4.1 ea_data_domains（数据主题域）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `code` | `VARCHAR(128)` | 编码 |
| `name` | `VARCHAR(512)` | 名称 |
| `description` | `TEXT` | 描述 |
| `parent_id` | `VARCHAR(64) FK` | 父主题域 ID |
| `linked_capability_id` | `VARCHAR(64) FK` | 关联业务能力 ID |
| `ontology_entity_id` | `VARCHAR(64)` | Ontology 实体 ID |
| 审计字段 | - | 同通用字段 |

#### 4.4.2 ea_data_entities（数据实体）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `code` | `VARCHAR(128)` | 编码 |
| `name` | `VARCHAR(512)` | 名称 |
| `description` | `TEXT` | 描述 |
| `domain_id` | `VARCHAR(64) FK NOT NULL` | 主题域 ID |
| `entity_type` | `VARCHAR(32)` | 实体类型 |
| `owning_application_id` | `VARCHAR(64) FK` | 拥有应用 ID |
| `fields` | `JSONB DEFAULT '[]'` | 字段列表 |
| `ontology_entity_id` | `VARCHAR(64)` | Ontology 实体 ID |
| 审计字段 | - | 同通用字段 |

#### 4.4.3 ea_data_flows（数据流转）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `name` | `VARCHAR(512) NOT NULL` | 流转名称 |
| `description` | `TEXT` | 描述 |
| `source_entity_id` | `VARCHAR(64) FK NOT NULL` | 源实体 ID |
| `target_entity_id` | `VARCHAR(64) FK NOT NULL` | 目标实体 ID |
| `source_application_id` | `VARCHAR(64) FK` | 源应用 ID |
| `target_application_id` | `VARCHAR(64) FK` | 目标应用 ID |
| `flow_type` | `VARCHAR(32) NOT NULL` | 流转类型 |
| `frequency` | `VARCHAR(32)` | 频率 |
| `technology` | `VARCHAR(128)` | 技术实现 |
| `field_mappings` | `JSONB DEFAULT '[]'` | 字段映射 |
| `lifecycle` | `VARCHAR(32)` | 生命周期状态 |
| `metadata` | `JSONB` | 扩展元数据 |
| 审计字段 | - | 同通用字段 |

#### 4.4.4 ea_data_assets（数据资产目录）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `code` | `VARCHAR(128)` | 编码 |
| `name` | `VARCHAR(512)` | 名称 |
| `description` | `TEXT` | 描述 |
| `asset_type` | `VARCHAR(32) NOT NULL` | 资产类型 |
| `domain_id` | `VARCHAR(64) FK NOT NULL` | 主题域 ID |
| `classification` | `VARCHAR(32)` | 数据分类 |
| `owner_role_id` | `VARCHAR(64) FK` | 负责角色 ID |
| `steward_user_id` | `VARCHAR(64)` | 数据管家 ID |
| `quality_score` | `INTEGER` | 质量评分 |
| `retention_policy` | `JSONB` | 保留策略 |
| `access_policy` | `TEXT` | 访问策略 |
| `metadata` | `JSONB` | 扩展元数据 |
| 审计字段 | - | 同通用字段 |

#### 4.4.5 ea_data_asset_entity_links（数据资产-实体关联）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `data_asset_id` | `VARCHAR(64) FK NOT NULL` | 数据资产 ID |
| `data_entity_id` | `VARCHAR(64) FK NOT NULL` | 数据实体 ID |
| `created_at` | `TIMESTAMPTZ` | 创建时间 |

索引：`idx_dael_asset_entity (data_asset_id, data_entity_id)` UNIQUE

### 4.5 技术架构表

#### 4.5.1 ea_tech_stacks（技术栈）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `code` | `VARCHAR(128)` | 编码 |
| `name` | `VARCHAR(512)` | 名称 |
| `description` | `TEXT` | 描述 |
| `category` | `VARCHAR(32) NOT NULL` | 分类 |
| `vendor` | `VARCHAR(128)` | 供应商 |
| `version` | `VARCHAR(64)` | 版本 |
| `license` | `VARCHAR(128)` | 许可证 |
| `status` | `VARCHAR(32) DEFAULT 'ASSESS'` | 技术状态 |
| `is_standard` | `BOOLEAN DEFAULT FALSE` | 是否标准 |
| `standard_document_id` | `VARCHAR(64) FK` | 标准文档 ID |
| `end_of_life` | `DATE` | 生命周期终止日期 |
| `upgrade_path` | `VARCHAR(256)` | 升级路径 |
| `metadata` | `JSONB` | 扩展元数据 |
| 审计字段 | - | 同通用字段 |

#### 4.5.2 ea_infra_topologies（基础设施拓扑）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `code` | `VARCHAR(128)` | 编码 |
| `name` | `VARCHAR(512)` | 名称 |
| `node_type` | `VARCHAR(32) NOT NULL` | 节点类型 |
| `environment` | `VARCHAR(32) DEFAULT 'production'` | 环境 |
| `spec` | `VARCHAR(512)` | 规格描述 |
| `parent_id` | `VARCHAR(64) FK` | 父节点 ID |
| `lifecycle` | `VARCHAR(32)` | 生命周期状态 |
| `metadata` | `JSONB` | 扩展元数据 |
| 审计字段 | - | 同通用字段 |

#### 4.5.3 ea_infra_app_links（基础设施-应用关联）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `infra_id` | `VARCHAR(64) FK NOT NULL` | 基础设施 ID |
| `application_id` | `VARCHAR(64) FK NOT NULL` | 应用 ID |
| `created_at` | `TIMESTAMPTZ` | 创建时间 |

索引：`idx_ial_infra_app (infra_id, application_id)` UNIQUE

#### 4.5.4 ea_infra_tech_stack_links（基础设施-技术栈关联）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `infra_id` | `VARCHAR(64) FK NOT NULL` | 基础设施 ID |
| `tech_stack_id` | `VARCHAR(64) FK NOT NULL` | 技术栈 ID |
| `created_at` | `TIMESTAMPTZ` | 创建时间 |

索引：`idx_itsl_infra_stack (infra_id, tech_stack_id)` UNIQUE

#### 4.5.5 ea_tech_standards（技术标准）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `code` | `VARCHAR(128)` | 编码 |
| `name` | `VARCHAR(512)` | 名称 |
| `description` | `TEXT` | 描述 |
| `category` | `VARCHAR(32) NOT NULL` | 分类 |
| `status` | `VARCHAR(32) DEFAULT 'DRAFT'` | 状态 |
| `version` | `VARCHAR(32)` | 版本号 |
| `effective_date` | `DATE` | 生效日期 |
| `expiry_date` | `DATE` | 失效日期 |
| `owner_role_id` | `VARCHAR(64) FK` | 负责角色 ID |
| `content` | `TEXT` | 标准内容 |
| 审计字段 | - | 同通用字段 |

#### 4.5.6 ea_tech_standard_stack_links（技术标准-技术栈关联）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `standard_id` | `VARCHAR(64) FK NOT NULL` | 技术标准 ID |
| `tech_stack_id` | `VARCHAR(64) FK NOT NULL` | 技术栈 ID |
| `created_at` | `TIMESTAMPTZ` | 创建时间 |

索引：`idx_tssl_std_stack (standard_id, tech_stack_id)` UNIQUE

### 4.6 架构治理表

#### 4.6.1 ea_reviews（架构评审）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `title` | `VARCHAR(512) NOT NULL` | 评审标题 |
| `description` | `TEXT` | 评审描述 |
| `review_type` | `VARCHAR(32) NOT NULL` | 评审类型 |
| `status` | `VARCHAR(32) DEFAULT 'DRAFT'` | 评审状态 |
| `priority` | `VARCHAR(32) DEFAULT 'MEDIUM'` | 优先级 |
| `submitter_id` | `VARCHAR(64)` | 提交人 ID |
| `impact_analysis_id` | `VARCHAR(64) FK` | 影响分析 ID |
| `due_date` | `DATE` | 截止日期 |
| `submitted_at` | `TIMESTAMPTZ` | 提交时间 |
| `resolved_at` | `TIMESTAMPTZ` | 解决时间 |
| `resolution` | `TEXT` | 解决结果 |
| `metadata` | `JSONB` | 扩展元数据 |
| 审计字段 | - | 同通用字段 |

#### 4.6.2 ea_review_reviewers（评审-评审人关联）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `review_id` | `VARCHAR(64) FK NOT NULL` | 评审 ID |
| `reviewer_id` | `VARCHAR(64) NOT NULL` | 评审人 ID |
| `decision` | `VARCHAR(32)` | 决定：`APPROVED/REJECTED` |
| `decided_at` | `TIMESTAMPTZ` | 决定时间 |
| `created_at` | `TIMESTAMPTZ` | 创建时间 |

索引：`idx_rr_review_reviewer (review_id, reviewer_id)` UNIQUE

#### 4.6.3 ea_review_affected_assets（评审-受影响资产）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `review_id` | `VARCHAR(64) FK NOT NULL` | 评审 ID |
| `asset_type` | `VARCHAR(32) NOT NULL` | 资产类型 |
| `asset_id` | `VARCHAR(64) NOT NULL` | 资产 ID |
| `created_at` | `TIMESTAMPTZ` | 创建时间 |

索引：`idx_raa_review_asset (review_id, asset_type, asset_id)` UNIQUE

#### 4.6.4 ea_review_comments（评审评论）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `review_id` | `VARCHAR(64) FK NOT NULL` | 评审 ID |
| `author_id` | `VARCHAR(64) NOT NULL` | 作者 ID |
| `content` | `TEXT NOT NULL` | 评论内容 |
| `created_at` | `TIMESTAMPTZ` | 创建时间 |

#### 4.6.5 ea_standards（标准规范）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `code` | `VARCHAR(128)` | 编码 |
| `name` | `VARCHAR(512)` | 名称 |
| `description` | `TEXT` | 描述 |
| `category` | `VARCHAR(32) NOT NULL` | 分类 |
| `status` | `VARCHAR(32) DEFAULT 'DRAFT'` | 状态 |
| `version` | `VARCHAR(32)` | 版本号 |
| `effective_date` | `DATE` | 生效日期 |
| `expiry_date` | `DATE` | 失效日期 |
| `owner_role_id` | `VARCHAR(64) FK` | 负责角色 ID |
| `content` | `TEXT` | 规范内容 |
| 审计字段 | - | 同通用字段 |

#### 4.6.6 ea_impact_analyses（变更影响分析）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `asset_type` | `VARCHAR(32) NOT NULL` | 变更资产类型 |
| `asset_id` | `VARCHAR(64) NOT NULL` | 变更资产 ID |
| `change_type` | `VARCHAR(32) NOT NULL` | 变更类型 |
| `change_description` | `TEXT` | 变更描述 |
| `related_review_id` | `VARCHAR(64) FK` | 关联评审 ID |
| `status` | `VARCHAR(32) DEFAULT 'PENDING'` | 分析状态 |
| `impacts` | `JSONB` | 影响分析结果 |
| `summary` | `JSONB` | 分析摘要 |
| `created_at` | `TIMESTAMPTZ` | 创建时间 |
| `completed_at` | `TIMESTAMPTZ` | 完成时间 |

### 4.7 Ontology 联动表

#### 4.7.1 ea_ontology_mappings（Ontology 映射）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `asset_type` | `VARCHAR(32) NOT NULL` | EA 资产类型 |
| `asset_id` | `VARCHAR(64) NOT NULL` | EA 资产 ID |
| `ontology_entity_id` | `VARCHAR(64) NOT NULL` | Ontology 实体 ID |
| `ontology_entity_name` | `VARCHAR(256)` | Ontology 实体名称 |
| `ontology_entity_type` | `VARCHAR(32)` | Ontology 实体类型 |
| `mapping_status` | `VARCHAR(32) DEFAULT 'MAPPED'` | 映射状态 |
| `last_sync_at` | `TIMESTAMPTZ` | 最后同步时间 |
| `created_at` | `TIMESTAMPTZ` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | 更新时间 |

索引：`idx_om_asset (asset_type, asset_id)`, `idx_om_ontology (ontology_entity_id)`, `idx_om_tenant_asset_ontology (tenant_id, asset_type, asset_id, ontology_entity_id)` UNIQUE

#### 4.7.2 ea_consistency_checks（一致性检查）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `tenant_id` | `VARCHAR(64)` | 租户 ID |
| `scope` | `VARCHAR(32) DEFAULT 'ALL'` | 检查范围 |
| `mapping_id` | `VARCHAR(64) FK` | 指定映射 ID |
| `status` | `VARCHAR(32) DEFAULT 'PENDING'` | 检查状态 |
| `total_mappings` | `INTEGER` | 总映射数 |
| `checked_mappings` | `INTEGER` | 已检查映射数 |
| `issues` | `JSONB` | 检查问题列表 |
| `summary` | `JSONB` | 检查摘要 |
| `created_at` | `TIMESTAMPTZ` | 创建时间 |
| `completed_at` | `TIMESTAMPTZ` | 完成时间 |

### 4.8 事件发件箱表（Outbox Pattern）

#### 4.8.1 ea_outbox_events（事件发件箱）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `VARCHAR(64) PK` | 主键 |
| `aggregate_type` | `VARCHAR(64) NOT NULL` | 聚合类型 |
| `aggregate_id` | `VARCHAR(64) NOT NULL` | 聚合 ID |
| `event_type` | `VARCHAR(128) NOT NULL` | 事件类型 |
| `payload` | `JSONB NOT NULL` | 事件载荷 |
| `trace_id` | `VARCHAR(64) NOT NULL` | 追踪 ID |
| `tenant_id` | `VARCHAR(64) NOT NULL` | 租户 ID |
| `status` | `VARCHAR(32) DEFAULT 'PENDING'` | 发送状态 |
| `retry_count` | `INTEGER DEFAULT 0` | 重试次数 |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | 创建时间 |
| `published_at` | `TIMESTAMPTZ` | 发布时间 |

索引：`idx_outbox_status_created (status, created_at)`, `idx_outbox_trace (trace_id)`

---

## 5. 事件定义（Kafka）

架构资产变更通过 Kafka 事件发布，使用 **Outbox 模式** 保证可靠投递。所有事件消息头包含 `X-Trace-Id`、`X-Tenant-Id`。

### 5.1 Topic 定义

| Topic | 说明 | 分区策略 |
|---|---|---|
| `ea.business-capability.events` | 业务能力变更事件 | 按 `tenant_id` 分区 |
| `ea.value-stream.events` | 价值流变更事件 | 按 `tenant_id` 分区 |
| `ea.business-process.events` | 业务流程变更事件 | 按 `tenant_id` 分区 |
| `ea.org-role.events` | 组织角色变更事件 | 按 `tenant_id` 分区 |
| `ea.application.events` | 应用系统变更事件 | 按 `tenant_id` 分区 |
| `ea.application-dependency.events` | 应用依赖变更事件 | 按 `tenant_id` 分区 |
| `ea.technical-debt.events` | 技术债务变更事件 | 按 `tenant_id` 分区 |
| `ea.data-domain.events` | 数据主题域变更事件 | 按 `tenant_id` 分区 |
| `ea.data-entity.events` | 数据实体变更事件 | 按 `tenant_id` 分区 |
| `ea.data-flow.events` | 数据流转变更事件 | 按 `tenant_id` 分区 |
| `ea.data-asset.events` | 数据资产变更事件 | 按 `tenant_id` 分区 |
| `ea.tech-stack.events` | 技术栈变更事件 | 按 `tenant_id` 分区 |
| `ea.infra-topology.events` | 基础设施变更事件 | 按 `tenant_id` 分区 |
| `ea.tech-standard.events` | 技术标准变更事件 | 按 `tenant_id` 分区 |
| `ea.review.events` | 架构评审变更事件 | 按 `tenant_id` 分区 |
| `ea.standard.events` | 标准规范变更事件 | 按 `tenant_id` 分区 |
| `ea.impact-analysis.events` | 影响分析事件 | 按 `tenant_id` 分区 |
| `ea.ontology-mapping.events` | Ontology 映射变更事件 | 按 `tenant_id` 分区 |
| `ea.dlq` | 死信队列 | 按 `tenant_id` 分区 |

### 5.2 事件格式

所有事件使用统一的 JSON 格式：

```json
{
  "eventId": "evt-uuid-001",
  "eventType": "BusinessCapabilityCreated",
  "aggregateType": "BusinessCapability",
  "aggregateId": "cap-001",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-07-16T11:00:00Z",
  "source": "TECH-EA",
  "version": "1.0",
  "payload": {
    "id": "cap-001",
    "code": "BC-001",
    "name": "客户管理",
    "level": 1,
    "lifecycle": "PROPOSED",
    "parentId": null,
    "ownerRoleId": "org-role-001",
    "ontologyEntityId": null
  }
}
```

Kafka 消息头：

| Header | 值 |
|---|---|
| `X-Trace-Id` | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `X-Tenant-Id` | `tenant-001` |
| `X-Event-Type` | `BusinessCapabilityCreated` |
| `X-Event-Version` | `1.0` |
| `Content-Type` | `application/json` |

### 5.3 事件类型清单

#### 5.3.1 业务架构事件

| 事件类型 | Topic | 说明 |
|---|---|---|
| `BusinessCapabilityCreated` | `ea.business-capability.events` | 业务能力创建 |
| `BusinessCapabilityUpdated` | `ea.business-capability.events` | 业务能力更新 |
| `BusinessCapabilityDeleted` | `ea.business-capability.events` | 业务能力删除 |
| `BusinessCapabilityMoved` | `ea.business-capability.events` | 业务能力层级移动 |
| `ValueStreamCreated` | `ea.value-stream.events` | 价值流创建 |
| `ValueStreamUpdated` | `ea.value-stream.events` | 价值流更新 |
| `ValueStreamDeleted` | `ea.value-stream.events` | 价值流删除 |
| `BusinessProcessCreated` | `ea.business-process.events` | 业务流程创建 |
| `BusinessProcessUpdated` | `ea.business-process.events` | 业务流程更新 |
| `BusinessProcessDeleted` | `ea.business-process.events` | 业务流程删除 |
| `OrgRoleCreated` | `ea.org-role.events` | 组织角色创建 |
| `OrgRoleUpdated` | `ea.org-role.events` | 组织角色更新 |
| `OrgRoleDeleted` | `ea.org-role.events` | 组织角色删除 |

#### 5.3.2 应用架构事件

| 事件类型 | Topic | 说明 |
|---|---|---|
| `ApplicationCreated` | `ea.application.events` | 应用系统创建 |
| `ApplicationUpdated` | `ea.application.events` | 应用系统更新 |
| `ApplicationDeleted` | `ea.application.events` | 应用系统删除 |
| `ApplicationDependencyAdded` | `ea.application-dependency.events` | 依赖关系添加 |
| `ApplicationDependencyRemoved` | `ea.application-dependency.events` | 依赖关系删除 |
| `TechnicalDebtCreated` | `ea.technical-debt.events` | 技术债务创建 |
| `TechnicalDebtUpdated` | `ea.technical-debt.events` | 技术债务更新 |
| `TechnicalDebtResolved` | `ea.technical-debt.events` | 技术债务解决 |

#### 5.3.3 数据架构事件

| 事件类型 | Topic | 说明 |
|---|---|---|
| `DataDomainCreated` | `ea.data-domain.events` | 主题域创建 |
| `DataDomainUpdated` | `ea.data-domain.events` | 主题域更新 |
| `DataDomainDeleted` | `ea.data-domain.events` | 主题域删除 |
| `DataEntityCreated` | `ea.data-entity.events` | 数据实体创建 |
| `DataEntityUpdated` | `ea.data-entity.events` | 数据实体更新 |
| `DataEntityDeleted` | `ea.data-entity.events` | 数据实体删除 |
| `DataFlowCreated` | `ea.data-flow.events` | 数据流转创建 |
| `DataFlowUpdated` | `ea.data-flow.events` | 数据流转更新 |
| `DataFlowDeleted` | `ea.data-flow.events` | 数据流转删除 |
| `DataAssetCreated` | `ea.data-asset.events` | 数据资产创建 |
| `DataAssetUpdated` | `ea.data-asset.events` | 数据资产更新 |
| `DataAssetDeleted` | `ea.data-asset.events` | 数据资产删除 |

#### 5.3.4 技术架构事件

| 事件类型 | Topic | 说明 |
|---|---|---|
| `TechStackCreated` | `ea.tech-stack.events` | 技术栈创建 |
| `TechStackUpdated` | `ea.tech-stack.events` | 技术栈更新 |
| `TechStackDeleted` | `ea.tech-stack.events` | 技术栈删除 |
| `InfraTopologyCreated` | `ea.infra-topology.events` | 基础设施创建 |
| `InfraTopologyUpdated` | `ea.infra-topology.events` | 基础设施更新 |
| `InfraTopologyDeleted` | `ea.infra-topology.events` | 基础设施删除 |
| `TechStandardCreated` | `ea.tech-standard.events` | 技术标准创建 |
| `TechStandardUpdated` | `ea.tech-standard.events` | 技术标准更新 |
| `TechStandardPublished` | `ea.tech-standard.events` | 技术标准发布 |

#### 5.3.5 架构治理事件

| 事件类型 | Topic | 说明 |
|---|---|---|
| `ReviewSubmitted` | `ea.review.events` | 评审提交 |
| `ReviewApproved` | `ea.review.events` | 评审通过 |
| `ReviewRejected` | `ea.review.events` | 评审驳回 |
| `ReviewWithdrawn` | `ea.review.events` | 评审撤回 |
| `ReviewCommentAdded` | `ea.review.events` | 评审评论添加 |
| `StandardCreated` | `ea.standard.events` | 标准规范创建 |
| `StandardUpdated` | `ea.standard.events` | 标准规范更新 |
| `StandardPublished` | `ea.standard.events` | 标准规范发布 |
| `ImpactAnalysisCompleted` | `ea.impact-analysis.events` | 影响分析完成 |

#### 5.3.6 Ontology 联动事件

| 事件类型 | Topic | 说明 |
|---|---|---|
| `OntologyMappingCreated` | `ea.ontology-mapping.events` | Ontology 映射创建 |
| `OntologyMappingDeleted` | `ea.ontology-mapping.events` | Ontology 映射删除 |
| `OntologySyncCompleted` | `ea.ontology-mapping.events` | Ontology 同步完成 |
| `ConsistencyCheckCompleted` | `ea.ontology-mapping.events` | 一致性检查完成 |

### 5.4 死信队列（DLQ）

消费失败的消息重试 3 次后投递至 `ea.dlq`。DLQ 消息包含原始消息内容及失败原因：

```json
{
  "eventId": "evt-uuid-001",
  "originalTopic": "ea.business-capability.events",
  "eventType": "BusinessCapabilityCreated",
  "aggregateId": "cap-001",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "retryCount": 3,
  "failureReason": "TECH-ONT service unavailable: connection timeout",
  "failedAt": "2026-07-16T12:00:10Z",
  "originalPayload": { ... },
  "originalHeaders": { ... }
}
```

DLQ 记录必须包含 `traceId` 字段用于故障诊断。

---

## 6. 增量交付计划

TECH-EA 服务按四个增量迭代交付，每个迭代包含明确的交付范围与验收标准。

### 6.1 迭代一：业务架构基础（Sprint 1）

| 项 | 说明 |
|---|---|
| 交付周期 | 2 周 |
| 交付范围 | 业务能力 CRUD、能力层级树、组织角色 CRUD |
| 数据模型 | `ea_business_capabilities`, `ea_org_roles` |
| API 数量 | 12 个 |
| 事件 | `ea.business-capability.events`, `ea.org-role.events` |
| 验收标准 | 业务能力多级层级创建/查询/移动；组织角色 CRUD；Outbox 事件发布 |

### 6.2 迭代二：应用与数据架构（Sprint 2）

| 项 | 说明 |
|---|---|
| 交付周期 | 3 周 |
| 交付范围 | 应用系统 CRUD、依赖关系管理、技术债务 CRUD、价值流 CRUD、业务流程 CRUD、数据主题域 CRUD、数据实体 CRUD |
| 数据模型 | `ea_applications`, `ea_application_dependencies`, `ea_technical_debts`, `ea_value_streams`, `ea_value_stream_stages`, `ea_business_processes`, `ea_process_capability_links`, `ea_data_domains`, `ea_data_entities` |
| API 数量 | 30 个 |
| 事件 | `ea.application.events`, `ea.application-dependency.events`, `ea.technical-debt.events`, `ea.value-stream.events`, `ea.business-process.events`, `ea.data-domain.events`, `ea.data-entity.events` |
| 验收标准 | 应用依赖图查询；依赖环检测；技术债务全生命周期；价值流阶段管理；流程-能力关联；数据实体字段管理 |

### 6.3 迭代三：数据流转与技术架构（Sprint 3）

| 项 | 说明 |
|---|---|
| 交付周期 | 2 周 |
| 交付范围 | 数据流转 CRUD、数据资产目录 CRUD、技术栈 CRUD、基础设施拓扑 CRUD、技术标准 CRUD |
| 数据模型 | `ea_data_flows`, `ea_data_assets`, `ea_data_asset_entity_links`, `ea_tech_stacks`, `ea_infra_topologies`, `ea_infra_app_links`, `ea_infra_tech_stack_links`, `ea_tech_standards`, `ea_tech_standard_stack_links` 及关联表 |
| API 数量 | 20 个 |
| 事件 | `ea.data-flow.events`, `ea.data-asset.events`, `ea.tech-stack.events`, `ea.infra-topology.events`, `ea.tech-standard.events` |
| 验收标准 | 数据流转字段映射；数据资产质量评分管理；技术栈采纳状态管理（Tech Radar）；基础设施拓扑层级；技术标准发布流程 |

### 6.4 迭代四：架构治理与 Ontology 联动（Sprint 4）

| 项 | 说明 |
|---|---|
| 交付周期 | 3 周 |
| 交付范围 | 架构评审全流程、标准规范 CRUD、变更影响分析、Ontology 概念映射、一致性检查 |
| 数据模型 | `ea_reviews`, `ea_review_reviewers`, `ea_review_affected_assets`, `ea_review_comments`, `ea_standards`, `ea_impact_analyses`, `ea_ontology_mappings`, `ea_consistency_checks` |
| API 数量 | 20 个 |
| 事件 | `ea.review.events`, `ea.standard.events`, `ea.impact-analysis.events`, `ea.ontology-mapping.events` |
| 验收标准 | 评审状态机流转（DRAFT→SUBMITTED→UNDER_REVIEW→APPROVED/REJECTED）；多评审人决策；变更影响分析自动识别上下游；Ontology 映射与同步；一致性检查报告 |

### 6.5 交付总览

| 迭代 | 周期 | API 数 | 数据表 | Kafka Topic |
|---|---|---|---|---|
| Sprint 1 | 2 周 | 12 | 2 | 2 |
| Sprint 2 | 3 周 | 30 | 7 | 7 |
| Sprint 3 | 2 周 | 20 | 9 | 5 |
| Sprint 4 | 3 周 | 20 | 8 | 4 |
| **合计** | **10 周** | **82** | **26** | **18 + 1 DLQ** |

### 6.6 非功能需求

| 项 | 目标 |
|---|---|
| API P99 延迟 | < 200ms（简单查询），< 500ms（复杂关联查询） |
| 影响分析 P99 延迟 | < 5s |
| 一致性检查 P99 延迟 | < 10s |
| 并发支持 | 100 QPS（读），20 QPS（写） |
| 可用性 | 99.9% |
| 数据一致性 | Outbox 模式保证最终一致性，事件至少一次投递 |
| 多租户隔离 | 所有查询强制 `tenant_id` 过滤 |
| 可观测性 | OpenTelemetry trace_id 全链路追踪，Prometheus 指标暴露 |

---

## 附录 A：API 接口索引

| 序号 | 接口 | 方法 | 路径 |
|---|---|---|---|
| 1 | 业务能力-列表 | GET | `/api/v1/ea/business-capabilities` |
| 2 | 业务能力-详情 | GET | `/api/v1/ea/business-capabilities/{id}` |
| 3 | 业务能力-创建 | POST | `/api/v1/ea/business-capabilities` |
| 4 | 业务能力-更新 | PUT | `/api/v1/ea/business-capabilities/{id}` |
| 5 | 业务能力-删除 | DELETE | `/api/v1/ea/business-capabilities/{id}` |
| 6 | 业务能力-层级树 | GET | `/api/v1/ea/business-capabilities/tree` |
| 7 | 业务能力-移动层级 | PUT | `/api/v1/ea/business-capabilities/{id}/parent` |
| 8 | 价值流-列表 | GET | `/api/v1/ea/value-streams` |
| 9 | 价值流-详情 | GET | `/api/v1/ea/value-streams/{id}` |
| 10 | 价值流-创建 | POST | `/api/v1/ea/value-streams` |
| 11 | 价值流-更新 | PUT | `/api/v1/ea/value-streams/{id}` |
| 12 | 价值流-删除 | DELETE | `/api/v1/ea/value-streams/{id}` |
| 13 | 价值流-阶段列表 | GET | `/api/v1/ea/value-streams/{id}/stages` |
| 14 | 价值流-添加阶段 | POST | `/api/v1/ea/value-streams/{id}/stages` |
| 15 | 价值流-删除阶段 | DELETE | `/api/v1/ea/value-streams/{id}/stages/{stageId}` |
| 16 | 业务流程-列表 | GET | `/api/v1/ea/business-processes` |
| 17 | 业务流程-详情 | GET | `/api/v1/ea/business-processes/{id}` |
| 18 | 业务流程-创建 | POST | `/api/v1/ea/business-processes` |
| 19 | 业务流程-更新 | PUT | `/api/v1/ea/business-processes/{id}` |
| 20 | 业务流程-删除 | DELETE | `/api/v1/ea/business-processes/{id}` |
| 21 | 业务流程-关联能力 | POST | `/api/v1/ea/business-processes/{id}/capabilities/{capabilityId}` |
| 22 | 业务流程-取消关联能力 | DELETE | `/api/v1/ea/business-processes/{id}/capabilities/{capabilityId}` |
| 23 | 组织角色-列表 | GET | `/api/v1/ea/org-roles` |
| 24 | 组织角色-详情 | GET | `/api/v1/ea/org-roles/{id}` |
| 25 | 组织角色-创建 | POST | `/api/v1/ea/org-roles` |
| 26 | 组织角色-更新 | PUT | `/api/v1/ea/org-roles/{id}` |
| 27 | 组织角色-删除 | DELETE | `/api/v1/ea/org-roles/{id}` |
| 28 | 应用系统-列表 | GET | `/api/v1/ea/applications` |
| 29 | 应用系统-详情 | GET | `/api/v1/ea/applications/{id}` |
| 30 | 应用系统-创建 | POST | `/api/v1/ea/applications` |
| 31 | 应用系统-更新 | PUT | `/api/v1/ea/applications/{id}` |
| 32 | 应用系统-删除 | DELETE | `/api/v1/ea/applications/{id}` |
| 33 | 依赖关系-列表 | GET | `/api/v1/ea/applications/{id}/dependencies` |
| 34 | 依赖关系-添加 | POST | `/api/v1/ea/applications/{id}/dependencies` |
| 35 | 依赖关系-删除 | DELETE | `/api/v1/ea/applications/{id}/dependencies/{depId}` |
| 36 | 依赖关系-图 | GET | `/api/v1/ea/applications/dependency-graph` |
| 37 | 技术债务-列表 | GET | `/api/v1/ea/technical-debts` |
| 38 | 技术债务-详情 | GET | `/api/v1/ea/technical-debts/{id}` |
| 39 | 技术债务-创建 | POST | `/api/v1/ea/technical-debts` |
| 40 | 技术债务-更新 | PUT | `/api/v1/ea/technical-debts/{id}` |
| 41 | 技术债务-删除 | DELETE | `/api/v1/ea/technical-debts/{id}` |
| 42 | 主题域-列表 | GET | `/api/v1/ea/data-domains` |
| 43 | 主题域-详情 | GET | `/api/v1/ea/data-domains/{id}` |
| 44 | 主题域-创建 | POST | `/api/v1/ea/data-domains` |
| 45 | 主题域-更新 | PUT | `/api/v1/ea/data-domains/{id}` |
| 46 | 主题域-删除 | DELETE | `/api/v1/ea/data-domains/{id}` |
| 47 | 数据实体-列表 | GET | `/api/v1/ea/data-entities` |
| 48 | 数据实体-详情 | GET | `/api/v1/ea/data-entities/{id}` |
| 49 | 数据实体-创建 | POST | `/api/v1/ea/data-entities` |
| 50 | 数据实体-更新 | PUT | `/api/v1/ea/data-entities/{id}` |
| 51 | 数据实体-删除 | DELETE | `/api/v1/ea/data-entities/{id}` |
| 52 | 数据流转-列表 | GET | `/api/v1/ea/data-flows` |
| 53 | 数据流转-详情 | GET | `/api/v1/ea/data-flows/{id}` |
| 54 | 数据流转-创建 | POST | `/api/v1/ea/data-flows` |
| 55 | 数据流转-更新 | PUT | `/api/v1/ea/data-flows/{id}` |
| 56 | 数据流转-删除 | DELETE | `/api/v1/ea/data-flows/{id}` |
| 57 | 数据资产-列表 | GET | `/api/v1/ea/data-assets` |
| 58 | 数据资产-详情 | GET | `/api/v1/ea/data-assets/{id}` |
| 59 | 数据资产-创建 | POST | `/api/v1/ea/data-assets` |
| 60 | 数据资产-更新 | PUT | `/api/v1/ea/data-assets/{id}` |
| 61 | 数据资产-删除 | DELETE | `/api/v1/ea/data-assets/{id}` |
| 62 | 技术栈-列表 | GET | `/api/v1/ea/tech-stacks` |
| 63 | 技术栈-详情 | GET | `/api/v1/ea/tech-stacks/{id}` |
| 64 | 技术栈-创建 | POST | `/api/v1/ea/tech-stacks` |
| 65 | 技术栈-更新 | PUT | `/api/v1/ea/tech-stacks/{id}` |
| 66 | 技术栈-删除 | DELETE | `/api/v1/ea/tech-stacks/{id}` |
| 67 | 基础设施-列表 | GET | `/api/v1/ea/infra-topologies` |
| 68 | 基础设施-详情 | GET | `/api/v1/ea/infra-topologies/{id}` |
| 69 | 基础设施-创建 | POST | `/api/v1/ea/infra-topologies` |
| 70 | 基础设施-更新 | PUT | `/api/v1/ea/infra-topologies/{id}` |
| 71 | 基础设施-删除 | DELETE | `/api/v1/ea/infra-topologies/{id}` |
| 72 | 技术标准-列表 | GET | `/api/v1/ea/tech-standards` |
| 73 | 技术标准-详情 | GET | `/api/v1/ea/tech-standards/{id}` |
| 74 | 技术标准-创建 | POST | `/api/v1/ea/tech-standards` |
| 75 | 技术标准-更新 | PUT | `/api/v1/ea/tech-standards/{id}` |
| 76 | 技术标准-删除 | DELETE | `/api/v1/ea/tech-standards/{id}` |
| 77 | 架构评审-列表 | GET | `/api/v1/ea/reviews` |
| 78 | 架构评审-详情 | GET | `/api/v1/ea/reviews/{id}` |
| 79 | 架构评审-创建 | POST | `/api/v1/ea/reviews` |
| 80 | 架构评审-更新 | PUT | `/api/v1/ea/reviews/{id}` |
| 81 | 架构评审-删除 | DELETE | `/api/v1/ea/reviews/{id}` |
| 82 | 架构评审-提交 | POST | `/api/v1/ea/reviews/{id}/submit` |
| 83 | 架构评审-通过 | POST | `/api/v1/ea/reviews/{id}/approve` |
| 84 | 架构评审-驳回 | POST | `/api/v1/ea/reviews/{id}/reject` |
| 85 | 架构评审-撤回 | POST | `/api/v1/ea/reviews/{id}/withdraw` |
| 86 | 架构评审-评论列表 | GET | `/api/v1/ea/reviews/{id}/comments` |
| 87 | 架构评审-添加评论 | POST | `/api/v1/ea/reviews/{id}/comments` |
| 88 | 标准规范-列表 | GET | `/api/v1/ea/standards` |
| 89 | 标准规范-详情 | GET | `/api/v1/ea/standards/{id}` |
| 90 | 标准规范-创建 | POST | `/api/v1/ea/standards` |
| 91 | 标准规范-更新 | PUT | `/api/v1/ea/standards/{id}` |
| 92 | 标准规范-删除 | DELETE | `/api/v1/ea/standards/{id}` |
| 93 | 影响分析-发起 | POST | `/api/v1/ea/impact-analysis` |
| 94 | 影响分析-结果 | GET | `/api/v1/ea/impact-analysis/{id}` |
| 95 | 概念映射-列表 | GET | `/api/v1/ea/ontology/mappings` |
| 96 | 概念映射-创建 | POST | `/api/v1/ea/ontology/mappings` |
| 97 | 概念映射-删除 | DELETE | `/api/v1/ea/ontology/mappings/{id}` |
| 98 | 实体关联-列表 | GET | `/api/v1/ea/ontology/entities` |
| 99 | 实体关联-详情 | GET | `/api/v1/ea/ontology/entities/{entityId}` |
| 100 | 一致性检查-发起 | POST | `/api/v1/ea/ontology/consistency-check` |
| 101 | 一致性检查-结果 | GET | `/api/v1/ea/ontology/consistency-check/{id}` |

---

*文档结束*