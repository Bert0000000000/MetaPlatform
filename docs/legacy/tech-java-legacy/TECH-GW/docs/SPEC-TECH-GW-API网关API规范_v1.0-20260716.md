# SPEC - API 网关服务 API 规范（TECH-GW）

> 文档版本：v1.0
> 文档日期：2026-07-16
> 适用模块：TECH-GW（API Gateway Service）
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

TECH-GW 是 Mate Platform 的**统一 API 网关服务**，作为平台所有后端服务对外暴露的唯一入口。基于 Spring Cloud Gateway 构建，TECH-GW 提供路由分发、流量控制（限流）、认证集成、协议转换、灰度发布、熔断降级与全量请求审计等企业级网关能力，确保平台 API 的安全、稳定、可观测。

平台架构约束规定：**所有外部请求必须通过 TECH-GW 进入平台**。APP-DASHBOARD、APP-SUPERAI、APP-DW、APP-APPHUB、APP-ONTSTUDIO、APP-ARCH、APP-MCPHUB 等应用前端以及外部第三方调用方均通过 TECH-GW 统一路由到后端 TECH 服务。

核心职责：

- **路由管理**：API 路由配置、路由规则（Path / Host / Header 匹配）、服务发现集成、路由优先级管理、路由启停
- **限流管理**：限流规则配置（QPS / 并发 / Token）、限流策略（全局限流 / 用户限流 / IP 限流 / 应用限流）、限流统计查询
- **认证集成**：与 TECH-IAM 集成的 JWT 验证、API Key 验证、Token 透传、认证规则按路由粒度配置
- **API 管理**：API 注册、API 分组管理、API 版本管理、OpenAPI 文档聚合导出
- **请求审计**：请求日志、响应日志、调用链追踪（trace_id 全链路关联）
- **灰度发布**：流量分配（按权重 / Header / Cookie）、灰度规则 CRUD、灰度统计
- **熔断降级**：熔断规则配置、降级策略（返回默认值 / 重定向 / 返回错误页）、熔断状态查询、手动恢复

### 1.2 技术栈

| 层级 | 技术 | 版本 | 用途 |
|---|---|---|---|
| 语言/框架 | Java + Spring Boot | 21 / 3.4 | 基础运行时 |
| 网关框架 | Spring Cloud Gateway | 4.1 | 响应式 API 网关内核，基于 Netty + Reactor |
| 服务发现 | Kubernetes Service + Istio | 1.32 / 1.24 | 服务注册发现与负载均衡 |
| 持久化 | PostgreSQL | 17 | 路由配置、限流规则、认证规则、API 注册信息、审计日志 |
| 缓存 | Redis | 7.4 | 限流计数器、路由缓存、认证缓存、熔断状态、灰度规则缓存 |
| 消息队列 | Kafka | 3.9 | 网关事件发布（请求审计、限流触发、熔断事件等，Outbox 模式） |
| 可观测性 | OpenTelemetry + Prometheus | 1.45 / 3.x | trace_id 传播、指标采集、延迟监控 |
| 熔断器 | Resilience4j | 2.2 | 熔断、隔离、限流、重试 |
| 配置中心 | Kubernetes ConfigMap + Nacos | - | 动态路由配置热更新 |

### 1.3 上游依赖

| 上游服务 | 依赖关系 | 说明 |
|---|---|---|
| TECH-IAM | 强依赖 | JWT Token 验证、API Key 鉴权、用户权限校验、租户身份解析 |
| TECH-OBS | 弱依赖 | 可观测性指标上报、trace_id 采集 |
| TECH-MSG | 弱依赖 | Kafka 消息基础设施（审计事件、限流事件、熔断事件发布） |
| Kubernetes Service | 强依赖 | 后端服务发现与负载均衡 |
| Istio | 强依赖 | Service Mesh 层提供 mTLS、流量管理、可观测性 |

> 说明：TECH-GW 的核心上游是 TECH-IAM（认证鉴权），所有经过网关的请求均需通过 TECH-IAM 完成身份验证。TECH-GW 通过 Kubernetes Service + Istio 发现并路由到所有后端 TECH 服务与 APP 服务。

### 1.4 下游消费方

| 下游服务/应用 | 消费方式 | 说明 |
|---|---|---|
| APP-DASHBOARD | HTTP 反向代理 | 仪表盘前端请求通过网关路由到后端 |
| APP-SUPERAI | HTTP 反向代理 | 超级 AI 对话请求通过网关路由到后端 |
| APP-DW | HTTP 反向代理 | 数字员工请求通过网关路由到后端 |
| APP-APPHUB | HTTP 反向代理 | 低代码应用与流程设计器请求通过网关路由 |
| APP-ONTSTUDIO | HTTP 反向代理 | 本体论引擎前端请求通过网关路由 |
| APP-ARCH | HTTP 反向代理 | 架构中心前端请求通过网关路由 |
| APP-MCPHUB | HTTP 反向代理 | MCP 服务中心前端请求通过网关路由 |
| TECH-ONT | HTTP 路由 | 本体引擎服务路由目标 |
| TECH-WFE | HTTP 路由 | 工作流引擎服务路由目标 |
| TECH-RULE | HTTP 路由 | 规则引擎服务路由目标 |
| TECH-ACTION | HTTP 路由 | Action Engine 服务路由目标 |
| TECH-RAG | HTTP 路由 | RAG 引擎服务路由目标 |
| TECH-AGENT | HTTP 路由 | Agent 框架服务路由目标 |
| TECH-LLMGW | HTTP 路由 | LLM Gateway 服务路由目标（SSE 流式透传） |
| TECH-MCP | HTTP 路由 | MCP 协议适配服务路由目标 |
| TECH-A2A | HTTP 路由 | A2A 协议适配服务路由目标 |
| TECH-EA | HTTP 路由 | EA 架构资产服务路由目标 |
| TECH-DATA | HTTP 路由 | 数据集成服务路由目标 |
| TECH-IAM | HTTP 路由 | 身份认证服务路由目标 |
| 外部调用方 | HTTP API | 第三方系统通过 API Key 调用平台 API |

### 1.5 核心能力清单

| 能力域 | 说明 |
|---|---|
| 路由管理 | 路由 CRUD、路由规则（Path/Host/Header）、路由优先级、路由启停、服务发现集成 |
| 限流管理 | 限流规则 CRUD（QPS/并发/Token）、限流策略（全局/用户/IP/应用）、限流统计查询 |
| 认证集成 | 认证规则配置、JWT 验证、API Key 验证、Token 透传、白名单路径 |
| API 管理 | API 注册、API 分组、API 版本管理、OpenAPI 文档聚合导出 |
| 请求审计 | 请求日志、响应日志、调用链追踪、慢请求分析 |
| 灰度发布 | 灰度规则 CRUD、流量分配（权重/Header/Cookie）、灰度统计、A/B 测试 |
| 熔断降级 | 熔断规则 CRUD、降级策略、熔断状态查询、手动恢复/强制熔断 |

### 1.6 核心概念

| 概念 | 说明 |
|---|---|
| Route | 路由规则，定义请求匹配条件（Path/Host/Header）与转发目标（URI/服务名） |
| Route Predicate | 路由谓词，请求匹配条件，如 Path、Host、Header、Method、Query |
| Route Filter | 路由过滤器，请求/响应处理链，如限流、认证、日志、重写 |
| Rate Limit Rule | 限流规则，定义限流维度（全局/用户/IP/应用）、限流类型（QPS/并发/Token）、阈值 |
| Auth Rule | 认证规则，定义某路由的认证方式（JWT/API Key/None/Token Passthrough） |
| API Definition | API 注册信息，含路径、方法、所属分组、版本、后端服务映射 |
| API Group | API 分组，按业务域或服务归类管理 API |
| Audit Log | 审计日志，记录每次请求的完整信息（请求/响应/耗时/状态码） |
| Grayscale Rule | 灰度规则，定义流量分配策略（按权重/Header/Cookie 路由到不同版本） |
| Circuit Breaker Rule | 熔断规则，定义熔断条件（错误率/慢调用率）、熔断阈值、恢复策略 |
| Degradation Strategy | 降级策略，熔断触发后的响应行为（返回默认值/重定向/返回错误页） |

### 1.7 请求处理架构

TECH-GW 的请求处理核心流程：

```
[Client Request]
       |
       v
[Trace ID 生成/透传] ──── X-Trace-Id 传播
       |
       v
[路由匹配] ──── Path / Host / Header / Method Predicate
       |
       v
[认证鉴权] ──── TECH-IAM JWT / API Key 校验（按 Auth Rule）
       |
       v
[限流检查] ──── Redis 令牌桶 QPS / 并发 / Token 控制
       |
       v
[灰度路由] ──── 权重 / Header / Cookie 灰度分流
       |
       v
[熔断检查] ──── Resilience4j 熔断器状态判断
       |
       v
[请求转发] ──── 负载均衡到后端服务（K8s Service Discovery）
       |
       v
[响应处理] ──── 响应过滤、日志记录
       |
       v
[审计日志] ──── Kafka 发布请求审计事件（Outbox 模式）
       |
       v
[Response] ──── 返回客户端
```

---

## 2. 通用约定

### 2.1 API 路径前缀

所有 TECH-GW 管理 API 路径统一前缀：

```
/api/v1/gw
```

完整路径示例：`/api/v1/gw/routes`、`/api/v1/gw/rate-limits`、`/api/v1/gw/auth-rules`、`/api/v1/gw/apis`、`/api/v1/gw/audit/logs`

> 注意：管理 API 前缀为 `/api/v1/gw`，而业务请求通过网关代理转发时的路径由路由规则定义，不限于此前缀。

### 2.2 请求/响应格式

#### 2.2.1 Content-Type

- JSON 请求体：`application/json; charset=UTF-8`
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

#### 2.3.1 Bearer Token（用户调用）

通过 `Authorization` 请求头携带 JWT：

```
Authorization: Bearer <jwt_token>
```

JWT 由 TECH-IAM 签发，包含 `sub`（用户ID）、`tenantId`（租户ID）、`roles`（角色列表）、`exp`（过期时间）。

#### 2.3.2 API Key（服务间调用）

通过 `X-API-Key` 请求头携带服务间调用凭证：

```
X-API-Key: <api_key>
X-Tenant-Id: <tenant_id>
```

服务间 API Key 由 TECH-IAM 统一签发，绑定调用方服务标识与权限范围。

#### 2.3.3 管理 API 认证

TECH-GW 管理 API（`/api/v1/gw/*`）需要管理员权限：
- 认证方式：Bearer Token（JWT）
- 要求角色：`PLATFORM_ADMIN` 或 `GATEWAY_ADMIN`
- Token 由 TECH-IAM 签发

### 2.4 请求头约定

| 请求头 | 必填 | 说明 |
|---|---|---|
| Authorization | 是 | Bearer Token（与 X-API-Key 二选一） |
| X-API-Key | 否 | 服务间调用 API Key（与 Authorization 二选一） |
| X-Trace-Id | 否 | 链路追踪 ID，未传则服务端自动生成 |
| X-Tenant-Id | 是 | 租户 ID |
| X-Request-Id | 否 | 请求唯一标识，用于幂等控制 |
| Content-Type | 是 | `application/json;charset=UTF-8` |
| X-Forwarded-For | 否 | 客户端真实 IP（代理链路透传） |

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
| 429 | Too Many Requests | 限流触发 |
| 500 | Internal Server Error | 服务内部错误 |
| 502 | Bad Gateway | 后端服务返回错误 |
| 503 | Service Unavailable | 后端服务不可用（熔断） |
| 504 | Gateway Timeout | 后端服务调用超时 |

#### 2.5.2 业务错误码

| 错误码 | HTTP 状态码 | 错误标识 | 说明 |
|---|---|---|---|
| 0 | 200 | SUCCESS | 成功 |
| 40001 | 400 | INVALID_PARAM | 请求参数校验失败 |
| 40002 | 400 | INVALID_JSON | 请求体 JSON 格式错误 |
| 40003 | 400 | MISSING_REQUIRED_FIELD | 缺少必填字段 |
| 40004 | 400 | INVALID_FIELD_VALUE | 字段值不合法 |
| 40005 | 400 | UNSUPPORTED_PREDICATE_TYPE | 不支持的路由谓词类型 |
| 40006 | 400 | UNSUPPORTED_AUTH_TYPE | 不支持的认证类型 |
| 40007 | 400 | UNSUPPORTED_LIMIT_TYPE | 不支持的限流类型 |
| 40008 | 400 | UNSUPPORTED_DEGRADE_STRATEGY | 不支持的降级策略 |
| 40101 | 401 | TOKEN_EXPIRED | Token 已过期 |
| 40102 | 401 | TOKEN_INVALID | Token 无效 |
| 40103 | 401 | API_KEY_INVALID | API Key 无效 |
| 40301 | 403 | PERMISSION_DENIED | 权限不足 |
| 40302 | 403 | TENANT_MISMATCH | 租户不匹配 |
| 40401 | 404 | ROUTE_NOT_FOUND | 路由不存在 |
| 40402 | 404 | RATE_LIMIT_NOT_FOUND | 限流规则不存在 |
| 40403 | 404 | AUTH_RULE_NOT_FOUND | 认证规则不存在 |
| 40404 | 404 | API_NOT_FOUND | API 定义不存在 |
| 40405 | 404 | API_GROUP_NOT_FOUND | API 分组不存在 |
| 40406 | 404 | AUDIT_LOG_NOT_FOUND | 审计日志不存在 |
| 40407 | 404 | GRAYSCALE_NOT_FOUND | 灰度规则不存在 |
| 40408 | 404 | CIRCUIT_BREAKER_NOT_FOUND | 熔断规则不存在 |
| 40409 | 404 | BACKEND_SERVICE_NOT_FOUND | 后端服务不存在 |
| 40901 | 409 | ROUTE_PATH_EXISTS | 路由路径已存在 |
| 40902 | 409 | ROUTE_NAME_EXISTS | 路由名称已存在 |
| 40903 | 409 | RATE_LIMIT_EXISTS | 限流规则已存在 |
| 40904 | 409 | API_PATH_EXISTS | API 路径已存在 |
| 40905 | 409 | API_GROUP_EXISTS | API 分组名称已存在 |
| 40906 | 409 | GRAYSCALE_EXISTS | 灰度规则已存在 |
| 40907 | 409 | CIRCUIT_BREAKER_EXISTS | 熔断规则已存在 |
| 40908 | 409 | VERSION_CONFLICT | 乐观锁版本冲突 |
| 42201 | 422 | ROUTE_DISABLED | 路由已禁用 |
| 42202 | 422 | BACKEND_UNAVAILABLE | 后端服务不可用 |
| 42203 | 422 | CIRCUIT_OPEN | 熔断器已打开 |
| 42204 | 422 | INVALID_GRAYSCALE_WEIGHT | 灰度权重总和必须为 100 |
| 42205 | 422 | INVALID_PRIORITY | 路由优先级冲突 |
| 42206 | 422 | ROUTE_IN_USE | 路由被引用，无法删除 |
| 42901 | 429 | RATE_LIMIT_EXCEEDED | QPS 限流触发 |
| 42902 | 429 | CONCURRENT_LIMIT_EXCEEDED | 并发数超限 |
| 42903 | 429 | TOKEN_LIMIT_EXCEEDED | Token 限流触发 |
| 50001 | 500 | INTERNAL_ERROR | 服务内部错误 |
| 50002 | 500 | DATABASE_ERROR | 数据库操作失败 |
| 50003 | 500 | REDIS_ERROR | Redis 操作失败 |
| 50004 | 500 | KAFKA_PUBLISH_FAILED | Kafka 消息发布失败 |
| 50005 | 500 | IAM_SERVICE_ERROR | TECH-IAM 服务调用失败 |
| 50006 | 500 | ROUTE_REFRESH_FAILED | 路由配置刷新失败 |
| 50301 | 503 | SERVICE_UNAVAILABLE | 服务暂不可用 |
| 50302 | 503 | CIRCUIT_BREAKER_OPEN | 熔断器打开，服务降级中 |
| 50401 | 504 | GATEWAY_TIMEOUT | 网关请求后端超时 |

**错误响应示例**：

```json
{
  "code": 42901,
  "message": "QPS 限流触发: routeId=route-001, limit=100, current=101",
  "data": {
    "routeId": "route-001",
    "limitType": "QPS",
    "limit": 100,
    "current": 101,
    "scope": "USER",
    "scopeId": "user-001",
    "retryAfter": 1
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

- 客户端通过 HTTP Header `X-Trace-Id` 传入 trace_id
- 若未传入，TECH-GW 自动生成 UUID v4 作为 trace_id
- trace_id 写入 Reactor Context 与 MDC（SLF4J MDC），贯穿整个请求处理链路

#### 2.7.2 出站传播

- 所有响应体的 `traceId` 字段携带当前请求的 trace_id
- 转发请求到后端服务时，在请求头中携带 `X-Trace-Id`
- 所有 Kafka 消息（Outbox 模式）的 Header 包含 `X-Trace-Id`
- 审计日志记录中包含 `trace_id` 字段
- OpenTelemetry Span 携带 trace_id，上报至 Jaeger / Tempo

#### 2.7.3 DLQ 记录

- 消费失败的 Kafka 消息写入 DLQ 时，记录体必须包含 `traceId` 字段
- DLQ 消息重试上限：3 次，超过后进入死信存储

### 2.8 幂等控制

- 写操作支持幂等：客户端传递 `X-Request-Id` 请求头
- 服务端基于 `(tenantId, requestType, requestId)` 做幂等去重
- 幂等窗口：24 小时
- 同一 `X-Request-Id` 重复请求返回首次结果

### 2.9 路由配置热更新

- 路由配置变更后，通过 Redis Pub/Sub 通知所有网关实例
- 网关实例收到通知后从 PostgreSQL 拉取最新配置并刷新路由表
- 配置刷新为原子操作，不影响正在处理的请求
- 刷新失败时保留旧配置并告警，不应用部分更新
- 配置生效延迟：P99 < 3 秒

---

## 3. API 接口详情

### 3.1 路由管理 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/gw/routes` | 创建路由 |
| GET | `/api/v1/gw/routes` | 路由列表（分页） |
| GET | `/api/v1/gw/routes/{routeId}` | 获取路由详情 |
| PUT | `/api/v1/gw/routes/{routeId}` | 更新路由 |
| DELETE | `/api/v1/gw/routes/{routeId}` | 删除路由 |
| PUT | `/api/v1/gw/routes/{routeId}/state` | 启用/禁用路由 |
| PUT | `/api/v1/gw/routes/{routeId}/priority` | 调整路由优先级 |
| GET | `/api/v1/gw/routes/{routeId}/predicates` | 查看路由谓词列表 |
| PUT | `/api/v1/gw/routes/{routeId}/predicates` | 更新路由谓词 |
| GET | `/api/v1/gw/routes/{routeId}/filters` | 查看路由过滤器列表 |
| PUT | `/api/v1/gw/routes/{routeId}/filters` | 更新路由过滤器 |
| POST | `/api/v1/gw/routes/refresh` | 手动刷新路由配置 |
| GET | `/api/v1/gw/routes/{routeId}/test` | 路由匹配测试 |

---

#### 3.1.1 创建路由

创建一条新的网关路由规则，定义请求匹配条件与转发目标。

**POST** `/api/v1/gw/routes`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| routeName | string | 是 | 路由名称，同一租户内唯一，1-128 字符 |
| description | string | 否 | 路由描述，最长 1024 字符 |
| predicates | array | 是 | 路由谓词列表，至少 1 条 |
| predicates[].type | string | 是 | 谓词类型：`PATH` / `HOST` / `HEADER` / `METHOD` / `QUERY` / `AFTER` / `BEFORE` / `BETWEEN` / `COOKIE` |
| predicates[].args | object | 是 | 谓词参数，key-value 结构（因谓词类型而异） |
| filters | array | 否 | 路由过滤器列表 |
| filters[].type | string | 是 | 过滤器类型：`REWRITE_PATH` / `ADD_HEADER` / `REMOVE_HEADER` / `SET_STATUS` / `RETRY` / `PREFIX_PATH` / `STRIP_PREFIX` |
| filters[].args | object | 是 | 过滤器参数，key-value 结构 |
| targetUri | string | 条件必填 | 转发目标 URI，如 `lb://tech-ont-service`。与 `serviceName` 二选一 |
| serviceName | string | 条件必填 | 后端服务名称（K8s Service 名称），如 `tech-ont-service`。与 `targetUri` 二选一 |
| targetPath | string | 否 | 转发目标路径，支持路径重写后的目标路径 |
| priority | integer | 否 | 路由优先级，数值越小优先级越高，默认 100，范围 1-999 |
| metadata | object | 否 | 扩展元数据 |
| status | string | 否 | 初始状态，默认 `ENABLED`，可选 `ENABLED` / `DISABLED` |

**谓词参数说明**

| 谓词类型 | 参数 | 说明 |
|---|---|---|
| PATH | `pattern` | 路径匹配模式，如 `/api/v1/ont/**` |
| HOST | `pattern` | Host 匹配模式，如 `**.metaplatform.com` |
| HEADER | `header`, `regexp` | 请求头名称与正则匹配值 |
| METHOD | `methods` | HTTP 方法列表，如 `["GET","POST"]` |
| QUERY | `param`, `regexp` | 查询参数名与正则匹配值 |
| COOKIE | `name`, `regexp` | Cookie 名称与正则匹配值 |
| AFTER | `datetime` | 在指定时间之后匹配（ISO 8601） |
| BEFORE | `datetime` | 在指定时间之前匹配（ISO 8601） |
| BETWEEN | `datetime1`, `datetime2` | 在两个时间之间匹配（ISO 8601） |

**请求示例**

```json
{
  "routeName": "ont-concepts-route",
  "description": "本体概念 API 路由，转发到 TECH-ONT 服务",
  "predicates": [
    {
      "type": "PATH",
      "args": {
        "pattern": "/api/v1/ont/concepts/**"
      }
    },
    {
      "type": "METHOD",
      "args": {
        "methods": ["GET", "POST", "PUT", "DELETE"]
      }
    }
  ],
  "filters": [
    {
      "type": "ADD_HEADER",
      "args": {
        "name": "X-Gateway-Source",
        "value": "tech-gw"
      }
    }
  ],
  "serviceName": "tech-ont-service",
  "priority": 50,
  "metadata": {
    "owner": "platform-team",
    "apiGroup": "ontology"
  },
  "status": "ENABLED"
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route",
    "description": "本体概念 API 路由，转发到 TECH-ONT 服务",
    "predicates": [
      {
        "type": "PATH",
        "args": { "pattern": "/api/v1/ont/concepts/**" }
      },
      {
        "type": "METHOD",
        "args": { "methods": ["GET", "POST", "PUT", "DELETE"] }
      }
    ],
    "filters": [
      {
        "type": "ADD_HEADER",
        "args": { "name": "X-Gateway-Source", "value": "tech-gw" }
      }
    ],
    "targetUri": "lb://tech-ont-service",
    "serviceName": "tech-ont-service",
    "priority": 50,
    "status": "ENABLED",
    "metadata": {
      "owner": "platform-team",
      "apiGroup": "ontology"
    },
    "version": 1,
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "createdBy": "user-admin",
    "updatedAt": "2026-07-16T10:30:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | routeName 为空或长度不合法 |
| 40003 | predicates 为空或缺少必填参数 |
| 40005 | 谓词类型不支持 |
| 40901 | 路由路径模式与已有路由冲突 |
| 40902 | routeName 已存在 |
| 42205 | priority 与同路径模式的其他路由冲突 |
| 40409 | serviceName 对应的后端服务未注册 |

---

#### 3.1.2 查询路由列表

分页查询当前租户下的路由列表，支持多条件筛选。

**GET** `/api/v1/gw/routes`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序字段，默认 `priority:asc,createdAt:desc` |
| keyword | string | 否 | 关键词，匹配 routeName / description |
| status | string | 否 | 路由状态：`ENABLED` / `DISABLED` |
| serviceName | string | 否 | 后端服务名称筛选 |
| pathPattern | string | 否 | 路径模式模糊匹配 |
| priorityMin | integer | 否 | 优先级下限 |
| priorityMax | integer | 否 | 优先级上限 |
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
        "routeId": "route-9a8b7c6d2026",
        "routeName": "ont-concepts-route",
        "description": "本体概念 API 路由",
        "pathPattern": "/api/v1/ont/concepts/**",
        "serviceName": "tech-ont-service",
        "priority": 50,
        "status": "ENABLED",
        "predicateCount": 2,
        "filterCount": 1,
        "createdAt": "2026-07-01T10:00:00.000+08:00",
        "updatedAt": "2026-07-16T10:30:00.000+08:00"
      },
      {
        "routeId": "route-112233445566",
        "routeName": "llmgw-chat-route",
        "description": "LLM 对话 API 路由",
        "pathPattern": "/api/v1/llmgw/chat/**",
        "serviceName": "tech-llmgw-service",
        "priority": 30,
        "status": "ENABLED",
        "predicateCount": 1,
        "filterCount": 2,
        "createdAt": "2026-07-02T14:00:00.000+08:00",
        "updatedAt": "2026-07-15T09:00:00.000+08:00"
      }
    ],
    "total": 48,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | status 枚举值不合法 |
| 40301 | 当前用户无路由查看权限 |

---

#### 3.1.3 获取路由详情

查询单个路由的完整信息，包括谓词、过滤器、转发目标等。

**GET** `/api/v1/gw/routes/{routeId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| routeId | string | 是 | 路由 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route",
    "description": "本体概念 API 路由，转发到 TECH-ONT 服务",
    "predicates": [
      {
        "type": "PATH",
        "args": { "pattern": "/api/v1/ont/concepts/**" }
      },
      {
        "type": "METHOD",
        "args": { "methods": ["GET", "POST", "PUT", "DELETE"] }
      }
    ],
    "filters": [
      {
        "type": "ADD_HEADER",
        "args": { "name": "X-Gateway-Source", "value": "tech-gw" }
      }
    ],
    "targetUri": "lb://tech-ont-service",
    "serviceName": "tech-ont-service",
    "targetPath": null,
    "priority": 50,
    "status": "ENABLED",
    "metadata": {
      "owner": "platform-team",
      "apiGroup": "ontology"
    },
    "version": 3,
    "createdAt": "2026-07-01T10:00:00.000+08:00",
    "createdBy": "user-admin",
    "updatedAt": "2026-07-16T10:30:00.000+08:00",
    "updatedBy": "user-zhangsan"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | routeId 不存在 |
| 40301 | 无权查看该路由 |

---

#### 3.1.4 更新路由

更新路由的基本信息、谓词、过滤器与转发目标。

**PUT** `/api/v1/gw/routes/{routeId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| routeId | string | 是 | 路由 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| routeName | string | 否 | 路由名称 |
| description | string | 否 | 路由描述 |
| predicates | array | 否 | 路由谓词列表 |
| filters | array | 否 | 路由过滤器列表 |
| targetUri | string | 否 | 转发目标 URI |
| serviceName | string | 否 | 后端服务名称 |
| targetPath | string | 否 | 转发目标路径 |
| priority | integer | 否 | 路由优先级 |
| metadata | object | 否 | 扩展元数据 |
| version | integer | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "routeName": "ont-concepts-route-v2",
  "description": "本体概念 API 路由（V2），增加限流过滤器",
  "predicates": [
    {
      "type": "PATH",
      "args": { "pattern": "/api/v1/ont/concepts/**" }
    },
    {
      "type": "METHOD",
      "args": { "methods": ["GET", "POST", "PUT", "DELETE", "PATCH"] }
    }
  ],
  "filters": [
    {
      "type": "ADD_HEADER",
      "args": { "name": "X-Gateway-Source", "value": "tech-gw" }
    },
    {
      "type": "RETRY",
      "args": { "retries": 3, "statuses": ["BAD_GATEWAY", "GATEWAY_TIMEOUT"] }
    }
  ],
  "serviceName": "tech-ont-service",
  "priority": 50,
  "version": 3
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route-v2",
    "description": "本体概念 API 路由（V2），增加限流过滤器",
    "priority": 50,
    "status": "ENABLED",
    "version": 4,
    "updatedAt": "2026-07-16T11:00:00.000+08:00",
    "updatedBy": "user-zhangsan"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | routeId 不存在 |
| 40902 | routeName 与其他路由重复 |
| 40908 | version 不匹配，乐观锁冲突 |
| 42205 | priority 与同路径模式的其他路由冲突 |

---

#### 3.1.5 删除路由

删除路由规则。若路由被限流规则、认证规则等引用，需先解除引用。

**DELETE** `/api/v1/gw/routes/{routeId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| routeId | string | 是 | 路由 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| force | boolean | 否 | 是否强制删除（级联删除关联的限流/认证规则），默认 false |
| reason | string | 否 | 删除原因 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route-v2",
    "deletedAt": "2026-07-16T11:30:00.000+08:00",
    "deletedBy": "user-admin",
    "cascadedRules": []
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | routeId 不存在 |
| 42206 | 路由被限流规则/认证规则引用且 force=false |

---

#### 3.1.6 启用/禁用路由

批量或单个启停路由。禁用后路由不再参与请求匹配。

**PUT** `/api/v1/gw/routes/{routeId}/state`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| routeId | string | 是 | 路由 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | string | 是 | 目标状态：`ENABLED` / `DISABLED` |
| reason | string | 否 | 操作原因 |

**请求示例**

```json
{
  "status": "DISABLED",
  "reason": "后端服务维护中，临时禁用路由"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route-v2",
    "previousStatus": "ENABLED",
    "currentStatus": "DISABLED",
    "updatedAt": "2026-07-16T12:00:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | routeId 不存在 |
| 42201 | 路由已处于目标状态 |

---

#### 3.1.7 调整路由优先级

调整路由的匹配优先级。数值越小优先级越高。

**PUT** `/api/v1/gw/routes/{routeId}/priority`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| routeId | string | 是 | 路由 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| priority | integer | 是 | 新优先级，范围 1-999 |
| version | integer | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "priority": 10,
  "version": 4
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "routeId": "route-9a8b7c6d2026",
    "previousPriority": 50,
    "currentPriority": 10,
    "version": 5,
    "updatedAt": "2026-07-16T12:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | routeId 不存在 |
| 40908 | version 不匹配，乐观锁冲突 |
| 42205 | priority 与同路径模式的其他路由冲突 |

---

#### 3.1.8 更新路由谓词

单独更新路由的谓词列表。

**PUT** `/api/v1/gw/routes/{routeId}/predicates`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| routeId | string | 是 | 路由 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| predicates | array | 是 | 路由谓词列表，至少 1 条 |
| version | integer | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "predicates": [
    {
      "type": "PATH",
      "args": { "pattern": "/api/v1/ont/concepts/**" }
    },
    {
      "type": "HOST",
      "args": { "pattern": "**.metaplatform.com" }
    },
    {
      "type": "METHOD",
      "args": { "methods": ["GET", "POST"] }
    }
  ],
  "version": 4
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "routeId": "route-9a8b7c6d2026",
    "predicateCount": 3,
    "version": 5,
    "updatedAt": "2026-07-16T13:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | routeId 不存在 |
| 40003 | predicates 为空 |
| 40005 | 谓词类型不支持 |
| 40908 | version 不匹配 |

---

#### 3.1.9 更新路由过滤器

单独更新路由的过滤器列表。

**PUT** `/api/v1/gw/routes/{routeId}/filters`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| routeId | string | 是 | 路由 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| filters | array | 否 | 路由过滤器列表，可为空（清空过滤器） |
| version | integer | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "filters": [
    {
      "type": "ADD_HEADER",
      "args": { "name": "X-Gateway-Source", "value": "tech-gw" }
    },
    {
      "type": "STRIP_PREFIX",
      "args": { "parts": 2 }
    },
    {
      "type": "RETRY",
      "args": { "retries": 3, "statuses": ["BAD_GATEWAY", "GATEWAY_TIMEOUT"] }
    }
  ],
  "version": 5
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "routeId": "route-9a8b7c6d2026",
    "filterCount": 3,
    "version": 6,
    "updatedAt": "2026-07-16T13:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | routeId 不存在 |
| 40908 | version 不匹配 |

---

#### 3.1.10 手动刷新路由配置

手动触发所有网关实例刷新路由配置。正常情况下配置变更后自动刷新，此接口用于手动干预。

**POST** `/api/v1/gw/routes/refresh`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| scope | string | 否 | 刷新范围：`ALL`（全部路由）/ `SINGLE`（单个路由），默认 `ALL` |
| routeId | string | 条件必填 | scope 为 `SINGLE` 时指定路由 ID |

**请求示例**

```json
{
  "scope": "ALL"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "refreshId": "rfr-20260716-000001",
    "scope": "ALL",
    "instanceCount": 3,
    "successCount": 3,
    "failedCount": 0,
    "duration": 850,
    "refreshedAt": "2026-07-16T14:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | scope 为 SINGLE 时 routeId 不存在 |
| 50006 | 路由配置刷新失败（部分实例未成功） |

---

#### 3.1.11 路由匹配测试

模拟请求测试路由匹配结果，不实际转发请求。

**GET** `/api/v1/gw/routes/{routeId}/test`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| routeId | string | 是 | 路由 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| method | string | 是 | HTTP 方法 |
| path | string | 是 | 请求路径 |
| host | string | 否 | 请求 Host |
| headers | string | 否 | 请求头，JSON 格式字符串 |
| query | string | 否 | 查询参数，JSON 格式字符串 |

**请求示例**

```
GET /api/v1/gw/routes/route-9a8b7c6d2026/test?method=GET&path=/api/v1/ont/concepts/123&host=api.metaplatform.com
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "matched": true,
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route-v2",
    "matchedPredicates": [
      { "type": "PATH", "args": { "pattern": "/api/v1/ont/concepts/**" } },
      { "type": "METHOD", "args": { "methods": ["GET", "POST"] } }
    ],
    "appliedFilters": [
      { "type": "ADD_HEADER", "args": { "name": "X-Gateway-Source", "value": "tech-gw" } }
    ],
    "targetUri": "lb://tech-ont-service",
    "finalPath": "/api/v1/ont/concepts/123"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40401 | routeId 不存在 |
| 40003 | method 或 path 参数缺失 |

---

### 3.2 限流管理 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/gw/rate-limits` | 创建限流规则 |
| GET | `/api/v1/gw/rate-limits` | 限流规则列表（分页） |
| GET | `/api/v1/gw/rate-limits/{ruleId}` | 获取限流规则详情 |
| PUT | `/api/v1/gw/rate-limits/{ruleId}` | 更新限流规则 |
| DELETE | `/api/v1/gw/rate-limits/{ruleId}` | 删除限流规则 |
| PUT | `/api/v1/gw/rate-limits/{ruleId}/state` | 启用/禁用限流规则 |
| GET | `/api/v1/gw/rate-limits/stats` | 限流统计查询 |
| GET | `/api/v1/gw/rate-limits/{ruleId}/stats` | 单条限流规则统计 |
| PUT | `/api/v1/gw/rate-limits/{ruleId}/reset` | 重置限流计数器 |

---

#### 3.2.1 创建限流规则

为指定路由或全局创建限流规则，支持 QPS、并发数、Token 多种限流类型。

**POST** `/api/v1/gw/rate-limits`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleName | string | 是 | 限流规则名称，同一租户内唯一，1-128 字符 |
| description | string | 否 | 规则描述，最长 1024 字符 |
| routeId | string | 否 | 关联路由 ID。为空表示全局限流规则 |
| scope | string | 是 | 限流维度：`GLOBAL` / `USER` / `IP` / `APP` |
| limitType | string | 是 | 限流类型：`QPS` / `CONCURRENT` / `TOKEN` |
| qpsLimit | integer | 条件必填 | QPS 上限，limitType 为 `QPS` 时必填，范围 1-100000 |
| concurrentLimit | integer | 条件必填 | 并发数上限，limitType 为 `CONCURRENT` 时必填，范围 1-10000 |
| tokenLimit | integer | 条件必填 | Token 配额上限，limitType 为 `TOKEN` 时必填，范围 1-100000000 |
| tokenWindow | string | 否 | Token 配额时间窗口：`DAILY` / `HOURLY` / `MONTHLY`，默认 `DAILY` |
| burstFactor | float | 否 | 突发因子（允许短时超出的倍数），默认 1.0，范围 1.0-5.0 |
| quotaAlertThreshold | integer | 否 | 配额预警阈值（百分比），默认 80，范围 50-99 |
| status | string | 否 | 初始状态，默认 `ENABLED`，可选 `ENABLED` / `DISABLED` |

**请求示例**

```json
{
  "ruleName": "ont-concepts-qps-limit",
  "description": "本体概念 API 用户级 QPS 限流，每用户每秒 100 次",
  "routeId": "route-9a8b7c6d2026",
  "scope": "USER",
  "limitType": "QPS",
  "qpsLimit": 100,
  "burstFactor": 1.5,
  "status": "ENABLED"
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-9a8b7c6d2026",
    "ruleName": "ont-concepts-qps-limit",
    "description": "本体概念 API 用户级 QPS 限流，每用户每秒 100 次",
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route-v2",
    "scope": "USER",
    "limitType": "QPS",
    "qpsLimit": 100,
    "concurrentLimit": null,
    "tokenLimit": null,
    "tokenWindow": null,
    "burstFactor": 1.5,
    "quotaAlertThreshold": 80,
    "status": "ENABLED",
    "version": 1,
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "createdBy": "user-admin",
    "updatedAt": "2026-07-16T10:30:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | ruleName 为空或长度不合法 |
| 40003 | limitType 为 QPS 时 qpsLimit 未提供 |
| 40007 | limitType 不支持 |
| 40401 | routeId 不存在 |
| 40903 | 同一路由 + scope + limitType 的规则已存在 |

---

#### 3.2.2 查询限流规则列表

分页查询当前租户下的限流规则列表。

**GET** `/api/v1/gw/rate-limits`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序字段，默认 `createdAt:desc` |
| keyword | string | 否 | 关键词，匹配 ruleName / description |
| status | string | 否 | 规则状态：`ENABLED` / `DISABLED` |
| routeId | string | 否 | 路由 ID 筛选 |
| scope | string | 否 | 限流维度：`GLOBAL` / `USER` / `IP` / `APP` |
| limitType | string | 否 | 限流类型：`QPS` / `CONCURRENT` / `TOKEN` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "ruleId": "rl-9a8b7c6d2026",
        "ruleName": "ont-concepts-qps-limit",
        "description": "本体概念 API 用户级 QPS 限流",
        "routeId": "route-9a8b7c6d2026",
        "routeName": "ont-concepts-route-v2",
        "scope": "USER",
        "limitType": "QPS",
        "qpsLimit": 100,
        "status": "ENABLED",
        "currentQps": 45,
        "triggeredCount": 3,
        "createdAt": "2026-07-01T10:00:00.000+08:00",
        "updatedAt": "2026-07-16T10:30:00.000+08:00"
      },
      {
        "ruleId": "rl-112233445566",
        "ruleName": "llmgw-global-concurrent-limit",
        "description": "LLM 网关全局并发限制",
        "routeId": null,
        "routeName": null,
        "scope": "GLOBAL",
        "limitType": "CONCURRENT",
        "concurrentLimit": 500,
        "status": "ENABLED",
        "currentConcurrent": 120,
        "triggeredCount": 0,
        "createdAt": "2026-07-02T14:00:00.000+08:00",
        "updatedAt": "2026-07-15T09:00:00.000+08:00"
      }
    ],
    "total": 24,
    "page": 1,
    "pageSize": 20,
    "totalPages": 2
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | status / scope / limitType 枚举值不合法 |
| 40301 | 当前用户无限流规则查看权限 |

---

#### 3.2.3 获取限流规则详情

查询单个限流规则的完整信息，包括当前实时限流计数。

**GET** `/api/v1/gw/rate-limits/{ruleId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 限流规则 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-9a8b7c6d2026",
    "ruleName": "ont-concepts-qps-limit",
    "description": "本体概念 API 用户级 QPS 限流，每用户每秒 100 次",
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route-v2",
    "scope": "USER",
    "limitType": "QPS",
    "qpsLimit": 100,
    "concurrentLimit": null,
    "tokenLimit": null,
    "tokenWindow": null,
    "burstFactor": 1.5,
    "quotaAlertThreshold": 80,
    "status": "ENABLED",
    "currentStats": {
      "currentQps": 45,
      "maxQps": 98,
      "triggeredCount": 3,
      "lastTriggeredAt": "2026-07-16T09:30:00.000+08:00",
      "totalRequests": 152340,
      "blockedRequests": 3
    },
    "version": 2,
    "createdAt": "2026-07-01T10:00:00.000+08:00",
    "createdBy": "user-admin",
    "updatedAt": "2026-07-16T10:30:00.000+08:00",
    "updatedBy": "user-zhangsan"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40402 | ruleId 不存在 |

---

#### 3.2.4 更新限流规则

更新限流规则的阈值、维度等配置。

**PUT** `/api/v1/gw/rate-limits/{ruleId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 限流规则 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleName | string | 否 | 规则名称 |
| description | string | 否 | 规则描述 |
| scope | string | 否 | 限流维度 |
| limitType | string | 否 | 限流类型 |
| qpsLimit | integer | 否 | QPS 上限 |
| concurrentLimit | integer | 否 | 并发数上限 |
| tokenLimit | integer | 否 | Token 配额上限 |
| tokenWindow | string | 否 | Token 时间窗口 |
| burstFactor | float | 否 | 突发因子 |
| quotaAlertThreshold | integer | 否 | 配额预警阈值 |
| version | integer | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "ruleName": "ont-concepts-qps-limit-v2",
  "qpsLimit": 200,
  "burstFactor": 2.0,
  "quotaAlertThreshold": 90,
  "version": 2
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-9a8b7c6d2026",
    "ruleName": "ont-concepts-qps-limit-v2",
    "qpsLimit": 200,
    "burstFactor": 2.0,
    "quotaAlertThreshold": 90,
    "version": 3,
    "updatedAt": "2026-07-16T11:00:00.000+08:00",
    "updatedBy": "user-zhangsan"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40402 | ruleId 不存在 |
| 40007 | limitType 不支持 |
| 40903 | 修改后与已有规则冲突（同路由 + scope + limitType） |
| 40908 | version 不匹配 |

---

#### 3.2.5 删除限流规则

删除限流规则，同时清除 Redis 中的限流计数器。

**DELETE** `/api/v1/gw/rate-limits/{ruleId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 限流规则 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reason | string | 否 | 删除原因 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-9a8b7c6d2026",
    "ruleName": "ont-concepts-qps-limit-v2",
    "deletedAt": "2026-07-16T11:30:00.000+08:00",
    "deletedBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40402 | ruleId 不存在 |

---

#### 3.2.6 启用/禁用限流规则

启停限流规则。禁用后不再执行限流检查。

**PUT** `/api/v1/gw/rate-limits/{ruleId}/state`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 限流规则 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | string | 是 | 目标状态：`ENABLED` / `DISABLED` |
| reason | string | 否 | 操作原因 |

**请求示例**

```json
{
  "status": "DISABLED",
  "reason": "压测期间临时关闭限流"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-9a8b7c6d2026",
    "previousStatus": "ENABLED",
    "currentStatus": "DISABLED",
    "updatedAt": "2026-07-16T12:00:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40402 | ruleId 不存在 |

---

#### 3.2.7 限流统计查询

查询限流统计数据，支持按时间范围、路由、维度等筛选。

**GET** `/api/v1/gw/rate-limits/stats`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startTime | string | 是 | 统计开始时间（ISO 8601） |
| endTime | string | 是 | 统计结束时间（ISO 8601） |
| routeId | string | 否 | 路由 ID 筛选 |
| scope | string | 否 | 限流维度筛选 |
| limitType | string | 否 | 限流类型筛选 |
| granularity | string | 否 | 时间粒度：`MINUTE` / `HOUR` / `DAY`，默认 `HOUR` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "summary": {
      "totalRequests": 1523400,
      "blockedRequests": 183,
      "blockedRate": 0.012,
      "triggeredRules": 5,
      "activeRules": 24
    },
    "byRule": [
      {
        "ruleId": "rl-9a8b7c6d2026",
        "ruleName": "ont-concepts-qps-limit-v2",
        "totalRequests": 520000,
        "blockedRequests": 120,
        "blockedRate": 0.023,
        "maxQps": 98,
        "avgQps": 45
      }
    ],
    "timeline": [
      {
        "timestamp": "2026-07-16T10:00:00.000+08:00",
        "totalRequests": 8500,
        "blockedRequests": 12,
        "avgQps": 42
      },
      {
        "timestamp": "2026-07-16T11:00:00.000+08:00",
        "totalRequests": 9200,
        "blockedRequests": 8,
        "avgQps": 51
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40003 | startTime 或 endTime 缺失 |
| 40004 | 时间范围不合法（如 endTime 早于 startTime） |

---

#### 3.2.8 单条限流规则统计

查询单条限流规则的实时统计数据与历史趋势。

**GET** `/api/v1/gw/rate-limits/{ruleId}/stats`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 限流规则 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startTime | string | 否 | 统计开始时间，默认最近 24 小时 |
| endTime | string | 否 | 统计结束时间，默认当前时间 |
| granularity | string | 否 | 时间粒度：`MINUTE` / `HOUR` / `DAY`，默认 `HOUR` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-9a8b7c6d2026",
    "ruleName": "ont-concepts-qps-limit-v2",
    "limitType": "QPS",
    "qpsLimit": 200,
    "currentQps": 45,
    "currentConcurrent": 12,
    "summary": {
      "totalRequests": 520000,
      "blockedRequests": 120,
      "blockedRate": 0.023,
      "maxQps": 198,
      "avgQps": 45,
      "triggeredCount": 120,
      "lastTriggeredAt": "2026-07-16T09:30:00.000+08:00"
    },
    "timeline": [
      {
        "timestamp": "2026-07-16T10:00:00.000+08:00",
        "totalRequests": 4500,
        "blockedRequests": 5,
        "maxQps": 85,
        "avgQps": 42
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40402 | ruleId 不存在 |

---

#### 3.2.9 重置限流计数器

手动重置限流规则的计数器（QPS 计数、并发计数、Token 配额）。

**PUT** `/api/v1/gw/rate-limits/{ruleId}/reset`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 限流规则 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| resetType | string | 否 | 重置类型：`ALL` / `QPS` / `CONCURRENT` / `TOKEN`，默认 `ALL` |
| scopeId | string | 否 | 指定重置的维度标识（如特定用户 ID / IP），为空则重置所有 |
| reason | string | 否 | 重置原因 |

**请求示例**

```json
{
  "resetType": "TOKEN",
  "scopeId": "user-001",
  "reason": "用户 Token 配额异常，手动重置"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "rl-9a8b7c6d2026",
    "resetType": "TOKEN",
    "scopeId": "user-001",
    "resetAt": "2026-07-16T13:00:00.000+08:00",
    "resetBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40402 | ruleId 不存在 |
| 50003 | Redis 计数器重置失败 |

---

### 3.3 认证管理 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/gw/auth-rules` | 创建认证规则 |
| GET | `/api/v1/gw/auth-rules` | 认证规则列表（分页） |
| GET | `/api/v1/gw/auth-rules/{ruleId}` | 获取认证规则详情 |
| PUT | `/api/v1/gw/auth-rules/{ruleId}` | 更新认证规则 |
| DELETE | `/api/v1/gw/auth-rules/{ruleId}` | 删除认证规则 |
| PUT | `/api/v1/gw/auth-rules/{ruleId}/state` | 启用/禁用认证规则 |
| GET | `/api/v1/gw/auth-rules/whitelist` | 查询白名单路径列表 |
| PUT | `/api/v1/gw/auth-rules/whitelist` | 更新白名单路径 |
| POST | `/api/v1/gw/auth-rules/{ruleId}/test` | 认证规则测试 |

---

#### 3.3.1 创建认证规则

为指定路由创建认证规则，定义该路由的认证方式（JWT/API Key/无认证/Token 透传）。

**POST** `/api/v1/gw/auth-rules`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleName | string | 是 | 认证规则名称，同一租户内唯一，1-128 字符 |
| description | string | 否 | 规则描述，最长 1024 字符 |
| routeId | string | 是 | 关联路由 ID |
| authType | string | 是 | 认证类型：`JWT` / `API_KEY` / `NONE` / `TOKEN_PASSTHROUGH` |
| jwtConfig | object | 条件必填 | authType 为 `JWT` 时的 JWT 验证配置 |
| jwtConfig.issuer | string | 否 | JWT 签发者，默认 TECH-IAM 的 issuer |
| jwtConfig.audience | string | 否 | JWT 受众 |
| jwtConfig.roles | array | 否 | 允许的角色列表，为空表示不校验角色 |
| jwtConfig.claims | object | 否 | 额外 Claims 校验，key-value 结构 |
| apiKeyConfig | object | 条件必填 | authType 为 `API_KEY` 时的 API Key 验证配置 |
| apiKeyConfig.headerName | string | 否 | API Key 请求头名称，默认 `X-API-Key` |
| apiKeyConfig.allowedKeys | array | 否 | 允许的 API Key 列表（从 TECH-IAM 同步，通常留空） |
| passthroughConfig | object | 条件必填 | authType 为 `TOKEN_PASSTHROUGH` 时的透传配置 |
| passthroughConfig.headerName | string | 否 | 透传的 Token 请求头名称，默认 `Authorization` |
| passthroughConfig.stripToken | boolean | 否 | 是否在转发前移除 Token，默认 false |
| status | string | 否 | 初始状态，默认 `ENABLED` |

**请求示例**

```json
{
  "ruleName": "ont-concepts-jwt-auth",
  "description": "本体概念 API JWT 认证，要求开发者角色",
  "routeId": "route-9a8b7c6d2026",
  "authType": "JWT",
  "jwtConfig": {
    "issuer": "tech-iam",
    "audience": "metaplatform",
    "roles": ["DEVELOPER", "PLATFORM_ADMIN"]
  },
  "status": "ENABLED"
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "auth-9a8b7c6d2026",
    "ruleName": "ont-concepts-jwt-auth",
    "description": "本体概念 API JWT 认证，要求开发者角色",
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route-v2",
    "authType": "JWT",
    "jwtConfig": {
      "issuer": "tech-iam",
      "audience": "metaplatform",
      "roles": ["DEVELOPER", "PLATFORM_ADMIN"],
      "claims": {}
    },
    "apiKeyConfig": null,
    "passthroughConfig": null,
    "status": "ENABLED",
    "version": 1,
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "createdBy": "user-admin",
    "updatedAt": "2026-07-16T10:30:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | ruleName 为空或长度不合法 |
| 40003 | authType 为 JWT 时 jwtConfig 未提供 |
| 40006 | authType 不支持 |
| 40401 | routeId 不存在 |
| 40901 | 该路由已有认证规则 |

---

#### 3.3.2 查询认证规则列表

分页查询当前租户下的认证规则列表。

**GET** `/api/v1/gw/auth-rules`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序字段，默认 `createdAt:desc` |
| keyword | string | 否 | 关键词，匹配 ruleName / description |
| status | string | 否 | 规则状态：`ENABLED` / `DISABLED` |
| routeId | string | 否 | 路由 ID 筛选 |
| authType | string | 否 | 认证类型：`JWT` / `API_KEY` / `NONE` / `TOKEN_PASSTHROUGH` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "ruleId": "auth-9a8b7c6d2026",
        "ruleName": "ont-concepts-jwt-auth",
        "description": "本体概念 API JWT 认证",
        "routeId": "route-9a8b7c6d2026",
        "routeName": "ont-concepts-route-v2",
        "authType": "JWT",
        "status": "ENABLED",
        "createdAt": "2026-07-01T10:00:00.000+08:00",
        "updatedAt": "2026-07-16T10:30:00.000+08:00"
      },
      {
        "ruleId": "auth-112233445566",
        "ruleName": "llmgw-apikey-auth",
        "description": "LLM 网关 API Key 认证",
        "routeId": "route-112233445566",
        "routeName": "llmgw-chat-route",
        "authType": "API_KEY",
        "status": "ENABLED",
        "createdAt": "2026-07-02T14:00:00.000+08:00",
        "updatedAt": "2026-07-15T09:00:00.000+08:00"
      }
    ],
    "total": 18,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | status / authType 枚举值不合法 |

---

#### 3.3.3 获取认证规则详情

查询单个认证规则的完整配置信息。

**GET** `/api/v1/gw/auth-rules/{ruleId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 认证规则 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "auth-9a8b7c6d2026",
    "ruleName": "ont-concepts-jwt-auth",
    "description": "本体概念 API JWT 认证，要求开发者角色",
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route-v2",
    "authType": "JWT",
    "jwtConfig": {
      "issuer": "tech-iam",
      "audience": "metaplatform",
      "roles": ["DEVELOPER", "PLATFORM_ADMIN"],
      "claims": {}
    },
    "apiKeyConfig": null,
    "passthroughConfig": null,
    "status": "ENABLED",
    "authStats": {
      "totalAuths": 152340,
      "successCount": 152337,
      "failureCount": 3,
      "failureRate": 0.002,
      "lastFailureAt": "2026-07-16T09:30:00.000+08:00",
      "lastFailureReason": "TOKEN_EXPIRED"
    },
    "version": 2,
    "createdAt": "2026-07-01T10:00:00.000+08:00",
    "createdBy": "user-admin",
    "updatedAt": "2026-07-16T10:30:00.000+08:00",
    "updatedBy": "user-zhangsan"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40403 | ruleId 不存在 |

---

#### 3.3.4 更新认证规则

更新认证规则的认证类型与配置。

**PUT** `/api/v1/gw/auth-rules/{ruleId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 认证规则 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleName | string | 否 | 规则名称 |
| description | string | 否 | 规则描述 |
| authType | string | 否 | 认证类型 |
| jwtConfig | object | 否 | JWT 验证配置 |
| apiKeyConfig | object | 否 | API Key 验证配置 |
| passthroughConfig | object | 否 | Token 透传配置 |
| version | integer | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "authType": "JWT",
  "jwtConfig": {
    "issuer": "tech-iam",
    "audience": "metaplatform",
    "roles": ["DEVELOPER", "PLATFORM_ADMIN", "VIEWER"],
    "claims": {
      "tenantId": "tenant-001"
    }
  },
  "version": 2
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "auth-9a8b7c6d2026",
    "ruleName": "ont-concepts-jwt-auth",
    "authType": "JWT",
    "version": 3,
    "updatedAt": "2026-07-16T11:00:00.000+08:00",
    "updatedBy": "user-zhangsan"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40403 | ruleId 不存在 |
| 40006 | authType 不支持 |
| 40908 | version 不匹配 |

---

#### 3.3.5 删除认证规则

删除认证规则。删除后该路由将不执行认证（等同 NONE）。

**DELETE** `/api/v1/gw/auth-rules/{ruleId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 认证规则 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reason | string | 否 | 删除原因 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "auth-9a8b7c6d2026",
    "ruleName": "ont-concepts-jwt-auth",
    "deletedAt": "2026-07-16T11:30:00.000+08:00",
    "deletedBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40403 | ruleId 不存在 |

---

#### 3.3.6 启用/禁用认证规则

启停认证规则。禁用后该路由不执行认证。

**PUT** `/api/v1/gw/auth-rules/{ruleId}/state`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 认证规则 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | string | 是 | 目标状态：`ENABLED` / `DISABLED` |
| reason | string | 否 | 操作原因 |

**请求示例**

```json
{
  "status": "DISABLED",
  "reason": "调试期间临时关闭认证"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "auth-9a8b7c6d2026",
    "previousStatus": "ENABLED",
    "currentStatus": "DISABLED",
    "updatedAt": "2026-07-16T12:00:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40403 | ruleId 不存在 |

---

#### 3.3.7 查询白名单路径

查询不需要认证的白名单路径列表。

**GET** `/api/v1/gw/auth-rules/whitelist`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "whitelist": [
      {
        "path": "/api/v1/iam/auth/login",
        "methods": ["POST"],
        "description": "登录接口",
        "createdAt": "2026-07-01T10:00:00.000+08:00"
      },
      {
        "path": "/api/v1/iam/auth/sso/**",
        "methods": ["GET", "POST"],
        "description": "SSO 回调",
        "createdAt": "2026-07-01T10:00:00.000+08:00"
      },
      {
        "path": "/api/v1/iam/auth/mfa/**",
        "methods": ["POST"],
        "description": "MFA 接口",
        "createdAt": "2026-07-01T10:00:00.000+08:00"
      },
      {
        "path": "/actuator/health",
        "methods": ["GET"],
        "description": "健康检查",
        "createdAt": "2026-07-01T10:00:00.000+08:00"
      }
    ],
    "total": 4
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

无特定错误场景。

---

#### 3.3.8 更新白名单路径

更新（覆盖）白名单路径列表。

**PUT** `/api/v1/gw/auth-rules/whitelist`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| whitelist | array | 是 | 白名单路径列表 |
| whitelist[].path | string | 是 | 路径模式，如 `/api/v1/iam/auth/**` |
| whitelist[].methods | array | 否 | HTTP 方法列表，为空表示所有方法 |
| whitelist[].description | string | 否 | 路径描述 |

**请求示例**

```json
{
  "whitelist": [
    {
      "path": "/api/v1/iam/auth/login",
      "methods": ["POST"],
      "description": "登录接口"
    },
    {
      "path": "/api/v1/iam/auth/sso/**",
      "methods": ["GET", "POST"],
      "description": "SSO 回调"
    },
    {
      "path": "/api/v1/iam/auth/mfa/**",
      "methods": ["POST"],
      "description": "MFA 接口"
    },
    {
      "path": "/actuator/health",
      "methods": ["GET"],
      "description": "健康检查"
    },
    {
      "path": "/api/v1/gw/routes/refresh",
      "methods": ["POST"],
      "description": "网关内部刷新接口"
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
    "total": 5,
    "updatedAt": "2026-07-16T13:00:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40003 | whitelist 为空 |
| 40001 | path 为空或格式不合法 |

---

#### 3.3.9 认证规则测试

模拟请求测试认证规则是否通过，不实际转发请求。

**POST** `/api/v1/gw/auth-rules/{ruleId}/test`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 认证规则 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| token | string | 条件必填 | JWT Token（authType 为 JWT 时） |
| apiKey | string | 条件必填 | API Key（authType 为 API_KEY 时） |
| headers | object | 否 | 模拟请求头 |

**请求示例**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTAwMSIsInRlbmFudElkIjoidGVuYW50LTAwMSIsInJvbGVzIjpbIkRFVkVMT1BFUiJdLCJleHAiOjE3ODkyNjA2MDB9.xxx"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "passed": true,
    "ruleId": "auth-9a8b7c6d2026",
    "authType": "JWT",
    "decodedClaims": {
      "sub": "user-001",
      "tenantId": "tenant-001",
      "roles": ["DEVELOPER"],
      "exp": 1789260600
    },
    "roleCheck": {
      "required": ["DEVELOPER", "PLATFORM_ADMIN"],
      "actual": ["DEVELOPER"],
      "passed": true
    },
    "tokenExpiry": "2026-07-16T12:00:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40403 | ruleId 不存在 |
| 40101 | Token 已过期 |
| 40102 | Token 无效 |
| 40301 | 角色不匹配 |

---

### 3.4 API 管理 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/gw/apis` | 注册 API |
| GET | `/api/v1/gw/apis` | API 列表（分页） |
| GET | `/api/v1/gw/apis/{apiId}` | 获取 API 详情 |
| PUT | `/api/v1/gw/apis/{apiId}` | 更新 API |
| DELETE | `/api/v1/gw/apis/{apiId}` | 删除 API |
| POST | `/api/v1/gw/apis/groups` | 创建 API 分组 |
| GET | `/api/v1/gw/apis/groups` | API 分组列表 |
| PUT | `/api/v1/gw/apis/groups/{groupId}` | 更新 API 分组 |
| DELETE | `/api/v1/gw/apis/groups/{groupId}` | 删除 API 分组 |
| GET | `/api/v1/gw/apis/{apiId}/versions` | API 版本列表 |
| POST | `/api/v1/gw/apis/{apiId}/versions` | 创建 API 新版本 |
| GET | `/api/v1/gw/apis/openapi` | 导出 OpenAPI 文档 |
| GET | `/api/v1/gw/apis/groups/{groupId}/openapi` | 按分组导出 OpenAPI 文档 |

---

#### 3.4.1 注册 API

注册一条 API 定义，包括路径、方法、后端服务映射、所属分组等。

**POST** `/api/v1/gw/apis`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| apiName | string | 是 | API 名称，同一租户内唯一，1-128 字符 |
| description | string | 否 | API 描述，最长 1024 字符 |
| groupId | string | 否 | 所属 API 分组 ID |
| path | string | 是 | API 路径，如 `/api/v1/ont/concepts` |
| method | string | 是 | HTTP 方法：`GET` / `POST` / `PUT` / `DELETE` / `PATCH` / `*`（所有方法） |
| version | string | 否 | API 版本号，默认 `v1`，如 `v1` / `v2` |
| backendService | string | 是 | 后端服务名称 |
| backendPath | string | 否 | 后端服务路径（若与 path 不同），默认与 path 一致 |
| authType | string | 否 | 认证类型：`JWT` / `API_KEY` / `NONE` / `TOKEN_PASSTHROUGH`，默认 `JWT` |
| tags | array | 否 | API 标签列表 |
| metadata | object | 否 | 扩展元数据 |
| status | string | 否 | 初始状态，默认 `PUBLISHED`，可选 `PUBLISHED` / `DRAFT` / `DEPRECATED` |

**请求示例**

```json
{
  "apiName": "create-concept",
  "description": "创建本体概念",
  "groupId": "grp-ontology",
  "path": "/api/v1/ont/concepts",
  "method": "POST",
  "version": "v1",
  "backendService": "tech-ont-service",
  "authType": "JWT",
  "tags": ["ontology", "write"],
  "metadata": {
    "owner": "platform-team",
    "docUrl": "https://wiki.metaplatform.com/ont/api/concepts"
  },
  "status": "PUBLISHED"
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "apiId": "api-9a8b7c6d2026",
    "apiName": "create-concept",
    "description": "创建本体概念",
    "groupId": "grp-ontology",
    "groupName": "本体引擎",
    "path": "/api/v1/ont/concepts",
    "method": "POST",
    "version": "v1",
    "backendService": "tech-ont-service",
    "backendPath": "/api/v1/ont/concepts",
    "authType": "JWT",
    "tags": ["ontology", "write"],
    "status": "PUBLISHED",
    "metadata": {
      "owner": "platform-team",
      "docUrl": "https://wiki.metaplatform.com/ont/api/concepts"
    },
    "version": 1,
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "createdBy": "user-admin",
    "updatedAt": "2026-07-16T10:30:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | apiName 为空或长度不合法 |
| 40003 | path 或 method 缺失 |
| 40405 | groupId 不存在 |
| 40904 | 同 path + method + version 的 API 已存在 |
| 40409 | backendService 未注册 |

---

#### 3.4.2 查询 API 列表

分页查询当前租户下的 API 列表。

**GET** `/api/v1/gw/apis`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序字段，默认 `createdAt:desc` |
| keyword | string | 否 | 关键词，匹配 apiName / description / path |
| groupId | string | 否 | API 分组 ID 筛选 |
| method | string | 否 | HTTP 方法筛选 |
| backendService | string | 否 | 后端服务名称筛选 |
| status | string | 否 | API 状态：`PUBLISHED` / `DRAFT` / `DEPRECATED` |
| tags | string | 否 | 标签筛选，逗号分隔 |
| version | string | 否 | API 版本筛选 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "apiId": "api-9a8b7c6d2026",
        "apiName": "create-concept",
        "description": "创建本体概念",
        "groupId": "grp-ontology",
        "groupName": "本体引擎",
        "path": "/api/v1/ont/concepts",
        "method": "POST",
        "version": "v1",
        "backendService": "tech-ont-service",
        "authType": "JWT",
        "tags": ["ontology", "write"],
        "status": "PUBLISHED",
        "createdAt": "2026-07-01T10:00:00.000+08:00",
        "updatedAt": "2026-07-16T10:30:00.000+08:00"
      }
    ],
    "total": 126,
    "page": 1,
    "pageSize": 20,
    "totalPages": 7
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | status / method 枚举值不合法 |

---

#### 3.4.3 获取 API 详情

查询单个 API 的完整信息。

**GET** `/api/v1/gw/apis/{apiId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| apiId | string | 是 | API ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "apiId": "api-9a8b7c6d2026",
    "apiName": "create-concept",
    "description": "创建本体概念",
    "groupId": "grp-ontology",
    "groupName": "本体引擎",
    "path": "/api/v1/ont/concepts",
    "method": "POST",
    "version": "v1",
    "backendService": "tech-ont-service",
    "backendPath": "/api/v1/ont/concepts",
    "authType": "JWT",
    "tags": ["ontology", "write"],
    "status": "PUBLISHED",
    "metadata": {
      "owner": "platform-team",
      "docUrl": "https://wiki.metaplatform.com/ont/api/concepts"
    },
    "routeId": "route-9a8b7c6d2026",
    "versions": ["v1"],
    "version": 1,
    "createdAt": "2026-07-01T10:00:00.000+08:00",
    "createdBy": "user-admin",
    "updatedAt": "2026-07-16T10:30:00.000+08:00",
    "updatedBy": "user-zhangsan"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40404 | apiId 不存在 |

---

#### 3.4.4 更新 API

更新 API 的基本信息与配置。

**PUT** `/api/v1/gw/apis/{apiId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| apiId | string | 是 | API ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| apiName | string | 否 | API 名称 |
| description | string | 否 | API 描述 |
| groupId | string | 否 | 所属分组 ID |
| backendService | string | 否 | 后端服务名称 |
| backendPath | string | 否 | 后端服务路径 |
| authType | string | 否 | 认证类型 |
| tags | array | 否 | 标签列表 |
| status | string | 否 | API 状态 |
| metadata | object | 否 | 扩展元数据 |
| version | integer | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "description": "创建本体概念（V2），支持批量创建",
  "tags": ["ontology", "write", "batch"],
  "status": "PUBLISHED",
  "version": 1
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "apiId": "api-9a8b7c6d2026",
    "description": "创建本体概念（V2），支持批量创建",
    "tags": ["ontology", "write", "batch"],
    "status": "PUBLISHED",
    "version": 2,
    "updatedAt": "2026-07-16T11:00:00.000+08:00",
    "updatedBy": "user-zhangsan"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40404 | apiId 不存在 |
| 40405 | groupId 不存在 |
| 40908 | version 不匹配 |

---

#### 3.4.5 删除 API

删除 API 定义。

**DELETE** `/api/v1/gw/apis/{apiId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| apiId | string | 是 | API ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reason | string | 否 | 删除原因 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "apiId": "api-9a8b7c6d2026",
    "apiName": "create-concept",
    "deletedAt": "2026-07-16T11:30:00.000+08:00",
    "deletedBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40404 | apiId 不存在 |

---

#### 3.4.6 创建 API 分组

创建一个 API 分组，用于按业务域或服务归类管理 API。

**POST** `/api/v1/gw/apis/groups`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| groupName | string | 是 | 分组名称，同一租户内唯一，1-128 字符 |
| description | string | 否 | 分组描述，最长 1024 字符 |
| parentGroupId | string | 否 | 父分组 ID（支持层级） |
| metadata | object | 否 | 扩展元数据 |

**请求示例**

```json
{
  "groupName": "本体引擎",
  "description": "TECH-ONT 本体引擎相关 API 分组",
  "metadata": {
    "owner": "platform-team",
    "service": "tech-ont-service"
  }
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "groupId": "grp-ontology",
    "groupName": "本体引擎",
    "description": "TECH-ONT 本体引擎相关 API 分组",
    "parentGroupId": null,
    "apiCount": 0,
    "metadata": {
      "owner": "platform-team",
      "service": "tech-ont-service"
    },
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "createdBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | groupName 为空或长度不合法 |
| 40905 | groupName 已存在 |
| 40405 | parentGroupId 不存在 |

---

#### 3.4.7 API 分组列表

查询 API 分组列表，支持树形结构返回。

**GET** `/api/v1/gw/apis/groups`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| keyword | string | 否 | 关键词，匹配 groupName / description |
| tree | boolean | 否 | 是否返回树形结构，默认 false |
| parentGroupId | string | 否 | 父分组 ID 筛选 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "groupId": "grp-ontology",
        "groupName": "本体引擎",
        "description": "TECH-ONT 本体引擎相关 API 分组",
        "parentGroupId": null,
        "apiCount": 24,
        "createdAt": "2026-07-01T10:00:00.000+08:00"
      },
      {
        "groupId": "grp-llmgw",
        "groupName": "LLM 网关",
        "description": "TECH-LLMGW LLM 网关相关 API 分组",
        "parentGroupId": null,
        "apiCount": 18,
        "createdAt": "2026-07-02T14:00:00.000+08:00"
      }
    ],
    "total": 8
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

无特定错误场景。

---

#### 3.4.8 更新 API 分组

更新 API 分组信息。

**PUT** `/api/v1/gw/apis/groups/{groupId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| groupId | string | 是 | 分组 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| groupName | string | 否 | 分组名称 |
| description | string | 否 | 分组描述 |
| parentGroupId | string | 否 | 父分组 ID |
| metadata | object | 否 | 扩展元数据 |

**请求示例**

```json
{
  "groupName": "本体引擎（V2）",
  "description": "TECH-ONT 本体引擎相关 API 分组（更新）"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "groupId": "grp-ontology",
    "groupName": "本体引擎（V2）",
    "description": "TECH-ONT 本体引擎相关 API 分组（更新）",
    "updatedAt": "2026-07-16T11:00:00.000+08:00",
    "updatedBy": "user-zhangsan"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40405 | groupId 不存在 |
| 40905 | groupName 已存在 |

---

#### 3.4.9 删除 API 分组

删除 API 分组。若分组下有 API，需先迁移或删除。

**DELETE** `/api/v1/gw/apis/groups/{groupId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| groupId | string | 是 | 分组 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| force | boolean | 否 | 是否强制删除（将分组下 API 移至未分组），默认 false |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "groupId": "grp-ontology",
    "groupName": "本体引擎（V2）",
    "deletedAt": "2026-07-16T11:30:00.000+08:00",
    "deletedBy": "user-admin",
    "migratedApiCount": 0
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40405 | groupId 不存在 |
| 42206 | 分组下存在 API 且 force=false |

---

#### 3.4.10 API 版本列表

查询某个 API 的所有版本。

**GET** `/api/v1/gw/apis/{apiId}/versions`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| apiId | string | 是 | API ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "apiId": "api-9a8b7c6d2026",
    "apiName": "create-concept",
    "versions": [
      {
        "version": "v1",
        "status": "PUBLISHED",
        "backendService": "tech-ont-service",
        "createdAt": "2026-07-01T10:00:00.000+08:00",
        "createdBy": "user-admin"
      },
      {
        "version": "v2",
        "status": "PUBLISHED",
        "backendService": "tech-ont-service",
        "createdAt": "2026-07-10T14:00:00.000+08:00",
        "createdBy": "user-zhangsan"
      }
    ],
    "currentVersion": "v2"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40404 | apiId 不存在 |

---

#### 3.4.11 创建 API 新版本

基于现有 API 创建新版本。

**POST** `/api/v1/gw/apis/{apiId}/versions`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| apiId | string | 是 | API ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| version | string | 是 | 新版本号，如 `v3` |
| backendService | string | 否 | 后端服务名称（可与旧版本不同） |
| backendPath | string | 否 | 后端服务路径 |
| description | string | 否 | 版本说明 |
| copyFromVersion | string | 否 | 从哪个版本复制配置，默认最新版本 |

**请求示例**

```json
{
  "version": "v3",
  "backendService": "tech-ont-service-v2",
  "description": "V3 版本，使用新版本体引擎服务",
  "copyFromVersion": "v2"
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "apiId": "api-9a8b7c6d2026",
    "version": "v3",
    "status": "DRAFT",
    "backendService": "tech-ont-service-v2",
    "description": "V3 版本，使用新版本体引擎服务",
    "createdAt": "2026-07-16T14:00:00.000+08:00",
    "createdBy": "user-zhangsan"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40404 | apiId 不存在 |
| 40904 | version 已存在 |
| 40409 | backendService 未注册 |

---

#### 3.4.12 导出 OpenAPI 文档

聚合所有已发布 API，导出 OpenAPI 3.0 文档。

**GET** `/api/v1/gw/apis/openapi`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| groupId | string | 否 | 按分组筛选，为空则导出全部 |
| version | string | 否 | 按版本筛选 |
| format | string | 否 | 导出格式：`json` / `yaml`，默认 `json` |

**响应示例（format=json）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "openapi": "3.0.3",
    "info": {
      "title": "Mate Platform API",
      "description": "Mate Platform 统一 API 文档",
      "version": "1.0.0"
    },
    "servers": [
      { "url": "https://api.metaplatform.com", "description": "Production" }
    ],
    "paths": {
      "/api/v1/ont/concepts": {
        "post": {
          "tags": ["本体引擎"],
          "summary": "创建本体概念",
          "security": [{ "bearerAuth": [] }],
          "responses": {
            "200": { "description": "成功" },
            "401": { "description": "未认证" }
          }
        }
      }
    },
    "components": {
      "securitySchemes": {
        "bearerAuth": {
          "type": "http",
          "scheme": "bearer",
          "bearerFormat": "JWT"
        }
      }
    }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

无特定错误场景。

---

#### 3.4.13 按分组导出 OpenAPI 文档

按指定 API 分组导出 OpenAPI 3.0 文档。

**GET** `/api/v1/gw/apis/groups/{groupId}/openapi`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| groupId | string | 是 | 分组 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| version | string | 否 | 按版本筛选 |
| format | string | 否 | 导出格式：`json` / `yaml`，默认 `json` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "openapi": "3.0.3",
    "info": {
      "title": "本体引擎 API",
      "description": "TECH-ONT 本体引擎 API 文档",
      "version": "1.0.0"
    },
    "servers": [
      { "url": "https://api.metaplatform.com", "description": "Production" }
    ],
    "paths": { },
    "components": { }
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40405 | groupId 不存在 |

---

### 3.5 请求审计 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/gw/audit/logs` | 请求日志查询（分页） |
| GET | `/api/v1/gw/audit/logs/{logId}` | 请求日志详情 |
| GET | `/api/v1/gw/audit/errors` | 错误请求日志查询 |
| GET | `/api/v1/gw/audit/errors/{logId}` | 错误请求日志详情 |
| GET | `/api/v1/gw/audit/latency` | 延迟统计查询 |
| GET | `/api/v1/gw/audit/latency/by-route` | 按路由延迟统计 |
| GET | `/api/v1/gw/audit/traces/{traceId}` | 调用链追踪查询 |
| GET | `/api/v1/gw/audit/slow-requests` | 慢请求查询 |
| GET | `/api/v1/gw/audit/export` | 导出审计日志 |

---

#### 3.5.1 请求日志查询

分页查询经过网关的请求日志，支持多维度筛选。

**GET** `/api/v1/gw/audit/logs`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序字段，默认 `createdAt:desc` |
| startTime | string | 否 | 请求开始时间（ISO 8601） |
| endTime | string | 否 | 请求结束时间（ISO 8601） |
| traceId | string | 否 | 链路追踪 ID |
| routeId | string | 否 | 路由 ID |
| routeName | string | 否 | 路由名称 |
| method | string | 否 | HTTP 方法 |
| path | string | 否 | 请求路径（模糊匹配） |
| statusCode | integer | 否 | HTTP 响应状态码 |
| statusCodeMin | integer | 否 | 响应状态码下限 |
| statusCodeMax | integer | 否 | 响应状态码上限 |
| userId | string | 否 | 用户 ID |
| clientIp | string | 否 | 客户端 IP |
| serviceName | string | 否 | 后端服务名称 |
| latencyMin | integer | 否 | 最小延迟（毫秒） |
| latencyMax | integer | 否 | 最大延迟（毫秒） |

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
        "method": "POST",
        "path": "/api/v1/ont/concepts",
        "routeId": "route-9a8b7c6d2026",
        "routeName": "ont-concepts-route-v2",
        "serviceName": "tech-ont-service",
        "statusCode": 201,
        "userId": "user-001",
        "clientIp": "192.168.1.100",
        "requestSize": 512,
        "responseSize": 1024,
        "latency": 85,
        "authType": "JWT",
        "authResult": "SUCCESS",
        "rateLimitResult": "PASS",
        "circuitBreakerState": "CLOSED",
        "createdAt": "2026-07-16T10:30:00.000+08:00"
      }
    ],
    "total": 152340,
    "page": 1,
    "pageSize": 20,
    "totalPages": 7617
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40004 | 时间范围不合法 |
| 40301 | 无审计日志查看权限 |

---

#### 3.5.2 请求日志详情

查询单条请求日志的完整信息，包括请求头、请求体摘要、响应头、响应体摘要。

**GET** `/api/v1/gw/audit/logs/{logId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| logId | string | 是 | 日志 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "logId": "log-20260716-000001",
    "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "tenantId": "tenant-001",
    "method": "POST",
    "path": "/api/v1/ont/concepts",
    "queryString": null,
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route-v2",
    "serviceName": "tech-ont-service",
    "backendUri": "lb://tech-ont-service/api/v1/ont/concepts",
    "statusCode": 201,
    "userId": "user-001",
    "username": "zhangsan",
    "clientIp": "192.168.1.100",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "requestHeaders": {
      "Authorization": "Bearer eyJhbG...",
      "Content-Type": "application/json",
      "X-Trace-Id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "X-Tenant-Id": "tenant-001"
    },
    "requestBody": "{\"name\":\"概念A\",\"description\":\"测试概念\"}",
    "responseHeaders": {
      "Content-Type": "application/json",
      "X-Trace-Id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    },
    "responseBody": "{\"code\":0,\"message\":\"success\",\"data\":{\"conceptId\":\"cpt-001\"}}",
    "requestSize": 512,
    "responseSize": 1024,
    "latency": 85,
    "backendLatency": 75,
    "authType": "JWT",
    "authResult": "SUCCESS",
    "rateLimitResult": "PASS",
    "circuitBreakerState": "CLOSED",
    "grayscaleVariant": null,
    "retryCount": 0,
    "createdAt": "2026-07-16T10:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40406 | logId 不存在 |

---

#### 3.5.3 错误请求日志查询

查询错误请求（状态码 >= 400）的日志。

**GET** `/api/v1/gw/audit/errors`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序字段，默认 `createdAt:desc` |
| startTime | string | 否 | 开始时间（ISO 8601） |
| endTime | string | 否 | 结束时间（ISO 8601） |
| routeId | string | 否 | 路由 ID |
| statusCode | integer | 否 | HTTP 状态码 |
| errorCode | string | 否 | 业务错误码 |
| serviceName | string | 否 | 后端服务名称 |
| errorType | string | 否 | 错误类型：`AUTH` / `RATE_LIMIT` / `CIRCUIT_BREAKER` / `BACKEND_ERROR` / `TIMEOUT` / `INTERNAL` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "logId": "log-20260716-000050",
        "traceId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "method": "POST",
        "path": "/api/v1/ont/concepts",
        "routeId": "route-9a8b7c6d2026",
        "routeName": "ont-concepts-route-v2",
        "serviceName": "tech-ont-service",
        "statusCode": 429,
        "errorCode": 42901,
        "errorType": "RATE_LIMIT",
        "errorMessage": "QPS 限流触发: limit=100, current=101",
        "userId": "user-002",
        "clientIp": "192.168.1.101",
        "latency": 5,
        "createdAt": "2026-07-16T10:35:00.000+08:00"
      }
    ],
    "total": 183,
    "page": 1,
    "pageSize": 20,
    "totalPages": 10
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40004 | 时间范围不合法 |

---

#### 3.5.4 错误请求日志详情

查询单条错误请求的完整信息，包括错误堆栈。

**GET** `/api/v1/gw/audit/errors/{logId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| logId | string | 是 | 日志 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "logId": "log-20260716-000050",
    "traceId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "method": "POST",
    "path": "/api/v1/ont/concepts",
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route-v2",
    "serviceName": "tech-ont-service",
    "statusCode": 429,
    "errorCode": 42901,
    "errorType": "RATE_LIMIT",
    "errorMessage": "QPS 限流触发: limit=100, current=101",
    "errorDetail": {
      "limitType": "QPS",
      "limit": 100,
      "current": 101,
      "scope": "USER",
      "scopeId": "user-002",
      "ruleId": "rl-9a8b7c6d2026"
    },
    "userId": "user-002",
    "username": "lisi",
    "clientIp": "192.168.1.101",
    "requestHeaders": {
      "Authorization": "Bearer eyJhbG...",
      "X-Trace-Id": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
    },
    "requestBody": "{\"name\":\"概念B\"}",
    "responseBody": "{\"code\":42901,\"message\":\"QPS 限流触发\",\"data\":{\"limit\":100,\"current\":101}}",
    "latency": 5,
    "createdAt": "2026-07-16T10:35:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40406 | logId 不存在 |

---

#### 3.5.5 延迟统计查询

查询网关请求的延迟统计数据，含分位数指标。

**GET** `/api/v1/gw/audit/latency`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startTime | string | 是 | 开始时间（ISO 8601） |
| endTime | string | 是 | 结束时间（ISO 8601） |
| routeId | string | 否 | 路由 ID 筛选 |
| granularity | string | 否 | 时间粒度：`MINUTE` / `HOUR` / `DAY`，默认 `HOUR` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "summary": {
      "totalRequests": 1523400,
      "avgLatency": 85,
      "p50Latency": 65,
      "p90Latency": 150,
      "p95Latency": 220,
      "p99Latency": 450,
      "maxLatency": 3200,
      "minLatency": 2
    },
    "timeline": [
      {
        "timestamp": "2026-07-16T10:00:00.000+08:00",
        "totalRequests": 8500,
        "avgLatency": 80,
        "p50Latency": 60,
        "p95Latency": 210,
        "p99Latency": 430
      },
      {
        "timestamp": "2026-07-16T11:00:00.000+08:00",
        "totalRequests": 9200,
        "avgLatency": 90,
        "p50Latency": 70,
        "p95Latency": 230,
        "p99Latency": 480
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40003 | startTime 或 endTime 缺失 |

---

#### 3.5.6 按路由延迟统计

按路由维度查询延迟统计，用于对比不同路由的性能。

**GET** `/api/v1/gw/audit/latency/by-route`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startTime | string | 是 | 开始时间（ISO 8601） |
| endTime | string | 是 | 结束时间（ISO 8601） |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "routeId": "route-9a8b7c6d2026",
        "routeName": "ont-concepts-route-v2",
        "totalRequests": 520000,
        "avgLatency": 75,
        "p50Latency": 55,
        "p95Latency": 180,
        "p99Latency": 380,
        "errorCount": 120,
        "errorRate": 0.023
      },
      {
        "routeId": "route-112233445566",
        "routeName": "llmgw-chat-route",
        "totalRequests": 34000,
        "avgLatency": 1850,
        "p50Latency": 1200,
        "p95Latency": 3500,
        "p99Latency": 5800,
        "errorCount": 15,
        "errorRate": 0.044
      }
    ],
    "total": 48
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40003 | startTime 或 endTime 缺失 |

---

#### 3.5.7 调用链追踪查询

通过 trace_id 查询全链路调用记录，包括网关转发、后端服务处理等。

**GET** `/api/v1/gw/audit/traces/{traceId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| traceId | string | 是 | 链路追踪 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "spans": [
      {
        "spanId": "span-001",
        "parentSpanId": null,
        "service": "TECH-GW",
        "operation": "gateway.request",
        "startTime": "2026-07-16T10:30:00.000+08:00",
        "duration": 85,
        "tags": {
          "http.method": "POST",
          "http.path": "/api/v1/ont/concepts",
          "http.status_code": 201,
          "routeId": "route-9a8b7c6d2026"
        }
      },
      {
        "spanId": "span-002",
        "parentSpanId": "span-001",
        "service": "TECH-GW",
        "operation": "gateway.auth",
        "startTime": "2026-07-16T10:30:00.005+08:00",
        "duration": 5,
        "tags": {
          "auth.type": "JWT",
          "auth.result": "SUCCESS",
          "auth.userId": "user-001"
        }
      },
      {
        "spanId": "span-003",
        "parentSpanId": "span-001",
        "service": "TECH-GW",
        "operation": "gateway.ratelimit",
        "startTime": "2026-07-16T10:30:00.010+08:00",
        "duration": 2,
        "tags": {
          "ratelimit.result": "PASS",
          "ratelimit.ruleId": "rl-9a8b7c6d2026"
        }
      },
      {
        "spanId": "span-004",
        "parentSpanId": "span-001",
        "service": "TECH-ONT",
        "operation": "backend.request",
        "startTime": "2026-07-16T10:30:00.012+08:00",
        "duration": 70,
        "tags": {
          "http.method": "POST",
          "http.path": "/api/v1/ont/concepts",
          "http.status_code": 201
        }
      }
    ],
    "totalDuration": 85,
    "spanCount": 4
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40406 | traceId 对应的调用链不存在 |

---

#### 3.5.8 慢请求查询

查询延迟超过阈值的慢请求。

**GET** `/api/v1/gw/audit/slow-requests`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |
| startTime | string | 否 | 开始时间，默认最近 1 小时 |
| endTime | string | 否 | 结束时间，默认当前时间 |
| threshold | integer | 否 | 慢请求阈值（毫秒），默认 1000 |
| routeId | string | 否 | 路由 ID 筛选 |
| serviceName | string | 否 | 后端服务名称筛选 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "logId": "log-20260716-000080",
        "traceId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
        "method": "POST",
        "path": "/api/v1/llmgw/chat/completions",
        "routeId": "route-112233445566",
        "routeName": "llmgw-chat-route",
        "serviceName": "tech-llmgw-service",
        "statusCode": 200,
        "latency": 3200,
        "threshold": 1000,
        "userId": "user-003",
        "clientIp": "192.168.1.102",
        "createdAt": "2026-07-16T10:20:00.000+08:00"
      }
    ],
    "total": 12,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40004 | threshold 值不合法 |

---

#### 3.5.9 导出审计日志

导出审计日志为 CSV 或 JSON 文件。

**GET** `/api/v1/gw/audit/export`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startTime | string | 是 | 开始时间（ISO 8601） |
| endTime | string | 是 | 结束时间（ISO 8601） |
| routeId | string | 否 | 路由 ID 筛选 |
| format | string | 否 | 导出格式：`csv` / `json`，默认 `csv` |
| maxRecords | integer | 否 | 最大导出条数，默认 10000，最大 100000 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "exportId": "exp-20260716-000001",
    "format": "csv",
    "totalRecords": 8500,
    "downloadUrl": "/api/v1/gw/audit/export/exp-20260716-000001/download",
    "expiresAt": "2026-07-16T11:30:00.000+08:00",
    "createdAt": "2026-07-16T10:30:00.000+08:00"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40003 | startTime 或 endTime 缺失 |
| 40004 | 时间范围过大或 maxRecords 超限 |

---

### 3.6 灰度发布 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/gw/grayscale` | 创建灰度规则 |
| GET | `/api/v1/gw/grayscale` | 灰度规则列表（分页） |
| GET | `/api/v1/gw/grayscale/{ruleId}` | 获取灰度规则详情 |
| PUT | `/api/v1/gw/grayscale/{ruleId}` | 更新灰度规则 |
| DELETE | `/api/v1/gw/grayscale/{ruleId}` | 删除灰度规则 |
| PUT | `/api/v1/gw/grayscale/{ruleId}/state` | 启用/禁用灰度规则 |
| GET | `/api/v1/gw/grayscale/{ruleId}/stats` | 灰度统计查询 |

---

#### 3.6.1 创建灰度规则

为指定路由创建灰度发布规则，支持按权重、Header、Cookie 分流。

**POST** `/api/v1/gw/grayscale`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleName | string | 是 | 灰度规则名称，同一租户内唯一，1-128 字符 |
| description | string | 否 | 规则描述，最长 1024 字符 |
| routeId | string | 是 | 关联路由 ID |
| strategy | string | 是 | 灰度策略：`WEIGHT` / `HEADER` / `COOKIE` / `AB_TEST` |
| variants | array | 是 | 灰度变体列表，至少 2 个 |
| variants[].name | string | 是 | 变体名称，如 `stable` / `canary` |
| variants[].weight | integer | 条件必填 | 权重（0-100），strategy 为 `WEIGHT` 或 `AB_TEST` 时必填。所有变体权重之和必须为 100 |
| variants[].targetService | string | 是 | 变体目标后端服务名称 |
| variants[].targetPath | string | 否 | 变体目标路径 |
| variants[].headerMatch | object | 条件必填 | Header 匹配条件，strategy 为 `HEADER` 时必填 |
| variants[].headerMatch.headerName | string | 否 | 请求头名称 |
| variants[].headerMatch.headerValue | string | 否 | 请求头值 |
| variants[].cookieMatch | object | 条件必填 | Cookie 匹配条件，strategy 为 `COOKIE` 时必填 |
| variants[].cookieMatch.cookieName | string | 否 | Cookie 名称 |
| variants[].cookieMatch.cookieValue | string | 否 | Cookie 值 |
| status | string | 否 | 初始状态，默认 `ENABLED`，可选 `ENABLED` / `DISABLED` |

**请求示例**

```json
{
  "ruleName": "ont-concepts-canary",
  "description": "本体概念 API 灰度发布，10% 流量到 v2 服务",
  "routeId": "route-9a8b7c6d2026",
  "strategy": "WEIGHT",
  "variants": [
    {
      "name": "stable",
      "weight": 90,
      "targetService": "tech-ont-service"
    },
    {
      "name": "canary",
      "weight": 10,
      "targetService": "tech-ont-service-v2"
    }
  ],
  "status": "ENABLED"
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "gs-9a8b7c6d2026",
    "ruleName": "ont-concepts-canary",
    "description": "本体概念 API 灰度发布，10% 流量到 v2 服务",
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route-v2",
    "strategy": "WEIGHT",
    "variants": [
      {
        "name": "stable",
        "weight": 90,
        "targetService": "tech-ont-service",
        "targetPath": null
      },
      {
        "name": "canary",
        "weight": 10,
        "targetService": "tech-ont-service-v2",
        "targetPath": null
      }
    ],
    "status": "ENABLED",
    "version": 1,
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "createdBy": "user-admin",
    "updatedAt": "2026-07-16T10:30:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | ruleName 为空或长度不合法 |
| 40003 | variants 少于 2 个 |
| 40401 | routeId 不存在 |
| 40906 | 该路由已有灰度规则 |
| 42204 | WEIGHT 策略下权重总和不等于 100 |
| 40409 | 变体的 targetService 未注册 |

---

#### 3.6.2 查询灰度规则列表

分页查询当前租户下的灰度规则列表。

**GET** `/api/v1/gw/grayscale`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序字段，默认 `createdAt:desc` |
| keyword | string | 否 | 关键词，匹配 ruleName / description |
| status | string | 否 | 规则状态：`ENABLED` / `DISABLED` |
| routeId | string | 否 | 路由 ID 筛选 |
| strategy | string | 否 | 灰度策略：`WEIGHT` / `HEADER` / `COOKIE` / `AB_TEST` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "ruleId": "gs-9a8b7c6d2026",
        "ruleName": "ont-concepts-canary",
        "description": "本体概念 API 灰度发布",
        "routeId": "route-9a8b7c6d2026",
        "routeName": "ont-concepts-route-v2",
        "strategy": "WEIGHT",
        "variantCount": 2,
        "status": "ENABLED",
        "totalRequests": 52000,
        "canaryRequests": 5200,
        "createdAt": "2026-07-01T10:00:00.000+08:00",
        "updatedAt": "2026-07-16T10:30:00.000+08:00"
      }
    ],
    "total": 6,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | status / strategy 枚举值不合法 |

---

#### 3.6.3 获取灰度规则详情

查询单个灰度规则的完整信息，包括变体配置与实时分流统计。

**GET** `/api/v1/gw/grayscale/{ruleId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 灰度规则 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "gs-9a8b7c6d2026",
    "ruleName": "ont-concepts-canary",
    "description": "本体概念 API 灰度发布，10% 流量到 v2 服务",
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route-v2",
    "strategy": "WEIGHT",
    "variants": [
      {
        "name": "stable",
        "weight": 90,
        "targetService": "tech-ont-service",
        "targetPath": null,
        "stats": {
          "totalRequests": 46800,
          "actualPercent": 90.0,
          "errorCount": 10,
          "errorRate": 0.021,
          "avgLatency": 75
        }
      },
      {
        "name": "canary",
        "weight": 10,
        "targetService": "tech-ont-service-v2",
        "targetPath": null,
        "stats": {
          "totalRequests": 5200,
          "actualPercent": 10.0,
          "errorCount": 2,
          "errorRate": 0.038,
          "avgLatency": 80
        }
      }
    ],
    "status": "ENABLED",
    "version": 2,
    "createdAt": "2026-07-01T10:00:00.000+08:00",
    "createdBy": "user-admin",
    "updatedAt": "2026-07-16T10:30:00.000+08:00",
    "updatedBy": "user-zhangsan"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40407 | ruleId 不存在 |

---

#### 3.6.4 更新灰度规则

更新灰度规则的策略与变体配置（如调整权重）。

**PUT** `/api/v1/gw/grayscale/{ruleId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 灰度规则 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleName | string | 否 | 规则名称 |
| description | string | 否 | 规则描述 |
| strategy | string | 否 | 灰度策略 |
| variants | array | 否 | 变体列表 |
| version | integer | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "variants": [
    {
      "name": "stable",
      "weight": 50,
      "targetService": "tech-ont-service"
    },
    {
      "name": "canary",
      "weight": 50,
      "targetService": "tech-ont-service-v2"
    }
  ],
  "version": 2
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "gs-9a8b7c6d2026",
    "strategy": "WEIGHT",
    "variantCount": 2,
    "version": 3,
    "updatedAt": "2026-07-16T11:00:00.000+08:00",
    "updatedBy": "user-zhangsan"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40407 | ruleId 不存在 |
| 42204 | 权重总和不等于 100 |
| 40908 | version 不匹配 |

---

#### 3.6.5 删除灰度规则

删除灰度规则，恢复为单一路由。

**DELETE** `/api/v1/gw/grayscale/{ruleId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 灰度规则 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reason | string | 否 | 删除原因 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "gs-9a8b7c6d2026",
    "ruleName": "ont-concepts-canary",
    "deletedAt": "2026-07-16T11:30:00.000+08:00",
    "deletedBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40407 | ruleId 不存在 |

---

#### 3.6.6 启用/禁用灰度规则

启停灰度规则。禁用后所有流量走默认路由目标。

**PUT** `/api/v1/gw/grayscale/{ruleId}/state`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 灰度规则 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | string | 是 | 目标状态：`ENABLED` / `DISABLED` |
| reason | string | 否 | 操作原因 |

**请求示例**

```json
{
  "status": "DISABLED",
  "reason": "灰度版本发现问题，暂停灰度"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "gs-9a8b7c6d2026",
    "previousStatus": "ENABLED",
    "currentStatus": "DISABLED",
    "updatedAt": "2026-07-16T12:00:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40407 | ruleId 不存在 |

---

#### 3.6.7 灰度统计查询

查询灰度规则的流量分流统计数据。

**GET** `/api/v1/gw/grayscale/{ruleId}/stats`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 灰度规则 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| startTime | string | 否 | 开始时间，默认最近 24 小时 |
| endTime | string | 否 | 结束时间，默认当前时间 |
| granularity | string | 否 | 时间粒度：`MINUTE` / `HOUR` / `DAY`，默认 `HOUR` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "gs-9a8b7c6d2026",
    "ruleName": "ont-concepts-canary",
    "strategy": "WEIGHT",
    "summary": {
      "totalRequests": 52000,
      "byVariant": [
        {
          "name": "stable",
          "requests": 46800,
          "percent": 90.0,
          "errorCount": 10,
          "errorRate": 0.021,
          "avgLatency": 75
        },
        {
          "name": "canary",
          "requests": 5200,
          "percent": 10.0,
          "errorCount": 2,
          "errorRate": 0.038,
          "avgLatency": 80
        }
      ]
    },
    "timeline": [
      {
        "timestamp": "2026-07-16T10:00:00.000+08:00",
        "stableRequests": 4500,
        "canaryRequests": 500,
        "stableErrors": 1,
        "canaryErrors": 0
      }
    ]
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40407 | ruleId 不存在 |

---

### 3.7 熔断降级 API

#### 接口总览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/gw/circuit-breakers` | 创建熔断规则 |
| GET | `/api/v1/gw/circuit-breakers` | 熔断规则列表（分页） |
| GET | `/api/v1/gw/circuit-breakers/{ruleId}` | 获取熔断规则详情 |
| PUT | `/api/v1/gw/circuit-breakers/{ruleId}` | 更新熔断规则 |
| DELETE | `/api/v1/gw/circuit-breakers/{ruleId}` | 删除熔断规则 |
| PUT | `/api/v1/gw/circuit-breakers/{ruleId}/state` | 启用/禁用熔断规则 |
| GET | `/api/v1/gw/circuit-breakers/{ruleId}/status` | 查询熔断器实时状态 |
| PUT | `/api/v1/gw/circuit-breakers/{ruleId}/reset` | 手动恢复（重置熔断器） |
| PUT | `/api/v1/gw/circuit-breakers/{ruleId}/force-open` | 强制熔断 |

---

#### 3.7.1 创建熔断规则

为指定路由创建熔断规则，定义熔断条件与降级策略。

**POST** `/api/v1/gw/circuit-breakers`

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleName | string | 是 | 熔断规则名称，同一租户内唯一，1-128 字符 |
| description | string | 否 | 规则描述，最长 1024 字符 |
| routeId | string | 是 | 关联路由 ID |
| failureType | string | 是 | 熔断触发条件类型：`ERROR_RATE` / `SLOW_CALL_RATE` / `ERROR_COUNT` |
| failureRateThreshold | float | 条件必填 | 错误率阈值（0.0-1.0），failureType 为 `ERROR_RATE` 时必填，默认 0.5 |
| slowCallRateThreshold | float | 条件必填 | 慢调用率阈值（0.0-1.0），failureType 为 `SLOW_CALL_RATE` 时必填，默认 0.8 |
| slowCallDurationThreshold | integer | 条件必填 | 慢调用延迟阈值（毫秒），failureType 为 `SLOW_CALL_RATE` 时必填 |
| failureCountThreshold | integer | 条件必填 | 错误次数阈值，failureType 为 `ERROR_COUNT` 时必填 |
| slidingWindowSize | integer | 否 | 滑动窗口大小，默认 100 |
| slidingWindowType | string | 否 | 滑动窗口类型：`COUNT` / `TIME`，默认 `COUNT` |
| minimumNumberOfCalls | integer | 否 | 最小调用次数（达到后才开始计算），默认 10 |
| waitDurationInOpenState | integer | 否 | 熔断打开后等待时间（秒），默认 60 |
| permittedNumberOfCallsInHalfOpen | integer | 否 | 半开状态允许的调用数，默认 10 |
| degradationStrategy | string | 否 | 降级策略：`RETURN_DEFAULT` / `REDIRECT` / `RETURN_ERROR`，默认 `RETURN_ERROR` |
| degradationConfig | object | 否 | 降级配置（因策略而异） |
| degradationConfig.defaultResponse | object | 否 | 默认响应体（策略为 `RETURN_DEFAULT` 时） |
| degradationConfig.redirectUrl | string | 否 | 重定向 URL（策略为 `REDIRECT` 时） |
| degradationConfig.errorStatusCode | integer | 否 | 错误状态码（策略为 `RETURN_ERROR` 时），默认 503 |
| degradationConfig.errorMessage | string | 否 | 错误消息 |
| status | string | 否 | 初始状态，默认 `ENABLED`，可选 `ENABLED` / `DISABLED` |

**请求示例**

```json
{
  "ruleName": "ont-concepts-cb",
  "description": "本体概念 API 熔断规则，错误率超 50% 熔断 60 秒",
  "routeId": "route-9a8b7c6d2026",
  "failureType": "ERROR_RATE",
  "failureRateThreshold": 0.5,
  "slidingWindowSize": 100,
  "slidingWindowType": "COUNT",
  "minimumNumberOfCalls": 10,
  "waitDurationInOpenState": 60,
  "permittedNumberOfCallsInHalfOpen": 10,
  "degradationStrategy": "RETURN_DEFAULT",
  "degradationConfig": {
    "defaultResponse": {
      "code": 50302,
      "message": "服务暂时不可用，请稍后重试",
      "data": null
    }
  },
  "status": "ENABLED"
}
```

**响应示例（201 Created）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "cb-9a8b7c6d2026",
    "ruleName": "ont-concepts-cb",
    "description": "本体概念 API 熔断规则，错误率超 50% 熔断 60 秒",
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route-v2",
    "failureType": "ERROR_RATE",
    "failureRateThreshold": 0.5,
    "slowCallRateThreshold": null,
    "slowCallDurationThreshold": null,
    "failureCountThreshold": null,
    "slidingWindowSize": 100,
    "slidingWindowType": "COUNT",
    "minimumNumberOfCalls": 10,
    "waitDurationInOpenState": 60,
    "permittedNumberOfCallsInHalfOpen": 10,
    "degradationStrategy": "RETURN_DEFAULT",
    "degradationConfig": {
      "defaultResponse": {
        "code": 50302,
        "message": "服务暂时不可用，请稍后重试",
        "data": null
      }
    },
    "status": "ENABLED",
    "version": 1,
    "createdAt": "2026-07-16T10:30:00.000+08:00",
    "createdBy": "user-admin",
    "updatedAt": "2026-07-16T10:30:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40001 | ruleName 为空或长度不合法 |
| 40008 | degradationStrategy 不支持 |
| 40401 | routeId 不存在 |
| 40907 | 该路由已有熔断规则 |

---

#### 3.7.2 查询熔断规则列表

分页查询当前租户下的熔断规则列表。

**GET** `/api/v1/gw/circuit-breakers`

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |
| sort | string | 否 | 排序字段，默认 `createdAt:desc` |
| keyword | string | 否 | 关键词，匹配 ruleName / description |
| status | string | 否 | 规则状态：`ENABLED` / `DISABLED` |
| routeId | string | 否 | 路由 ID 筛选 |
| failureType | string | 否 | 熔断条件类型 |
| degradationStrategy | string | 否 | 降级策略 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "ruleId": "cb-9a8b7c6d2026",
        "ruleName": "ont-concepts-cb",
        "description": "本体概念 API 熔断规则",
        "routeId": "route-9a8b7c6d2026",
        "routeName": "ont-concepts-route-v2",
        "failureType": "ERROR_RATE",
        "failureRateThreshold": 0.5,
        "degradationStrategy": "RETURN_DEFAULT",
        "status": "ENABLED",
        "currentState": "CLOSED",
        "createdAt": "2026-07-01T10:00:00.000+08:00",
        "updatedAt": "2026-07-16T10:30:00.000+08:00"
      }
    ],
    "total": 12,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40002 | status / failureType / degradationStrategy 枚举值不合法 |

---

#### 3.7.3 获取熔断规则详情

查询单个熔断规则的完整配置信息。

**GET** `/api/v1/gw/circuit-breakers/{ruleId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 熔断规则 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "cb-9a8b7c6d2026",
    "ruleName": "ont-concepts-cb",
    "description": "本体概念 API 熔断规则，错误率超 50% 熔断 60 秒",
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route-v2",
    "failureType": "ERROR_RATE",
    "failureRateThreshold": 0.5,
    "slowCallRateThreshold": null,
    "slowCallDurationThreshold": null,
    "failureCountThreshold": null,
    "slidingWindowSize": 100,
    "slidingWindowType": "COUNT",
    "minimumNumberOfCalls": 10,
    "waitDurationInOpenState": 60,
    "permittedNumberOfCallsInHalfOpen": 10,
    "degradationStrategy": "RETURN_DEFAULT",
    "degradationConfig": {
      "defaultResponse": {
        "code": 50302,
        "message": "服务暂时不可用，请稍后重试",
        "data": null
      }
    },
    "status": "ENABLED",
    "version": 2,
    "createdAt": "2026-07-01T10:00:00.000+08:00",
    "createdBy": "user-admin",
    "updatedAt": "2026-07-16T10:30:00.000+08:00",
    "updatedBy": "user-zhangsan"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40408 | ruleId 不存在 |

---

#### 3.7.4 更新熔断规则

更新熔断规则的阈值、降级策略等配置。

**PUT** `/api/v1/gw/circuit-breakers/{ruleId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 熔断规则 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleName | string | 否 | 规则名称 |
| description | string | 否 | 规则描述 |
| failureType | string | 否 | 熔断条件类型 |
| failureRateThreshold | float | 否 | 错误率阈值 |
| slowCallRateThreshold | float | 否 | 慢调用率阈值 |
| slowCallDurationThreshold | integer | 否 | 慢调用延迟阈值 |
| failureCountThreshold | integer | 否 | 错误次数阈值 |
| slidingWindowSize | integer | 否 | 滑动窗口大小 |
| slidingWindowType | string | 否 | 滑动窗口类型 |
| minimumNumberOfCalls | integer | 否 | 最小调用次数 |
| waitDurationInOpenState | integer | 否 | 熔断打开等待时间 |
| permittedNumberOfCallsInHalfOpen | integer | 否 | 半开允许调用数 |
| degradationStrategy | string | 否 | 降级策略 |
| degradationConfig | object | 否 | 降级配置 |
| version | integer | 是 | 乐观锁版本号 |

**请求示例**

```json
{
  "failureRateThreshold": 0.3,
  "waitDurationInOpenState": 120,
  "version": 2
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "cb-9a8b7c6d2026",
    "failureRateThreshold": 0.3,
    "waitDurationInOpenState": 120,
    "version": 3,
    "updatedAt": "2026-07-16T11:00:00.000+08:00",
    "updatedBy": "user-zhangsan"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40408 | ruleId 不存在 |
| 40008 | degradationStrategy 不支持 |
| 40908 | version 不匹配 |

---

#### 3.7.5 删除熔断规则

删除熔断规则。

**DELETE** `/api/v1/gw/circuit-breakers/{ruleId}`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 熔断规则 ID |

**请求参数（Query）**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reason | string | 否 | 删除原因 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "cb-9a8b7c6d2026",
    "ruleName": "ont-concepts-cb",
    "deletedAt": "2026-07-16T11:30:00.000+08:00",
    "deletedBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40408 | ruleId 不存在 |

---

#### 3.7.6 启用/禁用熔断规则

启停熔断规则。禁用后熔断器强制为 CLOSED 状态。

**PUT** `/api/v1/gw/circuit-breakers/{ruleId}/state`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 熔断规则 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | string | 是 | 目标状态：`ENABLED` / `DISABLED` |
| reason | string | 否 | 操作原因 |

**请求示例**

```json
{
  "status": "DISABLED",
  "reason": "调试期间临时关闭熔断"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "cb-9a8b7c6d2026",
    "previousStatus": "ENABLED",
    "currentStatus": "DISABLED",
    "updatedAt": "2026-07-16T12:00:00.000+08:00",
    "updatedBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40408 | ruleId 不存在 |

---

#### 3.7.7 查询熔断器实时状态

查询熔断器的当前状态与滑动窗口内的统计数据。

**GET** `/api/v1/gw/circuit-breakers/{ruleId}/status`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 熔断规则 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "cb-9a8b7c6d2026",
    "ruleName": "ont-concepts-cb",
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route-v2",
    "state": "CLOSED",
    "enabled": true,
    "stats": {
      "totalCalls": 85,
      "successfulCalls": 82,
      "failedCalls": 3,
      "failureRate": 0.035,
      "slowCalls": 5,
      "slowCallRate": 0.059,
      "currentFailureRate": 0.035,
      "threshold": 0.3
    },
    "lastStateChange": "2026-07-16T08:00:00.000+08:00",
    "lastFailure": {
      "timestamp": "2026-07-16T09:30:00.000+08:00",
      "statusCode": 500,
      "errorMessage": "Internal Server Error"
    },
    "nextAttemptAt": null
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40408 | ruleId 不存在 |

---

#### 3.7.8 手动恢复（重置熔断器）

手动将熔断器状态重置为 CLOSED，清除滑动窗口数据。

**PUT** `/api/v1/gw/circuit-breakers/{ruleId}/reset`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 熔断规则 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reason | string | 否 | 重置原因 |

**请求示例**

```json
{
  "reason": "后端服务已恢复，手动重置熔断器"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "cb-9a8b7c6d2026",
    "previousState": "OPEN",
    "currentState": "CLOSED",
    "resetAt": "2026-07-16T13:00:00.000+08:00",
    "resetBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40408 | ruleId 不存在 |

---

#### 3.7.9 强制熔断

手动将熔断器状态强制设为 OPEN，所有请求将走降级策略。用于后端服务故障时的紧急隔离。

**PUT** `/api/v1/gw/circuit-breakers/{ruleId}/force-open`

**路径参数**

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| ruleId | string | 是 | 熔断规则 ID |

**请求参数（Body）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reason | string | 是 | 强制熔断原因 |

**请求示例**

```json
{
  "reason": "后端服务故障，紧急隔离"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "cb-9a8b7c6d2026",
    "previousState": "CLOSED",
    "currentState": "OPEN",
    "forceOpen": true,
    "forceOpenReason": "后端服务故障，紧急隔离",
    "forceOpenAt": "2026-07-16T13:30:00.000+08:00",
    "forceOpenBy": "user-admin"
  },
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| 错误码 | 场景 |
|---|---|
| 40408 | ruleId 不存在 |
| 42203 | 熔断器已处于 OPEN 状态 |

---

## 4. 数据模型

### 4.1 PostgreSQL 表结构

TECH-GW 使用 PostgreSQL 17 作为持久化存储，存储路由配置、限流规则、认证规则、API 注册信息、审计日志、灰度规则、熔断规则等。

#### 4.1.1 gw_routes（路由表）

| 列名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| route_id | varchar(64) | PK | 路由 ID |
| tenant_id | varchar(64) | NOT NULL | 租户 ID |
| route_name | varchar(128) | NOT NULL | 路由名称 |
| description | varchar(1024) | | 路由描述 |
| predicates | jsonb | NOT NULL | 路由谓词列表 |
| filters | jsonb | | 路由过滤器列表 |
| target_uri | varchar(512) | | 转发目标 URI |
| service_name | varchar(256) | | 后端服务名称 |
| target_path | varchar(512) | | 转发目标路径 |
| priority | integer | NOT NULL DEFAULT 100 | 路由优先级（1-999） |
| status | varchar(16) | NOT NULL DEFAULT 'ENABLED' | 状态：ENABLED / DISABLED |
| metadata | jsonb | | 扩展元数据 |
| version | integer | NOT NULL DEFAULT 1 | 乐观锁版本号 |
| created_at | timestamptz | NOT NULL DEFAULT NOW() | 创建时间 |
| created_by | varchar(64) | NOT NULL | 创建人 |
| updated_at | timestamptz | NOT NULL DEFAULT NOW() | 更新时间 |
| updated_by | varchar(64) | NOT NULL | 更新人 |
| deleted_at | timestamptz | | 软删除时间 |

**索引**：
- `uk_routes_tenant_name` UNIQUE (tenant_id, route_name) WHERE deleted_at IS NULL
- `idx_routes_tenant_status` (tenant_id, status)
- `idx_routes_service` (service_name)
- `idx_routes_priority` (priority)
- `idx_routes_created_at` (created_at)

#### 4.1.2 gw_rate_limit_rules（限流规则表）

| 列名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| rule_id | varchar(64) | PK | 限流规则 ID |
| tenant_id | varchar(64) | NOT NULL | 租户 ID |
| rule_name | varchar(128) | NOT NULL | 规则名称 |
| description | varchar(1024) | | 规则描述 |
| route_id | varchar(64) | FK -> gw_routes | 关联路由 ID（可空，表示全局限流） |
| scope | varchar(16) | NOT NULL | 限流维度：GLOBAL / USER / IP / APP |
| limit_type | varchar(16) | NOT NULL | 限流类型：QPS / CONCURRENT / TOKEN |
| qps_limit | integer | | QPS 上限 |
| concurrent_limit | integer | | 并发数上限 |
| token_limit | bigint | | Token 配额上限 |
| token_window | varchar(16) | | Token 时间窗口：DAILY / HOURLY / MONTHLY |
| burst_factor | numeric(3,1) | DEFAULT 1.0 | 突发因子 |
| quota_alert_threshold | integer | DEFAULT 80 | 配额预警阈值 |
| status | varchar(16) | NOT NULL DEFAULT 'ENABLED' | 状态 |
| version | integer | NOT NULL DEFAULT 1 | 乐观锁版本号 |
| created_at | timestamptz | NOT NULL DEFAULT NOW() | 创建时间 |
| created_by | varchar(64) | NOT NULL | 创建人 |
| updated_at | timestamptz | NOT NULL DEFAULT NOW() | 更新时间 |
| updated_by | varchar(64) | NOT NULL | 更新人 |
| deleted_at | timestamptz | | 软删除时间 |

**索引**：
- `uk_rate_limits_tenant_name` UNIQUE (tenant_id, rule_name) WHERE deleted_at IS NULL
- `uk_rate_limits_route_scope_type` UNIQUE (tenant_id, route_id, scope, limit_type) WHERE deleted_at IS NULL
- `idx_rate_limits_route` (route_id)
- `idx_rate_limits_status` (status)

#### 4.1.3 gw_auth_rules（认证规则表）

| 列名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| rule_id | varchar(64) | PK | 认证规则 ID |
| tenant_id | varchar(64) | NOT NULL | 租户 ID |
| rule_name | varchar(128) | NOT NULL | 规则名称 |
| description | varchar(1024) | | 规则描述 |
| route_id | varchar(64) | FK -> gw_routes, UNIQUE | 关联路由 ID（一对一） |
| auth_type | varchar(32) | NOT NULL | 认证类型：JWT / API_KEY / NONE / TOKEN_PASSTHROUGH |
| jwt_config | jsonb | | JWT 验证配置 |
| api_key_config | jsonb | | API Key 验证配置 |
| passthrough_config | jsonb | | Token 透传配置 |
| status | varchar(16) | NOT NULL DEFAULT 'ENABLED' | 状态 |
| version | integer | NOT NULL DEFAULT 1 | 乐观锁版本号 |
| created_at | timestamptz | NOT NULL DEFAULT NOW() | 创建时间 |
| created_by | varchar(64) | NOT NULL | 创建人 |
| updated_at | timestamptz | NOT NULL DEFAULT NOW() | 更新时间 |
| updated_by | varchar(64) | NOT NULL | 更新人 |
| deleted_at | timestamptz | | 软删除时间 |

**索引**：
- `uk_auth_rules_tenant_name` UNIQUE (tenant_id, rule_name) WHERE deleted_at IS NULL
- `uk_auth_rules_route` UNIQUE (tenant_id, route_id) WHERE deleted_at IS NULL
- `idx_auth_rules_auth_type` (auth_type)

#### 4.1.4 gw_auth_whitelist（认证白名单表）

| 列名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | bigserial | PK | 自增主键 |
| tenant_id | varchar(64) | NOT NULL | 租户 ID |
| path | varchar(512) | NOT NULL | 白名单路径模式 |
| methods | jsonb | | HTTP 方法列表 |
| description | varchar(512) | | 描述 |
| created_at | timestamptz | NOT NULL DEFAULT NOW() | 创建时间 |
| created_by | varchar(64) | NOT NULL | 创建人 |

**索引**：
- `idx_whitelist_tenant` (tenant_id)
- `idx_whitelist_path` (path)

#### 4.1.5 gw_apis（API 定义表）

| 列名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| api_id | varchar(64) | PK | API ID |
| tenant_id | varchar(64) | NOT NULL | 租户 ID |
| api_name | varchar(128) | NOT NULL | API 名称 |
| description | varchar(1024) | | API 描述 |
| group_id | varchar(64) | FK -> gw_api_groups | 所属分组 ID |
| path | varchar(512) | NOT NULL | API 路径 |
| method | varchar(16) | NOT NULL | HTTP 方法 |
| version | varchar(16) | NOT NULL DEFAULT 'v1' | API 版本号 |
| backend_service | varchar(256) | NOT NULL | 后端服务名称 |
| backend_path | varchar(512) | | 后端服务路径 |
| auth_type | varchar(32) | DEFAULT 'JWT' | 认证类型 |
| tags | jsonb | | 标签列表 |
| status | varchar(16) | NOT NULL DEFAULT 'PUBLISHED' | 状态：PUBLISHED / DRAFT / DEPRECATED |
| metadata | jsonb | | 扩展元数据 |
| route_id | varchar(64) | FK -> gw_routes | 关联路由 ID |
| version_num | integer | NOT NULL DEFAULT 1 | 乐观锁版本号 |
| created_at | timestamptz | NOT NULL DEFAULT NOW() | 创建时间 |
| created_by | varchar(64) | NOT NULL | 创建人 |
| updated_at | timestamptz | NOT NULL DEFAULT NOW() | 更新时间 |
| updated_by | varchar(64) | NOT NULL | 更新人 |
| deleted_at | timestamptz | | 软删除时间 |

**索引**：
- `uk_apis_tenant_name` UNIQUE (tenant_id, api_name) WHERE deleted_at IS NULL
- `uk_apis_path_method_version` UNIQUE (tenant_id, path, method, version) WHERE deleted_at IS NULL
- `idx_apis_group` (group_id)
- `idx_apis_backend_service` (backend_service)
- `idx_apis_status` (status)

#### 4.1.6 gw_api_groups（API 分组表）

| 列名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| group_id | varchar(64) | PK | 分组 ID |
| tenant_id | varchar(64) | NOT NULL | 租户 ID |
| group_name | varchar(128) | NOT NULL | 分组名称 |
| description | varchar(1024) | | 分组描述 |
| parent_group_id | varchar(64) | FK -> gw_api_groups | 父分组 ID |
| metadata | jsonb | | 扩展元数据 |
| created_at | timestamptz | NOT NULL DEFAULT NOW() | 创建时间 |
| created_by | varchar(64) | NOT NULL | 创建人 |
| updated_at | timestamptz | NOT NULL DEFAULT NOW() | 更新时间 |
| updated_by | varchar(64) | NOT NULL | 更新人 |
| deleted_at | timestamptz | | 软删除时间 |

**索引**：
- `uk_api_groups_tenant_name` UNIQUE (tenant_id, group_name) WHERE deleted_at IS NULL
- `idx_api_groups_parent` (parent_group_id)

#### 4.1.7 gw_audit_logs（审计日志表）

| 列名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| log_id | varchar(64) | PK | 日志 ID |
| tenant_id | varchar(64) | NOT NULL | 租户 ID |
| trace_id | varchar(64) | NOT NULL | 链路追踪 ID |
| method | varchar(16) | NOT NULL | HTTP 方法 |
| path | varchar(512) | NOT NULL | 请求路径 |
| query_string | text | | 查询参数 |
| route_id | varchar(64) | | 路由 ID |
| route_name | varchar(128) | | 路由名称 |
| service_name | varchar(256) | | 后端服务名称 |
| backend_uri | varchar(512) | | 后端 URI |
| status_code | integer | NOT NULL | HTTP 响应状态码 |
| error_code | integer | | 业务错误码 |
| error_type | varchar(32) | | 错误类型 |
| error_message | text | | 错误消息 |
| user_id | varchar(64) | | 用户 ID |
| username | varchar(128) | | 用户名 |
| client_ip | varchar(64) | | 客户端 IP |
| user_agent | text | | User-Agent |
| request_headers | jsonb | | 请求头 |
| request_body | text | | 请求体（截断至 4KB） |
| response_headers | jsonb | | 响应头 |
| response_body | text | | 响应体（截断至 4KB） |
| request_size | integer | | 请求大小（字节） |
| response_size | integer | | 响应大小（字节） |
| latency | integer | NOT NULL | 总延迟（毫秒） |
| backend_latency | integer | | 后端延迟（毫秒） |
| auth_type | varchar(32) | | 认证类型 |
| auth_result | varchar(16) | | 认证结果：SUCCESS / FAILURE |
| rate_limit_result | varchar(16) | | 限流结果：PASS / BLOCKED |
| circuit_breaker_state | varchar(16) | | 熔断器状态 |
| grayscale_variant | varchar(64) | | 灰度变体名称 |
| retry_count | integer | DEFAULT 0 | 重试次数 |
| created_at | timestamptz | NOT NULL DEFAULT NOW() | 日志时间 |

**索引**：
- `idx_audit_logs_tenant_created` (tenant_id, created_at DESC)
- `idx_audit_logs_trace_id` (trace_id)
- `idx_audit_logs_route` (route_id)
- `idx_audit_logs_status_code` (status_code)
- `idx_audit_logs_user` (user_id)
- `idx_audit_logs_client_ip` (client_ip)
- `idx_audit_logs_error_type` (error_type) WHERE status_code >= 400

**分区策略**：按 `created_at` 做月度范围分区（PARTITION BY RANGE），保留 90 天数据，超期自动归档至对象存储（MinIO）。

#### 4.1.8 gw_grayscale_rules（灰度规则表）

| 列名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| rule_id | varchar(64) | PK | 灰度规则 ID |
| tenant_id | varchar(64) | NOT NULL | 租户 ID |
| rule_name | varchar(128) | NOT NULL | 规则名称 |
| description | varchar(1024) | | 规则描述 |
| route_id | varchar(64) | FK -> gw_routes, UNIQUE | 关联路由 ID（一对一） |
| strategy | varchar(16) | NOT NULL | 灰度策略：WEIGHT / HEADER / COOKIE / AB_TEST |
| variants | jsonb | NOT NULL | 灰度变体列表 |
| status | varchar(16) | NOT NULL DEFAULT 'ENABLED' | 状态 |
| version | integer | NOT NULL DEFAULT 1 | 乐观锁版本号 |
| created_at | timestamptz | NOT NULL DEFAULT NOW() | 创建时间 |
| created_by | varchar(64) | NOT NULL | 创建人 |
| updated_at | timestamptz | NOT NULL DEFAULT NOW() | 更新时间 |
| updated_by | varchar(64) | NOT NULL | 更新人 |
| deleted_at | timestamptz | | 软删除时间 |

**索引**：
- `uk_grayscale_tenant_name` UNIQUE (tenant_id, rule_name) WHERE deleted_at IS NULL
- `uk_grayscale_route` UNIQUE (tenant_id, route_id) WHERE deleted_at IS NULL

#### 4.1.9 gw_circuit_breaker_rules（熔断规则表）

| 列名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| rule_id | varchar(64) | PK | 熔断规则 ID |
| tenant_id | varchar(64) | NOT NULL | 租户 ID |
| rule_name | varchar(128) | NOT NULL | 规则名称 |
| description | varchar(1024) | | 规则描述 |
| route_id | varchar(64) | FK -> gw_routes, UNIQUE | 关联路由 ID（一对一） |
| failure_type | varchar(32) | NOT NULL | 熔断条件类型 |
| failure_rate_threshold | numeric(3,2) | | 错误率阈值 |
| slow_call_rate_threshold | numeric(3,2) | | 慢调用率阈值 |
| slow_call_duration_threshold | integer | | 慢调用延迟阈值（ms） |
| failure_count_threshold | integer | | 错误次数阈值 |
| sliding_window_size | integer | DEFAULT 100 | 滑动窗口大小 |
| sliding_window_type | varchar(8) | DEFAULT 'COUNT' | 滑动窗口类型 |
| minimum_number_of_calls | integer | DEFAULT 10 | 最小调用次数 |
| wait_duration_in_open_state | integer | DEFAULT 60 | 熔断等待时间（秒） |
| permitted_number_of_calls_in_half_open | integer | DEFAULT 10 | 半开允许调用数 |
| degradation_strategy | varchar(32) | DEFAULT 'RETURN_ERROR' | 降级策略 |
| degradation_config | jsonb | | 降级配置 |
| status | varchar(16) | NOT NULL DEFAULT 'ENABLED' | 状态 |
| version | integer | NOT NULL DEFAULT 1 | 乐观锁版本号 |
| created_at | timestamptz | NOT NULL DEFAULT NOW() | 创建时间 |
| created_by | varchar(64) | NOT NULL | 创建人 |
| updated_at | timestamptz | NOT NULL DEFAULT NOW() | 更新时间 |
| updated_by | varchar(64) | NOT NULL | 更新人 |
| deleted_at | timestamptz | | 软删除时间 |

**索引**：
- `uk_cb_tenant_name` UNIQUE (tenant_id, rule_name) WHERE deleted_at IS NULL
- `uk_cb_route` UNIQUE (tenant_id, route_id) WHERE deleted_at IS NULL

#### 4.1.10 gw_outbox_events（Outbox 事件表）

| 列名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| event_id | bigserial | PK | 事件自增 ID |
| tenant_id | varchar(64) | NOT NULL | 租户 ID |
| trace_id | varchar(64) | NOT NULL | 链路追踪 ID |
| event_type | varchar(64) | NOT NULL | 事件类型 |
| aggregate_id | varchar(64) | NOT NULL | 聚合根 ID（如 routeId / ruleId） |
| payload | jsonb | NOT NULL | 事件载荷 |
| status | varchar(16) | NOT NULL DEFAULT 'PENDING' | 状态：PENDING / SENT / FAILED |
| retry_count | integer | DEFAULT 0 | 重试次数 |
| created_at | timestamptz | NOT NULL DEFAULT NOW() | 创建时间 |
| sent_at | timestamptz | | 发送时间 |

**索引**：
- `idx_outbox_status_created` (status, created_at) WHERE status = 'PENDING'
- `idx_outbox_aggregate` (aggregate_id)
- `idx_outbox_trace_id` (trace_id)

---

### 4.2 Redis 数据结构

TECH-GW 使用 Redis 7.4 作为缓存层与运行时状态存储。

#### 4.2.1 路由配置缓存

| Key 模式 | 类型 | TTL | 说明 |
|---|---|---|---|
| `gw:{tenantId}:routes` | Hash | 无过期 | 路由配置缓存，field=routeId，value=JSON |
| `gw:{tenantId}:routes:priority` | ZSet | 无过期 | 路由优先级排序，score=priority，member=routeId |
| `gw:{tenantId}:routes:version` | String | 无过期 | 路由配置版本号，用于变更检测 |

#### 4.2.2 限流计数器

| Key 模式 | 类型 | TTL | 说明 |
|---|---|---|---|
| `gw:ratelimit:{ruleId}:qps:{scope}:{scopeId}` | String（INCR） | 1 秒 | QPS 计数器，按秒级窗口 |
| `gw:ratelimit:{ruleId}:concurrent:{scope}:{scopeId}` | String（INCR/DECR） | 300 秒 | 并发计数器，请求完成时 DECR |
| `gw:ratelimit:{ruleId}:token:{scope}:{scopeId}:{date}` | String（INCR） | 25 小时 | Token 配额计数器，按天/小时/月 |
| `gw:ratelimit:{ruleId}:config` | Hash | 无过期 | 限流规则配置缓存 |

#### 4.2.3 认证缓存

| Key 模式 | 类型 | TTL | 说明 |
|---|---|---|---|
| `gw:auth:{tenantId}:jwt:{tokenHash}` | Hash | 300 秒 | JWT 验证结果缓存（避免重复调用 TECH-IAM） |
| `gw:auth:{tenantId}:apikey:{apiKeyHash}` | Hash | 300 秒 | API Key 验证结果缓存 |
| `gw:auth:{tenantId}:rules` | Hash | 无过期 | 认证规则配置缓存 |
| `gw:auth:{tenantId}:whitelist` | Set | 无过期 | 白名单路径集合 |

#### 4.2.4 熔断器状态

| Key 模式 | 类型 | TTL | 说明 |
|---|---|---|---|
| `gw:circuit:{ruleId}:state` | String | 无过期 | 熔断器当前状态：CLOSED / OPEN / HALF_OPEN / DISABLED |
| `gw:circuit:{ruleId}:sliding_window` | Hash | 无过期 | 滑动窗口数据（成功/失败/慢调用计数） |
| `gw:circuit:{ruleId}:last_state_change` | String | 无过期 | 上次状态变更时间戳 |
| `gw:circuit:{ruleId}:force_open` | String | 无过期 | 强制熔断标记 |
| `gw:circuit:{ruleId}:config` | Hash | 无过期 | 熔断规则配置缓存 |

#### 4.2.5 灰度规则缓存

| Key 模式 | 类型 | TTL | 说明 |
|---|---|---|---|
| `gw:grayscale:{tenantId}:rules` | Hash | 无过期 | 灰度规则配置缓存，field=routeId，value=JSON |
| `gw:grayscale:{ruleId}:variant:{variantName}:count` | String（INCR） | 24 小时 | 灰度变体流量计数 |

#### 4.2.6 API 定义缓存

| Key 模式 | 类型 | TTL | 说明 |
|---|---|---|---|
| `gw:apis:{tenantId}:definitions` | Hash | 300 秒 | API 定义缓存，field=apiId，value=JSON |
| `gw:apis:{tenantId}:path_map` | Hash | 300 秒 | 路径到 API 的映射缓存 |
| `gw:apis:{tenantId}:groups` | Hash | 300 秒 | API 分组缓存 |

#### 4.2.7 配置刷新通知

| Key 模式 | 类型 | TTL | 说明 |
|---|---|---|---|
| `gw:config:refresh:channel` | Pub/Sub | - | 配置刷新通知频道，所有网关实例订阅 |
| `gw:config:refresh:{refreshId}` | String | 60 秒 | 刷新任务状态 |

#### 4.2.8 幂等控制

| Key 模式 | 类型 | TTL | 说明 |
|---|---|---|---|
| `gw:idempotent:{tenantId}:{requestType}:{requestId}` | String | 24 小时 | 幂等去重键，value=首次响应 JSON |

---

## 5. 事件定义

### 5.1 Kafka Topic 定义

所有事件通过 **Outbox 模式** 发布，确保事务一致性与数据不丢失。每条消息包含 `X-Trace-Id` Header。

| Topic | 说明 | 分区数 | 保留期 |
|---|---|---|---|
| `metaplatform.gw.audit` | 请求审计事件（每条请求的审计日志） | 12 | 7 天 |
| `metaplatform.gw.rate-limit` | 限流事件（限流触发、配额预警） | 6 | 3 天 |
| `metaplatform.gw.circuit-breaker` | 熔断事件（状态变更、强制熔断、手动恢复） | 6 | 7 天 |
| `metaplatform.gw.config-change` | 配置变更事件（路由/限流/认证/灰度/熔断规则变更） | 3 | 30 天 |
| `metaplatform.gw.grayscale` | 灰度事件（灰度规则变更、流量分配调整） | 3 | 7 天 |

**DLQ Topic**：

| Topic | 说明 |
|---|---|
| `metaplatform.gw.audit.dlq` | 审计事件死信队列 |
| `metaplatform.gw.rate-limit.dlq` | 限流事件死信队列 |
| `metaplatform.gw.circuit-breaker.dlq` | 熔断事件死信队列 |
| `metaplatform.gw.config-change.dlq` | 配置变更死信队列 |
| `metaplatform.gw.grayscale.dlq` | 灰度事件死信队列 |

> DLQ 消费失败的消息重试上限：3 次。DLQ 记录必须包含 `traceId` 字段。

### 5.2 事件结构

所有事件遵循统一的信封结构：

```json
{
  "eventId": "evt-20260716-000001",
  "eventType": "AUDIT_LOG_CREATED",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "aggregateId": "log-20260716-000001",
  "timestamp": "2026-07-16T10:30:00.000+08:00",
  "source": "TECH-GW",
  "version": "1.0",
  "payload": { }
}
```

**Kafka Header**：

| Header | 说明 |
|---|---|
| `X-Trace-Id` | 链路追踪 ID |
| `X-Tenant-Id` | 租户 ID |
| `X-Event-Type` | 事件类型 |
| `X-Event-Id` | 事件唯一 ID |

### 5.3 事件类型详情

#### 5.3.1 请求审计事件

**Topic**: `metaplatform.gw.audit`
**EventType**: `AUDIT_LOG_CREATED`

```json
{
  "eventId": "evt-20260716-000001",
  "eventType": "AUDIT_LOG_CREATED",
  "tenantId": "tenant-001",
  "traceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "aggregateId": "log-20260716-000001",
  "timestamp": "2026-07-16T10:30:00.000+08:00",
  "source": "TECH-GW",
  "version": "1.0",
  "payload": {
    "logId": "log-20260716-000001",
    "method": "POST",
    "path": "/api/v1/ont/concepts",
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route-v2",
    "serviceName": "tech-ont-service",
    "statusCode": 201,
    "userId": "user-001",
    "clientIp": "192.168.1.100",
    "latency": 85,
    "backendLatency": 75,
    "authType": "JWT",
    "authResult": "SUCCESS",
    "rateLimitResult": "PASS",
    "circuitBreakerState": "CLOSED",
    "grayscaleVariant": null,
    "requestSize": 512,
    "responseSize": 1024
  }
}
```

#### 5.3.2 限流触发事件

**Topic**: `metaplatform.gw.rate-limit`
**EventType**: `RATE_LIMIT_TRIGGERED`

```json
{
  "eventId": "evt-20260716-000050",
  "eventType": "RATE_LIMIT_TRIGGERED",
  "tenantId": "tenant-001",
  "traceId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "aggregateId": "rl-9a8b7c6d2026",
  "timestamp": "2026-07-16T10:35:00.000+08:00",
  "source": "TECH-GW",
  "version": "1.0",
  "payload": {
    "ruleId": "rl-9a8b7c6d2026",
    "ruleName": "ont-concepts-qps-limit-v2",
    "routeId": "route-9a8b7c6d2026",
    "limitType": "QPS",
    "scope": "USER",
    "scopeId": "user-002",
    "limit": 200,
    "current": 201,
    "clientIp": "192.168.1.101",
    "method": "POST",
    "path": "/api/v1/ont/concepts"
  }
}
```

#### 5.3.3 限流配额预警事件

**Topic**: `metaplatform.gw.rate-limit`
**EventType**: `RATE_LIMIT_QUOTA_ALERT`

```json
{
  "eventId": "evt-20260716-000051",
  "eventType": "RATE_LIMIT_QUOTA_ALERT",
  "tenantId": "tenant-001",
  "traceId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "aggregateId": "rl-token-001",
  "timestamp": "2026-07-16T10:40:00.000+08:00",
  "source": "TECH-GW",
  "version": "1.0",
  "payload": {
    "ruleId": "rl-token-001",
    "ruleName": "llmgw-token-daily-limit",
    "routeId": "route-112233445566",
    "limitType": "TOKEN",
    "scope": "USER",
    "scopeId": "user-003",
    "tokenLimit": 1000000,
    "tokenUsed": 802000,
    "usagePercent": 80.2,
    "threshold": 80
  }
}
```

#### 5.3.4 熔断状态变更事件

**Topic**: `metaplatform.gw.circuit-breaker`
**EventType**: `CIRCUIT_BREAKER_STATE_CHANGED`

```json
{
  "eventId": "evt-20260716-000100",
  "eventType": "CIRCUIT_BREAKER_STATE_CHANGED",
  "tenantId": "tenant-001",
  "traceId": "d4e5f6a7-b890-1234-def0-234567890123",
  "aggregateId": "cb-9a8b7c6d2026",
  "timestamp": "2026-07-16T11:00:00.000+08:00",
  "source": "TECH-GW",
  "version": "1.0",
  "payload": {
    "ruleId": "cb-9a8b7c6d2026",
    "ruleName": "ont-concepts-cb",
    "routeId": "route-9a8b7c6d2026",
    "previousState": "CLOSED",
    "currentState": "OPEN",
    "triggerReason": "ERROR_RATE_EXCEEDED",
    "failureRate": 0.52,
    "threshold": 0.3,
    "totalCalls": 100,
    "failedCalls": 52,
    "waitDurationInOpenState": 120,
    "nextAttemptAt": "2026-07-16T11:02:00.000+08:00"
  }
}
```

#### 5.3.5 熔断手动恢复事件

**Topic**: `metaplatform.gw.circuit-breaker`
**EventType**: `CIRCUIT_BREAKER_MANUAL_RESET`

```json
{
  "eventId": "evt-20260716-000101",
  "eventType": "CIRCUIT_BREAKER_MANUAL_RESET",
  "tenantId": "tenant-001",
  "traceId": "e5f6a7b8-9012-3456-ef01-345678901234",
  "aggregateId": "cb-9a8b7c6d2026",
  "timestamp": "2026-07-16T13:00:00.000+08:00",
  "source": "TECH-GW",
  "version": "1.0",
  "payload": {
    "ruleId": "cb-9a8b7c6d2026",
    "ruleName": "ont-concepts-cb",
    "routeId": "route-9a8b7c6d2026",
    "previousState": "OPEN",
    "currentState": "CLOSED",
    "operator": "user-admin",
    "reason": "后端服务已恢复，手动重置熔断器"
  }
}
```

#### 5.3.6 配置变更事件

**Topic**: `metaplatform.gw.config-change`
**EventType**: `ROUTE_CONFIG_CHANGED`

```json
{
  "eventId": "evt-20260716-000200",
  "eventType": "ROUTE_CONFIG_CHANGED",
  "tenantId": "tenant-001",
  "traceId": "f6a7b890-1234-5678-f012-456789012345",
  "aggregateId": "route-9a8b7c6d2026",
  "timestamp": "2026-07-16T11:00:00.000+08:00",
  "source": "TECH-GW",
  "version": "1.0",
  "payload": {
    "configType": "ROUTE",
    "action": "UPDATED",
    "routeId": "route-9a8b7c6d2026",
    "routeName": "ont-concepts-route-v2",
    "operator": "user-zhangsan",
    "changes": ["routeName", "predicates", "filters"]
  }
}
```

**其他配置变更事件类型**：

| EventType | 说明 |
|---|---|
| `ROUTE_CONFIG_CHANGED` | 路由配置变更（CREATED / UPDATED / DELETED / STATE_CHANGED） |
| `RATE_LIMIT_CONFIG_CHANGED` | 限流规则配置变更 |
| `AUTH_RULE_CONFIG_CHANGED` | 认证规则配置变更 |
| `API_DEFINITION_CHANGED` | API 定义变更 |
| `GRAYSCALE_CONFIG_CHANGED` | 灰度规则配置变更 |
| `CIRCUIT_BREAKER_CONFIG_CHANGED` | 熔断规则配置变更 |
| `ROUTE_CONFIG_REFRESHED` | 路由配置刷新完成 |

#### 5.3.7 灰度流量调整事件

**Topic**: `metaplatform.gw.grayscale`
**EventType**: `GRAYSCALE_TRAFFIC_ADJUSTED`

```json
{
  "eventId": "evt-20260716-000300",
  "eventType": "GRAYSCALE_TRAFFIC_ADJUSTED",
  "tenantId": "tenant-001",
  "traceId": "a7b89012-3456-7890-0123-567890123456",
  "aggregateId": "gs-9a8b7c6d2026",
  "timestamp": "2026-07-16T11:00:00.000+08:00",
  "source": "TECH-GW",
  "version": "1.0",
  "payload": {
    "ruleId": "gs-9a8b7c6d2026",
    "ruleName": "ont-concepts-canary",
    "routeId": "route-9a8b7c6d2026",
    "previousVariants": [
      { "name": "stable", "weight": 90 },
      { "name": "canary", "weight": 10 }
    ],
    "currentVariants": [
      { "name": "stable", "weight": 50 },
      { "name": "canary", "weight": 50 }
    ],
    "operator": "user-zhangsan"
  }
}
```

---

## 6. 增量交付计划

### 6.1 交付阶段总览

| 阶段 | 名称 | 时间 | 交付内容 |
|---|---|---|---|
| P0 | 核心路由与认证 | 第 1-2 周 | 路由管理（CRUD + 启停 + 优先级）、JWT 认证集成、请求审计基础 |
| P1 | 限流与熔断 | 第 3-4 周 | 限流管理（QPS/并发/Token）、熔断降级（CRUD + 状态查询 + 手动恢复） |
| P2 | API 管理与灰度 | 第 5-6 周 | API 注册/分组/版本管理、OpenAPI 导出、灰度发布（权重/Header/Cookie） |
| P3 | 审计增强与可观测 | 第 7-8 周 | 调用链追踪、延迟统计、慢请求分析、审计日志导出 |
| P4 | 生产加固 | 第 9-10 周 | 配置热更新优化、DLQ 处理、性能压测、多租户隔离加固 |

### 6.2 P0 - 核心路由与认证（第 1-2 周）

**目标**：建立网关核心路由能力与认证集成。

| 交付项 | 说明 |
|---|---|
| 路由管理 API | 路由 CRUD、谓词配置、过滤器配置、路由启停、优先级调整 |
| 路由匹配引擎 | Spring Cloud Gateway Predicate 链实现，支持 Path/Host/Header/Method |
| JWT 认证集成 | 与 TECH-IAM 集成的 JWT 验证、Token 解析、角色校验 |
| 认证规则管理 | 认证规则 CRUD、白名单路径管理 |
| 基础请求审计 | 请求/响应日志记录、trace_id 生成与传播 |
| Outbox 模式 | Kafka Outbox 事件表与发布器实现 |
| PostgreSQL 表结构 | gw_routes、gw_auth_rules、gw_auth_whitelist、gw_audit_logs、gw_outbox_events |
| Redis 缓存 | 路由配置缓存、JWT 验证缓存 |

**验收标准**：
- 路由 CRUD 全流程通过
- JWT 认证正确拦截非法请求
- 请求审计日志包含完整 trace_id
- Kafka 事件通过 Outbox 模式可靠发布

### 6.3 P1 - 限流与熔断（第 3-4 周）

**目标**：实现流量控制与服务保护能力。

| 交付项 | 说明 |
|---|---|
| 限流管理 API | 限流规则 CRUD、启停、统计查询、计数器重置 |
| QPS 限流 | 基于 Redis 令牌桶的 QPS 限流，支持全局/用户/IP/应用维度 |
| 并发限流 | 基于 Redis INCR/DECR 的并发数控制 |
| Token 限流 | 按 Token 配额的用量控制，支持日/小时/月窗口 |
| 配额预警 | Token 配额达到阈值时发布预警事件 |
| 熔断降级 API | 熔断规则 CRUD、启停、状态查询、手动恢复、强制熔断 |
| Resilience4j 集成 | 熔断器状态机（CLOSED/OPEN/HALF_OPEN）、滑动窗口 |
| 降级策略 | 返回默认值、重定向、返回错误页 |
| 限流/熔断事件 | Kafka 事件发布（限流触发、配额预警、熔断状态变更） |
| PostgreSQL 表结构 | gw_rate_limit_rules、gw_circuit_breaker_rules |
| Redis 数据结构 | 限流计数器、熔断器状态 |

**验收标准**：
- QPS 限流精度误差 < 5%
- 熔断器在错误率达阈值时正确切换状态
- 降级策略在熔断 OPEN 时生效
- 限流/熔断事件正确发布到 Kafka

### 6.4 P2 - API 管理与灰度（第 5-6 周）

**目标**：完善 API 生命周期管理与灰度发布能力。

| 交付项 | 说明 |
|---|---|
| API 管理 API | API 注册、更新、删除、列表查询 |
| API 分组 | 分组 CRUD、树形结构、API 归组 |
| API 版本管理 | 版本列表、创建新版本、版本切换 |
| OpenAPI 导出 | 全量/按分组导出 OpenAPI 3.0 文档（JSON/YAML） |
| 灰度发布 API | 灰度规则 CRUD、启停、统计查询 |
| 灰度策略 | 权重分流、Header 匹配、Cookie 匹配、A/B 测试 |
| 灰度统计 | 变体流量统计、错误率对比、延迟对比 |
| API Key 认证 | API Key 验证配置、与 TECH-IAM 集成 |
| Token 透传 | Token 透传配置（不验证直接转发） |
| PostgreSQL 表结构 | gw_apis、gw_api_groups、gw_grayscale_rules |
| Redis 数据结构 | API 定义缓存、灰度规则缓存 |

**验收标准**：
- API 注册与路由正确关联
- OpenAPI 文档格式符合 3.0 规范
- 灰度权重分流误差 < 2%
- 灰度统计正确反映各变体流量

### 6.5 P3 - 审计增强与可观测（第 7-8 周）

**目标**：完善审计能力与全链路可观测性。

| 交付项 | 说明 |
|---|---|
| 调用链追踪 | trace_id 全链路关联、Span 上报至 OpenTelemetry |
| 延迟统计 | P50/P90/P95/P99 分位数统计、按路由维度统计 |
| 慢请求分析 | 慢请求查询、阈值配置 |
| 错误请求分析 | 错误日志查询、错误类型分类、错误详情 |
| 审计日志导出 | CSV/JSON 导出、异步生成、下载链接 |
| 审计日志分区 | 按月分区、自动归档策略 |
| Prometheus 指标 | 请求 QPS、延迟分位数、错误率、限流触发率、熔断状态 |
| Grafana 仪表盘 | 网关总览、路由维度、限流面板、熔断面板 |

**验收标准**：
- trace_id 在网关->后端服务全链路贯通
- 延迟分位数统计误差 < 1%
- 审计日志导出支持 10 万条
- Prometheus 指标采集无丢失

### 6.6 P4 - 生产加固（第 9-10 周）

**目标**：生产环境稳定性与性能保障。

| 交付项 | 说明 |
|---|---|
| 配置热更新优化 | Redis Pub/Sub 通知、原子刷新、P99 < 3 秒 |
| DLQ 处理 | 死信队列消费、重试 3 次、traceId 保留 |
| 幂等控制 | X-Request-Id 幂等去重、24 小时窗口 |
| 性能压测 | 单实例 10000 QPS、P99 < 50ms（不含后端） |
| 多租户隔离 | 租户级配置隔离、限流隔离、审计隔离 |
| SSE 流式透传 | LLM 对话 SSE 流式响应透传支持 |
| WebSocket 透传 | WebSocket 协议透传支持 |
| 安全加固 | CORS 配置、SQL 注入防护、XSS 过滤、请求体大小限制 |
| 高可用 | 多实例部署、健康检查、优雅停机 |
| 灾备 | 配置备份与恢复、Redis 持久化 |

**验收标准**：
- 配置热更新 P99 < 3 秒
- 单实例 10000 QPS 下 P99 < 50ms
- DLQ 消息包含 traceId
- SSE/WebSocket 透传正常
- 多租户数据完全隔离

---

## 附录

### A. 枚举值速查

| 枚举 | 取值 |
|---|---|
| 路由状态 | ENABLED, DISABLED |
| 谓词类型 | PATH, HOST, HEADER, METHOD, QUERY, AFTER, BEFORE, BETWEEN, COOKIE |
| 过滤器类型 | REWRITE_PATH, ADD_HEADER, REMOVE_HEADER, SET_STATUS, RETRY, PREFIX_PATH, STRIP_PREFIX |
| 限流维度 | GLOBAL, USER, IP, APP |
| 限流类型 | QPS, CONCURRENT, TOKEN |
| Token 窗口 | DAILY, HOURLY, MONTHLY |
| 认证类型 | JWT, API_KEY, NONE, TOKEN_PASSTHROUGH |
| API 状态 | PUBLISHED, DRAFT, DEPRECATED |
| 灰度策略 | WEIGHT, HEADER, COOKIE, AB_TEST |
| 熔断条件类型 | ERROR_RATE, SLOW_CALL_RATE, ERROR_COUNT |
| 滑动窗口类型 | COUNT, TIME |
| 降级策略 | RETURN_DEFAULT, REDIRECT, RETURN_ERROR |
| 熔断器状态 | CLOSED, OPEN, HALF_OPEN, DISABLED |
| 错误类型 | AUTH, RATE_LIMIT, CIRCUIT_BREAKER, BACKEND_ERROR, TIMEOUT, INTERNAL |
| Outbox 事件状态 | PENDING, SENT, FAILED |

### B. API 路径速查

| 能力域 | 路径前缀 |
|---|---|
| 路由管理 | `/api/v1/gw/routes` |
| 限流管理 | `/api/v1/gw/rate-limits` |
| 认证管理 | `/api/v1/gw/auth-rules` |
| API 管理 | `/api/v1/gw/apis` |
| 请求审计 | `/api/v1/gw/audit` |
| 灰度发布 | `/api/v1/gw/grayscale` |
| 熔断降级 | `/api/v1/gw/circuit-breakers` |

### C. Kafka Topic 速查

| Topic | 说明 |
|---|---|
| `metaplatform.gw.audit` | 请求审计事件 |
| `metaplatform.gw.rate-limit` | 限流事件 |
| `metaplatform.gw.circuit-breaker` | 熔断事件 |
| `metaplatform.gw.config-change` | 配置变更事件 |
| `metaplatform.gw.grayscale` | 灰度事件 |
| `metaplatform.gw.*.dlq` | 各 Topic 对应的死信队列 |

---

> 本文档由 Mate Platform 平台架构组维护，如有疑问请联系平台架构团队。
