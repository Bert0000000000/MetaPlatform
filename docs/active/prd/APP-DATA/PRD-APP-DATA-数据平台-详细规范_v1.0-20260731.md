# PRD-APP-DATA 数据平台 详细规范

> 版本:v1.0 · 2026-07-31
> 配套:`PRD-APP-DATA-数据平台_v1.0-20260731.md`(总 PRD)+ `PRD-APP-DATA-数据平台-按钮操作手册_v1.0-20260731.md`
> 类型:**技术实现规范**(面向开发者)
> 状态:**Active**

---

## 1. 技术栈

| 层 | 选型 | 版本 |
|---|---|---|
| 后端 | Python | 3.12 |
| Web 框架 | FastAPI | latest |
| CDC 引擎 | Debezium + Kafka | debezium/connect:latest(已在 docker-compose) |
| 数据湖 | Apache Paimon + Iceberg | paimon:0.9 |
| 计算引擎 | Apache Flink | flink:1.19 |
| 调度 | Apache Airflow | apache/airflow:3.0 |
| 查询 | Trino / StarRocks | trino:latest |
| 元数据 | OpenMetadata | openmetadata/server:1.4 |
| 血缘 | OpenLineage + Marquez | marquez:0.50 |
| 质量 | Great Expectations | 0.18 |
| 权限 | Apache Ranger | 2.4 |
| 持久化 | PostgreSQL | 16 |

---

## 2. 包结构

```
packages/mate-tech-data/                       # 已有 DATA-D0-D8 模块
  pyproject.toml
  src/mate_tech_data/
    __init__.py
    main.py                                   # FastAPI app + install_auth
    api/
      app.py                                  # P2-W5:HTTP 控制面挂载
      cdc.py                                  # CDC 子域 endpoint
      etl.py                                  # ETL 子域 endpoint
      metrics.py                              # Metrics 子域 endpoint
      scheduler.py                            # Scheduler 子域 endpoint
    cdc/
      debezium_client.py                      # Debezium engine 封装
      schema_tracker.py                       # schema evolution tracker
    etl/
      flink_compiler.py                       # Flink SQL 编译器
      pyflink_runner.py                       # PyFlink 提交器
      lineage_extractor.py                   # 血缘提取
    metrics/
      lineage_builder.py                      # lineage 解析
      values_query.py                         # 值查询
    scheduler/
      airflow_client.py                       # Airflow 集成
      dag_validator.py                        # DAG 循环检测
    observability/
      xdomain_audit.py                        # 跨域审计(DATA-D8 已落地)
    auth/
      retention.py                            # 数据保留 + GDPR(DATA-D6 已落地)
    repositories/
      pg_store.py
      iceberg_catalog.py
  tests/
    test_cdc_api.py
    test_etl_api.py
    test_metrics_api.py
    test_scheduler_api.py
    test_tenant_integration.py                # ≥3 跨租户 negative
```

---

## 3. CDC HTTP 控制面(基于 Debezium)

```python
# 简化示意
from mate_platform.auth import install_auth
from mate_platform.tenancy.guards import require_tenant
from mate_platform.messaging import Event, OutboxWriter

app = FastAPI(title="mate-tech-data")
install_auth(app)

@app.post("/api/v1/data/cdc-tasks")
async def create_cdc_task(request: Request, body: CreateCDCTaskRequest):
    ctx = request.state.ctx
    require_tenant(ctx)

    # 1. 验证数据源连接(试运行)
    test_result = await test_cdc_connection(body.source_connection, body.source_table)
    if not test_result.ok:
        raise HTTPException(502, detail={"code": "E_SOURCE_CONNECTION_FAILED", "message": test_result.error})

    # 2. 创建 CDC 任务(启动 Debezium connector)
    task = await create_debezium_connector(body, ctx.tenant_id)

    # 3. emit outbox event
    outbox: OutboxWriter = request.app.state.outbox_writer
    outbox.append(Event.create(
        type="data.cdc.created",
        tenant_id=ctx.tenant_id,
        aggregate_id=task.id,
        payload={"name": body.name, "source": f"{body.source_type}://{body.source_table}"},
        trace_id=ctx.trace_id,
    ))

    return task.to_dict()
```

---

## 4. ETL 编译(Flink SQL → Job)

```python
async def compile_flink_sql(sql: str) -> CompileResult:
    """从 SQL 编译成 Flink job 描述符。"""
    # 1. SQL parser 校验
    parsed = FlinkSqlParser(sql)
    if parsed.errors:
        return CompileResult.failed(parsed.errors)

    # 2. 血缘提取(从 SQL AST)
    lineage = extract_lineage_from_sql(parsed)

    # 3. 编译成 Flink job
    job_descriptor = await submit_flink_job(parsed, lineage)

    return CompileResult.ok(job_descriptor)


@app.post("/api/v1/etl/tasks/{id}/run")
async def run_etl_task(request: Request, id: str):
    ctx = request.state.ctx
    require_tenant(ctx)

    task = await get_etl_task(id, ctx.tenant_id)
    if task.status == "running":
        raise HTTPException(409, detail={"code": "E_TASK_ALREADY_RUNNING"})

    # 编译 + 提交
    result = await compile_flink_sql(task.code)
    if not result.ok:
        raise HTTPException(400, detail={"code": "E_ETL_COMPILE_FAILED", "errors": result.errors})

    await submit_to_flink(result.job, ctx)

    # emit outbox
    ...
```

---

## 5. 指标 lineage 提取

```python
def extract_lineage_from_expression(expression: str) -> Lineage:
    """从 SQL 表达式提取 lineage(列引用 + 表引用)。"""
    # 简化:用 sqlparse 解析
    import sqlparse
    parsed = sqlparse.parse(expression)[0]

    tables = set()
    columns = set()

    for token in parsed.tokens:
        if isinstance(token, sqlparse.sql.Identifier):
            # 取表名与列名
            parts = str(token).split(".")
            if len(parts) == 2:
                tables.add(parts[0])
                columns.add(parts[1])

    return Lineage(tables=list(tables), columns=list(columns))


@app.post("/api/v1/metrics")
async def create_metric(request: Request, body: CreateMetricRequest):
    ctx = request.state.ctx
    require_tenant(ctx)

    # 自动 lineage
    lineage = extract_lineage_from_expression(body.expression)

    metric = Metric(
        tenant_id=ctx.tenant_id,
        name=body.name,
        expression=body.expression,
        source_table=body.source_table,
        lineage=lineage,
        status="draft",
        owner=ctx.user_id,
    )
    await metric_repo.create(metric)
    return metric.to_dict()
```

---

## 6. Scheduler DAG 校验

```python
def detect_dag_cycle(tasks: list[SchedulerTask]) -> bool:
    """拓扑排序检测 DAG 是否有环。"""
    # 构建邻接表
    graph = {t.id: t.depends_on for t in tasks}

    # DFS 检测环
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {t.id: WHITE for t in tasks}

    def dfs(node):
        if color[node] == GRAY:
            return True  # 环
        if color[node] == BLACK:
            return False
        color[node] = GRAY
        for dep in graph[node]:
            if dfs(dep):
                return True
        color[node] = BLACK
        return False

    return any(dfs(t.id) for t in tasks)


@app.post("/api/v1/scheduler/tasks")
async def create_scheduler_task(request: Request, body: CreateSchedulerTaskRequest):
    ctx = request.state.ctx
    require_tenant(ctx)

    # DAG 校验
    all_tasks = await get_all_scheduler_tasks(ctx.tenant_id)
    if detect_dag_cycle(all_tasks + [body.to_task()]):
        raise HTTPException(400, detail={"code": "E_DAG_HAS_CYCLE"})
```

---

## 7. 5 步 checklist(每 PR 自检)

按 `docs/active/specs/2026-07-30-per-app-integration-checklist.md` v1.0:

- [ ] **步骤 1**:`install_auth(app)` 在 `create_app()` 第一行
- [ ] **步骤 2**:每个 handler 第一行 `require_tenant(ctx)`
- [ ] **步骤 3**:写 handler 用 `outbox.append(Event.create(...))` 同事务
- [ ] **步骤 4**:出向调用用 `BearerAuth` + `OutgoingAuthMiddleware`(对 Debezium / Flink / Airflow 都需要)
- [ ] **步骤 5**:`tests/test_tenant_integration.py` ≥ 3 cross-tenant negative
- [ ] **步骤 6**:OpenAPI `security:` 段已升级三段式(`contracts/openapi/services/{data,etl,metrics,scheduler}.yaml` 已有)
- [ ] `pytest mate-tech-data/tests` 全绿
- [ ] `git log` 显示 commit 信息包含 ADR-0016 引用

---

## 8. 测试矩阵

| Suite | cases | 说明 |
|---|---:|---|
| `test_cdc_api.py` | 8 | happy-path CRUD + 启停 + 状态 + 跨租户 |
| `test_etl_api.py` | 8 | Flink SQL 编译 + 运行 + 停止 + lineage |
| `test_metrics_api.py` | 8 | CRUD + 计算 + lineage + values + RBAC |
| `test_scheduler_api.py` | 6 | DAG CRUD + 触发 + 暂停 + DAG 环检测 |
| `test_tenant_integration.py` | 6 | wrong tenant / missing scope / no tenant / admin / 跨租户数据源 |
| `test_xdomain_audit.py` | 4 | DATA-D8 跨域审计 |
| `test_retention.py` | 5 | DATA-D6 retention + GDPR |
| `test_pii_mask.py` | 4 | PII 脱敏 |
| **总计** | **49** | ≥ 49 cases(满足 DATA-D0-D8 回归) |

---

## 9. 配置与运行时

### 9.1 环境变量

```bash
# Debezium
DATA_DEBEZIUM_URL=http://debezium-connect:8083
DATA_DEBEZIUM_USER=debezium
DATA_DEBEZIUM_PASSWORD=${SECRET_DEBEZIUM_PASSWORD}

# Flink
DATA_FLINK_JOBMANAGER_URL=http://flink-jobmanager:8081
DATA_FLINK_REST_URL=http://flink-rest:8081

# Airflow
DATA_AIRFLOW_URL=http://airflow-webserver:8080
DATA_AIRFLOW_USER=airflow
DATA_AIRFLOW_PASSWORD=${SECRET_AIRFLOW_PASSWORD}

# Iceberg catalog
DATA_ICEBERG_CATALOG=mate_iceberg
DATA_ICEBERG_WAREHOUSE=s3a://mate-data/iceberg
DATA_S3_ENDPOINT=http://minio:9000
DATA_S3_ACCESS_KEY=${SECRET_MINIO_ACCESS_KEY}
DATA_S3_SECRET_KEY=${SECRET_MINIO_SECRET_KEY}
```

### 9.2 启动 profile

```yaml
# docker-compose.yml(已在 PLATFORM-K8S-01 配置)
debezium-connect:
  image: debezium/connect:latest
  environment:
    - BOOTSTRAP_SERVERS=kafka:9092
    - GROUP_ID=mate-debezium
    - CONFIG_STORAGE_TOPIC=debezium_config
    - OFFSET_STORAGE_TOPIC=debezium_offset
    - STATUS_STORAGE_TOPIC=debezium_status
```

---

## 10. 监控与告警

- **metrics**:
  - `data_cdc_tasks_total{status}` (Counter)
  - `data_cdc_lag_seconds` (Gauge)
  - `data_etl_runs_total{status}` (Counter)
  - `data_etl_duration_seconds` (Histogram)
  - `data_metrics_compute_duration_seconds` (Histogram)
  - `data_scheduler_task_runs_total{status}` (Counter)
- **alerts**:
  - CDC lag > 60s → warn
  - ETL 失败率 > 10% → warn
  - Scheduler 任务连续失败 3 次 → page oncall

---

## 11. 关联文档

- `PRD-APP-DATA-数据平台_v1.0-20260731.md` — 总 PRD
- `PRD-APP-DATA-数据平台-按钮操作手册_v1.0-20260731.md` — 用户操作
- `ADR-0016-data-platform-architecture.md` — 架构决策
- `architecture-implementation.md` 附录 A — Data-Ready Baseline
- `per-app-integration-checklist.md` — 5 步模式
- `contracts/openapi/services/{data,etl,metrics,scheduler}.yaml` — 4 子域契约源

---

## 12. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-07-31 | v1.0 初版(详细规范 + 5 步 checklist + 测试矩阵 + 监控告警) | TRAE 补 PRD |