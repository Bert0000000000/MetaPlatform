# ADR-0073：源→本体同步一致性（不漏行 / 不丢更新 / 不静默失败）

- **状态**：Accepted（2026-09-23）
- **日期**：2026-09-23
- **关联**：ADR-0021（Kernel 12 基元）、DATA-14/15（数据平面绑定）、
  13 硬规则 #3（tenant 上下文）、#5（production 禁止 fake success）

## 1. 背景

`v2_kernel/backing_datasources.py::sync_backing_datasource` 与
`v2_kernel/pg_repo.py::sync_backing_datasources` 是源表 → Individual 的索引腿。
实测（6000 行源 / 默认 batch_limit=5000，专用测试库 `metaplatform_ont_test`）暴露五类缺陷：

1. **单批 LIMIT 后不再读**：`SELECT * FROM t LIMIT %s` 一次到底，无游标/分页
   → 实测 6000 行只落 5000（漏 1000 行）。
2. **水位写成目标端 `now()`**：`UPDATE ... SET last_synced_at = now()`。实测同步后
   水位 = 目标库当前时间（2026-09-23），而源端边界是 2026-09-01 → 同步窗口内
   写入的、以及**同 ts 未读完**的行**永久丢失**（增量条件 `ts > wm` 直接跳过）。
3. **吞异常后报成功**：单行 `except Exception: continue`；无失败记录；调用方拿到的
   只有成功计数 → 「部分失败」被当作整体成功。
4. **多源优先级不跨批次**：字段优先级只在**单次调用**的内存 `written` 缓存里成立；
   `create_individual` 的 `props = props || EXCLUDED.props` 会让**后写的低优先级源**
   覆盖高优先级源已写字段（缺陷 2 修复后该问题即显形——此前被水位吞掉而"看不见"）。
5. **字段语义含混**：`row[column] is not None` 使**显式 NULL** 与「列缺失」不可区分
   → 无法清空字段；无删除语义（CDC `op=delete` 外无 tombstone）。

## 2. 决策

### 2.1 稳定分页（keyset，不漏行）

引擎按**keyset** 分页读到源穷尽：

- 增量且已有 ts 边界：`WHERE (ts_col, pk) > (:ts, :pk) ORDER BY ts_col, pk LIMIT n`
  ——**同时间戳靠 pk 决胜**（同 ts 行不会被 `>` 漏掉）；
- 全量 / 首次增量 / 源无 ts：`WHERE pk > :pk ORDER BY pk LIMIT n`；
- 全量同步**从头读**（不受既有增量游标影响）。

### 2.2 源端边界水位（不丢更新）

每次同步返回该源**已可靠处理**的边界 `(ts, pk)`；`pg_repo` 把它写回
`ont_backing_datasource.last_synced_at / last_synced_pk`，**绝不写目标端 `now()`**。
同步期间新增的数据（源 ts > 边界）下一轮自然读到。

### 2.3 失败可追踪、可重试、不静默

- 逐行失败登记到返回结构 `failures[]`（含 pk + error），并有
  `last_error / last_failed` 持久化列；
- **失败即停止推进游标**（边界停在失败点之前）→ 下一轮从失败点重读 = 自动重试；
- 返回 `ok = (total_failed == 0)`；调用方（调度器 / API）**不得**在 `ok=False` 时报成功。
- 批量写失败不静默降级：先记 `sync.batch_write_failed_fallback_row` 日志，再逐行定位。

### 2.4 字段级来源归属（`props_src`）跨批次生效

`ont_individual` 增列 `props_src JSONB`：`{prop_rid: {"prio": n, "src": name}}`。
写字段时若**已有归属的优先级 < 本次**（严格更优）→ 跳过；否则写入并更新归属。
等优先级允许覆盖 ⇒ **同源重跑幂等**、多源同级后写赢。

### 2.5 字段语义显式化

| 情形 | 语义 |
| --- | --- |
| 列不在行内（缺失） | **保持**原值 |
| 列存在且为 NULL（显式 null） | **清空**该字段（受优先级约束） |
| 用户编辑覆盖层命中该属性 | 管道**不写**（双流合并） |
| CDC `op=delete` / 全量 tombstone（`delete_missing=True`） | **删除**实例 |

## 3. 不做的

- **不新增失败记录表**：失败明细随返回结构下发 + `last_error/last_failed` 列 +
  结构化日志 `sync.batch_write_failed_fallback_row`。新增表会跳出 ga-014 的 9 表 RLS
  强制集（`prepare_ont_rls_test_db.py::KERNEL01_V2_TABLES`），把租户隔离面开个口子。
- 不改 `create_individual`（其它调用方语义不变）；同步腿改走 `upsert_sourced_props(_batch)`。
- 不做 OFFSET 分页（大表下不稳定）。
- 源端「回填历史 ts」的边界不处理（ts 单调性前提），已在模块 docstring 声明。

## 4. 实施与验证

- **实现**：`backing_datasources.py`（keyset 循环 + 分块批量写 + 失败登记 + 语义）、
  `pg_repo.py`（`upsert_sourced_props` / `_batch`、游标写回、`props_src`/`last_*` DDL）。
- **测试**：`tests/integration/test_ont_data_sync_integrity.py` —— 12,300 行源数据，
  逐主键逐字段对账，覆盖分页 / 同时间戳 / 单行失败+重试 / 进程中断+续跑 /
  增量重跑 / 多源优先级跨批次 / 显式 NULL 清空 / 覆盖层 / 删除（CDC + tombstone）。
- **证据**：`docs/active/delivery/evidence/ONT-DATA-SYNC-INTEGRITY-ACCEPTANCE.md`。

## 5. 已知边界

- 全量同步是 `O(行数)` 的 keyset 扫描 + 分块 upsert；12,300 行约 20s（含两源）。
- `props_src` 记录的是「谁最后被允许写」；清空（写 NULL）也占一个归属位。
- tombstone 仅对**权威源**（priority 最小的源）启用，且需显式 `delete_missing=True`。
