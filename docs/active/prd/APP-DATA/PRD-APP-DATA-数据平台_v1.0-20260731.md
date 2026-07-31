# PRD-APP-DATA 数据平台(总 PRD)

> 版本:v1.0 · 2026-07-31
> 关联:`PRD-APP-DATA-数据平台-详细规范_v1.0-20260731.md` + `PRD-APP-DATA-数据平台-按钮操作手册_v1.0-20260731.md`
> 关联:`ADR-0016-data-platform-architecture.md`(数据平台架构)+ `architecture-implementation.md` 附录 A(v3.1 Data-Ready Baseline)
> 配套:`contracts/openapi/services/{data,etl,metrics,scheduler}.yaml`(OpenAPI 4 子域)
> 状态:**Active**(P2-W5 启动参考)

---

## 1. 范围与定位

数据平台(APP-DATA)是 Mate Platform 中**开发者控制面 + 业务自助**两层数据能力。它提供数据接入(CDC)、数据加工(ETL)、指标管理(Metrics)、调度管理(Scheduler)四大子能力,既服务数据工程师(数据接入 / Pipeline 编排),也服务业务分析人员(指标查询 / 任务调度)。

### 1.1 设计目标

- **CDC 自动化**:支持 MySQL / PostgreSQL 的 binlog 增量接入,自动生成 Iceberg 表。
- **可视化 Pipeline**:Flink SQL / PyFlink 作业可视化编排,自动编译 / 部署 / 监控。
- **指标统一管理**:所有业务指标在 Metrics 域统一登记,提供 lineage / values 查询。
- **调度可观测**:所有 DAG / task 状态可查询,失败自动告警。

### 1.2 与已有 PRD / ADR 的关系

| 文档 | 关系 |
|---|---|
| `ADR-0016-data-platform-architecture.md` | 架构决策 |
| `architecture-implementation.md` 附录 A | Data-Ready Baseline(mate-tech-data + Flink + Airflow + Paimon + Iceberg + Trino + StarRocks) |
| `PRD-APP-ARCH_v2.2` §5.3 | 架构中心引用"数据资产目录"(由本 PRD 提供) |
| `PRD-APP-RAG` / `PRD-APP-ONTSTUDIO` | RAG 与 Ontology 消费数据平台输出 |
| **本文** | 数据平台业务规范 |

---

## 2. 用户场景

### 2.1 场景 A — 数据工程师接入 MySQL CDC

> **角色**:数据工程师(李工)
> **目标**:把业务 MySQL `orders` 表同步到 Iceberg ODS

1. 打开数据平台控制台 → "数据接入" → "新建 CDC 任务"
2. 选择数据源类型:`MySQL`
3. 填连接信息(host / port / db / user / password)+ 选择库表 `mydb.orders`
4. 选择落库:`paimon.ods.orders`
5. 点击 **试运行** → 系统用最近 100 行验证 schema + 网络连通性
6. 试运行 OK → 点击 **启动** → 任务进入 `running` 状态
7. 在控制台查看:增量速率 / lag / 错误数

### 2.2 场景 B — 业务分析师登记指标

> **角色**:业务分析师(王经理)
> **目标**:为"日活用户"登记一个业务指标

1. 打开数据平台 → "指标管理" → "新建指标"
2. 填指标信息:
   - 名称:DAU(每日活跃用户)
   - 表达式:`COUNT(DISTINCT user_id)`
   - 数据源:`dwd.user_events`
   - 计算频率:每日
   - owner:王经理
   - lineage:引用 `user_id`、`event_time`
3. 点击 **试计算** → 跑最近 7 天数据 → 返回 7 个值
4. 试计算 OK → 点击 **发布** → 指标进入"已发布"状态,可在 RAG / BI 中订阅
5. 在 lineage 视图查看:指标 → 表 → 列 → 物理表

### 2.3 场景 C — 编排 ETL DAG

> **角色**:数据工程师
> **目标**:为"每日销售报表"编排一个 DAG

1. 打开数据平台 → "调度" → "新建 DAG"
2. 选择节点:
   - `extract`:从 `ods.orders` 拉数据
   - `transform`:JOIN `dim.products`
   - `compute`:聚合 `SUM(amount)`
   - `load`:写入 `rpt.daily_sales`
3. 配置节点依赖:`extract → transform → compute → load`
4. 设置调度时间:`0 2 * * *`(每日凌晨 2 点)
5. 点击 **试运行** → 模拟数据走完 DAG
6. 点击 **发布** → DAG 进入调度队列

---

## 3. 4 子域功能清单

### 3.1 CDC(数据接入)

| 功能 | 状态 | 说明 |
|---|---|---|
| MySQL CDC | ✅ DATA-D0 | `extract mysql binlog → iceberg` |
| PostgreSQL CDC | ✅ DATA-D0 | `wal2json` |
| Kafka 事件接入 | ✅ DATA-D0 | `debezium → kafka → iceberg` |
| API 批量接入 | ⏳ DATA-D3 | 后续 batch |
| 任务启停 / 暂停 / 恢复 | ✅ | `POST /api/v1/data/cdc-tasks/{id}/pause` |
| 任务状态查询 | ✅ | `GET /api/v1/data/cdc-tasks/{id}/status` |

### 3.2 ETL(数据加工)

| 功能 | 状态 | 说明 |
|---|---|---|
| ETL 任务 CRUD | ✅ | `POST /api/v1/etl/tasks` |
| ETL 运行 / 停止 | ✅ | `POST /api/v1/etl/tasks/{id}/run` |
| ETL 状态查询 | ✅ | `GET /api/v1/etl/tasks/{id}/status` |
| Flink SQL 编译 | ✅ DATA-D4 | 自动从 SQL 编译成 Flink job |
| PyFlink 编译 | ✅ DATA-D4 | Python SDK 提交 |
| 数据产品发布(Iceberg ADS) | ⏳ DATA-D5 | 后续 batch |

### 3.3 Metrics(指标管理)

| 功能 | 状态 | 说明 |
|---|---|---|
| 指标 CRUD | ✅ | `POST /api/v1/metrics` |
| 指标计算 | ✅ | `POST /api/v1/metrics/{id}/compute` |
| 指标 lineage | ✅ | `GET /api/v1/metrics/{id}/lineage` |
| 指标 values 查询 | ✅ | `GET /api/v1/metrics/{id}/values` |
| OpenMetadata 集成 | ⏳ DATA-D6 | 后续 batch |

### 3.4 Scheduler(调度)

| 功能 | 状态 | 说明 |
|---|---|---|
| DAG 查询 | ✅ | `GET /api/v1/scheduler/dag` |
| 任务 CRUD | ✅ | `POST /api/v1/scheduler/tasks` |
| 任务暂停 / 触发 | ✅ | `POST /api/v1/scheduler/tasks/{id}/pause` |
| Airflow 集成 | ⏳ | 后续 batch |

---

## 4. 数据模型

### 4.1 CDC Task

```yaml
CDCTask:
  id: string
  tenant_id: string
  name: string
  source_type: mysql | postgres | kafka | api
  source_connection: object    # host / port / db / user / password
  source_table: string
  target_type: paimon | iceberg | kafka
  target_table: string
  status:
    - draft
    - running
    - paused
    - failed
    - stopped
  metrics:
    lag_seconds: int
    events_per_second: int
    errors_total: int
  created_by: string
  created_at: datetime
  started_at: datetime
```

### 4.2 ETL Task

```yaml
ETLTask:
  id: string
  tenant_id: string
  name: string
  type: flink_sql | pyflink | spark_sql
  code: text                   # SQL 或 Python 源码
  source_tables: [string]
  target_table: string
  schedule: cron | manual
  status: ...
  last_run_at: datetime
  last_run_duration_ms: int
  last_run_status: success | failed
```

### 4.3 Metric

```yaml
Metric:
  id: string
  tenant_id: string
  name: string
  description: string
  expression: string            # SQL 聚合表达式
  source_table: string
  computation_freq: daily | hourly | realtime
  owner: string
  lineage:
    tables: [string]
    columns: [string]
  status: draft | published | deprecated
  values:
    timestamp: datetime
    value: number
```

### 4.4 Scheduler Task

```yaml
SchedulerTask:
  id: string
  tenant_id: string
  name: string
  dag_id: string
  depends_on: [string]
  schedule: cron               # "0 2 * * *"
  status: pending | running | success | failed | skipped
  last_run_at: datetime
  next_run_at: datetime
```

---

## 5. 接口规范

详见 OpenAPI:`contracts/openapi/services/{data,etl,metrics,scheduler}.yaml`(4 子域共 30 endpoint)。

| Method | Path | 功能 |
|---|---|---|
| GET/POST | `/api/v1/data/cdc-tasks` | CDC 任务 CRUD |
| GET/POST | `/api/v1/data/sources` | 数据源 CRUD |
| GET/POST | `/api/v1/etl/tasks` | ETL 任务 CRUD |
| GET/POST | `/api/v1/metrics` | 指标 CRUD |
| GET/POST | `/api/v1/scheduler/tasks` | 调度任务 CRUD |
| POST | `/api/v1/scheduler/tasks/{id}/trigger` | 手动触发 |
| POST | `/api/v1/scheduler/tasks/{id}/pause` | 暂停 |

> 当前 P2-W5 优先级:**挂 30 endpoint 到 DATA-D0-D8 已落地模块**。

---

## 6. 关键业务规则

### 6.1 CDC 规则

- **同一 source_table 只能有 1 个 running CDC 任务**(避免重复同步)。
- **CDC 任务启动必须先试运行**,避免直接对生产库造成压力。
- **CDC 任务 schema 变更**:Iceberg 自动 schema evolution,无需手动同步。

### 6.2 ETL 规则

- **ETL 任务 SQL 必须通过 SQL parser 校验**(P1 后续 batch 加)。
- **ETL 任务首次运行前必须有 dry-run**(避免直接对生产数据造成破坏)。
- **ETL 任务失败默认重试 3 次**,然后置 failed。

### 6.3 Metrics 规则

- **指标表达式必须是确定性 SQL 聚合**(`COUNT` / `SUM` / `AVG` / `MAX` / `MIN`)。
- **指标 lineage 自动从表达式解析**,无需手动维护。
- **指标发布后不能修改表达式**,只能新建版本。

### 6.4 Scheduler 规则

- **DAG 不能有循环依赖**(DAG 检测)。
- **调度时间用 cron 表达式**,不支持事件触发(后续 batch 加)。
- **任务失败默认告警到 #data-alerts Slack 频道**。

### 6.5 租户隔离

- **每个 tenant 的 CDC / ETL / Metric / Scheduler 任务独立**,不能跨 tenant 复用。
- **数据源**(`/api/v1/data/sources`)是 tenant 级别,不在平台共享。
- **跨租户 admin 通道** 可看所有 tenant 任务。

---

## 7. 错误码

| Code | HTTP | 说明 |
|---|---|---|
| `E_SOURCE_NOT_FOUND` | 404 | 数据源不存在 |
| `E_SOURCE_CONNECTION_FAILED` | 502 | 数据源连接失败 |
| `E_TASK_ALREADY_RUNNING` | 409 | 任务已在 running 状态 |
| `E_DAG_HAS_CYCLE` | 400 | DAG 循环依赖 |
| `E_METRIC_INVALID_EXPRESSION` | 400 | 指标表达式非法 |
| `E_ETL_COMPILE_FAILED` | 400 | Flink SQL 编译失败 |
| `E_CDC_SCHEMA_MISMATCH` | 409 | source schema 与 target 不匹配 |

---

## 8. 安全与合规

- **数据源密码走 SealedSecret**(§13 硬规则 12)。
- **查询走 RBAC**:业务用户只能查 lineage 包含自己有权限的表的指标。
- **审计**:CDC / ETL 启动、Metric 发布都写到 audit log。
- **数据脱敏**:指标 values 在响应时自动脱敏(对接 `mate_clients.security.pii_mask`)。

---

## 9. P2-W5 落地清单

| 任务 | 工作量 | 备注 |
|---|---|---|
| HTTP 控制面挂 30 endpoint | 1 周 | 复用 DATA-D0-D8 模块(retention / pii_mask / xdomain_audit) |
| 5 步 checklist 完整 | 包含 | install_auth + require_tenant + outbox + BearerAuth + 跨租户 tests |
| cross-tenant negative tests ≥ 3 | 包含 | wrong tenant / missing scope / no tenant |
| ruff + pyright + bundled oasdiff | 包含 | CI 通过 |
| pyproject.toml + workspace 注册 | 0.5 天 | 加入 `[tool.uv.workspace.members]` |

---

## 10. 关联文档

- `PRD-APP-DATA-数据平台-详细规范_v1.0-20260731.md` — 技术实现
- `PRD-APP-DATA-数据平台-按钮操作手册_v1.0-20260731.md` — 用户操作
- `ADR-0016-data-platform-architecture.md` — 架构决策
- `architecture-implementation.md` 附录 A — Data-Ready Baseline
- `PRD-APP-ARCH_v2.2-20260727.md` §5.3 — 数据资产目录消费者
- `PRD-APP-RAG` / `PRD-APP-ONTSTUDIO` — 数据平台消费者
- `contracts/openapi/services/{data,etl,metrics,scheduler}.yaml` — 4 子域契约源

---

## 11. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-07-31 | v1.0 初版(总 PRD + 3 件套 + 4 子域 + 9 节) | TRAE 补 PRD |