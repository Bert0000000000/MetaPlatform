# ONT-DATA-SYNC-INTEGRITY 验收证据（源→本体同步不漏行 / 不丢更新 / 不静默失败）

> **批次**：ONT-DATA-SYNC-INTEGRITY（backing datasource 索引腿一致性收口）
> **日期**：2026-09-23
> **分支**：`feat/ont-data-sync-integrity`（基于 `origin/main@afd4e387`）
> **决策**：ADR-0073（`docs/active/decisions/ADR-0073-data-sync-integrity.md`）
> **operationIds**：`ontSyncV2BackingDatasources` / `ontApplyV2CdcChanges` / `ontGetV2SyncStatus`
> （**路径未变、未入契约**——既有债务，见 §5）
> **Requirement ID**：`FR-ONT-DATA-SYNC-INTEGRITY`

## 1. 问题与根因（实测）

在专用测试库 `metaplatform_ont_test`（专用租户）上以 6,000 行源数据复现：

| # | 根因（file:line） | 实测现象 |
| --- | --- | --- |
| 1 漏行 | `backing_datasources.py:135/137` `SELECT * FROM t LIMIT %s` 单批到底 | 源 6,000 行 → 本体 **5,000**（漏 1,000） |
| 2 丢更新 | `pg_repo.py:3855` `SET last_synced_at = now()`（目标端时间）+ 增量 `ts > wm` | 水位写成 **2026-09-23**（源端边界是 2026-09-01）→ 窗口内/同 ts 行永久跳过 |
| 3 静默失败 | `backing_datasources.py:173-175` `except Exception: continue` | 失败行无记录，调用方只拿到成功计数 |
| 4 优先级跨批次失效 | `pg_repo.py` `create_individual` 的 `props \|\| EXCLUDED.props`（后写覆盖） | 低优先级源增量覆盖高优先级值（**被缺陷 2 掩盖**：其行根本没被读到） |
| 5 语义含混 | `row[column] is not None` 抹平「缺失」与「显式 NULL」 | 无法清空字段；除 CDC delete 外无删除语义 |

## 2. 改动摘要与文件清单

**新增**：

| 文件 | 职责 |
| --- | --- |
| `mate-tech-ont/tests/integration/test_ont_data_sync_integrity.py` | 12,300 行源数据、逐主键逐字段对账，9 个用例 |
| `docs/active/decisions/ADR-0073-data-sync-integrity.md` | 决策档（Accepted） |
| `docs/active/delivery/evidence/ONT-DATA-SYNC-INTEGRITY-ACCEPTANCE.md` | 本文件 |

**修改**：

| 文件 | 改动 |
| --- | --- |
| `v2_kernel/backing_datasources.py` | keyset 分页循环（(ts,pk) / pk）+ 分块批量写 + 失败登记与停止推进 + 字段语义（缺失/显式 NULL/覆盖层/删除） |
| `v2_kernel/pg_repo.py` | 新 `upsert_sourced_props(_batch)`（`props_src` 字段级优先级）；游标写回**源端**边界；DDL 加 `props_src` / `last_synced_pk` / `last_error` / `last_failed` |
| `v2_kernel/sync_scheduler.py` | `ok=False` 计为失败类型（不再整体报成功） |
| `v2_kernel/bind_real_sources.py` | 外层 `ok` 透传同步的 `ok`（不吞失败行） |
| `tests/test_ont_cdc_writeback_merge.py`、`tests/test_ont_data14_datasources.py` | 返回结构同步（`{ok,total_synced,sources}`） |

## 3. 实现要点与安全

- **keyset 分页**：`(ts,pk) > (:ts,:pk)`（增量，同 ts 靠 pk 决胜）/ `pk > :pk`（全量、首次增量）；
  全量**从头读**，不受既有增量游标影响。
- **源端水位**：写回 `last_synced_at/last_synced_pk` = 已可靠处理边界；失败则**不越过失败点**。
- **失败可追踪可重试**：`failures[]` + `last_error/last_failed` + `ok` 布尔；重跑自动重读失败点。
- **优先级跨批次**：`ont_individual.props_src` 记录每字段 `{prio, src}`；已有归属**严格更优**
  才拒绝覆盖 ⇒ 同源重跑幂等、多源同级后写赢。
- **租户**：源表在专用测试库/租户；仓储写入走既有 `tenant_scope`（GOVERN-06）。
- **不新增表** ⇒ 不扩大 ga-014 的 9 表 RLS 强制面（见 ADR-0073 §3）。

## 4. 测试命令与真实结果（2026-09-23 实测）

| 命令 / 用例 | 结果 |
| --- | --- |
| **缺陷复现脚本**（6,000 行源，改前代码，专用测试库） | ✅ 复现：本体 5,000（漏 1,000）；`last_synced_at` = 目标端 `now()` |
| `pytest .../tests/integration/test_ont_data_sync_integrity.py -q`（**实现前**） | **6 failed / 2 passed**（4 项暴露 `batch_limit` 未接线，2 项为同 ts / 多源优先级行为） |
| 同上（**实现后**） | **9 passed**（21.8s） |
| `pytest .../test_ont_data_sync_integrity.py .../test_ont_cdc_writeback_merge.py .../test_ont_data14_datasources.py -q` | **15 passed**（37.2s） |
| `pytest packages/mate-tech-ont/tests -q` | **见 §4.1** |
| `ruff check` + `ruff format --check`（改动文件） | ✅ 净 |

**覆盖的验收场景**（每条都是真跑，无 skip）：

| 场景 | 断言 |
| --- | --- |
| 分页（12,300 行 / batch 1000） | 全量落库，抽检首/边界/末行逐字段一致 |
| 同时间戳 | 水位钉在 (BASE_TS, k000600) 后，其余同 ts 行**不被跳过**（补 11,700 行） |
| 单行失败 | `failed=1` + `failures[0].pk`；游标停在 `k000999`；失败行**不在**库中；重跑补齐 |
| 进程中断 | 首批 250 行已提交、游标停在 `k000250`；续跑补齐至 12,300 且无漏行 |
| 增量重跑 | 只命中变更行；未变行值不变 |
| 多源优先级跨批次 | crm(10) 已写字段，erp(20) 增量**不得覆盖**（name/score 均保持 crm） |
| 显式 NULL / 缺失 | 显式 NULL **清空**；列缺失**保持** |
| 用户编辑覆盖层 | 被编辑属性管道不写；未编辑属性随管道更新 |
| 删除 | CDC `op=delete` 删实例；全量 `delete_missing` tombstone 删源端已消失行 |

### 4.1 全量 ont 套件

> **`pytest packages/mate-tech-ont/tests -q` → 531 passed / 0 failed / 0 skipped**（97.86s；
> 基线 522 + 本批新增 9）。

## 5. 已知边界

1. **同步端点仍未入 OpenAPI 契约**（既有债务，与 ADR-0071/0072 同源）；本批不改契约。
2. **失败记录不落独立表**：仅返回结构 + `last_error/last_failed` 列 + 结构化日志（理由见 ADR-0073 §3）。
3. **源端回填历史 ts 不处理**：以 ts 单调为前提（keyset 的固有契约）。
4. **tombstone 需显式 `delete_missing=True`** 且只对权威源（priority 最小）生效；默认关闭。
5. **无多副本协调**：同步仍由进程内 Scheduler 触发（单副本假设，沿用 v1）。
6. **回滚**：`git revert` 本批提交即退回；新列是 `ADD COLUMN IF NOT EXISTS`（留列无害）。

## 6. 结论

**准出达成**：五类缺陷全部关闭并由 9 项真跑用例（12,300 行、逐主键逐字段对账）钉死；
失败**不静默**、游标**只推进到源端已处理边界**、优先级**跨批次**保持。

## CI 门禁与证据（LOOP-ROLLOUT-01 模板字段）

| job | 硬规则 | 本批状态 |
| --- | --- | --- |
| ga-001-openapi | 1 Swagger 没有接口不写 route | ⚠️ 同步/CDC 端点**本就未入契约**（既有债务）；本批不改路径与契约（§5.1） |
| ga-002-requirement-ids | 2 PRD 没有 Requirement ID | ✅ `FR-ONT-DATA-SYNC-INTEGRITY`（本文件 §头部） |
| ga-003-tenant | 3 没有 tenant 上下文不访问 repository | ✅ 写入经既有 `tenant_scope`（GOVERN-06）；测试用专用库 + 专用租户 `syncint` |
| ga-004-acl-client | 4 外部系统没有 ACL Client | N/A 源读取用 psycopg2 直连（v1 设计，`dsn_env`），非 HTTP 外部系统 |
| ga-005-no-fallback | 5 Production profile 禁止 fallback | ✅ **本批核心**：失败行不得报整体成功（`ok=False` 贯通 API/调度/脚本） |
| ga-006-static | 6 静态检查失败不合并 | ✅ `ruff check`/`format` 净 |
| ga-007-skip-tests | 7 契约或集成测试跳过不标记 Accepted | ✅ 新增 9 项全真跑（PG 可达，0 skip） |
| ga-008-helm | 8 没有 K8s readiness + 回滚 | N/A 无 K8s 改动；回滚见 §5.6 |
| ga-009-otel | 9 没有审计、指标、trace | ✅ 新增 `sync.batch_write_failed_fallback_row`、`sync_scheduler.sync_partial_failure` 结构化事件 |
| ga-010-evidence | 10 所有状态以验收证据为准 | ✅ **本文件即数据源** |
| ga-011-helm-docs | 11 helm-docs 同步子 chart README | N/A 无 chart 改动 |
| ga-012-secret-scan | 12 Secret 不进 git | ✅ 无 secret 入 diff（DSN 走 env 名） |
| ga-013-networkpolicy | 13 NetworkPolicy 缺失 = prod 不通过 | N/A 无网络策略改动 |

**证据**：本文件。**命令**：见 §4 测试表。
