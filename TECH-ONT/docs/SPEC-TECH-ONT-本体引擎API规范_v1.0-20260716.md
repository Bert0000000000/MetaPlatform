# SPEC - 本体引擎服务 API 规范（TECH-ONT）

> 版本：v1.0 | 日期：2026-07-16
> 维护方：Mate Platform 平台架构组
> 状态：发布

---

## 1. 服务概述

### 1.1 服务定位

TECH-ONT 是 Mate Platform 的**唯一数据真相源（Single Source of Truth）**，承担 Ontology 本体论引擎的核心能力：

- **统一语义建模**：通过 Concept（概念）、Entity（实体）、Relation（关系）、Attribute（属性）四要素构建企业级业务语义模型
- **推理与一致性校验**：基于规则与 OWL 推理机（HermiT / ELK）执行本体推理、知识补全与一致性检测
- **版本化管理**：对本体进行版本控制、差异对比、灰度发布与回滚
- **知识图谱查询**：将本体同步至 Neo4j 5.x，提供图遍历、路径查找、Cypher 查询能力
- **事件驱动广播**：通过 Kafka（Outbox 模式）将本体变更事件广播至下游消费方

TECH-ONT 与知识图谱合并为单层架构：PostgreSQL 17 存储元数据与版本快照，Neo4j 5.x 存储图结构并通过 CDC 保持与 PostgreSQL 双向一致（P3 同步）。

### 1.2 技术栈

| 层级 | 技术 | 版本 | 用途 |
|---|---|---|---|
| 语言/框架 | Java + Spring Boot | 21 / 3.4 | 服务主体 |
| AI 集成 | Spring AI | 1.0 | 本体补全、智能推荐 |
| 推理引擎 | HermiT / ELK | 1.4.x / 0.5.x | OWL DL 推理 / EL 表达式推理 |
| 元数据库 | PostgreSQL | 17 | 概念/实体/关系/属性/规则/版本元数据 |
| 图数据库 | Neo4j | 5.x | 知识图谱存储与查询 |
| 缓存 | Redis | 7.4 | 本体热点缓存、推理结果缓存 |
| 消息队列 | Kafka | 3.9 | 本体变更事件广播（Outbox 模式） |
| 可观测性 | OpenTelemetry + Prometheus | 1.45 / 3.x | trace_id 传播、指标采集 |

### 1.3 上游依赖

| 上游服务 | 依赖说明 |
|---|---|
| TECH-DATA | 提供外部数据源接入与数据集成能力，TECH-ONT 可基于 TECH-DATA 同步的业务数据自动补全实体实例（可选依赖） |

> TECH-ONT 作为平台数据真相源，本身不依赖其他业务服务；TECH-DATA 仅为可选的数据补全来源。

### 1.4 下游消费方

| 下游服务 | 消费场景 |
|---|---|
| TECH-RAG | 基于本体语义构建知识库索引、增强检索精度 |
| TECH-ACTION | Action 编排依赖本体定义的实体与关系结构 |
| TECH-WFE | 工作流引擎基于本体概念路由流程实例 |
| TECH-RULE | 规则引擎引用本体属性与关系作为规则条件 |
| TECH-MCP | MCP Server 暴露本体查询作为 Tool |
| TECH-EA | 架构资产服务基于本体描述企业架构 |
| APP-ONTSTUDIO | 本体论引擎前端（本体的可视化建模与编辑） |
| APP-APPHUB | 低代码应用构建基于本体生成业务对象 |
| APP-ARCH | 架构中心展示本体驱动的架构视图 |

---

## 2. 通用约定

### 2.1 API 路径前缀

所有 TECH-ONT API 路径统一前缀：

```
/api/v1/ont
```

完整路径示例：`/api/v1/ont/concepts`、`/api/v1/ont/entities/{entityId}`

### 2.2 请求/响应格式

#### 2.2.1 Content-Type

- 请求体：`application/json; charset=UTF-8`
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

### 2.4 错误码定义

#### 2.4.1 HTTP 状态码

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

#### 2.4.2 业务错误码

| 错误码 | HTTP 状态码 | 错误标识 | 说明 |
|---|---|---|---|
| 0 | 200 | SUCCESS | 成功 |
| 40001 | 400 | INVALID_PARAM | 请求参数校验失败 |
| 40002 | 400 | INVALID_JSON | 请求体 JSON 格式错误 |
| 40003 | 400 | MISSING_REQUIRED_FIELD | 缺少必填字段 |
| 40004 | 400 | INVALID_FIELD_VALUE | 字段值不合法 |
| 40101 | 401 | TOKEN_EXPIRED | Token 已过期 |
| 40102 | 401 | TOKEN_INVALID | Token 无效 |
| 40103 | 401 | API_KEY_INVALID | API Key 无效 |
| 40301 | 403 | PERMISSION_DENIED | 权限不足 |
| 40302 | 403 | TENANT_MISMATCH | 租户不匹配 |
| 40401 | 404 | CONCEPT_NOT_FOUND | 概念不存在 |
| 40402 | 404 | ENTITY_NOT_FOUND | 实体不存在 |
| 40403 | 404 | RELATION_NOT_FOUND | 关系不存在 |
| 40404 | 404 | ATTRIBUTE_NOT_FOUND | 属性不存在 |
| 40405 | 404 | RULE_NOT_FOUND | 规则不存在 |
| 40406 | 404 | VERSION_NOT_FOUND | 版本不存在 |
| 40407 | 404 | TASK_NOT_FOUND | 任务不存在 |
| 40901 | 409 | CONCEPT_ALREADY_EXISTS | 概念已存在（名称冲突） |
| 40902 | 409 | ENTITY_ALREADY_EXISTS | 实体已存在（唯一键冲突） |
| 40903 | 409 | RELATION_ALREADY_EXISTS | 关系已存在 |
| 40904 | 409 | ATTRIBUTE_ALREADY_EXISTS | 属性已存在 |
| 40905 | 409 | RULE_ALREADY_EXISTS | 规则已存在 |
| 40906 | 409 | VERSION_CONFLICT | 版本并发冲突 |
| 40907 | 409 | CYCLIC_INHERITANCE | 概念继承存在环 |
| 42201 | 422 | CONCEPT_HAS_ENTITIES | 概念下存在实体，无法删除 |
| 42202 | 422 | CONCEPT_HAS_CHILDREN | 概念下存在子概念，无法删除 |
| 42203 | 422 | ATTRIBUTE_CONSTRAINT_VIOLATION | 属性约束校验失败 |
| 42204 | 422 | RULE_EXECUTION_FAILED | 规则执行失败 |
| 42205 | 422 | INFERENCE_INCONSISTENCY | 本体推理发现不一致 |
| 42206 | 422 | VERSION_NOT_PUBLISHED | 版本未发布，无法回滚 |
| 42207 | 422 | RELATION_CONSTRAINT_VIOLATION | 关系约束校验失败（基数/类型） |
| 42901 | 429 | RATE_LIMIT_EXCEEDED | 限流触发 |
| 50001 | 500 | INTERNAL_ERROR | 服务内部错误 |
| 50002 | 500 | DATABASE_ERROR | 数据库操作失败 |
| 50003 | 500 | NEO4J_ERROR | 图数据库操作失败 |
| 50004 | 500 | INFERENCE_ENGINE_ERROR | 推理引擎异常 |
| 50005 | 500 | KAFKA_PUBLISH_FAILED | Kafka 消息发布失败 |
| 50301 | 503 | SERVICE_UNAVAILABLE | 服务暂不可用 |

错误响应示例：

```json
{
  "code": 40401,
  "message": "概念不存在: conceptId=concept-001",
  "data": null,
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### 2.5 分页参数约定

所有列表接口支持以下通用查询参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| page | integer | 否 | 1 | 页码，从 1 开始 |
| pageSize | integer | 否 | 20 | 每页条数，最大 100 |
| sort | string | 否 | createdAt:desc | 排序字段，格式 `field:asc\|desc`，支持多字段逗号分隔 |
| keyword | string | 否 | - | 关键词搜索（模糊匹配名称/描述） |

### 2.6 trace_id 传播

#### 2.6.1 入站传播

- 请求方通过 HTTP Header `X-Trace-Id` 传入 trace_id
- 若未传入，TECH-ONT 自动生成 UUID v4 作为 trace_id
- trace_id 写入 MDC（Mapped Diagnostic Context），贯穿整个请求处理链路

#### 2.6.2 出站传播

- 所有响应体的 `traceId` 字段携带当前请求的 trace_id
- 所有 Kafka 消息（Outbox 模式）的 Header 包含 `X-Trace-Id`
- 调用下游服务时透传 `X-Trace-Id` Header

#### 2.6.3 DLQ 记录

- 消费失败的 Kafka 消息写入 DLQ 时，记录体必须包含 `traceId` 字段
- DLQ 消息重试上限：3 次，超过后进入死信存储

---

## 3. API 接口详情

### 3.1 概念管理 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/ont/concepts` | 创建概念 |
| GET | `/api/v1/ont/concepts` | 概念列表（分页） |
| GET | `/api/v1/ont/concepts/{conceptId}` | 获取概念详情 |
| PUT | `/api/v1/ont/concepts/{conceptId}` | 更新概念 |
| DELETE | `/api/v1/ont/concepts/{conceptId}` | 删除概念 |
| GET | `/api/v1/ont/concepts/{conceptId}/children` | 获取子概念列表 |
| GET | `/api/v1/ont/concepts/{conceptId}/parents` | 获取父概念链 |
| GET | `/api/v1/ont/concepts/tree` | 获取概念层级树 |
| POST | `/api/v1/ont/concepts/{conceptId}/move` | 移动概念（变更父概念） |

---

#### 3.1.1 创建概念

**POST** `/api/v1/ont/concepts`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | 概念名称，租户内唯一，1-128 字符 |
| code | string | 是 | 概念编码，`^[A-Z][A-Z0-9_]*$`，租户内唯一 |
| description | string | 否 | 概念描述，最长 1024 字符 |
| parentConceptId | string | 否 | 父概念 ID，为空表示根概念 |
| icon | string | 否 | 概念图标标识 |
| metadata | object | 否 | 扩展元数据，key-value 结构 |
| attributeIds | array[string] | 否 | 关联属性 ID 列表 |

**请求示例**

```json
{
  "name": "客户",
  "code": "CUSTOMER",
  "description": "企业客户实体概念，包含个人客户与企业客户",
  "parentConceptId": "concept-org-001",
  "icon": "user",
  "metadata": {
    "domain": "CRM",
    "owner": "sales-team"
  },
  "attributeIds": ["attr-001", "attr-002"]
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "conceptId": "concept-customer-001",
    "name": "客户",
    "code": "CUSTOMER",
    "description": "企业客户实体概念，包含个人客户与企业客户",
    "parentConceptId": "concept-org-001",
    "icon": "user",
    "metadata": {
      "domain": "CRM",
      "owner": "sales-team"
    },
    "attributeIds": ["attr-001", "attr-002"],
    "depth": 2,
    "path": "/concept-root/concept-org-001/concept-customer-001",
    "createdAt": "2026-07-16T10:30:00.000Z",
    "updatedAt": "2026-07-16T10:30:00.000Z",
    "createdBy": "user-001",
    "updatedBy": "user-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | name/code 为空或格式不合法 |
| 40401 | parentConceptId 指向的概念不存在 |
| 40901 | name 或 code 已存在 |
| 40907 | parentConceptId 导致继承环 |
| 40301 | 无创建概念权限 |

---

#### 3.1.2 概念列表（分页）

**GET** `/api/v1/ont/concepts`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序，默认 `createdAt:desc` |
| keyword | string | 否 | 关键词搜索 |
| parentConceptId | string | 否 | 按父概念过滤 |
| code | string | 否 | 按编码精确匹配 |
| includeAttributes | boolean | 否 | 是否返回关联属性，默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "conceptId": "concept-customer-001",
        "name": "客户",
        "code": "CUSTOMER",
        "description": "企业客户实体概念",
        "parentConceptId": "concept-org-001",
        "depth": 2,
        "entityCount": 1523,
        "childCount": 2,
        "createdAt": "2026-07-16T10:30:00.000Z",
        "updatedAt": "2026-07-16T10:30:00.000Z"
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

---

#### 3.1.3 获取概念详情

**GET** `/api/v1/ont/concepts/{conceptId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| conceptId | string | 是 | 概念 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| includeAttributes | boolean | 否 | 是否返回关联属性列表，默认 true |
| includeChildren | boolean | 否 | 是否返回直接子概念列表，默认 false |
| includeInherited | boolean | 否 | 是否返回继承自父概念的属性，默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "conceptId": "concept-customer-001",
    "name": "客户",
    "code": "CUSTOMER",
    "description": "企业客户实体概念",
    "parentConceptId": "concept-org-001",
    "icon": "user",
    "metadata": { "domain": "CRM" },
    "depth": 2,
    "path": "/concept-root/concept-org-001/concept-customer-001",
    "attributes": [
      {
        "attributeId": "attr-001",
        "name": "客户名称",
        "code": "CUSTOMER_NAME",
        "dataType": "STRING",
        "required": true,
        "inherited": false
      },
      {
        "attributeId": "attr-inherited-001",
        "name": "创建时间",
        "code": "CREATED_AT",
        "dataType": "DATETIME",
        "required": true,
        "inherited": true
      }
    ],
    "children": [
      {
        "conceptId": "concept-individual-001",
        "name": "个人客户",
        "code": "INDIVIDUAL_CUSTOMER"
      }
    ],
    "entityCount": 1523,
    "createdAt": "2026-07-16T10:30:00.000Z",
    "updatedAt": "2026-07-16T11:00:00.000Z",
    "createdBy": "user-001",
    "updatedBy": "user-002"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | conceptId 不存在 |

---

#### 3.1.4 更新概念

**PUT** `/api/v1/ont/concepts/{conceptId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| conceptId | string | 是 | 概念 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | 概念名称 |
| description | string | 否 | 概念描述 |
| icon | string | 否 | 概念图标 |
| metadata | object | 否 | 扩展元数据（整体覆盖） |
| attributeIds | array[string] | 否 | 关联属性 ID 列表（整体覆盖） |

> `code` 与 `parentConceptId` 不允许通过此接口修改，变更父概念请使用 `POST /move` 接口。

**请求示例**

```json
{
  "name": "客户（更新）",
  "description": "更新后的描述",
  "metadata": { "domain": "CRM", "version": "2" }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "conceptId": "concept-customer-001",
    "name": "客户（更新）",
    "code": "CUSTOMER",
    "description": "更新后的描述",
    "parentConceptId": "concept-org-001",
    "metadata": { "domain": "CRM", "version": "2" },
    "updatedAt": "2026-07-16T12:00:00.000Z",
    "updatedBy": "user-002"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | name 格式不合法 |
| 40401 | conceptId 不存在 |
| 40404 | attributeIds 中存在不存在的属性 ID |
| 40901 | name 已被其他概念占用 |

---

#### 3.1.5 删除概念

**DELETE** `/api/v1/ont/concepts/{conceptId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| conceptId | string | 是 | 概念 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| cascade | boolean | 否 | 是否级联删除子概念与实体，默认 false |
| force | boolean | 否 | 当 cascade=false 且存在子概念/实体时是否强制删除，默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "conceptId": "concept-customer-001",
    "deleted": true,
    "cascadeDeleted": {
      "concepts": ["concept-individual-001"],
      "entities": ["entity-001", "entity-002"]
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | conceptId 不存在 |
| 42201 | 概念下存在实体且 cascade=false 且 force=false |
| 42202 | 概念下存在子概念且 cascade=false 且 force=false |

---

#### 3.1.6 获取子概念列表

**GET** `/api/v1/ont/concepts/{conceptId}/children`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| conceptId | string | 是 | 概念 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| recursive | boolean | 否 | 是否递归获取所有后代，默认 false |
| maxDepth | integer | 否 | 递归最大深度，默认无限制 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "conceptId": "concept-individual-001",
        "name": "个人客户",
        "code": "INDIVIDUAL_CUSTOMER",
        "depth": 3,
        "entityCount": 800,
        "childCount": 0
      },
      {
        "conceptId": "concept-enterprise-001",
        "name": "企业客户",
        "code": "ENTERPRISE_CUSTOMER",
        "depth": 3,
        "entityCount": 723,
        "childCount": 1
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.7 获取父概念链

**GET** `/api/v1/ont/concepts/{conceptId}/parents`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| conceptId | string | 是 | 概念 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "chain": [
      {
        "conceptId": "concept-root",
        "name": "根概念",
        "code": "ROOT",
        "depth": 0
      },
      {
        "conceptId": "concept-org-001",
        "name": "组织",
        "code": "ORGANIZATION",
        "depth": 1
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.8 获取概念层级树

**GET** `/api/v1/ont/concepts/tree`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| rootConceptId | string | 否 | 树根概念 ID，默认为租户根概念 |
| maxDepth | integer | 否 | 最大深度，默认 5 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tree": {
      "conceptId": "concept-root",
      "name": "根概念",
      "code": "ROOT",
      "children": [
        {
          "conceptId": "concept-org-001",
          "name": "组织",
          "code": "ORGANIZATION",
          "children": [
            {
              "conceptId": "concept-customer-001",
              "name": "客户",
              "code": "CUSTOMER",
              "children": []
            }
          ]
        }
      ]
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.1.9 移动概念（变更父概念）

**POST** `/api/v1/ont/concepts/{conceptId}/move`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| conceptId | string | 是 | 概念 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| newParentConceptId | string | 否 | 新父概念 ID，为空表示移至根级 |

**请求示例**

```json
{
  "newParentConceptId": "concept-new-parent-001"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "conceptId": "concept-customer-001",
    "oldParentConceptId": "concept-org-001",
    "newParentConceptId": "concept-new-parent-001",
    "newDepth": 2,
    "newPath": "/concept-root/concept-new-parent-001/concept-customer-001",
    "updatedAt": "2026-07-16T13:00:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | conceptId 或 newParentConceptId 不存在 |
| 40907 | 移动后产生继承环 |

---

### 3.2 实体管理 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/ont/entities` | 创建实体 |
| POST | `/api/v1/ont/entities/batch` | 批量创建实体 |
| GET | `/api/v1/ont/entities` | 实体列表（分页） |
| GET | `/api/v1/ont/entities/{entityId}` | 获取实体详情 |
| PUT | `/api/v1/ont/entities/{entityId}` | 更新实体 |
| DELETE | `/api/v1/ont/entities/{entityId}` | 删除实体 |
| GET | `/api/v1/ont/entities/by-concept/{conceptId}` | 按概念查询实体 |
| GET | `/api/v1/ont/entities/{entityId}/attributes` | 获取实体属性值 |
| PUT | `/api/v1/ont/entities/{entityId}/attributes` | 批量设置实体属性值 |
| PUT | `/api/v1/ont/entities/{entityId}/attributes/{attributeId}` | 设置单个属性值 |

---

#### 3.2.1 创建实体

**POST** `/api/v1/ont/entities`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| conceptId | string | 是 | 所属概念 ID |
| name | string | 是 | 实体名称，1-256 字符 |
| code | string | 否 | 实体编码，租户+概念内唯一 |
| description | string | 否 | 实体描述 |
| attributes | object | 否 | 属性键值对，key 为 attributeCode |
| metadata | object | 否 | 扩展元数据 |

**请求示例**

```json
{
  "conceptId": "concept-customer-001",
  "name": "阿里巴巴集团",
  "code": "ENT-ALIBABA-001",
  "description": "阿里巴巴集团控股有限公司",
  "attributes": {
    "CUSTOMER_NAME": "阿里巴巴集团",
    "CUSTOMER_TYPE": "ENTERPRISE",
    "INDUSTRY": "互联网科技",
    "REGISTERED_CAPITAL": "50000000000"
  }
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "entityId": "entity-alibaba-001",
    "conceptId": "concept-customer-001",
    "name": "阿里巴巴集团",
    "code": "ENT-ALIBABA-001",
    "description": "阿里巴巴集团控股有限公司",
    "attributes": {
      "CUSTOMER_NAME": {
        "attributeId": "attr-001",
        "value": "阿里巴巴集团",
        "dataType": "STRING",
        "valid": true
      },
      "CUSTOMER_TYPE": {
        "attributeId": "attr-002",
        "value": "ENTERPRISE",
        "dataType": "ENUM",
        "valid": true
      },
      "INDUSTRY": {
        "attributeId": "attr-003",
        "value": "互联网科技",
        "dataType": "STRING",
        "valid": true
      },
      "REGISTERED_CAPITAL": {
        "attributeId": "attr-004",
        "value": "50000000000",
        "dataType": "DECIMAL",
        "valid": true
      }
    },
    "metadata": {},
    "createdAt": "2026-07-16T10:35:00.000Z",
    "updatedAt": "2026-07-16T10:35:00.000Z",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | name 为空或 conceptId 为空 |
| 40401 | conceptId 不存在 |
| 40202 | code 已存在 |
| 42203 | 属性值不满足约束（必填缺失/类型不匹配/枚举值非法） |

---

#### 3.2.2 批量创建实体

**POST** `/api/v1/ont/entities/batch`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| conceptId | string | 是 | 所属概念 ID |
| entities | array[object] | 是 | 实体列表，每项结构同 3.2.1 请求体（不含 conceptId） |
| mode | string | 否 | 写入模式：`insert`（仅插入，默认）、`upsert`（存在则更新）、`skip`（存在则跳过） |

**请求示例**

```json
{
  "conceptId": "concept-customer-001",
  "mode": "upsert",
  "entities": [
    {
      "name": "阿里巴巴集团",
      "code": "ENT-ALIBABA-001",
      "attributes": { "CUSTOMER_TYPE": "ENTERPRISE" }
    },
    {
      "name": "腾讯科技",
      "code": "ENT-TENCENT-001",
      "attributes": { "CUSTOMER_TYPE": "ENTERPRISE" }
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
    "totalCount": 2,
    "successCount": 2,
    "failedCount": 0,
    "results": [
      {
        "index": 0,
        "entityId": "entity-alibaba-001",
        "action": "updated",
        "success": true
      },
      {
        "index": 1,
        "entityId": "entity-tencent-001",
        "action": "inserted",
        "success": true
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.2.3 实体列表（分页）

**GET** `/api/v1/ont/entities`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序字段 |
| keyword | string | 否 | 关键词搜索（名称/编码） |
| conceptId | string | 否 | 按概念过滤 |
| includeAttributes | boolean | 否 | 是否返回属性值，默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "entityId": "entity-alibaba-001",
        "conceptId": "concept-customer-001",
        "conceptName": "客户",
        "name": "阿里巴巴集团",
        "code": "ENT-ALIBABA-001",
        "createdAt": "2026-07-16T10:35:00.000Z",
        "updatedAt": "2026-07-16T10:35:00.000Z"
      }
    ],
    "total": 1523,
    "page": 1,
    "pageSize": 20,
    "totalPages": 77
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.2.4 获取实体详情

**GET** `/api/v1/ont/entities/{entityId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| entityId | string | 是 | 实体 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| includeAttributes | boolean | 否 | 是否返回属性值，默认 true |
| includeRelations | boolean | 否 | 是否返回关联关系，默认 false |
| includeInherited | boolean | 否 | 是否返回继承属性，默认 true |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "entityId": "entity-alibaba-001",
    "conceptId": "concept-customer-001",
    "conceptName": "客户",
    "name": "阿里巴巴集团",
    "code": "ENT-ALIBABA-001",
    "description": "阿里巴巴集团控股有限公司",
    "attributes": {
      "CUSTOMER_NAME": {
        "attributeId": "attr-001",
        "value": "阿里巴巴集团",
        "dataType": "STRING"
      },
      "CUSTOMER_TYPE": {
        "attributeId": "attr-002",
        "value": "ENTERPRISE",
        "dataType": "ENUM"
      }
    },
    "relations": [
      {
        "relationInstanceId": "rel-inst-001",
        "relationType": "SUPPLIES_TO",
        "targetEntityId": "entity-tencent-001",
        "targetEntityName": "腾讯科技"
      }
    ],
    "metadata": {},
    "createdAt": "2026-07-16T10:35:00.000Z",
    "updatedAt": "2026-07-16T10:35:00.000Z",
    "createdBy": "user-001",
    "updatedBy": "user-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40402 | entityId 不存在 |

---

#### 3.2.5 更新实体

**PUT** `/api/v1/ont/entities/{entityId}`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | 实体名称 |
| description | string | 否 | 实体描述 |
| code | string | 否 | 实体编码 |
| metadata | object | 否 | 扩展元数据（整体覆盖） |

**请求示例**

```json
{
  "name": "阿里巴巴集团（更新）",
  "description": "更新后的描述"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "entityId": "entity-alibaba-001",
    "name": "阿里巴巴集团（更新）",
    "description": "更新后的描述",
    "updatedAt": "2026-07-16T12:30:00.000Z",
    "updatedBy": "user-002"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.2.6 删除实体

**DELETE** `/api/v1/ont/entities/{entityId}`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| cascade | boolean | 否 | 是否级联删除关联关系实例，默认 true |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "entityId": "entity-alibaba-001",
    "deleted": true,
    "cascadeDeletedRelations": 3
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.2.7 按概念查询实体

**GET** `/api/v1/ont/entities/by-concept/{conceptId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| conceptId | string | 是 | 概念 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| includeSubConcepts | boolean | 否 | 是否包含子概念下的实体，默认 false |
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |
| keyword | string | 否 | 关键词搜索 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "conceptId": "concept-customer-001",
    "items": [
      {
        "entityId": "entity-alibaba-001",
        "name": "阿里巴巴集团",
        "code": "ENT-ALIBABA-001"
      }
    ],
    "total": 1523,
    "page": 1,
    "pageSize": 20,
    "totalPages": 77
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.2.8 获取实体属性值

**GET** `/api/v1/ont/entities/{entityId}/attributes`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| includeInherited | boolean | 否 | 是否包含继承属性，默认 true |
| attributeCodes | string | 否 | 指定属性编码列表，逗号分隔 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "entityId": "entity-alibaba-001",
    "attributes": {
      "CUSTOMER_NAME": {
        "attributeId": "attr-001",
        "attributeName": "客户名称",
        "value": "阿里巴巴集团",
        "dataType": "STRING",
        "inherited": false
      },
      "CUSTOMER_TYPE": {
        "attributeId": "attr-002",
        "attributeName": "客户类型",
        "value": "ENTERPRISE",
        "dataType": "ENUM",
        "inherited": false
      },
      "CREATED_AT": {
        "attributeId": "attr-inherited-001",
        "attributeName": "创建时间",
        "value": "2026-07-16T10:35:00.000Z",
        "dataType": "DATETIME",
        "inherited": true
      }
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.2.9 批量设置实体属性值

**PUT** `/api/v1/ont/entities/{entityId}/attributes`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| attributes | object | 是 | 属性键值对，key 为 attributeCode，value 为属性值 |
| validateConstraints | boolean | 否 | 是否校验属性约束，默认 true |

**请求示例**

```json
{
  "attributes": {
    "CUSTOMER_NAME": "阿里巴巴集团（更新）",
    "INDUSTRY": "电子商务"
  },
  "validateConstraints": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "entityId": "entity-alibaba-001",
    "updated": ["CUSTOMER_NAME", "INDUSTRY"],
    "validation": {
      "passed": true,
      "errors": []
    },
    "updatedAt": "2026-07-16T12:45:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40402 | entityId 不存在 |
| 40404 | attributeCode 不存在 |
| 42203 | 属性值不满足约束 |

---

#### 3.2.10 设置单个属性值

**PUT** `/api/v1/ont/entities/{entityId}/attributes/{attributeId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| entityId | string | 是 | 实体 ID |
| attributeId | string | 是 | 属性 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| value | any | 是 | 属性值，类型需与属性 dataType 匹配 |

**请求示例**

```json
{
  "value": "阿里巴巴集团控股有限公司"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "entityId": "entity-alibaba-001",
    "attributeId": "attr-001",
    "attributeCode": "CUSTOMER_NAME",
    "value": "阿里巴巴集团控股有限公司",
    "valid": true,
    "updatedAt": "2026-07-16T12:50:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

### 3.3 关系管理 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/ont/relations/types` | 创建关系类型 |
| GET | `/api/v1/ont/relations/types` | 关系类型列表（分页） |
| GET | `/api/v1/ont/relations/types/{relationTypeId}` | 获取关系类型详情 |
| PUT | `/api/v1/ont/relations/types/{relationTypeId}` | 更新关系类型 |
| DELETE | `/api/v1/ont/relations/types/{relationTypeId}` | 删除关系类型 |
| POST | `/api/v1/ont/relations/instances` | 创建关系实例 |
| GET | `/api/v1/ont/relations/instances` | 关系实例列表（分页） |
| GET | `/api/v1/ont/relations/instances/{relationInstanceId}` | 获取关系实例详情 |
| DELETE | `/api/v1/ont/relations/instances/{relationInstanceId}` | 删除关系实例 |
| GET | `/api/v1/ont/relations/instances/by-entity/{entityId}` | 查询实体的关联关系 |

---

#### 3.3.1 创建关系类型

**POST** `/api/v1/ont/relations/types`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | 关系类型名称，1-128 字符 |
| code | string | 是 | 关系类型编码，`^[A-Z][A-Z0-9_]*$`，租户内唯一 |
| description | string | 否 | 关系类型描述 |
| sourceConceptId | string | 是 | 源概念 ID |
| targetConceptId | string | 是 | 目标概念 ID |
| direction | string | 否 | 方向：`DIRECTED`（有向，默认）、`UNDIRECTED`（无向）、`BIDIRECTIONAL`（双向） |
| cardinality | string | 否 | 基数约束：`ONE_TO_ONE`、`ONE_TO_MANY`、`MANY_TO_MANY`（默认） |
| minCardinality | integer | 否 | 最小基数，默认 0 |
| maxCardinality | integer | 否 | 最大基数，0 表示无限制，默认 0 |
| symmetric | boolean | 否 | 是否对称关系，默认 false |
| transitive | boolean | 否 | 是否传递关系，默认 false |
| attributeIds | array[string] | 否 | 关系上的属性 ID 列表 |

**请求示例**

```json
{
  "name": "供货关系",
  "code": "SUPPLIES_TO",
  "description": "供应商向客户供货的关系",
  "sourceConceptId": "concept-supplier-001",
  "targetConceptId": "concept-customer-001",
  "direction": "DIRECTED",
  "cardinality": "MANY_TO_MANY",
  "transitive": false,
  "attributeIds": ["attr-rel-001"]
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "relationTypeId": "rel-type-supplies-001",
    "name": "供货关系",
    "code": "SUPPLIES_TO",
    "description": "供应商向客户供货的关系",
    "sourceConceptId": "concept-supplier-001",
    "sourceConceptName": "供应商",
    "targetConceptId": "concept-customer-001",
    "targetConceptName": "客户",
    "direction": "DIRECTED",
    "cardinality": "MANY_TO_MANY",
    "minCardinality": 0,
    "maxCardinality": 0,
    "symmetric": false,
    "transitive": false,
    "attributeIds": ["attr-rel-001"],
    "createdAt": "2026-07-16T11:00:00.000Z",
    "updatedAt": "2026-07-16T11:00:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | name/code/sourceConceptId/targetConceptId 为空 |
| 40401 | sourceConceptId 或 targetConceptId 不存在 |
| 40903 | code 已存在 |

---

#### 3.3.2 关系类型列表

**GET** `/api/v1/ont/relations/types`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |
| keyword | string | 否 | 关键词搜索 |
| sourceConceptId | string | 否 | 按源概念过滤 |
| targetConceptId | string | 否 | 按目标概念过滤 |
| direction | string | 否 | 按方向过滤 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "relationTypeId": "rel-type-supplies-001",
        "name": "供货关系",
        "code": "SUPPLIES_TO",
        "sourceConceptId": "concept-supplier-001",
        "sourceConceptName": "供应商",
        "targetConceptId": "concept-customer-001",
        "targetConceptName": "客户",
        "direction": "DIRECTED",
        "cardinality": "MANY_TO_MANY",
        "instanceCount": 320
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

#### 3.3.3 获取关系类型详情

**GET** `/api/v1/ont/relations/types/{relationTypeId}`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "relationTypeId": "rel-type-supplies-001",
    "name": "供货关系",
    "code": "SUPPLIES_TO",
    "description": "供应商向客户供货的关系",
    "sourceConceptId": "concept-supplier-001",
    "sourceConceptName": "供应商",
    "targetConceptId": "concept-customer-001",
    "targetConceptName": "客户",
    "direction": "DIRECTED",
    "cardinality": "MANY_TO_MANY",
    "minCardinality": 0,
    "maxCardinality": 0,
    "symmetric": false,
    "transitive": false,
    "attributeIds": ["attr-rel-001"],
    "attributes": [
      {
        "attributeId": "attr-rel-001",
        "name": "供货金额",
        "code": "SUPPLY_AMOUNT",
        "dataType": "DECIMAL"
      }
    ],
    "instanceCount": 320,
    "createdAt": "2026-07-16T11:00:00.000Z",
    "updatedAt": "2026-07-16T11:00:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.3.4 更新关系类型

**PUT** `/api/v1/ont/relations/types/{relationTypeId}`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | 关系类型名称 |
| description | string | 否 | 关系类型描述 |
| direction | string | 否 | 方向（已有实例时不建议修改） |
| cardinality | string | 否 | 基数约束 |
| minCardinality | integer | 否 | 最小基数 |
| maxCardinality | integer | 否 | 最大基数 |
| symmetric | boolean | 否 | 是否对称 |
| transitive | boolean | 否 | 是否传递 |
| attributeIds | array[string] | 否 | 关联属性 ID 列表（整体覆盖） |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "relationTypeId": "rel-type-supplies-001",
    "name": "供货关系（更新）",
    "updatedAt": "2026-07-16T12:00:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.3.5 删除关系类型

**DELETE** `/api/v1/ont/relations/types/{relationTypeId}`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| cascade | boolean | 否 | 是否级联删除关系实例，默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "relationTypeId": "rel-type-supplies-001",
    "deleted": true,
    "cascadeDeletedInstances": 320
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 42207 | 存在关系实例且 cascade=false |

---

#### 3.3.6 创建关系实例

**POST** `/api/v1/ont/relations/instances`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| relationTypeId | string | 是 | 关系类型 ID |
| sourceEntityId | string | 是 | 源实体 ID |
| targetEntityId | string | 是 | 目标实体 ID |
| attributes | object | 否 | 关系属性键值对 |
| metadata | object | 否 | 扩展元数据 |

**请求示例**

```json
{
  "relationTypeId": "rel-type-supplies-001",
  "sourceEntityId": "entity-supplier-001",
  "targetEntityId": "entity-alibaba-001",
  "attributes": {
    "SUPPLY_AMOUNT": "5000000",
    "SUPPLY_DATE": "2026-07-16"
  }
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "relationInstanceId": "rel-inst-001",
    "relationTypeId": "rel-type-supplies-001",
    "relationTypeCode": "SUPPLIES_TO",
    "sourceEntityId": "entity-supplier-001",
    "sourceEntityName": "供应商A",
    "targetEntityId": "entity-alibaba-001",
    "targetEntityName": "阿里巴巴集团",
    "attributes": {
      "SUPPLY_AMOUNT": {
        "attributeId": "attr-rel-001",
        "value": "5000000",
        "dataType": "DECIMAL"
      }
    },
    "createdAt": "2026-07-16T11:30:00.000Z",
    "updatedAt": "2026-07-16T11:30:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | relationTypeId/sourceEntityId/targetEntityId 为空 |
| 40402 | sourceEntityId 或 targetEntityId 不存在 |
| 40403 | relationTypeId 不存在 |
| 40903 | 相同源-目标-类型的关系实例已存在（且关系类型不允许重复） |
| 42207 | 违反基数约束（超出 maxCardinality）或源/目标实体概念不匹配 |

---

#### 3.3.7 关系实例列表

**GET** `/api/v1/ont/relations/instances`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |
| relationTypeId | string | 否 | 按关系类型过滤 |
| sourceEntityId | string | 否 | 按源实体过滤 |
| targetEntityId | string | 否 | 按目标实体过滤 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "relationInstanceId": "rel-inst-001",
        "relationTypeId": "rel-type-supplies-001",
        "relationTypeCode": "SUPPLIES_TO",
        "sourceEntityId": "entity-supplier-001",
        "sourceEntityName": "供应商A",
        "targetEntityId": "entity-alibaba-001",
        "targetEntityName": "阿里巴巴集团",
        "createdAt": "2026-07-16T11:30:00.000Z"
      }
    ],
    "total": 320,
    "page": 1,
    "pageSize": 20,
    "totalPages": 16
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.3.8 获取关系实例详情

**GET** `/api/v1/ont/relations/instances/{relationInstanceId}`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "relationInstanceId": "rel-inst-001",
    "relationTypeId": "rel-type-supplies-001",
    "relationTypeCode": "SUPPLIES_TO",
    "sourceEntityId": "entity-supplier-001",
    "sourceEntityName": "供应商A",
    "targetEntityId": "entity-alibaba-001",
    "targetEntityName": "阿里巴巴集团",
    "attributes": {
      "SUPPLY_AMOUNT": {
        "attributeId": "attr-rel-001",
        "value": "5000000",
        "dataType": "DECIMAL"
      }
    },
    "metadata": {},
    "createdAt": "2026-07-16T11:30:00.000Z",
    "updatedAt": "2026-07-16T11:30:00.000Z",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.3.9 删除关系实例

**DELETE** `/api/v1/ont/relations/instances/{relationInstanceId}`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "relationInstanceId": "rel-inst-001",
    "deleted": true
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.3.10 查询实体的关联关系

**GET** `/api/v1/ont/relations/instances/by-entity/{entityId}`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| role | string | 否 | 角色：`SOURCE`（作为源）、`TARGET`（作为目标）、`BOTH`（默认） |
| relationTypeId | string | 否 | 按关系类型过滤 |
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "entityId": "entity-alibaba-001",
    "items": [
      {
        "relationInstanceId": "rel-inst-001",
        "relationTypeId": "rel-type-supplies-001",
        "relationTypeCode": "SUPPLIES_TO",
        "role": "TARGET",
        "counterpartEntityId": "entity-supplier-001",
        "counterpartEntityName": "供应商A"
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

### 3.4 属性管理 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/ont/attributes` | 创建属性定义 |
| GET | `/api/v1/ont/attributes` | 属性列表（分页） |
| GET | `/api/v1/ont/attributes/{attributeId}` | 获取属性详情 |
| PUT | `/api/v1/ont/attributes/{attributeId}` | 更新属性 |
| DELETE | `/api/v1/ont/attributes/{attributeId}` | 删除属性 |
| POST | `/api/v1/ont/attributes/{attributeId}/validate` | 校验属性值 |

---

#### 3.4.1 创建属性定义

**POST** `/api/v1/ont/attributes`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | 属性名称，1-128 字符 |
| code | string | 是 | 属性编码，`^[A-Z][A-Z0-9_]*$`，租户内唯一 |
| description | string | 否 | 属性描述 |
| dataType | string | 是 | 数据类型：`STRING`、`INTEGER`、`LONG`、`DECIMAL`、`BOOLEAN`、`DATETIME`、`DATE`、`ENUM`、`JSON`、`UUID`、`REFERENCE` |
| required | boolean | 否 | 是否必填，默认 false |
| unique | boolean | 否 | 是否唯一，默认 false |
| defaultValue | any | 否 | 默认值 |
| enumValues | array[object] | 否 | 枚举值列表（dataType=ENUM 时必填） |
| constraints | object | 否 | 约束条件 |
| unit | string | 否 | 单位（如 kg、元、% |

`enumValues` 项结构：

| 字段 | 类型 | 说明 |
|---|---|---|
| value | string | 枚举值编码 |
| label | string | 枚举值显示名称 |

`constraints` 结构：

| 字段 | 类型 | 说明 |
|---|---|---|
| minLength | integer | 字符串最小长度（STRING 类型） |
| maxLength | integer | 字符串最大长度（STRING 类型） |
| min | number | 数值最小值（INTEGER/LONG/DECIMAL 类型） |
| max | number | 数值最大值 |
| pattern | string | 正则校验（STRING 类型） |
| precision | integer | 小数精度（DECIMAL 类型） |
| referenceConceptId | string | 引用概念 ID（REFERENCE 类型） |

**请求示例**

```json
{
  "name": "客户类型",
  "code": "CUSTOMER_TYPE",
  "description": "客户分类枚举属性",
  "dataType": "ENUM",
  "required": true,
  "unique": false,
  "enumValues": [
    { "value": "INDIVIDUAL", "label": "个人客户" },
    { "value": "ENTERPRISE", "label": "企业客户" },
    { "value": "GOVERNMENT", "label": "政府客户" }
  ]
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "attributeId": "attr-002",
    "name": "客户类型",
    "code": "CUSTOMER_TYPE",
    "description": "客户分类枚举属性",
    "dataType": "ENUM",
    "required": true,
    "unique": false,
    "defaultValue": null,
    "enumValues": [
      { "value": "INDIVIDUAL", "label": "个人客户" },
      { "value": "ENTERPRISE", "label": "企业客户" },
      { "value": "GOVERNMENT", "label": "政府客户" }
    ],
    "constraints": {},
    "unit": null,
    "conceptCount": 0,
    "createdAt": "2026-07-16T09:00:00.000Z",
    "updatedAt": "2026-07-16T09:00:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | name/code/dataType 为空或格式不合法 |
| 40004 | dataType=ENUM 但 enumValues 为空 |
| 40904 | code 已存在 |

---

#### 3.4.2 属性列表

**GET** `/api/v1/ont/attributes`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |
| keyword | string | 否 | 关键词搜索 |
| dataType | string | 否 | 按数据类型过滤 |
| conceptId | string | 否 | 按关联概念过滤 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "attributeId": "attr-002",
        "name": "客户类型",
        "code": "CUSTOMER_TYPE",
        "dataType": "ENUM",
        "required": true,
        "conceptCount": 3
      }
    ],
    "total": 45,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.4.3 获取属性详情

**GET** `/api/v1/ont/attributes/{attributeId}`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "attributeId": "attr-002",
    "name": "客户类型",
    "code": "CUSTOMER_TYPE",
    "description": "客户分类枚举属性",
    "dataType": "ENUM",
    "required": true,
    "unique": false,
    "defaultValue": null,
    "enumValues": [
      { "value": "INDIVIDUAL", "label": "个人客户" },
      { "value": "ENTERPRISE", "label": "企业客户" },
      { "value": "GOVERNMENT", "label": "政府客户" }
    ],
    "constraints": {},
    "unit": null,
    "concepts": [
      { "conceptId": "concept-customer-001", "conceptName": "客户" }
    ],
    "createdAt": "2026-07-16T09:00:00.000Z",
    "updatedAt": "2026-07-16T09:00:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.4.4 更新属性

**PUT** `/api/v1/ont/attributes/{attributeId}`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | 属性名称 |
| description | string | 否 | 属性描述 |
| required | boolean | 否 | 是否必填 |
| unique | boolean | 否 | 是否唯一 |
| defaultValue | any | 否 | 默认值 |
| enumValues | array[object] | 否 | 枚举值列表（仅 ENUM 类型） |
| constraints | object | 否 | 约束条件 |
| unit | string | 否 | 单位 |

> `code` 与 `dataType` 不允许修改。

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "attributeId": "attr-002",
    "name": "客户类型（更新）",
    "updatedAt": "2026-07-16T10:00:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.4.5 删除属性

**DELETE** `/api/v1/ont/attributes/{attributeId}`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| cascade | boolean | 否 | 是否级联清除已赋值的实体属性值，默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "attributeId": "attr-002",
    "deleted": true,
    "cascadeClearedValues": 0
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 42203 | 属性已被概念关联且 cascade=false |

---

#### 3.4.6 校验属性值

**POST** `/api/v1/ont/attributes/{attributeId}/validate`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| value | any | 是 | 待校验的属性值 |

**请求示例**

```json
{
  "value": "ENTERPRISE"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "attributeId": "attr-002",
    "value": "ENTERPRISE",
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
    "attributeId": "attr-002",
    "value": "INVALID_TYPE",
    "valid": false,
    "errors": [
      {
        "rule": "ENUM_VALUE",
        "message": "值 INVALID_TYPE 不在枚举范围内"
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

### 3.5 规则管理 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/ont/rules` | 创建规则 |
| GET | `/api/v1/ont/rules` | 规则列表（分页） |
| GET | `/api/v1/ont/rules/{ruleId}` | 获取规则详情 |
| PUT | `/api/v1/ont/rules/{ruleId}` | 更新规则 |
| DELETE | `/api/v1/ont/rules/{ruleId}` | 删除规则 |
| POST | `/api/v1/ont/rules/{ruleId}/enable` | 启用规则 |
| POST | `/api/v1/ont/rules/{ruleId}/disable` | 禁用规则 |
| POST | `/api/v1/ont/rules/{ruleId}/test` | 测试规则执行 |

---

#### 3.5.1 创建规则

**POST** `/api/v1/ont/rules`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | 规则名称，1-128 字符 |
| code | string | 是 | 规则编码，租户内唯一 |
| description | string | 否 | 规则描述 |
| ruleType | string | 是 | 规则类型：`INFERENCE`（推理规则）、`VALIDATION`（校验规则）、`DERIVATION`（派生规则）、`CONSTRAINT`（约束规则） |
| scope | string | 否 | 作用域：`GLOBAL`（全局）、`CONCEPT`（概念级）、`ENTITY`（实体级），默认 GLOBAL |
| scopeConceptId | string | 否 | 作用概念 ID（scope=CONCEPT 时必填） |
| condition | string | 是 | 规则条件表达式（SWRL 或 DSL） |
| action | string | 是 | 规则动作表达式（SWRL conclusion 或 DSL action） |
| priority | integer | 否 | 优先级，数值越小优先级越高，默认 100 |
| enabled | boolean | 否 | 是否启用，默认 true |

**请求示例**

```json
{
  "name": "企业客户自动分类",
  "code": "RULE_CUSTOMER_CLASSIFY",
  "description": "注册资本大于1亿的企业客户自动标记为大客户",
  "ruleType": "INFERENCE",
  "scope": "CONCEPT",
  "scopeConceptId": "concept-customer-001",
  "condition": "Customer(?c) ^ hasAttribute(?c, REGISTERED_CAPITAL, ?cap) ^ greaterThan(?cap, 100000000)",
  "action": "addClassification(?c, VIP_CUSTOMER)",
  "priority": 50,
  "enabled": true
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rule-001",
    "name": "企业客户自动分类",
    "code": "RULE_CUSTOMER_CLASSIFY",
    "description": "注册资本大于1亿的企业客户自动标记为大客户",
    "ruleType": "INFERENCE",
    "scope": "CONCEPT",
    "scopeConceptId": "concept-customer-001",
    "condition": "Customer(?c) ^ hasAttribute(?c, REGISTERED_CAPITAL, ?cap) ^ greaterThan(?cap, 100000000)",
    "action": "addClassification(?c, VIP_CUSTOMER)",
    "priority": 50,
    "enabled": true,
    "lastExecutedAt": null,
    "executionCount": 0,
    "createdAt": "2026-07-16T11:00:00.000Z",
    "updatedAt": "2026-07-16T11:00:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | name/code/ruleType/condition/action 为空 |
| 40004 | scope=CONCEPT 但 scopeConceptId 为空 |
| 40401 | scopeConceptId 不存在 |
| 40905 | code 已存在 |

---

#### 3.5.2 规则列表

**GET** `/api/v1/ont/rules`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |
| keyword | string | 否 | 关键词搜索 |
| ruleType | string | 否 | 按规则类型过滤 |
| scope | string | 否 | 按作用域过滤 |
| scopeConceptId | string | 否 | 按作用概念过滤 |
| enabled | boolean | 否 | 按启用状态过滤 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "ruleId": "rule-001",
        "name": "企业客户自动分类",
        "code": "RULE_CUSTOMER_CLASSIFY",
        "ruleType": "INFERENCE",
        "scope": "CONCEPT",
        "priority": 50,
        "enabled": true,
        "lastExecutedAt": "2026-07-16T12:00:00.000Z",
        "executionCount": 15
      }
    ],
    "total": 30,
    "page": 1,
    "pageSize": 20,
    "totalPages": 2
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.3 获取规则详情

**GET** `/api/v1/ont/rules/{ruleId}`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rule-001",
    "name": "企业客户自动分类",
    "code": "RULE_CUSTOMER_CLASSIFY",
    "description": "注册资本大于1亿的企业客户自动标记为大客户",
    "ruleType": "INFERENCE",
    "scope": "CONCEPT",
    "scopeConceptId": "concept-customer-001",
    "condition": "Customer(?c) ^ hasAttribute(?c, REGISTERED_CAPITAL, ?cap) ^ greaterThan(?cap, 100000000)",
    "action": "addClassification(?c, VIP_CUSTOMER)",
    "priority": 50,
    "enabled": true,
    "lastExecutedAt": "2026-07-16T12:00:00.000Z",
    "executionCount": 15,
    "lastExecutionStatus": "SUCCESS",
    "createdAt": "2026-07-16T11:00:00.000Z",
    "updatedAt": "2026-07-16T11:00:00.000Z",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.4 更新规则

**PUT** `/api/v1/ont/rules/{ruleId}`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | 规则名称 |
| description | string | 否 | 规则描述 |
| condition | string | 否 | 规则条件表达式 |
| action | string | 否 | 规则动作表达式 |
| priority | integer | 否 | 优先级 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rule-001",
    "name": "企业客户自动分类（更新）",
    "updatedAt": "2026-07-16T12:30:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.5 删除规则

**DELETE** `/api/v1/ont/rules/{ruleId}`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rule-001",
    "deleted": true
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.6 启用规则

**POST** `/api/v1/ont/rules/{ruleId}/enable`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rule-001",
    "enabled": true,
    "updatedAt": "2026-07-16T13:00:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.7 禁用规则

**POST** `/api/v1/ont/rules/{ruleId}/disable`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rule-001",
    "enabled": false,
    "updatedAt": "2026-07-16T13:05:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.5.8 测试规则执行

**POST** `/api/v1/ont/rules/{ruleId}/test`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| context | object | 否 | 测试上下文，提供变量绑定 |
| entityId | string | 否 | 测试目标实体 ID（scope=ENTITY 时） |
| dryRun | boolean | 否 | 是否仅模拟执行不实际写入，默认 true |

**请求示例**

```json
{
  "entityId": "entity-alibaba-001",
  "dryRun": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rule-001",
    "matched": true,
    "executed": false,
    "results": [
      {
        "entityId": "entity-alibaba-001",
        "action": "addClassification",
        "params": ["entity-alibaba-001", "VIP_CUSTOMER"],
        "applied": false
      }
    ],
    "executionTime": 45
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40402 | entityId 不存在 |
| 42204 | 规则执行失败（表达式错误） |

---

### 3.6 推理引擎 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/ont/inference/execute` | 执行推理任务 |
| GET | `/api/v1/ont/inference/tasks/{taskId}` | 获取推理任务状态 |
| GET | `/api/v1/ont/inference/tasks/{taskId}/result` | 获取推理结果 |
| POST | `/api/v1/ont/inference/validate` | 校验本体一致性 |

---

#### 3.6.1 执行推理任务

**POST** `/api/v1/ont/inference/execute`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reasoner | string | 否 | 推理机：`HERMIT`（HermiT，默认，OWL DL）、`ELK`（ELK，EL 表达式） |
| scope | string | 否 | 推理范围：`FULL`（全量本体，默认）、`CONCEPT`（指定概念）、`ENTITY`（指定实体） |
| scopeConceptId | string | 否 | 作用概念 ID（scope=CONCEPT 时） |
| scopeEntityId | string | 否 | 作用实体 ID（scope=ENTITY 时） |
| ruleIds | array[string] | 否 | 指定执行的规则 ID 列表，为空则执行所有启用规则 |
| async | boolean | 否 | 是否异步执行，默认 true（大数据量时推荐） |
| applyResults | boolean | 否 | 是否将推理结果写入本体，默认 false（仅返回推理结论） |

**请求示例**

```json
{
  "reasoner": "HERMIT",
  "scope": "CONCEPT",
  "scopeConceptId": "concept-customer-001",
  "ruleIds": ["rule-001"],
  "async": true,
  "applyResults": false
}
```

**响应示例（异步，202 Accepted）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "infer-task-001",
    "status": "PENDING",
    "reasoner": "HERMIT",
    "scope": "CONCEPT",
    "scopeConceptId": "concept-customer-001",
    "submittedAt": "2026-07-16T14:00:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**响应示例（同步，200 OK）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "infer-task-002",
    "status": "COMPLETED",
    "reasoner": "HERMIT",
    "results": {
      "inferredTriples": [
        {
          "subject": "entity-alibaba-001",
          "predicate": "hasClassification",
          "object": "VIP_CUSTOMER",
          "sourceRuleId": "rule-001",
          "confidence": 1.0
        }
      ],
      "inferredCount": 1,
      "applied": false
    },
    "executionTime": 1200,
    "completedAt": "2026-07-16T14:00:01.200Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | scopeConceptId 不存在 |
| 40402 | scopeEntityId 不存在 |
| 40405 | ruleIds 中存在不存在的规则 |
| 42205 | 推理发现本体不一致 |
| 50004 | 推理引擎异常 |

---

#### 3.6.2 获取推理任务状态

**GET** `/api/v1/ont/inference/tasks/{taskId}`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "infer-task-001",
    "status": "RUNNING",
    "progress": 65,
    "reasoner": "HERMIT",
    "scope": "CONCEPT",
    "scopeConceptId": "concept-customer-001",
    "submittedAt": "2026-07-16T14:00:00.000Z",
    "startedAt": "2026-07-16T14:00:00.500Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

> 任务状态：`PENDING`、`RUNNING`、`COMPLETED`、`FAILED`、`CANCELLED`

---

#### 3.6.3 获取推理结果

**GET** `/api/v1/ont/inference/tasks/{taskId}/result`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "infer-task-001",
    "status": "COMPLETED",
    "results": {
      "inferredTriples": [
        {
          "subject": "entity-alibaba-001",
          "predicate": "hasClassification",
          "object": "VIP_CUSTOMER",
          "sourceRuleId": "rule-001",
          "confidence": 1.0
        },
        {
          "subject": "entity-tencent-001",
          "predicate": "hasClassification",
          "object": "VIP_CUSTOMER",
          "sourceRuleId": "rule-001",
          "confidence": 1.0
        }
      ],
      "inferredCount": 2,
      "applied": false,
      "inconsistencies": []
    },
    "executionTime": 3500,
    "startedAt": "2026-07-16T14:00:00.500Z",
    "completedAt": "2026-07-16T14:00:04.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40407 | taskId 不存在 |
| 42205 | 推理任务完成但发现不一致 |

---

#### 3.6.4 校验本体一致性

**POST** `/api/v1/ont/inference/validate`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reasoner | string | 否 | 推理机：`HERMIT`（默认）、`ELK` |
| versionId | string | 否 | 指定版本校验，默认当前工作版本 |
| checkTypes | array[string] | 否 | 检查类型：`CONSISTENCY`（一致性）、`SATISFIABILITY`（可满足性）、`SUBSUMPTION`（包含关系），默认全部 |

**请求示例**

```json
{
  "reasoner": "HERMIT",
  "checkTypes": ["CONSISTENCY", "SUBSUMPTION"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "consistent": true,
    "checks": [
      {
        "type": "CONSISTENCY",
        "passed": true,
        "details": "本体一致，无矛盾"
      },
      {
        "type": "SUBSUMPTION",
        "passed": true,
        "subsumptionRelations": [
          {
            "subConcept": "concept-individual-001",
            "superConcept": "concept-customer-001",
            "explicit": false
          }
        ]
      }
    ],
    "executionTime": 800,
    "validatedAt": "2026-07-16T14:30:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**不一致响应示例**

```json
{
  "code": 42205,
  "message": "本体推理发现不一致",
  "data": {
    "consistent": false,
    "checks": [
      {
        "type": "CONSISTENCY",
        "passed": false,
        "explanations": [
          {
            "description": "概念 客户 既是 PERSON 的子概念又是 ORGANIZATION 的子概念，存在多重继承冲突",
            "entities": ["concept-customer-001"],
            "rules": ["rule-001"]
          }
        ]
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

### 3.7 版本管理 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/ont/versions` | 创建版本快照 |
| GET | `/api/v1/ont/versions` | 版本列表（分页） |
| GET | `/api/v1/ont/versions/{versionId}` | 获取版本详情 |
| GET | `/api/v1/ont/versions/{versionId}/diff` | 版本差异对比 |
| POST | `/api/v1/ont/versions/{versionId}/rollback` | 回滚至指定版本 |
| POST | `/api/v1/ont/versions/{versionId}/publish` | 发布版本 |
| GET | `/api/v1/ont/versions/current` | 获取当前版本信息 |

---

#### 3.7.1 创建版本快照

**POST** `/api/v1/ont/versions`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| version | string | 是 | 版本号，遵循语义化版本 `MAJOR.MINOR.PATCH` |
| label | string | 否 | 版本标签（如 `release`、`beta`） |
| description | string | 否 | 版本描述 |
| baselineVersionId | string | 否 | 基线版本 ID，用于增量对比 |

**请求示例**

```json
{
  "version": "1.2.0",
  "label": "release",
  "description": "新增供应商概念与供货关系，优化客户分类规则",
  "baselineVersionId": "ver-1.1.0"
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "versionId": "ver-1.2.0",
    "version": "1.2.0",
    "label": "release",
    "description": "新增供应商概念与供货关系，优化客户分类规则",
    "baselineVersionId": "ver-1.1.0",
    "status": "DRAFT",
    "snapshotStats": {
      "conceptCount": 25,
      "entityCount": 1523,
      "relationTypeCount": 15,
      "relationInstanceCount": 320,
      "attributeCount": 45,
      "ruleCount": 30
    },
    "createdBy": "user-001",
    "createdAt": "2026-07-16T15:00:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | version 为空或格式不合法 |
| 40906 | version 已存在 |

---

#### 3.7.2 版本列表

**GET** `/api/v1/ont/versions`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |
| status | string | 否 | 按状态过滤：`DRAFT`、`PUBLISHED`、`ARCHIVED` |
| label | string | 否 | 按标签过滤 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "versionId": "ver-1.2.0",
        "version": "1.2.0",
        "label": "release",
        "status": "PUBLISHED",
        "description": "新增供应商概念与供货关系",
        "createdBy": "user-001",
        "createdAt": "2026-07-16T15:00:00.000Z",
        "publishedAt": "2026-07-16T16:00:00.000Z"
      },
      {
        "versionId": "ver-1.1.0",
        "version": "1.1.0",
        "label": "release",
        "status": "ARCHIVED",
        "createdAt": "2026-07-01T10:00:00.000Z"
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.7.3 获取版本详情

**GET** `/api/v1/ont/versions/{versionId}`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "versionId": "ver-1.2.0",
    "version": "1.2.0",
    "label": "release",
    "description": "新增供应商概念与供货关系",
    "baselineVersionId": "ver-1.1.0",
    "status": "PUBLISHED",
    "snapshotStats": {
      "conceptCount": 25,
      "entityCount": 1523,
      "relationTypeCount": 15,
      "relationInstanceCount": 320,
      "attributeCount": 45,
      "ruleCount": 30
    },
    "createdBy": "user-001",
    "createdAt": "2026-07-16T15:00:00.000Z",
    "publishedAt": "2026-07-16T16:00:00.000Z",
    "publishedBy": "user-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.7.4 版本差异对比

**GET** `/api/v1/ont/versions/{versionId}/diff`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| compareVersionId | string | 是 | 对比目标版本 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "fromVersionId": "ver-1.1.0",
    "toVersionId": "ver-1.2.0",
    "summary": {
      "conceptsAdded": 2,
      "conceptsModified": 3,
      "conceptsRemoved": 0,
      "entitiesAdded": 120,
      "entitiesModified": 50,
      "entitiesRemoved": 5,
      "relationTypesAdded": 1,
      "relationInstancesAdded": 45,
      "attributesAdded": 5,
      "rulesAdded": 2,
      "rulesModified": 1
    },
    "details": {
      "concepts": {
        "added": [
          {
            "conceptId": "concept-supplier-001",
            "name": "供应商",
            "code": "SUPPLIER"
          }
        ],
        "modified": [
          {
            "conceptId": "concept-customer-001",
            "name": "客户",
            "changes": [
              { "field": "description", "oldValue": "客户概念", "newValue": "企业客户实体概念" }
            ]
          }
        ],
        "removed": []
      },
      "rules": {
        "added": [
          { "ruleId": "rule-001", "name": "企业客户自动分类" }
        ]
      }
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.7.5 回滚至指定版本

**POST** `/api/v1/ont/versions/{versionId}/rollback`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| createSnapshot | boolean | 否 | 回滚前是否创建当前版本快照，默认 true |
| snapshotDescription | string | 否 | 快照描述 |

**请求示例**

```json
{
  "createSnapshot": true,
  "snapshotDescription": "回滚至 1.2.0 前的快照"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "rolledBackTo": "ver-1.2.0",
    "snapshotCreated": "ver-1.3.0-snapshot",
    "snapshotDescription": "回滚至 1.2.0 前的快照",
    "rolledBackAt": "2026-07-16T17:00:00.000Z",
    "rolledBackBy": "user-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40406 | versionId 不存在 |
| 42206 | 版本未发布，无法回滚 |

---

#### 3.7.6 发布版本

**POST** `/api/v1/ont/versions/{versionId}/publish`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| validateConsistency | boolean | 否 | 发布前是否校验本体一致性，默认 true |
| reasoner | string | 否 | 一致性校验推理机，默认 HERMIT |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "versionId": "ver-1.2.0",
    "version": "1.2.0",
    "status": "PUBLISHED",
    "consistencyCheck": {
      "performed": true,
      "passed": true
    },
    "publishedAt": "2026-07-16T16:00:00.000Z",
    "publishedBy": "user-001"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40406 | versionId 不存在 |
| 42205 | 一致性校验未通过 |

---

#### 3.7.7 获取当前版本信息

**GET** `/api/v1/ont/versions/current`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "versionId": "ver-1.2.0",
    "version": "1.2.0",
    "label": "release",
    "status": "PUBLISHED",
    "publishedAt": "2026-07-16T16:00:00.000Z",
    "publishedBy": "user-001",
    "workingVersionId": "ver-1.3.0-draft",
    "workingVersionStatus": "DRAFT"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

### 3.8 知识图谱查询 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/ont/graph/cypher` | 执行 Cypher 查询 |
| POST | `/api/v1/ont/graph/traverse` | 图遍历 |
| POST | `/api/v1/ont/graph/path` | 路径查找 |
| GET | `/api/v1/ont/graph/entities/{entityId}/neighbors` | 获取邻居节点 |
| GET | `/api/v1/ont/graph/entities/{entityId}/shortest-path` | 最短路径查找 |
| GET | `/api/v1/ont/graph/stats` | 获取图谱统计信息 |

---

#### 3.8.1 执行 Cypher 查询

**POST** `/api/v1/ont/graph/cypher`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| query | string | 是 | Cypher 查询语句（只读查询，禁止写操作） |
| parameters | object | 否 | 查询参数绑定 |
| limit | integer | 否 | 结果上限，默认 100，最大 1000 |
| format | string | 否 | 返回格式：`JSON`（默认）、`GRAPH`（图结构）、`TABLE`（表格） |

**请求示例**

```json
{
  "query": "MATCH (e:Entity)-[r:SUPPLIES_TO]->(t:Entity) WHERE e.entityId = $entityId RETURN e, r, t LIMIT $limit",
  "parameters": {
    "entityId": "entity-supplier-001",
    "limit": 10
  },
  "format": "GRAPH"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "nodes": [
      {
        "id": "entity-supplier-001",
        "label": "供应商A",
        "type": "Entity",
        "properties": {
          "entityId": "entity-supplier-001",
          "conceptCode": "SUPPLIER"
        }
      },
      {
        "id": "entity-alibaba-001",
        "label": "阿里巴巴集团",
        "type": "Entity",
        "properties": {
          "entityId": "entity-alibaba-001",
          "conceptCode": "CUSTOMER"
        }
      }
    ],
    "edges": [
      {
        "id": "rel-inst-001",
        "source": "entity-supplier-001",
        "target": "entity-alibaba-001",
        "type": "SUPPLIES_TO",
        "properties": {
          "SUPPLY_AMOUNT": "5000000"
        }
      }
    ],
    "count": 1,
    "executionTime": 15
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | query 为空 |
| 40004 | Cypher 语法错误 |
| 40301 | 查询包含写操作（禁止） |
| 50003 | Neo4j 执行失败 |

---

#### 3.8.2 图遍历

**POST** `/api/v1/ont/graph/traverse`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startEntityId | string | 是 | 起始实体 ID |
| direction | string | 否 | 遍历方向：`OUT`（出向）、`IN`（入向）、`BOTH`（双向，默认） |
| relationTypeCodes | array[string] | 否 | 限定关系类型编码 |
| maxDepth | integer | 否 | 最大深度，默认 3 |
| limit | integer | 否 | 结果节点上限，默认 100 |
| conceptCodes | array[string] | 否 | 限定目标节点概念编码 |

**请求示例**

```json
{
  "startEntityId": "entity-alibaba-001",
  "direction": "BOTH",
  "relationTypeCodes": ["SUPPLIES_TO", "PARTNER_OF"],
  "maxDepth": 2,
  "limit": 50
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "startEntityId": "entity-alibaba-001",
    "nodes": [
      {
        "entityId": "entity-alibaba-001",
        "name": "阿里巴巴集团",
        "depth": 0
      },
      {
        "entityId": "entity-supplier-001",
        "name": "供应商A",
        "depth": 1
      },
      {
        "entityId": "entity-supplier-002",
        "name": "供应商B",
        "depth": 1
      },
      {
        "entityId": "entity-tencent-001",
        "name": "腾讯科技",
        "depth": 2
      }
    ],
    "edges": [
      {
        "source": "entity-supplier-001",
        "target": "entity-alibaba-001",
        "type": "SUPPLIES_TO"
      },
      {
        "source": "entity-supplier-002",
        "target": "entity-alibaba-001",
        "type": "SUPPLIES_TO"
      },
      {
        "source": "entity-supplier-001",
        "target": "entity-tencent-001",
        "type": "SUPPLIES_TO"
      }
    ],
    "totalNodes": 4,
    "totalEdges": 3,
    "executionTime": 20
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.8.3 路径查找

**POST** `/api/v1/ont/graph/path`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startEntityId | string | 是 | 起始实体 ID |
| endEntityId | string | 是 | 终止实体 ID |
| direction | string | 否 | 方向：`OUT`、`IN`、`BOTH`（默认） |
| relationTypeCodes | array[string] | 否 | 限定关系类型 |
| maxDepth | integer | 否 | 最大深度，默认 5 |
| algorithm | string | 否 | 算法：`SHORTEST`（最短路径，默认）、`ALL_SIMPLE`（所有简单路径）、`ALL_SHORTEST`（所有最短路径） |
| limit | integer | 否 | 路径数量上限，默认 10 |

**请求示例**

```json
{
  "startEntityId": "entity-alibaba-001",
  "endEntityId": "entity-tencent-001",
  "algorithm": "SHORTEST",
  "maxDepth": 5
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "startEntityId": "entity-alibaba-001",
    "endEntityId": "entity-tencent-001",
    "paths": [
      {
        "pathId": 0,
        "length": 2,
        "nodes": [
          "entity-alibaba-001",
          "entity-supplier-001",
          "entity-tencent-001"
        ],
        "edges": [
          {
            "source": "entity-supplier-001",
            "target": "entity-alibaba-001",
            "type": "SUPPLIES_TO"
          },
          {
            "source": "entity-supplier-001",
            "target": "entity-tencent-001",
            "type": "SUPPLIES_TO"
          }
        ]
      }
    ],
    "pathCount": 1,
    "executionTime": 12
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40402 | startEntityId 或 endEntityId 不存在 |

---

#### 3.8.4 获取邻居节点

**GET** `/api/v1/ont/graph/entities/{entityId}/neighbors`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| entityId | string | 是 | 实体 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| direction | string | 否 | 方向：`OUT`、`IN`、`BOTH`（默认） |
| relationTypeCode | string | 否 | 限定关系类型 |
| limit | integer | 否 | 结果上限，默认 50 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "entityId": "entity-alibaba-001",
    "neighbors": [
      {
        "entityId": "entity-supplier-001",
        "name": "供应商A",
        "conceptCode": "SUPPLIER",
        "relationType": "SUPPLIES_TO",
        "direction": "IN",
        "relationInstanceId": "rel-inst-001"
      },
      {
        "entityId": "entity-supplier-002",
        "name": "供应商B",
        "conceptCode": "SUPPLIER",
        "relationType": "SUPPLIES_TO",
        "direction": "IN",
        "relationInstanceId": "rel-inst-002"
      }
    ],
    "total": 2
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.8.5 最短路径查找

**GET** `/api/v1/ont/graph/entities/{entityId}/shortest-path`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| targetEntityId | string | 是 | 目标实体 ID |
| maxDepth | integer | 否 | 最大深度，默认 5 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "startEntityId": "entity-alibaba-001",
    "endEntityId": "entity-tencent-001",
    "shortestPathLength": 2,
    "path": [
      "entity-alibaba-001",
      "entity-supplier-001",
      "entity-tencent-001"
    ],
    "executionTime": 8
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

#### 3.8.6 获取图谱统计信息

**GET** `/api/v1/ont/graph/stats`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "totalNodes": 1523,
    "totalEdges": 320,
    "conceptDistribution": [
      { "conceptCode": "CUSTOMER", "count": 800 },
      { "conceptCode": "SUPPLIER", "count": 120 },
      { "conceptCode": "PRODUCT", "count": 603 }
    ],
    "relationTypeDistribution": [
      { "relationTypeCode": "SUPPLIES_TO", "count": 200 },
      { "relationTypeCode": "PARTNER_OF", "count": 120 }
    ],
    "avgDegree": 0.42,
    "maxDegree": 15,
    "lastSyncAt": "2026-07-16T15:30:00.000Z"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

## 4. 数据模型

### 4.1 PostgreSQL 表结构

TECH-ONT 使用 PostgreSQL 17 作为元数据库，所有表使用 `ont_` 前缀。所有表包含租户隔离字段 `tenant_id` 与审计字段。

#### 4.1.1 ont_concept（概念表）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| concept_id | VARCHAR(64) | PK | 概念 ID（UUID） |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| name | VARCHAR(128) | NOT NULL | 概念名称 |
| code | VARCHAR(128) | NOT NULL | 概念编码 |
| description | TEXT | | 概念描述 |
| parent_concept_id | VARCHAR(64) | FK | 父概念 ID |
| icon | VARCHAR(64) | | 图标标识 |
| metadata | JSONB | | 扩展元数据 |
| depth | INTEGER | NOT NULL DEFAULT 0 | 层级深度 |
| path | VARCHAR(1024) | | 层级路径 |
| status | VARCHAR(32) | NOT NULL DEFAULT 'ACTIVE' | 状态 |
| version_id | VARCHAR(64) | FK | 所属版本 ID |
| created_by | VARCHAR(64) | | 创建人 |
| updated_by | VARCHAR(64) | | 更新人 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 更新时间 |

**索引**：
- UNIQUE(`tenant_id`, `code`)
- UNIQUE(`tenant_id`, `name`, `parent_concept_id`)
- INDEX(`parent_concept_id`)
- INDEX(`tenant_id`, `version_id`)

---

#### 4.1.2 ont_entity（实体表）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| entity_id | VARCHAR(64) | PK | 实体 ID |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| concept_id | VARCHAR(64) | FK NOT NULL | 所属概念 ID |
| name | VARCHAR(256) | NOT NULL | 实体名称 |
| code | VARCHAR(128) | | 实体编码 |
| description | TEXT | | 实体描述 |
| metadata | JSONB | | 扩展元数据 |
| status | VARCHAR(32) | NOT NULL DEFAULT 'ACTIVE' | 状态 |
| version_id | VARCHAR(64) | FK | 所属版本 ID |
| created_by | VARCHAR(64) | | 创建人 |
| updated_by | VARCHAR(64) | | 更新人 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 更新时间 |

**索引**：
- UNIQUE(`tenant_id`, `concept_id`, `code`)（code 非空时）
- INDEX(`concept_id`)
- INDEX(`tenant_id`, `version_id`)

---

#### 4.1.3 ont_attribute（属性定义表）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| attribute_id | VARCHAR(64) | PK | 属性 ID |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| name | VARCHAR(128) | NOT NULL | 属性名称 |
| code | VARCHAR(128) | NOT NULL | 属性编码 |
| description | TEXT | | 属性描述 |
| data_type | VARCHAR(32) | NOT NULL | 数据类型 |
| required | BOOLEAN | NOT NULL DEFAULT FALSE | 是否必填 |
| unique | BOOLEAN | NOT NULL DEFAULT FALSE | 是否唯一 |
| default_value | JSONB | | 默认值 |
| enum_values | JSONB | | 枚举值列表 |
| constraints | JSONB | | 约束条件 |
| unit | VARCHAR(32) | | 单位 |
| version_id | VARCHAR(64) | FK | 所属版本 ID |
| created_by | VARCHAR(64) | | 创建人 |
| updated_by | VARCHAR(64) | | 更新人 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 更新时间 |

**索引**：
- UNIQUE(`tenant_id`, `code`)

---

#### 4.1.4 ont_concept_attribute（概念-属性关联表）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | BIGSERIAL | PK | 自增主键 |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| concept_id | VARCHAR(64) | FK NOT NULL | 概念 ID |
| attribute_id | VARCHAR(64) | FK NOT NULL | 属性 ID |
| inherited | BOOLEAN | NOT NULL DEFAULT FALSE | 是否继承 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 创建时间 |

**索引**：
- UNIQUE(`concept_id`, `attribute_id`)
- INDEX(`attribute_id`)

---

#### 4.1.5 ont_entity_attribute（实体属性值表）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | BIGSERIAL | PK | 自增主键 |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| entity_id | VARCHAR(64) | FK NOT NULL | 实体 ID |
| attribute_id | VARCHAR(64) | FK NOT NULL | 属性 ID |
| value | JSONB | | 属性值（JSON 编码以支持多类型） |
| valid | BOOLEAN | NOT NULL DEFAULT TRUE | 是否通过校验 |
| version_id | VARCHAR(64) | FK | 所属版本 ID |
| updated_by | VARCHAR(64) | | 更新人 |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 更新时间 |

**索引**：
- UNIQUE(`entity_id`, `attribute_id`)
- INDEX(`attribute_id`)
- GIN(`value`)（支持 JSONB 查询）

---

#### 4.1.6 ont_relation_type（关系类型表）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| relation_type_id | VARCHAR(64) | PK | 关系类型 ID |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| name | VARCHAR(128) | NOT NULL | 关系类型名称 |
| code | VARCHAR(128) | NOT NULL | 关系类型编码 |
| description | TEXT | | 关系类型描述 |
| source_concept_id | VARCHAR(64) | FK NOT NULL | 源概念 ID |
| target_concept_id | VARCHAR(64) | FK NOT NULL | 目标概念 ID |
| direction | VARCHAR(32) | NOT NULL DEFAULT 'DIRECTED' | 方向 |
| cardinality | VARCHAR(32) | NOT NULL DEFAULT 'MANY_TO_MANY' | 基数 |
| min_cardinality | INTEGER | NOT NULL DEFAULT 0 | 最小基数 |
| max_cardinality | INTEGER | NOT NULL DEFAULT 0 | 最大基数（0=无限） |
| symmetric | BOOLEAN | NOT NULL DEFAULT FALSE | 是否对称 |
| transitive | BOOLEAN | NOT NULL DEFAULT FALSE | 是否传递 |
| version_id | VARCHAR(64) | FK | 所属版本 ID |
| created_by | VARCHAR(64) | | 创建人 |
| updated_by | VARCHAR(64) | | 更新人 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 更新时间 |

**索引**：
- UNIQUE(`tenant_id`, `code`)
- INDEX(`source_concept_id`)
- INDEX(`target_concept_id`)

---

#### 4.1.7 ont_relation_instance（关系实例表）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| relation_instance_id | VARCHAR(64) | PK | 关系实例 ID |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| relation_type_id | VARCHAR(64) | FK NOT NULL | 关系类型 ID |
| source_entity_id | VARCHAR(64) | FK NOT NULL | 源实体 ID |
| target_entity_id | VARCHAR(64) | FK NOT NULL | 目标实体 ID |
| metadata | JSONB | | 扩展元数据 |
| status | VARCHAR(32) | NOT NULL DEFAULT 'ACTIVE' | 状态 |
| version_id | VARCHAR(64) | FK | 所属版本 ID |
| created_by | VARCHAR(64) | | 创建人 |
| updated_by | VARCHAR(64) | | 更新人 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 更新时间 |

**索引**：
- INDEX(`relation_type_id`)
- INDEX(`source_entity_id`)
- INDEX(`target_entity_id`)

---

#### 4.1.8 ont_relation_attribute（关系属性值表）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | BIGSERIAL | PK | 自增主键 |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| relation_instance_id | VARCHAR(64) | FK NOT NULL | 关系实例 ID |
| attribute_id | VARCHAR(64) | FK NOT NULL | 属性 ID |
| value | JSONB | | 属性值 |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 更新时间 |

**索引**：
- UNIQUE(`relation_instance_id`, `attribute_id`)

---

#### 4.1.9 ont_rule（规则表）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| rule_id | VARCHAR(64) | PK | 规则 ID |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| name | VARCHAR(128) | NOT NULL | 规则名称 |
| code | VARCHAR(128) | NOT NULL | 规则编码 |
| description | TEXT | | 规则描述 |
| rule_type | VARCHAR(32) | NOT NULL | 规则类型 |
| scope | VARCHAR(32) | NOT NULL DEFAULT 'GLOBAL' | 作用域 |
| scope_concept_id | VARCHAR(64) | FK | 作用概念 ID |
| condition | TEXT | NOT NULL | 条件表达式 |
| action | TEXT | NOT NULL | 动作表达式 |
| priority | INTEGER | NOT NULL DEFAULT 100 | 优先级 |
| enabled | BOOLEAN | NOT NULL DEFAULT TRUE | 是否启用 |
| last_executed_at | TIMESTAMPTZ | | 最后执行时间 |
| execution_count | BIGINT | NOT NULL DEFAULT 0 | 执行次数 |
| last_execution_status | VARCHAR(32) | | 最后执行状态 |
| version_id | VARCHAR(64) | FK | 所属版本 ID |
| created_by | VARCHAR(64) | | 创建人 |
| updated_by | VARCHAR(64) | | 更新人 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 更新时间 |

**索引**：
- UNIQUE(`tenant_id`, `code`)
- INDEX(`scope`, `scope_concept_id`)
- INDEX(`enabled`, `priority`)

---

#### 4.1.10 ont_version（版本表）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| version_id | VARCHAR(64) | PK | 版本 ID |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| version | VARCHAR(32) | NOT NULL | 版本号 |
| label | VARCHAR(64) | | 版本标签 |
| description | TEXT | | 版本描述 |
| baseline_version_id | VARCHAR(64) | FK | 基线版本 ID |
| status | VARCHAR(32) | NOT NULL DEFAULT 'DRAFT' | 状态 |
| snapshot | JSONB | | 本体快照（完整序列化） |
| snapshot_stats | JSONB | | 快照统计 |
| is_current | BOOLEAN | NOT NULL DEFAULT FALSE | 是否为当前工作版本 |
| created_by | VARCHAR(64) | | 创建人 |
| published_by | VARCHAR(64) | | 发布人 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 创建时间 |
| published_at | TIMESTAMPTZ | | 发布时间 |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 更新时间 |

**索引**：
- UNIQUE(`tenant_id`, `version`)
- INDEX(`tenant_id`, `status`)
- INDEX(`tenant_id`, `is_current`)

---

#### 4.1.11 ont_outbox（Outbox 事件表）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | BIGSERIAL | PK | 自增主键 |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| aggregate_type | VARCHAR(64) | NOT NULL | 聚合类型（CONCEPT/ENTITY/RELATION 等） |
| aggregate_id | VARCHAR(64) | NOT NULL | 聚合 ID |
| event_type | VARCHAR(128) | NOT NULL | 事件类型 |
| payload | JSONB | NOT NULL | 事件消息体 |
| trace_id | VARCHAR(64) | NOT NULL | 链路追踪 ID |
| status | VARCHAR(32) | NOT NULL DEFAULT 'PENDING' | 发送状态 |
| retry_count | INTEGER | NOT NULL DEFAULT 0 | 重试次数 |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 创建时间 |
| sent_at | TIMESTAMPTZ | | 发送时间 |

**索引**：
- INDEX(`status`, `created_at`)
- INDEX(`aggregate_type`, `aggregate_id`)

---

#### 4.1.12 ont_inference_task（推理任务表）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| task_id | VARCHAR(64) | PK | 任务 ID |
| tenant_id | VARCHAR(64) | NOT NULL | 租户 ID |
| reasoner | VARCHAR(32) | NOT NULL | 推理机 |
| scope | VARCHAR(32) | NOT NULL | 推理范围 |
| scope_concept_id | VARCHAR(64) | | 作用概念 ID |
| scope_entity_id | VARCHAR(64) | | 作用实体 ID |
| rule_ids | JSONB | | 规则 ID 列表 |
| status | VARCHAR(32) | NOT NULL DEFAULT 'PENDING' | 任务状态 |
| progress | INTEGER | NOT NULL DEFAULT 0 | 进度 |
| result | JSONB | | 推理结果 |
| error_message | TEXT | | 错误信息 |
| apply_results | BOOLEAN | NOT NULL DEFAULT FALSE | 是否写入结果 |
| trace_id | VARCHAR(64) | NOT NULL | 链路追踪 ID |
| submitted_at | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | 提交时间 |
| started_at | TIMESTAMPTZ | | 开始时间 |
| completed_at | TIMESTAMPTZ | | 完成时间 |

**索引**：
- INDEX(`tenant_id`, `status`)

---

### 4.2 Neo4j 图模型

#### 4.2.1 节点标签（Node Labels）

| 标签 | 说明 | 核心属性 |
|---|---|---|
| `Concept` | 概念节点 | `conceptId`, `code`, `name`, `depth`, `tenantId` |
| `Entity` | 实体节点 | `entityId`, `conceptId`, `conceptCode`, `name`, `code`, `tenantId` |

**节点属性详解**：

**Concept 节点**：
```cypher
(:Concept {
  conceptId: "concept-customer-001",
  code: "CUSTOMER",
  name: "客户",
  description: "企业客户实体概念",
  depth: 2,
  tenantId: "tenant-001",
  versionId: "ver-1.2.0"
})
```

**Entity 节点**：
```cypher
(:Entity {
  entityId: "entity-alibaba-001",
  conceptId: "concept-customer-001",
  conceptCode: "CUSTOMER",
  name: "阿里巴巴集团",
  code: "ENT-ALIBABA-001",
  tenantId: "tenant-001",
  versionId: "ver-1.2.0",
  // 实体属性值以平铺方式存储
  CUSTOMER_NAME: "阿里巴巴集团",
  CUSTOMER_TYPE: "ENTERPRISE",
  INDUSTRY: "互联网科技"
})
```

#### 4.2.2 关系类型（Relationship Types）

| 关系类型 | 方向 | 说明 | 属性 |
|---|---|---|---|
| `SUB_CLASS_OF` | Concept -> Concept | 概念继承关系（子概念指向父概念） | `inherited: boolean` |
| `HAS_ATTRIBUTE` | Concept -> AttributeNode | 概念关联属性 | `inherited: boolean` |
| `INSTANCE_OF` | Entity -> Concept | 实体归属概念 | - |
| `<RelationTypeCode>` | Entity -> Entity | 实体间关系实例（如 `SUPPLIES_TO`） | `relationInstanceId`, `relationTypeId`, 关系属性 |

**关系属性详解**：

**概念继承关系**：
```cypher
(:Concept {code: "INDIVIDUAL_CUSTOMER"})-[:SUB_CLASS_OF {inherited: false}]->(:Concept {code: "CUSTOMER"})
```

**实体归属关系**：
```cypher
(:Entity {entityId: "entity-alibaba-001"})-[:INSTANCE_OF]->(:Concept {code: "CUSTOMER"})
```

**实体间关系实例**：
```cypher
(:Entity {entityId: "entity-supplier-001"})
  -[:SUPPLIES_TO {
    relationInstanceId: "rel-inst-001",
    relationTypeId: "rel-type-supplies-001",
    SUPPLY_AMOUNT: "5000000",
    SUPPLY_DATE: "2026-07-16"
  }]->
(:Entity {entityId: "entity-alibaba-001"})
```

#### 4.2.3 约束与索引

```cypher
// 概念节点唯一约束
CREATE CONSTRAINT concept_id_unique IF NOT EXISTS
FOR (c:Concept) REQUIRE c.conceptId IS UNIQUE;

// 实体节点唯一约束
CREATE CONSTRAINT entity_id_unique IF NOT EXISTS
FOR (e:Entity) REQUIRE e.entityId IS UNIQUE;

// 概念编码索引
CREATE INDEX concept_code_index IF NOT EXISTS
FOR (c:Concept) ON (c.code);

// 实体概念编码索引
CREATE INDEX entity_concept_code_index IF NOT EXISTS
FOR (e:Entity) ON (e.conceptCode);

// 租户索引
CREATE INDEX concept_tenant_index IF NOT EXISTS
FOR (c:Concept) ON (c.tenantId);
CREATE INDEX entity_tenant_index IF NOT EXISTS
FOR (e:Entity) ON (e.tenantId);
```

#### 4.2.4 同步策略（P3 双向同步）

- **PostgreSQL -> Neo4j（主向）**：通过 Outbox 模式 + Kafka 事件驱动，TECH-ONT 消费自身发布的事件后将变更同步至 Neo4j
- **Neo4j -> PostgreSQL（反向）**：图查询优化场景下 Neo4j 中的临时计算结果不回写 PostgreSQL；仅本体结构变更通过显式 API 写回 PostgreSQL
- **一致性保证**：以 PostgreSQL 为真相源，Neo4j 为派生视图；通过 CDC 补偿机制修复漂移

---

## 5. 事件定义（Kafka 消息，Outbox 模式）

### 5.1 Outbox 模式说明

TECH-ONT 的所有领域事件通过 **Outbox 模式** 发布：

1. 业务事务与 Outbox 记录写入在**同一个 PostgreSQL 事务**中，保证原子性
2. 独立的 Outbox Publisher 轮询 `ont_outbox` 表，将 `PENDING` 状态的记录发布至 Kafka
3. 发布成功后更新 `ont_outbox.status` 为 `SENT`
4. 发布失败重试 3 次，超过后标记为 `FAILED` 并告警

### 5.2 Kafka Topic 命名规范

```
metaplatform.ont.{aggregate}.{event}
```

| Topic | 说明 |
|---|---|
| `metaplatform.ont.concept.created` | 概念创建事件 |
| `metaplatform.ont.concept.updated` | 概念更新事件 |
| `metaplatform.ont.concept.deleted` | 概念删除事件 |
| `metaplatform.ont.concept.moved` | 概念移动事件 |
| `metaplatform.ont.entity.created` | 实体创建事件 |
| `metaplatform.ont.entity.updated` | 实体更新事件 |
| `metaplatform.ont.entity.deleted` | 实体删除事件 |
| `metaplatform.ont.entity.attribute-changed` | 实体属性变更事件 |
| `metaplatform.ont.relation-type.created` | 关系类型创建事件 |
| `metaplatform.ont.relation-type.updated` | 关系类型更新事件 |
| `metaplatform.ont.relation-type.deleted` | 关系类型删除事件 |
| `metaplatform.ont.relation-instance.created` | 关系实例创建事件 |
| `metaplatform.ont.relation-instance.deleted` | 关系实例删除事件 |
| `metaplatform.ont.attribute.created` | 属性定义创建事件 |
| `metaplatform.ont.attribute.updated` | 属性定义更新事件 |
| `metaplatform.ont.attribute.deleted` | 属性定义删除事件 |
| `metaplatform.ont.rule.created` | 规则创建事件 |
| `metaplatform.ont.rule.updated` | 规则更新事件 |
| `metaplatform.ont.rule.deleted` | 规则删除事件 |
| `metaplatform.ont.rule.enabled` | 规则启用事件 |
| `metaplatform.ont.rule.disabled` | 规则禁用事件 |
| `metaplatform.ont.version.published` | 版本发布事件 |
| `metaplatform.ont.version.rolled-back` | 版本回滚事件 |

### 5.3 消息通用结构

所有 Kafka 消息包含统一的 Header 与 Body 结构。

#### 5.3.1 消息 Header

| Header Key | 类型 | 必填 | 说明 |
|---|---|---|---|
| `X-Trace-Id` | string | 是 | 链路追踪 ID，全链路唯一 |
| `X-Tenant-Id` | string | 是 | 租户 ID |
| `X-Event-Type` | string | 是 | 事件类型 |
| `X-Event-Id` | string | 是 | 事件唯一 ID（UUID） |
| `X-Aggregate-Type` | string | 是 | 聚合类型 |
| `X-Aggregate-Id` | string | 是 | 聚合 ID |
| `X-Timestamp` | string | 是 | 事件时间（ISO 8601） |
| `X-Version` | string | 是 | 事件 Schema 版本 |
| `Content-Type` | string | 是 | 固定 `application/json` |

#### 5.3.2 消息 Body 通用结构

```json
{
  "eventId": "evt-uuid-001",
  "eventType": "concept.created",
  "aggregateType": "CONCEPT",
  "aggregateId": "concept-customer-001",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-07-16T10:30:00.000Z",
  "version": "1.0",
  "data": { },
  "metadata": {
    "operator": "user-001",
    "source": "APP-ONTSTUDIO",
    "versionId": "ver-1.3.0-draft"
  }
}
```

### 5.4 事件详情

#### 5.4.1 概念创建事件

**Topic**: `metaplatform.ont.concept.created`

**消息体**：

```json
{
  "eventId": "evt-uuid-001",
  "eventType": "concept.created",
  "aggregateType": "CONCEPT",
  "aggregateId": "concept-customer-001",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-07-16T10:30:00.000Z",
  "version": "1.0",
  "data": {
    "conceptId": "concept-customer-001",
    "name": "客户",
    "code": "CUSTOMER",
    "description": "企业客户实体概念",
    "parentConceptId": "concept-org-001",
    "depth": 2,
    "path": "/concept-root/concept-org-001/concept-customer-001",
    "attributeIds": ["attr-001", "attr-002"]
  },
  "metadata": {
    "operator": "user-001",
    "source": "APP-ONTSTUDIO",
    "versionId": "ver-1.3.0-draft"
  }
}
```

#### 5.4.2 概念更新事件

**Topic**: `metaplatform.ont.concept.updated`

**消息体**：

```json
{
  "eventId": "evt-uuid-002",
  "eventType": "concept.updated",
  "aggregateType": "CONCEPT",
  "aggregateId": "concept-customer-001",
  "tenantId": "tenant-001",
  "traceId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "timestamp": "2026-07-16T12:00:00.000Z",
  "version": "1.0",
  "data": {
    "conceptId": "concept-customer-001",
    "changes": {
      "name": { "oldValue": "客户", "newValue": "客户（更新）" },
      "description": { "oldValue": "旧描述", "newValue": "更新后的描述" }
    }
  },
  "metadata": { "operator": "user-002", "source": "APP-ONTSTUDIO", "versionId": "ver-1.3.0-draft" }
}
```

#### 5.4.3 概念删除事件

**Topic**: `metaplatform.ont.concept.deleted`

**消息体**：

```json
{
  "eventId": "evt-uuid-003",
  "eventType": "concept.deleted",
  "aggregateType": "CONCEPT",
  "aggregateId": "concept-customer-001",
  "tenantId": "tenant-001",
  "traceId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "timestamp": "2026-07-16T13:00:00.000Z",
  "version": "1.0",
  "data": {
    "conceptId": "concept-customer-001",
    "cascade": true,
    "cascadeDeleted": { "concepts": ["concept-individual-001"], "entities": ["entity-001", "entity-002"] }
  },
  "metadata": { "operator": "user-001", "source": "APP-ONTSTUDIO" }
}
```

#### 5.4.4 概念移动事件

**Topic**: `metaplatform.ont.concept.moved`

**消息体**：

```json
{
  "eventId": "evt-uuid-004",
  "eventType": "concept.moved",
  "aggregateType": "CONCEPT",
  "aggregateId": "concept-customer-001",
  "tenantId": "tenant-001",
  "traceId": "d4e5f6a7-b8c9-0123-defa-234567890123",
  "timestamp": "2026-07-16T13:30:00.000Z",
  "version": "1.0",
  "data": {
    "conceptId": "concept-customer-001",
    "oldParentConceptId": "concept-org-001",
    "newParentConceptId": "concept-new-parent-001",
    "oldDepth": 2,
    "newDepth": 2,
    "oldPath": "/concept-root/concept-org-001/concept-customer-001",
    "newPath": "/concept-root/concept-new-parent-001/concept-customer-001"
  },
  "metadata": { "operator": "user-001", "source": "APP-ONTSTUDIO" }
}
```

#### 5.4.5 实体创建事件

**Topic**: `metaplatform.ont.entity.created`

**消息体**：

```json
{
  "eventId": "evt-uuid-005",
  "eventType": "entity.created",
  "aggregateType": "ENTITY",
  "aggregateId": "entity-alibaba-001",
  "tenantId": "tenant-001",
  "traceId": "e5f6a7b8-c9d0-1234-efab-345678901234",
  "timestamp": "2026-07-16T10:35:00.000Z",
  "version": "1.0",
  "data": {
    "entityId": "entity-alibaba-001",
    "conceptId": "concept-customer-001",
    "name": "阿里巴巴集团",
    "code": "ENT-ALIBABA-001",
    "attributes": { "CUSTOMER_NAME": "阿里巴巴集团", "CUSTOMER_TYPE": "ENTERPRISE" }
  },
  "metadata": { "operator": "user-001", "source": "APP-ONTSTUDIO", "versionId": "ver-1.3.0-draft" }
}
```

#### 5.4.6 实体更新事件

**Topic**: `metaplatform.ont.entity.updated`

**消息体**：

```json
{
  "eventId": "evt-uuid-006",
  "eventType": "entity.updated",
  "aggregateType": "ENTITY",
  "aggregateId": "entity-alibaba-001",
  "tenantId": "tenant-001",
  "traceId": "f6a7b8c9-d0e1-2345-fabc-456789012345",
  "timestamp": "2026-07-16T12:30:00.000Z",
  "version": "1.0",
  "data": {
    "entityId": "entity-alibaba-001",
    "changes": { "name": { "oldValue": "阿里巴巴集团", "newValue": "阿里巴巴集团（更新）" } }
  },
  "metadata": { "operator": "user-002", "source": "APP-ONTSTUDIO", "versionId": "ver-1.3.0-draft" }
}
```

#### 5.4.7 实体删除事件

**Topic**: `metaplatform.ont.entity.deleted`

**消息体**：

```json
{
  "eventId": "evt-uuid-007",
  "eventType": "entity.deleted",
  "aggregateType": "ENTITY",
  "aggregateId": "entity-alibaba-001",
  "tenantId": "tenant-001",
  "traceId": "a7b8c9d0-e1f2-3456-abcd-567890123456",
  "timestamp": "2026-07-16T14:00:00.000Z",
  "version": "1.0",
  "data": {
    "entityId": "entity-alibaba-001",
    "conceptId": "concept-customer-001",
    "cascade": true,
    "cascadeDeletedRelations": 3
  },
  "metadata": { "operator": "user-001", "source": "APP-ONTSTUDIO" }
}
```

#### 5.4.8 实体属性变更事件

**Topic**: `metaplatform.ont.entity.attribute-changed`

**消息体**：

```json
{
  "eventId": "evt-uuid-008",
  "eventType": "entity.attribute-changed",
  "aggregateType": "ENTITY",
  "aggregateId": "entity-alibaba-001",
  "tenantId": "tenant-001",
  "traceId": "b8c9d0e1-f2a3-4567-bcde-678901234567",
  "timestamp": "2026-07-16T12:45:00.000Z",
  "version": "1.0",
  "data": {
    "entityId": "entity-alibaba-001",
    "attributeChanges": [
      { "attributeId": "attr-001", "attributeCode": "CUSTOMER_NAME", "oldValue": "阿里巴巴集团", "newValue": "阿里巴巴集团（更新）" },
      { "attributeId": "attr-003", "attributeCode": "INDUSTRY", "oldValue": "互联网科技", "newValue": "电子商务" }
    ]
  },
  "metadata": { "operator": "user-001", "source": "APP-ONTSTUDIO", "versionId": "ver-1.3.0-draft" }
}
```

#### 5.4.9 关系类型创建事件

**Topic**: `metaplatform.ont.relation-type.created`

**消息体**：

```json
{
  "eventId": "evt-uuid-009",
  "eventType": "relation-type.created",
  "aggregateType": "RELATION_TYPE",
  "aggregateId": "rel-type-supplies-001",
  "tenantId": "tenant-001",
  "traceId": "c9d0e1f2-a3b4-5678-cdef-789012345678",
  "timestamp": "2026-07-16T11:00:00.000Z",
  "version": "1.0",
  "data": {
    "relationTypeId": "rel-type-supplies-001",
    "name": "供货关系",
    "code": "SUPPLIES_TO",
    "sourceConceptId": "concept-supplier-001",
    "targetConceptId": "concept-customer-001",
    "direction": "DIRECTED",
    "cardinality": "MANY_TO_MANY"
  },
  "metadata": { "operator": "user-001", "source": "APP-ONTSTUDIO", "versionId": "ver-1.3.0-draft" }
}
```

#### 5.4.10 关系实例创建事件

**Topic**: `metaplatform.ont.relation-instance.created`

**消息体**：

```json
{
  "eventId": "evt-uuid-010",
  "eventType": "relation-instance.created",
  "aggregateType": "RELATION_INSTANCE",
  "aggregateId": "rel-inst-001",
  "tenantId": "tenant-001",
  "traceId": "d0e1f2a3-b4c5-6789-efab-890123456789",
  "timestamp": "2026-07-16T11:30:00.000Z",
  "version": "1.0",
  "data": {
    "relationInstanceId": "rel-inst-001",
    "relationTypeId": "rel-type-supplies-001",
    "sourceEntityId": "entity-supplier-001",
    "targetEntityId": "entity-alibaba-001",
    "attributes": { "SUPPLY_AMOUNT": "5000000" }
  },
  "metadata": { "operator": "user-001", "source": "APP-ONTSTUDIO", "versionId": "ver-1.3.0-draft" }
}
```

#### 5.4.11 属性定义创建事件

**Topic**: `metaplatform.ont.attribute.created`

**消息体**：

```json
{
  "eventId": "evt-uuid-011",
  "eventType": "attribute.created",
  "aggregateType": "ATTRIBUTE",
  "aggregateId": "attr-002",
  "tenantId": "tenant-001",
  "traceId": "e1f2a3b4-c5d6-7890-abcd-901234567890",
  "timestamp": "2026-07-16T09:00:00.000Z",
  "version": "1.0",
  "data": {
    "attributeId": "attr-002",
    "name": "客户类型",
    "code": "CUSTOMER_TYPE",
    "dataType": "ENUM",
    "required": true,
    "enumValues": [
      { "value": "INDIVIDUAL", "label": "个人客户" },
      { "value": "ENTERPRISE", "label": "企业客户" }
    ]
  },
  "metadata": { "operator": "user-001", "source": "APP-ONTSTUDIO", "versionId": "ver-1.3.0-draft" }
}
```

#### 5.4.12 规则创建事件

**Topic**: `metaplatform.ont.rule.created`

**消息体**：

```json
{
  "eventId": "evt-uuid-012",
  "eventType": "rule.created",
  "aggregateType": "RULE",
  "aggregateId": "rule-001",
  "tenantId": "tenant-001",
  "traceId": "f2a3b4c5-d6e7-8901-bcde-012345678901",
  "timestamp": "2026-07-16T11:00:00.000Z",
  "version": "1.0",
  "data": {
    "ruleId": "rule-001",
    "name": "企业客户自动分类",
    "code": "RULE_CUSTOMER_CLASSIFY",
    "ruleType": "INFERENCE",
    "scope": "CONCEPT",
    "scopeConceptId": "concept-customer-001",
    "priority": 50,
    "enabled": true
  },
  "metadata": { "operator": "user-001", "source": "APP-ONTSTUDIO", "versionId": "ver-1.3.0-draft" }
}
```

#### 5.4.13 版本发布事件

**Topic**: `metaplatform.ont.version.published`

**消息体**：

```json
{
  "eventId": "evt-uuid-013",
  "eventType": "version.published",
  "aggregateType": "VERSION",
  "aggregateId": "ver-1.2.0",
  "tenantId": "tenant-001",
  "traceId": "a3b4c5d6-e7f8-9012-cdef-123456789012",
  "timestamp": "2026-07-16T16:00:00.000Z",
  "version": "1.0",
  "data": {
    "versionId": "ver-1.2.0",
    "version": "1.2.0",
    "label": "release",
    "consistencyCheck": { "performed": true, "passed": true },
    "snapshotStats": { "conceptCount": 25, "entityCount": 1523, "ruleCount": 30 }
  },
  "metadata": { "operator": "user-001", "source": "APP-ONTSTUDIO" }
}
```

#### 5.4.14 版本回滚事件

**Topic**: `metaplatform.ont.version.rolled-back`

**消息体**：

```json
{
  "eventId": "evt-uuid-014",
  "eventType": "version.rolled-back",
  "aggregateType": "VERSION",
  "aggregateId": "ver-1.2.0",
  "tenantId": "tenant-001",
  "traceId": "b4c5d6e7-f8a9-0123-defa-234567890123",
  "timestamp": "2026-07-16T17:00:00.000Z",
  "version": "1.0",
  "data": {
    "rolledBackTo": "ver-1.2.0",
    "snapshotCreated": "ver-1.3.0-snapshot",
    "snapshotDescription": "回滚至 1.2.0 前的快照"
  },
  "metadata": { "operator": "user-001", "source": "APP-ONTSTUDIO" }
}
```

### 5.5 DLQ（Dead Letter Queue）处理

#### 5.5.1 DLQ 策略

| 配置项 | 值 | 说明 |
|---|---|---|
| 重试次数 | 3 | 消费失败后最多重试 3 次 |
| 重试间隔 | 指数退避 | 1s, 2s, 4s |
| DLQ Topic 后缀 | `.dlq` | 如 `metaplatform.ont.concept.created.dlq` |
| 最大 DLQ 保留 | 7 天 | 超过 7 天的 DLQ 记录自动清理 |

#### 5.5.2 DLQ 消息结构

DLQ 消息在原始消息基础上增加以下字段：

```json
{
  "originalEvent": { },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "failureReason": "Neo4j connection timeout",
  "failureTimestamp": "2026-07-16T10:31:05.000Z",
  "retryCount": 3,
  "consumerGroup": "tech-ont-neo4j-sync",
  "originalTopic": "metaplatform.ont.concept.created",
  "originalPartition": 2,
  "originalOffset": 15432
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| originalEvent | object | 原始事件消息体（完整保留） |
| traceId | string | 链路追踪 ID（从原始消息 Header `X-Trace-Id` 继承） |
| failureReason | string | 失败原因描述 |
| failureTimestamp | string | 失败时间（ISO 8601） |
| retryCount | integer | 已重试次数 |
| consumerGroup | string | 消费者组名称 |
| originalTopic | string | 原始 Topic 名称 |
| originalPartition | integer | 原始分区号 |
| originalOffset | integer | 原始偏移量 |

> **关键约束**：DLQ 记录必须包含 `traceId` 字段用于故障诊断，该字段继承自原始 Kafka 消息 Header 中的 `X-Trace-Id`。

---

## 6. 增量交付计划

### Phase 1：核心建模能力（MVP）

**目标**：完成概念、实体、属性的基础 CRUD，支撑 APP-ONTSTUDIO 前端建模。

| 交付项 | 内容 | 优先级 |
|---|---|---|
| 概念管理 API | 概念 CRUD、层级树、子概念查询 | P0 |
| 实体管理 API | 实体 CRUD、按概念查询、属性值读写 | P0 |
| 属性管理 API | 属性定义 CRUD、枚举/约束、校验 | P0 |
| PostgreSQL 表结构 | ont_concept, ont_entity, ont_attribute, ont_concept_attribute, ont_entity_attribute | P0 |
| 统一响应体与错误码 | 统一响应格式、错误码体系 | P0 |
| 认证与租户隔离 | Bearer Token + API Key + 租户过滤 | P0 |

### Phase 2：关系与图查询

**目标**：完成关系建模与 Neo4j 图查询能力。

| 交付项 | 内容 | 优先级 |
|---|---|---|
| 关系类型管理 API | 关系类型 CRUD、基数约束 | P0 |
| 关系实例管理 API | 关系实例 CRUD、按实体查询 | P0 |
| Neo4j 图模型 | Concept/Entity 节点、SUB_CLASS_OF/INSTANCE_OF/关系类型边 | P0 |
| PostgreSQL -> Neo4j 同步 | Outbox 模式 + 事件驱动同步 | P0 |
| 知识图谱查询 API | Cypher 查询、图遍历、路径查找、邻居查询 | P1 |
| 图谱统计 API | 节点/边统计、概念分布 | P1 |

### Phase 3：规则与推理

**目标**：完成规则引擎集成与本体推理能力。

| 交付项 | 内容 | 优先级 |
|---|---|---|
| 规则管理 API | 规则 CRUD、启用/禁用、测试执行 | P1 |
| 推理引擎 API | 推理任务执行（HermiT/ELK）、异步任务管理 | P1 |
| 一致性校验 API | 本体一致性校验、可满足性检查 | P1 |
| 推理结果缓存 | Redis 缓存推理结论，避免重复计算 | P2 |
| TECH-RULE 集成 | 规则引擎委托执行、规则优先级调度 | P1 |

### Phase 4：版本管理与事件广播

**目标**：完成版本控制与 Kafka 事件全链路。

| 交付项 | 内容 | 优先级 |
|---|---|---|
| 版本管理 API | 版本快照、对比、回滚、发布 | P1 |
| Outbox 模式实现 | ont_outbox 表 + Publisher 轮询 + Kafka 发布 | P0 |
| Kafka 事件定义 | 概念/实体/关系/属性/规则/版本全量事件 | P0 |
| DLQ 处理 | 重试 3 次 + DLQ Topic + traceId 保留 | P0 |
| trace_id 全链路传播 | HTTP Header + Kafka Header + MDC + DLQ | P0 |

### Phase 5：增强与优化

**目标**：性能优化、多租户增强、可观测性。

| 交付项 | 内容 | 优先级 |
|---|---|---|
| 批量操作 API | 实体批量创建（upsert/skip 模式） | P2 |
| 热点缓存 | 概念树、属性定义 Redis 缓存 | P2 |
| 查询性能优化 | PostgreSQL 索引优化、Neo4j 查询计划优化 | P2 |
| OpenTelemetry 集成 | trace/span 上报、Prometheus 指标采集 | P2 |
| 限流与熔断 | API 限流（429）、Neo4j 连接池熔断 | P2 |
| P3 双向同步增强 | Neo4j -> PostgreSQL 显式回写、CDC 补偿 | P3 |

### 交付时间线

| 阶段 | 预计周期 | 里程碑 |
|---|---|---|
| Phase 1 | 3 周 | 核心建模 API 可用，APP-ONTSTUDIO 可接入 |
| Phase 2 | 3 周 | 关系建模与图查询可用，Neo4j 同步上线 |
| Phase 3 | 2 周 | 规则与推理引擎可用 |
| Phase 4 | 2 周 | 版本管理与事件广播全链路打通 |
| Phase 5 | 持续 | 性能优化与可观测性增强 |

---

## 附录 A：OpenAPI Specification 索引

本规范对应 OpenAPI 3.1 文件路径：

```
TECH-ONT/docs/openapi/ont-api-v1.0.yaml
```

## 附录 B：变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|---|---|---|---|
| v1.0 | 2026-07-16 | 初始版本，包含全部 8 组 API、数据模型、事件定义、交付计划 | 平台架构组 |