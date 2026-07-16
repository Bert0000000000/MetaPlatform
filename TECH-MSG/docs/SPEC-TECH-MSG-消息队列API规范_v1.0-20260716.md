# SPEC - 消息队列服务 API 规范（TECH-MSG）

| 字段 | 值 |
|---|---|
| 文档类型 | SPEC（规范与接口） |
| 模块 | TECH-MSG（消息队列服务） |
| 版本 | v1.0 |
| 日期 | 2026-07-16 |
| 状态 | Draft |
| 作者 | Meta Platform Team |

---

## 目录

- [1. 服务概述](#1-服务概述)
- [2. 通用约定](#2-通用约定)
- [3. API 接口详情](#3-api-接口详情)
  - [3.1 Topic/Queue 管理 API](#31-topicqueue-管理-api)
  - [3.2 消息发布 API](#32-消息发布-api)
  - [3.3 消息订阅 API](#33-消息订阅-api)
  - [3.4 DLQ 管理 API](#34-dlq-管理-api)
  - [3.5 消息追踪 API](#35-消息追踪-api)
  - [3.6 监控统计 API](#36-监控统计-api)
  - [3.7 Outbox 管理 API](#37-outbox-管理-api)
- [4. 数据模型](#4-数据模型)
- [5. 事件定义](#5-事件定义)
- [6. 增量交付计划](#6-增量交付计划)

---

## 1. 服务概述

### 1.1 定位

TECH-MSG 是 Mate Platform 的消息队列统一管理基座，为平台内所有微服务提供可靠的消息发布与订阅能力。服务封装了 Kafka 3.9（高吞吐事件流）与 RabbitMQ 4.x（低延迟工作队列）两套消息中间件，对上层提供统一的 RESTful API，屏蔽底层中间件差异。

核心职责：

| 编号 | 职责 | 说明 |
|---|---|---|
| 1 | Topic/Queue 管理 | Kafka Topic 创建/配置/监控、RabbitMQ Exchange/Queue 创建/配置/监控 |
| 2 | 消息发布 | 统一消息发布接口、Outbox 模式管理、消息确认查询 |
| 3 | 消息订阅 | 消费者组管理、订阅配置、消息消费确认、偏移量管理 |
| 4 | DLQ 管理 | 死信队列查看、重试策略配置、死信消息重发、DLQ 清理 |
| 5 | 消息追踪 | 基于 trace_id 的消息全链路追踪、消息搜索、消息详情 |
| 6 | 监控统计 | Topic/Queue 流量统计、延迟监控、积压告警、消费者 Lag |
| 7 | Outbox 管理 | Outbox 表管理、投递状态查询、Outbox 重投、Outbox 清理 |

### 1.2 技术栈

| 组件 | 版本 | 用途 |
|---|---|---|
| Java | 21 | 运行时 |
| Spring Boot | 3.4 | 应用框架 |
| Spring Kafka | 3.3 | Kafka 客户端 |
| Spring AMQP | 3.2 | RabbitMQ 客户端 |
| Kafka | 3.9 | 高吞吐事件流中间件 |
| RabbitMQ | 4.x | 低延迟工作队列中间件 |
| PostgreSQL | 17 | Outbox 表 / DLQ 记录表 / 配置元数据存储 |
| Redis | 7.4 | 消息幂等去重 / 限流 / 缓存 |

### 1.3 上游依赖

| 上游 | 依赖关系 | 说明 |
|---|---|---|
| 所有平台微服务 | 通过 Outbox 模式发布消息 | 业务服务将消息写入本地 Outbox 表，TECH-MSG 轮询投递至 Kafka/RabbitMQ |
| TECH-IAM | 认证与鉴权 | API 请求需携带 JWT Token，TECH-MSG 校验调用方权限 |
| TECH-OBS | 可观测性 | 上报 Metrics、Trace、Log 至可观测性平台 |
| infra/K8s | 基础设施 | 服务部署在 Kubernetes 上，通过 ConfigMap/Secret 注入中间件连接配置 |

### 1.4 下游消费

| 下游 | 消费关系 | 说明 |
|---|---|---|
| Kafka 3.9 集群 | TCP 连接 | 通过 Bootstrap Servers 连接，执行 Topic 管理、消息生产/消费 |
| RabbitMQ 4.x 集群 | AMQP 连接 | 通过 AMQP URI 连接，执行 Exchange/Queue 管理、消息生产/消费 |
| PostgreSQL | JDBC 连接 | 存储 Outbox 记录、DLQ 记录、Topic/Queue 配置元数据 |
| Redis 7.4 | Lettuce 连接 | 消息幂等去重（SETNX）、发布限流（令牌桶）、消费者心跳缓存 |

### 1.5 架构上下文图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Meta Platform 微服务层                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ │
│  │TECH-ONT │  │TECH-WFE │  │TECH-RAG │  │TECH-DATA│  │  ...   │ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └───┬────┘ │
│       │            │            │            │            │      │
│       │  ① 写入本地 Outbox 表 (PostgreSQL)                     │      │
└───────┼────────────┼────────────┼────────────┼────────────┼──────┘
        │            │            │            │            │
        ▼            ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TECH-MSG 消息队列服务                         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Outbox Relay │  │  DLQ Handler │  │  Consumer Manager    │   │
│  │ (轮询投递)    │  │ (重试3次→DLQ) │  │ (消费者组生命周期)    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                     │               │
│  ┌──────┴─────────────────┴─────────────────────┴───────────┐   │
│  │            统一消息发布/订阅 API (/api/v1/msg)             │   │
│  └──────┬─────────────────┬─────────────────────┬───────────┘   │
│         │                 │                     │               │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────────┴──────────┐   │
│  │ trace_id 传播 │  │ Redis 幂等    │  │ PostgreSQL 元数据    │   │
│  │ (消息头)      │  │ 去重/限流     │  │ (Outbox/DLQ/Config)  │   │
│  └──────────────┘  └──────────────┘  └─────────────────────┘   │
└───────────┬─────────────────┬─────────────────────────────────────┘
            │                 │
            ▼                 ▼
    ┌──────────────┐  ┌──────────────┐
    │  Kafka 3.9   │  │ RabbitMQ 4.x │
    │  (事件流)     │  │ (工作队列)    │
    └──────────────┘  └──────────────┘
```

---

## 2. 通用约定

### 2.1 API 路径前缀

所有 API 路径统一前缀：`/api/v1/msg`

完整路径示例：`/api/v1/msg/topics`

### 2.2 统一响应体

所有 API 响应采用统一的 JSON 结构：

```json
{
  "code": 0,
  "message": "success",
  "data": { },
  "traceId": "trace-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | integer | 业务状态码，`0` 表示成功，非 `0` 表示失败 |
| `message` | string | 状态描述信息 |
| `data` | object/array/null | 业务数据，失败时为 `null` |
| `traceId` | string | 请求链路追踪 ID，与请求头 `X-Trace-Id` 一致 |

分页响应 `data` 结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [ ],
    "total": 100,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "trace-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### 2.3 认证

所有 API 请求需携带 JWT Token：

```
Authorization: Bearer <jwt_token>
X-Trace-Id: trace-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

| 请求头 | 必填 | 说明 |
|---|---|---|
| `Authorization` | 是 | `Bearer <jwt_token>`，由 TECH-IAM 签发 |
| `X-Trace-Id` | 否 | 链路追踪 ID，未传则服务端自动生成 |
| `Content-Type` | 是 | `application/json`（POST/PUT 请求） |
| `Accept` | 否 | `application/json` |

### 2.4 错误码

| code | HTTP Status | 含义 | 说明 |
|---|---|---|---|
| `0` | 200 | 成功 | 请求处理成功 |
| `40001` | 400 | 参数校验失败 | 请求参数不合法 |
| `40004` | 404 | 资源不存在 | Topic/Queue/ConsumerGroup 等资源未找到 |
| `40009` | 409 | 资源冲突 | Topic/Queue 已存在、消费者组已存在 |
| `40301` | 403 | 未认证 | 缺少或无效的 JWT Token |
| `40302` | 403 | 无权限 | 当前用户无权操作该资源 |
| `40901` | 409 | 状态冲突 | 资源状态不允许当前操作（如 Topic 正在被删除时创建消息） |
| `42901` | 429 | 限流 | 请求频率超过限流阈值 |
| `50001` | 500 | 中间件异常 | Kafka/RabbitMQ 连接或操作失败 |
| `50002` | 500 | Outbox 投递失败 | Outbox 消息投递至中间件失败 |
| `50003` | 500 | 数据库异常 | PostgreSQL/Redis 操作失败 |
| `50301` | 503 | 服务不可用 | 中间件不可用、服务降级中 |

错误响应示例：

```json
{
  "code": 40004,
  "message": "Topic not found: order-events",
  "data": null,
  "traceId": "trace-a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### 2.5 trace_id 传播规则

**传播链路**：

```
HTTP 请求 (X-Trace-Id)
    → TECH-MSG 处理
        → Outbox 表记录 (trace_id 字段)
            → Kafka 消息头 (headers: X-Trace-Id)
            / RabbitMQ 消息属性 (properties.headers: X-Trace-Id)
                → 消费者消费消息
                    → 消费者日志/Span (trace_id)
                    → 消费失败 → DLQ 记录 (trace_id 字段)
                        → DLQ 重发 → 新消息头携带原始 trace_id
```

**规则**：

1. 请求未携带 `X-Trace-Id` 时，TECH-MSG 自动生成 UUID 格式的 traceId
2. Outbox 表中每条记录必须包含 `trace_id` 字段，值来源于写入 Outbox 时的请求 `X-Trace-Id`
3. Outbox Relay 投递消息至 Kafka 时，必须将 `trace_id` 写入 Kafka 消息头 `X-Trace-Id`
4. Outbox Relay 投递消息至 RabbitMQ 时，必须将 `trace_id` 写入 AMQP 消息属性 `headers.X-Trace-Id`
5. DLQ 记录必须包含 `traceId` 字段，值为原始消息的 trace_id
6. DLQ 重发消息时，必须保留原始 `trace_id`，同时生成新的 `retryTraceId` 用于本次重发链路追踪
7. 所有日志输出必须包含 `traceId` 字段，使用 MDC（Mapped Diagnostic Context）实现

### 2.6 Outbox 模式说明

#### 2.6.1 模式概述

Outbox 模式是一种保证数据库事务与消息发布原子性的可靠消息方案。业务服务在本地数据库事务中同时写入业务数据和 Outbox 记录，TECH-MSG 的 Outbox Relay 组件异步轮询 Outbox 表，将未投递的消息投递至 Kafka/RabbitMQ。

**解决的问题**：

- 业务事务与消息发布的原子性（不使用分布式事务）
- 消息不丢失（数据库持久化保证）
- 消息不重复（幂等投递 + 幂等消费）
- 消息可追溯（Outbox 表记录完整投递链路）

#### 2.6.2 工作流程

```
┌──────────────────────────────────────────────────────────────────┐
│ 业务服务 (如 TECH-ONT)                                            │
│                                                                  │
│  BEGIN TRANSACTION                                               │
│    ① INSERT INTO business_table (...) VALUES (...)               │
│    ② INSERT INTO msg_outbox                                     │
│         (id, aggregate_id, topic, payload, trace_id, ...)       │
│         VALUES (...)                                             │
│  COMMIT TRANSACTION                                              │
│                                                                  │
│  ③ 返回业务响应 (不等消息投递)                                     │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│ TECH-MSG - Outbox Relay (定时轮询, 默认 500ms)                    │
│                                                                  │
│  ④ SELECT * FROM msg_outbox WHERE status = 'PENDING'             │
│     ORDER BY created_at ASC LIMIT 100 FOR UPDATE SKIP LOCKED     │
│                                                                  │
│  ⑤ UPDATE msg_outbox SET status = 'PROCESSING'                  │
│     WHERE id IN (...)                                            │
│                                                                  │
│  ⑥ 投递至 Kafka / RabbitMQ (消息头携带 X-Trace-Id)               │
│                                                                  │
│  ⑦ 成功: UPDATE msg_outbox SET status = 'DELIVERED',            │
│         delivered_at = NOW()                                     │
│     失败: UPDATE msg_outbox SET status = 'FAILED',              │
│         retry_count = retry_count + 1,                          │
│         last_error = '...'                                      │
│         (retry_count >= max_retries → status = 'DEAD')          │
└──────────────────────────────────────────────────────────────────┘
```

#### 2.6.3 Outbox 状态机

```
PENDING ──→ PROCESSING ──→ DELIVERED (终态)
                │
                ├──→ FAILED (retry_count < max_retries, 回到 PENDING)
                │
                └──→ DEAD (retry_count >= max_retries, 进入 DLQ)
```

| 状态 | 说明 |
|---|---|
| `PENDING` | 待投递，Outbox Relay 尚未处理 |
| `PROCESSING` | 投递中，Outbox Relay 正在投递至中间件 |
| `DELIVERED` | 已投递成功，消息已发送至 Kafka/RabbitMQ |
| `FAILED` | 投递失败，等待重试（retry_count < max_retries） |
| `DEAD` | 投递失败且超过最大重试次数，已进入 DLQ |

#### 2.6.4 幂等保证

- **写入幂等**：Outbox 表 `id` 字段为业务生成的 UUID，重复写入会因唯一约束失败
- **投递幂等**：Outbox Relay 使用 `SELECT FOR UPDATE SKIP LOCKED` 确保同一消息不被多个 Relay 实例同时投递
- **消费幂等**：消费者侧需基于 `messageId`（Outbox `id`）做幂等去重，Redis SETNX `msg:consumed:{messageId}` TTL 24h

### 2.7 DLQ 机制说明

#### 2.7.1 机制概述

DLQ（Dead Letter Queue，死信队列）用于存储消费失败且重试超过最大次数的消息，确保 poison pill 消息不会阻塞正常消费，同时提供人工干预和重发能力。

#### 2.7.2 Kafka DLQ 流程

Kafka 本身不原生支持 DLQ，TECH-MSG 通过消费者侧实现：

```
消费者拉取消息
    → 业务处理
        → 成功: commit offset
        → 失败:
            → retry_count < 3: 重试 (延迟递增: 1s, 5s, 30s)
            → retry_count >= 3: 消息写入 DLQ Topic ({original-topic}.dlq)
                              → 记录 DLQ 元数据到 PostgreSQL (msg_dlq_records)
                              → commit offset (跳过该消息)
```

**Kafka DLQ Topic 命名规则**：`{original-topic}.dlq`
- 原始 Topic: `order-events` → DLQ Topic: `order-events.dlq`
- DLQ Topic 分区数与原始 Topic 一致
- DLQ Topic 保留策略: 7 天（可配置）

#### 2.7.3 RabbitMQ DLQ 流程

RabbitMQ 原生支持 DLX（Dead Letter Exchange）：

```
RabbitMQ Queue 配置 x-dead-letter-exchange
    → 消息被 reject/nack 且 requeue=false
        → 自动路由到 DLX
            → DLX 绑定到 DLQ
                → TECH-MSG 监听 DLQ，记录元数据到 PostgreSQL
```

**RabbitMQ DLQ 命名规则**：
- DLX: `{original-exchange}.dlx`
- DLQ: `{original-queue}.dlq`
- DLQ Routing Key: 与原始 Queue 的 Routing Key 一致

#### 2.7.4 重试策略

| 重试次数 | 延迟时间 | 实现方式 |
|---|---|---|
| 第 1 次 | 1 秒 | Kafka: 消费者暂停后重试 / RabbitMQ: TTL + DLX 回环 |
| 第 2 次 | 5 秒 | 同上 |
| 第 3 次 | 30 秒 | 同上 |
| 超过 3 次 | - | 进入 DLQ，不再自动重试 |

**Kafka 重试实现**：消费者在重试间隔内不 commit offset，等待延迟后重新处理。超过最大重试次数后写入 DLQ Topic 并 commit offset。

**RabbitMQ 重试实现**：使用 TTL + DLX 回环模式。消息被 nack 后路由到延迟队列 `{queue}.retry.{delay}`，TTL 过期后通过 DLX 回环到原始队列。

#### 2.7.5 DLQ 记录字段

每条 DLQ 记录必须包含以下字段（存储在 PostgreSQL `msg_dlq_records` 表）：

| 字段 | 说明 | 必填 |
|---|---|---|
| `traceId` | 原始消息的 trace_id | 是 |
| `originalTopic` | 原始 Topic/Exchange | 是 |
| `originalPartition` | 原始分区（Kafka） | Kafka 消息必填 |
| `originalOffset` | 原始偏移量（Kafka） | Kafka 消息必填 |
| `originalQueue` | 原始队列（RabbitMQ） | RabbitMQ 消息必填 |
| `originalRoutingKey` | 原始路由键（RabbitMQ） | RabbitMQ 消息必填 |
| `messageId` | 消息唯一 ID（Outbox id） | 是 |
| `payload` | 消息原始内容 | 是 |
| `headers` | 消息头（JSON） | 是 |
| `errorMessage` | 最后一次失败的错误信息 | 是 |
| `errorStack` | 错误堆栈 | 否 |
| `retryCount` | 已重试次数 | 是 |
| `deadAt` | 进入 DLQ 的时间 | 是 |

---

## 3. API 接口详情

### 3.1 Topic/Queue 管理 API

#### 3.1.1 创建 Kafka Topic

**POST** `/api/v1/msg/topics/kafka`

创建 Kafka Topic，支持自定义分区数和保留策略。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `name` | body | string | 是 | - | Topic 名称，符合 `[a-zA-Z0-9._-]` 规则，长度 1-249 |
| `partitions` | body | integer | 是 | - | 分区数，1-10000 |
| `replicationFactor` | body | integer | 否 | 集群最小副本数 | 副本因子，1-集群 Broker 数 |
| `replicasAssignments` | body | object | 否 | - | 手动指定分区-副本分配，与 partitions/replicationFactor 互斥 |
| `configs` | body | object | 否 | - | Topic 级配置项 |
| `configs.retentionMs` | body | long | 否 | 604800000 (7天) | 消息保留时间（毫秒） |
| `configs.retentionBytes` | body | long | 否 | -1 (不限) | 消息保留大小（字节） |
| `configs.maxMessageBytes` | body | integer | 否 | 1048588 (1MB) | 单条消息最大字节数 |
| `configs.segmentBytes` | body | integer | 否 | 1073741824 (1GB) | Segment 文件大小 |
| `configs.cleanupPolicy` | body | string | 否 | `delete` | 清理策略: `delete` / `compact` / `delete,compact` |
| `configs.compressionType` | body | string | 否 | `producer` | 压缩类型: `none` / `gzip` / `snappy` / `lz4` / `zstd` / `producer` |
| `description` | body | string | 否 | - | Topic 描述 |
| `owner` | body | string | 否 | - | 负责人/团队 |

**请求示例**

```json
{
  "name": "order-events",
  "partitions": 6,
  "replicationFactor": 3,
  "configs": {
    "retentionMs": 2592000000,
    "cleanupPolicy": "delete",
    "compressionType": "lz4"
  },
  "description": "订单领域事件流",
  "owner": "tech-ont"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "order-events",
    "partitions": 6,
    "replicationFactor": 3,
    "configs": {
      "retentionMs": "2592000000",
      "cleanupPolicy": "delete",
      "compressionType": "lz4"
    },
    "description": "订单领域事件流",
    "owner": "tech-ont",
    "createdAt": "2026-07-16T10:30:00.000Z",
    "createdBy": "admin@metaplatform.com"
  },
  "traceId": "trace-a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | Topic 名称不合法、分区数超出范围 |
| `40009` | Topic 已存在 |
| `40302` | 无创建 Topic 权限 |
| `50001` | Kafka 集群不可用 |
| `50301` | Kafka 集群连接失败 |

---

#### 3.1.2 查询 Kafka Topic 列表

**GET** `/api/v1/msg/topics/kafka`

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `name` | query | string | 否 | - | Topic 名称模糊匹配 |
| `page` | query | integer | 否 | 1 | 页码 |
| `pageSize` | query | integer | 否 | 20 | 每页条数，最大 100 |
| `sortBy` | query | string | 否 | `name` | 排序字段: `name` / `partitions` / `createdAt` |
| `sortOrder` | query | string | 否 | `asc` | 排序方向: `asc` / `desc` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "name": "order-events",
        "partitions": 6,
        "replicationFactor": 3,
        "configs": {
          "retentionMs": "2592000000",
          "cleanupPolicy": "delete"
        },
        "description": "订单领域事件流",
        "owner": "tech-ont",
        "createdAt": "2026-07-16T10:30:00.000Z"
      },
      {
        "name": "user-events",
        "partitions": 3,
        "replicationFactor": 3,
        "configs": {
          "retentionMs": "604800000",
          "cleanupPolicy": "delete"
        },
        "description": "用户领域事件流",
        "owner": "tech-iam",
        "createdAt": "2026-07-15T08:00:00.000Z"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "trace-b2c3d4e5-f6a7-8901-bcde-f23456789012"
}
```

---

#### 3.1.3 查询 Kafka Topic 详情

**GET** `/api/v1/msg/topics/kafka/{name}`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | string | Topic 名称 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "order-events",
    "partitions": 6,
    "replicationFactor": 3,
    "replicasAssignments": {
      "0": [1, 2, 3],
      "1": [2, 3, 4],
      "2": [3, 4, 5],
      "3": [4, 5, 1],
      "4": [5, 1, 2],
      "5": [1, 3, 5]
    },
    "configs": {
      "retentionMs": "2592000000",
      "retentionBytes": "-1",
      "maxMessageBytes": "1048588",
      "segmentBytes": "1073741824",
      "cleanupPolicy": "delete",
      "compressionType": "lz4"
    },
    "description": "订单领域事件流",
    "owner": "tech-ont",
    "createdAt": "2026-07-16T10:30:00.000Z",
    "createdBy": "admin@metaplatform.com",
    "partitionDetails": [
      {
        "partition": 0,
        "leader": 1,
        "replicas": [1, 2, 3],
        "isr": [1, 2, 3],
        "earliestOffset": 0,
        "latestOffset": 152340
      },
      {
        "partition": 1,
        "leader": 2,
        "replicas": [2, 3, 4],
        "isr": [2, 3, 4],
        "earliestOffset": 0,
        "latestOffset": 148920
      }
    ]
  },
  "traceId": "trace-c3d4e5f6-a7b8-9012-cdef-345678901234"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | Topic 不存在 |

---

#### 3.1.4 更新 Kafka Topic 配置

**PUT** `/api/v1/msg/topics/kafka/{name}/configs`

更新 Topic 级配置项。注意：`partitions` 和 `replicationFactor` 不可通过此接口修改。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | string | Topic 名称 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `configs` | body | object | 是 | 要更新的配置项 key-value |
| `description` | body | string | 否 | 更新描述 |
| `owner` | body | string | 否 | 更新负责人 |

**请求示例**

```json
{
  "configs": {
    "retentionMs": "432000000",
    "maxMessageBytes": "2097152"
  },
  "description": "延长保留时间至5天，增大消息上限"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "order-events",
    "configs": {
      "retentionMs": "432000000",
      "maxMessageBytes": "2097152",
      "cleanupPolicy": "delete",
      "compressionType": "lz4"
    },
    "updatedAt": "2026-07-16T11:00:00.000Z"
  },
  "traceId": "trace-d4e5f6a7-b8c9-0123-defa-456789012345"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | 配置项名称不合法 |
| `40004` | Topic 不存在 |
| `50001` | Kafka 配置更新失败 |

---

#### 3.1.5 增加 Kafka Topic 分区

**POST** `/api/v1/msg/topics/kafka/{name}/partitions`

仅支持增加分区，不支持减少。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | string | Topic 名称 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `newPartitionCount` | body | integer | 是 | 新的分区总数，必须大于当前分区数 |
| `replicasAssignments` | body | object | 否 | 新增分区的副本分配，不传则自动分配 |

**请求示例**

```json
{
  "newPartitionCount": 12,
  "replicasAssignments": {
    "6": [1, 2, 3],
    "7": [2, 3, 4],
    "8": [3, 4, 5],
    "9": [4, 5, 1],
    "10": [5, 1, 2],
    "11": [1, 3, 5]
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "order-events",
    "partitions": 12,
    "previousPartitions": 6,
    "updatedAt": "2026-07-16T11:15:00.000Z"
  },
  "traceId": "trace-e5f6a7b8-c9d0-1234-efab-567890123456"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | 新分区数小于等于当前分区数 |
| `40901` | Topic 正在删除中 |

---

#### 3.1.6 删除 Kafka Topic

**DELETE** `/api/v1/msg/topics/kafka/{name}`

删除 Kafka Topic。此操作不可逆，会同时删除 Topic 中的所有消息。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | string | Topic 名称 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `confirm` | query | string | 是 | 确认删除，必须传 `CONFIRM` |
| `force` | query | boolean | 否 | 是否强制删除（忽略活跃消费者），默认 `false` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "order-events",
    "deletedAt": "2026-07-16T11:30:00.000Z"
  },
  "traceId": "trace-f6a7b8c9-d0e1-2345-fabc-678901234567"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | confirm 参数不为 `CONFIRM` |
| `40004` | Topic 不存在 |
| `40901` | Topic 存在活跃消费者且 force=false |

---

#### 3.1.7 创建 RabbitMQ Exchange

**POST** `/api/v1/msg/exchanges`

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `name` | body | string | 是 | - | Exchange 名称 |
| `type` | body | string | 是 | - | Exchange 类型: `direct` / `fanout` / `topic` / `headers` |
| `durable` | body | boolean | 否 | `true` | 是否持久化 |
| `autoDelete` | body | boolean | 否 | `false` | 是否自动删除（最后一个队列解绑后删除） |
| `internal` | body | boolean | 否 | `false` | 是否为内部 Exchange |
| `arguments` | body | object | 否 | - | 额外参数 |
| `description` | body | string | 否 | - | 描述 |
| `owner` | body | string | 否 | - | 负责人 |

**请求示例**

```json
{
  "name": "ont.events",
  "type": "topic",
  "durable": true,
  "autoDelete": false,
  "description": "本体引擎事件交换机",
  "owner": "tech-ont"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "ont.events",
    "type": "topic",
    "durable": true,
    "autoDelete": false,
    "internal": false,
    "arguments": {},
    "description": "本体引擎事件交换机",
    "owner": "tech-ont",
    "createdAt": "2026-07-16T10:30:00.000Z"
  },
  "traceId": "trace-a7b8c9d0-e1f2-3456-abcd-789012345678"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | Exchange 名称或类型不合法 |
| `40009` | Exchange 已存在 |
| `50001` | RabbitMQ 连接失败 |

---

#### 3.1.8 查询 RabbitMQ Exchange 列表

**GET** `/api/v1/msg/exchanges`

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `name` | query | string | 否 | - | Exchange 名称模糊匹配 |
| `type` | query | string | 否 | - | Exchange 类型筛选 |
| `page` | query | integer | 否 | 1 | 页码 |
| `pageSize` | query | integer | 否 | 20 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "name": "ont.events",
        "type": "topic",
        "durable": true,
        "autoDelete": false,
        "internal": false,
        "description": "本体引擎事件交换机",
        "owner": "tech-ont",
        "createdAt": "2026-07-16T10:30:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "trace-b8c9d0e1-f2a3-4567-bcde-890123456789"
}
```

---

#### 3.1.9 删除 RabbitMQ Exchange

**DELETE** `/api/v1/msg/exchanges/{name}`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | string | Exchange 名称 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `confirm` | query | string | 是 | 确认删除，必须传 `CONFIRM` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "ont.events",
    "deletedAt": "2026-07-16T11:30:00.000Z"
  },
  "traceId": "trace-c9d0e1f2-a3b4-5678-cdef-901234567890"
}
```

---

#### 3.1.10 创建 RabbitMQ Queue

**POST** `/api/v1/msg/queues`

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `name` | body | string | 是 | - | Queue 名称 |
| `durable` | body | boolean | 否 | `true` | 是否持久化 |
| `autoDelete` | body | boolean | 否 | `false` | 是否自动删除 |
| `exclusive` | body | boolean | 否 | `false` | 是否排他（仅创建连接可用） |
| `arguments` | body | object | 否 | - | 额外参数 |
| `arguments.xMaxPriority` | body | integer | 否 | - | 最大优先级 (1-255) |
| `arguments.xMessageTtl` | body | long | 否 | - | 消息 TTL（毫秒） |
| `arguments.xExpires` | body | long | 否 | - | 队列空闲过期时间（毫秒） |
| `arguments.xMaxLength` | body | integer | 否 | - | 队列最大消息数 |
| `arguments.xMaxLengthBytes` | body | long | 否 | - | 队列最大字节数 |
| `arguments.xDeadLetterExchange` | body | string | 否 | - | 死信交换机 |
| `arguments.xDeadLetterRoutingKey` | body | string | 否 | - | 死信路由键 |
| `bindings` | body | array | 否 | - | 创建时绑定的 Exchange 列表 |
| `description` | body | string | 否 | - | 描述 |
| `owner` | body | string | 否 | - | 负责人 |

**请求示例**

```json
{
  "name": "ont.event.processor",
  "durable": true,
  "autoDelete": false,
  "arguments": {
    "xMessageTtl": 3600000,
    "xDeadLetterExchange": "ont.events.dlx",
    "xDeadLetterRoutingKey": "ont.event.dead"
  },
  "bindings": [
    {
      "exchange": "ont.events",
      "routingKey": "ont.event.#"
    }
  ],
  "description": "本体事件处理队列",
  "owner": "tech-ont"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "ont.event.processor",
    "durable": true,
    "autoDelete": false,
    "exclusive": false,
    "arguments": {
      "xMessageTtl": 3600000,
      "xDeadLetterExchange": "ont.events.dlx",
      "xDeadLetterRoutingKey": "ont.event.dead"
    },
    "bindings": [
      {
        "exchange": "ont.events",
        "routingKey": "ont.event.#"
      }
    ],
    "description": "本体事件处理队列",
    "owner": "tech-ont",
    "createdAt": "2026-07-16T10:30:00.000Z"
  },
  "traceId": "trace-d0e1f2a3-b4c5-6789-defa-012345678901"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | Queue 名称不合法 |
| `40009` | Queue 已存在 |
| `40901` | 绑定的 Exchange 不存在 |

---

#### 3.1.11 查询 RabbitMQ Queue 列表

**GET** `/api/v1/msg/queues`

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `name` | query | string | 否 | - | Queue 名称模糊匹配 |
| `page` | query | integer | 否 | 1 | 页码 |
| `pageSize` | query | integer | 否 | 20 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "name": "ont.event.processor",
        "durable": true,
        "autoDelete": false,
        "exclusive": false,
        "arguments": {
          "xMessageTtl": 3600000,
          "xDeadLetterExchange": "ont.events.dlx"
        },
        "bindings": [
          {
            "exchange": "ont.events",
            "routingKey": "ont.event.#"
          }
        ],
        "messageCount": 42,
        "consumerCount": 3,
        "description": "本体事件处理队列",
        "owner": "tech-ont",
        "createdAt": "2026-07-16T10:30:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "trace-e1f2a3b4-c5d6-7890-efab-123456789012"
}
```

---

#### 3.1.12 查询 RabbitMQ Queue 详情

**GET** `/api/v1/msg/queues/{name}`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "ont.event.processor",
    "durable": true,
    "autoDelete": false,
    "exclusive": false,
    "arguments": {
      "xMessageTtl": 3600000,
      "xDeadLetterExchange": "ont.events.dlx",
      "xDeadLetterRoutingKey": "ont.event.dead"
    },
    "bindings": [
      {
        "exchange": "ont.events",
        "routingKey": "ont.event.#",
        "arguments": {}
      }
    ],
    "messageCount": 42,
    "consumerCount": 3,
    "description": "本体事件处理队列",
    "owner": "tech-ont",
    "createdAt": "2026-07-16T10:30:00.000Z"
  },
  "traceId": "trace-f2a3b4c5-d6e7-8901-fabc-234567890123"
}
```

---

#### 3.1.13 删除 RabbitMQ Queue

**DELETE** `/api/v1/msg/queues/{name}`

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `confirm` | query | string | 是 | 确认删除，必须传 `CONFIRM` |
| `force` | query | boolean | 否 | 是否强制删除（忽略活跃消费者），默认 `false` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "ont.event.processor",
    "deletedAt": "2026-07-16T11:30:00.000Z"
  },
  "traceId": "trace-a3b4c5d6-e7f8-9012-abcd-345678901234"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | Queue 不存在 |
| `40901` | Queue 存在活跃消费者且 force=false |

---

#### 3.1.14 创建 RabbitMQ Binding

**POST** `/api/v1/msg/bindings`

将 Queue 绑定到 Exchange。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `exchange` | body | string | 是 | Exchange 名称 |
| `queue` | body | string | 是 | Queue 名称 |
| `routingKey` | body | string | 否 | 路由键 |
| `arguments` | body | object | 否 | 额外参数（headers 类型 Exchange 需要） |

**请求示例**

```json
{
  "exchange": "ont.events",
  "queue": "ont.event.processor",
  "routingKey": "ont.event.#"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "exchange": "ont.events",
    "queue": "ont.event.processor",
    "routingKey": "ont.event.#",
    "arguments": {},
    "createdAt": "2026-07-16T10:35:00.000Z"
  },
  "traceId": "trace-b4c5d6e7-f8a9-0123-bcde-456789012345"
}
```

---

#### 3.1.15 删除 RabbitMQ Binding

**DELETE** `/api/v1/msg/bindings`

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `exchange` | query | string | 是 | Exchange 名称 |
| `queue` | query | string | 是 | Queue 名称 |
| `routingKey` | query | string | 否 | 路由键 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "exchange": "ont.events",
    "queue": "ont.event.processor",
    "routingKey": "ont.event.#",
    "deletedAt": "2026-07-16T11:30:00.000Z"
  },
  "traceId": "trace-c5d6e7f8-a9b0-1234-cdef-567890123456"
}
```

---

### 3.2 消息发布 API

#### 3.2.1 统一消息发布（同步直发）

**POST** `/api/v1/msg/messages/publish`

直接发布消息至 Kafka/RabbitMQ，不经过 Outbox。适用于对消息可靠性要求不高的场景。**推荐业务服务使用 Outbox 模式发布消息。**

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `broker` | body | string | 是 | 中间件类型: `kafka` / `rabbitmq` |
| `topic` | body | string | kafka 必填 | Kafka Topic 名称 |
| `partition` | body | integer | 否 | Kafka 分区号，不传则按 key 哈希 |
| `key` | body | string | 否 | Kafka 消息 Key |
| `exchange` | body | string | rabbitmq 必填 | RabbitMQ Exchange 名称 |
| `routingKey` | body | string | rabbitmq 否 | RabbitMQ 路由键 |
| `payload` | body | object | 是 | 消息内容（JSON） |
| `headers` | body | object | 否 | 消息头，会自动注入 `X-Trace-Id` |
| `messageId` | body | string | 否 | 消息唯一 ID，不传则自动生成 UUID |
| `timestamp` | body | long | 否 | 消息时间戳（毫秒），不传则使用当前时间 |

**请求示例（Kafka）**

```json
{
  "broker": "kafka",
  "topic": "order-events",
  "key": "order-12345",
  "payload": {
    "eventType": "OrderCreated",
    "orderId": "ORD-2026-0716-0001",
    "customerId": "CUST-001",
    "amount": 299.00,
    "items": [
      { "sku": "SKU-001", "quantity": 2, "price": 99.00 },
      { "sku": "SKU-002", "quantity": 1, "price": 101.00 }
    ]
  },
  "headers": {
    "eventType": "OrderCreated",
    "source": "tech-ont"
  }
}
```

**请求示例（RabbitMQ）**

```json
{
  "broker": "rabbitmq",
  "exchange": "ont.events",
  "routingKey": "ont.event.concept.created",
  "payload": {
    "eventType": "ConceptCreated",
    "conceptId": "CONCEPT-001",
    "conceptName": "客户",
    "properties": ["name", "email", "phone"]
  },
  "headers": {
    "source": "tech-ont"
  }
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "messageId": "msg-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "broker": "kafka",
    "topic": "order-events",
    "partition": 3,
    "offset": 152341,
    "timestamp": 1721129400000,
    "traceId": "trace-d6e7f8a9-b0c1-2345-efab-678901234567"
  },
  "traceId": "trace-d6e7f8a9-b0c1-2345-efab-678901234567"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | 参数校验失败（缺少 topic/exchange 等） |
| `40004` | Topic/Exchange 不存在 |
| `42901` | 发布频率超限 |
| `50001` | 中间件发送失败 |
| `50301` | 中间件不可用 |

---

#### 3.2.2 创建 Outbox 消息

**POST** `/api/v1/msg/outbox/messages`

将消息写入 Outbox 表，由 Outbox Relay 异步投递至中间件。**推荐所有业务服务使用此接口发布消息。**

业务服务通常在自己的数据库事务中直接写入 Outbox 表（共享 PostgreSQL 实例），而非调用此 API。此 API 主要用于：
1. 不共享 PostgreSQL 实例的外部服务
2. 不需要事务一致性的场景
3. 管理工具手动写入消息

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `broker` | body | string | 是 | 中间件类型: `kafka` / `rabbitmq` |
| `topic` | body | string | kafka 必填 | Kafka Topic 名称 |
| `partition` | body | integer | 否 | Kafka 分区号 |
| `key` | body | string | 否 | Kafka 消息 Key |
| `exchange` | body | string | rabbitmq 必填 | RabbitMQ Exchange 名称 |
| `routingKey` | body | string | rabbitmq 否 | RabbitMQ 路由键 |
| `payload` | body | object | 是 | 消息内容（JSON） |
| `headers` | body | object | 否 | 消息头 |
| `aggregateId` | body | string | 否 | 聚合根 ID，用于关联业务实体 |
| `aggregateType` | body | string | 否 | 聚合根类型 |
| `messageId` | body | string | 否 | 消息唯一 ID，不传则自动生成 UUID |
| `scheduledAt` | body | string | 否 | 延迟投递时间（ISO 8601），不传则立即投递 |

**请求示例**

```json
{
  "broker": "kafka",
  "topic": "order-events",
  "key": "order-12345",
  "payload": {
    "eventType": "OrderCreated",
    "orderId": "ORD-2026-0716-0001",
    "customerId": "CUST-001",
    "amount": 299.00
  },
  "headers": {
    "eventType": "OrderCreated",
    "source": "tech-ont"
  },
  "aggregateId": "ORD-2026-0716-0001",
  "aggregateType": "Order"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "ob-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "status": "PENDING",
    "broker": "kafka",
    "topic": "order-events",
    "messageId": "msg-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "traceId": "trace-e7f8a9b0-c1d2-3456-fabc-789012345678",
    "createdAt": "2026-07-16T10:30:00.000Z"
  },
  "traceId": "trace-e7f8a9b0-c1d2-3456-fabc-789012345678"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | 参数校验失败 |
| `50003` | Outbox 表写入失败 |

---

#### 3.2.3 批量创建 Outbox 消息

**POST** `/api/v1/msg/outbox/messages/batch`

批量写入 Outbox 表，单次最大 1000 条。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `messages` | body | array | 是 | 消息列表，每条结构同 3.2.2，最大 1000 条 |

**请求示例**

```json
{
  "messages": [
    {
      "broker": "kafka",
      "topic": "order-events",
      "key": "order-12345",
      "payload": { "eventType": "OrderCreated", "orderId": "ORD-001" },
      "aggregateId": "ORD-001",
      "aggregateType": "Order"
    },
    {
      "broker": "kafka",
      "topic": "order-events",
      "key": "order-12346",
      "payload": { "eventType": "OrderCreated", "orderId": "ORD-002" },
      "aggregateId": "ORD-002",
      "aggregateType": "Order"
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
    "totalRequested": 2,
    "totalCreated": 2,
    "totalFailed": 0,
    "items": [
      {
        "id": "ob-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "status": "PENDING",
        "messageId": "msg-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "traceId": "trace-f8a9b0c1-d2e3-4567-abcd-890123456789"
      },
      {
        "id": "ob-yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
        "status": "PENDING",
        "messageId": "msg-yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
        "traceId": "trace-a9b0c1d2-e3f4-5678-bcde-901234567890"
      }
    ]
  },
  "traceId": "trace-f8a9b0c1-d2e3-4567-abcd-890123456789"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | 消息数量超过 1000 条 |
| `50003` | 批量写入失败（部分成功部分失败时，totalFailed > 0） |

---

#### 3.2.4 查询消息发布状态

**GET** `/api/v1/msg/messages/{messageId}/status`

根据 messageId 查询消息的发布/投递状态。同时查询 Outbox 记录和中间件中的消息。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `messageId` | string | 消息唯一 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "messageId": "msg-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "outbox": {
      "id": "ob-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "status": "DELIVERED",
      "broker": "kafka",
      "topic": "order-events",
      "partition": 3,
      "offset": 152341,
      "retryCount": 0,
      "createdAt": "2026-07-16T10:30:00.000Z",
      "deliveredAt": "2026-07-16T10:30:00.500Z"
    },
    "consumerAcks": [
      {
        "consumerGroup": "order-processor-group",
        "acked": true,
        "ackedAt": "2026-07-16T10:30:02.000Z"
      }
    ]
  },
  "traceId": "trace-b0c1d2e3-f4a5-6789-cdef-012345678901"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | messageId 不存在 |

---

#### 3.2.5 查询消息发布确认

**GET** `/api/v1/msg/messages/{messageId}/acks`

查询某条消息被哪些消费者组确认消费。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `messageId` | string | 消息唯一 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "messageId": "msg-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "broker": "kafka",
    "topic": "order-events",
    "partition": 3,
    "offset": 152341,
    "acks": [
      {
        "consumerGroup": "order-processor-group",
        "consumerId": "consumer-1",
        "acked": true,
        "ackedAt": "2026-07-16T10:30:02.000Z",
        "processingTimeMs": 1500
      },
      {
        "consumerGroup": "order-audit-group",
        "consumerId": "consumer-2",
        "acked": false,
        "ackedAt": null,
        "processingTimeMs": null
      }
    ]
  },
  "traceId": "trace-c1d2e3f4-a5b6-7890-efab-123456789012"
}
```

---

### 3.3 消息订阅 API

#### 3.3.1 创建消费者组

**POST** `/api/v1/msg/consumer-groups`

创建消费者组并配置订阅规则。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `name` | body | string | 是 | - | 消费者组名称 |
| `broker` | body | string | 是 | - | 中间件类型: `kafka` / `rabbitmq` |
| `topics` | body | array | kafka 必填 | - | 订阅的 Kafka Topic 列表 |
| `pattern` | body | string | kafka 否 | - | Topic 名称正则匹配模式，与 topics 互斥 |
| `queue` | body | string | rabbitmq 必填 | - | 订阅的 RabbitMQ Queue 名称 |
| `autoOffsetReset` | body | string | 否 | `latest` | Kafka 初始偏移: `earliest` / `latest` |
| `enableAutoCommit` | body | boolean | 否 | `false` | 是否自动提交偏移量（推荐 false，手动提交） |
| `autoCommitIntervalMs` | body | long | 否 | 5000 | 自动提交间隔（毫秒） |
| `maxPollRecords` | body | integer | 否 | 500 | 单次拉取最大记录数 |
| `maxPollIntervalMs` | body | long | 否 | 300000 | 拉取间隔最大时间（毫秒） |
| `sessionTimeoutMs` | body | long | 否 | 45000 | 会话超时时间（毫秒） |
| `heartbeatIntervalMs` | body | long | 否 | 3000 | 心跳间隔（毫秒） |
| `retryPolicy` | body | object | 否 | - | 重试策略 |
| `retryPolicy.maxRetries` | body | integer | 否 | 3 | 最大重试次数 |
| `retryPolicy.backoffInitialMs` | body | long | 否 | 1000 | 初始退避时间（毫秒） |
| `retryPolicy.backoffMaxMs` | body | long | 否 | 30000 | 最大退避时间（毫秒） |
| `retryPolicy.backoffMultiplier` | body | double | 否 | 2.0 | 退避乘数 |
| `dlqEnabled` | body | boolean | 否 | `true` | 是否启用 DLQ |
| `dlqTopic` | body | string | 否 | `{topic}.dlq` | Kafka DLQ Topic 名称 |
| `concurrency` | body | integer | 否 | 1 | 消费并发数 |
| `description` | body | string | 否 | - | 描述 |
| `owner` | body | string | 否 | - | 负责人 |
| `callbackUrl` | body | string | 否 | - | 消费回调 HTTP URL（Webhook 模式） |

**请求示例**

```json
{
  "name": "order-processor-group",
  "broker": "kafka",
  "topics": ["order-events"],
  "autoOffsetReset": "earliest",
  "enableAutoCommit": false,
  "maxPollRecords": 100,
  "retryPolicy": {
    "maxRetries": 3,
    "backoffInitialMs": 1000,
    "backoffMaxMs": 30000,
    "backoffMultiplier": 2.0
  },
  "dlqEnabled": true,
  "dlqTopic": "order-events.dlq",
  "concurrency": 3,
  "description": "订单事件处理消费者组",
  "owner": "tech-ont",
  "callbackUrl": "https://tech-ont.metaplatform.internal/api/v1/ont/events/consume"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "cg-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "name": "order-processor-group",
    "broker": "kafka",
    "topics": ["order-events"],
    "autoOffsetReset": "earliest",
    "enableAutoCommit": false,
    "maxPollRecords": 100,
    "retryPolicy": {
      "maxRetries": 3,
      "backoffInitialMs": 1000,
      "backoffMaxMs": 30000,
      "backoffMultiplier": 2.0
    },
    "dlqEnabled": true,
    "dlqTopic": "order-events.dlq",
    "concurrency": 3,
    "status": "CREATED",
    "description": "订单事件处理消费者组",
    "owner": "tech-ont",
    "callbackUrl": "https://tech-ont.metaplatform.internal/api/v1/ont/events/consume",
    "createdAt": "2026-07-16T10:30:00.000Z"
  },
  "traceId": "trace-d2e3f4a5-b6c7-8901-fabc-234567890123"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | 参数校验失败 |
| `40009` | 消费者组名称已存在 |
| `40004` | 订阅的 Topic 不存在 |

---

#### 3.3.2 查询消费者组列表

**GET** `/api/v1/msg/consumer-groups`

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `name` | query | string | 否 | - | 消费者组名称模糊匹配 |
| `broker` | query | string | 否 | - | 中间件类型筛选 |
| `status` | query | string | 否 | - | 状态筛选: `CREATED` / `ACTIVE` / `PAUSED` / `ERROR` |
| `topic` | query | string | 否 | - | 订阅的 Topic 名称筛选 |
| `page` | query | integer | 否 | 1 | 页码 |
| `pageSize` | query | integer | 否 | 20 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "cg-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "name": "order-processor-group",
        "broker": "kafka",
        "topics": ["order-events"],
        "status": "ACTIVE",
        "consumerCount": 3,
        "lag": 0,
        "description": "订单事件处理消费者组",
        "owner": "tech-ont",
        "createdAt": "2026-07-16T10:30:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "trace-e3f4a5b6-c7d8-9012-abcd-345678901234"
}
```

---

#### 3.3.3 查询消费者组详情

**GET** `/api/v1/msg/consumer-groups/{name}`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | string | 消费者组名称 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "cg-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "name": "order-processor-group",
    "broker": "kafka",
    "topics": ["order-events"],
    "autoOffsetReset": "earliest",
    "enableAutoCommit": false,
    "maxPollRecords": 100,
    "retryPolicy": {
      "maxRetries": 3,
      "backoffInitialMs": 1000,
      "backoffMaxMs": 30000,
      "backoffMultiplier": 2.0
    },
    "dlqEnabled": true,
    "dlqTopic": "order-events.dlq",
    "concurrency": 3,
    "status": "ACTIVE",
    "description": "订单事件处理消费者组",
    "owner": "tech-ont",
    "callbackUrl": "https://tech-ont.metaplatform.internal/api/v1/ont/events/consume",
    "createdAt": "2026-07-16T10:30:00.000Z",
    "consumers": [
      {
        "consumerId": "consumer-1",
        "clientId": "order-processor-1",
        "host": "10.0.1.21:54321",
        "assignments": [
          { "topic": "order-events", "partition": 0 },
          { "topic": "order-events", "partition": 3 }
        ],
        "lag": 0
      },
      {
        "consumerId": "consumer-2",
        "clientId": "order-processor-2",
        "host": "10.0.1.22:54322",
        "assignments": [
          { "topic": "order-events", "partition": 1 },
          { "topic": "order-events", "partition": 4 }
        ],
        "lag": 2
      },
      {
        "consumerId": "consumer-3",
        "clientId": "order-processor-3",
        "host": "10.0.1.23:54323",
        "assignments": [
          { "topic": "order-events", "partition": 2 },
          { "topic": "order-events", "partition": 5 }
        ],
        "lag": 0
      }
    ],
    "offsets": [
      { "topic": "order-events", "partition": 0, "committedOffset": 152340, "endOffset": 152340, "lag": 0 },
      { "topic": "order-events", "partition": 1, "committedOffset": 148918, "endOffset": 148920, "lag": 2 },
      { "topic": "order-events", "partition": 2, "committedOffset": 150100, "endOffset": 150100, "lag": 0 },
      { "topic": "order-events", "partition": 3, "committedOffset": 151200, "endOffset": 151200, "lag": 0 },
      { "topic": "order-events", "partition": 4, "committedOffset": 149800, "endOffset": 149800, "lag": 0 },
      { "topic": "order-events", "partition": 5, "committedOffset": 150500, "endOffset": 150500, "lag": 0 }
    ]
  },
  "traceId": "trace-f4a5b6c7-d8e9-0123-bcde-456789012345"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 消费者组不存在 |

---

#### 3.3.4 更新消费者组配置

**PUT** `/api/v1/msg/consumer-groups/{name}`

更新消费者组配置。部分配置需要重启消费者才能生效。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | string | 消费者组名称 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `maxPollRecords` | body | integer | 否 | 单次拉取最大记录数 |
| `retryPolicy` | body | object | 否 | 重试策略 |
| `concurrency` | body | integer | 否 | 消费并发数 |
| `callbackUrl` | body | string | 否 | 消费回调 URL |
| `description` | body | string | 否 | 描述 |
| `restart` | body | boolean | 否 | 是否立即重启消费者使配置生效，默认 `false` |

**请求示例**

```json
{
  "maxPollRecords": 200,
  "concurrency": 5,
  "restart": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "order-processor-group",
    "maxPollRecords": 200,
    "concurrency": 5,
    "restarted": true,
    "updatedAt": "2026-07-16T11:00:00.000Z"
  },
  "traceId": "trace-a5b6c7d8-e9f0-1234-cdef-567890123456"
}
```

---

#### 3.3.5 启动/暂停消费者组

**POST** `/api/v1/msg/consumer-groups/{name}/action`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | string | 消费者组名称 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `action` | body | string | 是 | 操作: `start` / `pause` / `restart` / `stop` |
| `reason` | body | string | 否 | 操作原因 |

**请求示例**

```json
{
  "action": "pause",
  "reason": "下游服务维护，暂停消费"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "order-processor-group",
    "previousStatus": "ACTIVE",
    "currentStatus": "PAUSED",
    "action": "pause",
    "updatedAt": "2026-07-16T11:00:00.000Z"
  },
  "traceId": "trace-b6c7d8e9-f0a1-2345-efab-678901234567"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40901` | 当前状态不允许该操作（如已暂停的消费者组再次暂停） |

---

#### 3.3.6 删除消费者组

**DELETE** `/api/v1/msg/consumer-groups/{name}`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | string | 消费者组名称 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `confirm` | query | string | 是 | 确认删除，必须传 `CONFIRM` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "order-processor-group",
    "deletedAt": "2026-07-16T11:30:00.000Z"
  },
  "traceId": "trace-c7d8e9f0-a1b2-3456-fabc-789012345678"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 消费者组不存在 |
| `40901` | 消费者组状态为 ACTIVE，需先停止 |

---

#### 3.3.7 提交消费确认

**POST** `/api/v1/msg/consumer-groups/{name}/acks`

手动提交消费偏移量确认。仅在 `enableAutoCommit=false` 时使用。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | string | 消费者组名称 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `type` | body | string | 是 | 确认类型: `commit` (提交偏移) / `reject` (拒绝，触发重试) |
| `topic` | body | string | kafka 是 | Kafka Topic 名称 |
| `partition` | body | integer | kafka 是 | Kafka 分区号 |
| `offset` | body | long | kafka 是 | 确认到的偏移量 |
| `deliveryTag` | body | long | rabbitmq 是 | RabbitMQ 消息投递标签 |
| `multiple` | body | boolean | 否 | 是否批量确认（RabbitMQ），默认 `false` |
| `requeue` | body | boolean | 否 | reject 时是否重新入队，默认 `false`（进入 DLQ） |
| `messageId` | body | string | 否 | 消息 ID（用于幂等记录） |
| `traceId` | body | string | 否 | 消息原始 traceId |

**请求示例（Kafka commit）**

```json
{
  "type": "commit",
  "topic": "order-events",
  "partition": 0,
  "offset": 152341,
  "messageId": "msg-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "traceId": "trace-d8e9f0a1-b2c3-4567-abcd-890123456789"
}
```

**请求示例（RabbitMQ reject）**

```json
{
  "type": "reject",
  "deliveryTag": 42,
  "requeue": false,
  "messageId": "msg-yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
  "traceId": "trace-e9f0a1b2-c3d4-5678-bcde-901234567890"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "acknowledged": true,
    "consumerGroup": "order-processor-group",
    "topic": "order-events",
    "partition": 0,
    "offset": 152341,
    "ackedAt": "2026-07-16T10:30:02.000Z"
  },
  "traceId": "trace-f0a1b2c3-d4e5-6789-cdef-012345678901"
}
```

---

#### 3.3.8 重置消费者偏移量

**POST** `/api/v1/msg/consumer-groups/{name}/offsets/reset`

重置消费者组的偏移量。操作前会自动暂停消费者。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | string | 消费者组名称 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `topic` | body | string | 是 | Topic 名称 |
| `partitionOffsets` | body | array | 否 | 指定分区偏移量，不传则全部分区 |
| `partitionOffsets[].partition` | body | integer | 是 | 分区号 |
| `partitionOffsets[].offset` | body | long | 否 | 目标偏移量（与 strategy 互斥） |
| `strategy` | body | string | 否 | 重置策略: `earliest` / `latest` / `timestamp`，与 offset 互斥 |
| `timestamp` | body | long | 否 | 时间戳策略时的时间戳（毫秒） |
| `resume` | body | boolean | 否 | 重置后是否自动恢复消费，默认 `true` |

**请求示例**

```json
{
  "topic": "order-events",
  "strategy": "earliest",
  "resume": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "consumerGroup": "order-processor-group",
    "topic": "order-events",
    "resetResults": [
      { "partition": 0, "previousOffset": 152340, "currentOffset": 0 },
      { "partition": 1, "previousOffset": 148920, "currentOffset": 0 },
      { "partition": 2, "previousOffset": 150100, "currentOffset": 0 },
      { "partition": 3, "previousOffset": 151200, "currentOffset": 0 },
      { "partition": 4, "previousOffset": 149800, "currentOffset": 0 },
      { "partition": 5, "previousOffset": 150500, "currentOffset": 0 }
    ],
    "resumed": true,
    "resetAt": "2026-07-16T11:00:00.000Z"
  },
  "traceId": "trace-a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | 消费者组或 Topic 不存在 |
| `40901` | 消费者组状态为 ACTIVE，需先暂停 |

---

#### 3.3.9 查询消费者组偏移量

**GET** `/api/v1/msg/consumer-groups/{name}/offsets`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | string | 消费者组名称 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `topic` | query | string | 否 | Topic 名称筛选 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "consumerGroup": "order-processor-group",
    "offsets": [
      {
        "topic": "order-events",
        "partition": 0,
        "committedOffset": 152340,
        "endOffset": 152340,
        "lag": 0,
        "consumerId": "consumer-1",
        "host": "10.0.1.21:54321"
      },
      {
        "topic": "order-events",
        "partition": 1,
        "committedOffset": 148918,
        "endOffset": 148920,
        "lag": 2,
        "consumerId": "consumer-2",
        "host": "10.0.1.22:54322"
      }
    ]
  },
  "traceId": "trace-b2c3d4e5-f6a7-8901-bcde-f23456789012"
}
```

---

### 3.4 DLQ 管理 API

#### 3.4.1 查询死信队列列表

**GET** `/api/v1/msg/dlq`

查询所有 DLQ Topic/Queue 及其消息积压情况。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `broker` | query | string | 否 | - | 中间件类型筛选 |
| `originalTopic` | query | string | 否 | - | 原始 Topic/Exchange 名称筛选 |
| `page` | query | integer | 否 | 1 | 页码 |
| `pageSize` | query | integer | 否 | 20 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "dlqName": "order-events.dlq",
        "broker": "kafka",
        "originalTopic": "order-events",
        "messageCount": 5,
        "oldestMessageAt": "2026-07-15T10:00:00.000Z",
        "newestMessageAt": "2026-07-16T09:30:00.000Z",
        "createdAt": "2026-07-16T10:30:00.000Z"
      },
      {
        "dlqName": "ont.event.processor.dlq",
        "broker": "rabbitmq",
        "originalQueue": "ont.event.processor",
        "messageCount": 2,
        "oldestMessageAt": "2026-07-16T08:00:00.000Z",
        "newestMessageAt": "2026-07-16T08:30:00.000Z",
        "createdAt": "2026-07-16T10:30:00.000Z"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "trace-c3d4e5f6-a7b8-9012-cdef-345678901234"
}
```

---

#### 3.4.2 查询死信消息列表

**GET** `/api/v1/msg/dlq/{dlqName}/messages`

查询某个 DLQ 中的死信消息列表。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `dlqName` | string | DLQ Topic/Queue 名称 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `traceId` | query | string | 否 | - | 按 trace_id 筛选 |
| `messageId` | query | string | 否 | - | 按消息 ID 筛选 |
| `startTime` | query | string | 否 | - | 死信时间范围起始（ISO 8601） |
| `endTime` | query | string | 否 | - | 死信时间范围结束（ISO 8601） |
| `page` | query | integer | 否 | 1 | 页码 |
| `pageSize` | query | integer | 否 | 20 | 每页条数 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "dlq-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "dlqName": "order-events.dlq",
        "broker": "kafka",
        "messageId": "msg-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "traceId": "trace-11111111-2222-3333-4444-555555555555",
        "originalTopic": "order-events",
        "originalPartition": 3,
        "originalOffset": 152340,
        "errorMessage": "NullPointerException: Cannot invoke method on null object",
        "errorStack": "java.lang.NullPointerException\n\tat com.metaplatform.ont.processor.OrderEventProcessor.handle(OrderEventProcessor.java:45)\n\t...",
        "retryCount": 3,
        "deadAt": "2026-07-16T09:30:00.000Z",
        "payload": {
          "eventType": "OrderCreated",
          "orderId": "ORD-2026-0716-0001"
        },
        "headers": {
          "X-Trace-Id": "trace-11111111-2222-3333-4444-555555555555",
          "eventType": "OrderCreated",
          "source": "tech-ont"
        }
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "trace-d4e5f6a7-b8c9-0123-efab-456789012345"
}
```

---

#### 3.4.3 查询死信消息详情

**GET** `/api/v1/msg/dlq/messages/{id}`

查询单条死信消息的完整详情，包含完整 payload、headers、错误信息和重试历史。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | DLQ 记录 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "dlq-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "dlqName": "order-events.dlq",
    "broker": "kafka",
    "messageId": "msg-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "traceId": "trace-11111111-2222-3333-4444-555555555555",
    "originalTopic": "order-events",
    "originalPartition": 3,
    "originalOffset": 152340,
    "originalKey": "order-12345",
    "payload": {
      "eventType": "OrderCreated",
      "orderId": "ORD-2026-0716-0001",
      "customerId": "CUST-001",
      "amount": 299.00,
      "items": [
        { "sku": "SKU-001", "quantity": 2, "price": 99.00 },
        { "sku": "SKU-002", "quantity": 1, "price": 101.00 }
      ]
    },
    "headers": {
      "X-Trace-Id": "trace-11111111-2222-3333-4444-555555555555",
      "eventType": "OrderCreated",
      "source": "tech-ont"
    },
    "errorMessage": "NullPointerException: Cannot invoke method on null object",
    "errorStack": "java.lang.NullPointerException\n\tat com.metaplatform.ont.processor.OrderEventProcessor.handle(OrderEventProcessor.java:45)\n\tat com.metaplatform.ont.processor.EventListener.onMessage(EventListener.java:23)\n\tat com.metaplatform.msg.consumer.KafkaConsumerWrapper.lambda$consume$0(KafkaConsumerWrapper.java:89)\n\tat java.base/java.lang.Thread.run(Thread.java:1583)",
    "retryCount": 3,
    "retryHistory": [
      {
        "attempt": 1,
        "startedAt": "2026-07-16T09:29:30.000Z",
        "finishedAt": "2026-07-16T09:29:30.500Z",
        "errorMessage": "NullPointerException: Cannot invoke method on null object",
        "durationMs": 500
      },
      {
        "attempt": 2,
        "startedAt": "2026-07-16T09:29:35.000Z",
        "finishedAt": "2026-07-16T09:29:35.300Z",
        "errorMessage": "NullPointerException: Cannot invoke method on null object",
        "durationMs": 300
      },
      {
        "attempt": 3,
        "startedAt": "2026-07-16T09:29:45.000Z",
        "finishedAt": "2026-07-16T09:29:45.200Z",
        "errorMessage": "NullPointerException: Cannot invoke method on null object",
        "durationMs": 200
      }
    ],
    "deadAt": "2026-07-16T09:30:00.000Z",
    "originalTimestamp": 1721129370000,
    "consumerGroup": "order-processor-group",
    "consumerId": "consumer-2"
  },
  "traceId": "trace-e5f6a7b8-c9d0-1234-fabc-567890123456"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | DLQ 记录不存在 |

---

#### 3.4.4 重发死信消息

**POST** `/api/v1/msg/dlq/messages/{id}/resend`

将死信消息重新发送至原始 Topic/Queue，并在 DLQ 中标记为已重发。重发时会保留原始 `traceId`，同时生成新的 `retryTraceId`。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | DLQ 记录 ID |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `target` | body | string | 否 | 重发目标: `original` (原始 Topic/Queue) / `custom` (自定义目标)，默认 `original` |
| `customTopic` | body | string | 否 | 自定义 Kafka Topic（target=custom 时） |
| `customExchange` | body | string | 否 | 自定义 RabbitMQ Exchange（target=custom 时） |
| `customRoutingKey` | body | string | 否 | 自定义路由键（target=custom 时） |
| `removeFromDlq` | body | boolean | 否 | 重发后是否从 DLQ 移除，默认 `false`（保留记录） |
| `note` | body | string | 否 | 重发备注 |

**请求示例**

```json
{
  "target": "original",
  "removeFromDlq": false,
  "note": "修复 NPE 后重发"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "dlqRecordId": "dlq-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "originalTraceId": "trace-11111111-2222-3333-4444-555555555555",
    "retryTraceId": "trace-66666666-7777-8888-9999-000000000000",
    "resendStatus": "DELIVERED",
    "target": "original",
    "broker": "kafka",
    "topic": "order-events",
    "partition": 3,
    "offset": 152342,
    "removedFromDlq": false,
    "resentAt": "2026-07-16T12:00:00.000Z"
  },
  "traceId": "trace-66666666-7777-8888-9999-000000000000"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | DLQ 记录不存在 |
| `40901` | DLQ 记录已被重发（状态为 RESENT） |
| `50001` | 重发至中间件失败 |

---

#### 3.4.5 批量重发死信消息

**POST** `/api/v1/msg/dlq/{dlqName}/messages/batch-resend`

批量重发 DLQ 中的死信消息。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `dlqName` | string | DLQ Topic/Queue 名称 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `ids` | body | array | 否 | 要重发的 DLQ 记录 ID 列表，不传则重发全部 |
| `target` | body | string | 否 | 重发目标，默认 `original` |
| `removeFromDlq` | body | boolean | 否 | 重发后是否从 DLQ 移除，默认 `false` |

**请求示例**

```json
{
  "ids": [
    "dlq-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "dlq-yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
  ],
  "target": "original",
  "removeFromDlq": false
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "totalRequested": 2,
    "totalResent": 2,
    "totalFailed": 0,
    "results": [
      {
        "dlqRecordId": "dlq-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "resendStatus": "DELIVERED",
        "retryTraceId": "trace-77777777-8888-9999-0000-111111111111"
      },
      {
        "dlqRecordId": "dlq-yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
        "resendStatus": "DELIVERED",
        "retryTraceId": "trace-88888888-9999-0000-1111-222222222222"
      }
    ]
  },
  "traceId": "trace-99999999-0000-1111-2222-333333333333"
}
```

---

#### 3.4.6 配置重试策略

**PUT** `/api/v1/msg/dlq/{dlqName}/retry-policy`

为 DLQ 配置全局重试策略。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `dlqName` | string | DLQ Topic/Queue 名称 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `maxRetries` | body | integer | 是 | - | 最大重试次数 |
| `backoffInitialMs` | body | long | 是 | - | 初始退避时间（毫秒） |
| `backoffMaxMs` | body | long | 是 | - | 最大退避时间（毫秒） |
| `backoffMultiplier` | body | double | 是 | - | 退避乘数 |
| `autoResendEnabled` | body | boolean | 否 | `false` | 是否启用自动重发（定时重发 DLQ 消息） |
| `autoResendIntervalMs` | body | long | 否 | 60000 | 自动重发间隔（毫秒） |
| `maxAutoResendCount` | body | integer | 否 | 10 | 自动重发最大次数 |

**请求示例**

```json
{
  "maxRetries": 5,
  "backoffInitialMs": 2000,
  "backoffMaxMs": 60000,
  "backoffMultiplier": 2.0,
  "autoResendEnabled": true,
  "autoResendIntervalMs": 300000,
  "maxAutoResendCount": 5
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "dlqName": "order-events.dlq",
    "retryPolicy": {
      "maxRetries": 5,
      "backoffInitialMs": 2000,
      "backoffMaxMs": 60000,
      "backoffMultiplier": 2.0
    },
    "autoResendEnabled": true,
    "autoResendIntervalMs": 300000,
    "maxAutoResendCount": 5,
    "updatedAt": "2026-07-16T12:00:00.000Z"
  },
  "traceId": "trace-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
}
```

---

#### 3.4.7 清理 DLQ 消息

**DELETE** `/api/v1/msg/dlq/{dlqName}/messages`

批量清理 DLQ 中的消息。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `dlqName` | string | DLQ Topic/Queue 名称 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `confirm` | query | string | 是 | 确认清理，必须传 `CONFIRM` |
| `ids` | body | array | 否 | 要清理的 DLQ 记录 ID 列表，不传则清理全部 |
| `olderThan` | body | string | 否 | 清理此时间之前的消息（ISO 8601） |
| `status` | body | string | 否 | 清理指定状态的消息: `DEAD` / `RESENT`，不传则全部 |

**请求示例**

```json
{
  "olderThan": "2026-07-10T00:00:00.000Z",
  "status": "RESENT"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "dlqName": "order-events.dlq",
    "totalDeleted": 15,
    "deletedAt": "2026-07-16T12:00:00.000Z"
  },
  "traceId": "trace-bbbbbbbb-cccc-dddd-eeee-ffffffffffff"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | confirm 参数不为 `CONFIRM` |
| `40004` | DLQ 不存在 |

---

### 3.5 消息追踪 API

#### 3.5.1 按 trace_id 查询消息

**GET** `/api/v1/msg/traces/{traceId}`

根据 trace_id 查询所有关联的消息（包括 Outbox 记录、已发布消息、DLQ 记录）。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `traceId` | string | 链路追踪 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "traceId": "trace-11111111-2222-3333-4444-555555555555",
    "messages": [
      {
        "messageId": "msg-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "broker": "kafka",
        "topic": "order-events",
        "partition": 3,
        "offset": 152340,
        "outboxId": "ob-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "outboxStatus": "DELIVERED",
        "payload": {
          "eventType": "OrderCreated",
          "orderId": "ORD-2026-0716-0001"
        },
        "headers": {
          "X-Trace-Id": "trace-11111111-2222-3333-4444-555555555555",
          "eventType": "OrderCreated"
        },
        "publishedAt": "2026-07-16T10:30:00.500Z",
        "consumerAcks": [
          {
            "consumerGroup": "order-processor-group",
            "acked": true,
            "ackedAt": "2026-07-16T10:30:02.000Z"
          }
        ],
        "dlqRecords": [
          {
            "dlqRecordId": "dlq-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            "dlqName": "order-events.dlq",
            "errorMessage": "NullPointerException",
            "retryCount": 3,
            "deadAt": "2026-07-16T09:30:00.000Z",
            "resendStatus": "RESENT",
            "retryTraceId": "trace-66666666-7777-8888-9999-000000000000"
          }
        ]
      }
    ],
    "totalMessages": 1
  },
  "traceId": "trace-11111111-2222-3333-4444-555555555555"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | trace_id 无关联消息 |

---

#### 3.5.2 查询消息全链路

**GET** `/api/v1/msg/traces/{traceId}/timeline`

查询某 trace_id 下消息的完整生命周期时间线。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `traceId` | string | 链路追踪 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "traceId": "trace-11111111-2222-3333-4444-555555555555",
    "timeline": [
      {
        "event": "OUTBOX_CREATED",
        "timestamp": "2026-07-16T10:30:00.000Z",
        "details": {
          "outboxId": "ob-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          "topic": "order-events",
          "messageId": "msg-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        }
      },
      {
        "event": "OUTBOX_PROCESSING",
        "timestamp": "2026-07-16T10:30:00.200Z",
        "details": {
          "outboxId": "ob-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        }
      },
      {
        "event": "MESSAGE_DELIVERED",
        "timestamp": "2026-07-16T10:30:00.500Z",
        "details": {
          "broker": "kafka",
          "topic": "order-events",
          "partition": 3,
          "offset": 152340
        }
      },
      {
        "event": "CONSUMER_RECEIVED",
        "timestamp": "2026-07-16T10:30:01.000Z",
        "details": {
          "consumerGroup": "order-processor-group",
          "consumerId": "consumer-2"
        }
      },
      {
        "event": "CONSUMER_PROCESSING_FAILED",
        "timestamp": "2026-07-16T10:30:01.500Z",
        "details": {
          "consumerGroup": "order-processor-group",
          "errorMessage": "NullPointerException",
          "retryAttempt": 1
        }
      },
      {
        "event": "CONSUMER_RETRY",
        "timestamp": "2026-07-16T10:30:02.500Z",
        "details": {
          "retryAttempt": 2,
          "backoffMs": 1000
        }
      },
      {
        "event": "CONSUMER_PROCESSING_FAILED",
        "timestamp": "2026-07-16T10:30:02.800Z",
        "details": {
          "retryAttempt": 2,
          "errorMessage": "NullPointerException"
        }
      },
      {
        "event": "MESSAGE_DEAD_LETTERED",
        "timestamp": "2026-07-16T10:30:10.000Z",
        "details": {
          "dlqName": "order-events.dlq",
          "dlqRecordId": "dlq-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
          "retryCount": 3
        }
      },
      {
        "event": "DLQ_RESENT",
        "timestamp": "2026-07-16T12:00:00.000Z",
        "details": {
          "retryTraceId": "trace-66666666-7777-8888-9999-000000000000",
          "targetTopic": "order-events",
          "newPartition": 3,
          "newOffset": 152342
        }
      }
    ]
  },
  "traceId": "trace-11111111-2222-3333-4444-555555555555"
}
```

---

#### 3.5.3 消息搜索

**POST** `/api/v1/msg/messages/search`

多条件搜索消息，支持按 Topic、时间范围、payload 内容、headers 等条件搜索。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `broker` | body | string | 否 | 中间件类型 |
| `topic` | body | string | 否 | Topic/Exchange 名称 |
| `messageId` | body | string | 否 | 消息 ID |
| `traceId` | body | string | 否 | trace_id |
| `startTime` | body | string | 否 | 起始时间（ISO 8601） |
| `endTime` | body | string | 否 | 结束时间（ISO 8601） |
| `payloadQuery` | body | string | 否 | payload 内容搜索（JSONPath 或关键字） |
| `headers` | body | object | 否 | headers 键值匹配 |
| `status` | body | string | 否 | Outbox 状态: `PENDING` / `PROCESSING` / `DELIVERED` / `FAILED` / `DEAD` |
| `page` | body | integer | 否 | 页码，默认 1 |
| `pageSize` | body | integer | 否 | 每页条数，默认 20 |

**请求示例**

```json
{
  "broker": "kafka",
  "topic": "order-events",
  "startTime": "2026-07-16T00:00:00.000Z",
  "endTime": "2026-07-16T23:59:59.999Z",
  "payloadQuery": "$.eventType == 'OrderCreated'",
  "headers": {
    "source": "tech-ont"
  },
  "page": 1,
  "pageSize": 10
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
        "messageId": "msg-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "traceId": "trace-11111111-2222-3333-4444-555555555555",
        "broker": "kafka",
        "topic": "order-events",
        "partition": 3,
        "offset": 152340,
        "outboxStatus": "DELIVERED",
        "payload": {
          "eventType": "OrderCreated",
          "orderId": "ORD-2026-0716-0001"
        },
        "headers": {
          "X-Trace-Id": "trace-11111111-2222-3333-4444-555555555555",
          "source": "tech-ont"
        },
        "publishedAt": "2026-07-16T10:30:00.500Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10
  },
  "traceId": "trace-cccccccc-dddd-eeee-ffff-000000000000"
}
```

---

#### 3.5.4 查询消息详情

**GET** `/api/v1/msg/messages/{messageId}`

根据 messageId 查询消息的完整详情。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `messageId` | string | 消息唯一 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "messageId": "msg-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "traceId": "trace-11111111-2222-3333-4444-555555555555",
    "broker": "kafka",
    "topic": "order-events",
    "partition": 3,
    "offset": 152340,
    "key": "order-12345",
    "payload": {
      "eventType": "OrderCreated",
      "orderId": "ORD-2026-0716-0001",
      "customerId": "CUST-001",
      "amount": 299.00,
      "items": [
        { "sku": "SKU-001", "quantity": 2, "price": 99.00 },
        { "sku": "SKU-002", "quantity": 1, "price": 101.00 }
      ]
    },
    "headers": {
      "X-Trace-Id": "trace-11111111-2222-3333-4444-555555555555",
      "eventType": "OrderCreated",
      "source": "tech-ont"
    },
    "timestamp": 1721129400000,
    "outbox": {
      "id": "ob-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "status": "DELIVERED",
      "aggregateId": "ORD-2026-0716-0001",
      "aggregateType": "Order",
      "createdAt": "2026-07-16T10:30:00.000Z",
      "deliveredAt": "2026-07-16T10:30:00.500Z",
      "retryCount": 0
    },
    "consumers": [
      {
        "consumerGroup": "order-processor-group",
        "consumerId": "consumer-2",
        "received": true,
        "receivedAt": "2026-07-16T10:30:01.000Z",
        "acked": true,
        "ackedAt": "2026-07-16T10:30:02.000Z",
        "processingTimeMs": 1000
      }
    ],
    "dlq": null
  },
  "traceId": "trace-dddddddd-eeee-ffff-0000-111111111111"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | messageId 不存在 |

---

### 3.6 监控统计 API

#### 3.6.1 Topic/Queue 流量统计

**GET** `/api/v1/msg/stats/traffic`

查询 Topic/Queue 的消息生产/消费流量统计。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `broker` | query | string | 否 | - | 中间件类型 |
| `topic` | query | string | 否 | - | Topic/Exchange 名称 |
| `queue` | query | string | 否 | - | Queue 名称（RabbitMQ） |
| `startTime` | query | string | 是 | - | 起始时间（ISO 8601） |
| `endTime` | query | string | 是 | - | 结束时间（ISO 8601） |
| `granularity` | query | string | 否 | `1m` | 粒度: `1m` / `5m` / `1h` / `1d` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "broker": "kafka",
    "topic": "order-events",
    "startTime": "2026-07-16T00:00:00.000Z",
    "endTime": "2026-07-16T01:00:00.000Z",
    "granularity": "5m",
    "series": [
      {
        "timestamp": "2026-07-16T00:00:00.000Z",
        "produced": 1250,
        "consumed": 1250,
        "producedBytes": 1250000,
        "consumedBytes": 1250000
      },
      {
        "timestamp": "2026-07-16T00:05:00.000Z",
        "produced": 980,
        "consumed": 980,
        "producedBytes": 980000,
        "consumedBytes": 980000
      },
      {
        "timestamp": "2026-07-16T00:10:00.000Z",
        "produced": 1100,
        "consumed": 1098,
        "producedBytes": 1100000,
        "consumedBytes": 1098000
      }
    ],
    "summary": {
      "totalProduced": 3330,
      "totalConsumed": 3328,
      "totalProducedBytes": 3330000,
      "totalConsumedBytes": 3328000,
      "avgProduceRate": 55.5,
      "avgConsumeRate": 55.47
    }
  },
  "traceId": "trace-eeeeeeee-ffff-0000-1111-222222222222"
}
```

---

#### 3.6.2 延迟监控

**GET** `/api/v1/msg/stats/latency`

查询消息的生产到消费延迟统计。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `broker` | query | string | 否 | 中间件类型 |
| `topic` | query | string | 否 | Topic 名称 |
| `consumerGroup` | query | string | 否 | 消费者组名称 |
| `startTime` | query | string | 是 | 起始时间 |
| `endTime` | query | string | 是 | 结束时间 |
| `granularity` | query | string | 否 | 粒度，默认 `5m` |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "topic": "order-events",
    "consumerGroup": "order-processor-group",
    "startTime": "2026-07-16T00:00:00.000Z",
    "endTime": "2026-07-16T01:00:00.000Z",
    "granularity": "5m",
    "series": [
      {
        "timestamp": "2026-07-16T00:00:00.000Z",
        "p50Ms": 150,
        "p90Ms": 320,
        "p95Ms": 450,
        "p99Ms": 890,
        "maxMs": 1200
      },
      {
        "timestamp": "2026-07-16T00:05:00.000Z",
        "p50Ms": 140,
        "p90Ms": 300,
        "p95Ms": 420,
        "p99Ms": 850,
        "maxMs": 1100
      }
    ],
    "summary": {
      "avgP50Ms": 145,
      "avgP90Ms": 310,
      "avgP95Ms": 435,
      "avgP99Ms": 870,
      "maxLatencyMs": 1200
    }
  },
  "traceId": "trace-ffffffff-0000-1111-2222-333333333333"
}
```

---

#### 3.6.3 积压告警查询

**GET** `/api/v1/msg/stats/backlog-alerts`

查询当前所有积压告警。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `severity` | query | string | 否 | 告警级别: `WARNING` / `CRITICAL` |
| `broker` | query | string | 否 | 中间件类型 |
| `acknowledged` | query | boolean | 否 | 是否已确认，默认 `false`（仅未确认） |
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
        "id": "alert-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "severity": "CRITICAL",
        "broker": "kafka",
        "topic": "order-events",
        "consumerGroup": "order-processor-group",
        "lag": 50000,
        "threshold": 10000,
        "message": "Consumer lag for order-processor-group on order-events exceeds threshold: 50000 > 10000",
        "triggeredAt": "2026-07-16T10:25:00.000Z",
        "acknowledged": false,
        "partitionDetails": [
          { "partition": 0, "lag": 5000 },
          { "partition": 1, "lag": 40000 },
          { "partition": 2, "lag": 5000 }
        ]
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "trace-00000000-1111-2222-3333-444444444444"
}
```

---

#### 3.6.4 消费者 Lag 监控

**GET** `/api/v1/msg/stats/consumer-lag`

查询消费者组的 Lag 情况（按 Topic 和分区维度）。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `consumerGroup` | query | string | 否 | 消费者组名称，不传则查询全部 |
| `topic` | query | string | 否 | Topic 名称 |
| `broker` | query | string | 否 | 中间件类型 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "consumerGroup": "order-processor-group",
        "broker": "kafka",
        "topic": "order-events",
        "totalLag": 50000,
        "partitionLags": [
          { "partition": 0, "committedOffset": 152340, "endOffset": 157340, "lag": 5000, "consumerId": "consumer-1" },
          { "partition": 1, "committedOffset": 148920, "endOffset": 188920, "lag": 40000, "consumerId": "consumer-2" },
          { "partition": 2, "committedOffset": 150100, "endOffset": 155100, "lag": 5000, "consumerId": "consumer-3" },
          { "partition": 3, "committedOffset": 151200, "endOffset": 151200, "lag": 0, "consumerId": "consumer-1" },
          { "partition": 4, "committedOffset": 149800, "endOffset": 149800, "lag": 0, "consumerId": "consumer-2" },
          { "partition": 5, "committedOffset": 150500, "endOffset": 150500, "lag": 0, "consumerId": "consumer-3" }
        ],
        "lastUpdated": "2026-07-16T10:30:00.000Z"
      }
    ]
  },
  "traceId": "trace-11111111-2222-3333-4444-555555555555"
}
```

---

#### 3.6.5 配置积压告警规则

**POST** `/api/v1/msg/stats/backlog-alerts/rules`

为 Topic/消费者组配置积压告警阈值规则。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `name` | body | string | 是 | 规则名称 |
| `broker` | body | string | 是 | 中间件类型 |
| `topic` | body | string | 是 | Topic 名称 |
| `consumerGroup` | body | string | 否 | 消费者组名称，不传则所有消费者组 |
| `lagThreshold` | body | long | 是 | Lag 告警阈值 |
| `timeThresholdMs` | body | long | 否 | 持续超过阈值的时间（毫秒），默认 0（立即告警） |
| `severity` | body | string | 否 | 告警级别: `WARNING` / `CRITICAL`，默认 `WARNING` |
| `notifyChannels` | body | array | 否 | 通知渠道: `email` / `webhook` / `feishu` |
| `webhookUrl` | body | string | 否 | Webhook 通知 URL |
| `enabled` | body | boolean | 否 | 是否启用，默认 `true` |

**请求示例**

```json
{
  "name": "order-events-lag-alert",
  "broker": "kafka",
  "topic": "order-events",
  "consumerGroup": "order-processor-group",
  "lagThreshold": 10000,
  "timeThresholdMs": 60000,
  "severity": "CRITICAL",
  "notifyChannels": ["feishu", "webhook"],
  "webhookUrl": "https://hooks.metaplatform.internal/alerts/msg"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "rule-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "name": "order-events-lag-alert",
    "broker": "kafka",
    "topic": "order-events",
    "consumerGroup": "order-processor-group",
    "lagThreshold": 10000,
    "timeThresholdMs": 60000,
    "severity": "CRITICAL",
    "notifyChannels": ["feishu", "webhook"],
    "webhookUrl": "https://hooks.metaplatform.internal/alerts/msg",
    "enabled": true,
    "createdAt": "2026-07-16T10:30:00.000Z"
  },
  "traceId": "trace-22222222-3333-4444-5555-666666666666"
}
```

---

### 3.7 Outbox 管理 API

#### 3.7.1 查询 Outbox 列表

**GET** `/api/v1/msg/outbox`

查询 Outbox 表中的消息记录。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|---|
| `status` | query | string | 否 | - | 状态筛选: `PENDING` / `PROCESSING` / `DELIVERED` / `FAILED` / `DEAD` |
| `broker` | query | string | 否 | - | 中间件类型 |
| `topic` | query | string | 否 | - | Topic/Exchange 名称 |
| `aggregateId` | query | string | 否 | - | 聚合根 ID |
| `aggregateType` | query | string | 否 | - | 聚合根类型 |
| `traceId` | query | string | 否 | - | trace_id |
| `startTime` | query | string | 否 | - | 创建时间范围起始 |
| `endTime` | query | string | 否 | - | 创建时间范围结束 |
| `page` | query | integer | 否 | 1 | 页码 |
| `pageSize` | query | integer | 否 | 20 | 每页条数 |
| `sortBy` | query | string | 否 | `createdAt` | 排序字段: `createdAt` / `deliveredAt` / `retryCount` |
| `sortOrder` | query | string | 否 | `desc` | 排序方向 |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "ob-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "messageId": "msg-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "traceId": "trace-11111111-2222-3333-4444-555555555555",
        "broker": "kafka",
        "topic": "order-events",
        "partition": 3,
        "offset": 152340,
        "status": "DELIVERED",
        "aggregateId": "ORD-2026-0716-0001",
        "aggregateType": "Order",
        "retryCount": 0,
        "maxRetries": 5,
        "createdAt": "2026-07-16T10:30:00.000Z",
        "processedAt": "2026-07-16T10:30:00.200Z",
        "deliveredAt": "2026-07-16T10:30:00.500Z",
        "lastError": null
      },
      {
        "id": "ob-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "messageId": "msg-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "traceId": "trace-22222222-3333-4444-5555-666666666666",
        "broker": "kafka",
        "topic": "order-events",
        "status": "FAILED",
        "aggregateId": "ORD-2026-0716-0002",
        "aggregateType": "Order",
        "retryCount": 2,
        "maxRetries": 5,
        "createdAt": "2026-07-16T10:31:00.000Z",
        "processedAt": "2026-07-16T10:31:00.200Z",
        "deliveredAt": null,
        "lastError": "org.apache.kafka.common.errors.TimeoutException: Expiring 1 record(s) for order-events-3: 30000 ms has passed since batch creation"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20
  },
  "traceId": "trace-33333333-4444-5555-6666-777777777777"
}
```

---

#### 3.7.2 查询 Outbox 详情

**GET** `/api/v1/msg/outbox/{id}`

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | Outbox 记录 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "ob-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "messageId": "msg-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "traceId": "trace-11111111-2222-3333-4444-555555555555",
    "broker": "kafka",
    "topic": "order-events",
    "key": "order-12345",
    "partition": 3,
    "offset": 152340,
    "status": "DELIVERED",
    "payload": {
      "eventType": "OrderCreated",
      "orderId": "ORD-2026-0716-0001",
      "customerId": "CUST-001",
      "amount": 299.00
    },
    "headers": {
      "X-Trace-Id": "trace-11111111-2222-3333-4444-555555555555",
      "eventType": "OrderCreated",
      "source": "tech-ont"
    },
    "aggregateId": "ORD-2026-0716-0001",
    "aggregateType": "Order",
    "retryCount": 0,
    "maxRetries": 5,
    "createdAt": "2026-07-16T10:30:00.000Z",
    "processedAt": "2026-07-16T10:30:00.200Z",
    "deliveredAt": "2026-07-16T10:30:00.500Z",
    "lastError": null,
    "retryHistory": [],
    "scheduledAt": null
  },
  "traceId": "trace-44444444-5555-6666-7777-888888888888"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | Outbox 记录不存在 |

---

#### 3.7.3 查询 Outbox 投递状态

**GET** `/api/v1/msg/outbox/{id}/delivery-status`

查询 Outbox 消息的投递状态和投递历史。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | Outbox 记录 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "outboxId": "ob-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "messageId": "msg-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "traceId": "trace-22222222-3333-4444-5555-666666666666",
    "status": "FAILED",
    "retryCount": 2,
    "maxRetries": 5,
    "nextRetryAt": "2026-07-16T10:32:00.000Z",
    "deliveryAttempts": [
      {
        "attempt": 1,
        "startedAt": "2026-07-16T10:31:00.200Z",
        "finishedAt": "2026-07-16T10:31:30.200Z",
        "result": "FAILED",
        "errorMessage": "TimeoutException: 30000 ms has passed since batch creation",
        "durationMs": 30000
      },
      {
        "attempt": 2,
        "startedAt": "2026-07-16T10:31:32.000Z",
        "finishedAt": "2026-07-16T10:32:02.000Z",
        "result": "FAILED",
        "errorMessage": "TimeoutException: 30000 ms has passed since batch creation",
        "durationMs": 30000
      }
    ]
  },
  "traceId": "trace-55555555-6666-7777-8888-999999999999"
}
```

---

#### 3.7.4 手动重投 Outbox 消息

**POST** `/api/v1/msg/outbox/{id}/retry`

手动触发 Outbox 消息重新投递。适用于 FAILED 状态的消息。

**路径参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | Outbox 记录 ID |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `resetRetryCount` | body | boolean | 否 | 是否重置重试计数器，默认 `false` |
| `note` | body | string | 否 | 重投备注 |

**请求示例**

```json
{
  "resetRetryCount": true,
  "note": "Kafka 集群恢复后手动重投"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "outboxId": "ob-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "previousStatus": "FAILED",
    "currentStatus": "PENDING",
    "retryCount": 0,
    "scheduledAt": "2026-07-16T12:00:00.000Z",
    "message": "Outbox message has been queued for re-delivery"
  },
  "traceId": "trace-66666666-7777-8888-9999-000000000000"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40004` | Outbox 记录不存在 |
| `40901` | Outbox 记录状态为 DELIVERED 或 DEAD（DEAD 需先 resetRetryCount） |

---

#### 3.7.5 批量重投 Outbox 消息

**POST** `/api/v1/msg/outbox/batch-retry`

批量重投 Outbox 消息。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `ids` | body | array | 否 | 要重投的 Outbox ID 列表，不传则按条件批量重投 |
| `filter` | body | object | 否 | 批量重投筛选条件（ids 为空时使用） |
| `filter.status` | body | string | 否 | 状态筛选，默认 `FAILED` |
| `filter.topic` | body | string | 否 | Topic 筛选 |
| `filter.olderThan` | body | string | 否 | 重投此时间之前创建的消息 |
| `resetRetryCount` | body | boolean | 否 | 是否重置重试计数器 |

**请求示例**

```json
{
  "filter": {
    "status": "FAILED",
    "topic": "order-events",
    "olderThan": "2026-07-16T11:00:00.000Z"
  },
  "resetRetryCount": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "totalMatched": 15,
    "totalRetried": 15,
    "totalFailed": 0,
    "retriedAt": "2026-07-16T12:00:00.000Z"
  },
  "traceId": "trace-77777777-8888-9999-0000-111111111111"
}
```

---

#### 3.7.6 清理 Outbox 记录

**DELETE** `/api/v1/msg/outbox`

批量清理已完成的 Outbox 记录，释放存储空间。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `confirm` | query | string | 是 | 确认清理，必须传 `CONFIRM` |
| `status` | body | string | 否 | 清理指定状态: `DELIVERED` / `DEAD`，默认 `DELIVERED` |
| `olderThan` | body | string | 是 | 清理此时间之前的记录（ISO 8601） |
| `broker` | body | string | 否 | 中间件类型筛选 |
| `topic` | body | string | 否 | Topic 筛选 |

**请求示例**

```json
{
  "status": "DELIVERED",
  "olderThan": "2026-07-10T00:00:00.000Z"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "totalDeleted": 50000,
    "status": "DELIVERED",
    "olderThan": "2026-07-10T00:00:00.000Z",
    "deletedAt": "2026-07-16T12:00:00.000Z"
  },
  "traceId": "trace-88888888-9999-0000-1111-222222222222"
}
```

**错误场景**

| code | 场景 |
|---|---|
| `40001` | confirm 参数不为 `CONFIRM`，缺少 olderThan |

---

#### 3.7.7 查询 Outbox Relay 配置

**GET** `/api/v1/msg/outbox/relay/config`

查询 Outbox Relay 组件的当前配置参数。

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "pollIntervalMs": 500,
    "batchSize": 100,
    "maxRetries": 5,
    "retryBackoffInitialMs": 1000,
    "retryBackoffMaxMs": 60000,
    "retryBackoffMultiplier": 2.0,
    "processingTimeoutMs": 30000,
    "cleanUpEnabled": true,
    "cleanUpOlderThanDays": 30,
    "cleanUpCron": "0 0 3 * * ?",
    "instanceCount": 2,
    "status": "RUNNING"
  },
  "traceId": "trace-99999999-aaaa-bbbb-cccc-dddddddddddd"
}
```

---

#### 3.7.8 更新 Outbox Relay 配置

**PUT** `/api/v1/msg/outbox/relay/config`

更新 Outbox Relay 组件配置。部分参数需重启 Relay 生效。

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `pollIntervalMs` | body | long | 否 | 轮询间隔（毫秒） |
| `batchSize` | body | integer | 否 | 单次拉取批量大小 |
| `maxRetries` | body | integer | 否 | 最大重试次数 |
| `retryBackoffInitialMs` | body | long | 否 | 初始退避时间 |
| `retryBackoffMaxMs` | body | long | 否 | 最大退避时间 |
| `processingTimeoutMs` | body | long | 否 | 处理超时时间 |
| `cleanUpEnabled` | body | boolean | 否 | 是否启用自动清理 |
| `cleanUpOlderThanDays` | body | integer | 否 | 清理多少天前的记录 |
| `restart` | body | boolean | 否 | 是否立即重启 Relay 使配置生效 |

**请求示例**

```json
{
  "pollIntervalMs": 200,
  "batchSize": 200,
  "maxRetries": 10,
  "restart": true
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "pollIntervalMs": 200,
    "batchSize": 200,
    "maxRetries": 10,
    "restarted": true,
    "updatedAt": "2026-07-16T12:00:00.000Z"
  },
  "traceId": "trace-aaaaaaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
}
```

---

## 4. 数据模型

### 4.1 PostgreSQL 表结构

TECH-MSG 使用 PostgreSQL 存储元数据、Outbox 记录、DLQ 记录和配置信息。所有表使用 schema `msg`。

#### 4.1.1 msg_outbox（Outbox 消息表）

```sql
CREATE TABLE msg.msg_outbox (
    id              VARCHAR(36)    PRIMARY KEY,
    message_id      VARCHAR(36)    NOT NULL UNIQUE,
    trace_id        VARCHAR(64)    NOT NULL,
    broker          VARCHAR(10)    NOT NULL DEFAULT 'kafka',
    topic           VARCHAR(249),
    exchange        VARCHAR(249),
    routing_key     VARCHAR(249),
    partition_num   INTEGER,
    msg_key         VARCHAR(249),
    payload         JSONB          NOT NULL,
    headers         JSONB          DEFAULT '{}',
    aggregate_id    VARCHAR(255),
    aggregate_type  VARCHAR(100),
    status          VARCHAR(20)    NOT NULL DEFAULT 'PENDING',
    retry_count     INTEGER        NOT NULL DEFAULT 0,
    max_retries     INTEGER        NOT NULL DEFAULT 5,
    last_error      TEXT,
    scheduled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    version         BIGINT         NOT NULL DEFAULT 0
);

CREATE INDEX idx_outbox_status ON msg.msg_outbox (status, created_at);
CREATE INDEX idx_outbox_trace_id ON msg.msg_outbox (trace_id);
CREATE INDEX idx_outbox_message_id ON msg.msg_outbox (message_id);
CREATE INDEX idx_outbox_aggregate ON msg.msg_outbox (aggregate_type, aggregate_id);
CREATE INDEX idx_outbox_topic_status ON msg.msg_outbox (topic, status);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | VARCHAR(36) | Outbox 记录主键（UUID） |
| `message_id` | VARCHAR(36) | 消息唯一 ID（UUID），用于幂等去重 |
| `trace_id` | VARCHAR(64) | 链路追踪 ID（必须，与 Kafka 消息头 X-Trace-Id 对应） |
| `broker` | VARCHAR(10) | 中间件类型: `kafka` / `rabbitmq` |
| `topic` | VARCHAR(249) | Kafka Topic 名称 |
| `exchange` | VARCHAR(249) | RabbitMQ Exchange 名称 |
| `routing_key` | VARCHAR(249) | RabbitMQ 路由键 |
| `partition_num` | INTEGER | Kafka 分区号（投递后填充） |
| `msg_key` | VARCHAR(249) | Kafka 消息 Key |
| `payload` | JSONB | 消息内容（JSON） |
| `headers` | JSONB | 消息头（JSON），含 X-Trace-Id |
| `aggregate_id` | VARCHAR(255) | 聚合根 ID，关联业务实体 |
| `aggregate_type` | VARCHAR(100) | 聚合根类型 |
| `status` | VARCHAR(20) | 投递状态: `PENDING` / `PROCESSING` / `DELIVERED` / `FAILED` / `DEAD` |
| `retry_count` | INTEGER | 已重试次数 |
| `max_retries` | INTEGER | 最大重试次数 |
| `last_error` | TEXT | 最后一次投递错误信息 |
| `scheduled_at` | TIMESTAMPTZ | 延迟投递时间 |
| `created_at` | TIMESTAMPTZ | 创建时间 |
| `processed_at` | TIMESTAMPTZ | 开始处理时间 |
| `delivered_at` | TIMESTAMPTZ | 投递成功时间 |
| `updated_at` | TIMESTAMPTZ | 最后更新时间 |
| `version` | BIGINT | 乐观锁版本号 |

#### 4.1.2 msg_outbox_delivery_attempts（Outbox 投递历史表）

```sql
CREATE TABLE msg.msg_outbox_delivery_attempts (
    id              BIGSERIAL      PRIMARY KEY,
    outbox_id       VARCHAR(36)    NOT NULL REFERENCES msg.msg_outbox(id),
    attempt         INTEGER        NOT NULL,
    started_at      TIMESTAMPTZ    NOT NULL,
    finished_at     TIMESTAMPTZ,
    result          VARCHAR(20)    NOT NULL,
    error_message   TEXT,
    duration_ms     BIGINT
);

CREATE INDEX idx_attempts_outbox_id ON msg.msg_outbox_delivery_attempts (outbox_id);
```

#### 4.1.3 msg_dlq_records（DLQ 死信记录表）

```sql
CREATE TABLE msg.msg_dlq_records (
    id                  VARCHAR(36)    PRIMARY KEY,
    message_id          VARCHAR(36)    NOT NULL,
    trace_id            VARCHAR(64)    NOT NULL,
    retry_trace_id      VARCHAR(64),
    broker              VARCHAR(10)    NOT NULL,
    dlq_name            VARCHAR(255)   NOT NULL,
    original_topic      VARCHAR(249),
    original_partition  INTEGER,
    original_offset     BIGINT,
    original_queue      VARCHAR(249),
    original_routing_key VARCHAR(249),
    original_key        VARCHAR(249),
    payload             JSONB          NOT NULL,
    headers             JSONB          DEFAULT '{}',
    error_message       TEXT           NOT NULL,
    error_stack         TEXT,
    retry_count         INTEGER        NOT NULL DEFAULT 0,
    consumer_group      VARCHAR(249),
    consumer_id         VARCHAR(249),
    status              VARCHAR(20)    NOT NULL DEFAULT 'DEAD',
    resend_target       VARCHAR(249),
    resend_partition    INTEGER,
    resend_offset       BIGINT,
    resend_note         TEXT,
    dead_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    resent_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dlq_trace_id ON msg.msg_dlq_records (trace_id);
CREATE INDEX idx_dlq_message_id ON msg.msg_dlq_records (message_id);
CREATE INDEX idx_dlq_dlq_name ON msg.msg_dlq_records (dlq_name, status);
CREATE INDEX idx_dlq_original_topic ON msg.msg_dlq_records (original_topic);
CREATE INDEX idx_dlq_dead_at ON msg.msg_dlq_records (dead_at);
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | VARCHAR(36) | DLQ 记录主键（UUID） |
| `message_id` | VARCHAR(36) | 原始消息唯一 ID |
| `trace_id` | VARCHAR(64) | 原始消息的 trace_id（必须） |
| `retry_trace_id` | VARCHAR(64) | 重发时生成的新 trace_id |
| `broker` | VARCHAR(10) | 中间件类型 |
| `dlq_name` | VARCHAR(255) | DLQ Topic/Queue 名称 |
| `original_topic` | VARCHAR(249) | 原始 Kafka Topic |
| `original_partition` | INTEGER | 原始 Kafka 分区 |
| `original_offset` | BIGINT | 原始 Kafka 偏移量 |
| `original_queue` | VARCHAR(249) | 原始 RabbitMQ Queue |
| `original_routing_key` | VARCHAR(249) | 原始 RabbitMQ 路由键 |
| `original_key` | VARCHAR(249) | 原始 Kafka 消息 Key |
| `payload` | JSONB | 消息原始内容 |
| `headers` | JSONB | 消息头（含 X-Trace-Id） |
| `error_message` | TEXT | 最后一次失败的错误信息 |
| `error_stack` | TEXT | 错误堆栈 |
| `retry_count` | INTEGER | 已重试次数 |
| `consumer_group` | VARCHAR(249) | 消费者组名称 |
| `consumer_id` | VARCHAR(249) | 消费者 ID |
| `status` | VARCHAR(20) | 状态: `DEAD` / `RESENT` |
| `dead_at` | TIMESTAMPTZ | 进入 DLQ 的时间 |
| `resent_at` | TIMESTAMPTZ | 重发时间 |

#### 4.1.4 msg_dlq_retry_history（DLQ 重试历史表）

```sql
CREATE TABLE msg.msg_dlq_retry_history (
    id              BIGSERIAL      PRIMARY KEY,
    dlq_record_id   VARCHAR(36)    NOT NULL REFERENCES msg.msg_dlq_records(id),
    attempt         INTEGER        NOT NULL,
    started_at      TIMESTAMPTZ    NOT NULL,
    finished_at     TIMESTAMPTZ,
    error_message   TEXT,
    duration_ms     BIGINT
);

CREATE INDEX idx_dlq_retry_record_id ON msg.msg_dlq_retry_history (dlq_record_id);
```

#### 4.1.5 msg_topic_configs（Topic 配置元数据表）

```sql
CREATE TABLE msg.msg_topic_configs (
    id              BIGSERIAL      PRIMARY KEY,
    broker          VARCHAR(10)    NOT NULL,
    name            VARCHAR(249)   NOT NULL,
    resource_type   VARCHAR(20)    NOT NULL,
    partitions      INTEGER,
    replication_factor INTEGER,
    configs         JSONB          DEFAULT '{}',
    bindings        JSONB          DEFAULT '[]',
    description     TEXT,
    owner           VARCHAR(100),
    created_by      VARCHAR(255),
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    UNIQUE(broker, name, resource_type)
);
```

| 字段 | 说明 |
|---|---|
| `broker` | 中间件类型 |
| `name` | Topic/Exchange/Queue 名称 |
| `resource_type` | 资源类型: `topic` / `exchange` / `queue` |
| `partitions` | 分区数（Kafka Topic） |
| `replication_factor` | 副本因子（Kafka Topic） |
| `configs` | 配置项（JSON） |
| `bindings` | 绑定关系（RabbitMQ Queue，JSON 数组） |

#### 4.1.6 msg_consumer_groups（消费者组表）

```sql
CREATE TABLE msg.msg_consumer_groups (
    id                  VARCHAR(36)    PRIMARY KEY,
    name                VARCHAR(249)   NOT NULL UNIQUE,
    broker              VARCHAR(10)    NOT NULL,
    topics              JSONB          DEFAULT '[]',
    pattern             VARCHAR(249),
    queue               VARCHAR(249),
    auto_offset_reset   VARCHAR(20)    DEFAULT 'latest',
    enable_auto_commit  BOOLEAN        DEFAULT false,
    auto_commit_interval_ms BIGINT     DEFAULT 5000,
    max_poll_records    INTEGER        DEFAULT 500,
    max_poll_interval_ms BIGINT        DEFAULT 300000,
    session_timeout_ms  BIGINT         DEFAULT 45000,
    heartbeat_interval_ms BIGINT       DEFAULT 3000,
    retry_policy        JSONB          DEFAULT '{}',
    dlq_enabled         BOOLEAN        DEFAULT true,
    dlq_topic           VARCHAR(249),
    concurrency         INTEGER        DEFAULT 1,
    callback_url        VARCHAR(500),
    status              VARCHAR(20)    NOT NULL DEFAULT 'CREATED',
    description         TEXT,
    owner               VARCHAR(100),
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
```

#### 4.1.7 msg_backlog_alert_rules（积压告警规则表）

```sql
CREATE TABLE msg.msg_backlog_alert_rules (
    id                  BIGSERIAL      PRIMARY KEY,
    name                VARCHAR(249)   NOT NULL,
    broker              VARCHAR(10)    NOT NULL,
    topic               VARCHAR(249)   NOT NULL,
    consumer_group      VARCHAR(249),
    lag_threshold       BIGINT         NOT NULL,
    time_threshold_ms   BIGINT         DEFAULT 0,
    severity            VARCHAR(20)    DEFAULT 'WARNING',
    notify_channels     JSONB          DEFAULT '[]',
    webhook_url         VARCHAR(500),
    enabled             BOOLEAN        DEFAULT true,
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
```

#### 4.1.8 msg_backlog_alerts（积压告警记录表）

```sql
CREATE TABLE msg.msg_backlog_alerts (
    id              BIGSERIAL      PRIMARY KEY,
    rule_id         BIGINT         REFERENCES msg.msg_backlog_alert_rules(id),
    severity        VARCHAR(20)    NOT NULL,
    broker          VARCHAR(10)    NOT NULL,
    topic           VARCHAR(249)   NOT NULL,
    consumer_group  VARCHAR(249),
    lag             BIGINT         NOT NULL,
    threshold       BIGINT         NOT NULL,
    message         TEXT           NOT NULL,
    partition_details JSONB        DEFAULT '[]',
    triggered_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    acknowledged    BOOLEAN        DEFAULT false,
    acknowledged_by VARCHAR(255),
    acknowledged_at TIMESTAMPTZ
);

CREATE INDEX idx_alerts_acknowledged ON msg.msg_backlog_alerts (acknowledged, triggered_at);
```

#### 4.1.9 msg_message_traces（消息追踪记录表）

```sql
CREATE TABLE msg.msg_message_traces (
    id              BIGSERIAL      PRIMARY KEY,
    trace_id        VARCHAR(64)    NOT NULL,
    message_id      VARCHAR(36)    NOT NULL,
    outbox_id       VARCHAR(36),
    broker          VARCHAR(10)    NOT NULL,
    topic           VARCHAR(249)   NOT NULL,
    partition       INTEGER,
    offset          BIGINT,
    event_type      VARCHAR(50)    NOT NULL,
    event_details   JSONB          DEFAULT '{}',
    consumer_group  VARCHAR(249),
    consumer_id     VARCHAR(249),
    timestamp       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_traces_trace_id ON msg.msg_message_traces (trace_id, timestamp);
CREATE INDEX idx_traces_message_id ON msg.msg_message_traces (message_id);
CREATE INDEX idx_traces_event_type ON msg.msg_message_traces (event_type, timestamp);
```

#### 4.1.10 msg_consumer_acks（消费确认记录表）

```sql
CREATE TABLE msg.msg_consumer_acks (
    id              BIGSERIAL      PRIMARY KEY,
    message_id      VARCHAR(36)    NOT NULL,
    trace_id        VARCHAR(64)    NOT NULL,
    consumer_group  VARCHAR(249)   NOT NULL,
    consumer_id     VARCHAR(249),
    broker          VARCHAR(10)    NOT NULL,
    topic           VARCHAR(249)   NOT NULL,
    partition       INTEGER,
    offset          BIGINT,
    delivery_tag    BIGINT,
    acked           BOOLEAN        NOT NULL DEFAULT false,
    received_at     TIMESTAMPTZ,
    acked_at        TIMESTAMPTZ,
    processing_time_ms BIGINT
);

CREATE INDEX idx_acks_message_id ON msg.msg_consumer_acks (message_id);
CREATE INDEX idx_acks_trace_id ON msg.msg_consumer_acks (trace_id);
CREATE INDEX idx_acks_consumer_group ON msg.msg_consumer_acks (consumer_group, acked);
```

### 4.2 Redis 数据结构

| Key 模式 | 类型 | TTL | 说明 |
|---|---|---|---|
| `msg:consumed:{messageId}` | STRING | 24h | 消费幂等去重，SETNX 确保消息不被重复消费 |
| `msg:publish:rate:{service}` | STRING (counter) | 1m | 发布限流计数器，令牌桶算法 |
| `msg:consumer:heartbeat:{groupId}:{consumerId}` | STRING | 30s | 消费者心跳，用于存活检测 |
| `msg:topic:stats:{topic}` | HASH | 5m | Topic 实时统计数据缓存 |
| `msg:lag:cache:{groupId}` | HASH | 30s | 消费者 Lag 缓存，避免频繁查询 Kafka |
| `msg:dlq:auto-resend:lock:{dlqName}` | STRING | 5m | DLQ 自动重发分布式锁 |

---

## 5. 事件定义

### 5.1 Kafka 内部管理事件

TECH-MSG 使用内部 Kafka Topic `msg.internal.events` 发布管理事件，供监控、审计和其他服务消费。所有事件消息头必须包含 `X-Trace-Id`。

#### 5.1.1 Topic 生命周期事件

```json
{
  "eventType": "TOPIC_CREATED",
  "eventVersion": "1.0",
  "traceId": "trace-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "timestamp": "2026-07-16T10:30:00.000Z",
  "source": "tech-msg",
  "data": {
    "broker": "kafka",
    "topicName": "order-events",
    "partitions": 6,
    "replicationFactor": 3,
    "configs": {
      "retentionMs": "2592000000",
      "cleanupPolicy": "delete"
    },
    "createdBy": "admin@metaplatform.com"
  }
}
```

| eventType | 说明 |
|---|---|
| `TOPIC_CREATED` | Kafka Topic 创建 |
| `TOPIC_UPDATED` | Kafka Topic 配置更新 |
| `TOPIC_PARTITIONS_INCREASED` | Kafka Topic 分区增加 |
| `TOPIC_DELETED` | Kafka Topic 删除 |
| `EXCHANGE_CREATED` | RabbitMQ Exchange 创建 |
| `EXCHANGE_DELETED` | RabbitMQ Exchange 删除 |
| `QUEUE_CREATED` | RabbitMQ Queue 创建 |
| `QUEUE_DELETED` | RabbitMQ Queue 删除 |
| `BINDING_CREATED` | RabbitMQ Binding 创建 |
| `BINDING_DELETED` | RabbitMQ Binding 删除 |

#### 5.1.2 消费者组生命周期事件

```json
{
  "eventType": "CONSUMER_GROUP_CREATED",
  "eventVersion": "1.0",
  "traceId": "trace-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "timestamp": "2026-07-16T10:30:00.000Z",
  "source": "tech-msg",
  "data": {
    "consumerGroupName": "order-processor-group",
    "broker": "kafka",
    "topics": ["order-events"],
    "concurrency": 3,
    "dlqEnabled": true,
    "owner": "tech-ont"
  }
}
```

| eventType | 说明 |
|---|---|
| `CONSUMER_GROUP_CREATED` | 消费者组创建 |
| `CONSUMER_GROUP_UPDATED` | 消费者组配置更新 |
| `CONSUMER_GROUP_STARTED` | 消费者组启动 |
| `CONSUMER_GROUP_PAUSED` | 消费者组暂停 |
| `CONSUMER_GROUP_RESTARTED` | 消费者组重启 |
| `CONSUMER_GROUP_STOPPED` | 消费者组停止 |
| `CONSUMER_GROUP_DELETED` | 消费者组删除 |
| `CONSUMER_GROUP_OFFSET_RESET` | 消费者组偏移量重置 |

#### 5.1.3 Outbox 投递事件

```json
{
  "eventType": "OUTBOX_DELIVERED",
  "eventVersion": "1.0",
  "traceId": "trace-11111111-2222-3333-4444-555555555555",
  "timestamp": "2026-07-16T10:30:00.500Z",
  "source": "tech-msg",
  "data": {
    "outboxId": "ob-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "messageId": "msg-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "broker": "kafka",
    "topic": "order-events",
    "partition": 3,
    "offset": 152340,
    "retryCount": 0,
    "deliveryDurationMs": 500
  }
}
```

| eventType | 说明 |
|---|---|
| `OUTBOX_CREATED` | Outbox 消息创建 |
| `OUTBOX_PROCESSING_STARTED` | Outbox 开始投递处理 |
| `OUTBOX_DELIVERED` | Outbox 消息投递成功 |
| `OUTBOX_DELIVERY_FAILED` | Outbox 消息投递失败（重试中） |
| `OUTBOX_DEAD` | Outbox 消息投递失败且超过最大重试次数 |
| `OUTBOX_RETRY` | Outbox 消息手动/自动重投 |

#### 5.1.4 DLQ 事件

```json
{
  "eventType": "MESSAGE_DEAD_LETTERED",
  "eventVersion": "1.0",
  "traceId": "trace-11111111-2222-3333-4444-555555555555",
  "timestamp": "2026-07-16T09:30:00.000Z",
  "source": "tech-msg",
  "data": {
    "dlqRecordId": "dlq-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "messageId": "msg-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "broker": "kafka",
    "originalTopic": "order-events",
    "dlqName": "order-events.dlq",
    "consumerGroup": "order-processor-group",
    "retryCount": 3,
    "errorMessage": "NullPointerException: Cannot invoke method on null object"
  }
}
```

| eventType | 说明 |
|---|---|
| `MESSAGE_DEAD_LETTERED` | 消息进入死信队列 |
| `DLQ_MESSAGE_RESENT` | 死信消息重发 |
| `DLQ_MESSAGE_PURGED` | 死信消息清理 |
| `DLQ_RETRY_POLICY_UPDATED` | DLQ 重试策略更新 |

#### 5.1.5 告警事件

```json
{
  "eventType": "BACKLOG_ALERT_TRIGGERED",
  "eventVersion": "1.0",
  "traceId": "trace-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "timestamp": "2026-07-16T10:25:00.000Z",
  "source": "tech-msg",
  "data": {
    "alertId": "alert-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "severity": "CRITICAL",
    "broker": "kafka",
    "topic": "order-events",
    "consumerGroup": "order-processor-group",
    "lag": 50000,
    "threshold": 10000,
    "partitionDetails": [
      { "partition": 0, "lag": 5000 },
      { "partition": 1, "lag": 40000 }
    ]
  }
}
```

| eventType | 说明 |
|---|---|
| `BACKLOG_ALERT_TRIGGERED` | 积压告警触发 |
| `BACKLOG_ALERT_ACKNOWLEDGED` | 积压告警被确认 |
| `BACKLOG_ALERT_RESOLVED` | 积压告警自动恢复 |

### 5.2 消息头规范

所有 Kafka 消息和 RabbitMQ 消息必须包含以下标准消息头：

| 消息头 | Kafka Header Key | RabbitMQ Header Key | 说明 |
|---|---|---|---|
| trace_id | `X-Trace-Id` | `X-Trace-Id` | 链路追踪 ID（必须） |
| message_id | `X-Message-Id` | `X-Message-Id` | 消息唯一 ID |
| source | `X-Source` | `X-Source` | 消息来源服务 |
| event_type | `X-Event-Type` | `X-Event-Type` | 事件类型 |
| timestamp | `X-Timestamp` | `X-Timestamp` | 消息时间戳（毫秒） |
| version | `X-Version` | `X-Version` | 消息格式版本 |

---

## 6. 增量交付计划

### 6.1 Phase 1 - 基础能力（MVP）

**目标**：实现消息发布与订阅的核心能力，支撑平台基本消息通信需求。

| 序号 | 交付项 | API 接口 | 优先级 |
|---|---|---|---|
| 1 | Kafka Topic CRUD | 3.1.1 - 3.1.6 | P0 |
| 2 | RabbitMQ Exchange/Queue CRUD | 3.1.7 - 3.1.15 | P0 |
| 3 | 统一消息发布（直发） | 3.2.1 | P0 |
| 4 | Outbox 消息创建 | 3.2.2, 3.2.3 | P0 |
| 5 | Outbox Relay 核心投递 | 内部组件 | P0 |
| 6 | 消费者组 CRUD | 3.3.1 - 3.3.6 | P0 |
| 7 | 消费确认 | 3.3.7 | P0 |
| 8 | PostgreSQL 表结构初始化 | 4.1.1 - 4.1.6 | P0 |
| 9 | trace_id 传播机制 | 全链路 | P0 |

**Phase 1 验收标准**：
- 业务服务可通过 Outbox 模式可靠发布消息
- Outbox Relay 正确投递消息至 Kafka/RabbitMQ
- 消费者组可正常消费消息并手动提交偏移
- Kafka 消息头包含 `X-Trace-Id`

### 6.2 Phase 2 - 可靠性增强

**目标**：实现 DLQ 机制和消息追踪能力，提供消息可靠性保障。

| 序号 | 交付项 | API 接口 | 优先级 |
|---|---|---|---|
| 1 | DLQ 机制（Kafka + RabbitMQ） | 内部组件 | P0 |
| 2 | DLQ 列表与详情查询 | 3.4.1 - 3.4.3 | P0 |
| 3 | 死信消息重发 | 3.4.4, 3.4.5 | P0 |
| 4 | DLQ 重试策略配置 | 3.4.6 | P1 |
| 5 | DLQ 清理 | 3.4.7 | P1 |
| 6 | 消息追踪（按 trace_id） | 3.5.1, 3.5.2 | P0 |
| 7 | 消息搜索与详情 | 3.5.3, 3.5.4 | P1 |
| 8 | 偏移量管理 | 3.3.8, 3.3.9 | P1 |
| 9 | DLQ 记录表与重试历史表 | 4.1.3 - 4.1.4 | P0 |
| 10 | 消息追踪记录表 | 4.1.9 | P1 |
| 11 | 消费确认记录表 | 4.1.10 | P1 |

**Phase 2 验收标准**：
- 消费失败的消息在重试 3 次后自动进入 DLQ
- DLQ 记录包含 `traceId` 字段
- 死信消息可手动重发至原始 Topic
- 可通过 trace_id 查询消息完整生命周期

### 6.3 Phase 3 - 运维与监控

**目标**：提供完善的监控统计和运维管理能力。

| 序号 | 交付项 | API 接口 | 优先级 |
|---|---|---|---|
| 1 | 流量统计 | 3.6.1 | P1 |
| 2 | 延迟监控 | 3.6.2 | P1 |
| 3 | 消费者 Lag 监控 | 3.6.4 | P0 |
| 4 | 积压告警查询 | 3.6.3 | P1 |
| 5 | 积压告警规则配置 | 3.6.5 | P2 |
| 6 | Outbox 管理增强 | 3.7.1 - 3.7.6 | P1 |
| 7 | Outbox Relay 配置管理 | 3.7.7, 3.7.8 | P2 |
| 8 | 告警规则与记录表 | 4.1.7 - 4.1.8 | P1 |
| 9 | Redis 幂等去重与限流 | 4.2 | P1 |
| 10 | 内部管理事件发布 | 5.1 | P2 |

**Phase 3 验收标准**：
- 可查看 Topic/Queue 的实时流量与延迟
- 消费者 Lag 超过阈值时自动触发告警
- Outbox 表可通过 API 管理和清理
- 消费幂等去重通过 Redis 正常工作

### 6.4 Phase 4 - 高级特性

**目标**：提供高级特性，支撑大规模生产运维。

| 序号 | 交付项 | 说明 | 优先级 |
|---|---|---|---|
| 1 | 消息延迟投递 | Outbox scheduled_at 支持 | P2 |
| 2 | DLQ 自动重发 | 定时自动重发 DLQ 消息 | P2 |
| 3 | 消息压缩 | Kafka 消息压缩配置 | P3 |
| 4 | 多集群支持 | Kafka/RabbitMQ 多集群管理 | P3 |
| 5 | 消息 Schema Registry | Avro/Protobuf Schema 管理 | P3 |
| 6 | Webhook 消费模式 | 消费者通过 HTTP Webhook 接收消息 | P3 |
| 7 | 消息回溯 | 按时间戳回溯消费 | P3 |
| 8 | 灰度发布 | Topic 灰度路由 | P3 |

### 6.5 交付时间线

| Phase | 预计周期 | 里程碑 |
|---|---|---|
| Phase 1 | 4 周 | MVP 可用，支撑基本消息通信 |
| Phase 2 | 3 周 | DLQ 和追踪能力上线 |
| Phase 3 | 3 周 | 监控告警体系完善 |
| Phase 4 | 持续迭代 | 高级特性按需交付 |

---

## 附录 A: API 接口汇总

| 序号 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 3.1.1 | POST | `/api/v1/msg/topics/kafka` | 创建 Kafka Topic |
| 3.1.2 | GET | `/api/v1/msg/topics/kafka` | 查询 Kafka Topic 列表 |
| 3.1.3 | GET | `/api/v1/msg/topics/kafka/{name}` | 查询 Kafka Topic 详情 |
| 3.1.4 | PUT | `/api/v1/msg/topics/kafka/{name}/configs` | 更新 Kafka Topic 配置 |
| 3.1.5 | POST | `/api/v1/msg/topics/kafka/{name}/partitions` | 增加 Kafka Topic 分区 |
| 3.1.6 | DELETE | `/api/v1/msg/topics/kafka/{name}` | 删除 Kafka Topic |
| 3.1.7 | POST | `/api/v1/msg/exchanges` | 创建 RabbitMQ Exchange |
| 3.1.8 | GET | `/api/v1/msg/exchanges` | 查询 Exchange 列表 |
| 3.1.9 | DELETE | `/api/v1/msg/exchanges/{name}` | 删除 Exchange |
| 3.1.10 | POST | `/api/v1/msg/queues` | 创建 RabbitMQ Queue |
| 3.1.11 | GET | `/api/v1/msg/queues` | 查询 Queue 列表 |
| 3.1.12 | GET | `/api/v1/msg/queues/{name}` | 查询 Queue 详情 |
| 3.1.13 | DELETE | `/api/v1/msg/queues/{name}` | 删除 Queue |
| 3.1.14 | POST | `/api/v1/msg/bindings` | 创建 Binding |
| 3.1.15 | DELETE | `/api/v1/msg/bindings` | 删除 Binding |
| 3.2.1 | POST | `/api/v1/msg/messages/publish` | 统一消息发布 |
| 3.2.2 | POST | `/api/v1/msg/outbox/messages` | 创建 Outbox 消息 |
| 3.2.3 | POST | `/api/v1/msg/outbox/messages/batch` | 批量创建 Outbox 消息 |
| 3.2.4 | GET | `/api/v1/msg/messages/{messageId}/status` | 查询消息发布状态 |
| 3.2.5 | GET | `/api/v1/msg/messages/{messageId}/acks` | 查询消息发布确认 |
| 3.3.1 | POST | `/api/v1/msg/consumer-groups` | 创建消费者组 |
| 3.3.2 | GET | `/api/v1/msg/consumer-groups` | 查询消费者组列表 |
| 3.3.3 | GET | `/api/v1/msg/consumer-groups/{name}` | 查询消费者组详情 |
| 3.3.4 | PUT | `/api/v1/msg/consumer-groups/{name}` | 更新消费者组配置 |
| 3.3.5 | POST | `/api/v1/msg/consumer-groups/{name}/action` | 启动/暂停消费者组 |
| 3.3.6 | DELETE | `/api/v1/msg/consumer-groups/{name}` | 删除消费者组 |
| 3.3.7 | POST | `/api/v1/msg/consumer-groups/{name}/acks` | 提交消费确认 |
| 3.3.8 | POST | `/api/v1/msg/consumer-groups/{name}/offsets/reset` | 重置消费者偏移量 |
| 3.3.9 | GET | `/api/v1/msg/consumer-groups/{name}/offsets` | 查询消费者组偏移量 |
| 3.4.1 | GET | `/api/v1/msg/dlq` | 查询死信队列列表 |
| 3.4.2 | GET | `/api/v1/msg/dlq/{dlqName}/messages` | 查询死信消息列表 |
| 3.4.3 | GET | `/api/v1/msg/dlq/messages/{id}` | 查询死信消息详情 |
| 3.4.4 | POST | `/api/v1/msg/dlq/messages/{id}/resend` | 重发死信消息 |
| 3.4.5 | POST | `/api/v1/msg/dlq/{dlqName}/messages/batch-resend` | 批量重发死信消息 |
| 3.4.6 | PUT | `/api/v1/msg/dlq/{dlqName}/retry-policy` | 配置重试策略 |
| 3.4.7 | DELETE | `/api/v1/msg/dlq/{dlqName}/messages` | 清理 DLQ 消息 |
| 3.5.1 | GET | `/api/v1/msg/traces/{traceId}` | 按 trace_id 查询消息 |
| 3.5.2 | GET | `/api/v1/msg/traces/{traceId}/timeline` | 查询消息全链路 |
| 3.5.3 | POST | `/api/v1/msg/messages/search` | 消息搜索 |
| 3.5.4 | GET | `/api/v1/msg/messages/{messageId}` | 查询消息详情 |
| 3.6.1 | GET | `/api/v1/msg/stats/traffic` | 流量统计 |
| 3.6.2 | GET | `/api/v1/msg/stats/latency` | 延迟监控 |
| 3.6.3 | GET | `/api/v1/msg/stats/backlog-alerts` | 积压告警查询 |
| 3.6.4 | GET | `/api/v1/msg/stats/consumer-lag` | 消费者 Lag 监控 |
| 3.6.5 | POST | `/api/v1/msg/stats/backlog-alerts/rules` | 配置积压告警规则 |
| 3.7.1 | GET | `/api/v1/msg/outbox` | 查询 Outbox 列表 |
| 3.7.2 | GET | `/api/v1/msg/outbox/{id}` | 查询 Outbox 详情 |
| 3.7.3 | GET | `/api/v1/msg/outbox/{id}/delivery-status` | 查询 Outbox 投递状态 |
| 3.7.4 | POST | `/api/v1/msg/outbox/{id}/retry` | 手动重投 Outbox 消息 |
| 3.7.5 | POST | `/api/v1/msg/outbox/batch-retry` | 批量重投 Outbox 消息 |
| 3.7.6 | DELETE | `/api/v1/msg/outbox` | 清理 Outbox 记录 |
| 3.7.7 | GET | `/api/v1/msg/outbox/relay/config` | 查询 Outbox Relay 配置 |
| 3.7.8 | PUT | `/api/v1/msg/outbox/relay/config` | 更新 Outbox Relay 配置 |

---

## 附录 B: 关键工程约束对照表

| 约束 | 实现位置 | 说明 |
|---|---|---|
| Kafka 消息发布必须使用 Outbox 模式 | 2.6, 3.2.2, 4.1.1 | 业务服务写入 Outbox 表，Relay 异步投递 |
| 事件消费必须支持 DLQ，重试 3 次 | 2.7, 3.4, 4.1.3 | 默认重试 3 次（1s/5s/30s），超限进入 DLQ |
| trace_id 必须在所有系统组件间传播 | 2.5, 5.2 | Outbox → Kafka Header X-Trace-Id → Consumer → DLQ |
| Kafka 消息头包含 X-Trace-Id | 2.5, 5.2 | Outbox Relay 投递时写入消息头 |
| DLQ 记录必须包含 traceId 字段 | 2.7.5, 4.1.3 | msg_dlq_records.trace_id 字段 NOT NULL |

---

*文档结束*
