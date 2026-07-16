# SPEC - 可观测性服务 API 规范（TECH-OBS）

> **文档编号**：SPEC-TECH-OBS-可观测性API规范
> **版本**：v1.0
> **日期**：2026-07-16
> **状态**：正式发布

## 版本历史

| 版本 | 日期 | 变更说明 | 作者 |
|---|---|---|---|
| v1.0 | 2026-07-16 | 初始版本，覆盖日志、指标、链路追踪、告警、仪表板、服务地图、SLO 七大领域 API | - |

---

## 目录

- [1. 服务概述](#1-服务概述)
- [2. 通用约定](#2-通用约定)
- [3. API 接口详情](#3-api-接口详情)
  - [3.1 日志管理 API](#31-日志管理-api)
  - [3.2 指标管理 API](#32-指标管理-api)
  - [3.3 链路追踪 API](#33-链路追踪-api)
  - [3.4 告警管理 API](#34-告警管理-api)
  - [3.5 仪表板管理 API](#35-仪表板管理-api)
  - [3.6 服务地图 API](#36-服务地图-api)
  - [3.7 SLO 管理 API](#37-slo-管理-api)
- [4. 数据模型](#4-数据模型)
- [5. 事件定义](#5-事件定义)
- [6. 增量交付计划](#6-增量交付计划)

---

## 1. 服务概述

### 1.1 定位

TECH-OBS 是 Mate Platform 的可观测性技术服务模块，为平台所有应用模块（APP-\*）和技术服务模块（TECH-\*）提供统一的日志、指标、链路追踪、告警、仪表板、服务地图和 SLO 管理能力。

TECH-OBS 并非简单封装开源组件，而是在 OpenTelemetry + Prometheus + Loki + Jaeger 之上构建统一的 API 层、数据模型层和治理层，使平台所有模块通过标准化 API 完成可观测性数据的写入与查询，而无需直接对接底层异构系统。

### 1.2 技术栈

| 层级 | 技术 | 版本 | 用途 |
|---|---|---|---|
| 应用层 | Java 21 + Spring Boot 3.4 | 21 / 3.4 | API 服务主体 |
| 链路采集 | OpenTelemetry Collector | 0.115+ | Trace/Metrics/Logs 采集网关 |
| Java Agent | OpenTelemetry Java Agent | 2.x | Java 应用自动埋点 |
| Python SDK | OpenTelemetry Python | 1.29+ | Python 应用自动埋点 |
| 指标存储 | Prometheus + Alertmanager | 3.x | 指标存储与告警引擎 |
| 日志存储 | Loki + Vector | 3.x | 日志存储与日志管道 |
| 链路存储 | Jaeger | 1.62+ | 分布式链路存储与查询 |
| 可视化 | Grafana | 11.x | 仪表板与可视化引擎 |
| 元数据存储 | PostgreSQL | 17 | 告警规则、仪表板配置、SLO 定义等元数据 |
| 消息队列 | Kafka | 3.9 | 告警事件分发 |
| 缓存 | Redis | 7.4 | 查询缓存、限流 |

### 1.3 上游依赖

| 上游模块 | 依赖说明 |
|---|---|
| 所有 APP-\* 模块 | 通过 OpenTelemetry SDK / Agent 自动上报日志、指标、Trace |
| 所有 TECH-\* 模块 | 同上，自动上报可观测性数据 |
| TECH-IAM | 认证鉴权，API 请求身份校验 |
| TECH-GW | API 网关路由、限流 |
| TECH-MSG | Kafka 消息基础设施，用于告警事件分发 |

### 1.4 下游消费

| 下游模块 | 消费说明 |
|---|---|
| APP-DASHBOARD | 可观测性仪表板展示，消费日志查询、指标查询、链路查询、告警列表、服务地图、SLO 等 API |
| APP-ARCH | 架构健康度分析，消费服务地图与指标数据 |
| 运维平台 | 外部运维系统集成，消费告警通知与指标数据 |

### 1.5 核心职责

1. **日志管理**：应用日志收集（Loki）、日志查询（全文搜索 / 结构化查询 / LogQL）、日志级别动态管理、日志告警规则
2. **指标管理**：自定义指标注册、指标采集配置、指标查询（PromQL）、指标元数据管理
3. **链路追踪**：分布式链路追踪（基于 OpenTelemetry + Jaeger）、Trace 查询、Span 详情、调用拓扑图
4. **告警管理**：告警规则配置（日志告警 / 指标告警 / 链路告警）、告警通知、告警 silenced / 恢复、告警历史
5. **仪表板管理**：自定义仪表板 CRUD、仪表板组件配置、仪表板分享与导出
6. **服务地图**：服务拓扑图、服务依赖关系、服务健康状态
7. **SLO 管理**：SLO 定义、错误预算（Error Budget）、SLI 查询、SLO 报告

---

## 2. 通用约定

### 2.1 路径前缀

所有 TECH-OBS API 路径统一前缀为：

```
/api/v1/obs
```

完整路径示例：`/api/v1/obs/logs/query`

### 2.2 统一响应体

所有 API 响应均使用统一的 JSON 结构：

```json
{
  "code": 0,
  "message": "success",
  "data": { ... },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | integer | 业务状态码，`0` 表示成功，非 `0` 表示业务错误 |
| `message` | string | 状态描述信息 |
| `data` | object / array / null | 业务数据载荷 |
| `traceId` | string | 本次请求的分布式链路追踪 ID，32 位十六进制字符串 |

**分页响应体**：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [ ... ],
    "total": 1523,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

### 2.3 认证

- 所有 API 请求须携带 `Authorization: Bearer <JWT_TOKEN>` 请求头
- JWT Token 由 TECH-IAM 签发与校验
- 请求头须携带 `X-Trace-Id`（如已有则透传，无则由网关生成），用于全链路追踪

### 2.4 错误码

| code | HTTP Status | 含义 | 说明 |
|---|---|---|---|
| `0` | 200 | 成功 | 请求处理成功 |
| `40001` | 400 | 参数校验失败 | 请求参数缺失或格式错误 |
| `40004` | 404 | 资源不存在 | 请求的资源未找到 |
| `40009` | 409 | 资源冲突 | 资源已存在或状态冲突 |
| `40101` | 401 | 未认证 | Token 缺失或无效 |
| `40301` | 403 | 无权限 | 当前用户无操作权限 |
| `42901` | 429 | 请求限流 | 触发速率限制 |
| `50001` | 500 | 服务内部错误 | 服务端未预期异常 |
| `50301` | 503 | 下游不可用 | Loki / Prometheus / Jaeger 等下游不可用 |
| `50401` | 504 | 查询超时 | 查询执行超时 |

错误响应示例：

```json
{
  "code": 40001,
  "message": "参数校验失败：startTime 不能为空",
  "data": null,
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

### 2.5 分页约定

列表类 API 支持统一分页参数：

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `page` | integer | 1 | 页码，从 1 开始 |
| `pageSize` | integer | 20 | 每页条数，最大 100 |
| `sortBy` | string | - | 排序字段 |
| `sortOrder` | string | `desc` | 排序方向：`asc` / `desc` |

### 2.6 trace_id 传播

- 所有 HTTP 请求头须携带 `X-Trace-Id`
- 服务间调用（Feign / RestTemplate）自动传播 `X-Trace-Id`
- Kafka 消息头包含 `X-Trace-Id`
- 日志输出 MDC 中包含 `traceId` 字段
- 统一响应体中 `traceId` 字段返回本次请求的追踪 ID

### 2.7 时间格式

- 所有时间参数和返回值使用 ISO 8601 UTC 格式：`2026-07-16T08:00:00Z`
- 时间范围查询参数：`startTime`（必填）、`endTime`（必填），最长查询跨度 7 天

---

## 3. API 接口详情

### 3.1 日志管理 API

日志管理 API 提供基于 Loki 的日志查询、搜索、日志级别管理和日志告警规则管理能力。

---

#### 3.1.1 日志查询（结构化查询）

**POST** `/api/v1/obs/logs/query`

对指定日志流进行结构化查询，支持按标签过滤、时间范围和 LogQL 表达式。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `service` | body | string | 是 | 服务名称，如 `tech-ont` |
| `labels` | body | object | 否 | 标签过滤条件，key-value 键值对 |
| `query` | body | string | 否 | LogQL 查询表达式，如 `{service="tech-ont"} \|~ "ERROR"` |
| `startTime` | body | string | 是 | 查询起始时间，ISO 8601 UTC |
| `endTime` | body | string | 是 | 查询结束时间，ISO 8601 UTC |
| `limit` | body | integer | 否 | 返回日志条数上限，默认 100，最大 5000 |
| `direction` | body | string | 否 | 日志排序方向：`forward`（正序）/ `backward`（倒序），默认 `backward` |
| `page` | body | integer | 否 | 页码，默认 1 |
| `pageSize` | body | integer | 否 | 每页条数，默认 20 |

**请求示例**

```json
{
  "service": "tech-ont",
  "labels": {
    "level": "ERROR",
    "env": "production"
  },
  "query": "{service=\"tech-ont\"} |= \"NullPointerException\"",
  "startTime": "2026-07-16T00:00:00Z",
  "endTime": "2026-07-16T08:00:00Z",
  "limit": 100,
  "direction": "backward",
  "page": 1,
  "pageSize": 20
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
        "timestamp": "2026-07-16T07:59:32.123Z",
        "service": "tech-ont",
        "level": "ERROR",
        "message": "NullPointerException at com.metaplatform.ont.engine.ConceptService.resolve(ConceptService.java:142)",
        "labels": {
          "service": "tech-ont",
          "level": "ERROR",
          "env": "production",
          "host": "pod-ont-7f9b-x2k4"
        },
        "traceId": "a1b2c3d4e5f6789012345678abcdef00",
        "spanId": "1a2b3c4d5e6f7a8b",
        "metadata": {
          "logger": "com.metaplatform.ont.engine.ConceptService",
          "thread": "http-nio-8080-exec-3"
        }
      },
      {
        "timestamp": "2026-07-16T07:58:15.456Z",
        "service": "tech-ont",
        "level": "ERROR",
        "message": "Failed to resolve concept ontology: concept_id=ont_0042",
        "labels": {
          "service": "tech-ont",
          "level": "ERROR",
          "env": "production",
          "host": "pod-ont-7f9b-x2k4"
        },
        "traceId": "b2c3d4e5f6789012345678abcdef001",
        "spanId": "2b3c4d5e6f7a8b9c",
        "metadata": {
          "logger": "com.metaplatform.ont.engine.ConceptService",
          "thread": "http-nio-8080-exec-1"
        }
      }
    ],
    "total": 47,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | `startTime` 或 `endTime` 缺失 / 格式错误 |
| `40001` | `service` 字段为空 |
| `50301` | Loki 下游不可用 |
| `50401` | 查询执行超时（超过 30s） |

---

#### 3.1.2 日志全文搜索

**POST** `/api/v1/obs/logs/search`

跨服务全文搜索日志内容，支持关键词、正则表达式和模糊匹配。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `keyword` | body | string | 是 | 搜索关键词，支持正则 |
| `services` | body | array[string] | 否 | 限定服务列表，为空则搜索全部服务 |
| `levels` | body | array[string] | 否 | 日志级别过滤：`DEBUG` / `INFO` / `WARN` / `ERROR` |
| `startTime` | body | string | 是 | 查询起始时间 |
| `endTime` | body | string | 是 | 查询结束时间 |
| `isRegex` | body | boolean | 否 | 是否正则匹配，默认 `false` |
| `caseSensitive` | body | boolean | 否 | 是否区分大小写，默认 `false` |
| `page` | body | integer | 否 | 页码，默认 1 |
| `pageSize` | body | integer | 否 | 每页条数，默认 20 |

**请求示例**

```json
{
  "keyword": "OutOfMemoryError",
  "services": ["tech-ont", "tech-wfe", "tech-rag"],
  "levels": ["ERROR", "FATAL"],
  "startTime": "2026-07-16T00:00:00Z",
  "endTime": "2026-07-16T08:00:00Z",
  "isRegex": false,
  "caseSensitive": true,
  "page": 1,
  "pageSize": 20
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
        "timestamp": "2026-07-16T07:45:00.789Z",
        "service": "tech-rag",
        "level": "ERROR",
        "message": "java.lang.OutOfMemoryError: Java heap space during vector embedding batch processing",
        "labels": {
          "service": "tech-rag",
          "level": "ERROR",
          "env": "production"
        },
        "traceId": "c3d4e5f6789012345678abcdef002",
        "spanId": "3c4d5e6f7a8b9c0d",
        "highlights": ["OutOfMemoryError"]
      }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | `keyword` 为空 |
| `50301` | Loki 下游不可用 |
| `50401` | 查询超时 |

---

#### 3.1.3 日志级别动态管理

**PUT** `/api/v1/obs/logs/level`

动态修改指定服务的日志级别，无需重启应用。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `service` | body | string | 是 | 服务名称 |
| `logger` | body | string | 是 | Logger 全限定名，如 `com.metaplatform.ont.engine`；设为 `ROOT` 表示根 Logger |
| `level` | body | string | 是 | 目标日志级别：`TRACE` / `DEBUG` / `INFO` / `WARN` / `ERROR` / `OFF` |

**请求示例**

```json
{
  "service": "tech-ont",
  "logger": "com.metaplatform.ont.engine",
  "level": "DEBUG"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "service": "tech-ont",
    "logger": "com.metaplatform.ont.engine",
    "level": "DEBUG",
    "previousLevel": "INFO",
    "updatedAt": "2026-07-16T08:00:00Z",
    "effectiveScope": "instance",
    "instances": [
      "pod-ont-7f9b-x2k4",
      "pod-ont-7f9b-m9p1"
    ]
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | `service`、`logger` 或 `level` 为空 |
| `40004` | 指定服务不存在 |
| `50301` | 服务实例不可达，无法下发日志级别变更 |

---

#### 3.1.4 查询日志级别配置

**GET** `/api/v1/obs/logs/level`

查询指定服务当前的日志级别配置。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `service` | query | string | 是 | 服务名称 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "service": "tech-ont",
    "loggers": [
      {
        "logger": "ROOT",
        "configuredLevel": "INFO",
        "effectiveLevel": "INFO"
      },
      {
        "logger": "com.metaplatform.ont.engine",
        "configuredLevel": "DEBUG",
        "effectiveLevel": "DEBUG"
      },
      {
        "logger": "org.springframework.web",
        "configuredLevel": null,
        "effectiveLevel": "INFO"
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | `service` 为空 |
| `40004` | 指定服务不存在 |

---

#### 3.1.5 日志聚合统计

**POST** `/api/v1/obs/logs/aggregate`

对日志进行聚合统计，返回时间序列分布。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `service` | body | string | 否 | 服务名称，为空则统计全部 |
| `groupBy` | body | string | 是 | 聚合维度：`service` / `level` / `logger` / `host` |
| `startTime` | body | string | 是 | 起始时间 |
| `endTime` | body | string | 是 | 结束时间 |
| `interval` | body | string | 否 | 时间桶大小：`1m` / `5m` / `1h` / `1d`，默认 `5m` |

**请求示例**

```json
{
  "service": "tech-ont",
  "groupBy": "level",
  "startTime": "2026-07-16T00:00:00Z",
  "endTime": "2026-07-16T08:00:00Z",
  "interval": "5m"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "groupBy": "level",
    "series": [
      {
        "label": "ERROR",
        "points": [
          { "timestamp": "2026-07-16T00:00:00Z", "value": 12 },
          { "timestamp": "2026-07-16T00:05:00Z", "value": 8 },
          { "timestamp": "2026-07-16T00:10:00Z", "value": 15 }
        ]
      },
      {
        "label": "WARN",
        "points": [
          { "timestamp": "2026-07-16T00:00:00Z", "value": 34 },
          { "timestamp": "2026-07-16T00:05:00Z", "value": 28 },
          { "timestamp": "2026-07-16T00:10:00Z", "value": 41 }
        ]
      },
      {
        "label": "INFO",
        "points": [
          { "timestamp": "2026-07-16T00:00:00Z", "value": 1250 },
          { "timestamp": "2026-07-16T00:05:00Z", "value": 1180 },
          { "timestamp": "2026-07-16T00:10:00Z", "value": 1320 }
        ]
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | `groupBy` 为空或值不合法 |
| `50301` | Loki 下游不可用 |

---

#### 3.1.6 日志告警规则创建

**POST** `/api/v1/obs/logs/alert-rules`

创建基于日志的告警规则，当日志匹配指定条件时触发告警。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `name` | body | string | 是 | 规则名称 |
| `service` | body | string | 是 | 目标服务 |
| `condition` | body | string | 是 | LogQL 告警条件表达式，如 `rate({service="tech-ont",level="ERROR"}[5m]) > 10` |
| `for` | body | string | 否 | 持续时间窗口，如 `5m`，默认 `1m` |
| `severity` | body | string | 是 | 告警级别：`critical` / `warning` / `info` |
| `notificationChannelIds` | body | array[string] | 否 | 通知渠道 ID 列表 |
| `annotations` | body | object | 否 | 注解信息，如 `summary`、`description` |
| `enabled` | body | boolean | 否 | 是否启用，默认 `true` |

**请求示例**

```json
{
  "name": "tech-ont ERROR 日志速率告警",
  "service": "tech-ont",
  "condition": "rate({service=\"tech-ont\",level=\"ERROR\"}[5m]) > 10",
  "for": "5m",
  "severity": "critical",
  "notificationChannelIds": ["nc-001", "nc-002"],
  "annotations": {
    "summary": "tech-ont 服务 ERROR 日志速率过高",
    "description": "最近 5 分钟内 ERROR 日志速率超过 10 条/秒，可能存在服务异常"
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
    "ruleId": "lar-0001",
    "name": "tech-ont ERROR 日志速率告警",
    "service": "tech-ont",
    "condition": "rate({service=\"tech-ont\",level=\"ERROR\"}[5m]) > 10",
    "for": "5m",
    "severity": "critical",
    "notificationChannelIds": ["nc-001", "nc-002"],
    "annotations": {
      "summary": "tech-ont 服务 ERROR 日志速率过高",
      "description": "最近 5 分钟内 ERROR 日志速率超过 10 条/秒，可能存在服务异常"
    },
    "enabled": true,
    "type": "log",
    "createdAt": "2026-07-16T08:00:00Z",
    "createdBy": "admin"
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | `name`、`service`、`condition`、`severity` 为空 |
| `40009` | 规则名称已存在 |
| `50001` | 规则写入 Prometheus Alertmanager 失败 |

---

#### 3.1.7 日志告警规则列表

**GET** `/api/v1/obs/logs/alert-rules`

查询日志告警规则列表。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `service` | query | string | 否 | 按服务过滤 |
| `severity` | query | string | 否 | 按级别过滤 |
| `enabled` | query | boolean | 否 | 按启用状态过滤 |
| `page` | query | integer | 否 | 页码 |
| `pageSize` | query | integer | 否 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "ruleId": "lar-0001",
        "name": "tech-ont ERROR 日志速率告警",
        "service": "tech-ont",
        "condition": "rate({service=\"tech-ont\",level=\"ERROR\"}[5m]) > 10",
        "for": "5m",
        "severity": "critical",
        "enabled": true,
        "type": "log",
        "createdAt": "2026-07-16T08:00:00Z",
        "createdBy": "admin"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `50301` | 查询元数据数据库失败 |

---

#### 3.1.8 日志告警规则更新

**PUT** `/api/v1/obs/logs/alert-rules/{ruleId}`

更新指定的日志告警规则。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `ruleId` | path | string | 是 | 规则 ID |
| `name` | body | string | 否 | 规则名称 |
| `condition` | body | string | 否 | 告警条件表达式 |
| `for` | body | string | 否 | 持续时间窗口 |
| `severity` | body | string | 否 | 告警级别 |
| `notificationChannelIds` | body | array[string] | 否 | 通知渠道 ID 列表 |
| `annotations` | body | object | 否 | 注解信息 |
| `enabled` | body | boolean | 否 | 是否启用 |

**请求示例**

```json
{
  "condition": "rate({service=\"tech-ont\",level=\"ERROR\"}[5m]) > 20",
  "severity": "warning",
  "enabled": false
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "lar-0001",
    "name": "tech-ont ERROR 日志速率告警",
    "service": "tech-ont",
    "condition": "rate({service=\"tech-ont\",level=\"ERROR\"}[5m]) > 20",
    "for": "5m",
    "severity": "warning",
    "enabled": false,
    "type": "log",
    "updatedAt": "2026-07-16T08:30:00Z",
    "updatedBy": "admin"
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 规则不存在 |
| `40001` | 参数校验失败 |
| `50001` | 更新 Alertmanager 规则失败 |

---

#### 3.1.9 日志告警规则删除

**DELETE** `/api/v1/obs/logs/alert-rules/{ruleId}`

删除指定的日志告警规则。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `ruleId` | path | string | 是 | 规则 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "lar-0001",
    "deleted": true
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 规则不存在 |
| `50001` | 从 Alertmanager 删除规则失败 |

---

### 3.2 指标管理 API

指标管理 API 提供自定义指标注册、PromQL 查询、指标列表和指标元数据管理能力，底层基于 Prometheus 3.x。

---

#### 3.2.1 自定义指标注册

**POST** `/api/v1/obs/metrics/register`

注册自定义指标，定义指标名称、类型、标签和帮助信息。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `name` | body | string | 是 | 指标名称，符合 Prometheus 命名规范，如 `metaplatform_ont_concept_total` |
| `type` | body | string | 是 | 指标类型：`counter` / `gauge` / `histogram` / `summary` |
| `help` | body | string | 是 | 指标帮助描述 |
| `labels` | body | array[object] | 否 | 标签定义列表 |
| `labels[].name` | body | string | 否 | 标签名称 |
| `labels[].description` | body | string | 否 | 标签描述 |
| `unit` | body | string | 否 | 指标单位，如 `seconds` / `bytes` / `count` |
| `service` | body | string | 是 | 归属服务名称 |

**请求示例**

```json
{
  "name": "metaplatform_ont_concept_total",
  "type": "counter",
  "help": "Total number of concepts created in the Ontology Engine",
  "labels": [
    { "name": "tenant_id", "description": "租户 ID" },
    { "name": "concept_type", "description": "概念类型" }
  ],
  "unit": "count",
  "service": "tech-ont"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "metricId": "mt-0001",
    "name": "metaplatform_ont_concept_total",
    "type": "counter",
    "help": "Total number of concepts created in the Ontology Engine",
    "labels": [
      { "name": "tenant_id", "description": "租户 ID" },
      { "name": "concept_type", "description": "概念类型" }
    ],
    "unit": "count",
    "service": "tech-ont",
    "status": "registered",
    "createdAt": "2026-07-16T08:00:00Z"
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | `name`、`type`、`help`、`service` 为空 |
| `40009` | 指标名称已注册 |
| `40001` | 指标名称不符合 Prometheus 命名规范（`[a-zA-Z_:][a-zA-Z0-9_:]*`） |

---

#### 3.2.2 指标查询（PromQL）

**POST** `/api/v1/obs/metrics/query`

执行 PromQL 查询，返回瞬时值或时间序列数据。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `query` | body | string | 是 | PromQL 查询表达式，如 `rate(http_requests_total[5m])` |
| `time` | body | string | 否 | 查询时间点（瞬时查询），ISO 8601 UTC；不传则使用当前时间 |
| `startTime` | body | string | 否 | 范围查询起始时间（与 `endTime` 同时使用） |
| `endTime` | body | string | 否 | 范围查询结束时间 |
| `step` | body | string | 否 | 范围查询步长，如 `15s` / `1m` / `5m`，默认 `1m` |
| `timeout` | body | string | 否 | 查询超时时间，默认 `30s`，最大 `2m` |

**请求示例（瞬时查询）**

```json
{
  "query": "rate(metaplatform_ont_concept_total{tenant_id=\"t001\"}[5m])",
  "time": "2026-07-16T08:00:00Z"
}
```

**请求示例（范围查询）**

```json
{
  "query": "rate(metaplatform_ont_concept_total{tenant_id=\"t001\"}[5m])",
  "startTime": "2026-07-16T07:00:00Z",
  "endTime": "2026-07-16T08:00:00Z",
  "step": "5m",
  "timeout": "30s"
}
```

**响应示例（瞬时查询）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "query": "rate(metaplatform_ont_concept_total{tenant_id=\"t001\"}[5m])",
    "resultType": "vector",
    "results": [
      {
        "metric": {
          "__name__": "metaplatform_ont_concept_total",
          "tenant_id": "t001",
          "concept_type": "business",
          "instance": "pod-ont-7f9b-x2k4:8080"
        },
        "value": [1784064000, "2.5"]
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**响应示例（范围查询）**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "query": "rate(metaplatform_ont_concept_total{tenant_id=\"t001\"}[5m])",
    "resultType": "matrix",
    "results": [
      {
        "metric": {
          "__name__": "metaplatform_ont_concept_total",
          "tenant_id": "t001",
          "concept_type": "business",
          "instance": "pod-ont-7f9b-x2k4:8080"
        },
        "values": [
          [1784060400, "1.2"],
          [1784060700, "1.8"],
          [1784061000, "2.5"],
          [1784061300, "3.1"],
          [1784061600, "2.9"],
          [1784061900, "2.5"],
          [1784062200, "2.0"],
          [1784062500, "1.7"],
          [1784062800, "1.5"],
          [1784063100, "1.3"],
          [1784063400, "1.1"],
          [1784063700, "1.0"]
        ]
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | `query` 为空 |
| `40001` | PromQL 语法错误 |
| `50301` | Prometheus 下游不可用 |
| `50401` | 查询超时 |

---

#### 3.2.3 指标列表查询

**GET** `/api/v1/obs/metrics`

查询已注册的指标列表，支持按服务、类型过滤。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `service` | query | string | 否 | 按服务过滤 |
| `type` | query | string | 否 | 按指标类型过滤：`counter` / `gauge` / `histogram` / `summary` |
| `keyword` | query | string | 否 | 指标名称模糊搜索 |
| `page` | query | integer | 否 | 页码 |
| `pageSize` | query | integer | 否 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "metricId": "mt-0001",
        "name": "metaplatform_ont_concept_total",
        "type": "counter",
        "help": "Total number of concepts created in the Ontology Engine",
        "labels": [
          { "name": "tenant_id", "description": "租户 ID" },
          { "name": "concept_type", "description": "概念类型" }
        ],
        "unit": "count",
        "service": "tech-ont",
        "status": "active",
        "createdAt": "2026-07-16T08:00:00Z"
      },
      {
        "metricId": "mt-0002",
        "name": "metaplatform_wfe_process_duration_seconds",
        "type": "histogram",
        "help": "Workflow process execution duration in seconds",
        "labels": [
          { "name": "process_id", "description": "流程定义 ID" },
          { "name": "status", "description": "执行状态" }
        ],
        "unit": "seconds",
        "service": "tech-wfe",
        "status": "active",
        "createdAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `50301` | 查询元数据数据库失败 |

---

#### 3.2.4 指标元数据详情

**GET** `/api/v1/obs/metrics/{metricId}`

查询单个指标的详细元数据信息，包括标签、采集状态和采样数据预览。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `metricId` | path | string | 是 | 指标 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "metricId": "mt-0001",
    "name": "metaplatform_ont_concept_total",
    "type": "counter",
    "help": "Total number of concepts created in the Ontology Engine",
    "labels": [
      { "name": "tenant_id", "description": "租户 ID" },
      { "name": "concept_type", "description": "概念类型" }
    ],
    "unit": "count",
    "service": "tech-ont",
    "status": "active",
    "createdAt": "2026-07-16T08:00:00Z",
    "lastScrapeAt": "2026-07-16T08:05:00Z",
    "scrapeInterval": "15s",
    "labelValues": {
      "tenant_id": ["t001", "t002", "t003"],
      "concept_type": ["business", "technical", "data"]
    },
    "preview": [
      {
        "labels": { "tenant_id": "t001", "concept_type": "business" },
        "value": 1523,
        "timestamp": "2026-07-16T08:05:00Z"
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 指标不存在 |

---

#### 3.2.5 指标采集配置

**PUT** `/api/v1/obs/metrics/{metricId}/scrape-config`

更新指标的采集配置，包括采集间隔和超时设置。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `metricId` | path | string | 是 | 指标 ID |
| `scrapeInterval` | body | string | 否 | 采集间隔，如 `15s` / `30s` / `1m`，默认 `15s` |
| `scrapeTimeout` | body | string | 否 | 采集超时，如 `10s`，默认 `10s` |
| `enabled` | body | boolean | 否 | 是否启用采集 |

**请求示例**

```json
{
  "scrapeInterval": "30s",
  "scrapeTimeout": "15s",
  "enabled": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "metricId": "mt-0001",
    "scrapeInterval": "30s",
    "scrapeTimeout": "15s",
    "enabled": true,
    "updatedAt": "2026-07-16T08:30:00Z"
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 指标不存在 |
| `50001` | 更新 Prometheus 采集配置失败 |

---

#### 3.2.6 指标删除

**DELETE** `/api/v1/obs/metrics/{metricId}`

注销自定义指标，同时从 Prometheus 采集配置中移除。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `metricId` | path | string | 是 | 指标 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "metricId": "mt-0001",
    "deleted": true
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 指标不存在 |
| `50001` | 从 Prometheus 移除采集配置失败 |

---

### 3.3 链路追踪 API

链路追踪 API 提供基于 OpenTelemetry + Jaeger 的分布式链路查询、Span 详情、调用拓扑图和服务依赖分析能力。

---

#### 3.3.1 Trace 查询

**POST** `/api/v1/obs/traces/query`

查询分布式链路追踪记录，支持按服务、操作、时间范围、标签和耗时过滤。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `service` | body | string | 否 | 服务名称过滤 |
| `operation` | body | string | 否 | 操作名称过滤（Span 名称） |
| `traceId` | body | string | 否 | 精确 Trace ID 查询 |
| `tags` | body | object | 否 | 标签过滤，key-value 键值对 |
| `minDuration` | body | string | 否 | 最小耗时，如 `1s` / `500ms` |
| `maxDuration` | body | string | 否 | 最大耗时 |
| `startTime` | body | string | 是 | 查询起始时间 |
| `endTime` | body | string | 是 | 查询结束时间 |
| `sortBy` | body | string | 否 | 排序字段：`duration` / `timestamp` / `spans`，默认 `duration` |
| `sortOrder` | body | string | 否 | 排序方向：`asc` / `desc`，默认 `desc` |
| `page` | body | integer | 否 | 页码 |
| `pageSize` | body | integer | 否 | 每页条数 |

**请求示例**

```json
{
  "service": "tech-ont",
  "operation": "POST /api/v1/ont/concepts",
  "minDuration": "500ms",
  "tags": {
    "http.status_code": "500"
  },
  "startTime": "2026-07-16T07:00:00Z",
  "endTime": "2026-07-16T08:00:00Z",
  "sortBy": "duration",
  "sortOrder": "desc",
  "page": 1,
  "pageSize": 20
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
        "traceId": "a1b2c3d4e5f6789012345678abcdef00",
        "rootService": "tech-gw",
        "rootOperation": "POST /api/v1/ont/concepts",
        "startTime": "2026-07-16T07:59:32.123Z",
        "duration": 1850,
        "durationUnit": "ms",
        "spanCount": 12,
        "serviceCount": 4,
        "services": ["tech-gw", "tech-iam", "tech-ont", "tech-data"],
        "hasError": true,
        "errorCount": 2
      },
      {
        "traceId": "b2c3d4e5f6789012345678abcdef001",
        "rootService": "tech-gw",
        "rootOperation": "POST /api/v1/ont/concepts",
        "startTime": "2026-07-16T07:58:15.456Z",
        "duration": 1230,
        "durationUnit": "ms",
        "spanCount": 8,
        "serviceCount": 3,
        "services": ["tech-gw", "tech-iam", "tech-ont"],
        "hasError": false,
        "errorCount": 0
      }
    ],
    "total": 47,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | `startTime` 或 `endTime` 缺失 |
| `50301` | Jaeger 下游不可用 |
| `50401` | 查询超时 |

---

#### 3.3.2 Trace 详情

**GET** `/api/v1/obs/traces/{traceId}`

查询指定 Trace 的完整详情，包括所有 Span 及其层次结构。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `traceId` | path | string | 是 | Trace ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "traceId": "a1b2c3d4e5f6789012345678abcdef00",
    "rootSpan": {
      "spanId": "1a2b3c4d5e6f7a8b",
      "parentSpanId": null,
      "traceId": "a1b2c3d4e5f6789012345678abcdef00",
      "operationName": "POST /api/v1/ont/concepts",
      "service": "tech-gw",
      "startTime": "2026-07-16T07:59:32.123Z",
      "duration": 1850,
      "durationUnit": "ms",
      "tags": {
        "http.method": "POST",
        "http.url": "/api/v1/ont/concepts",
        "http.status_code": "500",
        "component": "spring-boot"
      },
      "process": {
        "serviceName": "tech-gw",
        "tags": {
          "hostname": "pod-gw-7f9b-x2k4",
          "ip": "10.0.1.15",
          "jaeger.version": "Java-2.1.0"
        }
      },
      "logs": [
        {
          "timestamp": "2026-07-16T07:59:33.500Z",
          "fields": {
            "event": "error",
            "error.object": "NullPointerException",
            "message": "Concept service returned 500"
          }
        }
      ],
      "references": [],
      "hasError": true,
      "children": [
        {
          "spanId": "2b3c4d5e6f7a8b9c",
          "parentSpanId": "1a2b3c4d5e6f7a8b",
          "traceId": "a1b2c3d4e5f6789012345678abcdef00",
          "operationName": "auth.verify",
          "service": "tech-iam",
          "startTime": "2026-07-16T07:59:32.200Z",
          "duration": 45,
          "durationUnit": "ms",
          "tags": {
            "auth.method": "JWT",
            "auth.result": "success"
          },
          "process": {
            "serviceName": "tech-iam",
            "tags": {
              "hostname": "pod-iam-7f9b-m9p1",
              "ip": "10.0.1.22"
            }
          },
          "logs": [],
          "references": [
            {
              "refType": "CHILD_OF",
              "traceId": "a1b2c3d4e5f6789012345678abcdef00",
              "spanId": "1a2b3c4d5e6f7a8b"
            }
          ],
          "hasError": false,
          "children": []
        },
        {
          "spanId": "3c4d5e6f7a8b9c0d",
          "parentSpanId": "1a2b3c4d5e6f7a8b",
          "traceId": "a1b2c3d4e5f6789012345678abcdef00",
          "operationName": "ConceptService.create",
          "service": "tech-ont",
          "startTime": "2026-07-16T07:59:32.300Z",
          "duration": 1650,
          "durationUnit": "ms",
          "tags": {
            "db.system": "postgresql",
            "db.statement": "INSERT INTO ont_concepts...",
            "db.duration": "1200ms"
          },
          "process": {
            "serviceName": "tech-ont",
            "tags": {
              "hostname": "pod-ont-7f9b-x2k4",
              "ip": "10.0.1.30"
            }
          },
          "logs": [
            {
              "timestamp": "2026-07-16T07:59:33.500Z",
              "fields": {
                "event": "error",
                "error.object": "NullPointerException",
                "stack": "at ConceptService.create(ConceptService.java:142)"
              }
            }
          ],
          "references": [
            {
              "refType": "CHILD_OF",
              "traceId": "a1b2c3d4e5f6789012345678abcdef00",
              "spanId": "1a2b3c4d5e6f7a8b"
            }
          ],
          "hasError": true,
          "children": [
            {
              "spanId": "4d5e6f7a8b9c0d1e",
              "parentSpanId": "3c4d5e6f7a8b9c0d",
              "traceId": "a1b2c3d4e5f6789012345678abcdef00",
              "operationName": "DataSource.query",
              "service": "tech-data",
              "startTime": "2026-07-16T07:59:32.500Z",
              "duration": 1100,
              "durationUnit": "ms",
              "tags": {
                "db.system": "postgresql",
                "db.operation": "SELECT",
                "db.rows": "1"
              },
              "process": {
                "serviceName": "tech-data",
                "tags": {
                  "hostname": "pod-data-7f9b-q7r2",
                  "ip": "10.0.1.40"
                }
              },
              "logs": [],
              "references": [
                {
                  "refType": "CHILD_OF",
                  "traceId": "a1b2c3d4e5f6789012345678abcdef00",
                  "spanId": "3c4d5e6f7a8b9c0d"
                }
              ],
              "hasError": false,
              "children": []
            }
          ]
        }
      ]
    },
    "stats": {
      "totalSpans": 12,
      "totalServices": 4,
      "totalDuration": 1850,
      "errorSpans": 2,
      "deepestLevel": 4
    }
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | Trace 不存在 |
| `50301` | Jaeger 下游不可用 |

---

#### 3.3.3 Span 详情

**GET** `/api/v1/obs/traces/{traceId}/spans/{spanId}`

查询单个 Span 的详细信息，包括标签、日志事件和引用关系。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `traceId` | path | string | 是 | Trace ID |
| `spanId` | path | string | 是 | Span ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "traceId": "a1b2c3d4e5f6789012345678abcdef00",
    "spanId": "3c4d5e6f7a8b9c0d",
    "parentSpanId": "1a2b3c4d5e6f7a8b",
    "operationName": "ConceptService.create",
    "service": "tech-ont",
    "startTime": "2026-07-16T07:59:32.300Z",
    "duration": 1650,
    "durationUnit": "ms",
    "tags": {
      "http.method": "POST",
      "db.system": "postgresql",
      "db.statement": "INSERT INTO ont_concepts (id, name, type) VALUES ($1, $2, $3)",
      "db.duration": "1200ms",
      "otel.status_code": "ERROR",
      "otel.status_description": "NullPointerException"
    },
    "process": {
      "serviceName": "tech-ont",
      "tags": {
        "hostname": "pod-ont-7f9b-x2k4",
        "ip": "10.0.1.30",
        "jaeger.version": "Java-2.1.0",
        "otel.library.name": "spring-boot"
      }
    },
    "logs": [
      {
        "timestamp": "2026-07-16T07:59:33.500Z",
        "fields": {
          "event": "error",
          "error.object": "java.lang.NullPointerException",
          "message": "Cannot invoke method on null reference",
          "stack": "at com.metaplatform.ont.engine.ConceptService.create(ConceptService.java:142)\n  at com.metaplatform.ont.api.ConceptController.create(ConceptController.java:55)"
        }
      }
    ],
    "references": [
      {
        "refType": "CHILD_OF",
        "traceId": "a1b2c3d4e5f6789012345678abcdef00",
        "spanId": "1a2b3c4d5e6f7a8b"
      }
    ],
    "hasError": true,
    "childSpanIds": ["4d5e6f7a8b9c0d1e"]
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | Trace 或 Span 不存在 |
| `50301` | Jaeger 下游不可用 |

---

#### 3.3.4 调用拓扑图

**GET** `/api/v1/obs/traces/{traceId}/topology`

获取指定 Trace 的调用拓扑图结构，用于前端可视化展示调用链路。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `traceId` | path | string | 是 | Trace ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "traceId": "a1b2c3d4e5f6789012345678abcdef00",
    "nodes": [
      {
        "id": "tech-gw",
        "service": "tech-gw",
        "operation": "POST /api/v1/ont/concepts",
        "spanId": "1a2b3c4d5e6f7a8b",
        "duration": 1850,
        "hasError": true,
        "level": 0
      },
      {
        "id": "tech-iam",
        "service": "tech-iam",
        "operation": "auth.verify",
        "spanId": "2b3c4d5e6f7a8b9c",
        "duration": 45,
        "hasError": false,
        "level": 1
      },
      {
        "id": "tech-ont",
        "service": "tech-ont",
        "operation": "ConceptService.create",
        "spanId": "3c4d5e6f7a8b9c0d",
        "duration": 1650,
        "hasError": true,
        "level": 1
      },
      {
        "id": "tech-data",
        "service": "tech-data",
        "operation": "DataSource.query",
        "spanId": "4d5e6f7a8b9c0d1e",
        "duration": 1100,
        "hasError": false,
        "level": 2
      }
    ],
    "edges": [
      {
        "source": "tech-gw",
        "target": "tech-iam",
        "spanId": "2b3c4d5e6f7a8b9c",
        "duration": 45,
        "callCount": 1
      },
      {
        "source": "tech-gw",
        "target": "tech-ont",
        "spanId": "3c4d5e6f7a8b9c0d",
        "duration": 1650,
        "callCount": 1
      },
      {
        "source": "tech-ont",
        "target": "tech-data",
        "spanId": "4d5e6f7a8b9c0d1e",
        "duration": 1100,
        "callCount": 1
      }
    ],
    "maxDepth": 3
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | Trace 不存在 |
| `50301` | Jaeger 下游不可用 |

---

#### 3.3.5 服务依赖查询

**GET** `/api/v1/obs/traces/dependencies`

查询指定时间范围内的服务间调用依赖关系。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `service` | query | string | 否 | 指定服务名，查询该服务的依赖 |
| `startTime` | query | string | 是 | 起始时间 |
| `endTime` | query | string | 是 | 结束时间 |

**请求示例**

```
GET /api/v1/obs/traces/dependencies?service=tech-ont&startTime=2026-07-16T07:00:00Z&endTime=2026-07-16T08:00:00Z
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "service": "tech-ont",
    "startTime": "2026-07-16T07:00:00Z",
    "endTime": "2026-07-16T08:00:00Z",
    "dependencies": [
      {
        "parent": "tech-gw",
        "child": "tech-ont",
        "callCount": 1523,
        "errorCount": 47,
        "errorRate": 0.0309,
        "avgDuration": 234,
        "p99Duration": 1850,
        "operations": [
          { "operation": "POST /api/v1/ont/concepts", "count": 520 },
          { "operation": "GET /api/v1/ont/concepts/{id}", "count": 803 },
          { "operation": "PUT /api/v1/ont/concepts/{id}", "count": 200 }
        ]
      },
      {
        "parent": "tech-ont",
        "child": "tech-data",
        "callCount": 2890,
        "errorCount": 12,
        "errorRate": 0.0042,
        "avgDuration": 156,
        "p99Duration": 1100,
        "operations": [
          { "operation": "DataSource.query", "count": 2890 }
        ]
      },
      {
        "parent": "tech-ont",
        "child": "tech-rag",
        "callCount": 345,
        "errorCount": 0,
        "errorRate": 0.0,
        "avgDuration": 89,
        "p99Duration": 320,
        "operations": [
          { "operation": "RAGService.search", "count": 345 }
        ]
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | `startTime` 或 `endTime` 缺失 |
| `50301` | Jaeger 下游不可用 |

---

### 3.4 告警管理 API

告警管理 API 提供统一的告警规则 CRUD（日志告警 / 指标告警 / 链路告警）、告警列表查询、通知渠道配置、告警 silenced / 恢复操作和告警历史查询能力。

---

#### 3.4.1 创建告警规则

**POST** `/api/v1/obs/alerts/rules`

创建告警规则，支持指标告警、日志告警和链路告警三种类型。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `name` | body | string | 是 | 规则名称 |
| `type` | body | string | 是 | 告警类型：`metric` / `log` / `trace` |
| `service` | body | string | 是 | 目标服务 |
| `condition` | body | string | 是 | 告警条件表达式 |
| `for` | body | string | 否 | 持续时间窗口，默认 `1m` |
| `severity` | body | string | 是 | 告警级别：`critical` / `warning` / `info` |
| `notificationChannelIds` | body | array[string] | 否 | 通知渠道 ID 列表 |
| `annotations` | body | object | 否 | 注解信息（`summary`、`description`、`runbook_url`） |
| `labels` | body | object | 否 | 自定义标签 |
| `enabled` | body | boolean | 否 | 是否启用，默认 `true` |

**请求示例**

```json
{
  "name": "tech-ont P99 延迟告警",
  "type": "metric",
  "service": "tech-ont",
  "condition": "histogram_quantile(0.99, rate(metaplatform_ont_request_duration_seconds_bucket[5m])) > 2",
  "for": "5m",
  "severity": "warning",
  "notificationChannelIds": ["nc-001", "nc-003"],
  "annotations": {
    "summary": "tech-ont P99 延迟超过 2 秒",
    "description": "最近 5 分钟 P99 延迟持续超过 2 秒，请检查服务性能",
    "runbook_url": "https://wiki.metaplatform.com/runbooks/ont-p99-latency"
  },
  "labels": {
    "team": "platform",
    "priority": "high"
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
    "ruleId": "ar-0001",
    "name": "tech-ont P99 延迟告警",
    "type": "metric",
    "service": "tech-ont",
    "condition": "histogram_quantile(0.99, rate(metaplatform_ont_request_duration_seconds_bucket[5m])) > 2",
    "for": "5m",
    "severity": "warning",
    "notificationChannelIds": ["nc-001", "nc-003"],
    "annotations": {
      "summary": "tech-ont P99 延迟超过 2 秒",
      "description": "最近 5 分钟 P99 延迟持续超过 2 秒，请检查服务性能",
      "runbook_url": "https://wiki.metaplatform.com/runbooks/ont-p99-latency"
    },
    "labels": {
      "team": "platform",
      "priority": "high"
    },
    "enabled": true,
    "state": "ok",
    "createdAt": "2026-07-16T08:00:00Z",
    "createdBy": "admin"
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | `name`、`type`、`service`、`condition`、`severity` 为空 |
| `40009` | 规则名称已存在 |
| `50001` | 规则写入 Alertmanager 失败 |

---

#### 3.4.2 告警规则列表

**GET** `/api/v1/obs/alerts/rules`

查询告警规则列表，支持按类型、服务、级别和启用状态过滤。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `type` | query | string | 否 | 告警类型：`metric` / `log` / `trace` |
| `service` | query | string | 否 | 按服务过滤 |
| `severity` | query | string | 否 | 按级别过滤 |
| `enabled` | query | boolean | 否 | 按启用状态过滤 |
| `state` | query | string | 否 | 按告警状态过滤：`firing` / `pending` / `ok` |
| `page` | query | integer | 否 | 页码 |
| `pageSize` | query | integer | 否 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "ruleId": "ar-0001",
        "name": "tech-ont P99 延迟告警",
        "type": "metric",
        "service": "tech-ont",
        "condition": "histogram_quantile(0.99, rate(metaplatform_ont_request_duration_seconds_bucket[5m])) > 2",
        "for": "5m",
        "severity": "warning",
        "enabled": true,
        "state": "firing",
        "createdAt": "2026-07-16T08:00:00Z",
        "createdBy": "admin"
      },
      {
        "ruleId": "ar-0002",
        "name": "tech-ont ERROR 日志速率告警",
        "type": "log",
        "service": "tech-ont",
        "condition": "rate({service=\"tech-ont\",level=\"ERROR\"}[5m]) > 10",
        "for": "5m",
        "severity": "critical",
        "enabled": true,
        "state": "ok",
        "createdAt": "2026-07-16T08:00:00Z",
        "createdBy": "admin"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `50301` | 查询元数据数据库或 Alertmanager 失败 |

---

#### 3.4.3 告警规则详情

**GET** `/api/v1/obs/alerts/rules/{ruleId}`

查询单个告警规则的详细信息。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `ruleId` | path | string | 是 | 规则 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "ar-0001",
    "name": "tech-ont P99 延迟告警",
    "type": "metric",
    "service": "tech-ont",
    "condition": "histogram_quantile(0.99, rate(metaplatform_ont_request_duration_seconds_bucket[5m])) > 2",
    "for": "5m",
    "severity": "warning",
    "notificationChannelIds": ["nc-001", "nc-003"],
    "annotations": {
      "summary": "tech-ont P99 延迟超过 2 秒",
      "description": "最近 5 分钟 P99 延迟持续超过 2 秒，请检查服务性能",
      "runbook_url": "https://wiki.metaplatform.com/runbooks/ont-p99-latency"
    },
    "labels": {
      "team": "platform",
      "priority": "high"
    },
    "enabled": true,
    "state": "firing",
    "lastEvaluatedAt": "2026-07-16T08:05:00Z",
    "lastFiredAt": "2026-07-16T08:04:30Z",
    "createdAt": "2026-07-16T08:00:00Z",
    "createdBy": "admin",
    "updatedAt": "2026-07-16T08:00:00Z",
    "updatedBy": "admin"
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 规则不存在 |

---

#### 3.4.4 更新告警规则

**PUT** `/api/v1/obs/alerts/rules/{ruleId}`

更新指定的告警规则。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `ruleId` | path | string | 是 | 规则 ID |
| `name` | body | string | 否 | 规则名称 |
| `condition` | body | string | 否 | 告警条件表达式 |
| `for` | body | string | 否 | 持续时间窗口 |
| `severity` | body | string | 否 | 告警级别 |
| `notificationChannelIds` | body | array[string] | 否 | 通知渠道 ID 列表 |
| `annotations` | body | object | 否 | 注解信息 |
| `labels` | body | object | 否 | 自定义标签 |
| `enabled` | body | boolean | 否 | 是否启用 |

**请求示例**

```json
{
  "condition": "histogram_quantile(0.99, rate(metaplatform_ont_request_duration_seconds_bucket[5m])) > 3",
  "severity": "info",
  "enabled": false
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "ar-0001",
    "name": "tech-ont P99 延迟告警",
    "type": "metric",
    "service": "tech-ont",
    "condition": "histogram_quantile(0.99, rate(metaplatform_ont_request_duration_seconds_bucket[5m])) > 3",
    "for": "5m",
    "severity": "info",
    "enabled": false,
    "updatedAt": "2026-07-16T08:30:00Z",
    "updatedBy": "admin"
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 规则不存在 |
| `50001` | 更新 Alertmanager 规则失败 |

---

#### 3.4.5 删除告警规则

**DELETE** `/api/v1/obs/alerts/rules/{ruleId}`

删除指定的告警规则。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `ruleId` | path | string | 是 | 规则 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "ar-0001",
    "deleted": true
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 规则不存在 |
| `50001` | 从 Alertmanager 删除规则失败 |

---

#### 3.4.6 告警列表查询

**GET** `/api/v1/obs/alerts`

查询当前活跃的告警列表，包括 firing 和 pending 状态的告警。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `state` | query | string | 否 | 告警状态过滤：`firing` / `pending` / `all`，默认 `all` |
| `severity` | query | string | 否 | 按级别过滤 |
| `service` | query | string | 否 | 按服务过滤 |
| `type` | query | string | 否 | 按类型过滤 |
| `startTime` | query | string | 否 | 告警触发起始时间 |
| `endTime` | query | string | 否 | 告警触发结束时间 |
| `page` | query | integer | 否 | 页码 |
| `pageSize` | query | integer | 否 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "alertId": "alert-20260716080001",
        "ruleId": "ar-0001",
        "ruleName": "tech-ont P99 延迟告警",
        "type": "metric",
        "service": "tech-ont",
        "severity": "warning",
        "state": "firing",
        "condition": "histogram_quantile(0.99, rate(metaplatform_ont_request_duration_seconds_bucket[5m])) > 2",
        "currentValue": "2.85",
        "firedAt": "2026-07-16T07:55:00Z",
        "resolvedAt": null,
        "labels": {
          "team": "platform",
          "priority": "high",
          "service": "tech-ont"
        },
        "annotations": {
          "summary": "tech-ont P99 延迟超过 2 秒",
          "description": "最近 5 分钟 P99 延迟持续超过 2 秒，请检查服务性能",
          "runbook_url": "https://wiki.metaplatform.com/runbooks/ont-p99-latency"
        },
        "traceId": "a1b2c3d4e5f6789012345678abcdef00",
        "silenced": false,
        "silencedBy": null
      },
      {
        "alertId": "alert-20260716075002",
        "ruleId": "ar-0002",
        "ruleName": "tech-ont ERROR 日志速率告警",
        "type": "log",
        "service": "tech-ont",
        "severity": "critical",
        "state": "firing",
        "condition": "rate({service=\"tech-ont\",level=\"ERROR\"}[5m]) > 10",
        "currentValue": "15.3",
        "firedAt": "2026-07-16T07:50:00Z",
        "resolvedAt": null,
        "labels": {
          "service": "tech-ont"
        },
        "annotations": {
          "summary": "tech-ont 服务 ERROR 日志速率过高",
          "description": "最近 5 分钟内 ERROR 日志速率超过 10 条/秒"
        },
        "traceId": "b2c3d4e5f6789012345678abcdef001",
        "silenced": true,
        "silencedBy": "admin",
        "silencedAt": "2026-07-16T07:52:00Z",
        "silenceExpiresAt": "2026-07-16T09:52:00Z"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `50301` | Alertmanager 下游不可用 |

---

#### 3.4.7 告警通知渠道创建

**POST** `/api/v1/obs/alerts/notification-channels`

创建告警通知渠道，支持飞书、钉钉、邮件、Webhook 等多种渠道。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `name` | body | string | 是 | 渠道名称 |
| `type` | body | string | 是 | 渠道类型：`feishu` / `dingtalk` / `email` / `webhook` / `slack` |
| `config` | body | object | 是 | 渠道配置 |
| `config.webhookUrl` | body | string | 否 | Webhook URL（飞书/钉钉/Slack/Webhook 类型必填） |
| `config.emails` | body | array[string] | 否 | 邮箱列表（email 类型必填） |
| `config.smtpServer` | body | string | 否 | SMTP 服务器地址（email 类型可选） |
| `severityFilter` | body | array[string] | 否 | 接收告警级别过滤，如 `["critical", "warning"]`，为空则接收全部 |
| `enabled` | body | boolean | 否 | 是否启用，默认 `true` |

**请求示例**

```json
{
  "name": "平台团队飞书群",
  "type": "feishu",
  "config": {
    "webhookUrl": "https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx"
  },
  "severityFilter": ["critical", "warning"],
  "enabled": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "channelId": "nc-001",
    "name": "平台团队飞书群",
    "type": "feishu",
    "config": {
      "webhookUrl": "https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx"
    },
    "severityFilter": ["critical", "warning"],
    "enabled": true,
    "createdAt": "2026-07-16T08:00:00Z",
    "createdBy": "admin"
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | `name`、`type`、`config` 为空 |
| `40001` | Webhook URL 格式不合法 |
| `40009` | 渠道名称已存在 |

---

#### 3.4.8 告警通知渠道列表

**GET** `/api/v1/obs/alerts/notification-channels`

查询通知渠道列表。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `type` | query | string | 否 | 按渠道类型过滤 |
| `enabled` | query | boolean | 否 | 按启用状态过滤 |
| `page` | query | integer | 否 | 页码 |
| `pageSize` | query | integer | 否 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "channelId": "nc-001",
        "name": "平台团队飞书群",
        "type": "feishu",
        "severityFilter": ["critical", "warning"],
        "enabled": true,
        "createdAt": "2026-07-16T08:00:00Z"
      },
      {
        "channelId": "nc-002",
        "name": "运维邮件组",
        "type": "email",
        "config": {
          "emails": ["ops@metaplatform.com", "devops@metaplatform.com"]
        },
        "severityFilter": ["critical"],
        "enabled": true,
        "createdAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `50301` | 查询元数据数据库失败 |

---

#### 3.4.9 告警通知渠道更新

**PUT** `/api/v1/obs/alerts/notification-channels/{channelId}`

更新通知渠道配置。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `channelId` | path | string | 是 | 渠道 ID |
| `name` | body | string | 否 | 渠道名称 |
| `config` | body | object | 否 | 渠道配置 |
| `severityFilter` | body | array[string] | 否 | 接收告警级别过滤 |
| `enabled` | body | boolean | 否 | 是否启用 |

**请求示例**

```json
{
  "name": "平台团队飞书群（更新）",
  "severityFilter": ["critical"],
  "enabled": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "channelId": "nc-001",
    "name": "平台团队飞书群（更新）",
    "type": "feishu",
    "severityFilter": ["critical"],
    "enabled": true,
    "updatedAt": "2026-07-16T08:30:00Z"
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 渠道不存在 |

---

#### 3.4.10 告警通知渠道删除

**DELETE** `/api/v1/obs/alerts/notification-channels/{channelId}`

删除通知渠道。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `channelId` | path | string | 是 | 渠道 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "channelId": "nc-001",
    "deleted": true
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 渠道不存在 |
| `40009` | 渠道仍被告警规则引用，无法删除 |

---

#### 3.4.11 告警 Silenced

**POST** `/api/v1/obs/alerts/{alertId}/silence`

对指定告警执行静默操作，在指定时间内不再发送通知。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `alertId` | path | string | 是 | 告警 ID |
| `duration` | body | string | 是 | 静默持续时间，如 `1h` / `2h` / `24h` |
| `reason` | body | string | 否 | 静默原因 |

**请求示例**

```json
{
  "duration": "2h",
  "reason": "正在处理 tech-ont 性能问题，预计 2 小时内修复"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "alertId": "alert-20260716080001",
    "silenced": true,
    "silencedBy": "admin",
    "silencedAt": "2026-07-16T08:00:00Z",
    "expiresAt": "2026-07-16T10:00:00Z",
    "reason": "正在处理 tech-ont 性能问题，预计 2 小时内修复"
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 告警不存在 |
| `40009` | 告警已被静默 |
| `50001` | Alertmanager 静默操作失败 |

---

#### 3.4.12 告警恢复（取消静默）

**POST** `/api/v1/obs/alerts/{alertId}/unsilence`

取消告警的静默状态，恢复告警通知。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `alertId` | path | string | 是 | 告警 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "alertId": "alert-20260716080001",
    "silenced": false,
    "unsilencedBy": "admin",
    "unsilencedAt": "2026-07-16T09:00:00Z"
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 告警不存在 |
| `40009` | 告警未被静默，无需取消 |
| `50001` | Alertmanager 取消静默操作失败 |

---

#### 3.4.13 告警历史查询

**GET** `/api/v1/obs/alerts/history`

查询告警历史记录，包括已恢复和已过期的告警。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `ruleId` | query | string | 否 | 按规则 ID 过滤 |
| `service` | query | string | 否 | 按服务过滤 |
| `severity` | query | string | 否 | 按级别过滤 |
| `state` | query | string | 否 | 按状态过滤：`firing` / `resolved` |
| `startTime` | query | string | 是 | 起始时间 |
| `endTime` | query | string | 是 | 结束时间 |
| `page` | query | integer | 否 | 页码 |
| `pageSize` | query | integer | 否 | 每页条数 |

**请求示例**

```
GET /api/v1/obs/alerts/history?service=tech-ont&state=resolved&startTime=2026-07-15T00:00:00Z&endTime=2026-07-16T00:00:00Z&page=1&pageSize=20
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "alertId": "alert-20260715200001",
        "ruleId": "ar-0001",
        "ruleName": "tech-ont P99 延迟告警",
        "type": "metric",
        "service": "tech-ont",
        "severity": "warning",
        "state": "resolved",
        "firedAt": "2026-07-15T20:00:00Z",
        "resolvedAt": "2026-07-15T20:35:00Z",
        "duration": "35m",
        "currentValue": "1.2",
        "labels": {
          "team": "platform",
          "service": "tech-ont"
        },
        "annotations": {
          "summary": "tech-ont P99 延迟超过 2 秒",
          "description": "最近 5 分钟 P99 延迟持续超过 2 秒，请检查服务性能"
        },
        "traceId": "d4e5f6789012345678abcdef004",
        "resolvedBy": "system"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | `startTime` 或 `endTime` 缺失 |
| `50301` | 查询 Alertmanager 历史数据失败 |

---

### 3.5 仪表板管理 API

仪表板管理 API 提供自定义仪表板的 CRUD、组件配置、分享和导出能力，底层集成 Grafana 11.x。

---

#### 3.5.1 创建仪表板

**POST** `/api/v1/obs/dashboards`

创建自定义可观测性仪表板。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `name` | body | string | 是 | 仪表板名称 |
| `description` | body | string | 否 | 仪表板描述 |
| `tags` | body | array[string] | 否 | 标签列表 |
| `refreshInterval` | body | string | 否 | 自动刷新间隔：`5s` / `10s` / `30s` / `1m` / `5m` / `off`，默认 `30s` |
| `timeRange` | body | object | 否 | 默认时间范围 |
| `timeRange.from` | body | string | 否 | 默认起始时间或相对时间，如 `now-1h` |
| `timeRange.to` | body | string | 否 | 默认结束时间或相对时间，如 `now` |
| `variables` | body | array[object] | 否 | 模板变量定义 |
| `variables[].name` | body | string | 否 | 变量名称 |
| `variables[].type` | body | string | 否 | 变量类型：`query` / `custom` / `interval` |
| `variables[].query` | body | string | 否 | 变量查询表达式（type=query 时） |
| `variables[].options` | body | array | 否 | 自定义选项列表（type=custom 时） |

**请求示例**

```json
{
  "name": "tech-ont 服务监控面板",
  "description": "tech-ont 本体引擎服务核心指标监控",
  "tags": ["tech-ont", "production"],
  "refreshInterval": "30s",
  "timeRange": {
    "from": "now-1h",
    "to": "now"
  },
  "variables": [
    {
      "name": "service",
      "type": "query",
      "query": "label_values(metaplatform_ont_concept_total, service)"
    },
    {
      "name": "env",
      "type": "custom",
      "options": [
        { "text": "Production", "value": "production", "selected": true },
        { "text": "Staging", "value": "staging", "selected": false }
      ]
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
    "dashboardId": "db-0001",
    "name": "tech-ont 服务监控面板",
    "description": "tech-ont 本体引擎服务核心指标监控",
    "tags": ["tech-ont", "production"],
    "refreshInterval": "30s",
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    },
    "variables": [
      {
        "name": "service",
        "type": "query",
        "query": "label_values(metaplatform_ont_concept_total, service)"
      },
      {
        "name": "env",
        "type": "custom",
        "options": [
          { "text": "Production", "value": "production", "selected": true },
          { "text": "Staging", "value": "staging", "selected": false }
        ]
      }
    ],
    "panels": [],
    "createdAt": "2026-07-16T08:00:00Z",
    "createdBy": "admin",
    "version": 1
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | `name` 为空 |
| `40009` | 仪表板名称已存在 |
| `50001` | 创建 Grafana 仪表板失败 |

---

#### 3.5.2 仪表板列表

**GET** `/api/v1/obs/dashboards`

查询仪表板列表。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `tag` | query | string | 否 | 按标签过滤 |
| `keyword` | query | string | 否 | 名称模糊搜索 |
| `createdBy` | query | string | 否 | 按创建人过滤 |
| `page` | query | integer | 否 | 页码 |
| `pageSize` | query | integer | 否 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "dashboardId": "db-0001",
        "name": "tech-ont 服务监控面板",
        "description": "tech-ont 本体引擎服务核心指标监控",
        "tags": ["tech-ont", "production"],
        "refreshInterval": "30s",
        "panelCount": 6,
        "createdAt": "2026-07-16T08:00:00Z",
        "createdBy": "admin",
        "updatedAt": "2026-07-16T08:30:00Z",
        "version": 2
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `50301` | 查询 Grafana 失败 |

---

#### 3.5.3 仪表板详情

**GET** `/api/v1/obs/dashboards/{dashboardId}`

查询仪表板完整详情，包括所有面板组件配置。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `dashboardId` | path | string | 是 | 仪表板 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "dashboardId": "db-0001",
    "name": "tech-ont 服务监控面板",
    "description": "tech-ont 本体引擎服务核心指标监控",
    "tags": ["tech-ont", "production"],
    "refreshInterval": "30s",
    "timeRange": {
      "from": "now-1h",
      "to": "now"
    },
    "variables": [
      {
        "name": "service",
        "type": "query",
        "query": "label_values(metaplatform_ont_concept_total, service)",
        "current": { "text": "tech-ont", "value": "tech-ont" }
      }
    ],
    "panels": [
      {
        "panelId": "pn-0001",
        "title": "请求 QPS",
        "type": "timeseries",
        "gridPos": { "x": 0, "y": 0, "w": 12, "h": 8 },
        "datasource": "prometheus",
        "targets": [
          {
            "refId": "A",
            "expr": "rate(metaplatform_ont_request_total[5m])",
            "legendFormat": "{{service}}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "reqps",
            "color": { "mode": "palette-classic" }
          }
        },
        "options": {
          "legend": { "displayMode": "table", "placement": "bottom" },
          "tooltip": { "mode": "multi" }
        }
      },
      {
        "panelId": "pn-0002",
        "title": "P99 延迟",
        "type": "timeseries",
        "gridPos": { "x": 12, "y": 0, "w": 12, "h": 8 },
        "datasource": "prometheus",
        "targets": [
          {
            "refId": "A",
            "expr": "histogram_quantile(0.99, rate(metaplatform_ont_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P99"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "s",
            "thresholds": {
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 1 },
                { "color": "red", "value": 2 }
              ]
            }
          }
        },
        "options": {}
      },
      {
        "panelId": "pn-0003",
        "title": "错误率",
        "type": "stat",
        "gridPos": { "x": 0, "y": 8, "w": 6, "h": 4 },
        "datasource": "prometheus",
        "targets": [
          {
            "refId": "A",
            "expr": "sum(rate(metaplatform_ont_request_total{status=~\"5..\"}[5m])) / sum(rate(metaplatform_ont_request_total[5m]))",
            "legendFormat": "Error Rate"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percentunit",
            "thresholds": {
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 0.01 },
                { "color": "red", "value": 0.05 }
              ]
            }
          }
        },
        "options": {
          "reduceOptions": { "calcs": ["lastNotNull"] },
          "colorMode": "background"
        }
      }
    ],
    "createdAt": "2026-07-16T08:00:00Z",
    "createdBy": "admin",
    "updatedAt": "2026-07-16T08:30:00Z",
    "updatedBy": "admin",
    "version": 2
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 仪表板不存在 |
| `50301` | 查询 Grafana 失败 |

---

#### 3.5.4 更新仪表板

**PUT** `/api/v1/obs/dashboards/{dashboardId}`

更新仪表板的基本信息和配置。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `dashboardId` | path | string | 是 | 仪表板 ID |
| `name` | body | string | 否 | 仪表板名称 |
| `description` | body | string | 否 | 仪表板描述 |
| `tags` | body | array[string] | 否 | 标签列表 |
| `refreshInterval` | body | string | 否 | 自动刷新间隔 |
| `timeRange` | body | object | 否 | 默认时间范围 |
| `variables` | body | array[object] | 否 | 模板变量定义 |

**请求示例**

```json
{
  "name": "tech-ont 服务监控面板 v2",
  "refreshInterval": "10s",
  "timeRange": {
    "from": "now-6h",
    "to": "now"
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "dashboardId": "db-0001",
    "name": "tech-ont 服务监控面板 v2",
    "refreshInterval": "10s",
    "timeRange": {
      "from": "now-6h",
      "to": "now"
    },
    "updatedAt": "2026-07-16T09:00:00Z",
    "updatedBy": "admin",
    "version": 3
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 仪表板不存在 |
| `50001` | 更新 Grafana 仪表板失败 |

---

#### 3.5.5 删除仪表板

**DELETE** `/api/v1/obs/dashboards/{dashboardId}`

删除指定的仪表板。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `dashboardId` | path | string | 是 | 仪表板 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "dashboardId": "db-0001",
    "deleted": true
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 仪表板不存在 |
| `50001` | 删除 Grafana 仪表板失败 |

---

#### 3.5.6 添加面板组件

**POST** `/api/v1/obs/dashboards/{dashboardId}/panels`

向仪表板添加新的面板组件。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `dashboardId` | path | string | 是 | 仪表板 ID |
| `title` | body | string | 是 | 面板标题 |
| `type` | body | string | 是 | 面板类型：`timeseries` / `stat` / `gauge` / `table` / `bargauge` / `piechart` / `heatmap` / `log` / `nodeGraph` / `traces` / `alertlist` |
| `gridPos` | body | object | 是 | 网格位置 |
| `gridPos.x` | body | integer | 是 | X 坐标（0-23） |
| `gridPos.y` | body | integer | 是 | Y 坐标 |
| `gridPos.w` | body | integer | 是 | 宽度（1-24） |
| `gridPos.h` | body | integer | 是 | 高度 |
| `datasource` | body | string | 是 | 数据源：`prometheus` / `loki` / `jaeger` |
| `targets` | body | array[object] | 是 | 查询目标列表 |
| `targets[].refId` | body | string | 是 | 引用 ID，如 `A` |
| `targets[].expr` | body | string | 是 | 查询表达式（PromQL / LogQL / Trace 查询） |
| `targets[].legendFormat` | body | string | 否 | 图例格式 |
| `fieldConfig` | body | object | 否 | 字段配置（单位、颜色、阈值） |
| `options` | body | object | 否 | 面板选项 |

**请求示例**

```json
{
  "title": "JVM 内存使用",
  "type": "timeseries",
  "gridPos": { "x": 0, "y": 12, "w": 12, "h": 8 },
  "datasource": "prometheus",
  "targets": [
    {
      "refId": "A",
      "expr": "jvm_memory_used_bytes{area=\"heap\"}",
      "legendFormat": "{{pod}} - heap"
    },
    {
      "refId": "B",
      "expr": "jvm_memory_max_bytes{area=\"heap\"}",
      "legendFormat": "{{pod}} - max"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "bytes",
      "color": { "mode": "palette-classic" }
    }
  },
  "options": {
    "legend": { "displayMode": "table", "placement": "bottom" }
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "panelId": "pn-0004",
    "dashboardId": "db-0001",
    "title": "JVM 内存使用",
    "type": "timeseries",
    "gridPos": { "x": 0, "y": 12, "w": 12, "h": 8 },
    "datasource": "prometheus",
    "targets": [
      {
        "refId": "A",
        "expr": "jvm_memory_used_bytes{area=\"heap\"}",
        "legendFormat": "{{pod}} - heap"
      },
      {
        "refId": "B",
        "expr": "jvm_memory_max_bytes{area=\"heap\"}",
        "legendFormat": "{{pod}} - max"
      }
    ],
    "createdAt": "2026-07-16T08:30:00Z"
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 仪表板不存在 |
| `40001` | `title`、`type`、`gridPos`、`datasource`、`targets` 为空 |
| `50001` | 更新 Grafana 面板失败 |

---

#### 3.5.7 更新面板组件

**PUT** `/api/v1/obs/dashboards/{dashboardId}/panels/{panelId}`

更新仪表板中的指定面板组件。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `dashboardId` | path | string | 是 | 仪表板 ID |
| `panelId` | path | string | 是 | 面板 ID |
| `title` | body | string | 否 | 面板标题 |
| `type` | body | string | 否 | 面板类型 |
| `gridPos` | body | object | 否 | 网格位置 |
| `datasource` | body | string | 否 | 数据源 |
| `targets` | body | array[object] | 否 | 查询目标列表 |
| `fieldConfig` | body | object | 否 | 字段配置 |
| `options` | body | object | 否 | 面板选项 |

**请求示例**

```json
{
  "title": "JVM 堆内存使用（更新）",
  "gridPos": { "x": 0, "y": 12, "w": 24, "h": 8 }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "panelId": "pn-0004",
    "dashboardId": "db-0001",
    "title": "JVM 堆内存使用（更新）",
    "gridPos": { "x": 0, "y": 12, "w": 24, "h": 8 },
    "updatedAt": "2026-07-16T08:45:00Z"
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 仪表板或面板不存在 |
| `50001` | 更新 Grafana 面板失败 |

---

#### 3.5.8 删除面板组件

**DELETE** `/api/v1/obs/dashboards/{dashboardId}/panels/{panelId}`

从仪表板中删除指定面板组件。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `dashboardId` | path | string | 是 | 仪表板 ID |
| `panelId` | path | string | 是 | 面板 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "panelId": "pn-0004",
    "dashboardId": "db-0001",
    "deleted": true
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 仪表板或面板不存在 |
| `50001` | 更新 Grafana 面板失败 |

---

#### 3.5.9 仪表板分享

**POST** `/api/v1/obs/dashboards/{dashboardId}/share`

生成仪表板分享链接，支持公开访问或指定权限。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `dashboardId` | path | string | 是 | 仪表板 ID |
| `accessType` | body | string | 是 | 访问类型：`public` / `organization` / `specific_users` |
| `expiresIn` | body | string | 否 | 链接有效期：`1h` / `1d` / `7d` / `30d` / `never`，默认 `7d` |
| `allowedUsers` | body | array[string] | 否 | 允许访问的用户列表（accessType=specific_users 时必填） |
| `readOnly` | body | boolean | 否 | 是否只读，默认 `true` |

**请求示例**

```json
{
  "accessType": "organization",
  "expiresIn": "7d",
  "readOnly": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "dashboardId": "db-0001",
    "shareUrl": "https://obs.metaplatform.com/d/db-0001?shareToken=s8k9m0p2q4r6",
    "shareToken": "s8k9m0p2q4r6",
    "accessType": "organization",
    "expiresAt": "2026-07-23T08:00:00Z",
    "readOnly": true,
    "createdAt": "2026-07-16T08:00:00Z",
    "createdBy": "admin"
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 仪表板不存在 |
| `40001` | `accessType` 为空或值不合法 |
| `40001` | accessType=specific_users 时 `allowedUsers` 为空 |
| `50001` | 生成 Grafana 分享链接失败 |

---

#### 3.5.10 仪表板导出

**GET** `/api/v1/obs/dashboards/{dashboardId}/export`

导出仪表板配置为 JSON 文件。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `dashboardId` | path | string | 是 | 仪表板 ID |
| `format` | query | string | 否 | 导出格式：`json`（Grafana JSON）/ `yaml`，默认 `json` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "dashboardId": "db-0001",
    "name": "tech-ont 服务监控面板 v2",
    "format": "json",
    "exportedAt": "2026-07-16T08:00:00Z",
    "version": 3,
    "content": {
      "__inputs": [
        {
          "name": "DS_PROMETHEUS",
          "label": "Prometheus",
          "description": "",
          "type": "datasource",
          "pluginId": "prometheus",
          "pluginName": "Prometheus"
        }
      ],
      "__requires": [
        {
          "type": "panel",
          "id": "timeseries",
          "name": "Time series",
          "version": ""
        }
      ],
      "annotations": { "list": [] },
      "editable": true,
      "fiscalYearStartMonth": 0,
      "graphTooltip": 0,
      "id": null,
      "links": [],
      "liveNow": false,
      "panels": [ ... ],
      "refresh": "10s",
      "schemaVersion": 39,
      "style": "dark",
      "tags": ["tech-ont", "production"],
      "templating": { "list": [ ... ] },
      "time": { "from": "now-6h", "to": "now" },
      "timepicker": {},
      "timezone": "",
      "title": "tech-ont 服务监控面板 v2",
      "uid": "db-0001",
      "version": 3,
      "weekStart": ""
    }
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 仪表板不存在 |
| `50001` | 导出 Grafana 仪表板失败 |

---

### 3.6 服务地图 API

服务地图 API 提供服务拓扑图、服务健康状态和服务依赖关系查询能力，基于 Jaeger 和 Prometheus 数据聚合。

---

#### 3.6.1 服务拓扑图

**GET** `/api/v1/obs/service-map/topology`

查询指定时间范围内的全局服务拓扑图，展示所有服务间的调用关系。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `startTime` | query | string | 是 | 起始时间 |
| `endTime` | query | string | 是 | 结束时间 |
| `service` | query | string | 否 | 指定服务名，仅展示该服务及其直接上下游 |

**请求示例**

```
GET /api/v1/obs/service-map/topology?startTime=2026-07-16T07:00:00Z&endTime=2026-07-16T08:00:00Z
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "startTime": "2026-07-16T07:00:00Z",
    "endTime": "2026-07-16T08:00:00Z",
    "nodes": [
      {
        "id": "tech-gw",
        "service": "tech-gw",
        "type": "gateway",
        "health": "healthy",
        "instanceCount": 3,
        "requestRate": 152.3,
        "errorRate": 0.015,
        "p99Latency": 234,
        "p99LatencyUnit": "ms"
      },
      {
        "id": "tech-iam",
        "service": "tech-iam",
        "type": "service",
        "health": "healthy",
        "instanceCount": 2,
        "requestRate": 145.8,
        "errorRate": 0.001,
        "p99Latency": 45,
        "p99LatencyUnit": "ms"
      },
      {
        "id": "tech-ont",
        "service": "tech-ont",
        "type": "service",
        "health": "degraded",
        "instanceCount": 3,
        "requestRate": 89.2,
        "errorRate": 0.031,
        "p99Latency": 1850,
        "p99LatencyUnit": "ms"
      },
      {
        "id": "tech-data",
        "service": "tech-data",
        "type": "service",
        "health": "healthy",
        "instanceCount": 2,
        "requestRate": 234.5,
        "errorRate": 0.004,
        "p99Latency": 1100,
        "p99LatencyUnit": "ms"
      },
      {
        "id": "tech-rag",
        "service": "tech-rag",
        "type": "service",
        "health": "healthy",
        "instanceCount": 2,
        "requestRate": 12.1,
        "errorRate": 0.0,
        "p99Latency": 320,
        "p99LatencyUnit": "ms"
      },
      {
        "id": "app-dashboard",
        "service": "app-dashboard",
        "type": "application",
        "health": "healthy",
        "instanceCount": 2,
        "requestRate": 45.6,
        "errorRate": 0.002,
        "p99Latency": 180,
        "p99LatencyUnit": "ms"
      }
    ],
    "edges": [
      {
        "source": "app-dashboard",
        "target": "tech-gw",
        "callCount": 2736,
        "errorCount": 5,
        "errorRate": 0.002,
        "avgLatency": 120,
        "p99Latency": 234,
        "p99LatencyUnit": "ms"
      },
      {
        "source": "tech-gw",
        "target": "tech-iam",
        "callCount": 8748,
        "errorCount": 9,
        "errorRate": 0.001,
        "avgLatency": 28,
        "p99Latency": 45,
        "p99LatencyUnit": "ms"
      },
      {
        "source": "tech-gw",
        "target": "tech-ont",
        "callCount": 5352,
        "errorCount": 166,
        "errorRate": 0.031,
        "avgLatency": 345,
        "p99Latency": 1850,
        "p99LatencyUnit": "ms"
      },
      {
        "source": "tech-ont",
        "target": "tech-data",
        "callCount": 17340,
        "errorCount": 69,
        "errorRate": 0.004,
        "avgLatency": 156,
        "p99Latency": 1100,
        "p99LatencyUnit": "ms"
      },
      {
        "source": "tech-ont",
        "target": "tech-rag",
        "callCount": 726,
        "errorCount": 0,
        "errorRate": 0.0,
        "avgLatency": 89,
        "p99Latency": 320,
        "p99LatencyUnit": "ms"
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | `startTime` 或 `endTime` 缺失 |
| `50301` | Jaeger 或 Prometheus 下游不可用 |
| `50401` | 查询超时 |

---

#### 3.6.2 服务健康状态

**GET** `/api/v1/obs/service-map/health`

查询所有服务或指定服务的健康状态概览。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `service` | query | string | 否 | 指定服务名，为空则返回全部服务 |

**请求示例**

```
GET /api/v1/obs/service-map/health
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "services": [
      {
        "service": "tech-gw",
        "health": "healthy",
        "status": "operational",
        "instanceCount": 3,
        "healthyInstances": 3,
        "unhealthyInstances": 0,
        "metrics": {
          "requestRate": 152.3,
          "errorRate": 0.015,
          "p99Latency": 234,
          "p99LatencyUnit": "ms",
          "cpuUsage": 0.45,
          "memoryUsage": 0.62,
          "uptime": "99.98%"
        },
        "lastCheckedAt": "2026-07-16T08:05:00Z",
        "activeAlerts": 0
      },
      {
        "service": "tech-ont",
        "health": "degraded",
        "status": "degraded",
        "instanceCount": 3,
        "healthyInstances": 2,
        "unhealthyInstances": 1,
        "metrics": {
          "requestRate": 89.2,
          "errorRate": 0.031,
          "p99Latency": 1850,
          "p99LatencyUnit": "ms",
          "cpuUsage": 0.78,
          "memoryUsage": 0.85,
          "uptime": "99.92%"
        },
        "lastCheckedAt": "2026-07-16T08:05:00Z",
        "activeAlerts": 2,
        "issues": [
          {
            "type": "high_latency",
            "description": "P99 延迟 1850ms，超过阈值 1000ms",
            "severity": "warning"
          },
          {
            "type": "high_error_rate",
            "description": "错误率 3.1%，超过阈值 1%",
            "severity": "critical"
          }
        ]
      },
      {
        "service": "tech-iam",
        "health": "healthy",
        "status": "operational",
        "instanceCount": 2,
        "healthyInstances": 2,
        "unhealthyInstances": 0,
        "metrics": {
          "requestRate": 145.8,
          "errorRate": 0.001,
          "p99Latency": 45,
          "p99LatencyUnit": "ms",
          "cpuUsage": 0.22,
          "memoryUsage": 0.35,
          "uptime": "100.00%"
        },
        "lastCheckedAt": "2026-07-16T08:05:00Z",
        "activeAlerts": 0
      }
    ],
    "summary": {
      "totalServices": 15,
      "healthy": 13,
      "degraded": 1,
      "down": 0,
      "unknown": 1,
      "overallHealth": "degraded"
    }
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 指定服务不存在 |
| `50301` | Prometheus 下游不可用 |

---

#### 3.6.3 服务依赖查询

**GET** `/api/v1/obs/service-map/{service}/dependencies`

查询指定服务的上游和下游依赖关系。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `service` | path | string | 是 | 服务名称 |
| `startTime` | query | string | 否 | 起始时间，默认最近 1 小时 |
| `endTime` | query | string | 否 | 结束时间，默认当前时间 |
| `direction` | query | string | 否 | 依赖方向：`upstream` / `downstream` / `both`，默认 `both` |

**请求示例**

```
GET /api/v1/obs/service-map/tech-ont/dependencies?direction=both&startTime=2026-07-16T07:00:00Z&endTime=2026-07-16T08:00:00Z
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "service": "tech-ont",
    "startTime": "2026-07-16T07:00:00Z",
    "endTime": "2026-07-16T08:00:00Z",
    "upstream": [
      {
        "service": "tech-gw",
        "callCount": 5352,
        "errorCount": 166,
        "errorRate": 0.031,
        "avgLatency": 345,
        "p99Latency": 1850,
        "p99LatencyUnit": "ms",
        "operations": [
          { "operation": "POST /api/v1/ont/concepts", "count": 520, "errorCount": 47 },
          { "operation": "GET /api/v1/ont/concepts/{id}", "count": 803, "errorCount": 0 },
          { "operation": "PUT /api/v1/ont/concepts/{id}", "count": 200, "errorCount": 5 }
        ]
      },
      {
        "service": "app-ontstudio",
        "callCount": 412,
        "errorCount": 3,
        "errorRate": 0.007,
        "avgLatency": 210,
        "p99Latency": 890,
        "p99LatencyUnit": "ms",
        "operations": [
          { "operation": "GET /api/v1/ont/concepts", "count": 412, "errorCount": 3 }
        ]
      }
    ],
    "downstream": [
      {
        "service": "tech-data",
        "callCount": 17340,
        "errorCount": 69,
        "errorRate": 0.004,
        "avgLatency": 156,
        "p99Latency": 1100,
        "p99LatencyUnit": "ms",
        "operations": [
          { "operation": "DataSource.query", "count": 17340, "errorCount": 69 }
        ]
      },
      {
        "service": "tech-rag",
        "callCount": 726,
        "errorCount": 0,
        "errorRate": 0.0,
        "avgLatency": 89,
        "p99Latency": 320,
        "p99LatencyUnit": "ms",
        "operations": [
          { "operation": "RAGService.search", "count": 726, "errorCount": 0 }
        ]
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 指定服务不存在 |
| `50301` | Jaeger 下游不可用 |

---

### 3.7 SLO 管理 API

SLO 管理 API 提供服务等级目标（SLO）的定义、错误预算查询、SLI 查询和 SLO 报告能力。

---

#### 3.7.1 创建 SLO 定义

**POST** `/api/v1/obs/slos`

创建服务等级目标定义。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `name` | body | string | 是 | SLO 名称 |
| `service` | body | string | 是 | 目标服务 |
| `description` | body | string | 否 | SLO 描述 |
| `sli` | body | object | 是 | SLI 定义 |
| `sli.type` | body | string | 是 | SLI 类型：`availability` / `latency` / `throughput` / `error_rate` / `custom` |
| `sli.query` | body | string | 是 | SLI PromQL 查询表达式（分子），如 `1 - (sum(rate(http_requests_total{status=~\"5..\"}[{{.window}}])) / sum(rate(http_requests_total[{{.window}}])))` |
| `sli.totalQuery` | body | string | 否 | 总量查询（分母），当 type 非 custom 时可选 |
| `sli.labels` | body | object | 否 | SLI 额外标签 |
| `target` | body | number | 是 | SLO 目标值（百分比），如 `99.9` 表示 99.9% |
| `window` | body | string | 是 | SLO 评估窗口：`7d` / `14d` / `30d` / `90d` |
| `alerting` | body | object | 否 | 告警配置 |
| `alerting.fastBurn` | body | object | 否 | 快速燃烧告警配置 |
| `alerting.fastBurn.threshold` | body | number | 否 | 快速燃烧阈值（错误预算消耗百分比），默认 `2`（即 2% 错误预算在 1 小时内消耗完） |
| `alerting.fastBurn.window` | body | string | 否 | 快速燃烧窗口，默认 `1h` |
| `alerting.slowBurn` | body | object | 否 | 慢速燃烧告警配置 |
| `alerting.slowBurn.threshold` | body | number | 否 | 慢速燃烧阈值，默认 `25` |
| `alerting.slowBurn.window` | body | string | 否 | 慢速燃烧窗口，默认 `6h` |
| `notificationChannelIds` | body | array[string] | 否 | 通知渠道 ID |

**请求示例**

```json
{
  "name": "tech-ont API 可用性 SLO",
  "service": "tech-ont",
  "description": "tech-ont 服务 API 请求成功率目标为 99.9%（30 天滚动窗口）",
  "sli": {
    "type": "availability",
    "query": "1 - (sum(rate(metaplatform_ont_request_total{status=~\"5..\"}[{{.window}}])) / sum(rate(metaplatform_ont_request_total[{{.window}}])))",
    "totalQuery": "sum(rate(metaplatform_ont_request_total[{{.window}}]))",
    "labels": {
      "slo_type": "availability"
    }
  },
  "target": 99.9,
  "window": "30d",
  "alerting": {
    "fastBurn": {
      "threshold": 2,
      "window": "1h"
    },
    "slowBurn": {
      "threshold": 25,
      "window": "6h"
    }
  },
  "notificationChannelIds": ["nc-001", "nc-003"]
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "sloId": "slo-0001",
    "name": "tech-ont API 可用性 SLO",
    "service": "tech-ont",
    "description": "tech-ont 服务 API 请求成功率目标为 99.9%（30 天滚动窗口）",
    "sli": {
      "type": "availability",
      "query": "1 - (sum(rate(metaplatform_ont_request_total{status=~\"5..\"}[{{.window}}])) / sum(rate(metaplatform_ont_request_total[{{.window}}])))",
      "totalQuery": "sum(rate(metaplatform_ont_request_total[{{.window}}]))",
      "labels": {
        "slo_type": "availability"
      }
    },
    "target": 99.9,
    "window": "30d",
    "errorBudget": 0.001,
    "alerting": {
      "fastBurn": {
        "threshold": 2,
        "window": "1h"
      },
      "slowBurn": {
        "threshold": 25,
        "window": "6h"
      }
    },
    "notificationChannelIds": ["nc-001", "nc-003"],
    "status": "active",
    "createdAt": "2026-07-16T08:00:00Z",
    "createdBy": "admin"
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | `name`、`service`、`sli`、`target`、`window` 为空 |
| `40009` | SLO 名称已存在 |
| `40001` | `target` 不在 0-100 范围内 |
| `40001` | `window` 值不合法（仅支持 `7d` / `14d` / `30d` / `90d`） |
| `50001` | SLO 规则写入 Alertmanager 失败 |

---

#### 3.7.2 SLO 列表查询

**GET** `/api/v1/obs/slos`

查询 SLO 定义列表。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `service` | query | string | 否 | 按服务过滤 |
| `status` | query | string | 否 | 按状态过滤：`active` / `inactive` / `violated` |
| `page` | query | integer | 否 | 页码 |
| `pageSize` | query | integer | 否 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "sloId": "slo-0001",
        "name": "tech-ont API 可用性 SLO",
        "service": "tech-ont",
        "sliType": "availability",
        "target": 99.9,
        "window": "30d",
        "status": "active",
        "currentSli": 99.87,
        "errorBudgetRemaining": 0.3,
        "errorBudgetConsumed": 99.7,
        "createdAt": "2026-07-16T08:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `50301` | 查询元数据数据库失败 |

---

#### 3.7.3 SLO 详情

**GET** `/api/v1/obs/slos/{sloId}`

查询单个 SLO 的详细定义和当前状态。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `sloId` | path | string | 是 | SLO ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "sloId": "slo-0001",
    "name": "tech-ont API 可用性 SLO",
    "service": "tech-ont",
    "description": "tech-ont 服务 API 请求成功率目标为 99.9%（30 天滚动窗口）",
    "sli": {
      "type": "availability",
      "query": "1 - (sum(rate(metaplatform_ont_request_total{status=~\"5..\"}[{{.window}}])) / sum(rate(metaplatform_ont_request_total[{{.window}}])))",
      "totalQuery": "sum(rate(metaplatform_ont_request_total[{{.window}}]))",
      "labels": { "slo_type": "availability" }
    },
    "target": 99.9,
    "window": "30d",
    "errorBudget": 0.001,
    "alerting": {
      "fastBurn": { "threshold": 2, "window": "1h" },
      "slowBurn": { "threshold": 25, "window": "6h" }
    },
    "notificationChannelIds": ["nc-001", "nc-003"],
    "status": "active",
    "currentSli": 99.87,
    "errorBudget": {
      "total": 4.32,
      "consumed": 4.31,
      "remaining": 0.01,
      "remainingPercentage": 0.23,
      "unit": "minutes"
    },
    "createdAt": "2026-07-16T08:00:00Z",
    "createdBy": "admin",
    "updatedAt": "2026-07-16T08:00:00Z",
    "updatedBy": "admin"
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | SLO 不存在 |

---

#### 3.7.4 更新 SLO

**PUT** `/api/v1/obs/slos/{sloId}`

更新 SLO 定义。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `sloId` | path | string | 是 | SLO ID |
| `name` | body | string | 否 | SLO 名称 |
| `description` | body | string | 否 | SLO 描述 |
| `sli` | body | object | 否 | SLI 定义 |
| `target` | body | number | 否 | SLO 目标值 |
| `window` | body | string | 否 | SLO 评估窗口 |
| `alerting` | body | object | 否 | 告警配置 |
| `notificationChannelIds` | body | array[string] | 否 | 通知渠道 ID |
| `status` | body | string | 否 | SLO 状态：`active` / `inactive` |

**请求示例**

```json
{
  "target": 99.95,
  "window": "14d",
  "status": "active"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "sloId": "slo-0001",
    "name": "tech-ont API 可用性 SLO",
    "target": 99.95,
    "window": "14d",
    "errorBudget": 0.0005,
    "status": "active",
    "updatedAt": "2026-07-16T08:30:00Z",
    "updatedBy": "admin"
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | SLO 不存在 |
| `40001` | `target` 不在 0-100 范围内 |
| `50001` | 更新 Alertmanager 规则失败 |

---

#### 3.7.5 删除 SLO

**DELETE** `/api/v1/obs/slos/{sloId}`

删除 SLO 定义，同时移除关联的告警规则。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `sloId` | path | string | 是 | SLO ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "sloId": "slo-0001",
    "deleted": true
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | SLO 不存在 |
| `50001` | 删除关联告警规则失败 |

---

#### 3.7.6 错误预算查询

**GET** `/api/v1/obs/slos/{sloId}/error-budget`

查询指定 SLO 的错误预算消耗情况，包括预算总量、已消耗量和剩余量。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `sloId` | path | string | 是 | SLO ID |
| `startTime` | query | string | 否 | 起始时间，默认当前窗口起始 |
| `endTime` | query | string | 否 | 结束时间，默认当前时间 |
| `granularity` | query | string | 否 | 时间粒度：`1h` / `6h` / `1d`，默认 `1h` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "sloId": "slo-0001",
    "name": "tech-ont API 可用性 SLO",
    "target": 99.9,
    "window": "30d",
    "startTime": "2026-06-16T08:00:00Z",
    "endTime": "2026-07-16T08:00:00Z",
    "errorBudget": {
      "total": 4.32,
      "consumed": 4.31,
      "remaining": 0.01,
      "remainingPercentage": 0.23,
      "unit": "minutes",
      "status": "critical"
    },
    "series": [
      {
        "timestamp": "2026-07-16T07:00:00Z",
        "consumed": 4.28,
        "remaining": 0.04,
        "remainingPercentage": 0.93
      },
      {
        "timestamp": "2026-07-16T08:00:00Z",
        "consumed": 4.31,
        "remaining": 0.01,
        "remainingPercentage": 0.23
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | SLO 不存在 |
| `50301` | Prometheus 查询失败 |

---

#### 3.7.7 SLI 查询

**GET** `/api/v1/obs/slos/{sloId}/sli`

查询指定 SLO 的 SLI 当前值和历史趋势。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `sloId` | path | string | 是 | SLO ID |
| `startTime` | query | string | 否 | 起始时间 |
| `endTime` | query | string | 否 | 结束时间 |
| `step` | query | string | 否 | 时间步长，默认 `5m` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "sloId": "slo-0001",
    "name": "tech-ont API 可用性 SLO",
    "sliType": "availability",
    "target": 99.9,
    "currentValue": 99.87,
    "windowValue": 99.92,
    "window": "30d",
    "startTime": "2026-07-16T07:00:00Z",
    "endTime": "2026-07-16T08:00:00Z",
    "series": [
      {
        "timestamp": "2026-07-16T07:00:00Z",
        "value": 99.95
      },
      {
        "timestamp": "2026-07-16T07:05:00Z",
        "value": 99.93
      },
      {
        "timestamp": "2026-07-16T07:10:00Z",
        "value": 99.88
      },
      {
        "timestamp": "2026-07-16T07:15:00Z",
        "value": 99.82
      },
      {
        "timestamp": "2026-07-16T07:20:00Z",
        "value": 99.75
      },
      {
        "timestamp": "2026-07-16T07:25:00Z",
        "value": 99.80
      },
      {
        "timestamp": "2026-07-16T07:30:00Z",
        "value": 99.85
      },
      {
        "timestamp": "2026-07-16T07:35:00Z",
        "value": 99.90
      },
      {
        "timestamp": "2026-07-16T07:40:00Z",
        "value": 99.92
      },
      {
        "timestamp": "2026-07-16T07:45:00Z",
        "value": 99.94
      },
      {
        "timestamp": "2026-07-16T07:50:00Z",
        "value": 99.93
      },
      {
        "timestamp": "2026-07-16T07:55:00Z",
        "value": 99.91
      },
      {
        "timestamp": "2026-07-16T08:00:00Z",
        "value": 99.87
      }
    ],
    "statistics": {
      "min": 99.75,
      "max": 99.95,
      "avg": 99.88,
      "p50": 99.90,
      "p95": 99.94,
      "p99": 99.95
    }
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | SLO 不存在 |
| `50301` | Prometheus 查询失败 |

---

#### 3.7.8 SLO 报告

**GET** `/api/v1/obs/slos/{sloId}/report`

生成指定 SLO 的评估报告，包括 SLI 趋势、错误预算消耗、违规事件和燃烧率。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `sloId` | path | string | 是 | SLO ID |
| `startTime` | query | string | 是 | 报告起始时间 |
| `endTime` | query | string | 是 | 报告结束时间 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "sloId": "slo-0001",
    "name": "tech-ont API 可用性 SLO",
    "service": "tech-ont",
    "sliType": "availability",
    "target": 99.9,
    "window": "30d",
    "reportPeriod": {
      "startTime": "2026-06-16T08:00:00Z",
      "endTime": "2026-07-16T08:00:00Z"
    },
    "summary": {
      "achieved": false,
      "averageSli": 99.87,
      "targetSli": 99.9,
      "gap": -0.03,
      "totalRequests": 1523400,
      "totalErrors": 1980,
      "errorRate": 0.0013,
      "uptime": "99.87%",
      "status": "violated"
    },
    "errorBudget": {
      "total": 4.32,
      "consumed": 4.31,
      "remaining": 0.01,
      "remainingPercentage": 0.23,
      "burnRate": {
        "fast": {
          "current": 14.2,
          "threshold": 2,
          "window": "1h",
          "breached": true,
          "breachedAt": "2026-07-16T07:50:00Z"
        },
        "slow": {
          "current": 3.1,
          "threshold": 25,
          "window": "6h",
          "breached": false
        }
      }
    },
    "violations": [
      {
        "violationId": "v-001",
        "startTime": "2026-07-16T07:15:00Z",
        "endTime": "2026-07-16T07:25:00Z",
        "duration": "10m",
        "errorRate": 0.025,
        "errorCount": 45,
        "totalRequests": 1800,
        "rootCause": "tech-ont NullPointerException in ConceptService.create",
        "traceId": "a1b2c3d4e5f6789012345678abcdef00"
      }
    ],
    "dailyBreakdown": [
      {
        "date": "2026-07-15",
        "sli": 99.96,
        "errorCount": 12,
        "totalRequests": 52000,
        "errorBudgetConsumed": 0.02
      },
      {
        "date": "2026-07-16",
        "sli": 99.82,
        "errorCount": 198,
        "totalRequests": 52000,
        "errorBudgetConsumed": 0.28
      }
    ]
  },
  "traceId": "a1b2c3d4e5f6789012345678abcdef00"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | SLO 不存在 |
| `40001` | `startTime` 或 `endTime` 缺失 |
| `50301` | Prometheus 查询失败 |

---

## 4. 数据模型

### 4.1 PostgreSQL 表定义

TECH-OBS 使用 PostgreSQL 17 存储元数据（告警规则、通知渠道、仪表板配置、SLO 定义等），日志、指标和 Trace 时序数据分别存储在 Loki、Prometheus 和 Jaeger 中。

#### 4.1.1 alert_rules（告警规则表）

```sql
CREATE TABLE alert_rules (
    id              VARCHAR(64)   PRIMARY KEY DEFAULT gen_random_uuid()::text,
    rule_id         VARCHAR(32)   NOT NULL UNIQUE,          -- 业务规则 ID，如 ar-0001
    name            VARCHAR(256)  NOT NULL,                  -- 规则名称
    type            VARCHAR(16)   NOT NULL,                  -- 告警类型：metric / log / trace
    service         VARCHAR(64)   NOT NULL,                  -- 目标服务
    condition       TEXT          NOT NULL,                  -- 告警条件表达式
    duration        VARCHAR(16)   NOT NULL DEFAULT '1m',    -- 持续时间窗口
    severity        VARCHAR(16)   NOT NULL,                  -- 告警级别：critical / warning / info
    annotations     JSONB,                                  -- 注解信息
    labels          JSONB,                                  -- 自定义标签
    enabled         BOOLEAN       NOT NULL DEFAULT true,    -- 是否启用
    state           VARCHAR(16)   NOT NULL DEFAULT 'ok',    -- 当前状态：ok / pending / firing
    last_evaluated  TIMESTAMPTZ,                             -- 最后评估时间
    last_fired      TIMESTAMPTZ,                             -- 最后触发时间
    created_by      VARCHAR(64)   NOT NULL,                  -- 创建人
    updated_by      VARCHAR(64),                             -- 更新人
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_alert_type CHECK (type IN ('metric', 'log', 'trace')),
    CONSTRAINT chk_severity CHECK (severity IN ('critical', 'warning', 'info')),
    CONSTRAINT chk_alert_state CHECK (state IN ('ok', 'pending', 'firing'))
);

CREATE INDEX idx_alert_rules_service ON alert_rules(service);
CREATE INDEX idx_alert_rules_type ON alert_rules(type);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);
```

#### 4.1.2 notification_channels（通知渠道表）

```sql
CREATE TABLE notification_channels (
    id              VARCHAR(64)   PRIMARY KEY DEFAULT gen_random_uuid()::text,
    channel_id      VARCHAR(32)   NOT NULL UNIQUE,          -- 业务渠道 ID，如 nc-001
    name            VARCHAR(256)  NOT NULL,                  -- 渠道名称
    type            VARCHAR(32)   NOT NULL,                  -- 渠道类型：feishu / dingtalk / email / webhook / slack
    config          JSONB         NOT NULL,                  -- 渠道配置（webhookUrl / emails 等）
    severity_filter JSONB,                                   -- 接收告警级别过滤
    enabled         BOOLEAN       NOT NULL DEFAULT true,    -- 是否启用
    created_by      VARCHAR(64)   NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_channel_type CHECK (type IN ('feishu', 'dingtalk', 'email', 'webhook', 'slack'))
);
```

#### 4.1.3 alert_rule_channels（告警规则-通知渠道关联表）

```sql
CREATE TABLE alert_rule_channels (
    alert_rule_id     VARCHAR(64) NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    channel_id        VARCHAR(64) NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (alert_rule_id, channel_id)
);
```

#### 4.1.4 alert_history（告警历史表）

```sql
CREATE TABLE alert_history (
    id              BIGSERIAL     PRIMARY KEY,
    alert_id        VARCHAR(64)   NOT NULL UNIQUE,          -- 告警实例 ID
    rule_id         VARCHAR(32)   NOT NULL,                  -- 关联规则 ID
    rule_name       VARCHAR(256)  NOT NULL,                  -- 规则名称（冗余）
    type            VARCHAR(16)   NOT NULL,                  -- 告警类型
    service         VARCHAR(64)   NOT NULL,                  -- 目标服务
    severity        VARCHAR(16)   NOT NULL,                  -- 告警级别
    state           VARCHAR(16)   NOT NULL,                  -- 告警状态：firing / resolved
    condition       TEXT          NOT NULL,                  -- 触发条件
    current_value   TEXT,                                    -- 触发时当前值
    labels          JSONB,                                   -- 告警标签
    annotations     JSONB,                                   -- 告警注解
    trace_id        VARCHAR(64),                              -- 关联 Trace ID
    fired_at        TIMESTAMPTZ   NOT NULL,                   -- 触发时间
    resolved_at     TIMESTAMPTZ,                              -- 恢复时间
    resolved_by     VARCHAR(64),                              -- 恢复操作人（system / user）
    silenced        BOOLEAN       NOT NULL DEFAULT false,    -- 是否被静默
    silenced_by     VARCHAR(64),                              -- 静默操作人
    silenced_at     TIMESTAMPTZ,                              -- 静默时间
    silence_expires TIMESTAMPTZ,                              -- 静默过期时间
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_history_state CHECK (state IN ('firing', 'resolved'))
);

CREATE INDEX idx_alert_history_rule ON alert_history(rule_id);
CREATE INDEX idx_alert_history_service ON alert_history(service);
CREATE INDEX idx_alert_history_fired ON alert_history(fired_at);
CREATE INDEX idx_alert_history_trace ON alert_history(trace_id);
```

#### 4.1.5 dashboards（仪表板表）

```sql
CREATE TABLE dashboards (
    id              VARCHAR(64)   PRIMARY KEY DEFAULT gen_random_uuid()::text,
    dashboard_id    VARCHAR(32)   NOT NULL UNIQUE,          -- 业务仪表板 ID，如 db-0001
    name            VARCHAR(256)  NOT NULL,                  -- 仪表板名称
    description     TEXT,                                    -- 仪表板描述
    tags            JSONB,                                   -- 标签列表
    refresh_interval VARCHAR(16)  NOT NULL DEFAULT '30s',   -- 自动刷新间隔
    time_range      JSONB,                                   -- 默认时间范围
    variables       JSONB,                                   -- 模板变量定义
    panels          JSONB         NOT NULL DEFAULT '[]',     -- 面板组件配置
    version         INTEGER       NOT NULL DEFAULT 1,        -- 版本号
    grafana_uid     VARCHAR(64),                              -- Grafana 仪表板 UID
    created_by      VARCHAR(64)   NOT NULL,
    updated_by      VARCHAR(64),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dashboards_tags ON dashboards USING gin(tags);
```

#### 4.1.6 dashboard_shares（仪表板分享表）

```sql
CREATE TABLE dashboard_shares (
    id              VARCHAR(64)   PRIMARY KEY DEFAULT gen_random_uuid()::text,
    dashboard_id    VARCHAR(32)   NOT NULL,                  -- 仪表板 ID
    share_token     VARCHAR(128)  NOT NULL UNIQUE,           -- 分享 Token
    access_type     VARCHAR(32)   NOT NULL,                  -- 访问类型：public / organization / specific_users
    allowed_users   JSONB,                                   -- 允许访问用户（specific_users 时）
    read_only       BOOLEAN       NOT NULL DEFAULT true,     -- 是否只读
    expires_at      TIMESTAMPTZ,                              -- 过期时间
    created_by      VARCHAR(64)   NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_share_access CHECK (access_type IN ('public', 'organization', 'specific_users'))
);
```

#### 4.1.7 custom_metrics（自定义指标注册表）

```sql
CREATE TABLE custom_metrics (
    id              VARCHAR(64)   PRIMARY KEY DEFAULT gen_random_uuid()::text,
    metric_id       VARCHAR(32)   NOT NULL UNIQUE,          -- 业务指标 ID，如 mt-0001
    name            VARCHAR(256)  NOT NULL UNIQUE,            -- 指标名称（Prometheus 命名规范）
    type            VARCHAR(16)   NOT NULL,                   -- 指标类型：counter / gauge / histogram / summary
    help            TEXT          NOT NULL,                   -- 帮助描述
    labels          JSONB,                                    -- 标签定义列表
    unit            VARCHAR(32),                              -- 指标单位
    service         VARCHAR(64)   NOT NULL,                   -- 归属服务
    status         VARCHAR(16)   NOT NULL DEFAULT 'registered', -- 状态：registered / active / inactive
    scrape_interval VARCHAR(16)   NOT NULL DEFAULT '15s',    -- 采集间隔
    scrape_timeout  VARCHAR(16)   NOT NULL DEFAULT '10s',     -- 采集超时
    last_scrape_at  TIMESTAMPTZ,                              -- 最后采集时间
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_metric_type CHECK (type IN ('counter', 'gauge', 'histogram', 'summary')),
    CONSTRAINT chk_metric_status CHECK (status IN ('registered', 'active', 'inactive'))
);

CREATE INDEX idx_metrics_service ON custom_metrics(service);
CREATE INDEX idx_metrics_type ON custom_metrics(type);
```

#### 4.1.8 slos（SLO 定义表）

```sql
CREATE TABLE slos (
    id              VARCHAR(64)   PRIMARY KEY DEFAULT gen_random_uuid()::text,
    slo_id          VARCHAR(32)   NOT NULL UNIQUE,          -- 业务 SLO ID，如 slo-0001
    name            VARCHAR(256)  NOT NULL,                  -- SLO 名称
    service         VARCHAR(64)   NOT NULL,                  -- 目标服务
    description     TEXT,                                    -- SLO 描述
    sli             JSONB         NOT NULL,                  -- SLI 定义（type / query / totalQuery / labels）
    target          NUMERIC(5,2)  NOT NULL,                   -- SLO 目标值（百分比）
    window          VARCHAR(8)   NOT NULL,                   -- 评估窗口：7d / 14d / 30d / 90d
    error_budget    NUMERIC(8,6)  NOT NULL,                   -- 错误预算（1 - target/100）
    alerting        JSONB,                                    -- 告警配置（fastBurn / slowBurn）
    status          VARCHAR(16)   NOT NULL DEFAULT 'active',  -- 状态：active / inactive / violated
    created_by      VARCHAR(64)   NOT NULL,
    updated_by      VARCHAR(64),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_slo_target CHECK (target >= 0 AND target <= 100),
    CONSTRAINT chk_slo_window CHECK (window IN ('7d', '14d', '30d', '90d')),
    CONSTRAINT chk_slo_status CHECK (status IN ('active', 'inactive', 'violated'))
);

CREATE INDEX idx_slos_service ON slos(service);
CREATE INDEX idx_slos_status ON slos(status);
```

#### 4.1.9 slo_violations（SLO 违规记录表）

```sql
CREATE TABLE slo_violations (
    id              BIGSERIAL     PRIMARY KEY,
    slo_id          VARCHAR(32)   NOT NULL,                  -- SLO ID
    violation_id    VARCHAR(64)   NOT NULL UNIQUE,           -- 违规 ID
    start_time      TIMESTAMPTZ   NOT NULL,                   -- 违规开始时间
    end_time        TIMESTAMPTZ,                               -- 违规结束时间
    duration        VARCHAR(16),                               -- 违规持续时间
    error_rate      NUMERIC(8,6),                              -- 违规期间错误率
    error_count     INTEGER,                                   -- 错误数量
    total_requests  INTEGER,                                   -- 总请求数
    root_cause      TEXT,                                      -- 根因分析
    trace_id        VARCHAR(64),                              -- 关联 Trace ID
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_slo_violations_slo ON slo_violations(slo_id);
CREATE INDEX idx_slo_violations_start ON slo_violations(start_time);
```

### 4.2 Prometheus 指标定义

#### 4.2.1 平台标准指标命名规范

所有平台指标使用统一前缀 `metaplatform_`，格式：

```
metaplatform_{service}_{metric_name}_{unit}
```

#### 4.2.2 核心指标定义

| 指标名称 | 类型 | 标签 | 说明 |
|---|---|---|---|
| `metaplatform_{service}_request_total` | counter | `method`, `path`, `status`, `tenant_id` | HTTP 请求总数 |
| `metaplatform_{service}_request_duration_seconds` | histogram | `method`, `path`, `status`, `tenant_id` | HTTP 请求延迟分布 |
| `metaplatform_{service}_request_in_progress` | gauge | `method`, `path` | 当前处理中的请求数 |
| `metaplatform_{service}_error_total` | counter | `type`, `exception`, `tenant_id` | 错误总数 |
| `metaplatform_{service}_jvm_memory_used_bytes` | gauge | `area`, `pod` | JVM 内存使用 |
| `metaplatform_{service}_jvm_gc_pause_seconds` | histogram | `action`, `cause`, `pod` | JVM GC 暂停时间 |
| `metaplatform_{service}_db_connection_pool_active` | gauge | `pool`, `pod` | 数据库连接池活跃连接数 |
| `metaplatform_{service}_kafka_consumer_lag` | gauge | `topic`, `partition`, `consumer_group` | Kafka 消费延迟 |
| `metaplatform_obs_alert_fired_total` | counter | `rule_id`, `severity`, `service` | 告警触发总数 |
| `metaplatform_obs_alert_resolved_total` | counter | `rule_id`, `severity`, `service` | 告警恢复总数 |
| `metaplatform_obs_sli_value` | gauge | `slo_id`, `service`, `sli_type` | SLI 当前值 |
| `metaplatform_obs_error_budget_remaining` | gauge | `slo_id`, `service` | 错误预算剩余比例 |

#### 4.2.3 OpenTelemetry 指标采集配置

```yaml
# OpenTelemetry Collector 配置
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318
  prometheus:
    config:
      scrape_configs:
        - job_name: 'metaplatform-services'
          scrape_interval: 15s
          kubernetes_sd_configs:
            - role: pod
          relabel_configs:
            - source_labels: [__meta_kubernetes_pod_annotation_metaplatform_scrape]
              action: keep
              regex: true

processors:
  batch:
    timeout: 5s
    send_batch_size: 10000
  memory_limiter:
    check_interval: 1s
    limit_percentage: 80
    spike_limit_percentage: 25
  resource:
    attributes:
      - key: deployment.environment
        value: production
        action: upsert

exporters:
  prometheus:
    endpoint: 0.0.0.0:8889
  prometheusremotewrite:
    endpoint: http://prometheus:9090/api/v1/write
  loki:
    endpoint: http://loki:3100/loki/api/v1/push
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true

service:
  pipelines:
    metrics:
      receivers: [otlp, prometheus]
      processors: [memory_limiter, batch, resource]
      exporters: [prometheus, prometheusremotewrite]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch, resource]
      exporters: [loki]
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch, resource]
      exporters: [jaeger]
```

### 4.3 OpenTelemetry Span 结构

#### 4.3.1 Span 数据模型

```json
{
  "traceId": "a1b2c3d4e5f6789012345678abcdef00",
  "spanId": "1a2b3c4d5e6f7a8b",
  "parentSpanId": null,
  "traceState": "",
  "name": "POST /api/v1/ont/concepts",
  "kind": "SPAN_KIND_SERVER",
  "startTimeUnixNano": "1784063972123000000",
  "endTimeUnixNano": "1784063973973000000",
  "attributes": {
    "http.method": "POST",
    "http.url": "/api/v1/ont/concepts",
    "http.status_code": 500,
    "http.response_content_length": 128,
    "component": "spring-boot",
    "tenant_id": "t001",
    "user_id": "u12345"
  },
  "status": {
    "code": "STATUS_CODE_ERROR",
    "message": "NullPointerException at ConceptService.create"
  },
  "events": [
    {
      "name": "exception",
      "timeUnixNano": "1784063973500000000",
      "attributes": {
        "exception.type": "java.lang.NullPointerException",
        "exception.message": "Cannot invoke method on null reference",
        "exception.stacktrace": "at com.metaplatform.ont.engine.ConceptService..."
      }
    }
  ],
  "links": [],
  "resource": {
    "attributes": {
      "service.name": "tech-ont",
      "service.namespace": "metaplatform",
      "service.instance.id": "pod-ont-7f9b-x2k4",
      "host.name": "pod-ont-7f9b-x2k4",
      "telemetry.sdk.language": "java",
      "telemetry.sdk.name": "opentelemetry",
      "telemetry.sdk.version": "2.1.0",
      "deployment.environment": "production"
    }
  },
  "instrumentationLibrary": {
    "name": "io.opentelemetry.spring-boot",
    "version": "2.1.0"
  }
}
```

#### 4.3.2 Span Kind 枚举

| 值 | 说明 |
|---|---|
| `SPAN_KIND_UNSPECIFIED` | 未指定 |
| `SPAN_KIND_INTERNAL` | 内部操作 |
| `SPAN_KIND_SERVER` | 服务端处理 |
| `SPAN_KIND_CLIENT` | 客户端调用 |
| `SPAN_KIND_PRODUCER` | 消息生产者 |
| `SPAN_KIND_CONSUMER` | 消息消费者 |

#### 4.3.3 标准 Span 属性约定

| 属性前缀 | 说明 | 示例 |
|---|---|---|
| `http.*` | HTTP 请求属性 | `http.method`, `http.url`, `http.status_code` |
| `db.*` | 数据库操作属性 | `db.system`, `db.statement`, `db.duration` |
| `messaging.*` | 消息队列属性 | `messaging.system`, `messaging.destination` |
| `rpc.*` | RPC 调用属性 | `rpc.system`, `rpc.service`, `rpc.method` |
| `tenant_id` | 租户 ID（自定义） | `t001` |
| `trace_id` | 关联 Trace ID | `a1b2c3d4e5f6789012345678abcdef00` |

---

## 5. 事件定义

TECH-OBS 通过 Kafka 3.9 发布告警事件，遵循 **Outbox 模式** 防止数据丢失，消费端支持 **DLQ**（Dead Letter Queue）重试 3 次。所有 Kafka 消息头必须包含 `X-Trace-Id`。

### 5.1 Kafka Topic 定义

| Topic | 说明 | 分区数 | 副本数 | 保留策略 |
|---|---|---|---|---|
| `metaplatform.obs.alert.fired` | 告警触发事件 | 6 | 3 | 7 天 |
| `metaplatform.obs.alert.resolved` | 告警恢复事件 | 6 | 3 | 7 天 |
| `metaplatform.obs.alert.silenced` | 告警静默事件 | 3 | 3 | 3 天 |
| `metaplatform.obs.slo.violated` | SLO 违规事件 | 3 | 3 | 30 天 |

### 5.2 告警触发事件

**Topic**: `metaplatform.obs.alert.fired`

```json
{
  "eventType": "ALERT_FIRED",
  "eventVersion": "1.0",
  "eventId": "evt-20260716080001-0001",
  "timestamp": "2026-07-16T08:00:00.123Z",
  "traceId": "a1b2c3d4e5f6789012345678abcdef00",
  "data": {
    "alertId": "alert-20260716080001",
    "ruleId": "ar-0001",
    "ruleName": "tech-ont P99 延迟告警",
    "type": "metric",
    "service": "tech-ont",
    "severity": "warning",
    "state": "firing",
    "condition": "histogram_quantile(0.99, rate(metaplatform_ont_request_duration_seconds_bucket[5m])) > 2",
    "currentValue": "2.85",
    "firedAt": "2026-07-16T07:55:00Z",
    "labels": {
      "team": "platform",
      "priority": "high",
      "service": "tech-ont"
    },
    "annotations": {
      "summary": "tech-ont P99 延迟超过 2 秒",
      "description": "最近 5 分钟 P99 延迟持续超过 2 秒，请检查服务性能",
      "runbook_url": "https://wiki.metaplatform.com/runbooks/ont-p99-latency"
    },
    "relatedTraceId": "a1b2c3d4e5f6789012345678abcdef00",
    "notificationChannels": [
      { "channelId": "nc-001", "type": "feishu", "name": "平台团队飞书群" },
      { "channelId": "nc-003", "type": "email", "name": "运维邮件组" }
    ]
  }
}
```

**Kafka 消息头**：

| Header | 值 |
|---|---|
| `X-Trace-Id` | `a1b2c3d4e5f6789012345678abcdef00` |
| `event-type` | `ALERT_FIRED` |
| `event-version` | `1.0` |
| `content-type` | `application/json` |

### 5.3 告警恢复事件

**Topic**: `metaplatform.obs.alert.resolved`

```json
{
  "eventType": "ALERT_RESOLVED",
  "eventVersion": "1.0",
  "eventId": "evt-20260716083501-0002",
  "timestamp": "2026-07-16T08:35:00.456Z",
  "traceId": "b2c3d4e5f6789012345678abcdef001",
  "data": {
    "alertId": "alert-20260716080001",
    "ruleId": "ar-0001",
    "ruleName": "tech-ont P99 延迟告警",
    "type": "metric",
    "service": "tech-ont",
    "severity": "warning",
    "state": "resolved",
    "firedAt": "2026-07-16T07:55:00Z",
    "resolvedAt": "2026-07-16T08:35:00Z",
    "duration": "40m",
    "resolvedBy": "system",
    "labels": {
      "team": "platform",
      "service": "tech-ont"
    },
    "annotations": {
      "summary": "tech-ont P99 延迟超过 2 秒",
      "description": "告警已恢复，P99 延迟已降至 1.2 秒"
    },
    "relatedTraceId": "a1b2c3d4e5f6789012345678abcdef00"
  }
}
```

### 5.4 告警静默事件

**Topic**: `metaplatform.obs.alert.silenced`

```json
{
  "eventType": "ALERT_SILENCED",
  "eventVersion": "1.0",
  "eventId": "evt-20260716080200-0003",
  "timestamp": "2026-07-16T08:02:00.789Z",
  "traceId": "c3d4e5f6789012345678abcdef002",
  "data": {
    "alertId": "alert-20260716080001",
    "ruleId": "ar-0001",
    "ruleName": "tech-ont P99 延迟告警",
    "service": "tech-ont",
    "action": "silence",
    "duration": "2h",
    "reason": "正在处理 tech-ont 性能问题，预计 2 小时内修复",
    "silencedBy": "admin",
    "silencedAt": "2026-07-16T08:00:00Z",
    "expiresAt": "2026-07-16T10:00:00Z"
  }
}
```

### 5.5 SLO 违规事件

**Topic**: `metaplatform.obs.slo.violated`

```json
{
  "eventType": "SLO_VIOLATED",
  "eventVersion": "1.0",
  "eventId": "evt-20260716081000-0004",
  "timestamp": "2026-07-16T08:10:00.123Z",
  "traceId": "d4e5f6789012345678abcdef003",
  "data": {
    "sloId": "slo-0001",
    "sloName": "tech-ont API 可用性 SLO",
    "service": "tech-ont",
    "sliType": "availability",
    "target": 99.9,
    "currentSli": 99.82,
    "window": "30d",
    "violationType": "error_budget_exhausted",
    "errorBudget": {
      "total": 4.32,
      "consumed": 4.32,
      "remaining": 0.0,
      "remainingPercentage": 0.0
    },
    "burnRate": {
      "fast": { "current": 14.2, "threshold": 2, "window": "1h", "breached": true },
      "slow": { "current": 3.1, "threshold": 25, "window": "6h", "breached": false }
    },
    "violationStartTime": "2026-07-16T07:15:00Z",
    "errorCount": 45,
    "totalRequests": 1800,
    "rootCause": "tech-ont NullPointerException in ConceptService.create",
    "relatedTraceId": "a1b2c3d4e5f6789012345678abcdef00",
    "notificationChannels": [
      { "channelId": "nc-001", "type": "feishu", "name": "平台团队飞书群" },
      { "channelId": "nc-003", "type": "email", "name": "运维邮件组" }
    ]
  }
}
```

### 5.6 Outbox 模式实现

TECH-OBS 发布 Kafka 消息遵循 **Outbox 模式**：

1. 业务操作和 Outbox 记录在同一数据库事务中写入
2. 独立的 Outbox Publisher 线程轮询 `outbox_events` 表，将未发布的事件发送到 Kafka
3. 发送成功后标记 `published_at`，避免重复发送
4. 失败消息重试 3 次后进入 DLQ（Dead Letter Queue）

```sql
CREATE TABLE outbox_events (
    id              BIGSERIAL     PRIMARY KEY,
    event_id        VARCHAR(128)  NOT NULL UNIQUE,
    aggregate_type  VARCHAR(64)   NOT NULL,    -- 聚合类型：alert / slo
    aggregate_id    VARCHAR(64)   NOT NULL,    -- 聚合 ID：alert_id / slo_id
    event_type      VARCHAR(64)   NOT NULL,    -- 事件类型：ALERT_FIRED / ALERT_RESOLVED 等
    event_version   VARCHAR(16)   NOT NULL DEFAULT '1.0',
    topic           VARCHAR(128)  NOT NULL,    -- Kafka topic
    payload         JSONB         NOT NULL,    -- 事件 payload
    trace_id        VARCHAR(64)   NOT NULL,    -- trace_id 必须传播
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    published_at    TIMESTAMPTZ,               -- 发布时间（null 表示未发布）
    retry_count     INTEGER       NOT NULL DEFAULT 0,
    max_retries     INTEGER       NOT NULL DEFAULT 3,
    status          VARCHAR(16)   NOT NULL DEFAULT 'pending', -- pending / published / failed / dlq
    next_retry_at   TIMESTAMPTZ                -- 下次重试时间
);

CREATE INDEX idx_outbox_status ON outbox_events(status, next_retry_at);
CREATE INDEX idx_outbox_aggregate ON outbox_events(aggregate_type, aggregate_id);
```

### 5.7 DLQ 处理

| 配置项 | 值 | 说明 |
|---|---|---|
| 重试次数 | 3 | 最多重试 3 次 |
| 重试间隔 | 指数退避 | 10s → 30s → 90s |
| DLQ Topic 后缀 | `.dlq` | 如 `metaplatform.obs.alert.fired.dlq` |
| DLQ 记录保留 | 30 天 | 便于故障诊断 |
| DLQ 记录必含字段 | `traceId` | 用于跨系统故障追踪 |

---

## 6. 增量交付计划

### 6.1 交付阶段总览

| 阶段 | 名称 | 时间范围 | 交付内容 | 依赖 |
|---|---|---|---|---|
| P0 | 基础设施搭建 | 第 1-2 周 | OpenTelemetry Collector + Prometheus + Loki + Jaeger 部署，基础采集管道 | K8s 集群就绪 |
| P1 | 日志管理 | 第 3-4 周 | 3.1 日志管理 API 全部接口 | P0 完成 |
| P2 | 指标管理 | 第 5-6 周 | 3.2 指标管理 API 全部接口 | P0 完成 |
| P3 | 链路追踪 | 第 7-8 周 | 3.3 链路追踪 API 全部接口 | P0 完成 |
| P4 | 告警管理 | 第 9-10 周 | 3.4 告警管理 API + Kafka 事件 + Outbox | P1/P2/P3 完成 |
| P5 | 仪表板管理 | 第 11-12 周 | 3.5 仪表板管理 API + Grafana 集成 | P2 完成 |
| P6 | 服务地图 | 第 13-14 周 | 3.6 服务地图 API | P2/P3 完成 |
| P7 | SLO 管理 | 第 15-16 周 | 3.7 SLO 管理 API 全部接口 | P2/P4 完成 |

### 6.2 P0 - 基础设施搭建（第 1-2 周）

**交付目标**：完成可观测性基础组件部署与数据采集管道搭建。

| 交付项 | 说明 |
|---|---|
| OpenTelemetry Collector 部署 | 部署 Collector，配置 OTLP 接收器和 Prometheus/Loki/Jaeger 导出器 |
| Prometheus 3.x 部署 | 部署 Prometheus + Alertmanager，配置 scrape_configs |
| Loki 3.x 部署 | 部署 Loki + Vector 日志管道 |
| Jaeger 1.62 部署 | 部署 Jaeger，配置 OTLP 协议接收 |
| Grafana 11.x 部署 | 部署 Grafana，配置数据源（Prometheus / Loki / Jaeger） |
| Java Agent 注入 | 为所有 Java 服务注入 OpenTelemetry Java Agent 2.x |
| Python SDK 集成 | 为所有 Python 服务集成 OpenTelemetry Python SDK |
| trace_id 传播验证 | 验证 trace_id 在 HTTP / Kafka 间正确传播 |

### 6.3 P1 - 日志管理（第 3-4 周）

**交付目标**：实现日志查询、搜索、级别管理和日志告警规则。

| API | 优先级 | 交付项 |
|---|---|---|
| 3.1.1 日志查询 | P1 | POST `/api/v1/obs/logs/query` |
| 3.1.2 日志全文搜索 | P1 | POST `/api/v1/obs/logs/search` |
| 3.1.3 日志级别动态管理 | P2 | PUT `/api/v1/obs/logs/level` |
| 3.1.4 查询日志级别配置 | P2 | GET `/api/v1/obs/logs/level` |
| 3.1.5 日志聚合统计 | P2 | POST `/api/v1/obs/logs/aggregate` |
| 3.1.6 日志告警规则创建 | P3 | POST `/api/v1/obs/logs/alert-rules` |
| 3.1.7 日志告警规则列表 | P3 | GET `/api/v1/obs/logs/alert-rules` |
| 3.1.8 日志告警规则更新 | P3 | PUT `/api/v1/obs/logs/alert-rules/{ruleId}` |
| 3.1.9 日志告警规则删除 | P3 | DELETE `/api/v1/obs/logs/alert-rules/{ruleId}` |

### 6.4 P2 - 指标管理（第 5-6 周）

**交付目标**：实现自定义指标注册、PromQL 查询和指标元数据管理。

| API | 优先级 | 交付项 |
|---|---|---|
| 3.2.1 自定义指标注册 | P1 | POST `/api/v1/obs/metrics/register` |
| 3.2.2 指标查询（PromQL） | P1 | POST `/api/v1/obs/metrics/query` |
| 3.2.3 指标列表查询 | P1 | GET `/api/v1/obs/metrics` |
| 3.2.4 指标元数据详情 | P2 | GET `/api/v1/obs/metrics/{metricId}` |
| 3.2.5 指标采集配置 | P2 | PUT `/api/v1/obs/metrics/{metricId}/scrape-config` |
| 3.2.6 指标删除 | P2 | DELETE `/api/v1/obs/metrics/{metricId}` |

### 6.5 P3 - 链路追踪（第 7-8 周）

**交付目标**：实现 Trace 查询、Span 详情、调用拓扑图和服务依赖查询。

| API | 优先级 | 交付项 |
|---|---|---|
| 3.3.1 Trace 查询 | P1 | POST `/api/v1/obs/traces/query` |
| 3.3.2 Trace 详情 | P1 | GET `/api/v1/obs/traces/{traceId}` |
| 3.3.3 Span 详情 | P1 | GET `/api/v1/obs/traces/{traceId}/spans/{spanId}` |
| 3.3.4 调用拓扑图 | P2 | GET `/api/v1/obs/traces/{traceId}/topology` |
| 3.3.5 服务依赖查询 | P2 | GET `/api/v1/obs/traces/dependencies` |

### 6.6 P4 - 告警管理（第 9-10 周）

**交付目标**：实现统一告警规则 CRUD、告警列表、通知渠道管理、Silenced/恢复和告警历史，接入 Kafka 事件和 Outbox 模式。

| API | 优先级 | 交付项 |
|---|---|---|
| 3.4.1 创建告警规则 | P1 | POST `/api/v1/obs/alerts/rules` |
| 3.4.2 告警规则列表 | P1 | GET `/api/v1/obs/alerts/rules` |
| 3.4.3 告警规则详情 | P1 | GET `/api/v1/obs/alerts/rules/{ruleId}` |
| 3.4.4 更新告警规则 | P1 | PUT `/api/v1/obs/alerts/rules/{ruleId}` |
| 3.4.5 删除告警规则 | P1 | DELETE `/api/v1/obs/alerts/rules/{ruleId}` |
| 3.4.6 告警列表查询 | P1 | GET `/api/v1/obs/alerts` |
| 3.4.7 通知渠道创建 | P2 | POST `/api/v1/obs/alerts/notification-channels` |
| 3.4.8 通知渠道列表 | P2 | GET `/api/v1/obs/alerts/notification-channels` |
| 3.4.9 通知渠道更新 | P2 | PUT `/api/v1/obs/alerts/notification-channels/{channelId}` |
| 3.4.10 通知渠道删除 | P2 | DELETE `/api/v1/obs/alerts/notification-channels/{channelId}` |
| 3.4.11 告警 Silenced | P2 | POST `/api/v1/obs/alerts/{alertId}/silence` |
| 3.4.12 告警恢复 | P2 | POST `/api/v1/obs/alerts/{alertId}/unsilence` |
| 3.4.13 告警历史查询 | P3 | GET `/api/v1/obs/alerts/history` |
| Kafka 事件 | P1 | Outbox + 4 个 Topic + DLQ |

### 6.7 P5 - 仪表板管理（第 11-12 周）

**交付目标**：实现自定义仪表板 CRUD、面板组件配置、分享和导出，集成 Grafana。

| API | 优先级 | 交付项 |
|---|---|---|
| 3.5.1 创建仪表板 | P1 | POST `/api/v1/obs/dashboards` |
| 3.5.2 仪表板列表 | P1 | GET `/api/v1/obs/dashboards` |
| 3.5.3 仪表板详情 | P1 | GET `/api/v1/obs/dashboards/{dashboardId}` |
| 3.5.4 更新仪表板 | P1 | PUT `/api/v1/obs/dashboards/{dashboardId}` |
| 3.5.5 删除仪表板 | P1 | DELETE `/api/v1/obs/dashboards/{dashboardId}` |
| 3.5.6 添加面板组件 | P2 | POST `/api/v1/obs/dashboards/{dashboardId}/panels` |
| 3.5.7 更新面板组件 | P2 | PUT `/api/v1/obs/dashboards/{dashboardId}/panels/{panelId}` |
| 3.5.8 删除面板组件 | P2 | DELETE `/api/v1/obs/dashboards/{dashboardId}/panels/{panelId}` |
| 3.5.9 仪表板分享 | P3 | POST `/api/v1/obs/dashboards/{dashboardId}/share` |
| 3.5.10 仪表板导出 | P3 | GET `/api/v1/obs/dashboards/{dashboardId}/export` |

### 6.8 P6 - 服务地图（第 13-14 周）

**交付目标**：实现服务拓扑图、服务健康状态和服务依赖查询。

| API | 优先级 | 交付项 |
|---|---|---|
| 3.6.1 服务拓扑图 | P1 | GET `/api/v1/obs/service-map/topology` |
| 3.6.2 服务健康状态 | P1 | GET `/api/v1/obs/service-map/health` |
| 3.6.3 服务依赖查询 | P2 | GET `/api/v1/obs/service-map/{service}/dependencies` |

### 6.9 P7 - SLO 管理（第 15-16 周）

**交付目标**：实现 SLO 定义 CRUD、错误预算查询、SLI 查询和 SLO 报告。

| API | 优先级 | 交付项 |
|---|---|---|
| 3.7.1 创建 SLO 定义 | P1 | POST `/api/v1/obs/slos` |
| 3.7.2 SLO 列表查询 | P1 | GET `/api/v1/obs/slos` |
| 3.7.3 SLO 详情 | P1 | GET `/api/v1/obs/slos/{sloId}` |
| 3.7.4 更新 SLO | P1 | PUT `/api/v1/obs/slos/{sloId}` |
| 3.7.5 删除 SLO | P1 | DELETE `/api/v1/obs/slos/{sloId}` |
| 3.7.6 错误预算查询 | P2 | GET `/api/v1/obs/slos/{sloId}/error-budget` |
| 3.7.7 SLI 查询 | P2 | GET `/api/v1/obs/slos/{sloId}/sli` |
| 3.7.8 SLO 报告 | P3 | GET `/api/v1/obs/slos/{sloId}/report` |

### 6.10 API 接口统计

| 领域 | API 数量 | P1 优先级 | P2 优先级 | P3 优先级 |
|---|---|---|---|---|
| 日志管理 | 9 | 2 | 3 | 4 |
| 指标管理 | 6 | 3 | 3 | 0 |
| 链路追踪 | 5 | 3 | 2 | 0 |
| 告警管理 | 13 | 6 | 6 | 1 |
| 仪表板管理 | 10 | 5 | 3 | 2 |
| 服务地图 | 3 | 2 | 1 | 0 |
| SLO 管理 | 8 | 5 | 2 | 1 |
| **合计** | **54** | **26** | **20** | **8** |

### 6.11 里程碑

| 里程碑 | 时间 | 验收标准 |
|---|---|---|
| M1: 基础设施就绪 | 第 2 周末 | 所有服务自动上报 Metrics/Logs/Traces，Grafana 可展示 |
| M2: 日志+指标可用 | 第 6 周末 | 日志查询/搜索 + PromQL 查询通过验收测试 |
| M3: 全链路可观测 | 第 8 周末 | Trace 查询 + 调用拓扑 + 服务依赖通过验收测试 |
| M4: 告警体系就绪 | 第 10 周末 | 告警规则 CRUD + Kafka 事件 + 通知渠道 + DLQ 通过验收 |
| M5: 仪表板+服务地图 | 第 14 周末 | 仪表板 CRUD + 服务拓扑图 + 健康状态通过验收 |
| M6: SLO 体系完成 | 第 16 周末 | SLO CRUD + 错误预算 + SLI + SLO 报告通过验收 |

---

## 附录

### A. API 接口完整索引

| 序号 | 方法 | 路径 | 所属章节 |
|---|---|---|---|
| 1 | POST | `/api/v1/obs/logs/query` | 3.1.1 |
| 2 | POST | `/api/v1/obs/logs/search` | 3.1.2 |
| 3 | PUT | `/api/v1/obs/logs/level` | 3.1.3 |
| 4 | GET | `/api/v1/obs/logs/level` | 3.1.4 |
| 5 | POST | `/api/v1/obs/logs/aggregate` | 3.1.5 |
| 6 | POST | `/api/v1/obs/logs/alert-rules` | 3.1.6 |
| 7 | GET | `/api/v1/obs/logs/alert-rules` | 3.1.7 |
| 8 | PUT | `/api/v1/obs/logs/alert-rules/{ruleId}` | 3.1.8 |
| 9 | DELETE | `/api/v1/obs/logs/alert-rules/{ruleId}` | 3.1.9 |
| 10 | POST | `/api/v1/obs/metrics/register` | 3.2.1 |
| 11 | POST | `/api/v1/obs/metrics/query` | 3.2.2 |
| 12 | GET | `/api/v1/obs/metrics` | 3.2.3 |
| 13 | GET | `/api/v1/obs/metrics/{metricId}` | 3.2.4 |
| 14 | PUT | `/api/v1/obs/metrics/{metricId}/scrape-config` | 3.2.5 |
| 15 | DELETE | `/api/v1/obs/metrics/{metricId}` | 3.2.6 |
| 16 | POST | `/api/v1/obs/traces/query` | 3.3.1 |
| 17 | GET | `/api/v1/obs/traces/{traceId}` | 3.3.2 |
| 18 | GET | `/api/v1/obs/traces/{traceId}/spans/{spanId}` | 3.3.3 |
| 19 | GET | `/api/v1/obs/traces/{traceId}/topology` | 3.3.4 |
| 20 | GET | `/api/v1/obs/traces/dependencies` | 3.3.5 |
| 21 | POST | `/api/v1/obs/alerts/rules` | 3.4.1 |
| 22 | GET | `/api/v1/obs/alerts/rules` | 3.4.2 |
| 23 | GET | `/api/v1/obs/alerts/rules/{ruleId}` | 3.4.3 |
| 24 | PUT | `/api/v1/obs/alerts/rules/{ruleId}` | 3.4.4 |
| 25 | DELETE | `/api/v1/obs/alerts/rules/{ruleId}` | 3.4.5 |
| 26 | GET | `/api/v1/obs/alerts` | 3.4.6 |
| 27 | POST | `/api/v1/obs/alerts/notification-channels` | 3.4.7 |
| 28 | GET | `/api/v1/obs/alerts/notification-channels` | 3.4.8 |
| 29 | PUT | `/api/v1/obs/alerts/notification-channels/{channelId}` | 3.4.9 |
| 30 | DELETE | `/api/v1/obs/alerts/notification-channels/{channelId}` | 3.4.10 |
| 31 | POST | `/api/v1/obs/alerts/{alertId}/silence` | 3.4.11 |
| 32 | POST | `/api/v1/obs/alerts/{alertId}/unsilence` | 3.4.12 |
| 33 | GET | `/api/v1/obs/alerts/history` | 3.4.13 |
| 34 | POST | `/api/v1/obs/dashboards` | 3.5.1 |
| 35 | GET | `/api/v1/obs/dashboards` | 3.5.2 |
| 36 | GET | `/api/v1/obs/dashboards/{dashboardId}` | 3.5.3 |
| 37 | PUT | `/api/v1/obs/dashboards/{dashboardId}` | 3.5.4 |
| 38 | DELETE | `/api/v1/obs/dashboards/{dashboardId}` | 3.5.5 |
| 39 | POST | `/api/v1/obs/dashboards/{dashboardId}/panels` | 3.5.6 |
| 40 | PUT | `/api/v1/obs/dashboards/{dashboardId}/panels/{panelId}` | 3.5.7 |
| 41 | DELETE | `/api/v1/obs/dashboards/{dashboardId}/panels/{panelId}` | 3.5.8 |
| 42 | POST | `/api/v1/obs/dashboards/{dashboardId}/share` | 3.5.9 |
| 43 | GET | `/api/v1/obs/dashboards/{dashboardId}/export` | 3.5.10 |
| 44 | GET | `/api/v1/obs/service-map/topology` | 3.6.1 |
| 45 | GET | `/api/v1/obs/service-map/health` | 3.6.2 |
| 46 | GET | `/api/v1/obs/service-map/{service}/dependencies` | 3.6.3 |
| 47 | POST | `/api/v1/obs/slos` | 3.7.1 |
| 48 | GET | `/api/v1/obs/slos` | 3.7.2 |
| 49 | GET | `/api/v1/obs/slos/{sloId}` | 3.7.3 |
| 50 | PUT | `/api/v1/obs/slos/{sloId}` | 3.7.4 |
| 51 | DELETE | `/api/v1/obs/slos/{sloId}` | 3.7.5 |
| 52 | GET | `/api/v1/obs/slos/{sloId}/error-budget` | 3.7.6 |
| 53 | GET | `/api/v1/obs/slos/{sloId}/sli` | 3.7.7 |
| 54 | GET | `/api/v1/obs/slos/{sloId}/report` | 3.7.8 |

---

> **文档结束** | SPEC-TECH-OBS-可观测性API规范 v1.0 | 2026-07-16