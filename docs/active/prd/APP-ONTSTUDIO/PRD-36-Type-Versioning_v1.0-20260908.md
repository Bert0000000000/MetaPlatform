# PRD-36 本体类型版本管理（ONT-G8+G19）

> **版本**: v1.0 · **日期**: 2026-09-08 · **状态**: `[x]` Accepted（live 全链验证）
> **Requirement IDs**: FR-VER-001..004 · **关联**: 蓝图 §7.7 / pg_repo / Sprint 1

## 范围与验收
- FR-VER-001 branch：`POST /object-types/{rid}/branch`（body new_rid/note）→ 复制当前定义 + `ont_type_version` lineage
- FR-VER-002 diff：`GET /object-types/{rid}/diff?against=` → added/removed/changed/has_changes
- FR-VER-003 rollback：`POST /object-types/{rid}/rollback`（body from_rid）→ 定义恢复 + lineage 记录
- FR-VER-004 kernel 纯函数 `versioning_ops.diff_object_types`（4/4 单测）

## Live 记录（2026-09-08，经网关 8100 · 真 PG）
1. POST branch v1→v2 → 200 v2 定义=v1 ✅
2. diff 同定义 → has_changes:false ✅
3. v2 upsert 加 price → diff → `has_changes:true added:['verdemo-price']` ✅
4. rollback v2←v1 → v2 display_name 恢复 "VerDemo v1" ✅
