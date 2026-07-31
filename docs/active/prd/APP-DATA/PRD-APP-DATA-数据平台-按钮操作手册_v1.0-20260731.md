# PRD-APP-DATA 数据平台 按钮操作手册

> 版本:v1.0 · 2026-07-31
> 配套:`PRD-APP-DATA-数据平台_v1.0-20260731.md`(总 PRD)+ `PRD-APP-DATA-数据平台-详细规范_v1.0-20260731.md`
> 类型:**用户操作手册**(面向数据工程师 + 业务分析师)
> 状态:**Active**

---

## 1. 给数据工程师的操作手册

### 1.1 入口

- Web URL:`https://{your-domain}/data`(前端入口)
- 菜单路径:左侧菜单 → "数据平台" → 4 个子菜单
  - **数据接入**(CDC)
  - **数据加工**(ETL)
  - **指标管理**(Metrics)
  - **调度管理**(Scheduler)

### 1.2 数据接入(CDC)按钮

| 按钮 | 位置 | 快捷键 | 说明 |
|---|---|---|---|
| **新建 CDC 任务** | 顶部工具栏 | `Ctrl+N` | 创建 CDC 同步任务 |
| **试运行** | 顶部工具栏右侧 | `Ctrl+T` | 验证数据源连通性 + schema |
| **启动** | 任务详情页右上角 | — | 启动 Debezium connector |
| **暂停** | 任务详情页右上角 | — | 暂停但保留 offset |
| **恢复** | 任务详情页右上角 | — | 从 offset 恢复 |
| **停止** | 任务详情页右上角 | — | 停止并清理 |
| **查看 lineage** | 任务详情页底部 | — | 表 → 列 → 物理表 |

#### 典型流程 — 新建 MySQL CDC

1. 点击 **新建 CDC 任务** → 弹窗:
   - 任务名:`orders-mysql-cdc`
   - 数据源类型:MySQL
   - 连接:`mysql://192.168.1.10:3306/mydb`
   - 用户:`cdc_user`
   - 密码:(从 SealedSecret 选择)
   - 选择表:`orders`、`order_items`
   - 落库:`paimon.ods.orders`
2. 点击 **试运行** → 系统返回:
   - 连接测试:✅
   - Schema 校验:✅ (15 列)
   - 预估 lag:2s
3. 点击 **启动** → 任务进入 `running`
4. 在控制台查看:
   - 增量速率:120 events/s
   - Lag:1.5s
   - 错误数:0

---

### 1.3 数据加工(ETL)按钮

| 按钮 | 位置 | 说明 |
|---|---|---|
| **新建 ETL 任务** | 顶部工具栏 | 创建 SQL/PyFlink 任务 |
| **试编译** | 顶部工具栏右侧 | Flink SQL 编译校验 |
| **运行** | 任务详情页 | 提交到 Flink cluster |
| **停止** | 任务详情页 | 停止 Flink job |
| **查看 lineage** | 任务详情页底部 | 列 → 表 lineage |
| **查看历史运行** | 任务详情页 | 历史 run 列表 + 状态 |

#### 典型流程 — 编排 SQL ETL

1. 点击 **新建 ETL 任务** → 弹窗:
   - 任务名:`daily-sales-rollup`
   - 类型:Flink SQL
   - 源码:
     ```sql
     INSERT INTO paimon.rpt.daily_sales
     SELECT
       DATE(o.created_at) AS sale_date,
       p.category,
       SUM(o.amount) AS total_amount,
       COUNT(*) AS order_count
     FROM paimon.ods.orders o
     JOIN paimon.dim.products p
       ON o.product_id = p.id
     WHERE o.status = 'completed'
     GROUP BY DATE(o.created_at), p.category
     ```
2. 点击 **试编译** → 返回:
   - SQL 语法:✅
   - 表引用:✅ `paimon.ods.orders` / `paimon.dim.products` / `paimon.rpt.daily_sales`
   - 血缘:✅ (4 列 lineage)
   - 编译耗时:300ms
3. 点击 **运行** → 提交到 Flink
4. 任务进入 `running`,在"历史运行"列表可看每次 run 的状态 + 耗时

---

### 1.4 调度管理(Scheduler)按钮

| 按钮 | 位置 | 说明 |
|---|---|---|
| **新建 DAG** | 顶部工具栏 | 创建调度 DAG |
| **添加节点** | DAG 详情页 | 从节点库拖入 |
| **配置依赖** | 节点右键菜单 | 设置上游节点 |
| **配置 cron** | 节点详情面板 | 设置调度时间 |
| **试运行** | DAG 详情页右上角 | 立即触发一次 |
| **发布** | DAG 详情页右上角 | 进入调度队列 |

---

## 2. 给业务分析师的操作手册

### 2.1 指标管理(Metrics)按钮

| 按钮 | 位置 | 说明 |
|---|---|---|
| **新建指标** | 顶部工具栏 | 创建业务指标 |
| **试计算** | 任务详情页 | 用历史数据验证指标 |
| **查看 lineage** | 任务详情页底部 | 表 → 列 → 物理表 |
| **订阅指标** | 指标详情页 | 订阅到 BI / RAG |
| **查看 values** | 指标详情页"数据"标签 | 历史值列表 |

#### 典型流程 — 登记 DAU 指标

1. 点击 **新建指标** → 弹窗:
   - 名称:`DAU(每日活跃用户)`
   - 描述:`每日独立活跃用户数`
   - 表达式:`COUNT(DISTINCT user_id)`
   - 数据源:`paimon.dwd.user_events`
   - 计算频率:每日
   - Owner:王经理
2. 点击 **试计算** → 系统用最近 7 天数据验证:
   - 7 个 values:[12345, 13421, 14523, 13100, 12789, 14001, 13567]
   - 计算耗时:200ms
3. 点击 **发布** → 指标进入"已发布"
4. 在 **订阅指标** 按钮中选择目标(BI 仪表盘 / RAG 知识库)→ 订阅成功
5. 在 **lineage 视图** 查看:DAU 指标 → `user_events` → `user_id` 列

---

## 3. 给运维的故障排查手册

### 3.1 CDC lag 上升

**症状**:`data_cdc_lag_seconds` P95 > 60s

**排查**:
1. 看 Kafka lag:`kafka-consumer-groups.sh --describe --group mate-debezium`
2. 看 Debezium 状态:`curl http://debezium-connect:8083/connectors/{name}/status`
3. 看 Iceberg 写入速率:`SHOW TABLES FROM paimon.ods`

### 3.2 ETL 编译失败

**症状**:`POST /api/v1/etl/tasks/{id}/run` 返回 `E_ETL_COMPILE_FAILED`

**排查**:
1. 看 Flink REST 日志:`docker logs flink-jobmanager`
2. 看 SQL 错误位置:响应中的 `line` / `column` 字段
3. 用 `flink-sql-client` 本地试跑

### 3.3 Scheduler 任务一直 pending

**症状**:`status=pending`,从不进入 `running`

**排查**:
1. 看 Airflow Webserver:`http://airflow-webserver:8080`
2. 看 DAG 是否被 paused:`airflow dags list`
3. 看 worker 日志:`docker logs airflow-scheduler`

### 3.4 指标 lineage 不完整

**症状**:新建指标后 lineage 视图只有部分表

**排查**:
1. 看 SQL 表达式是否含子查询或 CTE(目前不支持)
2. 简化表达式,确保是单层 SELECT
3. 用 `EXPLAIN` 检查实际查询计划

---

## 4. 给开发者的 API 速查

### 4.1 CDC 任务 CRUD

```bash
# 创建 CDC 任务
curl -X POST http://localhost:8200/api/v1/data/cdc-tasks \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "X-Tenant-Id: tenant-001" \
  -d '{
    "name": "orders-mysql-cdc",
    "source_type": "mysql",
    "source_connection": {"host": "192.168.1.10", "port": 3306, "db": "mydb"},
    "source_table": "orders",
    "target_type": "paimon",
    "target_table": "paimon.ods.orders"
  }'

# 启动
curl -X POST http://localhost:8200/api/v1/data/cdc-tasks/{id}/resume

# 状态
curl -X GET http://localhost:8200/api/v1/data/cdc-tasks/{id}/status
```

### 4.2 ETL 任务运行

```bash
# 运行 ETL
curl -X POST http://localhost:8200/api/v1/etl/tasks/{id}/run

# 停止
curl -X POST http://localhost:8200/api/v1/etl/tasks/{id}/stop
```

### 4.3 指标计算 + lineage

```bash
# 计算
curl -X POST http://localhost:8200/api/v1/metrics/{id}/compute \
  -d '{"range": "last_7_days"}'

# lineage
curl -X GET http://localhost:8200/api/v1/metrics/{id}/lineage

# values
curl -X GET http://localhost:8200/api/v1/metrics/{id}/values?range=last_30_days
```

---

## 5. 关联文档

- `PRD-APP-DATA-数据平台_v1.0-20260731.md` — 总 PRD
- `PRD-APP-DATA-数据平台-详细规范_v1.0-20260731.md` — 详细规范
- `ADR-0016-data-platform-architecture.md` — 架构决策
- `architecture-implementation.md` 附录 A — Data-Ready Baseline
- `contracts/openapi/services/{data,etl,metrics,scheduler}.yaml` — 4 子域契约源

---

## 6. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-07-31 | v1.0 初版(4 子域按钮清单 + 典型操作流程 + API 速查 + 故障排查) | TRAE 补 PRD |