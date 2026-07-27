# SPEC - 数据集成与 ETL 服务 API 规范（TECH-DATA）

> 文档版本：v1.0
> 发布日期：2026-07-16
> 服务模块：TECH-DATA（数据集成与 ETL 服务）
> 包名：`tech_data`
> API 路径前缀：`/api/v1/data`
> 维护团队：Mate Platform 数据平台组

---

## 目录

- [1. 服务概述](#1-服务概述)
- [2. 通用约定](#2-通用约定)
- [3. API 接口详情](#3-api-接口详情)
  - [3.1 数据源管理 API](#31-数据源管理-api)
  - [3.2 CDC 实时同步 API](#32-cdc-实时同步-api)
  - [3.3 ETL/ELT 任务 API](#33-etlelt-任务-api)
  - [3.4 数据湖管理 API](#34-数据湖管理-api)
  - [3.5 数据仓库 API](#35-数据仓库-api)
  - [3.6 数据目录 API](#36-数据目录-api)
  - [3.7 数据质量 API](#37-数据质量-api)
  - [3.8 任务监控 API](#38-任务监控-api)
- [4. 数据模型](#4-数据模型)
- [5. 事件定义](#5-事件定义)
- [6. 增量交付计划](#6-增量交付计划)

---

## 1. 服务概述

### 1.1 服务定位

TECH-DATA 是 Mate Platform 的数据集成与 ETL 服务，负责将外围系统数据转化为平台可理解的资产。它是平台数据供应链的入口和核心管道，承接从外部异构数据源到平台内部数据湖、数据仓库的全链路数据流转。

核心职责：

| 序号 | 能力域 | 说明 |
|------|--------|------|
| 1 | 数据源管理 | 外部数据库、API、文件数据源接入，连接配置，测试连接 |
| 2 | CDC 实时同步 | 基于 Flink CDC 的实时数据变更捕获，CDC 任务配置与管理 |
| 3 | ETL/ELT 任务 | 基于 Airflow 的批量 ETL 任务编排，DBT 数仓建模，任务调度 |
| 4 | 数据湖管理 | Hudi/Iceberg 表管理，数据入湖（DeltaStreamer/upsert），湖表查询 |
| 5 | 数据仓库 | StarRocks OLAP 查询，数仓分层（ODS/DWD/DWS/ADS），物化视图 |
| 6 | 数据目录 | 数据资产目录，元数据管理，数据血缘追踪 |
| 7 | 数据质量 | 数据质量规则，质量监控，质量报告 |
| 8 | 任务监控 | ETL 任务运行状态，SLA 监控，失败告警 |

### 1.2 技术栈

| 层级 | 技术选型 | 用途 |
|------|----------|------|
| 服务框架 | Python 3.13 + FastAPI | REST API 服务 |
| 流处理 | Apache Flink 1.20 + Flink CDC | 实时数据变更捕获与同步 |
| 批处理 | Apache Airflow 2.10 | 批量 ETL 任务编排与调度 |
| 数仓建模 | DBT 1.9 | 数据仓库分层建模、转换逻辑管理 |
| 数据湖（主） | Apache Hudi 1.x | CDC/upsert 场景，DeltaStreamer 入湖，MoR 模式 |
| 数据湖（备） | Apache Iceberg 1.8 | 追加场景，时间旅行，Schema 演化 |
| OLAP | StarRocks 3.4 | 实时 OLAP 查询，多模型，物化视图 |
| 消息队列 | Kafka 3.9 | CDC 数据管道、事件通知 |
| 元数据存储 | PostgreSQL 17 | 数据源配置、任务元数据、质量规则 |
| 对象存储 | MinIO | 数据湖底层存储 |

### 1.3 上下游关系

```
                   ┌─────────────────────────────────────────────┐
                   │              外部数据源                      │
                   │  MySQL / PostgreSQL / Oracle / SQL Server   │
                   │  MongoDB / REST API / CSV / Parquet / S3    │
                   └────────────────────┬────────────────────────┘
                                        │ CDC / 批量抽取
                                        ▼
┌──────────────┐              ┌─────────────────┐              ┌──────────────┐
│   TECH-MSG   │◄───事件──── │    TECH-DATA    │ ──数据资产──► │   TECH-ONT   │
│ (消息队列)    │              │  (本服务)        │ ──文档切片──► │   TECH-RAG   │
└──────────────┘              └────────┬────────┘              └──────────────┘
                                       │
                          ┌────────────┼────────────┐
                          ▼            ▼            ▼
                   ┌──────────┐ ┌──────────┐ ┌──────────────┐
                   │  Hudi    │ │ Iceberg  │ │  StarRocks   │
                   │ (数据湖)  │ │ (数据湖)  │ │  (OLAP数仓)   │
                   └──────────┘ └──────────┘ └──────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │ APP-ONTSTUDIO   │
                              │ (本体论引擎前端)  │
                              └─────────────────┘
```

**上游依赖：**
- 外部数据源：MySQL、PostgreSQL、Oracle、SQL Server、MongoDB、REST API、文件（CSV/Parquet/JSON）、S3/MinIO
- TECH-MSG：消费 Kafka 中的控制指令，发布数据同步事件

**下游消费：**
- TECH-ONT：将数据资产注册为本体引擎的数据节点，作为平台唯一数据真相源的物理层
- TECH-RAG：将文档类数据切片后供 RAG 引擎检索
- APP-ONTSTUDIO：在本体论引擎前端展示数据资产目录、血缘、质量信息

### 1.4 服务端口与部署

| 配置项 | 值 |
|--------|-----|
| 服务端口 | 8090 |
| 健康检查 | `/api/v1/data/health` |
| API 文档 | `/api/v1/data/docs`（FastAPI Swagger UI） |
| OpenAPI JSON | `/api/v1/data/openapi.json` |
| 部署方式 | Kubernetes Pod（tek_data 服务） |

---

## 2. 通用约定

### 2.1 路径前缀

所有 API 路径统一前缀：`/api/v1/data`

示例：数据源列表接口完整路径为 `/api/v1/data/datasources`

### 2.2 统一响应体

所有接口返回统一的 JSON 响应结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    // 业务数据，对象或数组
  },
  "traceId": "trace-a1b2c3d4e5f6"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | integer | 业务状态码，`0` 表示成功，非 `0` 表示失败 |
| `message` | string | 状态描述信息 |
| `data` | object/array/null | 业务数据，失败时为 `null` |
| `traceId` | string | 链路追踪 ID，用于全链路日志关联 |

分页响应的 `data` 结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  },
  "traceId": "trace-a1b2c3d4e5f6"
}
```

### 2.3 认证

| 认证方式 | 说明 |
|----------|------|
| Bearer Token | 请求头 `Authorization: Bearer <JWT_TOKEN>`，由 TECH-IAM 签发 |
| API Key | 请求头 `X-API-Key: <key>`，用于服务间调用（M2M） |
| 租户标识 | 请求头 `X-Tenant-Id: <tenant_id>`，多租户隔离 |

### 2.4 错误码

| code | HTTP Status | 说明 | 典型场景 |
|------|-------------|------|----------|
| 0 | 200 | 成功 | 正常请求 |
| 40001 | 400 | 参数校验失败 | 必填参数缺失、格式错误 |
| 40101 | 401 | 未认证 | Token 缺失或过期 |
| 40301 | 403 | 无权限 | 当前用户无操作权限 |
| 40401 | 404 | 资源不存在 | 数据源/任务/表不存在 |
| 40901 | 409 | 资源冲突 | 名称重复、状态冲突 |
| 42201 | 422 | 业务规则冲突 | 数据源正在使用中无法删除 |
| 42901 | 429 | 请求过于频繁 | 触发限流 |
| 50001 | 500 | 服务内部错误 | 未捕获异常 |
| 50002 | 500 | 数据源连接失败 | 数据库连接超时/认证失败 |
| 50003 | 500 | 任务执行失败 | ETL/CDC 任务运行异常 |
| 50004 | 500 | 数据湖操作失败 | Hudi/Iceberg 表操作异常 |
| 50005 | 500 | OLAP 查询失败 | StarRocks 查询执行异常 |
| 50301 | 503 | 服务不可用 | 依赖组件（Flink/Airflow/StarRocks）不可用 |

错误响应示例：

```json
{
  "code": 40401,
  "message": "数据源不存在: ds-001",
  "data": null,
  "traceId": "trace-a1b2c3d4e5f6"
}
```

### 2.5 分页参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | integer | 1 | 页码，从 1 开始 |
| `pageSize` | integer | 20 | 每页条数，最大 100 |
| `sortBy` | string | `createdAt` | 排序字段 |
| `sortOrder` | string | `desc` | 排序方向：`asc`/`desc` |
| `keyword` | string | - | 名称模糊搜索关键词 |
| `status` | string | - | 状态过滤 |

### 2.6 trace_id 传播

遵循平台 P3 双向同步约束：

- 所有 HTTP 请求头须包含 `X-Trace-Id`，未提供时服务自动生成
- 所有 Kafka 消息头包含 `X-Trace-Id` 字段
- 所有日志输出包含 `trace_id` 字段
- 响应体中 `traceId` 字段回传给调用方
- CDC/ETL 任务执行日志关联 `trace_id`

### 2.7 Outbox 模式与 DLQ

遵循平台工程约束：

- Kafka 消息发布使用 **Outbox 模式**：先写 PostgreSQL outbox 表，再由轮询任务投递到 Kafka，确保数据不丢
- 事件消费支持 **DLQ（Dead Letter Queue）**：消费失败重试 3 次，超过后进入 `tech_data.dlq` topic
- DLQ 记录包含 `traceId`、`originalTopic`、`errorReason`、`payload` 字段

---

## 3. API 接口详情

> 以下接口如无特殊说明，均需要 `Authorization` 请求头。
> 请求体 Content-Type 统一为 `application/json`。
> 路径中的 `{id}` 为资源唯一标识。

### 3.1 数据源管理 API

数据源管理提供外部数据源的注册、配置、连接测试和 Schema 发现能力。

#### 3.1.1 获取数据源类型列表

获取平台支持的所有数据源类型。

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/datasources/types` |
| **认证** | Bearer Token |
| **权限** | `data:datasource:read` |

**请求参数：** 无

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "types": [
      {
        "type": "mysql",
        "name": "MySQL",
        "category": "database",
        "supportsCDC": true,
        "supportsBatch": true,
        "defaultPort": 3306,
        "connectionParams": ["host", "port", "database", "username", "password", "sslMode"],
        "version": "5.7+"
      },
      {
        "type": "postgresql",
        "name": "PostgreSQL",
        "category": "database",
        "supportsCDC": true,
        "supportsBatch": true,
        "defaultPort": 5432,
        "connectionParams": ["host", "port", "database", "username", "password", "sslMode"],
        "version": "10+"
      },
      {
        "type": "oracle",
        "name": "Oracle",
        "category": "database",
        "supportsCDC": true,
        "supportsBatch": true,
        "defaultPort": 1521,
        "connectionParams": ["host", "port", "serviceName", "username", "password"],
        "version": "11g+"
      },
      {
        "type": "sqlserver",
        "name": "SQL Server",
        "category": "database",
        "supportsCDC": true,
        "supportsBatch": true,
        "defaultPort": 1433,
        "connectionParams": ["host", "port", "database", "username", "password"],
        "version": "2016+"
      },
      {
        "type": "mongodb",
        "name": "MongoDB",
        "category": "database",
        "supportsCDC": true,
        "supportsBatch": true,
        "defaultPort": 27017,
        "connectionParams": ["host", "port", "database", "username", "password", "replicaSet"],
        "version": "4.0+"
      },
      {
        "type": "rest_api",
        "name": "REST API",
        "category": "api",
        "supportsCDC": false,
        "supportsBatch": true,
        "defaultPort": 443,
        "connectionParams": ["baseUrl", "authType", "headers", "timeout"],
        "version": "-"
      },
      {
        "type": "file_csv",
        "name": "CSV 文件",
        "category": "file",
        "supportsCDC": false,
        "supportsBatch": true,
        "defaultPort": null,
        "connectionParams": ["filePath", "delimiter", "encoding", "hasHeader"],
        "version": "-"
      },
      {
        "type": "file_parquet",
        "name": "Parquet 文件",
        "category": "file",
        "supportsCDC": false,
        "supportsBatch": true,
        "defaultPort": null,
        "connectionParams": ["filePath"],
        "version": "-"
      },
      {
        "type": "s3",
        "name": "S3 / MinIO",
        "category": "object_storage",
        "supportsCDC": false,
        "supportsBatch": true,
        "defaultPort": 9000,
        "connectionParams": ["endpoint", "bucket", "accessKey", "secretKey", "region"],
        "version": "-"
      },
      {
        "type": "kafka",
        "name": "Kafka",
        "category": "streaming",
        "supportsCDC": false,
        "supportsBatch": false,
        "defaultPort": 9092,
        "connectionParams": ["brokers", "topic", "groupId", "securityProtocol"],
        "version": "2.x+"
      }
    ]
  },
  "traceId": "trace-001"
}
```

**错误场景：** 无特殊错误场景。

---

#### 3.1.2 创建数据源

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/datasources` |
| **认证** | Bearer Token |
| **权限** | `data:datasource:write` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 数据源名称，租户内唯一，1-100 字符 |
| `type` | string | 是 | 数据源类型，见 3.1.1 返回的 `type` 值 |
| `description` | string | 否 | 数据源描述，最多 500 字符 |
| `category` | string | 是 | 数据源分类：`database`/`api`/`file`/`object_storage`/`streaming` |
| `connectionConfig` | object | 是 | 连接配置，结构取决于 `type`，敏感字段加密存储 |
| `tags` | string[] | 否 | 标签列表 |
| `ownerId` | string | 是 | 负责人用户 ID |

**请求示例（MySQL）：**

```json
{
  "name": "业务系统主库",
  "type": "mysql",
  "description": "核心业务系统 MySQL 主库",
  "category": "database",
  "connectionConfig": {
    "host": "10.0.1.100",
    "port": 3306,
    "database": "biz_core",
    "username": "data_reader",
    "password": "********",
    "sslMode": "preferred"
  },
  "tags": ["production", "core"],
  "ownerId": "user-001"
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "datasourceId": "ds-20260716-0001",
    "name": "业务系统主库",
    "type": "mysql",
    "category": "database",
    "description": "核心业务系统 MySQL 主库",
    "connectionConfig": {
      "host": "10.0.1.100",
      "port": 3306,
      "database": "biz_core",
      "username": "data_reader",
      "password": "******",
      "sslMode": "preferred"
    },
    "tags": ["production", "core"],
    "ownerId": "user-001",
    "status": "created",
    "connectionStatus": "untested",
    "createdAt": "2026-07-16T10:00:00Z",
    "updatedAt": "2026-07-16T10:00:00Z"
  },
  "traceId": "trace-002"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40001 | `name` 为空或超长；`type` 不在支持列表中；`connectionConfig` 缺少必填字段 |
| 40901 | 同租户下数据源名称已存在 |
| 50001 | 密钥加密服务异常 |

---

#### 3.1.3 获取数据源列表

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/datasources` |
| **认证** | Bearer Token |
| **权限** | `data:datasource:read` |

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | integer | 否 | 页码，默认 1 |
| `pageSize` | integer | 否 | 每页条数，默认 20 |
| `keyword` | string | 否 | 名称模糊搜索 |
| `type` | string | 否 | 数据源类型过滤 |
| `category` | string | 否 | 分类过滤 |
| `status` | string | 否 | 状态过滤：`created`/`active`/`disabled` |
| `connectionStatus` | string | 否 | 连接状态：`connected`/`disconnected`/`untested`/`error` |
| `tag` | string | 否 | 标签过滤 |
| `sortBy` | string | 否 | 排序字段，默认 `createdAt` |
| `sortOrder` | string | 否 | `asc`/`desc`，默认 `desc` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "datasourceId": "ds-20260716-0001",
        "name": "业务系统主库",
        "type": "mysql",
        "category": "database",
        "description": "核心业务系统 MySQL 主库",
        "tags": ["production", "core"],
        "ownerId": "user-001",
        "ownerName": "张三",
        "status": "active",
        "connectionStatus": "connected",
        "lastConnectedAt": "2026-07-16T09:55:00Z",
        "createdAt": "2026-07-16T10:00:00Z",
        "updatedAt": "2026-07-16T10:05:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "trace-003"
}
```

---

#### 3.1.4 获取数据源详情

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/datasources/{datasourceId}` |
| **认证** | Bearer Token |
| **权限** | `data:datasource:read` |

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `datasourceId` | string | 数据源 ID |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "datasourceId": "ds-20260716-0001",
    "name": "业务系统主库",
    "type": "mysql",
    "category": "database",
    "description": "核心业务系统 MySQL 主库",
    "connectionConfig": {
      "host": "10.0.1.100",
      "port": 3306,
      "database": "biz_core",
      "username": "data_reader",
      "password": "******",
      "sslMode": "preferred"
    },
    "tags": ["production", "core"],
    "ownerId": "user-001",
    "ownerName": "张三",
    "status": "active",
    "connectionStatus": "connected",
    "lastConnectedAt": "2026-07-16T09:55:00Z",
    "statistics": {
      "tableCount": 156,
      "cdcTaskCount": 3,
      "etlTaskCount": 8
    },
    "createdAt": "2026-07-16T10:00:00Z",
    "updatedAt": "2026-07-16T10:05:00Z"
  },
  "traceId": "trace-004"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 数据源 ID 不存在 |

---

#### 3.1.5 更新数据源

| 项目 | 说明 |
|------|------|
| **方法** | `PUT` |
| **路径** | `/api/v1/data/datasources/{datasourceId}` |
| **认证** | Bearer Token |
| **权限** | `data:datasource:write` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 否 | 数据源名称 |
| `description` | string | 否 | 描述 |
| `connectionConfig` | object | 否 | 连接配置（部分更新） |
| `tags` | string[] | 否 | 标签 |
| `status` | string | 否 | 状态：`active`/`disabled` |

**请求示例：**

```json
{
  "description": "更新后的描述信息",
  "connectionConfig": {
    "host": "10.0.1.101",
    "port": 3306
  },
  "status": "active"
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "datasourceId": "ds-20260716-0001",
    "name": "业务系统主库",
    "type": "mysql",
    "category": "database",
    "description": "更新后的描述信息",
    "connectionConfig": {
      "host": "10.0.1.101",
      "port": 3306,
      "database": "biz_core",
      "username": "data_reader",
      "password": "******",
      "sslMode": "preferred"
    },
    "tags": ["production", "core"],
    "status": "active",
    "updatedAt": "2026-07-16T10:10:00Z"
  },
  "traceId": "trace-005"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 数据源不存在 |
| 40901 | 名称与其他数据源冲突 |
| 42201 | 数据源存在运行中的 CDC 任务，无法修改连接配置 |

---

#### 3.1.6 删除数据源

| 项目 | 说明 |
|------|------|
| **方法** | `DELETE` |
| **路径** | `/api/v1/data/datasources/{datasourceId}` |
| **认证** | Bearer Token |
| **权限** | `data:datasource:delete` |

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `datasourceId` | string | 数据源 ID |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `force` | boolean | 否 | 是否强制删除（忽略关联任务检查），默认 `false` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "datasourceId": "ds-20260716-0001",
    "deleted": true,
    "deletedAt": "2026-07-16T10:15:00Z"
  },
  "traceId": "trace-006"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 数据源不存在 |
| 42201 | 数据源关联了运行中的 CDC/ETL 任务，且 `force=false` |

---

#### 3.1.7 测试数据源连接

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/datasources/{datasourceId}/test` |
| **认证** | Bearer Token |
| **权限** | `data:datasource:write` |

**请求参数（可选，用于测试未保存的配置）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `connectionConfig` | object | 否 | 临时连接配置，不传则使用已保存的配置 |
| `timeout` | integer | 否 | 连接超时秒数，默认 10 |

**响应示例（成功）：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "datasourceId": "ds-20260716-0001",
    "connectionStatus": "connected",
    "latencyMs": 45,
    "serverVersion": "MySQL 8.0.35",
    "testedAt": "2026-07-16T10:20:00Z"
  },
  "traceId": "trace-007"
}
```

**响应示例（失败）：**

```json
{
  "code": 50002,
  "message": "数据源连接失败: Connection refused",
  "data": {
    "datasourceId": "ds-20260716-0001",
    "connectionStatus": "error",
    "errorCode": "CONNECTION_REFUSED",
    "errorMessage": "Connection refused to 10.0.1.100:3306",
    "testedAt": "2026-07-16T10:20:00Z"
  },
  "traceId": "trace-007"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 数据源不存在 |
| 50002 | 连接超时、认证失败、网络不可达 |

---

#### 3.1.8 数据源 Schema 发现

获取数据源的数据库/Schema/表/字段结构。

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/datasources/{datasourceId}/schema` |
| **认证** | Bearer Token |
| **权限** | `data:datasource:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `database` | string | 否 | 数据库名（数据库类型数据源） |
| `table` | string | 否 | 表名，传入时返回该表的字段详情 |
| `includeColumns` | boolean | 否 | 是否包含字段详情，默认 `true` |
| `sampleSize` | integer | 否 | 样本数据行数，默认 0（不取样） |

**响应示例（库表列表）：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "datasourceId": "ds-20260716-0001",
    "database": "biz_core",
    "tables": [
      {
        "tableName": "orders",
        "schema": "public",
        "tableType": "TABLE",
        "rowCount": 1250000,
        "dataSizeBytes": 536870912,
        "columns": [
          {
            "name": "id",
            "dataType": "BIGINT",
            "nullable": false,
            "primaryKey": true,
            "defaultValue": null,
            "comment": "订单ID"
          },
          {
            "name": "order_no",
            "dataType": "VARCHAR(64)",
            "nullable": false,
            "primaryKey": false,
            "defaultValue": null,
            "comment": "订单编号"
          },
          {
            "name": "customer_id",
            "dataType": "BIGINT",
            "nullable": false,
            "primaryKey": false,
            "defaultValue": null,
            "comment": "客户ID"
          },
          {
            "name": "amount",
            "dataType": "DECIMAL(12,2)",
            "nullable": false,
            "primaryKey": false,
            "defaultValue": "0.00",
            "comment": "订单金额"
          },
          {
            "name": "status",
            "dataType": "VARCHAR(20)",
            "nullable": false,
            "primaryKey": false,
            "defaultValue": "'pending'",
            "comment": "订单状态"
          },
          {
            "name": "created_at",
            "dataType": "DATETIME",
            "nullable": false,
            "primaryKey": false,
            "defaultValue": "CURRENT_TIMESTAMP",
            "comment": "创建时间"
          }
        ],
        "sampleData": []
      }
    ]
  },
  "traceId": "trace-008"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 数据源不存在 |
| 50002 | 数据源未连接或 schema 获取失败 |

---

### 3.2 CDC 实时同步 API

CDC（Change Data Capture）实时同步基于 Flink CDC 捕获源数据库的数据变更，实时同步至数据湖（Hudi）或 Kafka。

#### 3.2.1 创建 CDC 任务

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/cdc-tasks` |
| **认证** | Bearer Token |
| **权限** | `data:cdc:write` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | CDC 任务名称，租户内唯一 |
| `description` | string | 否 | 任务描述 |
| `sourceDatasourceId` | string | 是 | 源数据源 ID |
| `sourceConfig` | object | 是 | 源表配置 |
| `sourceConfig.database` | string | 是 | 源数据库名 |
| `sourceConfig.tables` | string[] | 是 | 需同步的表列表 |
| `sourceConfig.includeSchemaChanges` | boolean | 否 | 是否同步 DDL 变更，默认 `false` |
| `sourceConfig.startupMode` | string | 否 | 启动模式：`initial`/`latest`/`timestamp`/`specific`，默认 `initial` |
| `sourceConfig.startupTimestamp` | string | 否 | `timestamp` 模式下的起始时间戳 |
| `targetConfig` | object | 是 | 目标配置 |
| `targetConfig.type` | string | 是 | 目标类型：`hudi`/`kafka`/`iceberg` |
| `targetConfig.database` | string | 是 | 目标数据库名 |
| `targetConfig.tablePrefix` | string | 否 | 目标表名前缀 |
| `targetConfig.kafkaTopic` | string | 否 | `kafka` 类型时的 topic 名 |
| `targetConfig.hudiConfig` | object | 否 | Hudi 特有配置 |
| `targetConfig.hudiConfig.tableType` | string | 否 | `COW`/`MOR`，默认 `MOR` |
| `targetConfig.hudiConfig.primaryKey` | string | 否 | 主键字段，逗号分隔 |
| `targetConfig.hudiConfig.partitionFields` | string | 否 | 分区字段 |
| `targetConfig.hudiConfig.recordKeyField` | string | 否 | 记录键字段 |
| `targetConfig.hudiConfig.preCombineField` | string | 否 | 预合并字段 |
| `targetConfig.hudiConfig.indexType` | string | 否 | 索引类型：`BLOOM`/`SIMPLE`/`BUCKET`，默认 `BLOOM` |
| `syncConfig` | object | 是 | 同步配置 |
| `syncConfig.parallelism` | integer | 否 | Flink 并行度，默认 1 |
| `syncConfig.checkpointInterval` | integer | 否 | Checkpoint 间隔（毫秒），默认 30000 |
| `syncConfig.flushIntervalMs` | integer | 否 | 刷新间隔（毫秒），默认 60000 |
| `syncConfig.retryTimes` | integer | 否 | 重试次数，默认 3 |
| `ownerId` | string | 是 | 负责人 ID |

**请求示例：**

```json
{
  "name": "订单表实时同步",
  "description": "将业务系统 orders 表实时同步到 Hudi 数据湖",
  "sourceDatasourceId": "ds-20260716-0001",
  "sourceConfig": {
    "database": "biz_core",
    "tables": ["orders", "order_items"],
    "includeSchemaChanges": false,
    "startupMode": "initial"
  },
  "targetConfig": {
    "type": "hudi",
    "database": "ods_biz",
    "tablePrefix": "ods_",
    "hudiConfig": {
      "tableType": "MOR",
      "primaryKey": "id",
      "partitionFields": "created_at",
      "recordKeyField": "id",
      "preCombineField": "updated_at",
      "indexType": "BLOOM"
    }
  },
  "syncConfig": {
    "parallelism": 2,
    "checkpointInterval": 60000,
    "flushIntervalMs": 30000,
    "retryTimes": 3
  },
  "ownerId": "user-001"
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "cdc-20260716-0001",
    "name": "订单表实时同步",
    "description": "将业务系统 orders 表实时同步到 Hudi 数据湖",
    "sourceDatasourceId": "ds-20260716-0001",
    "sourceDatasourceName": "业务系统主库",
    "sourceConfig": {
      "database": "biz_core",
      "tables": ["orders", "order_items"],
      "includeSchemaChanges": false,
      "startupMode": "initial"
    },
    "targetConfig": {
      "type": "hudi",
      "database": "ods_biz",
      "tablePrefix": "ods_",
      "hudiConfig": {
        "tableType": "MOR",
        "primaryKey": "id",
        "partitionFields": "created_at",
        "recordKeyField": "id",
        "preCombineField": "updated_at",
        "indexType": "BLOOM"
      }
    },
    "syncConfig": {
      "parallelism": 2,
      "checkpointInterval": 60000,
      "flushIntervalMs": 30000,
      "retryTimes": 3
    },
    "flinkJobId": null,
    "status": "created",
    "ownerId": "user-001",
    "createdAt": "2026-07-16T11:00:00Z",
    "updatedAt": "2026-07-16T11:00:00Z"
  },
  "traceId": "trace-009"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40001 | 源数据源不支持 CDC（`supportsCDC=false`）；目标类型不合法 |
| 40401 | 源数据源不存在 |
| 40901 | 任务名称已存在 |
| 42201 | 源数据源连接状态为 `disconnected` 或 `error` |

---

#### 3.2.2 获取 CDC 任务列表

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/cdc-tasks` |
| **认证** | Bearer Token |
| **权限** | `data:cdc:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数 |
| `keyword` | string | 否 | 名称搜索 |
| `status` | string | 否 | `created`/`running`/`stopped`/`failed`/`paused` |
| `sourceDatasourceId` | string | 否 | 源数据源 ID 过滤 |
| `targetType` | string | 否 | 目标类型过滤 |
| `ownerId` | string | 否 | 负责人过滤 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "taskId": "cdc-20260716-0001",
        "name": "订单表实时同步",
        "sourceDatasourceId": "ds-20260716-0001",
        "sourceDatasourceName": "业务系统主库",
        "sourceTables": ["orders", "order_items"],
        "targetType": "hudi",
        "targetDatabase": "ods_biz",
        "flinkJobId": "job-flink-001",
        "status": "running",
        "metrics": {
          "recordsInPerSec": 125.5,
          "recordsOutPerSec": 124.8,
          "currentLagMs": 1200,
          "totalRecordsRead": 1500000,
          "totalRecordsWritten": 1495000,
          "lastCheckpointTime": "2026-07-16T11:05:00Z"
        },
        "ownerId": "user-001",
        "createdAt": "2026-07-16T11:00:00Z",
        "startedAt": "2026-07-16T11:01:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "trace-010"
}
```

---

#### 3.2.3 获取 CDC 任务详情

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/cdc-tasks/{taskId}` |
| **认证** | Bearer Token |
| **权限** | `data:cdc:read` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "cdc-20260716-0001",
    "name": "订单表实时同步",
    "description": "将业务系统 orders 表实时同步到 Hudi 数据湖",
    "sourceDatasourceId": "ds-20260716-0001",
    "sourceDatasourceName": "业务系统主库",
    "sourceConfig": {
      "database": "biz_core",
      "tables": ["orders", "order_items"],
      "includeSchemaChanges": false,
      "startupMode": "initial"
    },
    "targetConfig": {
      "type": "hudi",
      "database": "ods_biz",
      "tablePrefix": "ods_",
      "hudiConfig": {
        "tableType": "MOR",
        "primaryKey": "id",
        "partitionFields": "created_at",
        "recordKeyField": "id",
        "preCombineField": "updated_at",
        "indexType": "BLOOM"
      }
    },
    "syncConfig": {
      "parallelism": 2,
      "checkpointInterval": 60000,
      "flushIntervalMs": 30000,
      "retryTimes": 3
    },
    "flinkJobId": "job-flink-001",
    "status": "running",
    "metrics": {
      "recordsInPerSec": 125.5,
      "recordsOutPerSec": 124.8,
      "currentLagMs": 1200,
      "totalRecordsRead": 1500000,
      "totalRecordsWritten": 1495000,
      "checkpointCount": 15,
      "lastCheckpointTime": "2026-07-16T11:05:00Z",
      "lastCheckpointSize": 10485760
    },
    "tableSyncStatus": [
      {
        "sourceTable": "orders",
        "targetTable": "ods_orders",
        "status": "syncing",
        "lastSyncedRecord": {
          "op": "INSERT",
          "key": "100001",
          "timestamp": "2026-07-16T11:04:58Z"
        }
      },
      {
        "sourceTable": "order_items",
        "targetTable": "ods_order_items",
        "status": "syncing",
        "lastSyncedRecord": {
          "op": "UPDATE",
          "key": "500001",
          "timestamp": "2026-07-16T11:04:55Z"
        }
      }
    ],
    "ownerId": "user-001",
    "createdAt": "2026-07-16T11:00:00Z",
    "startedAt": "2026-07-16T11:01:00Z",
    "updatedAt": "2026-07-16T11:05:00Z"
  },
  "traceId": "trace-011"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 任务 ID 不存在 |

---

#### 3.2.4 更新 CDC 任务

| 项目 | 说明 |
|------|------|
| **方法** | `PUT` |
| **路径** | `/api/v1/data/cdc-tasks/{taskId}` |
| **认证** | Bearer Token |
| **权限** | `data:cdc:write` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 否 | 任务名称 |
| `description` | string | 否 | 描述 |
| `syncConfig` | object | 否 | 同步配置（并行度、Checkpoint 间隔等） |
| `sourceConfig` | object | 否 | 源表配置（增加/减少同步表） |

> 注意：运行中的任务修改配置后，需重启任务生效。

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "cdc-20260716-0001",
    "name": "订单表实时同步-更新",
    "status": "running",
    "needRestart": true,
    "updatedAt": "2026-07-16T11:10:00Z"
  },
  "traceId": "trace-012"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 任务不存在 |
| 42201 | 任务运行中，不允许修改源数据库 |

---

#### 3.2.5 删除 CDC 任务

| 项目 | 说明 |
|------|------|
| **方法** | `DELETE` |
| **路径** | `/api/v1/data/cdc-tasks/{taskId}` |
| **认证** | Bearer Token |
| **权限** | `data:cdc:delete` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `stopFirst` | boolean | 否 | 是否先停止再删除，默认 `true` |
| `cleanupTarget` | boolean | 否 | 是否清理目标表数据，默认 `false` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "cdc-20260716-0001",
    "deleted": true,
    "targetCleaned": false,
    "deletedAt": "2026-07-16T11:15:00Z"
  },
  "traceId": "trace-013"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 任务不存在 |
| 42201 | 任务运行中且 `stopFirst=false` |

---

#### 3.2.6 启动 CDC 任务

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/cdc-tasks/{taskId}/start` |
| **认证** | Bearer Token |
| **权限** | `data:cdc:operate` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `savepointPath` | string | 否 | 从指定 savepoint 恢复 |
| `allowNonRestoredState` | boolean | 否 | 是否允许忽略无法恢复的状态，默认 `false` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "cdc-20260716-0001",
    "status": "running",
    "flinkJobId": "job-flink-002",
    "startedAt": "2026-07-16T11:20:00Z"
  },
  "traceId": "trace-014"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 任务不存在 |
| 40901 | 任务已在运行中 |
| 50003 | Flink 作业提交失败 |
| 50301 | Flink 集群不可用 |

---

#### 3.2.7 停止 CDC 任务

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/cdc-tasks/{taskId}/stop` |
| **认证** | Bearer Token |
| **权限** | `data:cdc:operate` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `savepoint` | boolean | 否 | 停止时是否创建 savepoint，默认 `true` |
| `savepointPath` | string | 否 | savepoint 存储路径 |
| `drain` | boolean | 否 | 是否在停止前处理完所有已读取的数据，默认 `false` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "cdc-20260716-0001",
    "status": "stopped",
    "savepointPath": "hdfs:///savepoints/cdc-20260716-0001/sp-001",
    "stoppedAt": "2026-07-16T11:25:00Z"
  },
  "traceId": "trace-015"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 任务不存在 |
| 40901 | 任务已停止 |
| 50003 | Flink 作业停止失败 |

---

#### 3.2.8 暂停/恢复 CDC 任务

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/cdc-tasks/{taskId}/{action}` |
| **认证** | Bearer Token |
| **权限** | `data:cdc:operate` |

`{action}` 取值：`pause` / `resume`

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "cdc-20260716-0001",
    "status": "paused",
    "action": "pause",
    "actionAt": "2026-07-16T11:30:00Z"
  },
  "traceId": "trace-016"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 任务不存在 |
| 40901 | 当前状态不允许该操作 |

---

#### 3.2.9 CDC 任务状态监控

获取 CDC 任务的实时运行指标。

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/cdc-tasks/{taskId}/metrics` |
| **认证** | Bearer Token |
| **权限** | `data:cdc:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `timeRange` | string | 否 | 时间范围：`1h`/`6h`/`24h`/`7d`，默认 `1h` |
| `granularity` | string | 否 | 粒度：`1m`/`5m`/`1h`，默认 `5m` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "cdc-20260716-0001",
    "status": "running",
    "currentMetrics": {
      "recordsInPerSec": 125.5,
      "recordsOutPerSec": 124.8,
      "currentLagMs": 1200,
      "totalRecordsRead": 1500000,
      "totalRecordsWritten": 1495000,
      "checkpointCount": 15,
      "lastCheckpointTime": "2026-07-16T11:05:00Z",
      "lastCheckpointDurationMs": 850,
      "lastCheckpointSize": 10485760,
      "numTaskManagers": 2,
      "numSlotsUsed": 2,
      "heapUsedMb": 512,
      "heapMaxMb": 2048
    },
    "timeSeries": [
      {
        "timestamp": "2026-07-16T11:00:00Z",
        "recordsInPerSec": 100.0,
        "recordsOutPerSec": 99.5,
        "lagMs": 500
      },
      {
        "timestamp": "2026-07-16T11:05:00Z",
        "recordsInPerSec": 125.5,
        "recordsOutPerSec": 124.8,
        "lagMs": 1200
      }
    ]
  },
  "traceId": "trace-017"
}
```

---

#### 3.2.10 CDC 管道管理

获取 CDC 任务的数据管道拓扑（源表 -> 目标表的映射关系）。

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/cdc-pipelines` |
| **认证** | Bearer Token |
| **权限** | `data:cdc:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sourceDatasourceId` | string | 否 | 源数据源过滤 |
| `targetType` | string | 否 | 目标类型过滤 |
| `sourceTable` | string | 否 | 源表名过滤 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "pipelines": [
      {
        "pipelineId": "pipe-001",
        "taskId": "cdc-20260716-0001",
        "taskName": "订单表实时同步",
        "source": {
          "datasourceId": "ds-20260716-0001",
          "datasourceName": "业务系统主库",
          "datasourceType": "mysql",
          "database": "biz_core",
          "table": "orders"
        },
        "target": {
          "type": "hudi",
          "database": "ods_biz",
          "table": "ods_orders",
          "tableType": "MOR"
        },
        "status": "syncing",
        "lastSyncTime": "2026-07-16T11:04:58Z",
        "recordsSynced": 1500000
      },
      {
        "pipelineId": "pipe-002",
        "taskId": "cdc-20260716-0001",
        "taskName": "订单表实时同步",
        "source": {
          "datasourceId": "ds-20260716-0001",
          "datasourceName": "业务系统主库",
          "datasourceType": "mysql",
          "database": "biz_core",
          "table": "order_items"
        },
        "target": {
          "type": "hudi",
          "database": "ods_biz",
          "table": "ods_order_items",
          "tableType": "MOR"
        },
        "status": "syncing",
        "lastSyncTime": "2026-07-16T11:04:55Z",
        "recordsSynced": 5500000
      }
    ]
  },
  "traceId": "trace-018"
}
```

---

### 3.3 ETL/ELT 任务 API

基于 Airflow 的批量 ETL 任务编排与 DBT 数仓建模管理。

#### 3.3.1 创建 ETL 任务

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/etl-tasks` |
| **认证** | Bearer Token |
| **权限** | `data:etl:write` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | ETL 任务名称，租户内唯一 |
| `description` | string | 否 | 任务描述 |
| `taskType` | string | 是 | 任务类型：`etl`/`elt`/`dbt`/`sql`/`python`/`shell` |
| `sourceDatasourceIds` | string[] | 否 | 源数据源 ID 列表 |
| `targetDatasourceId` | string | 否 | 目标数据源 ID |
| `dagConfig` | object | 是 | Airflow DAG 配置 |
| `dagConfig.schedule` | string | 是 | 调度表达式（Cron 或 `@daily` 等） |
| `dagConfig.startDate` | string | 是 | 生效开始日期（ISO 8601） |
| `dagConfig.endDate` | string | 否 | 生效结束日期 |
| `dagConfig.catchup` | boolean | 否 | 是否补跑历史，默认 `false` |
| `dagConfig.maxActiveRuns` | integer | 否 | 最大并发运行数，默认 1 |
| `dagConfig.tags` | string[] | 否 | Airflow DAG 标签 |
| `dagConfig.defaultArgs` | object | 否 | 默认参数 |
| `dagConfig.defaultArgs.owner` | string | 否 | DAG owner |
| `dagConfig.defaultArgs.retries` | integer | 否 | 重试次数，默认 3 |
| `dagConfig.defaultArgs.retryDelaySec` | integer | 否 | 重试间隔（秒），默认 300 |
| `dagConfig.defaultArgs.timeoutSec` | integer | 否 | 任务超时（秒），默认 3600 |
| `steps` | array | 是 | ETL 步骤列表 |
| `steps[].name` | string | 是 | 步骤名称 |
| `steps[].type` | string | 是 | 步骤类型：`extract`/`transform`/`load`/`dbt_run`/`dbt_test`/`sql`/`python`/`shell` |
| `steps[].config` | object | 是 | 步骤配置 |
| `steps[].dependsOn` | string[] | 否 | 依赖的步骤名列表 |
| `ownerId` | string | 是 | 负责人 ID |

**请求示例：**

```json
{
  "name": "订单数据每日汇总",
  "description": "每日从业务系统抽取订单数据，经 DBT 转换后加载到 DWS 层",
  "taskType": "dbt",
  "sourceDatasourceIds": ["ds-20260716-0001"],
  "targetDatasourceId": "ds-starrocks-001",
  "dagConfig": {
    "schedule": "0 2 * * *",
    "startDate": "2026-07-16T00:00:00Z",
    "catchup": false,
    "maxActiveRuns": 1,
    "tags": ["daily", "orders"],
    "defaultArgs": {
      "owner": "data-team",
      "retries": 3,
      "retryDelaySec": 300,
      "timeoutSec": 7200
    }
  },
  "steps": [
    {
      "name": "extract_orders",
      "type": "extract",
      "config": {
        "datasourceId": "ds-20260716-0001",
        "sql": "SELECT * FROM orders WHERE created_at >= '{{ ds }}' AND created_at < '{{ ds_next_day }}'",
        "targetTable": "stg_orders"
      },
      "dependsOn": []
    },
    {
      "name": "extract_order_items",
      "type": "extract",
      "config": {
        "datasourceId": "ds-20260716-0001",
        "sql": "SELECT * FROM order_items WHERE created_at >= '{{ ds }}' AND created_at < '{{ ds_next_day }}'",
        "targetTable": "stg_order_items"
      },
      "dependsOn": []
    },
    {
      "name": "dbt_transform",
      "type": "dbt_run",
      "config": {
        "projectName": "order_analytics",
        "models": ["dwd_orders", "dws_order_daily"],
        "vars": {
          "date_var": "{{ ds }}"
        },
        "fullRefresh": false
      },
      "dependsOn": ["extract_orders", "extract_order_items"]
    },
    {
      "name": "dbt_test",
      "type": "dbt_test",
      "config": {
        "projectName": "order_analytics",
        "models": ["dwd_orders", "dws_order_daily"]
      },
      "dependsOn": ["dbt_transform"]
    }
  ],
  "ownerId": "user-001"
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "etl-20260716-0001",
    "name": "订单数据每日汇总",
    "taskType": "dbt",
    "dagId": "dag_etl_20260716_0001",
    "airflowDagId": "dag_etl_20260716_0001",
    "status": "created",
    "schedule": "0 2 * * *",
    "nextRunTime": "2026-07-17T02:00:00Z",
    "ownerId": "user-001",
    "createdAt": "2026-07-16T12:00:00Z",
    "updatedAt": "2026-07-16T12:00:00Z"
  },
  "traceId": "trace-019"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40001 | 调度表达式格式错误；步骤依赖形成环 |
| 40401 | 源/目标数据源不存在 |
| 40901 | 任务名称已存在 |
| 50301 | Airflow 服务不可用 |

---

#### 3.3.2 获取 ETL 任务列表

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/etl-tasks` |
| **认证** | Bearer Token |
| **权限** | `data:etl:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数 |
| `keyword` | string | 否 | 名称搜索 |
| `taskType` | string | 否 | 任务类型过滤 |
| `status` | string | 否 | `created`/`active`/`paused`/`error` |
| `ownerId` | string | 否 | 负责人过滤 |
| `tag` | string | 否 | 标签过滤 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "taskId": "etl-20260716-0001",
        "name": "订单数据每日汇总",
        "taskType": "dbt",
        "status": "active",
        "schedule": "0 2 * * *",
        "lastRunStatus": "success",
        "lastRunTime": "2026-07-16T02:00:00Z",
        "lastRunDurationSec": 1800,
        "nextRunTime": "2026-07-17T02:00:00Z",
        "ownerId": "user-001",
        "ownerName": "张三",
        "createdAt": "2026-07-16T12:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "trace-020"
}
```

---

#### 3.3.3 获取 ETL 任务详情

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/etl-tasks/{taskId}` |
| **认证** | Bearer Token |
| **权限** | `data:etl:read` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "etl-20260716-0001",
    "name": "订单数据每日汇总",
    "description": "每日从业务系统抽取订单数据，经 DBT 转换后加载到 DWS 层",
    "taskType": "dbt",
    "sourceDatasourceIds": ["ds-20260716-0001"],
    "targetDatasourceId": "ds-starrocks-001",
    "dagConfig": {
      "schedule": "0 2 * * *",
      "startDate": "2026-07-16T00:00:00Z",
      "catchup": false,
      "maxActiveRuns": 1,
      "tags": ["daily", "orders"],
      "defaultArgs": {
        "owner": "data-team",
        "retries": 3,
        "retryDelaySec": 300,
        "timeoutSec": 7200
      }
    },
    "steps": [
      {
        "name": "extract_orders",
        "type": "extract",
        "status": "success",
        "dependsOn": []
      },
      {
        "name": "extract_order_items",
        "type": "extract",
        "status": "success",
        "dependsOn": []
      },
      {
        "name": "dbt_transform",
        "type": "dbt_run",
        "status": "success",
        "dependsOn": ["extract_orders", "extract_order_items"]
      },
      {
        "name": "dbt_test",
        "type": "dbt_test",
        "status": "success",
        "dependsOn": ["dbt_transform"]
      }
    ],
    "dagId": "dag_etl_20260716_0001",
    "airflowDagId": "dag_etl_20260716_0001",
    "status": "active",
    "lastRunStatus": "success",
    "lastRunTime": "2026-07-16T02:00:00Z",
    "lastRunDurationSec": 1800,
    "nextRunTime": "2026-07-17T02:00:00Z",
    "ownerId": "user-001",
    "createdAt": "2026-07-16T12:00:00Z",
    "updatedAt": "2026-07-16T12:00:00Z"
  },
  "traceId": "trace-021"
}
```

---

#### 3.3.4 更新 ETL 任务

| 项目 | 说明 |
|------|------|
| **方法** | `PUT` |
| **路径** | `/api/v1/data/etl-tasks/{taskId}` |
| **认证** | Bearer Token |
| **权限** | `data:etl:write` |

**请求参数：** 同 3.3.1，所有字段可选。

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "etl-20260716-0001",
    "name": "订单数据每日汇总-更新",
    "status": "active",
    "updatedAt": "2026-07-16T12:10:00Z"
  },
  "traceId": "trace-022"
}
```

---

#### 3.3.5 删除 ETL 任务

| 项目 | 说明 |
|------|------|
| **方法** | `DELETE` |
| **路径** | `/api/v1/data/etl-tasks/{taskId}` |
| **认证** | Bearer Token |
| **权限** | `data:etl:delete` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "etl-20260716-0001",
    "deleted": true,
    "deletedAt": "2026-07-16T12:15:00Z"
  },
  "traceId": "trace-023"
}
```

---

#### 3.3.6 手动触发 ETL 任务

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/etl-tasks/{taskId}/trigger` |
| **认证** | Bearer Token |
| **权限** | `data:etl:operate` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `logicalDate` | string | 否 | 逻辑日期（ISO 8601），默认当前时间 |
| `configOverride` | object | 否 | 配置覆盖（Airflow conf） |
| `steps` | string[] | 否 | 仅执行指定步骤 |

**请求示例：**

```json
{
  "logicalDate": "2026-07-15T00:00:00Z",
  "configOverride": {
    "date_var": "2026-07-15"
  }
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "etl-20260716-0001",
    "runId": "run-20260716-0001",
    "airflowRunId": "scheduled__2026-07-15T00:00:00+00:00",
    "dagRunId": "dag_run_001",
    "status": "running",
    "logicalDate": "2026-07-15T00:00:00Z",
    "triggeredAt": "2026-07-16T12:20:00Z",
    "triggeredBy": "user-001"
  },
  "traceId": "trace-024"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 任务不存在 |
| 40901 | 已有相同 logicalDate 的运行 |
| 50301 | Airflow 服务不可用 |

---

#### 3.3.7 获取执行历史

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/etl-tasks/{taskId}/runs` |
| **认证** | Bearer Token |
| **权限** | `data:etl:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数 |
| `status` | string | 否 | `running`/`success`/`failed`/`queued` |
| `startDate` | string | 否 | 开始日期 |
| `endDate` | string | 否 | 结束日期 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "runId": "run-20260716-0001",
        "airflowRunId": "scheduled__2026-07-15T00:00:00+00:00",
        "logicalDate": "2026-07-15T00:00:00Z",
        "status": "success",
        "triggerType": "manual",
        "triggeredBy": "user-001",
        "startedAt": "2026-07-16T02:00:00Z",
        "endedAt": "2026-07-16T02:30:00Z",
        "durationSec": 1800,
        "stepResults": [
          {
            "stepName": "extract_orders",
            "status": "success",
            "startedAt": "2026-07-16T02:00:00Z",
            "endedAt": "2026-07-16T02:05:00Z",
            "durationSec": 300,
            "recordsProcessed": 50000
          },
          {
            "stepName": "extract_order_items",
            "status": "success",
            "startedAt": "2026-07-16T02:00:00Z",
            "endedAt": "2026-07-16T02:04:00Z",
            "durationSec": 240,
            "recordsProcessed": 150000
          },
          {
            "stepName": "dbt_transform",
            "status": "success",
            "startedAt": "2026-07-16T02:05:00Z",
            "endedAt": "2026-07-16T02:25:00Z",
            "durationSec": 1200,
            "modelsRun": 2
          },
          {
            "stepName": "dbt_test",
            "status": "success",
            "startedAt": "2026-07-16T02:25:00Z",
            "endedAt": "2026-07-16T02:30:00Z",
            "durationSec": 300,
            "testsPassed": 8,
            "testsFailed": 0
          }
        ]
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "trace-025"
}
```

---

#### 3.3.8 获取执行详情

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/etl-tasks/{taskId}/runs/{runId}` |
| **认证** | Bearer Token |
| **权限** | `data:etl:read` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "runId": "run-20260716-0001",
    "taskId": "etl-20260716-0001",
    "taskName": "订单数据每日汇总",
    "airflowRunId": "scheduled__2026-07-15T00:00:00+00:00",
    "logicalDate": "2026-07-15T00:00:00Z",
    "status": "success",
    "triggerType": "manual",
    "triggeredBy": "user-001",
    "startedAt": "2026-07-16T02:00:00Z",
    "endedAt": "2026-07-16T02:30:00Z",
    "durationSec": 1800,
    "stepResults": [
      {
        "stepName": "extract_orders",
        "type": "extract",
        "status": "success",
        "startedAt": "2026-07-16T02:00:00Z",
        "endedAt": "2026-07-16T02:05:00Z",
        "durationSec": 300,
        "recordsProcessed": 50000,
        "logPath": "/api/v1/data/etl-tasks/etl-20260716-0001/runs/run-20260716-0001/logs?step=extract_orders"
      },
      {
        "stepName": "extract_order_items",
        "type": "extract",
        "status": "success",
        "startedAt": "2026-07-16T02:00:00Z",
        "endedAt": "2026-07-16T02:04:00Z",
        "durationSec": 240,
        "recordsProcessed": 150000,
        "logPath": "/api/v1/data/etl-tasks/etl-20260716-0001/runs/run-20260716-0001/logs?step=extract_order_items"
      },
      {
        "stepName": "dbt_transform",
        "type": "dbt_run",
        "status": "success",
        "startedAt": "2026-07-16T02:05:00Z",
        "endedAt": "2026-07-16T02:25:00Z",
        "durationSec": 1200,
        "modelsRun": 2,
        "models": [
          {
            "name": "dwd_orders",
            "status": "success",
            "recordsAffected": 50000,
            "executionTimeSec": 600
          },
          {
            "name": "dws_order_daily",
            "status": "success",
            "recordsAffected": 1000,
            "executionTimeSec": 600
          }
        ]
      },
      {
        "stepName": "dbt_test",
        "type": "dbt_test",
        "status": "success",
        "startedAt": "2026-07-16T02:25:00Z",
        "endedAt": "2026-07-16T02:30:00Z",
        "durationSec": 300,
        "testsPassed": 8,
        "testsFailed": 0,
        "testResults": [
          {
            "modelName": "dwd_orders",
            "testName": "not_null_dwd_orders_id",
            "status": "pass",
            "failures": 0
          },
          {
            "modelName": "dwd_orders",
            "testName": "unique_dwd_orders_id",
            "status": "pass",
            "failures": 0
          }
        ]
      }
    ]
  },
  "traceId": "trace-026"
}
```

---

#### 3.3.9 DBT 模型管理 - 列出 DBT 项目

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/dbt/projects` |
| **认证** | Bearer Token |
| **权限** | `data:etl:read` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "projects": [
      {
        "projectId": "dbt-proj-001",
        "name": "order_analytics",
        "version": "1.9.0",
        "profile": "default",
        "target": "prod",
        "modelsPath": "models/",
        "testsPath": "tests/",
        "modelsCount": 25,
        "testsCount": 40,
        "sourcesCount": 5,
        "lastCompiledAt": "2026-07-16T01:00:00Z",
        "createdAt": "2026-07-01T00:00:00Z"
      }
    ]
  },
  "traceId": "trace-027"
}
```

---

#### 3.3.10 DBT 模型管理 - 列出模型

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/dbt/projects/{projectId}/models` |
| **认证** | Bearer Token |
| **权限** | `data:etl:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `layer` | string | 否 | 数仓分层：`staging`/`intermediate`/`marts` |
| `materialized` | string | 否 | 物化方式：`view`/`table`/`incremental`/`ephemeral` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "projectId": "dbt-proj-001",
    "models": [
      {
        "modelId": "mdl-001",
        "name": "dwd_orders",
        "resourceType": "model",
        "layer": "marts",
        "materialized": "incremental",
        "schema": "dwd",
        "database": "data_warehouse",
        "alias": "dwd_orders",
        "description": "订单明细宽表",
        "columns": [
          {
            "name": "id",
            "dataType": "BIGINT",
            "description": "订单ID",
            "tests": ["not_null", "unique"]
          },
          {
            "name": "order_no",
            "dataType": "VARCHAR(64)",
            "description": "订单编号",
            "tests": ["not_null"]
          },
          {
            "name": "customer_name",
            "dataType": "VARCHAR(128)",
            "description": "客户名称"
          },
          {
            "name": "amount",
            "dataType": "DECIMAL(12,2)",
            "description": "订单金额",
            "tests": ["not_null"]
          }
        ],
        "dependsOn": ["stg_orders", "stg_order_items", "dim_customers"],
        "tags": ["daily", "dwd"],
        "lastRunStatus": "success",
        "lastRunTime": "2026-07-16T02:15:00Z"
      },
      {
        "modelId": "mdl-002",
        "name": "dws_order_daily",
        "resourceType": "model",
        "layer": "marts",
        "materialized": "table",
        "schema": "dws",
        "database": "data_warehouse",
        "alias": "dws_order_daily",
        "description": "订单日汇总表",
        "columns": [
          {
            "name": "dt",
            "dataType": "DATE",
            "description": "日期",
            "tests": ["not_null"]
          },
          {
            "name": "total_orders",
            "dataType": "INT",
            "description": "总订单数"
          },
          {
            "name": "total_amount",
            "dataType": "DECIMAL(15,2)",
            "description": "总金额"
          }
        ],
        "dependsOn": ["dwd_orders"],
        "tags": ["daily", "dws"],
        "lastRunStatus": "success",
        "lastRunTime": "2026-07-16T02:20:00Z"
      }
    ]
  },
  "traceId": "trace-028"
}
```

---

#### 3.3.11 DBT 模型管理 - 编译模型

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/dbt/projects/{projectId}/compile` |
| **认证** | Bearer Token |
| **权限** | `data:etl:write` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `models` | string[] | 否 | 指定模型（支持 `+` 语法），不传则编译全部 |
| `vars` | object | 否 | 变量覆盖 |
| `fullRefresh` | boolean | 否 | 是否全量刷新，默认 `false` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "projectId": "dbt-proj-001",
    "compileId": "compile-001",
    "status": "success",
    "modelsCompiled": 2,
    "compiledAt": "2026-07-16T12:30:00Z"
  },
  "traceId": "trace-029"
}
```

---

#### 3.3.12 ETL 任务编排 - DAG 可视化

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/etl-tasks/{taskId}/dag` |
| **认证** | Bearer Token |
| **权限** | `data:etl:read` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "etl-20260716-0001",
    "dagId": "dag_etl_20260716_0001",
    "nodes": [
      {
        "id": "extract_orders",
        "name": "extract_orders",
        "type": "extract",
        "status": "success"
      },
      {
        "id": "extract_order_items",
        "name": "extract_order_items",
        "type": "extract",
        "status": "success"
      },
      {
        "id": "dbt_transform",
        "name": "dbt_transform",
        "type": "dbt_run",
        "status": "success"
      },
      {
        "id": "dbt_test",
        "name": "dbt_test",
        "type": "dbt_test",
        "status": "success"
      }
    ],
    "edges": [
      {
        "source": "extract_orders",
        "target": "dbt_transform"
      },
      {
        "source": "extract_order_items",
        "target": "dbt_transform"
      },
      {
        "source": "dbt_transform",
        "target": "dbt_test"
      }
    ]
  },
  "traceId": "trace-030"
}
```

---

### 3.4 数据湖管理 API

管理 Hudi / Iceberg 数据湖表，包括表的创建、入湖任务、湖表查询和分区管理。

#### 3.4.1 创建 Hudi 表

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/lake/hudi/tables` |
| **认证** | Bearer Token |
| **权限** | `data:lake:write` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `database` | string | 是 | 数据库名 |
| `tableName` | string | 是 | 表名 |
| `description` | string | 否 | 表描述 |
| `tableType` | string | 是 | 表类型：`COW`（Copy On Write）/`MOR`（Merge On Read） |
| `schema` | array | 是 | 字段定义列表 |
| `schema[].name` | string | 是 | 字段名 |
| `schema[].dataType` | string | 是 | 字段类型 |
| `schema[].nullable` | boolean | 否 | 是否允许 NULL，默认 `true` |
| `schema[].comment` | string | 否 | 字段注释 |
| `primaryKey` | string | 是 | 主键字段，逗号分隔多个 |
| `preCombineField` | string | 是 | 预合并字段（用于去重） |
| `partitionFields` | string | 否 | 分区字段，逗号分隔 |
| `partitionType` | string | 否 | 分区类型：`SIMPLE`/`MULTI`/`BUCKET`，默认 `SIMPLE` |
| `indexType` | string | 否 | 索引类型：`BLOOM`/`SIMPLE`/`BUCKET`/`GLOBAL_BLOOM`，默认 `BLOOM` |
| `hoodieConfig` | object | 否 | Hudi 高级配置 |
| `hoodieConfig.cleanAsync` | boolean | 否 | 异步清理，默认 `true` |
| `hoodieConfig.cleanRetainCommits` | integer | 否 | 保留 commit 数，默认 10 |
| `hoodieConfig.compactAsync` | boolean | 否 | 异步压缩（MOR），默认 `true` |
| `hoodieConfig.compactDeltaCommits` | integer | 否 | 压缩 delta commit 阈值，默认 5 |

**请求示例：**

```json
{
  "database": "ods_biz",
  "tableName": "ods_customers",
  "description": "客户信息表（Hudi MOR）",
  "tableType": "MOR",
  "schema": [
    { "name": "id", "dataType": "BIGINT", "nullable": false, "comment": "客户ID" },
    { "name": "customer_name", "dataType": "STRING", "nullable": false, "comment": "客户名称" },
    { "name": "phone", "dataType": "STRING", "nullable": true, "comment": "电话" },
    { "name": "email", "dataType": "STRING", "nullable": true, "comment": "邮箱" },
    { "name": "created_at", "dataType": "TIMESTAMP", "nullable": false, "comment": "创建时间" },
    { "name": "updated_at", "dataType": "TIMESTAMP", "nullable": false, "comment": "更新时间" }
  ],
  "primaryKey": "id",
  "preCombineField": "updated_at",
  "partitionFields": "created_at",
  "partitionType": "SIMPLE",
  "indexType": "BLOOM",
  "hoodieConfig": {
    "cleanAsync": true,
    "cleanRetainCommits": 10,
    "compactAsync": true,
    "compactDeltaCommits": 5
  }
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tableId": "hudi-tbl-001",
    "database": "ods_biz",
    "tableName": "ods_customers",
    "tableType": "MOR",
    "location": "hdfs:///data/lake/hudi/ods_biz/ods_customers",
    "status": "created",
    "createdAt": "2026-07-16T13:00:00Z"
  },
  "traceId": "trace-031"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40001 | 字段定义不合法；主键字段不存在于 schema 中 |
| 40901 | 表已存在 |
| 50004 | Hudi 表创建失败 |

---

#### 3.4.2 创建 Iceberg 表

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/lake/iceberg/tables` |
| **认证** | Bearer Token |
| **权限** | `data:lake:write` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `database` | string | 是 | 数据库名 |
| `tableName` | string | 是 | 表名 |
| `description` | string | 否 | 表描述 |
| `format` | string | 否 | 文件格式：`PARQUET`/`AVRO`/`ORC`，默认 `PARQUET` |
| `schema` | array | 是 | 字段定义列表 |
| `schema[].name` | string | 是 | 字段名 |
| `schema[].dataType` | string | 是 | 字段类型 |
| `schema[].nullable` | boolean | 否 | 是否允许 NULL |
| `schema[].comment` | string | 否 | 字段注释 |
| `partitionSpec` | array | 否 | 分区规格 |
| `partitionSpec[].field` | string | 是 | 分区字段 |
| `partitionSpec[].transform` | string | 否 | 变换：`identity`/`year`/`month`/`day`/`hour`/`bucket[N]`/`truncate[W]`，默认 `identity` |
| `properties` | object | 否 | Iceberg 表属性 |
| `properties.writeFormat` | string | 否 | 写入格式 |
| `properties.targetFileSizeBytes` | integer | 否 | 目标文件大小，默认 536870912 |

**请求示例：**

```json
{
  "database": "ods_biz",
  "tableName": "ods_events",
  "description": "事件日志表（Iceberg）",
  "format": "PARQUET",
  "schema": [
    { "name": "event_id", "dataType": "STRING", "nullable": false, "comment": "事件ID" },
    { "name": "event_type", "dataType": "STRING", "nullable": false, "comment": "事件类型" },
    { "name": "event_data", "dataType": "STRING", "nullable": true, "comment": "事件数据JSON" },
    { "name": "event_time", "dataType": "TIMESTAMP", "nullable": false, "comment": "事件时间" }
  ],
  "partitionSpec": [
    { "field": "event_time", "transform": "day" },
    { "field": "event_type", "transform": "identity" }
  ],
  "properties": {
    "writeFormat": "parquet",
    "targetFileSizeBytes": 536870912
  }
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tableId": "iceberg-tbl-001",
    "database": "ods_biz",
    "tableName": "ods_events",
    "location": "hdfs:///data/lake/iceberg/ods_biz/ods_events",
    "status": "created",
    "createdAt": "2026-07-16T13:05:00Z"
  },
  "traceId": "trace-032"
}
```

---

#### 3.4.3 获取数据湖表列表

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/lake/tables` |
| **认证** | Bearer Token |
| **权限** | `data:lake:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数 |
| `lakeType` | string | 否 | `hudi`/`iceberg` |
| `database` | string | 否 | 数据库过滤 |
| `keyword` | string | 否 | 表名搜索 |
| `tableType` | string | 否 | Hudi 表类型：`COW`/`MOR` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "tableId": "hudi-tbl-001",
        "lakeType": "hudi",
        "database": "ods_biz",
        "tableName": "ods_customers",
        "description": "客户信息表（Hudi MOR）",
        "tableType": "MOR",
        "location": "hdfs:///data/lake/hudi/ods_biz/ods_customers",
        "partitionFields": "created_at",
        "primaryKey": "id",
        "statistics": {
          "rowCount": 500000,
          "dataSizeBytes": 1073741824,
          "fileCount": 120,
          "lastCommitTime": "2026-07-16T12:00:00Z",
          "commitCount": 150
        },
        "createdAt": "2026-07-16T13:00:00Z",
        "updatedAt": "2026-07-16T13:10:00Z"
      },
      {
        "tableId": "iceberg-tbl-001",
        "lakeType": "iceberg",
        "database": "ods_biz",
        "tableName": "ods_events",
        "description": "事件日志表（Iceberg）",
        "location": "hdfs:///data/lake/iceberg/ods_biz/ods_events",
        "partitionSpec": [
          { "field": "event_time", "transform": "day" },
          { "field": "event_type", "transform": "identity" }
        ],
        "statistics": {
          "rowCount": 10000000,
          "dataSizeBytes": 5368709120,
          "fileCount": 500,
          "snapshotCount": 80,
          "lastSnapshotTime": "2026-07-16T12:30:00Z"
        },
        "createdAt": "2026-07-16T13:05:00Z",
        "updatedAt": "2026-07-16T13:15:00Z"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "trace-033"
}
```

---

#### 3.4.4 获取数据湖表详情

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/lake/tables/{tableId}` |
| **认证** | Bearer Token |
| **权限** | `data:lake:read` |

**响应示例（Hudi）：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tableId": "hudi-tbl-001",
    "lakeType": "hudi",
    "database": "ods_biz",
    "tableName": "ods_customers",
    "description": "客户信息表（Hudi MOR）",
    "tableType": "MOR",
    "location": "hdfs:///data/lake/hudi/ods_biz/ods_customers",
    "schema": [
      { "name": "id", "dataType": "BIGINT", "nullable": false, "comment": "客户ID" },
      { "name": "customer_name", "dataType": "STRING", "nullable": false, "comment": "客户名称" },
      { "name": "phone", "dataType": "STRING", "nullable": true, "comment": "电话" },
      { "name": "email", "dataType": "STRING", "nullable": true, "comment": "邮箱" },
      { "name": "created_at", "dataType": "TIMESTAMP", "nullable": false, "comment": "创建时间" },
      { "name": "updated_at", "dataType": "TIMESTAMP", "nullable": false, "comment": "更新时间" }
    ],
    "primaryKey": "id",
    "preCombineField": "updated_at",
    "partitionFields": "created_at",
    "indexType": "BLOOM",
    "hoodieConfig": {
      "cleanAsync": true,
      "cleanRetainCommits": 10,
      "compactAsync": true,
      "compactDeltaCommits": 5
    },
    "statistics": {
      "rowCount": 500000,
      "dataSizeBytes": 1073741824,
      "fileCount": 120,
      "lastCommitTime": "2026-07-16T12:00:00Z",
      "commitCount": 150,
      "lastCompactionTime": "2026-07-16T11:00:00Z"
    },
    "timeline": [
      {
        "instant": "20260716120000000",
        "action": "deltacommit",
        "time": "2026-07-16T12:00:00Z",
        "state": "COMPLETED"
      },
      {
        "instant": "20260716110000000",
        "action": "compaction",
        "time": "2026-07-16T11:00:00Z",
        "state": "COMPLETED"
      }
    ],
    "createdAt": "2026-07-16T13:00:00Z",
    "updatedAt": "2026-07-16T13:10:00Z"
  },
  "traceId": "trace-034"
}
```

---

#### 3.4.5 删除数据湖表

| 项目 | 说明 |
|------|------|
| **方法** | `DELETE` |
| **路径** | `/api/v1/data/lake/tables/{tableId}` |
| **认证** | Bearer Token |
| **权限** | `data:lake:delete` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `purgeData` | boolean | 否 | 是否物理删除数据文件，默认 `false`（仅删元数据） |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tableId": "hudi-tbl-001",
    "deleted": true,
    "dataPurged": false,
    "deletedAt": "2026-07-16T13:20:00Z"
  },
  "traceId": "trace-035"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 表不存在 |
| 42201 | 表被 CDC 任务引用，无法删除 |

---

#### 3.4.6 创建入湖任务

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/lake/ingestion-tasks` |
| **认证** | Bearer Token |
| **权限** | `data:lake:write` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 入湖任务名称 |
| `sourceDatasourceId` | string | 是 | 源数据源 ID |
| `sourceConfig` | object | 是 | 源配置 |
| `sourceConfig.database` | string | 是 | 源数据库 |
| `sourceConfig.table` | string | 是 | 源表 |
| `sourceConfig.sql` | string | 否 | 自定义抽取 SQL（与 table 二选一） |
| `targetConfig` | object | 是 | 目标配置 |
| `targetConfig.lakeType` | string | 是 | `hudi`/`iceberg` |
| `targetConfig.database` | string | 是 | 目标数据库 |
| `targetConfig.tableName` | string | 是 | 目标表名 |
| `targetConfig.writeMode` | string | 是 | 写入模式：`upsert`/`insert`/`bulk_insert`/`append` |
| `schedule` | string | 否 | 调度表达式（Cron），不传则仅手动触发 |
| `batchSize` | integer | 否 | 批次大小，默认 1000 |
| `parallelism` | integer | 否 | 并行度，默认 1 |

**请求示例：**

```json
{
  "name": "客户数据批量入湖",
  "sourceDatasourceId": "ds-20260716-0001",
  "sourceConfig": {
    "database": "biz_core",
    "table": "customers",
    "sql": "SELECT * FROM customers WHERE updated_at >= '{{ last_run_ts }}'"
  },
  "targetConfig": {
    "lakeType": "hudi",
    "database": "ods_biz",
    "tableName": "ods_customers",
    "writeMode": "upsert"
  },
  "schedule": "0 */6 * * *",
  "batchSize": 2000,
  "parallelism": 2
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "ingest-001",
    "name": "客户数据批量入湖",
    "status": "created",
    "schedule": "0 */6 * * *",
    "nextRunTime": "2026-07-16T18:00:00Z",
    "createdAt": "2026-07-16T13:30:00Z"
  },
  "traceId": "trace-036"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 源数据源或目标表不存在 |
| 40001 | 写入模式与表类型不兼容（如 Iceberg 不支持 `upsert`） |

---

#### 3.4.7 湖表查询

通过 Trino/Presto 引擎查询数据湖表。

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/lake/query` |
| **认证** | Bearer Token |
| **权限** | `data:lake:read` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `lakeType` | string | 是 | `hudi`/`iceberg` |
| `database` | string | 是 | 数据库名 |
| `table` | string | 是 | 表名 |
| `sql` | string | 否 | 自定义查询 SQL，不传则返回前 N 行 |
| `limit` | integer | 否 | 返回行数限制，默认 100，最大 1000 |
| `columns` | string[] | 否 | 指定返回列 |
| `filters` | object | 否 | 过滤条件 |
| `timeTravel` | object | 否 | 时间旅行（Iceberg 专用） |
| `timeTravel.snapshotId` | string | 否 | 快照 ID |
| `timeTravel.timestamp` | string | 否 | 时间戳 |

**请求示例：**

```json
{
  "lakeType": "hudi",
  "database": "ods_biz",
  "table": "ods_customers",
  "sql": "SELECT id, customer_name, phone, email FROM ods_customers WHERE created_at >= '2026-07-01' LIMIT 10",
  "limit": 10
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "lakeType": "hudi",
    "database": "ods_biz",
    "table": "ods_customers",
    "schema": [
      { "name": "id", "dataType": "BIGINT" },
      { "name": "customer_name", "dataType": "STRING" },
      { "name": "phone", "dataType": "STRING" },
      { "name": "email", "dataType": "STRING" }
    ],
    "rows": [
      [1, "张三", "13800000001", "zhangsan@example.com"],
      [2, "李四", "13800000002", "lisi@example.com"],
      [3, "王五", "13800000003", "wangwu@example.com"]
    ],
    "totalRows": 3,
    "queryId": "query-001",
    "queryDurationMs": 350,
    "readAt": "2026-07-16T13:40:00Z"
  },
  "traceId": "trace-037"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 表不存在 |
| 50004 | 查询引擎不可用；SQL 语法错误 |

---

#### 3.4.8 分区管理

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/lake/tables/{tableId}/partitions` |
| **认证** | Bearer Token |
| **权限** | `data:lake:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tableId": "hudi-tbl-001",
    "partitions": [
      {
        "partitionPath": "created_at=2026-07-01",
        "fileCount": 12,
        "dataSizeBytes": 104857600,
        "rowCount": 50000,
        "lastModified": "2026-07-01T12:00:00Z"
      },
      {
        "partitionPath": "created_at=2026-07-02",
        "fileCount": 15,
        "dataSizeBytes": 125829120,
        "rowCount": 60000,
        "lastModified": "2026-07-02T12:00:00Z"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "trace-038"
}
```

**删除分区：**

| 项目 | 说明 |
|------|------|
| **方法** | `DELETE` |
| **路径** | `/api/v1/data/lake/tables/{tableId}/partitions/{partitionPath}` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tableId": "hudi-tbl-001",
    "partitionPath": "created_at=2026-07-01",
    "deleted": true,
    "deletedAt": "2026-07-16T13:45:00Z"
  },
  "traceId": "trace-039"
}
```

---

### 3.5 数据仓库 API

StarRocks OLAP 查询、数仓分层管理、物化视图管理。

#### 3.5.1 执行 StarRocks 查询

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/warehouse/queries` |
| **认证** | Bearer Token |
| **权限** | `data:warehouse:query` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `database` | string | 是 | 数据库名 |
| `sql` | string | 是 | 查询 SQL |
| `limit` | integer | 否 | 返回行数限制，默认 1000，最大 10000 |
| `timeout` | integer | 否 | 查询超时（秒），默认 60 |
| `format` | string | 否 | 返回格式：`json`/`csv`，默认 `json` |

**请求示例：**

```json
{
  "database": "dws",
  "sql": "SELECT dt, total_orders, total_amount FROM dws_order_daily WHERE dt >= '2026-07-01' ORDER BY dt DESC LIMIT 10",
  "limit": 10,
  "timeout": 30
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "queryId": "sr-query-001",
    "database": "dws",
    "schema": [
      { "name": "dt", "dataType": "DATE" },
      { "name": "total_orders", "dataType": "INT" },
      { "name": "total_amount", "dataType": "DECIMAL(15,2)" }
    ],
    "rows": [
      ["2026-07-15", 1250, 456789.00],
      ["2026-07-14", 1180, 432100.50],
      ["2026-07-13", 1320, 489000.00]
    ],
    "totalRows": 3,
    "queryDurationMs": 45,
    "scanBytes": 1048576,
    "scanRows": 15,
    "executedAt": "2026-07-16T14:00:00Z"
  },
  "traceId": "trace-040"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40001 | SQL 语法错误 |
| 50005 | StarRocks 查询执行失败；查询超时 |
| 50301 | StarRocks 服务不可用 |

---

#### 3.5.2 获取数仓分层结构

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/warehouse/layers` |
| **认证** | Bearer Token |
| **权限** | `data:warehouse:read` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "layers": [
      {
        "layer": "ODS",
        "name": "操作数据层",
        "description": "原始数据贴源层，保持与源系统一致的结构",
        "database": "ods",
        "tableCount": 45,
        "totalSizeBytes": 53687091200
      },
      {
        "layer": "DWD",
        "name": "明细数据层",
        "description": "维度建模的明细事实表，清洗后的规范数据",
        "database": "dwd",
        "tableCount": 28,
        "totalSizeBytes": 21474836480
      },
      {
        "layer": "DWS",
        "name": "汇总数据层",
        "description": "按主题域汇总的轻度聚合表",
        "database": "dws",
        "tableCount": 15,
        "totalSizeBytes": 5368709120
      },
      {
        "layer": "ADS",
        "name": "应用数据层",
        "description": "面向应用的高度聚合结果表",
        "database": "ads",
        "tableCount": 8,
        "totalSizeBytes": 536870912
      },
      {
        "layer": "DIM",
        "name": "维度层",
        "description": "公共维度表",
        "database": "dim",
        "tableCount": 12,
        "totalSizeBytes": 1073741824
      }
    ]
  },
  "traceId": "trace-041"
}
```

---

#### 3.5.3 获取数仓表列表

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/warehouse/tables` |
| **认证** | Bearer Token |
| **权限** | `data:warehouse:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数 |
| `database` | string | 否 | 数据库过滤 |
| `layer` | string | 否 | 分层过滤：`ODS`/`DWD`/`DWS`/`ADS`/`DIM` |
| `keyword` | string | 否 | 表名搜索 |
| `tableType` | string | 否 | 表类型：`table`/`view`/`materialized_view` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "tableId": "sr-tbl-001",
        "database": "dws",
        "tableName": "dws_order_daily",
        "layer": "DWS",
        "tableType": "table",
        "description": "订单日汇总表",
        "columnCount": 5,
        "rowCount": 365,
        "dataSizeBytes": 102400,
        "lastModified": "2026-07-16T02:30:00Z",
        "createdAt": "2026-07-01T00:00:00Z"
      },
      {
        "tableId": "sr-tbl-002",
        "database": "ads",
        "tableName": "ads_sales_dashboard",
        "layer": "ADS",
        "tableType": "materialized_view",
        "description": "销售看板物化视图",
        "columnCount": 8,
        "rowCount": 30,
        "dataSizeBytes": 51200,
        "lastRefreshTime": "2026-07-16T03:00:00Z",
        "createdAt": "2026-07-01T00:00:00Z"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "trace-042"
}
```

---

#### 3.5.4 创建物化视图

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/warehouse/materialized-views` |
| **认证** | Bearer Token |
| **权限** | `data:warehouse:write` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `database` | string | 是 | 数据库名 |
| `name` | string | 是 | 物化视图名称 |
| `description` | string | 否 | 描述 |
| `sql` | string | 是 | 物化视图定义 SQL |
| `refreshStrategy` | string | 是 | 刷新策略：`manual`/`auto`/`scheduled` |
| `refreshInterval` | string | 否 | `scheduled` 策略的刷新间隔（Cron） |
| `partitionBy` | string | 否 | 分区字段 |
| `distributionBy` | string | 否 | 分桶字段 |
| `properties` | object | 否 | StarRocks 表属性 |

**请求示例：**

```json
{
  "database": "ads",
  "name": "ads_sales_dashboard",
  "description": "销售看板物化视图",
  "sql": "SELECT dt, region, SUM(total_orders) AS orders, SUM(total_amount) AS amount FROM dws.dws_order_daily GROUP BY dt, region",
  "refreshStrategy": "scheduled",
  "refreshInterval": "0 * * * *",
  "partitionBy": "dt",
  "distributionBy": "HASH(region)",
  "properties": {
    "replication_num": "3",
    "storage_medium": "SSD"
  }
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "mvId": "mv-001",
    "database": "ads",
    "name": "ads_sales_dashboard",
    "refreshStrategy": "scheduled",
    "refreshInterval": "0 * * * *",
    "status": "created",
    "nextRefreshTime": "2026-07-16T15:00:00Z",
    "createdAt": "2026-07-16T14:10:00Z"
  },
  "traceId": "trace-043"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40001 | SQL 语法错误；刷新策略不合法 |
| 40901 | 物化视图名称已存在 |
| 50005 | StarRocks 物化视图创建失败 |

---

#### 3.5.5 刷新物化视图

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/warehouse/materialized-views/{mvId}/refresh` |
| **认证** | Bearer Token |
| **权限** | `data:warehouse:operate` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sync` | boolean | 否 | 是否同步等待刷新完成，默认 `false` |
| `partitionNames` | string[] | 否 | 指定刷新的分区 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "mvId": "mv-001",
    "refreshTaskId": "mv-refresh-001",
    "status": "running",
    "triggeredAt": "2026-07-16T14:15:00Z"
  },
  "traceId": "trace-044"
}
```

---

#### 3.5.6 获取物化视图刷新历史

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/warehouse/materialized-views/{mvId}/refresh-history` |
| **认证** | Bearer Token |
| **权限** | `data:warehouse:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "refreshId": "mv-refresh-001",
        "mvId": "mv-001",
        "status": "success",
        "triggerType": "scheduled",
        "startedAt": "2026-07-16T14:00:00Z",
        "endedAt": "2026-07-16T14:00:15Z",
        "durationSec": 15,
        "partitionsRefreshed": ["20260715", "20260716"],
        "rowsInserted": 60
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "trace-045"
}
```

---

### 3.6 数据目录 API

数据资产目录管理、元数据管理和数据血缘追踪。

#### 3.6.1 获取数据资产目录

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/catalog/assets` |
| **认证** | Bearer Token |
| **权限** | `data:catalog:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数 |
| `keyword` | string | 否 | 名称搜索 |
| `assetType` | string | 否 | 资产类型：`datasource`/`database`/`table`/`column`/`lake_table`/`warehouse_table`/`dbt_model` |
| `source` | string | 否 | 来源：`datasource`/`lake`/`warehouse`/`dbt` |
| `layer` | string | 否 | 数仓分层 |
| `tag` | string | 否 | 标签 |
| `ownerId` | string | 否 | 负责人 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "assetId": "asset-001",
        "assetType": "table",
        "name": "orders",
        "source": "datasource",
        "sourceId": "ds-20260716-0001",
        "sourceName": "业务系统主库",
        "database": "biz_core",
        "schema": "public",
        "description": "订单表",
        "columnCount": 6,
        "rowCount": 1250000,
        "tags": ["production", "core"],
        "ownerId": "user-001",
        "ownerName": "张三",
        "qualityScore": 95,
        "lastProfiledAt": "2026-07-16T06:00:00Z",
        "createdAt": "2026-07-16T10:00:00Z",
        "updatedAt": "2026-07-16T10:00:00Z"
      },
      {
        "assetId": "asset-002",
        "assetType": "lake_table",
        "name": "ods_customers",
        "source": "lake",
        "sourceId": "hudi-tbl-001",
        "sourceName": "Hudi 数据湖",
        "database": "ods_biz",
        "schema": null,
        "description": "客户信息表（Hudi MOR）",
        "columnCount": 6,
        "rowCount": 500000,
        "tags": ["ods", "hudi"],
        "ownerId": "user-001",
        "ownerName": "张三",
        "qualityScore": 92,
        "lastProfiledAt": "2026-07-16T06:00:00Z",
        "createdAt": "2026-07-16T13:00:00Z",
        "updatedAt": "2026-07-16T13:10:00Z"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "trace-046"
}
```

---

#### 3.6.2 获取资产详情

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/catalog/assets/{assetId}` |
| **认证** | Bearer Token |
| **权限** | `data:catalog:read` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "assetId": "asset-001",
    "assetType": "table",
    "name": "orders",
    "source": "datasource",
    "sourceId": "ds-20260716-0001",
    "sourceName": "业务系统主库",
    "database": "biz_core",
    "schema": "public",
    "description": "订单表",
    "columns": [
      {
        "name": "id",
        "dataType": "BIGINT",
        "nullable": false,
        "primaryKey": true,
        "comment": "订单ID",
        "qualityProfile": {
          "nullCount": 0,
          "nullRate": 0.0,
          "distinctCount": 1250000,
          "uniqueRate": 1.0,
          "minValue": "1",
          "maxValue": "1250000"
        }
      },
      {
        "name": "order_no",
        "dataType": "VARCHAR(64)",
        "nullable": false,
        "primaryKey": false,
        "comment": "订单编号",
        "qualityProfile": {
          "nullCount": 0,
          "nullRate": 0.0,
          "distinctCount": 1250000,
          "uniqueRate": 1.0
        }
      },
      {
        "name": "amount",
        "dataType": "DECIMAL(12,2)",
        "nullable": false,
        "primaryKey": false,
        "comment": "订单金额",
        "qualityProfile": {
          "nullCount": 0,
          "nullRate": 0.0,
          "distinctCount": 500000,
          "uniqueRate": 0.4,
          "minValue": "0.01",
          "maxValue": "99999.99",
          "avgValue": "256.78"
        }
      }
    ],
    "columnCount": 6,
    "rowCount": 1250000,
    "dataSizeBytes": 536870912,
    "tags": ["production", "core"],
    "ownerId": "user-001",
    "ownerName": "张三",
    "qualityScore": 95,
    "lastProfiledAt": "2026-07-16T06:00:00Z",
    "createdAt": "2026-07-16T10:00:00Z",
    "updatedAt": "2026-07-16T10:00:00Z"
  },
  "traceId": "trace-047"
}
```

---

#### 3.6.3 更新资产元数据

| 项目 | 说明 |
|------|------|
| **方法** | `PUT` |
| **路径** | `/api/v1/data/catalog/assets/{assetId}/metadata` |
| **认证** | Bearer Token |
| **权限** | `data:catalog:write` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `description` | string | 否 | 资产描述 |
| `tags` | string[] | 否 | 标签 |
| `ownerId` | string | 否 | 负责人 |
| `customProperties` | object | 否 | 自定义属性键值对 |
| `businessGlossary` | string | 否 | 关联业务术语 ID |

**请求示例：**

```json
{
  "description": "更新后的描述",
  "tags": ["production", "core", "finance"],
  "ownerId": "user-002",
  "customProperties": {
    "dataOwner": "财务部",
    "retentionDays": "365",
    "sensitivityLevel": "high"
  }
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "assetId": "asset-001",
    "description": "更新后的描述",
    "tags": ["production", "core", "finance"],
    "ownerId": "user-002",
    "customProperties": {
      "dataOwner": "财务部",
      "retentionDays": "365",
      "sensitivityLevel": "high"
    },
    "updatedAt": "2026-07-16T14:30:00Z"
  },
  "traceId": "trace-048"
}
```

---

#### 3.6.4 数据血缘查询

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/catalog/lineage` |
| **认证** | Bearer Token |
| **权限** | `data:catalog:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `assetId` | string | 是 | 资产 ID |
| `direction` | string | 否 | 方向：`upstream`（上游）/`downstream`（下游）/`both`（双向），默认 `both` |
| `depth` | integer | 否 | 查询深度，默认 3，最大 10 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "rootAsset": {
      "assetId": "asset-002",
      "name": "ods_customers",
      "type": "lake_table",
      "source": "lake"
    },
    "upstream": [
      {
        "assetId": "asset-001",
        "name": "customers",
        "type": "table",
        "source": "datasource",
        "sourceName": "业务系统主库",
        "database": "biz_core",
        "relationship": "cdc_sync",
        "taskId": "cdc-20260716-0001",
        "depth": 1
      }
    ],
    "downstream": [
      {
        "assetId": "asset-003",
        "name": "dwd_customers",
        "type": "warehouse_table",
        "source": "warehouse",
        "sourceName": "StarRocks",
        "database": "dwd",
        "relationship": "dbt_model",
        "taskId": "etl-20260716-0001",
        "modelName": "dwd_customers",
        "depth": 1
      },
      {
        "assetId": "asset-004",
        "name": "dws_customer_summary",
        "type": "warehouse_table",
        "source": "warehouse",
        "sourceName": "StarRocks",
        "database": "dws",
        "relationship": "dbt_model",
        "taskId": "etl-20260716-0001",
        "modelName": "dws_customer_summary",
        "depth": 2
      }
    ],
    "edges": [
      {
        "source": "asset-001",
        "target": "asset-002",
        "type": "cdc_sync",
        "taskId": "cdc-20260716-0001"
      },
      {
        "source": "asset-002",
        "target": "asset-003",
        "type": "dbt_model",
        "taskId": "etl-20260716-0001"
      },
      {
        "source": "asset-003",
        "target": "asset-004",
        "type": "dbt_model",
        "taskId": "etl-20260716-0001"
      }
    ]
  },
  "traceId": "trace-049"
}
```

---

#### 3.6.5 数据资产画像

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/catalog/assets/{assetId}/profile` |
| **认证** | Bearer Token |
| **权限** | `data:catalog:write` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sampleSize` | integer | 否 | 采样行数，默认 10000 |
| `columns` | string[] | 否 | 指定列画像（不传则全部列） |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "assetId": "asset-001",
    "profileId": "profile-001",
    "status": "completed",
    "sampleSize": 10000,
    "columnProfiles": [
      {
        "name": "id",
        "dataType": "BIGINT",
        "nullCount": 0,
        "nullRate": 0.0,
        "distinctCount": 10000,
        "uniqueRate": 1.0,
        "minValue": "1",
        "maxValue": "1250000",
        "topValues": [
          { "value": "1", "count": 1 },
          { "value": "2", "count": 1 }
        ]
      },
      {
        "name": "status",
        "dataType": "VARCHAR(20)",
        "nullCount": 0,
        "nullRate": 0.0,
        "distinctCount": 5,
        "uniqueRate": 0.0005,
        "topValues": [
          { "value": "completed", "count": 4500 },
          { "value": "pending", "count": 2500 },
          { "value": "shipped", "count": 2000 },
          { "value": "cancelled", "count": 700 },
          { "value": "refunded", "count": 300 }
        ]
      }
    ],
    "profiledAt": "2026-07-16T14:35:00Z"
  },
  "traceId": "trace-050"
}
```

---

### 3.7 数据质量 API

数据质量规则管理、质量检查执行和质量报告。

#### 3.7.1 创建质量规则

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/quality/rules` |
| **认证** | Bearer Token |
| **权限** | `data:quality:write` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 规则名称 |
| `description` | string | 否 | 描述 |
| `targetType` | string | 是 | 目标类型：`datasource_table`/`lake_table`/`warehouse_table` |
| `targetConfig` | object | 是 | 目标配置 |
| `targetConfig.datasourceId` | string | 否 | 数据源 ID |
| `targetConfig.database` | string | 是 | 数据库名 |
| `targetConfig.table` | string | 是 | 表名 |
| `targetConfig.column` | string | 否 | 列名（列级规则） |
| `ruleType` | string | 是 | 规则类型：`not_null`/`unique`/`not_empty`/`range`/`regex`/`enum`/`foreign_key`/`custom_sql` |
| `ruleConfig` | object | 是 | 规则配置（随类型不同） |
| `ruleConfig.minValue` | any | 否 | `range` 类型最小值 |
| `ruleConfig.maxValue` | any | 否 | `range` 类型最大值 |
| `ruleConfig.pattern` | string | 否 | `regex` 类型正则表达式 |
| `ruleConfig.allowedValues` | array | 否 | `enum` 类型允许值列表 |
| `ruleConfig.sql` | string | 否 | `custom_sql` 类型自定义 SQL |
| `severity` | string | 是 | 严重级别：`info`/`warning`/`error`/`critical` |
| `threshold` | number | 否 | 失败阈值（失败率），默认 0.0（任何失败即告警） |
| `schedule` | string | 否 | 检查调度（Cron），不传则不自动检查 |

**请求示例：**

```json
{
  "name": "订单ID非空检查",
  "description": "检查 orders 表 id 字段不为空",
  "targetType": "warehouse_table",
  "targetConfig": {
    "database": "dwd",
    "table": "dwd_orders",
    "column": "id"
  },
  "ruleType": "not_null",
  "ruleConfig": {},
  "severity": "critical",
  "threshold": 0.0,
  "schedule": "0 3 * * *"
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ruleId": "qr-001",
    "name": "订单ID非空检查",
    "status": "active",
    "schedule": "0 3 * * *",
    "nextCheckTime": "2026-07-17T03:00:00Z",
    "createdAt": "2026-07-16T15:00:00Z"
  },
  "traceId": "trace-051"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40001 | 规则类型不合法；规则配置与类型不匹配 |
| 40401 | 目标表不存在 |

---

#### 3.7.2 获取质量规则列表

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/quality/rules` |
| **认证** | Bearer Token |
| **权限** | `data:quality:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数 |
| `keyword` | string | 否 | 名称搜索 |
| `ruleType` | string | 否 | 规则类型过滤 |
| `severity` | string | 否 | 严重级别过滤 |
| `status` | string | 否 | `active`/`inactive` |
| `targetTable` | string | 否 | 目标表过滤 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "ruleId": "qr-001",
        "name": "订单ID非空检查",
        "ruleType": "not_null",
        "severity": "critical",
        "status": "active",
        "targetType": "warehouse_table",
        "targetTable": "dwd.dwd_orders",
        "targetColumn": "id",
        "lastCheckStatus": "passed",
        "lastCheckTime": "2026-07-16T03:00:00Z",
        "lastFailureCount": 0,
        "schedule": "0 3 * * *",
        "nextCheckTime": "2026-07-17T03:00:00Z",
        "createdAt": "2026-07-16T15:00:00Z"
      },
      {
        "ruleId": "qr-002",
        "name": "订单金额范围检查",
        "ruleType": "range",
        "severity": "error",
        "status": "active",
        "targetType": "warehouse_table",
        "targetTable": "dwd.dwd_orders",
        "targetColumn": "amount",
        "lastCheckStatus": "failed",
        "lastCheckTime": "2026-07-16T03:00:00Z",
        "lastFailureCount": 5,
        "lastFailureRate": 0.0004,
        "schedule": "0 3 * * *",
        "nextCheckTime": "2026-07-17T03:00:00Z",
        "createdAt": "2026-07-16T15:00:00Z"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "trace-052"
}
```

---

#### 3.7.3 执行质量检查

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/quality/rules/{ruleId}/check` |
| **认证** | Bearer Token |
| **权限** | `data:quality:operate` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sync` | boolean | 否 | 是否同步等待结果，默认 `true` |
| `sampleSize` | integer | 否 | 采样行数，不传则全量检查 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "checkId": "qc-001",
    "ruleId": "qr-001",
    "ruleName": "订单ID非空检查",
    "status": "passed",
    "totalRows": 50000,
    "failedRows": 0,
    "failureRate": 0.0,
    "severity": "critical",
    "threshold": 0.0,
    "passed": true,
    "sampleSize": null,
    "startedAt": "2026-07-16T15:05:00Z",
    "endedAt": "2026-07-16T15:05:10Z",
    "durationSec": 10
  },
  "traceId": "trace-053"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 规则不存在 |
| 50003 | 质量检查执行失败 |

---

#### 3.7.4 获取质量报告

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/quality/reports` |
| **认证** | Bearer Token |
| **权限** | `data:quality:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `startDate` | string | 是 | 报告开始日期 |
| `endDate` | string | 是 | 报告结束日期 |
| `targetTable` | string | 否 | 目标表过滤 |
| `severity` | string | 否 | 严重级别过滤 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "reportId": "qrpt-001",
    "period": {
      "startDate": "2026-07-10",
      "endDate": "2026-07-16"
    },
    "summary": {
      "totalRules": 40,
      "totalChecks": 280,
      "passedChecks": 265,
      "failedChecks": 15,
      "passRate": 0.9464,
      "criticalFailures": 2,
      "errorFailures": 8,
      "warningFailures": 5,
      "overallScore": 92
    },
    "byTable": [
      {
        "table": "dwd.dwd_orders",
        "ruleCount": 8,
        "checkCount": 56,
        "failedCount": 3,
        "passRate": 0.9464,
        "score": 90
      },
      {
        "table": "dwd.dwd_customers",
        "ruleCount": 5,
        "checkCount": 35,
        "failedCount": 0,
        "passRate": 1.0,
        "score": 100
      }
    ],
    "topFailures": [
      {
        "ruleId": "qr-002",
        "ruleName": "订单金额范围检查",
        "table": "dwd.dwd_orders",
        "severity": "error",
        "failureCount": 5,
        "lastFailureTime": "2026-07-16T03:00:00Z"
      }
    ],
    "trend": [
      { "date": "2026-07-10", "passRate": 0.95, "score": 91 },
      { "date": "2026-07-11", "passRate": 0.96, "score": 93 },
      { "date": "2026-07-12", "passRate": 0.94, "score": 90 },
      { "date": "2026-07-13", "passRate": 0.95, "score": 92 },
      { "date": "2026-07-14", "passRate": 0.97, "score": 94 },
      { "date": "2026-07-15", "passRate": 0.95, "score": 92 },
      { "date": "2026-07-16", "passRate": 0.95, "score": 92 }
    ],
    "generatedAt": "2026-07-16T16:00:00Z"
  },
  "traceId": "trace-054"
}
```

---

#### 3.7.5 质量监控看板

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/quality/dashboard` |
| **认证** | Bearer Token |
| **权限** | `data:quality:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `timeRange` | string | 否 | `24h`/`7d`/`30d`，默认 `24h` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "timeRange": "24h",
    "overview": {
      "activeRules": 40,
      "checksToday": 40,
      "passRate": 0.95,
      "criticalAlerts": 0,
      "errorAlerts": 1,
      "warningAlerts": 2,
      "overallScore": 92
    },
    "alerts": [
      {
        "alertId": "qa-001",
        "ruleId": "qr-002",
        "ruleName": "订单金额范围检查",
        "severity": "error",
        "table": "dwd.dwd_orders",
        "failureCount": 5,
        "failureRate": 0.0004,
        "alertTime": "2026-07-16T03:00:10Z",
        "status": "open"
      }
    ],
    "scoreByLayer": [
      { "layer": "ODS", "score": 95 },
      { "layer": "DWD", "score": 90 },
      { "layer": "DWS", "score": 98 },
      { "layer": "ADS", "score": 100 }
    ]
  },
  "traceId": "trace-055"
}
```

---

### 3.8 任务监控 API

ETL/CDC 任务运行状态监控、SLA 监控、失败告警和任务日志查询。

#### 3.8.1 获取任务运行状态总览

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/monitoring/overview` |
| **认证** | Bearer Token |
| **权限** | `data:monitoring:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `timeRange` | string | 否 | `1h`/`6h`/`24h`/`7d`，默认 `24h` |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "timeRange": "24h",
    "cdcTasks": {
      "total": 5,
      "running": 3,
      "stopped": 1,
      "failed": 1,
      "avgLagMs": 1500
    },
    "etlTasks": {
      "total": 20,
      "active": 15,
      "paused": 3,
      "error": 2,
      "runsToday": 35,
      "successRate": 0.94
    },
    "sla": {
      "totalSlaRules": 10,
      "atRisk": 1,
      "violated": 0
    },
    "alerts": {
      "critical": 1,
      "error": 3,
      "warning": 5,
      "unacknowledged": 4
    }
  },
  "traceId": "trace-056"
}
```

---

#### 3.8.2 SLA 监控

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/monitoring/sla` |
| **认证** | Bearer Token |
| **权限** | `data:monitoring:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `status` | string | 否 | `on_track`/`at_risk`/`violated` |
| `taskId` | string | 否 | 任务 ID 过滤 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "slaRules": [
      {
        "slaId": "sla-001",
        "taskId": "etl-20260716-0001",
        "taskName": "订单数据每日汇总",
        "taskType": "etl",
        "schedule": "0 2 * * *",
        "slaDeadline": "2026-07-17T04:00:00Z",
        "expectedDurationSec": 3600,
        "actualDurationSec": 1800,
        "status": "on_track",
        "remainingTimeSec": 72000,
        "lastRunStatus": "success"
      },
      {
        "slaId": "sla-002",
        "taskId": "etl-20260716-0002",
        "taskName": "客户数据全量同步",
        "taskType": "etl",
        "schedule": "0 1 * * *",
        "slaDeadline": "2026-07-17T03:00:00Z",
        "expectedDurationSec": 5400,
        "actualDurationSec": 5200,
        "status": "at_risk",
        "remainingTimeSec": 200,
        "lastRunStatus": "running"
      }
    ],
    "summary": {
      "total": 10,
      "onTrack": 8,
      "atRisk": 1,
      "violated": 1
    }
  },
  "traceId": "trace-057"
}
```

---

#### 3.8.3 失败告警列表

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/monitoring/alerts` |
| **认证** | Bearer Token |
| **权限** | `data:monitoring:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数 |
| `severity` | string | 否 | `info`/`warning`/`error`/`critical` |
| `status` | string | 否 | `open`/`acknowledged`/`resolved` |
| `taskType` | string | 否 | `cdc`/`etl` |
| `startTime` | string | 否 | 开始时间 |
| `endTime` | string | 否 | 结束时间 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "alertId": "alert-001",
        "taskId": "cdc-20260716-0002",
        "taskName": "客户表实时同步",
        "taskType": "cdc",
        "severity": "critical",
        "status": "open",
        "title": "CDC 任务失败",
        "message": "Flink 作业 cdc-20260716-0002 执行失败: Source database connection lost",
        "errorType": "SOURCE_CONNECTION_ERROR",
        "errorDetails": {
          "flinkJobId": "job-flink-003",
          "exception": "java.net.ConnectException: Connection refused",
          "failedAt": "2026-07-16T10:30:00Z"
        },
        "triggeredAt": "2026-07-16T10:30:05Z",
        "acknowledgedBy": null,
        "acknowledgedAt": null,
        "resolvedAt": null
      },
      {
        "alertId": "alert-002",
        "taskId": "etl-20260716-0003",
        "taskName": "日终报表生成",
        "taskType": "etl",
        "severity": "error",
        "status": "acknowledged",
        "title": "ETL 任务步骤失败",
        "message": "步骤 dbt_test 失败: 2 个测试未通过",
        "errorType": "DBT_TEST_FAILURE",
        "errorDetails": {
          "runId": "run-20260716-0003",
          "failedStep": "dbt_test",
          "failedTests": [
            "not_null_dwd_orders.customer_id",
            "unique_dwd_orders.order_no"
          ]
        },
        "triggeredAt": "2026-07-16T03:15:00Z",
        "acknowledgedBy": "user-001",
        "acknowledgedAt": "2026-07-16T03:20:00Z",
        "resolvedAt": null
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "traceId": "trace-058"
}
```

---

#### 3.8.4 确认/解决告警

| 项目 | 说明 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/v1/data/monitoring/alerts/{alertId}/acknowledge` |
| **认证** | Bearer Token |
| **权限** | `data:monitoring:operate` |

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `action` | string | 是 | `acknowledge`/`resolve` |
| `note` | string | 否 | 处理备注 |

**请求示例：**

```json
{
  "action": "acknowledge",
  "note": "正在排查源数据库连接问题"
}
```

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "alertId": "alert-001",
    "status": "acknowledged",
    "acknowledgedBy": "user-001",
    "acknowledgedAt": "2026-07-16T10:35:00Z",
    "note": "正在排查源数据库连接问题"
  },
  "traceId": "trace-059"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 告警不存在 |
| 40901 | 告警已被确认/解决 |

---

#### 3.8.5 获取任务日志

| 项目 | 说明 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/v1/data/monitoring/logs` |
| **认证** | Bearer Token |
| **权限** | `data:monitoring:read` |

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskId` | string | 是 | 任务 ID |
| `runId` | string | 否 | 执行 ID（ETL 任务） |
| `step` | string | 否 | 步骤名（ETL 任务） |
| `level` | string | 否 | 日志级别：`INFO`/`WARN`/`ERROR`/`DEBUG` |
| `startTime` | string | 否 | 开始时间 |
| `endTime` | string | 否 | 结束时间 |
| `keyword` | string | 否 | 关键词搜索 |
| `page` | integer | 否 | 页码 |
| `pageSize` | integer | 否 | 每页条数，默认 100 |

**响应示例：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "etl-20260716-0001",
    "runId": "run-20260716-0001",
    "step": "dbt_transform",
    "logs": [
      {
        "timestamp": "2026-07-16T02:05:00Z",
        "level": "INFO",
        "message": "Starting dbt run with models: dwd_orders, dws_order_daily",
        "step": "dbt_transform"
      },
      {
        "timestamp": "2026-07-16T02:05:05Z",
        "level": "INFO",
        "message": "1 of 2 START table model dwd.dwd_orders [RUN]",
        "step": "dbt_transform"
      },
      {
        "timestamp": "2026-07-16T02:15:00Z",
        "level": "INFO",
        "message": "1 of 2 OK created sql table model dwd.dwd_orders [SELECT 50000 rows in 600.0s]",
        "step": "dbt_transform"
      },
      {
        "timestamp": "2026-07-16T02:15:05Z",
        "level": "INFO",
        "message": "2 of 2 START table model dws.dws_order_daily [RUN]",
        "step": "dbt_transform"
      },
      {
        "timestamp": "2026-07-16T02:25:00Z",
        "level": "INFO",
        "message": "2 of 2 OK created sql table model dws.dws_order_daily [SELECT 1000 rows in 600.0s]",
        "step": "dbt_transform"
      },
      {
        "timestamp": "2026-07-16T02:25:05Z",
        "level": "INFO",
        "message": "Finished running 2 table models in 1200.0s",
        "step": "dbt_transform"
      }
    ],
    "total": 6,
    "page": 1,
    "pageSize": 100,
    "totalPages": 1
  },
  "traceId": "trace-060"
}
```

**错误场景：**

| code | 场景 |
|------|------|
| 40401 | 任务不存在 |

---

## 4. 数据模型

### 4.1 PostgreSQL 元数据表

TECH-DATA 使用 PostgreSQL 17 存储所有元数据配置信息。

#### 4.1.1 `data_sources` - 数据源表

```sql
CREATE TABLE data_sources (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    name            VARCHAR(100)  NOT NULL,
    type            VARCHAR(50)   NOT NULL,          -- mysql/postgresql/oracle/...
    category        VARCHAR(30)   NOT NULL,          -- database/api/file/object_storage/streaming
    description     TEXT,
    connection_config JSONB       NOT NULL,           -- 加密存储的连接配置
    tags            TEXT[]        DEFAULT '{}',
    owner_id        VARCHAR(64)   NOT NULL,
    status          VARCHAR(20)   DEFAULT 'created',  -- created/active/disabled
    connection_status VARCHAR(20) DEFAULT 'untested', -- connected/disconnected/untested/error
    last_connected_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);
```

#### 4.1.2 `cdc_tasks` - CDC 任务表

```sql
CREATE TABLE cdc_tasks (
    id                    VARCHAR(64)   PRIMARY KEY,
    tenant_id             VARCHAR(64)   NOT NULL,
    name                  VARCHAR(200)  NOT NULL,
    description           TEXT,
    source_datasource_id  VARCHAR(64)   NOT NULL REFERENCES data_sources(id),
    source_config         JSONB         NOT NULL,
    target_config         JSONB         NOT NULL,
    sync_config           JSONB         NOT NULL,
    flink_job_id          VARCHAR(128),
    status                VARCHAR(20)   DEFAULT 'created',  -- created/running/stopped/failed/paused
    owner_id              VARCHAR(64)   NOT NULL,
    created_at            TIMESTAMPTZ   DEFAULT NOW(),
    started_at            TIMESTAMPTZ,
    updated_at            TIMESTAMPTZ   DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);
```

#### 4.1.3 `etl_tasks` - ETL 任务表

```sql
CREATE TABLE etl_tasks (
    id                    VARCHAR(64)   PRIMARY KEY,
    tenant_id             VARCHAR(64)   NOT NULL,
    name                  VARCHAR(200)  NOT NULL,
    description           TEXT,
    task_type             VARCHAR(30)   NOT NULL,  -- etl/elt/dbt/sql/python/shell
    source_datasource_ids TEXT[]        DEFAULT '{}',
    target_datasource_id  VARCHAR(64),
    dag_config            JSONB         NOT NULL,
    steps                 JSONB         NOT NULL,
    dag_id                VARCHAR(128),
    airflow_dag_id        VARCHAR(128),
    status                VARCHAR(20)   DEFAULT 'created',  -- created/active/paused/error
    owner_id              VARCHAR(64)   NOT NULL,
    created_at            TIMESTAMPTZ   DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);
```

#### 4.1.4 `etl_task_runs` - ETL 任务执行历史表

```sql
CREATE TABLE etl_task_runs (
    id              VARCHAR(64)   PRIMARY KEY,
    task_id         VARCHAR(64)   NOT NULL REFERENCES etl_tasks(id),
    airflow_run_id  VARCHAR(256),
    logical_date    TIMESTAMPTZ   NOT NULL,
    status          VARCHAR(20)   NOT NULL,  -- running/success/failed/queued
    trigger_type    VARCHAR(20)   NOT NULL,  -- manual/scheduled
    triggered_by    VARCHAR(64)   NOT NULL,
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    duration_sec    INTEGER,
    step_results    JSONB,                   -- 各步骤执行结果
    error_message   TEXT,
    trace_id        VARCHAR(128),
    created_at      TIMESTAMPTZ   DEFAULT NOW()
);
```

#### 4.1.5 `lake_tables` - 数据湖表元数据

```sql
CREATE TABLE lake_tables (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    lake_type       VARCHAR(20)   NOT NULL,  -- hudi/iceberg
    database_name   VARCHAR(100)  NOT NULL,
    table_name      VARCHAR(200)  NOT NULL,
    description     TEXT,
    table_type      VARCHAR(20),             -- COW/MOR (Hudi)
    location        TEXT         NOT NULL,
    schema_json     JSONB        NOT NULL,
    primary_key     VARCHAR(500),
    pre_combine_field VARCHAR(100),
    partition_fields VARCHAR(500),
    index_type      VARCHAR(50),
    hoodie_config   JSONB,
    properties      JSONB,
    row_count       BIGINT,
    data_size_bytes BIGINT,
    file_count      INTEGER,
    last_commit_time TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE(tenant_id, lake_type, database_name, table_name)
);
```

#### 4.1.6 `quality_rules` - 数据质量规则表

```sql
CREATE TABLE quality_rules (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    name            VARCHAR(200)  NOT NULL,
    description     TEXT,
    target_type     VARCHAR(30)   NOT NULL,  -- datasource_table/lake_table/warehouse_table
    target_config   JSONB         NOT NULL,
    rule_type       VARCHAR(30)   NOT NULL,  -- not_null/unique/range/regex/enum/custom_sql
    rule_config     JSONB         NOT NULL,
    severity        VARCHAR(20)   NOT NULL,  -- info/warning/error/critical
    threshold       DECIMAL(5,4)  DEFAULT 0.0,
    schedule        VARCHAR(100),
    status          VARCHAR(20)   DEFAULT 'active',
    owner_id        VARCHAR(64)   NOT NULL,
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);
```

#### 4.1.7 `quality_checks` - 质量检查记录表

```sql
CREATE TABLE quality_checks (
    id              VARCHAR(64)   PRIMARY KEY,
    rule_id         VARCHAR(64)   NOT NULL REFERENCES quality_rules(id),
    status          VARCHAR(20)   NOT NULL,  -- passed/failed/error
    total_rows      BIGINT,
    failed_rows     BIGINT,
    failure_rate    DECIMAL(8,6),
    severity        VARCHAR(20)   NOT NULL,
    threshold       DECIMAL(5,4),
    passed          BOOLEAN       NOT NULL,
    sample_size     INTEGER,
    error_details   JSONB,
    trace_id        VARCHAR(128),
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    duration_sec    INTEGER,
    created_at      TIMESTAMPTZ   DEFAULT NOW()
);
```

#### 4.1.8 `catalog_assets` - 数据资产目录表

```sql
CREATE TABLE catalog_assets (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    asset_type      VARCHAR(30)   NOT NULL,  -- datasource/database/table/column/lake_table/warehouse_table/dbt_model
    name            VARCHAR(200)  NOT NULL,
    source          VARCHAR(30)   NOT NULL,  -- datasource/lake/warehouse/dbt
    source_id       VARCHAR(64),
    source_name     VARCHAR(200),
    database_name   VARCHAR(100),
    schema_name     VARCHAR(100),
    description     TEXT,
    columns_json    JSONB,
    column_count    INTEGER,
    row_count       BIGINT,
    data_size_bytes BIGINT,
    tags            TEXT[]        DEFAULT '{}',
    owner_id        VARCHAR(64),
    quality_score   INTEGER,
    custom_properties JSONB,
    last_profiled_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW()
);
```

#### 4.1.9 `lineage_edges` - 数据血缘关系表

```sql
CREATE TABLE lineage_edges (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    source_asset_id VARCHAR(64)   NOT NULL REFERENCES catalog_assets(id),
    target_asset_id VARCHAR(64)   NOT NULL REFERENCES catalog_assets(id),
    edge_type       VARCHAR(30)   NOT NULL,  -- cdc_sync/dbt_model/etl_transform/ingestion
    task_id         VARCHAR(64),
    transform_config JSONB,
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    UNIQUE(source_asset_id, target_asset_id, edge_type, task_id)
);
```

#### 4.1.10 `sla_rules` - SLA 规则表

```sql
CREATE TABLE sla_rules (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    task_id         VARCHAR(64)   NOT NULL,
    task_type       VARCHAR(20)   NOT NULL,  -- cdc/etl
    sla_deadline_offset_sec BIGINT NOT NULL, -- 距离调度时间的偏移量
    expected_duration_sec INTEGER,
    status          VARCHAR(20)   DEFAULT 'active',
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW()
);
```

#### 4.1.11 `alerts` - 告警表

```sql
CREATE TABLE alerts (
    id              VARCHAR(64)   PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    task_id         VARCHAR(64),
    task_name       VARCHAR(200),
    task_type       VARCHAR(20),             -- cdc/etl
    severity        VARCHAR(20)   NOT NULL,  -- info/warning/error/critical
    status          VARCHAR(20)   DEFAULT 'open',  -- open/acknowledged/resolved
    title           VARCHAR(500)  NOT NULL,
    message         TEXT          NOT NULL,
    error_type      VARCHAR(100),
    error_details   JSONB,
    triggered_at    TIMESTAMPTZ   DEFAULT NOW(),
    acknowledged_by VARCHAR(64),
    acknowledged_at TIMESTAMPTZ,
    resolved_by     VARCHAR(64),
    resolved_at     TIMESTAMPTZ,
    note            TEXT,
    trace_id        VARCHAR(128)
);
```

#### 4.1.12 `outbox_events` - Outbox 事件表

```sql
CREATE TABLE outbox_events (
    id              BIGSERIAL     PRIMARY KEY,
    tenant_id       VARCHAR(64)   NOT NULL,
    aggregate_type  VARCHAR(50)   NOT NULL,  -- cdc_task/etl_task/datasource/...
    aggregate_id    VARCHAR(64)   NOT NULL,
    event_type      VARCHAR(100)  NOT NULL,
    payload         JSONB         NOT NULL,
    headers         JSONB         DEFAULT '{}',
    trace_id        VARCHAR(128),
    status          VARCHAR(20)   DEFAULT 'pending',  -- pending/sent/failed
    retry_count     INTEGER       DEFAULT 0,
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    sent_at         TIMESTAMPTZ
);
```

### 4.2 StarRocks OLAP 表

数仓分层使用 StarRocks 3.4 存储。

#### 4.2.1 ODS 层 - `ods.ods_orders`

```sql
CREATE TABLE ods.ods_orders (
    id              BIGINT       NOT NULL COMMENT '订单ID',
    order_no        VARCHAR(64)  NOT NULL COMMENT '订单编号',
    customer_id     BIGINT       NOT NULL COMMENT '客户ID',
    amount          DECIMAL(12,2) NOT NULL COMMENT '订单金额',
    status          VARCHAR(20)  NOT NULL COMMENT '订单状态',
    created_at      DATETIME     NOT NULL COMMENT '创建时间',
    updated_at      DATETIME     NOT NULL COMMENT '更新时间'
) ENGINE=OLAP
DUPLICATE KEY(id)
PARTITION BY date_trunc('day', created_at)
DISTRIBUTED BY HASH(id) BUCKETS 10
PROPERTIES (
    "replication_num" = "3",
    "storage_medium" = "HDD",
    "dynamic_partition.enable" = "true",
    "dynamic_partition.time_unit" = "DAY",
    "dynamic_partition.start" = "-365",
    "dynamic_partition.end" = "3",
    "dynamic_partition.prefix" = "p"
);
```

#### 4.2.2 DWD 层 - `dwd.dwd_orders`

```sql
CREATE TABLE dwd.dwd_orders (
    id              BIGINT       NOT NULL COMMENT '订单ID',
    order_no        VARCHAR(64)  NOT NULL COMMENT '订单编号',
    customer_id     BIGINT       NOT NULL COMMENT '客户ID',
    customer_name   VARCHAR(128) NULL COMMENT '客户名称',
    amount          DECIMAL(12,2) NOT NULL COMMENT '订单金额',
    status          VARCHAR(20)  NOT NULL COMMENT '订单状态',
    dt              DATE         NOT NULL COMMENT '分区日期'
) ENGINE=OLAP
UNIQUE KEY(id)
PARTITION BY date_trunc('day', dt)
DISTRIBUTED BY HASH(id) BUCKETS 10
PROPERTIES (
    "replication_num" = "3",
    "storage_medium" = "SSD"
);
```

#### 4.2.3 DWS 层 - `dws.dws_order_daily`

```sql
CREATE TABLE dws.dws_order_daily (
    dt              DATE         NOT NULL COMMENT '日期',
    region          VARCHAR(50)  NULL COMMENT '区域',
    total_orders    INT          NOT NULL COMMENT '总订单数',
    total_amount    DECIMAL(15,2) NOT NULL COMMENT '总金额',
    avg_amount      DECIMAL(10,2) NULL COMMENT '平均金额'
) ENGINE=OLAP
DUPLICATE KEY(dt, region)
PARTITION BY date_trunc('month', dt)
DISTRIBUTED BY HASH(dt) BUCKETS 5
PROPERTIES (
    "replication_num" = "3",
    "storage_medium" = "SSD"
);
```

#### 4.2.4 ADS 层物化视图 - `ads.ads_sales_dashboard`

```sql
CREATE MATERIALIZED VIEW ads.ads_sales_dashboard
DISTRIBUTED BY HASH(region) BUCKETS 3
PARTITION BY date_trunc('day', dt)
REFRESH ASYNC EVERY (INTERVAL 1 HOUR)
PROPERTIES (
    "replication_num" = "3"
)
AS
SELECT
    dt,
    region,
    SUM(total_orders) AS orders,
    SUM(total_amount) AS amount
FROM dws.dws_order_daily
GROUP BY dt, region;
```

### 4.3 Hudi 数据湖表

Hudi 表通过 Flink CDC DeltaStreamer 或 Hudi Flink Connector 创建。

#### 4.3.1 Hudi MOR 表 - `ods_biz.ods_orders`

```sql
-- 通过 Flink SQL 创建 Hudi MOR 表
CREATE TABLE ods_biz.ods_orders (
    id              BIGINT       NOT NULL PRIMARY KEY NOT ENFORCED,
    order_no        STRING       NOT NULL,
    customer_id     BIGINT       NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    status          STRING       NOT NULL,
    created_at      TIMESTAMP(3) NOT NULL,
    updated_at      TIMESTAMP(3) NOT NULL
) WITH (
    'connector' = 'hudi',
    'path' = 'hdfs:///data/lake/hudi/ods_biz/ods_orders',
    'table.type' = 'MERGE_ON_READ',
    'hoodie.datasource.write.recordkey.field' = 'id',
    'hoodie.datasource.write.precombine.field' = 'updated_at',
    'hoodie.datasource.write.partitionpath.field' = 'created_at',
    'hoodie.index.type' = 'BLOOM',
    'hoodie.clean.async' = 'true',
    'hoodie.clean.retains_commits' = '10',
    'hoodie.compact.async' = 'true',
    'hoodie.compact.inline.max.delta.commits' = '5',
    'compaction.tasks' = '2',
    'write.tasks' = '2',
    'checkpoint.interval' = '60000'
);
```

#### 4.3.2 Hudi COW 表 - `ods_biz.ods_customers`

```sql
CREATE TABLE ods_biz.ods_customers (
    id              BIGINT       NOT NULL PRIMARY KEY NOT ENFORCED,
    customer_name   STRING       NOT NULL,
    phone           STRING,
    email           STRING,
    created_at      TIMESTAMP(3) NOT NULL,
    updated_at      TIMESTAMP(3) NOT NULL
) WITH (
    'connector' = 'hudi',
    'path' = 'hdfs:///data/lake/hudi/ods_biz/ods_customers',
    'table.type' = 'COPY_ON_WRITE',
    'hoodie.datasource.write.recordkey.field' = 'id',
    'hoodie.datasource.write.precombine.field' = 'updated_at',
    'hoodie.datasource.write.partitionpath.field' = 'created_at',
    'hoodie.index.type' = 'BLOOM',
    'write.tasks' = '1'
);
```

### 4.4 Iceberg 数据湖表

```sql
CREATE TABLE ods_biz.ods_events (
    event_id        STRING       NOT NULL,
    event_type      STRING       NOT NULL,
    event_data      STRING,
    event_time      TIMESTAMP(3) NOT NULL
) WITH (
    'connector' = 'iceberg',
    'catalog-name' = 'hive_catalog',
    'catalog-type' = 'hive',
    'warehouse' = 'hdfs:///data/lake/iceberg',
    'format-version' = '2',
    'write.format.default' = 'parquet'
) PARTITIONED BY (days(event_time), event_type);
```

---

## 5. 事件定义

TECH-DATA 通过 Kafka 发布事件，遵循 **Outbox 模式**（先写 `outbox_events` 表，再由轮询任务投递）。所有事件消息头包含 `X-Trace-Id`。

### 5.1 Kafka Topic 规划

| Topic | 说明 | 消费者 |
|-------|------|--------|
| `tech_data.cdc.sync` | CDC 数据同步事件 | TECH-ONT, TECH-RAG |
| `tech_data.task.status` | ETL/CDC 任务状态变更事件 | TECH-OBS, APP-ONTSTUDIO |
| `tech_data.quality.alert` | 数据质量告警事件 | TECH-OBS |
| `tech_data.lake.commit` | 数据湖提交事件 | TECH-ONT |
| `tech_data.dlq` | 死信队列（消费失败超过 3 次） | 监控系统 |

### 5.2 事件通用结构

```json
{
  "eventId": "evt-20260716-0001",
  "eventType": "cdc.sync.completed",
  "tenantId": "tenant-001",
  "aggregateType": "cdc_task",
  "aggregateId": "cdc-20260716-0001",
  "timestamp": "2026-07-16T11:05:00Z",
  "traceId": "trace-a1b2c3d4e5f6",
  "payload": {
    // 事件特定数据
  }
}
```

### 5.3 事件详情

#### 5.3.1 `cdc.sync.started` - CDC 同步启动

**Topic:** `tech_data.cdc.sync`

```json
{
  "eventId": "evt-001",
  "eventType": "cdc.sync.started",
  "tenantId": "tenant-001",
  "aggregateType": "cdc_task",
  "aggregateId": "cdc-20260716-0001",
  "timestamp": "2026-07-16T11:01:00Z",
  "traceId": "trace-009",
  "payload": {
    "taskId": "cdc-20260716-0001",
    "taskName": "订单表实时同步",
    "sourceDatasourceId": "ds-20260716-0001",
    "sourceTables": ["orders", "order_items"],
    "targetType": "hudi",
    "targetDatabase": "ods_biz",
    "flinkJobId": "job-flink-002",
    "startedBy": "user-001"
  }
}
```

#### 5.3.2 `cdc.sync.completed` - CDC 同步完成（Checkpoint 成功）

**Topic:** `tech_data.cdc.sync`

```json
{
  "eventId": "evt-002",
  "eventType": "cdc.sync.completed",
  "tenantId": "tenant-001",
  "aggregateType": "cdc_task",
  "aggregateId": "cdc-20260716-0001",
  "timestamp": "2026-07-16T11:05:00Z",
  "traceId": "trace-009",
  "payload": {
    "taskId": "cdc-20260716-0001",
    "checkpointId": 15,
    "checkpointTime": "2026-07-16T11:05:00Z",
    "recordsWritten": 5000,
    "totalRecordsWritten": 1500000,
    "tablesSynced": [
      { "sourceTable": "orders", "targetTable": "ods_orders", "records": 3000 },
      { "sourceTable": "order_items", "targetTable": "ods_order_items", "records": 2000 }
    ]
  }
}
```

#### 5.3.3 `cdc.sync.failed` - CDC 同步失败

**Topic:** `tech_data.cdc.sync`

```json
{
  "eventId": "evt-003",
  "eventType": "cdc.sync.failed",
  "tenantId": "tenant-001",
  "aggregateType": "cdc_task",
  "aggregateId": "cdc-20260716-0001",
  "timestamp": "2026-07-16T11:10:00Z",
  "traceId": "trace-009",
  "payload": {
    "taskId": "cdc-20260716-0001",
    "flinkJobId": "job-flink-002",
    "errorType": "SOURCE_CONNECTION_ERROR",
    "errorMessage": "Source database connection lost",
    "failedAt": "2026-07-16T11:10:00Z",
    "lastCheckpointId": 15,
    "lastCheckpointTime": "2026-07-16T11:05:00Z"
  }
}
```

#### 5.3.4 `etl.task.started` - ETL 任务启动

**Topic:** `tech_data.task.status`

```json
{
  "eventId": "evt-004",
  "eventType": "etl.task.started",
  "tenantId": "tenant-001",
  "aggregateType": "etl_task",
  "aggregateId": "etl-20260716-0001",
  "timestamp": "2026-07-16T02:00:00Z",
  "traceId": "trace-019",
  "payload": {
    "taskId": "etl-20260716-0001",
    "taskName": "订单数据每日汇总",
    "runId": "run-20260716-0001",
    "logicalDate": "2026-07-15T00:00:00Z",
    "triggerType": "scheduled",
    "triggeredBy": "system"
  }
}
```

#### 5.3.5 `etl.task.completed` - ETL 任务完成

**Topic:** `tech_data.task.status`

```json
{
  "eventId": "evt-005",
  "eventType": "etl.task.completed",
  "tenantId": "tenant-001",
  "aggregateType": "etl_task",
  "aggregateId": "etl-20260716-0001",
  "timestamp": "2026-07-16T02:30:00Z",
  "traceId": "trace-019",
  "payload": {
    "taskId": "etl-20260716-0001",
    "runId": "run-20260716-0001",
    "logicalDate": "2026-07-15T00:00:00Z",
    "status": "success",
    "durationSec": 1800,
    "stepsCompleted": 4,
    "totalRecordsProcessed": 200000
  }
}
```

#### 5.3.6 `etl.task.failed` - ETL 任务失败

**Topic:** `tech_data.task.status`

```json
{
  "eventId": "evt-006",
  "eventType": "etl.task.failed",
  "tenantId": "tenant-001",
  "aggregateType": "etl_task",
  "aggregateId": "etl-20260716-0003",
  "timestamp": "2026-07-16T03:15:00Z",
  "traceId": "trace-024",
  "payload": {
    "taskId": "etl-20260716-0003",
    "runId": "run-20260716-0003",
    "failedStep": "dbt_test",
    "errorType": "DBT_TEST_FAILURE",
    "errorMessage": "2 个测试未通过",
    "failedTests": [
      "not_null_dwd_orders.customer_id",
      "unique_dwd_orders.order_no"
    ]
  }
}
```

#### 5.3.7 `quality.alert.triggered` - 质量告警触发

**Topic:** `tech_data.quality.alert`

```json
{
  "eventId": "evt-007",
  "eventType": "quality.alert.triggered",
  "tenantId": "tenant-001",
  "aggregateType": "quality_rule",
  "aggregateId": "qr-002",
  "timestamp": "2026-07-16T03:00:10Z",
  "traceId": "trace-051",
  "payload": {
    "ruleId": "qr-002",
    "ruleName": "订单金额范围检查",
    "severity": "error",
    "table": "dwd.dwd_orders",
    "failureCount": 5,
    "failureRate": 0.0004,
    "threshold": 0.0,
    "checkId": "qc-002"
  }
}
```

#### 5.3.8 `lake.commit.completed` - 数据湖提交完成

**Topic:** `tech_data.lake.commit`

```json
{
  "eventId": "evt-008",
  "eventType": "lake.commit.completed",
  "tenantId": "tenant-001",
  "aggregateType": "lake_table",
  "aggregateId": "hudi-tbl-001",
  "timestamp": "2026-07-16T12:00:00Z",
  "traceId": "trace-009",
  "payload": {
    "tableId": "hudi-tbl-001",
    "lakeType": "hudi",
    "database": "ods_biz",
    "tableName": "ods_customers",
    "commitInstant": "20260716120000000",
    "action": "deltacommit",
    "recordsInserted": 500,
    "recordsUpdated": 200,
    "recordsDeleted": 0,
    "fileCount": 3
  }
}
```

### 5.4 DLQ 消息结构

消费失败超过 3 次的消息进入死信队列：

**Topic:** `tech_data.dlq`

```json
{
  "dlqId": "dlq-001",
  "originalTopic": "tech_data.cdc.sync",
  "originalEventId": "evt-002",
  "eventType": "cdc.sync.completed",
  "traceId": "trace-009",
  "payload": {
    // 原始事件 payload
  },
  "errorReason": "Consumer processing timeout",
  "retryCount": 3,
  "firstFailedAt": "2026-07-16T11:05:01Z",
  "lastFailedAt": "2026-07-16T11:06:30Z",
  "movedToDlqAt": "2026-07-16T11:06:31Z"
}
```

---

## 6. 增量交付计划

### 6.1 版本规划

| 版本 | 预计时间 | 范围 | 关键交付 |
|------|----------|------|----------|
| v0.1 | 2026 Q3 | 数据源管理 MVP | 数据源 CRUD、连接测试、Schema 发现 |
| v0.2 | 2026 Q3 | ETL 任务基础 | Airflow 集成、ETL 任务 CRUD、手动触发、执行历史 |
| v0.3 | 2026 Q4 | CDC 实时同步 | Flink CDC 集成、CDC 任务 CRUD、启停、状态监控 |
| v0.4 | 2026 Q4 | 数据湖管理 | Hudi/Iceberg 表 CRUD、入湖任务、湖表查询 |
| v0.5 | 2027 Q1 | 数据仓库 | StarRocks 查询、数仓分层、物化视图 |
| v0.6 | 2027 Q1 | 数据目录 | 资产目录、元数据管理、数据血缘 |
| v0.7 | 2027 Q2 | 数据质量 | 质量规则、质量检查、质量报告 |
| v0.8 | 2027 Q2 | 任务监控 | SLA 监控、失败告警、任务日志 |
| v1.0 | 2027 Q3 | 正式发布 | 全功能 GA、性能优化、安全加固 |

### 6.2 各版本详细交付项

#### v0.1 - 数据源管理 MVP

- [ ] 数据源类型列表接口
- [ ] 数据源 CRUD（MySQL、PostgreSQL、Oracle、SQL Server）
- [ ] 数据源连接测试
- [ ] Schema 发现（库/表/字段）
- [ ] 多租户隔离
- [ ] 连接配置加密存储

#### v0.2 - ETL 任务基础

- [ ] Airflow 2.10 集成
- [ ] ETL 任务 CRUD（SQL/Python/Shell 类型）
- [ ] DAG 自动生成与同步
- [ ] 手动触发执行
- [ ] 执行历史查询
- [ ] 步骤级执行详情
- [ ] Outbox 模式事件发布

#### v0.3 - CDC 实时同步

- [ ] Flink 1.20 + Flink CDC 集成
- [ ] CDC 任务 CRUD
- [ ] Flink 作业提交与管理
- [ ] CDC 任务启停（含 Savepoint）
- [ ] 暂停/恢复
- [ ] 实时指标监控（吞吐、延迟、Checkpoint）
- [ ] CDC 管道拓扑查询
- [ ] 支持 MySQL/PostgreSQL/MongoDB CDC

#### v0.4 - 数据湖管理

- [ ] Hudi 表 CRUD（COW/MOR）
- [ ] Iceberg 表 CRUD
- [ ] Hudi DeltaStreamer 入湖
- [ ] 批量入湖任务（Airflow 调度）
- [ ] 湖表查询（Trino 引擎）
- [ ] 分区管理（列表/删除）
- [ ] 表统计信息（行数/文件数/大小）
- [ ] Hudi Timeline 查询

#### v0.5 - 数据仓库

- [ ] StarRocks 3.4 集成
- [ ] SQL 查询执行接口
- [ ] 数仓分层结构（ODS/DWD/DWS/ADS/DIM）
- [ ] 数仓表列表与详情
- [ ] 物化视图 CRUD
- [ ] 物化视图刷新（手动/定时）
- [ ] 刷新历史查询
- [ ] DBT 1.9 模型管理
- [ ] DBT 编译与运行

#### v0.6 - 数据目录

- [ ] 数据资产目录自动发现
- [ ] 资产列表与详情
- [ ] 元数据管理（描述/标签/自定义属性）
- [ ] 数据血缘自动追踪
- [ ] 血缘图谱查询（上游/下游/双向）
- [ ] 数据资产画像
- [ ] 列级质量画像
- [ ] 与 TECH-ONT 资产注册联动

#### v0.7 - 数据质量

- [ ] 质量规则 CRUD（7 种规则类型）
- [ ] 质量检查执行（同步/异步）
- [ ] 质量报告（周期性/按表/按规则）
- [ ] 质量监控看板
- [ ] 质量告警事件发布
- [ ] 质量趋势分析
- [ ] DBT Test 集成

#### v0.8 - 任务监控

- [ ] 任务运行状态总览
- [ ] SLA 规则配置与监控
- [ ] 失败告警列表
- [ ] 告警确认/解决流程
- [ ] 任务日志查询
- [ ] 日志关键词搜索
- [ ] 与 TECH-OBS 告警通道对接

#### v1.0 - 正式发布

- [ ] 全功能 API 覆盖率达标
- [ ] 性能压测与优化（API P99 < 200ms）
- [ ] OpenAPI 3.0 文档完善
- [ ] 安全加固（RBAC、数据脱敏、审计日志）
- [ ] K8s 部署 Helm Chart
- [ ] 运维手册与故障排查指南
- [ ] 与 TECH-ONT / TECH-RAG / APP-ONTSTUDIO 集成联调

### 6.3 API 接口交付清单汇总

| API 分组 | 接口数 | v0.1 | v0.2 | v0.3 | v0.4 | v0.5 | v0.6 | v0.7 | v0.8 |
|----------|--------|------|------|------|------|------|------|------|------|
| 数据源管理 | 8 | 8 | - | - | - | - | - | - | - |
| ETL/ELT 任务 | 12 | - | 12 | - | - | - | - | - | - |
| CDC 实时同步 | 10 | - | - | 10 | - | - | - | - | - |
| 数据湖管理 | 8 | - | - | - | 8 | - | - | - | - |
| 数据仓库 | 6 | - | - | - | - | 6 | - | - | - |
| 数据目录 | 5 | - | - | - | - | - | 5 | - | - |
| 数据质量 | 5 | - | - | - | - | - | - | 5 | - |
| 任务监控 | 5 | - | - | - | - | - | - | - | 5 |
| **合计** | **59** | **8** | **12** | **10** | **8** | **6** | **5** | **5** | **5** |

### 6.4 依赖与风险

| 依赖项 | 说明 | 风险等级 | 缓解措施 |
|--------|------|----------|----------|
| Flink 集群稳定性 | CDC 任务依赖 Flink 作业运行 | 高 | K8s 部署 Flink Session Cluster，配置自动恢复 |
| Airflow 调度可靠性 | ETL 任务依赖 Airflow DAG 调度 | 中 | Airflow HA 部署，DB 后端 PostgreSQL |
| StarRocks 查询性能 | 大数据量 OLAP 查询超时 | 中 | 物化视图加速、查询超时控制、分页限制 |
| 源数据库连接稳定性 | CDC 实时同步依赖源库可用性 | 高 | 连接池管理、断线重连、告警通知 |
| Hudi/Iceberg 兼容性 | 湖格式版本升级风险 | 中 | 锁定版本（Hudi 1.x / Iceberg 1.8），充分测试 |
| Kafka 消息可靠性 | 事件投递需保证 At-Least-Once | 中 | Outbox 模式 + 幂等消费 + DLQ |

---

> **文档结束**
>
> 本文档定义了 TECH-DATA 数据集成与 ETL 服务的完整 API 规范。所有接口遵循平台统一的响应体格式、认证机制和错误码规范。增量交付计划按版本分阶段实现，确保核心能力优先交付。