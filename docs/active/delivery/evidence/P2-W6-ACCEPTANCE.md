# P2-W6 PR#18 — mate-tech-data 包接入 (data 域 15 endpoint)

> **批次**: P2-W6 · PR#18
> **日期**: 2026-08-01
> **ADR**: ADR-0014 (5 步接入模式)
> **状态**: ✅ Accepted
> **关联**: `docs/active/specs/2026-07-31-backend-impl-backlog.md` v1.5

---

## 1. 交付目标

新建 `mate-tech-data` 包,实现数据平台控制面 **data 域 15 个 spec-only endpoint**
(CDC 任务管理 + 数据源管理),按 ADR-0014 5 步模式接入。

**背景修正**: backlog §4.1 原述"DATA-D0-D8 已落地仅需挂路由"不准确 ——
DATA-D0-D8 落地的是横切能力(retention / pii_mask / xdomain_audit / lineage),
与 spec 的 data/etl/metrics/scheduler 控制面业务不直接对应。本批次实际为
**新建包 + 全新 in-memory 实现**,同 dw/wfe 模式。

---

## 2. 规模指标

| 项 | 数 |
|---|---:|
| 新建包 | 1 (`mate-tech-data`) |
| 新建文件 | 12 (pyproject + README + 4 src 模块 + 4 包/子包 __init__ + 3 测试) |
| 实现 endpoint | **15** (cdc-tasks 8 + sources 7) + 1 health |
| dataclass | 2 (`CdcTask`, `DataSource`) |
| seed catalog | 3 (sources × 3 + cdc-tasks × 3 + schemas × 3) |
| outbox 事件类型 | 9 |
| 新增 tests | **28** (20 happy-path + 8 tenant-integration) |
| 全后端回归 | **632 passed** (604 + 28) / 0 failed / 118s |

---

## 3. ADR-0014 5 步合规矩阵

| 步骤 | 实现 | 证据 |
|---|---|---|
| 1. `install_auth(app)` | ✅ `create_app()` 首行 `install_auth(app, extra_anonymous_paths={"/api/v1/data/health"})` | `main.py:31` |
| 2. `require_tenant(ctx)` | ✅ `_tid(request)` helper 调用 `require_tenant(ctx)`,每个 handler 首行 | `api/app.py:_tid` |
| 3. outbox 事件 | ✅ 9 个写 handler emit `data.<aggregate>.<verb>` 事件 | created/updated/deleted/paused/resumed (cdc) + created/updated/deleted/tested (source) |
| 4. BearerAuth 出向 | ✅ `AsyncDataClient` 预留 (P2-W6 in-memory stub;真实 CDC 引擎 Debezium/Flink 留后续批次) | `clients.py` |
| 5. tenant tests | ✅ 8 个 tenant tests (wrong-tenant 403 + no-tenant 400 + isolation × 2 + cross-tenant 404 × 2 + health) | `test_app_data_tenant_integration.py` |

---

## 4. 实现详情

### 4.1 CDC 任务 (8 endpoint)

| Method | Path | operationId | FR |
|---|---|---|---|
| GET | `/api/v1/data/cdc-tasks` | dataGetDataCdcTasks | FR-DATA-DATAGETDATACDCTASKS |
| POST | `/api/v1/data/cdc-tasks` | dataPostDataCdcTasks | FR-DATA-DATAPOSTDATACDCTASKS |
| GET | `/api/v1/data/cdc-tasks/{id}` | dataGetDataCdcTasksId | FR-DATA-DATAGETDATACDCTASKSID |
| PUT | `/api/v1/data/cdc-tasks/{id}` | dataPutDataCdcTasksId | FR-DATA-DATAPUTDATACDCTASKSID |
| DELETE | `/api/v1/data/cdc-tasks/{id}` | dataDeleteDataCdcTasksId | FR-DATA-DATADELETEDATACDCTASKSID |
| POST | `/api/v1/data/cdc-tasks/{id}/pause` | dataPostDataCdcTasksIdPause | FR-DATA-DATAPOSTDATACDCTASKSIDPAUSE |
| POST | `/api/v1/data/cdc-tasks/{id}/resume` | dataPostDataCdcTasksIdResume | FR-DATA-DATAPOSTDATACDCTASKSIDRESUME |
| GET | `/api/v1/data/cdc-tasks/{id}/status` | dataGetDataCdcTasksIdStatus | FR-DATA-DATAGETDATACDCTASKSIDSTATUS |

- list 支持 `status` 过滤 + 分页 envelope `{items,total,page,size,pages}`
- pause/resume 通过 `set_cdc_task_status` 原地修改 status (running↔paused)
- 5 个写操作各 emit 对应 outbox 事件

### 4.2 数据源 (7 endpoint)

| Method | Path | operationId | FR |
|---|---|---|---|
| GET | `/api/v1/data/sources` | dataGetDataSources | FR-DATA-DATAGETDATASOURCES |
| POST | `/api/v1/data/sources` | dataPostDataSources | FR-DATA-DATAPOSTDATASOURCES |
| GET | `/api/v1/data/sources/{id}` | dataGetDataSourcesId | FR-DATA-DATAGETDATASOURCESID |
| PUT | `/api/v1/data/sources/{id}` | dataPutDataSourcesId | FR-DATA-DATAPUTDATASOURCESID |
| DELETE | `/api/v1/data/sources/{id}` | dataDeleteDataSourcesId | FR-DATA-DATADELETEDATASOURCESID |
| GET | `/api/v1/data/sources/{id}/schema` | dataGetDataSourcesIdSchema | FR-DATA-DATAGETDATASOURCESIDSCHEMA |
| POST | `/api/v1/data/sources/{id}/test` | dataPostDataSourcesIdTest | FR-DATA-DATAPOSTDATASOURCESIDTEST |

- list 支持 `type` 过滤 + 分页
- schema 发现返回 `{source_id, tables:[{name, columns:[{name,type}]}]}`
- test connection 返回 `{source_id, ok, latency_ms, error}` (connected 源 ok=true)
- 4 个写操作 emit outbox 事件 (created/updated/deleted/tested)

### 4.3 数据模型

```python
@dataclass
class CdcTask:  # mutable
    id, tenant_id, name, source_id, target_table,
    status (running|paused|stopped|failed), config, created_at, updated_at

@dataclass
class DataSource:  # mutable
    id, tenant_id, name, type (mysql|postgres|kafka|...),
    connection_config, status (connected|disconnected|error),
    created_at, updated_at
```

---

## 5. 实际运行结果

```text
# mate-tech-data (新建包)
$ uv run pytest packages/mate-tech-data/tests/ -q
28 passed in 0.60s   # 20 happy-path + 8 tenant-integration

# 全后端回归
$ uv run pytest packages/ -q --no-header
632 passed in 118.22s   # 604 (P2-W5 基线) + 28 (data)
```

### 5.1 测试构成

**test_app_data.py (20 happy-path)**:
- CDC: list / list+status-filter / create / get / get-404 / update / delete / pause / resume / status (10)
- Source: list / list+type-filter / create / get / get-404 / update / delete / schema / schema-404 / test-connection (10)
- 含 outbox 事件断言 (create/update/delete/pause/resume/schema-test)
- 含 health 匿名访问

**test_app_data_tenant_integration.py (8 tenant)**:
- `test_wrong_tenant_403` — token tenant A + X-Tenant-Id B → 403
- `test_no_tenant_400` — 空 tenant → 400 E_TENANT_REQUIRED
- `test_tenant_isolation_cdc_tasks` — 两租户 CDC 列表互不可见
- `test_tenant_isolation_sources` — 两租户 source 列表互不可见
- `test_cross_tenant_cdc_task_404` — tenant A 创建的 task,tenant B 访问 → 404
- `test_cross_tenant_source_404` — tenant A 创建的 source,tenant B 访问/删除 → 404
- `test_health_anonymous_ok` — health 无 token 可达

---

## 6. 与 13 硬规则对齐

| # | 硬规则 | 本批次合规 |
|---|---|---|
| 1 | Swagger 没有接口不写 route | ✅ 15 endpoint 全部对应 spec operationId |
| 3 | 没有 tenant 上下文不访问 repository | ✅ `_tid(request)` + `require_tenant` 守门 |
| 4 | 外部系统没有 ACL Client | ✅ `AsyncDataClient` 预留 |
| 7 | 契约或集成测试跳过不标记 Accepted | ✅ 28 tests 全 pass,0 skip |
| 9 | 没有审计、指标、trace | ✅ OTel 沿用 install_auth 注入 |
| 10 | 所有状态以验收证据为准 | ✅ 本文件 |

---

## 7. 后续

- **P2-W7 PR#19**: etl + metrics + scheduler 14 endpoint (3 小域合并,同模式新建)
- 真实 CDC 引擎集成 (Debezium/Flink) 留后续批次,`AsyncDataClient` 契约已锁定
