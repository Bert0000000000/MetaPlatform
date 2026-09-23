# ONT-LINK-CARDINALITY-CONCURRENCY 验收证据（关系写入的跨进程并发保护）

> **批次**：ONT-LINK-CARDINALITY-CONCURRENCY（关系基数校验与写入的 DB 级互斥）
> **日期**：2026-09-23
> **分支**：`fix/ont-link-cardinality-concurrency`（基于 `origin/main@71b91dbe`）
> **决策**：ADR-0075（`docs/active/decisions/ADR-0075-link-cardinality-concurrency.md`）
> **operationIds**：`ontCreateV2LinkInstance` / `ontExecuteV2Proposal`（edit-set 执行，路径未改）
> **Requirement ID**：`FR-ONT-LINK-CARDINALITY-CONCURRENCY`

## 1. 问题与根因（实测）

| # | 根因（file:line） | 后果 |
| --- | --- | --- |
| 1 TOCTOU | `_check_link_cardinality` **自开连接**数边后关闭（:2344），`create_link_instance` **另开连接**写入（:2282） | 两个独立连接/进程各数到 0 条边 → 都写入成功，1:1 / 1:N / N:1 约束失效 |
| 2 绕行 | edit-set `add_link` **直接** `INSERT INTO ont_link_instance`（:5694），不做基数校验 | Action / 导入路径绕过已注册 LinkType 的基数约束 |

复现（修复前，测试用窗口放大器把「校验 → 写入」间隔拉长 0.6s）：两线程并发写 1:1 同 src
关系 → **两条都成功**，库里 2 条冲突边。

## 2. 改动摘要与文件清单

**新增**：

| 文件 | 职责 |
| --- | --- |
| `mate-tech-ont/tests/integration/test_ont_link_cardinality_concurrency.py` | 3 项（先红后绿，含确定性并发用例） |
| `docs/active/decisions/ADR-0075-link-cardinality-concurrency.md` | 决策档（Accepted） |
| `docs/active/delivery/evidence/ONT-LINK-CARDINALITY-CONCURRENCY-ACCEPTANCE.md` | 本文件 |

**修改**：

| 文件 | 改动 |
| --- | --- |
| `v2_kernel/pg_repo.py` | 新增 `_lock_link_endpoints`（`pg_advisory_xact_lock`，端点键、排序防死锁）与 `_count_endpoint_edges`；`_check_link_cardinality(cur=)` 在原事务内数边；`create_link_instance` 单事务（锁 → 校验 → 写入）；edit-set `add_link` 接同一对 helper |

## 3. 实现要点与安全

- **数据库级互斥**（非进程内锁）：`pg_advisory_xact_lock(hashtextextended('<link_type>|<endpoint>',0))`，
  对 src 与 dst 两个端点各锁一把，**按 key 排序**获取以避免死锁；锁随事务提交/回滚释放。
- **同一事务**：校验与写入共用一个 cursor/连接 —— 消除了「数一遍」与「写一条」之间的窗口。
- **可达写入口一致**：Action / edit-set 的 `add_link` 与直插路径共用同一约束。
- **租户隔离**：lock key 含 `link_type_rid`（含租户），不会跨租户阻塞。
- 未注册 LinkType 仍宽松（沿用 legacy 语义）。

## 4. 测试命令与真实结果（2026-09-23 实测）

| 命令 / 用例 | 结果 |
| --- | --- |
| `pytest .../integration/test_ont_link_cardinality_concurrency.py -q`（**修复前**，`git stash` 仅回退实现文件） | **2 failed / 1 passed** —— 并发双写都成功 + edit-set `add_link` 绕过约束 |
| 同上（**修复后**） | **3 passed** |
| `pytest packages/mate-tech-ont/tests -q` | **见 §4.1** |
| `ruff check` + `ruff format --check`（改动文件） | ✅ 净 |

**覆盖**：

| 场景 | 断言 |
| --- | --- |
| 两独立连接并发写 1:1 冲突关系（同 src） | 恰好 1 个成功、另 1 个 cardinality 违规；库中只有 1 条边 |
| 串行对照 | 第二条冲突关系被拒绝 |
| edit-set `add_link`（Action 路径） | 受同一基数约束拒绝，冲突边不落库 |

### 4.1 全量 ont 套件

> **`pytest packages/mate-tech-ont/tests -q` → 534 passed / 0 failed / 0 skipped**（97.40s；
> 基线 531 + 本批新增 3）。

## 5. 已知边界

1. advisory lock 在**同一数据库内**互斥（多副本连同一 PG 有效）；跨库/跨集群不在本批。
2. LinkType 定义在锁外读取；定义与写入并发变更时以写入时读到的定义为准。
3. `remove_link` 未加端点锁（删除只放松约束，不制造违规）。
4. in-memory 路径未改（单进程语义）。
5. **回滚**：`git revert` 本批提交即退回（无新增表/迁移/契约变更）。

## 6. 结论

**准出达成**：基数校验与写入在**同一事务 + DB 端点锁**下执行，两个独立连接并发创建冲突
关系时**最多一个成功**；Action/edit-set 可达写入口遵守同一约束。以确定性并发用例钉死
（先红后绿，红由 `git stash` 回退实现单独证明）。

## CI 门禁与证据（LOOP-ROLLOUT-01 模板字段）

| job | 硬规则 | 本批状态 |
| --- | --- | --- |
| ga-001-openapi | 1 Swagger 没有接口不写 route | ✅ 未改路径/契约 |
| ga-002-requirement-ids | 2 PRD 没有 Requirement ID | ✅ `FR-ONT-LINK-CARDINALITY-CONCURRENCY`（本文件 §头部） |
| ga-003-tenant | 3 没有 tenant 上下文不访问 repository | ✅ 写入经 `tenant_scope`；lock key 含租户内 rid；测试用专用库 + 专用租户 `linkconc` |
| ga-004-acl-client | 4 外部系统没有 ACL Client | N/A 无外部调用 |
| ga-005-no-fallback | 5 Production profile 禁止 fallback | ✅ 并发冲突**拒绝**，不静默接受第二条边 |
| ga-006-static | 6 静态检查失败不合并 | ✅ `ruff check`/`format` 净 |
| ga-007-skip-tests | 7 契约或集成测试跳过不标记 Accepted | ✅ 新增 3 项全真跑（含真并发线程） |
| ga-008-helm | 8 没有 K8s readiness + 回滚 | N/A 无 K8s 改动；回滚见 §5.5 |
| ga-009-otel | 9 没有审计、指标、trace | ✅ 沿用既有 OTel 中间件；冲突以 ValueError 显式失败 |
| ga-010-evidence | 10 所有状态以验收证据为准 | ✅ **本文件即数据源** |
| ga-011-helm-docs | 11 helm-docs 同步子 chart README | N/A 无 chart 改动 |
| ga-012-secret-scan | 12 Secret 不进 git | ✅ 无 secret 入 diff |
| ga-013-networkpolicy | 13 NetworkPolicy 缺失 = prod 不通过 | N/A 无网络策略改动 |

**证据**：本文件。**命令**：见 §4 测试表。
