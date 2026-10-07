# ONT-MIGRATION-PLAN ACCEPTANCE — 模型发布 Migration Plan（存量数据迁移）

> **日期**：2026-10-07 · **ADR**：`docs/active/decisions/ADR-0082-ontology-migration-plan.md`
> **范围**：ObjectType 面的存量实例适配（评估 / 执行 / 记录）+ **家族发布自动携带实例**
> （修一个未登记缺陷：branch v1→v2 后 `ont_individual.class_rid` 停在旧 rid，新 rid 下
> 查实例恒 0 行——数据在库、产品面不可见）。发布语义不变（破坏性确认门禁不动）。
> **测试基线**：`packages/mate-kernel/tests` + `packages/mate-tech-ont/tests` =
> **1333 passed / 0 failed**（本批新增 22 项；两包合计口径，全仓以 CI 为准）。
> 前端：tsc / build 过；新增 E2E spec 2/2 绿；全量 Playwright 见 §4。

## 1. 验收判据逐条对位

| # | 判据 | 实现 | 证据 |
| --- | --- | --- | --- |
| 1 | **家族发布后实例在新 rid 下可见**；reattach 计数入档 | `upsert_object_type` supersede 路径**同一事务** `UPDATE ont_individual SET class_rid=新 WHERE class_rid=ANY(旧)` + 写 `kind='reattach'` 迁移记录（实例 rid 家族稳定，无重写风险） | `test_family_publish_carries_instances_and_records_run`；浏览器实测（发布 migsmoke v2 → 迁移记录「发布携带 reattached=1」+ `GET /individuals?class_rid=v2` 返回该实例） |
| 2 | sync 命中同 rid 时 class_rid 跟到当前版本 | `upsert_sourced_props` 与批量版 `ON CONFLICT (rid) DO UPDATE` 均补 `class_rid = EXCLUDED.class_rid` | `test_sourced_upsert_updates_class_rid_on_conflict` |
| 3 | assess 分类 + **SQL 级真实计数**（只读） | removed 有同 slug 后继 → rename；无后继 → drops（默认 preserve）；format 分 coercible/kept；PK 冲突/缺失检出；旧 rid 残留实例计 reattach_pending；`target` 参数支持**草稿预演**（发布前看影响） | `test_rename_paired_by_slug_and_true_removal_preserved`、`test_counts_match_seeded_data`、`test_format_counts_split_coercible_and_kept`、`test_pk_conflicts_and_missing_detected`、`test_assess_with_target_payload_previews_draft`、`test_assess_is_read_only` |
| 4 | rename 四处重映射 | `props` / `props_src`（字段级来源优先级）/ `ont_edit_overlay`（回写覆盖层，主键并存先并后改）/ `ont_backing_datasource.field_mapping` | `test_rename_remaps_props_props_src_overlay_and_field_mapping` |
| 5 | drop 默认 preserve；显式 drop 才删 | preserve 只计数；drop 物理删键（含 props_src/overlay）且评估明示不可逆 | `test_drop_preserves_by_default`、`test_explicit_drop_removes_keys` |
| 6 | coerce 仅无损白名单 | string↔integer/double 可解析子集、number→string、int→double（\|v\|<2^53）；白名单外保留原值 + 计数 | `test_coerce_lossless_only` |
| 7 | PK 重派生 fail-closed | rid 按新 pk 值重派生 + `ont_link_instance.src/dst` 与 overlay 同步改写；**冲突/缺失默认整单拒（单事务回滚，无部分写）**；`skip` 跳过并逐条报告；复合主键如实报不支持 | `test_rederive_rewrites_rids_and_links`、`test_conflict_aborts_without_partial_writes`、`test_missing_pk_skip_option_reports` |
| 8 | 幂等键回放；缺键 400 | `ont_migration_run (tenant_id, idempotency_key)` 唯一；同键回放原结果（`replayed: true`）不重复执行 | `test_same_idempotency_key_replays_original_result`、`test_missing_idempotency_key_rejected` |
| 9 | expected_checksum 漂移 409 | 复用 `VersionConflict` → 409 `E409_VERSION_CONFLICT`（与 ADR-0080 §2.5 同口径） | `test_checksum_drift_rejected_409` |
| 10 | 跨租户 403；runs 租户隔离 | 三端点 rid 前缀守门；`list_migration_runs` 按家族类型 rid + 租户过滤 | `test_cross_tenant_denied`、`test_runs_list_is_tenant_scoped` |
| 11 | 迁移后模型回滚仍只动模型 | 回滚写新快照不动实例；迁移记录跨回滚保留（链条可追溯） | `test_rollback_after_migration_keeps_migrated_data` |

## 2. 勘察发现并修复的缺陷（此前未登记）

**家族发布后实例整体不可见**：ADR-0080 的 supersede 实现只下线旧 rid 不碰
`ont_individual.class_rid`，而查询按 rid 解析（无家族语义）——`deal.v1 → deal.v2`
发布后 v2 下查实例 0 行；连数据同步的 `ON CONFLICT DO UPDATE` 也不更新 class_rid，
管道同步无法自愈。本批以「同事务 reattach + 迁移记录」修复（判据 #1/#2），
旧存量悬空可由 assess（reattach_pending 计数）→ run 治愈（判据 #3 的
`test_assess_reports_and_heals_legacy_orphans`）。

## 3. 端点与契约

| 端点 | operationId | 权限 | 说明 |
| --- | --- | --- | --- |
| `POST /object-types/{rid}/migration/assess` | `ontAssessV2Migration` | ont.read（scope platform.write） | 只读评估；`target_payload` 传草稿 = 发布前预演 |
| `POST /object-types/{rid}/migration/run` | `ontRunV2Migration` | ont.write | Idempotency-Key 必填 + expected_checksum 必填 |
| `GET /object-types/{rid}/migration/runs` | `ontListV2MigrationRuns` | ont.read | 家族迁移记录（reattach + plan 均入档） |

契约三产物（`services/ont.yaml` / `platform.yaml` / `generated/bundled.yaml`）同步提交；
`REQUIREMENT-MATRIX.yaml` 登记 `FR-ONT-RELEASE-MIGRATION`。

## 4. 真栈验证（网关 8100 → mate-tech-ont 容器 → PG；容器 bind mount 主检出，重启加载）

- **HTTP 冒烟 10 步全过**（脚本化，真实 IAM 登录）：发布 v1 → 建实例 → 破坏性重发布
  无确认 409 / 带确认 200 → 评估（dangling=1, instances_affected=1）→ 无幂等键 400 →
  执行（preserved=1，默认不丢数据）→ 同键回放 → 历史 1 条 → 漂移 409。
- **浏览器实测**（9250 dev server，UI 操作）：版本与发布页选中冒烟类型 →「评估影响」
  → 评估结果面板（变更清单 + 受影响/待重挂/PK 计数 + 悬空属性明细 + 处置策略选择）→
  「执行迁移」（确认框带摘要）→ 迁移完成 + 记录入档；「发布新版本」v1→v2 →
  迁移记录出现「发布携带 reattached=1」，`GET /individuals?class_rid=v2` 实例可见。
- **E2E**：`tests/e2e/ontology-migration-plan.spec.ts` 2/2 绿（评估→执行→记录→家族
  发布携带实例全流程 + 无幂等键 400 守卫）；全量 Playwright **167 过 / 1 skip /
  0 红**（含既有的 governance-flow「版本操作能力未退化」与 superai-routing）。
- 冒烟数据已从共享 dev 库清理（直接按 rid 删行，含迁移记录）。

## 5. 交付门禁（13 硬规则）与复现

| 门禁 | 结果 | 说明 |
| --- | --- | --- |
| ga-001 oasdiff | pass | 新增 3 operation 属非破坏性；三产物同步提交 |
| ga-002 requirement IDs | pass | `FR-ONT-RELEASE-MIGRATION` 已登记 |
| ga-003 forbid_raw_sql | pass | 新 SQL 全在 repo 层 tenant_scope 内 |
| ga-004 forbid_bare_httpx | pass | 未新增出站直连 |
| ga-005 forbid_legacy_fallback | pass | 未触碰 |
| ga-006 ruff + pyright strict | pass | ruff check / format 全绿（本批文件） |
| ga-007 forbid_skip_tests | pass | 新增用例无 skip / xfail |
| ga-008 helm | pass | 未触碰 |
| ga-009 otel | pass | 未触碰 |
| ga-010 require_evidence | pass | 本文件即证据 |
| ga-011 helm-docs | pass | 未触碰 |
| ga-012 gitleaks | pass | 无密钥材料 |
| ga-013 networkpolicy | pass | 未触碰 |

**复现命令**：

```bash
uv run --directory mate-platform-backend pytest \
  packages/mate-kernel/tests packages/mate-tech-ont/tests -q   # 1333 passed
cd metaplatform-frontend/apps/web && npx playwright test \
  tests/e2e/ontology-migration-plan.spec.ts                     # 2 passed
```

**关键 commit**：见 PR 列表（ADR → 失败测试+实现 → 契约 → target_payload 扩展 → 前端+E2E）。

## 6. 边界（与 ADR-0082 §5 一致，不夸大）

- **只做 ObjectType 面**：LinkType / Interface 变更的迁移不在本批。
- **复合主键重派生不支持**（评估如实报 unsupported，不静默）。
- **单事务执行**：生产规模（数十万实例级）的分批/后台长跑迁移留后续边界。
- **drop 不可逆**：评估阶段明示信息损失（`plan_inverse_loss`），无影子备份。
- **评估与执行的计数窗口**：评估只读不加锁，并发写入下两数可能有小差异；
  执行按执行时数据为准（expected_checksum 只锁模型定义漂移）。
- `ont_migration_run` 沿 `ont_type_version` 先例做显式租户过滤，不进 RLS 9 表清单
  （ga-014 覆盖面不变；本地测试库需 `ALTER TABLE ... OWNER TO mate_ont_test` 对齐）。
- **既有契约缺口（本批不修，登记）**：branch / diff / rollback / wip 四组端点早于
  本批存在但从未入契（compare_runtime 对 runtime→contract 方向只报告不拦截），
  建议后续独立批次补齐。
