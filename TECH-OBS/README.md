# TECH-OBS - 可观测性服务（日志方向 P0）

> Mate Platform 基础设施可观测性子系统的日志模块，提供统一日志接入、查询与链路追踪支撑。

## 模块类型

**TECH** 模块（技术底座）。

## 作用

提供日志维度的可观测能力：

- **日志接入**：接收各业务模块写入的结构化日志，落地 PostgreSQL。
- **日志查询**：通过 LogQL 调用 Loki `/loki/api/v1/query_range`，聚合后返回分页结果。
- **链路追踪贯通**：透传 `X-Trace-Id` 到 MDC，所有响应 `ApiResponse.traceId` 字段保持一致。
- **多租户**：通过 `tenant_id` 隔离日志，`TenantContext.DEFAULT_TENANT_ID = "tenant-default"`。

M1 范围仅覆盖 P0（日志接入 + 查询）；指标、追踪、告警等 P1+ 能力将由后续版本补充。

## 上下游

### 上游依赖

- **Loki 3.3.2**（`infra/docker-compose.base.yml` 中 `obs-loki` 服务，端口 3100）：日志聚合与查询引擎。
- **PostgreSQL 17**：`obs_logs` 表持久化（库名 `metaplatform_obs`，由 `init-multiple-databases.sh` 自动创建）。

### 下游消费方

- **APP-DASHBOARD / APP-SUPERAI / APP-APPHUB**：日志查询 UI、日志告警视图。
- **所有 APP-* / TECH-* 模块**：调用 `/api/v1/obs/logs/ingest` 写入结构化日志（建议通过 OpenTelemetry Exporter 或日志切面）。
- **运维平台**：通过 Loki 原生接口或本服务间接检索历史日志。

## 端口规划

| 服务 | 端口 | 用途 |
|---|---|---|
| TECH-OBS（本服务） | **8301** | HTTP API + Actuator |
| Loki | 3100 | 日志聚合（容器内 `infra-loki`） |
| PostgreSQL | 5432 | 元数据与日志归档（库 `metaplatform_obs`） |

## API 列表

所有响应均为统一结构 `ApiResponse<T>`：`{ code, message, data, traceId }`。`code = 0` 代表成功。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/obs/logs/query` | 通过 Loki LogQL 查询日志（支持 service/level/traceId/keyword + 时间窗口 + 分页） |
| POST | `/api/v1/obs/logs/ingest` | 接收结构化日志并写入 `obs_logs` 表 |
| GET  | `/actuator/health` | 健康检查 |
| GET  | `/actuator/info` | 应用元数据 |

### `POST /api/v1/obs/logs/query`

请求体：
```json
{
  "serviceName": "iam",
  "level": "ERROR",
  "keyword": "login failed",
  "traceId": "trace-123",
  "startTime": "2026-07-16T00:00:00Z",
  "endTime": "2026-07-16T01:00:00Z",
  "page": 1,
  "size": 50
}
```

- 时间范围超过 `app.obs.query.max-time-range-hours`（默认 168h）时返回 `40005 INVALID_TIME_RANGE`。
- 单页 size 上限为 `app.obs.query.max-page-size`（默认 500），超出将被截断。

响应：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      { "timestamp": "2026-07-16T00:00:01Z", "serviceName": "iam", "level": "ERROR", "traceId": null, "message": "...", "labels": { "service": "iam" } }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 50,
    "totalPages": 1
  },
  "traceId": "..."
}
```

### `POST /api/v1/obs/logs/ingest`

请求体：
```json
{
  "serviceName": "iam",
  "level": "INFO",
  "traceId": "trace-123",
  "message": "user login success",
  "timestamp": "2026-07-16T00:00:00Z",
  "labels": { "env": "dev", "userId": "u-1" }
}
```

- `serviceName`、`level` 必填且非空字符串；
- `message` 必填；
- `timestamp` 缺省时使用服务端当前时间；
- `labels` 为任意 JSON 对象，落库到 `JSONB` 列。

成功响应 `data` 字段返回生成的日志主键 `id`（UUID 字符串）。

## 错误码（5 位）

| 错误码 | HTTP | 含义 |
|---|---|---|
| 0 | 200 | success |
| 40001 | 400 | 参数校验失败 |
| 40003 | 400 | 缺少必填字段 |
| 40004 | 400 | 字段值不合法 |
| 40005 | 400 | 时间范围不合法 |
| 40102 | 401 | Token 无效 |
| 40301 | 403 | 权限不足 |
| 40401 | 404 | 日志不存在 |
| 50001 | 500 | 服务内部错误 |
| 50301 | 503 | Loki 下游不可用 |
| 50401 | 504 | 查询执行超时 |

## 配置

`application.yml`（基础）+ `application-dev.yml`（本地开发）：

| 键 | 默认值 | 含义 |
|---|---|---|
| `server.port` | 8301 | HTTP 端口 |
| `spring.profiles.active` | dev | 默认 profile |
| `spring.datasource.url` | `jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:metaplatform_obs}` | 数据库连接 |
| `app.obs.loki.base-url` | `http://localhost:3100` | Loki 地址 |
| `app.obs.loki.query-path` | `/loki/api/v1/query_range` | Loki 查询路径 |
| `app.obs.loki.connect-timeout-ms` | 5000 | 连接超时 |
| `app.obs.loki.read-timeout-ms` | 30000 | 读超时 |
| `app.obs.query.max-time-range-hours` | 168 | 单次查询最大时间跨度（小时） |
| `app.obs.query.default-page-size` | 50 | 默认页大小 |
| `app.obs.query.max-page-size` | 500 | 单次查询最大页大小 |

环境变量可覆盖：`DB_HOST / DB_PORT / DB_NAME / DB_USERNAME / DB_PASSWORD / LOKI_BASE_URL / SPRING_PROFILES_ACTIVE`。

## 目录结构

```
TECH-OBS/
├── README.md
├── pom.xml
├── docs/
│   └── SPEC-TECH-OBS-可观测性API规范_v1.0-20260716.md
└── src/
    ├── main/
    │   ├── java/com/metaplatform/obs/
    │   │   ├── IobApplication.java                  # Spring Boot 启动类
    │   │   ├── common/                              # ApiResponse / ErrorCode / TraceContext / TraceFilter / TenantContext
    │   │   ├── config/                              # ObsLokiProperties / ObsQueryProperties / RestClientConfig
    │   │   ├── controller/LogController.java        # /logs/query + /logs/ingest
    │   │   ├── dto/                                 # LogQueryRequest / LogIngestRequest / LogEntry / PageResponse
    │   │   ├── dto/loki/LokiQueryResponse.java      # Loki 响应 DTO
    │   │   ├── entity/ObsLogEntity.java             # obs_logs 行映射
    │   │   ├── exception/                           # ObsException + GlobalExceptionHandler
    │   │   ├── repository/ObsLogRepository.java     # JdbcTemplate
    │   │   └── service/                             # LokiQueryService + LogIngestService
    │   └── resources/
    │       ├── application.yml
    │       ├── application-dev.yml
    │       └── db/migration/V1__init_obs_logs_schema.sql
    └── test/java/com/metaplatform/obs/
        ├── controller/LogControllerTest.java        # @WebMvcTest（8 用例）
        └── service/LokiQueryServiceTest.java        # RestTemplate mock（9 用例）
```

## 测试

```
cd TECH-OBS
mvn clean test
```

- `LokiQueryServiceTest` 覆盖 LogQL 构建、转义、Loki 调用 URL 拼接、ResourceAccess/HttpStatusCode 包装、时间范围校验等 9 个用例。
- `LogControllerTest` 通过 `@WebMvcTest` 覆盖 `/logs/query` 与 `/logs/ingest` 的成功路径、`@Valid` 失败（40001）、Loki 不可用（50301）等 8 个用例。
- 总用例数 ≥ 17，**满足不少于 6 个用例的最低要求**。

## 本地启动

> 说明：本任务不实际启动服务与镜像，以下步骤仅作为后续手工验证指引。

1. 启动基础依赖（在 `infra/` 下执行）：
   ```
   docker compose -f docker-compose.base.yml up -d
   ```
   启动后 `infra-loki`（3100）、`infra-postgres`（5432，包含 `metaplatform_obs` 库）应健康。

2. 启动本服务：
   ```
   cd TECH-OBS
   mvn spring-boot:run
   ```
   监听 `http://localhost:8301`。

3. 健康检查：
   ```
   curl http://localhost:8301/actuator/health
   ```

4. 验证日志查询（依赖 Loki 中存在标签 `service="iam"`、`level="ERROR"` 的数据）：
   ```
   curl -X POST http://localhost:8301/api/v1/obs/logs/query \
     -H 'Content-Type: application/json' \
     -d '{"serviceName":"iam","level":"ERROR","startTime":"2026-07-16T00:00:00Z","endTime":"2026-07-16T01:00:00Z","page":1,"size":50}'
   ```

5. 验证日志写入（落地 `obs_logs`）：
   ```
   curl -X POST http://localhost:8301/api/v1/obs/logs/ingest \
     -H 'Content-Type: application/json' \
     -d '{"serviceName":"iam","level":"INFO","traceId":"trace-1","message":"hello","labels":{"env":"dev"}}'
   ```

## 约束与设计说明

- **不修改** `TECH-IAM` / `TECH-ONT` 业务模块；日志接入由调用方主动调用 `/logs/ingest` 或由后续 Vector / OTel Collector 完成（不在 P0 范围）。
- **多租户隔离**：通过 `TenantContext.get()` 取当前线程租户，默认 `tenant-default`，后续接入 IAM 后替换为 `X-Tenant-Id` 解析。
- **链路追踪**：所有响应 `ApiResponse.traceId` 由 `TraceContext.getOrCreate()` 注入，MDC 在请求结束清空。
- **Loki 调用失败**统一映射为 `50301 LOKI_UNAVAILABLE`，便于上层统一告警。
- **不持久化到 Loki 之外再二次查 Loki**：查询路径完全依赖 Loki，写入路径完全依赖 PostgreSQL，二者职责清晰分离，便于后续独立扩容。

## 相关文档

- [项目总览](../README.md)
- [技术选型建议](../docs/002-TS/TS-Mate_Platform-技术选型建议_自研最新版_v1.1-20260716.md)
- [应用架构](../docs/001-ARCH/ARCH-Mate_Platform-应用架构_v1.0-20260716.md)
- [模块 API 规范](docs/SPEC-TECH-OBS-可观测性API规范_v1.0-20260716.md)
- [基础设施](../infra/README.md)
- [版本路线图](../docs/004-PLAN/PLAN-Mate_Platform-版本路线图_v2.0-20260716.md)