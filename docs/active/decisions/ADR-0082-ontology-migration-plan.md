# ADR-0082：模型发布 Migration Plan（存量实例适配 · 评估/执行/记录）

- **状态**：Accepted（2026-10-07）
- **日期**：2026-10-07
- **关联**：ADR-0080（草稿与版本机制 —— 其 §5 边界"Migration Plan 作为后续增量的输入条件"即本 ADR）、
  ADR-0073（数据同步一致性 —— `props_src` 字段级来源优先级）、ADR-0074（模型写入原子性）、
  MP-ONTOLOGY-RELEASE-01（季度计划 Sprint 4：Draft→Diff→Review→Publish→**Migration Plan**→Rollback）
- **范围**：ObjectType 面的存量实例适配；发布语义本身不变（破坏性确认门禁不动）

## 1. 背景

ADR-0080 交付版本机制时明确不承诺数据迁移。本次勘察确认**两类悬空**：

### 1.1 家族发布后实例整体不可见（缺陷，此前未登记）

`branch_object_type` 同族发布（`deal.v1 → deal.v2`）在同一事务内置旧 rid `archived=TRUE`
并写新 rid，但**不更新 `ont_individual.class_rid`**。而所有实例查询按 rid 解析
（`_resolve_source_classes`：自身 + 后代，**无家族语义**），于是：

- 新 rid 下查实例 = **0 行**（数据还在库里，产品面全部不可见）；
- 数据同步也救不回：sync 写实例的 `ON CONFLICT (rid) DO UPDATE` 不更新 `class_rid`
  （实例 rid `ont.<tenant>.ind.<slug>.<pk>` 家族稳定，rid 冲突命中后 class_rid 永停旧版本）。

实例 rid 本就按**家族 slug**（不含版本号）构造，同族发布不改变任何实例 rid ——
重挂只需改 `class_rid` 一列，无重写风险。`merge_object_types` 已确立同类重映射模式。

### 1.2 属性级悬空（ADR-0080 §5 已登记）

同 rid 覆盖发布（草稿 apply / 直接 `POST /object-types` / branch 后编辑新版）产生：

| 变更 | 存量后果 |
| --- | --- |
| 删属性 | `props` JSONB 残留旧 prop rid 键（`props_src` / `ont_edit_overlay` / 背挂数据源 `field_mapping` 同样残留） |
| 属性 format 变化 | 存量值与新声明不符（string 列里存着数字语义值，或反之） |
| 主键变更 | 实例 rid（内嵌 pk 值）与 `primary_key` 列失配；新 pk 派生可能撞已有 rid |

`detect_destructive_changes`（kernel）已能**检出**这些变更（发布确认门禁用），
但没有对应的**处置**能力 —— 本 ADR 补的就是这一段。

## 2. 决策

### 2.1 总口径：评估 → 执行 → 记录，三步走

Migration Plan = 发布后对存量实例的**声明式适配**。发布本身语义不变：
破坏性确认（`confirm_name`）门禁、乐观并发（`expected_checksum`）冲突口径都不动。

### 2.2 家族发布自动携带实例（修 §1.1 缺陷）

`upsert_object_type` 的 supersede 路径在**同一事务**内执行：

```sql
UPDATE ont_individual SET class_rid = <新rid>
WHERE class_rid = ANY(<被下线的旧rids>) AND tenant_id = <租户>;
```

并写一条 `kind='reattach'` 的迁移记录（计数入档）。理由：

- 不做 = 数据不可见缺陷继续存在，"Migration Plan"沦为显式补票；
- 同事务 = 不出现"新版已生效、实例还挂旧版"的中间态；
- rid 家族稳定 = 无需重写实例 rid / 关系实例（与 merge 的跨家族场景不同）。

同时给 sync 的 `ON CONFLICT (rid) DO UPDATE` 补 `class_rid = EXCLUDED.class_rid`
（防御性：家族发布后管道同步不再把 class_rid 停留在旧版本）。

### 2.3 属性级迁移：默认不丢数据

计划由 kernel 纯函数 `build_migration_plan(old_def, new_def, options)` 构建，步骤分五类：

| 步骤 | 判定 | 处置 | 默认 |
| --- | --- | --- | --- |
| **rename** | 旧 prop rid 有**同 slug**（rid 第 4 段）的新后继 | `props` / `props_src` / `ont_edit_overlay` / `field_mapping` 四处键重映射；显式 mapping 覆盖猜测 | 按 slug 自动配对 |
| **drop** | 旧 prop rid 无后继（真删除） | `preserve`：保留键 + 计数报警；`drop`：删除键（**信息损失，评估里明示不可逆**） | **preserve** |
| **coerce** | 保留属性的 format 变化 | 仅**无损**转换（`"123"`→123、number→string、整型 widening）；不可无损 → 保留原值 + 计数报警，不猜 | lossless only |
| **pk_rederive** | 主键集合变化 | 从新 pk 属性值重派生实例 rid + 同步改写 `ont_link_instance.src/dst`（REPLACE 模式，同 merge）；**冲突或缺失默认整单拒执行**（无部分写），可显式 `skip`（跳过该实例并报告） | fail-closed |
| **reattach** | §2.2 的自动携带（独立成记录，不进显式计划） | 同事务 class_rid 重挂 | 自动 |

复合主键 v1 **不支持**重派生（评估如实报告 `unsupported`，不静默）。

### 2.4 评估先行（只读）

`POST /object-types/{rid}/migration/assess` 不写任何数据，输出：

- 分类变更清单（reuse `detect_destructive_changes` / `diff_object_types` 的分类口径）；
- **真实计数**（SQL 级：受影响实例数、悬空键数、格式不符数、PK 冲突/缺失数、待重挂数）；
- 默认计划草案（含每步的预估影响与信息损失标注）。

`baseline` 缺省 = 家族上一条版本快照；`target` 缺省 = 当前 live 定义。
草稿页预检（`ontValidateV2Model`）与发布页共用本评估。

### 2.5 执行幂等、可审计、防漂移

- 新表 **`ont_migration_run`**：`run_id` / `tenant_id` / `class_rid` / `kind`
  （`reattach` | `plan`）/ `from_checksum` / `to_checksum` / `plan`(JSONB) /
  `status` / `counts`(JSONB) / `author` / `idempotency_key` / `created_at`；
  `(tenant_id, idempotency_key)` 唯一 —— 同键重放**回放原结果**（不重复执行）。
  沿 `ont_type_version` 先例做显式租户过滤，不进 RLS 9 表清单。
- `POST /object-types/{rid}/migration/run` 要求：
  - `Idempotency-Key` 头（缺 → 400，reuse `_require_idempotency_key`）；
  - `expected_checksum` 与当前 live 不符 → **409 `E409_VERSION_CONFLICT`**
    （与 ADR-0080 §2.5 同一 code，语义同为"你以为的基线已经过期"）。
- 执行**单事务**（各步骤原子；PK fail-closed 在写前预检，无部分写）。

### 2.6 回滚口径不变

模型回滚仍只回滚模型（ADR-0080 §2.6）。迁移记录跨回滚保留，
"发布 → 迁移 → 回滚"链条可追溯。反向迁移 = 对旧定义再跑一次正向计划；
**drop 掉的数据不可逆** —— 评估阶段明示，不做影子备份表。

### 2.7 R1 引用、计划和数据范围（2026-10-08）

- 家族键沿用 `(tenant, slug)`。live、baseline 引用、版本行的 class_rid 及其
  definition、target 草稿必须属于该租户和家族；快照读取显式按租户过滤。
  跨租户引用返回 403，同租户跨家族或非法定义返回 422，未找到返回 404。
- 评估请求的可选 `baseline`、`target_payload`、`options` 允许 null，与省略字段
  同义（现有前端默认序列化方式）；空字符串 baseline 也保留默认基线语义。
  非 null 的字段仍按引用、ObjectType 对象、选项对象严格校验。
- 执行根据家族内真实快照的 `from_checksum` 和当前 live 重建规范计划，仅允许
  显式 rename、drops=preserve/drop、pk_missing=abort/skip。未知字段、非法类型、
  伪造校验和/目标/format/reattach、越界属性或扩大步骤范围返回 422。
- R1 将 `POST /api/v1/ont/v2/object-types/{rid}/migration/run` 请求中 `plan`
  的 `class_rid`、`from_checksum`、`renames`、`coercions`、`pk_rederive`、`drops`、
  `reattach`、`warnings` 八个字段全部设为必填；适用的空对象、空数组和 null
  仍按完整规范计划表达。此为明确接受的安全性兼容过渡，属于破坏性契约收紧，
  不声明向后兼容。曾发送不完整计划的客户端须先调用 assess，再将评估返回的
  完整计划交给 run；当前默认页面已遵循此路径。服务端不补齐缺失字段，
  不放宽未知字段或伪造计划校验。
  两条 oasdiff CI 门共用
  [精确诊断清单](../../../mate-platform-backend/contracts/openapi/oasdiff-r1-approved-errors.txt)，
  仅批准该方法、路径与八条新增必填请求属性的完整诊断；保留 `--fail-on ERR`，
  其他字段、接口和破坏性错误仍阻断。后续扩大过渡范围须先修订 ADR 并重新评审。
- 执行前按 tenant 和家族 class_rid 成员资格锁定实例集合；全部步骤、来源、覆盖层、
  PK/关系端点重写共用该集合（PK 重写后更新集合中的 RID）；数据源映射按同租户家族限定。
  RID 前缀不作为成员资格依据。drop 同时移除目标来源、覆盖及映射中的旧键。
- rename 默认冲突即整体回滚：同一目标实例的 props 或 props_src、覆盖层，以及同一
  数据源映射已同时具有源/目标键时，返回 409 `E409_MIGRATION_RENAME_CONFLICT`，
  说明实例/数据源和字段。按键存在判冲突，即使值为 null 或相等也不覆盖。
  不同来源键指向同一目标、非移除属性作为来源、非新增属性作为目标均拒绝。
- 本节不扩展调度/同步声明迁移、rename 与 PK/coerce 组合、数值精度、并发或重放指纹；
  这些继续由 R2/R3 处理。模型回滚和复合主键边界不变。

## 3. 不做的

- LinkType / Interface 变更的迁移（本批只做 ObjectType 面）。
- 复合主键重派生。
- 大数据量分批 / 后台长跑迁移（单事务执行；生产规模分批登记为后续边界）。
- 版本审批流（Review/Approve）与发布包编排 —— 仍属 `MP-ONTOLOGY-RELEASE-01` 后续。
- drop 数据的恢复 / 影子备份。
- 不改破坏性确认门禁与乐观并发口径（ADR-0080 已定）。

## 4. 实施与验证

- **kernel**：`mate_kernel/ontology/migration.py` —— 计划模型（dataclass 步骤）+
  `build_migration_plan`（纯函数：old/new `ObjectType` + options → plan）+
  无损转换判定 + 信息损失标注。不碰 SQL。
- **repo**：`v2_kernel/pg_repo.py` —— supersede 同事务 reattach；`assess_migration`
  （SQL 计数）；`run_migration`（单事务 + run 记录 + 幂等回放）；`list_migration_runs`；
  `ont_migration_run` DDL；sync `ON CONFLICT` 补 `class_rid`。
- **API**：`v2_kernel/api.py` —— `ontAssessV2Migration` / `ontRunV2Migration` /
  `ontListV2MigrationRuns` 三端点；跨租户 403 / 缺幂等键 400 / 漂移 409。
- **契约**：`services/ont.yaml` + `platform.yaml` 重建 + `REQUIREMENT-MATRIX`
  （`FR-ONT-RELEASE-MIGRATION`）。
- **前端**：`kernel.ts` 三函数；`ReleasesPage`「存量适配」面板（评估/执行/历史）；
  `DraftsPage` 预检加影响计数；governance E2E 扩展。
- **测试**：`tests/integration/test_ont_migration_plan.py`（先红后绿，~17 项，
  PG fixture 复用 version-mechanism 模式）。
- **证据**：`ONT-MIGRATION-PLAN-ACCEPTANCE.md`。

## 5. 已知边界

- `ont_migration_run` 不进 RLS 强制清单（显式租户过滤先例：`ont_type_version` 同）。
- coerce 的"无损"集合是白名单（string↔number 的可解析子集、number→string、整型 widening）；
  其余 format 对（date/bool 等）一律保留原值 + 报警。
- PK `skip` 选项跳过的实例**不迁移**（class_rid 照常、rid 不重派生），在 run 记录里逐条列出。
- 评估计数与执行计数可能因并发写入存在极小窗口差异（评估只读不加锁）；执行按执行时数据为准。
