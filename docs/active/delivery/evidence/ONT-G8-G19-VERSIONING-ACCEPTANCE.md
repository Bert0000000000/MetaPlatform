# ONT-G8+G19 ACCEPTANCE — 类型版本管理（rollback/diff/branch）

> **日期**: 2026-09-08 · **PRD**: PRD-36 `[x]` · **部署**: mate-tech-ont（prd worktree 挂载源）

## 交付
kernel `versioning_ops.diff_object_types`（纯函数）+ pg_repo `branch/diff/rollback_object_type`
（`ont_type_version` lineage 表）+ REST 三端点（ontBranchV2ObjectType / ontDiffV2ObjectType /
ontRollbackV2ObjectType，路由置于通配 `{rid:path}` GET 之前——修复了 path 转换器吞后缀的 500）。

## Live（经网关 8100 · 真 PG，无 mock）
1. branch v1→v2 → 200，v2 定义=v1 ✅
2. diff 同定义 → has_changes:false ✅
3. v2 加 price → diff `has_changes:true, added:['verdemo-price']` ✅
4. rollback v2←v1 → GET v2 display 恢复 "VerDemo v1" ✅

## 测试
kernel diff 4/4（identical/added/removed+changed/type-change）。

## 修复记录
- to_thread 线程 `_current_tenant()`=None → tenant 从 rid 派生
- API→repo 传参补 ClassRef 包装
- 三路由前移解决 `{rid:path}` 通配吞并
