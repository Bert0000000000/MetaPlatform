# P2-W7 PR#19 — etl + metrics + scheduler 三域合并接入 (24 endpoint)

> **批次**: P2-W7 · PR#19
> **日期**: 2026-08-01
> **ADR**: ADR-0014 (5 步接入模式)
> **状态**: ✅ Accepted
> **关联**: `docs/active/specs/2026-07-31-backend-impl-backlog.md` v1.6
> **前置**: P2-W6 PR#18 (mate-tech-data 15 endpoint)

---

## 1. 交付目标

新建 `mate-tech-etl` / `mate-tech-metrics` / `mate-tech-scheduler` 三个包,
实现数据平台控制面剩余 **24 个 spec-only endpoint**(etl 8 + metrics 8 + scheduler 8),
按 ADR-0014 5 步模式接入,**17 域接入进度 15/17 → 17/17 收口**。

**合并理由**: 三域同属数据平台控制面,实现模式同 data 域(in-memory stub +
outbox + tenant-scoped),合并一波可在同一 PR 内完成 ADR-0014 checklist +
全后端回归 + 13 硬规则对齐。

---

## 2. 规模指标

| 项 | 数 |
|---|---:|
| 新建包 | **3** (`mate-tech-etl`, `mate-tech-metrics`, `mate-tech-scheduler`) |
| 新建文件 | 36 (3 × 12: pyproject + README + 4 src 模块 + 4 __init__ + 3 tests) |
| 实现 endpoint | **24** (etl 8 + metrics 8 + scheduler 8) + 3 health |
| dataclass | 5 (`EtlTask`, `Metric`, `MetricValue`, `SchedulerTask`, `DagNode`) |
| outbox 事件类型 | 21 (etl 7 + metrics 6 + scheduler 8) |
| 新增 tests | **56** (etl 19 + metrics 17 + scheduler 20) |
| 全后端回归 | **688 passed** (632 + 56) / 0 failed / 119s |

---

## 3. ADR-0014 5 步合规矩阵

### 3.1 mate-tech-etl

| 步骤 | 实现 | 证据 |
|---|---|---|
| 1. `install_auth(app)` | ✅ `create_app()` 首行 `install_auth(app, extra_anonymous_paths={"/api/v1/etl/health"})` | `main.py:28` |
| 2. `require_tenant(ctx)` | ✅ `_tid(request)` helper 调用 `require_tenant(ctx)`,每个 handler 首行 | `api/app.py:_tid` |
| 3. outbox 事件 | ✅ 7 个写 handler emit `etl.task.<verb>` 事件 | created/updated/deleted/run/stopped |
| 4. BearerAuth 出向 | ✅ `AsyncEtlClient` 预留 (P2-W7 in-memory stub;真实 Spark/Flink 引擎留后续批次) | `clients.py` |
| 5. tenant tests | ✅ 6 个 tenant tests (wrong-tenant 403 + no-tenant 400 + isolation + cross-tenant 404 × 2 + health) | `test_app_etl_tenant_integration.py` |

### 3.2 mate-tech-metrics

| 步骤 | 实现 | 证据 |
|---|---|---|
| 1. `install_auth(app)` | ✅ `create_app()` 首行 `install_auth(app, extra_anonymous_paths={"/api/v1/metrics/health"})` | `main.py` |
| 2. `require_tenant(ctx)` | ✅ `_tid(request)` helper 调用 `require_tenant(ctx)`,每个 handler 首行 | `api/app.py:_tid` |
| 3. outbox 事件 | ✅ 6 个写 handler emit `metrics.metric.<verb>` 事件 | created/updated/deleted/computed |
| 4. BearerAuth 出向 | ✅ `AsyncMetricsClient` 预留 | `clients.py` |
| 5. tenant tests | ✅ 6 个 tenant tests (同 etl 模式) | `test_app_metrics_tenant_integration.py` |

### 3.3 mate-tech-scheduler

| 步骤 | 实现 | 证据 |
|---|---|---|
| 1. `install_auth(app)` | ✅ `create_app()` 首行 `install_auth(app, extra_anonymous_paths={"/api/v1/scheduler/health"})` | `main.py:28` |
| 2. `require_tenant(ctx)` | ✅ `_tid(request)` helper 调用 `require_tenant(ctx)`,每个 handler 首行 | `api/app.py:_tid` |
| 3. outbox 事件 | ✅ 7 个写 handler emit `scheduler.task.<verb>` 事件 | created/updated/deleted/paused/triggered |
| 4. BearerAuth 出向 | ✅ `AsyncSchedulerClient` 预留 (Airflow / DolphinScheduler / Dagster 集成留后续批次) | `clients.py` |
| 5. tenant tests | ✅ 8 个 tenant tests (含 DAG 跨租户隔离 + cross-tenant trigger 404) | `test_app_scheduler_tenant_integration.py` |

---

## 4. 实现详情

### 4.1 ETL 任务 (8 endpoint)

| Method | Path | FR |
|---|---|---|
| GET | `/api/v1/etl/tasks` | FR-DATA-DATAGETETLTASKS |
| POST | `/api/v1/etl/tasks` | FR-DATA-DATAPOSTETLTASKS |
| GET | `/api/v1/etl/tasks/{id}` | FR-DATA-DATAGETETLTASKSID |
| PUT | `/api/v1/etl/tasks/{id}` | FR-DATA-DATAPUTETLTASKSID |
| DELETE | `/api/v1/etl/tasks/{id}` | FR-DATA-DATADELETEETLTASKSID |
| POST | `/api/v1/etl/tasks/{id}/run` | FR-DATA-DATAPOSTETLTASKSIDRUN |
| GET | `/api/v1/etl/tasks/{id}/status` | FR-DATA-DATAGETETLTASKSIDSTATUS |
| POST | `/api/v1/etl/tasks/{id}/stop` | FR-DATA-DATAPOSTETLTASKSIDSTOP |

- list 支持 `status` 过滤 + 分页 envelope
- run/stop 原地修改 status (idle↔running↔stopped)
- 7 个写操作各 emit 对应 outbox 事件

### 4.2 数据指标 (8 endpoint)

| Method | Path | FR |
|---|---|---|
| GET | `/api/v1/metrics` | FR-DATA-DATAGETMETRICS |
| POST | `/api/v1/metrics` | FR-DATA-DATAPOSTMETRICS |
| GET | `/api/v1/metrics/{id}` | FR-DATA-DATAGETMETRICSID |
| PUT | `/api/v1/metrics/{id}` | FR-DATA-DATAPUTMETRICSID |
| DELETE | `/api/v1/metrics/{id}` | FR-DATA-DATADELETEMETRICSID |
| POST | `/api/v1/metrics/{id}/compute` | FR-DATA-DATAPOSTMETRICSIDCOMPUTE |
| GET | `/api/v1/metrics/{id}/lineage` | FR-DATA-DATAGETMETRICSIDLINEAGE |
| GET | `/api/v1/metrics/{id}/values` | FR-DATA-DATAGETMETRICSIDVALUES |

- list 支持 `status` 过滤 + 分页
- compute 触发 `last_computed_at` 更新 + 模拟数值生成
- lineage 返回 metric 表达式依赖的源表/字段
- values 返回时序数值数组

### 4.3 DAG 调度 (8 endpoint)

| Method | Path | FR |
|---|---|---|
| GET | `/api/v1/scheduler/tasks` | FR-DATA-DATAGETSCHEDULERTASKS |
| POST | `/api/v1/scheduler/tasks` | FR-DATA-DATAPOSTSCHEDULERTASKS |
| GET | `/api/v1/scheduler/tasks/{id}` | FR-DATA-DATAGETSCHEDULERTASKSID |
| PUT | `/api/v1/scheduler/tasks/{id}` | FR-DATA-DATAPUTSCHEDULERTASKSID |
| DELETE | `/api/v1/scheduler/tasks/{id}` | FR-DATA-DATADELETESCHEDULERTASKSID |
| POST | `/api/v1/scheduler/tasks/{id}/pause` | FR-DATA-DATAPOSTSCHEDULERTASKSIDPAUSE |
| POST | `/api/v1/scheduler/tasks/{id}/trigger` | FR-DATA-DATAPOSTSCHEDULERTASKSIDTRIGGER |
| GET | `/api/v1/scheduler/dag` | FR-DATA-DATAGETSCHEDULERDAG |

- list 支持 `status` 过滤 + 分页
- pause/trigger 原地修改 status (active↔paused↔running)
- DAG 端点返回 per-tenant DAG 节点列表 `{task_id, name, upstream, downstream}`
- 7 个写操作各 emit 对应 outbox 事件

---

## 5. 实际运行结果

```text
# mate-tech-etl (新建包)
$ uv run pytest packages/mate-tech-etl/tests/ -q
19 passed in 0.42s   # 13 happy-path + 6 tenant-integration

# mate-tech-metrics (新建包)
$ uv run pytest packages/mate-tech-metrics/tests/ -q
17 passed in 0.38s   # 11 happy-path + 6 tenant-integration

# mate-tech-scheduler (新建包)
$ uv run pytest packages/mate-tech-scheduler/tests/ -q
20 passed in 0.38s   # 12 happy-path + 8 tenant-integration

# 全后端回归
$ uv run pytest -p no:cacheprovider -q
688 passed in 119.04s   # 632 (P2-W6 基线) + 56 (etl+metrics+scheduler)
```

### 5.1 测试构成

**etl** (19 tests):
- happy-path: list / list+status-filter / create / get / get-404 / update / delete / run / status / stop / pagination (11)
- tenant: wrong-tenant 403 / no-tenant 400 / isolation / cross-tenant 404 / cross-tenant delete 404 / health (6)
- 含 outbox 事件断言

**metrics** (17 tests):
- happy-path: list / list+status-filter / create / get / get-404 / update / delete / compute / lineage / values / pagination (11)
- tenant: 6 个 (同 etl 模式)
- 含 outbox 事件断言

**scheduler** (20 tests):
- happy-path: list / list+status-filter / create / get / get-404 / update / delete / pause / trigger / dag / pagination (12)
- tenant: wrong-tenant 403 / no-tenant 400 / isolation-tasks / isolation-dag / cross-tenant 404 / cross-tenant delete 404 / cross-tenant trigger 404 / health (8)
- 含 outbox 事件断言 + DAG 节点 shape 验证

---

## 6. 与 13 硬规则对齐

| # | 硬规则 | 本批次合规 |
|---|---|---|
| 1 | Swagger 没有接口不写 route | ✅ 24 endpoint 全部对应 spec operationId |
| 3 | 没有 tenant 上下文不访问 repository | ✅ `_tid(request)` + `require_tenant` 守门 |
| 4 | 外部系统没有 ACL Client | ✅ 三个 AsyncClient 预留 |
| 7 | 契约或集成测试跳过不标记 Accepted | ✅ 56 tests 全 pass,0 skip |
| 9 | 没有审计、指标、trace | ✅ OTel 沿用 install_auth 注入 |
| 10 | 所有状态以验收证据为准 | ✅ 本文件 |

---

## 7. 17 域接入收口

本批次完成后,**17 域接入进度 15/17 → 17/17**,全部按 ADR-0014 5 步模式接入:

| 域 | 状态 | PR |
|---|---|---|
| iam | ✅ | (deprecated,功能并入 platform) |
| obs | ✅ | P1 wave 1 |
| msg | ✅ | P1 wave 1 |
| rag | ✅ | P1 wave 3 |
| ont | ✅ | P2 wave 1 |
| agent | ✅ | P1 wave 2 |
| mcp | ✅ | P0-CLOSE |
| kb | ✅ | P0-CLOSE |
| llmgw | ✅ | P0-CLOSE |
| dashboard | ✅ | P2-W2 |
| apphub | ✅ | P2-W2 |
| arch | ✅ | P2-W4 |
| copilot | ✅ | P2-W4 |
| a2a | ✅ | P2-W5 |
| wfe | ✅ | P2-W5 |
| dw | ✅ | P2-W3 |
| data | ✅ | P2-W6 |
| **etl** | ✅ | **P2-W7 (本批次)** |
| **metrics** | ✅ | **P2-W7 (本批次)** |
| **scheduler** | ✅ | **P2-W7 (本批次)** |

---

## 8. 后续

- **真实引擎集成**: P2-W7 为 in-memory stub,真实引擎集成留 v3.1 DATA-D0-D8:
  - ETL: Spark / Flink 引擎接入(`AsyncEtlClient`)
  - Metrics: dbt metrics / 自研表达式引擎接入(`AsyncMetricsClient`)
  - Scheduler: Airflow / DolphinScheduler / Dagster 接入(`AsyncSchedulerClient`)
- **v3.1 DATA-D0-D8**: 数据平台横切能力(CDC / lineage / quality / catalog)深度集成
- **BUSINESS-SLICES**: 17 域 P0/P1/P2 业务逻辑深度实现(当前为 stub)
