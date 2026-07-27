# SPEC - 规则引擎服务 API 规范（TECH-RULE）

> 版本：v1.0 | 日期：2026-07-16 | 状态：草案

## 版本历史

| 版本 | 日期 | 变更说明 | 作者 |
|---|---|---|---|
| v1.0 | 2026-07-16 | 初始版本，定义规则集管理、规则定义、DMN 决策表、规则执行、规则测试、规则监控六大类 API | - |

---

## 1. 服务概述

### 1.1 模块定位

TECH-RULE（规则引擎服务）是 Mate Platform 的业务规则计算中枢，为工作流引擎、Action 引擎、Agent 框架与低代码应用中心提供统一的规则定义、执行与监控能力。

规则引擎与 `TECH-ONT` 本体引擎深度集成：规则条件可引用 Ontology 中的 Concept（概念）、Attribute（属性）与 Relation（关系），确保规则语义与平台本体模型保持一致。所有规则计算以 Ontology 为单一真相源，避免规则与数据语义脱节。

**核心职责：**

| 序号 | 职责 | 说明 |
|------|------|------|
| 1 | 规则集管理 | 规则集的创建、查询、更新、删除、版本管理与发布回滚 |
| 2 | 规则定义 | 条件-动作规则（IF-THEN）、DMN 决策表、规则优先级、启用/禁用 |
| 3 | 规则执行 | 输入事实数据，执行规则匹配，返回动作列表；支持批量执行与异步执行 |
| 4 | 规则测试 | 上传测试数据，模拟规则执行，查看匹配结果，支持版本对比 |
| 5 | 规则监控 | 执行统计、匹配率分析、错误追踪、执行历史查询 |

### 1.2 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 运行时 | Java 21 + Spring Boot 3.4 | 主服务框架 |
| 规则引擎 | Drools 9.x（核心）+ 自研表达式（轻量场景） | Drools 处理复杂规则集，自研表达式处理简单 IF-THEN |
| 决策表 | DMN 1.4 标准 + Drools DMN 运行时 | 兼容 OMG DMN 规范 |
| 持久化 | PostgreSQL 17 | 规则定义、执行日志、测试用例持久化 |
| 缓存 | Redis 7.4 | 规则集编译结果缓存、热点规则缓存 |
| 消息队列 | Kafka 3.9 | 规则执行事件、规则变更事件（Outbox 模式） |
| 可观测性 | OpenTelemetry 1.45 + Prometheus 3.x | trace_id 全链路传播、执行指标采集 |
| 包名 | `com.metaplatform.rule` | Java 根包 |
| API 前缀 | `/api/v1/rule` | 统一路径前缀 |

### 1.3 上下游关系

```
                    ┌──────────────┐
                    │   TECH-ONT   │  (上游) 概念/属性/关系语义
                    └──────┬───────┘
                           │ 引用 Ontology 元素
                           ▼
                    ┌──────────────┐
                    │  TECH-RULE   │  规则引擎服务
                    └──┬───┬───┬───┘
                       │   │   │
          ┌────────────┘   │   └────────────┐
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────────┐
    │ TECH-WFE │    │TECH-ACTION│   │ APP-APPHUB   │
    │ 工作流引擎 │    │ 动作引擎  │    │ 应用中心     │
    │ 条件分支  │    │ 触发规则  │    │ 规则配置 UI  │
    └──────────┘    └──────────┘    └──────────────┘
```

| 方向 | 模块 | 交互内容 |
|------|------|---------|
| 上游（依赖） | TECH-ONT | 规则条件引用 Concept/Attribute/Relation；规则校验时查询本体定义 |
| 下游（被依赖） | TECH-WFE | 工作流条件分支节点调用规则集执行接口进行路由决策 |
| 下游（被依赖） | TECH-ACTION | Action 触发规则匹配，根据规则动作触发对应 Action |
| 下游（被依赖） | APP-APPHUB | 低代码应用中心提供规则配置界面，调用规则管理 API |

### 1.4 核心概念

| 概念 | 说明 |
|------|------|
| RuleSet（规则集） | 规则的逻辑容器，包含一组相关规则，支持版本管理与发布 |
| Rule（规则） | 单条 IF-THEN 规则，由条件（Condition）和动作（Action）组成 |
| RuleCondition（规则条件） | 规则的 IF 部分，引用 Ontology 属性进行事实判断 |
| RuleAction（规则动作） | 规则的 THEN 部分，定义匹配后执行的动作（赋值、触发事件、调用 Action 等） |
| DecisionTable（决策表） | DMN 标准决策表，以表格形式定义多输入多输出的决策逻辑 |
| Fact（事实） | 规则执行时输入的业务数据对象，映射到 Ontology 实体 |
| ExecutionLog（执行日志） | 规则执行的完整记录，包含输入事实、匹配规则、输出动作、耗时等 |

---

## 2. 通用约定

### 2.1 路径前缀

所有 TECH-RULE API 路径统一前缀为 `/api/v1/rule`。

```
基础路径：/api/v1/rule
完整示例：/api/v1/rule/rule-sets
```

### 2.2 统一响应体

所有接口返回统一 JSON 结构：

```json
{
  "code": 0,
  "message": "success",
  "data": { },
  "traceId": "a1b2c3d4e5f6-20260716120000-001"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| code | integer | 业务状态码，`0` 表示成功，非 `0` 表示失败（见错误码表） |
| message | string | 状态描述信息 |
| data | object/array/null | 业务数据，失败时为 `null` |
| traceId | string | 全链路追踪 ID，贯穿所有系统组件，与 Kafka 消息头 `X-Trace-Id` 一致 |

### 2.3 认证

所有接口需通过 `TECH-IAM` 颁发的 JWT 令牌认证：

```
Authorization: Bearer <jwt_token>
```

JWT Payload 包含以下声明：

| 声明 | 说明 |
|------|------|
| sub | 用户 ID |
| tenant_id | 租户 ID |
| roles | 角色列表（如 `rule_admin`、`rule_developer`、`rule_viewer`） |
| exp | 过期时间 |

### 2.4 错误码

| code | HTTP Status | 说明 | 典型场景 |
|------|-------------|------|---------|
| 0 | 200 | 成功 | 请求正常处理 |
| 40001 | 400 | 参数校验失败 | 必填参数缺失、格式错误 |
| 40002 | 400 | JSON 解析失败 | 请求体非合法 JSON |
| 40101 | 401 | 未认证 | 缺少或无效的 Authorization 头 |
| 40301 | 403 | 无权限 | 当前角色无权操作该资源 |
| 40401 | 404 | 资源不存在 | 规则集/规则/决策表 ID 不存在 |
| 40901 | 409 | 资源冲突 | 规则集名称重复、版本号冲突 |
| 40902 | 409 | 状态冲突 | 规则集已发布不可修改、规则已启用不可删除 |
| 42201 | 422 | 规则校验失败 | 条件表达式语法错误、引用的 Ontology 属性不存在 |
| 42202 | 422 | 决策表校验失败 | 决策规则行不完整、输入输出列类型不匹配 |
| 42901 | 429 | 限流 | 规则执行频率超出限制 |
| 50001 | 500 | 服务内部错误 | 规则引擎运行时异常 |
| 50002 | 500 | 上游服务不可用 | TECH-ONT 服务不可达 |
| 50301 | 503 | 服务不可用 | 规则引擎未就绪 |

### 2.5 分页约定

列表类接口统一使用分页参数：

**请求参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | integer | 否 | 1 | 页码，从 1 开始 |
| pageSize | integer | 否 | 20 | 每页条数，最大 100 |
| sortBy | string | 否 | createdAt | 排序字段 |
| sortOrder | string | 否 | desc | 排序方向：`asc`/`desc` |

**响应分页结构：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [ ],
    "total": 156,
    "page": 1,
    "pageSize": 20,
    "totalPages": 8
  },
  "traceId": "xxx"
}
```

### 2.6 trace_id 传播

- 每个请求由网关生成或透传 `X-Trace-Id` 请求头
- 服务内部所有日志、数据库操作、Kafka 消息均携带 `traceId`
- 响应体的 `traceId` 字段与请求头一致
- Kafka 消息头固定包含 `X-Trace-Id` 字段

### 2.7 Outbox 模式

Kafka 消息发布遵循 Outbox 模式：

1. 业务事务中，将事件写入 `outbox_events` 表（与业务数据同一事务）
2. 独立的 Outbox Publisher 轮询 `outbox_events` 表，发布到 Kafka
3. 发布成功后标记 `outbox_events.status = PUBLISHED`
4. 消费端失败重试 3 次后进入 DLQ，DLQ 记录包含 `traceId` 字段

---

## 3. API 接口详情

### 3.1 规则集管理 API

规则集（RuleSet）是规则的逻辑容器，支持版本管理与发布生命周期。

#### 3.1.1 创建规则集

**POST** `/api/v1/rule/rule-sets`

创建一个新的规则集。规则集创建后默认状态为 `DRAFT`。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 规则集名称，租户内唯一，长度 1-100 |
| code | string | 是 | 规则集编码，唯一标识，`^[a-z][a-z0-9_]{2,49}$` |
| description | string | 否 | 规则集描述，最大 500 字符 |
| ontologyRef | object | 否 | 关联的 Ontology 命名空间 |
| ontologyRef.namespace | string | 否 | Ontology 命名空间（如 `sales`） |
| ontologyRef.version | string | 否 | Ontology 版本号 |
| conflictResolution | string | 否 | 冲突解决策略：`PRIORITY`（优先级，默认）、`FIRST_MATCH`（首次匹配）、`ALL_MATCH`（全部匹配） |
| executionMode | string | 否 | 执行模式：`SYNC`（同步，默认）、`ASYNC`（异步） |
| tags | string[] | 否 | 标签列表 |

**请求示例：**

```json
{
  "name": "订单风控规则集",
  "code": "order_risk_control",
  "description": "针对订单业务的风控规则集合，包含金额阈值、频次限制等",
  "ontologyRef": {
    "namespace": "order",
    "version": "v1.2"
  },
  "conflictResolution": "PRIORITY",
  "executionMode": "SYNC",
  "tags": ["风控", "订单"]
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "name": "订单风控规则集",
    "code": "order_risk_control",
    "description": "针对订单业务的风控规则集合，包含金额阈值、频次限制等",
    "ontologyRef": {
      "namespace": "order",
      "version": "v1.2"
    },
    "conflictResolution": "PRIORITY",
    "executionMode": "SYNC",
    "tags": ["风控", "订单"],
    "status": "DRAFT",
    "currentVersion": null,
    "publishedVersion": null,
    "ruleCount": 0,
    "createdAt": "2026-07-16T10:00:00Z",
    "updatedAt": "2026-07-16T10:00:00Z",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4e5f6-20260716100000-001"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40001 | name 为空或超长；code 格式不合规 |
| 40101 | 未携带有效的 JWT |
| 40301 | 当前用户无创建权限 |
| 40901 | 同租户下 code 已存在 |

---

#### 3.1.2 查询规则集列表

**GET** `/api/v1/rule/rule-sets`

分页查询当前租户下的规则集列表，支持多条件过滤。

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyword | string | 否 | 名称/编码模糊搜索 |
| status | string | 否 | 状态过滤：`DRAFT`/`PUBLISHED`/`ARCHIVED` |
| tag | string | 否 | 标签过滤 |
| ontologyNamespace | string | 否 | Ontology 命名空间过滤 |
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |
| sortBy | string | 否 | 排序字段，默认 `createdAt` |
| sortOrder | string | 否 | `asc`/`desc`，默认 `desc` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "ruleSetId": "rs-9f3a2b1c8d7e4f60",
        "name": "订单风控规则集",
        "code": "order_risk_control",
        "status": "PUBLISHED",
        "currentVersion": "v2",
        "publishedVersion": "v2",
        "ruleCount": 12,
        "tags": ["风控", "订单"],
        "createdAt": "2026-07-16T10:00:00Z",
        "updatedAt": "2026-07-16T14:30:00Z",
        "createdBy": "user-001"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4e5f6-20260716100100-002"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40001 | pageSize 超过 100 |
| 40101 | 未认证 |

---

#### 3.1.3 获取规则集详情

**GET** `/api/v1/rule/rule-sets/{ruleSetId}`

获取指定规则集的完整信息，包含规则数量、版本信息等。

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ruleSetId | string | 是 | 规则集 ID |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "name": "订单风控规则集",
    "code": "order_risk_control",
    "description": "针对订单业务的风控规则集合",
    "ontologyRef": {
      "namespace": "order",
      "version": "v1.2"
    },
    "conflictResolution": "PRIORITY",
    "executionMode": "SYNC",
    "tags": ["风控", "订单"],
    "status": "PUBLISHED",
    "currentVersion": "v2",
    "publishedVersion": "v2",
    "ruleCount": 12,
    "activeRuleCount": 10,
    "versions": [
      { "version": "v1", "createdAt": "2026-07-10T09:00:00Z", "createdBy": "user-001" },
      { "version": "v2", "createdAt": "2026-07-16T14:00:00Z", "createdBy": "user-001" }
    ],
    "createdAt": "2026-07-16T10:00:00Z",
    "updatedAt": "2026-07-16T14:30:00Z",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4e5f6-20260716100200-003"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | ruleSetId 不存在 |
| 40301 | 无权访问该租户的规则集 |

---

#### 3.1.4 更新规则集

**PUT** `/api/v1/rule/rule-sets/{ruleSetId}`

更新规则集的可编辑字段。仅 `DRAFT` 状态的规则集可修改核心配置。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 否 | 规则集名称 |
| description | string | 否 | 描述 |
| ontologyRef | object | 否 | 关联 Ontology |
| conflictResolution | string | 否 | 冲突解决策略 |
| executionMode | string | 否 | 执行模式 |
| tags | string[] | 否 | 标签列表 |

**请求示例：**

```json
{
  "description": "更新后的订单风控规则集描述",
  "conflictResolution": "ALL_MATCH",
  "tags": ["风控", "订单", "v2迭代"]
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "name": "订单风控规则集",
    "description": "更新后的订单风控规则集描述",
    "conflictResolution": "ALL_MATCH",
    "tags": ["风控", "订单", "v2迭代"],
    "status": "DRAFT",
    "updatedAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "a1b2c3d4e5f6-20260716100300-004"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 规则集不存在 |
| 40902 | 规则集已发布，不可修改核心配置（需创建新版本） |
| 40001 | 字段格式校验失败 |

---

#### 3.1.5 删除规则集

**DELETE** `/api/v1/rule/rule-sets/{ruleSetId}`

删除规则集及其所有版本和规则。删除为软删除，保留审计记录。

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| force | boolean | 否 | 是否强制删除（即使已发布），默认 `false` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "deleted": true,
    "deletedRules": 12,
    "deletedVersions": 2
  },
  "traceId": "a1b2c3d4e5f6-20260716100400-005"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 规则集不存在 |
| 40902 | 规则集已发布且 force=false |
| 40301 | 无删除权限 |

---

#### 3.1.6 创建规则集版本

**POST** `/api/v1/rule/rule-sets/{ruleSetId}/versions`

基于当前草稿创建一个新的规则集版本快照。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| versionLabel | string | 否 | 版本标签（如 `v3`），不填则自动递增 |
| changeLog | string | 否 | 版本变更说明 |
| snapshotRules | boolean | 否 | 是否快照当前所有规则，默认 `true` |

**请求示例：**

```json
{
  "versionLabel": "v3",
  "changeLog": "新增高频订单限流规则，调整金额阈值"
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "version": "v3",
    "changeLog": "新增高频订单限流规则，调整金额阈值",
    "ruleCount": 13,
    "createdAt": "2026-07-16T15:00:00Z",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4e5f6-20260716100500-006"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 规则集不存在 |
| 40901 | versionLabel 已存在 |

---

#### 3.1.7 查询版本列表

**GET** `/api/v1/rule/rule-sets/{ruleSetId}/versions`

获取规则集的所有版本列表。

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "version": "v1",
        "changeLog": "初始版本",
        "ruleCount": 8,
        "status": "ARCHIVED",
        "createdAt": "2026-07-10T09:00:00Z",
        "createdBy": "user-001"
      },
      {
        "version": "v2",
        "changeLog": "新增金额阈值规则",
        "ruleCount": 12,
        "status": "PUBLISHED",
        "createdAt": "2026-07-16T14:00:00Z",
        "createdBy": "user-001"
      },
      {
        "version": "v3",
        "changeLog": "新增高频订单限流规则",
        "ruleCount": 13,
        "status": "DRAFT",
        "createdAt": "2026-07-16T15:00:00Z",
        "createdBy": "user-001"
      }
    ],
    "total": 3
  },
  "traceId": "a1b2c3d4e5f6-20260716100600-007"
}
```

---

#### 3.1.8 获取版本详情

**GET** `/api/v1/rule/rule-sets/{ruleSetId}/versions/{version}`

获取指定版本的完整快照信息，包含该版本下所有规则摘要。

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ruleSetId | string | 是 | 规则集 ID |
| version | string | 是 | 版本标签（如 `v2`） |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "version": "v2",
    "changeLog": "新增金额阈值规则",
    "status": "PUBLISHED",
    "ruleCount": 12,
    "rules": [
      {
        "ruleId": "rl-1a2b3c4d5e6f",
        "name": "高额订单告警",
        "priority": 100,
        "enabled": true
      },
      {
        "ruleId": "rl-2b3c4d5e6f7a",
        "name": "深夜订单审查",
        "priority": 80,
        "enabled": true
      }
    ],
    "createdAt": "2026-07-16T14:00:00Z",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4e5f6-20260716100700-008"
}
```

---

#### 3.1.9 发布规则集版本

**POST** `/api/v1/rule/rule-sets/{ruleSetId}/publish`

将指定版本发布为线上版本。发布前自动执行规则校验，校验通过后编译规则集并缓存。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| version | string | 是 | 待发布的版本标签 |
| skipValidation | boolean | 否 | 是否跳过校验，默认 `false`（不建议跳过） |

**请求示例：**

```json
{
  "version": "v3",
  "skipValidation": false
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "publishedVersion": "v3",
    "previousVersion": "v2",
    "validationPassed": true,
    "validationErrors": [],
    "compiledAt": "2026-07-16T15:30:00Z",
    "publishedBy": "user-001"
  },
  "traceId": "a1b2c3d4e5f6-20260716100800-009"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 42201 | 规则校验失败（条件语法错误、引用属性不存在） |
| 40401 | 版本不存在 |
| 40902 | 该版本已是当前发布版本 |

---

#### 3.1.10 回滚规则集版本

**POST** `/api/v1/rule/rule-sets/{ruleSetId}/rollback`

将发布版本回滚到指定历史版本。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| targetVersion | string | 是 | 回滚目标版本标签 |
| createNewVersion | boolean | 否 | 是否基于目标版本创建新版本，默认 `true` |

**请求示例：**

```json
{
  "targetVersion": "v2",
  "createNewVersion": true
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "rolledBackFrom": "v3",
    "rolledBackTo": "v2",
    "newVersion": "v4",
    "publishedVersion": "v4",
    "rolledBackAt": "2026-07-16T16:00:00Z"
  },
  "traceId": "a1b2c3d4e5f6-20260716100900-010"
}
```

---

### 3.2 规则定义 API

规则（Rule）是规则集内的单条 IF-THEN 规则，由条件（Condition）和动作（Action）组成。

#### 3.2.1 创建规则

**POST** `/api/v1/rule/rule-sets/{ruleSetId}/rules`

在指定规则集下创建一条新规则。

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ruleSetId | string | 是 | 规则集 ID |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 规则名称，规则集内唯一，1-100 字符 |
| code | string | 是 | 规则编码，`^[a-z][a-z0-9_]{2,49}$` |
| description | string | 否 | 规则描述 |
| ruleType | string | 是 | 规则类型：`IF_THEN`（条件动作）、`DECISION_TABLE`（决策表引用）、`EXPRESSION`（表达式） |
| priority | integer | 否 | 优先级，数值越大优先级越高，默认 0 |
| conditions | array | 否 | 条件列表（ruleType 为 IF_THEN 时提供） |
| conditions[].field | string | 否 | 条件字段，引用 Ontology 属性（如 `order.amount`） |
| conditions[].operator | string | 否 | 操作符：`EQ`/`NE`/`GT`/`GTE`/`LT`/`LTE`/`IN`/`NOT_IN`/`CONTAINS`/`BETWEEN`/`REGEX` |
| conditions[].value | any | 否 | 比较值 |
| conditions[].logicOp | string | 否 | 与前一条件的逻辑关系：`AND`（默认）/`OR` |
| conditions[].group | string | 否 | 条件分组 ID（支持括号分组） |
| actions | array | 否 | 动作列表 |
| actions[].type | string | 否 | 动作类型：`ASSIGN`（赋值）/`EVENT`（发送事件）/`ACTION_INVOKE`（调用 Action）/`REJECT`（拒绝）/`APPROVE`（通过）/`NOTIFY`（通知） |
| actions[].target | string | 否 | 动作目标（赋值字段、事件名、Action 编码） |
| actions[].params | object | 否 | 动作参数 |
| decisionTableId | string | 否 | 关联决策表 ID（ruleType 为 DECISION_TABLE 时提供） |
| expression | string | 否 | 表达式（ruleType 为 EXPRESSION 时提供） |
| enabled | boolean | 否 | 是否启用，默认 `true` |
| effectiveFrom | string | 否 | 生效开始时间（ISO 8601） |
| effectiveTo | string | 否 | 生效结束时间（ISO 8601） |

**请求示例：**

```json
{
  "name": "高额订单告警",
  "code": "high_amount_alert",
  "description": "订单金额超过 10 万时触发告警",
  "ruleType": "IF_THEN",
  "priority": 100,
  "conditions": [
    {
      "field": "order.amount",
      "operator": "GT",
      "value": 100000,
      "logicOp": "AND"
    },
    {
      "field": "order.status",
      "operator": "EQ",
      "value": "PENDING",
      "logicOp": "AND"
    }
  ],
  "actions": [
    {
      "type": "EVENT",
      "target": "order.high_amount_detected",
      "params": { "severity": "HIGH" }
    },
    {
      "type": "NOTIFY",
      "target": "risk_manager",
      "params": { "channel": "sms", "template": "high_amount_notify" }
    }
  ],
  "enabled": true,
  "effectiveFrom": "2026-07-16T00:00:00Z"
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-1a2b3c4d5e6f",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "name": "高额订单告警",
    "code": "high_amount_alert",
    "ruleType": "IF_THEN",
    "priority": 100,
    "conditions": [
      {
        "conditionId": "cd-001",
        "field": "order.amount",
        "operator": "GT",
        "value": 100000,
        "logicOp": "AND"
      },
      {
        "conditionId": "cd-002",
        "field": "order.status",
        "operator": "EQ",
        "value": "PENDING",
        "logicOp": "AND"
      }
    ],
    "actions": [
      {
        "actionId": "ac-001",
        "type": "EVENT",
        "target": "order.high_amount_detected",
        "params": { "severity": "HIGH" }
      },
      {
        "actionId": "ac-002",
        "type": "NOTIFY",
        "target": "risk_manager",
        "params": { "channel": "sms", "template": "high_amount_notify" }
      }
    ],
    "enabled": true,
    "effectiveFrom": "2026-07-16T00:00:00Z",
    "status": "ACTIVE",
    "createdAt": "2026-07-16T10:30:00Z",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4e5f6-20260716103000-011"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 规则集不存在 |
| 40001 | name 为空、priority 非整数 |
| 40901 | 规则集内 code 已存在 |
| 42201 | 条件引用的 Ontology 属性不存在；操作符与值类型不匹配 |
| 40902 | 规则集已发布，需在草稿版本中编辑 |

---

#### 3.2.2 查询规则列表

**GET** `/api/v1/rule/rule-sets/{ruleSetId}/rules`

分页查询规则集下的规则列表。

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyword | string | 否 | 名称/编码模糊搜索 |
| ruleType | string | 否 | 规则类型过滤 |
| enabled | boolean | 否 | 启用状态过滤 |
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "ruleId": "rl-1a2b3c4d5e6f",
        "name": "高额订单告警",
        "code": "high_amount_alert",
        "ruleType": "IF_THEN",
        "priority": 100,
        "enabled": true,
        "conditionCount": 2,
        "actionCount": 2,
        "createdAt": "2026-07-16T10:30:00Z",
        "updatedAt": "2026-07-16T10:30:00Z"
      },
      {
        "ruleId": "rl-2b3c4d5e6f7a",
        "name": "深夜订单审查",
        "code": "late_night_review",
        "ruleType": "IF_THEN",
        "priority": 80,
        "enabled": true,
        "conditionCount": 1,
        "actionCount": 1,
        "createdAt": "2026-07-16T11:00:00Z",
        "updatedAt": "2026-07-16T11:00:00Z"
      }
    ],
    "total": 12,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4e5f6-20260716103100-012"
}
```

---

#### 3.2.3 获取规则详情

**GET** `/api/v1/rule/rules/{ruleId}`

获取单条规则的完整信息，包含全部条件和动作。

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ruleId | string | 是 | 规则 ID |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-1a2b3c4d5e6f",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "name": "高额订单告警",
    "code": "high_amount_alert",
    "description": "订单金额超过 10 万时触发告警",
    "ruleType": "IF_THEN",
    "priority": 100,
    "conditions": [
      {
        "conditionId": "cd-001",
        "field": "order.amount",
        "fieldType": "DECIMAL",
        "ontologyRef": { "concept": "Order", "attribute": "amount" },
        "operator": "GT",
        "value": 100000,
        "valueType": "NUMBER",
        "logicOp": "AND",
        "group": null
      },
      {
        "conditionId": "cd-002",
        "field": "order.status",
        "fieldType": "ENUM",
        "ontologyRef": { "concept": "Order", "attribute": "status" },
        "operator": "EQ",
        "value": "PENDING",
        "valueType": "STRING",
        "logicOp": "AND",
        "group": null
      }
    ],
    "actions": [
      {
        "actionId": "ac-001",
        "type": "EVENT",
        "target": "order.high_amount_detected",
        "params": { "severity": "HIGH" },
        "order": 1
      },
      {
        "actionId": "ac-002",
        "type": "NOTIFY",
        "target": "risk_manager",
        "params": { "channel": "sms", "template": "high_amount_notify" },
        "order": 2
      }
    ],
    "enabled": true,
    "effectiveFrom": "2026-07-16T00:00:00Z",
    "effectiveTo": null,
    "status": "ACTIVE",
    "matchCount": 156,
    "lastMatchedAt": "2026-07-16T13:45:00Z",
    "createdAt": "2026-07-16T10:30:00Z",
    "updatedAt": "2026-07-16T10:30:00Z",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4e5f6-20260716103200-013"
}
```

---

#### 3.2.4 更新规则

**PUT** `/api/v1/rule/rules/{ruleId}`

更新规则的基础信息（名称、描述、生效时间等）。条件和动作的更新请使用专用接口。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 否 | 规则名称 |
| description | string | 否 | 规则描述 |
| effectiveFrom | string | 否 | 生效开始时间 |
| effectiveTo | string | 否 | 生效结束时间 |

**请求示例：**

```json
{
  "description": "更新后的描述：订单金额超过 10 万且待审核时触发告警",
  "effectiveTo": "2026-12-31T23:59:59Z"
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-1a2b3c4d5e6f",
    "description": "更新后的描述：订单金额超过 10 万且待审核时触发告警",
    "effectiveTo": "2026-12-31T23:59:59Z",
    "updatedAt": "2026-07-16T11:30:00Z"
  },
  "traceId": "a1b2c3d4e5f6-20260716103300-014"
}
```

---

#### 3.2.5 删除规则

**DELETE** `/api/v1/rule/rules/{ruleId}`

从规则集中删除指定规则。软删除。

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-1a2b3c4d5e6f",
    "deleted": true
  },
  "traceId": "a1b2c3d4e5f6-20260716103400-015"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 规则不存在 |
| 40902 | 规则已启用，需先禁用再删除 |

---

#### 3.2.6 配置规则条件

**PUT** `/api/v1/rule/rules/{ruleId}/conditions`

整体替换规则的条件列表。支持条件分组以实现括号逻辑。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| conditions | array | 是 | 条件列表（结构同 3.2.1 的 conditions） |

**请求示例：**

```json
{
  "conditions": [
    {
      "field": "order.amount",
      "operator": "GT",
      "value": 100000,
      "logicOp": "AND",
      "group": "A"
    },
    {
      "field": "order.customerLevel",
      "operator": "IN",
      "value": ["GOLD", "PLATINUM"],
      "logicOp": "OR",
      "group": "A"
    },
    {
      "field": "order.status",
      "operator": "EQ",
      "value": "PENDING",
      "logicOp": "AND",
      "group": "B"
    }
  ]
}
```

> 上述条件逻辑等价于：`((order.amount > 100000 OR order.customerLevel IN [GOLD, PLATINUM]) AND order.status == PENDING)`

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-1a2b3c4d5e6f",
    "conditions": [
      { "conditionId": "cd-003", "field": "order.amount", "operator": "GT", "value": 100000, "logicOp": "AND", "group": "A" },
      { "conditionId": "cd-004", "field": "order.customerLevel", "operator": "IN", "value": ["GOLD", "PLATINUM"], "logicOp": "OR", "group": "A" },
      { "conditionId": "cd-005", "field": "order.status", "operator": "EQ", "value": "PENDING", "logicOp": "AND", "group": "B" }
    ],
    "validationPassed": true,
    "updatedAt": "2026-07-16T12:00:00Z"
  },
  "traceId": "a1b2c3d4e5f6-20260716103500-016"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 42201 | 条件语法错误；引用的 Ontology 属性不存在；值类型不匹配 |

---

#### 3.2.7 配置规则动作

**PUT** `/api/v1/rule/rules/{ruleId}/actions`

整体替换规则的动作列表。动作按 order 顺序执行。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| actions | array | 是 | 动作列表（结构同 3.2.1 的 actions，需包含 order 字段） |

**请求示例：**

```json
{
  "actions": [
    {
      "type": "ASSIGN",
      "target": "order.riskLevel",
      "params": { "value": "HIGH" },
      "order": 1
    },
    {
      "type": "ACTION_INVOKE",
      "target": "act_freeze_order",
      "params": { "reason": "high_amount" },
      "order": 2
    },
    {
      "type": "EVENT",
      "target": "order.risk_triggered",
      "params": { "severity": "HIGH" },
      "order": 3
    }
  ]
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-1a2b3c4d5e6f",
    "actions": [
      { "actionId": "ac-003", "type": "ASSIGN", "target": "order.riskLevel", "params": { "value": "HIGH" }, "order": 1 },
      { "actionId": "ac-004", "type": "ACTION_INVOKE", "target": "act_freeze_order", "params": { "reason": "high_amount" }, "order": 2 },
      { "actionId": "ac-005", "type": "EVENT", "target": "order.risk_triggered", "params": { "severity": "HIGH" }, "order": 3 }
    ],
    "validationPassed": true,
    "updatedAt": "2026-07-16T12:10:00Z"
  },
  "traceId": "a1b2c3d4e5f6-20260716103600-017"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 42201 | 引用的 Action 不存在；动作参数缺失 |

---

#### 3.2.8 设置规则优先级

**PUT** `/api/v1/rule/rules/{ruleId}/priority`

调整规则优先级。冲突解决策略为 `PRIORITY` 时，优先级高的规则先执行。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| priority | integer | 是 | 优先级，-2147483648 ~ 2147483647 |

**请求示例：**

```json
{
  "priority": 200
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-1a2b3c4d5e6f",
    "priority": 200,
    "updatedAt": "2026-07-16T12:20:00Z"
  },
  "traceId": "a1b2c3d4e5f6-20260716103700-018"
}
```

---

#### 3.2.9 启用规则

**POST** `/api/v1/rule/rules/{ruleId}/enable`

启用规则，使其参与规则集执行。

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-1a2b3c4d5e6f",
    "enabled": true,
    "status": "ACTIVE",
    "updatedAt": "2026-07-16T12:30:00Z"
  },
  "traceId": "a1b2c3d4e5f6-20260716103800-019"
}
```

---

#### 3.2.10 禁用规则

**POST** `/api/v1/rule/rules/{ruleId}/disable`

禁用规则，使其不参与规则集执行，但保留配置。

**请求参数（可选）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| reason | string | 否 | 禁用原因 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-1a2b3c4d5e6f",
    "enabled": false,
    "status": "INACTIVE",
    "reason": "业务调整，暂时停用",
    "updatedAt": "2026-07-16T12:40:00Z"
  },
  "traceId": "a1b2c3d4e5f6-20260716103900-020"
}
```

---

### 3.3 DMN 决策表 API

DMN（Decision Model and Notation）决策表以表格形式定义多输入多输出的决策逻辑，适用于规则密集且结构化的场景。

#### 3.3.1 创建决策表

**POST** `/api/v1/rule/decision-tables`

创建一个 DMN 决策表。决策表可独立管理，被规则引用。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 决策表名称 |
| code | string | 是 | 决策表编码，租户内唯一 |
| description | string | 否 | 描述 |
| ruleSetId | string | 否 | 关联规则集 ID（可后续关联） |
| hitPolicy | string | 否 | 命中策略：`UNIQUE`（唯一命中，默认）/`FIRST`（首次命中）/`PRIORITY`（优先命中）/`ANY`（任意命中）/`COLLECT`（收集）/`RULE_ORDER`（规则顺序）/`OUTPUT_ORDER`（输出顺序） |
| aggregation | string | 否 | 聚合函数（hitPolicy 为 COLLECT 时）：`SUM`/`MIN`/`MAX`/`COUNT`/`AVERAGE` |
| inputColumns | array | 否 | 输入列定义 |
| inputColumns[].name | string | 否 | 列名 |
| inputColumns[].expression | string | 否 | 输入表达式（引用 Ontology 属性，如 `order.amount`） |
| inputColumns[].typeRef | string | 否 | 数据类型：`STRING`/`NUMBER`/`BOOLEAN`/`DATE`/`ENUM` |
| outputColumns | array | 否 | 输出列定义 |
| outputColumns[].name | string | 否 | 输出列名 |
| outputColumns[].expression | string | 否 | 输出表达式（赋值目标） |
| outputColumns[].typeRef | string | 否 | 数据类型 |

**请求示例：**

```json
{
  "name": "订单风险等级决策表",
  "code": "order_risk_level_table",
  "description": "根据订单金额和客户等级判定风险等级",
  "ruleSetId": "rs-9f3a2b1c8d7e4f60",
  "hitPolicy": "UNIQUE",
  "inputColumns": [
    { "name": "金额范围", "expression": "order.amount", "typeRef": "NUMBER" },
    { "name": "客户等级", "expression": "order.customerLevel", "typeRef": "STRING" }
  ],
  "outputColumns": [
    { "name": "风险等级", "expression": "order.riskLevel", "typeRef": "STRING" },
    { "name": "处理策略", "expression": "order.strategy", "typeRef": "STRING" }
  ]
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tableId": "dt-5e6f7a8b9c0d",
    "name": "订单风险等级决策表",
    "code": "order_risk_level_table",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "hitPolicy": "UNIQUE",
    "inputColumns": [
      { "columnId": "ic-001", "name": "金额范围", "expression": "order.amount", "typeRef": "NUMBER" }
    ],
    "outputColumns": [
      { "columnId": "oc-001", "name": "风险等级", "expression": "order.riskLevel", "typeRef": "STRING" }
    ],
    "ruleCount": 0,
    "status": "DRAFT",
    "createdAt": "2026-07-16T13:00:00Z",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4e5f6-20260716104000-021"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40901 | code 已存在 |
| 40401 | 关联的 ruleSetId 不存在 |
| 42201 | 输入列表达式引用的属性不存在 |

---

#### 3.3.2 查询决策表列表

**GET** `/api/v1/rule/decision-tables`

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyword | string | 否 | 名称/编码搜索 |
| ruleSetId | string | 否 | 关联规则集过滤 |
| hitPolicy | string | 否 | 命中策略过滤 |
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "tableId": "dt-5e6f7a8b9c0d",
        "name": "订单风险等级决策表",
        "code": "order_risk_level_table",
        "ruleSetId": "rs-9f3a2b1c8d7e4f60",
        "hitPolicy": "UNIQUE",
        "inputColumnCount": 2,
        "outputColumnCount": 2,
        "ruleCount": 6,
        "status": "PUBLISHED",
        "createdAt": "2026-07-16T13:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4e5f6-20260716104100-022"
}
```

---

#### 3.3.3 获取决策表详情

**GET** `/api/v1/rule/decision-tables/{tableId}`

获取决策表完整信息，包含输入输出列定义与所有决策规则行。

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tableId": "dt-5e6f7a8b9c0d",
    "name": "订单风险等级决策表",
    "code": "order_risk_level_table",
    "description": "根据订单金额和客户等级判定风险等级",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "hitPolicy": "UNIQUE",
    "aggregation": null,
    "inputColumns": [
      { "columnId": "ic-001", "name": "金额范围", "expression": "order.amount", "typeRef": "NUMBER" },
      { "columnId": "ic-002", "name": "客户等级", "expression": "order.customerLevel", "typeRef": "STRING" }
    ],
    "outputColumns": [
      { "columnId": "oc-001", "name": "风险等级", "expression": "order.riskLevel", "typeRef": "STRING" },
      { "columnId": "oc-002", "name": "处理策略", "expression": "order.strategy", "typeRef": "STRING" }
    ],
    "rules": [
      {
        "ruleRowId": "dr-001",
        "inputs": ["> 100000", "\"GOLD\""],
        "outputs": ["\"HIGH\"", "\"FREEZE\""],
        "annotation": "高额金牌客户冻结"
      },
      {
        "ruleRowId": "dr-002",
        "inputs": ["> 100000", "-"],
        "outputs": ["\"HIGH\"", "\"REVIEW\""],
        "annotation": "高额其他客户人工审核"
      },
      {
        "ruleRowId": "dr-003",
        "inputs": ["[50000, 100000]", "\"GOLD\""],
        "outputs": ["\"MEDIUM\"", "\"AUTO_APPROVE\""],
        "annotation": "中额金牌客户自动通过"
      }
    ],
    "ruleCount": 3,
    "status": "PUBLISHED",
    "createdAt": "2026-07-16T13:00:00Z",
    "updatedAt": "2026-07-16T13:30:00Z"
  },
  "traceId": "a1b2c3d4e5f6-20260716104200-023"
}
```

---

#### 3.3.4 更新决策表

**PUT** `/api/v1/rule/decision-tables/{tableId}`

更新决策表的元信息（名称、描述、命中策略等）。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 否 | 名称 |
| description | string | 否 | 描述 |
| hitPolicy | string | 否 | 命中策略 |
| aggregation | string | 否 | 聚合函数 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tableId": "dt-5e6f7a8b9c0d",
    "name": "订单风险等级决策表（更新）",
    "hitPolicy": "PRIORITY",
    "updatedAt": "2026-07-16T14:00:00Z"
  },
  "traceId": "a1b2c3d4e5f6-20260716104300-024"
}
```

---

#### 3.3.5 删除决策表

**DELETE** `/api/v1/rule/decision-tables/{tableId}`

删除决策表。若被规则引用则需先解除引用。

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tableId": "dt-5e6f7a8b9c0d",
    "deleted": true
  },
  "traceId": "a1b2c3d4e5f6-20260716104400-025"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40902 | 决策表被规则引用，需先解除引用 |

---

#### 3.3.6 添加决策表列

**POST** `/api/v1/rule/decision-tables/{tableId}/columns`

向决策表添加输入列或输出列。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| columnType | string | 是 | 列类型：`INPUT`/`OUTPUT` |
| name | string | 是 | 列名 |
| expression | string | 是 | 表达式 |
| typeRef | string | 是 | 数据类型 |
| position | integer | 否 | 插入位置，默认追加到末尾 |

**请求示例：**

```json
{
  "columnType": "INPUT",
  "name": "下单时段",
  "expression": "order.createdAt",
  "typeRef": "DATE",
  "position": 3
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "columnId": "ic-003",
    "columnType": "INPUT",
    "name": "下单时段",
    "expression": "order.createdAt",
    "typeRef": "DATE",
    "position": 3
  },
  "traceId": "a1b2c3d4e5f6-20260716104500-026"
}
```

---

#### 3.3.7 更新决策表列

**PUT** `/api/v1/rule/decision-tables/{tableId}/columns/{columnId}`

更新列定义。修改列类型时会校验现有决策规则的兼容性。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 否 | 列名 |
| expression | string | 否 | 表达式 |
| typeRef | string | 否 | 数据类型 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "columnId": "ic-001",
    "name": "订单金额",
    "expression": "order.amount",
    "typeRef": "NUMBER",
    "compatibilityCheck": "PASSED"
  },
  "traceId": "a1b2c3d4e5f6-20260716104600-027"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 42202 | 修改列类型后现有决策规则不兼容 |

---

#### 3.3.8 删除决策表列

**DELETE** `/api/v1/rule/decision-tables/{tableId}/columns/{columnId}`

删除决策表列。会同步清除所有决策规则行中对应的输入/输出单元格。

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "columnId": "ic-003",
    "deleted": true,
    "affectedRuleRows": 6
  },
  "traceId": "a1b2c3d4e5f6-20260716104700-028"
}
```

---

#### 3.3.9 编辑决策规则

**PUT** `/api/v1/rule/decision-tables/{tableId}/rules`

整体替换决策表的所有决策规则行。每行包含输入单元格和输出单元格。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| rules | array | 是 | 决策规则行列表 |
| rules[].inputs | array | 是 | 输入单元格值数组，顺序与输入列一致；`"-"` 表示任意匹配 |
| rules[].outputs | array | 是 | 输出单元格值数组，顺序与输出列一致 |
| rules[].annotation | string | 否 | 行注释 |

**请求示例：**

```json
{
  "rules": [
    {
      "inputs": ["> 100000", "\"GOLD\""],
      "outputs": ["\"HIGH\"", "\"FREEZE\""],
      "annotation": "高额金牌客户冻结"
    },
    {
      "inputs": ["> 100000", "-"],
      "outputs": ["\"HIGH\"", "\"REVIEW\""],
      "annotation": "高额其他客户人工审核"
    },
    {
      "inputs": ["[50000, 100000]", "\"GOLD\""],
      "outputs": ["\"MEDIUM\"", "\"AUTO_APPROVE\""],
      "annotation": "中额金牌客户自动通过"
    },
    {
      "inputs": ["[50000, 100000]", "-"],
      "outputs": ["\"MEDIUM\"", "\"REVIEW\""],
      "annotation": "中额其他客户人工审核"
    },
    {
      "inputs": ["< 50000", "-"],
      "outputs": ["\"LOW\"", "\"AUTO_APPROVE\""],
      "annotation": "低额自动通过"
    }
  ]
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tableId": "dt-5e6f7a8b9c0d",
    "ruleCount": 5,
    "rules": [
      { "ruleRowId": "dr-001", "inputs": ["> 100000", "\"GOLD\""], "outputs": ["\"HIGH\"", "\"FREEZE\""], "annotation": "高额金牌客户冻结" },
      { "ruleRowId": "dr-002", "inputs": ["> 100000", "-"], "outputs": ["\"HIGH\"", "\"REVIEW\""], "annotation": "高额其他客户人工审核" },
      { "ruleRowId": "dr-003", "inputs": ["[50000, 100000]", "\"GOLD\""], "outputs": ["\"MEDIUM\"", "\"AUTO_APPROVE\""], "annotation": "中额金牌客户自动通过" },
      { "ruleRowId": "dr-004", "inputs": ["[50000, 100000]", "-"], "outputs": ["\"MEDIUM\"", "\"REVIEW\""], "annotation": "中额其他客户人工审核" },
      { "ruleRowId": "dr-005", "inputs": ["< 50000", "-"], "outputs": ["\"LOW\"", "\"AUTO_APPROVE\""], "annotation": "低额自动通过" }
    ],
    "updatedAt": "2026-07-16T14:30:00Z"
  },
  "traceId": "a1b2c3d4e5f6-20260716104800-029"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 42202 | 输入单元格数与输入列数不匹配；输出单元格值类型与列类型不匹配 |
| 42202 | UNIQUE 策略下存在重叠的输入规则行 |

---

#### 3.3.10 验证决策表

**POST** `/api/v1/rule/decision-tables/{tableId}/validate`

对决策表进行完整性校验，不修改任何数据。

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tableId": "dt-5e6f7a8b9c0d",
    "valid": true,
    "errors": [],
    "warnings": [
      {
        "type": "GAP_DETECTION",
        "message": "金额范围 [100000, 50000] 与客户等级 SILVER 组合未覆盖",
        "ruleRows": []
      }
    ],
    "coverage": {
      "inputCombinations": 12,
      "coveredCombinations": 5,
      "coverageRate": 0.417
    }
  },
  "traceId": "a1b2c3d4e5f6-20260716104900-030"
}
```

**校验项：**

| 校验类型 | 说明 |
|---------|------|
| SYNTAX | 单元格表达式语法校验 |
| TYPE_MATCH | 输入输出值与列类型匹配校验 |
| COMPLETENESS | 规则行完整性（无空输出） |
| OVERLAP | UNIQUE 策略下输入范围重叠检测 |
| GAP | 输入组合缺口检测 |
| COVERAGE | 输入组合覆盖率统计 |

---

### 3.4 规则执行 API

规则执行是规则引擎的核心能力，接收事实数据，执行规则匹配，返回动作列表。

#### 3.4.1 执行规则集

**POST** `/api/v1/rule/rule-sets/{ruleSetId}/execute`

输入事实数据，执行已发布版本的规则集，返回匹配的规则和动作列表。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| facts | object | 是 | 事实数据，键为 Ontology 实体路径，值为属性数据 |
| version | string | 否 | 指定执行版本，不填则使用当前发布版本 |
| executionContext | object | 否 | 执行上下文（调用方、业务 ID 等） |
| executionContext.source | string | 否 | 调用来源：`WFE`/`ACTION`/`AGENT`/`MANUAL` |
| executionContext.businessId | string | 否 | 业务关联 ID |
| debug | boolean | 否 | 是否返回调试信息（匹配过程），默认 `false` |

**请求示例：**

```json
{
  "facts": {
    "order": {
      "orderId": "ORD-20260716-001",
      "amount": 156000,
      "status": "PENDING",
      "customerLevel": "GOLD",
      "createdAt": "2026-07-16T13:00:00Z"
    }
  },
  "executionContext": {
    "source": "WFE",
    "businessId": "WF-20260716-0001"
  },
  "debug": true
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "ex-7a8b9c0d1e2f",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "version": "v3",
    "status": "COMPLETED",
    "matchedRules": [
      {
        "ruleId": "rl-1a2b3c4d5e6f",
        "name": "高额订单告警",
        "code": "high_amount_alert",
        "priority": 200,
        "actions": [
          {
            "actionId": "ac-003",
            "type": "ASSIGN",
            "target": "order.riskLevel",
            "result": { "value": "HIGH" }
          },
          {
            "actionId": "ac-004",
            "type": "ACTION_INVOKE",
            "target": "act_freeze_order",
            "result": { "status": "QUEUED", "actionExecutionId": "ae-001" }
          },
          {
            "actionId": "ac-005",
            "type": "EVENT",
            "target": "order.risk_triggered",
            "result": { "published": true }
          }
        ]
      }
    ],
    "outputs": {
      "order.riskLevel": "HIGH",
      "order.strategy": "FREEZE"
    },
    "statistics": {
      "totalRules": 13,
      "evaluatedRules": 13,
      "matchedRules": 1,
      "matchRate": 0.077,
      "executionTimeMs": 23
    },
    "debugInfo": {
      "evaluationTrace": [
        { "ruleId": "rl-1a2b3c4d5e6f", "matched": true, "conditionResults": [true, true] },
        { "ruleId": "rl-2b3c4d5e6f7a", "matched": false, "conditionResults": [false] }
      ]
    },
    "executedAt": "2026-07-16T15:00:00Z",
    "durationMs": 23
  },
  "traceId": "a1b2c3d4e5f6-20260716105000-031"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 规则集不存在 |
| 40902 | 规则集未发布任何版本 |
| 42201 | facts 数据格式不合规；引用的属性不存在 |
| 42901 | 执行频率超限 |
| 50002 | TECH-ONT 服务不可用（属性解析失败） |

---

#### 3.4.2 单条规则测试

**POST** `/api/v1/rule/rules/{ruleId}/test`

针对单条规则输入事实数据进行测试，不依赖规则集发布状态。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| facts | object | 是 | 事实数据 |
| debug | boolean | 否 | 返回条件评估详情，默认 `true` |

**请求示例：**

```json
{
  "facts": {
    "order": {
      "amount": 156000,
      "status": "PENDING",
      "customerLevel": "GOLD"
    }
  },
  "debug": true
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-1a2b3c4d5e6f",
    "matched": true,
    "conditionResults": [
      { "conditionId": "cd-003", "field": "order.amount", "operator": "GT", "value": 100000, "actualValue": 156000, "result": true },
      { "conditionId": "cd-004", "field": "order.customerLevel", "operator": "IN", "value": ["GOLD", "PLATINUM"], "actualValue": "GOLD", "result": true },
      { "conditionId": "cd-005", "field": "order.status", "operator": "EQ", "value": "PENDING", "actualValue": "PENDING", "result": true }
    ],
    "actions": [
      { "actionId": "ac-003", "type": "ASSIGN", "target": "order.riskLevel", "result": { "value": "HIGH" } },
      { "actionId": "ac-004", "type": "ACTION_INVOKE", "target": "act_freeze_order", "result": { "status": "SIMULATED" } }
    ],
    "executionTimeMs": 5
  },
  "traceId": "a1b2c3d4e5f6-20260716105100-032"
}
```

---

#### 3.4.3 批量执行

**POST** `/api/v1/rule/rule-sets/{ruleSetId}/batch-execute`

批量提交多组事实数据执行规则集。支持同步和异步两种模式（取决于规则集的 executionMode 配置）。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| batch | array | 是 | 批量事实数据列表，每项含 facts 和可选的 batchId |
| batch[].batchId | string | 否 | 单条批次 ID，用于结果关联 |
| batch[].facts | object | 是 | 事实数据 |
| version | string | 否 | 执行版本 |
| executionContext | object | 否 | 执行上下文 |

**请求示例：**

```json
{
  "batch": [
    { "batchId": "B001", "facts": { "order": { "amount": 156000, "status": "PENDING", "customerLevel": "GOLD" } } },
    { "batchId": "B002", "facts": { "order": { "amount": 30000, "status": "PENDING", "customerLevel": "SILVER" } } },
    { "batchId": "B003", "facts": { "order": { "amount": 80000, "status": "PENDING", "customerLevel": "GOLD" } } }
  ],
  "executionContext": { "source": "ACTION", "businessId": "BATCH-001" }
}
```

**响应示例（同步模式）：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "batchExecutionId": "bx-1a2b3c4d5e6f",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "version": "v3",
    "status": "COMPLETED",
    "results": [
      {
        "batchId": "B001",
        "matched": true,
        "matchedRuleCount": 1,
        "outputs": { "order.riskLevel": "HIGH", "order.strategy": "FREEZE" },
        "executionTimeMs": 20
      },
      {
        "batchId": "B002",
        "matched": true,
        "matchedRuleCount": 1,
        "outputs": { "order.riskLevel": "LOW", "order.strategy": "AUTO_APPROVE" },
        "executionTimeMs": 12
      },
      {
        "batchId": "B003",
        "matched": true,
        "matchedRuleCount": 1,
        "outputs": { "order.riskLevel": "MEDIUM", "order.strategy": "AUTO_APPROVE" },
        "executionTimeMs": 15
      }
    ],
    "statistics": {
      "totalBatch": 3,
      "successCount": 3,
      "failedCount": 0,
      "totalExecutionTimeMs": 47,
      "averageExecutionTimeMs": 15.67
    }
  },
  "traceId": "a1b2c3d4e5f6-20260716105200-033"
}
```

**响应示例（异步模式）：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "batchExecutionId": "bx-2b3c4d5e6f7a",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "version": "v3",
    "status": "PROCESSING",
    "totalBatch": 3,
    "message": "批量执行已提交，请通过 executionId 查询结果",
    "resultQueryUrl": "/api/v1/rule/executions/bx-2b3c4d5e6f7a"
  },
  "traceId": "a1b2c3d4e5f6-20260716105300-034"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40001 | batch 为空或超过 1000 条 |
| 42901 | 批量执行频率超限 |

---

#### 3.4.4 获取执行结果

**GET** `/api/v1/rule/executions/{executionId}`

获取规则执行结果详情。适用于异步执行结果的轮询查询。

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| executionId | string | 是 | 执行 ID（单次执行或批量执行 ID） |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "executionId": "ex-7a8b9c0d1e2f",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "version": "v3",
    "executionType": "SINGLE",
    "status": "COMPLETED",
    "source": "WFE",
    "businessId": "WF-20260716-0001",
    "facts": {
      "order": { "amount": 156000, "status": "PENDING", "customerLevel": "GOLD" }
    },
    "matchedRules": [
      { "ruleId": "rl-1a2b3c4d5e6f", "name": "高额订单告警", "priority": 200 }
    ],
    "outputs": { "order.riskLevel": "HIGH", "order.strategy": "FREEZE" },
    "statistics": {
      "totalRules": 13,
      "matchedRules": 1,
      "executionTimeMs": 23
    },
    "executedAt": "2026-07-16T15:00:00Z",
    "completedAt": "2026-07-16T15:00:00Z"
  },
  "traceId": "a1b2c3d4e5f6-20260716105400-035"
}
```

---

#### 3.4.5 执行历史列表

**GET** `/api/v1/rule/executions`

分页查询规则执行历史。

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ruleSetId | string | 否 | 规则集过滤 |
| ruleId | string | 否 | 规则过滤 |
| status | string | 否 | 执行状态：`COMPLETED`/`FAILED`/`PROCESSING` |
| source | string | 否 | 调用来源过滤 |
| startTime | string | 否 | 开始时间（ISO 8601） |
| endTime | string | 否 | 结束时间（ISO 8601） |
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "executionId": "ex-7a8b9c0d1e2f",
        "ruleSetId": "rs-9f3a2b1c8d7e4f60",
        "ruleSetName": "订单风控规则集",
        "version": "v3",
        "status": "COMPLETED",
        "source": "WFE",
        "matchedRuleCount": 1,
        "executionTimeMs": 23,
        "executedAt": "2026-07-16T15:00:00Z"
      },
      {
        "executionId": "ex-8b9c0d1e2f3a",
        "ruleSetId": "rs-9f3a2b1c8d7e4f60",
        "ruleSetName": "订单风控规则集",
        "version": "v3",
        "status": "FAILED",
        "source": "ACTION",
        "errorMessage": "Ontology attribute order.customLevel not found",
        "executionTimeMs": 5,
        "executedAt": "2026-07-16T14:50:00Z"
      }
    ],
    "total": 156,
    "page": 1,
    "pageSize": 20,
    "totalPages": 8
  },
  "traceId": "a1b2c3d4e5f6-20260716105500-036"
}
```

---

### 3.5 规则测试 API

规则测试提供独立于线上执行的沙箱环境，支持测试用例管理、模拟执行和版本对比。

#### 3.5.1 创建测试用例

**POST** `/api/v1/rule/test-cases`

创建一个规则测试用例，包含输入事实和预期结果。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 测试用例名称 |
| ruleSetId | string | 是 | 关联规则集 ID |
| version | string | 否 | 关联版本，不填则关联发布版本 |
| inputFacts | object | 是 | 输入事实数据 |
| expectedMatches | array | 否 | 预期匹配的规则 ID 列表 |
| expectedOutputs | object | 否 | 预期输出 |
| description | string | 否 | 测试用例描述 |

**请求示例：**

```json
{
  "name": "高额金牌订单测试",
  "ruleSetId": "rs-9f3a2b1c8d7e4f60",
  "version": "v3",
  "inputFacts": {
    "order": { "amount": 156000, "status": "PENDING", "customerLevel": "GOLD" }
  },
  "expectedMatches": ["rl-1a2b3c4d5e6f"],
  "expectedOutputs": { "order.riskLevel": "HIGH", "order.strategy": "FREEZE" },
  "description": "验证高额金牌客户订单触发冻结策略"
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "testCaseId": "tc-3c4d5e6f7a8b",
    "name": "高额金牌订单测试",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "version": "v3",
    "status": "CREATED",
    "lastRunStatus": null,
    "createdAt": "2026-07-16T16:00:00Z",
    "createdBy": "user-001"
  },
  "traceId": "a1b2c3d4e5f6-20260716105600-037"
}
```

---

#### 3.5.2 查询测试用例列表

**GET** `/api/v1/rule/test-cases`

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ruleSetId | string | 否 | 规则集过滤 |
| version | string | 否 | 版本过滤 |
| lastRunStatus | string | 否 | 最近运行状态：`PASSED`/`FAILED`/`ERROR` |
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "testCaseId": "tc-3c4d5e6f7a8b",
        "name": "高额金牌订单测试",
        "ruleSetId": "rs-9f3a2b1c8d7e4f60",
        "version": "v3",
        "lastRunStatus": "PASSED",
        "lastRunAt": "2026-07-16T16:10:00Z",
        "createdAt": "2026-07-16T16:00:00Z"
      }
    ],
    "total": 8,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4e5f6-20260716105700-038"
}
```

---

#### 3.5.3 模拟执行测试用例

**POST** `/api/v1/rule/test-cases/{testCaseId}/run`

执行指定的测试用例，对比实际结果与预期结果。

**请求参数（可选）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| version | string | 否 | 覆盖测试用例的默认版本，用于跨版本测试 |
| debug | boolean | 否 | 返回详细调试信息，默认 `true` |

**请求示例：**

```json
{
  "version": "v3",
  "debug": true
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "runId": "tr-4d5e6f7a8b9c",
    "testCaseId": "tc-3c4d5e6f7a8b",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "version": "v3",
    "status": "PASSED",
    "actualMatches": ["rl-1a2b3c4d5e6f"],
    "expectedMatches": ["rl-1a2b3c4d5e6f"],
    "matchComparison": { "passed": true, "missing": [], "unexpected": [] },
    "actualOutputs": { "order.riskLevel": "HIGH", "order.strategy": "FREEZE" },
    "expectedOutputs": { "order.riskLevel": "HIGH", "order.strategy": "FREEZE" },
    "outputComparison": { "passed": true, "differences": [] },
    "debugInfo": {
      "evaluationTrace": [
        { "ruleId": "rl-1a2b3c4d5e6f", "matched": true, "conditionResults": [true, true, true] }
      ]
    },
    "executionTimeMs": 18,
    "ranAt": "2026-07-16T16:10:00Z"
  },
  "traceId": "a1b2c3d4e5f6-20260716105800-039"
}
```

**status 取值：**

| status | 说明 |
|--------|------|
| PASSED | 匹配规则与输出均符合预期 |
| FAILED | 匹配规则或输出与预期不符 |
| ERROR | 执行过程中发生异常 |

---

#### 3.5.4 查看测试运行结果

**GET** `/api/v1/rule/test-runs/{runId}`

获取历史测试运行的详细结果。

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "runId": "tr-4d5e6f7a8b9c",
    "testCaseId": "tc-3c4d5e6f7a8b",
    "testCaseName": "高额金牌订单测试",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "version": "v3",
    "status": "PASSED",
    "inputFacts": {
      "order": { "amount": 156000, "status": "PENDING", "customerLevel": "GOLD" }
    },
    "actualMatches": [
      { "ruleId": "rl-1a2b3c4d5e6f", "name": "高额订单告警", "priority": 200 }
    ],
    "expectedMatches": ["rl-1a2b3c4d5e6f"],
    "actualOutputs": { "order.riskLevel": "HIGH", "order.strategy": "FREEZE" },
    "expectedOutputs": { "order.riskLevel": "HIGH", "order.strategy": "FREEZE" },
    "comparison": {
      "matchPassed": true,
      "outputPassed": true,
      "differences": []
    },
    "executionTimeMs": 18,
    "ranAt": "2026-07-16T16:10:00Z",
    "ranBy": "user-001"
  },
  "traceId": "a1b2c3d4e5f6-20260716105900-040"
}
```

---

#### 3.5.5 版本对比测试

**POST** `/api/v1/rule/test-cases/compare`

使用同一组测试用例在两个不同版本上执行，对比结果差异。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ruleSetId | string | 是 | 规则集 ID |
| baseVersion | string | 是 | 基准版本 |
| targetVersion | string | 是 | 目标版本 |
| testCaseIds | string[] | 否 | 指定测试用例 ID 列表，不填则使用该规则集全部用例 |

**请求示例：**

```json
{
  "ruleSetId": "rs-9f3a2b1c8d7e4f60",
  "baseVersion": "v2",
  "targetVersion": "v3",
  "testCaseIds": ["tc-3c4d5e6f7a8b", "tc-5e6f7a8b9c0d"]
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "comparisonId": "cmp-6f7a8b9c0d1e",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "baseVersion": "v2",
    "targetVersion": "v3",
    "summary": {
      "totalCases": 2,
      "consistent": 1,
      "changed": 1,
      "newlyPassed": 0,
      "newlyFailed": 0
    },
    "details": [
      {
        "testCaseId": "tc-3c4d5e6f7a8b",
        "testCaseName": "高额金牌订单测试",
        "baseResult": { "status": "PASSED", "matchedRules": ["rl-1a2b3c4d5e6f"], "outputs": { "order.riskLevel": "HIGH", "order.strategy": "FREEZE" } },
        "targetResult": { "status": "PASSED", "matchedRules": ["rl-1a2b3c4d5e6f"], "outputs": { "order.riskLevel": "HIGH", "order.strategy": "FREEZE" } },
        "diff": "NO_CHANGE"
      },
      {
        "testCaseId": "tc-5e6f7a8b9c0d",
        "testCaseName": "中额金牌订单测试",
        "baseResult": { "status": "PASSED", "matchedRules": ["rl-3c4d5e6f7a8b"], "outputs": { "order.riskLevel": "MEDIUM", "order.strategy": "AUTO_APPROVE" } },
        "targetResult": { "status": "PASSED", "matchedRules": ["rl-3c4d5e6f7a8b", "rl-7a8b9c0d1e2f"], "outputs": { "order.riskLevel": "MEDIUM", "order.strategy": "AUTO_APPROVE", "order.flag": "REVIEW_LATER" } },
        "diff": "MATCHED_RULES_CHANGED: 新增匹配 rl-7a8b9c0d1e2f; OUTPUTS_CHANGED: 新增 order.flag=REVIEW_LATER"
      }
    ],
    "ranAt": "2026-07-16T16:30:00Z"
  },
  "traceId": "a1b2c3d4e5f6-20260716110000-041"
}
```

---

#### 3.5.6 上传测试数据

**POST** `/api/v1/rule/test-data/upload`

上传 CSV/JSON 格式的批量测试数据文件，自动解析为测试用例。

**请求参数（multipart/form-data）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | file | 是 | 测试数据文件（.csv 或 .json） |
| ruleSetId | string | 是 | 关联规则集 ID |
| version | string | 否 | 关联版本 |
| namePrefix | string | 否 | 生成的测试用例名称前缀 |
| autoGenerateExpected | boolean | 否 | 是否自动以首次执行结果作为预期值，默认 `false` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "uploadId": "up-7a8b9c0d1e2f",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "fileName": "test_orders.csv",
    "totalRows": 50,
    "parsedCases": 48,
    "failedRows": 2,
    "parseErrors": [
      { "row": 12, "error": "amount 字段非数值类型" },
      { "row": 37, "error": "status 字段缺失" }
    ],
    "createdTestCaseIds": ["tc-7a8b9c0d1e2f", "tc-8b9c0d1e2f3a"],
    "uploadedAt": "2026-07-16T17:00:00Z"
  },
  "traceId": "a1b2c3d4e5f6-20260716110100-042"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40001 | 文件格式不支持；文件超过 10MB |
| 42201 | CSV 列与 Ontology 属性不匹配 |

---

### 3.6 规则监控 API

规则监控提供执行统计、匹配率分析、错误追踪等运维能力。

#### 3.6.1 执行统计

**GET** `/api/v1/rule/monitoring/statistics`

获取规则集或全局的执行统计数据。

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ruleSetId | string | 否 | 规则集过滤，不填则统计全部 |
| startTime | string | 是 | 开始时间（ISO 8601） |
| endTime | string | 是 | 结束时间（ISO 8601） |
| granularity | string | 否 | 时间粒度：`HOUR`/`DAY`/`WEEK`，默认 `DAY` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "timeRange": { "start": "2026-07-10T00:00:00Z", "end": "2026-07-16T23:59:59Z" },
    "granularity": "DAY",
    "summary": {
      "totalExecutions": 15420,
      "successCount": 15380,
      "failedCount": 40,
      "successRate": 0.9974,
      "averageExecutionTimeMs": 18.5,
      "p50ExecutionTimeMs": 15,
      "p95ExecutionTimeMs": 45,
      "p99ExecutionTimeMs": 120
    },
    "timeline": [
      { "timestamp": "2026-07-10", "executions": 2100, "success": 2095, "failed": 5, "avgTimeMs": 16.2 },
      { "timestamp": "2026-07-11", "executions": 2250, "success": 2248, "failed": 2, "avgTimeMs": 17.1 },
      { "timestamp": "2026-07-12", "executions": 1980, "success": 1975, "failed": 5, "avgTimeMs": 15.8 },
      { "timestamp": "2026-07-13", "executions": 2300, "success": 2298, "failed": 2, "avgTimeMs": 18.0 },
      { "timestamp": "2026-07-14", "executions": 2400, "success": 2395, "failed": 5, "avgTimeMs": 19.2 },
      { "timestamp": "2026-07-15", "executions": 2190, "success": 2185, "failed": 5, "avgTimeMs": 17.5 },
      { "timestamp": "2026-07-16", "executions": 2200, "success": 2184, "failed": 16, "avgTimeMs": 20.3 }
    ]
  },
  "traceId": "a1b2c3d4e5f6-20260716110200-043"
}
```

---

#### 3.6.2 匹配率分析

**GET** `/api/v1/rule/monitoring/match-rate`

分析规则集中每条规则的匹配率，识别热点规则和从未命中的规则。

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ruleSetId | string | 是 | 规则集 ID |
| version | string | 否 | 版本，默认发布版本 |
| startTime | string | 是 | 开始时间 |
| endTime | string | 是 | 结束时间 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "version": "v3",
    "timeRange": { "start": "2026-07-10T00:00:00Z", "end": "2026-07-16T23:59:59Z" },
    "totalExecutions": 15420,
    "ruleMatchStats": [
      {
        "ruleId": "rl-1a2b3c4d5e6f",
        "ruleName": "高额订单告警",
        "code": "high_amount_alert",
        "enabled": true,
        "matchCount": 156,
        "matchRate": 0.0101,
        "lastMatchedAt": "2026-07-16T13:45:00Z",
        "averageExecutionTimeMs": 22
      },
      {
        "ruleId": "rl-2b3c4d5e6f7a",
        "ruleName": "深夜订单审查",
        "code": "late_night_review",
        "enabled": true,
        "matchCount": 890,
        "matchRate": 0.0577,
        "lastMatchedAt": "2026-07-16T14:20:00Z",
        "averageExecutionTimeMs": 18
      },
      {
        "ruleId": "rl-9a8b7c6d5e4f",
        "ruleName": "低额自动通过",
        "code": "low_amount_auto_approve",
        "enabled": true,
        "matchCount": 12000,
        "matchRate": 0.7782,
        "lastMatchedAt": "2026-07-16T15:00:00Z",
        "averageExecutionTimeMs": 12
      },
      {
        "ruleId": "rl-0f1e2d3c4b5a",
        "ruleName": "海外订单标记",
        "code": "overseas_order_flag",
        "enabled": true,
        "matchCount": 0,
        "matchRate": 0,
        "lastMatchedAt": null,
        "averageExecutionTimeMs": 10,
        "warning": "NEVER_MATCHED"
      }
    ],
    "summary": {
      "totalRules": 13,
      "activeRules": 10,
      "neverMatchedRules": 3,
      "hotRules": 2,
      "hotRuleThreshold": 0.5
    }
  },
  "traceId": "a1b2c3d4e5f6-20260716110300-044"
}
```

---

#### 3.6.3 错误追踪

**GET** `/api/v1/rule/monitoring/errors`

查询规则执行错误记录，支持按错误类型和规则过滤。

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ruleSetId | string | 否 | 规则集过滤 |
| ruleId | string | 否 | 规则过滤 |
| errorType | string | 否 | 错误类型：`VALIDATION`/`RUNTIME`/`ONTOLOGY_REF`/`TIMEOUT` |
| startTime | string | 否 | 开始时间 |
| endTime | string | 否 | 结束时间 |
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "errorId": "err-8b9c0d1e2f3a",
        "executionId": "ex-8b9c0d1e2f3a",
        "ruleSetId": "rs-9f3a2b1c8d7e4f60",
        "ruleId": "rl-5e6f7a8b9c0d",
        "ruleName": "客户黑名单检查",
        "errorType": "ONTOLOGY_REF",
        "errorMessage": "Ontology attribute order.customLevel not found in namespace order@v1.2",
        "errorCode": "ONT_ATTR_NOT_FOUND",
        "stackTrace": "com.metaplatform.rule.exception.OntologyRefException...",
        "facts": { "order": { "amount": 80000 } },
        "traceId": "a1b2c3d4e5f6-20260716145000-099",
        "occurredAt": "2026-07-16T14:50:00Z"
      },
      {
        "errorId": "err-9c0d1e2f3a4b",
        "executionId": "ex-9c0d1e2f3a4b",
        "ruleSetId": "rs-9f3a2b1c8d7e4f60",
        "ruleId": null,
        "ruleName": null,
        "errorType": "TIMEOUT",
        "errorMessage": "Rule execution timed out after 5000ms",
        "errorCode": "EXEC_TIMEOUT",
        "stackTrace": null,
        "facts": { "order": { "amount": 156000, "status": "PENDING", "customerLevel": "GOLD" } },
        "traceId": "a1b2c3d4e5f6-20260716145500-100",
        "occurredAt": "2026-07-16T14:55:00Z"
      }
    ],
    "total": 40,
    "page": 1,
    "pageSize": 20,
    "totalPages": 2,
    "summary": {
      "totalErrors": 40,
      "byType": {
        "VALIDATION": 15,
        "RUNTIME": 10,
        "ONTOLOGY_REF": 12,
        "TIMEOUT": 3
      }
    }
  },
  "traceId": "a1b2c3d4e5f6-20260716110400-045"
}
```

---

#### 3.6.4 执行历史查询

**GET** `/api/v1/rule/monitoring/executions`

查询规则执行的详细历史记录，支持多维过滤。与 3.4.5 的区别在于本接口面向运维监控场景，提供更多聚合和统计字段。

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ruleSetId | string | 否 | 规则集过滤 |
| ruleId | string | 否 | 匹配规则过滤 |
| status | string | 否 | 执行状态 |
| source | string | 否 | 调用来源 |
| minDuration | integer | 否 | 最小耗时（毫秒） |
| maxDuration | integer | 否 | 最大耗时（毫秒） |
| matchedOnly | boolean | 否 | 仅返回有匹配的执行，默认 `false` |
| startTime | string | 否 | 开始时间 |
| endTime | string | 否 | 结束时间 |
| page | integer | 否 | 页码 |
| pageSize | integer | 否 | 每页条数 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "executionId": "ex-7a8b9c0d1e2f",
        "ruleSetId": "rs-9f3a2b1c8d7e4f60",
        "ruleSetName": "订单风控规则集",
        "version": "v3",
        "status": "COMPLETED",
        "source": "WFE",
        "businessId": "WF-20260716-0001",
        "matchedRuleCount": 1,
        "matchedRuleNames": ["高额订单告警"],
        "executionTimeMs": 23,
        "executedAt": "2026-07-16T15:00:00Z",
        "traceId": "a1b2c3d4e5f6-20260716105000-031"
      }
    ],
    "total": 15420,
    "page": 1,
    "pageSize": 20,
    "totalPages": 771,
    "summary": {
      "avgExecutionTimeMs": 18.5,
      "maxExecutionTimeMs": 120,
      "minExecutionTimeMs": 8,
      "matchedExecutionRate": 0.89
    }
  },
  "traceId": "a1b2c3d4e5f6-20260716110500-046"
}
```

---

#### 3.6.5 单规则统计

**GET** `/api/v1/rule/monitoring/rules/{ruleId}/stats`

获取单条规则的执行统计信息，包含匹配趋势和性能指标。

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| startTime | string | 是 | 开始时间 |
| endTime | string | 是 | 结束时间 |
| granularity | string | 否 | 时间粒度，默认 `DAY` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-1a2b3c4d5e6f",
    "ruleName": "高额订单告警",
    "code": "high_amount_alert",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "enabled": true,
    "timeRange": { "start": "2026-07-10T00:00:00Z", "end": "2026-07-16T23:59:59Z" },
    "summary": {
      "totalEvaluations": 15420,
      "matchCount": 156,
      "matchRate": 0.0101,
      "averageEvaluationTimeMs": 22,
      "p95EvaluationTimeMs": 35,
      "lastMatchedAt": "2026-07-16T13:45:00Z",
      "actionsExecuted": {
        "ASSIGN": 156,
        "ACTION_INVOKE": 156,
        "EVENT": 156
      }
    },
    "timeline": [
      { "timestamp": "2026-07-10", "evaluations": 2100, "matches": 20, "matchRate": 0.0095, "avgTimeMs": 20 },
      { "timestamp": "2026-07-11", "evaluations": 2250, "matches": 25, "matchRate": 0.0111, "avgTimeMs": 21 },
      { "timestamp": "2026-07-12", "evaluations": 1980, "matches": 18, "matchRate": 0.0091, "avgTimeMs": 19 },
      { "timestamp": "2026-07-13", "evaluations": 2300, "matches": 30, "matchRate": 0.0130, "avgTimeMs": 23 },
      { "timestamp": "2026-07-14", "evaluations": 2400, "matches": 22, "matchRate": 0.0092, "avgTimeMs": 22 },
      { "timestamp": "2026-07-15", "evaluations": 2190, "matches": 19, "matchRate": 0.0087, "avgTimeMs": 21 },
      { "timestamp": "2026-07-16", "evaluations": 2200, "matches": 22, "matchRate": 0.0100, "avgTimeMs": 24 }
    ]
  },
  "traceId": "a1b2c3d4e5f6-20260716110600-047"
}
```

---

## 4. 数据模型

### 4.1 表结构总览

| 表名 | 说明 |
|------|------|
| rule_sets | 规则集主表 |
| rule_set_versions | 规则集版本快照 |
| rules | 规则定义表 |
| rule_conditions | 规则条件表 |
| rule_actions | 规则动作表 |
| decision_tables | DMN 决策表主表 |
| decision_table_columns | 决策表列定义 |
| decision_table_rules | 决策表规则行 |
| execution_logs | 规则执行日志 |
| execution_details | 执行明细（匹配规则、条件评估） |
| test_cases | 测试用例 |
| test_runs | 测试运行记录 |
| test_run_results | 测试运行结果明细 |
| outbox_events | Outbox 事件表 |

### 4.2 rule_sets（规则集主表）

```sql
CREATE TABLE rule_sets (
    id              VARCHAR(32)    PRIMARY KEY,
    tenant_id       VARCHAR(32)    NOT NULL,
    name            VARCHAR(100)   NOT NULL,
    code            VARCHAR(50)    NOT NULL,
    description     TEXT,
    ontology_namespace  VARCHAR(100),
    ontology_version    VARCHAR(20),
    conflict_resolution VARCHAR(20)  NOT NULL DEFAULT 'PRIORITY',
    execution_mode      VARCHAR(10)  NOT NULL DEFAULT 'SYNC',
    status          VARCHAR(20)    NOT NULL DEFAULT 'DRAFT',
    current_version VARCHAR(20),
    published_version VARCHAR(20),
    tags            JSONB          DEFAULT '[]',
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(32)    NOT NULL,
    updated_by      VARCHAR(32),
    deleted_at      TIMESTAMPTZ,
    trace_id        VARCHAR(64)
);

CREATE UNIQUE INDEX uk_rule_sets_tenant_code ON rule_sets(tenant_id, code) WHERE deleted_at IS NULL;
CREATE INDEX idx_rule_sets_status ON rule_sets(tenant_id, status);
CREATE INDEX idx_rule_sets_tags ON rule_sets USING GIN(tags);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(32) | 规则集 ID，主键 |
| tenant_id | VARCHAR(32) | 租户 ID |
| name | VARCHAR(100) | 规则集名称 |
| code | VARCHAR(50) | 规则集编码，租户内唯一 |
| description | TEXT | 描述 |
| ontology_namespace | VARCHAR(100) | 关联 Ontology 命名空间 |
| ontology_version | VARCHAR(20) | Ontology 版本 |
| conflict_resolution | VARCHAR(20) | 冲突解决策略 |
| execution_mode | VARCHAR(10) | 执行模式 |
| status | VARCHAR(20) | 状态：DRAFT/PUBLISHED/ARCHIVED |
| current_version | VARCHAR(20) | 当前草稿版本 |
| published_version | VARCHAR(20) | 已发布版本 |
| tags | JSONB | 标签数组 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |
| created_by | VARCHAR(32) | 创建人 |
| deleted_at | TIMESTAMPTZ | 软删除时间 |
| trace_id | VARCHAR(64) | 创建请求的 traceId |

### 4.3 rule_set_versions（规则集版本表）

```sql
CREATE TABLE rule_set_versions (
    id              VARCHAR(32)    PRIMARY KEY,
    rule_set_id     VARCHAR(32)    NOT NULL REFERENCES rule_sets(id),
    version         VARCHAR(20)    NOT NULL,
    change_log      TEXT,
    snapshot        JSONB          NOT NULL,
    rule_count      INTEGER        NOT NULL DEFAULT 0,
    status          VARCHAR(20)    NOT NULL DEFAULT 'DRAFT',
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(32)    NOT NULL,
    trace_id        VARCHAR(64)
);

CREATE UNIQUE INDEX uk_versions_set_ver ON rule_set_versions(rule_set_id, version);
CREATE INDEX idx_versions_rule_set ON rule_set_versions(rule_set_id);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(32) | 版本 ID |
| rule_set_id | VARCHAR(32) | 规则集 ID（外键） |
| version | VARCHAR(20) | 版本标签 |
| change_log | TEXT | 版本变更说明 |
| snapshot | JSONB | 规则集快照（含全部规则、条件、动作） |
| rule_count | INTEGER | 规则数量 |
| status | VARCHAR(20) | 版本状态：DRAFT/PUBLISHED/ARCHIVED |

### 4.4 rules（规则定义表）

```sql
CREATE TABLE rules (
    id              VARCHAR(32)    PRIMARY KEY,
    rule_set_id     VARCHAR(32)    NOT NULL REFERENCES rule_sets(id),
    tenant_id       VARCHAR(32)    NOT NULL,
    name            VARCHAR(100)   NOT NULL,
    code            VARCHAR(50)    NOT NULL,
    description     TEXT,
    rule_type       VARCHAR(20)    NOT NULL,
    priority        INTEGER        NOT NULL DEFAULT 0,
    decision_table_id VARCHAR(32),
    expression      TEXT,
    enabled         BOOLEAN        NOT NULL DEFAULT TRUE,
    effective_from  TIMESTAMPTZ,
    effective_to    TIMESTAMPTZ,
    status          VARCHAR(20)    NOT NULL DEFAULT 'ACTIVE',
    match_count     BIGINT         NOT NULL DEFAULT 0,
    last_matched_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(32)    NOT NULL,
    deleted_at      TIMESTAMPTZ,
    trace_id        VARCHAR(64)
);

CREATE UNIQUE INDEX uk_rules_set_code ON rules(rule_set_id, code) WHERE deleted_at IS NULL;
CREATE INDEX idx_rules_rule_set ON rules(rule_set_id);
CREATE INDEX idx_rules_priority ON rules(rule_set_id, priority DESC);
CREATE INDEX idx_rules_enabled ON rules(rule_set_id, enabled) WHERE deleted_at IS NULL;
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(32) | 规则 ID |
| rule_set_id | VARCHAR(32) | 规则集 ID（外键） |
| rule_type | VARCHAR(20) | 规则类型：IF_THEN/DECISION_TABLE/EXPRESSION |
| priority | INTEGER | 优先级 |
| decision_table_id | VARCHAR(32) | 关联决策表 ID |
| expression | TEXT | 表达式（EXPRESSION 类型） |
| enabled | BOOLEAN | 是否启用 |
| effective_from | TIMESTAMPTZ | 生效开始时间 |
| effective_to | TIMESTAMPTZ | 生效结束时间 |
| status | VARCHAR(20) | 状态：ACTIVE/INACTIVE |
| match_count | BIGINT | 历史匹配次数（累计） |
| last_matched_at | TIMESTAMPTZ | 最后匹配时间 |

### 4.5 rule_conditions（规则条件表）

```sql
CREATE TABLE rule_conditions (
    id              VARCHAR(32)    PRIMARY KEY,
    rule_id         VARCHAR(32)    NOT NULL REFERENCES rules(id),
    field           VARCHAR(200)   NOT NULL,
    ontology_concept  VARCHAR(100),
    ontology_attribute VARCHAR(100),
    operator        VARCHAR(20)    NOT NULL,
    value           JSONB,
    value_type      VARCHAR(20),
    logic_op        VARCHAR(10)    NOT NULL DEFAULT 'AND',
    condition_group VARCHAR(32),
    sort_order      INTEGER        NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conditions_rule ON rule_conditions(rule_id);
CREATE INDEX idx_conditions_group ON rule_conditions(rule_id, condition_group);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(32) | 条件 ID |
| rule_id | VARCHAR(32) | 规则 ID（外键） |
| field | VARCHAR(200) | 条件字段（Ontology 属性路径） |
| ontology_concept | VARCHAR(100) | 引用的 Ontology 概念 |
| ontology_attribute | VARCHAR(100) | 引用的 Ontology 属性 |
| operator | VARCHAR(20) | 操作符 |
| value | JSONB | 比较值 |
| value_type | VARCHAR(20) | 值类型 |
| logic_op | VARCHAR(10) | 逻辑关系：AND/OR |
| condition_group | VARCHAR(32) | 条件分组 ID（括号逻辑） |
| sort_order | INTEGER | 排序序号 |

### 4.6 rule_actions（规则动作表）

```sql
CREATE TABLE rule_actions (
    id              VARCHAR(32)    PRIMARY KEY,
    rule_id         VARCHAR(32)    NOT NULL REFERENCES rules(id),
    action_type     VARCHAR(20)    NOT NULL,
    target          VARCHAR(200),
    params          JSONB,
    sort_order      INTEGER        NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_actions_rule ON rule_actions(rule_id);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(32) | 动作 ID |
| rule_id | VARCHAR(32) | 规则 ID（外键） |
| action_type | VARCHAR(20) | 动作类型：ASSIGN/EVENT/ACTION_INVOKE/REJECT/APPROVE/NOTIFY |
| target | VARCHAR(200) | 动作目标 |
| params | JSONB | 动作参数 |
| sort_order | INTEGER | 执行顺序 |

### 4.7 decision_tables（决策表主表）

```sql
CREATE TABLE decision_tables (
    id              VARCHAR(32)    PRIMARY KEY,
    tenant_id       VARCHAR(32)    NOT NULL,
    name            VARCHAR(100)   NOT NULL,
    code            VARCHAR(50)    NOT NULL,
    description     TEXT,
    rule_set_id     VARCHAR(32)    REFERENCES rule_sets(id),
    hit_policy      VARCHAR(20)    NOT NULL DEFAULT 'UNIQUE',
    aggregation     VARCHAR(20),
    status          VARCHAR(20)    NOT NULL DEFAULT 'DRAFT',
    rule_count      INTEGER        NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(32)    NOT NULL,
    deleted_at      TIMESTAMPTZ,
    trace_id        VARCHAR(64)
);

CREATE UNIQUE INDEX uk_decision_tables_tenant_code ON decision_tables(tenant_id, code) WHERE deleted_at IS NULL;
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(32) | 决策表 ID |
| hit_policy | VARCHAR(20) | 命中策略 |
| aggregation | VARCHAR(20) | 聚合函数（COLLECT 策略） |
| rule_count | INTEGER | 决策规则行数 |

### 4.8 decision_table_columns（决策表列定义）

```sql
CREATE TABLE decision_table_columns (
    id              VARCHAR(32)    PRIMARY KEY,
    table_id        VARCHAR(32)    NOT NULL REFERENCES decision_tables(id),
    column_type     VARCHAR(10)    NOT NULL,
    name            VARCHAR(100)   NOT NULL,
    expression      VARCHAR(500)   NOT NULL,
    type_ref        VARCHAR(20)    NOT NULL,
    position        INTEGER        NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_columns_table ON decision_table_columns(table_id);
CREATE INDEX idx_columns_table_type_pos ON decision_table_columns(table_id, column_type, position);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(32) | 列 ID |
| table_id | VARCHAR(32) | 决策表 ID（外键） |
| column_type | VARCHAR(10) | 列类型：INPUT/OUTPUT |
| name | VARCHAR(100) | 列名 |
| expression | VARCHAR(500) | 表达式 |
| type_ref | VARCHAR(20) | 数据类型 |
| position | INTEGER | 列位置 |

### 4.9 decision_table_rules（决策表规则行）

```sql
CREATE TABLE decision_table_rules (
    id              VARCHAR(32)    PRIMARY KEY,
    table_id        VARCHAR(32)    NOT NULL REFERENCES decision_tables(id),
    inputs          JSONB          NOT NULL,
    outputs         JSONB          NOT NULL,
    annotation      TEXT,
    sort_order      INTEGER        NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dt_rules_table ON decision_table_rules(table_id);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(32) | 规则行 ID |
| table_id | VARCHAR(32) | 决策表 ID（外键） |
| inputs | JSONB | 输入单元格数组 |
| outputs | JSONB | 输出单元格数组 |
| annotation | TEXT | 行注释 |
| sort_order | INTEGER | 行顺序 |

### 4.10 execution_logs（执行日志表）

```sql
CREATE TABLE execution_logs (
    id              VARCHAR(32)    PRIMARY KEY,
    tenant_id       VARCHAR(32)    NOT NULL,
    rule_set_id     VARCHAR(32)    NOT NULL,
    version         VARCHAR(20)    NOT NULL,
    rule_id         VARCHAR(32),
    execution_type  VARCHAR(10)    NOT NULL,
    status          VARCHAR(20)    NOT NULL,
    source          VARCHAR(20),
    business_id     VARCHAR(64),
    facts           JSONB,
    outputs         JSONB,
    matched_rules   JSONB,
    total_rules     INTEGER,
    matched_count   INTEGER,
    error_message   TEXT,
    error_code      VARCHAR(50),
    execution_time_ms INTEGER,
    executed_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    trace_id        VARCHAR(64)    NOT NULL
);

CREATE INDEX idx_exec_logs_rule_set ON execution_logs(rule_set_id, executed_at DESC);
CREATE INDEX idx_exec_logs_status ON execution_logs(status, executed_at DESC);
CREATE INDEX idx_exec_logs_trace ON execution_logs(trace_id);
CREATE INDEX idx_exec_logs_time ON execution_logs(executed_at DESC);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(32) | 执行 ID |
| execution_type | VARCHAR(10) | 执行类型：SINGLE/BATCH |
| status | VARCHAR(20) | 执行状态：COMPLETED/FAILED/PROCESSING |
| source | VARCHAR(20) | 调用来源 |
| facts | JSONB | 输入事实数据 |
| outputs | JSONB | 输出结果 |
| matched_rules | JSONB | 匹配的规则列表 |
| error_message | TEXT | 错误信息 |
| error_code | VARCHAR(50) | 错误码 |
| execution_time_ms | INTEGER | 执行耗时（毫秒） |
| trace_id | VARCHAR(64) | 全链路 traceId（必填） |

### 4.11 execution_details（执行明细表）

```sql
CREATE TABLE execution_details (
    id              VARCHAR(32)    PRIMARY KEY,
    execution_id    VARCHAR(32)    NOT NULL REFERENCES execution_logs(id),
    rule_id         VARCHAR(32)    NOT NULL,
    rule_name       VARCHAR(100),
    matched         BOOLEAN        NOT NULL,
    condition_results JSONB,
    action_results  JSONB,
    evaluation_time_ms INTEGER,
    evaluated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exec_details_execution ON execution_details(execution_id);
CREATE INDEX idx_exec_details_rule ON execution_details(rule_id, matched);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(32) | 明细 ID |
| execution_id | VARCHAR(32) | 执行日志 ID（外键） |
| rule_id | VARCHAR(32) | 规则 ID |
| matched | BOOLEAN | 是否匹配 |
| condition_results | JSONB | 各条件评估结果 |
| action_results | JSONB | 动作执行结果 |
| evaluation_time_ms | INTEGER | 评估耗时 |

### 4.12 test_cases（测试用例表）

```sql
CREATE TABLE test_cases (
    id              VARCHAR(32)    PRIMARY KEY,
    tenant_id       VARCHAR(32)    NOT NULL,
    name            VARCHAR(100)   NOT NULL,
    description     TEXT,
    rule_set_id     VARCHAR(32)    NOT NULL REFERENCES rule_sets(id),
    version         VARCHAR(20),
    input_facts     JSONB          NOT NULL,
    expected_matches JSONB         DEFAULT '[]',
    expected_outputs JSONB,
    last_run_status VARCHAR(20),
    last_run_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(32)    NOT NULL,
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_test_cases_rule_set ON test_cases(rule_set_id);
CREATE INDEX idx_test_cases_last_run ON test_cases(last_run_status);
```

### 4.13 test_runs（测试运行记录表）

```sql
CREATE TABLE test_runs (
    id              VARCHAR(32)    PRIMARY KEY,
    test_case_id    VARCHAR(32)    NOT NULL REFERENCES test_cases(id),
    rule_set_id     VARCHAR(32)    NOT NULL,
    version         VARCHAR(20)    NOT NULL,
    status          VARCHAR(20)    NOT NULL,
    actual_matches  JSONB,
    expected_matches JSONB,
    actual_outputs  JSONB,
    expected_outputs JSONB,
    comparison      JSONB,
    debug_info      JSONB,
    execution_time_ms INTEGER,
    ran_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    ran_by          VARCHAR(32)    NOT NULL,
    trace_id        VARCHAR(64)
);

CREATE INDEX idx_test_runs_case ON test_runs(test_case_id, ran_at DESC);
CREATE INDEX idx_test_runs_rule_set ON test_runs(rule_set_id, version);
```

### 4.14 outbox_events（Outbox 事件表）

```sql
CREATE TABLE outbox_events (
    id              BIGSERIAL      PRIMARY KEY,
    aggregate_id    VARCHAR(32)    NOT NULL,
    aggregate_type  VARCHAR(50)    NOT NULL,
    event_type      VARCHAR(100)   NOT NULL,
    payload         JSONB          NOT NULL,
    status          VARCHAR(20)    NOT NULL DEFAULT 'PENDING',
    retry_count     INTEGER        NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    published_at    TIMESTAMPTZ,
    trace_id        VARCHAR(64)    NOT NULL
);

CREATE INDEX idx_outbox_status ON outbox_events(status, created_at);
CREATE INDEX idx_outbox_aggregate ON outbox_events(aggregate_type, aggregate_id);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 自增主键 |
| aggregate_id | VARCHAR(32) | 聚合根 ID（规则集 ID / 执行 ID 等） |
| aggregate_type | VARCHAR(50) | 聚合类型：RULE_SET/RULE/EXECUTION |
| event_type | VARCHAR(100) | 事件类型 |
| payload | JSONB | 事件负载 |
| status | VARCHAR(20) | 状态：PENDING/PUBLISHED/FAILED |
| retry_count | INTEGER | 重试次数 |
| trace_id | VARCHAR(64) | traceId（必填，用于故障诊断） |

---

## 5. 事件定义

### 5.1 Kafka Topic 规划

| Topic | 说明 | 生产者 | 消费者 |
|-------|------|--------|--------|
| `metaplatform.rule.execution` | 规则执行事件 | TECH-RULE | TECH-WFE, TECH-ACTION, APP-DASHBOARD |
| `metaplatform.rule.change` | 规则变更事件 | TECH-RULE | TECH-WFE, TECH-ACTION, APP-APPHUB |
| `metaplatform.rule.dlq` | 死信队列 | TECH-RULE | TECH-OBS（告警） |

### 5.2 事件通用结构

所有事件消息体统一结构，Kafka 消息头固定包含 `X-Trace-Id`：

```json
{
  "eventId": "evt-1a2b3c4d5e6f",
  "eventType": "rule.execution.completed",
  "aggregateId": "ex-7a8b9c0d1e2f",
  "aggregateType": "EXECUTION",
  "tenantId": "tenant-001",
  "timestamp": "2026-07-16T15:00:00Z",
  "traceId": "a1b2c3d4e5f6-20260716105000-031",
  "payload": { }
}
```

### 5.3 规则执行事件

#### 5.3.1 rule.execution.completed

规则集执行成功完成时发布。

**Topic：** `metaplatform.rule.execution`

```json
{
  "eventId": "evt-1a2b3c4d5e6f",
  "eventType": "rule.execution.completed",
  "aggregateId": "ex-7a8b9c0d1e2f",
  "aggregateType": "EXECUTION",
  "tenantId": "tenant-001",
  "timestamp": "2026-07-16T15:00:00Z",
  "traceId": "a1b2c3d4e5f6-20260716105000-031",
  "payload": {
    "executionId": "ex-7a8b9c0d1e2f",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "version": "v3",
    "source": "WFE",
    "businessId": "WF-20260716-0001",
    "matchedRules": [
      {
        "ruleId": "rl-1a2b3c4d5e6f",
        "code": "high_amount_alert",
        "actions": [
          { "type": "ASSIGN", "target": "order.riskLevel", "value": "HIGH" },
          { "type": "EVENT", "target": "order.risk_triggered" },
          { "type": "ACTION_INVOKE", "target": "act_freeze_order" }
        ]
      }
    ],
    "outputs": { "order.riskLevel": "HIGH", "order.strategy": "FREEZE" },
    "executionTimeMs": 23
  }
}
```

#### 5.3.2 rule.execution.failed

规则集执行失败时发布。

**Topic：** `metaplatform.rule.execution`

```json
{
  "eventId": "evt-2b3c4d5e6f7a",
  "eventType": "rule.execution.failed",
  "aggregateId": "ex-8b9c0d1e2f3a",
  "aggregateType": "EXECUTION",
  "tenantId": "tenant-001",
  "timestamp": "2026-07-16T14:50:00Z",
  "traceId": "a1b2c3d4e5f6-20260716145000-099",
  "payload": {
    "executionId": "ex-8b9c0d1e2f3a",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "version": "v3",
    "source": "ACTION",
    "businessId": "ACT-001",
    "errorType": "ONTOLOGY_REF",
    "errorCode": "ONT_ATTR_NOT_FOUND",
    "errorMessage": "Ontology attribute order.customLevel not found",
    "ruleId": "rl-5e6f7a8b9c0d",
    "facts": { "order": { "amount": 80000 } }
  }
}
```

### 5.4 规则变更事件

#### 5.4.1 rule.set.published

规则集版本发布时发布。下游服务（WFE/ACTION）需刷新缓存的规则集编译结果。

**Topic：** `metaplatform.rule.change`

```json
{
  "eventId": "evt-3c4d5e6f7a8b",
  "eventType": "rule.set.published",
  "aggregateId": "rs-9f3a2b1c8d7e4f60",
  "aggregateType": "RULE_SET",
  "tenantId": "tenant-001",
  "timestamp": "2026-07-16T15:30:00Z",
  "traceId": "a1b2c3d4e5f6-20260716100800-009",
  "payload": {
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "ruleSetCode": "order_risk_control",
    "publishedVersion": "v3",
    "previousVersion": "v2",
    "ruleCount": 13,
    "validationPassed": true,
    "publishedBy": "user-001"
  }
}
```

#### 5.4.2 rule.set.version.created

规则集新版本创建时发布。

**Topic：** `metaplatform.rule.change`

```json
{
  "eventId": "evt-4d5e6f7a8b9c",
  "eventType": "rule.set.version.created",
  "aggregateId": "rs-9f3a2b1c8d7e4f60",
  "aggregateType": "RULE_SET",
  "tenantId": "tenant-001",
  "timestamp": "2026-07-16T15:00:00Z",
  "traceId": "a1b2c3d4e5f6-20260716100500-006",
  "payload": {
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "version": "v3",
    "changeLog": "新增高频订单限流规则，调整金额阈值",
    "ruleCount": 13,
    "createdBy": "user-001"
  }
}
```

#### 5.4.3 rule.set.rolledback

规则集版本回滚时发布。

**Topic：** `metaplatform.rule.change`

```json
{
  "eventId": "evt-5e6f7a8b9c0d",
  "eventType": "rule.set.rolledback",
  "aggregateId": "rs-9f3a2b1c8d7e4f60",
  "aggregateType": "RULE_SET",
  "tenantId": "tenant-001",
  "timestamp": "2026-07-16T16:00:00Z",
  "traceId": "a1b2c3d4e5f6-20260716100900-010",
  "payload": {
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "rolledBackFrom": "v3",
    "rolledBackTo": "v2",
    "newVersion": "v4",
    "publishedVersion": "v4"
  }
}
```

#### 5.4.4 rule.created

规则创建时发布。

**Topic：** `metaplatform.rule.change`

```json
{
  "eventId": "evt-6f7a8b9c0d1e",
  "eventType": "rule.created",
  "aggregateId": "rl-1a2b3c4d5e6f",
  "aggregateType": "RULE",
  "tenantId": "tenant-001",
  "timestamp": "2026-07-16T10:30:00Z",
  "traceId": "a1b2c3d4e5f6-20260716103000-011",
  "payload": {
    "ruleId": "rl-1a2b3c4d5e6f",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "name": "高额订单告警",
    "code": "high_amount_alert",
    "ruleType": "IF_THEN",
    "priority": 100,
    "enabled": true
  }
}
```

#### 5.4.5 rule.updated

规则更新时发布。

**Topic：** `metaplatform.rule.change`

```json
{
  "eventId": "evt-7a8b9c0d1e2f",
  "eventType": "rule.updated",
  "aggregateId": "rl-1a2b3c4d5e6f",
  "aggregateType": "RULE",
  "tenantId": "tenant-001",
  "timestamp": "2026-07-16T12:00:00Z",
  "traceId": "a1b2c3d4e5f6-20260716103500-016",
  "payload": {
    "ruleId": "rl-1a2b3c4d5e6f",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "name": "高额订单告警",
    "code": "high_amount_alert",
    "changes": ["conditions", "actions", "priority"],
    "priority": 200,
    "updatedBy": "user-001"
  }
}
```

#### 5.4.6 rule.deleted

规则删除时发布。

**Topic：** `metaplatform.rule.change`

```json
{
  "eventId": "evt-8b9c0d1e2f3a",
  "eventType": "rule.deleted",
  "aggregateId": "rl-1a2b3c4d5e6f",
  "aggregateType": "RULE",
  "tenantId": "tenant-001",
  "timestamp": "2026-07-16T17:00:00Z",
  "traceId": "a1b2c3d4e5f6-20260716103400-015",
  "payload": {
    "ruleId": "rl-1a2b3c4d5e6f",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "code": "high_amount_alert",
    "deletedBy": "user-001"
  }
}
```

#### 5.4.7 rule.enabled / rule.disabled

规则启用/禁用状态变更时发布。

**Topic：** `metaplatform.rule.change`

```json
{
  "eventId": "evt-9c0d1e2f3a4b",
  "eventType": "rule.disabled",
  "aggregateId": "rl-1a2b3c4d5e6f",
  "aggregateType": "RULE",
  "tenantId": "tenant-001",
  "timestamp": "2026-07-16T12:40:00Z",
  "traceId": "a1b2c3d4e5f6-20260716103900-020",
  "payload": {
    "ruleId": "rl-1a2b3c4d5e6f",
    "ruleSetId": "rs-9f3a2b1c8d7e4f60",
    "enabled": false,
    "reason": "业务调整，暂时停用",
    "updatedBy": "user-001"
  }
}
```

### 5.5 Outbox 与 DLQ 机制

#### 5.5.1 Outbox 发布流程

规则引擎所有 Kafka 消息发布遵循 Outbox 模式，确保业务数据与事件发布的最终一致性：

```
┌──────────────────────────────────────────────────────────┐
│  业务事务（同一 PostgreSQL 事务）                          │
│                                                          │
│  1. 写入业务数据（rule_sets / rules / execution_logs）    │
│  2. 写入 outbox_events 表（status=PENDING）               │
│  3. 事务提交                                               │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Outbox Publisher（独立线程，轮询）                         │
│                                                          │
│  4. 查询 status=PENDING 的 outbox_events                  │
│  5. 发布到 Kafka（消息头含 X-Trace-Id）                    │
│  6. 标记 status=PUBLISHED                                 │
│  7. 发布失败 → retry_count++，重试 3 次                    │
│  8. 3 次失败 → status=FAILED，写入 DLQ                     │
└──────────────────────────────────────────────────────────┘
```

#### 5.5.2 DLQ 死信队列

消费端处理失败的消息进入死信队列 `metaplatform.rule.dlq`：

```json
{
  "eventId": "evt-dlq-001",
  "originalTopic": "metaplatform.rule.execution",
  "originalEventType": "rule.execution.completed",
  "failureReason": "Consumer processing timeout",
  "retryCount": 3,
  "originalPayload": { },
  "traceId": "a1b2c3d4e5f6-20260716105000-031",
  "failedAt": "2026-07-16T15:01:00Z",
  "consumerId": "tech-wfe-consumer-01"
}
```

| DLQ 字段 | 说明 |
|---------|------|
| originalTopic | 原始 Topic |
| originalEventType | 原始事件类型 |
| failureReason | 失败原因 |
| retryCount | 已重试次数（固定 3） |
| traceId | 原始 traceId（必填，用于故障诊断） |
| consumerId | 消费者实例 ID |

#### 5.5.3 事件消费约定

| 约定 | 说明 |
|------|------|
| 幂等性 | 消费者必须实现幂等处理，基于 eventId 去重 |
| 重试策略 | 消费失败重试 3 次，间隔指数退避（1s/4s/16s） |
| DLQ 记录 | 3 次重试失败后进入 DLQ，记录必须包含 traceId |
| trace_id 传播 | 消费者处理时从消息头 `X-Trace-Id` 提取 traceId，写入本地日志与下游调用 |

---

## 6. 增量交付计划

### 6.1 交付阶段总览

| 阶段 | 名称 | 时间范围 | 交付内容 |
|------|------|---------|---------|
| Phase 1 | MVP 核心规则引擎 | 第 1-4 周 | 规则集管理、IF-THEN 规则定义、同步执行 |
| Phase 2 | DMN 决策表与测试 | 第 5-8 周 | DMN 决策表、规则测试、版本对比 |
| Phase 3 | 监控与异步执行 | 第 9-12 周 | 规则监控、批量执行、异步执行 |
| Phase 4 | 高级特性与优化 | 第 13-16 周 | 条件分组、性能优化、Outbox 完善 |

### 6.2 Phase 1：MVP 核心规则引擎（第 1-4 周）

**目标：** 打通规则集管理 → 规则定义 → 规则执行的核心链路。

| 周次 | 交付项 | 涉及 API |
|------|--------|---------|
| W1 | 数据模型建表（rule_sets, rules, rule_conditions, rule_actions, execution_logs） | 4.2-4.6, 4.10 |
| W1 | 规则集 CRUD | 3.1.1-3.1.5 |
| W2 | 规则定义 CRUD + 条件/动作配置 | 3.2.1-3.2.7 |
| W3 | Ontology 属性引用与校验（集成 TECH-ONT） | 3.2.1, 3.2.6 |
| W3 | 规则优先级、启用/禁用 | 3.2.8-3.2.10 |
| W4 | 规则集执行（同步模式） | 3.4.1, 3.4.4 |
| W4 | 规则执行事件（rule.execution.completed/failed） | 5.3.1-5.3.2 |

**验收标准：**
- 可创建规则集并定义 IF-THEN 规则
- 规则条件可引用 Ontology 属性
- 输入事实数据可执行规则并返回匹配结果
- 执行日志完整记录

### 6.3 Phase 2：DMN 决策表与测试（第 5-8 周）

**目标：** 支持 DMN 决策表与规则测试能力。

| 周次 | 交付项 | 涉及 API |
|------|--------|---------|
| W5 | 决策表数据模型与 CRUD | 4.7-4.9, 3.3.1-3.3.5 |
| W6 | 决策表列管理与规则行编辑 | 3.3.6-3.3.9 |
| W6 | 决策表验证（语法、类型、重叠、覆盖率） | 3.3.10 |
| W7 | 测试用例管理与模拟执行 | 3.5.1-3.5.4 |
| W8 | 测试数据上传、版本对比测试 | 3.5.5-3.5.6 |
| W8 | 规则集版本管理与发布/回滚 | 3.1.6-3.1.10 |

**验收标准：**
- 可创建 DMN 决策表并编辑决策规则
- 决策表验证能检测语法错误、类型不匹配、规则重叠
- 可创建测试用例并模拟执行，对比预期结果
- 支持版本对比测试

### 6.4 Phase 3：监控与异步执行（第 9-12 周）

**目标：** 完善监控运维能力与批量/异步执行。

| 周次 | 交付项 | 涉及 API |
|------|--------|---------|
| W9 | 执行统计与执行历史查询 | 3.6.1, 3.6.4 |
| W10 | 匹配率分析与单规则统计 | 3.6.2, 3.6.5 |
| W10 | 错误追踪 | 3.6.3 |
| W11 | 批量执行（同步） | 3.4.3 |
| W11 | 异步执行模式 | 3.4.1, 3.4.3, 3.4.4 |
| W12 | 规则变更事件（rule.set.published/version.created/rolledback） | 5.4.1-5.4.3 |
| W12 | Outbox 模式完整实现 | 5.5.1-5.5.2 |

**验收标准：**
- 监控面板可查看执行统计、匹配率、错误追踪
- 支持批量执行和异步执行
- 规则变更事件通过 Outbox 模式可靠发布
- DLQ 机制正常工作，DLQ 记录包含 traceId

### 6.5 Phase 4：高级特性与优化（第 13-16 周）

**目标：** 条件分组、性能优化与生产加固。

| 周次 | 交付项 | 涉及 API |
|------|--------|---------|
| W13 | 条件分组（括号逻辑） | 3.2.6 |
| W13 | 表达式规则类型（EXPRESSION） | 3.2.1 |
| W14 | 规则集编译缓存（Redis） | - |
| W14 | 执行性能优化（Drools KieSession 复用） | - |
| W15 | 规则变更事件（rule.created/updated/deleted/enabled/disabled） | 5.4.4-5.4.7 |
| W15 | 限流与熔断 | - |
| W16 | 全链路 trace_id 验证、生产加固、文档定稿 | - |

**验收标准：**
- 条件分组支持复杂括号逻辑
- 规则集编译结果缓存命中率 > 95%
- P95 执行耗时 < 50ms
- 全链路 trace_id 完整传播，Kafka 消息头包含 X-Trace-Id
- 限流策略生效，超限返回 42901

---

## 附录 A：API 速查表

| 方法 | 路径 | 说明 | 章节 |
|------|------|------|------|
| POST | /api/v1/rule/rule-sets | 创建规则集 | 3.1.1 |
| GET | /api/v1/rule/rule-sets | 查询规则集列表 | 3.1.2 |
| GET | /api/v1/rule/rule-sets/{ruleSetId} | 获取规则集详情 | 3.1.3 |
| PUT | /api/v1/rule/rule-sets/{ruleSetId} | 更新规则集 | 3.1.4 |
| DELETE | /api/v1/rule/rule-sets/{ruleSetId} | 删除规则集 | 3.1.5 |
| POST | /api/v1/rule/rule-sets/{ruleSetId}/versions | 创建规则集版本 | 3.1.6 |
| GET | /api/v1/rule/rule-sets/{ruleSetId}/versions | 查询版本列表 | 3.1.7 |
| GET | /api/v1/rule/rule-sets/{ruleSetId}/versions/{version} | 获取版本详情 | 3.1.8 |
| POST | /api/v1/rule/rule-sets/{ruleSetId}/publish | 发布规则集版本 | 3.1.9 |
| POST | /api/v1/rule/rule-sets/{ruleSetId}/rollback | 回滚规则集版本 | 3.1.10 |
| POST | /api/v1/rule/rule-sets/{ruleSetId}/rules | 创建规则 | 3.2.1 |
| GET | /api/v1/rule/rule-sets/{ruleSetId}/rules | 查询规则列表 | 3.2.2 |
| GET | /api/v1/rule/rules/{ruleId} | 获取规则详情 | 3.2.3 |
| PUT | /api/v1/rule/rules/{ruleId} | 更新规则 | 3.2.4 |
| DELETE | /api/v1/rule/rules/{ruleId} | 删除规则 | 3.2.5 |
| PUT | /api/v1/rule/rules/{ruleId}/conditions | 配置规则条件 | 3.2.6 |
| PUT | /api/v1/rule/rules/{ruleId}/actions | 配置规则动作 | 3.2.7 |
| PUT | /api/v1/rule/rules/{ruleId}/priority | 设置规则优先级 | 3.2.8 |
| POST | /api/v1/rule/rules/{ruleId}/enable | 启用规则 | 3.2.9 |
| POST | /api/v1/rule/rules/{ruleId}/disable | 禁用规则 | 3.2.10 |
| POST | /api/v1/rule/decision-tables | 创建决策表 | 3.3.1 |
| GET | /api/v1/rule/decision-tables | 查询决策表列表 | 3.3.2 |
| GET | /api/v1/rule/decision-tables/{tableId} | 获取决策表详情 | 3.3.3 |
| PUT | /api/v1/rule/decision-tables/{tableId} | 更新决策表 | 3.3.4 |
| DELETE | /api/v1/rule/decision-tables/{tableId} | 删除决策表 | 3.3.5 |
| POST | /api/v1/rule/decision-tables/{tableId}/columns | 添加决策表列 | 3.3.6 |
| PUT | /api/v1/rule/decision-tables/{tableId}/columns/{columnId} | 更新决策表列 | 3.3.7 |
| DELETE | /api/v1/rule/decision-tables/{tableId}/columns/{columnId} | 删除决策表列 | 3.3.8 |
| PUT | /api/v1/rule/decision-tables/{tableId}/rules | 编辑决策规则 | 3.3.9 |
| POST | /api/v1/rule/decision-tables/{tableId}/validate | 验证决策表 | 3.3.10 |
| POST | /api/v1/rule/rule-sets/{ruleSetId}/execute | 执行规则集 | 3.4.1 |
| POST | /api/v1/rule/rules/{ruleId}/test | 单条规则测试 | 3.4.2 |
| POST | /api/v1/rule/rule-sets/{ruleSetId}/batch-execute | 批量执行 | 3.4.3 |
| GET | /api/v1/rule/executions/{executionId} | 获取执行结果 | 3.4.4 |
| GET | /api/v1/rule/executions | 执行历史列表 | 3.4.5 |
| POST | /api/v1/rule/test-cases | 创建测试用例 | 3.5.1 |
| GET | /api/v1/rule/test-cases | 查询测试用例列表 | 3.5.2 |
| POST | /api/v1/rule/test-cases/{testCaseId}/run | 模拟执行测试用例 | 3.5.3 |
| GET | /api/v1/rule/test-runs/{runId} | 查看测试运行结果 | 3.5.4 |
| POST | /api/v1/rule/test-cases/compare | 版本对比测试 | 3.5.5 |
| POST | /api/v1/rule/test-data/upload | 上传测试数据 | 3.5.6 |
| GET | /api/v1/rule/monitoring/statistics | 执行统计 | 3.6.1 |
| GET | /api/v1/rule/monitoring/match-rate | 匹配率分析 | 3.6.2 |
| GET | /api/v1/rule/monitoring/errors | 错误追踪 | 3.6.3 |
| GET | /api/v1/rule/monitoring/executions | 执行历史查询 | 3.6.4 |
| GET | /api/v1/rule/monitoring/rules/{ruleId}/stats | 单规则统计 | 3.6.5 |

---

## 附录 B：枚举值参考

| 枚举 | 取值 | 说明 |
|------|------|------|
| RuleSet.status | DRAFT / PUBLISHED / ARCHIVED | 规则集状态 |
| RuleSet.conflictResolution | PRIORITY / FIRST_MATCH / ALL_MATCH | 冲突解决策略 |
| RuleSet.executionMode | SYNC / ASYNC | 执行模式 |
| Rule.ruleType | IF_THEN / DECISION_TABLE / EXPRESSION | 规则类型 |
| Rule.status | ACTIVE / INACTIVE | 规则状态 |
| RuleCondition.operator | EQ / NE / GT / GTE / LT / LTE / IN / NOT_IN / CONTAINS / BETWEEN / REGEX | 条件操作符 |
| RuleCondition.logicOp | AND / OR | 逻辑关系 |
| RuleAction.type | ASSIGN / EVENT / ACTION_INVOKE / REJECT / APPROVE / NOTIFY | 动作类型 |
| DecisionTable.hitPolicy | UNIQUE / FIRST / PRIORITY / ANY / COLLECT / RULE_ORDER / OUTPUT_ORDER | 命中策略 |
| ExecutionLog.status | COMPLETED / FAILED / PROCESSING | 执行状态 |
| ExecutionLog.source | WFE / ACTION / AGENT / MANUAL | 调用来源 |
| TestRun.status | PASSED / FAILED / ERROR | 测试运行状态 |
| ErrorType | VALIDATION / RUNTIME / ONTOLOGY_REF / TIMEOUT | 错误类型 |

---

> 文档结束 | TECH-RULE 规则引擎服务 API 规范 v1.0 | 2026-07-16