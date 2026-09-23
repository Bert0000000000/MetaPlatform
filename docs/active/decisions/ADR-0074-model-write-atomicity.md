# ADR-0074：模型写入原子性与发布期一致性校验（fail-closed）

- **状态**：Accepted（2026-09-23）
- **日期**：2026-09-23
- **关联**：ADR-0021（Kernel 12 基元）、EXP-01（浅层级 / Interface 约束）、
  MP-DEDUP-01（slug 冲突）、13 硬规则 #5（禁止 fake success）

## 1. 背景

`pg_repo.py::upsert_object_type` 是 ObjectType 的**唯一写入链**（`POST /object-types`
与 `POST /object-types/wip/{rid}/apply` 都经它）。实测发现三处缺陷：

1. **非原子**：类型行先 `conn.commit()`（`pg_repo.py:1413`），随后在**另一个事务**里写
   `parent_class` 派生的 subclass 公理，且

   ```python
   except Exception:
       # 公理同步失败不阻断类型落库（G21 查询自然退化为精确匹配）
       pass
   ```

   —— 公理写失败被**吞掉**，留下「有类型、无公理」的半成品：层级树/子类闭包查询与
   模型详情不一致，且无人知晓。
2. **读取失败视为通过**（接口校验）：`_validate_registered_interfaces` 的

   ```python
   try:
       interfaces = self.list_interfaces()
   except Exception:
       return          # ← 读取失败 = 跳过校验 = 通过
   ```

   接口存储抖动即静默跳过申报接口的一致性校验。
3. **读取失败视为通过**（破坏性变更门禁）：`api.py` 的 `POST /object-types` 中

   ```python
   except KeyError:
       destructive = []
   except Exception:
       destructive = []    # ← 读取失败 = 无破坏性变更 = 放行
   ```

   破坏性变更（删属性/改主键/改 parent）在读取失败时可被静默绕过。

## 2. 决策

### 2.1 类型行 + 派生公理同一事务

`upsert_object_type` 的单事务内完成：slug 冲突预检 → 类型行 upsert → `_sync_parent_axiom`
（同一 `cursor`）。任一步失败 **整体回滚** 并向上抛出；不再有「先提交类型再吞公理异常」。
`_sync_parent_axiom` 只在 rid 形态不支持派生时 no-op（结构上无公理可写），不吞异常。

### 2.2 校验所需读取失败一律 fail-closed

新增 `ModelValidationUnavailable(RuntimeError)`：无法确认一致性（读取失败）时**拒绝落库**。
API 翻译为 **503**（依赖不可用、可重试），与 422（调用方数据错误）区分。

- 接口一致性校验：读取失败 → `ModelValidationUnavailable`；
- 破坏性变更门禁：`KeyError`（类型不存在）仍视为「无破坏性变更」，其它读取异常 → 503。

### 2.3 草稿宽松 / 发布严格（维持并显式化）

- **草稿**（`ont_schema_wip` 暂存）保持宽松：允许未解析/不合规引用先落草稿；
- **发布**（`upsert_object_type`，`apply-schema-wip` 复用）必须完成接口/引用一致性校验，
  且**读取失败不得视为通过**（§2.2）。

## 3. 不做的

- 不改 `upsert_axiom_record` 的独立事务语义（它服务于 Axiom CRUD 端点；层级公理改走
  `_sync_parent_axiom`）。
- 不新增「发布」专用端点：`apply-schema-wip` 已委托同一门禁链，改一处即覆盖两处。
- 不引入新的迁移/表。

## 4. 实施与验证

- **实现**：`pg_repo.py`（单事务 + `_sync_parent_axiom` + `ModelValidationUnavailable` +
  接口校验 fail-closed）、`api.py`（503 映射 + 破坏性门禁 fail-closed）。
- **测试**：`tests/integration/test_ont_model_write_atomicity.py`（5 项，先红后绿）：
  注入公理写故障 → 新类型不落库 / 更新场景旧版本保持；接口读取失败 → 拒绝；
  草稿可存违规引用但发布拒绝；正对照类型+公理同落且层级一致。
- **证据**：`docs/active/delivery/evidence/ONT-MODEL-WRITE-ATOMICITY-ACCEPTANCE.md`。

## 5. 已知边界

- 单事务范围是「类型行 + 派生公理」；**跨类型**的结构性变更（如批量迁移）不在本事务内。
- `_sync_parent_axiom` 只做 upsert，不删除历史公理记录（沿用原语义：清空 parent = 禁用）。
- 读取失败一律 503，调用方需重试；本批不做自动重试。
