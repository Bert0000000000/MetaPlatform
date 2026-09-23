# ONT-MODEL-WRITE-ATOMICITY 验收证据（模型写入原子性 + 发布期校验 fail-closed）

> **批次**：ONT-MODEL-WRITE-ATOMICITY（本体模型修改的事务原子性与发布期一致性）
> **日期**：2026-09-23
> **分支**：`fix/ont-model-write-atomicity`（基于 `origin/main@71b91dbe`）
> **决策**：ADR-0074（`docs/active/decisions/ADR-0074-model-write-atomicity.md`）
> **operationIds**：`ontCreateV2ObjectType` / `ontApplyV2SchemaWip`（未改路径）
> **Requirement ID**：`FR-ONT-MODEL-WRITE-ATOMICITY`

## 1. 问题与根因（实测）

| # | 根因（file:line） | 后果 |
| --- | --- | --- |
| 1 非原子 | `pg_repo.py:1413` 先 `conn.commit()` 提交类型，随后**另一事务**写 `parent_class` 派生的 subclass 公理，且 `except Exception: pass`（:1441）吞掉失败 | 「有类型、无公理」半成品：层级树 / 子类闭包查询与模型详情不一致，且无人知晓 |
| 2 读取失败=通过（接口） | `_validate_registered_interfaces` 的 `except Exception: return`（:1456） | 接口存储抖动 → 静默跳过申报接口的一致性校验 |
| 3 读取失败=通过（破坏性门禁） | `api.py` `POST /object-types` 的 `except Exception: destructive = []`（:1764） | 读取失败 → 破坏性变更（删属性/改主键/改 parent）被静默放行 |

## 2. 改动摘要与文件清单

**新增**：

| 文件 | 职责 |
| --- | --- |
| `mate-tech-ont/tests/integration/test_ont_model_write_atomicity.py` | 5 项（先红后绿） |
| `docs/active/decisions/ADR-0074-model-write-atomicity.md` | 决策档（Accepted） |
| `docs/active/delivery/evidence/ONT-MODEL-WRITE-ATOMICITY-ACCEPTANCE.md` | 本文件 |

**修改**：

| 文件 | 改动 |
| --- | --- |
| `v2_kernel/pg_repo.py` | `upsert_object_type` 单事务（类型行 + `_sync_parent_axiom`）+ 失败整体回滚；新增 `ModelValidationUnavailable`；接口校验读取失败 fail-closed |
| `v2_kernel/api.py` | `ModelValidationUnavailable` → **503**（可重试）；破坏性变更门禁读取失败 fail-closed（503） |

## 3. 实现要点与安全

- **原子性**：`_sync_parent_axiom(cur, row)` 在**同一 cursor** 写公理；任一步失败 →
  `conn.rollback()` + 抛出。更新场景失败**保持旧版本**（不会落成半成品）。
- **fail-closed**：无法确认一致性（读取失败）→ 拒绝落库；503 与 422 语义分离
  （依赖不可用 vs 调用方数据错误）。
- **草稿宽松 / 发布严格**：`ont_schema_wip` 仍可暂存不合规引用；发布链
  （`upsert_object_type`，`apply-schema-wip` 复用）强制接口一致性校验。
- 不新增表/迁移；不改 `upsert_axiom_record`（服务 Axiom CRUD 端点）。

## 4. 测试命令与真实结果（2026-09-23 实测）

| 命令 / 用例 | 结果 |
| --- | --- |
| `pytest .../integration/test_ont_model_write_atomicity.py -q`（**修复前**） | **3 failed / 2 passed** —— 公理故障不回滚 ×2、接口读取失败 = 通过 ×1，全部复现 |
| 同上（**修复后**） | **5 passed** |
| `pytest packages/mate-tech-ont/tests -q` | **见 §4.1** |
| `ruff check` + `ruff format --check`（改动文件） | ✅ 净 |

**覆盖**：

| 场景 | 断言 |
| --- | --- |
| 注入公理写故障（新建） | 抛出且类型**不落库**、无公理残留 |
| 注入公理写故障（更新） | 抛出且**旧版本保持**（display_name / parent_class 均未变） |
| 接口存储读取失败 | 抛非 KeyError 的异常（fail-closed），类型不落库 |
| 草稿 vs 发布 | 违规引用可存 WIP；`upsert_object_type` 拒绝（`requires property`）；补齐后成功 |
| 正对照 | 类型 + subclass 公理同落，层级读回一致 |

### 4.1 全量 ont 套件

> **`pytest packages/mate-tech-ont/tests -q` → 536 passed / 0 failed / 0 skipped**（94.79s；
> 基线 531 + 本批新增 5）。

## 5. 已知边界

1. 事务范围 = 「类型行 + 派生公理」；**跨类型**结构变更不在单事务内。
2. `_sync_parent_axiom` 只 upsert 不删历史公理（沿用「清空 parent = 禁用」语义）。
3. 读取失败一律 503，需调用方重试；本批不做自动重试。
4. 契约未变（`ontCreateV2ObjectType` / `ontApplyV2SchemaWip` 路径与 schema 未动）。
5. **回滚**：`git revert` 本批提交即退回。

## 6. 结论

**准出达成**：模型修改（类型 + 层级公理）在失败条件下**整体回滚**；发布期一致性校验
**读取失败不再视为通过**；草稿/发布边界显式化。均为先红后绿的真跑用例。

## CI 门禁与证据（LOOP-ROLLOUT-01 模板字段）

| job | 硬规则 | 本批状态 |
| --- | --- | --- |
| ga-001-openapi | 1 Swagger 没有接口不写 route | ✅ 未改路径/契约（仅错误码语义新增 503 分支） |
| ga-002-requirement-ids | 2 PRD 没有 Requirement ID | ✅ `FR-ONT-MODEL-WRITE-ATOMICITY`（本文件 §头部） |
| ga-003-tenant | 3 没有 tenant 上下文不访问 repository | ✅ 写入经 `tenant_scope`；测试用专用库 + 专用租户 `modatomic` |
| ga-004-acl-client | 4 外部系统没有 ACL Client | N/A 无外部调用 |
| ga-005-no-fallback | 5 Production profile 禁止 fallback | ✅ **本批核心**：读取失败不得视为通过（fail-closed，503） |
| ga-006-static | 6 静态检查失败不合并 | ✅ `ruff check`/`format` 净 |
| ga-007-skip-tests | 7 契约或集成测试跳过不标记 Accepted | ✅ 新增 5 项全真跑 |
| ga-008-helm | 8 没有 K8s readiness + 回滚 | N/A 无 K8s 改动；回滚见 §5.5 |
| ga-009-otel | 9 没有审计、指标、trace | ✅ 沿用既有 OTel 中间件；失败路径抛异常不再静默 |
| ga-010-evidence | 10 所有状态以验收证据为准 | ✅ **本文件即数据源** |
| ga-011-helm-docs | 11 helm-docs 同步子 chart README | N/A 无 chart 改动 |
| ga-012-secret-scan | 12 Secret 不进 git | ✅ 无 secret 入 diff |
| ga-013-networkpolicy | 13 NetworkPolicy 缺失 = prod 不通过 | N/A 无网络策略改动 |

**证据**：本文件。**命令**：见 §4 测试表。
