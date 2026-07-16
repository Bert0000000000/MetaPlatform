# SPEC - 身份认证与权限服务 API 规范（TECH-IAM）

> 文档版本：v1.0
> 文档日期：2026-07-16
> 适用模块：TECH-IAM（Identity & Access Management Service）
> 状态：定稿

---

## 1. 服务概述

### 1.1 定位

TECH-IAM 是 Mate Platform 的身份认证与权限服务，为平台所有 APP 应用与 TECH 技术服务提供统一的安全基座。作为平台无上游依赖的最底层基础设施服务，TECH-IAM 负责统一身份认证（含 SSO、多因素认证）、用户与组织架构管理、RBAC + ABAC 权限模型、数据权限（行级/字段级）、API Key 管理以及全量操作审计。所有需要鉴权的业务请求均需持有 TECH-IAM 签发的 JWT Token 或 API Key，所有模块的权限校验均可通过 TECH-IAM 的权限检查接口完成。

### 1.2 技术栈

| 层次 | 技术选型 | 说明 |
|---|---|---|
| 语言/框架 | Java 21 + Spring Boot 3.4 | 基础运行时 |
| 安全框架 | Spring Security 6 + spring-ai-oauth2 | 认证授权内核 |
| Token | JWT（jjwt） | Access Token + Refresh Token |
| 持久化 | PostgreSQL 17 | 用户、组织、角色、权限、审计持久化 |
| 缓存 | Redis 7.4 | Token 黑名单、权限缓存、登录限流、会话管理 |
| 消息队列 | Kafka 3.9 | 用户/角色/权限变更事件发布（Outbox 模式） |
| 可观测性 | OpenTelemetry 1.45 | trace_id 全链路传播 |
| 密码加密 | BCrypt + Argon2id | 密码哈希存储 |
| 多因素认证 | TOTP（RFC 6238） | 基于时间的一次性密码 |

### 1.3 上游依赖

| 上游服务 | 依赖关系 | 说明 |
|---|---|---|
| 无 | - | TECH-IAM 是平台最底层安全服务，无上游业务依赖 |

> 说明：TECH-IAM 仅依赖外部基础设施（PostgreSQL、Redis、Kafka），不依赖任何业务服务或 TECH 模块，确保认证授权链路的独立性与可靠性。

### 1.4 下游消费

| 下游服务/应用 | 消费方式 | 说明 |
|---|---|---|
| APP-DASHBOARD | REST API | 用户信息展示、审计日志查询 |
| APP-SUPERAI | REST API | 调用方身份解析、权限校验 |
| APP-DW | REST API | 数字员工身份、API Key 鉴权、权限检查 |
| APP-APPHUB | REST API | 应用内用户/角色/权限管理、表单审批人解析 |
| APP-ONTSTUDIO | REST API | 本体资源访问权限校验 |
| APP-ARCH | REST API | 架构资产访问权限校验 |
| APP-MCPHUB | REST API | MCP 资源/工具访问权限校验 |
| TECH-ONT | REST API | 本体数据权限校验 |
| TECH-WFE | REST API | 审批人解析、流程操作权限校验 |
| TECH-RULE | REST API | 规则资源访问权限校验 |
| TECH-ACTION | REST API | Action 执行权限校验 |
| TECH-RAG | REST API | 知识库访问权限校验 |
| TECH-AGENT | REST API | Agent 身份与权限校验 |
| TECH-LLMGW | REST API | 模型调用 API Key 鉴权 |
| TECH-MCP | REST API | MCP 工具调用权限校验 |
| TECH-A2A | REST API | A2A Agent 身份校验 |
| TECH-EA | REST API | 架构资产权限校验 |
| TECH-DATA | REST API | 数据集成任务权限校验 |
| TECH-GW | REST API | 网关统一鉴权委托 |
| TECH-MSG | REST API | 消息服务调用方鉴权 |
| TECH-OBS | REST API | 可观测性数据访问鉴权 |

### 1.5 核心能力清单

| 能力域 | 说明 |
|---|---|
| 用户管理 | 用户 CRUD、用户状态管理（启用/禁用/锁定）、密码管理（重置/修改）、头像上传 |
| 组织架构 | 部门 CRUD、部门层级树、岗位 CRUD、人员与部门/岗位关联管理 |
| 角色管理 | 角色 CRUD、角色权限分配、角色成员管理（用户-角色绑定） |
| 权限管理 | 权限定义 CRUD（RBAC + ABAC）、权限策略、数据权限（行级/字段级）、权限检查接口 |
| 认证服务 | 登录/登出、Token 管理（JWT Access + Refresh）、SSO 集成、多因素认证（MFA）、当前用户信息 |
| API Key 管理 | API Key 生成、列表查询、删除/吊销、权限绑定 |
| 操作审计 | 用户操作日志、登录日志、权限变更日志 |

---

## 2. 通用约定

### 2.1 路径前缀

所有 TECH-IAM API 路径统一前缀：`/api/v1/iam`

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
- Token 由 TECH-IAM 签发，包含 `userId`、`tenantId`、`roles`、`permissions`、`jti` 等声明
- Access Token 有效期：2 小时；Refresh Token 有效期：7 天
- 登录（`/auth/login`）、SSO 登录（`/auth/sso/login`）、MFA 发起（`/auth/mfa/initiate`）、MFA 验证（`/auth/mfa/verify`）接口无需认证
- 其余所有接口均需携带有效 Token
- 写操作需校验用户权限，读操作需校验数据可见范围

### 2.4 请求头约定

| 请求头 | 必填 | 说明 |
|---|---|---|
| Authorization | 是（除登录类接口） | Bearer Token |
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
| 40101 | 401 | 未认证 | Token 缺失 |
| 40102 | 401 | 认证失败 | 用户名或密码错误 |
| 40103 | 401 | Token 已过期 | Access Token 过期，需刷新 |
| 40104 | 401 | 多因素认证未完成 | 需要 MFA 二次验证 |
| 40105 | 401 | API Key 无效 | API Key 不存在或已被吊销 |
| 40301 | 403 | 无权限 | 用户无权操作该资源 |
| 40302 | 403 | 账户已被禁用 | 用户状态为 DISABLED |
| 40303 | 403 | 账户已被锁定 | 登录失败次数过多触发锁定 |
| 40401 | 404 | 资源不存在 | 用户/部门/角色/权限不存在 |
| 40901 | 409 | 状态冲突 | 操作与当前资源状态不兼容（如禁用用户再次禁用） |
| 40902 | 409 | 版本冲突 | 并发更新导致乐观锁冲突 |
| 40903 | 409 | 资源已存在 | 用户名/邮箱/手机号重复、角色编码重复 |
| 42201 | 422 | 业务规则校验失败 | 密码强度不足、部门存在子部门不可删除 |
| 42901 | 429 | 请求过于频繁 | 触发登录限流或接口限流 |
| 50001 | 500 | 服务内部错误 | 未捕获异常 |
| 50002 | 500 | 依赖服务不可用 | Redis/PostgreSQL 不可达 |
| 50003 | 500 | 安全策略异常 | Token 签名失败、加密异常 |

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
- 审计日志记录 traceId，支持全链路安全事件追溯

### 2.8 幂等控制

- 写操作支持幂等：客户端传递 `X-Request-Id` 请求头
- 服务端基于 `(tenantId, requestType, requestId)` 做幂等去重
- 幂等窗口：24 小时
- 同一 `X-Request-Id` 重复请求返回首次结果

### 2.9 密码安全策略

- 密码哈希算法：BCrypt（cost=12），可升级至 Argon2id
- 密码强度要求：长度 8-64 位，至少包含大写字母、小写字母、数字、特殊字符中的 3 类
- 密码禁止使用常见弱密码（如 `123456`、`password`）
- 密码修改时不可与最近 5 次历史密码相同
- 密码相关接口响应不返回任何密码哈希或明文

### 2.10 登录安全策略

- 登录失败次数限制：连续失败 5 次锁定账户 30 分钟
- 登录限流：同一 IP 每分钟最多 20 次登录请求
- 登录失败计数存储于 Redis，key 为 `login:fail:{tenantId}:{username}`
- 账户锁定状态存储于 Redis，key 为 `login:lock:{tenantId}:{username}`，TTL 30 分钟
- 支持图形验证码：失败 3 次后要求验证码

---

## 3. API 接口详情

### 3.1 用户管理 API

#### 3.1.1 创建用户

创建新用户，创建后用户默认状态为 ENABLED（启用），需通过重置密码或首次登录设置密码。

```
POST /api/v1/iam/users
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| username | string | 是 | 登录用户名，3-64 字符，唯一 |
| realName | string | 是 | 真实姓名 |
| email | string | 否 | 邮箱地址，唯一 |
| phone | string | 否 | 手机号，唯一 |
| employeeNo | string | 否 | 工号 |
| avatarUrl | string | 否 | 头像 URL |
| status | string | 否 | 初始状态，默认 ENABLED，可选 ENABLED/DISABLED |
| departmentIds | array | 否 | 关联部门 ID 列表 |
| positionId | string | 否 | 岗位 ID |
| roleIds | array | 否 | 初始角色 ID 列表 |
| requirePasswordReset | boolean | 否 | 是否要求首次登录重置密码，默认 true |
| description | string | 否 | 用户描述 |

**请求示例**

```json
{
  "username": "zhangsan",
  "realName": "张三",
  "email": "zhangsan@metaplatform.com",
  "phone": "13800138000",
  "employeeNo": "EMP-2026-0001",
  "departmentIds": ["dept-001"],
  "positionId": "pos-001",
  "roleIds": ["role-developer"],
  "requirePasswordReset": true,
  "description": "研发部后端工程师"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userId": "user-9a8b7c6d",
    "username": "zhangsan",
    "realName": "张三",
    "email": "zhangsan@metaplatform.com",
    "phone": "13800138000",
    "employeeNo": "EMP-2026-0001",
    "avatarUrl": null,
    "status": "ENABLED",
    "requirePasswordReset": true,
    "departments": [
      { "deptId": "dept-001", "deptName": "研发部", "path": "/总部/研发部" }
    ],
    "position": { "positionId": "pos-001", "positionName": "后端工程师" },
    "roles": [
      { "roleId": "role-developer", "roleName": "开发者", "roleCode": "DEVELOPER" }
    ],
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "createdBy": "user-admin"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | username 为空或长度不合法 |
| 40903 | username/email/phone 已存在 |
| 40401 | departmentIds/positionId/roleIds 引用的资源不存在 |
| 40301 | 当前用户无用户创建权限 |

---

#### 3.1.2 查询用户列表

分页查询当前租户下的用户列表，支持多条件筛选。

```
GET /api/v1/iam/users
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| size | int | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序字段，默认 -createdAt |
| keyword | string | 否 | 关键词，匹配 username/realName/email/phone/employeeNo |
| status | string | 否 | 用户状态：ENABLED/DISABLED/LOCKED |
| departmentId | string | 否 | 部门 ID，查询该部门及子部门下用户 |
| roleId | string | 否 | 角色 ID |
| positionId | string | 否 | 岗位 ID |
| createdAtStart | string | 否 | 创建时间起（ISO 8601） |
| createdAtEnd | string | 否 | 创建时间止（ISO 8601） |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "userId": "user-9a8b7c6d",
        "username": "zhangsan",
        "realName": "张三",
        "email": "zhangsan@metaplatform.com",
        "phone": "13800138000",
        "status": "ENABLED",
        "primaryDepartment": { "deptId": "dept-001", "deptName": "研发部" },
        "position": { "positionId": "pos-001", "positionName": "后端工程师" },
        "lastLoginAt": "2026-07-16T09:15:00.000+08:00",
        "createdAt": "2026-07-01T10:00:00.000+08:00"
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
| 40002 | status 枚举值不合法 |
| 40301 | 当前用户无用户列表查看权限（受数据权限约束仅可见本部门） |

---

#### 3.1.3 查询用户详情

查询单个用户的完整信息，包括关联部门、岗位、角色、权限摘要。

```
GET /api/v1/iam/users/{userId}
```

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| userId | string | 是 | 用户 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userId": "user-9a8b7c6d",
    "username": "zhangsan",
    "realName": "张三",
    "email": "zhangsan@metaplatform.com",
    "phone": "13800138000",
    "employeeNo": "EMP-2026-0001",
    "avatarUrl": "https://minio.metaplatform.com/avatars/user-9a8b7c6d.png",
    "status": "ENABLED",
    "requirePasswordReset": false,
    "lastLoginAt": "2026-07-16T09:15:00.000+08:00",
    "lastLoginIp": "192.168.1.100",
    "mfaEnabled": true,
    "departments": [
      { "deptId": "dept-001", "deptName": "研发部", "path": "/总部/研发部", "isPrimary": true }
    ],
    "position": { "positionId": "pos-001", "positionName": "后端工程师" },
    "roles": [
      { "roleId": "role-developer", "roleName": "开发者", "roleCode": "DEVELOPER", "roleType": "CUSTOM" }
    ],
    "permissionCount": 42,
    "apiKeyCount": 2,
    "createdAt": "2026-07-01T10:00:00.000+08:00",
    "updatedAt": "2026-07-16T09:15:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | userId 不存在 |
| 40301 | 无权查看该用户信息（跨部门数据权限） |

---

#### 3.1.4 更新用户信息

更新用户基本信息。不支持通过此接口修改密码与状态（使用专用接口）。

```
PUT /api/v1/iam/users/{userId}
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| realName | string | 否 | 真实姓名 |
| email | string | 否 | 邮箱地址 |
| phone | string | 否 | 手机号 |
| employeeNo | string | 否 | 工号 |
| avatarUrl | string | 否 | 头像 URL |
| description | string | 否 | 用户描述 |
| version | int | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "realName": "张三丰",
  "phone": "13800138001",
  "employeeNo": "EMP-2026-0001",
  "description": "研发部资深后端工程师",
  "version": 3
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userId": "user-9a8b7c6d",
    "realName": "张三丰",
    "phone": "13800138001",
    "version": 4,
    "updatedAt": "2026-07-16T10:35:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | userId 不存在 |
| 40902 | version 不匹配，乐观锁冲突 |
| 40903 | email/phone 已被其他用户占用 |
| 40301 | 无权修改该用户信息 |

---

#### 3.1.5 删除用户

软删除用户。用户被删除后不可登录，关联数据保留用于审计追溯。

```
DELETE /api/v1/iam/users/{userId}
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| transferUserId | string | 否 | 待删除用户拥有的资源（如流程实例）转移目标用户 ID |
| reason | string | 否 | 删除原因 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userId": "user-9a8b7c6d",
    "username": "zhangsan",
    "deletedAt": "2026-07-16T10:35:00.000+08:00",
    "deletedBy": "user-admin",
    "revokedTokens": 3,
    "revokedApiKeys": 2
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | userId 不存在 |
| 40901 | 用户存在未完成的流程实例且未指定 transferUserId |
| 40301 | 无删除用户权限 |
| 42201 | 不可删除超级管理员账户 |

---

#### 3.1.6 启用/禁用用户

修改用户启用状态。禁用用户后立即吊销其所有有效 Token 与 API Key。

```
PATCH /api/v1/iam/users/{userId}/status
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | string | 是 | 目标状态：ENABLED / DISABLED |
| reason | string | 否 | 状态变更原因 |

**请求示例**

```json
{
  "status": "DISABLED",
  "reason": "用户离职，账户停用"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userId": "user-9a8b7c6d",
    "status": "DISABLED",
    "revokedTokens": 3,
    "revokedApiKeys": 2,
    "updatedAt": "2026-07-16T10:35:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | userId 不存在 |
| 40901 | 用户已是目标状态（重复操作） |
| 42201 | 不可禁用超级管理员账户 |
| 40301 | 无状态变更权限 |

---

#### 3.1.7 重置密码

管理员重置指定用户密码。重置后用户需在下次登录时设置新密码。此操作不要求旧密码。

```
POST /api/v1/iam/users/{userId}/password/reset
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| newPassword | string | 否 | 新密码，不传则生成随机临时密码并返回 |
| requireChangeOnLogin | boolean | 否 | 是否要求用户下次登录修改密码，默认 true |
| notifyChannel | string | 否 | 临时密码通知渠道：EMAIL / SMS，不传则返回在响应中 |

**请求示例**

```json
{
  "requireChangeOnLogin": true,
  "notifyChannel": "EMAIL"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userId": "user-9a8b7c6d",
    "username": "zhangsan",
    "tempPassword": "Tp9$xK2mNq",
    "requireChangeOnLogin": true,
    "notifiedVia": "EMAIL",
    "revokedTokens": 3,
    "resetAt": "2026-07-16T10:35:00.000+08:00",
    "resetBy": "user-admin"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | userId 不存在 |
| 40302 | 用户已被禁用 |
| 42201 | 新密码不满足强度要求 |
| 40301 | 无重置密码权限 |

---

#### 3.1.8 修改密码

用户修改自身密码，需校验旧密码。支持当前登录用户与指定用户（需权限）两种模式。

```
POST /api/v1/iam/users/{userId}/password/change
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| oldPassword | string | 是 | 旧密码 |
| newPassword | string | 是 | 新密码，需满足强度策略 |
| mfaCode | string | 否 | MFA 验证码，若用户开启 MFA 则必填 |

**请求示例**

```json
{
  "oldPassword": "OldP@ssw0rd",
  "newPassword": "N3wP@ssw0rd!",
  "mfaCode": "123456"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userId": "user-9a8b7c6d",
    "changedAt": "2026-07-16T10:35:00.000+08:00",
    "revokedTokens": 2
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | userId 不存在 |
| 40102 | 旧密码错误 |
| 40104 | 需要 MFA 验证码但未提供或验证失败 |
| 42201 | 新密码不满足强度要求；与历史密码重复 |
| 40301 | 无权修改他人密码（非本人且无管理员权限） |

---

#### 3.1.9 上传用户头像

上传用户头像图片，存储至 MinIO 对象存储并返回访问 URL。

```
POST /api/v1/iam/users/{userId}/avatar
```

**请求参数（multipart/form-data）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| file | file | 是 | 头像图片文件，支持 PNG/JPG/JPEG/WEBP，最大 2MB |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userId": "user-9a8b7c6d",
    "avatarUrl": "https://minio.metaplatform.com/avatars/user-9a8b7c6d.png",
    "uploadedAt": "2026-07-16T10:35:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | userId 不存在 |
| 40001 | 文件为空 |
| 40002 | 文件格式不支持或超过大小限制 |
| 40301 | 无权修改他人头像 |

---

### 3.2 组织架构 API

#### 3.2.1 创建部门

创建新部门，需指定上级部门（根部门 parentId 为空）。

```
POST /api/v1/iam/departments
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| deptCode | string | 是 | 部门编码，租户内唯一 |
| deptName | string | 是 | 部门名称 |
| parentId | string | 否 | 上级部门 ID，为空则创建根部门 |
| sortOrder | int | 否 | 同级排序序号，默认 0 |
| leaderId | string | 否 | 部门负责人用户 ID |
| description | string | 否 | 部门描述 |

**请求示例**

```json
{
  "deptCode": "RD-BACKEND",
  "deptName": "后端研发组",
  "parentId": "dept-001",
  "sortOrder": 1,
  "leaderId": "user-9a8b7c6d",
  "description": "后端服务研发团队"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "deptId": "dept-002",
    "deptCode": "RD-BACKEND",
    "deptName": "后端研发组",
    "parentId": "dept-001",
    "parentName": "研发部",
    "path": "/总部/研发部/后端研发组",
    "level": 3,
    "sortOrder": 1,
    "leader": { "userId": "user-9a8b7c6d", "realName": "张三" },
    "memberCount": 0,
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "createdBy": "user-admin"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | deptName/deptCode 为空 |
| 40903 | deptCode 已存在 |
| 40401 | parentId 引用的部门不存在 |
| 42201 | 部门层级超过最大深度（默认 10 层） |
| 40301 | 无部门创建权限 |

---

#### 3.2.2 查询部门列表

分页查询部门列表。

```
GET /api/v1/iam/departments
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| size | int | 否 | 每页条数，默认 20 |
| keyword | string | 否 | 匹配 deptName/deptCode |
| parentId | string | 否 | 上级部门 ID，查询直接子部门 |
| includeChildren | boolean | 否 | 是否递归包含所有子部门，默认 false |
| leaderId | string | 否 | 部门负责人 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "deptId": "dept-002",
        "deptCode": "RD-BACKEND",
        "deptName": "后端研发组",
        "parentId": "dept-001",
        "level": 3,
        "sortOrder": 1,
        "leader": { "userId": "user-9a8b7c6d", "realName": "张三" },
        "memberCount": 12,
        "childCount": 0,
        "path": "/总部/研发部/后端研发组",
        "createdAt": "2026-07-16T10:30:00.000+08:00"
      }
    ],
    "total": 8,
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
| 40401 | parentId 不存在 |
| 40301 | 无部门查看权限 |

---

#### 3.2.3 查询部门详情

查询单个部门完整信息。

```
GET /api/v1/iam/departments/{deptId}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "deptId": "dept-002",
    "deptCode": "RD-BACKEND",
    "deptName": "后端研发组",
    "parentId": "dept-001",
    "parentName": "研发部",
    "path": "/总部/研发部/后端研发组",
    "level": 3,
    "sortOrder": 1,
    "leader": { "userId": "user-9a8b7c6d", "realName": "张三", "username": "zhangsan" },
    "memberCount": 12,
    "childCount": 0,
    "children": [],
    "description": "后端服务研发团队",
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "updatedAt": "2026-07-16T10:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | deptId 不存在 |

---

#### 3.2.4 更新部门

更新部门信息。

```
PUT /api/v1/iam/departments/{deptId}
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| deptName | string | 否 | 部门名称 |
| parentId | string | 否 | 上级部门 ID（变更后重新计算层级与路径） |
| sortOrder | int | 否 | 排序序号 |
| leaderId | string | 否 | 部门负责人 ID |
| description | string | 否 | 部门描述 |
| version | int | 是 | 乐观锁版本号 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "deptId": "dept-002",
    "deptName": "后端研发组",
    "parentId": "dept-001",
    "path": "/总部/研发部/后端研发组",
    "level": 3,
    "version": 2,
    "updatedAt": "2026-07-16T10:35:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | deptId 不存在 |
| 40902 | version 不匹配 |
| 40401 | parentId 不存在 |
| 42201 | 不能将部门移动到自身或其子部门下（造成循环引用） |
| 40301 | 无部门修改权限 |

---

#### 3.2.5 删除部门

删除部门。存在子部门或成员时不可直接删除。

```
DELETE /api/v1/iam/departments/{deptId}
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| cascade | boolean | 否 | 是否级联删除子部门，默认 false |
| transferDeptId | string | 否 | 成员迁移目标部门 ID |
| reason | string | 否 | 删除原因 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "deptId": "dept-002",
    "deletedAt": "2026-07-16T10:35:00.000+08:00",
    "deletedBy": "user-admin",
    "transferredMembers": 12,
    "transferDeptId": "dept-001"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | deptId 不存在 |
| 42201 | 存在子部门且 cascade=false；存在成员且未指定 transferDeptId |
| 42201 | 不可删除根部门 |
| 40301 | 无部门删除权限 |

---

#### 3.2.6 查询部门层级树

以树形结构返回部门层级，支持从指定节点开始。

```
GET /api/v1/iam/departments/tree
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| rootId | string | 否 | 根节点部门 ID，不传则返回整个租户的部门树 |
| maxDepth | int | 否 | 最大返回深度，默认全部 |
| includeMemberCount | boolean | 否 | 是否包含成员计数，默认 true |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "deptId": "dept-root",
    "deptCode": "HQ",
    "deptName": "总部",
    "level": 1,
    "memberCount": 156,
    "children": [
      {
        "deptId": "dept-001",
        "deptCode": "RD",
        "deptName": "研发部",
        "level": 2,
        "memberCount": 48,
        "children": [
          {
            "deptId": "dept-002",
            "deptCode": "RD-BACKEND",
            "deptName": "后端研发组",
            "level": 3,
            "memberCount": 12,
            "children": []
          }
        ]
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | rootId 不存在 |
| 40301 | 无部门树查看权限 |

---

#### 3.2.7 创建岗位

创建岗位。

```
POST /api/v1/iam/positions
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| positionCode | string | 是 | 岗位编码，租户内唯一 |
| positionName | string | 是 | 岗位名称 |
| departmentId | string | 否 | 所属部门 ID |
| level | int | 否 | 岗位职级 |
| description | string | 否 | 岗位描述 |

**请求示例**

```json
{
  "positionCode": "BACKEND-ENG",
  "positionName": "后端工程师",
  "departmentId": "dept-002",
  "level": 5,
  "description": "后端服务开发岗位"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "positionId": "pos-001",
    "positionCode": "BACKEND-ENG",
    "positionName": "后端工程师",
    "departmentId": "dept-002",
    "departmentName": "后端研发组",
    "level": 5,
    "memberCount": 0,
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "createdBy": "user-admin"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | positionName/positionCode 为空 |
| 40903 | positionCode 已存在 |
| 40401 | departmentId 不存在 |
| 40301 | 无岗位创建权限 |

---

#### 3.2.8 查询岗位列表

分页查询岗位列表。

```
GET /api/v1/iam/positions
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| size | int | 否 | 每页条数，默认 20 |
| keyword | string | 否 | 匹配 positionName/positionCode |
| departmentId | string | 否 | 所属部门 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "positionId": "pos-001",
        "positionCode": "BACKEND-ENG",
        "positionName": "后端工程师",
        "departmentId": "dept-002",
        "departmentName": "后端研发组",
        "level": 5,
        "memberCount": 8,
        "createdAt": "2026-07-16T10:30:00.000+08:00"
      }
    ],
    "total": 15,
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
| 40401 | departmentId 不存在 |
| 40301 | 无岗位查看权限 |

---

#### 3.2.9 更新岗位

更新岗位信息。

```
PUT /api/v1/iam/positions/{positionId}
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| positionName | string | 否 | 岗位名称 |
| departmentId | string | 否 | 所属部门 ID |
| level | int | 否 | 岗位职级 |
| description | string | 否 | 岗位描述 |
| version | int | 是 | 乐观锁版本号 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "positionId": "pos-001",
    "positionName": "高级后端工程师",
    "level": 6,
    "version": 2,
    "updatedAt": "2026-07-16T10:35:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | positionId 不存在 |
| 40902 | version 不匹配 |
| 40401 | departmentId 不存在 |
| 40301 | 无岗位修改权限 |

---

#### 3.2.10 删除岗位

删除岗位。存在在职人员时不可删除。

```
DELETE /api/v1/iam/positions/{positionId}
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| transferPositionId | string | 否 | 在职人员迁移目标岗位 ID |
| reason | string | 否 | 删除原因 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "positionId": "pos-001",
    "deletedAt": "2026-07-16T10:35:00.000+08:00",
    "deletedBy": "user-admin",
    "transferredMembers": 3,
    "transferPositionId": "pos-002"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | positionId 不存在 |
| 42201 | 存在在职人员且未指定 transferPositionId |
| 40301 | 无岗位删除权限 |

---

#### 3.2.11 人员部门关联管理

为用户分配部门与岗位。一个用户可关联多个部门，需指定主部门。

```
POST /api/v1/iam/users/{userId}/departments
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| assignments | array | 是 | 部门岗位分配列表 |
| assignments[].departmentId | string | 是 | 部门 ID |
| assignments[].positionId | string | 否 | 岗位 ID |
| assignments[].isPrimary | boolean | 否 | 是否主部门，默认 false |
| replaceMode | boolean | 否 | 是否替换模式（清除原有关联），默认 false（增量追加） |

**请求示例**

```json
{
  "assignments": [
    { "departmentId": "dept-002", "positionId": "pos-001", "isPrimary": true },
    { "departmentId": "dept-003", "positionId": "pos-003", "isPrimary": false }
  ],
  "replaceMode": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userId": "user-9a8b7c6d",
    "assignments": [
      { "departmentId": "dept-002", "departmentName": "后端研发组", "positionId": "pos-001", "positionName": "后端工程师", "isPrimary": true },
      { "departmentId": "dept-003", "departmentName": "架构组", "positionId": "pos-003", "positionName": "架构师", "isPrimary": false }
    ],
    "updatedAt": "2026-07-16T10:35:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | userId 或 departmentId/positionId 不存在 |
| 42201 | 未指定主部门；多个主部门；岗位不属于指定部门 |
| 40301 | 无人员关联管理权限 |

---

#### 3.2.12 查询部门成员

查询指定部门下的成员列表，可选择是否递归子部门。

```
GET /api/v1/iam/departments/{deptId}/members
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| size | int | 否 | 每页条数，默认 20 |
| recursive | boolean | 否 | 是否递归查询子部门成员，默认 false |
| positionId | string | 否 | 按岗位筛选 |
| isPrimary | boolean | 否 | 是否仅主部门成员，默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "userId": "user-9a8b7c6d",
        "username": "zhangsan",
        "realName": "张三",
        "positionId": "pos-001",
        "positionName": "后端工程师",
        "isPrimary": true,
        "status": "ENABLED"
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
| 40401 | deptId 不存在 |
| 40301 | 无权查看该部门成员 |

---

### 3.3 角色管理 API

#### 3.3.1 创建角色

创建角色，角色分为系统内置角色（SYSTEM，不可删除）与自定义角色（CUSTOM）。

```
POST /api/v1/iam/roles
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| roleCode | string | 是 | 角色编码，租户内唯一 |
| roleName | string | 是 | 角色名称 |
| roleType | string | 否 | 角色类型：SYSTEM/CUSTOM，默认 CUSTOM |
| description | string | 否 | 角色描述 |
| dataScope | string | 否 | 数据范围：ALL（全部）/ DEPT（本部门）/ DEPT_AND_SUB（本部门及子部门）/ SELF（仅本人）/ CUSTOM（自定义），默认 SELF |
| enabled | boolean | 否 | 是否启用，默认 true |

**请求示例**

```json
{
  "roleCode": "PROJECT_MANAGER",
  "roleName": "项目经理",
  "roleType": "CUSTOM",
  "description": "项目管理角色，可管理项目资源",
  "dataScope": "DEPT_AND_SUB",
  "enabled": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "roleId": "role-pm-001",
    "roleCode": "PROJECT_MANAGER",
    "roleName": "项目经理",
    "roleType": "CUSTOM",
    "description": "项目管理角色，可管理项目资源",
    "dataScope": "DEPT_AND_SUB",
    "enabled": true,
    "permissionCount": 0,
    "memberCount": 0,
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "createdBy": "user-admin"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | roleCode/roleName 为空 |
| 40903 | roleCode 已存在 |
| 40002 | roleType/dataScope 枚举值不合法 |
| 40301 | 无角色创建权限 |

---

#### 3.3.2 查询角色列表

分页查询角色列表。

```
GET /api/v1/iam/roles
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| size | int | 否 | 每页条数，默认 20 |
| keyword | string | 否 | 匹配 roleName/roleCode |
| roleType | string | 否 | 角色类型：SYSTEM/CUSTOM |
| enabled | boolean | 否 | 是否启用 |
| dataScope | string | 否 | 数据范围 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "roleId": "role-pm-001",
        "roleCode": "PROJECT_MANAGER",
        "roleName": "项目经理",
        "roleType": "CUSTOM",
        "dataScope": "DEPT_AND_SUB",
        "enabled": true,
        "permissionCount": 15,
        "memberCount": 8,
        "createdAt": "2026-07-16T10:30:00.000+08:00"
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
| 40002 | roleType/dataScope 枚举值不合法 |
| 40301 | 无角色列表查看权限 |

---

#### 3.3.3 查询角色详情

查询单个角色完整信息，含权限列表与成员统计。

```
GET /api/v1/iam/roles/{roleId}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "roleId": "role-pm-001",
    "roleCode": "PROJECT_MANAGER",
    "roleName": "项目经理",
    "roleType": "CUSTOM",
    "description": "项目管理角色，可管理项目资源",
    "dataScope": "DEPT_AND_SUB",
    "enabled": true,
    "permissionCount": 15,
    "memberCount": 8,
    "permissions": [
      {
        "permissionId": "perm-001",
        "permissionCode": "project:read",
        "permissionName": "查看项目",
        "resourceType": "PROJECT",
        "actions": ["READ"]
      }
    ],
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "updatedAt": "2026-07-16T10:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | roleId 不存在 |
| 40301 | 无权查看该角色 |

---

#### 3.3.4 更新角色

更新角色信息。系统内置角色的 roleCode 不可修改。

```
PUT /api/v1/iam/roles/{roleId}
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| roleName | string | 否 | 角色名称 |
| description | string | 否 | 角色描述 |
| dataScope | string | 否 | 数据范围 |
| enabled | boolean | 否 | 是否启用 |
| version | int | 是 | 乐观锁版本号 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "roleId": "role-pm-001",
    "roleName": "高级项目经理",
    "dataScope": "ALL",
    "enabled": true,
    "version": 2,
    "updatedAt": "2026-07-16T10:35:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | roleId 不存在 |
| 40902 | version 不匹配 |
| 42201 | 系统内置角色不可修改 roleCode |
| 40301 | 无角色修改权限 |

---

#### 3.3.5 删除角色

删除自定义角色。系统内置角色不可删除。存在成员时需先移除成员或指定迁移角色。

```
DELETE /api/v1/iam/roles/{roleId}
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| transferRoleId | string | 否 | 成员迁移目标角色 ID |
| reason | string | 否 | 删除原因 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "roleId": "role-pm-001",
    "deletedAt": "2026-07-16T10:35:00.000+08:00",
    "deletedBy": "user-admin",
    "transferredMembers": 8,
    "transferRoleId": "role-pm-002"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | roleId 不存在 |
| 42201 | 系统内置角色不可删除；存在成员且未指定 transferRoleId |
| 40301 | 无角色删除权限 |

---

#### 3.3.6 分配角色权限

为角色分配权限。支持替换模式与增量模式。

```
POST /api/v1/iam/roles/{roleId}/permissions
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| permissionIds | array | 是 | 权限 ID 列表 |
| replaceMode | boolean | 否 | 是否替换模式（清除原有权限），默认 false（增量追加） |

**请求示例**

```json
{
  "permissionIds": ["perm-001", "perm-002", "perm-003"],
  "replaceMode": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "roleId": "role-pm-001",
    "roleCode": "PROJECT_MANAGER",
    "permissionCount": 3,
    "assignedPermissions": [
      { "permissionId": "perm-001", "permissionCode": "project:read" },
      { "permissionId": "perm-002", "permissionCode": "project:write" },
      { "permissionId": "perm-003", "permissionCode": "project:delete" }
    ],
    "affectedUsers": 8,
    "updatedAt": "2026-07-16T10:35:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | roleId 不存在；permissionIds 引用的权限不存在 |
| 42201 | 系统内置角色不可修改权限 |
| 40301 | 无权限分配权限 |

---

#### 3.3.7 查询角色权限

查询角色已分配的权限列表。

```
GET /api/v1/iam/roles/{roleId}/permissions
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| resourceType | string | 否 | 按资源类型筛选 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "roleId": "role-pm-001",
    "roleCode": "PROJECT_MANAGER",
    "permissions": [
      {
        "permissionId": "perm-001",
        "permissionCode": "project:read",
        "permissionName": "查看项目",
        "resourceType": "PROJECT",
        "actions": ["READ"],
        "effect": "ALLOW"
      },
      {
        "permissionId": "perm-002",
        "permissionCode": "project:write",
        "permissionName": "编辑项目",
        "resourceType": "PROJECT",
        "actions": ["CREATE", "UPDATE"],
        "effect": "ALLOW"
      }
    ],
    "total": 15
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | roleId 不存在 |
| 40301 | 无权查看角色权限 |

---

#### 3.3.8 添加角色成员

为角色批量添加成员（用户）。

```
POST /api/v1/iam/roles/{roleId}/members
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| userIds | array | 是 | 用户 ID 列表 |

**请求示例**

```json
{
  "userIds": ["user-001", "user-002", "user-003"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "roleId": "role-pm-001",
    "roleCode": "PROJECT_MANAGER",
    "addedMembers": 3,
    "skippedMembers": 0,
    "memberCount": 11,
    "updatedAt": "2026-07-16T10:35:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | roleId 不存在；userIds 引用的用户不存在 |
| 42201 | 角色已禁用不可添加成员 |
| 40301 | 无角色成员管理权限 |

---

#### 3.3.9 查询角色成员

分页查询角色下的成员列表。

```
GET /api/v1/iam/roles/{roleId}/members
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| size | int | 否 | 每页条数，默认 20 |
| keyword | string | 否 | 匹配 username/realName |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "userId": "user-001",
        "username": "zhangsan",
        "realName": "张三",
        "primaryDepartment": { "deptId": "dept-001", "deptName": "研发部" },
        "status": "ENABLED",
        "assignedAt": "2026-07-16T10:35:00.000+08:00"
      }
    ],
    "total": 11,
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
| 40401 | roleId 不存在 |
| 40301 | 无权查看角色成员 |

---

#### 3.3.10 移除角色成员

从角色中移除指定成员。

```
DELETE /api/v1/iam/roles/{roleId}/members/{userId}
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reason | string | 否 | 移除原因 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "roleId": "role-pm-001",
    "userId": "user-001",
    "removedAt": "2026-07-16T10:35:00.000+08:00",
    "removedBy": "user-admin",
    "memberCount": 10
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | roleId/userId 不存在 |
| 40901 | 用户不在该角色中 |
| 42201 | 不可移除超级管理员的超级管理员角色 |
| 40301 | 无角色成员管理权限 |

---

### 3.4 权限管理 API

#### 3.4.1 创建权限定义

创建权限定义。权限定义描述对某类资源的操作能力，支持 RBAC（基于角色）与 ABAC（基于属性）两种模式。

```
POST /api/v1/iam/permissions
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| permissionCode | string | 是 | 权限编码，格式 `resource:action`，租户内唯一 |
| permissionName | string | 是 | 权限名称 |
| resourceType | string | 是 | 资源类型（如 USER/DEPARTMENT/ROLE/PROJECT/ONTOLOGY） |
| resourceId | string | 否 | 具体资源 ID，为空表示该类型所有资源 |
| actions | array | 是 | 操作列表：READ/CREATE/UPDATE/DELETE/EXPORT/IMPORT/ADMIN |
| effect | string | 否 | 效果：ALLOW/DENY，默认 ALLOW |
| description | string | 否 | 权限描述 |
| conditions | object | 否 | ABAC 条件表达式（JSON） |

**请求示例**

```json
{
  "permissionCode": "project:write",
  "permissionName": "编辑项目",
  "resourceType": "PROJECT",
  "actions": ["CREATE", "UPDATE"],
  "effect": "ALLOW",
  "description": "允许创建和编辑项目资源",
  "conditions": {
    "expression": "resource.ownerId == subject.userId",
    "description": "仅允许编辑自己创建的项目"
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "permissionId": "perm-002",
    "permissionCode": "project:write",
    "permissionName": "编辑项目",
    "resourceType": "PROJECT",
    "resourceId": null,
    "actions": ["CREATE", "UPDATE"],
    "effect": "ALLOW",
    "description": "允许创建和编辑项目资源",
    "conditions": {
      "expression": "resource.ownerId == subject.userId",
      "description": "仅允许编辑自己创建的项目"
    },
    "roleCount": 0,
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "createdBy": "user-admin"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | permissionCode/permissionName/resourceType/actions 为空 |
| 40903 | permissionCode 已存在 |
| 40002 | actions/effect 枚举值不合法 |
| 42201 | ABAC 条件表达式语法错误 |
| 40301 | 无权限定义创建权限 |

---

#### 3.4.2 查询权限定义列表

分页查询权限定义列表。

```
GET /api/v1/iam/permissions
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| size | int | 否 | 每页条数，默认 20 |
| keyword | string | 否 | 匹配 permissionName/permissionCode |
| resourceType | string | 否 | 资源类型 |
| effect | string | 否 | 效果：ALLOW/DENY |
| action | string | 否 | 操作类型 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "permissionId": "perm-002",
        "permissionCode": "project:write",
        "permissionName": "编辑项目",
        "resourceType": "PROJECT",
        "actions": ["CREATE", "UPDATE"],
        "effect": "ALLOW",
        "roleCount": 3,
        "createdAt": "2026-07-16T10:30:00.000+08:00"
      }
    ],
    "total": 48,
    "page": 1,
    "size": 20,
    "totalPages": 3
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | effect/action 枚举值不合法 |
| 40301 | 无权限定义查看权限 |

---

#### 3.4.3 查询权限定义详情

查询单个权限定义完整信息。

```
GET /api/v1/iam/permissions/{permissionId}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "permissionId": "perm-002",
    "permissionCode": "project:write",
    "permissionName": "编辑项目",
    "resourceType": "PROJECT",
    "resourceId": null,
    "actions": ["CREATE", "UPDATE"],
    "effect": "ALLOW",
    "description": "允许创建和编辑项目资源",
    "conditions": {
      "expression": "resource.ownerId == subject.userId",
      "description": "仅允许编辑自己创建的项目"
    },
    "roles": [
      { "roleId": "role-pm-001", "roleCode": "PROJECT_MANAGER", "roleName": "项目经理" }
    ],
    "roleCount": 3,
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "updatedAt": "2026-07-16T10:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | permissionId 不存在 |
| 40301 | 无权查看该权限定义 |

---

#### 3.4.4 更新权限定义

更新权限定义信息。

```
PUT /api/v1/iam/permissions/{permissionId}
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| permissionName | string | 否 | 权限名称 |
| actions | array | 否 | 操作列表 |
| effect | string | 否 | 效果 |
| description | string | 否 | 权限描述 |
| conditions | object | 否 | ABAC 条件表达式 |
| version | int | 是 | 乐观锁版本号 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "permissionId": "perm-002",
    "permissionName": "编辑项目",
    "actions": ["CREATE", "UPDATE", "DELETE"],
    "version": 2,
    "updatedAt": "2026-07-16T10:35:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | permissionId 不存在 |
| 40902 | version 不匹配 |
| 40002 | actions/effect 枚举值不合法 |
| 42201 | ABAC 条件表达式语法错误 |
| 40301 | 无权限定义修改权限 |

---

#### 3.4.5 删除权限定义

删除权限定义。已被角色引用的权限需先解除关联。

```
DELETE /api/v1/iam/permissions/{permissionId}
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| force | boolean | 否 | 是否强制删除（自动解除角色关联），默认 false |
| reason | string | 否 | 删除原因 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "permissionId": "perm-002",
    "permissionCode": "project:write",
    "deletedAt": "2026-07-16T10:35:00.000+08:00",
    "deletedBy": "user-admin",
    "unlinkedRoles": 3
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | permissionId 不存在 |
| 42201 | 已被角色引用且 force=false |
| 40301 | 无权限定义删除权限 |

---

#### 3.4.6 创建权限策略

创建权限策略，策略为一组权限定义的集合，可绑定到角色或用户，用于实现更灵活的 ABAC 授权。

```
POST /api/v1/iam/policies
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| policyCode | string | 是 | 策略编码，租户内唯一 |
| policyName | string | 是 | 策略名称 |
| description | string | 否 | 策略描述 |
| statements | array | 是 | 策略声明列表 |
| statements[].effect | string | 是 | 效果：ALLOW/DENY |
| statements[].actions | array | 是 | 操作列表 |
| statements[].resource | string | 是 | 资源匹配表达式（如 `project:*`） |
| statements[].condition | object | 否 | ABAC 条件 |
| enabled | boolean | 否 | 是否启用，默认 true |

**请求示例**

```json
{
  "policyCode": "PROJECT_FULL_ACCESS",
  "policyName": "项目完全访问策略",
  "description": "允许对项目资源进行全部操作",
  "statements": [
    {
      "effect": "ALLOW",
      "actions": ["READ", "CREATE", "UPDATE", "DELETE"],
      "resource": "project:*",
      "condition": {
        "expression": "subject.departmentId == resource.departmentId",
        "description": "仅允许操作本部门项目"
      }
    },
    {
      "effect": "DENY",
      "actions": ["DELETE"],
      "resource": "project:archived:*",
      "condition": null
    }
  ],
  "enabled": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "policyId": "policy-001",
    "policyCode": "PROJECT_FULL_ACCESS",
    "policyName": "项目完全访问策略",
    "statementCount": 2,
    "enabled": true,
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "createdBy": "user-admin"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | policyCode/policyName/statements 为空 |
| 40903 | policyCode 已存在 |
| 40002 | effect 枚举值不合法 |
| 42201 | resource 表达式语法错误；condition 条件表达式语法错误 |
| 40301 | 无策略创建权限 |

---

#### 3.4.7 查询权限策略列表

分页查询权限策略列表。

```
GET /api/v1/iam/policies
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| size | int | 否 | 每页条数，默认 20 |
| keyword | string | 否 | 匹配 policyName/policyCode |
| enabled | boolean | 否 | 是否启用 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "policyId": "policy-001",
        "policyCode": "PROJECT_FULL_ACCESS",
        "policyName": "项目完全访问策略",
        "statementCount": 2,
        "enabled": true,
        "boundRoleCount": 3,
        "createdAt": "2026-07-16T10:30:00.000+08:00"
      }
    ],
    "total": 6,
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
| 40301 | 无策略查看权限 |

---

#### 3.4.8 数据权限配置

配置数据权限，控制行级（数据范围）与字段级（可见字段）访问。

```
POST /api/v1/iam/data-permissions
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| roleCode | string | 是 | 关联角色编码 |
| resourceType | string | 是 | 资源类型 |
| rowScope | string | 是 | 行级范围：ALL/DEPT/DEPT_AND_SUB/SELF/CUSTOM |
| customDeptIds | array | 否 | rowScope=CUSTOM 时指定的部门 ID 列表 |
| fieldScope | string | 否 | 字段级范围：ALL/CUSTOM，默认 ALL |
| visibleFields | array | 否 | fieldScope=CUSTOM 时可见字段列表 |
| invisibleFields | array | 否 | fieldScope=CUSTOM 时隐藏字段列表 |

**请求示例**

```json
{
  "roleCode": "PROJECT_MANAGER",
  "resourceType": "PROJECT",
  "rowScope": "CUSTOM",
  "customDeptIds": ["dept-001", "dept-002"],
  "fieldScope": "CUSTOM",
  "visibleFields": ["id", "name", "status", "owner", "amount"],
  "invisibleFields": ["cost", "profit"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "dataPermissionId": "dp-001",
    "roleCode": "PROJECT_MANAGER",
    "resourceType": "PROJECT",
    "rowScope": "CUSTOM",
    "customDeptIds": ["dept-001", "dept-002"],
    "fieldScope": "CUSTOM",
    "visibleFields": ["id", "name", "status", "owner", "amount"],
    "invisibleFields": ["cost", "profit"],
    "affectedUsers": 8,
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "createdBy": "user-admin"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | roleCode/resourceType/rowScope 为空 |
| 40401 | roleCode 引用的角色不存在 |
| 40002 | rowScope/fieldScope 枚举值不合法 |
| 42201 | rowScope=CUSTOM 但未指定 customDeptIds；fieldScope=CUSTOM 但未指定 visibleFields |
| 40301 | 无数据权限配置权限 |

---

#### 3.4.9 查询数据权限配置

查询数据权限配置列表或详情。

```
GET /api/v1/iam/data-permissions
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| roleCode | string | 否 | 按角色编码筛选 |
| resourceType | string | 否 | 按资源类型筛选 |
| rowScope | string | 否 | 按行级范围筛选 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "dataPermissionId": "dp-001",
        "roleCode": "PROJECT_MANAGER",
        "roleName": "项目经理",
        "resourceType": "PROJECT",
        "rowScope": "CUSTOM",
        "customDeptIds": ["dept-001", "dept-002"],
        "fieldScope": "CUSTOM",
        "visibleFields": ["id", "name", "status", "owner", "amount"],
        "invisibleFields": ["cost", "profit"],
        "affectedUsers": 8,
        "createdAt": "2026-07-16T10:30:00.000+08:00"
      }
    ],
    "total": 4,
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
| 40401 | roleCode 不存在 |
| 40301 | 无数据权限查看权限 |

---

#### 3.4.10 权限检查

统一权限检查接口，供所有 TECH/APP 模块调用，判断用户是否对指定资源拥有指定操作权限。

```
POST /api/v1/iam/permissions/check
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| userId | string | 是 | 被检查用户 ID |
| resourceType | string | 是 | 资源类型 |
| resourceId | string | 否 | 具体资源 ID，为空表示该类型全部资源 |
| action | string | 是 | 操作：READ/CREATE/UPDATE/DELETE/EXPORT/IMPORT/ADMIN |
| context | object | 否 | ABAC 上下文（资源属性、环境属性） |

**请求示例**

```json
{
  "userId": "user-001",
  "resourceType": "PROJECT",
  "resourceId": "proj-2026-001",
  "action": "UPDATE",
  "context": {
    "resource": {
      "ownerId": "user-001",
      "departmentId": "dept-001",
      "status": "ACTIVE"
    },
    "environment": {
      "ip": "192.168.1.100",
      "time": "2026-07-16T10:30:00.000+08:00"
    }
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "allowed": true,
    "userId": "user-001",
    "resourceType": "PROJECT",
    "resourceId": "proj-2026-001",
    "action": "UPDATE",
    "matchedPermissions": [
      { "permissionId": "perm-002", "permissionCode": "project:write", "effect": "ALLOW" }
    ],
    "deniedReason": null,
    "dataScope": "DEPT_AND_SUB",
    "checkedAt": "2026-07-16T10:35:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**响应示例（拒绝）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "allowed": false,
    "userId": "user-001",
    "resourceType": "PROJECT",
    "resourceId": "proj-2026-001",
    "action": "DELETE",
    "matchedPermissions": [],
    "deniedReason": "用户无 PROJECT:DELETE 权限，且命中 DENY 策略（archived 项目不可删除）",
    "dataScope": null,
    "checkedAt": "2026-07-16T10:35:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | userId/resourceType/action 为空 |
| 40401 | userId 不存在 |
| 40002 | action 枚举值不合法 |
| 50003 | ABAC 条件求值异常 |

---

### 3.5 认证服务 API

#### 3.5.1 登录

用户名密码登录。若用户开启 MFA，返回 `mfaRequired=true` 及预登录令牌，需完成 MFA 验证后换取正式 Token。

```
POST /api/v1/iam/auth/login
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |
| captchaId | string | 否 | 图形验证码 ID（失败 3 次后必填） |
| captchaCode | string | 否 | 图形验证码 |
| deviceId | string | 否 | 设备标识，用于设备信任 |
| rememberMe | boolean | 否 | 记住我，延长 Refresh Token 有效期至 30 天 |

**请求示例**

```json
{
  "username": "zhangsan",
  "password": "P@ssw0rd123",
  "deviceId": "device-pc-001",
  "rememberMe": false
}
```

**响应示例（登录成功）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "loginResult": "SUCCESS",
    "userId": "user-9a8b7c6d",
    "username": "zhangsan",
    "realName": "张三",
    "accessToken": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTlhOGI3YzZkIiwi...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9.eyJ0eXAiOiJyZWZyZXNoIiwi...",
    "tokenType": "Bearer",
    "expiresIn": 7200,
    "refreshExpiresIn": 604800,
    "requirePasswordReset": false,
    "mfaRequired": false,
    "loginAt": "2026-07-16T10:30:00.000+08:00",
    "loginIp": "192.168.1.100"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**响应示例（需要 MFA）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "loginResult": "MFA_REQUIRED",
    "userId": "user-9a8b7c6d",
    "mfaRequired": true,
    "mfaToken": "mfa-token-temp-xxx",
    "mfaMethods": ["TOTP"],
    "expiresIn": 300,
    "loginAt": "2026-07-16T10:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | username/password 为空 |
| 40102 | 用户名或密码错误 |
| 40302 | 用户已被禁用 |
| 40303 | 账户已被锁定（失败次数过多） |
| 42901 | 登录请求过于频繁（IP 限流） |
| 40001 | 需要验证码但未提供 |
| 42201 | 验证码错误 |

---

#### 3.5.2 登出

登出当前会话，吊销 Access Token 与 Refresh Token。

```
POST /api/v1/iam/auth/logout
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| refreshToken | string | 否 | Refresh Token，传入则一并吊销 |
| allDevices | boolean | 否 | 是否登出所有设备会话，默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "logoutAt": "2026-07-16T10:35:00.000+08:00",
    "revokedSessions": 1
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40101 | Token 缺失或无效 |
| 40103 | Token 已过期 |

---

#### 3.5.3 刷新 Token

使用 Refresh Token 获取新的 Access Token。

```
POST /api/v1/iam/auth/refresh
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| refreshToken | string | 是 | Refresh Token |

**请求示例**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9.eyJ0eXAiOiJyZWZyZXNoIiwi..."
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTlhOGI3YzZkIiwi...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9.eyJ0eXAiOiJyZWZyZXNoIiwi...",
    "tokenType": "Bearer",
    "expiresIn": 7200,
    "refreshExpiresIn": 604800,
    "refreshedAt": "2026-07-16T12:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | refreshToken 为空 |
| 40103 | Refresh Token 已过期 |
| 40105 | Refresh Token 已被吊销（登出/禁用/改密） |
| 40302 | 用户已被禁用 |

---

#### 3.5.4 SSO 登录

通过 SSO 协议登录。支持 OAuth 2.0 / OIDC / SAML 三种协议。

```
POST /api/v1/iam/auth/sso/login
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| protocol | string | 是 | SSO 协议：OAUTH2/OIDC/SAML |
| provider | string | 是 | 身份提供方编码（如 LARK/DINGTALK/WECHAT/azuread） |
| code | string | 否 | OAuth2/OIDC 授权码 |
| samlResponse | string | 否 | SAML 响应（Base64 编码） |
| redirectUri | string | 否 | 回调地址 |
| autoCreateUser | boolean | 否 | 用户不存在时是否自动创建，默认 false |

**请求示例**

```json
{
  "protocol": "OIDC",
  "provider": "LARK",
  "code": "oauth-code-xxx",
  "redirectUri": "https://apphub.metaplatform.com/callback",
  "autoCreateUser": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "loginResult": "SUCCESS",
    "userId": "user-9a8b7c6d",
    "username": "zhangsan",
    "realName": "张三",
    "ssoProvider": "LARK",
    "ssoSubject": "lark-open-id-xxx",
    "linkedUser": true,
    "accessToken": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTlhOGI3YzZkIiwi...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9.eyJ0eXAiOiJyZWZyZXNoIiwi...",
    "tokenType": "Bearer",
    "expiresIn": 7200,
    "refreshExpiresIn": 604800,
    "loginAt": "2026-07-16T10:30:00.000+08:00",
    "loginIp": "192.168.1.100"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | protocol/provider 为空 |
| 40002 | protocol 枚举值不合法 |
| 40102 | SSO 授权码无效或已过期 |
| 40401 | SSO 用户未关联本地用户且 autoCreateUser=false |
| 42201 | SSO provider 未配置 |
| 50002 | SSO 身份提供方不可达 |

---

#### 3.5.5 多因素认证 - 发起绑定

为当前用户开启 MFA，生成 TOTP 密钥与二维码。

```
POST /api/v1/iam/auth/mfa/initiate
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| method | string | 否 | MFA 方式，目前支持 TOTP，默认 TOTP |
| password | string | 是 | 当前用户密码（验证身份） |

**请求示例**

```json
{
  "method": "TOTP",
  "password": "P@ssw0rd123"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "mfaSetupId": "mfa-setup-xxx",
    "method": "TOTP",
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCodeUri": "otpauth://totp/MatePlatform:zhangsan?secret=JBSWY3DPEHPK3PXP&issuer=MatePlatform",
    "qrCodeImageBase64": "data:image/png;base64,iVBORw0KGgo...",
    "expiresIn": 300,
    "initiatedAt": "2026-07-16T10:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40101 | Token 缺失或无效 |
| 40102 | 密码验证失败 |
| 40901 | 用户已开启 MFA |

---

#### 3.5.6 多因素认证 - 验证绑定 / 登录验证

验证 TOTP 验证码。既用于 MFA 绑定确认，也用于 MFA 登录二次验证。

```
POST /api/v1/iam/auth/mfa/verify
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| mfaToken | string | 否 | MFA 登录验证时使用（来自登录响应的 mfaToken） |
| mfaSetupId | string | 否 | MFA 绑定时使用（来自发起绑定的 mfaSetupId） |
| code | string | 是 | TOTP 验证码（6 位） |
| scenario | string | 是 | 场景：BIND（绑定确认）/ LOGIN（登录验证）/ DISABLE（关闭 MFA） |

**请求示例（登录验证）**

```json
{
  "mfaToken": "mfa-token-temp-xxx",
  "code": "123456",
  "scenario": "LOGIN"
}
```

**响应示例（登录验证成功）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "verified": true,
    "userId": "user-9a8b7c6d",
    "username": "zhangsan",
    "realName": "张三",
    "accessToken": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTlhOGI3YzZkIiwi...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9.eyJ0eXAiOiJyZWZyZXNoIiwi...",
    "tokenType": "Bearer",
    "expiresIn": 7200,
    "refreshExpiresIn": 604800,
    "loginAt": "2026-07-16T10:31:00.000+08:00",
    "loginIp": "192.168.1.100"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**响应示例（绑定确认成功）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "verified": true,
    "userId": "user-9a8b7c6d",
    "mfaEnabled": true,
    "mfaMethod": "TOTP",
    "backupCodes": ["829145", "371628", "594033", "621704", "839556", "471238", "950617", "384562"],
    "bindAt": "2026-07-16T10:31:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | code/scenario 为空 |
| 40102 | MFA 验证码错误 |
| 40104 | mfaToken/mfaSetupId 无效或已过期 |
| 42901 | MFA 验证尝试过于频繁（5 次失败锁定 15 分钟） |
| 40401 | scenario=DISABLE 但用户未开启 MFA |

---

#### 3.5.7 当前用户信息

获取当前登录用户的完整信息。

```
GET /api/v1/iam/auth/me
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userId": "user-9a8b7c6d",
    "username": "zhangsan",
    "realName": "张三",
    "email": "zhangsan@metaplatform.com",
    "phone": "13800138000",
    "employeeNo": "EMP-2026-0001",
    "avatarUrl": "https://minio.metaplatform.com/avatars/user-9a8b7c6d.png",
    "status": "ENABLED",
    "mfaEnabled": true,
    "departments": [
      { "deptId": "dept-001", "deptName": "研发部", "path": "/总部/研发部", "isPrimary": true }
    ],
    "position": { "positionId": "pos-001", "positionName": "后端工程师" },
    "roles": [
      { "roleId": "role-developer", "roleCode": "DEVELOPER", "roleName": "开发者", "dataScope": "DEPT" }
    ],
    "loginAt": "2026-07-16T10:30:00.000+08:00",
    "loginIp": "192.168.1.100",
    "tokenExpireAt": "2026-07-16T12:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40101 | Token 缺失或无效 |
| 40103 | Token 已过期 |

---

#### 3.5.8 当前用户权限

获取当前登录用户的权限列表，供前端进行按钮级、菜单级权限控制。

```
GET /api/v1/iam/auth/me/permissions
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| resourceType | string | 否 | 按资源类型筛选 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userId": "user-9a8b7c6d",
    "permissionCodes": [
      "project:read",
      "project:write",
      "department:read",
      "user:read",
      "ontology:read"
    ],
    "permissions": [
      {
        "permissionCode": "project:read",
        "resourceType": "PROJECT",
        "actions": ["READ"]
      },
      {
        "permissionCode": "project:write",
        "resourceType": "PROJECT",
        "actions": ["CREATE", "UPDATE"]
      }
    ],
    "dataScopes": {
      "PROJECT": "DEPT_AND_SUB",
      "USER": "DEPT",
      "ONTOLOGY": "ALL"
    },
    "roles": [
      { "roleCode": "DEVELOPER", "roleName": "开发者", "dataScope": "DEPT" }
    ]
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40101 | Token 缺失或无效 |
| 40103 | Token 已过期 |

---

### 3.6 API Key 管理 API

#### 3.6.1 生成 API Key

为用户或应用生成 API Key，用于服务间调用鉴权。API Key 仅在创建时返回完整密钥，后续不可查询。

```
POST /api/v1/iam/api-keys
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | API Key 名称 |
| ownerId | string | 否 | 所属用户 ID，默认当前用户 |
| description | string | 否 | 描述 |
| scopes | array | 否 | 权限范围（权限编码列表），为空则继承用户全部权限 |
| expiresAt | string | 否 | 过期时间（ISO 8601），为空则永不过期 |
| ipWhitelist | array | 否 | IP 白名单 |

**请求示例**

```json
{
  "name": "数字员工-数据查询",
  "description": "用于数字员工自动化数据查询任务",
  "scopes": ["project:read", "ontology:read", "rag:search"],
  "expiresAt": "2027-07-16T00:00:00.000+08:00",
  "ipWhitelist": ["192.168.1.0/24", "10.0.0.0/8"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "keyId": "apikey-9a8b7c6d",
    "name": "数字员工-数据查询",
    "apiKey": "mp-ak-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "apiKeyPrefix": "mp-ak-xxxx",
    "ownerId": "user-9a8b7c6d",
    "ownerName": "张三",
    "scopes": ["project:read", "ontology:read", "rag:search"],
    "expiresAt": "2027-07-16T00:00:00.000+08:00",
    "ipWhitelist": ["192.168.1.0/24", "10.0.0.0/8"],
    "status": "ACTIVE",
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "createdBy": "user-9a8b7c6d"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | name 为空 |
| 40401 | ownerId 不存在 |
| 42201 | scopes 引用的权限编码不存在 |
| 40002 | expiresAt 已早于当前时间 |
| 40301 | 无权为他人创建 API Key |

---

#### 3.6.2 查询 API Key 列表

分页查询 API Key 列表。不返回完整密钥，仅返回前缀。

```
GET /api/v1/iam/api-keys
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| size | int | 否 | 每页条数，默认 20 |
| keyword | string | 否 | 匹配 name |
| ownerId | string | 否 | 按所属用户筛选 |
| status | string | 否 | 状态：ACTIVE/REVOKED/EXPIRED |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "keyId": "apikey-9a8b7c6d",
        "name": "数字员工-数据查询",
        "apiKeyPrefix": "mp-ak-xxxx",
        "ownerId": "user-9a8b7c6d",
        "ownerName": "张三",
        "scopes": ["project:read", "ontology:read", "rag:search"],
        "expiresAt": "2027-07-16T00:00:00.000+08:00",
        "ipWhitelist": ["192.168.1.0/24"],
        "status": "ACTIVE",
        "lastUsedAt": "2026-07-16T09:15:00.000+08:00",
        "lastUsedIp": "192.168.1.100",
        "createdAt": "2026-07-16T10:30:00.000+08:00"
      }
    ],
    "total": 5,
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
| 40401 | ownerId 不存在 |
| 40301 | 无权查看他人 API Key |
| 40002 | status 枚举值不合法 |

---

#### 3.6.3 查询 API Key 详情

查询单个 API Key 详情，不返回完整密钥。

```
GET /api/v1/iam/api-keys/{keyId}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "keyId": "apikey-9a8b7c6d",
    "name": "数字员工-数据查询",
    "apiKeyPrefix": "mp-ak-xxxx",
    "ownerId": "user-9a8b7c6d",
    "ownerName": "张三",
    "description": "用于数字员工自动化数据查询任务",
    "scopes": ["project:read", "ontology:read", "rag:search"],
    "expiresAt": "2027-07-16T00:00:00.000+08:00",
    "ipWhitelist": ["192.168.1.0/24", "10.0.0.0/8"],
    "status": "ACTIVE",
    "lastUsedAt": "2026-07-16T09:15:00.000+08:00",
    "lastUsedIp": "192.168.1.100",
    "usageCount": 1280,
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "createdBy": "user-9a8b7c6d"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | keyId 不存在 |
| 40301 | 无权查看该 API Key |

---

#### 3.6.4 删除/吊销 API Key

吊销 API Key，吊销后立即失效，不可恢复。同时清除 Redis 中的 API Key 缓存。

```
DELETE /api/v1/iam/api-keys/{keyId}
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reason | string | 否 | 吊销原因 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "keyId": "apikey-9a8b7c6d",
    "status": "REVOKED",
    "revokedAt": "2026-07-16T10:35:00.000+08:00",
    "revokedBy": "user-9a8b7c6d"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | keyId 不存在 |
| 40901 | API Key 已被吊销 |
| 40301 | 无权吊销该 API Key |

---

#### 3.6.5 API Key 权限绑定

为 API Key 绑定权限范围。支持替换模式与增量模式。

```
POST /api/v1/iam/api-keys/{keyId}/permissions
```

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| scopes | array | 是 | 权限编码列表 |
| replaceMode | boolean | 否 | 是否替换模式，默认 false（增量追加） |

**请求示例**

```json
{
  "scopes": ["project:read", "project:write", "rag:search"],
  "replaceMode": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "keyId": "apikey-9a8b7c6d",
    "name": "数字员工-数据查询",
    "scopes": ["project:read", "project:write", "rag:search"],
    "scopeCount": 3,
    "updatedAt": "2026-07-16T10:35:00.000+08:00",
    "updatedBy": "user-9a8b7c6d"
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | keyId 不存在 |
| 42201 | scopes 引用的权限编码不存在；API Key 已被吊销不可修改 |
| 40301 | 无权修改该 API Key 权限 |

---

### 3.7 操作审计 API

#### 3.7.1 操作日志查询

查询用户操作日志，记录所有写操作的审计轨迹。

```
GET /api/v1/iam/audit/operations
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| size | int | 否 | 每页条数，默认 20 |
| userId | string | 否 | 操作用户 ID |
| module | string | 否 | 操作模块（USER/DEPARTMENT/ROLE/PERMISSION/AUTH/API_KEY） |
| action | string | 否 | 操作类型（CREATE/UPDATE/DELETE/LOGIN/LOGOUT 等） |
| resourceType | string | 否 | 资源类型 |
| resourceId | string | 否 | 资源 ID |
| result | string | 否 | 操作结果：SUCCESS/FAILED |
| traceId | string | 否 | 按 traceId 检索 |
| startTime | string | 否 | 开始时间（ISO 8601） |
| endTime | string | 否 | 结束时间（ISO 8601） |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "logId": "log-op-20260716-000001",
        "userId": "user-admin",
        "username": "admin",
        "realName": "管理员",
        "module": "USER",
        "action": "CREATE",
        "resourceType": "USER",
        "resourceId": "user-9a8b7c6d",
        "resourceName": "zhangsan",
        "result": "SUCCESS",
        "detail": "创建用户 zhangsan",
        "requestIp": "192.168.1.100",
        "requestUserAgent": "Mozilla/5.0...",
        "requestPath": "/api/v1/iam/users",
        "requestMethod": "POST",
        "requestParams": "{\"username\":\"zhangsan\",\"realName\":\"张三\"}",
        "traceId": "a1b2c3d4e5f6",
        "durationMs": 45,
        "operatedAt": "2026-07-16T10:30:00.000+08:00"
      }
    ],
    "total": 1280,
    "page": 1,
    "size": 20,
    "totalPages": 64
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | module/action/result 枚举值不合法 |
| 40301 | 无审计日志查看权限 |

---

#### 3.7.2 登录日志查询

查询用户登录日志，记录所有登录尝试（含成功与失败）。

```
GET /api/v1/iam/audit/logins
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| size | int | 否 | 每页条数，默认 20 |
| userId | string | 否 | 用户 ID |
| username | string | 否 | 用户名 |
| loginType | string | 否 | 登录类型：PASSWORD/SSO/MFA |
| result | string | 否 | 登录结果：SUCCESS/FAILED/LOCKED |
| loginIp | string | 否 | 登录 IP |
| startTime | string | 否 | 开始时间（ISO 8601） |
| endTime | string | 否 | 结束时间（ISO 8601） |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "logId": "log-login-20260716-000001",
        "userId": "user-9a8b7c6d",
        "username": "zhangsan",
        "realName": "张三",
        "loginType": "PASSWORD",
        "result": "SUCCESS",
        "loginIp": "192.168.1.100",
        "loginLocation": "上海市",
        "browser": "Chrome 126",
        "os": "Windows 11",
        "device": "PC",
        "ssoProvider": null,
        "failReason": null,
        "traceId": "a1b2c3d4e5f6",
        "loginAt": "2026-07-16T10:30:00.000+08:00"
      },
      {
        "logId": "log-login-20260716-000002",
        "userId": "user-9a8b7c6d",
        "username": "zhangsan",
        "realName": "张三",
        "loginType": "PASSWORD",
        "result": "FAILED",
        "loginIp": "192.168.1.100",
        "loginLocation": "上海市",
        "browser": "Chrome 126",
        "os": "Windows 11",
        "device": "PC",
        "ssoProvider": null,
        "failReason": "密码错误",
        "failCount": 2,
        "traceId": "b2c3d4e5f6a1",
        "loginAt": "2026-07-16T10:25:00.000+08:00"
      }
    ],
    "total": 560,
    "page": 1,
    "size": 20,
    "totalPages": 28
  },
  "traceId": "a1b2c3d4e5f6"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | loginType/result 枚举值不合法 |
| 40301 | 无登录日志查看权限 |

---

#### 3.7.3 权限变更日志查询

查询权限变更日志，记录角色权限分配、用户角色变更、数据权限配置等操作。

```
GET /api/v1/iam/audit/permission-changes
```

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | int | 否 | 页码，默认 1 |
| size | int | 否 | 每页条数，默认 20 |
| changeType | string | 否 | 变更类型：ROLE_PERMISSION/USER_ROLE/DATA_PERMISSION/POLICY_CHANGE |
| roleId | string | 否 | 角色 ID |
| userId | string | 否 | 受影响用户 ID |
| operatorId | string | 否 | 操作人 ID |
| startTime | string | 否 | 开始时间（ISO 8601） |
| endTime | string | 否 | 结束时间（ISO 8601） |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "logId": "log-pc-20260716-000001",
        "changeType": "ROLE_PERMISSION",
        "operatorId": "user-admin",
        "operatorName": "管理员",
        "targetType": "ROLE",
        "targetId": "role-pm-001",
        "targetName": "项目经理",
        "action": "ASSIGN",
        "beforeValue": ["perm-001"],
        "afterValue": ["perm-001", "perm-002", "perm-003"],
        "affectedUserIds": ["user-001", "user-002"],
        "affectedUserCount": 8,
        "reason": "项目组权限调整",
        "traceId": "a1b2c3d4e5f6",
        "changedAt": "2026-07-16T10:35:00.000+08:00"
      },
      {
        "logId": "log-pc-20260716-000002",
        "changeType": "USER_ROLE",
        "operatorId": "user-admin",
        "operatorName": "管理员",
        "targetType": "USER",
        "targetId": "user-001",
        "targetName": "zhangsan",
        "action": "ADD_ROLE",
        "beforeValue": ["role-developer"],
        "afterValue": ["role-developer", "role-pm-001"],
        "affectedUserIds": ["user-001"],
        "affectedUserCount": 1,
        "reason": "晋升项目经理",
        "traceId": "c3d4e5f6a1b2",
        "changedAt": "2026-07-16T10:40:00.000+08:00"
      }
    ],
    "total": 86,
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
| 40002 | changeType 枚举值不合法 |
| 40301 | 无权限变更日志查看权限 |

---

## 4. 数据模型

### 4.1 PostgreSQL 表结构总览

| 表名 | 说明 |
|---|---|
| iam_user | 用户表 |
| iam_department | 部门表 |
| iam_position | 岗位表 |
| iam_user_department | 用户-部门-岗位关联表 |
| iam_role | 角色表 |
| iam_permission | 权限定义表 |
| iam_role_permission | 角色-权限关联表 |
| iam_user_role | 用户-角色关联表 |
| iam_policy | 权限策略表 |
| iam_policy_statement | 策略声明表 |
| iam_role_policy | 角色-策略关联表 |
| iam_data_permission | 数据权限配置表 |
| iam_api_key | API Key 表 |
| iam_api_key_scope | API Key 权限范围表 |
| iam_mfa_secret | 多因素认证密钥表 |
| iam_sso_binding | SSO 账号绑定表 |
| iam_audit_operation | 操作审计日志表 |
| iam_audit_login | 登录审计日志表 |
| iam_audit_permission_change | 权限变更审计日志表 |
| iam_outbox | Outbox 事件表（Kafka 事务消息） |
| iam_idempotent_request | 幂等请求记录表 |

### 4.2 iam_user（用户表）

```sql
CREATE TABLE iam_user (
    id                  VARCHAR(64)   PRIMARY KEY,          -- 用户 ID（UUID）
    tenant_id           VARCHAR(64)   NOT NULL,             -- 租户 ID
    username            VARCHAR(64)   NOT NULL,             -- 登录用户名
    real_name           VARCHAR(128)  NOT NULL,             -- 真实姓名
    email               VARCHAR(256),                       -- 邮箱
    phone               VARCHAR(32),                        -- 手机号
    employee_no         VARCHAR(64),                        -- 工号
    avatar_url          VARCHAR(512),                       -- 头像 URL
    password_hash       VARCHAR(256)  NOT NULL,             -- 密码哈希（BCrypt）
    password_updated_at TIMESTAMP,                          -- 密码最后修改时间
    require_password_reset BOOLEAN       NOT NULL DEFAULT FALSE, -- 是否要求重置密码
    status              VARCHAR(32)   NOT NULL DEFAULT 'ENABLED', -- 状态：ENABLED/DISABLED/LOCKED
    locked_at           TIMESTAMP,                          -- 锁定时间
    locked_reason       VARCHAR(256),                       -- 锁定原因
    mfa_enabled         BOOLEAN       NOT NULL DEFAULT FALSE, -- 是否开启 MFA
    last_login_at       TIMESTAMP,                          -- 最后登录时间
    last_login_ip       VARCHAR(64),                        -- 最后登录 IP
    description         TEXT,                               -- 用户描述
    version             INT           NOT NULL DEFAULT 1,  -- 乐观锁版本号
    deleted             BOOLEAN       NOT NULL DEFAULT FALSE, -- 软删除标记
    deleted_at          TIMESTAMP,                          -- 删除时间
    deleted_by          VARCHAR(64),                        -- 删除操作人
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(64),                        -- 创建人
    updated_by          VARCHAR(64),                        -- 更新人
    UNIQUE (tenant_id, username)
);

CREATE INDEX idx_user_tenant_status ON iam_user (tenant_id, status, deleted);
CREATE INDEX idx_user_email ON iam_user (tenant_id, email) WHERE email IS NOT NULL;
CREATE INDEX idx_user_phone ON iam_user (tenant_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_user_employee_no ON iam_user (tenant_id, employee_no) WHERE employee_no IS NOT NULL;
CREATE INDEX idx_user_created_at ON iam_user (created_at DESC);
```

### 4.3 iam_department（部门表）

```sql
CREATE TABLE iam_department (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    dept_code           VARCHAR(128)  NOT NULL,             -- 部门编码
    dept_name           VARCHAR(256)  NOT NULL,             -- 部门名称
    parent_id           VARCHAR(64),                        -- 上级部门 ID
    parent_path         VARCHAR(1024),                      -- 祖先路径（如 /root/dept-001）
    full_path           VARCHAR(1024) NOT NULL,             -- 完整名称路径（如 /总部/研发部）
    level               INT           NOT NULL,             -- 层级（根为 1）
    sort_order          INT           NOT NULL DEFAULT 0,   -- 同级排序序号
    leader_id           VARCHAR(64),                        -- 部门负责人用户 ID
    description         TEXT,                               -- 部门描述
    version             INT           NOT NULL DEFAULT 1,
    deleted             BOOLEAN       NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMP,
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(64),
    updated_by          VARCHAR(64),
    UNIQUE (tenant_id, dept_code)
);

CREATE INDEX idx_dept_tenant_parent ON iam_department (tenant_id, parent_id, deleted);
CREATE INDEX idx_dept_tenant_level ON iam_department (tenant_id, level);
CREATE INDEX idx_dept_leader ON iam_department (tenant_id, leader_id);
```

### 4.4 iam_position（岗位表）

```sql
CREATE TABLE iam_position (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    position_code       VARCHAR(128)  NOT NULL,             -- 岗位编码
    position_name       VARCHAR(256)  NOT NULL,             -- 岗位名称
    department_id       VARCHAR(64),                        -- 所属部门 ID
    level               INT,                                -- 岗位职级
    description         TEXT,                               -- 岗位描述
    version             INT           NOT NULL DEFAULT 1,
    deleted             BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(64),
    updated_by          VARCHAR(64),
    UNIQUE (tenant_id, position_code)
);

CREATE INDEX idx_pos_tenant_dept ON iam_position (tenant_id, department_id);
```

### 4.5 iam_user_department（用户-部门-岗位关联表）

```sql
CREATE TABLE iam_user_department (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    user_id             VARCHAR(64)   NOT NULL,             -- 用户 ID
    department_id       VARCHAR(64)   NOT NULL,             -- 部门 ID
    position_id         VARCHAR(64),                        -- 岗位 ID
    is_primary          BOOLEAN       NOT NULL DEFAULT FALSE, -- 是否主部门
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(64),
    UNIQUE (tenant_id, user_id, department_id),
    FOREIGN KEY (user_id) REFERENCES iam_user(id) ON DELETE CASCADE
);

CREATE INDEX idx_ud_tenant_user ON iam_user_department (tenant_id, user_id);
CREATE INDEX idx_ud_tenant_dept ON iam_user_department (tenant_id, department_id);
CREATE INDEX idx_ud_primary ON iam_user_department (tenant_id, user_id, is_primary);
```

### 4.6 iam_role（角色表）

```sql
CREATE TABLE iam_role (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    role_code           VARCHAR(128)  NOT NULL,             -- 角色编码
    role_name           VARCHAR(256)  NOT NULL,             -- 角色名称
    role_type           VARCHAR(32)   NOT NULL DEFAULT 'CUSTOM', -- 角色类型：SYSTEM/CUSTOM
    description         TEXT,                               -- 角色描述
    data_scope          VARCHAR(32)   NOT NULL DEFAULT 'SELF', -- 数据范围：ALL/DEPT/DEPT_AND_SUB/SELF/CUSTOM
    enabled             BOOLEAN       NOT NULL DEFAULT TRUE, -- 是否启用
    version             INT           NOT NULL DEFAULT 1,
    deleted             BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(64),
    updated_by          VARCHAR(64),
    UNIQUE (tenant_id, role_code)
);

CREATE INDEX idx_role_tenant_type ON iam_role (tenant_id, role_type, enabled, deleted);
```

### 4.7 iam_permission（权限定义表）

```sql
CREATE TABLE iam_permission (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    permission_code     VARCHAR(256)  NOT NULL,             -- 权限编码（resource:action）
    permission_name     VARCHAR(256)  NOT NULL,             -- 权限名称
    resource_type       VARCHAR(64)   NOT NULL,             -- 资源类型
    resource_id         VARCHAR(64),                        -- 具体资源 ID（为空表示全部）
    actions             JSONB         NOT NULL,             -- 操作列表 ["READ","CREATE",...]
    effect              VARCHAR(16)   NOT NULL DEFAULT 'ALLOW', -- 效果：ALLOW/DENY
    description         TEXT,                               -- 权限描述
    conditions          JSONB,                              -- ABAC 条件表达式
    version             INT           NOT NULL DEFAULT 1,
    deleted             BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(64),
    updated_by          VARCHAR(64),
    UNIQUE (tenant_id, permission_code)
);

CREATE INDEX idx_perm_tenant_resource ON iam_permission (tenant_id, resource_type, deleted);
CREATE INDEX idx_perm_tenant_effect ON iam_permission (tenant_id, effect, deleted);
```

### 4.8 iam_role_permission（角色-权限关联表）

```sql
CREATE TABLE iam_role_permission (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    role_id             VARCHAR(64)   NOT NULL,             -- 角色 ID
    permission_id       VARCHAR(64)   NOT NULL,             -- 权限 ID
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(64),
    UNIQUE (tenant_id, role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES iam_role(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES iam_permission(id) ON DELETE CASCADE
);

CREATE INDEX idx_rp_role ON iam_role_permission (role_id);
CREATE INDEX idx_rp_permission ON iam_role_permission (permission_id);
```

### 4.9 iam_user_role（用户-角色关联表）

```sql
CREATE TABLE iam_user_role (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    user_id             VARCHAR(64)   NOT NULL,             -- 用户 ID
    role_id             VARCHAR(64)   NOT NULL,             -- 角色 ID
    assigned_at         TIMESTAMP     NOT NULL DEFAULT NOW(),
    assigned_by         VARCHAR(64),                        -- 分配人
    expired_at          TIMESTAMP,                          -- 过期时间（为空则永久）
    UNIQUE (tenant_id, user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES iam_user(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES iam_role(id) ON DELETE CASCADE
);

CREATE INDEX idx_ur_user ON iam_user_role (user_id);
CREATE INDEX idx_ur_role ON iam_user_role (role_id);
```

### 4.10 iam_policy（权限策略表）

```sql
CREATE TABLE iam_policy (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    policy_code         VARCHAR(128)  NOT NULL,             -- 策略编码
    policy_name         VARCHAR(256)  NOT NULL,             -- 策略名称
    description         TEXT,                               -- 策略描述
    enabled             BOOLEAN       NOT NULL DEFAULT TRUE, -- 是否启用
    version             INT           NOT NULL DEFAULT 1,
    deleted             BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(64),
    updated_by          VARCHAR(64),
    UNIQUE (tenant_id, policy_code)
);
```

### 4.11 iam_policy_statement（策略声明表）

```sql
CREATE TABLE iam_policy_statement (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    policy_id           VARCHAR(64)   NOT NULL,             -- 策略 ID
    effect              VARCHAR(16)   NOT NULL,             -- 效果：ALLOW/DENY
    actions             JSONB         NOT NULL,             -- 操作列表
    resource            VARCHAR(512)  NOT NULL,             -- 资源匹配表达式
    condition           JSONB,                              -- ABAC 条件
    sort_order          INT           NOT NULL DEFAULT 0,
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    FOREIGN KEY (policy_id) REFERENCES iam_policy(id) ON DELETE CASCADE
);

CREATE INDEX idx_ps_policy ON iam_policy_statement (policy_id);
```

### 4.12 iam_data_permission（数据权限配置表）

```sql
CREATE TABLE iam_data_permission (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    role_code           VARCHAR(128)  NOT NULL,             -- 关联角色编码
    resource_type       VARCHAR(64)   NOT NULL,             -- 资源类型
    row_scope           VARCHAR(32)   NOT NULL,             -- 行级范围：ALL/DEPT/DEPT_AND_SUB/SELF/CUSTOM
    custom_dept_ids     JSONB,                              -- 自定义部门 ID 列表（row_scope=CUSTOM）
    field_scope         VARCHAR(32)   NOT NULL DEFAULT 'ALL', -- 字段级范围：ALL/CUSTOM
    visible_fields      JSONB,                              -- 可见字段列表
    invisible_fields    JSONB,                              -- 隐藏字段列表
    version             INT           NOT NULL DEFAULT 1,
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(64),
    updated_by          VARCHAR(64),
    UNIQUE (tenant_id, role_code, resource_type)
);

CREATE INDEX idx_dp_tenant_role ON iam_data_permission (tenant_id, role_code);
CREATE INDEX idx_dp_tenant_resource ON iam_data_permission (tenant_id, resource_type);
```

### 4.13 iam_api_key（API Key 表）

```sql
CREATE TABLE iam_api_key (
    id                  VARCHAR(64)   PRIMARY KEY,          -- keyId
    tenant_id           VARCHAR(64)   NOT NULL,
    name                VARCHAR(256)  NOT NULL,             -- API Key 名称
    api_key_hash        VARCHAR(256)  NOT NULL,             -- API Key 哈希（存储哈希，不存明文）
    api_key_prefix      VARCHAR(32)   NOT NULL,             -- API Key 前缀（用于展示匹配）
    owner_id            VARCHAR(64)   NOT NULL,             -- 所属用户 ID
    description         TEXT,                               -- 描述
    scopes              JSONB,                              -- 权限范围
    ip_whitelist        JSONB,                              -- IP 白名单
    expires_at          TIMESTAMP,                          -- 过期时间（为空则永不过期）
    status              VARCHAR(32)   NOT NULL DEFAULT 'ACTIVE', -- 状态：ACTIVE/REVOKED/EXPIRED
    last_used_at        TIMESTAMP,                          -- 最后使用时间
    last_used_ip        VARCHAR(64),                        -- 最后使用 IP
    usage_count         BIGINT        NOT NULL DEFAULT 0,   -- 使用次数
    revoked_at          TIMESTAMP,                          -- 吊销时间
    revoked_by          VARCHAR(64),                        -- 吊销人
    revoked_reason      TEXT,                               -- 吊销原因
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(64)
);

CREATE INDEX idx_ak_tenant_owner ON iam_api_key (tenant_id, owner_id, status);
CREATE INDEX idx_ak_tenant_status ON iam_api_key (tenant_id, status);
CREATE INDEX idx_ak_key_hash ON iam_api_key (api_key_hash);
```

### 4.14 iam_mfa_secret（多因素认证密钥表）

```sql
CREATE TABLE iam_mfa_secret (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    user_id             VARCHAR(64)   NOT NULL,             -- 用户 ID
    method              VARCHAR(32)   NOT NULL DEFAULT 'TOTP', -- MFA 方式
    secret_encrypted    TEXT          NOT NULL,             -- TOTP 密钥（加密存储）
    backup_codes_hash   JSONB,                              -- 备用验证码哈希列表
    enabled             BOOLEAN       NOT NULL DEFAULT FALSE, -- 是否已启用
    enabled_at          TIMESTAMP,                          -- 启用时间
    last_used_at        TIMESTAMP,                          -- 最后使用时间
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, user_id, method),
    FOREIGN KEY (user_id) REFERENCES iam_user(id) ON DELETE CASCADE
);
```

### 4.15 iam_sso_binding（SSO 账号绑定表）

```sql
CREATE TABLE iam_sso_binding (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    user_id             VARCHAR(64)   NOT NULL,             -- 本地用户 ID
    provider            VARCHAR(64)   NOT NULL,             -- 身份提供方
    protocol            VARCHAR(32)   NOT NULL,             -- SSO 协议：OAUTH2/OIDC/SAML
    sso_subject         VARCHAR(256)  NOT NULL,             -- SSO 主体标识（openid/unionid）
    sso_username        VARCHAR(256),                       -- SSO 用户名
    attributes          JSONB,                              -- SSO 属性快照
    last_login_at       TIMESTAMP,                          -- 最后 SSO 登录时间
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, provider, sso_subject),
    FOREIGN KEY (user_id) REFERENCES iam_user(id) ON DELETE CASCADE
);

CREATE INDEX idx_sso_tenant_user ON iam_sso_binding (tenant_id, user_id);
```

### 4.16 iam_audit_operation（操作审计日志表）

```sql
CREATE TABLE iam_audit_operation (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    user_id             VARCHAR(64),                        -- 操作用户 ID
    username            VARCHAR(64),                        -- 操作用户名
    real_name           VARCHAR(128),                       -- 操作人姓名
    module              VARCHAR(32)   NOT NULL,             -- 操作模块
    action              VARCHAR(32)   NOT NULL,             -- 操作类型
    resource_type       VARCHAR(64),                        -- 资源类型
    resource_id         VARCHAR(64),                        -- 资源 ID
    resource_name       VARCHAR(256),                       -- 资源名称
    result              VARCHAR(16)   NOT NULL,             -- 操作结果：SUCCESS/FAILED
    detail              TEXT,                               -- 操作详情
    request_ip          VARCHAR(64),                        -- 请求 IP
    request_user_agent  TEXT,                               -- 请求 UA
    request_path        VARCHAR(512),                       -- 请求路径
    request_method      VARCHAR(16),                        -- 请求方法
    request_params      TEXT,                               -- 请求参数（脱敏）
    error_message       TEXT,                               -- 错误信息（失败时）
    trace_id            VARCHAR(64),                        -- 链路追踪 ID
    duration_ms         INT,                                -- 耗时（毫秒）
    operated_at         TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ao_tenant_time ON iam_audit_operation (tenant_id, operated_at DESC);
CREATE INDEX idx_ao_tenant_user ON iam_audit_operation (tenant_id, user_id, operated_at DESC);
CREATE INDEX idx_ao_tenant_module ON iam_audit_operation (tenant_id, module, operated_at DESC);
CREATE INDEX idx_ao_resource ON iam_audit_operation (tenant_id, resource_type, resource_id);
CREATE INDEX idx_ao_trace_id ON iam_audit_operation (trace_id);
```

### 4.17 iam_audit_login（登录审计日志表）

```sql
CREATE TABLE iam_audit_login (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    user_id             VARCHAR(64),                        -- 用户 ID
    username            VARCHAR(64),                        -- 用户名
    real_name           VARCHAR(128),                       -- 姓名
    login_type          VARCHAR(32)   NOT NULL,             -- 登录类型：PASSWORD/SSO/MFA
    result              VARCHAR(16)   NOT NULL,             -- 登录结果：SUCCESS/FAILED/LOCKED
    login_ip            VARCHAR(64),                        -- 登录 IP
    login_location      VARCHAR(256),                       -- 登录地点
    browser             VARCHAR(128),                       -- 浏览器
    os                  VARCHAR(128),                       -- 操作系统
    device              VARCHAR(64),                        -- 设备类型
    sso_provider        VARCHAR(64),                        -- SSO 提供方（SSO 登录时）
    fail_reason         VARCHAR(256),                       -- 失败原因
    fail_count          INT,                                -- 当前失败次数
    trace_id            VARCHAR(64),                        -- 链路追踪 ID
    login_at            TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_al_tenant_time ON iam_audit_login (tenant_id, login_at DESC);
CREATE INDEX idx_al_tenant_user ON iam_audit_login (tenant_id, user_id, login_at DESC);
CREATE INDEX idx_al_tenant_result ON iam_audit_login (tenant_id, result, login_at DESC);
```

### 4.18 iam_audit_permission_change（权限变更审计日志表）

```sql
CREATE TABLE iam_audit_permission_change (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    change_type         VARCHAR(32)   NOT NULL,             -- 变更类型：ROLE_PERMISSION/USER_ROLE/DATA_PERMISSION/POLICY_CHANGE
    operator_id         VARCHAR(64)   NOT NULL,             -- 操作人 ID
    operator_name       VARCHAR(128),                       -- 操作人姓名
    target_type         VARCHAR(32)   NOT NULL,             -- 目标类型：ROLE/USER/POLICY
    target_id           VARCHAR(64)   NOT NULL,             -- 目标 ID
    target_name         VARCHAR(256),                       -- 目标名称
    action              VARCHAR(32)   NOT NULL,             -- 变更动作：ASSIGN/REVOKE/ADD_ROLE/REMOVE_ROLE 等
    before_value        JSONB,                              -- 变更前值
    after_value         JSONB,                              -- 变更后值
    affected_user_ids   JSONB,                              -- 受影响用户 ID 列表
    affected_user_count INT,                                -- 受影响用户数
    reason              TEXT,                               -- 变更原因
    trace_id            VARCHAR(64),                        -- 链路追踪 ID
    changed_at          TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_apc_tenant_time ON iam_audit_permission_change (tenant_id, changed_at DESC);
CREATE INDEX idx_apc_tenant_type ON iam_audit_permission_change (tenant_id, change_type, changed_at DESC);
CREATE INDEX idx_apc_operator ON iam_audit_permission_change (operator_id, changed_at DESC);
CREATE INDEX idx_apc_target ON iam_audit_permission_change (target_type, target_id);
```

### 4.19 iam_outbox（Outbox 事件表）

```sql
CREATE TABLE iam_outbox (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    event_id            VARCHAR(64)   NOT NULL,             -- 事件唯一 ID
    event_type          VARCHAR(64)   NOT NULL,             -- 事件类型
    aggregate_type      VARCHAR(32)   NOT NULL,             -- 聚合类型：USER/ROLE/PERMISSION 等
    aggregate_id        VARCHAR(64)   NOT NULL,             -- 聚合 ID
    payload             JSONB         NOT NULL,             -- 事件 payload
    trace_id            VARCHAR(64),                        -- 链路追踪 ID
    status              VARCHAR(16)   NOT NULL DEFAULT 'PENDING', -- 状态：PENDING/SENT/FAILED
    retry_count         INT           NOT NULL DEFAULT 0,   -- 重试次数
    max_retries         INT           NOT NULL DEFAULT 3,   -- 最大重试次数
    next_retry_at       TIMESTAMP,                          -- 下次重试时间
    sent_at             TIMESTAMP,                          -- 发送成功时间
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbox_status_retry ON iam_outbox (status, next_retry_at) WHERE status = 'PENDING';
CREATE INDEX idx_outbox_aggregate ON iam_outbox (aggregate_type, aggregate_id);
```

### 4.20 iam_idempotent_request（幂等请求记录表）

```sql
CREATE TABLE iam_idempotent_request (
    id                  VARCHAR(64)   PRIMARY KEY,
    tenant_id           VARCHAR(64)   NOT NULL,
    request_type        VARCHAR(64)   NOT NULL,             -- 请求类型
    request_id          VARCHAR(64)   NOT NULL,             -- 客户端请求 ID
    response_code       INT,                                -- 首次响应码
    response_body       TEXT,                               -- 首次响应体（缓存）
    trace_id            VARCHAR(64),                        -- 链路追踪 ID
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMP     NOT NULL,             -- 过期时间
    UNIQUE (tenant_id, request_type, request_id)
);
```

### 4.21 Redis 数据结构

| Key 模式 | 类型 | TTL | 说明 |
|---|---|---|---|
| `token:blacklist:{jti}` | String | 与 Access Token 剩余有效期一致 | 登出/吊销的 Access Token 黑名单 |
| `token:refresh:{userId}:{deviceId}` | String | 7 天 | Refresh Token 存储，支持多设备会话 |
| `session:{userId}:{deviceId}` | Hash | 2 小时 | 会话信息（登录 IP、设备、登录时间） |
| `user:permissions:{userId}` | Set | 30 分钟 | 用户权限编码缓存 |
| `user:roles:{userId}` | Set | 30 分钟 | 用户角色编码缓存 |
| `user:detail:{userId}` | Hash | 10 分钟 | 用户详情缓存 |
| `dept:tree:{tenantId}` | String(JSON) | 10 分钟 | 部门层级树缓存 |
| `login:fail:{tenantId}:{username}` | String(int) | 30 分钟 | 登录失败次数计数 |
| `login:lock:{tenantId}:{username}` | String | 30 分钟 | 账户锁定标记 |
| `login:rate:{ip}` | String(int) | 1 分钟 | IP 登录限流计数 |
| `apikey:{keyHash}` | Hash | 10 分钟 | API Key 缓存（含 ownerId、scopes、status） |
| `mfa:setup:{mfaSetupId}` | Hash | 5 分钟 | MFA 绑定临时会话（含 secret、userId） |
| `mfa:login:{mfaToken}` | Hash | 5 分钟 | MFA 登录临时会话（含 userId、loginIp） |
| `mfa:attempt:{userId}` | String(int) | 15 分钟 | MFA 验证失败次数计数 |
| `captcha:{captchaId}` | String | 5 分钟 | 图形验证码 |
| `perm:check:{userId}:{resourceType}:{action}` | String(bool) | 5 分钟 | 权限检查结果缓存 |

---

## 5. 事件定义

### 5.1 事件类型

| 事件类型 | 说明 | 触发时机 |
|---|---|---|
| USER_CREATED | 用户创建事件 | 新用户创建成功后 |
| USER_UPDATED | 用户更新事件 | 用户基本信息更新后 |
| USER_DISABLED | 用户禁用事件 | 用户被禁用，吊销全部 Token |
| USER_ENABLED | 用户启用事件 | 用户被重新启用 |
| USER_DELETED | 用户删除事件 | 用户被软删除 |
| DEPARTMENT_CREATED | 部门创建事件 | 新部门创建后 |
| DEPARTMENT_UPDATED | 部门更新事件 | 部门信息或层级变更后 |
| DEPARTMENT_DELETED | 部门删除事件 | 部门被删除后 |
| ROLE_CREATED | 角色创建事件 | 新角色创建后 |
| ROLE_UPDATED | 角色更新事件 | 角色信息更新后 |
| ROLE_DELETED | 角色删除事件 | 角色被删除后 |
| ROLE_PERMISSION_CHANGED | 角色权限变更事件 | 角色权限分配/移除后 |
| USER_ROLE_CHANGED | 用户角色变更事件 | 用户被授予/移除角色后 |
| PERMISSION_CREATED | 权限定义创建事件 | 新权限定义创建后 |
| PERMISSION_UPDATED | 权限定义更新事件 | 权限定义更新后 |
| PERMISSION_DELETED | 权限定义删除事件 | 权限定义被删除后 |
| DATA_PERMISSION_CHANGED | 数据权限变更事件 | 数据权限配置变更后 |
| API_KEY_CREATED | API Key 创建事件 | API Key 生成后 |
| API_KEY_REVOKED | API Key 吊销事件 | API Key 被吊销后 |

### 5.2 Kafka Topic 定义

| Topic | 说明 | 分区策略 |
|---|---|---|
| `iam.user.events` | 用户生命周期事件 | 按 `userId` 哈希分区 |
| `iam.org.events` | 组织架构变更事件 | 按 `departmentId` 哈希分区 |
| `iam.role.events` | 角色与权限变更事件 | 按 `roleId` 哈希分区 |
| `iam.permission.events` | 权限定义与策略变更事件 | 按 `permissionId` 哈希分区 |
| `iam.apikey.events` | API Key 生命周期事件 | 按 `keyId` 哈希分区 |
| `iam.dlq` | 死信队列 | 消费失败的事件 |

### 5.3 Kafka 消息结构

所有 Kafka 消息采用统一信封格式：

```json
{
  "eventId": "evt-20260716-000001",
  "eventType": "USER_CREATED",
  "eventTimestamp": "2026-07-16T10:30:00.000+08:00",
  "tenantId": "tenant-001",
  "aggregateType": "USER",
  "aggregateId": "user-9a8b7c6d",
  "traceId": "a1b2c3d4e5f6",
  "source": "TECH-IAM",
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

#### 5.4.1 USER_CREATED

```json
{
  "userId": "user-9a8b7c6d",
  "username": "zhangsan",
  "realName": "张三",
  "email": "zhangsan@metaplatform.com",
  "phone": "13800138000",
  "employeeNo": "EMP-2026-0001",
  "status": "ENABLED",
  "departments": [
    { "deptId": "dept-001", "deptName": "研发部", "isPrimary": true }
  ],
  "position": { "positionId": "pos-001", "positionName": "后端工程师" },
  "roles": [
    { "roleId": "role-developer", "roleCode": "DEVELOPER", "roleName": "开发者" }
  ],
  "createdBy": "user-admin",
  "createdAt": "2026-07-16T10:30:00.000+08:00"
}
```

#### 5.4.2 USER_DISABLED

```json
{
  "userId": "user-9a8b7c6d",
  "username": "zhangsan",
  "realName": "张三",
  "previousStatus": "ENABLED",
  "currentStatus": "DISABLED",
  "revokedTokens": 3,
  "revokedApiKeys": 2,
  "reason": "用户离职，账户停用",
  "operatedBy": "user-admin",
  "operatedAt": "2026-07-16T10:35:00.000+08:00"
}
```

#### 5.4.3 ROLE_PERMISSION_CHANGED

```json
{
  "roleId": "role-pm-001",
  "roleCode": "PROJECT_MANAGER",
  "roleName": "项目经理",
  "action": "ASSIGN",
  "addedPermissionIds": ["perm-002", "perm-003"],
  "removedPermissionIds": [],
  "currentPermissionIds": ["perm-001", "perm-002", "perm-003"],
  "affectedUserIds": ["user-001", "user-002"],
  "affectedUserCount": 8,
  "reason": "项目组权限调整",
  "operatedBy": "user-admin",
  "operatedAt": "2026-07-16T10:35:00.000+08:00"
}
```

#### 5.4.4 USER_ROLE_CHANGED

```json
{
  "userId": "user-001",
  "username": "zhangsan",
  "realName": "张三",
  "action": "ADD_ROLE",
  "addedRoleIds": ["role-pm-001"],
  "removedRoleIds": [],
  "currentRoleIds": ["role-developer", "role-pm-001"],
  "addedRoles": [
    { "roleId": "role-pm-001", "roleCode": "PROJECT_MANAGER", "roleName": "项目经理", "dataScope": "DEPT_AND_SUB" }
  ],
  "reason": "晋升项目经理",
  "operatedBy": "user-admin",
  "operatedAt": "2026-07-16T10:40:00.000+08:00"
}
```

#### 5.4.5 API_KEY_REVOKED

```json
{
  "keyId": "apikey-9a8b7c6d",
  "name": "数字员工-数据查询",
  "apiKeyPrefix": "mp-ak-xxxx",
  "ownerId": "user-9a8b7c6d",
  "previousStatus": "ACTIVE",
  "currentStatus": "REVOKED",
  "reason": "密钥泄漏，紧急吊销",
  "operatedBy": "user-9a8b7c6d",
  "operatedAt": "2026-07-16T10:35:00.000+08:00"
}
```

### 5.5 Outbox 模式实现

#### 5.5.1 写入流程

1. 业务事务中，将事件写入 `iam_outbox` 表（与业务数据在同一数据库事务中提交）
2. 独立的 Outbox Publisher 线程轮询 `iam_outbox` 表中 `status = 'PENDING'` 的记录
3. Publisher 将事件发送到 Kafka，发送成功后更新 `status = 'SENT'`
4. 发送失败时递增 `retry_count`，若超过 `max_retries` 则 `status = 'FAILED'`

```
[业务事务开始]
  -> 写入 iam_user（用户数据）
  -> 写入 iam_user_role（角色关联）
  -> 写入 iam_outbox（USER_CREATED 事件，与业务数据同一事务）
[业务事务提交]

[Outbox Publisher 线程]
  -> 查询 iam_outbox WHERE status = 'PENDING' ORDER BY created_at
  -> 发送到 Kafka（topic = iam.user.events）
  -> 更新 iam_outbox SET status = 'SENT', sent_at = NOW()
  -> 若失败：retry_count++，next_retry_at = NOW() + 退避间隔
  -> 若 retry_count > max_retries：status = 'FAILED'，写入 iam.dlq
```

#### 5.5.2 事务保证

- Outbox 表与业务表在同一 PostgreSQL 事务中写入，保证原子性
- Outbox Publisher 使用 `SELECT ... FOR UPDATE SKIP LOCKED` 避免多实例重复消费
- Kafka 发送成功后才更新 Outbox 状态，保证 at-least-once 语义
- 消费方需实现幂等处理（基于 `eventId` 去重）

#### 5.5.3 DLQ 处理

- 超过最大重试次数的事件进入 DLQ（`iam.dlq` topic）
- DLQ 消息保留 `traceId` 字段用于故障诊断
- DLQ 消息保留原始事件 payload，支持人工重放
- 运维告警：DLQ 有新消息时触发告警通知

### 5.6 事件消费方指南

| 消费方 | 订阅 Topic | 处理逻辑 |
|---|---|---|
| TECH-WFE | iam.user.events, iam.org.events | 更新审批人解析缓存、组织架构同步 |
| TECH-ONT | iam.user.events, iam.role.events | 同步本体数据权限、刷新权限缓存 |
| TECH-LLMGW | iam.apikey.events | 同步 API Key 鉴权缓存（吊销立即生效） |
| TECH-GW | iam.user.events, iam.role.events | 网关权限缓存刷新 |
| TECH-MCP | iam.user.events, iam.role.events | MCP 资源/工具访问权限缓存刷新 |
| TECH-A2A | iam.user.events | A2A Agent 身份信息同步 |
| APP-DASHBOARD | iam.user.events | 用户状态展示更新 |
| APP-APPHUB | iam.role.events, iam.permission.events | 应用内权限控制刷新 |
| TECH-MSG | 所有 | 统一消息推送（用户禁用通知、权限变更通知） |

**消费方幂等处理**

```java
// 伪代码示例
@KafkaListener(topics = "iam.user.events")
public void onUserEvent(UserEvent event) {
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

**权限缓存失效策略**

- 角色权限变更（ROLE_PERMISSION_CHANGED）：清除该角色所有用户的 `user:permissions:{userId}` 缓存
- 用户角色变更（USER_ROLE_CHANGED）：清除该用户的 `user:permissions:{userId}` 和 `user:roles:{userId}` 缓存
- 用户禁用（USER_DISABLED）：清除该用户所有 Token 与会话，加入 Token 黑名单
- API Key 吊销（API_KEY_REVOKED）：删除 `apikey:{keyHash}` 缓存

---

## 6. 增量交付计划

### 6.1 Sprint 1：用户与认证核心（M1）

**目标**：完成用户管理、登录认证、JWT Token 管理的基础能力。

| 交付项 | API | 说明 |
|---|---|---|
| 创建用户 | POST /api/v1/iam/users | 含部门/岗位/角色关联 |
| 查询用户列表 | GET /api/v1/iam/users | 分页查询、条件筛选 |
| 查询用户详情 | GET /api/v1/iam/users/{userId} | 含关联信息 |
| 更新用户信息 | PUT /api/v1/iam/users/{userId} | 乐观锁 |
| 删除用户 | DELETE /api/v1/iam/users/{userId} | 软删除 |
| 启用/禁用用户 | PATCH /api/v1/iam/users/{userId}/status | 吊销 Token |
| 重置密码 | POST /api/v1/iam/users/{userId}/password/reset | 管理员重置 |
| 修改密码 | POST /api/v1/iam/users/{userId}/password/change | 校验旧密码 |
| 头像上传 | POST /api/v1/iam/users/{userId}/avatar | MinIO 存储 |
| 登录 | POST /api/v1/iam/auth/login | 含验证码、登录限流 |
| 登出 | POST /api/v1/iam/auth/logout | Token 黑名单 |
| 刷新 Token | POST /api/v1/iam/auth/refresh | Refresh Token 轮换 |
| 当前用户信息 | GET /api/v1/iam/auth/me | - |
| 当前用户权限 | GET /api/v1/iam/auth/me/permissions | 前端权限控制 |
| 数据表 | 全部 DDL | iam_user 等核心表 |
| 基础设施 | Redis Token 管理 | 黑名单、会话、登录限流 |
| 基础设施 | Kafka Outbox | Outbox 写入 + Publisher 基础版 |

**验收标准**：能完成用户全生命周期管理，用户可通过用户名密码登录获取 JWT Token，支持 Token 刷新与登出，登录失败限流与账户锁定生效。

---

### 6.2 Sprint 2：组织架构与角色（M2）

**目标**：完成组织架构管理与角色体系，支撑审批人解析与权限分配。

| 交付项 | API | 说明 |
|---|---|---|
| 创建部门 | POST /api/v1/iam/departments | 含层级计算 |
| 查询部门列表 | GET /api/v1/iam/departments | 多条件筛选 |
| 查询部门详情 | GET /api/v1/iam/departments/{deptId} | - |
| 更新部门 | PUT /api/v1/iam/departments/{deptId} | 含层级重算 |
| 删除部门 | DELETE /api/v1/iam/departments/{deptId} | 级联与迁移 |
| 部门层级树 | GET /api/v1/iam/departments/tree | 树形结构 |
| 创建岗位 | POST /api/v1/iam/positions | - |
| 查询岗位列表 | GET /api/v1/iam/positions | - |
| 更新岗位 | PUT /api/v1/iam/positions/{positionId} | - |
| 删除岗位 | DELETE /api/v1/iam/positions/{positionId} | 人员迁移 |
| 人员部门关联 | POST /api/v1/iam/users/{userId}/departments | 主部门管理 |
| 查询部门成员 | GET /api/v1/iam/departments/{deptId}/members | 递归查询 |
| 创建角色 | POST /api/v1/iam/roles | 系统角色与自定义角色 |
| 查询角色列表 | GET /api/v1/iam/roles | - |
| 查询角色详情 | GET /api/v1/iam/roles/{roleId} | - |
| 更新角色 | PUT /api/v1/iam/roles/{roleId} | - |
| 删除角色 | DELETE /api/v1/iam/roles/{roleId} | 成员迁移 |
| 添加角色成员 | POST /api/v1/iam/roles/{roleId}/members | 批量添加 |
| 查询角色成员 | GET /api/v1/iam/roles/{roleId}/members | - |
| 移除角色成员 | DELETE /api/v1/iam/roles/{roleId}/members/{userId} | - |
| 事件发布 | iam.user.events, iam.org.events, iam.role.events | Outbox 完整版 |
| 缓存 | 部门树缓存、用户角色缓存 | Redis 缓存策略 |

**验收标准**：能管理多层级部门树与岗位，人员可关联多部门，角色可分配成员，组织架构事件正确发布。

---

### 6.3 Sprint 3：权限管理（M3）

**目标**：完成 RBAC + ABAC 权限模型、数据权限、权限检查接口。

| 交付项 | API | 说明 |
|---|---|---|
| 创建权限定义 | POST /api/v1/iam/permissions | RBAC + ABAC |
| 查询权限定义列表 | GET /api/v1/iam/permissions | - |
| 查询权限定义详情 | GET /api/v1/iam/permissions/{permissionId} | - |
| 更新权限定义 | PUT /api/v1/iam/permissions/{permissionId} | - |
| 删除权限定义 | DELETE /api/v1/iam/permissions/{permissionId} | - |
| 创建权限策略 | POST /api/v1/iam/policies | ABAC 策略声明 |
| 查询权限策略列表 | GET /api/v1/iam/policies | - |
| 角色权限分配 | POST /api/v1/iam/roles/{roleId}/permissions | 替换/增量 |
| 查询角色权限 | GET /api/v1/iam/roles/{roleId}/permissions | - |
| 数据权限配置 | POST /api/v1/iam/data-permissions | 行级/字段级 |
| 查询数据权限 | GET /api/v1/iam/data-permissions | - |
| 权限检查 | POST /api/v1/iam/permissions/check | 统一鉴权接口 |
| 事件发布 | iam.permission.events, iam.role.events | 权限变更事件 |
| 缓存 | 权限检查结果缓存、用户权限缓存 | 失效策略 |

**验收标准**：权限定义可绑定到角色，权限检查接口可正确返回 ALLOW/DENY，数据权限可控制行级与字段级访问范围，权限变更事件正确发布。

---

### 6.4 Sprint 4：SSO 与 MFA 增强（M4）

**目标**：完成 SSO 集成、多因素认证、API Key 管理。

| 交付项 | API | 说明 |
|---|---|---|
| SSO 登录 | POST /api/v1/iam/auth/sso/login | OAuth2/OIDC/SAML |
| MFA 发起绑定 | POST /api/v1/iam/auth/mfa/initiate | TOTP 密钥生成 |
| MFA 验证 | POST /api/v1/iam/auth/mfa/verify | 绑定/登录/关闭 |
| 生成 API Key | POST /api/v1/iam/api-keys | 含 IP 白名单 |
| API Key 列表 | GET /api/v1/iam/api-keys | - |
| API Key 详情 | GET /api/v1/iam/api-keys/{keyId} | - |
| 吊销 API Key | DELETE /api/v1/iam/api-keys/{keyId} | 立即失效 |
| API Key 权限绑定 | POST /api/v1/iam/api-keys/{keyId}/permissions | - |
| 数据表 | iam_mfa_secret, iam_sso_binding, iam_api_key | - |
| 缓存 | API Key 缓存、MFA 临时会话 | Redis |
| 事件发布 | iam.apikey.events | API Key 生命周期 |

**验收标准**：支持飞书/钉钉等 SSO 登录，MFA 绑定与登录验证流程完整，API Key 可生成/吊销/绑定权限且立即生效。

---

### 6.5 Sprint 5：审计与优化（M5）

**目标**：完成操作审计日志体系，性能优化与安全增强。

| 交付项 | API | 说明 |
|---|---|---|
| 操作日志查询 | GET /api/v1/iam/audit/operations | 多维度检索 |
| 登录日志查询 | GET /api/v1/iam/audit/logins | 含设备信息 |
| 权限变更日志 | GET /api/v1/iam/audit/permission-changes | 变更前后对比 |
| 数据表 | iam_audit_operation, iam_audit_login, iam_audit_permission_change | 按月分区 |
| 审计切面 | AOP 审计注解 | 自动记录写操作 |
| 权限缓存优化 | 多级缓存 | 本地缓存 + Redis |
| 密码安全增强 | 密码历史、弱密码库 | 防止密码复用 |
| 登录安全增强 | 异地登录检测、设备信任 | 安全告警 |
| 租户隔离 | 多租户数据隔离 | 行级安全策略 |
| 性能压测 | 全链路压测 | 目标 500 TPS |
| 数据归档 | 定时任务 | 审计日志分区归档 |

**验收标准**：所有写操作有审计记录，审计日志支持多维度检索与 traceId 追溯，通过全链路性能压测，多租户隔离正确。

---

## 附录 A：枚举值速查表

| 枚举 | 值 | 说明 |
|---|---|---|
| UserStatus | ENABLED / DISABLED / LOCKED | 用户状态 |
| RoleType | SYSTEM / CUSTOM | 角色类型 |
| DataScope | ALL / DEPT / DEPT_AND_SUB / SELF / CUSTOM | 数据范围 |
| PermissionEffect | ALLOW / DENY | 权限效果 |
| PermissionAction | READ / CREATE / UPDATE / DELETE / EXPORT / IMPORT / ADMIN | 操作类型 |
| ApiKeyStatus | ACTIVE / REVOKED / EXPIRED | API Key 状态 |
| LoginType | PASSWORD / SSO / MFA | 登录类型 |
| LoginResult | SUCCESS / FAILED / LOCKED | 登录结果 |
| AuditModule | USER / DEPARTMENT / ROLE / PERMISSION / AUTH / API_KEY | 审计模块 |
| SsoProtocol | OAUTH2 / OIDC / SAML | SSO 协议 |
| MfaMethod | TOTP | MFA 方式 |
| MfaScenario | BIND / LOGIN / DISABLE | MFA 场景 |
| ChangeType | ROLE_PERMISSION / USER_ROLE / DATA_PERMISSION / POLICY_CHANGE | 权限变更类型 |
| FieldScope | ALL / CUSTOM | 字段级范围 |
| OutboxStatus | PENDING / SENT / FAILED | Outbox 状态 |

---

## 附录 B：JWT Token 声明（Claims）

| Claim | 说明 |
|---|---|
| iss | 签发方（固定 `MatePlatform-IAM`） |
| sub | 用户 ID（userId） |
| aud | 受众（固定 `MatePlatform`） |
| exp | 过期时间（Unix 时间戳） |
| iat | 签发时间 |
| jti | Token 唯一 ID（用于黑名单） |
| tenant_id | 租户 ID |
| username | 用户名 |
| real_name | 真实姓名 |
| roles | 角色编码列表 |
| permissions | 权限编码列表（摘要） |
| dept_id | 主部门 ID |
| dept_path | 主部门路径 |
| token_type | token 类型：access / refresh |
| device_id | 设备标识 |
| login_ip | 登录 IP |

---

## 附录 C：API 速查索引

| 编号 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 3.1.1 | POST | /api/v1/iam/users | 创建用户 |
| 3.1.2 | GET | /api/v1/iam/users | 查询用户列表 |
| 3.1.3 | GET | /api/v1/iam/users/{userId} | 查询用户详情 |
| 3.1.4 | PUT | /api/v1/iam/users/{userId} | 更新用户信息 |
| 3.1.5 | DELETE | /api/v1/iam/users/{userId} | 删除用户 |
| 3.1.6 | PATCH | /api/v1/iam/users/{userId}/status | 启用/禁用用户 |
| 3.1.7 | POST | /api/v1/iam/users/{userId}/password/reset | 重置密码 |
| 3.1.8 | POST | /api/v1/iam/users/{userId}/password/change | 修改密码 |
| 3.1.9 | POST | /api/v1/iam/users/{userId}/avatar | 上传头像 |
| 3.2.1 | POST | /api/v1/iam/departments | 创建部门 |
| 3.2.2 | GET | /api/v1/iam/departments | 查询部门列表 |
| 3.2.3 | GET | /api/v1/iam/departments/{deptId} | 查询部门详情 |
| 3.2.4 | PUT | /api/v1/iam/departments/{deptId} | 更新部门 |
| 3.2.5 | DELETE | /api/v1/iam/departments/{deptId} | 删除部门 |
| 3.2.6 | GET | /api/v1/iam/departments/tree | 部门层级树 |
| 3.2.7 | POST | /api/v1/iam/positions | 创建岗位 |
| 3.2.8 | GET | /api/v1/iam/positions | 查询岗位列表 |
| 3.2.9 | PUT | /api/v1/iam/positions/{positionId} | 更新岗位 |
| 3.2.10 | DELETE | /api/v1/iam/positions/{positionId} | 删除岗位 |
| 3.2.11 | POST | /api/v1/iam/users/{userId}/departments | 人员部门关联 |
| 3.2.12 | GET | /api/v1/iam/departments/{deptId}/members | 查询部门成员 |
| 3.3.1 | POST | /api/v1/iam/roles | 创建角色 |
| 3.3.2 | GET | /api/v1/iam/roles | 查询角色列表 |
| 3.3.3 | GET | /api/v1/iam/roles/{roleId} | 查询角色详情 |
| 3.3.4 | PUT | /api/v1/iam/roles/{roleId} | 更新角色 |
| 3.3.5 | DELETE | /api/v1/iam/roles/{roleId} | 删除角色 |
| 3.3.6 | POST | /api/v1/iam/roles/{roleId}/permissions | 分配角色权限 |
| 3.3.7 | GET | /api/v1/iam/roles/{roleId}/permissions | 查询角色权限 |
| 3.3.8 | POST | /api/v1/iam/roles/{roleId}/members | 添加角色成员 |
| 3.3.9 | GET | /api/v1/iam/roles/{roleId}/members | 查询角色成员 |
| 3.3.10 | DELETE | /api/v1/iam/roles/{roleId}/members/{userId} | 移除角色成员 |
| 3.4.1 | POST | /api/v1/iam/permissions | 创建权限定义 |
| 3.4.2 | GET | /api/v1/iam/permissions | 查询权限定义列表 |
| 3.4.3 | GET | /api/v1/iam/permissions/{permissionId} | 查询权限定义详情 |
| 3.4.4 | PUT | /api/v1/iam/permissions/{permissionId} | 更新权限定义 |
| 3.4.5 | DELETE | /api/v1/iam/permissions/{permissionId} | 删除权限定义 |
| 3.4.6 | POST | /api/v1/iam/policies | 创建权限策略 |
| 3.4.7 | GET | /api/v1/iam/policies | 查询权限策略列表 |
| 3.4.8 | POST | /api/v1/iam/data-permissions | 数据权限配置 |
| 3.4.9 | GET | /api/v1/iam/data-permissions | 查询数据权限配置 |
| 3.4.10 | POST | /api/v1/iam/permissions/check | 权限检查 |
| 3.5.1 | POST | /api/v1/iam/auth/login | 登录 |
| 3.5.2 | POST | /api/v1/iam/auth/logout | 登出 |
| 3.5.3 | POST | /api/v1/iam/auth/refresh | 刷新 Token |
| 3.5.4 | POST | /api/v1/iam/auth/sso/login | SSO 登录 |
| 3.5.5 | POST | /api/v1/iam/auth/mfa/initiate | MFA 发起绑定 |
| 3.5.6 | POST | /api/v1/iam/auth/mfa/verify | MFA 验证 |
| 3.5.7 | GET | /api/v1/iam/auth/me | 当前用户信息 |
| 3.5.8 | GET | /api/v1/iam/auth/me/permissions | 当前用户权限 |
| 3.6.1 | POST | /api/v1/iam/api-keys | 生成 API Key |
| 3.6.2 | GET | /api/v1/iam/api-keys | API Key 列表 |
| 3.6.3 | GET | /api/v1/iam/api-keys/{keyId} | API Key 详情 |
| 3.6.4 | DELETE | /api/v1/iam/api-keys/{keyId} | 吊销 API Key |
| 3.6.5 | POST | /api/v1/iam/api-keys/{keyId}/permissions | API Key 权限绑定 |
| 3.7.1 | GET | /api/v1/iam/audit/operations | 操作日志查询 |
| 3.7.2 | GET | /api/v1/iam/audit/logins | 登录日志查询 |
| 3.7.3 | GET | /api/v1/iam/audit/permission-changes | 权限变更日志 |
