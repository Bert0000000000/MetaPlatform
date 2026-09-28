# ONT-VERSION-MECHANISM ACCEPTANCE — 草稿与版本机制补齐

> **日期**：2026-09-23 · **ADR**：`docs/active/decisions/ADR-0080-ontology-draft-and-version-mechanism.md`
> **范围**：补齐既有草稿 / 版本机制；**不新建发布平台、不新增表族、不新增端点**
> **测试基线**：`packages/mate-kernel/tests` + `packages/mate-tech-ont/tests` = **1311 passed / 0 failed**
> （两个包合计；本文不把不同包的数字相加冒充全仓结果，全仓结果以 CI 为准）

## 1. 验收判据逐条对位

| # | 判据 | 实现 | 证据 |
| --- | --- | --- | --- |
| 1 | **破坏性草稿正确确认后可发布；未确认仍拒绝** | `api.py::apply_schema_wip` 不再 `del confirm_name`，改为覆盖草稿载荷后交同一门禁；未确认仍由 `destructive_confirm_required` 409 拒绝 | `test_ont_version_mechanism.py::TestDraftConfirmPassthrough`（409 → 确认 → 200）+ 浏览器实测（草稿页：应用 → 行内二段确认 → 重发（确认）→ 已应用 WIP） |
| 2 | **发布 v2 后仍能读取 v1 完整定义** | 版本 = 不可变**定义快照**（`definition` + `checksum` + `dependencies`）；每次发布同事务写入 | `TestVersionSnapshots::test_publishing_v2_keeps_v1_definition_readable`、`TestPublishNewVersion::test_publish_v2_supersedes_v1_and_keeps_both_readable` + 浏览器实测（发布 v2 后 v1 rid 仍 200 且属性完整） |
| 3 | **Diff 可重现** | `diff_object_types` 两侧都走 `_definition_for` —— 版本快照 rid 解析为快照定义（不可变），不再是可能被覆盖的 live 行 | `TestDiffReproducible::test_diff_between_snapshot_and_live_is_reproducible` + 浏览器实测（基准=v1 快照，连续两次结果逐字相同） |
| 4 | **并发编辑有明确冲突** | ①草稿保存时记 live 指纹为基线，apply 时基线≠live → 409 `E409_VERSION_CONFLICT`；②`POST /versions` 的 `expected_checksum` 不一致 → `VersionConflict` → 409 | `TestStaleDraftConflict`（2 项）、`TestVersionConflict`（2 项）+ 浏览器实测（"草稿基线已过期：模型已被他人改动（当前 …，草稿基线 …）"） |
| 5 | **回滚范围与结果一致** | `rollback_object_type` 只回滚模型定义；`from_rid` 接受 **`ver` 快照 rid**；文档/UI/confirm 文案三处写明"不动数据、不补偿副作用" | `TestRollbackScope::test_rollback_restores_model_only` + 浏览器实测（回滚后模型回到 2 属性，实例 `note=keep-me` **仍在**） |
| 6 | **唯一权威版本来源** | `ont_type_version` 的定义快照；`list_versions` 不再恒 `[]`，并在 SQL 层过滤旧血缘行 | `TestVersionSnapshots::test_list_versions_was_empty_now_returns_snapshots`、`TestVersionDependencies::test_live_checksum_pins_the_current_effective_version` |
| 附加 | **发布前验证引用与兼容性**（目标 §4） | `_assert_publishable` → 模型错误 422 `invalid_model`；`ontValidateV2Model` 升级为发布前预检（静态错误 + 破坏性差异 + 引用解析 + 必要依赖） | `TestPublishPreflight`（2 项）+ 浏览器实测（草稿页「预检」→ 破坏性清单 + 依赖计数） |

## 2. 版本面盘点（目标 §2 的交付物）

| 面 | 位置 | 角色 | 权威性 |
| --- | --- | --- | --- |
| `ont_schema_wip`（含 `base_checksum`） | `POST/GET/DELETE /object-types/wip*` + `/ontology/governance/drafts` | **草稿**（个人未发布副本） | 不占版本号；基线用于冲突判定 |
| `ont_type_version`（`definition`/`checksum`/`version_no`/`dependencies`） | `GET/POST /versions/{class_rid}` | **已发布版本** = 不可变定义快照 | **唯一权威版本历史** |
| `ont_object_type`（live 行） | `GET/POST /object-types*` | **当前生效定义** | 权威"当前"；其 `checksum` 与快照比对即得"当前生效版本" |
| `branch` / `diff` / `rollback` | `POST /object-types/{rid}/branch|rollback`、`GET /object-types/{rid}/diff` | 版本**操作**面 | 不产生第二套真相；三者都落到上表 |
| 前端「版本与发布」`/ontology/governance/releases` | `ReleasesPage.tsx` | 版本读面 + 操作面 | 原为 `listObjectTypes()` 的**同族 rid 列表冒充历史**；现改为消费 `/versions/{class_rid}`，标注"当前生效" |

**家族键 = `(tenant, slug)`**：`...deal.v1` 与 `...deal.v2` 共享一份版本历史；
生效集合里一个家族至多一个类型（`uq_ont_ot_tenant_slug`），因此同族发布新版本会
**下线旧 rid**（其定义已在快照里，可完整回读）。

## 3. 浏览器实测（真栈：9250 → 网关 8100 → mate-tech-ont 容器 8007 → PG）

一次典型会话（脚本化操作，全部为真实 HTTP）：

1. 建类型 `...obj.vermech.demo.v1` → 发布即产生 `...ver.demo.v1`（属性 2、依赖 2）；
2. 「版本与发布」页选中该类型 → 「当前生效」显示定义指纹 + `对应已发布版本 v1`；
3. 点「发布新版本」输入 `...demo.v2` → 成功；旧 rid 从类型列表消失、v1 定义仍可读；
4. 给 v2 加属性（upsert）→ 版本史出现 `v3`（属性 3）；
5. 「设为基准」v1 快照 + 对比 live → **连续两次 diff 逐字相同**，显示 `新增属性 vm-note`；
6. 「回滚到此版」（v1 快照）→ live 回到 v2 指纹、`当前生效` 标到 v2、版本史**不新增重复条目**；
7. 回滚后实例 `ont.…ind.vermech.d1` 仍为 200 且 `vm-note=keep-me` —— **数据未回滚**；
8. 草稿页：破坏性草稿「应用」→ 行内二段确认 → 重发（确认）→ 成功，版本史新增一条；
9. 另存草稿后并发改动 live → 「应用」→ 409 `草稿基线已过期`（附带当前/基线两个指纹）。

> 实测数据为临时造数，验证结束后已按 rid 前缀精确清理（`ont_object_type` / `ont_type_version`
> / `ont_individual` / `ont_schema_wip` / `ont_axiom`）。

## 4. 同批修复的既有缺陷

| 缺陷 | 位置 | 症状 |
| --- | --- | --- |
| `apply_schema_wip` 丢弃 `confirm_name` | `api.py` | 破坏性草稿永远发不出去（409 死循环） |
| `list_versions` 恒返回 `[]` | `pg_repo.py` | 版本历史面为空，"发布"无史可查 |
| 版本行不携带定义 | `ont_type_version` | 覆盖发布后旧定义无处可读 |
| 旧血缘行读回崩页 | `_row_to_version` | `class_rid=''` → `ValueError` → 历史接口 500 |
| 草稿页渲染崩溃 | `DraftsPage.tsx` | `dataIndex:'__label__'` → `ridTail(undefined)` → 只要有 1 条草稿即整页崩 |
| 同族发布撞 slug 唯一 | `branch_object_type` | 同族 v1→v2 无法发布（`SlugConflictError`） |
| in-memory 与 PG 契约漂移 | `in_memory.py` | `snapshot_version` 不认 `expected_checksum` → 真栈 500 |

## 5. 边界（与 ADR-0080 §5 一致，不夸大）

- **回滚不动数据、不补偿副作用**；删属性/改主键后存量实例可能悬空 —— "Migration Plan"
  能力明确不在本批（后续增量输入条件）。
- 未解析引用**不阻断**发布（沿用"先声明后注册"）。
- 同内容不同 rid 记为两条版本（`rid` 属定义内容），因此"分叉后立刻改动"会留下一条
  仅 rid 不同的中间版本 —— 真实但略冗余。
- 并发保护是**乐观**的：库不一致时先提交者胜，后提交者 409。
- in-memory 是轻量 fake：**不做同内容去重**，且类型不存在时 `definition` 为空
  （PG 侧为 `KeyError`）；冲突判定两边一致。

## 6. 交付门禁（13 硬规则）与复现

本批**不新增 contract operation**（只扩既有端点的字段与行为），13 条 GA 门禁在 PR #92 上全绿：

| 门禁 | 结果 | 说明 |
| --- | --- | --- |
| ga-001 oasdiff（无未批准的破坏性变更） | pass | 新增响应字段属非破坏性 |
| ga-002 requirement IDs present | pass | 未新增 operation，无需登记 |
| ga-003 forbid_raw_sql（规则 3） | pass | 新查询走 repo 的 tenant scope |
| ga-004 forbid_bare_httpx（规则 4） | pass | 未新增出站直连 |
| ga-005 forbid_legacy_fallback（规则 5） | pass | 未触碰 |
| ga-006 ruff + pyright strict | pass | 全仓 ruff check / format 干净 |
| ga-007 forbid_skip_tests（规则 7） | pass | 新增用例无 skip / xfail |
| ga-008 helm lint + kubeconform | pass | 未触碰 |
| ga-009 OTel collector smoke | pass | 未触碰 |
| ga-010 require_evidence（规则 10） | pass | 本文件即证据 |
| ga-011 helm-docs --dry-run | pass | 未触碰 |
| ga-012 gitleaks | pass | 无密钥材料 |
| ga-013 NetworkPolicy service coverage | pass | 未触碰 |

**commit**：`62c41e40`（本批）

**命令**：

```bash
cd mate-platform-backend
.venv/Scripts/python.exe -m pytest packages/mate-kernel/tests packages/mate-tech-ont/tests -q          # 1311 passed
.venv/Scripts/python.exe -m pytest packages/mate-tech-ont/tests/integration/test_ont_version_mechanism.py -q   # 16 passed
cd ../metaplatform-frontend/apps/web && node_modules/.bin/tsc -b --noEmit                             # 前端 typecheck
```
