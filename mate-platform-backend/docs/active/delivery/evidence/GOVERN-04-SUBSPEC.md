# GOVERN-04 实施规格：KERNEL-01 12 基元 PG 持久化补齐

> 编制：2026-08-07
> 范围：mate-platform-backend/packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py
> 关联：plan §3 GOVERN-04 / ADR-0021（12 KERNEL-01 primitives）/ evidence/RUNTIME-MVP-02-ACCEPTANCE.md
> 收口证据：本文件即 ACCEPTANCE；落地后并入 evidence/KERNEL-01-PG-FULL-ACCEPTANCE.md

## 0. TL;DR

- 11 个基元（除 Function 执行器外）的 PG 持久化全部接通，5 个 stub `return 入参` 改为真 SQL。
- `apply_action` InMemory 与 PG 行为对齐（都走 `ActionService.apply`：submission_criteria + Function 落库 + side_effects + 审计 + 回滚占位）。
- 8 张 PG 表 DDL 全部落地：`ont_object_type` / `ont_individual` / `ont_action_type` / `ont_link_type` / `ont_interface` / `ont_link_instance` / `ont_axiom` / `ont_function`。
- Function 基元本体（`upsert_function` / `list_functions`）在 GOVERN-04 落地；但 Function **执行器接通**（`ActionService.register_function` 真 invoke + Function Sandbox）归 GOVERN-05。
- 11 基元 × ≥3 单测 + 5 stub 集成测（psql DSN 可达时）；GOVERN-10 负责 pre-existing 3 个 fixture leak 修复。

## 1. 现状盘点（pg_repo.py 现状）

### 1.1 已真接（不动）

| 基元 | 方法 | 行号 | 状态 |
|---|---|---|---|
| ClassRef | `resolve_class_ref` | 199-200 | ✅ |
| Version | `snapshot_version` / `list_versions` | 202-219 | ✅（versions 表归 MVP-02 后续） |
| ObjectType | `upsert_object_type` / `get_object_type` / `list_object_types` | 223-280 | ✅ |
| ActionType | `upsert_action_type` / `list_action_types` / `get_action_type` | 286-378 | ✅ |
| Individual | `create_individual` / `get_individual` / `list_individuals` | 382-441 | ✅ |
| ObjectSet | `evaluate_object_set` | 465-497 | ✅ |

### 1.2 stub（必须真接，本批范围）

| 基元 | 方法 | 行号 | 现状 | 目标 |
|---|---|---|---|---|
| LinkType | `upsert_link_type` | 282-284 | `return lt` | `INSERT … ON CONFLICT (rid) DO UPDATE` |
| LinkType | `list_link_types` | 326-327 | `return []` | `SELECT` |
| LinkType | `get_link_type` | 356-357 | `raise KeyError` | `SELECT WHERE rid` |
| Interface | `upsert_interface` | 320-321 | `return i` | `INSERT … ON CONFLICT (rid) DO UPDATE` |
| Interface | `list_interfaces` | 353-354 | `return []` | `SELECT` |
| Property | `upsert_property` | 323-324 | `return p` | `INSERT … ON CONFLICT (rid) DO UPDATE`（拆出独立表，避免被 OT/LT/AT/IF 各自序列化时丢失） |
| LinkInstance | `create_link_instance` | 443-444 | `return li` | `INSERT … ON CONFLICT (rid) DO UPDATE` |
| LinkInstance | `list_link_instances` | 446-447 | `return []` | `SELECT WHERE tenant_id` |
| Axiom | `upsert_axiom` | 451-452 | `return ax` | `INSERT … ON CONFLICT (rid) DO UPDATE` |
| Axiom | `list_axioms` | 454-455 | `return []` | `SELECT` |
| Function | `upsert_function` | 457-458 | `return f` | `INSERT … ON CONFLICT (rid) DO UPDATE` |
| Function | `list_functions` | 460-461 | `return []` | `SELECT` |

### 1.3 行为分叉（必须对齐，本批范围）

`PgOntologyRepository.apply_action` (499-527) 直接 `UPDATE ont_individual SET updated_at` + 旁路 side_effects JSON，不走 `ActionService.apply`。

`InMemoryOntologyRepository.apply_action` (160-205) 已走 ActionService（submission_criteria / Function / side_effects / 审计）。

**目标**：PG 也走 ActionService。两条 path 必须语义一致：
1. submission_criteria 全部通过（SimpleRuleEvaluator）— 失败 → `SubmissionCriteriaFailed`
2. side_effects 发出（ActionService 记录到 outcome.side_effects_emitted）
3. Function 落库（GOVERN-04 仅保留接口；GOVERN-05 接 register_function + 真 invoke）
4. 审计字段 actor / tenant_id / sandbox_id（GOVERN-04 仅记录 actor + tenant_id）
5. 失败回滚（rollback_hook 占位，GOVERN-05 接 Function Sandbox 后真接）

## 2. DDL 增量（5 张新表）

```sql
CREATE TABLE IF NOT EXISTS ont_link_type (
    rid            TEXT PRIMARY KEY,
    tenant_id      TEXT NOT NULL,
    src_rid        TEXT NOT NULL,
    dst_rid        TEXT NOT NULL,
    cardinality    TEXT NOT NULL,
    directionality TEXT NOT NULL,
    link_properties JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ont_lt_tenant ON ont_link_type (tenant_id);

CREATE TABLE IF NOT EXISTS ont_interface (
    rid          TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL,
    properties   JSONB NOT NULL DEFAULT '[]'::jsonb,
    required_links TEXT[] NOT NULL DEFAULT '{}',
    polymorphic_action_constraints TEXT[] NOT NULL DEFAULT '{}',
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ont_if_tenant ON ont_interface (tenant_id);

CREATE TABLE IF NOT EXISTS ont_property (
    rid          TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL,
    type_id      TEXT NOT NULL DEFAULT 'string',
    nullable     BOOLEAN NOT NULL DEFAULT TRUE,
    primary_key  BOOLEAN NOT NULL DEFAULT FALSE,
    title        TEXT NOT NULL DEFAULT '',
    format       TEXT NOT NULL DEFAULT 'string',
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ont_prop_tenant ON ont_property (tenant_id);

CREATE TABLE IF NOT EXISTS ont_link_instance (
    rid             TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL,
    link_type_rid   TEXT NOT NULL,
    src             TEXT NOT NULL,
    dst             TEXT NOT NULL,
    props           JSONB NOT NULL DEFAULT '{}'::jsonb,
    marking         TEXT[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ont_li_tenant ON ont_link_instance (tenant_id);
CREATE INDEX IF NOT EXISTS ix_ont_li_src ON ont_link_instance (src);
CREATE INDEX IF NOT EXISTS ix_ont_li_dst ON ont_link_instance (dst);

CREATE TABLE IF NOT EXISTS ont_axiom (
    rid        TEXT PRIMARY KEY,
    tenant_id  TEXT NOT NULL,
    kind       TEXT NOT NULL,
    operands   TEXT[] NOT NULL DEFAULT '{}',
    rule_ref   TEXT NOT NULL DEFAULT '',
    metadata   JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ont_ax_tenant ON ont_axiom (tenant_id);

CREATE TABLE IF NOT EXISTS ont_function (
    rid        TEXT PRIMARY KEY,
    tenant_id  TEXT NOT NULL,
    language   TEXT NOT NULL,
    version    INTEGER NOT NULL DEFAULT 1,
    source_ref TEXT NOT NULL DEFAULT '',
    signatures JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ont_fn_tenant ON ont_function (tenant_id);
```

合计 8 张表，全部带 `tenant_id + updated_at`，全部用 `IF NOT EXISTS` 幂等。索引全部带 `tenant_id` 前缀。

## 3. 应用层映射

### 3.1 _row_to_* helpers

复用现有 `_ot_to_row` / `_row_to_ot` / `_row_to_individual` 模式，新增：

- `_lt_to_row(lt: LinkType)` / `_row_to_lt(row)`
- `_if_to_row(i: Interface)` / `_row_to_if(row)`
- `_prop_to_row(p: Property)` / `_row_to_prop(row)`
- `_li_to_row(li: LinkInstance)` / `_row_to_li(row)`
- `_ax_to_row(ax: Axiom)` / `_row_to_ax(row)`
- `_fn_to_row(f: Function)` / `_row_to_fn(row)`

### 3.2 upsert_* 实现

每个 `upsert_x` 模式：

```python
def upsert_x(self, x: X) -> X:
    self._ensure_schema()
    row = _x_to_row(x)
    conn, _ = self._connect()
    try:
        with self._cursor(conn) as cur:
            cur.execute(
                """INSERT INTO ont_x (...)
                   VALUES (...)
                   ON CONFLICT (rid) DO UPDATE SET
                     .. = EXCLUDED..,
                     updated_at = now()""",
                (...),
            )
        conn.commit()
        return x
    finally:
        conn.close()
```

### 3.3 list_* 实现

每个 `list_x` 模式：

```python
def list_xs(self) -> list[X]:
    self._ensure_schema()
    conn, _ = self._connect()
    try:
        with self._cursor(conn) as cur:
            cur.execute("SELECT * FROM ont_x ORDER BY rid")
            rows = cur.fetchall()
        return [_row_to_x(r) for r in rows]
    finally:
        conn.close()
```

**注意**：所有 `list_*` 当前不带 tenant 过滤（v2_kernel/api.py 走 require_tenant 字符串前缀兜底；PG RLS 由 GOVERN-06 加）。本批保留现状行为，不在 list 层重复过滤，避免与 RLS 双重保护打架。

### 3.4 get_link_type 修复

```python
def get_link_type(self, rid: ClassRef) -> LinkType:
    self._ensure_schema()
    conn, _ = self._connect()
    try:
        with self._cursor(conn) as cur:
            cur.execute("SELECT * FROM ont_link_type WHERE rid = %s", (rid.rid,))
            row = cur.fetchone()
        if row is None:
            raise KeyError(f"LinkType not found: {rid.rid}")
        return _row_to_lt(row)
    finally:
        conn.close()
```

### 3.5 apply_action 重写（PG 路径走 ActionService）

```python
def apply_action(
    self,
    action_rid: ClassRef,
    target_iid: str,
    parameters: dict[str, Any],
    provenance: dict[str, Any],
) -> tuple[datetime, list[str]]:
    from mate_kernel.action.engine import ActionService, SubmissionContext
    from dataclasses import replace
    self._ensure_schema()
    at = self.get_action_type(action_rid)
    ind = self.get_individual(target_iid)
    target_props = {k.rid: v for k, v in ind.props}
    outcome = self._action_service.apply(
        action_rid=at.rid.rid,
        submission_criteria=at.submission_criteria,
        function_ref=at.function_ref.rid,
        on_rid=at.on[0].rid if at.on else "",
        target_iid=target_iid,
        parameters=parameters,
        side_effects=at.side_effects,
        ctx=SubmissionContext(
            actor=str(provenance.get("actor", "?")),
            tenant_id=str(provenance.get("tenant_id", ind.tenant_id)),
        ),
        target_props=target_props,
    )
    now = outcome.applied_at
    if parameters:
        param_rids = {p.rid.rid.split(".")[-2]: p.rid for p in at.parameters if "." in p.rid.rid}
        merged = dict(ind.props)
        for key, value in parameters.items():
            resolved = ClassRef(key) if key.startswith("ont.") else param_rids.get(key)
            if resolved is None:
                raise KeyError(f"unknown parameter {key!r} for action={action_rid}")
            merged[resolved] = value
        ind_new = replace(ind, props=tuple(merged.items()), updated_at=now)
        self.create_individual(ind_new)
    return now, outcome.side_effects_emitted
```

并 `__init__` 增 `self._action_service = ActionService()`，与 InMemory 对齐。

## 4. 测试矩阵

### 4.1 单元 / 集成测试（psql DSN 可达时跑；不可达则 skip）

落在 `packages/mate-tech-ont/tests/integration/test_v2_kernel_pg_e2e.py`，复用现有 `repo` fixture + `_clean_pg`（扩 5 张新表）：

| 基元 | 测试 | 断言 |
|---|---|---|
| LinkType | `test_upsert_link_type_round_trip` | upsert → get 字段全等 |
| LinkType | `test_list_link_types_returns_seeded` | upsert 3 个 → list 长度 = 3 |
| Interface | `test_upsert_interface_round_trip` | properties / required_links / polymorphic_action_constraints 全等 |
| Property | `test_upsert_property_round_trip` | 独立表，OT 引用不到时仍可读 |
| LinkInstance | `test_create_link_instance_round_trip` | rid + src/dst/marking 全等 |
| LinkInstance | `test_list_link_instances_filters_by_tenant`（注：list 不带 tenant 过滤，但 RLS 由 GOVERN-06 加，本测只验证返回结构） |
| Axiom | `test_upsert_axiom_round_trip` | kind / operands / metadata 全等 |
| Axiom | `test_list_axioms_returns_seeded` | upsert 2 → list 长度 = 2 |
| Function | `test_upsert_function_round_trip` | language / version / source_ref 全等 |
| Function | `test_list_functions_returns_seeded` | upsert 2 → list 长度 = 2 |
| apply_action | `test_apply_action_submission_criteria_failed` | submission_criteria 含 `status == 'pending'`，parameters 不传 status → SubmissionCriteriaFailed |
| apply_action | `test_apply_action_side_effects_emitted` | upsert AT with side_effects=('emit.outbox.audit',) → outcome.side_effects_emitted 含 'emit.outbox.audit' |
| apply_action | `test_apply_action_writes_props` | upsert AT with parameters 含 `decision` 短名 → individual.props 含 decision 参数 Property rid |

合计 13 个新测，加上原有 5 个 PG e2e = 18 个；加入 InMemory 5 个 = 23。

### 4.2 不在本批范围（属后续）

- 3 个 pre-existing fixture leak 失败（plan §A2） — 归 GOVERN-10
- Function 执行器接通（register_function + 真 invoke + Function Sandbox） — 归 GOVERN-05
- PG RLS FORCE POLICY — 归 GOVERN-06

## 5. 验收

- `grep "return lt$\|return i$\|return p$\|return li$\|return ax$\|return f$" packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py` 0 命中（除合法 list 空返回注释）
- `psql $PG_DSN -c "\dt ont_*"` 返回 8 张表
- `python -m pytest packages/mate-tech-ont/tests/integration/test_v2_kernel_pg_e2e.py -v` 全部 pass 或 skip（无 PG 时）
- `python -m pytest packages/mate-tech-ont/tests/integration/test_v2_kernel_e2e.py -v` InMemory 全部 pass
- ruff 触达文件 0 error

## 6. 落地文件清单

- 修改：`packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py`（+~200 行）
- 修改：`packages/mate-tech-ont/tests/integration/test_v2_kernel_pg_e2e.py`（+~150 行；扩 `_clean_pg` + 13 新测）
- 新建：`packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/_row_codecs.py`（拆出 _row_to_* 辅助，避免 pg_repo.py 单文件过 700 行；可选）

## 7. 风险

| 风险 | 缓解 |
|---|---|
| psql 不可达时 13 个新测全 skip | 标 skip + reason；CI 必须有 PG sidecar 才跑全量 |
| apply_action 重写与 InMemory 路径字段不一致 | 复用 InMemory 末尾的 parameters→props 合并逻辑（line 188-205），行为对位 |
| 5 张新表 DDL 与已有 DDL 命名冲突 | `IF NOT EXISTS` + 字段名不冲突 |
| LinkInstance.rid 校验已在 dataclass `__post_init__` 强制 `ont.<tenant>.lnk.` 前缀 | 落到 PG 时不重复校验（数据来源已校验） |

## 8. 未尽事项

- 11 基元 PG RLS FORCE POLICY（Alembic 0013 + ALTER TABLE … ENABLE/FORCE ROW LEVEL SECURITY）— GOVERN-06
- Function.register_function 真接 + Function Sandbox execute — GOVERN-05
- 3 个 pre-existing fixture leak 失败 — GOVERN-10
- 8 CI workflow 与 13 ga-* job 对位矩阵 — GOVERN-10